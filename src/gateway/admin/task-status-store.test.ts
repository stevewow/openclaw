import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-task-status-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./task-status-store.js");
const projects = await import("./project-store.js");

const DEFAULT_KEYS = ["todo", "in_progress", "review", "done"];

beforeEach(async () => {
  for (const t of await projects.listTasks()) await projects.deleteTask(t.id);
  for (const p of await projects.listProjects()) await projects.deleteProject(p.id);
  // Restore the shipped global set between cases; several rewrite it.
  await store.setStatuses(
    null,
    DEFAULT_KEYS.map((k) => ({ key: k, label: k, isDone: k === "done" })),
  );
});

describe("default set", () => {
  it("ships the four columns every board started with", async () => {
    const global = await store.listGlobalStatuses();
    expect(global.map((s) => s.key)).toEqual(DEFAULT_KEYS);
    expect(global.find((s) => s.key === "done")?.isDone).toBe(true);
  });

  it("hands the global set to a project that has not customised", async () => {
    const p = await projects.createProject({ title: "Shoots" });
    expect((await store.resolveStatuses(p.id)).map((s) => s.key)).toEqual(DEFAULT_KEYS);
    expect(await store.listProjectStatuses(p.id)).toEqual([]);
  });

  it("uses the global set for tasks with no project", async () => {
    expect((await store.resolveStatuses(null)).map((s) => s.key)).toEqual(DEFAULT_KEYS);
    expect(await store.defaultStatusKey(null)).toBe("todo");
  });
});

describe("normalizeStatusKey", () => {
  it("slugs a label into a usable key", () => {
    expect(store.normalizeStatusKey("Needs Review")).toBe("needs_review");
    expect(store.normalizeStatusKey("  On Set!  ")).toBe("on_set");
    expect(store.normalizeStatusKey("Ready→Deliver")).toBe("ready_deliver");
  });

  it("rejects a key that slugs to nothing", () => {
    expect(store.normalizeStatusKey("!!!")).toBeNull();
    expect(store.normalizeStatusKey("")).toBeNull();
  });
});

describe("per-project columns", () => {
  it("overrides only the project that set them", async () => {
    const a = await projects.createProject({ title: "Shoots" });
    const b = await projects.createProject({ title: "Edits" });
    await store.setStatuses(a.id, [
      { key: "booked", label: "Booked" },
      { key: "shot", label: "Shot" },
      { key: "delivered", label: "Delivered", isDone: true },
    ]);
    expect((await store.resolveStatuses(a.id)).map((s) => s.key)).toEqual([
      "booked",
      "shot",
      "delivered",
    ]);
    expect((await store.resolveStatuses(b.id)).map((s) => s.key)).toEqual(DEFAULT_KEYS);
  });

  it("treats the first column as where new tasks land", async () => {
    const p = await projects.createProject({ title: "Shoots" });
    await store.setStatuses(p.id, [
      { key: "intake", label: "Intake" },
      { key: "done", label: "Done", isDone: true },
    ]);
    expect(await store.defaultStatusKey(p.id)).toBe("intake");
  });

  it("answers what counts as finished per board", async () => {
    const p = await projects.createProject({ title: "Shoots" });
    await store.setStatuses(p.id, [
      { key: "booked", label: "Booked" },
      { key: "delivered", label: "Delivered", isDone: true },
    ]);
    expect(await store.isDoneStatus(p.id, "delivered")).toBe(true);
    expect(await store.isDoneStatus(p.id, "booked")).toBe(false);
    // The word "done" is not special — only the flag is.
    expect(await store.isDoneStatus(p.id, "done")).toBe(false);
  });

  it("falls back to global once a project's overrides are cleared", async () => {
    const p = await projects.createProject({ title: "Shoots" });
    await store.setStatuses(p.id, [{ key: "only", label: "Only", isDone: true }]);
    await store.clearProjectStatuses(p.id);
    expect((await store.resolveStatuses(p.id)).map((s) => s.key)).toEqual(DEFAULT_KEYS);
  });

  it("resolves many boards in one call", async () => {
    const a = await projects.createProject({ title: "A" });
    const b = await projects.createProject({ title: "B" });
    await store.setStatuses(a.id, [{ key: "x", label: "X", isDone: true }]);
    const map = await store.resolveStatusesForProjects([a.id, b.id, null]);
    expect(map.get(a.id)?.map((s) => s.key)).toEqual(["x"]);
    expect(map.get(b.id)?.map((s) => s.key)).toEqual(DEFAULT_KEYS);
    expect(map.get("")?.map((s) => s.key)).toEqual(DEFAULT_KEYS);
  });
});

