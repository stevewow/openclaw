import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

// The dashboard ships its client code as one inline <script> inside a template
// literal, so a stray brace or a mis-escaped backtick is invisible to tsgo and
// to lint — it only shows up as a blank page in the browser. Parsing the
// rendered script here fails the build instead.
function inlineScripts(html: string): string[] {
  const blocks: string[] = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  for (const m of html.matchAll(re)) blocks.push(m[1]!);
  return blocks;
}

describe("admin dashboard inline script", () => {
  it("parses as JavaScript", () => {
    const blocks = inlineScripts(ADMIN_UI_HTML);
    expect(blocks.length).toBeGreaterThan(0);
    for (const js of blocks) {
      // vm.Script compiles without running: syntax only, no DOM needed.
      expect(() => new vm.Script(js)).not.toThrow();
    }
  });

  it("keeps the churn report's client hooks wired to markup that exists", () => {
    // Every element the churn code reaches for by id has to be in the page, or
    // the feature silently no-ops. These are the ones added or moved recently.
    for (const id of [
      "churn-refresh-btn",
      "churn-years-sel",
      "churn-seasonal-chk",
      "churn-refresh-status",
      "churn-note-modal",
      "churn-note-input",
      "churn-note-list",
      "churn-note-save",
      "churn-note-close",
      "churn-note-title",
      "churn-note-error",
    ]) {
      expect(ADMIN_UI_HTML).toContain(`id="${id}"`);
    }
  });

  it("gives the churn report the shared Spiro reconnect banner", () => {
    // Churn refreshes pull from Spiro, so an expired connection has to be
    // recoverable from this page like it is on the Financials reports. The
    // banner is driven by the shared `.js-spiro-*` hooks, so it must sit inside
    // the churn page rather than anywhere in the document.
    const start = ADMIN_UI_HTML.indexOf('id="page-churn"');
    const end = ADMIN_UI_HTML.indexOf('class="card churn-refresh"', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const churnTop = ADMIN_UI_HTML.slice(start, end);
    expect(churnTop).toContain("js-spiro-banner");
    expect(churnTop).toContain("js-spiro-reconnect");
    expect(churnTop).toContain("js-spiro-title");
    expect(churnTop).toContain("js-spiro-msg");
  });

  it("keeps the how-to-read explainer collapsed by default", () => {
    // <details> without `open`: expandable, but closed on arrival.
    expect(ADMIN_UI_HTML).toContain('<details class="card churn-howto"');
    expect(ADMIN_UI_HTML).not.toContain('<details class="card churn-howto" open');
  });
});

describe("user portal inline script", () => {
  it("parses as JavaScript", () => {
    const blocks = inlineScripts(USER_PORTAL_HTML);
    expect(blocks.length).toBeGreaterThan(0);
    for (const js of blocks) {
      expect(() => new vm.Script(js)).not.toThrow();
    }
  });
});
