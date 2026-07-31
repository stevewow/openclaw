import crypto from "node:crypto";
import { callTool, listTools } from "../../../extensions/spiro/api.js";
import {
  defaultCase,
  listPastDueCases,
  PAST_DUE_CASE_STATUSES,
  type PastDueCase,
  type PastDueCaseStatus,
} from "./past-due-cases-store.js";
import { lastContactByAccount, type LastContact } from "./past-due-contacts-store.js";
import { type ContactIndex, loadContactIndex, lookupContact } from "./pipedrive-contacts-store.js";
import { getAdminDb } from "./user-store.js";

// ── Collections policy ────────────────────────────────────────────────────
// Buckets and next-actions mirror WOW Video Tours' written collection process.
// A bucket is chosen by an account's OLDEST past-due invoice (worst case).
export type PastDueBucket = "1-44" | "45-59" | "60-89" | "90-119" | "120+";

export const PAST_DUE_BUCKETS: PastDueBucket[] = ["1-44", "45-59", "60-89", "90-119", "120+"];

// Policy action surfaced per bucket. Kept declarative so the UI and any future
// automation read the same source of truth.
export function bucketForDays(daysPastDue: number): PastDueBucket {
  if (daysPastDue >= 120) return "120+";
  if (daysPastDue >= 90) return "90-119";
  if (daysPastDue >= 60) return "60-89";
  if (daysPastDue >= 45) return "45-59";
  return "1-44";
}

export function policyAction(bucket: PastDueBucket): { label: string; detail: string } {
  switch (bucket) {
    case "1-44":
      return { label: "Monitor", detail: "First billing email is due at 45 days past due." };
    case "45-59":
      return {
        label: "Send billing email",
        detail: "45-day billing email from billing.",
      };
    case "60-89":
      return {
        label: "Billing call + notify BDS",
        detail: "60-day billing call. Notify BDS. Switch payment plan to pay-at-download.",
      };
    case "90-119":
      return {
        label: "Billing call / final email",
        detail:
          "90-day billing call. If no answer, send final collection email. Switch payment plan to pay-at-order.",
      };
    case "120+":
      return {
        label: "Letter → refer to collections",
        detail:
          "Letter sent 14 days after last contact with a 30-day deadline. Notify BDS. Refer to collections if no payment or plan by the deadline.",
      };
  }
}

