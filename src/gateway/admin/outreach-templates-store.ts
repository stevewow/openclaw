// Outreach scripts for collections calls and emails.
//
// A template is editable text with merge fields — `{{account}}`, `{{balance}}`
// and friends — that a collector picks on an account and gets back filled in and
// ready to send. The point is that the wording stays consistent across whoever
// is working the queue, and that nobody retypes a balance and gets it wrong.
//
// Merge fields are resolved against the account the collector is looking at.
// An unknown field is left visible as `{{whatever}}` rather than blanked: a
// script with a gap in it is obvious, a script with a silent blank is not.

import { randomUUID } from "node:crypto";
import { getAdminDb } from "./user-store.js";

export type OutreachChannelKind = "call" | "email" | "letter" | "text";

export const OUTREACH_KINDS: Array<{ key: OutreachChannelKind; label: string }> = [
  { key: "call", label: "Call script" },
  { key: "email", label: "Email" },
  { key: "letter", label: "Letter" },
  { key: "text", label: "Text" },
];

const KIND_KEYS = new Set<string>(OUTREACH_KINDS.map((k) => k.key));

export function isOutreachKind(value: unknown): value is OutreachChannelKind {
  return typeof value === "string" && KIND_KEYS.has(value);
}

/**
 * The fields a script may use. Documented here because this list is what the
 * editor shows the author — an undocumented field is an unusable one.
 */
export const MERGE_FIELDS: Array<{ token: string; describes: string }> = [
  { token: "account", describes: "Account name (the agent or brokerage)" },
  { token: "balance", describes: "Total still outstanding, formatted" },
  { token: "invoiced", describes: "Total invoiced before payments, formatted" },
  { token: "paid", describes: "Paid so far, formatted" },
  { token: "invoice_count", describes: "How many past-due invoices" },
  { token: "days_past_due", describes: "Days since the oldest invoice fell due" },
  { token: "bucket", describes: "Aging bucket, e.g. 60-89" },
  { token: "next_action", describes: "The policy action for that bucket" },
  { token: "plan_down", describes: "Required down payment for a plan, formatted" },
  { token: "plan_months", describes: "Maximum plan length in months" },
  { token: "last_contact", describes: "When this account was last reached" },
  { token: "owner", describes: "Who the account is assigned to" },
  { token: "today", describes: "Today's date" },
  { token: "me", describes: "The name of whoever is sending it" },
];

export type OutreachTemplate = {
  id: string;
  title: string;
  kind: OutreachChannelKind;
  /** Only meaningful for email; blank for the others. */
  subject: string | null;
  body: string;
  /** Aging buckets this script suits, empty meaning "any". */
  buckets: string[];
  active: boolean;
  sortOrder: number;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: number;
  updatedAt: number;
};

type Row = {
  id: string;
  title: string;
  kind: string;
  subject: string | null;
  body: string;
  buckets: string;
  active: number;
  sort_order: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: number;
  updated_at: number;
};

const MAX_TITLE = 120;
const MAX_SUBJECT = 200;
const MAX_BODY = 20000;

