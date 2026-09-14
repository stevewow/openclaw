// Our own Spiro orders, by address, so the listing queue can tell a house we
// have already booked from a prospect.
//
// A listing whose shoot is already on our books is not a lead: the agent is a
// client, and a BDS cold-calling them about the house we photographed last
// week is worse than no call at all. So every open row in the queue is checked
// against the orders submitted in the last 90 days, and a match is flagged and
// moved off the worklist rather than deleted — the VA can still see it, and
// still send it on when the listing agent is somebody other than the client.
//
// Cached rather than searched per listing. Spiro's API returns 100 orders a
// page and the account takes ~4,600 a quarter, so a full read is ~47 calls.
// After the first, a check reads only what was submitted since the newest order
// already held, which is usually one page.

import { callTool } from "../../../extensions/spiro/api.js";
import { spiroOrderUrl } from "./spiro-links.js";
import { getAdminDb } from "./user-store.js";

export const SPIRO_ORDER_LOOKBACK_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Spiro's public API caps a page at 100 whatever is asked for. */
const PAGE_SIZE = 100;
/** 50,000 orders: a guard against a paging loop, not a budget. */
const MAX_PAGES = 500;

export type SpiroOrderCall = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/** One order, reduced to where it was and who ordered it. */
export type SpiroOrderAddress = {
  orderId: string;
  trackingCode: string | null;
  status: string;
  submittedAt: number;
  street: string;
  streetKey: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  agentName: string | null;
  companyName: string | null;
};

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function zip5(value: string | null | undefined): string | null {
  return value?.trim().match(/^\d{5}/)?.[0] ?? null;
}

/** USPS abbreviations, so "South Main Street" and "S Main St" are one street. */
const STREET_WORDS: Record<string, string> = {
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
  street: "st",
  avenue: "ave",
  av: "ave",
  drive: "dr",
  road: "rd",
  court: "ct",
  lane: "ln",
  boulevard: "blvd",
  place: "pl",
  circle: "cir",
  parkway: "pkwy",
  terrace: "ter",
  trail: "trl",
  highway: "hwy",
  square: "sq",
  crossing: "xing",
  point: "pt",
  cove: "cv",
  ridge: "rdg",
  creek: "crk",
  heights: "hts",
  meadows: "mdws",
  manor: "mnr",
  plaza: "plz",
  station: "sta",
  trace: "trce",
  valley: "vly",
  village: "vlg",
};

/**
 * A street address reduced to what both sources agree on.
 *
 * The feed writes "1630 S Main St"; whoever typed the order into Spiro may have
 * written "1630 South Main Street." Units are dropped: Spiro keeps the unit in
 * a field of its own while the feed folds it into the line, so keeping it would
 * miss every condo rather than occasionally flag a neighbor in one building.
 */
