// Month-by-month figures for the sales dashboard's charts.
//
// Each month is the dashboard's own month-to-date report for that month —
// completed shoots on their shoot day, the same markets, goals and listings — so
// a point on a chart is always the number the Report tab shows for that month.
// The running month counts through yesterday, as the report does.

import { accountToday } from "./brokerage-orders.js";
import { addDays, minYmd, monthEnd, monthKey } from "./sales-calendar.js";
import { loadSalesContext, type MonthRow } from "./sales-dashboard.js";
import { SalesInputError, type SalesMarket } from "./sales-markets.js";
import type { SalesSync } from "./sales-orders.js";

/** Three years on a chart, plus the year before them for a same-month-last-year line. */
export const MAX_TREND_MONTHS = 48;

export type TrendPoint = {
  key: string;
  label: string;
  units: number;
  revenueCents: number;
  aspCents: number | null;
  /** First-ever plus returning; null for a year too early to judge. */
  newClients: number | null;
  listings: number | null;
  sharePct: number | null;
  goalUnits: number | null;
  goalRevenueCents: number | null;
  unitsPct: number | null;
  revenuePct: number | null;
};

export type TrendMonth = {
  month: string;
  throughDay: string;
  /** The running month, counted only through yesterday. */
  partial: boolean;
  rows: TrendPoint[];
  total: TrendPoint;
};

export type SalesTrends = {
  from: string;
  to: string;
  months: TrendMonth[];
  markets: SalesMarket[];
  /** The months a chart can show. */
  range: { min: string; max: string };
  sync: SalesSync;
};

/** Every month from `from` to `to`, both YYYY-MM and both included. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  let key = monthKey(year, month);
  while (key <= to) {
    out.push(key);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
    key = monthKey(year, month);
  }
  return out;
}

export function trendPoint(row: MonthRow): TrendPoint {
  return {
    key: row.key,
    label: row.label,
    units: row.actual.units,
    revenueCents: row.actual.revenueCents,
    aspCents: row.actual.aspCents,
    newClients: row.newClients ? row.newClients.first + row.newClients.returning : null,
    listings: row.share.listings,
    sharePct: row.share.pct,
    goalUnits: row.goal.units > 0 ? row.goal.units : null,
    goalRevenueCents: row.goal.revenueCents > 0 ? row.goal.revenueCents : null,
    unitsPct: row.pct.units,
    revenuePct: row.pct.revenue,
  };
}

/** Months outside what the order cache holds are left off rather than charted as zero. */
export async function getSalesTrends(params: {
  from: string;
  to: string;
  now?: number;
}): Promise<SalesTrends> {
  if (monthsBetween(params.from, params.to).length > MAX_TREND_MONTHS) {
    throw new SalesInputError(`A chart covers at most ${MAX_TREND_MONTHS} months.`);
  }
  const now = params.now ?? Date.now();
  const yesterday = addDays(accountToday(now), -1);
  const max = yesterday.slice(0, 7);
  const to = params.to < max ? params.to : max;
  const ctx = await loadSalesContext({
    earliest: `${params.from.slice(0, 4)}-01-01`,
    through: minYmd(yesterday, monthEnd(Number(to.slice(0, 4)), Number(to.slice(5, 7)))),
    now,
  });
  const from = params.from > ctx.firstMonth ? params.from : ctx.firstMonth;

  const months: TrendMonth[] = [];
  for (const key of from <= to ? monthsBetween(from, to) : []) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const report = await ctx.reportFor(year, month, minYmd(yesterday, monthEnd(year, month)));
    months.push({
      month: key,
      throughDay: report.throughDay,
      partial: report.throughDay < report.monthEnd,
      rows: report.mtd.rows.map(trendPoint),
      total: trendPoint(report.mtd.total),
    });
  }
  return {
    from,
    to,
    months,
    markets: ctx.markets,
    range: { min: ctx.firstMonth, max },
    sync: ctx.sync,
  };
}