// Payment-plan terms per policy: 10% down, term capped by balance size.
export function paymentPlanTerms(balance: number): { requiredDown: number; maxMonths: number } {
  return {
    requiredDown: Math.round(balance * 0.1 * 100) / 100,
    maxMonths: balance < 1000 ? 3 : 6,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────
export type PastDueInvoice = {
  invoiceId: string;
  referenceNumber: string | null;
  status: string | null;
  /** Invoiced total, before anything the client has paid against it. */
  amount: number;
  /** Paid so far. Null when Spiro did not report a figure. */
  amountPaid: number | null;
  /** Still owed. Falls back to the invoiced total when Spiro reports nothing. */
  outstanding: number;
  partiallyPaid: boolean;
  dateCreated: number | null;
  dateDue: number;
  daysPastDue: number;
  orderCount: number;
};

export type PastDueAccount = {
  accountKey: string;
  accountName: string;
  accountType: "company" | "agent" | "unknown";
  /** Still owed across the account's past-due invoices. */
  balance: number;
  /** Invoiced total across those invoices, before payments. */
  invoiced: number;
  /** Paid against those invoices so far. */
  paid: number;
  invoiceCount: number;
  /** Past-due invoices carrying a partial payment. Drives the review flag. */
  partiallyPaidCount: number;
  /**
   * A partially paid invoice means the balance shown here is not the whole
   * story — a plan, a dispute, or a short payment sits behind it — so the
   * account is held out for a human to read before any collections step.
   */
  needsManualReview: boolean;
  oldestDaysPastDue: number;
  bucket: PastDueBucket;
  action: { label: string; detail: string };
  paymentPlan: { requiredDown: number; maxMonths: number };
  case: PastDueCase;
  /**
   * When anyone last reached this client. A contact logged by a collector wins
   * over Pipedrive activity: it is about this debt, not about any dealing with
   * the client, and `source` says which one is being shown.
   */
  lastContact: {
    at: number;
    source: "logged" | "pipedrive";
    channel: string | null;
    byName: string | null;
    /** Who we matched in Pipedrive, so a wrong name match is visible. */
    matchedName: string | null;
  } | null;
  /** Whole days since that contact, or null when nobody has reached them. */
  daysSinceContact: number | null;
};

export type PastDueBreakdown = {
  generatedAt: number;
  refreshedAt: number | null;
  totalPastDue: number;
  accountCount: number;
  invoiceCount: number;
  manualReviewCount: number;
  byBucket: Array<{ bucket: PastDueBucket; accounts: number; amount: number }>;
  byStatus: Array<{ status: PastDueCaseStatus; accounts: number; amount: number }>;
  accounts: PastDueAccount[];
};

export type FinancialNote = {
  id: string;
  accountKey: string;
  body: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: number;
};

// ── Spiro invoice tool resolution ─────────────────────────────────────────
// Spiro's REST API exposes GET /api/v1/invoices (InvoiceListItemModel). The MCP
// server wraps it as a tool; the exact name isn't guaranteed, so resolve the
// preferred name first and fall back to a fuzzy "invoice" match, mirroring the
// order-report store's approach.
const PREFERRED_INVOICES_TOOL = "search_spiro_invoices";

let invoicesToolName: string | null = null;

async function resolveInvoicesToolName(): Promise<string> {
  if (invoicesToolName) return invoicesToolName;
  const tools = await listTools();
  const match =
    tools.find((t) => t.name === PREFERRED_INVOICES_TOOL) ??
    tools.find((t) => /^search.*invoice/i.test(t.name)) ??
    tools.find((t) => /invoice/i.test(t.name));
  if (!match) {
    throw new Error(
      "No Spiro tool matching 'invoice' found. Run /spiro-auth to connect Spiro, then check available tools.",
    );
  }
  invoicesToolName = match.name;
  return match.name;
}

// ── Field extraction (defensive against MCP envelope drift) ────────────────
function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function firstString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function firstNumber(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function parseDateMs(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) {
      const ms = Date.parse(v);
      if (Number.isFinite(ms)) return ms;
    }
  }
  return null;
}

type CachedInvoice = {
  invoiceId: string;
  referenceNumber: string | null;
  status: string | null;
  accountKey: string;
  accountName: string;
  accountType: "company" | "agent" | "unknown";
  amountTotal: number;
  amountPaid: number | null;
  amountDue: number | null;
  dateCreated: number | null;
  dateDue: number;
  orderCount: number;
};

// What the client still owes on one invoice. Spiro's InvoiceAmountModel reports
// `amountDue` (total less payments, credits and adjustments); it is the figure
// to collect on. Older cached rows predate the column, so fall back to the
// invoiced total — the pre-existing behavior — rather than guessing zero.
function outstandingOf(row: { amount_total: number; amount_due: number | null }): number {
  return row.amount_due ?? row.amount_total;
}

// True when money has landed against an invoice that is still not settled.
// `status` carries Spiro's own label ("PartiallyPaid"); the amount comparison
// catches a row whose status string drifts or is missing.
function isPartiallyPaid(row: {
  status: string | null;
  amount_total: number;
  amount_paid: number | null;
  amount_due: number | null;
}): boolean {
  if ((row.status ?? "").toLowerCase().replace(/[\s_-]/g, "") === "partiallypaid") {
    return true;
  }
  const paid = row.amount_paid ?? 0;
  return paid > 0 && outstandingOf(row) > 0;
}

// Smart payee grouping: bill whoever actually owes. Spiro's InvoicePartyModel
// carries payeeType plus company/agent ids+names. Group by company when the
// payee is the company (or only a company id is present), otherwise by the agent.
function deriveAccount(party: Record<string, unknown>): {
  accountKey: string;
  accountName: string;
  accountType: "company" | "agent" | "unknown";
} {
  const payeeType = (firstString(party, ["payeeType", "payee_type"]) ?? "").toLowerCase();
  const companyId = firstString(party, ["companyId", "company_id"]);
  const companyName = firstString(party, ["companyName", "company_name"]);
  const agentId = firstString(party, ["agentId", "agent_id"]);
  const agentName = firstString(party, ["agentName", "agent_name"]);

  const preferCompany =
    payeeType.includes("company") || payeeType.includes("brokerage") || (!!companyId && !agentId);

  if (preferCompany && (companyId || companyName)) {
    return {
      accountKey: `company:${companyId ?? companyName}`,
      accountName: companyName ?? "Unknown company",
      accountType: "company",
    };
  }
  if (agentId || agentName) {
    return {
      accountKey: `agent:${agentId ?? agentName}`,
      accountName: agentName ?? "Unknown agent",
      accountType: "agent",
    };
  }
  if (companyId || companyName) {
    return {
      accountKey: `company:${companyId ?? companyName}`,
      accountName: companyName ?? "Unknown company",
      accountType: "company",
    };
  }
  return { accountKey: "unknown", accountName: "Unknown payee", accountType: "unknown" };
}

function extractInvoice(raw: Record<string, unknown>): CachedInvoice | null {
  const invoiceId = firstString(raw, ["invoiceId", "invoice_id", "id"]);
  if (!invoiceId) return null;

  // Only unpaid invoices are relevant to collections. dateFullyPaid !== null
  // means the invoice has been settled; skip it.
  const paidMs = parseDateMs(raw, ["dateFullyPaid", "date_fully_paid"]);
  if (paidMs !== null) return null;

  const dateDue = parseDateMs(raw, ["dateDue", "date_due", "dueDate", "due_date"]);
  if (dateDue === null) return null; // no due date → cannot age it

  const party = asObject(raw.party) ?? raw;
  const amountObj = asObject(raw.amount);
  const amountTotal =
    (amountObj ? firstNumber(amountObj, ["total", "amount", "grandTotal"]) : null) ??
    firstNumber(raw, ["total", "amount", "amountTotal", "totalInvoiceAmount"]) ??
    0;

  const account = deriveAccount(party);

  return {
    invoiceId,
    referenceNumber: firstString(raw, ["referenceNumber", "reference_number"]),
    status: firstString(raw, ["status"]),
    accountKey: account.accountKey,
    accountName: account.accountName,
    accountType: account.accountType,
    amountTotal,
    amountPaid: amountObj ? firstNumber(amountObj, ["amountPaid", "amount_paid"]) : null,
    amountDue: amountObj ? firstNumber(amountObj, ["amountDue", "amount_due"]) : null,
    dateCreated: parseDateMs(raw, ["dateCreated", "date_created"]),
    dateDue,
    orderCount: firstNumber(raw, ["orderCount", "order_count"]) ?? 0,
  };
}

// search_spiro_invoices replies as {content:[{type:"text", text:"<json>"}]} where
// the JSON parses to {data: Invoice[], meta: {hasNextPage, ...}}. Falls back to a
// few reasonable shapes in case the MCP envelope changes.
function parsePagedInvoicesResult(result: unknown): {
  invoices: Array<Record<string, unknown>>;
  hasNextPage: boolean;
} {
  let payload: unknown = result;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    const content = (obj as { content?: Array<{ type: string; text?: string }> }).content;
    const textPart = content?.find((c) => c.type === "text")?.text;
    if (textPart) {
      try {
        payload = JSON.parse(textPart) as unknown;
      } catch {
        payload = obj;
      }
    }
  }
  if (Array.isArray(payload))
    return { invoices: payload as Array<Record<string, unknown>>, hasNextPage: false };
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["data", "invoices", "items", "results"]) {
      const v = obj[key];
      if (Array.isArray(v)) {
        const meta = asObject(obj.meta);
        return {
          invoices: v as Array<Record<string, unknown>>,
          hasNextPage: meta?.hasNextPage === true,
        };
      }
    }
  }
  return { invoices: [], hasNextPage: false };
}

