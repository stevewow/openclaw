// The sales dashboard: each market's goals against what it has booked, for a
// month and the year to it, with the pace the month and the year are on.
//
// What counts (reconciled against the August 2026 sheet to within 1%): every
// order placed in the period whose total is above $0, in the market of the
// order's company — Spiro's service area on that company. Cancelled orders are
// $0 in Spiro, so the $0 scrub drops them too.
//
// Markets are one list for every month (see sales-markets.ts). An order from a
// market that is not tracked in its month counts under "Other markets", so the
// company total is always every order.
//
// The sheet's arithmetic, kept exactly:
//   units/day goal   unit goal ÷ business days in the month, rounded up
//   end-of-month     month to date ÷ business days completed × business days
//   ASP goal         entered per market — the sheet's are not revenue ÷ units —
//                    falling back to revenue ÷ units when left blank
//   company total    its own goal when one is entered (August's 1,500 units is
//                    not the 1,525 its markets add up to), else the markets' sum
// Year to date does the same for the year. Its goal to date is every earlier
// month's goal plus this month's prorated by business days, so its percentage
// means "on pace" on the 15th as much as on the 31st.
//
// Market share is units ÷ new listings for the same market and month. For the
// year it adds up only the months that have listings entered, so a month still
// waiting on its number does not drag the share down.
//
// Comparisons are the same report built for last month and for this month last
// year, counted as far into their month as this one is, so the 14th is
// compared with the 14th.

import { accountToday } from "./brokerage-orders.js";
import { regionKey } from "./focus-regions.js";
import {
  addDays,
  businessDays,
  isYmd,
  minYmd,
  monthEnd,
  monthKey,
  monthStart,
} from "./sales-calendar.js";
import { classifyClients, type ClientEvent, type PaidOrder } from "./sales-clients.js";
import {
  amount,
  listSalesListings,
  listSalesMarkets,
  marketActiveIn,
  marketOf,
  OTHER_MARKET,
  SalesInputError,
  type SalesListing,
  type SalesMarket,
  TOTAL_GOAL_KEY,
  wholeIn,
} from "./sales-markets.js";
import { getSalesSync, type SalesSync } from "./sales-orders.js";
import { getAdminDb } from "./user-store.js";

const TOTAL_GOAL_LABEL = "Company total";
const OTHER_LABEL = "Other markets";

// ── The report ──────────────────────────────────────────────────────────────

export type ReportOrder = { day: string; marketKey: string; totalCents: number };

export type SalesGoal = {
  month: number;
  marketKey: string;
  marketLabel: string;
  units: number;
  revenueCents: number;
  /** Entered ASP goal; null means revenue ÷ units. */
  aspCents: number | null;
};

export type Measures = { units: number; revenueCents: number; aspCents: number | null };

export type NewClients = { first: number; returning: number };

export type Trend = {
  units: number | null;
  revenueCents: number | null;
  unitsPct: number | null;
  revenuePct: number | null;
};

/** Null listings: none entered for the period. */
export type Share = { listings: number | null; pct: number | null };

export type MonthRow = {
  key: string;
  label: string;
  goal: Measures & { unitsPerDay: number | null };
  actual: Measures;
  pct: { units: number | null; revenue: number | null; asp: number | null };
  newClients: NewClients | null;
  trend: Trend;
  share: Share;
};

export type YearRow = {
  key: string;
  label: string;
  goalToDate: Measures;
  annualGoal: Measures;
  actual: Measures;
  pct: { units: number | null; revenue: number | null; asp: number | null };
  newClients: NewClients | null;
  trend: Trend;
  /** Over the months with listings entered; `units` are those months' units. */
  share: Share & { units: number };
};

export type SalesReport = {
  year: number;
  month: number;
  monthStart: string;
  monthEnd: string;
  /** The last day counted: yesterday for the running month, the month's end otherwise. */
  throughDay: string;
  businessDays: { month: number; monthCompleted: number; year: number; yearCompleted: number };
  mtd: { rows: MonthRow[]; total: MonthRow };
  ytd: { rows: YearRow[]; total: YearRow };
  /** Agents whose new-client answer is still being fetched from Spiro. */
  clientsPending: number;
};

