import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";

/**
 * The tracker's shell — its toolbar, its hash routing and its board card — is
 * inline JS and markup inside a template string that no type or lint pass sees.
 * The team called the old page overwhelming, so these pin the things that were
 * cut: three views in the open rather than five, and a card that carries a
 * title plus one line instead of five stacked blocks.
 */

function inlineScript(): string {
  const m = ADMIN_UI_HTML.match(/<script>([\s\S]*?)<\/script>/);
  if (!m?.[1]) {
    throw new Error("no inline script found in ADMIN_UI_HTML");
  }
  return m[1];
}

/** Lift a named block out of the SPA script so it can run on its own. */
function sliceBlock(start: string, end: string): string {
  const script = inlineScript();
  const from = script.indexOf(start);
  const to = script.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`block ${start} … ${end} not found — did the SPA change?`);
  }
  return script.slice(from, to);
}

// Stands in for the SPA's `esc`, which only ever escapes scalar task fields.
const escape = (v: string | number | null | undefined) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

describe("the tracker toolbar", () => {
  const dom = new JSDOM(ADMIN_UI_HTML, { runScripts: "outside-only" });
  const doc = dom.window.document;
  const toolbar = doc.querySelector("#page-projects .projects-toolbar");
  const menu = doc.querySelector("#tool-menu-pop");

  it("shows three views in the segmented control, not five", () => {
    // JSDOM ships no types, so everything off the document arrives as `any`;
    // naming the element type here keeps the map callback typed.
    const buttons: Element[] = toolbar
      ? Array.from(toolbar.querySelectorAll(".view-toggle .view-btn"))
      : [];
    const labels = buttons.map((b) => b.textContent?.trim());
    expect(labels).toEqual(["My Work", "Board", "List"]);
  });

  it("keeps the occasional views in the overflow menu", () => {
    expect(menu?.querySelector("#view-cal-btn")).not.toBeNull();
    expect(menu?.querySelector("#view-projects-btn")).not.toBeNull();
    // Both still exist as controls, so nothing became unreachable.
    expect(doc.querySelector("#view-cal-btn")).not.toBeNull();
    expect(doc.querySelector("#view-projects-btn")).not.toBeNull();
  });

  it("leaves one primary action in the bar and moves project actions into the menu", () => {
    // "+ New Task" is the everyday action and stays a button.
    expect(toolbar?.querySelector("#add-task-btn")).not.toBeNull();
    // Creating and editing a project is occasional; it moved behind ⋯.
    for (const id of ["#add-project-btn", "#edit-project-btn", "#dup-project-btn"]) {
      expect(menu?.querySelector(id), `${id} should be in the overflow menu`).not.toBeNull();
    }
  });

  it("still offers board columns and the closed-projects toggle", () => {
    expect(menu?.querySelector("#board-columns-btn")).not.toBeNull();
    expect(menu?.querySelector("#show-closed-projects")).not.toBeNull();
  });

  it("gives every menu view a tick slot so the active one can be marked", () => {
    expect(doc.querySelector("#view-cal-btn .tool-menu-tick")).not.toBeNull();
    expect(doc.querySelector("#view-projects-btn .tool-menu-tick")).not.toBeNull();
  });
});

describe("parseHash", () => {
  function load(hash: string) {
    const dom = new JSDOM("<!DOCTYPE html>", {
      url: `https://x.test/admin${hash}`,
      runScripts: "outside-only",
    });
    dom.window.eval(sliceBlock("function parseHash()", "function grants()"));
    return (
      dom.window as unknown as { parseHash: () => { page: string; params: Record<string, string> } }
    ).parseHash();
  }

  it("reads a bare page", () => {
    expect(load("#projects")).toEqual({ page: "projects", params: {} });
  });

  it("splits the deep-link target the mention emails send", () => {
    expect(load("#projects?task=abc-123")).toEqual({
      page: "projects",
      params: { task: "abc-123" },
    });
  });

  it("decodes an escaped id", () => {
    expect(load("#projects?task=a%20b%26c").params.task).toBe("a b&c");
  });

  it("returns an empty page for an empty hash, so the caller picks a default", () => {
    expect(load("").page).toBe("");
  });
});

