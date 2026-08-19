import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import {
  FEEDBACK_COMPONENT_JS,
  FEEDBACK_CSS,
  FEEDBACK_MARKUP,
  FEEDBACK_MODALS,
} from "./feedback-ui.js";

/**
 * The Hub page is markup and JS inside template strings, which no type or lint
 * pass reads. Two bugs shipped from exactly that: a nav link pointing at an
 * unregistered page, and layout classes that were never defined anywhere —
 * `page-head` and `stats`/`stat` styled nothing, so the tiles stacked.
 */

/** Every class the SPA's stylesheet defines, plus the ones this page ships. */
function definedClasses(): Set<string> {
  const css = ADMIN_UI_HTML.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const out = new Set<string>();
  for (const m of `${css}\n${FEEDBACK_CSS}`.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
    if (m[1]) {
      out.add(m[1]);
    }
  }
  return out;
}

/** Class names written into the page's own markup. */
function usedClasses(markup: string): string[] {
  const out = new Set<string>();
  for (const m of markup.matchAll(/class="([^"]+)"/g)) {
    for (const c of (m[1] ?? "").split(/\s+/)) {
      if (c) {
        out.add(c);
      }
    }
  }
  return Array.from(out);
}

describe("the feedback page markup", () => {
  /**
   * Classes that exist to be selected on rather than styled.
   *
   * `page` is the host SPA's: navigate() queries it to hide every page before
   * showing one. The rest are derived from this page's own querySelector calls
   * rather than listed by hand, so a new handler hook does not fail the check.
   */
  function jsHooks(): Set<string> {
    const hooks = new Set(["page"]);
    for (const m of FEEDBACK_COMPONENT_JS.matchAll(/querySelectorAll?\('\.([\w-]+)'/g)) {
      if (m[1]) {
        hooks.add(m[1]);
      }
    }
    return hooks;
  }
  const JS_HOOKS = jsHooks();

  it("only uses classes something actually defines", () => {
    const defined = definedClasses();
    expect(defined.size).toBeGreaterThan(50); // the scrape found a real stylesheet
    const undefinedClasses = usedClasses(`${FEEDBACK_MARKUP}\n${FEEDBACK_MODALS}`).filter(
      (c) => !defined.has(c) && !JS_HOOKS.has(c),
    );
    expect(undefinedClasses).toEqual([]);
  });

  it("only uses defined classes in the rows it renders at runtime", () => {
    // The table rows are built in JS, so their classes never appear in the
    // markup above — `btn-secondary` reached production this way and styled
    // nothing.
    const defined = definedClasses();
    const inJs = new Set<string>();
    for (const m of FEEDBACK_COMPONENT_JS.matchAll(/class="([^"'+]+)"/g)) {
      for (const c of (m[1] ?? "").split(/\s+/)) {
        // Status chips are composed as 'fb-chip-' + key, so skip the stems.
        if (c && !c.endsWith("-")) {
          inJs.add(c);
        }
      }
    }
    expect(Array.from(inJs).filter((c) => !defined.has(c) && !JS_HOOKS.has(c))).toEqual([]);
  });

  it("lays the summary tiles out on the shared stats grid", () => {
    // `stats`/`stat` were invented and styled nothing, so the tiles rendered as
    // plain blocks and ran down the page instead of across it.
    expect(FEEDBACK_MARKUP).toContain('class="stats-grid"');
    expect(FEEDBACK_COMPONENT_JS).toContain('class="stat-card"');
    expect(FEEDBACK_COMPONENT_JS).not.toContain('<div class="stat">');
  });

  it("offers a way to file feedback, not only to read it", () => {
    expect(FEEDBACK_MARKUP).toContain('id="fb-new"');
    expect(FEEDBACK_COMPONENT_JS).toContain("'/feedback'");
  });

  it("is interpolated into the SPA", () => {
    expect(ADMIN_UI_HTML).toContain(FEEDBACK_MARKUP.trim());
    expect(ADMIN_UI_HTML).toContain(FEEDBACK_MODALS.trim());
    expect(ADMIN_UI_HTML).toContain(FEEDBACK_COMPONENT_JS.trim());
  });

  it("gives every id in the page a single owner", () => {
    const ids = new Map<string, number>();
    for (const m of `${FEEDBACK_MARKUP}\n${FEEDBACK_MODALS}`.matchAll(/id="([^"]+)"/g)) {
      const id = m[1] ?? "";
      ids.set(id, (ids.get(id) ?? 0) + 1);
    }
    expect(Array.from(ids.entries()).filter(([, n]) => n > 1)).toEqual([]);
  });
});
