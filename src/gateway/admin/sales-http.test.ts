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
 * The sales dashboard through the real admin router: the grant opens the page;
 * markets, goals, new listings and holidays stay an admin's; and what an admin
 * saves is what the page then counts against.
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

type Share = { listings: number | null; pct: number | null };
type Row = {
  key: string;
  label: string;
  actual: { units: number; revenueCents: number };
  share: Share;
};
type Report = {
  businessDays: { month: number };
  mtd: {
    rows: Row[];
    total: Row & { goal: { units: number; revenueCents: number; unitsPerDay: number | null } };
  };
  ytd: { rows: Array<Row & { share: Share & { units: number } }>; total: Row };
};
type Comparison = {
  throughDay: string;
  complete: boolean;
  mtd: { rows: Row[]; total: Row };
  ytd: { rows: Row[]; total: Row };
};

async function dashboard(month: string): Promise<{
  report: Report;
  markets: unknown[];
  compare: { mom: Comparison | null; yoy: Comparison | null };
}> {
  const res = await call("GET", `/sales-dashboard?month=${month}`, { token: grantedToken });
  expect(res.status).toBe(200);
  return res.json as never;
}

describe("sales dashboard routes", () => {
  it("opens only with the grant, and says who may edit", async () => {
    expect((await call("GET", "/sales-dashboard", { token: plainToken })).status).toBe(403);
    expect(
      (await call("GET", "/sales-dashboard/goals?year=2026", { token: plainToken })).status,
    ).toBe(403);
    expect((await call("GET", "/sales-dashboard/markets", { token: plainToken })).status).toBe(403);

    const granted = await call("GET", "/sales-dashboard?month=2026-08", { token: grantedToken });
    expect(granted.status).toBe(200);
    expect(granted.json.canEdit).toBe(false);
    expect(granted.json.monthKey).toBe("2026-08");
    expect((granted.json.report as Report).businessDays.month).toBe(21);
    expect(granted.json.markets).toEqual([]);
    // Nothing read from Spiro yet: nothing to compare with.
    expect(granted.json.compare).toEqual({ mom: null, yoy: null });

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

  it("keeps one market list, which only an admin changes", async () => {
    expect(
      (
        await call("POST", "/sales-dashboard/markets", {
          token: grantedToken,
          body: { label: "Charlotte" },
        })
      ).status,
    ).toBe(403);
    for (const label of ["Charlotte", "Findlay", "Lima"]) {
      const added = await call("POST", "/sales-dashboard/markets", {
        token: superToken,
        body: { label },
      });
      expect(added.status).toBe(201);
    }
    for (const label of ["Fort Wayne, Indiana", "Other", "Unassigned", "total", ""]) {
      const res = await call("POST", "/sales-dashboard/markets", {
        token: superToken,
        body: { label },
      });
      expect(res.status).toBe(400);
    }

    const listed = await call("GET", "/sales-dashboard/markets", { token: grantedToken });
    expect(listed.status).toBe(200);
    expect(listed.json.markets).toEqual([
      { key: "charlotte", label: "Charlotte", removedFrom: null },
      { key: "findlay", label: "Findlay", removedFrom: null },
      { key: "lima", label: "Lima", removedFrom: null },
    ]);
    expect(listed.json.suggestions).toEqual([]);

    // The same markets in every month, with nothing entered for any of them.
    for (const month of ["2025-03", "2026-08", "2026-12"]) {
      const { report } = await dashboard(month);
      expect(report.mtd.rows.map((r) => r.label)).toEqual(["Charlotte", "Findlay", "Lima"]);
    }
  });

  it("lets only an admin set goals, for markets on the list", async () => {
    const august = {
      year: 2026,
      month: 8,
      goals: [
        { marketLabel: "Charlotte", units: "243", revenue: "$77,928.24", asp: "320.78" },
        { marketKey: "findlay", units: 25, revenue: 4952.1, asp: "" },
        // Left blank: no goal.
        { marketKey: "lima", units: "", revenue: "", asp: "" },
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

    const { report } = await dashboard("2026-08");
    // Units from the company goal; revenue, left blank there, from the markets.
    expect(report.mtd.total.goal).toMatchObject({
      units: 1500,
      revenueCents: 8288034,
      unitsPerDay: 72,
    });

    for (const bad of [
      { marketLabel: "Lima", units: 2.5 },
      { marketLabel: "Lima", units: -1 },
      { marketLabel: "", units: 3 },
      { marketLabel: "Unassigned", units: 3 },
      // Not on the market list.
      { marketLabel: "Toledo", units: 3 },
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
          { marketKey: "lima", units: 2 },
        ],
      },
    });
    expect(twice.status).toBe(400);

    // Saving some markets leaves the others' goals as they were.
    const partial = await call("PUT", "/sales-dashboard/goals", {
      token: superToken,
      body: { year: 2026, month: 8, goals: [{ marketKey: "lima", units: 128 }] },
    });
    expect((partial.json.goals as Array<{ marketKey: string }>).map((g) => g.marketKey)).toEqual([
      "charlotte",
      "total",
      "findlay",
      "lima",
    ]);
  });

  it("stops a market from a month on, and keeps the months before", async () => {
    const stop = { removedFrom: "2026-09" };
    expect(
      (await call("PATCH", "/sales-dashboard/markets/findlay", { token: grantedToken, body: stop }))
        .status,
    ).toBe(403);
    expect(
      (
        await call("PATCH", "/sales-dashboard/markets/findlay", {
          token: superToken,
          body: { removedFrom: "September" },
        })
      ).status,
    ).toBe(400);
    expect(
      (await call("PATCH", "/sales-dashboard/markets/toledo", { token: superToken, body: stop }))
        .status,
    ).toBe(404);
    const stopped = await call("PATCH", "/sales-dashboard/markets/findlay", {
      token: superToken,
      body: stop,
    });
    expect(stopped.status).toBe(200);
    expect(stopped.json.market).toEqual({
      key: "findlay",
      label: "Findlay",
      removedFrom: "2026-09",
    });

    expect((await dashboard("2026-08")).report.mtd.rows.map((r) => r.label)).toEqual([
      "Charlotte",
      "Findlay",
      "Lima",
    ]);
    expect((await dashboard("2026-11")).report.mtd.rows.map((r) => r.label)).toEqual([
      "Charlotte",
      "Lima",
    ]);
    const september = await call("PUT", "/sales-dashboard/goals", {
      token: superToken,
      body: { year: 2026, month: 9, goals: [{ marketKey: "findlay", units: 25 }] },
    });
    expect(september.status).toBe(400);
    const goals = await call("GET", "/sales-dashboard/goals?year=2026", { token: grantedToken });
    expect((goals.json.goals as Array<{ marketKey: string }>).map((g) => g.marketKey)).toContain(
      "findlay",
    );

    // Adding it again tracks it in every month again.
    const back = await call("POST", "/sales-dashboard/markets", {
      token: superToken,
      body: { label: "Findlay" },
    });
    expect(back.json.market).toEqual({ key: "findlay", label: "Findlay", removedFrom: null });
    expect((await dashboard("2026-11")).report.mtd.rows).toHaveLength(3);
  });

  it("keeps new listings an admin's, and turns them into market share and comparisons", async () => {
    const db = userStore.getAdminDb();
    const now = Date.now();
    const synced = {
      history_floor: "2025-01-01",
      covered_from: "2025-01-01",
      covered_to: "2026-09-14",
      year_read_at: now,
      refreshed_at: now,
      attempted_at: now,
      orders_read: 0,
      error: null,
    };
    await db
      .insertInto("admin_sales_sync")
      .values([
        { id: "orders", ...synced },
        { id: "appointments", ...synced },
      ])
      .execute();
    await db
      .insertInto("admin_sales_companies")
      .values([
        { company_id: "c-lima", name: "Lima Realty", service_area: "Lima, Ohio", checked_at: now },
        {
          company_id: "c-akron",
          name: "Akron Realty",
          service_area: "Akron, Ohio",
          checked_at: now,
        },
      ])
      .execute();
    const order = (
      id: string,
      day: string,
      company: string,
      cents: number,
      status = "delivered",
    ) => ({
      order_id: id,
      order_day: day,
      agent_id: null,
      agent_name: null,
      company_id: company,
      company_name: null,
      status,
      total_cents: cents,
    });
    await db
      .insertInto("admin_sales_orders")
      .values([
        order("a1", "2026-08-03", "c-lima", 20000),
        order("a2", "2026-08-04", "c-lima", 20000),
        order("a3", "2026-08-05", "c-lima", 20000),
        order("a4", "2026-08-06", "c-lima", 20000),
        order("a5", "2026-08-04", "c-akron", 10000),
        order("j1", "2026-07-02", "c-lima", 20000),
        order("j2", "2026-07-03", "c-lima", 20000),
        order("y1", "2025-08-12", "c-lima", 15000),
        order("y2", "2025-08-13", "c-lima", 15000),
        // Booked for August but not shot: not counted anywhere.
        order("c1", "2026-08-07", "c-lima", 20000, "confirmed"),
        // Placed in July, shot in August after a cancelled first appointment.
        order("x1", "2026-07-30", "c-lima", 20000),
      ])
      .execute();
    await db
      .insertInto("admin_sales_appointments")
      .values([
        {
          appointment_id: "ap-x1-a",
          order_id: "x1",
          arrival_day: "2026-07-31",
          status: "cancelled",
        },
        {
          appointment_id: "ap-x1-b",
          order_id: "x1",
          arrival_day: "2026-08-01",
          status: "completed",
        },
      ])
      .execute();

    const july = ["", "", "", "", "", "", "30", "40", "", "", "", ""];
    const body = { year: 2026, rows: [{ marketKey: "lima", months: july }] };
    expect(
      (await call("PUT", "/sales-dashboard/listings", { token: grantedToken, body })).status,
    ).toBe(403);
    for (const rows of [
      [{ marketKey: "toledo", months: july }],
      [{ marketKey: "lima", months: july.slice(1) }],
      [{ marketKey: "lima", months: ["2.5", ...july.slice(1)] }],
      [{ marketKey: "lima", months: ["-3", ...july.slice(1)] }],
    ]) {
      const res = await call("PUT", "/sales-dashboard/listings", {
        token: superToken,
        body: { year: 2026, rows },
      });
      expect(res.status).toBe(400);
    }
    const saved = await call("PUT", "/sales-dashboard/listings", { token: superToken, body });
    expect(saved.status).toBe(200);
    expect(saved.json.listings).toEqual([
      { month: 7, marketKey: "lima", listings: 30 },
      { month: 8, marketKey: "lima", listings: 40 },
    ]);
    const listed = await call("GET", "/sales-dashboard/listings?year=2026", {
      token: grantedToken,
    });
    expect(listed.json.listings).toEqual(saved.json.listings);

    // Akron is not on the list, so it has a service-area suggestion and counts under Other.
    const markets = await call("GET", "/sales-dashboard/markets", { token: grantedToken });
    expect(markets.json.suggestions).toEqual([{ key: "akron", label: "Akron", orders: 1 }]);

    const { report, compare } = await dashboard("2026-08");
    const lima = report.mtd.rows.find((r) => r.key === "lima");
    // Four shot the day they were placed, plus July's order shot on Aug 1.
    expect(lima?.actual.units).toBe(5);
    expect(lima?.share).toEqual({ listings: 40, pct: 12.5 });
    expect(report.mtd.rows.at(-1)).toMatchObject({ label: "Other markets", actual: { units: 1 } });
    expect(report.mtd.total.actual.units).toBe(6);
    // July and August: 7 units over 70 listings.
    expect(report.ytd.rows.find((r) => r.key === "lima")?.share).toEqual({
      listings: 70,
      units: 7,
      pct: 10,
    });

    // August is finished, so it compares with the whole of July and of August 2025.
    expect(compare.mom?.throughDay).toBe("2026-07-31");
    expect(compare.mom?.complete).toBe(true);
    expect(compare.mom?.mtd.rows.find((r) => r.key === "lima")).toMatchObject({
      actual: { units: 2 },
      share: { listings: 30, pct: 6.67 },
    });
    expect(compare.yoy?.throughDay).toBe("2025-08-31");
    expect(compare.yoy?.mtd.total.actual).toMatchObject({ units: 2, revenueCents: 30000 });
    expect(compare.yoy?.ytd.total.actual.units).toBe(2);

    // January 2025 is the first month kept: no year before it to compare with.
    expect((await dashboard("2025-01")).compare).toMatchObject({ yoy: null });
  });

  it("gives each month's figures for the charts, as the report counts them", async () => {
    expect(
      (await call("GET", "/sales-dashboard/trends?from=2026-07&to=2026-08", { token: plainToken }))
        .status,
    ).toBe(403);
    for (const query of [
      "from=2026-7&to=2026-08",
      "from=2026-09&to=2026-08",
      "from=2020-01&to=2026-08",
    ]) {
      const res = await call("GET", `/sales-dashboard/trends?${query}`, { token: grantedToken });
      expect(res.status).toBe(400);
    }

    const res = await call("GET", "/sales-dashboard/trends?from=2024-06&to=2026-08", {
      token: grantedToken,
    });
    expect(res.status).toBe(200);
    type Point = { key: string; units: number; sharePct: number | null; goalUnits: number | null };
    const trends = res.json as {
      from: string;
      months: Array<{ month: string; partial: boolean; rows: Point[]; total: Point }>;
    };
    // Nothing is kept before the order history's first month, so the range starts there.
    expect(trends.from).toBe("2025-01");
    expect(trends.months).toHaveLength(20);
    const byMonth = new Map(trends.months.map((m) => [m.month, m]));
    const lima = (month: string) => byMonth.get(month)?.rows.find((r) => r.key === "lima");
    // The same numbers the report gives for those months.
    expect(lima("2026-07")).toMatchObject({ units: 2, sharePct: 6.67 });
    expect(lima("2026-08")).toMatchObject({ units: 5, sharePct: 12.5, goalUnits: 128 });
    expect(byMonth.get("2026-08")).toMatchObject({ partial: false, total: { units: 6 } });
    expect(byMonth.get("2025-08")?.total.units).toBe(2);
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
    // 21 weekdays in November 2026, less Thanksgiving.
    expect((await dashboard("2026-11")).report.businessDays.month).toBe(20);

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
