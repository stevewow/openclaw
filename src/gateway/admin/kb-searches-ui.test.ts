import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { KB_SEARCHES_COMPONENT_JS } from "./kb-searches-ui.js";

/**
 * The report is inline JS inside a template string, so no type or lint pass
 * reads it. These run the real block against a real DOM, with the markup taken
 * from the assembled `ADMIN_UI_HTML` — a page that stopped being wired into the
 * SPA fails here rather than in a browser.
 *
 * What is worth pinning is the split: three sections that answer three
 * different questions, and each one landing in its own table.
 */

const SUMMARY = {
  since: Date.UTC(2026, 6, 21),
  totalSearches: 10,
  zeroResultSearches: 4,
  clickedSearches: 3,
  gaps: [
    {
      query: "DRONE PHOTOS",
      queryKey: "drone photos",
      searches: 3,
      withResults: 0,
      clicks: 0,
      lastAt: Date.UTC(2026, 7, 18),
    },
    {
      query: "matterport",
      queryKey: "matterport",
      searches: 1,
      withResults: 0,
      clicks: 0,
      lastAt: Date.UTC(2026, 7, 12),
    },
  ],
  unhelpful: [
    {
      query: "invoice",
      queryKey: "invoice",
      searches: 3,
      withResults: 3,
      clicks: 0,
      lastAt: Date.UTC(2026, 7, 19),
    },
  ],
  top: [
    {
      query: "DRONE PHOTOS",
      queryKey: "drone photos",
      searches: 3,
      withResults: 0,
      clicks: 0,
      lastAt: Date.UTC(2026, 7, 18),
    },
    {
      query: "invoice",
      queryKey: "invoice",
      searches: 3,
      withResults: 3,
      clicks: 0,
      lastAt: Date.UTC(2026, 7, 19),
    },
    {
      query: "reschedule",
      queryKey: "reschedule",
      searches: 3,
      withResults: 3,
      clicks: 3,
      lastAt: Date.UTC(2026, 7, 20),
    },
  ],
};

const ASKS = {
  since: Date.UTC(2026, 6, 21),
  totalAsks: 6,
  answeredAsks: 4,
  contentDeclines: 1,
  brokenDeclines: 1,
  inputTokens: 7000,
  outputTokens: 300,
  requests: [
    {
      id: "ask-1",
      question: "can you reshoot the front of the house",
      email: "agent@example.com",
      wasAnswered: false,
      escalatedAt: Date.UTC(2026, 7, 20),
    },
    {
      id: "ask-2",
      question: "when will the video be ready",
      email: null,
      wasAnswered: true,
      escalatedAt: Date.UTC(2026, 7, 19),
    },
  ],
  unanswered: [
    {
      question: "do you shoot twilight photos",
      questionKey: "do you shoot twilight photos",
      asks: 2,
      answered: 0,
      lastAt: Date.UTC(2026, 7, 19),
    },
  ],
  top: [],
};

type Call = { method: string; path: string };

function mount(opts: { ok?: boolean; asks?: boolean } = {}) {
  const dom = new JSDOM(ADMIN_UI_HTML, { runScripts: "outside-only" });
  const win = dom.window as unknown as Record<string, unknown> & {
    document: Document;
    eval: (code: string) => unknown;
    Event: typeof Event;
  };
  const calls: Call[] = [];

  win.esc = (v: string | number | null | undefined) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
  win.api = (method: string, path: string) => {
    calls.push({ method, path });
    if (opts.ok === false) {
      return Promise.resolve({ ok: false, data: {} });
    }
    return Promise.resolve({
      ok: true,
      data: { summary: SUMMARY, asks: opts.asks === false ? undefined : ASKS },
    });
  };

  win.eval(KB_SEARCHES_COMPONENT_JS);

  const doc = win.document;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  return {
    doc,
    calls,
    win,
    async load() {
      win.eval("loadKbSearches()");
      await settle();
    },
    rowsIn(id: string): string[][] {
      return [...doc.querySelectorAll(`#${id} tr`)].map((tr) =>
        [...tr.querySelectorAll("td")].map((td) => td.textContent?.trim() ?? ""),
      );
    },
  };
}

