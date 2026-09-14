// Year-to-date orders and revenue per Spiro company, for the brokerage
// partnership page.
//
// Read from Spiro's reporting orders, which carry the company and the order
// total on every row. That endpoint caps a request at 31 days and 500 rows, so
// a year is a dozen windows of a few pages each — a sweep, not a page load —
// and what is kept is a per-company, per-month rollup the page sums.
//
// What counts (Steve, 2026-09-14): every order placed this calendar year except
// cancelled ones, at its order total, on the date it was placed. The whole year
// is re-read each time rather than resumed, because an order placed in March
// can be cancelled in September and a resumed read would never see it. The
// rollup is only replaced by a read that finished, so a failure leaves the last
// good totals standing.

import { callTool } from "../../../extensions/spiro/api.js";
import { getAdminDb } from "./user-store.js";

export type SpiroCall = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/** Spiro reads report dates in the account's timezone. */
const ACCOUNT_TIME_ZONE = "America/New_York";
const REPORTING_TOOL = "search_spiro_reporting_orders";
const PAGE_SIZE = 500;
const MAX_PAGES_PER_WINDOW = 40;
/** Spiro caps a reporting request at 31 days; stay inside it. */
const WINDOW_DAYS = 30;
const INSERT_CHUNK = 200;
const RETRY_DELAYS_MS: readonly number[] = [1000, 3000];
const SYNC_ID = "ytd";
const REFRESH_EVERY_MS = 6 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The first 200 characters of whatever came back, for an error message. */
function quote(value: unknown): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return (raw ?? String(value)).slice(0, 200);
}

/**
 * Unwrap an MCP reply: `{content:[{type:"text", text:"<json>"}]}` around
 * `{data:[...], meta:{...}}`. A reply with no list is an error, never an empty
 * page — a silently empty page would zero a brokerage's totals.
 */
export function unwrapSpiroList(result: unknown): {
  rows: Array<Record<string, unknown>>;
  meta: Record<string, unknown> | null;
} {
  let payload: unknown = result;
  const outer = asObject(result);
  const content = outer?.content;
  if (Array.isArray(content)) {
    const part = content.find(
      (c): c is { type: string; text: string } =>
        asObject(c)?.type === "text" && typeof asObject(c)?.text === "string",
    );
    if (part) {
      try {
        payload = JSON.parse(part.text) as unknown;
      } catch {
        throw new Error(`Spiro answered with something that is not JSON: ${quote(part.text)}`);
      }
    }
  }
  const obj = asObject(payload);
  if (!obj || !Array.isArray(obj.data)) {
    throw new Error(`Spiro answered without a list: ${quote(payload)}`);
  }
  return {
    rows: obj.data.filter((row): row is Record<string, unknown> => asObject(row) !== null),
    meta: asObject(obj.meta),
  };
}

// ── Dates ───────────────────────────────────────────────────────────────────

