import crypto from "node:crypto";
import { getAdminDb } from "./user-store.js";

// Sales leads, wherever they came in from.
//
// The CRM stays the system of record for a deal; this is the intake queue in
// front of it — what arrived, who it went to, and whether anyone has picked it
// up yet. So the model is deliberately thin: the contact, the market, the owner
// it was dispatched to, a status, and an append-only trail.
//
// Everything the form asked that is not one of those columns is kept verbatim
// in `fields`. A question added to the website should land in the Hub the same
// afternoon, not after a migration.

export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
};

/** Statuses that still want someone to do something. Drives the "open" count. */
export const OPEN_LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "qualified"];

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as string[]).includes(value);
}

export type LeadSource = "framer" | "manual";

export type LeadEventKind = "created" | "note" | "status_change" | "dispatch" | "assignment";

export type LeadEvent = {
  id: string;
  leadId: string;
  kind: LeadEventKind;
  authorName: string | null;
  body: string | null;
  createdAt: number;
};

export type Lead = {
  id: string;
  number: string;
  source: LeadSource;
  formName: string | null;
  submissionId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  marketRaw: string | null;
  territoryKey: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  status: LeadStatus;
  pageUrl: string | null;
  /** Every other answer the form sent, in the order it sent them. */
  fields: Array<{ label: string; value: string }>;
  /** Which lead-magnet playbook it arrived on, if it matched one. */
  playbookKey: string | null;
  notifiedAt: number | null;
  notifyError: string | null;
  createdAt: number;
  updatedAt: number;
};

const LEAD_PREFIX = "LEAD-";
const LEAD_SEQ_START = 1000;

type LeadRow = {
  id: string;
  number: string;
  source: string;
  form_name: string | null;
  submission_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  market_raw: string | null;
  territory_key: string | null;
  owner_name: string | null;
  owner_email: string | null;
  status: string;
  page_url: string | null;
  fields: string;
  playbook_key: string | null;
  notified_at: number | null;
  notify_error: string | null;
  created_at: number;
  updated_at: number;
};

function parseFields(raw: string): Array<{ label: string; value: string }> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const label = (entry as { label?: unknown }).label;
      const value = (entry as { value?: unknown }).value;
      if (typeof label !== "string" || typeof value !== "string") {
        return [];
      }
      return [{ label, value }];
    });
  } catch {
    return [];
  }
}

function rowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    number: row.number,
    source: row.source === "manual" ? "manual" : "framer",
    formName: row.form_name,
    submissionId: row.submission_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    message: row.message,
    marketRaw: row.market_raw,
    territoryKey: row.territory_key,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    status: isLeadStatus(row.status) ? row.status : "new",
    pageUrl: row.page_url,
    fields: parseFields(row.fields),
    playbookKey: row.playbook_key,
    notifiedAt: row.notified_at,
    notifyError: row.notify_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function nextLeadNumber(
  trx: import("kysely").Transaction<import("./user-store.js").AdminDb>,
): Promise<string> {
  const row = await trx
    .selectFrom("admin_lead_seq")
    .select("next_number")
    .where("id", "=", 1)
    .executeTakeFirst();
  const current = row?.next_number ?? LEAD_SEQ_START + 1;
  if (row) {
    await trx
      .updateTable("admin_lead_seq")
      .set({ next_number: current + 1 })
      .where("id", "=", 1)
      .execute();
  } else {
    await trx
      .insertInto("admin_lead_seq")
      .values({ id: 1, next_number: current + 1 })
      .execute();
  }
  return `${LEAD_PREFIX}${current}`;
}

export type CreateLeadParams = {
  source?: LeadSource;
  formName?: string | null;
  submissionId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  marketRaw?: string | null;
  territoryKey?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  pageUrl?: string | null;
  fields?: Array<{ label: string; value: string }>;
  playbookKey?: string | null;
};

