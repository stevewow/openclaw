import { callTool, listTools } from "../../../extensions/spiro/api.js";
import { getAdminDb } from "./user-store.js";

// ── Cleveland investment model ─────────────────────────────────────────────
// A standalone P&L view for the Cleveland market. Revenue is Spiro order value
// for two photographers; costs are payroll (historical actuals + ongoing weekly
// wages) plus editing at a flat percentage of revenue. The view charts
// cumulative revenue vs cumulative cost and projects both weekly (run-rate) and
// cumulative breakeven from a linear revenue trend.

// Revenue comes from orders shot by these photographers (matched case-insensitively
// on the appointment photographer name).
export const CLEVELAND_PHOTOGRAPHERS = ["John Kickham", "Brandon Kralovic"];

// Ongoing weekly payroll — paid every week going forward (Fridays). Continues
// after each payee's last recorded historical payment below.
export const ONGOING_WAGES: Array<{ payee: string; weekly: number }> = [
  { payee: "Brandon Kralovic", weekly: 800 },
  { payee: "Taylor Thomas", weekly: 769.23 },
];

// Editing cost is a flat share of revenue.
export const EDITING_COST_RATE = 0.1;

// Payroll already paid (from QuickBooks). Dates normalized to YYYY-MM-DD (UTC).
export const PAST_EXPENSES: Array<{ date: string; payee: string; amount: number }> = [
  { date: "2026-04-14", payee: "John Kickham", amount: 800 },
  { date: "2026-04-21", payee: "John Kickham", amount: 800 },
  { date: "2026-04-28", payee: "John Kickham", amount: 800 },
  { date: "2026-05-08", payee: "John Kickham", amount: 960 },
  { date: "2026-05-20", payee: "Brandon Kralovic", amount: 800 },
  { date: "2026-05-26", payee: "Brandon Kralovic", amount: 800 },
  { date: "2026-06-02", payee: "Brandon Kralovic", amount: 800 },
  { date: "2026-06-09", payee: "Brandon Kralovic", amount: 800 },
  { date: "2026-06-15", payee: "Brandon Kralovic", amount: 800 },
  { date: "2026-06-23", payee: "Brandon Kralovic", amount: 800 },
  { date: "2026-07-01", payee: "Brandon Kralovic", amount: 800 },
  { date: "2026-07-07", payee: "Brandon Kralovic", amount: 800 },
  { date: "2026-04-17", payee: "Taylor Thomas", amount: 769.23 },
  { date: "2026-04-24", payee: "Taylor Thomas", amount: 769.23 },
  { date: "2026-05-01", payee: "Taylor Thomas", amount: 769.23 },
  { date: "2026-05-08", payee: "Taylor Thomas", amount: 769.23 },
  { date: "2026-05-15", payee: "Taylor Thomas", amount: 769.23 },
  { date: "2026-05-22", payee: "Taylor Thomas", amount: 769.23 },
  { date: "2026-05-29", payee: "Taylor Thomas", amount: 769.23 },
  { date: "2026-06-05", payee: "Taylor Thomas", amount: 769.23 },
  { date: "2026-06-12", payee: "Taylor Thomas", amount: 769.23 },
  { date: "2026-06-19", payee: "Taylor Thomas", amount: 769.23 },
  { date: "2026-06-26", payee: "Taylor Thomas", amount: 769.23 },
  { date: "2026-07-03", payee: "Taylor Thomas", amount: 769.23 },
];

// Earliest order-submitted date to scan for revenue (a little before the first
// payroll date so any order delivered in-window is captured).
const FETCH_FROM = "2026-03-01";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PROJECTION_WEEKS = 156; // 3 years — projection horizon for breakeven search.

