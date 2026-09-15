// The sales dashboard: each market's goals against what it has booked, for a
// month and the year to it, with the pace the month and the year are on.
//
// What counts (reconciled against the August 2026 sheet to within 1%): every
// order placed in the period whose total is above $0, in the market of the
// order's company — Spiro's service area on that company. Cancelled orders are
// $0 in Spiro, so the $0 scrub drops them too.
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

import { accountToday } from "./brokerage-orders.js";
import { regionKey, regionLabel } from "./focus-regions.js";
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
import { getSalesSync, type SalesSync } from "./sales-orders.js";
import { getAdminDb } from "./user-store.js";

export const UNASSIGNED_MARKET = "unassigned";
/** The goal row for the company as a whole, rather than any one market. */
export const TOTAL_GOAL_KEY = "total";
const TOTAL_GOAL_LABEL = "Company total";

export class SalesInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesInputError";
  }
}

/** "Fort Wayne, Indiana" → fort wayne / Fort Wayne; no service area → Unassigned. */
export function marketOf(serviceArea: string | null | undefined): { key: string; label: string } {
  const key = regionKey(serviceArea);
  return key
    ? { key, label: regionLabel(serviceArea) }
    : { key: UNASSIGNED_MARKET, label: "Unassigned" };
}

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

export type MonthRow = {
  key: string;
  label: string;
  goal: Measures & { unitsPerDay: number | null };
  actual: Measures;
  pct: { units: number | null; revenue: number | null; asp: number | null };
  newClients: NewClients | null;
  trend: Trend;
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
  orders: readonly ReportOrder[];
  marketLabels: ReadonlyMap<string, string>;
  goals: readonly SalesGoal[];
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

function bumpClients(map: Map<string, NewClients>, event: ClientEvent): void {
  const c = map.get(event.marketKey) ?? { first: 0, returning: 0 };
  if (event.kind === "first") {
    c.first++;
  } else {
    c.returning++;
  }
  map.set(event.marketKey, c);
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

  const labels = new Map(input.marketLabels);
  const mtd = new Map<string, Tally>();
  const ytd = new Map<string, Tally>();
  for (const order of input.orders) {
    if (!(order.totalCents > 0) || order.day < yStart || order.day > through) {
      continue;
    }
    const one = { units: 1, revenueCents: order.totalCents };
    bump(ytd, order.marketKey, one);
    if (order.day >= mStart) {
      bump(mtd, order.marketKey, one);
    }
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
    if (!labels.has(goal.marketKey)) {
      labels.set(goal.marketKey, goal.marketLabel);
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

  const monthClients = new Map<string, NewClients>();
  const yearClients = new Map<string, NewClients>();
  for (const event of input.clientEvents ?? []) {
    if (event.day < yStart || event.day > through) {
      continue;
    }
    bumpClients(yearClients, event);
    if (event.day >= mStart) {
      bumpClients(monthClients, event);
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
  });
  const yearRow = (
    key: string,
    label: string,
    actual: Tally,
    goalToDate: Tally,
    annualGoal: Tally,
    clients: NewClients | null,
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
  });

  // Every market with an order this year or a goal this year, Unassigned last.
  const keys = [...new Set([...ytd.keys(), ...annual.keys()])].toSorted((a, b) => {
    if (a === UNASSIGNED_MARKET || b === UNASSIGNED_MARKET) {
      return a === UNASSIGNED_MARKET ? 1 : -1;
    }
    return (labels.get(a) ?? a).localeCompare(labels.get(b) ?? b);
  });

  const mtdRows: MonthRow[] = [];
  const ytdRows: YearRow[] = [];
  const mtdSum = { units: 0, revenueCents: 0 };
  const ytdSum = { units: 0, revenueCents: 0 };
  const monthClientSum = { first: 0, returning: 0 };
  const yearClientSum = { first: 0, returning: 0 };
  for (const key of keys) {
    const label = labels.get(key) ?? key;
    const goal = monthGoals.get(key);
    const goalTally = goal ? { units: goal.units, revenueCents: goal.revenueCents } : ZERO;
    const goalAsp = goal ? (goal.aspCents ?? averageCents(goalTally)) : null;
    const mClients = counted ? (monthClients.get(key) ?? { first: 0, returning: 0 }) : null;
    const yClients = counted ? (yearClients.get(key) ?? { first: 0, returning: 0 }) : null;
    mtdRows.push(monthRow(key, label, mtd.get(key) ?? ZERO, goalTally, goalAsp, mClients));
    ytdRows.push(
      yearRow(
        key,
        label,
        ytd.get(key) ?? ZERO,
        toDate.get(key) ?? ZERO,
        annual.get(key) ?? ZERO,
        yClients,
      ),
    );
    addInto(mtdSum, mtd.get(key) ?? ZERO);
    addInto(ytdSum, ytd.get(key) ?? ZERO);
    monthClientSum.first += mClients?.first ?? 0;
    monthClientSum.returning += mClients?.returning ?? 0;
    yearClientSum.first += yClients?.first ?? 0;
    yearClientSum.returning += yClients?.returning ?? 0;
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
      ),
    },
    clientsPending: input.clientsPending,
  };
}

// ── Reading it from the cache ───────────────────────────────────────────────

export type SalesDashboard = {
  report: SalesReport;
  sync: SalesSync;
  monthKey: string;
  /** The months the picker offers. */
  months: { min: string; max: string };
};

