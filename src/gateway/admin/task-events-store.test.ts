import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-task-events-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./task-events-store.js");
const projects = await import("./project-store.js");
const userStore = await import("./user-store.js");

let steveId: string;
let annaId: string;

beforeAll(async () => {
  steveId = (await userStore.createUser({ username: "steve", password: "xxxxxxxx", role: "admin" }))
    .id;
  annaId = (await userStore.createUser({ username: "anna", password: "xxxxxxxx", role: "user" }))
    .id;
});

async function newTask(over: Partial<Parameters<typeof projects.createTask>[0]> = {}) {
  return projects.createTask({ title: "Edit the walkthrough", ...over });
}

beforeEach(async () => {
  for (const t of await projects.listTasks()) await projects.deleteTask(t.id);
});

describe("comments", () => {
  it("records the body with who wrote it, oldest first", async () => {
    const task = await newTask();
    await store.addTaskComment({
      taskId: task.id,
      body: "  Waiting on the floor plan.  ",
      authorId: steveId,
      authorName: "steve",
      now: 1000,
    });
    await store.addTaskComment({
      taskId: task.id,
      body: "Floor plan is in.",
      authorId: annaId,
      authorName: "anna",
      now: 2000,
    });
    const feed = await store.listTaskEvents(task.id);
    expect(feed.map((e) => e.body)).toEqual(["Waiting on the floor plan.", "Floor plan is in."]);
    expect(feed[0]).toMatchObject({ kind: "comment", authorName: "steve", editedAt: null });
  });

  it("caps an overlong comment rather than rejecting it", async () => {
    const task = await newTask();
    const c = await store.addTaskComment({ taskId: task.id, body: "x".repeat(9000) });
    expect(c.body?.length).toBe(store.MAX_COMMENT_LEN);
  });

  it("edits a comment and stamps when", async () => {
    const task = await newTask();
    const c = await store.addTaskComment({ taskId: task.id, body: "Typo heer", now: 1000 });
    const edited = await store.editTaskComment(c.id, "Typo here", { now: 5000 });
    expect(edited).toMatchObject({ body: "Typo here", editedAt: 5000, createdAt: 1000 });
  });

  it("refuses to edit or delete an activity row", async () => {
    const task = await newTask();
    await store.recordTaskActivity({ taskId: task.id, field: "status", from: "todo", to: "done" });
    const [activity] = await store.listTaskEvents(task.id);
    expect(await store.editTaskComment(activity!.id, "rewriting history")).toBeNull();
    expect(await store.deleteTaskComment(activity!.id)).toBe(false);
    expect(await store.listTaskEvents(task.id)).toHaveLength(1);
  });

  it("deletes a comment and reports a missing id", async () => {
    const task = await newTask();
    const c = await store.addTaskComment({ taskId: task.id, body: "oops" });
    expect(await store.deleteTaskComment(c.id)).toBe(true);
    expect(await store.deleteTaskComment(c.id)).toBe(false);
  });

  it("goes with the task when the task is deleted", async () => {
    const task = await newTask();
    await store.addTaskComment({ taskId: task.id, body: "one" });
    await projects.deleteTask(task.id);
    expect(await store.listTaskEvents(task.id)).toEqual([]);
  });

  it("counts comments per task without counting activity", async () => {
    const a = await newTask({ title: "A" });
    const b = await newTask({ title: "B" });
    await store.addTaskComment({ taskId: a.id, body: "1" });
    await store.addTaskComment({ taskId: a.id, body: "2" });
    await store.recordTaskActivity({ taskId: a.id, field: "status", from: "todo", to: "done" });
    await store.addTaskComment({ taskId: b.id, body: "1" });
    const counts = await store.countCommentsByTask([a.id, b.id]);
    expect(counts.get(a.id)).toBe(2);
    expect(counts.get(b.id)).toBe(1);
    expect(await store.countCommentsByTask([])).toEqual(new Map());
  });
});

