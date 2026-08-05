import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * Both SPAs ship as one giant template literal, which no type or lint pass
 * reads as code. Without this, a stray brace or a backtick in a CSS comment
 * ships a blank page with every other test still green.
 *
 * `admin-ui-tracker-shell.test.ts` already parses the admin script as a side
 * effect of driving it; the portal had no such cover at all.
 */
describe("SPA scripts parse", () => {
  for (const [name, html] of [
    ["admin dashboard", ADMIN_UI_HTML],
    ["user portal", USER_PORTAL_HTML],
  ] as const) {
    it(`the ${name} script is syntactically valid`, () => {
      const script = /<script>([\s\S]*)<\/script>/.exec(html);
      expect(script).not.toBeNull();
      // oxlint-disable-next-line no-implied-eval
      expect(() => new Function((script as RegExpExecArray)[1])).not.toThrow();
    });
  }
});
