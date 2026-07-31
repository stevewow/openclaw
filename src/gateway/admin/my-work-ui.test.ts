import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { MY_WORK_COMPONENT_JS } from "./my-work-ui.js";
import { TASK_LIST_COMPONENT_JS } from "./task-list-ui.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * My Work is the landing view on both surfaces, so what it hides matters as
 * much as what it shows. The grouping is pure and tested directly; the rendered
 * list is driven through a real DOM.
 */

type Task = Record<string, unknown>;

const NOW = new Date(2026, 6, 15, 10, 0, 0).getTime();
const days = (n: number) => new Date(2026, 6, 15 + n, 12, 0, 0).getTime();

const task = (over: Task = {}): Task => ({
  id: "t1",
  title: "Edit walkthrough",
  status: "todo",
  priority: "medium",
  dueDate: null,
  assigneeIds: ["me"],
  projectId: null,
  position: 0,
  ...over,
});

function load() {
  const dom = new JSDOM(`<!DOCTYPE html><div id="mw"></div>`, { runScripts: "outside-only" });
  const escape = (v: string | number | null | undefined) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
  // dueChip/dueState come from the shared list module, exactly as in the SPAs.
  dom.window.eval(
    `var esc = ${escape.toString()};\n${TASK_LIST_COMPONENT_JS}\n${MY_WORK_COMPONENT_JS}`,
  );
  const w = dom.window as unknown as {
    document: Document;
    eval: (s: string) => unknown;
    groupMyWork: (
      t: Task[],
      now: number,
      isDone?: (t: Task) => boolean,
    ) => Array<{ key: string; label: string; tasks: Task[] }>;
    myWorkTasks: (t: Task[], userId: string | null) => Task[];
    createMyWork: (cfg: Record<string, unknown>) => { render: () => void };
  };
  return { dom, w, doc: dom.window.document };
}