export async function createLead(params: CreateLeadParams): Promise<Lead> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.transaction().execute(async (trx) => {
    const number = await nextLeadNumber(trx);
    await trx
      .insertInto("admin_leads")
      .values({
        id,
        number,
        source: params.source ?? "framer",
        form_name: params.formName ?? null,
        submission_id: params.submissionId ?? null,
        name: params.name ?? null,
        email: params.email ?? null,
        phone: params.phone ?? null,
        company: params.company ?? null,
        message: params.message ?? null,
        market_raw: params.marketRaw ?? null,
        territory_key: params.territoryKey ?? null,
        owner_name: params.ownerName ?? null,
        owner_email: params.ownerEmail ?? null,
        status: "new",
        page_url: params.pageUrl ?? null,
        fields: JSON.stringify(params.fields ?? []),
        playbook_key: params.playbookKey ?? null,
        notified_at: null,
        notify_error: null,
        created_at: now,
        updated_at: now,
      })
      .execute();
    await trx
      .insertInto("admin_lead_events")
      .values({
        id: crypto.randomUUID(),
        lead_id: id,
        kind: "created",
        author_name: null,
        body: params.formName
          ? `Submitted through ${params.formName}`
          : "Submitted through the website",
        created_at: now,
      })
      .execute();
  });
  const created = await getLead(id);
  if (!created) {
    throw new Error("lead_create_failed");
  }
  return created;
}

export async function getLead(id: string): Promise<Lead | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_leads")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? rowToLead(row) : null;
}

/**
 * The lead a submission id already made, if any.
 *
 * This is the whole of the duplicate defence: Framer retries a webhook up to
 * five times until it gets a 2xx, so the second delivery of a submission has to
 * find the first one and stop.
 */
export async function getLeadBySubmissionId(submissionId: string): Promise<Lead | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_leads")
    .selectAll()
    .where("submission_id", "=", submissionId)
    .executeTakeFirst();
  return row ? rowToLead(row) : null;
}

export type ListLeadsFilter = {
  status?: LeadStatus | "all" | "open";
  territoryKey?: string;
  /** Only leads from the last N days. */
  days?: number;
  /** Free text over name, email, company, market and message. */
  q?: string;
  limit?: number;
};

export async function listLeads(filter: ListLeadsFilter = {}): Promise<Lead[]> {
  const db = getAdminDb();
  let query = db.selectFrom("admin_leads").selectAll();
  if (filter.status && filter.status !== "all") {
    query =
      filter.status === "open"
        ? query.where("status", "in", OPEN_LEAD_STATUSES)
        : query.where("status", "=", filter.status);
  }
  if (filter.territoryKey) {
    query =
      filter.territoryKey === "unassigned"
        ? query.where("territory_key", "is", null)
        : query.where("territory_key", "=", filter.territoryKey);
  }
  if (filter.days && filter.days > 0) {
    query = query.where("created_at", ">=", Date.now() - filter.days * 24 * 60 * 60 * 1000);
  }
  const q = filter.q?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    query = query.where((eb) =>
      eb.or([
        eb(eb.fn("lower", ["name"]), "like", like),
        eb(eb.fn("lower", ["email"]), "like", like),
        eb(eb.fn("lower", ["company"]), "like", like),
        eb(eb.fn("lower", ["market_raw"]), "like", like),
        eb(eb.fn("lower", ["message"]), "like", like),
        eb(eb.fn("lower", ["number"]), "like", like),
      ]),
    );
  }
  const rows = await query
    .orderBy("created_at", "desc")
    .limit(Math.min(filter.limit ?? 500, 2000))
    .execute();
  return rows.map(rowToLead);
}

/** Leads created inside a window, oldest first. What the daily digest reads. */
export async function listLeadsBetween(fromMs: number, toMs: number): Promise<Lead[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_leads")
    .selectAll()
    .where("created_at", ">=", fromMs)
    .where("created_at", "<", toMs)
    .orderBy("created_at", "asc")
    .execute();
  return rows.map(rowToLead);
}

export type LeadSummary = {
  total: number;
  byStatus: Array<{ status: LeadStatus; label: string; count: number }>;
  /** Leads nobody's market matched, which is the one number worth chasing. */
  unrouted: number;
  /** Dispatch emails that did not go out. */
  undelivered: number;
};

