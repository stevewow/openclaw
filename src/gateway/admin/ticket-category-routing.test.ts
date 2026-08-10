import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// A request type used to be creatable with no department. It then fell through
// to "general" at intake — a desk nobody chose, reached by forgetting a field on
// a second page. Routing now belongs to the request type and is required, so the
// API must refuse a type that names no desk (or names one that does not exist)
// rather than quietly picking one.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-routing-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleAdminHttpRequest } = await import("./admin-http.js");
const userStore = await import("./user-store.js");
const dept = await import("./ticket-department-store.js");

let server: Server;
let base: string;
let token: string;

async function call(
  method: string,
  apiPath: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`${base}/api/admin${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
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
  const id = (await userStore.createUser({ username: "root", password: "pw", role: "superadmin" }))
    .id;
  token = (await userStore.createSession(id)).token;
  await dept.ensureDepartmentSeed();

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

describe("adding a request type", () => {
  it("refuses one that names no department", async () => {
    const res = await call("POST", "/tickets/categories", { label: "Reshoot the exterior" });
    expect(res.status).toBe(400);
    expect(String(res.json?.error)).toContain("department");
    // The category must not exist: a rejected create leaves nothing behind.
    const cats = await import("./ticket-category-store.js");
    expect(await cats.getCategory("reshoot_the_exterior")).toBeNull();
  });

  it("refuses a department that does not exist", async () => {
    const res = await call("POST", "/tickets/categories", {
      label: "Reshoot the exterior",
      department: "not-a-desk",
    });
    expect(res.status).toBe(400);
    expect(String(res.json?.error)).toContain("not-a-desk");
  });

  it("stores the route when the department is named", async () => {
    const res = await call("POST", "/tickets/categories", {
      label: "Reshoot the exterior",
      department: "operations",
    });
    expect(res.status).toBe(201);
    // Resolution is what intake actually calls — assert the desk, not the row.
    expect(await dept.resolveDepartmentForCategory("reshoot_the_exterior")).toBe("operations");
  });
});

describe("editing a request type", () => {
  it("refuses to repoint it at a department that does not exist", async () => {
    const res = await call("PUT", "/tickets/categories/reshoot_the_exterior", {
      department: "ghost-desk",
    });
    expect(res.status).toBe(400);
    // The existing route survives a rejected edit.
    expect(await dept.resolveDepartmentForCategory("reshoot_the_exterior")).toBe("operations");
  });

  it("repoints it at a real department", async () => {
    const res = await call("PUT", "/tickets/categories/reshoot_the_exterior", {
      department: "editing",
    });
    expect(res.status).toBe(200);
    expect(await dept.resolveDepartmentForCategory("reshoot_the_exterior")).toBe("editing");
  });
});
