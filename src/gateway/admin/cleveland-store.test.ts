import { describe, expect, it } from "vitest";
import { computeInvestment, ONGOING_WAGES, PAST_EXPENSES } from "./cleveland-store.js";

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
  });
});
