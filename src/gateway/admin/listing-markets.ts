// Which markets the listing sweep reads, and what the feed is asked for.
//
// Derived from the lists that already exist rather than a third copy: the
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
 * Markets we prospect in that are not in the BDS book the sales reports and
 * the market report are built from.
 *
 * Cleveland is routed for leads (Lead Routing, Taylor Thomas) but is not a
 * region in `focus-regions.ts`, and adding it there would also put it in the
 * Focus report's ownership split. A listing sweep only needs a feed query and a
 * territory key, so it is added here instead. The key must match the routing
 * row's, or a sent listing lands on nobody's desk.
 */
const LISTING_ONLY_MARKETS: ReadonlyArray<{ label: string; query: string }> = [
  { label: "Cleveland", query: "Cleveland, OH" },
];

/**
 * The markets to sweep.
 *
 * Keyed the way the routing table keys a territory, so a listing sent as a
 * lead lands on the same desk a website lead from that city would.
 */
export function listingMarkets(): ListingMarket[] {
  const markets = [...MARKET_REGIONS, ...LISTING_ONLY_MARKETS].map((region) => ({
    key: territoryKeyFromLabel(region.label),
    label: region.label,
    query: region.query,
  }));
  // Once a listing-only market joins the BDS book it would be swept twice, at a
  // credit apiece, so the report's entry wins.
  const seen = new Set<string>();
  return markets.filter((market) => !seen.has(market.key) && seen.add(market.key));
}
