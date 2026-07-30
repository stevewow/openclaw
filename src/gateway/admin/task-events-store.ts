// Per-task comment thread and activity history.
//
// Both live in one table (`admin_task_events`) because the drawer renders them
// as a single chronological stream — "Steve moved this to Review" reads in line
// with "Steve: waiting on the floor plan", and splitting them would mean merging
// two ordered lists on every read for no gain.
//
// Comments are authored; activity is derived. Activity rows are written by
// diffing a task before and after an update (see `diffTaskActivity`), so the
// history records what actually changed rather than what the caller submitted —
// a PUT that re-sends an unchanged status logs nothing.
//
// `author_name` is denormalised: history has to stay readable after the account
// that wrote it is deleted, and these rows outlive their authors.

import { randomUUID } from "node:crypto";
import type { Task } from "./project-store.js";
import { getAdminDb } from "./user-store.js";

export type TaskEventKind = "comment" | "activity";

/** Fields whose changes are worth a line in the history. */
export type TaskActivityField =
  | "status"
  | "priority"
  | "title"
  | "dueDate"
  | "projectId"
  | "assignees"
  | "created";

export type TaskEvent = {
  id: string;
  taskId: string;
  kind: TaskEventKind;
  /** Comment text; null on activity rows. */
  body: string | null;
  /** Activity payload; null on comments. */
  field: TaskActivityField | null;
  from: string | null;
  to: string | null;
  /** User ids named with @ in a comment. */
  mentions: string[];
  authorId: string | null;
  authorName: string | null;
  createdAt: number;
  editedAt: number | null;
};

type TaskEventRow = {
  id: string;
  task_id: string;
  kind: string;
  body: string | null;
  meta: string | null;
  mentions: string;
  author_id: string | null;
  author_name: string | null;
  created_at: number;
  edited_at: number | null;
};

export const MAX_COMMENT_LEN = 5000;

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function rowToEvent(r: TaskEventRow): TaskEvent {
  let field: TaskActivityField | null = null;
  let from: string | null = null;
  let to: string | null = null;
  if (r.meta) {
    try {
      const m = JSON.parse(r.meta) as { field?: string; from?: string | null; to?: string | null };
      field = (m.field as TaskActivityField | undefined) ?? null;
      from = m.from ?? null;
      to = m.to ?? null;
    } catch {
      // A malformed meta blob must not take the whole feed down; the row still
      // carries its author and timestamp, which is most of its value.
    }
  }
  return {
    id: r.id,
    taskId: r.task_id,
    kind: r.kind === "activity" ? "activity" : "comment",
    body: r.body,
    field,
    from,
    to,
    mentions: parseJsonArray(r.mentions),
    authorId: r.author_id,
    authorName: r.author_name,
    createdAt: r.created_at,
    editedAt: r.edited_at,
  };
}

/**
 * Extract @mentions from comment text against the set of users that could be
 * meant. Names contain spaces, so a bare word-boundary regex cannot find them;
 * instead each candidate's handle is matched literally, longest first, so
 * "@Anna Marie" wins over "@Anna". Matching is case-insensitive and the
 * returned ids are unique.
 */
export function parseMentions(
  body: string,
  candidates: Array<{ id: string; name: string }>,
): string[] {
  const found = new Set<string>();
  const lower = body.toLowerCase();
  // Text already claimed by a longer handle. Without this, "@Anna Marie" would
  // also match the shorter "@Anna" sitting inside it and mention both people.
  const claimed = new Array<boolean>(lower.length).fill(false);
  const sorted = [...candidates].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) {
    if (!c.name.trim()) continue;
    const handle = `@${c.name.toLowerCase()}`;
    let from = 0;
    for (;;) {
      const at = lower.indexOf(handle, from);
      if (at === -1) break;
      const end = at + handle.length;
      // Must not be the tail of a longer word ("@annabelle" is not "@anna").
      const after = lower[end];
      let free = after === undefined || !/[a-z0-9_-]/.test(after);
      for (let i = at; free && i < end; i++) {
        if (claimed[i]) free = false;
      }
      if (free) {
        found.add(c.id);
        for (let i = at; i < end; i++) claimed[i] = true;
        break;
      }
      from = end;
    }
  }
  return Array.from(found);
}

/** The whole feed for one task, oldest first — the order it is read in. */
export async function listTaskEvents(taskId: string): Promise<TaskEvent[]> {
  const db = getAdminDb();
  const rows = (await db
    .selectFrom("admin_task_events")
    .selectAll()
    .where("task_id", "=", taskId)
    .orderBy("created_at", "asc")
    .execute()) as TaskEventRow[];
  return rows.map(rowToEvent);
}