export type SalesReportInput = {
  year: number;
  month: number;
  throughDay: string;
  /** Market keys as Spiro gives them; the report decides which row each counts under. */
  orders: readonly ReportOrder[];
  markets: readonly SalesMarket[];
  goals: readonly SalesGoal[];
  listings: readonly SalesListing[];
  holidays: ReadonlySet<string>;
  /** Null when the year is too early for the order history to judge. */
  clientEvents: readonly ClientEvent[] | null;
  clientsPending: number;
};

type Tally = { units: number; revenueCents: number };

const ZERO: Tally = { units: 0, revenueCents: 0 };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A percentage to two places, or null when there is no goal to be a percentage of. */
function pct(actual: number | null, goal: number | null): number | null {
  if (actual === null || goal === null || !(goal > 0)) {
    return null;
  }
  return Math.round((actual / goal) * 10000) / 100;
}

function averageCents(t: Tally): number | null {
  return t.units > 0 ? t.revenueCents / t.units : null;
}

function measures(t: Tally, aspCents: number | null = averageCents(t)): Measures {
  return {
    units: round2(t.units),
    revenueCents: Math.round(t.revenueCents),
    aspCents: aspCents === null ? null : Math.round(aspCents),
  };
}

function addInto(into: Tally, t: Tally, share = 1): void {
  into.units += t.units * share;
  into.revenueCents += t.revenueCents * share;
}

function bump(map: Map<string, Tally>, key: string, t: Tally, share = 1): void {
  const existing = map.get(key);
  if (existing) {
    addInto(existing, t, share);
  } else {
    map.set(key, { units: t.units * share, revenueCents: t.revenueCents * share });
  }
}

function bumpClients(map: Map<string, NewClients>, key: string, event: ClientEvent): void {
  const c = map.get(key) ?? { first: 0, returning: 0 };
  if (event.kind === "first") {
    c.first++;
  } else {
    c.returning++;
  }
  map.set(key, c);
}

function trend(actual: Tally, done: number, days: number, goal: Tally): Trend {
  const units = done > 0 ? (actual.units / done) * days : null;
  const revenueCents = done > 0 ? (actual.revenueCents / done) * days : null;
  return {
    units: units === null ? null : round2(units),
    revenueCents: revenueCents === null ? null : Math.round(revenueCents),
    unitsPct: pct(units, goal.units),
    revenuePct: pct(revenueCents, goal.revenueCents),
  };
}

