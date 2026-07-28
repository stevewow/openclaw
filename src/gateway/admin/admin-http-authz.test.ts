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

  it("attaches links and files to a task, and gates them on the projects grant", async () => {
    const created = await call("POST", "/tasks", {
      token: adminToken,
      body: { title: "Has attachments" },
    });
    const taskId = (created.json?.task as { id: string }).id;

    const link = await call("POST", `/tasks/${taskId}/attachments`, {
      token: adminToken,
      body: { type: "link", url: "https://example.com/brief", title: "Brief" },
    });
    expect(link.status).toBe(201);
    expect((link.json?.attachment as { url: string }).url).toBe("https://example.com/brief");

    const upload = await call("POST", `/tasks/${taskId}/attachments`, {
      token: adminToken,
      body: {
        type: "file",
        filename: "notes.txt",
        mimetype: "text/plain",
        fileData: Buffer.from("hello there").toString("base64"),
      },
    });
    expect(upload.status).toBe(201);
    const uploaded = upload.json?.attachment as { id: string; filesize: number };
    expect(uploaded.filesize).toBe(11);

    const listed = await call("GET", `/tasks/${taskId}/attachments`, { token: adminToken });
    expect((listed.json?.attachments as unknown[]).length).toBe(2);

    // The download route returns the bytes that went in.
    const fileRes = await fetch(`${base}/api/admin/attachments/${uploaded.id}/file`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(fileRes.status).toBe(200);
    expect(await fileRes.text()).toBe("hello there");

    // The task list carries a count so cards can badge without N queries.
    const tasks = await call("GET", "/tasks", { token: adminToken });
    const row = (tasks.json?.tasks as Array<{ id: string; attachmentCount: number }>).find(
      (t) => t.id === taskId,
    );
    expect(row?.attachmentCount).toBe(2);

    // Someone with no grant cannot read or write them.
    await userStore.setUserPermissions(plainId, []);
    const ungranted = await tokenFor(plainId);
    expect((await call("GET", `/tasks/${taskId}/attachments`, { token: ungranted })).status).toBe(
      403,
    );
    expect(
      (await call("GET", `/attachments/${uploaded.id}/file`, { token: ungranted })).status,
    ).toBe(403);

    // The projects grant alone is not enough — it still is not their task.
    await userStore.setUserPermissions(plainId, [{ permissionType: "feature", value: "projects" }]);
    const granted = await tokenFor(plainId);
    expect((await call("GET", `/tasks/${taskId}/attachments`, { token: granted })).status).toBe(
      403,
    );

    const removed = await call("DELETE", `/attachments/${uploaded.id}`, { token: adminToken });
    expect(removed.status).toBe(200);
    expect(
      (
        (await call("GET", `/tasks/${taskId}/attachments`, { token: adminToken })).json
          ?.attachments as unknown[]
      ).length,
    ).toBe(1);
  });

  it("refuses a link scheme that would run as script when clicked", async () => {
    const created = await call("POST", "/tasks", {
      token: adminToken,
      body: { title: "Link guard" },
    });
    const taskId = (created.json?.task as { id: string }).id;
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://x",
    ]) {
      const res = await call("POST", `/tasks/${taskId}/attachments`, {
        token: adminToken,
        body: { type: "link", url },
      });
      expect(`${url} -> ${res.status}`).toBe(`${url} -> 400`);
    }
  });

  it("404s attachments on an owner that does not exist", async () => {
    // Admins bypass the access guard, so without an explicit existence check
    // this would 200 on read and strand an orphan row + file on write.
    expect(
      (await call("GET", "/tasks/no-such-task/attachments", { token: adminToken })).status,
    ).toBe(404);
    expect(
      (await call("GET", "/projects/no-such-project/attachments", { token: adminToken })).status,
    ).toBe(404);
    expect(
      (
        await call("POST", "/tasks/no-such-task/attachments", {
          token: adminToken,
          body: { type: "link", url: "https://example.com" },
        })
      ).status,
    ).toBe(404);
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

describe("pipedrive cleanup report — admin-approve vs VA-done split", () => {
  const items = [
    {
      itemKey: "authz:merge:1",
      kind: "merge",
      title: "Merge duplicate",
      detail: "merge #b into #a",
    },
    { itemKey: "authz:fill:2", kind: "fill", title: "Set office", detail: "set Office = Auth" },
  ];

  it("hides the report from a user without the grant", async () => {
    const plainToken = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, []);
    const res = await call("GET", "/reports/pipedrive-cleanup", { token: plainToken });
    expect(res.status).toBe(403);
  });

  it("lets an admin import and refuses import from a non-admin", async () => {
    const plainToken = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, [
      { permissionType: "report", value: "pipedrive-cleanup" },
    ]);
    const imp = await call("POST", "/reports/pipedrive-cleanup/import", {
      token: adminToken,
      body: { market: "Authz", items },
    });
    expect(imp.status).toBe(200);
    const denied = await call("POST", "/reports/pipedrive-cleanup/import", {
      token: plainToken,
      body: { market: "Authz", items },
    });
    expect(denied.status).toBe(403);
  });

  it("shows a granted VA only released items, never un-verified suggestions", async () => {
    const plainToken = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, [
      { permissionType: "report", value: "pipedrive-cleanup" },
    ]);
    const vaList = await call("GET", "/reports/pipedrive-cleanup", { token: plainToken });
    expect(vaList.status).toBe(200);
    // Nothing approved yet → the VA sees an empty list even though suggestions exist.
    expect((vaList.json?.items as unknown[]).length).toBe(0);
    expect(vaList.json?.canVerify).toBe(false);
  });

  it("refuses a granted VA approving, but lets the admin approve then the VA complete", async () => {
    const plainToken = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, [
      { permissionType: "report", value: "pipedrive-cleanup" },
    ]);
    const adminList = await call("GET", "/reports/pipedrive-cleanup", { token: adminToken });
    const target = (adminList.json?.items as Array<{ id: string; status: string }>).find(
      (i) => i.status === "suggested",
    )!;

    // A report-access user cannot approve.
    const vaApprove = await call("PUT", `/reports/pipedrive-cleanup/items/${target.id}/approve`, {
      token: plainToken,
    });
    expect(vaApprove.status).toBe(403);

    // Nor can they jump a suggestion straight to done.
    const early = await call("PUT", `/reports/pipedrive-cleanup/items/${target.id}/done`, {
      token: plainToken,
      body: { done: true },
    });
    expect(early.status).toBe(409);

    // Admin approves; VA then completes.
    const approve = await call("PUT", `/reports/pipedrive-cleanup/items/${target.id}/approve`, {
      token: adminToken,
    });
    expect(approve.status).toBe(200);
    const done = await call("PUT", `/reports/pipedrive-cleanup/items/${target.id}/done`, {
      token: plainToken,
      body: { done: true },
    });
    expect(done.status).toBe(200);
    expect((done.json?.item as { status: string }).status).toBe("done");
  });
});

