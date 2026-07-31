import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-focus-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./focus-store.js");
const userStore = await import("./user-store.js");

const DAY = 86400000;
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

describe("date windows", () => {
  it("splits a year into ranges Spiro will accept", () => {
    const windows = store.dateWindows(at(2026, 1, 1), at(2026, 12, 31));
    // Spiro caps a reporting request at 31 days.
    expect(windows.length).toBeGreaterThanOrEqual(12);
    for (const w of windows) {
      const span = (store.parseYmd(w.to) - store.parseYmd(w.from)) / DAY;
      expect(span).toBeLessThan(31);
    }
    expect(windows[0].from).toBe("2026-01-01");
    expect(windows[windows.length - 1].to).toBe("2026-12-31");
  });

  it("covers every day exactly once, with no gap between windows", () => {
    const windows = store.dateWindows(at(2026, 3, 1), at(2026, 5, 15));
    for (let i = 1; i < windows.length; i++) {
      const prevEnd = store.parseYmd(windows[i - 1].to);
      const thisStart = store.parseYmd(windows[i].from);
      expect(thisStart - prevEnd).toBe(DAY);
    }
  });

  it("handles a range shorter than one window", () => {
    const windows = store.dateWindows(at(2026, 3, 1), at(2026, 3, 3));
    expect(windows).toEqual([{ from: "2026-03-01", to: "2026-03-03" }]);
  });
});

describe("comparison window", () => {
  it("defaults to the same dates a year earlier", () => {
    const w = store.comparisonWindow(at(2026, 8, 1), at(2027, 7, 31), "yoy");
    expect(store.ymd(w.from)).toBe("2025-08-01");
    expect(store.ymd(w.to)).toBe("2026-07-31");
  });

  it("can instead take an equal stretch immediately before", () => {
    const w = store.comparisonWindow(at(2026, 7, 1), at(2026, 7, 31), "previous");
    expect(store.ymd(w.to)).toBe("2026-06-30");
    // Equal LENGTH, not the previous calendar month: July is 31 days, so this
    // reaches back to May 31. That is what makes the mode work for an arbitrary
    // range like "the last 90 days", which is the point of offering it.
    expect(store.ymd(w.from)).toBe("2026-05-31");
    const span = (w.to - w.from) / DAY;
    expect(span).toBe((at(2026, 7, 31) - at(2026, 7, 1)) / DAY);
  });
});

