// The sales dashboard's markets, and each market's new listings by month.
//
// Markets are one list for every month (Steve, 2026-09-15). Adding a market
// puts it in every month, earlier ones included, so its history is there to
// compare against. Removing one stops it counting from a chosen month on and
// leaves the months before it as they were, goals and all. A market is named
// the way its Spiro service area starts — "Fort Wayne" for "Fort Wayne,
// Indiana" — which is how its orders find it.
//
// New listings are entered once they are published, a number per market per
// month, and are what market share divides that month's shoots by.

import { regionKey, regionLabel } from "./focus-regions.js";
import { getAdminDb } from "./user-store.js";

export const UNASSIGNED_MARKET = "unassigned";
/** The goal row for the company as a whole, rather than any one market. */
export const TOTAL_GOAL_KEY = "total";
/** Where orders count when their market is not one being tracked that month. */
export const OTHER_MARKET = "other";
const RESERVED_KEYS: ReadonlySet<string> = new Set([
  UNASSIGNED_MARKET,
  TOTAL_GOAL_KEY,
  OTHER_MARKET,
]);
const MAX_LISTINGS = 1_000_000;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

export function wholeIn(value: unknown, min: number, max: number, what: string): number {
  const n =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new SalesInputError(`${what} must be a whole number from ${min} to ${max}.`);
  }
  return n;
}

