import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * Popups shared with the dashboard are written with the dashboard's class names.
 * The portal has its own stylesheet, and when it lacked `.modal` the Send to BDS
 * form rendered with no panel behind it: fields floating on the dark backdrop,
 * labels and hints unreadable. Nothing failed — it just looked broken — so this
 * checks that every popup class the portal's markup uses has a rule behind it.
 */
describe("portal popups", () => {
  const dom = new JSDOM(USER_PORTAL_HTML);
  const doc = dom.window.document;
  const css = [...doc.querySelectorAll("style")].map((s) => s.textContent ?? "").join("\n");

  function hasRule(className: string): boolean {
    return new RegExp(`\\.${className}(?![\\w-])[^{]*\\{`).test(css);
  }

  it("styles every popup class its markup uses", () => {
    const used = new Set<string>();
    for (const el of doc.querySelectorAll('[class*="modal"]')) {
      for (const cls of el.classList) {
        if (cls.startsWith("modal")) {
          used.add(cls);
        }
      }
    }
    // The popups this was found on are really in the portal.
    expect(used).toContain("modal");
    expect(used).toContain("modal-title");
    expect([...used].filter((cls) => !hasRule(cls))).toEqual([]);
  });

  it("includes the Send to BDS and add-lead popups", () => {
    for (const id of ["lst-modal", "lst-dismiss-modal", "ld-new-modal", "ld-modal"]) {
      const backdrop = doc.getElementById(id);
      expect(backdrop?.classList.contains("modal-backdrop")).toBe(true);
      expect(backdrop?.querySelector(".modal")).not.toBeNull();
    }
  });
});
