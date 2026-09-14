import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-brokerage-orders-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const orders = await import("./brokerage-orders.js");
const store = await import("./brokerage-store.js");

/**
 * The year-to-date totals behind every brokerage. What matters is that they
 * are the whole year and only the orders that count: every 31-day window and
 * every page read, cancelled orders left out, and a read that breaks partway
 * never replacing good totals with half of them.
 */

afterAll(() => {
  delete process.env.OPENCLAW_STATE_DIR;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

// 14:00 Eastern on Sep 14 2026.
const NOW = Date.parse("2026-09-14T18:00:00Z");
const HERITAGE = "ccf8d3b0-8de4-496b-80af-c350205dfb3f";
const HERITAGE_CINCY = "ec3b9940-336b-444f-873d-048d894b5648";
const HANNA = "b6d50beb-77a0-4b38-9482-d6711ad587a4";

/** A row shaped the way `search_spiro_reporting_orders` returned one from the live account. */
function row(over: {
  orderId: string;
  date: string;
  total: number;
  company?: string;
  status?: string;
}): Record<string, unknown> {
  return {
    orderId: over.orderId,
    orderNumber: "wxu443nb4",
    orderDate: over.date,
    status: over.status ?? "delivered",
    total: over.total,
    agent: { id: "2c3fa5ba-29b0-4279-bb4b-b69ff95bbef9", name: "The Cindy Buckreus Team" },
    company: { id: over.company ?? HERITAGE, name: "Coldwell Banker Heritage" },
    products: [],
  };
}

/** The MCP envelope around one reporting page. */
function reply(data: unknown[], hasMoreData = false): unknown {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          data,
          meta: { dataset: "orders", hasMoreData, resultSetAsOf: "2026-09-14T18:00:00Z" },
        }),
      },
    ],
  };
}

describe("windows", () => {
  it("covers January 1 to today in spans Spiro accepts, with no gap or overlap", () => {
    const windows = orders.yearWindows("2026-09-14");
    expect(windows[0]?.from).toBe("2026-01-01");
    expect(windows.at(-1)?.to).toBe("2026-09-14");
    let prevTo: string | null = null;
    for (const w of windows) {
      const days = (Date.parse(w.to) - Date.parse(w.from)) / 86400000 + 1;
      expect(days).toBeLessThanOrEqual(31);
      if (prevTo) {
        expect(Date.parse(w.from) - Date.parse(prevTo)).toBe(86400000);
      }
      prevTo = w.to;
    }
  });

  it("takes today from the account's timezone, not the server's", () => {
    // 02:00 UTC on Jan 1 is still Dec 31 in Ohio.
    expect(orders.accountToday(Date.parse("2027-01-01T02:00:00Z"))).toBe("2026-12-31");
    expect(orders.accountYear(Date.parse("2027-01-01T02:00:00Z"))).toBe(2026);
  });
});

describe("rollup", () => {
  it("counts every order but cancelled ones, at the order total, once each", () => {
    const months = orders.rollupOrders(
      [
        row({ orderId: "a", date: "2026-08-15T15:12:34.44-04:00", total: 259 }),
        row({ orderId: "b", date: "2026-08-20T09:00:00-04:00", total: 135.5 }),
        row({ orderId: "b", date: "2026-08-20T09:00:00-04:00", total: 135.5 }),
        row({ orderId: "c", date: "2026-08-21T09:00:00-04:00", total: 400, status: "cancelled" }),
        row({ orderId: "d", date: "2025-12-31T23:00:00-05:00", total: 999 }),
        row({ orderId: "e", date: "2026-03-02T10:00:00-05:00", total: 100, company: HANNA }),
      ],
      2026,
    );
    const august = months.find((m) => m.companyId === HERITAGE && m.month === 8);
    expect(august).toMatchObject({ orders: 2, revenueCents: 39450, cancelled: 1 });
    // Last year's order is not this year's revenue.
    expect(months.some((m) => m.month === 12)).toBe(false);
    expect(months.find((m) => m.companyId === HANNA)).toMatchObject({ month: 3, orders: 1 });
  });

  it("files a late-evening order in the month it was placed where the account is", () => {
    const [month] = orders.rollupOrders(
      [row({ orderId: "x", date: "2026-08-31T23:30:00-04:00", total: 50 })],
      2026,
    );
    expect(month?.month).toBe(8);
  });
});

