// Board columns — the statuses a task can hold.
//
// Statuses used to be four hardcoded keys pinned by a CHECK constraint. They are
// now data: a global default set (project_id NULL) plus an optional per-project
// override, so a shoot pipeline and an edit pipeline can look different without
// one dictating the other.
//
// Two rules make the rest of the system safe:
//   - `is_done` decides what "finished" means. Recurrence, due-date colouring
//     and progress ask the status set rather than testing `status === 'done'`,
//     so a board whose last column is called "Delivered" still behaves.
//   - Replacing a project's set remaps any task holding a key that no longer
//     exists. A task stranded on a deleted column would vanish from the board
//     while still counting in every total — worse than moving it somewhere real.

import { randomUUID } from "node:crypto";
import { getAdminDb } from "./user-store.js";

export type TaskStatusDef = {
  id: string;
  projectId: string | null;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  isDone: boolean;
  /** Cards allowed in this column before it warns. Null = no limit. */
  wipLimit: number | null;
};

type Row = {
  id: string;
  project_id: string | null;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_done: number;
  wip_limit: number | null;
  created_at: number;
  updated_at: number;
};

export type TaskStatusInput = {
  key: string;
  label: string;
  color?: string;
  isDone?: boolean;
  wipLimit?: number | null;
};

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
export const MAX_STATUSES_PER_BOARD = 12;

function rowToDef(r: Row): TaskStatusDef {
  return {
    id: r.id,
    projectId: r.project_id,
    key: r.key,
    label: r.label,
    color: r.color,
    sortOrder: r.sort_order,
    isDone: r.is_done === 1,
    wipLimit: r.wip_limit,
  };
}

/**
 * Normalise a submitted column. Keys are machine identifiers stored on every
 * task, so they are constrained; the label is what people actually read.
 */
export function normalizeStatusKey(raw: string): string | null {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return KEY_RE.test(key) ? key : null;
}

export async function listGlobalStatuses(): Promise<TaskStatusDef[]> {
  const db = getAdminDb();
  const rows = (await db
    .selectFrom("admin_task_statuses")
    .selectAll()
    .where("project_id", "is", null)
    .orderBy("sort_order", "asc")
    .execute()) as Row[];
  return rows.map(rowToDef);
}

/** A project's own columns, or [] when it has not customised. */
export async function listProjectStatuses(projectId: string): Promise<TaskStatusDef[]> {
  const db = getAdminDb();
  const rows = (await db
    .selectFrom("admin_task_statuses")
    .selectAll()
    .where("project_id", "=", projectId)
    .orderBy("sort_order", "asc")
    .execute()) as Row[];
  return rows.map(rowToDef);
}

/**
 * The columns a board should draw: the project's own set when it has one, the
 * global set otherwise. Tasks with no project always use the global set.
 */
export async function resolveStatuses(projectId: string | null): Promise<TaskStatusDef[]> {
  if (projectId) {
    const own = await listProjectStatuses(projectId);
    if (own.length > 0) return own;
  }
  return listGlobalStatuses();
}

/** Every board's columns in one round trip, keyed by project id ('' = global). */
export async function resolveStatusesForProjects(
  projectIds: Array<string | null>,
): Promise<Map<string, TaskStatusDef[]>> {
  const global = await listGlobalStatuses();
  const out = new Map<string, TaskStatusDef[]>([["", global]]);
  const real = Array.from(new Set(projectIds.filter((id): id is string => !!id)));
  if (real.length === 0) return out;
  const db = getAdminDb();
  const rows = (await db
    .selectFrom("admin_task_statuses")
    .selectAll()
    .where("project_id", "in", real)
    .orderBy("sort_order", "asc")
    .execute()) as Row[];
  for (const r of rows) {
    const key = r.project_id ?? "";
    const list = out.get(key);
    if (list && key !== "") list.push(rowToDef(r));
    else if (key !== "") out.set(key, [rowToDef(r)]);
  }
  // Projects with no rows of their own fall back to global.
  for (const id of real) {
    if (!out.has(id)) out.set(id, global);
  }
  return out;
}

/** The key a new task should take on a given board. */
export async function defaultStatusKey(projectId: string | null): Promise<string> {
  const set = await resolveStatuses(projectId);
  return set[0]?.key ?? "todo";
}