const PAGE_SIZE = 200;
const MAX_PAGES = 200; // 200 * 200 = 40,000 invoices ceiling — generous safety cap.
const INSERT_CHUNK = 200; // rows per insert; keeps bound-parameter count well under SQLite's cap.
const REFRESH_LOG_KEY = "invoices";

// ── Refresh ────────────────────────────────────────────────────────────────
export async function refreshInvoices(opts: { manual: boolean }): Promise<{ count: number }> {
  const toolName = await resolveInvoicesToolName();

  // The account holds ~75k invoices but only a few hundred are unpaid. Sorting by
  // dateFullyPaid ascending places every unpaid invoice (dateFullyPaid = null)
  // strictly before any paid one — verified live against the connected account —
  // so we page through the unpaid block and stop the moment a page yields a paid
  // invoice. A refresh then reads only the relevant few hundred rows, not all 75k,
  // and stays complete regardless of which status values count as unpaid.
  // Key by invoiceId to dedupe. Sorting by dateFullyPaid puts every unpaid
  // invoice (dateFullyPaid = null) ahead of any paid one, but the order *within*
  // that null block is not stable across pages, so the same invoice can surface
  // on more than one page. Deduping here both prevents a PRIMARY KEY collision
  // on insert and stops an invoice's balance from being counted twice.
  const cachedById = new Map<string, CachedInvoice>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await callTool(toolName, { sort: "dateFullyPaid", page, pageSize: PAGE_SIZE });
    const { invoices, hasNextPage } = parsePagedInvoicesResult(result);
    let sawPaid = false;
    for (const raw of invoices) {
      if (parseDateMs(raw, ["dateFullyPaid", "date_fully_paid"]) !== null) {
        sawPaid = true; // sorted null-first: this row and all after it are paid
        break;
      }
      const inv = extractInvoice(raw);
      if (inv) cachedById.set(inv.invoiceId, inv);
    }
    if (sawPaid || !hasNextPage || invoices.length === 0) break;
  }
  const cached = [...cachedById.values()];

  const db = getAdminDb();
  const now = Date.now();
  // Replace the snapshot atomically: the page reads straight from this table, so
  // a delete that is not followed by a successful insert must never be visible.
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("admin_spiro_invoices").execute();
    for (let i = 0; i < cached.length; i += INSERT_CHUNK) {
      await trx
        .insertInto("admin_spiro_invoices")
        .values(
          cached.slice(i, i + INSERT_CHUNK).map((inv) => ({
            invoice_id: inv.invoiceId,
            reference_number: inv.referenceNumber,
            status: inv.status,
            account_key: inv.accountKey,
            account_name: inv.accountName,
            account_type: inv.accountType,
            amount_total: inv.amountTotal,
            amount_paid: inv.amountPaid,
            amount_due: inv.amountDue,
            date_created: inv.dateCreated,
            date_due: inv.dateDue,
            order_count: inv.orderCount,
            cached_at: now,
          })),
        )
        .execute();
    }
  });

  await db
    .insertInto("admin_spiro_invoice_refresh_log")
    .values({ id: REFRESH_LOG_KEY, refreshed_at: now, manual: opts.manual ? 1 : 0 })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({ refreshed_at: now, manual: opts.manual ? 1 : 0 }),
    )
    .execute();

  return { count: cached.length };
}

