import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { TASK_STATUS_COMPONENT_JS } from "./task-status-ui.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * Both dashboards ship their SPA as inline JS inside a template string, which
 * no type or lint pass sees. These tests parse that script and lift the
 * project-visibility block out of the shipped HTML so the rules deciding what
 * lands on the board are covered rather than assumed.
 */

function inlineScripts(html: string): string[] {
  return Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g)).map((m) => m[1]);
}

type ProjectLike = { id: string; status: string };
type TaskLike = { id: string; projectId: string | null; parentTaskId?: string | null };

function loadVisibilityModel(opts: {
  projects: ProjectLike[];
  tasks: TaskLike[];
  projectsFilter?: string;
  showClosed?: boolean;
}) {
  const script = inlineScripts(ADMIN_UI_HTML)[0];
  if (!script) {
    throw new Error("no inline script found in ADMIN_UI_HTML");
  }

  const start = script.indexOf("function isClosedProject(p) {");
  const endMarker = "function renderProjectsPage()";
  const endIdx = script.indexOf(endMarker);
  if (start === -1 || endIdx === -1) {
    throw new Error("project visibility block not found — did the SPA change?");
  }
  const block = script.slice(start, endIdx);

  // The block closes over SPA state and over helpers it never calls here
  // (loadProjects/populateProjectFilter touch the DOM but stay unreached).
  // The block also builds the shared filter bar and list view, which reach for
  // the DOM and for SPA-wide state. Stub them: this suite is about project
  // visibility, and the filter bar has its own tests in task-list-ui.test.ts.
  // The pass-through `apply` keeps getFilteredTasks equal to its unfiltered
  // scope, which is exactly what these cases assert on.
  const preamble = `
    let allProjects = ${JSON.stringify(opts.projects)};
    let allTasks = ${JSON.stringify(opts.tasks)};
    let projectsFilter = ${JSON.stringify(opts.projectsFilter ?? "")};
    let showClosedProjects = ${opts.showClosed ? "true" : "false"};
    let adminUsers = [];
    let currentUser = null;
    function createTaskFilterBar() {
      return {
        apply: function (t) { return t; },
        refreshOptions: function () {},
        setCount: function () {},
        filter: function () { return {}; },
        reset: function () {},
      };
    }
    function createTaskList() { return { render: function () {} }; }
    function createMyWork() { return { render: function () {} }; }
    function myWorkTasks(t) { return t; }
    function userLabel(id) { return id; }
    function openEditTask() {}
    function api() {}
    function loadProjects() {}
    function renderProjectsPage() {}
    var statusRegistry = { isDoneTask: function () { return false; }, doneKey: function () { return 'done'; }, defaultKey: function () { return 'todo'; } };
  `;
  // Evaluating the shipped block is the point of this suite; the input is our
  // own source file, not user data.
  // oxlint-disable-next-line no-implied-eval
  const factory = new Function(
    `${preamble}\n${block}\nreturn { isClosedProject, matchesStatusTab, selectableProjects, getFilteredTasks };`,
  );
  return factory() as {
    isClosedProject: (p: ProjectLike) => boolean;
    matchesStatusTab: (p: ProjectLike, tab: string) => boolean;
    selectableProjects: () => ProjectLike[];
    getFilteredTasks: () => TaskLike[];
  };
}

const PROJECTS: ProjectLike[] = [
  { id: "p-active", status: "active" },
  { id: "p-planning", status: "planning" },
  { id: "p-done", status: "completed" },
  { id: "p-archived", status: "archived" },
];

const TASKS: TaskLike[] = [
  { id: "t-active", projectId: "p-active" },
  { id: "t-planning", projectId: "p-planning" },
  { id: "t-done", projectId: "p-done" },
  { id: "t-archived", projectId: "p-archived" },
  { id: "t-loose", projectId: null },
  { id: "t-sub", projectId: "p-active", parentTaskId: "t-active" },
];