export async function getSalesDashboard(params: {
  year: number;
  month: number;
  now?: number;
}): Promise<SalesDashboard> {
  const now = params.now ?? Date.now();
  const yesterday = addDays(accountToday(now), -1);
  const sync = await getSalesSync();
  const floor = sync.historyFloor;
  const yStart = `${params.year}-01-01`;
  const through = minYmd(yesterday, monthEnd(params.year, params.month));
  const db = getAdminDb();

  const rows = await db
    .selectFrom("admin_sales_orders as o")
    .leftJoin("admin_sales_companies as c", "c.company_id", "o.company_id")
    .select(["o.order_day", "o.agent_id", "o.total_cents", "c.service_area"])
    .where("o.total_cents", ">", 0)
    .where("o.order_day", ">=", floor ? minYmd(floor, yStart) : yStart)
    .where("o.order_day", "<=", through)
    .execute();
  const labels = new Map<string, string>();
  const orders: ReportOrder[] = [];
  const paid: PaidOrder[] = [];
  for (const row of rows) {
    const market = marketOf(row.service_area);
    labels.set(market.key, market.label);
    orders.push({ day: row.order_day, marketKey: market.key, totalCents: row.total_cents });
    if (row.agent_id) {
      paid.push({ agentId: row.agent_id, day: row.order_day, marketKey: market.key });
    }
  }

  // "Returning after 12 months" needs the twelve months before every order it
  // judges, so new clients start the year after the cache's floor.
  let clientEvents: ClientEvent[] | null = null;
  let clientsPending = 0;
  if (floor && params.year > Number(floor.slice(0, 4))) {
    const history = await db
      .selectFrom("admin_sales_agent_history")
      .select(["agent_id", "had_paid"])
      .execute();
    const prior = new Map(history.map((h) => [h.agent_id, h.had_paid === 1]));
    const result = classifyClients(paid, prior, { from: yStart, to: through });
    clientEvents = result.events;
    clientsPending = result.pendingAgents.length;
  }

  const report = buildSalesReport({
    year: params.year,
    month: params.month,
    throughDay: through,
    orders,
    marketLabels: labels,
    goals: await listSalesGoals(params.year),
    holidays: new Set((await listSalesHolidays()).map((h) => h.day)),
    clientEvents,
    clientsPending,
  });
  return {
    report,
    sync,
    monthKey: monthKey(params.year, params.month),
    months: {
      min: `${floor ? floor.slice(0, 4) : yesterday.slice(0, 4)}-01`,
      max: yesterday.slice(0, 7),
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

function wholeIn(value: unknown, min: number, max: number, what: string): number {
  const n =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new SalesInputError(`${what} must be a whole number from ${min} to ${max}.`);
  }
  return n;
}

/** A non-negative amount; blank reads as nothing entered. Accepts "$1,234.50". */
function amount(value: unknown, what: string): number | null {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
    return null;
  }
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[$,\s]/g, ""))
        : Number.NaN;
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
    throw new SalesInputError(`${what} must be a number of zero or more.`);
  }
  return n;
}

/** The markets the goal editor offers: any with an order since last year, or a goal this year. */
export async function listSalesMarkets(
  year: number,
): Promise<Array<{ key: string; label: string }>> {
  const areas = await getAdminDb()
    .selectFrom("admin_sales_orders as o")
    .innerJoin("admin_sales_companies as c", "c.company_id", "o.company_id")
    .select("c.service_area")
    .distinct()
    .where("c.service_area", "is not", null)
    .where("o.order_day", ">=", `${year - 1}-01-01`)
    .execute();
  const out = new Map<string, string>();
  for (const a of areas) {
    const market = marketOf(a.service_area);
    if (market.key !== UNASSIGNED_MARKET) {
      out.set(market.key, market.label);
    }
  }
  for (const goal of await listSalesGoals(year)) {
    if (goal.marketKey !== TOTAL_GOAL_KEY) {
      out.set(goal.marketKey, out.get(goal.marketKey) ?? goal.marketLabel);
    }
  }
  return [...out.entries()]
    .map(([key, label]) => ({ key, label }))
    .toSorted((a, b) => a.label.localeCompare(b.label));
}

/** Replace one month's goals with the ones given. A row left blank is no goal. */
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
  const entries = new Map<
    string,
    {
      year: number;
      month: number;
      market_key: string;
      market_label: string;
      units: number;
      revenue_cents: number;
      asp_cents: number | null;
      updated_by: string;
      updated_at: number;
    }
  >();
  for (const raw of input.goals) {
    const goal = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const isTotal = goal.marketKey === TOTAL_GOAL_KEY;
    const label = isTotal
      ? TOTAL_GOAL_LABEL
      : typeof goal.marketLabel === "string"
        ? goal.marketLabel.trim()
        : "";
    const key = isTotal ? TOTAL_GOAL_KEY : regionKey(label);
    if (!label || label.length > 60 || !key) {
      throw new SalesInputError("Every goal needs a market name of up to 60 characters.");
    }
    if (!isTotal && (key === TOTAL_GOAL_KEY || key === UNASSIGNED_MARKET)) {
      throw new SalesInputError(`"${label}" is not a market name that can hold a goal.`);
    }
    const units = amount(goal.units, `${label} units`);
    if (units !== null && !Number.isInteger(units)) {
      throw new SalesInputError(`${label} units must be a whole number.`);
    }
    const revenue = amount(goal.revenue, `${label} revenue`);
    const asp = amount(goal.asp, `${label} ASP`);
    if (units === null && revenue === null && asp === null) {
      continue;
    }
    if (entries.has(key)) {
      throw new SalesInputError(`${label} is listed twice.`);
    }
    entries.set(key, {
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
  await getAdminDb()
    .transaction()
    .execute(async (trx) => {
      await trx
        .deleteFrom("admin_sales_goals")
        .where("year", "=", year)
        .where("month", "=", month)
        .execute();
      if (entries.size > 0) {
        await trx
          .insertInto("admin_sales_goals")
          .values([...entries.values()])
          .execute();
      }
    });
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
