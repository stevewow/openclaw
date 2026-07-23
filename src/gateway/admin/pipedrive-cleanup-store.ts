import { randomUUID } from "node:crypto";
import { getAdminDb } from "./user-store.js";

// Pipedrive Cleanup checklist: a two-stage worklist that lives entirely in the
// admin DB. An external scanner (the Pipedrive hygiene script, later a scheduled
// routine) POSTs suggested changes into `importCleanupItems`; every item starts
// `suggested`. An admin verifies each into `approved` or `rejected`; a granted
// non-admin (the VA) then works the `approved` items to `done`. The gateway holds
// NO Pipedrive credentials — it only stores and gates the suggestions.

export type CleanupKind = "merge" | "fill" | "exclude" | "review";
export type CleanupStatus = "suggested" | "approved" | "rejected" | "done";

export type CleanupImportItem = {
  itemKey: string; // stable natural key for idempotent re-import, e.g. "lima:merge:4267"
  kind: CleanupKind;
  title: string;
  detail: string; // human-readable instruction for whoever actions it
  office?: string | null; // suggested Office value, when relevant
  verify?: boolean; // flag the item for extra scrutiny before approval
  payload?: unknown; // raw org ids/names for reference + deep links
};

export type CleanupItem = {
  id: string;
  itemKey: string;
  market: string;
  kind: CleanupKind;
  title: string;
  detail: string;
  office: string | null;
  verify: boolean;
  payload: unknown;
  status: CleanupStatus;
  note: string | null;
  createdAt: number;
  updatedAt: number;
  approvedBy: string | null;
  approvedAt: number | null;
  doneBy: string | null;
  doneAt: number | null;
};

export type CleanupSummary = {
  total: number;
  suggested: number;
  approved: number;
  rejected: number;
  done: number;
};

type CleanupRow = {
  id: string;
  item_key: string;
  market: string;
  kind: string;
  title: string;
  detail: string;
  office: string | null;
  verify: number;
  payload: string;
  status: string;
  note: string | null;
  created_at: number;
  updated_at: number;
  approved_by: string | null;
  approved_at: number | null;
  done_by: string | null;
  done_at: number | null;
};

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

function rowToItem(r: CleanupRow): CleanupItem {
  return {
    id: r.id,
    itemKey: r.item_key,
    market: r.market,
    kind: r.kind as CleanupKind,
    title: r.title,
    detail: r.detail,
    office: r.office,
    verify: r.verify === 1,
    payload: parsePayload(r.payload),
    status: r.status as CleanupStatus,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    doneBy: r.done_by,
    doneAt: r.done_at,
  };
}

// Rank for a stable, useful default ordering. Within a status, merges (the
// riskiest, highest-value action) sort ahead of fills, then review/exclude.
const KIND_ORDER: Record<CleanupKind, number> = { merge: 0, fill: 1, review: 2, exclude: 3 };
const ADMIN_STATUS_ORDER: Record<CleanupStatus, number> = {
  suggested: 0,
  approved: 1,
  done: 2,
  rejected: 3,
};

function sortItems(items: CleanupItem[], order: Record<CleanupStatus, number>): CleanupItem[] {
  return items.toSorted(
    (a, b) =>
      order[a.status] - order[b.status] ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.title.localeCompare(b.title),
  );
}

// Idempotent import. New keys insert as `suggested`. Existing keys refresh their
// descriptive fields ONLY while still `suggested` — once an admin has approved or
// rejected an item, or a VA has completed it, a re-scan must not disturb it.
export async function importCleanupItems(
  market: string,
  items: CleanupImportItem[],
): Promise<{ added: number; updated: number; skipped: number }> {
  const db = getAdminDb();
  const now = Date.now();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  await db.transaction().execute(async (trx) => {
    for (const item of items) {
      const existing = await trx
        .selectFrom("admin_pipedrive_cleanup_items")
        .select(["id", "status"])
        .where("item_key", "=", item.itemKey)
        .executeTakeFirst();
      const office = item.office ?? null;
      const verify = item.verify ? 1 : 0;
      const payload = JSON.stringify(item.payload ?? {});
      if (!existing) {
        await trx
          .insertInto("admin_pipedrive_cleanup_items")
          .values({
            id: randomUUID(),
            item_key: item.itemKey,
            market,
            kind: item.kind,
            title: item.title,
            detail: item.detail,
            office,
            verify,
            payload,
            status: "suggested",
            note: null,
            created_at: now,
            updated_at: now,
            approved_by: null,
            approved_at: null,
            done_by: null,
            done_at: null,
          })
          .execute();
        added += 1;
      } else if (existing.status === "suggested") {
        await trx
          .updateTable("admin_pipedrive_cleanup_items")
          .set({
            market,
            kind: item.kind,
            title: item.title,
            detail: item.detail,
            office,
            verify,
            payload,
            updated_at: now,
          })
          .where("id", "=", existing.id)
          .execute();
        updated += 1;
      } else {
        skipped += 1;
      }
    }
  });
  return { added, updated, skipped };
}

