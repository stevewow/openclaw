// The new-listing queue: what the sweep found, and what a person did about it.
//
// The sweep is the cheap half and the queue is the valuable half. Anyone can
// fetch today's listings; the thing worth keeping is which ones somebody has
// already looked at, sent, or decided against — so the VA opening this at nine
// tomorrow sees what changed rather than the same forty houses again.
//
// Rows are never deleted by a sweep. A listing that leaves the feed (it sold,
// it was withdrawn) stays exactly where it was, because the queue is a record
// of work as much as a list of houses.

import crypto from "node:crypto";
import type { FeedListing, ListingMarket } from "./listing-feed.js";
import { fetchNewListings, type ListingFeedDeps, withinWindow } from "./listing-feed.js";
import {
  checkListingsAgainstSpiro,
  listingOrderUrl,
  type SpiroCheckResult,
  type SpiroOrderCall,
} from "./listing-spiro-orders.js";
import { loadContactIndex, lookupContact } from "./pipedrive-contacts-store.js";
import { getAdminDb } from "./user-store.js";

export type ListingQueueStatus = "new" | "sent" | "dismissed";

export type Listing = {
  id: string;
  propertyId: string;
  listingId: string | null;
  territoryKey: string;
  marketLabel: string;
  status: string;
  listedAt: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  href: string | null;
  photoUrl: string | null;
  agentName: string | null;
  agentOffice: string | null;
  agentFeedId: string | null;
  knownPersonId: number | null;
  knownOrgId: number | null;
  /** Our own Spiro order at this address in the last 90 days, if any. */
  spiroOrderId: string | null;
  spiroOrderUrl: string | null;
  spiroTrackingCode: string | null;
  spiroOrderStatus: string | null;
  spiroOrderedAt: number | null;
  spiroOrderAgent: string | null;
  queueStatus: ListingQueueStatus;
  leadId: string | null;
  dismissedReason: string | null;
  actionedBy: string | null;
  actionedAt: number | null;
  firstSeenAt: number;
  updatedAt: number;
};

type ListingRow = {
  id: string;
  property_id: string;
  listing_id: string | null;
  territory_key: string;
  market_label: string;
  status: string;
  listed_at: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  href: string | null;
  photo_url: string | null;
  agent_name: string | null;
  agent_office: string | null;
  agent_feed_id: string | null;
  known_person_id: number | null;
  known_org_id: number | null;
  spiro_order_id: string | null;
  spiro_tracking_code: string | null;
  spiro_order_status: string | null;
  spiro_ordered_at: number | null;
  spiro_order_agent: string | null;
  queue_status: string;
  lead_id: string | null;
  dismissed_reason: string | null;
  actioned_by: string | null;
  actioned_at: number | null;
  first_seen_at: number;
  updated_at: number;
};

function isQueueStatus(value: string): value is ListingQueueStatus {
  return value === "new" || value === "sent" || value === "dismissed";
}

function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    propertyId: row.property_id,
    listingId: row.listing_id,
    territoryKey: row.territory_key,
    marketLabel: row.market_label,
    status: row.status,
    listedAt: row.listed_at,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    price: row.price,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    href: row.href,
    photoUrl: row.photo_url,
    agentName: row.agent_name,
    agentOffice: row.agent_office,
    agentFeedId: row.agent_feed_id,
    knownPersonId: row.known_person_id,
    knownOrgId: row.known_org_id,
    spiroOrderId: row.spiro_order_id,
    spiroOrderUrl: listingOrderUrl(row.spiro_order_id),
    spiroTrackingCode: row.spiro_tracking_code,
    spiroOrderStatus: row.spiro_order_status,
    spiroOrderedAt: row.spiro_ordered_at,
    spiroOrderAgent: row.spiro_order_agent,
    queueStatus: isQueueStatus(row.queue_status) ? row.queue_status : "new",
    leadId: row.lead_id,
    dismissedReason: row.dismissed_reason,
    actionedBy: row.actioned_by,
    actionedAt: row.actioned_at,
    firstSeenAt: row.first_seen_at,
    updatedAt: row.updated_at,
  };
}

export type ListingFilter = {
  /**
   * `new` is the worklist: open and not one of our own orders. `ours` is the
   * open rows that are. `open` is both.
   */
  queueStatus?: ListingQueueStatus | "all" | "open" | "ours";
  territoryKey?: string;
  /** Only listings that went on the market inside this many hours. */
  hours?: number;
  q?: string;
};