export function buildSalesReport(input: SalesReportInput): SalesReport {
  const { year, month, holidays } = input;
  const mStart = monthStart(year, month);
  const mEnd = monthEnd(year, month);
  const yStart = `${year}-01-01`;
  const through = minYmd(input.throughDay, mEnd);
  const monthDays = businessDays(mStart, mEnd, holidays);
  const monthDone = businessDays(mStart, through, holidays);
  const yearDays = businessDays(yStart, `${year}-12-31`, holidays);
  const yearDone = businessDays(yStart, through, holidays);
  const monthShare = monthDays > 0 ? monthDone / monthDays : 0;

  const markets = new Map(input.markets.map((m) => [m.key, m]));
  /** Whether a market is tracked in a month of this year. */
  const trackedIn = (marketKey: string, m: number): boolean => {
    const market = markets.get(marketKey);
    return !!market && marketActiveIn(market, monthKey(year, m));
  };
  /** The row something dated `day` counts under. */
  const rowOf = (marketKey: string, day: string): string =>
    trackedIn(marketKey, Number(day.slice(5, 7))) ? marketKey : OTHER_MARKET;
  const labelOf = (key: string): string => markets.get(key)?.label ?? OTHER_LABEL;

  const mtd = new Map<string, Tally>();
  const ytd = new Map<string, Tally>();
  /** Units per row per month (index 1–12), for market share. */
  const unitsByMonth = new Map<string, number[]>();
  for (const order of input.orders) {
    if (!(order.totalCents > 0) || order.day < yStart || order.day > through) {
      continue;
    }
    const key = rowOf(order.marketKey, order.day);
    const one = { units: 1, revenueCents: order.totalCents };
    bump(ytd, key, one);
    if (order.day >= mStart) {
      bump(mtd, key, one);
    }
    const units = unitsByMonth.get(key) ?? Array.from({ length: 13 }, () => 0);
    units[Number(order.day.slice(5, 7))]++;
    unitsByMonth.set(key, units);
  }

  const monthGoals = new Map<string, SalesGoal>();
  const toDate = new Map<string, Tally>();
  const annual = new Map<string, Tally>();
  const marketSumByMonth = new Map<number, Tally>();
  const totalGoalByMonth = new Map<number, SalesGoal>();
  for (const goal of input.goals) {
    if (goal.marketKey === TOTAL_GOAL_KEY) {
      totalGoalByMonth.set(goal.month, goal);
      continue;
    }
    // A goal left behind by a market that has since stopped counting stays
    // saved, but it is not a goal for a month the market is not in.
    if (!trackedIn(goal.marketKey, goal.month)) {
      continue;
    }
    const t = { units: goal.units, revenueCents: goal.revenueCents };
    bump(annual, goal.marketKey, t);
    const sum = marketSumByMonth.get(goal.month) ?? { units: 0, revenueCents: 0 };
    addInto(sum, t);
    marketSumByMonth.set(goal.month, sum);
    if (goal.month < month) {
      bump(toDate, goal.marketKey, t);
    } else if (goal.month === month) {
      monthGoals.set(goal.marketKey, goal);
      bump(toDate, goal.marketKey, t, monthShare);
    }
  }

  /** The company's goal for a month: its own where entered, field by field, else the markets'. */
  const companyGoal = (m: number): { tally: Tally; aspCents: number | null } => {
    const sum = marketSumByMonth.get(m) ?? ZERO;
    const own = totalGoalByMonth.get(m);
    const tally = {
      units: own && own.units > 0 ? own.units : sum.units,
      revenueCents: own && own.revenueCents > 0 ? own.revenueCents : sum.revenueCents,
    };
    return { tally, aspCents: own?.aspCents ?? averageCents(tally) };
  };
  const companyToDate = { units: 0, revenueCents: 0 };
  const companyAnnual = { units: 0, revenueCents: 0 };
  for (let m = 1; m <= 12; m++) {
    const { tally } = companyGoal(m);
    addInto(companyAnnual, tally);
    if (m < month) {
      addInto(companyToDate, tally);
    } else if (m === month) {
      addInto(companyToDate, tally, monthShare);
    }
  }

  /** New listings per market per month, through this month. */
  const listings = new Map<string, Map<number, number>>();
  for (const entry of input.listings) {
    if (entry.month > month || !trackedIn(entry.marketKey, entry.month)) {
      continue;
    }
    const byMonth = listings.get(entry.marketKey) ?? new Map<number, number>();
    byMonth.set(entry.month, entry.listings);
    listings.set(entry.marketKey, byMonth);
  }
  const shareInMonth = (key: string, units: number): Share => {
    const entered = listings.get(key)?.get(month) ?? null;
    return { listings: entered, pct: pct(units, entered) };
  };
  const shareInYear = (key: string): YearRow["share"] => {
    const entered = listings.get(key);
    if (!entered || entered.size === 0) {
      return { listings: null, units: 0, pct: null };
    }
    let count = 0;
    let units = 0;
    for (const [m, n] of entered) {
      count += n;
      units += unitsByMonth.get(key)?.[m] ?? 0;
    }
    return { listings: count, units, pct: pct(units, count) };
  };

  const monthClients = new Map<string, NewClients>();
  const yearClients = new Map<string, NewClients>();
  for (const event of input.clientEvents ?? []) {
    if (event.day < yStart || event.day > through) {
      continue;
    }
    const key = rowOf(event.marketKey, event.day);
    bumpClients(yearClients, key, event);
    if (event.day >= mStart) {
      bumpClients(monthClients, key, event);
    }
  }
  const counted = input.clientEvents !== null;

  const monthRow = (
    key: string,
    label: string,
    actual: Tally,
    goal: Tally,
    goalAspCents: number | null,
    clients: NewClients | null,
    share: Share,
  ): MonthRow => ({
    key,
    label,
    goal: {
      ...measures(goal, goalAspCents),
      unitsPerDay: goal.units > 0 && monthDays > 0 ? Math.ceil(goal.units / monthDays) : null,
    },
    actual: measures(actual),
    pct: {
      units: pct(actual.units, goal.units),
      revenue: pct(actual.revenueCents, goal.revenueCents),
      asp: pct(averageCents(actual), goalAspCents),
    },
    newClients: clients,
    trend: trend(actual, monthDone, monthDays, goal),
    share,
  });
  const yearRow = (
    key: string,
    label: string,
    actual: Tally,
    goalToDate: Tally,
    annualGoal: Tally,
    clients: NewClients | null,
    share: YearRow["share"],
  ): YearRow => ({
    key,
    label,
    goalToDate: measures(goalToDate),
    annualGoal: measures(annualGoal),
    actual: measures(actual),
    pct: {
      units: pct(actual.units, goalToDate.units),
      revenue: pct(actual.revenueCents, goalToDate.revenueCents),
      asp: pct(averageCents(actual), averageCents(goalToDate)),
    },
    newClients: clients,
    trend: trend(actual, yearDone, yearDays, annualGoal),
    share,
  });

  // Rows: the markets tracked in the period, by name, then Other markets when
  // any order landed there. A market stopped later in the year still has a
  // year-to-date row for the months it counted.
  const sortedKeys = (m: number): string[] =>
    input.markets
      .filter((market) => marketActiveIn(market, monthKey(year, m)))
      .map((market) => market.key)
      .toSorted((a, b) => labelOf(a).localeCompare(labelOf(b)));
  const withOther = (keys: string[], tallies: Map<string, Tally>): string[] =>
    tallies.has(OTHER_MARKET) ? [...keys, OTHER_MARKET] : keys;

  const mtdRows: MonthRow[] = [];
  const mtdSum = { units: 0, revenueCents: 0 };
  const monthClientSum = { first: 0, returning: 0 };
  const monthShareSum = { listings: 0, units: 0, any: false };
  for (const key of withOther(sortedKeys(month), mtd)) {
    const goal = monthGoals.get(key);
    const goalTally = goal ? { units: goal.units, revenueCents: goal.revenueCents } : ZERO;
    const goalAsp = goal ? (goal.aspCents ?? averageCents(goalTally)) : null;
    const actual = mtd.get(key) ?? ZERO;
    const clients = counted ? (monthClients.get(key) ?? { first: 0, returning: 0 }) : null;
    const share = shareInMonth(key, actual.units);
    mtdRows.push(monthRow(key, labelOf(key), actual, goalTally, goalAsp, clients, share));
    addInto(mtdSum, actual);
    monthClientSum.first += clients?.first ?? 0;
    monthClientSum.returning += clients?.returning ?? 0;
    if (share.listings !== null) {
      monthShareSum.any = true;
      monthShareSum.listings += share.listings;
      monthShareSum.units += actual.units;
    }
  }

  const ytdRows: YearRow[] = [];
  const ytdSum = { units: 0, revenueCents: 0 };
  const yearClientSum = { first: 0, returning: 0 };
  const yearShareSum = { listings: 0, units: 0, any: false };
  for (const key of withOther(sortedKeys(1), ytd)) {
    const actual = ytd.get(key) ?? ZERO;
    const clients = counted ? (yearClients.get(key) ?? { first: 0, returning: 0 }) : null;
    const share = shareInYear(key);
    ytdRows.push(
      yearRow(
        key,
        labelOf(key),
        actual,
        toDate.get(key) ?? ZERO,
        annual.get(key) ?? ZERO,
        clients,
        share,
      ),
    );
    addInto(ytdSum, actual);
    yearClientSum.first += clients?.first ?? 0;
    yearClientSum.returning += clients?.returning ?? 0;
    if (share.listings !== null) {
      yearShareSum.any = true;
      yearShareSum.listings += share.listings;
      yearShareSum.units += share.units;
    }
  }
  const thisMonth = companyGoal(month);

  return {
    year,
    month,
    monthStart: mStart,
    monthEnd: mEnd,
    throughDay: through,
    businessDays: {
      month: monthDays,
      monthCompleted: monthDone,
      year: yearDays,
      yearCompleted: yearDone,
    },
    mtd: {
      rows: mtdRows,
      total: monthRow(
        TOTAL_GOAL_KEY,
        "Total",
        mtdSum,
        thisMonth.tally,
        thisMonth.aspCents,
        counted ? monthClientSum : null,
        monthShareSum.any
          ? {
              listings: monthShareSum.listings,
              pct: pct(monthShareSum.units, monthShareSum.listings),
            }
          : { listings: null, pct: null },
      ),
    },
    ytd: {
      rows: ytdRows,
      total: yearRow(
        TOTAL_GOAL_KEY,
        "Total",
        ytdSum,
        companyToDate,
        companyAnnual,
        counted ? yearClientSum : null,
        yearShareSum.any
          ? {
              listings: yearShareSum.listings,
              units: yearShareSum.units,
              pct: pct(yearShareSum.units, yearShareSum.listings),
            }
          : { listings: null, units: 0, pct: null },
      ),
    },
    clientsPending: input.clientsPending,
  };
}

