import { describe, expect, it } from "vitest";
import {
  computeInvestment,
  ONGOING_WAGES,
  PAST_EXPENSES,
  toClevelandOrder,
} from "./cleveland-store.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 8); // 2026-07-08
const sumExpenses = PAST_EXPENSES.reduce((s, e) => s + e.amount, 0);
const ongoingWeekly = ONGOING_WAGES.reduce((s, w) => s + w.weekly, 0);

describe("computeInvestment", () => {
  it("accrues cost with no revenue and finds no breakeven", () => {
    const inv = computeInvestment({
      revenueEvents: [],
      refreshedAt: null,
      orderCount: 0,
      now: NOW,
    });
    expect(inv.summary.totalRevenue).toBe(0);
    expect(inv.summary.net).toBeLessThan(0);
    expect(inv.summary.weeklyBreakevenWeek).toBeNull();
    expect(inv.summary.totalBreakevenWeek).toBeNull();
    // Every historical payroll dollar is counted; ongoing wages may add a week or two.
    expect(inv.summary.totalCost).toBeGreaterThanOrEqual(sumExpenses - 0.01);
    expect(inv.summary.totalCost).toBeLessThan(sumExpenses + 3 * ongoingWeekly);
    expect(inv.weeks.every((w) => w.revenue === 0)).toBe(true);
    expect(inv.weeks.at(-1)!.cumulativeCost).toBeGreaterThan(inv.weeks[0]!.cumulativeCost);
  });

  it("charges editing at 10% of a week's revenue", () => {
    const base = computeInvestment({
      revenueEvents: [],
      refreshedAt: null,
      orderCount: 0,
      now: NOW,
    });
    const withRev = computeInvestment({
      revenueEvents: [{ deliveredAt: Date.UTC(2026, 5, 3), revenue: 1000 }], // Wed in week of Mon 2026-06-01
      refreshedAt: null,
      orderCount: 1,
      now: NOW,
    });
    const wk = Date.UTC(2026, 5, 1);
    const bw = base.weeks.find((w) => w.weekStart === wk)!;
    const rw = withRev.weeks.find((w) => w.weekStart === wk)!;
    expect(rw.revenue).toBe(1000);
    expect(rw.cost - bw.cost).toBeCloseTo(100, 2); // 10% editing, wages unchanged
  });

  it("does not double-pay or skip ongoing wages across the historical→projected boundary", () => {
    const inv = computeInvestment({
      revenueEvents: [],
      refreshedAt: null,
      orderCount: 0,
      now: NOW,
    });
    // Each projected week should carry exactly the ongoing weekly payroll (no revenue → no editing).
    const projected = inv.weeks.filter((w) => w.projected);
    expect(projected.length).toBeGreaterThan(0);
    for (const w of projected) expect(w.cost).toBeCloseTo(ongoingWeekly, 2);
  });

  it("finds weekly then cumulative breakeven under a rising revenue trend", () => {
    const events: Array<{ deliveredAt: number; revenue: number }> = [];
    let r = 500;
    for (let wk = Date.UTC(2026, 3, 13); wk < NOW; wk += WEEK_MS) {
      events.push({ deliveredAt: wk + DAY_MS, revenue: r });
      r += 500;
    }
    const inv = computeInvestment({
      revenueEvents: events,
      refreshedAt: null,
      orderCount: events.length,
      now: NOW,
    });
    expect(inv.summary.trendSlopePerWeek).toBeGreaterThan(0);
    expect(inv.summary.weeklyBreakevenWeek).not.toBeNull();
    expect(inv.summary.totalBreakevenWeek).not.toBeNull();
    // You must beat the weekly run-rate before you can pay back the accumulated deficit.
    expect(inv.summary.totalBreakevenWeek!).toBeGreaterThanOrEqual(
      inv.summary.weeklyBreakevenWeek!,
    );
  });

  it("recent-window trend captures a late ramp that the all-weeks fit dilutes", () => {
    const now = Date.UTC(2026, 8, 1); // 2026-09-01
    const events: Array<{ deliveredAt: number; revenue: number }> = [];
    // Long stagnant stretch: small weekly revenue from May through mid-July.
    for (let d = Date.UTC(2026, 4, 1); d < Date.UTC(2026, 6, 20); d += WEEK_MS) {
      events.push({ deliveredAt: d, revenue: 120 });
    }
    // Recent ramp: the last 4 weeks climb steeply.
    [28, 21, 14, 7].forEach((back, i) =>
      events.push({ deliveredAt: now - back * DAY_MS, revenue: 1500 + i * 400 }),
    );

    const win4 = computeInvestment({
      revenueEvents: events,
      refreshedAt: null,
      orderCount: events.length,
      now,
      trendWindowWeeks: 4,
    });
    const all = computeInvestment({
      revenueEvents: events,
      refreshedAt: null,
      orderCount: events.length,
      now,
      trendWindowWeeks: null,
    });

    expect(win4.summary.trendWindowWeeks).toBe(4);
    expect(all.summary.trendWindowWeeks).toBeNull();
    // The recent ramp reads as a much steeper trend than the diluted full-history fit.
    expect(win4.summary.trendSlopePerWeek).toBeGreaterThan(all.summary.trendSlopePerWeek);
    expect(win4.summary.totalBreakevenWeek).not.toBeNull();
  });

  it("defaults the trend window to 4 weeks", () => {
    const inv = computeInvestment({
      revenueEvents: [],
      refreshedAt: null,
      orderCount: 0,
      now: NOW,
    });
    expect(inv.summary.trendWindowWeeks).toBe(4);
    expect(inv.summary.trendWeighted).toBe(false);
  });

  it("recency-weighted trend sits between the all-weeks fit and a hard recent window", () => {
    const now = Date.UTC(2026, 8, 1);
    const events: Array<{ deliveredAt: number; revenue: number }> = [];
    for (let d = Date.UTC(2026, 4, 1); d < Date.UTC(2026, 6, 20); d += WEEK_MS) {
      events.push({ deliveredAt: d, revenue: 120 });
    }
    [28, 21, 14, 7].forEach((back, i) =>
      events.push({ deliveredAt: now - back * DAY_MS, revenue: 1500 + i * 400 }),
    );
    const mk = (opts: { trendWindowWeeks?: number | null; trendWeighted?: boolean }) =>
      computeInvestment({
        revenueEvents: events,
        refreshedAt: null,
        orderCount: events.length,
        now,
        ...opts,
      });
    const weighted = mk({ trendWeighted: true });
    const all = mk({ trendWindowWeeks: null });
    const hard4 = mk({ trendWindowWeeks: 4 });

    expect(weighted.summary.trendWeighted).toBe(true);
    expect(weighted.summary.trendWindowWeeks).toBeNull();
    // Recent-led: steeper than the diluted all-weeks fit...
    expect(weighted.summary.trendSlopePerWeek).toBeGreaterThan(all.summary.trendSlopePerWeek);
    // ...but smoother than the hard 4-week cutoff, since older weeks still count a little.
    expect(weighted.summary.trendSlopePerWeek).toBeLessThan(hard4.summary.trendSlopePerWeek);
  });
});