// ── Date helpers (UTC, week anchored on Monday) ────────────────────────────
function parseYmd(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

function weekStartMs(ms: number): number {
  const d = new Date(ms);
  const dayFromMonday = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dayFromMonday * DAY_MS;
}

// ── Types ──────────────────────────────────────────────────────────────────
export type ClevelandWeek = {
  weekStart: number; // ms, Monday UTC
  revenue: number;
  cost: number;
  cumulativeRevenue: number;
  cumulativeCost: number;
  projected: boolean;
};

export type ClevelandInvestment = {
  refreshedAt: number | null;
  photographers: string[];
  ongoingWeeklyWage: number;
  weeks: ClevelandWeek[];
  summary: {
    totalRevenue: number; // actual, to date
    totalCost: number; // actual, to date
    net: number;
    latestWeeklyRevenue: number;
    latestWeeklyCost: number;
    trendSlopePerWeek: number;
    weeklyBreakevenWeek: number | null;
    totalBreakevenWeek: number | null;
    orderCount: number;
  };
};

type RevenueEvent = { deliveredAt: number; revenue: number };

// ── Pure computation ───────────────────────────────────────────────────────
function linearFit(points: Array<{ x: number; y: number }>): { slope: number; intercept: number } {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: points[0]!.y };
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  return { slope, intercept: (sy - slope * sx) / n };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeInvestment(params: {
  revenueEvents: RevenueEvent[];
  refreshedAt: number | null;
  orderCount: number;
  now: number;
}): ClevelandInvestment {
  const { revenueEvents, refreshedAt, orderCount, now } = params;
  const ongoingWeeklyWage = ONGOING_WAGES.reduce((s, w) => s + w.weekly, 0);

  // Actual revenue bucketed by delivered week.
  const actualRevenueByWeek = new Map<number, number>();
  for (const ev of revenueEvents) {
    const wk = weekStartMs(ev.deliveredAt);
    actualRevenueByWeek.set(wk, (actualRevenueByWeek.get(wk) ?? 0) + ev.revenue);
  }

  // Historical wages bucketed by week; track each ongoing payee's last-paid week
  // so projected wages resume the week after (no gap, no double-pay).
  const wageByWeek = new Map<number, number>();
  const lastPaidWeek = new Map<string, number>();
  for (const exp of PAST_EXPENSES) {
    const wk = weekStartMs(parseYmd(exp.date));
    wageByWeek.set(wk, (wageByWeek.get(wk) ?? 0) + exp.amount);
    lastPaidWeek.set(exp.payee, Math.max(lastPaidWeek.get(exp.payee) ?? 0, wk));
  }

  const currentWeek = weekStartMs(now);
  const firstWeek = Math.min(
    ...PAST_EXPENSES.map((e) => weekStartMs(parseYmd(e.date))),
    ...(revenueEvents.length
      ? revenueEvents.map((e) => weekStartMs(e.deliveredAt))
      : [currentWeek]),
  );

  // Trend from complete actual weeks only (a partial current week would drag it down).
  const fitPoints: Array<{ x: number; y: number }> = [];
  for (let wk = firstWeek; wk + WEEK_MS <= now; wk += WEEK_MS) {
    fitPoints.push({ x: (wk - firstWeek) / WEEK_MS, y: actualRevenueByWeek.get(wk) ?? 0 });
  }
  const { slope, intercept } = linearFit(fitPoints);

  const ongoingWageForWeek = (wk: number): number =>
    ONGOING_WAGES.reduce((s, w) => s + (wk > (lastPaidWeek.get(w.payee) ?? -1) ? w.weekly : 0), 0);

  const revenueForWeek = (wk: number, idx: number): number => {
    if (wk <= currentWeek) return actualRevenueByWeek.get(wk) ?? 0;
    return Math.max(0, slope * idx + intercept);
  };

  // Walk the full horizon to find breakevens; slice for display afterward.
  const allWeeks: ClevelandWeek[] = [];
  let cumRev = 0;
  let cumCost = 0;
  let weeklyBreakevenWeek: number | null = null;
  let totalBreakevenWeek: number | null = null;
  let totalRevenue = 0;
  let totalCost = 0;
  let latestWeeklyRevenue = 0;
  let latestWeeklyCost = 0;

  const horizonEnd = currentWeek + MAX_PROJECTION_WEEKS * WEEK_MS;
  let idx = 0;
  for (let wk = firstWeek; wk <= horizonEnd; wk += WEEK_MS, idx++) {
    const revenue = revenueForWeek(wk, idx);
    const wage = (wageByWeek.get(wk) ?? 0) + ongoingWageForWeek(wk);
    const cost = wage + EDITING_COST_RATE * revenue;
    cumRev += revenue;
    cumCost += cost;
    const projected = wk > currentWeek;

    if (!projected) {
      totalRevenue += revenue;
      totalCost += cost;
      if (wk + WEEK_MS <= now) {
        latestWeeklyRevenue = revenue;
        latestWeeklyCost = cost;
      }
    }
    if (weeklyBreakevenWeek === null && cost > 0 && revenue >= cost) weeklyBreakevenWeek = wk;
    if (totalBreakevenWeek === null && cumCost > 0 && cumRev >= cumCost) totalBreakevenWeek = wk;

    allWeeks.push({
      weekStart: wk,
      revenue: round2(revenue),
      cost: round2(cost),
      cumulativeRevenue: round2(cumRev),
      cumulativeCost: round2(cumCost),
      projected,
    });

    if (totalBreakevenWeek !== null && wk > totalBreakevenWeek) break; // enough to show the crossing
  }

  // Display window: through the total-breakeven crossing (+6wk buffer) when found,
  // otherwise a year of projection so the trend is visible.
  const currentIdx = Math.round((currentWeek - firstWeek) / WEEK_MS);
  let displayEndIdx: number;
  if (totalBreakevenWeek !== null) {
    displayEndIdx = Math.round((totalBreakevenWeek - firstWeek) / WEEK_MS) + 6;
  } else if (weeklyBreakevenWeek !== null) {
    displayEndIdx = Math.round((weeklyBreakevenWeek - firstWeek) / WEEK_MS) + 6;
  } else {
    displayEndIdx = currentIdx + 52;
  }
  const weeks = allWeeks.slice(0, Math.min(allWeeks.length, displayEndIdx + 1));

  return {
    refreshedAt,
    photographers: CLEVELAND_PHOTOGRAPHERS,
    ongoingWeeklyWage: round2(ongoingWeeklyWage),
    weeks,
    summary: {
      totalRevenue: round2(totalRevenue),
      totalCost: round2(totalCost),
      net: round2(totalRevenue - totalCost),
      latestWeeklyRevenue: round2(latestWeeklyRevenue),
      latestWeeklyCost: round2(latestWeeklyCost),
      trendSlopePerWeek: round2(slope),
      weeklyBreakevenWeek,
      totalBreakevenWeek,
      orderCount,
    },
  };
}

// ── Spiro order revenue ────────────────────────────────────────────────────
const PREFERRED_ORDERS_TOOL = "search_spiro_orders";
let ordersToolName: string | null = null;

async function resolveOrdersToolName(): Promise<string> {
  if (ordersToolName) return ordersToolName;
  const tools = await listTools();
  const match =
    tools.find((t) => t.name === PREFERRED_ORDERS_TOOL) ??
    tools.find((t) => /^search.*order/i.test(t.name)) ??
    tools.find((t) => /order/i.test(t.name));
  if (!match) {
    throw new Error("No Spiro order tool found. Run /spiro-auth to connect Spiro.");
  }
  ordersToolName = match.name;
  return match.name;
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function firstString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function firstNumber(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function parseDateMs(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) {
      const ms = Date.parse(v);
      if (Number.isFinite(ms)) return ms;
    }
  }
  return null;
}

// The appointment photographer name is the match key (OrderListItemModel →
// primaryAppointment: OrderAppointmentSummaryModel → photographer.name).
function extractPhotographer(raw: Record<string, unknown>): string | null {
  const appt = asObject(raw.primaryAppointment) ?? asObject(raw.appointment);
  const photog = appt ? asObject(appt.photographer) : null;
  return (
    (photog ? firstString(photog, ["name", "fullName", "displayName"]) : null) ??
    firstString(raw, ["photographerName", "photographer_name"])
  );
}

const CLEVELAND_KEYWORDS = ["kickham", "kralovic"];

function matchesCleveland(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return CLEVELAND_KEYWORDS.some((k) => n.includes(k));
}

function parsePagedOrdersResult(result: unknown): {
  orders: Array<Record<string, unknown>>;
  hasNextPage: boolean;
} {
  let payload: unknown = result;
  const obj = asObject(result);
  if (obj) {
    const content = (obj as { content?: Array<{ type: string; text?: string }> }).content;
    const textPart = content?.find((c) => c.type === "text")?.text;
    if (textPart) {
      try {
        payload = JSON.parse(textPart) as unknown;
      } catch {
        payload = obj;
      }
    }
  }
  if (Array.isArray(payload))
    return { orders: payload as Array<Record<string, unknown>>, hasNextPage: false };
  const p = asObject(payload);
  if (p) {
    for (const key of ["data", "orders", "items", "results"]) {
      const v = p[key];
      if (Array.isArray(v)) {
        const meta = asObject(p.meta);
        return {
          orders: v as Array<Record<string, unknown>>,
          hasNextPage: meta?.hasNextPage === true,
        };
      }
    }
  }
  return { orders: [], hasNextPage: false };
}

const PAGE_SIZE = 200;
const MAX_PAGES = 400; // 80k orders ceiling across the scan window.
const REFRESH_LOG_KEY = "cleveland";

export async function refreshClevelandOrders(opts: {
  manual: boolean;
}): Promise<{ count: number }> {
  const toolName = await resolveOrdersToolName();
  const to = new Date(Date.now() + DAY_MS).toISOString().slice(0, 10);

  type Cached = { orderId: string; photographer: string; revenue: number; deliveredAt: number };
  const byId = new Map<string, Cached>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await callTool(toolName, {
      dateSubmittedFrom: FETCH_FROM,
      dateSubmittedTo: to,
      page,
      pageSize: PAGE_SIZE,
    });
    const { orders, hasNextPage } = parsePagedOrdersResult(result);
    for (const raw of orders) {
      const photographer = extractPhotographer(raw);
      if (!matchesCleveland(photographer)) continue;
      const deliveredAt = parseDateMs(raw, ["deliveredAt", "delivered_at"]);
      if (deliveredAt === null) continue; // revenue recognized on delivery only
      const orderId = firstString(raw, ["orderId", "order_id", "id"]);
      if (!orderId) continue;
      const revenue =
        firstNumber(raw, ["totalSalePrice", "total_sale_price", "total", "totalPrice"]) ?? 0;
      byId.set(orderId, { orderId, photographer: photographer!, revenue, deliveredAt });
    }
    if (!hasNextPage || orders.length === 0) break;
  }

  const cached = [...byId.values()];
  const db = getAdminDb();
  const now = Date.now();
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("admin_cleveland_orders").execute();
    for (let i = 0; i < cached.length; i += PAGE_SIZE) {
      await trx
        .insertInto("admin_cleveland_orders")
        .values(
          cached.slice(i, i + PAGE_SIZE).map((o) => ({
            order_id: o.orderId,
            photographer: o.photographer,
            revenue: o.revenue,
            delivered_at: o.deliveredAt,
            cached_at: now,
          })),
        )
        .execute();
    }
  });

  await db
    .insertInto("admin_cleveland_refresh_log")
    .values({ id: REFRESH_LOG_KEY, refreshed_at: now, manual: opts.manual ? 1 : 0 })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({ refreshed_at: now, manual: opts.manual ? 1 : 0 }),
    )
    .execute();

  return { count: cached.length };
}

