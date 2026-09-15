// Spiro orders for the sales dashboard, cached one row per order under the day
// it was placed.
//
// Read from Spiro's reporting orders, which carry the order total, status,
// agent and company on every row. Every order is kept, $0 ones included: what
// the dashboard counts is decided when it reads (sales-dashboard.ts), so
// changing that rule never needs a re-read.
//
// Coverage is one unbroken span of days, [covered_from, covered_to], read to the
// end. The first run reads newest-first back to January 1 of the previous year
// — the floor — committing a week at a time, so this month shows up in minutes
// and a read that breaks partway resumes where it stopped. Later runs re-read
// the trailing 45 days, where edits and cancellations land, and the current year
// once a week.
//
// After the orders: the service area of any company not seen before (that is
// the market), then the older order history new clients are judged against
// (sales-clients.ts).

import { callTool } from "../../../extensions/spiro/api.js";
import { accountToday } from "./brokerage-orders.js";
import { addDays, dayCount, maxYmd, minYmd } from "./sales-calendar.js";
import { CLIENT_PROBES_PER_RUN, resolveClientHistory } from "./sales-clients.js";
import {
  asObject,
  callSpiro,
  quote,
  sleep,
  type SpiroCall,
  type SpiroIo,
  SpiroReadError,
  str,
} from "./sales-spiro.js";
import { getAdminDb } from "./user-store.js";

const REPORTING_TOOL = "search_spiro_reporting_orders";
const COMPANY_TOOL = "get_spiro_company";
const SYNC_ID = "orders";
/** Days one read asks for before a timeout makes it ask for fewer. */
const CHUNK_DAYS = 7;
const PAGE_SIZE = 500;
/** A single day at this page size has always answered, even when wider reads time out. */
const SMALL_PAGE_SIZE = 100;
const MAX_PAGES = 60;
export const RECENT_DAYS = 45;
const YEAR_REREAD_MS = 7 * 24 * 60 * 60 * 1000;
const COMPANY_LOOKUPS_PER_RUN = 200;
const INSERT_CHUNK = 200;
const REFRESH_EVERY_MS = 2 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export type SalesOrderRow = {
  order_id: string;
  order_day: string;
  agent_id: string | null;
  agent_name: string | null;
  company_id: string | null;
  company_name: string | null;
  status: string;
  total_cents: number;
};

/**
 * One reporting row. The day is read off the order date's own text
 * (`2026-08-01T00:15:26-04:00`), which Spiro writes in the account's timezone.
 */
export function toOrderRow(raw: Record<string, unknown>): SalesOrderRow | null {
  const orderId = str(raw.orderId);
  const date = str(raw.orderDate);
  const day = date ? date.slice(0, 10) : null;
  if (!orderId || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return null;
  }
  const agent = asObject(raw.agent);
  const company = asObject(raw.company);
  const total = typeof raw.total === "number" && Number.isFinite(raw.total) ? raw.total : 0;
  return {
    order_id: orderId,
    order_day: day,
    agent_id: str(agent?.id),
    agent_name: str(agent?.name),
    company_id: str(company?.id),
    company_name: str(company?.name),
    status: (str(raw.status) ?? "unknown").toLowerCase(),
    total_cents: Math.round(total * 100),
  };
}

// ── Planning ────────────────────────────────────────────────────────────────

export type Coverage = {
  historyFloor: string;
  coveredFrom: string | null;
  coveredTo: string | null;
  yearReadAt: number | null;
};

export type SweepSpan = { kind: "recent" | "backfill" | "year"; from: string; to: string };

/** What a run reads, in the order it reads it. */
export function planSpans(coverage: Coverage, today: string, now: number): SweepSpan[] {
  const floor = coverage.historyFloor;
  if (!coverage.coveredFrom || !coverage.coveredTo) {
    return [{ kind: "backfill", from: floor, to: today }];
  }
  const spans: SweepSpan[] = [];
  // Reaching back to covered_to as well keeps coverage unbroken after a long
  // stretch with no runs.
  const recentFrom = maxYmd(floor, minYmd(addDays(today, -(RECENT_DAYS - 1)), coverage.coveredTo));
  spans.push({ kind: "recent", from: recentFrom, to: today });
  if (coverage.coveredFrom > floor) {
    spans.push({ kind: "backfill", from: floor, to: addDays(coverage.coveredFrom, -1) });
  }
  const yearFrom = maxYmd(floor, `${today.slice(0, 4)}-01-01`);
  const yearDue = !coverage.yearReadAt || now - coverage.yearReadAt >= YEAR_REREAD_MS;
  if (yearDue && yearFrom < recentFrom) {
    spans.push({ kind: "year", from: yearFrom, to: addDays(recentFrom, -1) });
  }
  return spans;
}