function rowToTemplate(r: Row): OutreachTemplate {
  let buckets: string[] = [];
  try {
    const parsed: unknown = JSON.parse(r.buckets);
    if (Array.isArray(parsed)) {
      buckets = parsed.filter((b): b is string => typeof b === "string");
    }
  } catch {
    buckets = [];
  }
  return {
    id: r.id,
    title: r.title,
    kind: isOutreachKind(r.kind) ? r.kind : "call",
    subject: r.subject,
    body: r.body,
    buckets,
    active: r.active === 1,
    sortOrder: r.sort_order,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listTemplates(
  opts: { includeInactive?: boolean } = {},
): Promise<OutreachTemplate[]> {
  let q = getAdminDb().selectFrom("admin_outreach_templates").selectAll();
  if (!opts.includeInactive) {
    q = q.where("active", "=", 1);
  }
  const rows = (await q.orderBy("sort_order", "asc").orderBy("title", "asc").execute()) as Row[];
  return rows.map(rowToTemplate);
}

export async function getTemplate(id: string): Promise<OutreachTemplate | null> {
  const row = (await getAdminDb()
    .selectFrom("admin_outreach_templates")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst()) as Row | undefined;
  return row ? rowToTemplate(row) : null;
}

export type TemplateInput = {
  title: string;
  kind: OutreachChannelKind;
  subject?: string | null;
  body: string;
  buckets?: string[];
  active?: boolean;
  sortOrder?: number;
};

function clean(input: TemplateInput) {
  const title = input.title.trim().slice(0, MAX_TITLE);
  const body = input.body.slice(0, MAX_BODY);
  if (!title) {
    throw new Error("a template needs a title");
  }
  if (!body.trim()) {
    throw new Error("a template needs some text");
  }
  return {
    title,
    kind: input.kind,
    // A subject on a call script is noise, so it is dropped rather than stored.
    subject:
      input.kind === "email" && input.subject?.trim()
        ? input.subject.trim().slice(0, MAX_SUBJECT)
        : null,
    body,
    buckets: JSON.stringify(
      Array.isArray(input.buckets) ? input.buckets.filter((b) => typeof b === "string") : [],
    ),
    active: input.active === false ? 0 : 1,
    sort_order: Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder as number) : 0,
  };
}

export async function createTemplate(
  input: TemplateInput & { userId: string | null; userName: string | null },
): Promise<OutreachTemplate> {
  const now = Date.now();
  const c = clean(input);
  const row: Row = {
    id: randomUUID(),
    ...c,
    created_by: input.userId,
    created_by_name: input.userName,
    created_at: now,
    updated_at: now,
  };
  await getAdminDb().insertInto("admin_outreach_templates").values(row).execute();
  return rowToTemplate(row);
}

export async function updateTemplate(
  id: string,
  input: TemplateInput,
): Promise<OutreachTemplate | null> {
  const existing = await getTemplate(id);
  if (!existing) {
    return null;
  }
  const c = clean(input);
  await getAdminDb()
    .updateTable("admin_outreach_templates")
    .set({ ...c, updated_at: Date.now() })
    .where("id", "=", id)
    .execute();
  return getTemplate(id);
}

export async function deleteTemplate(id: string): Promise<void> {
  await getAdminDb().deleteFrom("admin_outreach_templates").where("id", "=", id).execute();
}

// ── Merge ──────────────────────────────────────────────────────────────────

export type MergeContext = Record<string, string>;

const TOKEN_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/**
 * Substitute `{{field}}` tokens. An unknown token is left exactly as written so
 * the gap is visible in the draft rather than silently becoming an empty string
 * in something about to be sent to a client.
 */
export function renderTemplate(text: string, ctx: MergeContext): string {
  return (text ?? "").replace(TOKEN_RE, (whole, name: string) => {
    const key = name.toLowerCase();
    return Object.hasOwn(ctx, key) ? ctx[key] : whole;
  });
}

/** Tokens a template uses that the context cannot fill — shown as a warning. */
export function unresolvedFields(text: string, ctx: MergeContext): string[] {
  const out = new Set<string>();
  for (const m of (text ?? "").matchAll(TOKEN_RE)) {
    const key = m[1].toLowerCase();
    if (!Object.hasOwn(ctx, key)) {
      out.add(key);
    }
  }
  return [...out];
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Build the merge context for one past-due account. */
export function mergeContextFor(params: {
  account: {
    accountName: string;
    balance: number;
    invoiced: number;
    paid: number;
    invoiceCount: number;
    oldestDaysPastDue: number;
    bucket: string;
    action: { label: string };
    paymentPlan: { requiredDown: number; maxMonths: number };
    lastContact: { at: number } | null;
    case: { assignedToName: string | null };
  };
  senderName: string | null;
  now?: number;
}): MergeContext {
  const a = params.account;
  const now = params.now ?? Date.now();
  const date = (ms: number) => new Date(ms).toLocaleDateString("en-US");
  return {
    account: a.accountName,
    balance: money(a.balance),
    invoiced: money(a.invoiced),
    paid: money(a.paid),
    invoice_count: String(a.invoiceCount),
    days_past_due: String(a.oldestDaysPastDue),
    bucket: a.bucket,
    next_action: a.action.label,
    plan_down: money(a.paymentPlan.requiredDown),
    plan_months: String(a.paymentPlan.maxMonths),
    last_contact: a.lastContact ? date(a.lastContact.at) : "no previous contact",
    owner: a.case.assignedToName ?? "unassigned",
    today: date(now),
    me: params.senderName ?? "",
  };
}
