import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-past-due-followups-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./past-due-followups-store.js");
const projects = await import("./project-store.js");
const statuses = await import("./task-status-store.js");

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

beforeEach(async () => {
  for (const t of await projects.listTasks()) {
    await projects.deleteTask(t.id);
  }
  for (const p of await projects.listProjects()) {
    await projects.deleteProject(p.id);
  }
  await statuses.setStatuses(null, [
    { key: "todo", label: "Todo", isDone: false },
    { key: "done", label: "Done", isDone: true },
  ]);
});

/**
 * Board columns are per-project and carry arbitrary keys, but `CreateTaskParams`
 * still types `status` as the four keys the app shipped with. Narrowed here so
 * these cases can use a real custom column without widening the core type.
 */
type TaskStatusArg = Parameters<typeof projects.createTask>[0]["status"];

const asStatus = (key: string) => key as NonNullable<TaskStatusArg>;

/** A scheduled follow-up: a dated task, linked to the account it is about. */
async function scheduleFollowUp(opts: {
  accountKey: string;
  dueDate: number | null;
  status?: string;
  projectId?: string | null;
  title?: string;
}) {
  const task = await projects.createTask({
    title: opts.title ?? "Collections: call them",
    projectId: opts.projectId ?? null,
    dueDate: opts.dueDate,
    status: asStatus(opts.status ?? "todo"),
  });
  await store.linkFollowUpTask({ taskId: task.id, accountKey: opts.accountKey, now: NOW });
  return task;
}

describe("next contact", () => {
  it("is the due date of the scheduled follow-up", async () => {
    const task = await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW + 3 * DAY });
    const map = await store.nextContactByAccount();
    expect(map.get("acct-1")).toMatchObject({ at: NOW + 3 * DAY, taskId: task.id });
  });

  it("is absent for an account with nothing booked", async () => {
    await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW + DAY });
    const map = await store.nextContactByAccount();
    expect(map.has("acct-2")).toBe(false);
  });

  it("takes the soonest when an account carries several open follow-ups", async () => {
    await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW + 10 * DAY, title: "later" });
    await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW + 2 * DAY, title: "sooner" });
    await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW + 6 * DAY, title: "middle" });
    const map = await store.nextContactByAccount();
    expect(map.get("acct-1")?.at).toBe(NOW + 2 * DAY);
    expect(map.get("acct-1")?.taskTitle).toBe("sooner");
  });

  it("keeps a follow-up that has already slipped, rather than dropping it", async () => {
    // An overdue follow-up is the thing most needing attention; it must not
    // vanish just because its date has passed.
    await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW - 5 * DAY });
    const map = await store.nextContactByAccount();
    expect(map.get("acct-1")?.at).toBe(NOW - 5 * DAY);
  });

  it("clears once the follow-up is ticked off", async () => {
    const task = await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW + DAY });
    expect((await store.nextContactByAccount()).has("acct-1")).toBe(true);
    await projects.updateTask(task.id, { status: "done" });
    expect((await store.nextContactByAccount()).has("acct-1")).toBe(false);
  });

  it("falls through to the next open follow-up when one is completed", async () => {
    const first = await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW + DAY });
    await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW + 9 * DAY });
    await projects.updateTask(first.id, { status: "done" });
    expect((await store.nextContactByAccount()).get("acct-1")?.at).toBe(NOW + 9 * DAY);
  });

  it("clears when the follow-up task is deleted", async () => {
    const task = await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW + DAY });
    await projects.deleteTask(task.id);
    expect((await store.nextContactByAccount()).has("acct-1")).toBe(false);
  });

  it("ignores an undated task — that is not a scheduled contact", async () => {
    await scheduleFollowUp({ accountKey: "acct-1", dueDate: null });
    expect((await store.nextContactByAccount()).has("acct-1")).toBe(false);
  });

  it("treats 'finished' as the board's done column, not the literal key", async () => {
    // A Collections board whose last column is "Collected" closes a follow-up
    // exactly like one that says "Done".
    const project = await projects.createProject({ title: "Collections" });
    await statuses.setStatuses(project.id, [
      { key: "queued", label: "Queued", isDone: false },
      { key: "collected", label: "Collected", isDone: true },
    ]);
    const task = await scheduleFollowUp({
      accountKey: "acct-1",
      dueDate: NOW + DAY,
      projectId: project.id,
      status: "queued",
    });
    expect((await store.nextContactByAccount()).has("acct-1")).toBe(true);
    await projects.updateTask(task.id, { status: asStatus("collected") });
    expect((await store.nextContactByAccount()).has("acct-1")).toBe(false);
  });

  it("keeps accounts apart", async () => {
    await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW + 2 * DAY });
    await scheduleFollowUp({ accountKey: "acct-2", dueDate: NOW + 8 * DAY });
    const map = await store.nextContactByAccount();
    expect(map.get("acct-1")?.at).toBe(NOW + 2 * DAY);
    expect(map.get("acct-2")?.at).toBe(NOW + 8 * DAY);
  });

  it("linking the same task twice is a no-op, not a constraint error", async () => {
    const task = await scheduleFollowUp({ accountKey: "acct-1", dueDate: NOW + DAY });
    await expect(
      store.linkFollowUpTask({ taskId: task.id, accountKey: "acct-1", now: NOW }),
    ).resolves.toBeUndefined();
    expect((await store.nextContactByAccount()).size).toBe(1);
  });
});
