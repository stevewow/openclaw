import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-admin-authz-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleAdminHttpRequest, setPortalAuthResolver } = await import("./admin-http.js");
const userStore = await import("./user-store.js");

let server: Server;
let base: string;

// Session tokens, keyed by role.
let superToken: string;
let adminToken: string;
let userToken: string;

let superId: string;
let adminId: string;
let userId: string;
let plainId: string;

async function tokenFor(id: string): Promise<string> {
  return (await userStore.createSession(id)).token;
}

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`${base}/api/admin${path}`, {
    method,
    headers: {
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  let json: Record<string, unknown> | null = null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

beforeAll(async () => {
  // Users are created directly rather than via ensureAdminInitialized() so this
  // suite does not start the background refresh schedulers.
  superId = (await userStore.createUser({ username: "root", password: "pw", role: "superadmin" }))
    .id;
  adminId = (await userStore.createUser({ username: "desk", password: "pw", role: "admin" })).id;
  userId = (await userStore.createUser({ username: "viewer", password: "pw", role: "user" })).id;
  plainId = (await userStore.createUser({ username: "other", password: "pw", role: "user" })).id;

  superToken = await tokenFor(superId);
  adminToken = await tokenFor(adminId);
  userToken = await tokenFor(userId);

  // Gateway auth resolver stub — /portal/config hands this out on success.
  setPortalAuthResolver(() => ({ mode: "token", token: "GATEWAY-SECRET" }) as never);

  server = createServer((req, res) => {
    void (async () => {
      const handled = await handleAdminHttpRequest(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end("not found");
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("superadmin accounts are protected from admins", () => {
  it("refuses an admin resetting a superadmin's password", async () => {
    const res = await call("PUT", `/users/${superId}`, {
      token: adminToken,
      body: { password: "seized" },
    });
    expect(res.status).toBe(403);
    // The password must be unchanged: the original still logs in.
    const login = await call("POST", "/auth/login", {
      body: { username: "root", password: "pw" },
    });
    expect(login.status).toBe(200);
  });

  it("refuses an admin deleting a superadmin", async () => {
    const res = await call("DELETE", `/users/${superId}`, { token: adminToken });
    expect(res.status).toBe(403);
    expect(await userStore.getUserById(superId)).not.toBeNull();
  });

  it("still lets a superadmin edit a superadmin", async () => {
    const res = await call("PUT", `/users/${superId}`, {
      token: superToken,
      body: { firstName: "Root" },
    });
    expect(res.status).toBe(200);
  });

  it("still lets an admin edit a non-superadmin user", async () => {
    const res = await call("PUT", `/users/${plainId}`, {
      token: adminToken,
      body: { firstName: "Renamed" },
    });
    expect(res.status).toBe(200);
  });

  it("404s on an unknown user rather than leaking the guard", async () => {
    const res = await call("PUT", "/users/does-not-exist", {
      token: adminToken,
      body: { firstName: "x" },
    });
    expect(res.status).toBe(404);
  });
});

describe("/portal/config is gated on chat access", () => {
  it("refuses a user with no chat permission", async () => {
    await userStore.setUserPermissions(userId, []);
    const res = await call("GET", "/portal/config", { token: userToken });
    expect(res.status).toBe(403);
  });

  it("does not leak the gateway credential to an ungranted user", async () => {
    await userStore.setUserPermissions(userId, []);
    const res = await call("GET", "/portal/config", { token: userToken });
    expect(JSON.stringify(res.json ?? {})).not.toContain("GATEWAY-SECRET");
  });

  it("allows a user explicitly granted chat", async () => {
    await userStore.setUserPermissions(userId, [{ permissionType: "feature", value: "chat" }]);
    const res = await call("GET", "/portal/config", { token: userToken });
    expect(res.status).toBe(200);
  });

  it("hands back the caller's own portal token, never the shared gateway secret", async () => {
    await userStore.setUserPermissions(userId, [{ permissionType: "feature", value: "chat" }]);
    const res = await call("GET", "/portal/config", { token: userToken });
    // The browser credential must be the user's own session token: per-user,
    // revocable on logout, and scope-capped by the gateway on connect.
    expect(res.json?.gatewayToken).toBe(userToken);
    expect(res.json?.portalSessionToken).toBe(userToken);
    expect(JSON.stringify(res.json ?? {})).not.toContain("GATEWAY-SECRET");
  });

  it("allows admins without an explicit grant", async () => {
    const res = await call("GET", "/portal/config", { token: adminToken });
    expect(res.status).toBe(200);
  });

  it("still requires a session", async () => {
    const res = await call("GET", "/portal/config");
    expect(res.status).toBe(401);
  });
});

describe("ticket surfaces are gated per-grant", () => {
  // The queue and its three config surfaces are granted separately so someone
  // can work tickets without being able to rewire departments, request types,
  // or the public intake form.
  const SURFACES: Array<{ feature: string; path: string }> = [
    { feature: "tickets", path: "/tickets" },
    { feature: "tickets", path: "/tickets/stats" },
    { feature: "ticket-departments", path: "/tickets/departments" },
    { feature: "ticket-categories", path: "/tickets/categories" },
    { feature: "ticket-form", path: "/tickets/test-token?email=qa@example.com" },
  ];

  it("denies every ticket surface to a user with no grants", async () => {
    await userStore.setUserPermissions(plainId, []);
    const plainToken = await tokenFor(plainId);
    for (const { path } of SURFACES) {
      const res = await call("GET", path, { token: plainToken });
      expect(`${path} -> ${res.status}`).toBe(`${path} -> 403`);
    }
  });

  it("opens exactly the granted surface and nothing else", async () => {
    for (const target of SURFACES) {
      await userStore.setUserPermissions(plainId, [
        { permissionType: "feature", value: target.feature },
      ]);
      const plainToken = await tokenFor(plainId);
      for (const probe of SURFACES) {
        const res = await call("GET", probe.path, { token: plainToken });
        // The queue grant also carries READ of the department/category lookups —
        // it needs them for filter dropdowns and to render labels, not raw keys.
        const allowed =
          probe.feature === target.feature ||
          (target.feature === "tickets" &&
            (probe.feature === "ticket-departments" || probe.feature === "ticket-categories"));
        expect(
          `grant=${target.feature} probe=${probe.path} -> ${res.status === 403 ? "403" : "ok"}`,
        ).toBe(`grant=${target.feature} probe=${probe.path} -> ${allowed ? "ok" : "403"}`);
      }
    }
  });

  it("lets the queue grant READ the lookups but never WRITE them", async () => {
    await userStore.setUserPermissions(plainId, [{ permissionType: "feature", value: "tickets" }]);
    const plainToken = await tokenFor(plainId);

    // Reads the queue page actually depends on.
    expect((await call("GET", "/tickets/departments", { token: plainToken })).status).not.toBe(403);
    expect((await call("GET", "/tickets/categories", { token: plainToken })).status).not.toBe(403);

    // Mutations still require the matching config grant.
    const writes: Array<[string, string]> = [
      ["POST", "/tickets/departments"],
      ["PUT", "/tickets/departments/editing"],
      ["DELETE", "/tickets/departments/editing"],
      ["POST", "/tickets/categories"],
      ["PUT", "/tickets/categories/edit_request"],
      ["DELETE", "/tickets/categories/edit_request"],
      ["PUT", "/tickets/category-routes"],
    ];
    for (const [method, path] of writes) {
      const res = await call(method, path, { token: plainToken, body: { label: "x" } });
      expect(`${method} ${path} -> ${res.status}`).toBe(`${method} ${path} -> 403`);
    }
  });

  it("routes category-routes with the Departments grant, where it is edited", async () => {
    await userStore.setUserPermissions(plainId, [
      { permissionType: "feature", value: "ticket-departments" },
    ]);
    const plainToken = await tokenFor(plainId);
    const res = await call("PUT", "/tickets/category-routes", {
      token: plainToken,
      body: { routes: {} },
    });
    expect(res.status).not.toBe(403);

    // The request-types grant must NOT unlock it.
    await userStore.setUserPermissions(plainId, [
      { permissionType: "feature", value: "ticket-categories" },
    ]);
    const other = await tokenFor(plainId);
    const denied = await call("PUT", "/tickets/category-routes", {
      token: other,
      body: { routes: {} },
    });
    expect(denied.status).toBe(403);
  });

  it("closes an unknown ticket subpath by default rather than leaving it open", async () => {
    // A future /tickets/* route must ship denied for the ungranted, not exposed.
    await userStore.setUserPermissions(plainId, [
      { permissionType: "feature", value: "ticket-departments" },
    ]);
    const plainToken = await tokenFor(plainId);
    const res = await call("GET", "/tickets/some-future-surface", { token: plainToken });
    expect(res.status).toBe(403);
  });

  it("still lets admins through without any ticket grant", async () => {
    for (const { path } of SURFACES) {
      const res = await call("GET", path, { token: adminToken });
      expect(`${path} -> ${res.status}`).not.toBe(`${path} -> 403`);
    }
  });
});

describe("project duplication and board reordering", () => {
  it("duplicates a project with its tasks and honors the projects grant", async () => {
    const created = await call("POST", "/projects", {
      token: adminToken,
      body: { title: "Newsletter", status: "active" },
    });
    expect(created.status).toBe(201);
    const projectId = (created.json?.project as { id: string }).id;
    await call("POST", "/tasks", {
      token: adminToken,
      body: { title: "Write draft", projectId, status: "review" },
    });

    // A user with no grants cannot reach the duplicate route at all.
    await userStore.setUserPermissions(plainId, []);
    const ungranted = await tokenFor(plainId);
    expect(
      (await call("POST", `/projects/${projectId}/duplicate`, { token: ungranted, body: {} }))
        .status,
    ).toBe(403);

    // With the projects grant it is still scoped: not their project, still denied.
    await userStore.setUserPermissions(plainId, [{ permissionType: "feature", value: "projects" }]);
    const granted = await tokenFor(plainId);
    expect(
      (await call("POST", `/projects/${projectId}/duplicate`, { token: granted, body: {} })).status,
    ).toBe(403);

    const dup = await call("POST", `/projects/${projectId}/duplicate`, {
      token: adminToken,
      body: { title: "August Newsletter" },
    });
    expect(dup.status).toBe(201);
    const copy = dup.json?.project as { id: string; title: string };
    expect(copy.title).toBe("August Newsletter");
    expect(copy.id).not.toBe(projectId);

    const tasks = await call("GET", `/tasks?projectId=${copy.id}`, { token: adminToken });
    const copied = tasks.json?.tasks as Array<{ title: string; status: string }>;
    expect(copied.map((t) => t.title)).toEqual(["Write draft"]);
    // Copies restart regardless of where the original had got to.
    expect(copied[0].status).toBe("todo");
  });

  it("404s duplicating a project that does not exist", async () => {
    const res = await call("POST", "/projects/nope/duplicate", { token: adminToken, body: {} });
    expect(res.status).toBe(404);
  });

  it("persists position so a dragged card keeps its slot", async () => {
    const created = await call("POST", "/tasks", {
      token: adminToken,
      body: { title: "Draggable", status: "todo" },
    });
    const taskId = (created.json?.task as { id: string }).id;

    const moved = await call("PUT", `/tasks/${taskId}`, {
      token: adminToken,
      body: { status: "in_progress", position: 3 },
    });
    expect(moved.status).toBe(200);
    const task = moved.json?.task as { status: string; position: number };
    expect(task.status).toBe("in_progress");
    expect(task.position).toBe(3);

    // Junk positions are ignored rather than written through.
    const bad = await call("PUT", `/tasks/${taskId}`, {
      token: adminToken,
      body: { position: "first" },
    });
    expect((bad.json?.task as { position: number }).position).toBe(3);
  });
});