describe("renderTaskCard", () => {
  type CardTask = Record<string, unknown>;

  function render(task: CardTask, over: { projects?: unknown[]; subtasks?: CardTask[] } = {}) {
    const dom = new JSDOM("<!DOCTYPE html><div id='out'></div>", { runScripts: "outside-only" });
    const { window } = dom;
    const subtasks = over.subtasks ?? [];
    window.eval(`
      var esc = ${escape.toString()};
      var allProjects = ${JSON.stringify(over.projects ?? [])};
      var allTasks = ${JSON.stringify([task, ...subtasks])};
      var statusRegistry = { isDoneTask: function(t) { return t.status === 'done'; } };
      function userLabel(id) { return id; }
      function attachmentCountFor() { return ${JSON.stringify(task.attachmentCount ?? 0)}; }
      function dueChip(t) { return '<span class="due-chip">due</span>'; }
      ${sliceBlock("function initials(name)", "/** Projects drawn on the calendar")}
    `);
    const html = (window as unknown as { renderTaskCard: (t: CardTask) => string }).renderTaskCard(
      task,
    );
    window.document.getElementById("out")!.innerHTML = html;
    return { doc: window.document, html };
  }

  const base: CardTask = {
    id: "t1",
    title: "Re-cut the Montgomery walkthrough",
    description: "A long description that used to eat three lines of the card.",
    status: "todo",
    priority: "medium",
    dueDate: null,
    assigneeIds: [],
    tags: ["shoot", "urgent-ish"],
    projectId: null,
    recurrence: null,
    commentCount: 0,
  };

  it("shows the title and drops the description and tags", () => {
    const { doc } = render(base);
    expect(doc.querySelector(".task-card-title")?.textContent).toBe(
      "Re-cut the Montgomery walkthrough",
    );
    // Both used to be their own block on every card; they live in the modal now.
    expect(doc.querySelector(".task-card-desc")).toBeNull();
    expect(doc.querySelector(".task-tags")).toBeNull();
  });

  it("hides routine priority and shows only what is actually hot", () => {
    expect(render({ ...base, priority: "medium" }).doc.querySelector(".task-prio")).toBeNull();
    expect(render({ ...base, priority: "low" }).doc.querySelector(".task-prio")).toBeNull();
    expect(
      render({ ...base, priority: "urgent" }).doc.querySelector(".task-prio")?.textContent,
    ).toContain("urgent");
    expect(render({ ...base, priority: "high" }).doc.querySelector(".task-prio")).not.toBeNull();
  });

  it("puts project, due date and counts on one line", () => {
    const { doc } = render(
      { ...base, projectId: "p1", dueDate: 123, commentCount: 2, attachmentCount: 1 },
      { projects: [{ id: "p1", title: "Coldwell Banker", color: "#3b82f6" }] },
    );
    const line = doc.querySelector(".task-card-line");
    expect(line).not.toBeNull();
    expect(line?.querySelector(".task-card-proj-name")?.textContent).toBe("Coldwell Banker");
    expect(line?.querySelector(".due-chip")).not.toBeNull();
    expect(line?.textContent).toContain("💬 2");
    // One row, not one labelled row per fact.
    expect(doc.querySelectorAll(".task-card-line").length).toBe(1);
    expect(doc.querySelector(".task-card-facts")).toBeNull();
  });

  it("omits the line entirely when there is nothing to say", () => {
    expect(render(base).doc.querySelector(".task-card-line")).toBeNull();
  });

  it("stacks assignees as initials and caps the row at three", () => {
    const { doc } = render({
      ...base,
      assigneeIds: ["Anna Marie", "Mark Kent", "Sam Poe", "Dev Roy", "Kim Lee"],
    });
    const avatars = doc.querySelectorAll(".task-assignee-row .task-assignee");
    // Three initials plus a "+2" counter.
    expect(avatars.length).toBe(4);
    expect(avatars[0]?.textContent).toBe("AM");
    expect(avatars[3]?.textContent).toBe("+2");
    // The full list stays reachable without opening the task.
    expect(doc.querySelector(".task-assignee-row")?.getAttribute("title")).toContain("Kim Lee");
    // Names no longer take a chip each.
    expect(doc.querySelector(".task-assignee-chip")).toBeNull();
  });

  it("puts subtask progress and assignees on the same last row", () => {
    const { doc } = render(
      { ...base, assigneeIds: ["Anna Marie"] },
      {
        subtasks: [
          { id: "s1", parentTaskId: "t1", status: "done" },
          { id: "s2", parentTaskId: "t1", status: "todo" },
        ],
      },
    );
    const foot = doc.querySelector(".task-card-foot");
    expect(foot?.querySelector(".task-subtask-count")?.textContent).toBe("1/2");
    expect(foot?.querySelector(".task-assignee-row")).not.toBeNull();
    expect((foot?.querySelector(".task-subtask-fill") as HTMLElement).style.width).toBe("50%");
  });

  it("stays draggable and keeps the ids the board relies on", () => {
    const { doc } = render({ ...base, status: "in_progress" });
    const card = doc.querySelector(".task-card") as HTMLElement;
    expect(card.getAttribute("draggable")).toBe("true");
    expect(card.dataset.id).toBe("t1");
    expect(card.dataset.status).toBe("in_progress");
  });
});