describe("admin SPA inline script", () => {
  it("parses as valid JavaScript", () => {
    for (const script of inlineScripts(ADMIN_UI_HTML)) {
      // oxlint-disable-next-line no-implied-eval
      expect(() => new Function(script)).not.toThrow();
    }
  });
});

describe("user portal inline script", () => {
  it("parses as valid JavaScript", () => {
    for (const script of inlineScripts(USER_PORTAL_HTML)) {
      // oxlint-disable-next-line no-implied-eval
      expect(() => new Function(script)).not.toThrow();
    }
  });
});

// The portal shipped board-only for a while, so members had no calendar at all
// while the dashboard did. Both SPAs now mount the same shared component; these
// pin that down from either side.
describe("both SPAs mount the shared calendar", () => {
  const surfaces: Array<[string, string]> = [
    ["admin dashboard", ADMIN_UI_HTML],
    ["user portal", USER_PORTAL_HTML],
  ];

  it.each(surfaces)("%s carries the calendar markup", (_label, html) => {
    expect(html).toContain('class="cal-weekdays"');
    expect(html).toContain('class="cal-days"');
    expect(html).toContain('class="btn btn-ghost btn-sm cal-prev"');
    expect(html).toContain('class="btn btn-ghost btn-sm cal-next"');
  });

  it.each(surfaces)("%s instantiates the shared component", (_label, html) => {
    expect(html).toContain("function createProjectCalendar(cfg)");
    expect(html).toContain("createProjectCalendar({");
  });

  it("gives the portal a Board/Calendar switch pointing at both containers", () => {
    expect(USER_PORTAL_HTML).toContain('id="pt-view-board"');
    expect(USER_PORTAL_HTML).toContain('id="pt-view-cal"');
    expect(USER_PORTAL_HTML).toContain('id="pt-calendar"');
    expect(USER_PORTAL_HTML).toContain("rootId: 'pt-calendar'");
  });

  it.each(surfaces)("%s mounts the shared filter bar and list view", (_label, html) => {
    expect(html).toContain('class="tl-search"');
    expect(html).toContain("function createTaskFilterBar(cfg)");
    expect(html).toContain("createTaskFilterBar({");
    expect(html).toContain("function createTaskList(cfg)");
    expect(html).toContain("createTaskList({");
  });

  it.each(surfaces)("%s uses the shared due chip rather than its own", (_label, html) => {
    expect(html).toContain("function dueChip(task, now)");
    expect(html).toContain("dueChip(task)");
  });

  it("keeps one copy of the month-grid logic, not a fork per SPA", () => {
    // The renderer body must come from the shared module only. Two copies of
    // this line would mean the SPAs had drifted apart again.
    const marker = "html += '<div class=\"cal-day' + (isToday ? ' today' : '')";
    for (const [, html] of surfaces) {
      expect(html.split(marker).length - 1).toBe(1);
    }
  });
});

describe("closed projects stay off the board", () => {
  it("hides completed and archived projects from pickers by default", () => {
    const m = loadVisibilityModel({ projects: PROJECTS, tasks: TASKS });
    expect(m.selectableProjects().map((p) => p.id)).toEqual(["p-active", "p-planning"]);
  });

  it("shows every project once 'Show closed' is on", () => {
    const m = loadVisibilityModel({ projects: PROJECTS, tasks: TASKS, showClosed: true });
    expect(m.selectableProjects().map((p) => p.id)).toEqual(PROJECTS.map((p) => p.id));
  });

  it("keeps a closed project listed while it is the active filter", () => {
    // Archiving the project you are looking at must not blank the selection.
    const m = loadVisibilityModel({
      projects: PROJECTS,
      tasks: TASKS,
      projectsFilter: "p-archived",
    });
    expect(m.selectableProjects().map((p) => p.id)).toContain("p-archived");
  });

  it("drops tasks belonging to closed projects, keeping loose tasks", () => {
    const m = loadVisibilityModel({ projects: PROJECTS, tasks: TASKS });
    expect(m.getFilteredTasks().map((t) => t.id)).toEqual(["t-active", "t-planning", "t-loose"]);
  });

  it("still excludes subtasks, which belong to the task modal", () => {
    const m = loadVisibilityModel({ projects: PROJECTS, tasks: TASKS, showClosed: true });
    expect(m.getFilteredTasks().map((t) => t.id)).not.toContain("t-sub");
  });

  it("narrows to one project when a filter is set", () => {
    const m = loadVisibilityModel({ projects: PROJECTS, tasks: TASKS, projectsFilter: "p-active" });
    expect(m.getFilteredTasks().map((t) => t.id)).toEqual(["t-active"]);
  });
});

