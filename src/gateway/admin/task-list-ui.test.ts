import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { TASK_LIST_COMPONENT_JS, TASK_LIST_MARKUP } from "./task-list-ui.js";

type Task = Record<string, unknown>;

/**
 * The module is browser JS the SPAs interpolate, so it is evaluated in a real
 * window. The pure helpers are pulled straight off it; the components are
 * driven through the DOM.
 */
function load() {
  const dom = new JSDOM(
    `<!DOCTYPE html><div id="bar">${TASK_LIST_MARKUP}</div><div id="list"></div>`,
    {
      runScripts: "outside-only",
    },
  );
  const { window } = dom;
  const escape = (v: unknown) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
  window.eval(`var esc = ${escape.toString()};\n${TASK_LIST_COMPONENT_JS}`);
  return window as unknown as {
    document: Document;
    makeTaskFilter: () => Record<string, unknown>;
    applyTaskFilter: (
      t: Task[],
      f: Record<string, unknown>,
      ctx?: Record<string, unknown>,
    ) => Task[];
    sortTasks: (t: Task[], key: string, dir?: string) => Task[];
    dueState: (due: number | null, status: string, now?: number) => string;
    dueLabel: (due: number | null, status: string, now?: number) => string;
    createTaskFilterBar: (cfg: Record<string, unknown>) => {
      filter: () => Record<string, unknown>;
      apply: (t: Task[]) => Task[];
      setCount: (a: number, b: number) => void;
      refreshOptions: () => void;
    };
    createTaskList: (cfg: Record<string, unknown>) => { render: () => void };
  };
}

const NOW = new Date(2026, 6, 15, 10, 0, 0).getTime();
const days = (n: number) => new Date(2026, 6, 15 + n, 12, 0, 0).getTime();

const task = (over: Task = {}): Task => ({
  id: "t1",
  title: "Edit walkthrough",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: null,
  assigneeIds: [],
  tags: [],
  position: 0,
  createdAt: 0,
  ...over,
});

describe("dueState", () => {
  it("classifies relative to local midnight", () => {
    const w = load();
    expect(w.dueState(days(-1), "todo", NOW)).toBe("overdue");
    expect(w.dueState(days(0), "todo", NOW)).toBe("today");
    expect(w.dueState(days(3), "todo", NOW)).toBe("soon");
    expect(w.dueState(days(30), "todo", NOW)).toBe("later");
    expect(w.dueState(null, "todo", NOW)).toBe("none");
  });

  it("does not call a finished task overdue", () => {
    const w = load();
    // A task delivered late is done, not a fire — colouring it red is noise.
    expect(w.dueState(days(-5), "done", NOW)).toBe("done");
  });

  it("counts a task due earlier today as still due today", () => {
    const w = load();
    expect(w.dueState(new Date(2026, 6, 15, 1, 0, 0).getTime(), "todo", NOW)).toBe("today");
  });

  it("words overdue in whole days", () => {
    const w = load();
    expect(w.dueLabel(days(-1), "todo", NOW)).toBe("1 day overdue");
    expect(w.dueLabel(days(-4), "todo", NOW)).toBe("4 days overdue");
    expect(w.dueLabel(days(0), "todo", NOW)).toBe("Due today");
  });
});

