// Collections worklist state for the Past Due Accounts report.
//
// The invoice snapshot in `admin_spiro_invoices` is replaced wholesale on every
// Spiro refresh, so nothing a human decides can live there. A "case" is the
// durable board record for one payee: which stage it sits at, who owns it, when
// the next action is due, and whether a partial-payment review has been signed
// off. It is keyed by the same `account_key` the breakdown groups on, so a case
// re-attaches to its account after any refresh.
//
// Rows are created lazily: an account with no case reads as the implicit
// `new`/unassigned default, and only touching it (stage, owner, review) writes.
// That keeps the table the size of the worked list, not of every past-due payee.

import { isPastDueActionKey, type PastDueActionKey } from "./past-due-policy.js";
import { getAdminDb } from "./user-store.js";

export type PastDueCaseStatus = "new" | "working" | "promised" | "plan" | "escalated" | "resolved";

// Board columns, left to right. The order is the collections funnel, so it also
// serves as the default sort rank.
export const PAST_DUE_CASE_STATUSES: Array<{
  key: PastDueCaseStatus;
  label: string;
  detail: string;
}> = [
  { key: "new", label: "New", detail: "Not picked up yet." },
  { key: "working", label: "Working", detail: "Contact attempted or in progress." },
  { key: "promised", label: "Promise to pay", detail: "Client committed to a date." },
  { key: "plan", label: "Payment plan", detail: "On a plan per the collections policy." },
  { key: "escalated", label: "Escalated", detail: "With BDS, a letter, or collections." },
  { key: "resolved", label: "Resolved", detail: "Paid, written off, or otherwise closed." },
];

const STATUS_KEYS = new Set<string>(PAST_DUE_CASE_STATUSES.map((s) => s.key));

export function isPastDueCaseStatus(value: unknown): value is PastDueCaseStatus {
  return typeof value === "string" && STATUS_KEYS.has(value);
}

export type PastDueCase = {
  accountKey: string;
  accountName: string;
  status: PastDueCaseStatus;
  /** Pinned collections step, or null to follow the aging policy. */
  nextAction: PastDueActionKey | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedBy: string | null;
  assignedAt: number | null;
  dueAt: number | null;
  reviewClearedBy: string | null;
  reviewClearedByName: string | null;
  reviewClearedAt: number | null;
  createdAt: number;
  updatedAt: number;
  updatedByName: string | null;
};

type CaseRow = {
  account_key: string;
  account_name: string;
  status: string;
  next_action: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: number | null;
  due_at: number | null;
  review_cleared_by: string | null;
  review_cleared_by_name: string | null;
  review_cleared_at: number | null;
  created_at: number;
  updated_at: number;
  updated_by_name: string | null;
};

function rowToCase(row: CaseRow, assigneeName: string | null): PastDueCase {
  return {
    accountKey: row.account_key,
    accountName: row.account_name,
    status: isPastDueCaseStatus(row.status) ? row.status : "new",
    nextAction: isPastDueActionKey(row.next_action) ? row.next_action : null,
    assignedTo: row.assigned_to,
    assignedToName: assigneeName,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    dueAt: row.due_at,
    reviewClearedBy: row.review_cleared_by,
    reviewClearedByName: row.review_cleared_by_name,
    reviewClearedAt: row.review_cleared_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by_name,
  };
}

/** The implicit state of an account nobody has touched yet. */
export function defaultCase(
  accountKey: string,
  accountName: string,
  now = Date.now(),
): PastDueCase {
  return {
    accountKey,
    accountName,
    status: "new",
    nextAction: null,
    assignedTo: null,
    assignedToName: null,
    assignedBy: null,
    assignedAt: null,
    dueAt: null,
    reviewClearedBy: null,
    reviewClearedByName: null,
    reviewClearedAt: null,
    createdAt: now,
    updatedAt: now,
    updatedByName: null,
  };
}

// Assignee display names are resolved from admin_users on read rather than
// copied onto the case, so a rename or a deleted account can never leave the
// board showing a stale owner. (The FK is ON DELETE SET NULL, so a deleted user
// releases their cases back to unassigned.)
async function assigneeNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return new Map();
  }
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_users")
    .select(["id", "username", "first_name", "last_name"])
    .where("id", "in", unique)
    .execute();
  return new Map(
    rows.map((r) => {
      const full = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
      return [r.id, full || r.username];
    }),
  );
}

/** Every case that exists, keyed by account. Accounts with no row are absent. */
export async function listPastDueCases(): Promise<Map<string, PastDueCase>> {
  const db = getAdminDb();
  const rows = (await db.selectFrom("admin_past_due_cases").selectAll().execute()) as CaseRow[];
  const names = await assigneeNames(rows.map((r) => r.assigned_to).filter((v) => v !== null));
  return new Map(
    rows.map((row) => [
      row.account_key,
      rowToCase(row, row.assigned_to ? (names.get(row.assigned_to) ?? null) : null),
    ]),
  );
}