describe("parseMentions", () => {
  const people = [
    { id: "u1", name: "Anna" },
    { id: "u2", name: "Anna Marie" },
    { id: "u3", name: "Steve" },
  ];

  it("finds a plain mention", () => {
    expect(store.parseMentions("ping @Steve please", people)).toEqual(["u3"]);
  });

  it("prefers the longest matching name", () => {
    // "@Anna Marie" must not resolve to Anna — longest handle wins.
    expect(store.parseMentions("@Anna Marie can you look?", people)).toEqual(["u2"]);
  });

  it("ignores a name that is only a prefix of a longer word", () => {
    expect(store.parseMentions("@Annabelle is not a user", people)).toEqual([]);
  });

  it("is case-insensitive and de-duplicates", () => {
    expect(store.parseMentions("@steve @STEVE @Steve", people)).toEqual(["u3"]);
  });

  it("returns nothing for text with no mentions", () => {
    expect(store.parseMentions("no one here", people)).toEqual([]);
  });

  it("stores the resolved ids on the comment", async () => {
    const task = await newTask();
    const c = await store.addTaskComment({
      taskId: task.id,
      body: "@Steve take a look",
      mentions: store.parseMentions("@Steve take a look", [{ id: steveId, name: "steve" }]),
    });
    expect(c.mentions).toEqual([steveId]);
  });
});

describe("diffTaskActivity", () => {
  it("reports only fields that actually changed", async () => {
    const before = await newTask({ status: "todo", priority: "medium" });
    const after = { ...before, status: "review" as const, priority: "high" as const };
    expect(store.diffTaskActivity(before, after)).toEqual([
      { field: "status", from: "todo", to: "review" },
      { field: "priority", from: "medium", to: "high" },
    ]);
  });

  it("says nothing when a write changes nothing", async () => {
    const before = await newTask();
    expect(store.diffTaskActivity(before, { ...before })).toEqual([]);
  });

  it("ignores position and updatedAt churn", async () => {
    const before = await newTask();
    const after = { ...before, position: before.position + 5, updatedAt: before.updatedAt + 1000 };
    expect(store.diffTaskActivity(before, after)).toEqual([]);
  });

  it("treats assignee sets as unordered", async () => {
    const before = await newTask();
    const withTwo = { ...before, assigneeIds: [steveId, annaId] };
    const reordered = { ...before, assigneeIds: [annaId, steveId] };
    expect(store.diffTaskActivity(withTwo, reordered)).toEqual([]);
    expect(store.diffTaskActivity(before, withTwo)).toHaveLength(1);
    expect(store.diffTaskActivity(before, withTwo)[0]?.field).toBe("assignees");
  });

  it("records a due date being set and cleared", async () => {
    const before = await newTask({ dueDate: null });
    const set = { ...before, dueDate: 1_800_000_000_000 };
    expect(store.diffTaskActivity(before, set)).toEqual([
      { field: "dueDate", from: null, to: "1800000000000" },
    ]);
    expect(store.diffTaskActivity(set, before)).toEqual([
      { field: "dueDate", from: "1800000000000", to: null },
    ]);
  });
});

describe("recordTaskDiff", () => {
  it("writes one history row per change, attributed to the actor", async () => {
    const before = await newTask({ status: "todo" });
    const after = { ...before, status: "done" as const, title: "Edited title" };
    await store.recordTaskDiff(before, after, { id: steveId, name: "steve" }, 4242);
    const feed = await store.listTaskEvents(before.id);
    expect(feed).toHaveLength(2);
    expect(feed.every((e) => e.kind === "activity")).toBe(true);
    expect(feed.every((e) => e.authorName === "steve")).toBe(true);
    expect(feed.map((e) => e.field).sort()).toEqual(["status", "title"]);
  });

  it("writes nothing for a no-op update", async () => {
    const before = await newTask();
    await store.recordTaskDiff(before, { ...before }, { id: steveId, name: "steve" });
    expect(await store.listTaskEvents(before.id)).toEqual([]);
  });
});