export function summarizeLeads(leads: readonly Lead[]): LeadSummary {
  const counts = new Map<LeadStatus, number>();
  let unrouted = 0;
  let undelivered = 0;
  for (const lead of leads) {
    counts.set(lead.status, (counts.get(lead.status) ?? 0) + 1);
    if (!lead.territoryKey) {
      unrouted += 1;
    }
    if (!lead.notifiedAt) {
      undelivered += 1;
    }
  }
  return {
    total: leads.length,
    byStatus: LEAD_STATUSES.map((status) => ({
      status,
      label: LEAD_STATUS_LABELS[status],
      count: counts.get(status) ?? 0,
    })),
    unrouted,
    undelivered,
  };
}

export async function addLeadEvent(params: {
  leadId: string;
  kind: LeadEventKind;
  authorName?: string | null;
  body?: string | null;
}): Promise<LeadEvent> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db
    .insertInto("admin_lead_events")
    .values({
      id,
      lead_id: params.leadId,
      kind: params.kind,
      author_name: params.authorName ?? null,
      body: params.body ?? null,
      created_at: now,
    })
    .execute();
  return {
    id,
    leadId: params.leadId,
    kind: params.kind,
    authorName: params.authorName ?? null,
    body: params.body ?? null,
    createdAt: now,
  };
}

export async function listLeadEvents(leadId: string): Promise<LeadEvent[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_lead_events")
    .selectAll()
    .where("lead_id", "=", leadId)
    .orderBy("created_at", "asc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    kind: (r.kind as LeadEventKind) ?? "note",
    authorName: r.author_name,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function setLeadStatus(
  id: string,
  status: LeadStatus,
  actorName: string | null,
): Promise<Lead | null> {
  const db = getAdminDb();
  const existing = await getLead(id);
  if (!existing) {
    return null;
  }
  if (existing.status === status) {
    return existing;
  }
  await db
    .updateTable("admin_leads")
    .set({ status, updated_at: Date.now() })
    .where("id", "=", id)
    .execute();
  await addLeadEvent({
    leadId: id,
    kind: "status_change",
    authorName: actorName,
    body: `${LEAD_STATUS_LABELS[existing.status]} → ${LEAD_STATUS_LABELS[status]}`,
  });
  return getLead(id);
}

/**
 * Hand a lead to a different desk.
 *
 * Owner name and address are stored on the lead, not looked up through the
 * territory, so a re-route records who has it now without rewriting who was
 * emailed at intake — the trail carries both.
 */
export async function assignLead(
  id: string,
  params: { territoryKey: string | null; ownerName: string | null; ownerEmail: string | null },
  actorName: string | null,
): Promise<Lead | null> {
  const db = getAdminDb();
  const existing = await getLead(id);
  if (!existing) {
    return null;
  }
  await db
    .updateTable("admin_leads")
    .set({
      territory_key: params.territoryKey,
      owner_name: params.ownerName,
      owner_email: params.ownerEmail,
      updated_at: Date.now(),
    })
    .where("id", "=", id)
    .execute();
  await addLeadEvent({
    leadId: id,
    kind: "assignment",
    authorName: actorName,
    body: params.ownerName
      ? `Assigned to ${params.ownerName}${params.ownerEmail ? ` <${params.ownerEmail}>` : ""}`
      : "Unassigned",
  });
  return getLead(id);
}

/** Record the outcome of a dispatch attempt, successful or not. */
export async function recordLeadDispatch(
  id: string,
  result: { ok: true; to: string } | { ok: false; error: string },
): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();
  await db
    .updateTable("admin_leads")
    .set(
      result.ok
        ? { notified_at: now, notify_error: null, updated_at: now }
        : { notify_error: result.error.slice(0, 500), updated_at: now },
    )
    .where("id", "=", id)
    .execute();
  await addLeadEvent({
    leadId: id,
    kind: "dispatch",
    authorName: null,
    body: result.ok ? `Emailed to ${result.to}` : `Email failed: ${result.error.slice(0, 200)}`,
  });
}

export async function deleteLead(id: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_leads").where("id", "=", id).execute();
}