// ── Comparisons ─────────────────────────────────────────────────────────────

/**
 * The day an earlier month is counted through to compare with `report`: as far
 * into it as the report is into its own month. A finished month compares with
 * the whole of the other; the 31st of a month compares with the last of a
 * shorter one.
 */
export function comparableThrough(
  report: Pick<SalesReport, "monthStart" | "monthEnd" | "throughDay">,
  year: number,
  month: number,
): string {
  const start = monthStart(year, month);
  const end = monthEnd(year, month);
  if (report.throughDay < report.monthStart) {
    return addDays(start, -1);
  }
  if (report.throughDay >= report.monthEnd) {
    return end;
  }
  return minYmd(addDays(start, Number(report.throughDay.slice(8, 10)) - 1), end);
}

export type CompareRow = {
  key: string;
  label: string;
  actual: Measures;
  newClients: NewClients | null;
  share: Share;
};

export type SalesComparison = {
  year: number;
  month: number;
  monthStart: string;
  throughDay: string;
  /** False while the Spiro read has not yet reached back to the start of the period. */
  complete: boolean;
  mtd: { rows: CompareRow[]; total: CompareRow };
  ytd: { rows: CompareRow[]; total: CompareRow };
};

function compareRow(row: MonthRow | YearRow): CompareRow {
  return {
    key: row.key,
    label: row.label,
    actual: row.actual,
    newClients: row.newClients,
    share: { listings: row.share.listings, pct: row.share.pct },
  };
}

