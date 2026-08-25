import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { resolveNavConfig } from "./nav-config-store.js";

/**
 * The dashboard ships as one inline script inside a template string, so nothing
 * in the build ever runs it. These boot the real page in a DOM against a stubbed
 * API and drive it the way a person would — sign in, open a section, click a
 * button — which is the only way the sidebar renderer, the Users list and the
 * Navigation editor are covered at all.
 *
 * The stub answers the handful of routes these paths touch and records what was
 * asked for, so a change that stops calling an endpoint (or starts calling the
 * wrong one) fails here rather than in the browser.
 */

type Call = { method: string; path: string; body: unknown };

type Perm = { permissionType: string; value: string };

type StubUser = {
  id: string;
  username: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  lastLoginAt: number | null;
  permissions: Perm[];
};

function stubUser(over: Partial<StubUser> = {}): StubUser {
  return {
    id: "u-1",
    username: "dana",
    role: "user",
    firstName: "Dana",
    lastName: "Reyes",
    email: "dana@example.com",
    lastLoginAt: Date.now() - 3 * 86400000,
    permissions: [],
    ...over,
  };
}

async function boot(
  options: { role?: string; grants?: Perm[]; users?: StubUser[]; navConfig?: unknown } = {},
) {
  const calls: Call[] = [];
  const users = options.users ?? [
    stubUser(),
    stubUser({
      id: "u-2",
      username: "root",
      role: "superadmin",
      firstName: "Sam",
      lastName: "Ops",
      email: null,
      permissions: [],
    }),
  ];
  let savedNav: unknown = null;

  const respond = (method: string, path: string, body: unknown): [number, unknown] => {
    if (path === "/auth/login") {
      return [
        200,
        {
          token: "t",
          user: {
            id: "u-2",
            username: "root",
            role: options.role ?? "superadmin",
            permissions: options.grants ?? [],
          },
        },
      ];
    }
    if (path === "/users") {
      return [200, { users }];
    }
    if (path === "/nav-config?surface=admin" || path === "/nav-config?surface=portal") {
      const surface = path.endsWith("portal") ? "portal" : "admin";
      const cfg = savedNav ?? options.navConfig ?? null;
      return [200, { surface, config: resolveNavConfig(surface, cfg as never) }];
    }
    if (path === "/nav-config" && method === "PUT") {
      const data = body as { surface: string; config: unknown; reset?: boolean };
      savedNav = data.reset ? null : data.config;
      return [
        200,
        {
          surface: data.surface,
          config: resolveNavConfig(
            data.surface as never,
            (data.reset ? null : data.config) as never,
          ),
        },
      ];
    }
    if (path === "/agents") {
      return [200, { agents: [{ id: "main", name: "Main" }] }];
    }
    if (path === "/skills") {
      return [200, { skills: [{ name: "deploy", description: "ships it" }] }];
    }
    if (path === "/channels") {
      return [200, { channels: [{ id: "slack" }] }];
    }
    if (path.endsWith("/permissions")) {
      return [200, { ok: true, permissions: [] }];
    }
    if (path === "/portal/config") {
      return [200, {}];
    }
    if (path === "/tasks") {
      return [200, { tasks: [] }];
    }
    return [200, {}];
  };

  const dom = new JSDOM(ADMIN_UI_HTML, {
    runScripts: "dangerously",
    url: "http://localhost/",
    beforeParse(window: Window & typeof globalThis) {
      (window as unknown as { fetch: unknown }).fetch = async (
        url: string,
        opts: { method: string; body?: string },
      ) => {
        const path = url.replace("/api/admin", "");
        const body = opts.body ? JSON.parse(opts.body) : undefined;
        calls.push({ method: opts.method, path, body });
        const [status, data] = respond(opts.method, path, body);
        return { ok: status < 400, status, json: async () => data };
      };
      window.confirm = () => true;
      window.alert = () => {};
    },
  });

  const document = dom.window.document as Document;
  (document.getElementById("login-username") as HTMLInputElement).value = "root";
  (document.getElementById("login-password") as HTMLInputElement).value = "pw";
  document.getElementById("login-form")?.dispatchEvent(new dom.window.Event("submit"));
  // The sign-in path is a chain of awaited fetches; a few microtask turns is
  // enough for all of them to settle against the stub.
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }

  const click = async (el: Element | null) => {
    el?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  return { dom, document, calls, click };
}