/**
 * The Projects list opens on work in hand. Finished work is one tab away rather
 * than gone, so these pin both halves: what Open hides, and that every other
 * tab still reaches it.
 */
describe("the Projects list status tabs", () => {
  const { matchesStatusTab } = loadVisibilityModel({ projects: PROJECTS, tasks: TASKS });
  const idsOn = (tab: string) => PROJECTS.filter((p) => matchesStatusTab(p, tab)).map((p) => p.id);

  it("shows planning and active work on Open", () => {
    expect(idsOn("open")).toEqual(["p-active", "p-planning"]);
  });

  it("still reaches completed and archived projects on their own tabs", () => {
    expect(idsOn("completed")).toEqual(["p-done"]);
    expect(idsOn("archived")).toEqual(["p-archived"]);
    expect(idsOn("planning")).toEqual(["p-planning"]);
    expect(idsOn("active")).toEqual(["p-active"]);
  });

  it("keeps All unfiltered", () => {
    expect(idsOn("all")).toEqual(PROJECTS.map((p) => p.id));
  });

  it("lands on Open, with All beside it", () => {
    // The default lives in two places that must agree: the state variable the
    // first render reads, and the tab painted as selected.
    expect(ADMIN_UI_HTML).toContain("let projectsStatusFilter = 'open';");
    expect(ADMIN_UI_HTML).toContain(
      '<button class="view-btn active" data-status="open">Open</button>',
    );
    expect(ADMIN_UI_HTML).toContain('<button class="view-btn" data-status="all">All</button>');
  });
});

/**
 * Board columns are data now, so the shipped renderBoard is lifted out of the
 * SPA and run against a real DOM. Parsing alone would not catch a board that
 * draws the wrong columns — or silently drops a card whose status the column
 * set in view does not define.
 */
function renderBoardWith(opts: {
  columns: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  projectsFilter?: string;
}) {
  const script = inlineScripts(ADMIN_UI_HTML)[0];
  if (!script) {
    throw new Error("no inline script found in ADMIN_UI_HTML");
  }
  const start = script.indexOf("function renderBoard() {");
  const end = script.indexOf("// ── Board drag & drop");
  if (start === -1 || end === -1) {
    throw new Error("renderBoard block not found — did the SPA change?");
  }

  const dom = new JSDOM(
    `<!DOCTYPE html><div id="projects-board"><div class="board-wrap" id="board-cols"></div></div>`,
    { runScripts: "outside-only" },
  );
  const escape = (v: string | number | null | undefined) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
  // The board only needs the columns and the tasks; cards and the filter bar
  // have their own coverage, so both are stubbed down to what it reads.
  const preamble = `
    var esc = ${escape.toString()};
    var projectsFilter = ${JSON.stringify(opts.projectsFilter ?? "")};
    function getFilteredTasks() { return ${JSON.stringify(opts.tasks)}; }
    function renderTaskCard(t) { return '<div class="task-card" data-id="' + esc(t.id) + '"></div>'; }
    var statusRegistry = createStatusRegistry({ api: function() {
      return Promise.resolve({ ok: true, data: { sets: { '': ${JSON.stringify(opts.columns)} }, custom: {} } });
    } });
  `;
  dom.window.eval(`${TASK_STATUS_COMPONENT_JS}\n${preamble}\n${script.slice(start, end)}`);
  return {
    async render() {
      await (dom.window.eval("statusRegistry.ensure([])") as Promise<void>);
      (dom.window.eval("renderBoard") as () => void)();
      return dom.window.document;
    },
  };
}

