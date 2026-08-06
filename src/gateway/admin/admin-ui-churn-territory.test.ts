import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";

/**
 * The BDS filter on the Churn report lives entirely in the SPA's inline JS,
 * which no type or lint pass reads. This lifts that block out of the shipped
 * HTML and runs it against a real document, the same technique
 * admin-ui-past-due.test.ts uses for the collections board — a filter that
 * silently matches nobody would otherwise ship green.
 */

type ChurnRow = {
  agent_id: string;
  agent_name: string;
  company_name: string;
  region: string | null;
  bds: string | null;
  health?: string;
};

type ChurnModel = {
  churnState: {
    report: unknown;
    dismissed: Record<string, unknown>;
    bds: string;
    showHidden: boolean;
  };
  churnRenderBdsRow: () => void;
  churnRowsFor: (rows: ChurnRow[]) => ChurnRow[];
  /** innerHTML of the filter container after a render. */
  churnRenderedHtml: () => string;
  /** Every value churnApply was re-run with, in order. */
  applied: string[];
};

function loadChurnTerritory(rows: ChurnRow[]): ChurnModel {
  const script = Array.from(ADMIN_UI_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)).map(
    (m) => m[1],
  )[0];
  if (!script) {
    throw new Error("no inline script found in ADMIN_UI_HTML");
  }
  const start = script.indexOf("var churnState = {");
  const endIdx = script.indexOf("function churnRenderHiddenBar()");
  if (start === -1 || endIdx === -1) {
    throw new Error("churn block not found — did the SPA change?");
  }
  const block = script.slice(start, endIdx);

  const dom = new JSDOM('<div id="churn-bds-row" class="card churn-bds-row hidden"></div>');
  const applied: string[] = [];
  const preamble = `
    const esc = (s) => String(s);
    // churnApply re-renders the whole page; here it only records that the
    // filter asked for a re-render.
    const churnApply = () => applied.push(churnState.bds);
  `;
  // Evaluating the shipped block is the point of this suite; the input is our
  // own source file, not user data.
  // oxlint-disable-next-line no-implied-eval
  const factory = new Function(
    "document",
    "applied",
    `${preamble}\n${block}\nreturn { churnState, churnRenderBdsRow, churnRowsFor };`,
  );
  const model = factory(dom.window.document, applied) as Omit<
    ChurnModel,
    "applied" | "churnRenderedHtml"
  >;
  model.churnState.report = { agent_scores: rows, outreach_queue: rows.slice(0, 1) };
  const container: Element | null = dom.window.document.getElementById("churn-bds-row");
  return {
    ...model,
    applied,
    churnRenderedHtml: () => container?.innerHTML ?? "",
  };
}

const ROWS: ChurnRow[] = [
  {
    agent_id: "a1",
    agent_name: "Amber",
    company_name: "Cincy Realty",
    region: "Cincinnati",
    bds: "Pam Branam",
  },
  {
    agent_id: "a2",
    agent_name: "Bo",
    company_name: "Columbus Homes",
    region: "Columbus",
    bds: "Chris Voge",
  },
  {
    agent_id: "a3",
    agent_name: "Cass",
    company_name: "Dayton Group",
    region: "Dayton",
    bds: "Ryan Bowersock",
  },
  {
    agent_id: "a4",
    agent_name: "Dee",
    company_name: "Mystery Group",
    region: null,
    bds: null,
  },
];

describe("the churn BDS filter", () => {
  it("narrows the rows to one owner's book", () => {
    const m = loadChurnTerritory(ROWS);
    m.churnState.bds = "Chris Voge";
    expect(m.churnRowsFor(ROWS).map((r) => r.agent_id)).toEqual(["a2"]);
  });

  it("can single out the clients no territory rule reached", () => {
    const m = loadChurnTerritory(ROWS);
    m.churnState.bds = "__none";
    // These are the ones nobody is calling — the reason the option exists.
    expect(m.churnRowsFor(ROWS).map((r) => r.agent_id)).toEqual(["a4"]);
  });

  it("shows everyone when no owner is chosen", () => {
    const m = loadChurnTerritory(ROWS);
    expect(m.churnRowsFor(ROWS)).toHaveLength(4);
  });

  it("keeps hidden rows out unless the viewer asked for them", () => {
    const m = loadChurnTerritory(ROWS);
    m.churnState.dismissed = { a2: { agentKey: "a2" } };
    m.churnState.bds = "Chris Voge";
    expect(m.churnRowsFor(ROWS)).toHaveLength(0);
    m.churnState.showHidden = true;
    expect(m.churnRowsFor(ROWS).map((r) => r.agent_id)).toEqual(["a2"]);
  });
});

describe("the churn BDS picker markup", () => {
  it("lists each owner with a count, plus the unowned bucket", () => {
    const m = loadChurnTerritory(ROWS);
    m.churnRenderBdsRow();
    const html = m.churnRenderedHtml();
    expect(html).toContain("Chris Voge (1)");
    expect(html).toContain("Pam Branam (1)");
    expect(html).toContain("No owner (1)");
    expect(html).toContain("All BDS (4 agents)");
  });

  it("explains the Columbus/Dayton cut where the filter is used", () => {
    const m = loadChurnTerritory(ROWS);
    m.churnRenderBdsRow();
    expect(m.churnRenderedHtml()).toContain("own top 20%");
  });

  it("says the cache is cold rather than offering an empty filter", () => {
    const m = loadChurnTerritory(ROWS.map((r) => ({ ...r, region: null, bds: null })));
    m.churnRenderBdsRow();
    expect(m.churnRenderedHtml()).toContain("Territory is unknown for every agent");
    expect(m.churnRenderedHtml()).not.toContain("<select");
  });

  it("drops a selected owner who no longer owns anyone after a refresh", () => {
    const m = loadChurnTerritory(ROWS);
    m.churnState.bds = "Joy Kiser";
    m.churnRenderBdsRow();
    // Otherwise the table reads empty under a select that says "All".
    expect(m.churnState.bds).toBe("");
  });
});
