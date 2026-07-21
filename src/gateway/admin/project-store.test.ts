import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-project-store-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./project-store.js");
const userStore = await import("./user-store.js");

let admin: string;
let alice: string;
let bob: string;

beforeAll(async () => {
  admin = (await userStore.createUser({ username: "admin", password: "x", role: "admin" })).id;
  alice = (await userStore.createUser({ username: "alice", password: "x", role: "user" })).id;
  bob = (await userStore.createUser({ username: "bob", password: "x", role: "user" })).id;
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("project/task viewer scoping", () => {
  it("scopes projects to creator + members, admins see all", async () => {
    const aliceProject = await store.createProject({ title: "Alice solo", createdBy: alice });
    const sharedProject = await store.createProject({
      title: "Shared",
      createdBy: alice,
      memberIds: [bob],
    });
    await store.createProject({ title: "Bob solo", createdBy: bob });

    const aliceView = await store.listProjects({ userId: alice, role: "user" });
    expect(aliceView.map((p) => p.title).sort()).toEqual(["Alice solo", "Shared"]);

    const bobView = await store.listProjects({ userId: bob, role: "user" });
    // Bob sees only the project he was added to + his own.
    expect(bobView.map((p) => p.title).sort()).toEqual(["Bob solo", "Shared"]);

    const adminView = await store.listProjects({ userId: admin, role: "admin" });
    expect(adminView.length).toBe(3);

    // Members round-trips.
    const shared = adminView.find((p) => p.title === "Shared")!;
    expect(shared.memberIds).toEqual([bob]);
    expect(aliceProject.memberIds).toEqual([]);
  });

  it("shows project members all tasks in the project, plus tasks assigned to them", async () => {
    const proj = await store.createProject({ title: "Team", createdBy: alice, memberIds: [bob] });
    // Task created by alice inside the shared project — bob should see it (member of project).
    await store.createTask({ title: "In shared project", projectId: proj.id, createdBy: alice });
    // Task in no project, assigned to bob — bob should see it via assignment.
    await store.createTask({ title: "Assigned to bob", createdBy: alice, assigneeIds: [bob] });
    // Task in no project, not assigned to bob — bob should NOT see it.
    await store.createTask({ title: "Alice private", createdBy: alice });

    const bobTasks = await store.listTasks({}, { userId: bob, role: "user" });
    const titles = bobTasks.map((t) => t.title);
    expect(titles).toContain("In shared project");
    expect(titles).toContain("Assigned to bob");
    expect(titles).not.toContain("Alice private");
  });

  it("round-trips task assignees and dates", async () => {
    const proj = await store.createProject({
      title: "Dated",
      createdBy: admin,
      startDate: 1000,
      endDate: 2000,
    });
    expect(proj.startDate).toBe(1000);
    expect(proj.endDate).toBe(2000);

    const task = await store.createTask({
      title: "Multi",
      createdBy: admin,
      assigneeIds: [alice, bob],
    });
    expect(task.assigneeIds.sort()).toEqual([alice, bob].sort());

    const updated = await store.updateTask(task.id, { assigneeIds: [alice] });
    expect(updated!.assigneeIds).toEqual([alice]);
  });

  it("enforces access guards for non-admins", async () => {
    const proj = await store.createProject({ title: "Guarded", createdBy: alice });
    expect(await store.canAccessProject({ userId: alice, role: "user" }, proj.id)).toBe(true);
    expect(await store.canAccessProject({ userId: bob, role: "user" }, proj.id)).toBe(false);
    // Admins bypass the guard.
    expect(await store.canAccessProject({ userId: admin, role: "admin" }, proj.id)).toBe(true);

    const task = await store.createTask({ title: "Guarded task", createdBy: alice });
    expect(await store.canAccessTask({ userId: bob, role: "user" }, task.id)).toBe(false);
    expect(await store.canAccessTask({ userId: alice, role: "user" }, task.id)).toBe(true);
  });
});

describe("duplicateProject", () => {
  it("copies the project, its members, and its task tree as fresh todos", async () => {
    const source = await store.createProject({
      title: "June Newsletter",
      description: "Monthly send",
      status: "active",
      color: "#ff0000",
      tags: ["marketing"],
      startDate: 1000,
      endDate: 2000,
      memberIds: [bob],
      createdBy: alice,
    });
    const draft = await store.createTask({
      title: "Draft copy",
      projectId: source.id,
      status: "done",
      priority: "high",
      tags: ["writing"],
      position: 0,
      dueDate: 5_000,
      assigneeIds: [bob],
      createdBy: alice,
    });
    await store.createTask({
      title: "Proofread",
      projectId: source.id,
      parentTaskId: draft.id,
      status: "in_progress",
      createdBy: alice,
    });

    const copy = await store.duplicateProject(source.id, { createdBy: alice });
    expect(copy).not.toBeNull();
    expect(copy!.id).not.toBe(source.id);
    expect(copy!.title).toBe("June Newsletter (copy)");
    expect(copy!.description).toBe("Monthly send");
    expect(copy!.color).toBe("#ff0000");
    expect(copy!.tags).toEqual(["marketing"]);
    expect(copy!.memberIds).toEqual([bob]);
    // Dates belong to the original run, not the copy.
    expect(copy!.startDate).toBeNull();
    expect(copy!.endDate).toBeNull();

    const copied = await store.listTasks({ projectId: copy!.id });
    expect(copied.length).toBe(2);
    // Every copied task restarts, keeping priority/tags/assignees.
    expect(copied.every((t) => t.status === "todo")).toBe(true);
    expect(copied.every((t) => t.dueDate === null)).toBe(true);
    const copiedDraft = copied.find((t) => t.title === "Draft copy")!;
    expect(copiedDraft.priority).toBe("high");
    expect(copiedDraft.tags).toEqual(["writing"]);
    expect(copiedDraft.assigneeIds).toEqual([bob]);
    expect(copiedDraft.parentTaskId).toBeNull();
    // Subtask nesting is remapped onto the copied parent, not the original.
    const copiedSub = copied.find((t) => t.title === "Proofread")!;
    expect(copiedSub.parentTaskId).toBe(copiedDraft.id);

    // The source is untouched.
    const originalTasks = await store.listTasks({ projectId: source.id });
    expect(originalTasks.length).toBe(2);
    expect(originalTasks.find((t) => t.title === "Draft copy")!.status).toBe("done");
  });

  it("reopens a finished project and can shift due dates and drop assignees", async () => {
    const source = await store.createProject({
      title: "May Newsletter",
      status: "completed",
      createdBy: alice,
    });
    await store.createTask({
      title: "Send",
      projectId: source.id,
      dueDate: 10_000,
      assigneeIds: [bob],
      createdBy: alice,
    });

    const copy = await store.duplicateProject(source.id, {
      title: "July Newsletter",
      dueDateShiftMs: 500,
      includeAssignees: false,
      createdBy: alice,
    });
    expect(copy!.title).toBe("July Newsletter");
    // A completed source must not hand its status to the copy.
    expect(copy!.status).toBe("planning");

    const [task] = await store.listTasks({ projectId: copy!.id });
    expect(task.dueDate).toBe(10_500);
    expect(task.assigneeIds).toEqual([]);
  });

  it("returns null for a project that does not exist", async () => {
    expect(await store.duplicateProject("missing-id")).toBeNull();
  });
});