describe("the help-search report", () => {
  it("is wired into the SPA", () => {
    expect(ADMIN_UI_HTML).toContain('id="page-kb-searches"');
    expect(ADMIN_UI_HTML).toContain('data-page="kb-searches"');
    expect(ADMIN_UI_HTML).toContain("loadKbSearches()");
  });

  it("asks for the default window", async () => {
    const ui = mount();
    await ui.load();
    expect(ui.calls).toEqual([{ method: "GET", path: "/kb/searches?days=30" }]);
  });

  it("puts each term in the section that says what to do about it", async () => {
    const ui = mount();
    await ui.load();

    // Nothing matched: write the article.
    expect(ui.rowsIn("kbs-gap-rows").map((cells) => cells[0])).toEqual([
      "DRONE PHOTOS",
      "matterport",
    ]);
    // Matched, opened nothing: retitle the article.
    expect(ui.rowsIn("kbs-unhelpful-rows").map((cells) => cells[0])).toEqual(["invoice"]);
    // Everything, by volume.
    expect(ui.rowsIn("kbs-top-rows").map((cells) => cells[0])).toEqual([
      "DRONE PHOTOS",
      "invoice",
      "reschedule",
    ]);
  });

  it("shows the counts that separate a miss from a hit", async () => {
    const ui = mount();
    await ui.load();
    const reschedule = ui.rowsIn("kbs-top-rows").find((cells) => cells[0] === "reschedule");
    // searches, matched, opened
    expect(reschedule?.slice(1, 4)).toEqual(["3", "3", "3"]);
    const invoice = ui.rowsIn("kbs-top-rows").find((cells) => cells[0] === "invoice");
    expect(invoice?.slice(1, 4)).toEqual(["3", "3", "0"]);
  });

  it("counts the totals as shares, so a small week is not read as a crisis", async () => {
    const ui = mount();
    await ui.load();
    const stats = ui.doc.getElementById("kbs-stats")?.textContent ?? "";
    expect(stats).toContain("40% of searches");
    expect(stats).toContain("30% of searches");
  });

  it("offers each term as a search anyone can run themselves", async () => {
    const ui = mount();
    await ui.load();
    const link = ui.doc.querySelector("#kbs-gap-rows a") as HTMLAnchorElement | null;
    expect(link?.getAttribute("href")).toBe("/help?q=DRONE%20PHOTOS");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("reloads when the period changes", async () => {
    const ui = mount();
    await ui.load();
    const select = ui.doc.getElementById("kbs-days") as HTMLSelectElement;
    select.value = "90";
    select.dispatchEvent(new ui.win.Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ui.calls.at(-1)).toEqual({ method: "GET", path: "/kb/searches?days=90" });
  });

  it("lists the questions nothing could answer", async () => {
    const ui = mount();
    await ui.load();
    expect(ui.doc.getElementById("kbs-ask-card")?.hasAttribute("hidden")).toBe(false);
    expect(ui.rowsIn("kbs-unanswered-rows").map((cells) => cells[0])).toEqual([
      "do you shoot twilight photos",
    ]);
  });

  it("counts the tokens spent, and calls out failures as failures", async () => {
    const ui = mount();
    await ui.load();
    const cost = ui.doc.getElementById("kbs-ask-cost")?.textContent ?? "";
    expect(cost).toContain("6 questions");
    expect(cost).toContain("4 answered");
    expect(cost).toContain("7,300 tokens");
    // A broken key must not read as a pile of missing articles.
    expect(cost).toContain("1 failed for technical reasons");
  });

  it("lists the questions a client asked a person to look at", async () => {
    const ui = mount();
    await ui.load();
    expect(ui.doc.getElementById("kbs-req-card")?.hasAttribute("hidden")).toBe(false);
    expect(ui.rowsIn("kbs-req-rows").map((cells) => cells[0])).toEqual([
      "can you reshoot the front of the house",
      "when will the video be ready",
    ]);
  });

  it("makes an address it can reply to clickable, and says so when there is none", async () => {
    const ui = mount();
    await ui.load();
    const link = ui.doc.querySelector("#kbs-req-rows a") as HTMLAnchorElement | null;
    expect(link?.getAttribute("href")).toContain("mailto:agent%40example.com");
    // A request with no address is still shown — the question is worth reading.
    expect(ui.rowsIn("kbs-req-rows")[1]?.[1]).toBe("no address left");
  });

  it("hides the requests card when nobody has asked for a person", async () => {
    const ui = mount({ asks: false });
    await ui.load();
    expect(ui.doc.getElementById("kbs-req-card")?.hasAttribute("hidden")).toBe(true);
  });

  it("hides the questions card while the box has never been used", async () => {
    const ui = mount({ asks: false });
    await ui.load();
    expect(ui.doc.getElementById("kbs-ask-card")?.hasAttribute("hidden")).toBe(true);
  });

  it("says so when the report will not load, rather than sitting on Loading…", async () => {
    const ui = mount({ ok: false });
    await ui.load();
    expect(ui.doc.getElementById("kbs-gap-rows")?.textContent).toContain("Could not load");
    expect(ui.doc.getElementById("kbs-top-rows")?.textContent).toContain("Could not load");
  });

  it("reports an empty period as empty rather than as a failure", async () => {
    const ui = mount();
    ui.win.api = () =>
      Promise.resolve({
        ok: true,
        data: {
          summary: {
            since: Date.UTC(2026, 6, 21),
            totalSearches: 0,
            zeroResultSearches: 0,
            clickedSearches: 0,
            gaps: [],
            unhelpful: [],
            top: [],
          },
        },
      });
    await ui.load();
    expect(ui.doc.getElementById("kbs-gap-rows")?.textContent).toContain("Nothing in this period");
    expect(ui.doc.getElementById("kbs-count")?.textContent).toBe("");
  });
});
