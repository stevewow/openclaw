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

describe("past due accounts — assigned worklist", () => {
  const ACCOUNT = "agent:authz-past-due";
  const OTHER = "agent:authz-past-due-other";

  async function grantPastDue(): Promise<string> {
    const token = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, [{ permissionType: "report", value: "past-due" }]);
    return token;
  }

  it("hides the report from a user without the grant", async () => {
    const token = await tokenFor(plainId);
    await userStore.setUserPermissions(plainId, []);
    expect((await call("GET", "/financials/past-due", { token })).status).toBe(403);
    expect((await call("GET", `/financials/accounts/${ACCOUNT}`, { token })).status).toBe(403);
  });

  it("keeps refresh admin-only even for a granted user", async () => {
    const token = await grantPastDue();
    expect((await call("POST", "/financials/past-due/refresh", { token })).status).toBe(403);
  });

  it("refuses a granted user acting on an account nobody assigned them", async () => {
    const token = await grantPastDue();
    const res = await call("PUT", `/financials/accounts/${ACCOUNT}/status`, {
      token,
      body: { status: "working" },
    });
    expect(res.status).toBe(403);
    const note = await call("POST", "/financials/notes", {
      token,
      body: { accountKey: ACCOUNT, body: "should not land" },
    });
    expect(note.status).toBe(403);
  });

  it("refuses a granted user assigning work — that stays with admins", async () => {
    const token = await grantPastDue();
    const res = await call("PUT", `/financials/accounts/${ACCOUNT}/assign`, {
      token,
      body: { assignedTo: plainId },
    });
    expect(res.status).toBe(403);
  });

  it("rejects an unknown assignee and an off-board stage", async () => {
    const bad = await call("PUT", `/financials/accounts/${ACCOUNT}/assign`, {
      token: adminToken,
      body: { assignedTo: "no-such-user" },
    });
    expect(bad.status).toBe(400);
    const stage = await call("PUT", `/financials/accounts/${ACCOUNT}/status`, {
      token: adminToken,
      body: { status: "done" },
    });
    expect(stage.status).toBe(400);
  });

  it("opens the account to its assignee once an admin hands it over", async () => {
    const token = await grantPastDue();
    const assign = await call("PUT", `/financials/accounts/${ACCOUNT}/assign`, {
      token: adminToken,
      body: { assignedTo: plainId },
    });
    expect(assign.status).toBe(200);
    expect((assign.json?.case as { assignedTo: string }).assignedTo).toBe(plainId);

    // Now theirs to work: read, move, note.
    expect((await call("GET", `/financials/accounts/${ACCOUNT}`, { token })).status).toBe(200);
    const moved = await call("PUT", `/financials/accounts/${ACCOUNT}/status`, {
      token,
      body: { status: "promised" },
    });
    expect(moved.status).toBe(200);
    expect((moved.json?.case as { status: string }).status).toBe("promised");
    const note = await call("POST", "/financials/notes", {
      token,
      body: { accountKey: ACCOUNT, body: "Client says Friday." },
    });
    expect(note.status).toBe(201);
    expect((note.json?.note as { createdByName: string }).createdByName).toBe("other");

    // …but only this account. A different one is still closed to them.
    await call("PUT", `/financials/accounts/${OTHER}/status`, {
      token: adminToken,
      body: { status: "working" },
    });
    expect((await call("GET", `/financials/accounts/${OTHER}`, { token })).status).toBe(403);
  });

  it("says so when the new owner cannot open the report yet", async () => {
    await userStore.setUserPermissions(plainId, []);
    const blind = await call("PUT", `/financials/accounts/${ACCOUNT}/assign`, {
      token: adminToken,
      body: { assignedTo: plainId },
    });
    expect(blind.json?.assigneeCanView).toBe(false);

    await userStore.setUserPermissions(plainId, [{ permissionType: "report", value: "past-due" }]);
    const granted = await call("PUT", `/financials/accounts/${ACCOUNT}/assign`, {
      token: adminToken,
      body: { assignedTo: plainId },
    });
    expect(granted.json?.assigneeCanView).toBe(true);

    // An admin assignee needs no grant at all.
    const toAdmin = await call("PUT", `/financials/accounts/${ACCOUNT}/assign`, {
      token: adminToken,
      body: { assignedTo: adminId },
    });
    expect(toAdmin.json?.assigneeCanView).toBe(true);
  });

  it("lets the assignee sign off the partial-payment review", async () => {
    const token = await grantPastDue();
    await call("PUT", `/financials/accounts/${ACCOUNT}/assign`, {
      token: adminToken,
      body: { assignedTo: plainId },
    });
    const res = await call("PUT", `/financials/accounts/${ACCOUNT}/review`, {
      token,
      body: { cleared: true },
    });
    expect(res.status).toBe(200);
    expect((res.json?.case as { reviewClearedByName: string }).reviewClearedByName).toBe("other");
  });

  it("scopes the breakdown to the assignee's own accounts", async () => {
    const token = await grantPastDue();
    await call("PUT", `/financials/accounts/${ACCOUNT}/assign`, {
      token: adminToken,
      body: { assignedTo: plainId },
    });
    const mine = await call("GET", "/financials/past-due", { token });
    expect(mine.status).toBe(200);
    const accounts = (mine.json?.breakdown as { accounts: Array<{ accountKey: string }> }).accounts;
    // No invoice snapshot exists in this suite, so the scoped list is empty —
    // the point is that it never leaks the company-wide roster or the
    // assignment picker.
    expect(accounts.every((a) => a.accountKey === ACCOUNT)).toBe(true);
    expect(mine.json?.canAssign).toBe(false);
    expect(mine.json?.assignees).toEqual([]);

    const admin = await call("GET", "/financials/past-due", { token: adminToken });
    expect(admin.json?.canAssign).toBe(true);
    expect((admin.json?.assignees as unknown[]).length).toBeGreaterThan(0);
  });

  it("lets the author delete their own note but not someone else's", async () => {
    const token = await grantPastDue();
    await call("PUT", `/financials/accounts/${ACCOUNT}/assign`, {
      token: adminToken,
      body: { assignedTo: plainId },
    });
    const mine = await call("POST", "/financials/notes", {
      token,
      body: { accountKey: ACCOUNT, body: "mine to delete" },
    });
    const theirs = await call("POST", "/financials/notes", {
      token: adminToken,
      body: { accountKey: ACCOUNT, body: "the admin's note" },
    });
    const mineId = (mine.json?.note as { id: string }).id;
    const theirsId = (theirs.json?.note as { id: string }).id;

    expect((await call("DELETE", `/financials/notes/${theirsId}`, { token })).status).toBe(403);
    expect((await call("DELETE", `/financials/notes/${mineId}`, { token })).status).toBe(200);
    // The admin can still clear anyone's.
    expect(
      (await call("DELETE", `/financials/notes/${theirsId}`, { token: adminToken })).status,
    ).toBe(200);
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

describe("task comments + activity — scoped to the task", () => {
  // Portal sections are deny-by-default, so the two non-admin accounts need the
  // projects grant before they can hold a task at all. Last describe in the
  // file, so widening them here does not leak into other cases.
  beforeAll(async () => {
    for (const id of [userId, plainId]) {
      await userStore.setUserPermissions(id, [{ permissionType: "feature", value: "projects" }]);
    }
  });

  async function taskOwnedBy(token: string, over: Record<string, unknown> = {}) {
    const r = await call("POST", "/tasks", { token, body: { title: "Shoot 42", ...over } });
    return (r.json?.task as { id: string }).id;
  }

  it("opens the history with who created the task", async () => {
    const id = await taskOwnedBy(adminToken);
    const r = await call("GET", `/tasks/${id}/events`, { token: adminToken });
    expect(r.status).toBe(200);
    const events = r.json?.events as Array<Record<string, unknown>>;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "activity", field: "created", authorName: "desk" });
  });

  it("records only what actually changed on an update", async () => {
    const id = await taskOwnedBy(adminToken);
    // Re-sends the same title plus a real status change: one line, not two.
    await call("PUT", `/tasks/${id}`, {
      token: adminToken,
      body: { title: "Shoot 42", status: "review" },
    });
    const r = await call("GET", `/tasks/${id}/events`, { token: adminToken });
    const activity = (r.json?.events as Array<Record<string, unknown>>).filter(
      (e) => e.kind === "activity" && e.field !== "created",
    );
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({ field: "status", from: "todo", to: "review" });
  });

  it("logs nothing for a drag that only moves position", async () => {
    const id = await taskOwnedBy(adminToken);
    await call("PUT", `/tasks/${id}`, { token: adminToken, body: { position: 7 } });
    const r = await call("GET", `/tasks/${id}/events`, { token: adminToken });
    const events = r.json?.events as Array<Record<string, unknown>>;
    expect(events.filter((e) => e.field !== "created")).toHaveLength(0);
  });

  it("resolves @mentions against real accounts only", async () => {
    const id = await taskOwnedBy(adminToken);
    const r = await call("POST", `/tasks/${id}/events`, {
      token: adminToken,
      body: { body: "@viewer and @nobody please look" },
    });
    expect(r.status).toBe(201);
    expect((r.json?.event as { mentions: string[] }).mentions).toEqual([userId]);
  });

  it("rejects an empty comment", async () => {
    const id = await taskOwnedBy(adminToken);
    const r = await call("POST", `/tasks/${id}/events`, {
      token: adminToken,
      body: { body: "  " },
    });
    expect(r.status).toBe(400);
  });

  it("404s for a task that does not exist", async () => {
    const r = await call("GET", "/tasks/no-such-task/events", { token: adminToken });
    expect(r.status).toBe(404);
  });

  it("keeps a stranger out of someone else's task thread", async () => {
    // Owned by `viewer`, with `other` neither assigned nor a project member.
    const id = await taskOwnedBy(userToken);
    expect((await call("GET", `/tasks/${id}/events`, { token: userToken })).status).toBe(200);
    const denied = await call("GET", `/tasks/${id}/events`, { token: await tokenFor(plainId) });
    expect(denied.status).toBe(403);
    const posted = await call("POST", `/tasks/${id}/events`, {
      token: await tokenFor(plainId),
      body: { body: "sneaking in" },
    });
    expect(posted.status).toBe(403);
  });

  it("lets the author edit and delete their own comment", async () => {
    const id = await taskOwnedBy(userToken);
    const created = await call("POST", `/tasks/${id}/events`, {
      token: userToken,
      body: { body: "first pass" },
    });
    const eventId = (created.json?.event as { id: string }).id;
    const edited = await call("PUT", `/tasks/${id}/events/${eventId}`, {
      token: userToken,
      body: { body: "second pass" },
    });
    expect(edited.status).toBe(200);
    expect(edited.json?.event).toMatchObject({ body: "second pass" });
    expect((edited.json?.event as { editedAt: number }).editedAt).toBeGreaterThan(0);
    const gone = await call("DELETE", `/tasks/${id}/events/${eventId}`, { token: userToken });
    expect(gone.status).toBe(200);
  });

  it("stops one user rewriting another's comment, but lets an admin remove it", async () => {
    const id = await taskOwnedBy(adminToken);
    const created = await call("POST", `/tasks/${id}/events`, {
      token: adminToken,
      body: { body: "desk wrote this" },
    });
    const eventId = (created.json?.event as { id: string }).id;
    // `viewer` cannot even reach this task, so scope denies before ownership.
    expect(
      (
        await call("PUT", `/tasks/${id}/events/${eventId}`, {
          token: userToken,
          body: { body: "x" },
        })
      ).status,
    ).toBe(403);
    // superadmin can clear it even though they did not write it.
    expect(
      (await call("DELETE", `/tasks/${id}/events/${eventId}`, { token: superToken })).status,
    ).toBe(200);
  });

  it("refuses to edit an activity row", async () => {
    const id = await taskOwnedBy(adminToken);
    const events = (await call("GET", `/tasks/${id}/events`, { token: adminToken })).json
      ?.events as Array<{ id: string }>;
    const r = await call("PUT", `/tasks/${id}/events/${events[0]!.id}`, {
      token: adminToken,
      body: { body: "rewriting history" },
    });
    expect(r.status).toBe(400);
  });

  it("counts comments on the task list", async () => {
    const id = await taskOwnedBy(adminToken, { title: "Counted" });
    await call("POST", `/tasks/${id}/events`, { token: adminToken, body: { body: "one" } });
    await call("POST", `/tasks/${id}/events`, { token: adminToken, body: { body: "two" } });
    const list = await call("GET", "/tasks", { token: adminToken });
    const task = (list.json?.tasks as Array<Record<string, unknown>>).find((t) => t.id === id);
    expect(task?.commentCount).toBe(2);
  });
});

describe("board columns — readable by members, writable by admins", () => {
  async function resetGlobal() {
    await call("PUT", "/task-statuses", {
      token: superToken,
      body: {
        statuses: [
          { key: "todo", label: "Todo" },
          { key: "in_progress", label: "In Progress" },
          { key: "review", label: "Review" },
          { key: "done", label: "Done", isDone: true },
        ],
      },
    });
  }

  it("serves the global set by default", async () => {
    await resetGlobal();
    const r = await call("GET", "/task-statuses", { token: adminToken });
    expect(r.status).toBe(200);
    expect((r.json?.statuses as Array<{ key: string }>).map((s) => s.key)).toEqual([
      "todo",
      "in_progress",
      "review",
      "done",
    ]);
  });

  it("refuses a non-admin rewriting the columns", async () => {
    const r = await call("PUT", "/task-statuses", {
      token: userToken,
      body: { statuses: [{ key: "a", label: "A" }] },
    });
    expect(r.status).toBe(403);
  });

  it("gives a project its own columns and leaves the global set alone", async () => {
    await resetGlobal();
    const proj = await call("POST", "/projects", {
      token: adminToken,
      body: { title: "Shoots" },
    });
    const projectId = (proj.json?.project as { id: string }).id;
    const put = await call("PUT", `/task-statuses?projectId=${projectId}`, {
      token: adminToken,
      body: {
        statuses: [
          { key: "booked", label: "Booked", color: "#c0000a" },
          { key: "delivered", label: "Delivered", isDone: true },
        ],
      },
    });
    expect(put.status).toBe(200);
    expect((put.json?.statuses as Array<{ key: string }>).map((s) => s.key)).toEqual([
      "booked",
      "delivered",
    ]);
    const global = await call("GET", "/task-statuses", { token: adminToken });
    expect((global.json?.statuses as Array<{ key: string }>).map((s) => s.key)).toContain("todo");
  });

  it("accepts a task on a custom column the old constraint would have rejected", async () => {
    const proj = await call("POST", "/projects", { token: adminToken, body: { title: "Custom" } });
    const projectId = (proj.json?.project as { id: string }).id;
    await call("PUT", `/task-statuses?projectId=${projectId}`, {
      token: adminToken,
      body: {
        statuses: [
          { key: "booked", label: "Booked" },
          { key: "delivered", label: "Delivered", isDone: true },
        ],
      },
    });
    const created = await call("POST", "/tasks", {
      token: adminToken,
      body: { title: "Shoot 12 Oak", projectId, status: "delivered" },
    });
    expect(created.status).toBe(201);
    expect((created.json?.task as { status: string }).status).toBe("delivered");
  });

  it("opens a new task in the board's first column, not a hardcoded one", async () => {
    const proj = await call("POST", "/projects", { token: adminToken, body: { title: "First" } });
    const projectId = (proj.json?.project as { id: string }).id;
    await call("PUT", `/task-statuses?projectId=${projectId}`, {
      token: adminToken,
      body: {
        statuses: [
          { key: "intake", label: "Intake" },
          { key: "shipped", label: "Shipped", isDone: true },
        ],
      },
    });
    const created = await call("POST", "/tasks", {
      token: adminToken,
      body: { title: "No status given", projectId },
    });
    expect((created.json?.task as { status: string }).status).toBe("intake");
  });

  it("ignores a status that is not on the destination board", async () => {
    const proj = await call("POST", "/projects", { token: adminToken, body: { title: "Strict" } });
    const projectId = (proj.json?.project as { id: string }).id;
    await call("PUT", `/task-statuses?projectId=${projectId}`, {
      token: adminToken,
      body: [{ key: "only", label: "Only" }].length
        ? { statuses: [{ key: "only", label: "Only", isDone: true }] }
        : {},
    });
    const created = await call("POST", "/tasks", {
      token: adminToken,
      body: { title: "T", projectId, status: "review" },
    });
    expect((created.json?.task as { status: string }).status).toBe("only");
  });

  it("remaps stranded tasks and reports how many moved", async () => {
    const proj = await call("POST", "/projects", { token: adminToken, body: { title: "Remap" } });
    const projectId = (proj.json?.project as { id: string }).id;
    const t = await call("POST", "/tasks", {
      token: adminToken,
      body: { title: "Stranded", projectId, status: "review" },
    });
    const taskId = (t.json?.task as { id: string }).id;
    const put = await call("PUT", `/task-statuses?projectId=${projectId}`, {
      token: adminToken,
      body: {
        statuses: [
          { key: "todo", label: "Todo" },
          { key: "done", label: "Done", isDone: true },
        ],
      },
    });
    expect(put.json?.remapped).toBe(1);
    const list = await call("GET", "/tasks", { token: adminToken });
    const moved = (list.json?.tasks as Array<Record<string, unknown>>).find((x) => x.id === taskId);
    expect(moved?.status).toBe("todo");
  });

  it("resets a project back to the global set", async () => {
    await resetGlobal();
    const proj = await call("POST", "/projects", { token: adminToken, body: { title: "Reset" } });
    const projectId = (proj.json?.project as { id: string }).id;
    await call("PUT", `/task-statuses?projectId=${projectId}`, {
      token: adminToken,
      body: { statuses: [{ key: "solo", label: "Solo", isDone: true }] },
    });
    expect(
      (await call("GET", `/task-statuses?projectId=${projectId}`, { token: adminToken })).json
        ?.custom,
    ).toBe(true);
    const del = await call("DELETE", `/task-statuses?projectId=${projectId}`, {
      token: adminToken,
    });
    expect(del.status).toBe(200);
    const after = await call("GET", `/task-statuses?projectId=${projectId}`, { token: adminToken });
    expect(after.json?.custom).toBe(false);
    expect((after.json?.statuses as Array<{ key: string }>).map((s) => s.key)).toContain("todo");
  });

  it("rejects an empty column set", async () => {
    const r = await call("PUT", "/task-statuses", { token: adminToken, body: { statuses: [] } });
    expect(r.status).toBe(400);
    await resetGlobal();
  });

  it("404s for a project that does not exist", async () => {
    const r = await call("PUT", "/task-statuses?projectId=nope", {
      token: adminToken,
      body: { statuses: [{ key: "a", label: "A" }] },
    });
    expect(r.status).toBe(404);
  });

  it("serves every board in one call so a mixed view paints once", async () => {
    await resetGlobal();
    const a = await call("POST", "/projects", { token: adminToken, body: { title: "Plain" } });
    const b = await call("POST", "/projects", { token: adminToken, body: { title: "Shoots" } });
    const plainId = (a.json?.project as { id: string }).id;
    const shootsId = (b.json?.project as { id: string }).id;
    await call("PUT", `/task-statuses?projectId=${shootsId}`, {
      token: adminToken,
      body: {
        statuses: [
          { key: "booked", label: "Booked" },
          { key: "delivered", label: "Delivered", isDone: true },
        ],
      },
    });

    const r = await call("GET", `/task-statuses/sets?projectIds=${plainId},${shootsId}`, {
      token: adminToken,
    });
    expect(r.status).toBe(200);
    const sets = r.json?.sets as Record<string, Array<{ key: string }>>;
    const custom = r.json?.custom as Record<string, boolean>;
    expect(sets[""].map((s) => s.key)).toEqual(["todo", "in_progress", "review", "done"]);
    // A project with no columns of its own reports the global set, not custom.
    expect(sets[plainId].map((s) => s.key)).toEqual(["todo", "in_progress", "review", "done"]);
    expect(custom[plainId]).toBe(false);
    expect(sets[shootsId].map((s) => s.key)).toEqual(["booked", "delivered"]);
    expect(custom[shootsId]).toBe(true);
  });

  it("drops boards the caller cannot see rather than failing the whole view", async () => {
    await resetGlobal();
    const hidden = await call("POST", "/projects", {
      token: adminToken,
      body: { title: "Secret" },
    });
    const hiddenId = (hidden.json?.project as { id: string }).id;
    const r = await call("GET", `/task-statuses/sets?projectIds=${hiddenId}`, { token: userToken });
    expect(r.status).toBe(200);
    const sets = r.json?.sets as Record<string, unknown>;
    // The global set still comes back, so the member's board renders.
    expect(sets[""]).toBeTruthy();
    expect(sets[hiddenId]).toBeUndefined();
  });
});

describe("outreach scripts — read by the queue, written by admins", () => {
  it("lets an admin write a script and hands it back on the list", async () => {
    const created = await call("POST", "/financials/templates", {
      token: adminToken,
      body: { title: "First reminder", kind: "call", body: "Hi {{account}}, {{balance}} is due." },
    });
    expect(created.status).toBe(201);
    const list = await call("GET", "/financials/templates", { token: adminToken });
    expect(list.status).toBe(200);
    const titles = (list.json?.templates as Array<{ title: string }>).map((t) => t.title);
    expect(titles).toContain("First reminder");
    expect(list.json?.canEdit).toBe(true);
  });

  it("refuses a script write from someone who only works the queue", async () => {
    // Wording is collections policy: a collector uses scripts, they do not edit them.
    await userStore.setUserPermissions(userId, [{ permissionType: "report", value: "past-due" }]);
    const r = await call("POST", "/financials/templates", {
      token: userToken,
      body: { title: "Rogue", kind: "call", body: "..." },
    });
    expect(r.status).toBe(403);
  });

  it("still lets that person read the scripts they have to use", async () => {
    await userStore.setUserPermissions(userId, [{ permissionType: "report", value: "past-due" }]);
    const r = await call("GET", "/financials/templates", { token: userToken });
    expect(r.status).toBe(200);
    expect(r.json?.canEdit).toBe(false);
  });

  it("denies the scripts entirely to someone without the report", async () => {
    await userStore.setUserPermissions(userId, []);
    const r = await call("GET", "/financials/templates", { token: userToken });
    expect(r.status).toBe(403);
  });

  it("rejects a channel it does not know rather than storing it", async () => {
    const r = await call("POST", "/financials/templates", {
      token: adminToken,
      body: { title: "Bad", kind: "smoke_signal", body: "..." },
    });
    expect(r.status).toBe(400);
  });

  it("404s when rendering a script that does not exist", async () => {
    const r = await call("GET", "/financials/accounts/agent:nobody/script?templateId=missing", {
      token: adminToken,
    });
    expect(r.status).toBe(404);
  });

  it("asks for a templateId rather than guessing one", async () => {
    const r = await call("GET", "/financials/accounts/agent:nobody/script", { token: adminToken });
    expect(r.status).toBe(400);
  });
});

describe("past-due contact log", () => {
  it("records a contact and lists it back", async () => {
    const posted = await call("POST", "/financials/accounts/agent:abc/contacts", {
      token: adminToken,
      body: { channel: "call", note: "Left a voicemail" },
    });
    expect(posted.status).toBe(201);
    const list = await call("GET", "/financials/accounts/agent:abc/contacts", {
      token: adminToken,
    });
    expect(list.status).toBe(200);
    expect((list.json?.contacts as unknown[]).length).toBe(1);
  });

  it("rejects a channel it does not know", async () => {
    const r = await call("POST", "/financials/accounts/agent:abc/contacts", {
      token: adminToken,
      body: { channel: "carrier_pigeon" },
    });
    expect(r.status).toBe(400);
  });

  it("denies the log to someone the account is not assigned to", async () => {
    await userStore.setUserPermissions(userId, [{ permissionType: "report", value: "past-due" }]);
    const r = await call("GET", "/financials/accounts/agent:abc/contacts", { token: userToken });
    expect(r.status).toBe(403);
  });

  it("reports the CRM directory as unconfigured rather than failing", async () => {
    const r = await call("GET", "/financials/pipedrive/status", { token: adminToken });
    expect(r.status).toBe(200);
    expect(r.json?.configured).toBe(false);
  });

  it("keeps the CRM sweep to admins", async () => {
    await userStore.setUserPermissions(userId, [{ permissionType: "report", value: "past-due" }]);
    const r = await call("POST", "/financials/pipedrive/refresh", { token: userToken });
    expect(r.status).toBe(403);
  });
});