export async function getInvoiceRefreshStatus(): Promise<{ refreshedAt: number | null }> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_spiro_invoice_refresh_log")
    .selectAll()
    .where("id", "=", REFRESH_LOG_KEY)
    .executeTakeFirst();
  return { refreshedAt: row?.refreshed_at ?? null };
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

// ── Queries ──────────────────────────────────────────────────────────────
/**
 * Pick which "last contact" to show. A logged contact always wins when it is at
 * least as recent as Pipedrive's: it was made about this debt, by someone whose
 * name we can show, on a channel we know.
 */
export function resolveLastContact(params: {
  logged: LastContact | null;
  pipedrive: ContactIndex | null;
  name: string;
  type: "company" | "agent" | "unknown";
}): PastDueAccount["lastContact"] {
  const match = params.pipedrive
    ? lookupContact(params.pipedrive, { name: params.name, type: params.type })
    : null;
  const crmAt = match?.lastActivityAt ?? null;
  const logged = params.logged;

  if (logged && (crmAt === null || logged.at >= crmAt)) {
    return {
      at: logged.at,
      source: "logged",
      channel: logged.channel,
      byName: logged.byName,
      matchedName: null,
    };
  }
  if (crmAt !== null && match) {
    return {
      at: crmAt,
      source: "pipedrive",
      channel: null,
      byName: null,
      matchedName: match.matchedName,
    };
  }
  return null;
}

