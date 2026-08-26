import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { resolveNavConfig } from "./nav-config-store.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * The lead queue ships as markup and inline JS inside a template string, so
 * nothing in the build ever runs it. These boot the real page in a DOM against a
 * stubbed API and drive it — the same technique admin-ui-spa.test.ts uses — and
 * they do it on BOTH signed-in surfaces, because the two SPAs share the routes
 * and the component module but no page shell.
 */

type Call = { method: string; path: string; body: unknown };

const LEADS = [
  {
    id: "lead-1",
    number: "LEAD-1001",
    source: "framer",
    formName: "Contact",
    name: "Dana Reyes",
    email: "dana@brokerage.com",
    phone: "(614) 555-0111",
    company: "Keller Williams Capital",
    message: "Two listings next week.",
    marketRaw: "Columbus",
    territoryKey: "columbus",
    ownerName: "Chris Voge",
    ownerEmail: "chris@example.com",
    status: "new",
    pageUrl: null,
    fields: [{ label: "Listings per year", value: "24" }],
    notifiedAt: 1_756_000_000_000,
    notifyError: null,
    createdAt: 1_756_000_000_000,
    updatedAt: 1_756_000_000_000,
  },
  {
    id: "lead-2",
    number: "LEAD-1002",
    source: "framer",
    formName: "Contact",
    name: "Sam Unrouted",
    email: "sam@x.com",
    phone: null,
    company: null,
    message: null,
    marketRaw: "Nashville",
    territoryKey: null,
    ownerName: null,
    ownerEmail: null,
    status: "new",
    pageUrl: null,
    fields: [],
    notifiedAt: null,
    notifyError: "no territory matched and no fallback address",
    createdAt: 1_756_000_000_000,
    updatedAt: 1_756_000_000_000,
  },
];

const TERRITORIES = [
  {
    key: "columbus",
    label: "Columbus",
    aliases: ["Central Ohio"],
    ownerName: "Chris Voge",
    ownerEmail: "chris@example.com",
    active: true,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    key: "lima",
    label: "Lima",
    aliases: [],
    ownerName: "Ryan Bowersock",
    ownerEmail: null,
    active: true,
    sortOrder: 1,
    createdAt: 0,
    updatedAt: 0,
  },
];

const QUEUE_RESPONSE = {
  leads: LEADS,
  summary: {
    total: 2,
    byStatus: [
      { status: "new", label: "New", count: 2 },
      { status: "contacted", label: "Contacted", count: 0 },
      { status: "qualified", label: "Qualified", count: 0 },
      { status: "won", label: "Won", count: 0 },
      { status: "lost", label: "Lost", count: 0 },
    ],
    unrouted: 1,
    undelivered: 1,
  },
  statuses: [
    { key: "new", label: "New" },
    { key: "contacted", label: "Contacted" },
    { key: "qualified", label: "Qualified" },
    { key: "won", label: "Won" },
    { key: "lost", label: "Lost" },
  ],
  territories: TERRITORIES,
};

const EVENTS = [
  {
    id: "e1",
    leadId: "lead-1",
    kind: "created",
    authorName: null,
    body: "Submitted through Contact",
    createdAt: 1,
  },
  {
    id: "e2",
    leadId: "lead-1",
    kind: "dispatch",
    authorName: null,
    body: "Emailed to chris@example.com",
    createdAt: 2,
  },
];