describe("validation", () => {
  it("refuses an empty board", async () => {
    await expect(store.setStatuses(null, [])).rejects.toThrow(/at least one column/);
  });

  it("forces a done column so work can be completed", async () => {
    const p = await projects.createProject({ title: "P" });
    const { statuses } = await store.setStatuses(p.id, [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
    ]);
    // Nothing marked done means recurrence never rolls and progress never fills,
    // so the last column is promoted.
    expect(statuses.map((s) => s.isDone)).toEqual([false, true]);
  });

  it("drops duplicate keys and caps the board width", async () => {
    const p = await projects.createProject({ title: "P" });
    const many = Array.from({ length: 20 }, (_, i) => ({ key: `c${i}`, label: `C${i}` }));
    const { statuses } = await store.setStatuses(p.id, [
      { key: "dup", label: "One" },
      { key: "dup", label: "Two" },
      ...many,
    ]);
    expect(statuses.filter((s) => s.key === "dup")).toHaveLength(1);
    expect(statuses.length).toBeLessThanOrEqual(store.MAX_STATUSES_PER_BOARD);
  });

  it("keeps a valid colour and replaces a bad one", async () => {
    const p = await projects.createProject({ title: "P" });
    const { statuses } = await store.setStatuses(p.id, [
      { key: "a", label: "A", color: "#c0000a" },
      { key: "b", label: "B", color: "red; background:url(x)", isDone: true },
    ]);
    expect(statuses[0]?.color).toBe("#c0000a");
    expect(statuses[1]?.color).toBe("#6b7280");
  });

  it("keeps a positive WIP limit and discards nonsense", async () => {
    const p = await projects.createProject({ title: "P" });
    const { statuses } = await store.setStatuses(p.id, [
      { key: "a", label: "A", wipLimit: 3 },
      { key: "b", label: "B", wipLimit: -2, isDone: true },
    ]);
    expect(statuses[0]?.wipLimit).toBe(3);
    expect(statuses[1]?.wipLimit).toBeNull();
  });
});

describe("remapping stranded tasks", () => {
  it("moves tasks off a column that no longer exists", async () => {
    const p = await projects.createProject({ title: "Shoots" });
    const keep = await projects.createTask({ title: "Keep", projectId: p.id, status: "todo" });
    const strand = await projects.createTask({
      title: "Strand",
      projectId: p.id,
      status: "review",
    });
    const { remapped } = await store.setStatuses(p.id, [
      { key: "todo", label: "Todo" },
      { key: "done", label: "Done", isDone: true },
    ]);
    expect(remapped).toBe(1);
    expect((await projects.getTask(strand.id))?.status).toBe("todo");
    expect((await projects.getTask(keep.id))?.status).toBe("todo");
  });

  it("reports nothing remapped when every task still fits", async () => {
    const p = await projects.createProject({ title: "Shoots" });
    await projects.createTask({ title: "A", projectId: p.id, status: "todo" });
    const { remapped } = await store.setStatuses(p.id, [
      { key: "todo", label: "Todo" },
      { key: "done", label: "Done", isDone: true },
    ]);
    expect(remapped).toBe(0);
  });

  it("does not disturb another project's tasks", async () => {
    const a = await projects.createProject({ title: "A" });
    const b = await projects.createProject({ title: "B" });
    const untouched = await projects.createTask({
      title: "B task",
      projectId: b.id,
      status: "review",
    });
    await store.setStatuses(a.id, [{ key: "only", label: "Only", isDone: true }]);
    expect((await projects.getTask(untouched.id))?.status).toBe("review");
  });

  it("rescues project-less tasks when the global set changes", async () => {
    const loose = await projects.createTask({ title: "Loose", status: "review" });
    const { remapped } = await store.setStatuses(null, [
      { key: "todo", label: "Todo" },
      { key: "done", label: "Done", isDone: true },
    ]);
    expect(remapped).toBeGreaterThanOrEqual(1);
    expect((await projects.getTask(loose.id))?.status).toBe("todo");
  });

  it("leaves a customised project alone when the global set changes", async () => {
    const p = await projects.createProject({ title: "Custom" });
    await store.setStatuses(p.id, [
      { key: "booked", label: "Booked" },
      { key: "delivered", label: "Delivered", isDone: true },
    ]);
    const task = await projects.createTask({ title: "T", projectId: p.id, status: "booked" });
    await store.setStatuses(null, [
      { key: "todo", label: "Todo" },
      { key: "done", label: "Done", isDone: true },
    ]);
    // Its board still has "booked", so the global rewrite must not touch it.
    expect((await projects.getTask(task.id))?.status).toBe("booked");
  });

  it("stores a status the old CHECK constraint would have rejected", async () => {
    // The whole point of the migration: 'delivered' was not one of the four.
    const p = await projects.createProject({ title: "Shoots" });
    await store.setStatuses(p.id, [{ key: "delivered", label: "Delivered", isDone: true }]);
    const t = await projects.createTask({
      title: "Custom status",
      projectId: p.id,
      status: "delivered" as never,
    });
    expect((await projects.getTask(t.id))?.status).toBe("delivered");
  });
});
