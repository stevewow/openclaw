import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { COACH_COMPONENT_JS } from "./coach-ui.js";
import { GUIDE_COMPONENT_JS } from "./guide-ui.js";
import { KB_COMPONENT_JS } from "./kb-ui.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * The coach ships as inline script inside a template string, so nothing in the
 * build ever runs it. These boot the real SPA markup in a DOM against a stubbed
 * API and drive it the way a person would.
 */

type Call = { method: string; path: string; body: unknown };

function mount(routes: Record<string, unknown> = {}) {
  const dom = new JSDOM(ADMIN_UI_HTML, {
    runScripts: "outside-only",
    url: "https://hub.test/admin",
  });
  const win = dom.window as unknown as Record<string, unknown> & {
    document: Document;
    eval: (code: string) => unknown;
  };
  const calls: Call[] = [];
  win.esc = (v: string | number | null | undefined) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
  win.alert = () => {};
  win.confirm = () => true;
  win.api = (method: string, path: string, body: unknown) => {
    calls.push({ method, path, body });
    const key = `${method} ${path}`;
    const hit = routes[key] ?? routes[path];
    return Promise.resolve(
      hit === undefined
        ? { ok: false, status: 404, data: {} }
        : { ok: true, status: 200, data: hit },
    );
  };
  // kbMdToHtml lives in the article editor and is what renders an answer.
  win.eval(KB_COMPONENT_JS);
  win.eval(GUIDE_COMPONENT_JS);
  win.eval(COACH_COMPONENT_JS);
  const doc = win.document;
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return {
    dom,
    win,
    doc,
    calls,
    settle,
    el: (id: string) => doc.getElementById(id) as HTMLElement,
    click: (id: string) =>
      doc.getElementById(id)?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })),
  };
}

