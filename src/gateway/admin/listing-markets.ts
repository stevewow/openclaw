// Which markets the listing sweep reads, and what the feed is asked for.
//
// Derived from the two lists that already exist rather than a third copy: the
// territory table decides who owns a market for leads, and the market report's
// region queries already carry the state qualifier the feed needs — a bare
// "Columbus" or "Charlotte" resolves to the wrong state's city.
//
// Its own module because both the route and the store want it and neither
// should import the other.

import { territoryKeyFromLabel } from "./lead-territories.js";
import type { ListingMarket } from "./listing-feed.js";
import { MARKET_REGIONS } from "./market-trends.js";

/**
 * The markets to sweep.
 *
 * Keyed the way the routing table keys a territory, so a listing sent as a
 * lead lands on the same desk a website lead from that city would.
 */
export function listingMarkets(): ListingMarket[] {
  return MARKET_REGIONS.map((region) => ({
    key: territoryKeyFromLabel(region.label),
    label: region.label,
    query: region.query,
  }));
}