describe("groupMyWork", () => {
  it("buckets by when a task is due, newest bucket first", () => {
    const { w } = load();
    const groups = w.groupMyWork(
      [
        task({ id: "late", dueDate: days(-2) }),
        task({ id: "now", dueDate: days(0) }),
        task({ id: "week", dueDate: days(3) }),
        task({ id: "far", dueDate: days(40) }),
        task({ id: "undated", dueDate: null }),
      ],
      NOW,
    );
    expect(groups.map((g) => g.key)).toEqual(["overdue", "today", "soon", "later", "none"]);
    expect(groups.map((g) => g.tasks.length)).toEqual([1, 1, 1, 1, 1]);
  });

  it("drops empty buckets rather than showing empty headings", () => {
    const { w } = load();
    const groups = w.groupMyWork([task({ dueDate: days(0) })], NOW);
    expect(groups.map((g) => g.key)).toEqual(["today"]);
  });

  it("leaves finished work out — this is a to-do list, not a record", () => {
    const { w } = load();
    const groups = w.groupMyWork(
      [
        task({ id: "a", dueDate: days(0) }),
        task({ id: "b", status: "delivered", dueDate: days(0) }),
      ],
      NOW,
      (t) => t.status === "delivered",
    );
    // Done is per board (a column flag), so the caller decides — not a string test.
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a"]);
  });

  it("sorts a bucket by due date, then priority", () => {
    const { w } = load();
    const groups = w.groupMyWork(
      [
        task({ id: "low-soon", dueDate: days(2), priority: "low" }),
        task({ id: "urgent-later", dueDate: days(4), priority: "urgent" }),
        task({ id: "urgent-soon", dueDate: days(2), priority: "urgent" }),
      ],
      NOW,
    );
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["urgent-soon", "low-soon", "urgent-later"]);
  });

  it("keeps undated work last inside Someday", () => {
    const { w } = load();
    const groups = w.groupMyWork(
      [task({ id: "b", priority: "low" }), task({ id: "a", priority: "urgent" })],
      NOW,
    );
    expect(groups[0].key).toBe("none");
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("myWorkTasks", () => {
  it("keeps only what is assigned to this person", () => {
    const { w } = load();
    const out = w.myWorkTasks(
      [
        task({ id: "mine", assigneeIds: ["me"] }),
        task({ id: "shared", assigneeIds: ["you", "me"] }),
        task({ id: "theirs", assigneeIds: ["you"] }),
        task({ id: "nobody", assigneeIds: [] }),
      ],
      "me",
    );
    expect(out.map((t) => t.id)).toEqual(["mine", "shared"]);
  });

  it("keeps subtasks — a subtask assigned to you is still your work", () => {
    const { w } = load();
    const out = w.myWorkTasks([task({ id: "sub", parentTaskId: "parent" })], "me");
    expect(out.map((t) => t.id)).toEqual(["sub"]);
  });

  it("shows nothing rather than everything when nobody is signed in", () => {
    const { w } = load();
    expect(w.myWorkTasks([task()], null)).toEqual([]);
  });
});

describe("createMyWork render", () => {
  function mount(tasks: Task[], over: Record<string, unknown> = {}) {
    const { w, doc } = load();
    const toggles: Array<[string, boolean]> = [];
    const opened: string[] = [];
    w.eval("createMyWork") as (cfg: Record<string, unknown>) => { render: () => void };
    const mw = w.createMyWork({
      rootId: "mw",
      tasks: () => tasks,
      currentUserId: () => "me",
      isDone: (t: Task) => t.status === "done",
      projectFor: (t: Task) => (t.projectId ? { title: "Shoots", color: "#3b82f6" } : null),
      now: () => NOW,
      onOpen: (id: string) => opened.push(id),
      onToggleDone: (id: string, done: boolean) => toggles.push([id, done]),
      ...over,
    });
    mw.render();
    return { doc, toggles, opened };
  }

  it("draws a heading per bucket with a count", () => {
    const { doc } = mount([
      task({ id: "a", dueDate: days(-1) }),
      task({ id: "b", dueDate: days(0) }),
      task({ id: "c", dueDate: days(0) }),
    ]);
    const titles = Array.from(doc.querySelectorAll(".mw-group-title")).map((el) => el.textContent);
    expect(titles).toEqual(["Overdue", "Today"]);
    const counts = Array.from(doc.querySelectorAll(".mw-group-count")).map((el) => el.textContent);
    expect(counts).toEqual(["1", "2"]);
  });

  it("says so plainly when there is nothing assigned", () => {
    const { doc } = mount([]);
    expect(doc.querySelector(".mw-empty")?.textContent).toContain("Nothing assigned to you");
    expect(doc.querySelectorAll(".mw-row")).toHaveLength(0);
  });

  it("opens a task when its row is clicked", () => {
    const { doc, opened } = mount([task({ id: "a", dueDate: days(0) })]);
    (doc.querySelector(".mw-row") as HTMLElement).click();
    expect(opened).toEqual(["a"]);
  });

  it("ticking the box completes the task without also opening it", () => {
    const { doc, toggles, opened } = mount([task({ id: "a", dueDate: days(0) })]);
    // click() toggles the box itself, so a plain click is the real gesture.
    const box = doc.querySelector(".mw-check") as HTMLInputElement;
    box.click();
    expect(box.checked).toBe(true);
    expect(toggles).toEqual([["a", true]]);
    // The checkbox is an action, not navigation.
    expect(opened).toEqual([]);
  });

  it("shows the project a task belongs to, and an overdue chip", () => {
    const { doc } = mount([task({ id: "a", dueDate: days(-3), projectId: "p1" })]);
    expect(doc.querySelector(".mw-sub")?.textContent).toContain("Shoots");
    expect(doc.querySelector(".due-chip.due-overdue")?.textContent).toBe("3 days overdue");
  });

  it("flags only urgent and high priority, so the list stays quiet", () => {
    const { doc } = mount([
      task({ id: "a", priority: "urgent", dueDate: days(0) }),
      task({ id: "b", priority: "medium", dueDate: days(0) }),
    ]);
    const flags = Array.from(doc.querySelectorAll(".mw-prio")).map((el) => el.textContent);
    expect(flags).toEqual(["urgent"]);
  });
});

describe("both SPAs land on My Work", () => {
  const surfaces: Array<[string, string]> = [
    ["admin dashboard", ADMIN_UI_HTML],
    ["user portal", USER_PORTAL_HTML],
  ];

  it.each(surfaces)("%s mounts the shared component", (_label, html) => {
    expect(html).toContain("function createMyWork(cfg)");
    expect(html).toContain("createMyWork({");
  });

  it.each(surfaces)("%s offers My Work in the view switcher", (_label, html) => {
    expect(html).toContain("My Work");
  });

  it("keeps one copy of the grouping logic, not a fork per SPA", () => {
    const marker = "function groupMyWork(tasks, now, isDone) {";
    for (const [, html] of surfaces) {
      expect(html.split(marker).length - 1).toBe(1);
    }
  });

  it.each(surfaces)("%s collapses its toolbar into one filter row", (_label, html) => {
    expect(html).toContain('class="board-tools"');
    expect(html).toContain('class="tool-menu-pop hidden"');
  });
});