/** Newest first, so the days people look at land before the ones they rarely do. */
export function chunksNewestFirst(
  from: string,
  to: string,
  size: number = CHUNK_DAYS,
): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  let end = to;
  while (end >= from) {
    const start = maxYmd(from, addDays(end, -(size - 1)));
    out.push({ from: start, to: end });
    end = addDays(start, -1);
  }
  return out;
}

/**
 * Join a freshly read span onto the covered one. A span that neither overlaps
 * nor touches it cannot extend it; the newer of the two is kept, and the
 * backfill will fill the gap.
 */
export function extendCoverage(
  coverage: { coveredFrom: string | null; coveredTo: string | null },
  from: string,
  to: string,
): { coveredFrom: string; coveredTo: string } {
  if (!coverage.coveredFrom || !coverage.coveredTo) {
    return { coveredFrom: from, coveredTo: to };
  }
  const touches = from <= addDays(coverage.coveredTo, 1) && to >= addDays(coverage.coveredFrom, -1);
  if (!touches) {
    return to > coverage.coveredTo
      ? { coveredFrom: from, coveredTo: to }
      : { coveredFrom: coverage.coveredFrom, coveredTo: coverage.coveredTo };
  }
  return {
    coveredFrom: minYmd(from, coverage.coveredFrom),
    coveredTo: maxYmd(to, coverage.coveredTo),
  };
}

// ── Reading ─────────────────────────────────────────────────────────────────

async function readPages(
  io: SpiroIo,
  from: string,
  to: string,
  pageSize: number,
): Promise<SalesOrderRow[]> {
  const rows: SalesOrderRow[] = [];
  let resultSetAsOf: string | null = null;
  for (let page = 1; ; page++) {
    if (page > MAX_PAGES) {
      throw new SpiroReadError(`${from} to ${to} ran past ${MAX_PAGES} pages`, "other");
    }
    const args: Record<string, unknown> = { from, to, page, pageSize };
    // Holding the snapshot steady stops a row shifting pages mid-read.
    if (resultSetAsOf) {
      args.resultSetAsOf = resultSetAsOf;
    }
    const { data, meta } = await callSpiro(io, REPORTING_TOOL, args);
    if (!Array.isArray(data)) {
      throw new SpiroReadError(`Spiro answered without an order list: ${quote(data)}`, "other");
    }
    for (const raw of data) {
      const obj = asObject(raw);
      const row = obj ? toOrderRow(obj) : null;
      if (row) {
        rows.push(row);
      }
    }
    resultSetAsOf = resultSetAsOf ?? str(meta?.resultSetAsOf);
    const more = meta?.hasMoreData === true || meta?.hasNextPage === true;
    if (!more || data.length === 0) {
      return rows;
    }
  }
}

/**
 * One span of days. Spiro times out on a wide span at a large page size, so a
 * timeout first retries with smaller pages, then halves the span, down to a
 * single day.
 */
export async function readSpan(
  io: SpiroIo,
  from: string,
  to: string,
  pageSize: number = PAGE_SIZE,
): Promise<SalesOrderRow[]> {
  try {
    return await readPages(io, from, to, pageSize);
  } catch (err) {
    if (!(err instanceof SpiroReadError) || err.kind !== "timeout") {
      throw err;
    }
    if (pageSize > SMALL_PAGE_SIZE) {
      return readSpan(io, from, to, SMALL_PAGE_SIZE);
    }
    const days = dayCount(from, to);
    if (days <= 1) {
      throw err;
    }
    const firstEnd = addDays(from, Math.floor(days / 2) - 1);
    const first = await readSpan(io, from, firstEnd, pageSize);
    const second = await readSpan(io, addDays(firstEnd, 1), to, pageSize);
    return [...first, ...second];
  }
}

// ── Storing ─────────────────────────────────────────────────────────────────

async function loadCoverage(now: number): Promise<Coverage> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_sales_sync")
    .selectAll()
    .where("id", "=", SYNC_ID)
    .executeTakeFirst();
  if (row) {
    return {
      historyFloor: row.history_floor,
      coveredFrom: row.covered_from,
      coveredTo: row.covered_to,
      yearReadAt: row.year_read_at,
    };
  }
  const floor = `${Number(accountToday(now).slice(0, 4)) - 1}-01-01`;
  await db
    .insertInto("admin_sales_sync")
    .values({
      id: SYNC_ID,
      history_floor: floor,
      covered_from: null,
      covered_to: null,
      year_read_at: null,
      refreshed_at: null,
      attempted_at: null,
      orders_read: 0,
      error: null,
    })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  return { historyFloor: floor, coveredFrom: null, coveredTo: null, yearReadAt: null };
}

