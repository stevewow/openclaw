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
    expect(res.json?.gatewayToken).toBe("GATEWAY-SECRET");
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