export async function listCleanupItems(opts: {
  market?: string | null;
  includeSuggested: boolean; // false for the VA — they never see un-approved suggestions
}): Promise<CleanupItem[]> {
  const db = getAdminDb();
  let q = db.selectFrom("admin_pipedrive_cleanup_items").selectAll();
  if (opts.market) {
    q = q.where("market", "=", opts.market);
  }
  if (!opts.includeSuggested) {
    // The VA sees only what an admin has released to them.
    q = q.where("status", "in", ["approved", "done"]);
  }
  const rows = (await q.execute()) as CleanupRow[];
  return sortItems(rows.map(rowToItem), ADMIN_STATUS_ORDER);
}

export async function getCleanupSummary(market?: string | null): Promise<CleanupSummary> {
  const items = await listCleanupItems({ market: market ?? null, includeSuggested: true });
  const summary: CleanupSummary = {
    total: items.length,
    suggested: 0,
    approved: 0,
    rejected: 0,
    done: 0,
  };
  for (const it of items) {
    summary[it.status] += 1;
  }
  return summary;
}

// Admin verify step. Only a `suggested` item can be approved or rejected.
export async function decideCleanupItem(
  id: string,
  decision: "approved" | "rejected",
  byUserId: string,
): Promise<CleanupItem | null> {
  const db = getAdminDb();
  const now = Date.now();
  const row = (await db
    .selectFrom("admin_pipedrive_cleanup_items")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst()) as CleanupRow | undefined;
  if (!row || row.status !== "suggested") {
    return null;
  }
  await db
    .updateTable("admin_pipedrive_cleanup_items")
    .set({
      status: decision,
      approved_by: byUserId,
      approved_at: now,
      updated_at: now,
    })
    .where("id", "=", id)
    .execute();
  return listOne(id);
}

// VA completion step. Only an `approved` item can be marked `done`; un-checking a
// `done` item returns it to `approved`. Any other transition is refused — this is
// what stops a report-access user from ever approving their own work.
export async function setCleanupItemDone(
  id: string,
  done: boolean,
  byUserId: string,
): Promise<CleanupItem | null> {
  const db = getAdminDb();
  const now = Date.now();
  const row = (await db
    .selectFrom("admin_pipedrive_cleanup_items")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst()) as CleanupRow | undefined;
  if (!row) {
    return null;
  }
  if (done && row.status !== "approved") {
    return null;
  }
  if (!done && row.status !== "done") {
    return null;
  }
  await db
    .updateTable("admin_pipedrive_cleanup_items")
    .set({
      status: done ? "done" : "approved",
      done_by: done ? byUserId : null,
      done_at: done ? now : null,
      updated_at: now,
    })
    .where("id", "=", id)
    .execute();
  return listOne(id);
}

// A note the VA leaves on an item. Allowed only once the item is theirs to work
// (approved or done); never on a suggestion still awaiting admin verification.
export async function setCleanupItemNote(id: string, note: string): Promise<CleanupItem | null> {
  const db = getAdminDb();
  const now = Date.now();
  const row = (await db
    .selectFrom("admin_pipedrive_cleanup_items")
    .select(["id", "status"])
    .where("id", "=", id)
    .executeTakeFirst()) as { id: string; status: string } | undefined;
  if (!row || (row.status !== "approved" && row.status !== "done")) {
    return null;
  }
  const trimmed = note.trim();
  await db
    .updateTable("admin_pipedrive_cleanup_items")
    .set({ note: trimmed ? trimmed : null, updated_at: now })
    .where("id", "=", id)
    .execute();
  return listOne(id);
}

async function listOne(id: string): Promise<CleanupItem | null> {
  const db = getAdminDb();
  const row = (await db
    .selectFrom("admin_pipedrive_cleanup_items")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst()) as CleanupRow | undefined;
  return row ? rowToItem(row) : null;
}