describe("sweep", () => {
  it("reads every window and every page, then totals per agreement", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const call = async (name: string, args: Record<string, unknown>) => {
      expect(name).toBe("search_spiro_reporting_orders");
      calls.push(args);
      if (args.from === "2026-01-01") {
        return args.page === 1
          ? reply([row({ orderId: "j1", date: "2026-01-05T10:00:00-05:00", total: 200 })], true)
          : reply([row({ orderId: "j2", date: "2026-01-06T10:00:00-05:00", total: 300 })]);
      }
      if (args.to === "2026-09-14") {
        return reply([
          row({
            orderId: "s1",
            date: "2026-09-10T10:00:00-04:00",
            total: 150,
            company: HERITAGE_CINCY,
          }),
          row({
            orderId: "s2",
            date: "2026-09-11T10:00:00-04:00",
            total: 500,
            status: "cancelled",
          }),
        ]);
      }
      return reply([]);
    };

    const result = await orders.refreshBrokerageOrders({ call, now: NOW, retryDelaysMs: [] });
    expect(result).toMatchObject({ year: 2026, coveredTo: "2026-09-14", ordersRead: 4 });
    expect(calls.filter((c) => c.from === "2026-01-01").map((c) => c.page)).toEqual([1, 2]);
    // The second page is held to the first page's snapshot.
    expect(calls.find((c) => c.page === 2)?.resultSetAsOf).toBe("2026-09-14T18:00:00Z");
    expect(calls.at(-1)?.to).toBe("2026-09-14");

    const agreement = await store.createAgreement(
      {
        name: "Coldwell Banker Heritage",
        stage: "active",
        companies: [
          {
            companyId: HERITAGE,
            companyName: "Coldwell Banker Heritage",
            serviceArea: "Dayton, Ohio",
          },
          {
            companyId: HERITAGE_CINCY,
            companyName: "Coldwell Banker Heritage",
            serviceArea: "Cincinnati, Ohio",
          },
        ],
      },
      { actorName: "Steve", year: 2026 },
    );
    expect(agreement.ytdOrders).toBe(3);
    expect(agreement.ytdRevenueCents).toBe(65000);
    expect(agreement.companies.find((c) => c.companyId === HERITAGE_CINCY)?.ytdOrders).toBe(1);

    const sync = await orders.getBrokerageOrderSync();
    expect(sync).toMatchObject({ year: 2026, ordersRead: 4, refreshedAt: NOW, error: null });
    expect(orders.needsRefresh(sync, NOW + 60 * 60 * 1000)).toBe(false);
    expect(orders.needsRefresh(sync, NOW + 7 * 60 * 60 * 1000)).toBe(true);
    // A new year needs its own read at once.
    expect(orders.needsRefresh(sync, Date.parse("2027-01-01T12:00:00Z"))).toBe(true);
  });

  it("keeps the last good totals when a read breaks partway", async () => {
    const before = await store.companyTotalsForYear(2026);
    expect(before.get(HERITAGE)?.orders).toBe(2);

    let calls = 0;
    const call = async (_name: string, args: Record<string, unknown>) => {
      calls++;
      if (args.from === "2026-03-02") {
        return { content: [{ type: "text", text: '{"error":"upstream timeout"}' }] };
      }
      return reply([]);
    };
    await expect(
      orders.refreshBrokerageOrders({ call, now: NOW + 1000, retryDelaysMs: [0] }),
    ).rejects.toThrow(/without a list/);
    // The bad window was tried again before giving up.
    expect(calls).toBeGreaterThan(3);

    const after = await store.companyTotalsForYear(2026);
    expect(after.get(HERITAGE)?.orders).toBe(2);
    const sync = await orders.getBrokerageOrderSync();
    expect(sync.refreshedAt).toBe(NOW);
    expect(sync.attemptedAt).toBe(NOW + 1000);
    expect(sync.error).toMatch(/upstream timeout/);
  });
});

describe("company search", () => {
  it("returns active companies with where they are", async () => {
    let sent: Record<string, unknown> | null = null;
    const hits = await orders.searchSpiroCompanies("Heritage", {
      call: async (_name, args) => {
        sent = args;
        return reply([
          {
            companyId: HERITAGE,
            name: "Coldwell Banker Heritage",
            deactivated: false,
            agentCount: 448,
            serviceArea: { serviceAreaId: "fada", name: "Dayton, Ohio" },
            address: { city: "Beavercreek", stateOrProvince: "OH" },
          },
        ]);
      },
    });
    expect(sent).toMatchObject({ nameContains: "Heritage", deactivated: false });
    expect(hits).toEqual([
      {
        companyId: HERITAGE,
        name: "Coldwell Banker Heritage",
        serviceArea: "Dayton, Ohio",
        city: "Beavercreek, OH",
        agentCount: 448,
      },
    ]);
  });
});
