import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { resolveNavConfig } from "./nav-config-store.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * The portal's menu is generated the same way the dashboard's is, from the
 * arrangement saved for the `portal` surface. These boot the real page against
 * a stubbed API so the renderer and its access filter are exercised rather than
 * assumed — the portal has no second surface to catch a mistake here.
 */

type Perm = { permissionType: string; value: string };

const feature = (value: string): Perm => ({ permissionType: "feature", value });
const report = (value: string): Perm => ({ permissionType: "report", value });

async function boot(permissions: Perm[], navConfig: unknown = null) {
  const calls: string[] = [];
  const respond = (path: string): unknown => {
    if (path === "/auth/login") {
      return { token: "t", user: { id: "u-1", username: "dana", role: "user", permissions } };
    }
    if (path === "/auth/me") {
      return { id: "u-1", username: "dana", role: "user", permissions };
    }
    if (path.startsWith("/nav-config")) {
      return { surface: "portal", config: resolveNavConfig("portal", navConfig as never) };
    }
    if (path === "/portal/config") {
      return {};
    }
    // Report payloads the Reports page fetches on open. Empty but well-shaped:
    // these tests are about the menu, and a bare {} makes the renderer throw.
    if (path.startsWith("/reports/")) {
      return { report: { rows: [], columns: [] }, rows: [], months: [], markets: [] };
    }
    return {};
  };

  const dom = new JSDOM(USER_PORTAL_HTML, {
    runScripts: "dangerously",
    url: "http://localhost/portal",
    beforeParse(window: Window & typeof globalThis) {
      (window as unknown as { fetch: unknown }).fetch = async (
        url: string,
        opts: { method: string; body?: string },
      ) => {
        const path = url.replace("/api/admin", "");
        calls.push(path);
        const data = respond(path);
        return { ok: true, status: 200, json: async () => data };
      };
    },
  });

  const document = dom.window.document as Document;
  (document.getElementById("login-username") as HTMLInputElement).value = "dana";
  (document.getElementById("login-password") as HTMLInputElement).value = "pw";
  document.getElementById("login-form")?.dispatchEvent(new dom.window.Event("submit"));
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }

  const click = async (el: Element | null) => {
    el?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  const navPages = () =>
    Array.from(document.querySelectorAll("#sidebar-nav .nav-link")).map(
      (a) => (a as HTMLElement).dataset.page,
    );
  return { dom, document, calls, click, navPages };
}

describe("the portal's generated menu", () => {
  it("draws only the granted sections, plus My Account", async () => {
    const { calls, navPages } = await boot([feature("chat"), feature("projects")]);
    expect(calls).toContain("/nav-config?surface=portal");
    expect(navPages()).toEqual(["chat", "tasks", "account"]);
  });

  it("opens Reports for anyone holding any single report", async () => {
    const { navPages } = await boot([report("photographers")]);
    expect(navPages()).toEqual(["reports", "account"]);
  });

  it("lets an upload grant carry its own way into the library", async () => {
    const { navPages } = await boot([feature("resource-upload")]);
    expect(navPages()).toEqual(["resources", "account"]);
  });

  it("never draws a section a saved layout names but the viewer lacks", async () => {
    // A layout is arrangement, not access: putting Reports first cannot hand
    // Reports to somebody who holds no report grant.
    const { navPages } = await boot([feature("chat")], {
      groups: [{ id: "main", label: "", collapsible: false }],
      items: [
        { id: "reports", label: "", icon: "", group: "main", hidden: false },
        { id: "chat", label: "", icon: "", group: "main", hidden: false },
      ],
    });
    expect(navPages()).toEqual(["chat", "account"]);
  });

  it("honours a rename, a reorder and a submenu from the saved layout", async () => {
    const { document, click, navPages } = await boot(
      [feature("chat"), feature("projects"), feature("resources")],
      {
        groups: [
          { id: "work", label: "Work", collapsible: false },
          { id: "extra", label: "More", collapsible: true },
        ],
        items: [
          { id: "tasks", label: "My Work", icon: "✅", group: "work", hidden: false },
          { id: "chat", label: "", icon: "", group: "work", hidden: false },
          { id: "resources", label: "", icon: "", group: "extra", hidden: false },
        ],
      },
    );
    expect(navPages().slice(0, 2)).toEqual(["tasks", "chat"]);
    expect(
      document.querySelector('#sidebar-nav .nav-link[data-page="tasks"]')?.textContent,
    ).toContain("My Work");

    const body = document.querySelector('[data-nav-group-body="extra"]');
    expect(body?.classList.contains("hidden")).toBe(true);
    await click(document.querySelector('[data-nav-group="extra"]'));
    expect(
      document.querySelector('[data-nav-group-body="extra"]')?.classList.contains("hidden"),
    ).toBe(false);
  });

  it("marks the open page active and switches pages on click", async () => {
    const { document, click } = await boot([feature("chat"), feature("projects")]);
    expect(
      (document.querySelector("#sidebar-nav .nav-link.active") as HTMLElement)?.dataset.page,
    ).toBe("chat");
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="account"]'));
    expect(
      (document.querySelector("#sidebar-nav .nav-link.active") as HTMLElement)?.dataset.page,
    ).toBe("account");
    expect(document.getElementById("page-account")?.classList.contains("active")).toBe(true);
  });
});
