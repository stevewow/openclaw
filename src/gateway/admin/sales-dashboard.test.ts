import { describe, expect, it } from "vitest";
import { businessDays, oneYearBefore } from "./sales-calendar.js";
import { classifyClients, type PaidOrder } from "./sales-clients.js";
import {
  buildSalesReport,
  comparableThrough,
  type ReportOrder,
  type SalesGoal,
} from "./sales-dashboard.js";
import type { SalesMarket } from "./sales-markets.js";
import { monthsBetween } from "./sales-trends.js";

/**
 * The dashboard's arithmetic, pinned to the sheet it replaces. The August 2026
 * tracker is reproduced cell for cell from its own goals and actuals, so a
 * change that moves any percentage, per-day goal or ASP off the sheet fails
 * here rather than in front of the sales team.
 */

const NONE = new Set<string>();

function market(label: string, removedFrom: string | null = null): SalesMarket {
  return { key: label.toLowerCase(), label, removedFrom };
}

/** `count` orders summing exactly `dollars`, spread across August. */
function orders(marketKey: string, count: number, dollars: number): ReportOrder[] {
  const totalCents = Math.round(dollars * 100);
  const each = Math.floor(totalCents / count);
  return Array.from({ length: count }, (_, i) => ({
    day: `2026-08-${String((i % 31) + 1).padStart(2, "0")}`,
    marketKey,
    totalCents: i === count - 1 ? totalCents - each * (count - 1) : each,
  }));
}

/** `count` $200 orders on one day. */
function onDay(count: number, day: string, marketKey: string): ReportOrder[] {
  return Array.from({ length: count }, () => ({ day, marketKey, totalCents: 20000 }));
}

function goal(month: number, marketKey: string, units: number): SalesGoal {
  return {
    month,
    marketKey,
    marketLabel: marketKey,
    units,
    revenueCents: units * 20000,
    aspCents: null,
  };
}

// From the August 2026 sheet: goal units, goal revenue, goal ASP, actual units, actual revenue.
const AUGUST: Array<[string, number, number, number, number, number]> = [
  ["Charlotte", 243, 77928.24, 320.78, 203, 69580.5],
  ["Cincinnati", 352, 93072.96, 264.63, 416, 110988.75],
  ["Cleveland", 59, 14927.0, 253.0, 7, 1356.0],
  ["Columbus", 197, 52291.57, 265.96, 195, 59295.0],
  ["Dayton", 394, 101458.26, 257.79, 298, 75509.25],
  ["Findlay", 25, 4952.1, 198.33, 6, 1572.0],
  ["Fort Wayne", 49, 12075.45, 247.23, 18, 5171.0],
  ["Lima", 128, 26385.62, 205.87, 113, 23671.0],
  ["Toledo", 78, 19806.1, 255.44, 74, 16083.25],
];

// The sheet's MONTH-TO-DATE ACTUAL block: units %, units/day goal, rev %, ASP, ASP %.
const SHEET: Record<string, [number, number, number, number, number]> = {
  Charlotte: [83.54, 12, 89.29, 342.76, 106.85],
  Cincinnati: [118.18, 17, 119.25, 266.8, 100.82],
  Cleveland: [11.86, 3, 9.08, 193.71, 76.57],
  Columbus: [98.98, 10, 113.39, 304.08, 114.33],
  Dayton: [75.63, 19, 74.42, 253.39, 98.29],
  Findlay: [24.0, 2, 31.74, 262.0, 132.1],
  "Fort Wayne": [36.73, 3, 42.82, 287.28, 116.2],
  Lima: [88.28, 7, 89.71, 209.48, 101.75],
  Toledo: [94.87, 4, 81.2, 217.34, 85.09],
};