export function streetKey(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const words = (raw.toLowerCase().split(",")[0] ?? "")
    .replace(/\s*#.*$/, "")
    .replace(/\s(?:apt|apartment|unit|suite|ste|lot|bldg|building)\b.*$/, "")
    .replace(/['.]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => STREET_WORDS[word] ?? word);
  // The house number is what makes it an address rather than a street; without
  // one, every order on Main St would match.
  if (words.length < 2 || !/^\d/.test(words[0] ?? "")) {
    return null;
  }
  return words.join(" ");
}

type Locality = { city: string | null; zip: string | null };

/**
 * Whether two addresses on the same street are in the same town. The ZIP
 * decides when both have one; the city only stands in when one is missing.
 * Neither means no match — a house number and a street name alone are shared
 * by too many towns in eight markets to call it our order.
 */
export function sameLocality(a: Locality, b: Locality): boolean {
  const zipA = zip5(a.zip);
  const zipB = zip5(b.zip);
  if (zipA && zipB) {
    return zipA === zipB;
  }
  const cityA = a.city?.trim().toLowerCase();
  const cityB = b.city?.trim().toLowerCase();
  return Boolean(cityA && cityB && cityA === cityB);
}

/** One row of `search_spiro_orders`, shaped as the live account returns it. */
export function parseSpiroOrder(raw: unknown): SpiroOrderAddress | null {
  const row = obj(raw);
  const orderId = str(row?.orderId);
  if (!row || !orderId) {
    return null;
  }
  const address = obj(obj(row.property)?.address) ?? {};
  const street = str(address.streetAddress);
  const key = streetKey(street);
  const submittedAt = Date.parse(str(row.dateSubmitted) ?? "");
  if (!street || !key || !Number.isFinite(submittedAt)) {
    return null;
  }
  const client = obj(row.client) ?? {};
  return {
    orderId,
    trackingCode: str(row.trackingCode),
    status: str(row.status) ?? "unknown",
    submittedAt,
    street,
    streetKey: key,
    city: str(address.city),
    state: str(address.stateOrProvince),
    zip: zip5(str(address.postalCode)),
    agentName: str(client.agentName),
    companyName: str(client.companyName),
  };
}

/**
 * The MCP reply is `{content:[{type:"text", text:"{data, meta}"}]}`. Anything
 * else throws: a reader that treats an unexpected shape as "no orders" would
 * quietly unflag the whole queue, and a Spiro reader has failed that way twice.
 */
function unwrapOrderPage(result: unknown): { orders: unknown[]; hasNextPage: boolean } {
  const outer = obj(result);
  const content = Array.isArray(outer?.content) ? outer.content : [];
  const text = content.map(obj).find((part) => part?.type === "text")?.text;
  if (outer?.isError === true) {
    throw new Error(
      `Spiro order search failed: ${typeof text === "string" ? text.slice(0, 200) : "no detail"}`,
    );
  }
  let payload: unknown = outer;
  if (typeof text === "string") {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new Error("Spiro order search did not answer with JSON");
    }
  }
  const page = obj(payload);
  if (!page || !Array.isArray(page.data)) {
    throw new Error("Spiro order search answered without an order list");
  }
  return { orders: page.data, hasNextPage: obj(page.meta)?.hasNextPage === true };
}

export type SpiroOrderRefresh = {
  /** Orders Spiro returned on this read, before dedupe. */
  fetched: number;
  since: string;
};

/**
 * Bring the cached orders up to date and drop the ones past 90 days.
 *
 * Reads from a day before the newest order held. Newest-first paging shifts
 * when an order lands mid-read, which repeats a row rather than skipping one,
 * and the day of overlap catches an order submitted while the last read was
 * running. Both are absorbed by the upsert — which is also what carries a
 * status change, such as a cancellation, onto an order already held.
 */
export async function refreshSpiroOrderCache(
  deps: { call?: SpiroOrderCall; now?: number } = {},
): Promise<SpiroOrderRefresh> {
  const call = deps.call ?? callTool;
  const now = deps.now ?? Date.now();
  const db = getAdminDb();
  const floor = now - SPIRO_ORDER_LOOKBACK_DAYS * DAY_MS;
  const newest = await db
    .selectFrom("admin_listing_spiro_orders")
    .select("submitted_at")
    .orderBy("submitted_at", "desc")
    .limit(1)
    .executeTakeFirst();
  const since = new Date(
    newest ? Math.max(floor, newest.submitted_at - DAY_MS) : floor,
  ).toISOString();

  let fetched = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { orders, hasNextPage } = unwrapOrderPage(
      await call("search_spiro_orders", {
        dateSubmittedFrom: since,
        sort: "-dateSubmitted",
        page,
        pageSize: PAGE_SIZE,
      }),
    );
    fetched += orders.length;
    const parsed = new Map<string, SpiroOrderAddress>();
    for (const raw of orders) {
      const order = parseSpiroOrder(raw);
      if (order) {
        parsed.set(order.orderId, order);
      }
    }
    if (parsed.size > 0) {
      await db
        .insertInto("admin_listing_spiro_orders")
        .values(
          [...parsed.values()].map((order) => ({
            order_id: order.orderId,
            street_key: order.streetKey,
            street: order.street,
            city: order.city,
            state: order.state,
            zip: order.zip,
            status: order.status,
            tracking_code: order.trackingCode,
            agent_name: order.agentName,
            company_name: order.companyName,
            submitted_at: order.submittedAt,
            cached_at: now,
          })),
        )
        .onConflict((oc) =>
          oc.column("order_id").doUpdateSet((eb) => ({
            street_key: eb.ref("excluded.street_key"),
            street: eb.ref("excluded.street"),
            city: eb.ref("excluded.city"),
            state: eb.ref("excluded.state"),
            zip: eb.ref("excluded.zip"),
            status: eb.ref("excluded.status"),
            tracking_code: eb.ref("excluded.tracking_code"),
            agent_name: eb.ref("excluded.agent_name"),
            company_name: eb.ref("excluded.company_name"),
            submitted_at: eb.ref("excluded.submitted_at"),
            cached_at: eb.ref("excluded.cached_at"),
          })),
        )
        .execute();
    }
    if (!hasNextPage || orders.length === 0) {
      break;
    }
  }

  await db.deleteFrom("admin_listing_spiro_orders").where("submitted_at", "<", floor).execute();
  return { fetched, since };
}

type CachedOrderRow = {
  order_id: string;
  tracking_code: string | null;
  status: string;
  city: string | null;
  zip: string | null;
  agent_name: string | null;
  submitted_at: number;
};

/**
 * Flag every open listing that is one of our orders, and unflag any that no
 * longer is — the order was cancelled, or has aged past 90 days.
 *
 * Open rows only. A listing somebody already sent or set aside is a decision,
 * and changing what the row says afterwards would rewrite why it was made.
 * Cancelled orders never count: a shoot that did not happen is an agent who
 * may be booking somebody else, which is exactly who the queue is for.
 */
export async function matchListingsToOrders(now: number = Date.now()): Promise<number> {
  const db = getAdminDb();
  const cutoff = now - SPIRO_ORDER_LOOKBACK_DAYS * DAY_MS;
  const open = await db
    .selectFrom("admin_listings")
    .select(["id", "address", "city", "zip"])
    .where("queue_status", "=", "new")
    .execute();

  let flagged = 0;
  for (const listing of open) {
    const key = streetKey(listing.address);
    const candidates: CachedOrderRow[] = key
      ? await db
          .selectFrom("admin_listing_spiro_orders")
          .select([
            "order_id",
            "tracking_code",
            "status",
            "city",
            "zip",
            "agent_name",
            "submitted_at",
          ])
          .where("street_key", "=", key)
          .where("submitted_at", ">=", cutoff)
          .where("status", "!=", "cancelled")
          .orderBy("submitted_at", "desc")
          .execute()
      : [];
    const order = candidates.find((candidate) => sameLocality(candidate, listing)) ?? null;
    if (order) {
      flagged++;
    }
    await db
      .updateTable("admin_listings")
      .set({
        spiro_order_id: order?.order_id ?? null,
        spiro_tracking_code: order?.tracking_code ?? null,
        spiro_order_status: order?.status ?? null,
        spiro_ordered_at: order?.submitted_at ?? null,
        spiro_order_agent: order?.agent_name ?? null,
      })
      .where("id", "=", listing.id)
      .execute();
  }
  return flagged;
}

export type SpiroCheckResult = {
  fetched: number;
  flagged: number;
  /** Set when Spiro could not be read; the flags then come from what was already held. */
  error: string | null;
};

/** Read what is new in Spiro, then re-flag the queue. */
export async function checkListingsAgainstSpiro(
  deps: { call?: SpiroOrderCall; now?: number } = {},
): Promise<SpiroCheckResult> {
  let fetched = 0;
  let error: string | null = null;
  try {
    fetched = (await refreshSpiroOrderCache(deps)).fetched;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  // A failed read still leaves most of 90 days of orders in hand, and flagging
  // against those beats flagging against nothing.
  const flagged = await matchListingsToOrders(deps.now);
  return { fetched, flagged, error };
}

export type SpiroOrderCacheStatus = {
  /** Orders held from the last 90 days. */
  orders: number;
  refreshedAt: number | null;
};

export async function getSpiroOrderCacheStatus(
  now: number = Date.now(),
): Promise<SpiroOrderCacheStatus> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_listing_spiro_orders")
    .select((eb) => [
      eb.fn.countAll<number>().as("orders"),
      eb.fn.max<number | null>("cached_at").as("refreshed_at"),
    ])
    .where("submitted_at", ">=", now - SPIRO_ORDER_LOOKBACK_DAYS * DAY_MS)
    .executeTakeFirst();
  return { orders: row?.orders ?? 0, refreshedAt: row?.refreshed_at ?? null };
}

/** The link a flagged card opens. Null for an id Spiro would not route. */
export function listingOrderUrl(orderId: string | null): string | null {
  return orderId ? spiroOrderUrl(orderId) : null;
}