// A real Spiro order row (trimmed), captured from search_spiro_orders. The
// delivery timestamp lives on `website`, not the order root — reading the root
// silently dropped every order and the report charted cost with no revenue.
const SPIRO_ORDER: Record<string, unknown> = {
  orderId: "7a13abc6-371b-4144-2088-08df0b324c22",
  trackingCode: "ffq276rif",
  status: "delivered",
  dateSubmitted: "2026-09-07T20:19:02.7713310Z",
  totalSalePrice: 150,
  mediaTitle: "14244 Puritas Ave, Cleveland, OH 44135, USA",
  primaryAppointment: {
    appointmentId: "8261b897-54c3-45a6-95e3-c78f50ef11f3",
    photographer: {
      photographerId: "71aaae43-5471-4e24-be46-c44f5b2e5459",
      name: "Brandon Kralovic",
    },
  },
  website: {
    hasDisplayPage: true,
    deliveredAt: "2026-09-09T05:05:47.8179245Z",
  },
};

describe("toClevelandOrder", () => {
  it("reads revenue and the delivered date off a real Spiro order row", () => {
    const order = toClevelandOrder(SPIRO_ORDER);
    expect(order).not.toBeNull();
    expect(order!.orderId).toBe("7a13abc6-371b-4144-2088-08df0b324c22");
    expect(order!.photographer).toBe("Brandon Kralovic");
    expect(order!.revenue).toBe(150);
    expect(order!.deliveredAt).toBe(Date.parse("2026-09-09T05:05:47.8179245Z"));
  });

  it("skips an order that has not been delivered yet", () => {
    const undelivered = {
      ...SPIRO_ORDER,
      status: "confirmed",
      website: { hasDisplayPage: false, deliveredAt: null },
    };
    expect(toClevelandOrder(undelivered)).toBeNull();
  });

  it("skips an order shot by a photographer outside Cleveland", () => {
    const other = {
      ...SPIRO_ORDER,
      primaryAppointment: { photographer: { name: "Valerie Fitzsimmons" } },
    };
    expect(toClevelandOrder(other)).toBeNull();
  });

  it("counts both Cleveland photographers", () => {
    const kickham = {
      ...SPIRO_ORDER,
      orderId: "other-order",
      primaryAppointment: { photographer: { name: "John Kickham" } },
    };
    expect(toClevelandOrder(kickham)?.photographer).toBe("John Kickham");
  });
});