describe("churn report — read gated by the report grant", () => {
  // Pin the snapshot path to a missing file so resolution is deterministic
  // regardless of the host's real workspace.
  const savedChurnPath = process.env.OPENCLAW_CHURN_REPORT_PATH;
  beforeAll(() => {
    process.env.OPENCLAW_CHURN_REPORT_PATH = "/nonexistent/churn-authz-test.json";
  });
  afterAll(() => {
    if (savedChurnPath === undefined) {
      delete process.env.OPENCLAW_CHURN_REPORT_PATH;
    } else {
      process.env.OPENCLAW_CHURN_REPORT_PATH = savedChurnPath;
    }
  });

  it("hides the report from a user without the grant", async () => {
    const plainToken = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, []);
    const res = await call("GET", "/reports/churn", { token: plainToken });
    expect(res.status).toBe(403);
  });

  it("serves a granted user and an admin (null snapshot when the engine has not run)", async () => {
    const plainToken = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, [{ permissionType: "report", value: "churn" }]);
    const granted = await call("GET", "/reports/churn", { token: plainToken });
    expect(granted.status).toBe(200);
    // No snapshot file in the test workspace → report is null with a status.
    expect(granted.json?.report ?? null).toBeNull();
    expect(granted.json?.status).toBe("not_generated");

    const adminRes = await call("GET", "/reports/churn", { token: adminToken });
    expect(adminRes.status).toBe(200);
  });

  it("refuses to dismiss when there is no snapshot to dismiss from", async () => {
    const res = await call("POST", "/reports/churn/dismissals", {
      token: adminToken,
      body: { agentKey: "guid-1" },
    });
    expect(res.status).toBe(409);
  });
});