/** Comment counts for many tasks at once, so cards can show a badge. */
export async function countCommentsByTask(taskIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (taskIds.length === 0) return counts;
  const db = getAdminDb();
  const rows = (await db
    .selectFrom("admin_task_events")
    .select("task_id")
    .where("task_id", "in", taskIds)
    .where("kind", "=", "comment")
    .execute()) as Array<{ task_id: string }>;
  for (const r of rows) counts.set(r.task_id, (counts.get(r.task_id) ?? 0) + 1);
  return counts;
}

export async function addTaskComment(input: {
  taskId: string;
  body: string;
  mentions?: string[];
  authorId?: string | null;
  authorName?: string | null;
  now?: number;
}): Promise<TaskEvent> {
  const db = getAdminDb();
  const row: TaskEventRow = {
    id: randomUUID(),
    task_id: input.taskId,
    kind: "comment",
    body: input.body.trim().slice(0, MAX_COMMENT_LEN),
    meta: null,
    mentions: JSON.stringify(input.mentions ?? []),
    author_id: input.authorId ?? null,
    author_name: input.authorName ?? null,
    created_at: input.now ?? Date.now(),
    edited_at: null,
  };
  await db.insertInto("admin_task_events").values(row).execute();
  return rowToEvent(row);
}

/**
 * Edit a comment's text. Returns null when the id is missing or is an activity
 * row — history is not editable, only what a person wrote.
 */
export async function editTaskComment(
  id: string,
  body: string,
  opts: { mentions?: string[]; now?: number } = {},
): Promise<TaskEvent | null> {
  const db = getAdminDb();
  const existing = (await db
    .selectFrom("admin_task_events")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst()) as TaskEventRow | undefined;
  if (!existing || existing.kind !== "comment") return null;
  const next = {
    body: body.trim().slice(0, MAX_COMMENT_LEN),
    mentions: JSON.stringify(opts.mentions ?? parseJsonArray(existing.mentions)),
    edited_at: opts.now ?? Date.now(),
  };
  await db.updateTable("admin_task_events").set(next).where("id", "=", id).execute();
  return rowToEvent({ ...existing, ...next });
}

/** Delete a comment. Activity rows are not deletable. Returns false if absent. */
export async function deleteTaskComment(id: string): Promise<boolean> {
  const db = getAdminDb();
  const result = await db
    .deleteFrom("admin_task_events")
    .where("id", "=", id)
    .where("kind", "=", "comment")
    .executeTakeFirst();
  return Number(result.numDeletedRows ?? 0) > 0;
}

export async function recordTaskActivity(input: {
  taskId: string;
  field: TaskActivityField;
  from?: string | null;
  to?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  now?: number;
}): Promise<void> {
  const db = getAdminDb();
  await db
    .insertInto("admin_task_events")
    .values({
      id: randomUUID(),
      task_id: input.taskId,
      kind: "activity",
      body: null,
      meta: JSON.stringify({
        field: input.field,
        from: input.from ?? null,
        to: input.to ?? null,
      }),
      mentions: "[]",
      author_id: input.authorId ?? null,
      author_name: input.authorName ?? null,
      created_at: input.now ?? Date.now(),
      edited_at: null,
    })
    .execute();
}

type ActivityDiff = { field: TaskActivityField; from: string | null; to: string | null };

/**
 * What changed between two versions of a task, as history lines.
 *
 * Only fields a person would want narrated are compared — `position` moves on
 * every drag and `updatedAt` moves on every write, so both would bury the feed
 * in noise. Assignee sets are compared order-insensitively for the same reason.
 */
export function diffTaskActivity(before: Task, after: Task): ActivityDiff[] {
  const out: ActivityDiff[] = [];
  const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

  if (before.status !== after.status) {
    out.push({ field: "status", from: before.status, to: after.status });
  }
  if (before.priority !== after.priority) {
    out.push({ field: "priority", from: before.priority, to: after.priority });
  }
  if (before.title !== after.title) {
    out.push({ field: "title", from: before.title, to: after.title });
  }
  if (before.dueDate !== after.dueDate) {
    out.push({ field: "dueDate", from: str(before.dueDate), to: str(after.dueDate) });
  }
  if (before.projectId !== after.projectId) {
    out.push({ field: "projectId", from: before.projectId, to: after.projectId });
  }
  const a = [...before.assigneeIds].sort();
  const b = [...after.assigneeIds].sort();
  if (a.join(",") !== b.join(",")) {
    out.push({ field: "assignees", from: a.join(",") || null, to: b.join(",") || null });
  }
  return out;
}

/** Write one history line per real change. No changes means no rows. */
export async function recordTaskDiff(
  before: Task,
  after: Task,
  actor: { id?: string | null; name?: string | null },
  now?: number,
): Promise<void> {
  for (const d of diffTaskActivity(before, after)) {
    await recordTaskActivity({
      taskId: after.id,
      field: d.field,
      from: d.from,
      to: d.to,
      authorId: actor.id ?? null,
      authorName: actor.name ?? null,
      now,
    });
  }
}
