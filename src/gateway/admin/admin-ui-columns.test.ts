import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { TASK_STATUS_COMPONENT_JS } from "./task-status-ui.js";

/**
 * The board-column editor rewrites what every card on a board can hold, so its
 * behaviour is driven here rather than assumed. The shipped block is lifted out
 * of the SPA and run against the shipped markup in a real DOM, which also keeps
 * the element ids the block reaches for honest.
 */

type Column = {
  key: string;
  label: string;
  color: string;
  isDone: boolean;
  wipLimit: number | null;
};

type ApiCall = { method: string; path: string; body: unknown };

const DEFAULT_SET: Column[] = [
  { key: "todo", label: "Todo", color: "#6b7280", isDone: false, wipLimit: null },
  { key: "done", label: "Done", color: "#16a34a", isDone: true, wipLimit: null },
];

function loadEditor(opts: {
  statuses?: Column[];
  custom?: boolean;
  projectsFilter?: string;
  projects?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  customBoards?: string[];
  confirmAnswer?: boolean;
}) {
  const script = Array.from(ADMIN_UI_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)).map(
    (m) => m[1],
  )[0];
  if (!script) {
    throw new Error("no inline script found in ADMIN_UI_HTML");
  }
  const start = script.indexOf("// ── Board column editor");
  const end = script.indexOf("function setProjColor(color) {");
  if (start === -1 || end === -1) {
    throw new Error("column editor block not found — did the SPA change?");
  }

  // The real page, so the block binds to the ids it actually ships with.
  const dom = new JSDOM(ADMIN_UI_HTML, { runScripts: "outside-only" });
  const calls: ApiCall[] = [];
  const alerts: string[] = [];
  const confirms: string[] = [];
  const escape = (v: string | number | null | undefined) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );

  dom.window.eval(`
    var esc = ${escape.toString()};
    var __calls = [], __alerts = [], __confirms = [];
    var allProjects = ${JSON.stringify(opts.projects ?? [{ id: "p1", title: "Shoots" }])};
    var allTasks = ${JSON.stringify(opts.tasks ?? [])};
    var projectsFilter = ${JSON.stringify(opts.projectsFilter ?? "")};
    function alert(m) { __alerts.push(String(m)); }
    function confirm(m) { __confirms.push(String(m)); return ${opts.confirmAnswer === false ? "false" : "true"}; }
    function loadProjects() { return Promise.resolve(); }
    function api(method, path, body) {
      __calls.push({ method: method, path: path, body: body === undefined ? null : body });
      if (method === 'GET') {
        return Promise.resolve({ ok: true, data: {
          statuses: ${JSON.stringify(opts.statuses ?? DEFAULT_SET)},
          custom: ${opts.custom ? "true" : "false"},
        } });
      }
      return Promise.resolve({ ok: true, data: { statuses: (body && body.statuses) || [], remapped: 0 } });
    }
    var statusRegistry = {
      invalidate: function() {},
      isCustom: function(id) { return ${JSON.stringify(opts.customBoards ?? [])}.indexOf(id) !== -1; },
    };
    ${TASK_STATUS_COMPONENT_JS}
    ${script.slice(start, end)}
  `);

  const w = dom.window as unknown as {
    document: Document;
    eval: (s: string) => unknown;
  };
  const drain = () => {
    const out = dom.window.eval("JSON.stringify({c:__calls,a:__alerts,q:__confirms})") as string;
    return JSON.parse(out) as { c: ApiCall[]; a: string[]; q: string[] };
  };
  return {
    doc: w.document,
    calls,
    drain,
    async open() {
      (dom.window.eval("openColumnsEditor") as () => void)();
      // openColumnsEditor kicks off the load without awaiting it.
      await new Promise((r) => setTimeout(r, 0));
    },
    click(sel: string) {
      (w.document.querySelector(sel) as HTMLElement).click();
    },
    rows() {
      return Array.from(w.document.querySelectorAll("#columns-list .col-row"));
    },
    labels() {
      return Array.from(
        w.document.querySelectorAll("#columns-list .col-row [data-field=label]"),
      ).map((el) => (el as HTMLInputElement).value);
    },
    setLabel(i: number, value: string) {
      const el = w.document.querySelectorAll("#columns-list .col-row [data-field=label]")[
        i
      ] as HTMLInputElement;
      el.value = value;
    },
    setWip(i: number, value: string) {
      const el = w.document.querySelectorAll("#columns-list .col-row [data-field=wipLimit]")[
        i
      ] as HTMLInputElement;
      el.value = value;
    },
    async save() {
      (w.document.querySelector("#columns-save") as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

describe("board column editor", () => {
  it("loads the selected project's columns, not the default set", async () => {
    const ed = loadEditor({ projectsFilter: "p1", custom: true });
    await ed.open();
    expect(ed.drain().c[0].path).toBe("/task-statuses?projectId=p1");
    expect(ed.labels()).toEqual(["Todo", "Done"]);
    expect(ed.doc.querySelector("#columns-modal-title")?.textContent).toContain("Shoots");
  });

  it("edits the default set when no project is selected", async () => {
    const ed = loadEditor({ projectsFilter: "" });
    await ed.open();
    expect(ed.drain().c[0].path).toBe("/task-statuses");
    expect(ed.doc.querySelector("#columns-modal-title")?.textContent).toBe("Default Board Columns");
    // There is nothing for the default set to fall back to, so no reset.
    expect(ed.doc.querySelector("#columns-reset")?.classList.contains("hidden")).toBe(true);
  });

  it("offers a reset only once a project has its own columns", async () => {
    const borrowed = loadEditor({ projectsFilter: "p1", custom: false });
    await borrowed.open();
    expect(borrowed.doc.querySelector("#columns-reset")?.classList.contains("hidden")).toBe(true);
    expect(borrowed.doc.querySelector("#columns-note")?.textContent).toContain("Borrowing");

    const own = loadEditor({ projectsFilter: "p1", custom: true });
    await own.open();
    expect(own.doc.querySelector("#columns-reset")?.classList.contains("hidden")).toBe(false);
  });

  it("keeps typed edits when a row is reordered", async () => {
    const ed = loadEditor({ projectsFilter: "p1", custom: true });
    await ed.open();
    ed.setLabel(0, "Booked");
    ed.click("#columns-list .col-row:last-child .col-btn[data-act=up]");
    // The repaint must not discard the untyped-into-state edit above it.
    expect(ed.labels()).toEqual(["Done", "Booked"]);
  });

  it("adds and removes columns", async () => {
    const ed = loadEditor({ projectsFilter: "p1", custom: true });
    await ed.open();
    ed.click("#columns-add");
    expect(ed.rows()).toHaveLength(3);
    ed.click("#columns-list .col-row:last-child .col-btn[data-act=del]");
    expect(ed.rows()).toHaveLength(2);
  });

  it("never lets the last column be removed", async () => {
    const ed = loadEditor({
      projectsFilter: "p1",
      custom: true,
      statuses: [DEFAULT_SET[0]],
    });
    await ed.open();
    const del = ed.doc.querySelector("#columns-list .col-btn[data-act=del]") as HTMLButtonElement;
    expect(del.disabled).toBe(true);
  });

  it("sends labels, colours, done flags and WIP limits, dropping blank rows", async () => {
    const ed = loadEditor({ projectsFilter: "p1", custom: true });
    await ed.open();
    ed.setWip(0, "3");
    ed.click("#columns-add"); // left blank on purpose
    await ed.save();
    const put = ed.drain().c.find((c) => c.method === "PUT")!;
    expect(put.path).toBe("/task-statuses?projectId=p1");
    const sent = (put.body as { statuses: Column[] }).statuses;
    expect(sent.map((s) => s.label)).toEqual(["Todo", "Done"]);
    expect(sent[0].wipLimit).toBe(3);
    expect(sent[1].isDone).toBe(true);
  });

  it("treats a blank or junk WIP limit as no limit", async () => {
    const ed = loadEditor({ projectsFilter: "p1", custom: true });
    await ed.open();
    ed.setWip(0, "0");
    ed.setWip(1, "");
    await ed.save();
    const put = ed.drain().c.find((c) => c.method === "PUT")!;
    const sent = (put.body as { statuses: Column[] }).statuses;
    expect(sent[0].wipLimit).toBeNull();
    expect(sent[1].wipLimit).toBeNull();
  });

  it("keeps an existing column's key when only its label changes", async () => {
    const ed = loadEditor({ projectsFilter: "p1", custom: true });
    await ed.open();
    ed.setLabel(0, "Booked");
    await ed.save();
    const put = ed.drain().c.find((c) => c.method === "PUT")!;
    const sent = (put.body as { statuses: Column[] }).statuses;
    // Renaming must not strand every task sitting on that column.
    expect(sent[0].key).toBe("todo");
    expect(sent[0].label).toBe("Booked");
  });

  it("warns before a removal that would move tasks, and obeys a cancel", async () => {
    const ed = loadEditor({
      projectsFilter: "p1",
      custom: true,
      tasks: [
        { id: "a", projectId: "p1", status: "todo" },
        { id: "b", projectId: "p1", status: "todo" },
      ],
      confirmAnswer: false,
    });
    await ed.open();
    ed.click("#columns-list .col-row:first-child .col-btn[data-act=del]");
    await ed.save();
    const res = ed.drain();
    expect(res.q.join(" ")).toContain("2 tasks sit");
    // Cancelling must not write.
    expect(res.c.some((c) => c.method === "PUT")).toBe(false);
  });

  it("does not count tasks on projects that keep their own columns", async () => {
    const ed = loadEditor({
      projectsFilter: "",
      custom: true,
      customBoards: ["p2"],
      tasks: [
        { id: "a", projectId: "p2", status: "booked" },
        { id: "b", projectId: null, status: "todo" },
      ],
    });
    await ed.open();
    ed.click("#columns-list .col-row:first-child .col-btn[data-act=del]");
    await ed.save();
    const res = ed.drain();
    // p2 defines its own board, so editing the default set cannot strand it.
    expect(res.q.join(" ")).toContain("1 task sits");
  });

  it("warns when no column is marked done before letting the server pick one", async () => {
    const ed = loadEditor({
      projectsFilter: "p1",
      custom: true,
      statuses: [
        { key: "a", label: "A", color: "#6b7280", isDone: false, wipLimit: null },
        { key: "b", label: "B", color: "#6b7280", isDone: false, wipLimit: null },
      ],
    });
    await ed.open();
    await ed.save();
    expect(ed.drain().q.join(" ")).toContain('"B" will be treated as finished');
  });

  it("resets a project back to the default set", async () => {
    const ed = loadEditor({ projectsFilter: "p1", custom: true });
    await ed.open();
    ed.click("#columns-reset");
    await new Promise((r) => setTimeout(r, 0));
    const del = ed.drain().c.find((c) => c.method === "DELETE");
    expect(del?.path).toBe("/task-statuses?projectId=p1");
  });
});