describe("churn dismissals — shared hide/restore", () => {
  const savedChurnPath = process.env.OPENCLAW_CHURN_REPORT_PATH;
  let snapshotFile: string;

  beforeAll(() => {
    snapshotFile = path.join(TMP_DIR, "churn-snapshot.json");
    fs.writeFileSync(
      snapshotFile,
      JSON.stringify({
        schema_version: 2,
        generated_at: "2026-07-27T12:00:00",
        observation_end: "2026-07-27",
        seasonal_adjust: true,
        orders_kept: 10,
        orders_total: 12,
        agents_total: 2,
        headline: {},
        health_tiers: {},
        model: {},
        identity_audit: {},
        revenue_retention: [],
        second_order_conversion: [],
        seasonality: [],
        data_quality: [],
        agent_scores: [
          { agent_id: "guid-1", agent_name: "Dana Reyes", company_name: "CB Heritage" },
          { agent_id: "guid-2", agent_name: "Sam Okafor", company_name: "Sibcy Cline" },
        ],
        outreach_queue: [
          { agent_id: "guid-1", agent_name: "Dana Reyes", company_name: "CB Heritage" },
        ],
      }),
    );
    process.env.OPENCLAW_CHURN_REPORT_PATH = snapshotFile;
  });
  afterAll(() => {
    if (savedChurnPath === undefined) {
      delete process.env.OPENCLAW_CHURN_REPORT_PATH;
    } else {
      process.env.OPENCLAW_CHURN_REPORT_PATH = savedChurnPath;
    }
  });

  it("refuses hide and restore without the report grant", async () => {
    const plainToken = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, []);
    const hide = await call("POST", "/reports/churn/dismissals", {
      token: plainToken,
      body: { agentKey: "guid-1" },
    });
    expect(hide.status).toBe(403);
    const restore = await call("DELETE", "/reports/churn/dismissals/guid-1", {
      token: plainToken,
    });
    expect(restore.status).toBe(403);
  });

  it("lets a granted user hide an agent, sees it on the report, then restores it", async () => {
    const plainToken = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, [{ permissionType: "report", value: "churn" }]);

    const hide = await call("POST", "/reports/churn/dismissals", {
      token: plainToken,
      body: { agentKey: "guid-1", reason: "Retired in June" },
    });
    expect(hide.status).toBe(200);
    // Name and brokerage come from the snapshot, not the request body.
    expect(hide.json?.dismissal).toMatchObject({
      agentKey: "guid-1",
      agentName: "Dana Reyes",
      companyName: "CB Heritage",
      reason: "Retired in June",
      dismissedByName: "other",
    });

    // Any other viewer of the report sees the same dismissal.
    const read = await call("GET", "/reports/churn", { token: adminToken });
    expect(read.status).toBe(200);
    expect(read.json?.dismissals).toHaveLength(1);

    const restore = await call("DELETE", "/reports/churn/dismissals/guid-1", {
      token: plainToken,
    });
    expect(restore.status).toBe(200);
    const after = await call("GET", "/reports/churn", { token: adminToken });
    expect(after.json?.dismissals).toEqual([]);
  });

  it("rejects an agent key that is not in the snapshot, and a missing key", async () => {
    const unknown = await call("POST", "/reports/churn/dismissals", {
      token: adminToken,
      body: { agentKey: "guid-nope" },
    });
    expect(unknown.status).toBe(404);
    const missing = await call("POST", "/reports/churn/dismissals", {
      token: adminToken,
      body: {},
    });
    expect(missing.status).toBe(400);
  });

  it("reports 404 when restoring an agent that was not hidden", async () => {
    const res = await call("DELETE", "/reports/churn/dismissals/guid-2", { token: adminToken });
    expect(res.status).toBe(404);
  });

  it("files the hide reason as a note, so it outlives the dismissal", async () => {
    const hide = await call("POST", "/reports/churn/dismissals", {
      token: adminToken,
      body: { agentKey: "guid-2", reason: "Moved to Florida" },
    });
    expect(hide.status).toBe(200);
    expect(hide.json?.note).toMatchObject({
      agentKey: "guid-2",
      body: "Hidden: Moved to Florida",
    });

    await call("DELETE", "/reports/churn/dismissals/guid-2", { token: adminToken });
    const read = await call("GET", "/reports/churn", { token: adminToken });
    expect(read.json?.dismissals).toEqual([]);
    // Restored, but the record of why they were hidden stays on the report.
    const notes = (
      read.json?.notes as Array<{ id: string; agentKey: string; body: string }>
    ).filter((n) => n.agentKey === "guid-2");
    expect(notes).toHaveLength(1);
    expect(notes[0]?.body).toBe("Hidden: Moved to Florida");
  });
});