/** Today's `YYYY-MM-DD` where the Spiro account is. */
export function accountToday(now: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ACCOUNT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

export function accountYear(now: number): number {
  return Number(accountToday(now).slice(0, 4));
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** January 1 through `to`, in windows Spiro will accept. */
export function yearWindows(to: string): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  let cursor = `${to.slice(0, 4)}-01-01`;
  while (cursor <= to) {
    const end = addDays(cursor, WINDOW_DAYS - 1);
    const windowTo = end < to ? end : to;
    out.push({ from: cursor, to: windowTo });
    cursor = addDays(windowTo, 1);
  }
  return out;
}

// ── Rollup ──────────────────────────────────────────────────────────────────

export type CompanyMonth = {
  year: number;
  month: number;
  companyId: string;
  companyName: string;
  orders: number;
  revenueCents: number;
  cancelled: number;
};

/**
 * Fold reporting rows into per-company months. The month is read off the
 * order date's own text (`2026-08-15T15:12:34-04:00`), which Spiro writes in
 * the account's timezone — converting it would move a late-evening order into
 * the next month.
 */
export function rollupOrders(rows: Array<Record<string, unknown>>, year: number): CompanyMonth[] {
  const seen = new Set<string>();
  const months = new Map<string, CompanyMonth>();
  for (const row of rows) {
    const orderId = str(row.orderId);
    const company = asObject(row.company);
    const companyId = str(company?.id);
    const date = str(row.orderDate);
    const match = date ? /^(\d{4})-(\d{2})-/.exec(date) : null;
    if (!orderId || !companyId || !match || Number(match[1]) !== year || seen.has(orderId)) {
      continue;
    }
    seen.add(orderId);
    const month = Number(match[2]);
    const key = `${companyId}:${month}`;
    const entry = months.get(key) ?? {
      year,
      month,
      companyId,
      companyName: str(company?.name) ?? companyId,
      orders: 0,
      revenueCents: 0,
      cancelled: 0,
    };
    if (str(row.status)?.toLowerCase() === "cancelled") {
      entry.cancelled++;
    } else {
      entry.orders++;
      const total = typeof row.total === "number" && Number.isFinite(row.total) ? row.total : 0;
      entry.revenueCents += Math.round(total * 100);
    }
    months.set(key, entry);
  }
  return [...months.values()];
}

export type OrderSweepDeps = {
  call?: SpiroCall;
  now?: number;
  /** Pauses before each retry of a failed page; its length is the number of retries. */
  retryDelaysMs?: readonly number[];
};

export type OrderSweepResult = {
  year: number;
  coveredTo: string;
  ordersRead: number;
  companies: number;
};

async function readPage(
  call: SpiroCall,
  args: Record<string, unknown>,
  retryDelaysMs: readonly number[],
): Promise<ReturnType<typeof unwrapSpiroList>> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt - 1]));
    }
    try {
      return unwrapSpiroList(await call(REPORTING_TOOL, args));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function sweep(deps: OrderSweepDeps): Promise<OrderSweepResult> {
  const call = deps.call ?? callTool;
  const now = deps.now ?? Date.now();
  const retryDelays = deps.retryDelaysMs ?? RETRY_DELAYS_MS;
  const today = accountToday(now);
  const year = Number(today.slice(0, 4));
  const db = getAdminDb();

  try {
    const rows: Array<Record<string, unknown>> = [];
    for (const window of yearWindows(today)) {
      let resultSetAsOf: string | null = null;
      for (let page = 1; ; page++) {
        if (page > MAX_PAGES_PER_WINDOW) {
          throw new Error(`${window.from} to ${window.to} ran past ${MAX_PAGES_PER_WINDOW} pages`);
        }
        const args: Record<string, unknown> = {
          from: window.from,
          to: window.to,
          page,
          pageSize: PAGE_SIZE,
        };
        // Holding the snapshot steady stops a row shifting pages mid-read.
        if (resultSetAsOf) {
          args.resultSetAsOf = resultSetAsOf;
        }
        const { rows: pageRows, meta } = await readPage(call, args, retryDelays);
        rows.push(...pageRows);
        resultSetAsOf = resultSetAsOf ?? str(meta?.resultSetAsOf);
        const more = meta?.hasMoreData === true || meta?.hasNextPage === true;
        if (!more || pageRows.length === 0) {
          break;
        }
      }
    }

    const months = rollupOrders(rows, year);
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("admin_brokerage_company_months").where("year", "=", year).execute();
      for (let i = 0; i < months.length; i += INSERT_CHUNK) {
        await trx
          .insertInto("admin_brokerage_company_months")
          .values(
            months.slice(i, i + INSERT_CHUNK).map((m) => ({
              year: m.year,
              month: m.month,
              company_id: m.companyId,
              company_name: m.companyName,
              orders: m.orders,
              revenue_cents: m.revenueCents,
              cancelled: m.cancelled,
            })),
          )
          .execute();
      }
      await trx
        .insertInto("admin_brokerage_order_sync")
        .values({
          id: SYNC_ID,
          year,
          covered_to: today,
          orders_read: rows.length,
          refreshed_at: now,
          attempted_at: now,
          error: null,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            year,
            covered_to: today,
            orders_read: rows.length,
            refreshed_at: now,
            attempted_at: now,
            error: null,
          }),
        )
        .execute();
    });
    return {
      year,
      coveredTo: today,
      ordersRead: rows.length,
      companies: new Set(months.map((m) => m.companyId)).size,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The last good totals stay; only the failure is recorded beside them.
    await db
      .insertInto("admin_brokerage_order_sync")
      .values({
        id: SYNC_ID,
        year,
        covered_to: null,
        orders_read: 0,
        refreshed_at: null,
        attempted_at: now,
        error: message.slice(0, 500),
      })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({ attempted_at: now, error: message.slice(0, 500) }),
      )
      .execute();
    throw err;
  }
}