export async function getClevelandInvestment(now = Date.now()): Promise<ClevelandInvestment> {
  const db = getAdminDb();
  const rows = await db.selectFrom("admin_cleveland_orders").selectAll().execute();
  const log = await db
    .selectFrom("admin_cleveland_refresh_log")
    .selectAll()
    .where("id", "=", REFRESH_LOG_KEY)
    .executeTakeFirst();
  return computeInvestment({
    revenueEvents: rows.map((r) => ({ deliveredAt: r.delivered_at, revenue: r.revenue })),
    refreshedAt: log?.refreshed_at ?? null,
    orderCount: rows.length,
    now,
  });
}

// ── Scheduler ──────────────────────────────────────────────────────────────
let schedulerStarted = false;
export function ensureClevelandScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
  const STALE_MS = 6 * 60 * 60 * 1000;
  const tick = async () => {
    try {
      const db = getAdminDb();
      const log = await db
        .selectFrom("admin_cleveland_refresh_log")
        .selectAll()
        .where("id", "=", REFRESH_LOG_KEY)
        .executeTakeFirst();
      if (!log?.refreshed_at || Date.now() - log.refreshed_at > STALE_MS) {
        await refreshClevelandOrders({ manual: false });
      }
    } catch {
      // Spiro not connected yet, or transient failure — retry next tick.
    }
  };
  void tick();
  setInterval(() => void tick(), CHECK_INTERVAL_MS).unref();
}
