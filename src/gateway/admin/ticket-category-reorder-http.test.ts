import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// PUT /tickets/categories/reorder sits in front of the /tickets/categories/:key
// route, which matches any single segment and would happily take "reorder" as a
// category key — renaming a request type to "reorder" or 404ing, depending on
// order. These cases pin that the dedicated route wins.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-cat-reorder-http-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleAdminHttpRequest } = await import("./admin-http.js");
const userStore = await import("./user-store.js");
const cats = await import("./ticket-category-store.js");

let server: Server;
let base: string;
let adminToken: string;

async function call(
  method: string,
  p: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`${base}/api/admin${p}`, {
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

/** The key order as the dashboard would read it back. */
async function orderViaApi(): Promise<string[]> {
  const res = await call("GET", "/tickets/categories", { token: adminToken });
  const categories = (res.json?.categories ?? []) as { key: string }[];
  return categories.map((c) => c.key);
}

const SEEDED = ["edit_request", "additional_service", "missing_media", "other"];

beforeAll(async () => {
  const admin = await userStore.createUser({ username: "desk", password: "pw", role: "admin" });
  adminToken = (await userStore.createSession(admin.id)).token;
  await cats.ensureCategorySeed();

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

describe("PUT /tickets/categories/reorder", () => {
  it("reorders instead of being captured by the :key route", async () => {
    const wanted = ["other", "edit_request", "missing_media", "additional_service"];
    const res = await call("PUT", "/tickets/categories/reorder", {
      token: adminToken,
      body: { keys: wanted },
    });

    expect(res.status).toBe(200);
    expect((res.json?.categories as { key: string }[]).map((c) => c.key)).toEqual(wanted);
    expect(await orderViaApi()).toEqual(wanted);

    // The :key route would have tried to edit a category named "reorder".
    expect(await cats.getCategory("reorder")).toBeNull();
  });

  it("rejects a body that is not a list of keys", async () => {
    const before = await orderViaApi();
    for (const body of [{}, { keys: "edit_request" }, { keys: [1, 2] }]) {
      const res = await call("PUT", "/tickets/categories/reorder", { token: adminToken, body });
      expect(res.status).toBe(400);
    }
    expect(await orderViaApi()).toEqual(before);
  });

  it("requires authentication", async () => {
    const before = await orderViaApi();
    const res = await call("PUT", "/tickets/categories/reorder", {
      body: { keys: SEEDED.toReversed() },
    });

    expect(res.status).toBe(401);
    expect(await orderViaApi()).toEqual(before);
  });

  it("still routes a real key to the edit route", async () => {
    const res = await call("PUT", "/tickets/categories/other", {
      token: adminToken,
      body: { label: "Something else" },
    });
    expect(res.status).toBe(200);
    expect((res.json?.category as { label: string }).label).toBe("Something else");
  });
});