export async function listListings(filter: ListingFilter = {}): Promise<Listing[]> {
  const db = getAdminDb();
  let q = db.selectFrom("admin_listings").selectAll();
  const status = filter.queueStatus ?? "new";
  if (status === "open") {
    q = q.where("queue_status", "=", "new");
  } else if (status === "new") {
    q = q.where("queue_status", "=", "new").where("spiro_order_id", "is", null);
  } else if (status === "ours") {
    q = q.where("queue_status", "=", "new").where("spiro_order_id", "is not", null);
  } else if (status !== "all") {
    q = q.where("queue_status", "=", status);
  }
  if (filter.territoryKey) {
    q = q.where("territory_key", "=", filter.territoryKey);
  }
  if (filter.hours && filter.hours > 0) {
    q = q.where("listed_at", ">=", Date.now() - filter.hours * 60 * 60 * 1000);
  }
  if (filter.q?.trim()) {
    const term = `%${filter.q.trim().toLowerCase()}%`;
    q = q.where((eb) =>
      eb.or([
        eb("address", "like", term),
        eb("agent_name", "like", term),
        eb("agent_office", "like", term),
        eb("city", "like", term),
      ]),
    );
  }
  // Newest on the market first: the queue is worked from the top, and a house
  // that listed an hour ago is the one still worth a call today.
  const rows = await q.orderBy("listed_at", "desc").orderBy("first_seen_at", "desc").execute();
  return (rows as ListingRow[]).map(rowToListing);
}

export async function getListing(id: string): Promise<Listing | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_listings")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? rowToListing(row as ListingRow) : null;
}

export type ListingSummary = {
  total: number;
  /** Open and worth working: not one of our own orders. */
  newCount: number;
  /** Open, but the house is already one of our Spiro orders. */
  ourOrderCount: number;
  sentCount: number;
  dismissedCount: number;
  /** How many worth working we do not already have in the CRM. */
  unknownAgents: number;
};

export function summarizeListings(listings: readonly Listing[]): ListingSummary {
  let newCount = 0;
  let ourOrderCount = 0;
  let sentCount = 0;
  let dismissedCount = 0;
  let unknownAgents = 0;
  for (const listing of listings) {
    if (listing.queueStatus === "new") {
      if (listing.spiroOrderId) {
        ourOrderCount++;
        continue;
      }
      newCount++;
      if (!listing.knownPersonId) {
        unknownAgents++;
      }
    } else if (listing.queueStatus === "sent") {
      sentCount++;
    } else {
      dismissedCount++;
    }
  }
  return {
    total: listings.length,
    newCount,
    ourOrderCount,
    sentCount,
    dismissedCount,
    unknownAgents,
  };
}

export type SweepResult = {
  markets: string[];
  found: number;
  added: number;
  creditsRemaining: number | null;
  errors: Array<{ market: string; error: string }>;
  /** The cross-check against our own Spiro orders, run after every sweep. */
  spiro: SpiroCheckResult;
};

export type SweepDeps = ListingFeedDeps & {
  now?: number;
  windowHours?: number;
  /** Injected in tests so a sweep never reaches the network. */
  fetchMarket?: (market: ListingMarket) => Promise<{
    listings: FeedListing[];
    creditsRemaining: number | null;
  }>;
  /** Injected in tests so the Spiro check never reaches the network. */
  spiroCall?: SpiroOrderCall;
};

/**
 * Sweep the given markets and file what is new.
 *
 * A listing already in the queue is left completely alone — not even its price
 * is updated. The row records what we saw when we first saw it and what a
 * person then did; rewriting it under a VA who is halfway through working the
 * list would change the thing they are looking at.
 *
 * One market failing does not fail the sweep. A market with no credits left or
 * a name the feed cannot resolve is reported beside the ones that worked,
 * because eight markets minus one is still a morning's work. Spiro failing does
 * not fail it either: the listings are in, and the flags fall back to the
 * orders already held.
 */