describe("churn notes — shared agent notes", () => {
  const savedChurnPath = process.env.OPENCLAW_CHURN_REPORT_PATH;
  let snapshotFile: string;

  beforeAll(() => {
    snapshotFile = path.join(TMP_DIR, "churn-notes-snapshot.json");
    fs.writeFileSync(
      snapshotFile,
      JSON.stringify({
        schema_version: 3,
        generated_at: "2026-07-27T12:00:00",
        observation_end: "2026-07-27",
        observation_start: "2023-07-28",
        window_years: 3,
        seasonal_adjust: true,
        orders_kept: 10,
        orders_total: 12,
        agents_total: 1,
        headline: {},
        health_tiers: {},
        model: {},
        identity_audit: {},
        revenue_retention: [],
        second_order_conversion: [],
        seasonality: [],
        data_quality: [],
        agent_scores: [
          { agent_id: "guid-1", agent_name: "Dana Reyes", company_name: "CB Heritage" },
        ],
        outreach_queue: [],
      }),
    );
    process.env.OPENCLAW_CHURN_REPORT_PATH = snapshotFile;
  });
  afterAll(() => {
    if (savedChurnPath === undefined) {
      delete process.env.OPENCLAW_CHURN_REPORT_PATH;
    } else {
      process.env.OPENCLAW_CHURN_REPORT_PATH = savedChurnPath;
    }
  });

  it("refuses reading and writing notes without the report grant", async () => {
    const plainToken = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, []);
    const read = await call("GET", "/reports/churn/notes/guid-1", { token: plainToken });
    expect(read.status).toBe(403);
    const write = await call("POST", "/reports/churn/notes/guid-1", {
      token: plainToken,
      body: { body: "nope" },
    });
    expect(write.status).toBe(403);
  });

  it("adds a note against an agent in the snapshot and shares it with the team", async () => {
    const plainToken = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, [{ permissionType: "report", value: "churn" }]);
    const added = await call("POST", "/reports/churn/notes/guid-1", {
      token: plainToken,
      body: { body: "Called — listing again in spring." },
    });
    expect(added.status).toBe(200);
    // Name and brokerage are read from the snapshot, never from the request.
    expect(added.json?.note).toMatchObject({
      agentKey: "guid-1",
      agentName: "Dana Reyes",
      companyName: "CB Heritage",
      body: "Called — listing again in spring.",
      createdByName: "other",
    });

    const noteId = (added.json?.note as { id: string }).id;
    const mine = await call("GET", "/reports/churn/notes/guid-1", { token: adminToken });
    expect((mine.json?.notes as Array<{ id: string }>).map((n) => n.id)).toContain(noteId);
    // The snapshot read carries every note, so each row can show its own.
    const onReport = await call("GET", "/reports/churn", { token: adminToken });
    expect((onReport.json?.notes as Array<{ id: string }>).map((n) => n.id)).toContain(noteId);

    const del = await call("DELETE", `/reports/churn/notes/guid-1/${noteId}`, {
      token: adminToken,
    });
    expect(del.status).toBe(200);
    const after = await call("GET", "/reports/churn", { token: adminToken });
    expect((after.json?.notes as Array<{ id: string }>).map((n) => n.id)).not.toContain(noteId);
  });

  it("rejects an empty note and an agent that is not in the snapshot", async () => {
    const empty = await call("POST", "/reports/churn/notes/guid-1", {
      token: adminToken,
      body: { body: "   " },
    });
    expect(empty.status).toBe(400);
    const unknown = await call("POST", "/reports/churn/notes/guid-nope", {
      token: adminToken,
      body: { body: "hello" },
    });
    expect(unknown.status).toBe(404);
  });

  it("reports 404 when deleting a note that does not exist", async () => {
    const res = await call("DELETE", "/reports/churn/notes/guid-1/no-such-note", {
      token: adminToken,
    });
    expect(res.status).toBe(404);
  });
});

describe("churn refresh — gated, validated, one at a time", () => {
  it("refuses to start or read a refresh without the report grant", async () => {
    const plainToken = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, []);
    const start = await call("POST", "/reports/churn/refresh", {
      token: plainToken,
      body: { years: 3 },
    });
    expect(start.status).toBe(403);
    const status = await call("GET", "/reports/churn/refresh", { token: plainToken });
    expect(status.status).toBe(403);
  });

  it("rejects a window the engine is not offered", async () => {
    for (const years of [0, 4, 99, "3"]) {
      const res = await call("POST", "/reports/churn/refresh", {
        token: adminToken,
        body: { years },
      });
      expect(res.status).toBe(400);
    }
  });

  it("reports an idle state before anything has run", async () => {
    const res = await call("GET", "/reports/churn/refresh", { token: adminToken });
    expect(res.status).toBe(200);
    expect(res.json?.refresh).toMatchObject({ status: "idle" });
  });
});