export async function getPastDueBreakdown(now = Date.now()): Promise<PastDueBreakdown> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_spiro_invoices")
    .selectAll()
    .where("date_due", "<", now)
    .execute();

  const byAccount = new Map<
    string,
    {
      name: string;
      type: "company" | "agent" | "unknown";
      balance: number;
      invoiced: number;
      paid: number;
      count: number;
      partial: number;
      oldest: number;
    }
  >();
  for (const row of rows) {
    const daysPastDue = daysBetween(row.date_due, now);
    if (daysPastDue < 1) continue;
    const entry = byAccount.get(row.account_key) ?? {
      name: row.account_name,
      type: (row.account_type as "company" | "agent" | "unknown") ?? "unknown",
      balance: 0,
      invoiced: 0,
      paid: 0,
      count: 0,
      partial: 0,
      oldest: 0,
    };
    entry.balance += outstandingOf(row);
    entry.invoiced += row.amount_total;
    entry.paid += row.amount_paid ?? 0;
    entry.count += 1;
    if (isPartiallyPaid(row)) {
      entry.partial += 1;
    }
    entry.oldest = Math.max(entry.oldest, daysPastDue);
    byAccount.set(row.account_key, entry);
  }

  const cases = await listPastDueCases();
  const logged = await lastContactByAccount();
  // The CRM directory is optional: unconfigured or never swept simply means the
  // column falls back to what collectors logged themselves.
  let pipedrive: ContactIndex | null = null;
  try {
    pipedrive = await loadContactIndex();
  } catch {
    pipedrive = null;
  }

  const accounts: PastDueAccount[] = Array.from(byAccount.entries())
    .map(([accountKey, v]) => {
      const bucket = bucketForDays(v.oldest);
      const lastContact = resolveLastContact({
        logged: logged.get(accountKey) ?? null,
        pipedrive,
        name: v.name,
        type: v.type,
      });
      return {
        accountKey,
        accountName: v.name,
        accountType: v.type,
        balance: Math.round(v.balance * 100) / 100,
        invoiced: Math.round(v.invoiced * 100) / 100,
        paid: Math.round(v.paid * 100) / 100,
        invoiceCount: v.count,
        partiallyPaidCount: v.partial,
        needsManualReview: v.partial > 0,
        oldestDaysPastDue: v.oldest,
        bucket,
        action: policyAction(bucket),
        paymentPlan: paymentPlanTerms(v.balance),
        case: cases.get(accountKey) ?? defaultCase(accountKey, v.name, now),
        lastContact,
        daysSinceContact: lastContact ? Math.max(0, daysBetween(lastContact.at, now)) : null,
      };
    })
    .sort((a, b) => b.oldestDaysPastDue - a.oldestDaysPastDue || b.balance - a.balance);

  const byBucket = PAST_DUE_BUCKETS.map((bucket) => {
    const inBucket = accounts.filter((a) => a.bucket === bucket);
    return {
      bucket,
      accounts: inBucket.length,
      amount: Math.round(inBucket.reduce((s, a) => s + a.balance, 0) * 100) / 100,
    };
  });

  const byStatus = PAST_DUE_CASE_STATUSES.map(({ key }) => {
    const inStatus = accounts.filter((a) => a.case.status === key);
    return {
      status: key,
      accounts: inStatus.length,
      amount: Math.round(inStatus.reduce((s, a) => s + a.balance, 0) * 100) / 100,
    };
  });

  const { refreshedAt } = await getInvoiceRefreshStatus();

  return {
    generatedAt: now,
    refreshedAt,
    totalPastDue: Math.round(accounts.reduce((s, a) => s + a.balance, 0) * 100) / 100,
    accountCount: accounts.length,
    invoiceCount: accounts.reduce((s, a) => s + a.invoiceCount, 0),
    manualReviewCount: accounts.filter((a) => a.needsManualReview).length,
    byBucket,
    byStatus,
    accounts,
  };
}

/**
 * The same breakdown, cut down to one person's assigned accounts. A collections
 * assignee is granted the report to work their own queue, not to read the
 * company's total exposure, so the tiles and bucket counts are recomputed over
 * the accounts they can actually see rather than filtering rows under
 * company-wide totals.
 */