/** Replace a span's orders with what was just read, and extend coverage with it. */
async function commitSpan(
  from: string,
  to: string,
  rows: readonly SalesOrderRow[],
  coverage: Coverage,
): Promise<Coverage> {
  const inSpan = new Map<string, SalesOrderRow>();
  for (const row of rows) {
    if (row.order_day >= from && row.order_day <= to) {
      inSpan.set(row.order_id, row);
    }
  }
  const list = [...inSpan.values()];
  const next = extendCoverage(coverage, from, to);
  await getAdminDb()
    .transaction()
    .execute(async (trx) => {
      await trx
        .deleteFrom("admin_sales_orders")
        .where("order_day", ">=", from)
        .where("order_day", "<=", to)
        .execute();
      for (let i = 0; i < list.length; i += INSERT_CHUNK) {
        const chunk = list.slice(i, i + INSERT_CHUNK);
        // An order is placed once, but clear its id wherever else it sits so a
        // changed date can never count it twice.
        await trx
          .deleteFrom("admin_sales_orders")
          .where(
            "order_id",
            "in",
            chunk.map((r) => r.order_id),
          )
          .execute();
        await trx.insertInto("admin_sales_orders").values(chunk).execute();
      }
      await trx
        .updateTable("admin_sales_sync")
        .set({ covered_from: next.coveredFrom, covered_to: next.coveredTo })
        .where("id", "=", SYNC_ID)
        .execute();
    });
  return { ...coverage, ...next };
}

/**
 * The service area of every company an order names that has not been looked up.
 * The Sales Focus report has already swept most of them, so its cache is the
 * first stop; companies created since are asked of Spiro one at a time.
 */
async function fillCompanies(io: SpiroIo, now: number): Promise<number> {
  const db = getAdminDb();
  const missing = await db
    .selectFrom("admin_sales_orders as o")
    .leftJoin("admin_sales_companies as c", "c.company_id", "o.company_id")
    .select(["o.company_id", "o.company_name"])
    .where("o.company_id", "is not", null)
    .where("c.company_id", "is", null)
    .groupBy("o.company_id")
    .execute();
  const nameById = new Map<string, string | null>();
  for (const m of missing) {
    if (m.company_id) {
      nameById.set(m.company_id, m.company_name);
    }
  }
  const ids = [...nameById.keys()];
  if (ids.length === 0) {
    return 0;
  }

  const known = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const seeded = await db
      .selectFrom("admin_focus_companies")
      .select(["company_id", "name", "region", "cached_at"])
      .where("company_id", "in", ids.slice(i, i + 500))
      .execute();
    if (seeded.length > 0) {
      await db
        .insertInto("admin_sales_companies")
        .values(
          seeded.map((s) => ({
            company_id: s.company_id,
            name: s.name,
            service_area: s.region,
            checked_at: s.cached_at,
          })),
        )
        .onConflict((oc) => oc.column("company_id").doNothing())
        .execute();
    }
    for (const s of seeded) {
      known.add(s.company_id);
    }
  }

  let lookedUp = 0;
  for (const id of ids) {
    if (known.has(id)) {
      continue;
    }
    if (lookedUp >= COMPANY_LOOKUPS_PER_RUN) {
      break;
    }
    lookedUp++;
    let name = nameById.get(id) ?? null;
    let serviceArea: string | null = null;
    try {
      const { data } = await callSpiro(io, COMPANY_TOOL, { companyId: id });
      const company = asObject(data);
      serviceArea = str(asObject(company?.serviceArea)?.name);
      name = str(company?.name) ?? name;
    } catch (err) {
      if (err instanceof SpiroReadError && err.kind === "rate_limited") {
        throw err;
      }
      // A company Spiro no longer has is stored without a market so it is not
      // asked about again; any other failure waits for the next run.
      if (!(err instanceof SpiroReadError && err.kind === "not_found")) {
        continue;
      }
    }
    await db
      .insertInto("admin_sales_companies")
      .values({ company_id: id, name, service_area: serviceArea, checked_at: now })
      .onConflict((oc) =>
        oc.column("company_id").doUpdateSet({ name, service_area: serviceArea, checked_at: now }),
      )
      .execute();
  }
  return lookedUp;
}

// ── The run ─────────────────────────────────────────────────────────────────

export type SalesSweepDeps = {
  call?: SpiroCall;
  now?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Agents whose older history one run may ask Spiro about. */
  clientBudget?: number;
};