describe("the report", () => {
  const CUR_FROM = at(2026, 7, 1);
  const CUR_TO = at(2026, 7, 31);

  beforeAll(async () => {
    const db = userStore.getAdminDb();
    const now = Date.now();
    await db
      .insertInto("admin_focus_companies")
      .values([
        { company_id: "c-cin", name: "Cincy Realty", region: "Cincinnati, Ohio", cached_at: now },
        { company_id: "c-col", name: "Columbus Homes", region: "Columbus, Ohio", cached_at: now },
        { company_id: "c-day", name: "Dayton Group", region: "Dayton, Ohio", cached_at: now },
        { company_id: "c-cle", name: "Cleveland Co", region: "Cleveland, Ohio", cached_at: now },
      ])
      .execute();
    await db
      .insertInto("admin_focus_agents")
      .values([
        {
          agent_id: "a1",
          name: "Amber Fairbanks",
          email: "amber@example.com",
          company_id: "c-cin",
          cached_at: now,
        },
      ])
      .execute();

    const order = (
      id: string,
      agent: string,
      company: string,
      date: number,
      total: number,
      status = "delivered",
    ) => ({
      order_id: id,
      agent_id: agent,
      agent_name: agent === "a1" ? "Amber Fairbanks" : `Agent ${agent}`,
      company_id: company,
      company_name: company,
      order_date: date,
      total,
      status,
      cached_at: now,
    });

    await db
      .insertInto("admin_focus_orders")
      .values([
        // Current period, Cincinnati client: 2 shoots, $500.
        order("o1", "a1", "c-cin", at(2026, 7, 5), 300),
        order("o2", "a1", "c-cin", at(2026, 7, 20), 200),
        // Same client a year earlier: $400, so +25%.
        order("o3", "a1", "c-cin", at(2025, 7, 10), 400),
        // A cancelled order still carries revenue but is not a shoot.
        order("o4", "a1", "c-cin", at(2026, 7, 25), 0, "cancelled"),
        // Columbus + Dayton, for the shared-book split.
        order("o5", "a2", "c-col", at(2026, 7, 8), 5000),
        order("o6", "a3", "c-day", at(2026, 7, 9), 100),
        order("o7", "a4", "c-day", at(2026, 7, 10), 50),
        // A client who bought last year and nothing this year.
        order("o8", "a5", "c-cin", at(2025, 7, 15), 900),
        // An unowned region.
        order("o9", "a6", "c-cle", at(2026, 7, 11), 750),
      ])
      .execute();
  });

  it("counts shoots and revenue for the window", async () => {
    const r = await store.getFocusReport({ from: "2026-07-01", to: "2026-07-31" });
    const amber = r.rows.find((x) => x.agentId === "a1")!;
    // The cancelled order adds no shoot.
    expect(amber.shoots).toBe(2);
    expect(amber.revenue).toBe(500);
    expect(amber.agentName).toBe("Amber Fairbanks");
  });

  it("compares against the same window a year earlier by default", async () => {
    const r = await store.getFocusReport({ from: "2026-07-01", to: "2026-07-31" });
    expect(r.compare).toBe("yoy");
    expect(r.comparisonFrom).toBe("2025-07-01");
    const amber = r.rows.find((x) => x.agentId === "a1")!;
    expect(amber.priorRevenue).toBe(400);
    expect(amber.growthPct).toBe(25);
  });

  it("shows a client who stopped buying as a total loss, not as missing", async () => {
    const r = await store.getFocusReport({ from: "2026-07-01", to: "2026-07-31" });
    const lapsed = r.rows.find((x) => x.agentId === "a5")!;
    // This is the whole point of the report — who went quiet.
    expect(lapsed.revenue).toBe(0);
    expect(lapsed.priorRevenue).toBe(900);
    expect(lapsed.growthPct).toBe(-100);
  });

  it("reports no growth figure for a brand-new client rather than infinity", async () => {
    const r = await store.getFocusReport({ from: "2026-07-01", to: "2026-07-31" });
    const fresh = r.rows.find((x) => x.agentId === "a2")!;
    expect(fresh.priorRevenue).toBe(0);
    // Ranking a new client above everyone as "infinite growth" would be a lie.
    expect(fresh.growthPct).toBeNull();
  });

  it("assigns each client a region and an owner", async () => {
    const r = await store.getFocusReport({ from: "2026-07-01", to: "2026-07-31" });
    expect(r.rows.find((x) => x.agentId === "a1")!.region).toBe("Cincinnati");
    expect(r.rows.find((x) => x.agentId === "a1")!.bds).toBe("Pam Branam");
    // Biggest of the three shared clients goes to the top slice.
    expect(r.rows.find((x) => x.agentId === "a2")!.bds).toBe("Chris Voge");
    expect(r.rows.find((x) => x.agentId === "a3")!.bds).toBe("Ryan Bowersock");
  });

  it("leaves a client in an unowned region without an owner", async () => {
    const r = await store.getFocusReport({ from: "2026-07-01", to: "2026-07-31" });
    const stray = r.rows.find((x) => x.agentId === "a6")!;
    expect(stray.region).toBe("Cleveland");
    expect(stray.bds).toBeNull();
  });

  it("filters to one BDS and totals only what they own", async () => {
    const all = await store.getFocusReport({ from: "2026-07-01", to: "2026-07-31" });
    const mine = await store.getFocusReport({
      from: "2026-07-01",
      to: "2026-07-31",
      bds: "Pam Branam",
    });
    expect(mine.rows.length).toBeLessThan(all.rows.length);
    expect(mine.rows.every((r) => r.bds === "Pam Branam")).toBe(true);
    expect(mine.totals.clients).toBe(mine.rows.length);
    expect(mine.totals.revenue).toBe(mine.rows.reduce((s, r) => s + r.revenue, 0));
  });

  it("ranks by revenue so the biggest client reads first", async () => {
    const r = await store.getFocusReport({ from: "2026-07-01", to: "2026-07-31" });
    const revenues = r.rows.map((x) => x.revenue);
    expect(revenues).toEqual(revenues.toSorted((a, b) => b - a));
  });

  it("offers only the owners actually present as filter options", async () => {
    const r = await store.getFocusReport({ from: "2026-07-01", to: "2026-07-31" });
    expect(r.bdsOptions).toContain("Pam Branam");
    expect(r.bdsOptions).not.toContain("Joy Kiser");
  });

  it("explains how the shared book was cut", async () => {
    const r = await store.getFocusReport({ from: "2026-07-01", to: "2026-07-31" });
    expect(r.splitNote).toContain("Columbus and Dayton");
    expect(r.splitNote).toContain("of 3 clients");
  });

  it("rejects a backwards or malformed range rather than returning nonsense", async () => {
    await expect(store.getFocusReport({ from: "2026-07-31", to: "2026-07-01" })).rejects.toThrow(
      /from on or before to/,
    );
    await expect(store.getFocusReport({ from: "nope", to: "2026-07-01" })).rejects.toThrow();
  });
});