describe("the hovering box", () => {
  it("is mounted outside the pages, so changing page does not take it away", () => {
    for (const [name, html] of [
      ["admin", ADMIN_UI_HTML],
      ["portal", USER_PORTAL_HTML],
    ] as const) {
      const doc = new JSDOM(html).window.document;
      const panel = doc.getElementById("coach-panel");
      expect(panel, name).toBeTruthy();
      // navigate() hides everything matching .page; a widget inside one would
      // disappear the first time anyone moved around the Hub.
      expect(panel?.closest(".page"), name).toBe(null);
      expect(doc.getElementById("coach-launch")?.closest(".page"), name).toBe(null);
    }
  });

  it("stays hidden until the coach is actually usable", async () => {
    // No key configured: a launcher that only apologises is worse than none.
    const off = mount({ "GET /coach/status": { enabled: false, sections: 72 } });
    await off.win.eval("coachInit()");
    await off.settle();
    expect(off.el("coach-launch").hasAttribute("hidden")).toBe(true);

    // Key, but nothing in the guide to answer from.
    const empty = mount({ "GET /coach/status": { enabled: true, sections: 0 } });
    await empty.win.eval("coachInit()");
    await empty.settle();
    expect(empty.el("coach-launch").hasAttribute("hidden")).toBe(true);
  });

  it("appears once there is a key and a guide", async () => {
    const ui = mount({ "GET /coach/status": { enabled: true, sections: 72 } });
    await ui.win.eval("coachInit()");
    await ui.settle();
    expect(ui.el("coach-launch").hasAttribute("hidden")).toBe(false);
  });

  it("opens with something to press, so the first question costs no typing", async () => {
    const ui = mount({ "GET /coach/status": { enabled: true, sections: 72 } });
    await ui.win.eval("coachInit()");
    await ui.settle();
    ui.click("coach-launch");
    expect(ui.el("coach-panel").hasAttribute("hidden")).toBe(false);
    expect(ui.el("coach-launch").getAttribute("aria-expanded")).toBe("true");
    const chips = ui.doc.querySelectorAll("#coach-log [data-coach-chip]");
    expect(chips.length).toBeGreaterThan(2);
  });

  it("closes on Escape", async () => {
    const ui = mount({ "GET /coach/status": { enabled: true, sections: 72 } });
    await ui.win.eval("coachInit()");
    await ui.settle();
    ui.click("coach-launch");
    ui.doc.dispatchEvent(
      new ui.dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(ui.el("coach-panel").hasAttribute("hidden")).toBe(true);
    expect(ui.el("coach-launch").hasAttribute("hidden")).toBe(false);
  });

  it("asks, and renders the answer as writing rather than asterisks", async () => {
    const ui = mount({
      "GET /coach/status": { enabled: true, sections: 72 },
      "POST /coach/ask": {
        askId: "a-1",
        answered: true,
        answer: "**Lead with WOW Essentials.**\n\n- Photos get them in\n- Video keeps them there",
        cited: [{ id: "sec-1", heading: "WOW Essentials" }],
      },
    });
    await ui.win.eval("coachInit()");
    await ui.settle();
    ui.click("coach-launch");
    (ui.el("coach-input") as HTMLTextAreaElement).value = "What should I recommend?";
    ui.click("coach-send");
    await ui.settle();
    await ui.settle();

    const ask = ui.calls.find((c) => c.path === "/coach/ask");
    expect(ask?.method).toBe("POST");
    expect((ask?.body as { question: string }).question).toBe("What should I recommend?");
    // A thread id goes up so a follow-up lands in the same conversation.
    expect((ask?.body as { threadId: string }).threadId).toMatch(/^th-/);

    const log = ui.el("coach-log").innerHTML;
    expect(log).toContain("<strong>Lead with WOW Essentials.</strong>");
    expect(log).toContain("<li>Photos get them in</li>");
    // Nothing a reader sees still carries the markdown. (The raw text is kept
    // on the node for Copy, which the next test covers.)
    const answerEl = ui.doc.querySelector("#coach-log .coach-them[data-coach-md]");
    expect(answerEl?.textContent).not.toContain("**");
    // And it says where it got it, which is how anyone notices a wrong answer.
    expect(log).toContain("WOW Essentials");
    expect(log).toContain("data-coach-copy");
  });

  it("hands Copy the markdown that was drafted, not the rendered page", async () => {
    const answer = "Subject: Your photos\n\n**Hi Dana**, everything is ready.";
    const ui = mount({
      "GET /coach/status": { enabled: true, sections: 72 },
      "POST /coach/ask": { askId: "a-1", answered: true, answer, cited: [] },
    });
    await ui.win.eval("coachInit()");
    await ui.settle();
    ui.click("coach-launch");
    (ui.el("coach-input") as HTMLTextAreaElement).value = "Draft an email";
    ui.click("coach-send");
    await ui.settle();
    await ui.settle();
    const msg = ui.doc.querySelector("#coach-log .coach-them[data-coach-md]");
    expect(msg?.getAttribute("data-coach-md")).toBe(answer);
  });

  it("says so plainly when the coach is being asked too much", async () => {
    const ui = mount({ "GET /coach/status": { enabled: true, sections: 72 } });
    await ui.win.eval("coachInit()");
    await ui.settle();
    ui.click("coach-launch");
    // A 429 arrives as a non-ok response carrying its own wording.
    ui.win.api = () =>
      Promise.resolve({ ok: false, status: 429, data: { message: "Give it a few minutes." } });
    (ui.el("coach-input") as HTMLTextAreaElement).value = "again";
    ui.click("coach-send");
    await ui.settle();
    await ui.settle();
    expect(ui.el("coach-log").textContent).toContain("Give it a few minutes.");
  });
});

describe("the guide page", () => {
  const DOCS = {
    docs: [
      {
        id: "d1",
        slug: "product-guide",
        title: "Product Guide",
        summary: "What we sell.",
        sectionCount: 2,
      },
      {
        id: "d2",
        slug: "sales-scripts",
        title: "Sales Scripts",
        summary: "What we say.",
        sectionCount: 1,
      },
    ],
    canEdit: false,
    approxTokens: 16_000,
    tokenCap: 40_000,
  };
  const SECTIONS = {
    sections: [
      {
        id: "s1",
        docId: "d1",
        heading: "HDR Photography",
        group: "Base / Standalone Services",
        bodyMd: "| SQ. FT. | STANDARD PRICE |\n| --- | --- |\n| 0 - 2,000 | $160 |",
        sortOrder: 0,
      },
      {
        id: "s2",
        docId: "d1",
        heading: "WOW Essentials",
        group: "Bundles",
        bodyMd: "- Photos\n- Video",
        sortOrder: 1,
      },
    ],
  };

  it("renders pricing as a table a person can read", async () => {
    const ui = mount({ "GET /guide": DOCS, "GET /guide/docs/d1/sections": SECTIONS });
    await ui.win.eval("loadGuide()");
    await ui.settle();
    await ui.settle();
    const html = ui.el("gd-list").innerHTML;
    expect(html).toContain("<th>SQ. FT.</th>");
    expect(html).toContain("<td>$160</td>");
    expect(html).toContain("Base / Standalone Services");
    expect(html).toContain("Bundles");
  });

  it("hides the editing controls from someone who may only read", async () => {
    const ui = mount({ "GET /guide": DOCS, "GET /guide/docs/d1/sections": SECTIONS });
    await ui.win.eval("loadGuide()");
    await ui.settle();
    await ui.settle();
    expect(ui.el("gd-add").classList.contains("hidden")).toBe(true);
    expect(ui.doc.querySelectorAll("#gd-list [data-edit]").length).toBe(0);
  });

  it("offers editing to an admin", async () => {
    const ui = mount({
      "GET /guide": { ...DOCS, canEdit: true },
      "GET /guide/docs/d1/sections": SECTIONS,
    });
    await ui.win.eval("loadGuide()");
    await ui.settle();
    await ui.settle();
    expect(ui.el("gd-add").classList.contains("hidden")).toBe(false);
    expect(ui.doc.querySelectorAll("#gd-list [data-edit]").length).toBe(2);
  });

  it("finds an objection by what it says, not just by heading", async () => {
    const ui = mount({ "GET /guide": DOCS, "GET /guide/docs/d1/sections": SECTIONS });
    await ui.win.eval("loadGuide()");
    await ui.settle();
    await ui.settle();
    const search = ui.el("gd-search") as HTMLInputElement;
    search.value = "video";
    search.dispatchEvent(new ui.dom.window.Event("input", { bubbles: true }));
    const html = ui.el("gd-list").innerHTML;
    expect(html).toContain("WOW Essentials");
    expect(html).not.toContain("HDR Photography");
    expect(ui.el("gd-count").textContent).toContain("1 of 2");
  });

  it("warns when the guide has grown past what the coach can hold", async () => {
    const ui = mount({
      "GET /guide": { ...DOCS, approxTokens: 39_000, tokenCap: 40_000 },
      "GET /guide/docs/d1/sections": SECTIONS,
    });
    await ui.win.eval("loadGuide()");
    await ui.settle();
    await ui.settle();
    expect(ui.el("gd-sync").textContent).toContain("getting long");
  });
});
