import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { MARKET_COMPONENT_JS, MARKET_CSS } from "./market-ui.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * The Market report ships on two surfaces from one component. These are the
 * wiring facts that no other test can catch: an element id the component is
 * told to write into but that the page never renders fails silently at
 * runtime, and a surface that embeds the markup but not the component ships a
 * dead panel.
 */

const SURFACES = [
  ["admin dashboard", ADMIN_UI_HTML],
  ["user portal", USER_PORTAL_HTML],
] as const;

describe("both surfaces embed the shared component", () => {
  for (const [name, html] of SURFACES) {
    it(`${name} carries the component and its styles`, () => {
      // Interpolated verbatim, so a distinctive line of each must be present.
      expect(html).toContain("function createMarketReport(cfg)");
      expect(html).toContain(".market-national-row");
      expect(MARKET_COMPONENT_JS).toContain("function createMarketReport(cfg)");
      expect(MARKET_CSS).toContain(".market-national-row");
      expect(name).toBeTruthy();
    });
  }

  it("defines the component exactly once per surface", () => {
    // Two copies would mean the extraction left the old inline block behind,
    // and the second definition would quietly win.
    for (const [, html] of SURFACES) {
      const hits = html.split("function createMarketReport(cfg)").length - 1;
      expect(hits).toBe(1);
    }
  });
});

/**
 * Every id the component is configured with must exist in that surface's
 * markup. The component guards missing elements rather than throwing, so a
 * typo here would show up only as a panel that never fills in.
 */
describe("every configured element id exists in its surface", () => {
  const idKeys = [
    "metricSelectId",
    "tableId",
    "nationalId",
    "noteId",
    "warningId",
    "refreshedAtId",
  ];

  for (const [name, html] of SURFACES) {
    it(`${name} renders every element it configures`, () => {
      const call = /createMarketReport\(\{([\s\S]*?)\}\)/.exec(html);
      expect(call).not.toBeNull();
      const body = (call as RegExpExecArray)[1];
      let checked = 0;
      for (const key of idKeys) {
        const m = new RegExp(`${key}:\\s*'([^']+)'`).exec(body);
        if (!m) {
          continue;
        }
        expect(html).toContain(`id="${m[1]}"`);
        checked += 1;
      }
      // The table and the picker are not optional on either surface.
      expect(checked).toBeGreaterThanOrEqual(2);
    });
  }
});

describe("the portal surface", () => {
  it("offers the report in its catalog, so a granted user can reach it", () => {
    expect(USER_PORTAL_HTML).toContain("{ key: 'market', title: 'Housing Market' }");
  });

  it("gives its table a distinct storage key from the dashboard's", () => {
    // Column layout is saved per report key; sharing one would let a portal
    // user's arrangement follow them onto the admin page.
    expect(USER_PORTAL_HTML).toContain("reportKey: 'p-market'");
    expect(ADMIN_UI_HTML).toContain("reportKey: 'market'");
  });

  it("reads the cache and never offers the metered refresh", () => {
    // The sweep is admin-only server-side; showing the button would just fail.
    expect(USER_PORTAL_HTML).toContain("/reports/market");
    expect(USER_PORTAL_HTML).not.toContain("/reports/market/refresh");
    expect(ADMIN_UI_HTML).toContain("/reports/market/refresh");
  });

  it("hides the Spiro date controls, which do not apply to this report", () => {
    const line = /report-controls'\)\.classList\.toggle\('hidden',([^;]*);/.exec(USER_PORTAL_HTML);
    expect(line).not.toBeNull();
    expect((line as RegExpExecArray)[1]).toContain("'market'");
  });

  it("does not name an env var a BDS cannot act on", () => {
    // The unconfigured-key hint is admin-only; adminHints is what selects it.
    expect(USER_PORTAL_HTML).not.toContain("adminHints: true");
    expect(ADMIN_UI_HTML).toContain("adminHints: true");
  });
});

describe("the dashboard surface", () => {
  it("keeps the page, its report card, and its permission key in step", () => {
    expect(ADMIN_UI_HTML).toContain('id="page-market"');
    expect(ADMIN_UI_HTML).toContain("report: 'market'");
    expect(ADMIN_UI_HTML).toContain("{ key: 'market', icon:");
  });

  it("routes the page back to the Reports nav entry", () => {
    // A report sub-page has no nav item of its own; without this the sidebar
    // highlight would clear while the page is open.
    const nav = /navKey = 'reports';/.exec(ADMIN_UI_HTML);
    expect(nav).not.toBeNull();
    const line = ADMIN_UI_HTML.slice(
      Math.max(0, (nav as RegExpExecArray).index - 400),
      (nav as RegExpExecArray).index,
    );
    expect(line).toContain("'market'");
  });
});