/** Whether a status counts as finished on its board. */
export async function isDoneStatus(projectId: string | null, key: string): Promise<boolean> {
  const set = await resolveStatuses(projectId);
  return set.find((s) => s.key === key)?.isDone ?? false;
}

/**
 * Replace a board's columns wholesale, remapping any task left stranded.
 *
 * `projectId` null edits the global set. Returns the saved columns plus how many
 * tasks had to be moved, so the caller can say so rather than have rows quietly
 * relocate.
 */
export async function setStatuses(
  projectId: string | null,
  inputs: TaskStatusInput[],
): Promise<{ statuses: TaskStatusDef[]; remapped: number }> {
  const db = getAdminDb();
  const now = Date.now();

  const seen = new Set<string>();
  const clean: Array<TaskStatusInput & { key: string }> = [];
  for (const raw of inputs.slice(0, MAX_STATUSES_PER_BOARD)) {
    const key = normalizeStatusKey(raw.key || raw.label || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    clean.push({
      key,
      label:
        String(raw.label ?? key)
          .trim()
          .slice(0, 60) || key,
      color: /^#[0-9a-fA-F]{6}$/.test(String(raw.color ?? "")) ? String(raw.color) : "#6b7280",
      isDone: raw.isDone === true,
      wipLimit:
        typeof raw.wipLimit === "number" && Number.isFinite(raw.wipLimit) && raw.wipLimit > 0
          ? Math.trunc(raw.wipLimit)
          : null,
    });
  }
  if (clean.length === 0) {
    throw new Error("a board needs at least one column");
  }
  // Without a done column, nothing can ever be completed: recurrence would never
  // roll over and progress bars would never fill.
  if (!clean.some((c) => c.isDone)) {
    clean[clean.length - 1]!.isDone = true;
  }

  let query = db.deleteFrom("admin_task_statuses");
  query = projectId
    ? query.where("project_id", "=", projectId)
    : query.where("project_id", "is", null);
  await query.execute();

  await db
    .insertInto("admin_task_statuses")
    .values(
      clean.map((c, i) => ({
        id: randomUUID(),
        project_id: projectId,
        key: c.key,
        label: c.label!,
        color: c.color!,
        sort_order: i,
        is_done: c.isDone ? 1 : 0,
        wip_limit: c.wipLimit ?? null,
        created_at: now,
        updated_at: now,
      })),
    )
    .execute();

  const remapped = await remapStrandedTasks(projectId, clean[0]!.key);
  return { statuses: await resolveStatuses(projectId), remapped };
}

/**
 * Move tasks whose status no longer exists on their board onto `fallbackKey`.
 * Scoped to the board that changed: editing one project's columns must not
 * disturb another's.
 */
async function remapStrandedTasks(projectId: string | null, fallbackKey: string): Promise<number> {
  const db = getAdminDb();
  const valid = new Set((await resolveStatuses(projectId)).map((s) => s.key));

  let sel = db.selectFrom("admin_tasks").select(["id", "status"]);
  if (projectId) {
    sel = sel.where("project_id", "=", projectId);
  } else {
    // The global set covers project-less tasks and every project that has not
    // customised, so those are the rows at risk here.
    const customised = (await db
      .selectFrom("admin_task_statuses")
      .select("project_id")
      .where("project_id", "is not", null)
      .execute()) as Array<{ project_id: string }>;
    const exempt = Array.from(new Set(customised.map((c) => c.project_id)));
    sel = sel.where((eb) =>
      exempt.length > 0
        ? eb.or([eb("project_id", "is", null), eb("project_id", "not in", exempt)])
        : eb.or([eb("project_id", "is", null), eb("project_id", "is not", null)]),
    );
  }
  const rows = (await sel.execute()) as Array<{ id: string; status: string }>;
  const stranded = rows.filter((r) => !valid.has(r.status));
  if (stranded.length === 0) return 0;
  await db
    .updateTable("admin_tasks")
    .set({ status: fallbackKey, updated_at: Date.now() })
    .where(
      "id",
      "in",
      stranded.map((s) => s.id),
    )
    .execute();
  return stranded.length;
}

/** Drop a project's overrides so it falls back to the global set. */
export async function clearProjectStatuses(projectId: string): Promise<number> {
  const db = getAdminDb();
  await db.deleteFrom("admin_task_statuses").where("project_id", "=", projectId).execute();
  return remapStrandedTasks(projectId, (await listGlobalStatuses())[0]?.key ?? "todo");
}