export function scopeBreakdownToAssignee(
  breakdown: PastDueBreakdown,
  userId: string,
): PastDueBreakdown {
  const accounts = breakdown.accounts.filter((a) => a.case.assignedTo === userId);
  const sum = (list: PastDueAccount[]) =>
    Math.round(list.reduce((s, a) => s + a.balance, 0) * 100) / 100;
  return {
    ...breakdown,
    totalPastDue: sum(accounts),
    accountCount: accounts.length,
    invoiceCount: accounts.reduce((s, a) => s + a.invoiceCount, 0),
    manualReviewCount: accounts.filter((a) => a.needsManualReview).length,
    byBucket: PAST_DUE_BUCKETS.map((bucket) => {
      const inBucket = accounts.filter((a) => a.bucket === bucket);
      return { bucket, accounts: inBucket.length, amount: sum(inBucket) };
    }),
    byStatus: PAST_DUE_CASE_STATUSES.map(({ key }) => {
      const inStatus = accounts.filter((a) => a.case.status === key);
      return { status: key, accounts: inStatus.length, amount: sum(inStatus) };
    }),
    accounts,
  };
}

/**
 * Display name for an account, from the invoice snapshot. Falls back to the key
 * so a case can still be written for an account whose invoices have since been
 * paid off and dropped out of the snapshot.
 */
export async function getAccountName(accountKey: string): Promise<string> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_spiro_invoices")
    .select("account_name")
    .where("account_key", "=", accountKey)
    .executeTakeFirst();
  return row?.account_name ?? accountKey;
}

export async function getAccountInvoices(
  accountKey: string,
  now = Date.now(),
): Promise<{ accountName: string; invoices: PastDueInvoice[] }> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_spiro_invoices")
    .selectAll()
    .where("account_key", "=", accountKey)
    .where("date_due", "<", now)
    .execute();

  const invoices: PastDueInvoice[] = rows
    .map((row) => ({
      invoiceId: row.invoice_id,
      referenceNumber: row.reference_number,
      status: row.status,
      amount: Math.round(row.amount_total * 100) / 100,
      amountPaid: row.amount_paid === null ? null : Math.round(row.amount_paid * 100) / 100,
      outstanding: Math.round(outstandingOf(row) * 100) / 100,
      partiallyPaid: isPartiallyPaid(row),
      dateCreated: row.date_created,
      dateDue: row.date_due,
      daysPastDue: daysBetween(row.date_due, now),
      orderCount: row.order_count,
    }))
    .filter((i) => i.daysPastDue >= 1)
    .sort((a, b) => b.daysPastDue - a.daysPastDue);

  return { accountName: rows[0]?.account_name ?? accountKey, invoices };
}

// ── Notes ──────────────────────────────────────────────────────────────────
export async function listNotes(accountKey: string): Promise<FinancialNote[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_financial_notes")
    .selectAll()
    .where("account_key", "=", accountKey)
    .orderBy("created_at", "desc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    accountKey: r.account_key,
    body: r.body,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  }));
}

const MAX_NOTE_LEN = 2000;

export async function addNote(params: {
  accountKey: string;
  body: string;
  createdBy: string | null;
  createdByName?: string | null;
}): Promise<FinancialNote> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  const body = params.body.trim().slice(0, MAX_NOTE_LEN);
  await db
    .insertInto("admin_financial_notes")
    .values({
      id,
      account_key: params.accountKey,
      body,
      created_by: params.createdBy,
      created_by_name: params.createdByName ?? null,
      created_at: now,
    })
    .execute();
  return {
    id,
    accountKey: params.accountKey,
    body,
    createdBy: params.createdBy,
    createdByName: params.createdByName ?? null,
    createdAt: now,
  };
}

export async function getNote(id: string): Promise<FinancialNote | null> {
  const db = getAdminDb();
  const r = await db
    .selectFrom("admin_financial_notes")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return r
    ? {
        id: r.id,
        accountKey: r.account_key,
        body: r.body,
        createdBy: r.created_by,
        createdByName: r.created_by_name,
        createdAt: r.created_at,
      }
    : null;
}

export async function deleteNote(id: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_financial_notes").where("id", "=", id).execute();
}

// ── Scheduler ────────────────────────────────────────────────────────────
let schedulerStarted = false;
export function ensureFinancialsScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
  const STALE_MS = 6 * 60 * 60 * 1000; // refresh if older than 6 hours
  const tick = async () => {
    try {
      const { refreshedAt } = await getInvoiceRefreshStatus();
      if (!refreshedAt || Date.now() - refreshedAt > STALE_MS) {
        await refreshInvoices({ manual: false });
      }
    } catch {
      // Spiro not connected yet, or transient failure — retry next tick.
    }
  };
  void tick();
  setInterval(() => void tick(), CHECK_INTERVAL_MS).unref();
}
