import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
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
  const preamble = `
    let allProjects = ${JSON.stringify(opts.projects)};
    let allTasks = ${JSON.stringify(opts.tasks)};
    let projectsFilter = ${JSON.stringify(opts.projectsFilter ?? "")};
    let showClosedProjects = ${opts.showClosed ? "true" : "false"};
  `;
  // Evaluating the shipped block is the point of this suite; the input is our
  // own source file, not user data.
  // oxlint-disable-next-line no-implied-eval
  const factory = new Function(
    `${preamble}\n${block}\nreturn { isClosedProject, selectableProjects, getFilteredTasks };`,
  );
  return factory() as {
    isClosedProject: (p: ProjectLike) => boolean;
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
