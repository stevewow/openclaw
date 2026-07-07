import crypto from "node:crypto";
import { callTool, listTools } from "../../../extensions/spiro/api.js";
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
  amount: number;
  dateCreated: number | null;
  dateDue: number;
  daysPastDue: number;
  orderCount: number;
};

export type PastDueAccount = {
  accountKey: string;
  accountName: string;
  accountType: "company" | "agent" | "unknown";
  balance: number;
  invoiceCount: number;
  oldestDaysPastDue: number;
  bucket: PastDueBucket;
  action: { label: string; detail: string };
  paymentPlan: { requiredDown: number; maxMonths: number };
};

export type PastDueBreakdown = {
  generatedAt: number;
  refreshedAt: number | null;
  totalPastDue: number;
  accountCount: number;
  invoiceCount: number;
  byBucket: Array<{ bucket: PastDueBucket; accounts: number; amount: number }>;
  accounts: PastDueAccount[];
};

export type FinancialNote = {
  id: string;
  accountKey: string;
  body: string;
  createdBy: string | null;
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
  dateCreated: number | null;
  dateDue: number;
  orderCount: number;
};

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
  const cached: CachedInvoice[] = [];
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
      if (inv) cached.push(inv);
    }
    if (sawPaid || !hasNextPage || invoices.length === 0) break;
  }

  const db = getAdminDb();
  const now = Date.now();
  await db.deleteFrom("admin_spiro_invoices").execute();
  if (cached.length > 0) {
    await db
      .insertInto("admin_spiro_invoices")
      .values(
        cached.map((inv) => ({
          invoice_id: inv.invoiceId,
          reference_number: inv.referenceNumber,
          status: inv.status,
          account_key: inv.accountKey,
          account_name: inv.accountName,
          account_type: inv.accountType,
          amount_total: inv.amountTotal,
          date_created: inv.dateCreated,
          date_due: inv.dateDue,
          order_count: inv.orderCount,
          cached_at: now,
        })),
      )
      .execute();
  }

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
      count: number;
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
      count: 0,
      oldest: 0,
    };
    entry.balance += row.amount_total;
    entry.count += 1;
    entry.oldest = Math.max(entry.oldest, daysPastDue);
    byAccount.set(row.account_key, entry);
  }

  const accounts: PastDueAccount[] = Array.from(byAccount.entries())
    .map(([accountKey, v]) => {
      const bucket = bucketForDays(v.oldest);
      return {
        accountKey,
        accountName: v.name,
        accountType: v.type,
        balance: Math.round(v.balance * 100) / 100,
        invoiceCount: v.count,
        oldestDaysPastDue: v.oldest,
        bucket,
        action: policyAction(bucket),
        paymentPlan: paymentPlanTerms(v.balance),
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

  const { refreshedAt } = await getInvoiceRefreshStatus();

  return {
    generatedAt: now,
    refreshedAt,
    totalPastDue: Math.round(accounts.reduce((s, a) => s + a.balance, 0) * 100) / 100,
    accountCount: accounts.length,
    invoiceCount: accounts.reduce((s, a) => s + a.invoiceCount, 0),
    byBucket,
    accounts,
  };
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
    createdAt: r.created_at,
  }));
}

export async function addNote(params: {
  accountKey: string;
  body: string;
  createdBy: string | null;
}): Promise<FinancialNote> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db
    .insertInto("admin_financial_notes")
    .values({
      id,
      account_key: params.accountKey,
      body: params.body,
      created_by: params.createdBy,
      created_at: now,
    })
    .execute();
  return {
    id,
    accountKey: params.accountKey,
    body: params.body,
    createdBy: params.createdBy,
    createdAt: now,
  };
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
