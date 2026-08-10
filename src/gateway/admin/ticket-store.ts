import crypto from "node:crypto";
import { resolveDepartmentForCategory } from "./ticket-department-store.js";
import { getAdminDb } from "./user-store.js";

// ── Domain vocabulary ─────────────────────────────────────────────────────
// Client-submitted support tickets from the Spiro media-delivery page. Clients
// enter through a guided intake form; management reviews here; the department
// works the ticket from their email inbox. Email in/out wiring lands in a
// later track — this store owns the model, numbers, and activity thread.

export type TicketStatus = "new" | "in_progress" | "needs_review" | "resolved" | "closed";
/**
 * A category key from the admin-managed `admin_ticket_categories` table — data,
 * not a closed union, since admins add their own from the dashboard (the same
 * shape `department` has always had). Validated at the intake boundary against
 * the category store, not by the type system or a DB CHECK.
 */
export type TicketCategory = string;
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketSource = "widget" | "email" | "manual";

export const TICKET_STATUSES: TicketStatus[] = [
  "new",
  "in_progress",
  "needs_review",
  "resolved",
  "closed",
];
/** The seeded category keys. Only a fallback for callers with no DB access. */
export const TICKET_CATEGORIES: TicketCategory[] = [
  "edit_request",
  "additional_service",
  "missing_media",
  "other",
];
export const TICKET_PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];
export const TICKET_SOURCES: TicketSource[] = ["widget", "email", "manual"];

// Default department set. Kept as a small editable list rather than a hard enum
// because WOW's real desk names still need confirmation; the ticket carries a
// free-text department so the routing table can change without a migration.
export const DEFAULT_DEPARTMENTS = ["editing", "operations", "billing", "general"] as const;

// Which desk a category routes to by default. The email track uses this to pick
// the outbound address; the dashboard uses it to pre-fill the department field.
const CATEGORY_DEPARTMENT: Record<string, string> = {
  edit_request: "editing",
  additional_service: "operations",
  missing_media: "operations",
  other: "general",
};

export function defaultDepartmentForCategory(category: TicketCategory): string {
  return CATEGORY_DEPARTMENT[category] ?? "general";
}

// Ticket numbers are human-facing (subject lines, client references). Prefix +
// a monotonic counter seeded above 1000 so the very first ticket reads WVT-1001.
const TICKET_PREFIX = "WVT-";
// Demo/test tickets get their own prefix + counter so they're unmistakable in
// the queue and never advance the real WVT sequence.
const TEST_TICKET_PREFIX = "TEST-";
const TICKET_SEQ_START = 1000;

/**
 * Every prefix a ticket number (and therefore a reply token) can carry.
 *
 * Inbound email matching builds its pattern from this list, so adding a prefix
 * here is all it takes for replies to that ticket class to route. Keeping it
 * beside the minting logic is deliberate: when TEST- was introduced the inbound
 * matcher still only knew WVT-, and every reply to a test ticket was silently
 * dropped as unmatched.
 */
export const TICKET_NUMBER_PREFIXES = [TICKET_PREFIX, TEST_TICKET_PREFIX] as const;

// ── Activity thread ───────────────────────────────────────────────────────
// Every state change and message is an append-only event so the dashboard is a
// faithful mirror of the email conversation and management has an audit trail.
export type TicketEventKind =
  | "created"
  | "comment"
  | "status_change"
  | "assignment"
  | "email_out"
  | "email_in";
export type TicketAuthorType = "client" | "staff" | "system";

export type TicketEvent = {
  id: string;
  ticketId: string;
  kind: TicketEventKind;
  authorType: TicketAuthorType;
  authorName: string | null;
  body: string | null;
  meta: Record<string, unknown> | null;
  createdAt: number;
};

export type Ticket = {
  id: string;
  number: string;
  replyToken: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  subject: string;
  description: string | null;
  department: string;
  requesterName: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  orderId: string | null;
  orderAddress: string | null;
  assignedTo: string | null;
  isTest: boolean;
  /** Sum of the priced choices the client ticked, in whole cents. */
  estimateCents: number | null;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
};