describe("applyTaskFilter", () => {
  const w = load();
  const base = w.makeTaskFilter();
  const tasks: Task[] = [
    task({
      id: "a",
      title: "Shoot 12 Oak",
      priority: "urgent",
      assigneeIds: ["u1"],
      tags: ["shoot"],
      dueDate: days(-2),
    }),
    task({
      id: "b",
      title: "Edit 44 Elm",
      priority: "low",
      assigneeIds: ["u2"],
      tags: ["edit"],
      dueDate: days(0),
    }),
    task({
      id: "c",
      title: "Invoice run",
      priority: "medium",
      assigneeIds: [],
      tags: [],
      dueDate: null,
    }),
    task({
      id: "d",
      title: "Archive old",
      status: "done",
      priority: "low",
      assigneeIds: ["u1"],
      dueDate: days(-9),
    }),
  ];
  const ids = (r: Task[]) => r.map((t) => t.id);

  it("passes everything through an empty filter", () => {
    expect(ids(w.applyTaskFilter(tasks, base))).toEqual(["a", "b", "c", "d"]);
  });

  it("matches text against title, description and tags", () => {
    expect(ids(w.applyTaskFilter(tasks, { ...base, text: "elm" }))).toEqual(["b"]);
    expect(ids(w.applyTaskFilter(tasks, { ...base, text: "SHOOT" }))).toEqual(["a"]);
    const withDesc = [task({ id: "x", description: "needs drone footage" })];
    expect(ids(w.applyTaskFilter(withDesc, { ...base, text: "drone" }))).toEqual(["x"]);
  });

  it("filters by assignee, priority and tag", () => {
    expect(ids(w.applyTaskFilter(tasks, { ...base, assignee: "u1" }))).toEqual(["a", "d"]);
    expect(ids(w.applyTaskFilter(tasks, { ...base, priority: "low" }))).toEqual(["b", "d"]);
    expect(ids(w.applyTaskFilter(tasks, { ...base, tag: "edit" }))).toEqual(["b"]);
  });

  it("scopes 'only mine' to the viewer", () => {
    expect(ids(w.applyTaskFilter(tasks, { ...base, mine: true }, { userId: "u2" }))).toEqual(["b"]);
  });

  it("shows nothing for 'only mine' when nobody is signed in", () => {
    // Better to show an empty list than silently show everyone's work.
    expect(w.applyTaskFilter(tasks, { ...base, mine: true }, {})).toEqual([]);
  });

  it("filters by due window, and treats a done task as not overdue", () => {
    expect(ids(w.applyTaskFilter(tasks, { ...base, due: "overdue" }, { now: NOW }))).toEqual(["a"]);
    expect(ids(w.applyTaskFilter(tasks, { ...base, due: "today" }, { now: NOW }))).toEqual(["b"]);
    expect(ids(w.applyTaskFilter(tasks, { ...base, due: "none" }, { now: NOW }))).toEqual(["c"]);
    expect(ids(w.applyTaskFilter(tasks, { ...base, due: "week" }, { now: NOW }))).toEqual([
      "a",
      "b",
    ]);
  });

  it("combines filters as AND", () => {
    const r = w.applyTaskFilter(tasks, { ...base, assignee: "u1", priority: "urgent" });
    expect(ids(r)).toEqual(["a"]);
  });
});

