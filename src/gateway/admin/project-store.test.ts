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