export type SalesSweepResult = {
  ordersRead: number;
  spans: SweepSpan[];
  companiesLookedUp: number;
  clientsChecked: number;
  clientsPending: number;
  calls: number;
};

async function sweep(deps: SalesSweepDeps): Promise<SalesSweepResult> {
  const io: SpiroIo = { call: deps.call ?? callTool, sleep: deps.sleep ?? sleep, calls: 0 };
  const now = deps.now ?? Date.now();
  const today = accountToday(now);
  const db = getAdminDb();
  let coverage = await loadCoverage(now);
  await db
    .updateTable("admin_sales_sync")
    .set({ attempted_at: now })
    .where("id", "=", SYNC_ID)
    .execute();

  let ordersRead = 0;
  try {
    const spans = planSpans(coverage, today, now);
    for (const span of spans) {
      for (const chunk of chunksNewestFirst(span.from, span.to)) {
        const rows = await readSpan(io, chunk.from, chunk.to);
        coverage = await commitSpan(chunk.from, chunk.to, rows, coverage);
        ordersRead += rows.length;
      }
      // A finished backfill has read this year as well as a yearly re-read does.
      if (span.kind !== "recent") {
        coverage = { ...coverage, yearReadAt: now };
        await db
          .updateTable("admin_sales_sync")
          .set({ year_read_at: now })
          .where("id", "=", SYNC_ID)
          .execute();
      }
    }
    const companiesLookedUp = await fillCompanies(io, now);
    await db
      .updateTable("admin_sales_sync")
      .set({ refreshed_at: now, orders_read: ordersRead, error: null })
      .where("id", "=", SYNC_ID)
      .execute();
    const clients = await resolveClientHistory(io, coverage.historyFloor, {
      budget: deps.clientBudget ?? CLIENT_PROBES_PER_RUN,
      now,
    });
    return {
      ordersRead,
      spans,
      companiesLookedUp,
      clientsChecked: clients.checked,
      clientsPending: clients.pending,
      calls: io.calls,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Every week already committed stays; only the failure is recorded.
    await db
      .updateTable("admin_sales_sync")
      .set({ error: message.slice(0, 500) })
      .where("id", "=", SYNC_ID)
      .execute();
    throw err;
  }
}

let inFlight: Promise<SalesSweepResult> | null = null;

/** Read Spiro now. A second caller while one is running joins it. */
export function refreshSalesData(deps: SalesSweepDeps = {}): Promise<SalesSweepResult> {
  if (!inFlight) {
    inFlight = sweep(deps).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export type SalesSync = {
  historyFloor: string | null;
  coveredFrom: string | null;
  coveredTo: string | null;
  refreshedAt: number | null;
  attemptedAt: number | null;
  ordersRead: number;
  error: string | null;
  running: boolean;
};

export async function getSalesSync(): Promise<SalesSync> {
  const row = await getAdminDb()
    .selectFrom("admin_sales_sync")
    .selectAll()
    .where("id", "=", SYNC_ID)
    .executeTakeFirst();
  return {
    historyFloor: row?.history_floor ?? null,
    coveredFrom: row?.covered_from ?? null,
    coveredTo: row?.covered_to ?? null,
    refreshedAt: row?.refreshed_at ?? null,
    attemptedAt: row?.attempted_at ?? null,
    ordersRead: row?.orders_read ?? 0,
    error: row?.error ?? null,
    running: inFlight !== null,
  };
}

/** Whether the scheduler should start a run: stale, never read, and not just failed. */
export function needsSalesRefresh(sync: SalesSync, now: number): boolean {
  if (sync.running) {
    return false;
  }
  const failedLast =
    sync.attemptedAt !== null && (sync.refreshedAt === null || sync.attemptedAt > sync.refreshedAt);
  if (failedLast && sync.attemptedAt !== null && now - sync.attemptedAt < RETRY_AFTER_FAILURE_MS) {
    return false;
  }
  return sync.refreshedAt === null || now - sync.refreshedAt >= REFRESH_EVERY_MS;
}

let schedulerStarted = false;
export function ensureSalesOrderScheduler(): void {
  // Tests drive the sweep by hand with a fake Spiro; a live timer would reach
  // for the real one.
  if (schedulerStarted || process.env.VITEST) {
    return;
  }
  schedulerStarted = true;
  const tick = async () => {
    try {
      if (needsSalesRefresh(await getSalesSync(), Date.now())) {
        await refreshSalesData();
      }
    } catch {
      // Spiro not connected, or a transient failure — the error is on the sync
      // row for the page to show, and a later tick tries again.
    }
  };
  void tick();
  setInterval(() => void tick(), CHECK_INTERVAL_MS).unref();
}
