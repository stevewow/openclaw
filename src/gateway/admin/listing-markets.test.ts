import { describe, expect, it } from "vitest";
import { seedTerritories } from "./lead-territories.js";
import { listingMarkets } from "./listing-markets.js";
import { MARKET_REGIONS } from "./market-trends.js";

/**
 * The sweep's market list. A market missing from it is not an error anywhere —
 * its section of the page is just empty — which is how Cleveland went unswept.
 */
describe("the markets a listing sweep reads", () => {
  it("covers every market-report region and Cleveland", () => {
    const keys = listingMarkets().map((m) => m.key);
    for (const region of MARKET_REGIONS) {
      expect(keys).toContain(region.key.replace(/\s+/g, "-"));
    }
    expect(listingMarkets().find((m) => m.key === "cleveland")).toEqual({
      key: "cleveland",
      label: "Cleveland",
      query: "Cleveland, OH",
    });
  });

  it("asks the feed for a city with its state, so it resolves to the right one", () => {
    for (const market of listingMarkets()) {
      expect(market.query).toMatch(/^[A-Za-z .'-]+, [A-Z]{2}$/);
    }
  });

  it("sweeps each market once, since each one costs a credit", () => {
    const keys = listingMarkets().map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keys the seeded markets exactly as lead routing does", () => {
    const routed = new Set(seedTerritories().map((t) => t.key));
    const unrouted = listingMarkets()
      .map((m) => m.key)
      .filter((key) => !routed.has(key));
    // Cleveland's routing row was added in the Hub, not seeded from the BDS book.
    expect(unrouted).toEqual(["cleveland"]);
  });
});