describe("the dashboard boots", () => {
  it("signs in and builds the sidebar from the saved arrangement", async () => {
    const { document, calls } = await boot();
    expect(document.getElementById("app")?.classList.contains("hidden")).toBe(false);
    expect(calls.some((c) => c.path === "/nav-config?surface=admin")).toBe(true);

    const links = Array.from(document.querySelectorAll("#sidebar-nav .nav-link")).map(
      (a) => (a as HTMLElement).dataset.page,
    );
    // Default order, and a superadmin sees the role-locked entries.
    expect(links.slice(0, 4)).toEqual(["dashboard", "users", "agents", "chat"]);
    expect(links).toContain("navigation");
    expect(links).toContain("system");
    const headings = Array.from(document.querySelectorAll("#sidebar-nav .nav-section")).map((h) =>
      h.textContent?.trim(),
    );
    expect(headings).toEqual(["Main", "Workspace", "Support", "Financials", "Settings"]);
  });

  it("drops sections the viewer cannot open, and the heading with them", async () => {
    // A non-admin holding only the tickets grant. They stay in this SPA rather
    // than being bounced to the portal (the ticket queue lives here), and the
    // menu narrows to what that one grant opens.
    const { document } = await boot({
      role: "user",
      grants: [{ permissionType: "feature", value: "tickets" }],
    });
    const links = Array.from(document.querySelectorAll("#sidebar-nav .nav-link")).map(
      (a) => (a as HTMLElement).dataset.page,
    );
    expect(links).not.toContain("users");
    expect(links).not.toContain("system");
    expect(links).not.toContain("departments");
    expect(links).toContain("dashboard");
    expect(links).toContain("tickets");
    expect(links).toContain("account");
    const headings = Array.from(document.querySelectorAll("#sidebar-nav .nav-section")).map((h) =>
      h.textContent?.trim(),
    );
    // Support survives because Tickets is under it; Financials has nothing left
    // to head, so the heading goes with its sections.
    expect(headings).toContain("Support");
    expect(headings).not.toContain("Financials");
  });

  it("renders a submenu folded shut until its heading is clicked", async () => {
    const { document, click } = await boot({
      navConfig: {
        groups: [
          { id: "main", label: "Main", collapsible: false },
          { id: "money", label: "Financials", collapsible: true },
        ],
        items: [
          { id: "dashboard", label: "", icon: "", group: "main", hidden: false },
          { id: "financials", label: "", icon: "", group: "money", hidden: false },
          { id: "cleveland", label: "", icon: "", group: "money", hidden: false },
        ],
      },
    });
    const toggle = document.querySelector('[data-nav-group="money"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    const body = document.querySelector('[data-nav-group-body="money"]');
    expect(body?.classList.contains("hidden")).toBe(true);

    await click(toggle);
    expect(
      document.querySelector('[data-nav-group-body="money"]')?.classList.contains("hidden"),
    ).toBe(false);
  });

  it("honours a hidden section and a renamed one", async () => {
    const { document } = await boot({
      navConfig: {
        groups: [{ id: "main", label: "Main", collapsible: false }],
        items: [
          { id: "users", label: "People", icon: "🧑", group: "main", hidden: false },
          { id: "system", label: "", icon: "", group: "main", hidden: true },
        ],
      },
    });
    const users = document.querySelector('#sidebar-nav .nav-link[data-page="users"]');
    expect(users?.textContent?.trim()).toContain("People");
    expect(document.querySelector('#sidebar-nav .nav-link[data-page="system"]')).toBeNull();
  });
});

describe("the Users page", () => {
  it("lists people with their role and an access summary", async () => {
    const { document, click } = await boot({
      users: [
        stubUser({ permissions: [{ permissionType: "feature", value: "tickets" }] }),
        stubUser({
          id: "u-2",
          username: "root",
          role: "superadmin",
          firstName: "Sam",
          lastName: "Ops",
        }),
        stubUser({
          id: "u-3",
          username: "newbie",
          firstName: "Nia",
          lastName: "Bloom",
          permissions: [],
        }),
      ],
    });
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="users"]'));

    const rows = Array.from(document.querySelectorAll(".user-row"));
    expect(rows).toHaveLength(3);
    expect(rows[0]?.querySelector(".user-name")?.textContent).toContain("Dana Reyes");
    expect(rows[0]?.querySelector(".user-avatar")?.textContent).toBe("DR");
    expect(rows[0]?.querySelector(".user-access")?.textContent).toContain("Tickets");
    // Role short-circuits the grant list, because that is how the server reads it.
    expect(rows[1]?.querySelector(".user-access")?.textContent).toContain("Everything");
    // Somebody granted nothing is called out rather than left blank.
    expect(rows[2]?.querySelector(".user-access")?.textContent).toContain("No access yet");
    expect(document.getElementById("users-count")?.textContent).toBe("3 people");
  });

  it("filters by search text and by role", async () => {
    const { dom, document, click } = await boot({
      users: [
        stubUser(),
        stubUser({
          id: "u-2",
          username: "root",
          role: "superadmin",
          firstName: "Sam",
          lastName: "Ops",
        }),
      ],
    });
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="users"]'));

    const search = document.getElementById("users-search") as HTMLInputElement;
    search.value = "sam";
    search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    expect(document.querySelectorAll(".user-row")).toHaveLength(1);
    expect(document.getElementById("users-count")?.textContent).toBe("1 of 2 shown");

    search.value = "";
    search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await click(document.querySelector('#users-role-filters [data-role="superadmin"]'));
    expect(document.querySelectorAll(".user-row")).toHaveLength(1);
    expect(document.querySelector(".user-name")?.textContent).toContain("Sam Ops");
  });

  it("edits profile and access in one dialog and saves both", async () => {
    const { dom, document, calls, click } = await boot({
      users: [stubUser({ permissions: [{ permissionType: "feature", value: "tickets" }] })],
    });
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="users"]'));
    await click(document.querySelector('.user-row [onclick^="openEditUser"]'));

    expect(document.getElementById("user-modal")?.classList.contains("hidden")).toBe(false);
    expect(document.getElementById("user-modal-title")?.textContent).toBe("Edit Dana Reyes");
    // The dialog opened on Profile; Access is a tab away, not a second modal.
    await click(document.querySelector('#user-modal-tabs [data-utab="user-tab-access"]'));
    expect(document.getElementById("user-tab-access")?.classList.contains("hidden")).toBe(false);

    // The grant this person already holds is reflected, and the catalog of
    // agents/skills/channels was fetched to fill the rest.
    const ticketBox = document.getElementById("perm-feature-tickets") as HTMLInputElement;
    expect(ticketBox.checked).toBe(true);
    expect(document.getElementById("perm-agent-main")).not.toBeNull();
    expect(document.getElementById("perm-skill-deploy")).not.toBeNull();

    // Grant a report, then save: one submit writes the profile and the access.
    const reportBox = document.getElementById("perm-report-photographers") as HTMLInputElement;
    reportBox.checked = true;
    reportBox.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    calls.length = 0;
    document.getElementById("user-modal-form")?.dispatchEvent(new dom.window.Event("submit"));
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }

    const put = calls.find((c) => c.method === "PUT" && c.path === "/users/u-1");
    expect(put).toBeDefined();
    const perms = calls.find((c) => c.path === "/users/u-1/permissions");
    expect(perms?.method).toBe("PUT");
    const granted = (perms?.body as { permissions: Perm[] }).permissions;
    expect(granted).toContainEqual({ permissionType: "feature", value: "tickets" });
    expect(granted).toContainEqual({ permissionType: "report", value: "photographers" });
    expect(document.getElementById("user-modal")?.classList.contains("hidden")).toBe(true);
  });

  it("grants a whole group at once", async () => {
    const { document, click } = await boot({ users: [stubUser()] });
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="users"]'));
    await click(document.querySelector('.user-row [onclick^="openEditUser"]'));
    await click(document.querySelector('#user-modal-tabs [data-utab="user-tab-access"]'));

    await click(document.querySelector('[data-bulk-kind="feature"][data-bulk="all"]'));
    const boxes = Array.from(
      document.querySelectorAll('#perms-groups input[data-perm-kind="feature"]'),
    ) as HTMLInputElement[];
    expect(boxes.length).toBeGreaterThan(5);
    expect(boxes.every((b) => b.checked)).toBe(true);

    await click(document.querySelector('[data-bulk-kind="feature"][data-bulk="none"]'));
    const after = Array.from(
      document.querySelectorAll('#perms-groups input[data-perm-kind="feature"]'),
    ) as HTMLInputElement[];
    expect(after.some((b) => b.checked)).toBe(false);
  });

  it("creates a person and writes their access against the new id", async () => {
    const { dom, document, calls, click } = await boot({ users: [] });
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="users"]'));
    await click(document.getElementById("add-user-btn"));

    (document.getElementById("modal-username") as HTMLInputElement).value = "nia";
    (document.getElementById("modal-password") as HTMLInputElement).value = "hunter2";
    calls.length = 0;
    document.getElementById("user-modal-form")?.dispatchEvent(new dom.window.Event("submit"));
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }

    expect(calls.find((c) => c.method === "POST" && c.path === "/users")).toBeDefined();
    // POST answers with the stub's default {} — no id — so no permissions write
    // is attempted against a user that does not exist yet.
    expect(calls.filter((c) => c.path.endsWith("/permissions"))).toEqual([]);
  });
});