function augustInput(withCompanyGoal: boolean) {
  const goals: SalesGoal[] = AUGUST.map(([label, units, revenue, asp]) => ({
    month: 8,
    marketKey: label.toLowerCase(),
    marketLabel: label,
    units,
    revenueCents: Math.round(revenue * 100),
    aspCents: Math.round(asp * 100),
  }));
  if (withCompanyGoal) {
    goals.push({
      month: 8,
      marketKey: "total",
      marketLabel: "Company total",
      units: 1500,
      revenueCents: 40289730,
      aspCents: null,
    });
  }
  return {
    year: 2026,
    month: 8,
    throughDay: "2026-09-01",
    orders: AUGUST.flatMap(([label, , , , units, revenue]) =>
      orders(label.toLowerCase(), units, revenue),
    ),
    markets: AUGUST.map(([label]) => market(label)),
    goals,
    listings: [],
    holidays: NONE,
    clientEvents: null,
    clientsPending: 0,
  };
}

describe("the August 2026 sheet", () => {
  const report = buildSalesReport(augustInput(true));

  it("counts 21 business days, all completed", () => {
    expect(report.businessDays.month).toBe(21);
    expect(report.businessDays.monthCompleted).toBe(21);
    expect(report.throughDay).toBe("2026-08-31");
  });

  for (const [label, [unitsPct, perDay, revenuePct, asp, aspPct]] of Object.entries(SHEET)) {
    it(`matches ${label}'s row`, () => {
      const row = report.mtd.rows.find((r) => r.label === label);
      expect(row).toBeDefined();
      expect(row?.pct.units).toBe(unitsPct);
      expect(row?.goal.unitsPerDay).toBe(perDay);
      expect(row?.pct.revenue).toBe(revenuePct);
      expect(row?.actual.aspCents).toBe(Math.round(asp * 100));
      expect(row?.pct.asp).toBe(aspPct);
      // With every business day done, the month's trend is the month itself.
      expect(row?.trend.unitsPct).toBe(unitsPct);
      expect(row?.trend.revenuePct).toBe(revenuePct);
    });
  }

  it("matches the TOTAL row, which carries its own unit goal", () => {
    const total = report.mtd.total;
    expect(total.actual.units).toBe(1330);
    expect(total.actual.revenueCents).toBe(36322675);
    expect(total.pct.units).toBe(88.67);
    expect(total.goal.unitsPerDay).toBe(72);
    expect(total.pct.revenue).toBe(90.15);
    expect(total.actual.aspCents).toBe(27310);
    expect(total.goal.aspCents).toBe(26860);
    expect(total.pct.asp).toBe(101.68);
  });

  it("adds the markets up for the total when no company goal is entered", () => {
    const summed = buildSalesReport(augustInput(false)).mtd.total;
    expect(summed.goal.units).toBe(1525);
    expect(summed.goal.revenueCents).toBe(40289730);
    expect(summed.goal.unitsPerDay).toBe(73);
  });
});

describe("pace", () => {
  it("runs a part-finished month to its end, skipping holidays", () => {
    // September 2026 has 22 weekdays; Labor Day takes one. Through the 14th,
    // 9 business days are done: 4 before the holiday and 5 after.
    const holidays = new Set(["2026-09-07"]);
    expect(businessDays("2026-09-01", "2026-09-30", holidays)).toBe(21);
    const report = buildSalesReport({
      year: 2026,
      month: 9,
      throughDay: "2026-09-14",
      orders: [
        ...onDay(90, "2026-09-10", "lima"),
        // After the day counted through: not in the month to date.
        { day: "2026-09-15", marketKey: "lima", totalCents: 20000 },
        // A $0 order is never a unit.
        { day: "2026-09-10", marketKey: "lima", totalCents: 0 },
      ],
      markets: [market("Lima")],
      goals: [
        ...Array.from({ length: 8 }, (_, i) => goal(i + 1, "lima", 100)),
        goal(9, "lima", 200),
      ],
      listings: [],
      holidays,
      clientEvents: null,
      clientsPending: 0,
    });
    expect(report.businessDays.monthCompleted).toBe(9);
    const lima = report.mtd.rows[0];
    expect(lima?.actual.units).toBe(90);
    expect(lima?.trend.units).toBe(210);
    expect(lima?.trend.unitsPct).toBe(105);
    expect(lima?.goal.unitsPerDay).toBe(10);
    expect(lima?.goal.aspCents).toBe(20000);
    // Year to date: eight full months plus 9/21 of September's goal.
    const ytd = report.ytd.rows[0];
    expect(ytd?.goalToDate.units).toBe(885.71);
    expect(ytd?.annualGoal.units).toBe(1000);
    expect(ytd?.pct.units).toBe(10.16);
  });

  it("has no trend before a business day", () => {
    const report = buildSalesReport({
      year: 2026,
      month: 11,
      throughDay: "2026-10-31",
      orders: [],
      markets: [market("Toledo")],
      goals: [goal(11, "toledo", 10)],
      listings: [],
      holidays: NONE,
      clientEvents: null,
      clientsPending: 0,
    });
    expect(report.businessDays.monthCompleted).toBe(0);
    expect(report.mtd.total.trend.units).toBeNull();
    expect(report.mtd.total.newClients).toBeNull();
  });
});