let inFlight: Promise<OrderSweepResult> | null = null;

/** Re-read this year's orders. A second caller while one is running joins it. */
export function refreshBrokerageOrders(deps: OrderSweepDeps = {}): Promise<OrderSweepResult> {
  if (!inFlight) {
    inFlight = sweep(deps).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export type BrokerageOrderSync = {
  year: number | null;
  coveredTo: string | null;
  ordersRead: number;
  refreshedAt: number | null;
  attemptedAt: number | null;
  error: string | null;
  running: boolean;
};

export async function getBrokerageOrderSync(): Promise<BrokerageOrderSync> {
  const row = await getAdminDb()
    .selectFrom("admin_brokerage_order_sync")
    .selectAll()
    .where("id", "=", SYNC_ID)
    .executeTakeFirst();
  return {
    year: row?.year ?? null,
    coveredTo: row?.covered_to ?? null,
    ordersRead: row?.orders_read ?? 0,
    refreshedAt: row?.refreshed_at ?? null,
    attemptedAt: row?.attempted_at ?? null,
    error: row?.error ?? null,
    running: inFlight !== null,
  };
}

/** Whether the stored totals are old enough, or from last year, to read again. */
export function needsRefresh(sync: BrokerageOrderSync, now: number): boolean {
  if (!sync.refreshedAt || sync.year !== accountYear(now)) {
    return true;
  }
  return now - sync.refreshedAt >= REFRESH_EVERY_MS;
}

let schedulerStarted = false;
export function ensureBrokerageOrderScheduler(): void {
  // Tests drive the sweep by hand with a fake Spiro; a live timer would reach
  // for the real one.
  if (schedulerStarted || process.env.VITEST) {
    return;
  }
  schedulerStarted = true;
  const tick = async () => {
    try {
      if (needsRefresh(await getBrokerageOrderSync(), Date.now())) {
        await refreshBrokerageOrders();
      }
    } catch {
      // Spiro not connected, or a transient failure — the error is on the sync
      // row for the page to show, and the next tick tries again.
    }
  };
  void tick();
  setInterval(() => void tick(), CHECK_INTERVAL_MS).unref();
}

// ── Company search ──────────────────────────────────────────────────────────

export type SpiroCompanyHit = {
  companyId: string;
  name: string;
  serviceArea: string | null;
  city: string | null;
  agentCount: number | null;
};

/** Active Spiro companies whose name contains `q`, for linking to an agreement. */
export async function searchSpiroCompanies(
  q: string,
  deps: { call?: SpiroCall } = {},
): Promise<SpiroCompanyHit[]> {
  const call = deps.call ?? callTool;
  const { rows } = unwrapSpiroList(
    await call("search_spiro_companies", { nameContains: q, deactivated: false, pageSize: 25 }),
  );
  const hits: SpiroCompanyHit[] = [];
  for (const row of rows) {
    const companyId = str(row.companyId);
    const name = str(row.name);
    if (!companyId || !name) {
      continue;
    }
    const address = asObject(row.address);
    const city = [str(address?.city), str(address?.stateOrProvince)].filter(Boolean).join(", ");
    hits.push({
      companyId,
      name,
      serviceArea: str(asObject(row.serviceArea)?.name),
      city: city || null,
      agentCount: typeof row.agentCount === "number" ? row.agentCount : null,
    });
  }
  return hits;
}