export type CreateTicketParams = {
  category: TicketCategory;
  subject: string;
  description?: string | null;
  priority?: TicketPriority;
  source?: TicketSource;
  department?: string | null;
  requesterName?: string | null;
  requesterEmail?: string | null;
  requesterPhone?: string | null;
  orderId?: string | null;
  orderAddress?: string | null;
  assignedTo?: string | null;
  createdBy?: string | null;
  /** A demonstration ticket — gets a TEST- number and is kept out of stats. */
  isTest?: boolean;
  /** Server-computed total of the priced choices; never taken from the client. */
  estimateCents?: number | null;
};

export type UpdateTicketParams = {
  status?: TicketStatus;
  priority?: TicketPriority;
  department?: string;
  subject?: string;
  description?: string | null;
  assignedTo?: string | null;
};

export type ListTicketFilters = {
  status?: TicketStatus;
  category?: TicketCategory;
  department?: string;
  assignedTo?: string;
  q?: string;
};

type TicketRow = {
  id: string;
  number: string;
  reply_token: string;
  category: string;
  status: string;
  priority: string;
  source: string;
  subject: string;
  description: string | null;
  department: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  order_id: string | null;
  order_address: string | null;
  assigned_to: string | null;
  created_by: string | null;
  is_test: number;
  estimate_cents: number | null;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
};

type TicketEventRow = {
  id: string;
  ticket_id: string;
  kind: string;
  author_type: string;
  author_name: string | null;
  body: string | null;
  meta: string | null;
  created_at: number;
};

function rowToTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    number: row.number,
    replyToken: row.reply_token,
    category: row.category as TicketCategory,
    status: row.status as TicketStatus,
    priority: row.priority as TicketPriority,
    source: row.source as TicketSource,
    subject: row.subject,
    description: row.description,
    department: row.department,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requesterPhone: row.requester_phone,
    orderId: row.order_id,
    orderAddress: row.order_address,
    assignedTo: row.assigned_to,
    isTest: row.is_test === 1,
    estimateCents: row.estimate_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

function rowToEvent(row: TicketEventRow): TicketEvent {
  let meta: Record<string, unknown> | null = null;
  if (row.meta) {
    try {
      meta = JSON.parse(row.meta) as Record<string, unknown>;
    } catch {
      meta = null;
    }
  }
  return {
    id: row.id,
    ticketId: row.ticket_id,
    kind: row.kind as TicketEventKind,
    authorType: row.author_type as TicketAuthorType,
    authorName: row.author_name,
    body: row.body,
    meta,
    createdAt: row.created_at,
  };
}

// ── Reply-command grammar ─────────────────────────────────────────────────
// The department drives a ticket from their inbox: the first non-empty line of
// a reply is read as a command. Kept pure + exported so the email-inbound track
// (and its tests) share exactly this parse. An unrecognized reply never closes
// a ticket — it lands in `needs_review` so nothing falls through the cracks.
export type ReplyCommand = "update" | "resolved" | "none";

export type ParsedReply = { command: ReplyCommand; body: string };

export function parseReplyCommand(text: string): ParsedReply {
  const trimmed = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!trimmed) return { command: "none", body: "" };
  const firstBreak = trimmed.indexOf("\n");
  const firstLine = (firstBreak === -1 ? trimmed : trimmed.slice(0, firstBreak)).trim();
  // Tolerate a trailing ":" / "-" and any following text on the same line.
  const match = firstLine.match(/^(update|resolved)\b[:\-\s]*(.*)$/i);
  if (!match) return { command: "none", body: trimmed };
  const command = match[1]!.toLowerCase() as "update" | "resolved";
  const sameLineRest = match[2]!.trim();
  const rest = firstBreak === -1 ? "" : trimmed.slice(firstBreak + 1).trim();
  const body = [sameLineRest, rest].filter(Boolean).join("\n").trim();
  return { command, body };
}

/** Status a recognized reply command moves the ticket to. `none` → needs_review. */
export function statusForReplyCommand(command: ReplyCommand): TicketStatus {
  switch (command) {
    case "resolved":
      return "resolved";
    case "update":
      return "in_progress";
    case "none":
      return "needs_review";
  }
}