export async function sweepListings(
  markets: readonly ListingMarket[],
  deps: SweepDeps = {},
): Promise<SweepResult> {
  const db = getAdminDb();
  const now = deps.now ?? Date.now();
  const windowHours = deps.windowHours ?? 24;
  const sweepId = crypto.randomUUID();
  await db
    .insertInto("admin_listing_sweeps")
    .values({
      id: sweepId,
      started_at: now,
      finished_at: null,
      markets: JSON.stringify(markets.map((m) => m.key)),
      found: 0,
      added: 0,
      credits_remaining: null,
      error: null,
    })
    .execute();

  const errors: SweepResult["errors"] = [];
  let found = 0;
  let added = 0;
  let creditsRemaining: number | null = null;

  // One directory load for the whole sweep rather than a lookup per listing:
  // the answer to "do we know this agent" comes from a cache that is already
  // in the database, and it is what decides whether a row is worth opening.
  const index = await loadContactIndex().catch(() => null);

  for (const market of markets) {
    try {
      const page = deps.fetchMarket
        ? await deps.fetchMarket(market)
        : await fetchNewListings(market, deps);
      if (page.creditsRemaining !== null) {
        creditsRemaining = page.creditsRemaining;
      }
      const fresh = withinWindow(page.listings, now, windowHours);
      found += fresh.length;
      for (const listing of fresh) {
        const existing = await db
          .selectFrom("admin_listings")
          .select("id")
          .where("property_id", "=", listing.propertyId)
          .executeTakeFirst();
        if (existing) {
          continue;
        }
        const known =
          index && listing.agentName
            ? lookupContact(index, { name: listing.agentName, type: "agent" })
            : null;
        const office =
          index && listing.agentOffice
            ? lookupContact(index, { name: listing.agentOffice, type: "company" })
            : null;
        await db
          .insertInto("admin_listings")
          .values({
            id: crypto.randomUUID(),
            property_id: listing.propertyId,
            listing_id: listing.listingId,
            territory_key: market.key,
            market_label: market.label,
            status: listing.status,
            listed_at: listing.listedAt,
            address: listing.address,
            city: listing.city,
            state: listing.state,
            zip: listing.zip,
            price: listing.price,
            beds: listing.beds,
            baths: listing.baths,
            sqft: listing.sqft,
            href: listing.href,
            photo_url: listing.photoUrl,
            agent_name: listing.agentName,
            agent_office: listing.agentOffice,
            agent_feed_id: listing.agentFeedId,
            known_person_id: known?.pipedriveId ?? null,
            known_org_id: office?.pipedriveId ?? null,
            spiro_order_id: null,
            spiro_tracking_code: null,
            spiro_order_status: null,
            spiro_ordered_at: null,
            spiro_order_agent: null,
            queue_status: "new",
            lead_id: null,
            dismissed_reason: null,
            actioned_by: null,
            actioned_at: null,
            first_seen_at: now,
            updated_at: now,
          })
          .execute();
        added++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ market: market.key, error: message });
      // Credits gone means every remaining market would fail the same way, and
      // each attempt is another call. Stop rather than prove it eight times.
      if (/credits/i.test(message)) {
        break;
      }
    }
  }

  // Before anyone sees the new rows: a house we already have an order for is
  // not a prospect, and the time to say so is before a VA starts researching it.
  const spiro = await checkListingsAgainstSpiro({ call: deps.spiroCall, now });

  await db
    .updateTable("admin_listing_sweeps")
    .set({
      finished_at: Date.now(),
      found,
      added,
      credits_remaining: creditsRemaining,
      error: errors.length > 0 ? JSON.stringify(errors).slice(0, 1000) : null,
    })
    .where("id", "=", sweepId)
    .execute();

  return { markets: markets.map((m) => m.key), found, added, creditsRemaining, errors, spiro };
}

export type LastSweep = {
  startedAt: number;
  finishedAt: number | null;
  found: number;
  added: number;
  creditsRemaining: number | null;
  error: string | null;
};

export async function getLastSweep(): Promise<LastSweep | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_listing_sweeps")
    .selectAll()
    .orderBy("started_at", "desc")
    .executeTakeFirst();
  if (!row) {
    return null;
  }
  return {
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    found: row.found,
    added: row.added,
    creditsRemaining: row.credits_remaining,
    error: row.error,
  };
}

/** Mark a listing as having become a lead. */
export async function markListingSent(
  id: string,
  params: { leadId: string; actorName: string },
): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();
  await db
    .updateTable("admin_listings")
    .set({
      queue_status: "sent",
      lead_id: params.leadId,
      actioned_by: params.actorName,
      actioned_at: now,
      updated_at: now,
    })
    .where("id", "=", id)
    .execute();
}

/** Take a listing off the queue, with the reason it was not worth a call. */
export async function dismissListing(
  id: string,
  params: { reason: string | null; actorName: string },
): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();
  await db
    .updateTable("admin_listings")
    .set({
      queue_status: "dismissed",
      dismissed_reason: params.reason?.slice(0, 300) ?? null,
      actioned_by: params.actorName,
      actioned_at: now,
      updated_at: now,
    })
    .where("id", "=", id)
    .execute();
}

/** Put a dismissed listing back, for the one dismissed by mistake. */
export async function restoreListing(id: string): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();
  await db
    .updateTable("admin_listings")
    .set({
      queue_status: "new",
      dismissed_reason: null,
      actioned_by: null,
      actioned_at: null,
      updated_at: now,
    })
    .where("id", "=", id)
    .where("queue_status", "=", "dismissed")
    .execute();
}
