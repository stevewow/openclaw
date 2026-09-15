import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-sales-orders-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const sales = await import("./sales-orders.js");
const dashboard = await import("./sales-dashboard.js");
const salesMarkets = await import("./sales-markets.js");
const { callSpiro } = await import("./sales-spiro.js");
const { getAdminDb } = await import("./user-store.js");

/**
 * The order cache behind the sales dashboard, against a fake Spiro that behaves
 * the way the live one did on 2026-09-15: wide reads time out, the key runs
 * into its rate limit, and a read can die partway. What matters is that every
 * finished week is kept, coverage stays one unbroken span, the next read picks
 * up where the last stopped, and the dashboard counts the result correctly.
 */

afterAll(() => {
  delete process.env.OPENCLAW_STATE_DIR;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

// 14:00 Eastern on Sep 14 2026.
const NOW = Date.parse("2026-09-14T18:00:00Z");
const HOUR = 60 * 60 * 1000;
const CHARLOTTE_CO = "c1-charlotte";
const CLEVELAND_CO = "c2-cleveland";
const noSleep = async () => {};

type Fixture = {
  orderId: string;
  day: string;
  total: number;
  agent: string;
  company: string;
  status?: string;
};

const ORDERS: Fixture[] = [
  { orderId: "o-sep-a", day: "2026-09-10", total: 300, agent: "agent-a", company: CHARLOTTE_CO },
  { orderId: "o-aug-a", day: "2026-08-03", total: 250, agent: "agent-a", company: CHARLOTTE_CO },
  { orderId: "o-sep-b", day: "2026-09-11", total: 180, agent: "agent-b", company: CLEVELAND_CO },
  { orderId: "o-2025-c", day: "2025-03-05", total: 200, agent: "agent-c", company: CHARLOTTE_CO },
  { orderId: "o-jul-c", day: "2026-07-01", total: 150, agent: "agent-c", company: CHARLOTTE_CO },
  {
    orderId: "o-sep-d",
    day: "2026-09-12",
    total: 0,
    agent: "agent-d",
    company: CLEVELAND_CO,
    status: "cancelled",
  },
];

let fixtures: Fixture[] = ORDERS;

/** The MCP envelope around a Spiro reply. */
function envelope(payload: unknown): unknown {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

function fakeSpiro(opts: { failOn?: string; timeoutOn?: string } = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const call = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    calls.push({ name, args });
    if (name === "search_spiro_reporting_orders") {
      const from = String(args.from);
      const to = String(args.to);
      if (opts.failOn && from <= opts.failOn && opts.failOn <= to) {
        throw new Error("boom");
      }
      if (
        opts.timeoutOn &&
        from <= opts.timeoutOn &&
        opts.timeoutOn <= to &&
        args.pageSize === 500
      ) {
        return envelope({
          error: "spiro_public_api_error",
          statusCode: 504,
          body: '{"title":"Gateway Timeout","status":504}',
        });
      }
      // Shaped like a live reporting row.
      const data = fixtures
        .filter((f) => f.day >= from && f.day <= to)
        .map((f) => ({
          orderId: f.orderId,
          orderNumber: "dt3613pg2",
          orderDate: `${f.day}T10:15:26.1476227-04:00`,
          status: f.status ?? "delivered",
          total: f.total,
          agent: { id: f.agent, name: f.agent },
          company: { id: f.company, name: f.company },
          products: [],
        }));
      return envelope({
        data,
        meta: { hasMoreData: false, resultSetAsOf: "2026-09-14T18:00:00Z" },
      });
    }
    if (name === "get_spiro_company") {
      return envelope({
        companyId: args.companyId,
        name: "Cleveland Realty",
        serviceArea: { serviceAreaId: "sa-cle", name: "Cleveland, Ohio" },
      });
    }
    if (name === "summarize_spiro_reporting_orders") {
      return envelope({ data: [], meta: { dataset: "orders" } });
    }
    throw new Error(`unexpected tool ${name}`);
  };
  return { call, calls };
}

describe("planning a read", () => {
  it("backfills everything the first time", () => {
    expect(
      sales.planSpans(
        { historyFloor: "2025-01-01", coveredFrom: null, coveredTo: null, yearReadAt: null },
        "2026-09-14",
        NOW,
      ),
    ).toEqual([{ kind: "backfill", from: "2025-01-01", to: "2026-09-14" }]);
  });

  it("re-reads recent days, resumes an unfinished backfill, and re-reads the year when due", () => {
    expect(
      sales.planSpans(
        {
          historyFloor: "2025-01-01",
          coveredFrom: "2025-06-01",
          coveredTo: "2026-09-10",
          yearReadAt: null,
        },
        "2026-09-14",
        NOW,
      ),
    ).toEqual([
      { kind: "recent", from: "2026-08-01", to: "2026-09-14" },
      { kind: "backfill", from: "2025-01-01", to: "2025-05-31" },
      { kind: "year", from: "2026-01-01", to: "2026-07-31" },
    ]);
    // Read a day ago and long unrefreshed since: the recent span reaches back to
    // where coverage ends, so it stays unbroken.
    expect(
      sales.planSpans(
        {
          historyFloor: "2025-01-01",
          coveredFrom: "2025-01-01",
          coveredTo: "2026-06-30",
          yearReadAt: NOW - 24 * HOUR,
        },
        "2026-09-14",
        NOW,
      ),
    ).toEqual([{ kind: "recent", from: "2026-06-30", to: "2026-09-14" }]);
  });

  it("reads newest week first and joins what it reads into one span", () => {
    expect(sales.chunksNewestFirst("2026-09-01", "2026-09-10")).toEqual([
      { from: "2026-09-04", to: "2026-09-10" },
      { from: "2026-09-01", to: "2026-09-03" },
    ]);
    const covered = { coveredFrom: "2026-09-08", coveredTo: "2026-09-14" };
    expect(sales.extendCoverage(covered, "2026-09-01", "2026-09-07")).toEqual({
      coveredFrom: "2026-09-01",
      coveredTo: "2026-09-14",
    });
    // A span with a gap before it cannot claim the gap.
    expect(sales.extendCoverage(covered, "2026-08-01", "2026-08-05")).toEqual(covered);
  });

  it("starts a scheduled read when stale, but not straight after a failure", () => {
    const base = {
      historyFloor: "2025-01-01",
      coveredFrom: null,
      coveredTo: null,
      ordersRead: 0,
      error: null,
      running: false,
    };
    expect(sales.needsSalesRefresh({ ...base, refreshedAt: null, attemptedAt: null }, NOW)).toBe(
      true,
    );
    const fresh = { ...base, refreshedAt: NOW - HOUR, attemptedAt: NOW - HOUR };
    expect(sales.needsSalesRefresh(fresh, NOW)).toBe(false);
    const stale = { ...base, refreshedAt: NOW - 3 * HOUR, attemptedAt: NOW - 3 * HOUR };
    expect(sales.needsSalesRefresh(stale, NOW)).toBe(true);
    const justFailed = { ...base, refreshedAt: NOW - 5 * HOUR, attemptedAt: NOW - 0.2 * HOUR };
    expect(sales.needsSalesRefresh(justFailed, NOW)).toBe(false);
    const failedAWhileAgo = { ...base, refreshedAt: NOW - 5 * HOUR, attemptedAt: NOW - HOUR };
    expect(sales.needsSalesRefresh(failedAWhileAgo, NOW)).toBe(true);
    expect(sales.needsSalesRefresh({ ...stale, running: true }, NOW)).toBe(false);
  });
});

describe("talking to Spiro", () => {
  it("waits out the rate limit and asks again", async () => {
    const slept: number[] = [];
    let n = 0;
    const io = {
      calls: 0,
      sleep: async (ms: number) => {
        slept.push(ms);
      },
      call: async () =>
        n++ === 0
          ? envelope({
              error: "spiro_public_api_error",
              statusCode: 429,
              body: "Rate limit exceeded for this API key. Please retry in about a minute.",
            })
          : envelope({ data: [1], meta: {} }),
    };
    const { data } = await callSpiro(io, "search_spiro_reporting_orders", {});
    expect(data).toEqual([1]);
    expect(slept).toEqual([65_000]);
    expect(io.calls).toBe(2);
  });
});

describe("reading orders", () => {
  beforeAll(async () => {
    // The Sales Focus report already knows this company's service area.
    await getAdminDb()
      .insertInto("admin_focus_companies")
      .values({
        company_id: CHARLOTTE_CO,
        name: "Charlotte Realty",
        region: "Charlotte, North Carolina",
        cached_at: NOW,
      })
      .execute();
  });

  async function cachedOrders() {
    const rows = await getAdminDb().selectFrom("admin_sales_orders").selectAll().execute();
    return new Map(rows.map((r) => [r.order_id, r]));
  }

  it("keeps every finished week when a read breaks partway", async () => {
    fixtures = ORDERS;
    const spiro = fakeSpiro({ failOn: "2025-03-05" });
    await expect(
      sales.refreshSalesData({ call: spiro.call, now: NOW, sleep: noSleep }),
    ).rejects.toThrow("boom");

    const sync = await sales.getSalesSync();
    expect(sync.historyFloor).toBe("2025-01-01");
    expect(sync.coveredTo).toBe("2026-09-14");
    expect((sync.coveredFrom ?? "") > "2025-03-05").toBe(true);
    expect(sync.refreshedAt).toBeNull();
    expect(sync.error).toContain("boom");
    expect([...(await cachedOrders()).keys()].toSorted()).toEqual([
      "o-aug-a",
      "o-jul-c",
      "o-sep-a",
      "o-sep-b",
      "o-sep-d",
    ]);
  });

  it("resumes, narrows a read that times out, and fills in markets and client history", async () => {
    const spiro = fakeSpiro({ timeoutOn: "2026-09-11" });
    const result = await sales.refreshSalesData({
      call: spiro.call,
      now: NOW + 60_000,
      sleep: noSleep,
    });
    expect(result.spans.map((s) => s.kind)).toEqual(["recent", "backfill", "year"]);

    const sync = await sales.getSalesSync();
    expect(sync).toMatchObject({
      coveredFrom: "2025-01-01",
      coveredTo: "2026-09-14",
      error: null,
      running: false,
    });
    expect((await cachedOrders()).has("o-2025-c")).toBe(true);

    // The week holding Sep 11 timed out at 500 rows and answered at 100.
    const sizes = spiro.calls
      .filter(
        (c) =>
          c.name === "search_spiro_reporting_orders" &&
          String(c.args.from) <= "2026-09-11" &&
          String(c.args.to) >= "2026-09-11",
      )
      .map((c) => c.args.pageSize);
    expect(sizes).toContain(500);
    expect(sizes).toContain(100);

    // Charlotte came from the Focus cache; only the new company was asked about.
    const companies = await getAdminDb()
      .selectFrom("admin_sales_companies")
      .select(["company_id", "service_area"])
      .orderBy("company_id")
      .execute();
    expect(companies).toEqual([
      { company_id: CHARLOTTE_CO, service_area: "Charlotte, North Carolina" },
      { company_id: CLEVELAND_CO, service_area: "Cleveland, Ohio" },
    ]);
    expect(
      spiro.calls.filter((c) => c.name === "get_spiro_company").map((c) => c.args.companyId),
    ).toEqual([CLEVELAND_CO]);

    // Agents A and B first paid this year, so Spiro is asked about their past, in
    // two spans back to 2020 each. C paid in 2025 and needs no asking.
    const summaries = spiro.calls.filter((c) => c.name === "summarize_spiro_reporting_orders");
    expect(
      summaries.map((c) => String(c.args.agentId)).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(["agent-a", "agent-a", "agent-b", "agent-b"]);
    expect(summaries.filter((c) => c.args.agentId === "agent-b").map((c) => c.args)).toEqual([
      { agentId: "agent-b", from: "2022-01-01", to: "2024-12-31", span: "year" },
      { agentId: "agent-b", from: "2020-01-01", to: "2021-12-31", span: "year" },
    ]);

    // Only markets on the list get a row of their own.
    for (const label of ["Charlotte", "Cleveland"]) {
      await salesMarkets.addSalesMarket({ label }, "test", NOW);
    }
    const dash = await dashboard.getSalesDashboard({ year: 2026, month: 9, now: NOW });
    expect(dash.report.throughDay).toBe("2026-09-13");
    expect(dash.months).toEqual({ min: "2025-01", max: "2026-09" });
    expect(dash.report.clientsPending).toBe(0);
    const month = new Map(dash.report.mtd.rows.map((r) => [r.label, r]));
    expect(month.get("Charlotte")?.actual).toEqual({
      units: 1,
      revenueCents: 30000,
      aspCents: 30000,
    });
    // The cancelled $0 order is not a unit.
    expect(month.get("Cleveland")?.actual.units).toBe(1);
    expect(month.get("Cleveland")?.newClients).toEqual({ first: 1, returning: 0 });
    expect(month.get("Charlotte")?.newClients).toEqual({ first: 0, returning: 0 });
    const year = new Map(dash.report.ytd.rows.map((r) => [r.label, r]));
    expect(year.get("Charlotte")?.actual.units).toBe(3);
    // A's first-ever order was in August; C came back in July after 16 months.
    expect(year.get("Charlotte")?.newClients).toEqual({ first: 1, returning: 1 });
  });

  it("re-reads only recent days later, so edits and cancellations land", async () => {
    // Sep 10 was cancelled after the last read, and Sep 11 no longer exists.
    const cancelled: Fixture = {
      orderId: "o-sep-a",
      day: "2026-09-10",
      total: 0,
      agent: "agent-a",
      company: CHARLOTTE_CO,
      status: "cancelled",
    };
    fixtures = [
      cancelled,
      ...ORDERS.filter((o) => o.orderId !== "o-sep-a" && o.orderId !== "o-sep-b"),
    ];
    const spiro = fakeSpiro();
    const result = await sales.refreshSalesData({
      call: spiro.call,
      now: NOW + 3 * HOUR,
      sleep: noSleep,
    });
    expect(result.spans).toEqual([{ kind: "recent", from: "2026-08-01", to: "2026-09-14" }]);

    const orders = await cachedOrders();
    expect(orders.get("o-sep-a")).toMatchObject({ total_cents: 0, status: "cancelled" });
    expect(orders.has("o-sep-b")).toBe(false);
    expect(orders.has("o-2025-c")).toBe(true);
    // What Spiro already said about client history and companies is kept.
    expect(spiro.calls.filter((c) => c.name !== "search_spiro_reporting_orders")).toEqual([]);
  });
});