// ── Ticket number ─────────────────────────────────────────────────────────
async function nextTicketNumber(
  trx: import("kysely").Transaction<import("./user-store.js").AdminDb>,
  isTest: boolean,
): Promise<{ number: string; replyToken: string }> {
  // Real and test tickets draw from separate counters so demos never advance
  // the client-facing WVT sequence.
  const seqTable = isTest ? "admin_ticket_test_seq" : "admin_ticket_seq";
  const prefix = isTest ? TEST_TICKET_PREFIX : TICKET_PREFIX;
  const row = await trx
    .selectFrom(seqTable)
    .select("next_number")
    .where("id", "=", 1)
    .executeTakeFirst();
  const current = row?.next_number ?? TICKET_SEQ_START + 1;
  if (row) {
    await trx
      .updateTable(seqTable)
      .set({ next_number: current + 1 })
      .where("id", "=", 1)
      .execute();
  } else {
    await trx
      .insertInto(seqTable)
      .values({ id: 1, next_number: current + 1 })
      .execute();
  }
  return {
    number: `${prefix}${current}`,
    replyToken: `${prefix}${current}`.toLowerCase(),
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────
export async function createTicket(params: CreateTicketParams): Promise<Ticket> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  const department =
    (params.department && params.department.trim()) ||
    (await resolveDepartmentForCategory(params.category));

  const isTest = params.isTest === true;
  await db.transaction().execute(async (trx) => {
    const { number, replyToken } = await nextTicketNumber(trx, isTest);
    await trx
      .insertInto("admin_tickets")
      .values({
        id,
        number,
        reply_token: replyToken,
        category: params.category,
        status: "new",
        priority: params.priority ?? "medium",
        source: params.source ?? "manual",
        subject: params.subject,
        description: params.description ?? null,
        department,
        requester_name: params.requesterName ?? null,
        requester_email: params.requesterEmail ?? null,
        requester_phone: params.requesterPhone ?? null,
        order_id: params.orderId ?? null,
        order_address: params.orderAddress ?? null,
        assigned_to: params.assignedTo ?? null,
        created_by: params.createdBy ?? null,
        is_test: isTest ? 1 : 0,
        estimate_cents: params.estimateCents ?? null,
        created_at: now,
        updated_at: now,
        resolved_at: null,
      })
      .execute();
    await trx
      .insertInto("admin_ticket_events")
      .values({
        id: crypto.randomUUID(),
        ticket_id: id,
        kind: "created",
        author_type: params.source === "manual" ? "staff" : "client",
        author_name: params.requesterName ?? null,
        body: null,
        meta: JSON.stringify({
          category: params.category,
          department,
          source: params.source ?? "manual",
          ...(isTest ? { test: true } : {}),
        }),
        created_at: now,
      })
      .execute();
  });

  return (await getTicket(id))!;
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_tickets")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? rowToTicket(row) : null;
}

export async function getTicketByNumber(number: string): Promise<Ticket | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_tickets")
    .selectAll()
    .where("number", "=", number)
    .executeTakeFirst();
  return row ? rowToTicket(row) : null;
}

/** Look a ticket up by its reply-to token — the hook the inbound-email track uses. */
export async function getTicketByReplyToken(replyToken: string): Promise<Ticket | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_tickets")
    .selectAll()
    .where("reply_token", "=", replyToken.toLowerCase())
    .executeTakeFirst();
  return row ? rowToTicket(row) : null;
}

export async function listTickets(filters: ListTicketFilters = {}): Promise<Ticket[]> {
  const db = getAdminDb();
  let query = db.selectFrom("admin_tickets").selectAll();
  if (filters.status) query = query.where("status", "=", filters.status);
  if (filters.category) query = query.where("category", "=", filters.category);
  if (filters.department) query = query.where("department", "=", filters.department);
  if (filters.assignedTo) query = query.where("assigned_to", "=", filters.assignedTo);
  if (filters.q && filters.q.trim()) {
    const like = `%${filters.q.trim().toLowerCase()}%`;
    query = query.where((eb) =>
      eb.or([
        eb(eb.fn("lower", ["subject"]), "like", like),
        eb(eb.fn("lower", ["number"]), "like", like),
        eb(eb.fn("lower", ["requester_name"]), "like", like),
        eb(eb.fn("lower", ["requester_email"]), "like", like),
        eb(eb.fn("lower", ["order_address"]), "like", like),
      ]),
    );
  }
  const rows = await query.orderBy("created_at", "desc").execute();
  return rows.map(rowToTicket);
}

