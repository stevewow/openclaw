import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { TASK_STATUS_COMPONENT_JS } from "./task-status-ui.js";

type Column = {
  key: string;
  label: string;
  color: string;
  isDone: boolean;
  wipLimit: number | null;
  missing?: boolean;
};

type Registry = {
  ensure: (ids: Array<string | null>) => Promise<void>;
  columnsFor: (projectId: string) => Column[];
  columnsForView: (projectId: string, tasks: Array<Record<string, unknown>>) => Column[];
  columnOf: (projectId: string, key: string) => Column;
  isDone: (projectId: string, key: string) => boolean;
  isDoneTask: (task: Record<string, unknown> | null) => boolean;
  defaultKey: (projectId: string) => string;
  doneKey: (projectId: string) => string;
  labelOf: (projectId: string, key: string) => string;
  rankOf: (projectId: string, key: string) => number;
  isCustom: (projectId: string) => boolean;
  invalidate: (projectId?: string) => void;
  optionsHtml: (
    projectId: string,
    selected: string,
    tasks?: Array<Record<string, unknown>>,
  ) => string;
};

const col = (key: string, label: string, over: Partial<Column> = {}): Column => ({
  key,
  label,
  color: "#6b7280",
  isDone: false,
  wipLimit: null,
  ...over,
});

const GLOBAL_SET = [
  col("todo", "Todo"),
  col("in_progress", "In Progress"),
  col("done", "Done", { isDone: true }),
];

// A shoot pipeline: different keys, a different done column, and a WIP limit.
const SHOOT_SET = [
  col("booked", "Booked"),
  col("shot", "Shot", { wipLimit: 3 }),
  col("delivered", "Delivered", { isDone: true }),
];

/**
 * The module is browser JS the SPAs interpolate, so it runs in a real window.
 * `api` is stubbed to serve the batch endpoint the registry calls, and every
 * call is recorded so the caching behaviour can be asserted.
 */
function load(sets: Record<string, Column[]>, custom: Record<string, boolean> = {}) {
  const dom = new JSDOM("<!DOCTYPE html><div></div>", { runScripts: "outside-only" });
  const { window } = dom;
  const calls: string[] = [];
  const escape = (v: string | number | null | undefined) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
  window.eval(`var esc = ${escape.toString()};\n${TASK_STATUS_COMPONENT_JS}`);

  const api = async (_method: string, path: string) => {
    calls.push(path);
    const raw = path.split("projectIds=")[1];
    const ids = raw ? decodeURIComponent(raw).split(",").filter(Boolean) : [];
    const out: Record<string, Column[]> = { "": sets[""] ?? GLOBAL_SET };
    for (const id of ids) {
      out[id] = sets[id] ?? sets[""] ?? GLOBAL_SET;
    }
    return { ok: true, data: { sets: out, custom } };
  };

  const make = window.eval("createStatusRegistry") as (cfg: unknown) => Registry;
  return { registry: make({ api }), calls };
}

describe("createStatusRegistry", () => {
  it("serves the global set to projects that have not customized", async () => {
    const { registry } = load({ "": GLOBAL_SET });
    await registry.ensure(["p1"]);
    expect(registry.columnsFor("p1").map((c) => c.key)).toEqual(["todo", "in_progress", "done"]);
    expect(registry.columnsFor("").map((c) => c.key)).toEqual(["todo", "in_progress", "done"]);
  });

  it("gives each project its own columns", async () => {
    const { registry } = load({ "": GLOBAL_SET, shoots: SHOOT_SET });
    await registry.ensure(["shoots", "p1"]);
    expect(registry.columnsFor("shoots").map((c) => c.label)).toEqual([
      "Booked",
      "Shot",
      "Delivered",
    ]);
    expect(registry.columnsFor("p1").map((c) => c.label)).toEqual(["Todo", "In Progress", "Done"]);
  });

  it("resolves done against the task's own board, not the string 'done'", async () => {
    const { registry } = load({ "": GLOBAL_SET, shoots: SHOOT_SET });
    await registry.ensure(["shoots"]);
    // The shoot board finishes at Delivered; nothing on it is called 'done'.
    expect(registry.isDoneTask({ projectId: "shoots", status: "delivered" })).toBe(true);
    expect(registry.isDoneTask({ projectId: "shoots", status: "shot" })).toBe(false);
    expect(registry.isDoneTask({ projectId: "", status: "done" })).toBe(true);
    expect(registry.doneKey("shoots")).toBe("delivered");
    expect(registry.defaultKey("shoots")).toBe("booked");
  });

  it("keeps a task visible when its status is not a column on the board in view", async () => {
    const { registry } = load({ "": GLOBAL_SET, shoots: SHOOT_SET });
    await registry.ensure(["shoots"]);
    // An all-projects board draws the global set; a shoot task would otherwise
    // match no column and silently vanish while still counting in totals.
    const view = registry.columnsForView("", [
      { projectId: "shoots", status: "delivered" },
      { projectId: "", status: "todo" },
    ]);
    expect(view.map((c) => c.key)).toEqual(["todo", "in_progress", "done", "delivered"]);
    // It is drawn with the label its own project gives it.
    expect(view[3].label).toBe("Delivered");
  });

  it("reconstructs a column for a status no board defines any more", async () => {
    const { registry } = load({ "": GLOBAL_SET });
    await registry.ensure([]);
    const view = registry.columnsForView("", [{ projectId: "", status: "awaiting_edit" }]);
    expect(view.map((c) => c.key)).toEqual(["todo", "in_progress", "done", "awaiting_edit"]);
    expect(view[3].label).toBe("Awaiting Edit");
    // A stranded key must not be guessed as finished — that would tick tasks off
    // and roll recurrences over on nothing but a name.
    expect(view[3].isDone).toBe(false);
    expect(view[3].missing).toBe(true);
  });

  it("ranks by column order so a list sorted by status follows the board", async () => {
    const { registry } = load({ "": GLOBAL_SET, shoots: SHOOT_SET });
    await registry.ensure(["shoots"]);
    expect(registry.rankOf("shoots", "booked")).toBe(0);
    expect(registry.rankOf("shoots", "delivered")).toBe(2);
    // Unknown keys sort after every real column rather than ahead of them.
    expect(registry.rankOf("shoots", "nope")).toBe(3);
  });

  it("fetches each board once and refetches only after invalidation", async () => {
    const { registry, calls } = load({ "": GLOBAL_SET, shoots: SHOOT_SET });
    await registry.ensure(["shoots"]);
    await registry.ensure(["shoots"]);
    expect(calls).toHaveLength(1);
    registry.invalidate("shoots");
    await registry.ensure(["shoots"]);
    expect(calls).toHaveLength(2);
  });

  it("renders a picker limited to the board in view", async () => {
    const { registry } = load({ "": GLOBAL_SET, shoots: SHOOT_SET });
    await registry.ensure(["shoots"]);
    const html = registry.optionsHtml("shoots", "shot");
    expect(html).toContain('<option value="shot" selected>Shot</option>');
    expect(html).not.toContain("In Progress");
  });

  it("falls back to the seed columns before anything is loaded", () => {
    const { registry } = load({ "": GLOBAL_SET });
    expect(registry.columnsFor("").map((c) => c.key)).toEqual([
      "todo",
      "in_progress",
      "review",
      "done",
    ]);
    expect(registry.isDone("", "done")).toBe(true);
  });
});