describe("markets", () => {
  it("lists every tracked market, and puts untracked and unassigned orders under Other markets", () => {
    const report = buildSalesReport({
      year: 2026,
      month: 10,
      throughDay: "2026-10-31",
      orders: [
        { day: "2026-10-02", marketKey: "unassigned", totalCents: 5000 },
        { day: "2026-10-03", marketKey: "akron", totalCents: 7000 },
      ],
      markets: [market("Toledo"), market("Charlotte")],
      goals: [],
      listings: [],
      holidays: NONE,
      clientEvents: null,
      clientsPending: 0,
    });
    // Toledo and Charlotte have no orders or goals and are listed anyway.
    expect(report.mtd.rows.map((r) => [r.label, r.actual.units])).toEqual([
      ["Charlotte", 0],
      ["Toledo", 0],
      ["Other markets", 2],
    ]);
    expect(report.mtd.total.actual.revenueCents).toBe(12000);
  });

  it("keeps a stopped market in the months before it stopped, and counts it under Other after", () => {
    const report = buildSalesReport({
      year: 2026,
      month: 10,
      throughDay: "2026-10-31",
      orders: [
        { day: "2026-08-10", marketKey: "findlay", totalCents: 20000 },
        { day: "2026-10-10", marketKey: "findlay", totalCents: 30000 },
        { day: "2026-10-11", marketKey: "lima", totalCents: 25000 },
      ],
      markets: [market("Findlay", "2026-09"), market("Lima")],
      goals: [goal(8, "findlay", 25), goal(10, "findlay", 25), goal(10, "lima", 100)],
      listings: [],
      holidays: NONE,
      clientEvents: null,
      clientsPending: 0,
    });
    expect(report.mtd.rows.map((r) => [r.label, r.actual.units])).toEqual([
      ["Lima", 1],
      ["Other markets", 1],
    ]);
    // October's Findlay goal is still saved, but Findlay is not in October.
    expect(report.mtd.total.goal.units).toBe(100);
    const findlay = report.ytd.rows.find((r) => r.key === "findlay");
    expect(findlay?.actual.units).toBe(1);
    expect(findlay?.annualGoal.units).toBe(25);
    expect(report.ytd.rows.map((r) => r.label)).toEqual(["Findlay", "Lima", "Other markets"]);
    expect(report.ytd.total.actual.units).toBe(3);
  });
});

describe("market share", () => {
  it("divides units by new listings, over only the months with listings for the year", () => {
    const report = buildSalesReport({
      year: 2026,
      month: 9,
      throughDay: "2026-09-30",
      orders: [
        ...onDay(30, "2026-07-15", "dayton"),
        ...onDay(40, "2026-08-14", "dayton"),
        ...onDay(50, "2026-09-15", "dayton"),
        ...onDay(10, "2026-09-15", "lima"),
      ],
      markets: [market("Dayton"), market("Lima")],
      goals: [],
      listings: [
        { month: 8, marketKey: "dayton", listings: 400 },
        { month: 9, marketKey: "dayton", listings: 500 },
        // A month the report has not reached yet.
        { month: 10, marketKey: "dayton", listings: 450 },
      ],
      holidays: NONE,
      clientEvents: null,
      clientsPending: 0,
    });
    expect(report.mtd.rows.find((r) => r.key === "dayton")?.share).toEqual({
      listings: 500,
      pct: 10,
    });
    // No listings for Lima: no share, and Lima's units stay out of the total's.
    expect(report.mtd.rows.find((r) => r.key === "lima")?.share).toEqual({
      listings: null,
      pct: null,
    });
    expect(report.mtd.total.share).toEqual({ listings: 500, pct: 10 });
    // July has no listings, so its 30 units are not in the year's share.
    expect(report.ytd.rows.find((r) => r.key === "dayton")?.share).toEqual({
      listings: 900,
      units: 90,
      pct: 10,
    });
    expect(report.ytd.total.share).toEqual({ listings: 900, units: 90, pct: 10 });
  });
});