const COLS = [
  { key: "booked", label: "Booked", color: "#6b7280", isDone: false, wipLimit: null },
  { key: "shot", label: "Shot", color: "#3b82f6", isDone: false, wipLimit: 2 },
  { key: "delivered", label: "Delivered", color: "#16a34a", isDone: true, wipLimit: null },
];

describe("the board draws whatever columns its project defines", () => {
  it("renders one column per status, in order, with its own label and colour", async () => {
    const doc = await renderBoardWith({ columns: COLS, tasks: [] }).render();
    const titles = Array.from(doc.querySelectorAll(".board-col-title")).map((el) =>
      el.textContent?.trim(),
    );
    expect(titles).toEqual(["Booked", "Shot", "Delivered"]);
    const bodies = Array.from(doc.querySelectorAll(".board-col-body"));
    expect(bodies.map((b) => (b as HTMLElement).dataset.status)).toEqual([
      "booked",
      "shot",
      "delivered",
    ]);
  });

  it("places each card in its own column and counts it", async () => {
    const doc = await renderBoardWith({
      columns: COLS,
      tasks: [
        { id: "a", status: "booked", position: 0, createdAt: 0 },
        { id: "b", status: "delivered", position: 0, createdAt: 0 },
        { id: "c", status: "delivered", position: 1, createdAt: 0 },
      ],
    }).render();
    const bodies = Array.from(doc.querySelectorAll(".board-col-body"));
    expect(bodies[0]!.querySelectorAll(".task-card")).toHaveLength(1);
    expect(bodies[1]!.querySelectorAll(".task-card")).toHaveLength(0);
    expect(bodies[2]!.querySelectorAll(".task-card")).toHaveLength(2);
    const counts = Array.from(doc.querySelectorAll(".board-col-count")).map((el) =>
      el.textContent?.trim(),
    );
    expect(counts).toEqual(["1", "0 / 2", "2"]);
  });

  it("flags a column over its WIP limit without blocking anything", async () => {
    const doc = await renderBoardWith({
      columns: COLS,
      tasks: [
        { id: "a", status: "shot", position: 0, createdAt: 0 },
        { id: "b", status: "shot", position: 1, createdAt: 0 },
        { id: "c", status: "shot", position: 2, createdAt: 0 },
      ],
    }).render();
    const over = doc.querySelectorAll(".board-col-count.over-wip");
    expect(over).toHaveLength(1);
    expect(over[0]!.textContent?.trim()).toBe("3 / 2");
    // The cards are still drawn: the limit is a signal, not a gate.
    expect(doc.querySelectorAll(".task-card")).toHaveLength(3);
  });

  it("keeps a card whose status the visible column set does not define", async () => {
    const doc = await renderBoardWith({
      columns: COLS,
      tasks: [{ id: "stray", status: "awaiting_edit", position: 0, createdAt: 0 }],
    }).render();
    const titles = Array.from(doc.querySelectorAll(".board-col-title")).map((el) =>
      el.textContent?.trim(),
    );
    // An extra column appears rather than the card vanishing from the board
    // while still counting in every total.
    expect(titles).toEqual(["Booked", "Shot", "Delivered", "Awaiting Edit"]);
    expect(doc.querySelectorAll(".task-card")).toHaveLength(1);
  });

  it("offers Add Task on every column, carrying that column's key", async () => {
    const doc = await renderBoardWith({ columns: COLS, tasks: [] }).render();
    const keys = Array.from(doc.querySelectorAll(".board-add-btn")).map(
      (el) => (el as HTMLElement).dataset.status,
    );
    expect(keys).toEqual(["booked", "shot", "delivered"]);
  });
});