describe("the shipped SPA script", () => {
  it("parses — a syntax error here breaks the whole dashboard silently", () => {
    // Nothing in this file is type-checked or linted: it is a template string.
    // `new Function` parses without executing, so a stray brace or bad literal
    // fails here rather than in someone's browser.
    const script = inlineScript();
    expect(script.length).toBeGreaterThan(1000);
    // Parsing our own shipped source is the whole point of the check.
    // oxlint-disable-next-line no-implied-eval
    expect(() => new Function(script)).not.toThrow();
  });
});

describe("task assignment", () => {
  const dom = new JSDOM(ADMIN_UI_HTML, { runScripts: "outside-only" });
  const doc = dom.window.document;

  it("offers one assignee as a select, not a checkbox list", () => {
    const sel = doc.querySelector("#task-assignee");
    expect(sel).not.toBeNull();
    expect((sel as Element).tagName).toBe("SELECT");
    // The multi-select picker it replaced is gone from the task modal.
    expect(doc.querySelector("#task-assignees-list")).toBeNull();
  });

  it("keeps the checkbox picker for project membership, which is still many", () => {
    const members = doc.querySelector("#proj-members-list");
    expect(members).not.toBeNull();
    expect(members?.classList.contains("member-picker")).toBe(true);
  });

  it("collapses the assignee to a single-element array on save", () => {
    const script = inlineScript();
    const start = script.indexOf("function renderAssigneeSelect(");
    const end = script.indexOf("function isClosedProject(");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const win = new JSDOM(
      "<!DOCTYPE html><select id='task-assignee'><option value=''>Unassigned</option>" +
        "<option value='u1'>One</option><option value='u2'>Two</option></select>",
      { runScripts: "outside-only" },
    ).window;
    // oxlint-disable-next-line no-implied-eval
    const factory = new Function(
      "document",
      `${script.slice(start, end)}\nreturn { renderAssigneeSelect, readAssigneeSelect };`,
    );
    const api = factory(win.document) as {
      readAssigneeSelect: () => string[];
    };
    expect(api.readAssigneeSelect()).toEqual([]);
    (win.document.getElementById("task-assignee") as HTMLSelectElement).value = "u2";
    expect(api.readAssigneeSelect()).toEqual(["u2"]);
  });
});

describe("project detail", () => {
  const dom = new JSDOM(ADMIN_UI_HTML, { runScripts: "outside-only" });
  const doc = dom.window.document;

  it("ships a detail drawer with the hand-off actions", () => {
    expect(doc.querySelector("#proj-detail-modal")).not.toBeNull();
    expect(doc.querySelector("#proj-detail-body")).not.toBeNull();
    for (const id of ["#proj-detail-board", "#proj-detail-edit", "#proj-detail-dup"]) {
      expect(doc.querySelector(id), `${id} should exist`).not.toBeNull();
    }
  });

  it("starts hidden, so it does not cover the page on load", () => {
    expect(doc.querySelector("#proj-detail-modal")?.classList.contains("hidden")).toBe(true);
  });
});

describe("the projects filter row fits its container", () => {
  const css = ADMIN_UI_HTML.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";

  it("styles every select full-width by default — the rule the row must defend against", () => {
    expect(css).toMatch(/input,\s*select,\s*textarea\s*\{[^}]*width:\s*100%/);
  });

  it("gives the project picker its own width and lets it shrink", () => {
    // With width:100% inherited and flex-shrink:0 it claimed the entire row,
    // squeezed the filter bar to zero, and pushed search and Filters past the
    // clipped right edge of .main.
    const rule = css.match(/\.board-tools \.project-select\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/width:\s*auto/);
    expect(rule).toMatch(/max-width:/);
    expect(rule).not.toMatch(/flex-shrink:\s*0/);
  });

  it("keeps .main clipping, so an overflowing row is a bug and not a scrollbar", () => {
    expect(css).toMatch(/\.main\s*\{[^}]*overflow-x:\s*hidden/);
  });
});
