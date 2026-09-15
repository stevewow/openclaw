import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-sales-http-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleAdminHttpRequest } = await import("./admin-http.js");
const userStore = await import("./user-store.js");

/**
 * The sales dashboard through the real admin router: the grant opens the page,
 * goals and holidays stay an admin's, and what an admin saves is what the page
 * then counts against.
 */

let server: Server;
let base: string;
let superToken: string;
let grantedToken: string;
let plainToken: string;

async function call(
  method: string,
  route: string,
  opts: { token: string; body?: unknown },
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${base}/api/admin${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${opts.token}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // not JSON
  }
  return { status: res.status, json };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    void handleAdminHttpRequest(req, res).then((handled) => {
      if (!handled) {
        res.statusCode = 404;
        res.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  const superId = (
    await userStore.createUser({ username: "root", password: "pw", role: "superadmin" })
  ).id;
  const grantedId = (await userStore.createUser({ username: "bds", password: "pw", role: "user" }))
    .id;
  const plainId = (await userStore.createUser({ username: "va", password: "pw", role: "user" })).id;
  superToken = (await userStore.createSession(superId)).token;
  grantedToken = (await userStore.createSession(grantedId)).token;
  plainToken = (await userStore.createSession(plainId)).token;
  const grant = await call("PUT", `/users/${grantedId}/permissions`, {
    token: superToken,
    body: { permissions: [{ permissionType: "feature", value: "sales-dashboard" }] },
  });
  expect(grant.status).toBe(200);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.OPENCLAW_STATE_DIR;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

type MonthTotal = { goal: { units: number; revenueCents: number; unitsPerDay: number | null } };

describe("sales dashboard routes", () => {
  it("opens only with the grant, and says who may edit", async () => {
    expect((await call("GET", "/sales-dashboard", { token: plainToken })).status).toBe(403);
    expect(
      (await call("GET", "/sales-dashboard/goals?year=2026", { token: plainToken })).status,
    ).toBe(403);

    const granted = await call("GET", "/sales-dashboard?month=2026-08", { token: grantedToken });
    expect(granted.status).toBe(200);
    expect(granted.json.canEdit).toBe(false);
    expect(granted.json.monthKey).toBe("2026-08");
    expect((granted.json.report as { businessDays: { month: number } }).businessDays.month).toBe(
      21,
    );

    const admin = await call("GET", "/sales-dashboard", { token: superToken });
    expect(admin.status).toBe(200);
    expect(admin.json.canEdit).toBe(true);
  });

  it("refuses a month it cannot read", async () => {
    for (const month of ["2026-13", "August", "2026-8"]) {
      const res = await call("GET", `/sales-dashboard?month=${month}`, { token: superToken });
      expect(res.status).toBe(400);
    }
  });

  it("lets only an admin set goals, and counts against what was saved", async () => {
    const august = {
      year: 2026,
      month: 8,
      goals: [
        { marketLabel: "Charlotte", units: "243", revenue: "$77,928.24", asp: "320.78" },
        { marketLabel: "Findlay", units: 25, revenue: 4952.1, asp: "" },
        // Left blank: no goal.
        { marketLabel: "Lima", units: "", revenue: "", asp: "" },
        // The company goal, whatever label the page sends with it.
        { marketKey: "total", marketLabel: "anything", units: 1500, revenue: "", asp: "" },
      ],
    };
    expect(
      (await call("PUT", "/sales-dashboard/goals", { token: grantedToken, body: august })).status,
    ).toBe(403);

    const saved = await call("PUT", "/sales-dashboard/goals", { token: superToken, body: august });
    expect(saved.status).toBe(200);
    expect(saved.json.goals).toEqual([
      {
        month: 8,
        marketKey: "charlotte",
        marketLabel: "Charlotte",
        units: 243,
        revenueCents: 7792824,
        aspCents: 32078,
      },
      {
        month: 8,
        marketKey: "total",
        marketLabel: "Company total",
        units: 1500,
        revenueCents: 0,
        aspCents: null,
      },
      {
        month: 8,
        marketKey: "findlay",
        marketLabel: "Findlay",
        units: 25,
        revenueCents: 495210,
        aspCents: null,
      },
    ]);

    const listed = await call("GET", "/sales-dashboard/goals?year=2026", { token: grantedToken });
    expect(listed.status).toBe(200);
    expect(listed.json.markets).toEqual([
      { key: "charlotte", label: "Charlotte" },
      { key: "findlay", label: "Findlay" },
    ]);

    const page = await call("GET", "/sales-dashboard?month=2026-08", { token: grantedToken });
    const total = (page.json.report as { mtd: { total: MonthTotal } }).mtd.total;
    // Units from the company goal; revenue, left blank there, from the markets.
    expect(total.goal).toMatchObject({ units: 1500, revenueCents: 8288034, unitsPerDay: 72 });

    for (const bad of [
      { marketLabel: "Lima", units: 2.5 },
      { marketLabel: "Lima", units: -1 },
      { marketLabel: "", units: 3 },
      { marketLabel: "Unassigned", units: 3 },
    ]) {
      const res = await call("PUT", "/sales-dashboard/goals", {
        token: superToken,
        body: { year: 2026, month: 8, goals: [bad] },
      });
      expect(res.status).toBe(400);
    }
    const twice = await call("PUT", "/sales-dashboard/goals", {
      token: superToken,
      body: {
        year: 2026,
        month: 8,
        goals: [
          { marketLabel: "Lima", units: 1 },
          { marketLabel: "lima", units: 2 },
        ],
      },
    });
    expect(twice.status).toBe(400);

    // Saving a month replaces it whole.
    const replaced = await call("PUT", "/sales-dashboard/goals", {
      token: superToken,
      body: { year: 2026, month: 8, goals: [{ marketLabel: "Lima", units: 128 }] },
    });
    expect((replaced.json.goals as Array<{ marketKey: string }>).map((g) => g.marketKey)).toEqual([
      "lima",
    ]);
  });

  it("keeps the holiday list an admin's, and takes holidays out of business days", async () => {
    const thanksgiving = { day: "2026-11-26", label: "Thanksgiving" };
    expect(
      (await call("POST", "/sales-dashboard/holidays", { token: grantedToken, body: thanksgiving }))
        .status,
    ).toBe(403);
    expect(
      (
        await call("POST", "/sales-dashboard/holidays", {
          token: superToken,
          body: { day: "2026-02-30", label: "Not a day" },
        })
      ).status,
    ).toBe(400);
    const added = await call("POST", "/sales-dashboard/holidays", {
      token: superToken,
      body: thanksgiving,
    });
    expect(added.status).toBe(201);

    const listed = await call("GET", "/sales-dashboard/holidays", { token: grantedToken });
    expect(listed.json.holidays).toEqual([thanksgiving]);
    const november = await call("GET", "/sales-dashboard?month=2026-11", { token: grantedToken });
    // 21 weekdays in November 2026, less Thanksgiving.
    expect((november.json.report as { businessDays: { month: number } }).businessDays.month).toBe(
      20,
    );

    expect(
      (await call("DELETE", "/sales-dashboard/holidays/2026-11-26", { token: grantedToken }))
        .status,
    ).toBe(403);
    expect(
      (await call("DELETE", "/sales-dashboard/holidays/2026-11-26", { token: superToken })).status,
    ).toBe(200);
    expect(
      (await call("DELETE", "/sales-dashboard/holidays/2026-11-26", { token: superToken })).status,
    ).toBe(404);
  });
});