describe("sortTasks", () => {
  const w = load();

  it("orders by priority severity, not alphabetically", () => {
    const t = [
      task({ id: "l", priority: "low" }),
      task({ id: "u", priority: "urgent" }),
      task({ id: "m", priority: "medium" }),
    ];
    expect(w.sortTasks(t, "priority", "asc").map((x) => x.id)).toEqual(["u", "m", "l"]);
    expect(w.sortTasks(t, "priority", "desc").map((x) => x.id)).toEqual(["l", "m", "u"]);
  });

  it("orders by workflow order for status", () => {
    const t = [
      task({ id: "d", status: "done" }),
      task({ id: "t", status: "todo" }),
      task({ id: "r", status: "review" }),
    ];
    expect(w.sortTasks(t, "status", "asc").map((x) => x.id)).toEqual(["t", "r", "d"]);
  });

  it("keeps undated tasks last in both directions", () => {
    const t = [
      task({ id: "none", dueDate: null }),
      task({ id: "late", dueDate: days(9) }),
      task({ id: "soon", dueDate: days(1) }),
    ];
    expect(w.sortTasks(t, "due", "asc").map((x) => x.id)).toEqual(["soon", "late", "none"]);
    expect(w.sortTasks(t, "due", "desc").map((x) => x.id)).toEqual(["late", "soon", "none"]);
  });

  it("falls back to manual board order for an unknown key", () => {
    const t = [task({ id: "b", position: 2 }), task({ id: "a", position: 1 })];
    expect(w.sortTasks(t, "whatever", "asc").map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input", () => {
    const t = [task({ id: "b", priority: "low" }), task({ id: "a", priority: "urgent" })];
    w.sortTasks(t, "priority", "asc");
    expect(t.map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("createTaskFilterBar", () => {
  it("reflects controls into the filter and reports the count", () => {
    const w = load();
    let changes = 0;
    const bar = w.createTaskFilterBar({
      rootId: "bar",
      onChange: () => {
        changes++;
      },
      people: () => [{ id: "u1", name: "steve" }],
      tags: () => ["shoot"],
      currentUserId: () => "u1",
    });
    bar.refreshOptions();
    const doc = w.document;
    const search = doc.querySelector(".tl-search") as HTMLInputElement;
    search.value = "oak";
    search.dispatchEvent(
      new (w as never as { window: Window }).window.Event("input", { bubbles: true }),
    );
    expect(bar.filter().text).toBe("oak");
    expect(changes).toBeGreaterThan(0);
    // Clear appears only once something is set.
    expect((doc.querySelector(".tl-clear") as HTMLElement).classList.contains("hidden")).toBe(
      false,
    );
    bar.setCount(3, 10);
    expect(doc.querySelector(".tl-count")?.textContent).toBe("3 of 10 tasks");
    bar.setCount(10, 10);
    expect(doc.querySelector(".tl-count")?.textContent).toBe("10 tasks");
  });

  it("clears every control at once", () => {
    const w = load();
    const bar = w.createTaskFilterBar({ rootId: "bar", people: () => [], tags: () => [] });
    const doc = w.document;
    const mine = doc.querySelector(".tl-mine-chk") as HTMLInputElement;
    mine.checked = true;
    mine.dispatchEvent(
      new (w as never as { window: Window }).window.Event("change", { bubbles: true }),
    );
    expect(bar.filter().mine).toBe(true);
    (doc.querySelector(".tl-clear") as HTMLElement).click();
    expect(bar.filter().mine).toBe(false);
    expect((doc.querySelector(".tl-clear") as HTMLElement).classList.contains("hidden")).toBe(true);
  });
});

describe("createTaskList", () => {
  function mountList(tasks: Task[], over: Record<string, unknown> = {}) {
    const w = load();
    const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const opened: string[] = [];
    const list = w.createTaskList({
      rootId: "list",
      tasks: () => tasks,
      projectFor: () => null,
      userLabel: (id: string) => id,
      onOpen: (id: string) => opened.push(id),
      onPatch: (id: string, patch: Record<string, unknown>) => patches.push({ id, patch }),
      groupBy: () => "",
      ...over,
    });
    list.render();
    return { w, doc: w.document, list, patches, opened };
  }

  it("renders a row per task with inline status and priority", () => {
    const { doc } = mountList([task({ id: "a" }), task({ id: "b", title: "Second" })]);
    expect(doc.querySelectorAll("tbody tr[data-id]").length).toBe(2);
    expect(doc.querySelector('tr[data-id="a"] select[data-field="status"]')).not.toBeNull();
    expect(doc.querySelector('tr[data-id="a"] select[data-field="priority"]')).not.toBeNull();
  });

  it("says so when filters leave nothing", () => {
    const { doc } = mountList([]);
    expect(doc.querySelector(".tl-empty-row")?.textContent).toContain("No tasks match");
  });

  it("emits a patch when a row's status is changed inline", () => {
    const { doc, patches, w } = mountList([task({ id: "a" })]);
    const sel = doc.querySelector(
      'tr[data-id="a"] select[data-field="status"]',
    ) as HTMLSelectElement;
    sel.value = "review";
    sel.dispatchEvent(
      new (w as never as { window: Window }).window.Event("change", { bubbles: true }),
    );
    expect(patches).toEqual([{ id: "a", patch: { status: "review" } }]);
  });

  it("opens a task when its title is clicked", () => {
    const { doc, opened } = mountList([task({ id: "a" })]);
    (doc.querySelector('[data-open="a"]') as HTMLElement).click();
    expect(opened).toEqual(["a"]);
  });

  it("toggles sort direction on a repeated header click", () => {
    const { doc } = mountList([
      task({ id: "l", priority: "low" }),
      task({ id: "u", priority: "urgent" }),
    ]);
    const th = () => doc.querySelector('th[data-sort="priority"]') as HTMLElement;
    th().click();
    let order = Array.from(doc.querySelectorAll("tbody tr[data-id]")).map((r) =>
      r.getAttribute("data-id"),
    );
    expect(order).toEqual(["u", "l"]);
    th().click();
    order = Array.from(doc.querySelectorAll("tbody tr[data-id]")).map((r) =>
      r.getAttribute("data-id"),
    );
    expect(order).toEqual(["l", "u"]);
  });

  it("groups rows under headings when asked", () => {
    const { doc } = mountList(
      [task({ id: "a", status: "todo" }), task({ id: "b", status: "done" })],
      { groupBy: () => "status" },
    );
    const groups = Array.from(doc.querySelectorAll(".tl-group-row")).map((r) => r.textContent);
    expect(groups.some((g) => g?.includes("Todo"))).toBe(true);
    expect(groups.some((g) => g?.includes("Done"))).toBe(true);
  });

  it("escapes task titles", () => {
    const { doc } = mountList([task({ id: "a", title: "<img src=x onerror=alert(1)>" })]);
    expect(doc.querySelector("tbody")?.querySelector("img")).toBeNull();
    expect(doc.querySelector(".tl-title-cell")?.textContent).toContain("<img src=x");
  });
});