describe("comparisons", () => {
  it("counts the earlier month as far into itself as this one is", () => {
    const sept14 = { monthStart: "2026-09-01", monthEnd: "2026-09-30", throughDay: "2026-09-14" };
    expect(comparableThrough(sept14, 2026, 8)).toBe("2026-08-14");
    expect(comparableThrough(sept14, 2025, 9)).toBe("2025-09-14");
    const march30 = { monthStart: "2026-03-01", monthEnd: "2026-03-31", throughDay: "2026-03-30" };
    expect(comparableThrough(march30, 2026, 2)).toBe("2026-02-28");
    // A finished month compares with the whole of the other.
    const leapFebruary = {
      monthStart: "2028-02-01",
      monthEnd: "2028-02-29",
      throughDay: "2028-02-29",
    };
    expect(comparableThrough(leapFebruary, 2028, 1)).toBe("2028-01-31");
    expect(comparableThrough(leapFebruary, 2027, 2)).toBe("2027-02-28");
    // On the 1st nothing of the month is counted yet, so nothing of the other is either.
    const firstDay = { monthStart: "2026-10-01", monthEnd: "2026-10-31", throughDay: "2026-09-30" };
    expect(comparableThrough(firstDay, 2026, 9)).toBe("2026-08-31");
  });
});

describe("new clients", () => {
  const range = { from: "2026-01-01", to: "2026-09-30" };
  const paid = (agentId: string, day: string, marketKey = "dayton"): PaidOrder => ({
    agentId,
    day,
    marketKey,
  });

  it("tells first-ever from returning, and a regular from either", () => {
    const { events, pendingAgents } = classifyClients(
      [
        // Never ordered before the floor, first order in March.
        paid("new", "2026-03-04"),
        paid("new", "2026-04-01"),
        // Ordered in 2025, then nothing for over a year.
        paid("back", "2025-02-10"),
        paid("back", "2026-05-20", "lima"),
        // Ordered within the last twelve months: neither.
        paid("regular", "2025-11-03"),
        paid("regular", "2026-02-01"),
        // Only pre-floor history, which Spiro says exists.
        paid("old", "2026-06-15"),
        // Nobody has asked Spiro about this one yet.
        paid("unknown", "2026-07-01"),
      ],
      new Map([
        ["new", false],
        ["back", false],
        ["regular", false],
        ["old", true],
      ]),
      range,
    );
    expect(events).toEqual([
      { agentId: "new", day: "2026-03-04", marketKey: "dayton", kind: "first" },
      { agentId: "back", day: "2026-05-20", marketKey: "lima", kind: "returning" },
      { agentId: "old", day: "2026-06-15", marketKey: "dayton", kind: "returning" },
    ]);
    expect(pendingAgents).toEqual(["unknown"]);
  });

  it("needs more than twelve months between orders to call a client returning", () => {
    const exactlyAYear = classifyClients(
      [paid("a", "2025-05-20"), paid("a", "2026-05-20")],
      new Map([["a", false]]),
      range,
    );
    expect(exactlyAYear.events).toEqual([]);
    const aYearAndADay = classifyClients(
      [paid("a", "2025-05-19"), paid("a", "2026-05-20")],
      new Map([["a", false]]),
      range,
    );
    expect(aYearAndADay.events.map((e) => e.kind)).toEqual(["returning"]);
    expect(oneYearBefore("2028-02-29")).toBe("2027-02-28");
  });
});

describe("chart months", () => {
  it("lists every month in a range, across a new year", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(monthsBetween("2026-08", "2026-08")).toEqual(["2026-08"]);
    expect(monthsBetween("2026-09", "2026-08")).toEqual([]);
  });
});