function respond(method: string, path: string, body: unknown): [number, unknown] {
  if (path === "/auth/login") {
    return [
      200,
      { token: "t", user: { id: "u-1", username: "root", role: "superadmin", permissions: [] } },
    ];
  }
  if (path === "/nav-config?surface=admin" || path === "/nav-config?surface=portal") {
    const surface = path.endsWith("portal") ? "portal" : "admin";
    return [200, { surface, config: resolveNavConfig(surface, null as never) }];
  }
  if (path.startsWith("/leads?") || path === "/leads") {
    return [200, QUEUE_RESPONSE];
  }
  if (path === "/lead-territories") {
    return [200, { territories: TERRITORIES }];
  }
  if (path.startsWith("/leads/") && method === "GET") {
    return [200, { lead: LEADS[0], events: EVENTS }];
  }
  if (path.startsWith("/leads/")) {
    const status = (body as { status?: string } | undefined)?.status ?? "new";
    return [200, { lead: { ...LEADS[0], status }, events: EVENTS }];
  }
  // The dashboard loads itself on sign-in before anything here is clicked; these
  // keep that path from throwing over a stub that only knows about leads.
  if (path === "/users") {
    return [200, { users: [] }];
  }
  if (path === "/agents") {
    return [200, { agents: [] }];
  }
  if (path === "/skills") {
    return [200, { skills: [] }];
  }
  if (path === "/channels") {
    return [200, { channels: [] }];
  }
  if (path === "/tasks" || path.startsWith("/tasks?")) {
    return [200, { tasks: [] }];
  }
  if (path === "/projects") {
    return [200, { projects: [] }];
  }
  if (path === "/portal/config" || path === "/auth/me") {
    return [200, { id: "u-1", username: "root", role: "superadmin", permissions: [], email: null }];
  }
  return [200, {}];
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function bootAdmin() {
  const calls: Call[] = [];
  const dom = new JSDOM(ADMIN_UI_HTML, {
    runScripts: "dangerously",
    url: "http://localhost/",
    beforeParse(window: Window & typeof globalThis) {
      (window as unknown as { fetch: unknown }).fetch = async (
        url: string,
        opts: { method: string; body?: string },
      ) => {
        const path = url.replace("/api/admin", "");
        const parsed = opts.body ? JSON.parse(opts.body) : undefined;
        calls.push({ method: opts.method, path, body: parsed });
        const [status, data] = respond(opts.method, path, parsed);
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
  await settle();
  const click = async (el: Element | null) => {
    el?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await settle();
  };
  const change = async (el: Element | null) => {
    el?.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await settle();
  };
  return { dom, document, calls, click, change };
}

describe("the lead queue in the dashboard", () => {
  it("lists what came in, with the market and who has it", async () => {
    const { document, click, calls } = await bootAdmin();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="leads"]'));

    expect(calls.some((c) => c.path.startsWith("/leads?"))).toBe(true);
    const rows = Array.from(document.querySelectorAll("#ld-rows tr"));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Dana Reyes");
    expect(rows[0].textContent).toContain("Columbus");
    expect(rows[0].textContent).toContain("Chris Voge");
    expect(document.getElementById("ld-count")?.textContent).toBe("2 leads");
  });

  it("marks the lead nobody owns and the one nobody was told about", async () => {
    const { document, click } = await bootAdmin();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="leads"]'));

    const unrouted = document.querySelectorAll("#ld-rows tr")[1];
    expect(unrouted.querySelector(".ld-unrouted")?.textContent).toBe("Unrouted");
    const stats = document.getElementById("ld-stats")?.textContent ?? "";
    expect(stats).toContain("Unrouted");
    expect(stats).toContain("Not emailed");
  });

  it("opens a lead with its answers, its trail and the way to reach them", async () => {
    const { document, click } = await bootAdmin();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="leads"]'));
    await click(document.querySelector("#ld-rows tr .ld-open"));

    expect(document.getElementById("ld-modal")?.classList.contains("hidden")).toBe(false);
    const facts = document.getElementById("ld-modal-facts")?.textContent ?? "";
    expect(facts).toContain("dana@brokerage.com");
    expect(facts).toContain("(614) 555-0111");
    // The answers the form asked that have no column of their own.
    expect(facts).toContain("Listings per year");
    expect(document.getElementById("ld-modal-message")?.textContent).toContain("Two listings");
    expect(document.getElementById("ld-modal-trail")?.textContent).toContain(
      "Emailed to chris@example.com",
    );
  });

  it("moves a lead along and re-routes it through the API", async () => {
    const { document, click, change, calls } = await bootAdmin();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="leads"]'));
    await click(document.querySelector("#ld-rows tr .ld-open"));

    const status = document.getElementById("ld-modal-status") as HTMLSelectElement;
    status.value = "contacted";
    await change(status);
    expect(
      calls.some(
        (c) =>
          c.method === "PUT" &&
          c.path === "/leads/lead-1/status" &&
          (c.body as { status: string }).status === "contacted",
      ),
    ).toBe(true);

    const territory = document.getElementById("ld-modal-territory") as HTMLSelectElement;
    territory.value = "lima";
    await change(territory);
    expect(
      calls.some(
        (c) =>
          c.method === "PUT" &&
          c.path === "/leads/lead-1/assign" &&
          (c.body as { territoryKey: string }).territoryKey === "lima",
      ),
    ).toBe(true);
  });

  it("sends the dispatch again on request", async () => {
    const { document, click, calls } = await bootAdmin();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="leads"]'));
    await click(document.querySelector("#ld-rows tr .ld-open"));
    await click(document.getElementById("ld-modal-resend"));
    expect(calls.some((c) => c.method === "POST" && c.path === "/leads/lead-1/dispatch")).toBe(
      true,
    );
  });

  it("shows the routing table and says which markets cannot be emailed", async () => {
    const { document, click } = await bootAdmin();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="lead-routing"]'));

    const rows = Array.from(document.querySelectorAll("#ld-terr-rows tr"));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("chris@example.com");
    expect(rows[0].textContent).toContain("Central Ohio");
    expect(rows[1].querySelector(".ld-missing")?.textContent).toContain("no address");
  });

  it("saves an address onto a market", async () => {
    const { document, click, calls } = await bootAdmin();
    await click(document.querySelector('#sidebar-nav .nav-link[data-page="lead-routing"]'));
    await click(document.querySelectorAll("#ld-terr-rows .ld-terr-edit")[1]);
    (document.getElementById("ld-terr-email") as HTMLInputElement).value = "ryan@example.com";
    await click(document.getElementById("ld-terr-save"));

    const saved = calls.find((c) => c.method === "PUT" && c.path === "/lead-territories/lima");
    expect((saved?.body as { ownerEmail: string }).ownerEmail).toBe("ryan@example.com");
  });
});