export async function getPastDueCase(accountKey: string): Promise<PastDueCase | null> {
  const db = getAdminDb();
  const row = (await db
    .selectFrom("admin_past_due_cases")
    .selectAll()
    .where("account_key", "=", accountKey)
    .executeTakeFirst()) as CaseRow | undefined;
  if (!row) {
    return null;
  }
  const names = await assigneeNames(row.assigned_to ? [row.assigned_to] : []);
  return rowToCase(row, row.assigned_to ? (names.get(row.assigned_to) ?? null) : null);
}

// One writer for every mutation: create the row on first touch, then patch it.
// `accountName` is carried on the case so an assignee's queue can name the
// account without re-reading the invoice snapshot.
async function upsertCase(
  accountKey: string,
  accountName: string,
  patch: Partial<Omit<CaseRow, "account_key" | "created_at">>,
  now: number,
): Promise<PastDueCase> {
  const db = getAdminDb();
  const existing = await db
    .selectFrom("admin_past_due_cases")
    .select("account_key")
    .where("account_key", "=", accountKey)
    .executeTakeFirst();
  if (existing) {
    await db
      .updateTable("admin_past_due_cases")
      .set({ ...patch, account_name: accountName, updated_at: now })
      .where("account_key", "=", accountKey)
      .execute();
  } else {
    await db
      .insertInto("admin_past_due_cases")
      .values({
        account_key: accountKey,
        account_name: accountName,
        status: "new",
        next_action: null,
        assigned_to: null,
        assigned_by: null,
        assigned_at: null,
        due_at: null,
        review_cleared_by: null,
        review_cleared_by_name: null,
        review_cleared_at: null,
        created_at: now,
        updated_at: now,
        updated_by_name: null,
        ...patch,
      })
      .execute();
  }
  const saved = await getPastDueCase(accountKey);
  // The row was just written in this call, so it exists; the default keeps the
  // return type honest without an assertion.
  return saved ?? defaultCase(accountKey, accountName, now);
}

export async function setPastDueCaseStatus(params: {
  accountKey: string;
  accountName: string;
  status: PastDueCaseStatus;
  byUserName?: string | null;
  now?: number;
}): Promise<PastDueCase> {
  const now = params.now ?? Date.now();
  return upsertCase(
    params.accountKey,
    params.accountName,
    { status: params.status, updated_by_name: params.byUserName ?? null },
    now,
  );
}

/**
 * Pin the collections step for an account, or with `nextAction: null` hand it
 * back to the aging policy. Pinning is deliberate: it is how someone says the
 * account is being worked ahead of, or behind, what its age implies.
 */
export async function setPastDueCaseNextAction(params: {
  accountKey: string;
  accountName: string;
  nextAction: PastDueActionKey | null;
  byUserName?: string | null;
  now?: number;
}): Promise<PastDueCase> {
  const now = params.now ?? Date.now();
  return upsertCase(
    params.accountKey,
    params.accountName,
    { next_action: params.nextAction, updated_by_name: params.byUserName ?? null },
    now,
  );
}

/**
 * Assign (or, with `assignedTo: null`, unassign) an account. Assigning also
 * moves a still-`new` case to `working`: handing someone the account is the
 * moment it starts being worked, and leaving it in New would keep it looking
 * untouched on the board.
 */
export async function assignPastDueCase(params: {
  accountKey: string;
  accountName: string;
  assignedTo: string | null;
  dueAt?: number | null;
  byUserId: string;
  byUserName?: string | null;
  now?: number;
}): Promise<PastDueCase> {
  const now = params.now ?? Date.now();
  const current = await getPastDueCase(params.accountKey);
  const patch: Partial<CaseRow> = {
    assigned_to: params.assignedTo,
    assigned_by: params.assignedTo ? params.byUserId : null,
    assigned_at: params.assignedTo ? now : null,
    updated_by_name: params.byUserName ?? null,
  };
  if (params.dueAt !== undefined) {
    patch.due_at = params.dueAt;
  }
  if (params.assignedTo && (!current || current.status === "new")) {
    patch.status = "working";
  }
  return upsertCase(params.accountKey, params.accountName, patch, now);
}

/**
 * Sign off the partial-payment review. The flag itself is derived from invoice
 * data and stays true while a partially paid invoice is past due; clearing
 * records that a human has looked at it, so the board can separate "not yet
 * reviewed" from "reviewed, still partially paid".
 */
export async function setPastDueCaseReviewCleared(params: {
  accountKey: string;
  accountName: string;
  cleared: boolean;
  byUserId: string;
  byUserName?: string | null;
  now?: number;
}): Promise<PastDueCase> {
  const now = params.now ?? Date.now();
  return upsertCase(
    params.accountKey,
    params.accountName,
    {
      review_cleared_by: params.cleared ? params.byUserId : null,
      review_cleared_by_name: params.cleared ? (params.byUserName ?? null) : null,
      review_cleared_at: params.cleared ? now : null,
      updated_by_name: params.byUserName ?? null,
    },
    now,
  );
}

export async function setPastDueCaseDueAt(params: {
  accountKey: string;
  accountName: string;
  dueAt: number | null;
  byUserName?: string | null;
  now?: number;
}): Promise<PastDueCase> {
  const now = params.now ?? Date.now();
  return upsertCase(
    params.accountKey,
    params.accountName,
    { due_at: params.dueAt, updated_by_name: params.byUserName ?? null },
    now,
  );
}
