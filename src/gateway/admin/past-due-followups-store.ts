/**
 * The link between a collections follow-up task and the account it was raised
 * for, and the "next contact" date derived from it.
 *
 * Next Contact is not typed in by hand: scheduling the contact IS creating the
 * follow-up task, so the date on the report is that task's due date. Ticking
 * the task off — or deleting it — clears the column, which keeps the report
 * honest without anyone maintaining a second date.
 */

import { resolveStatuses } from "./task-status-store.js";
import { getAdminDb } from "./user-store.js";

export type NextContact = {
  at: number;
  taskId: string;
  taskTitle: string;
  /** Who the follow-up is on, so the report can say whose move it is. */
  assignedTo: string | null;
};

/** Record that a task is the scheduled follow-up for an account. */
export async function linkFollowUpTask(params: {
  taskId: string;
  accountKey: string;
  now?: number;
}): Promise<void> {
  const db = getAdminDb();
  await db
    .insertInto("admin_past_due_followups")
    .values({
      task_id: params.taskId,
      account_key: params.accountKey,
      created_at: params.now ?? Date.now(),
    })
    // A task is raised once; re-linking the same id is a no-op rather than a
    // constraint error, so a retried request cannot fail the whole write.
    .onConflict((oc) => oc.column("task_id").doNothing())
    .execute();
}

type JoinedRow = {
  task_id: string;
  account_key: string;
  title: string;
  status: string;
  due_date: number | null;
  project_id: string | null;
  assigned_to: string | null;
};

/**
 * The soonest still-open follow-up per account.
 *
 * "Open" means the task's column is not the board's done column — finished is a
 * property of the column (`isDone`), never the literal key `done`, so a
 * Collections board ending in "Collected" closes a follow-up exactly like one
 * ending in "Done". Undated tasks are skipped: a follow-up with no due date has
 * not actually been scheduled.
 */
export async function nextContactByAccount(): Promise<Map<string, NextContact>> {
  const db = getAdminDb();
  const rows = (await db
    .selectFrom("admin_past_due_followups as f")
    .innerJoin("admin_tasks as t", "t.id", "f.task_id")
    .select([
      "f.task_id",
      "f.account_key",
      "t.title",
      "t.status",
      "t.due_date",
      "t.project_id",
      "t.assigned_to",
    ])
    .where("t.due_date", "is not", null)
    .execute()) as JoinedRow[];
  if (!rows.length) {
    return new Map();
  }

  // Follow-ups all land in the Collections project, but resolve per distinct
  // project anyway so a task moved elsewhere is still judged by its own board.
  const doneByProject = new Map<string | null, Set<string>>();
  for (const projectId of new Set(rows.map((r) => r.project_id))) {
    const statuses = await resolveStatuses(projectId);
    doneByProject.set(projectId, new Set(statuses.filter((s) => s.isDone).map((s) => s.key)));
  }

  const out = new Map<string, NextContact>();
  for (const row of rows) {
    if (doneByProject.get(row.project_id)?.has(row.status)) {
      continue;
    }
    const at = row.due_date;
    if (at === null) {
      continue;
    }
    const current = out.get(row.account_key);
    // Soonest wins; an account can carry more than one open follow-up and the
    // report only has room for the next one.
    if (current && current.at <= at) {
      continue;
    }
    out.set(row.account_key, {
      at,
      taskId: row.task_id,
      taskTitle: row.title,
      assignedTo: row.assigned_to,
    });
  }
  return out;
}