describe("the lead queue in the portal", () => {
  it("ships the same queue, without the pages only an admin has", () => {
    expect(USER_PORTAL_HTML).toContain('id="page-leads"');
    expect(USER_PORTAL_HTML).toContain('id="ld-rows"');
    expect(USER_PORTAL_HTML).toContain('id="ld-modal"');
    // Adding leads by hand and editing the routing table are the admin's.
    expect(USER_PORTAL_HTML).not.toContain('id="ld-new"');
    expect(USER_PORTAL_HTML).not.toContain('id="page-lead-routing"');
    expect(USER_PORTAL_HTML).not.toContain('id="ld-terr-rows"');
  });

  it("draws the queue for a teammate who was granted it", async () => {
    const calls: Call[] = [];
    const dom = new JSDOM(USER_PORTAL_HTML, {
      runScripts: "dangerously",
      url: "http://localhost/",
      beforeParse(window: Window & typeof globalThis) {
        (window as unknown as { fetch: unknown }).fetch = async (
          url: string,
          opts: { method: string; body?: string },
        ) => {
          const path = url.replace("/api/admin", "");
          const parsed = opts.body ? JSON.parse(opts.body) : undefined;
          calls.push({ method: opts.method ?? "GET", path, body: parsed });
          const [status, data] = respond(opts.method ?? "GET", path, parsed);
          return { ok: status < 400, status, json: async () => data };
        };
        window.alert = () => {};
      },
    });
    const document = dom.window.document as Document;
    await settle();
    // Driving the portal's sign-in is another suite's job; what matters here is
    // that the queue renders from the same response the dashboard reads.
    const load = (dom.window as unknown as { loadLeads?: () => Promise<void> }).loadLeads;
    expect(typeof load).toBe("function");
    await load?.();
    await settle();
    const rows = Array.from(document.querySelectorAll("#ld-rows tr"));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Dana Reyes");
  });
});