describe("the Navigation editor", () => {
  it("loads the current arrangement into draggable groups", async () => {
    const { document, click } = await boot();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="navigation"]'));

    const groups = Array.from(document.querySelectorAll(".nav-edit-group")).map(
      (g) => (g as HTMLElement).dataset.group,
    );
    expect(groups).toEqual(["main", "workspace", "support", "financials", "settings"]);
    const mainItems = Array.from(
      document.querySelectorAll('[data-drop-group="main"] .nav-edit-item'),
    ).map((li) => (li as HTMLElement).dataset.item);
    expect(mainItems).toEqual(["dashboard", "users", "agents", "chat"]);
    expect(document.querySelector(".nav-edit-item")?.getAttribute("draggable")).toBe("true");
  });

  it("reorders with the arrow buttons and saves what it shows", async () => {
    const { document, calls, click } = await boot();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="navigation"]'));

    // Move Users above Dashboard.
    await click(document.querySelector('[data-move="up"][data-item-id="users"]'));
    expect(
      Array.from(document.querySelectorAll('[data-drop-group="main"] .nav-edit-item')).map(
        (li) => (li as HTMLElement).dataset.item,
      ),
    ).toEqual(["users", "dashboard", "agents", "chat"]);
    expect(document.getElementById("nav-editor-status")?.textContent).toBe("Unsaved changes.");

    calls.length = 0;
    await click(document.getElementById("nav-save"));
    const save = calls.find((c) => c.method === "PUT" && c.path === "/nav-config");
    const body = save?.body as { surface: string; config: { items: Array<{ id: string }> } };
    expect(body.surface).toBe("admin");
    expect(body.config.items[0]?.id).toBe("users");
    expect(document.getElementById("nav-editor-status")?.textContent).toBe("Menu saved.");
    // The editor's own sidebar is one of the things that just changed.
    expect((document.querySelector("#sidebar-nav .nav-link") as HTMLElement)?.dataset.page).toBe(
      "users",
    );
  });

  it("hides a section from the menu without removing the page", async () => {
    const { document, calls, click } = await boot();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="navigation"]'));
    await click(document.querySelector('[data-toggle-hidden="cleveland"]'));
    await click(document.getElementById("nav-save"));

    const save = calls.find((c) => c.method === "PUT" && c.path === "/nav-config");
    const items = (save?.body as { config: { items: Array<{ id: string; hidden: boolean }> } })
      .config.items;
    expect(items.find((i) => i.id === "cleveland")?.hidden).toBe(true);
    expect(document.querySelector('#sidebar-nav .nav-link[data-page="cleveland"]')).toBeNull();
    // The page itself is still registered and still routable.
    expect(ADMIN_UI_HTML).toContain("el: 'page-cleveland'");
  });

  it("adds a heading, turns it into a submenu, and rehomes items when it is deleted", async () => {
    const { dom, document, click } = await boot();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="navigation"]'));

    await click(document.getElementById("nav-add-group"));
    const added = Array.from(document.querySelectorAll(".nav-edit-group")).pop() as HTMLElement;
    const newId = added.dataset.group as string;
    expect(added.querySelector<HTMLInputElement>(".nav-edit-group-label")?.value).toBe(
      "New heading",
    );

    const submenu = added.querySelector(`[data-group-collapsible="${newId}"]`) as HTMLInputElement;
    submenu.checked = true;
    submenu.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    // Deleting the Financials heading moves its sections, it does not drop them.
    await click(document.querySelector('[data-group-delete="financials"]'));
    expect(document.querySelector('[data-group="financials"]')).toBeNull();
    const stillThere = Array.from(document.querySelectorAll(".nav-edit-item")).map(
      (li) => (li as HTMLElement).dataset.item,
    );
    expect(stillThere).toContain("financials");
    expect(stillThere).toContain("cleveland");
  });

  it("switches surfaces and edits the portal menu instead", async () => {
    const { document, calls, click } = await boot();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="navigation"]'));
    await click(document.querySelector('#nav-surface-tabs [data-surface="portal"]'));

    expect(calls.some((c) => c.path === "/nav-config?surface=portal")).toBe(true);
    const items = Array.from(document.querySelectorAll(".nav-edit-item")).map(
      (li) => (li as HTMLElement).dataset.item,
    );
    expect(items).toEqual(["chat", "tasks", "reports", "resources", "account"]);
  });

  it("puts the menu back with Reset", async () => {
    const { document, calls, click } = await boot();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="navigation"]'));
    await click(document.querySelector('[data-move="up"][data-item-id="users"]'));
    calls.length = 0;
    await click(document.getElementById("nav-reset"));

    const reset = calls.find((c) => c.method === "PUT" && c.path === "/nav-config");
    expect((reset?.body as { reset: boolean }).reset).toBe(true);
    expect(
      Array.from(document.querySelectorAll('[data-drop-group="main"] .nav-edit-item')).map(
        (li) => (li as HTMLElement).dataset.item,
      ),
    ).toEqual(["dashboard", "users", "agents", "chat"]);
  });
});