export async function updateTicket(
  id: string,
  params: UpdateTicketParams,
  actor?: { name?: string | null; authorType?: TicketAuthorType },
): Promise<Ticket | null> {
  const existing = await getTicket(id);
  if (!existing) return null;
  const db = getAdminDb();
  const now = Date.now();
  const updates: Record<string, unknown> = { updated_at: now };
  if (params.subject !== undefined) updates.subject = params.subject;
  if (params.description !== undefined) updates.description = params.description;
  if (params.priority !== undefined) updates.priority = params.priority;
  if (params.department !== undefined) updates.department = params.department;
  if (params.assignedTo !== undefined) updates.assigned_to = params.assignedTo;
  if (params.status !== undefined) {
    updates.status = params.status;
    // First move into resolved stamps resolvedAt; leaving resolved clears it.
    if (params.status === "resolved" && existing.status !== "resolved") updates.resolved_at = now;
    else if (params.status !== "resolved" && params.status !== "closed") updates.resolved_at = null;
  }

  await db.updateTable("admin_tickets").set(updates).where("id", "=", id).execute();

  const authorType = actor?.authorType ?? "staff";
  const authorName = actor?.name ?? null;
  if (params.status !== undefined && params.status !== existing.status) {
    await addTicketEvent(id, {
      kind: "status_change",
      authorType,
      authorName,
      body: null,
      meta: { from: existing.status, to: params.status },
    });
  }
  if (params.assignedTo !== undefined && params.assignedTo !== existing.assignedTo) {
    await addTicketEvent(id, {
      kind: "assignment",
      authorType,
      authorName,
      body: null,
      meta: { from: existing.assignedTo, to: params.assignedTo },
    });
  }

  return getTicket(id);
}

export async function deleteTicket(id: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_tickets").where("id", "=", id).execute();
}

// ── Events ────────────────────────────────────────────────────────────────
export async function addTicketEvent(
  ticketId: string,
  event: {
    kind: TicketEventKind;
    authorType: TicketAuthorType;
    authorName?: string | null;
    body?: string | null;
    meta?: Record<string, unknown> | null;
  },
): Promise<TicketEvent> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db
    .insertInto("admin_ticket_events")
    .values({
      id,
      ticket_id: ticketId,
      kind: event.kind,
      author_type: event.authorType,
      author_name: event.authorName ?? null,
      body: event.body ?? null,
      meta: event.meta ? JSON.stringify(event.meta) : null,
      created_at: now,
    })
    .execute();
  // Any activity bumps the ticket's updated_at so the queue sorts sensibly.
  await db
    .updateTable("admin_tickets")
    .set({ updated_at: now })
    .where("id", "=", ticketId)
    .execute();
  return {
    id,
    ticketId,
    kind: event.kind,
    authorType: event.authorType,
    authorName: event.authorName ?? null,
    body: event.body ?? null,
    meta: event.meta ?? null,
    createdAt: now,
  };
}

export async function listTicketEvents(ticketId: string): Promise<TicketEvent[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_ticket_events")
    .selectAll()
    .where("ticket_id", "=", ticketId)
    .orderBy("created_at", "asc")
    .execute();
  return rows.map(rowToEvent);
}

// ── Stats ─────────────────────────────────────────────────────────────────
export type TicketStats = { total: number; byStatus: Record<TicketStatus, number> };

export async function getTicketStats(): Promise<TicketStats> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_tickets")
    .select(["status", (eb) => eb.fn.countAll<number>().as("count")])
    // Demo tickets must not move the real Open/New/etc. counts.
    .where("is_test", "=", 0)
    .groupBy("status")
    .execute();
  const byStatus: Record<TicketStatus, number> = {
    new: 0,
    in_progress: 0,
    needs_review: 0,
    resolved: 0,
    closed: 0,
  };
  let total = 0;
  for (const r of rows) {
    const count = Number(r.count) || 0;
    total += count;
    if (r.status in byStatus) byStatus[r.status as TicketStatus] = count;
  }
  return { total, byStatus };
}