// ── Reading it from the cache ───────────────────────────────────────────────

export type SalesDashboard = {
  report: SalesReport;
  sync: SalesSync;
  monthKey: string;
  /** The months the picker offers. */
  months: { min: string; max: string };
  markets: SalesMarket[];
  /** Null where the order cache does not reach back to the period. */
  compare: { mom: SalesComparison | null; yoy: SalesComparison | null };
};

export async function getSalesDashboard(params: {
  year: number;
  month: number;
  now?: number;
}): Promise<SalesDashboard> {
  const { year, month } = params;
  const now = params.now ?? Date.now();
  const yesterday = addDays(accountToday(now), -1);
  const sync = await getSalesSync();
  const floor = sync.historyFloor;
  // Last year too, for the comparisons.
  const earliest = `${year - 1}-01-01`;
  const through = minYmd(yesterday, monthEnd(year, month));
  const db = getAdminDb();

  const rows = await db
    .selectFrom("admin_sales_orders as o")
    .leftJoin("admin_sales_companies as c", "c.company_id", "o.company_id")
    .select(["o.order_day", "o.agent_id", "o.total_cents", "c.service_area"])
    .where("o.total_cents", ">", 0)
    .where("o.order_day", ">=", floor ? minYmd(floor, earliest) : earliest)
    .where("o.order_day", "<=", through)
    .execute();
  const orders: ReportOrder[] = [];
  const paid: PaidOrder[] = [];
  for (const row of rows) {
    const market = marketOf(row.service_area);
    orders.push({ day: row.order_day, marketKey: market.key, totalCents: row.total_cents });
    if (row.agent_id) {
      paid.push({ agentId: row.agent_id, day: row.order_day, marketKey: market.key });
    }
  }
  const markets = await listSalesMarkets();
  const holidays = new Set((await listSalesHolidays()).map((h) => h.day));

  // "Returning after 12 months" needs the twelve months before every order it
  // judges, so new clients start the year after the cache's floor. An agent's
  // new-client order depends only on orders before it, so one pass per year up
  // to the last day counted serves every period in that year.
  const floorYear = floor ? Number(floor.slice(0, 4)) : null;
  let priorPaid: Promise<Map<string, boolean>> | undefined;
  const clientsFor = async (y: number) => {
    if (floorYear === null || y <= floorYear) {
      return null;
    }
    priorPaid ??= db
      .selectFrom("admin_sales_agent_history")
      .select(["agent_id", "had_paid"])
      .execute()
      .then((history) => new Map(history.map((h) => [h.agent_id, h.had_paid === 1])));
    return classifyClients(paid, await priorPaid, {
      from: `${y}-01-01`,
      to: minYmd(through, `${y}-12-31`),
    });
  };

  const reportFor = async (y: number, m: number, throughDay: string): Promise<SalesReport> => {
    const clients = await clientsFor(y);
    return buildSalesReport({
      year: y,
      month: m,
      throughDay,
      orders,
      markets,
      goals: await listSalesGoals(y),
      listings: await listSalesListings(y),
      holidays,
      clientEvents: clients?.events ?? null,
      clientsPending: clients?.pendingAgents.length ?? 0,
    });
  };
  const report = await reportFor(year, month, through);

  /** `periodStart` is the earliest day the comparison reads: its month, or its year to date. */
  const comparison = async (
    y: number,
    m: number,
    periodStart: string,
  ): Promise<SalesComparison | null> => {
    if (!floor || periodStart < floor) {
      return null;
    }
    const prior = await reportFor(y, m, comparableThrough(report, y, m));
    return {
      year: y,
      month: m,
      monthStart: prior.monthStart,
      throughDay: prior.throughDay,
      complete: sync.coveredFrom !== null && sync.coveredFrom <= periodStart,
      mtd: { rows: prior.mtd.rows.map(compareRow), total: compareRow(prior.mtd.total) },
      ytd: { rows: prior.ytd.rows.map(compareRow), total: compareRow(prior.ytd.total) },
    };
  };
  const lastMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

  return {
    report,
    sync,
    monthKey: monthKey(year, month),
    months: {
      min: `${floor ? floor.slice(0, 4) : yesterday.slice(0, 4)}-01`,
      max: yesterday.slice(0, 7),
    },
    markets,
    compare: {
      mom: await comparison(lastMonth.y, lastMonth.m, monthStart(lastMonth.y, lastMonth.m)),
      yoy: await comparison(year - 1, month, `${year - 1}-01-01`),
    },
  };
}