/** A non-negative amount; blank reads as nothing entered. Accepts "$1,234.50". */
export function amount(value: unknown, what: string): number | null {
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

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

// ── Markets ─────────────────────────────────────────────────────────────────

export type SalesMarket = {
  key: string;
  label: string;
  /** The month (YYYY-MM) it stops counting from; null while it is tracked. */
  removedFrom: string | null;
};

/** Whether a market counts in a month, given as YYYY-MM. */
export function marketActiveIn(market: SalesMarket, month: string): boolean {
  return market.removedFrom === null || month < market.removedFrom;
}

function byLabel(a: { label: string }, b: { label: string }): number {
  return a.label.localeCompare(b.label);
}

export async function listSalesMarkets(): Promise<SalesMarket[]> {
  const rows = await getAdminDb()
    .selectFrom("admin_sales_markets")
    .select(["market_key", "label", "removed_from"])
    .execute();
  return rows
    .map((r) => ({ key: r.market_key, label: r.label, removedFrom: r.removed_from }))
    .toSorted(byLabel);
}

/** Add a market to every month, or start tracking one again that was stopped. */
export async function addSalesMarket(
  input: Record<string, unknown>,
  actorName: string,
  now: number,
): Promise<SalesMarket> {
  const label = typeof input.label === "string" ? input.label.trim() : "";
  const key = regionKey(label);
  if (!label || label.length > 60 || !key) {
    throw new SalesInputError("Name the market in up to 60 characters.");
  }
  if (label.includes(",")) {
    throw new SalesInputError(
      "Name the market without its state — Fort Wayne, not Fort Wayne, Indiana.",
    );
  }
  if (RESERVED_KEYS.has(key)) {
    throw new SalesInputError(`"${label}" is not a name a market can have.`);
  }
  await getAdminDb()
    .insertInto("admin_sales_markets")
    .values({
      market_key: key,
      label,
      removed_from: null,
      created_by: actorName,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.column("market_key").doUpdateSet({ label, removed_from: null, updated_at: now }),
    )
    .execute();
  return { key, label, removedFrom: null };
}

/** Stop a market counting from a month on (a YYYY-MM), or null to track it again. */
export async function setSalesMarketRemoval(
  key: string,
  input: Record<string, unknown>,
  now: number,
): Promise<SalesMarket | null> {
  const removedFrom = input.removedFrom ?? null;
  if (removedFrom !== null && !isMonthKey(removedFrom)) {
    throw new SalesInputError("removedFrom must be a month, YYYY-MM, or null.");
  }
  const result = await getAdminDb()
    .updateTable("admin_sales_markets")
    .set({ removed_from: removedFrom, updated_at: now })
    .where("market_key", "=", key)
    .executeTakeFirst();
  if (Number(result.numUpdatedRows) === 0) {
    return null;
  }
  return (await listSalesMarkets()).find((m) => m.key === key) ?? null;
}

/** Service areas with paid orders since `since` that are not on the market list. */
export async function suggestSalesMarkets(
  since: string,
): Promise<Array<{ key: string; label: string; orders: number }>> {
  const rows = await getAdminDb()
    .selectFrom("admin_sales_orders as o")
    .innerJoin("admin_sales_companies as c", "c.company_id", "o.company_id")
    .select((eb) => ["c.service_area", eb.fn.countAll<number>().as("orders")])
    .where("o.total_cents", ">", 0)
    .where("o.order_day", ">=", since)
    .where("c.service_area", "is not", null)
    .groupBy("c.service_area")
    .execute();
  const listed = new Set((await listSalesMarkets()).map((m) => m.key));
  const out = new Map<string, { key: string; label: string; orders: number }>();
  for (const row of rows) {
    const market = marketOf(row.service_area);
    if (
      market.key === UNASSIGNED_MARKET ||
      RESERVED_KEYS.has(market.key) ||
      listed.has(market.key)
    ) {
      continue;
    }
    const existing = out.get(market.key);
    if (existing) {
      existing.orders += row.orders;
    } else {
      out.set(market.key, { ...market, orders: row.orders });
    }
  }
  return [...out.values()].toSorted((a, b) => b.orders - a.orders || byLabel(a, b));
}

// ── New listings ────────────────────────────────────────────────────────────

export type SalesListing = { month: number; marketKey: string; listings: number };

export async function listSalesListings(year: number): Promise<SalesListing[]> {
  const rows = await getAdminDb()
    .selectFrom("admin_sales_listings")
    .select(["month", "market_key", "listings"])
    .where("year", "=", year)
    .orderBy("month")
    .orderBy("market_key")
    .execute();
  return rows.map((r) => ({ month: r.month, marketKey: r.market_key, listings: r.listings }));
}

/**
 * Save a year's new listings for the markets given: each row carries all twelve
 * months, and a blank month is one not entered yet. Markets left out keep theirs.
 */
export async function saveSalesListings(
  input: Record<string, unknown>,
  actorName: string,
  now: number,
): Promise<SalesListing[]> {
  const year = wholeIn(input.year, 2000, 2100, "Year");
  if (!Array.isArray(input.rows) || input.rows.length > 100) {
    throw new SalesInputError("rows must be a list of up to 100 markets.");
  }
  const known = new Map((await listSalesMarkets()).map((m) => [m.key, m]));
  const saves = new Map<string, Array<{ month: number; listings: number }>>();
  for (const raw of input.rows) {
    const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const market = typeof row.marketKey === "string" ? known.get(row.marketKey) : undefined;
    if (!market) {
      throw new SalesInputError(
        `"${String(row.marketKey)}" is not on the market list. Add it under Markets first.`,
      );
    }
    if (saves.has(market.key)) {
      throw new SalesInputError(`${market.label} is listed twice.`);
    }
    if (!Array.isArray(row.months) || row.months.length !== 12) {
      throw new SalesInputError(
        `${market.label} needs a value, or a blank, for each of 12 months.`,
      );
    }
    const months: Array<{ month: number; listings: number }> = [];
    row.months.forEach((value: unknown, i) => {
      const what = `${market.label} new listings for ${MONTH_NAMES[i]}`;
      const n = amount(value, what);
      if (n === null) {
        return;
      }
      if (!Number.isInteger(n) || n > MAX_LISTINGS) {
        throw new SalesInputError(`${what} must be a whole number up to ${MAX_LISTINGS}.`);
      }
      months.push({ month: i + 1, listings: n });
    });
    saves.set(market.key, months);
  }
  await getAdminDb()
    .transaction()
    .execute(async (trx) => {
      for (const [key, months] of saves) {
        await trx
          .deleteFrom("admin_sales_listings")
          .where("year", "=", year)
          .where("market_key", "=", key)
          .execute();
        if (months.length > 0) {
          await trx
            .insertInto("admin_sales_listings")
            .values(
              months.map((m) => ({
                year,
                month: m.month,
                market_key: key,
                listings: m.listings,
                updated_by: actorName,
                updated_at: now,
              })),
            )
            .execute();
        }
      }
    });
  return listSalesListings(year);
}
