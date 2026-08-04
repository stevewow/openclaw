import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { BRAND_FAVICON_TAG, BRAND_NAME, brandLogo } from "./brand.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * The dashboard is white-labeled for the team. The brand block used to be
 * pasted into both pages independently, so these guard the thing that actually
 * regresses: one page getting rebranded and the other quietly keeping the
 * upstream identity.
 */

const PAGES: ReadonlyArray<[string, string]> = [
  ["admin", ADMIN_UI_HTML],
  ["portal", USER_PORTAL_HTML],
];

describe("dashboard branding", () => {
  for (const [name, html] of PAGES) {
    it(`${name} carries no upstream product name`, () => {
      expect(html.toLowerCase()).not.toContain("openclaw");
      expect(html).not.toContain("🦞");
    });

    it(`${name} shows the brand name and logo`, () => {
      expect(html).toContain(BRAND_NAME);
      expect(html).toContain(brandLogo(32));
      expect(html).toContain(BRAND_FAVICON_TAG);
    });
  }

  it("renders the logo inline so it needs no served asset", () => {
    const logo = brandLogo(44);
    expect(logo).toContain("<svg");
    expect(logo).toContain('width="44"');
    // Decorative in-page: the brand name sits beside it as real text.
    expect(logo).toContain('aria-hidden="true"');
    // Fully self-drawn: no <image>/href pulling a file the gateway must serve.
    // (xmlns is a namespace identifier, not a fetch, so it does not count.)
    expect(logo).not.toContain("<image");
    expect(logo).not.toContain("href");
  });

  it("encodes the favicon so the data URI survives an href attribute", () => {
    expect(BRAND_FAVICON_TAG).toContain('href="data:image/svg+xml,');
    const href = /href="([^"]*)"/.exec(BRAND_FAVICON_TAG)?.[1] ?? "";
    expect(href).not.toBe("");
    for (const raw of ["<", ">", "#"]) {
      expect(href).not.toContain(raw);
    }
    expect(decodeURIComponent(href)).toContain("<circle");
  });
});