// ── Goals ───────────────────────────────────────────────────────────────────

export async function listSalesGoals(year: number): Promise<SalesGoal[]> {
  const rows = await getAdminDb()
    .selectFrom("admin_sales_goals")
    .selectAll()
    .where("year", "=", year)
    .orderBy("month")
    .orderBy("market_label")
    .execute();
  return rows.map((r) => ({
    month: r.month,
    marketKey: r.market_key,
    marketLabel: r.market_label,
    units: r.units,
    revenueCents: r.revenue_cents,
    aspCents: r.asp_cents,
  }));
}

/**
 * Save one month's goals for the markets given; a row left blank clears that
 * market's goal. Markets not in the list sent keep what they had, so a goal
 * saved before a market stopped counting is still there.
 */
export async function saveSalesGoals(
  input: Record<string, unknown>,
  actorName: string,
  now: number,
): Promise<SalesGoal[]> {
  const year = wholeIn(input.year, 2000, 2100, "Year");
  const month = wholeIn(input.month, 1, 12, "Month");
  if (!Array.isArray(input.goals) || input.goals.length > 100) {
    throw new SalesInputError("goals must be a list of up to 100 markets.");
  }
  const known = new Map((await listSalesMarkets()).map((m) => [m.key, m]));
  const touched = new Set<string>();
  const entries: Array<{
    year: number;
    month: number;
    market_key: string;
    market_label: string;
    units: number;
    revenue_cents: number;
    asp_cents: number | null;
    updated_by: string;
    updated_at: number;
  }> = [];
  for (const raw of input.goals) {
    const goal = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    let key: string;
    let label: string;
    if (goal.marketKey === TOTAL_GOAL_KEY) {
      key = TOTAL_GOAL_KEY;
      label = TOTAL_GOAL_LABEL;
    } else {
      const named = typeof goal.marketLabel === "string" ? goal.marketLabel.trim() : "";
      const market = known.get(
        typeof goal.marketKey === "string" ? goal.marketKey : regionKey(named),
      );
      if (!market) {
        throw new SalesInputError(
          `"${named || String(goal.marketKey)}" is not on the market list. Add it under Markets first.`,
        );
      }
      if (!marketActiveIn(market, monthKey(year, month))) {
        throw new SalesInputError(`${market.label} is not tracked in ${monthKey(year, month)}.`);
      }
      key = market.key;
      label = market.label;
    }
    if (touched.has(key)) {
      throw new SalesInputError(`${label} is listed twice.`);
    }
    touched.add(key);
    const units = amount(goal.units, `${label} units`);
    if (units !== null && !Number.isInteger(units)) {
      throw new SalesInputError(`${label} units must be a whole number.`);
    }
    const revenue = amount(goal.revenue, `${label} revenue`);
    const asp = amount(goal.asp, `${label} ASP`);
    if (units === null && revenue === null && asp === null) {
      continue;
    }
    entries.push({
      year,
      month,
      market_key: key,
      market_label: label,
      units: units ?? 0,
      revenue_cents: Math.round((revenue ?? 0) * 100),
      asp_cents: asp === null ? null : Math.round(asp * 100),
      updated_by: actorName,
      updated_at: now,
    });
  }
  if (touched.size > 0) {
    await getAdminDb()
      .transaction()
      .execute(async (trx) => {
        await trx
          .deleteFrom("admin_sales_goals")
          .where("year", "=", year)
          .where("month", "=", month)
          .where("market_key", "in", [...touched])
          .execute();
        if (entries.length > 0) {
          await trx.insertInto("admin_sales_goals").values(entries).execute();
        }
      });
  }
  return listSalesGoals(year);
}

// ── Holidays ────────────────────────────────────────────────────────────────

export type SalesHoliday = { day: string; label: string };

export async function listSalesHolidays(): Promise<SalesHoliday[]> {
  return getAdminDb()
    .selectFrom("admin_sales_holidays")
    .select(["day", "label"])
    .orderBy("day")
    .execute();
}

export async function addSalesHoliday(
  input: Record<string, unknown>,
  actorName: string,
  now: number,
): Promise<SalesHoliday> {
  if (!isYmd(input.day)) {
    throw new SalesInputError("day must be a date, YYYY-MM-DD.");
  }
  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (!label || label.length > 80) {
    throw new SalesInputError("Name the holiday in up to 80 characters.");
  }
  const day = input.day;
  await getAdminDb()
    .insertInto("admin_sales_holidays")
    .values({ day, label, created_by: actorName, created_at: now })
    .onConflict((oc) => oc.column("day").doUpdateSet({ label }))
    .execute();
  return { day, label };
}

export async function deleteSalesHoliday(day: string): Promise<boolean> {
  const result = await getAdminDb()
    .deleteFrom("admin_sales_holidays")
    .where("day", "=", day)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}
