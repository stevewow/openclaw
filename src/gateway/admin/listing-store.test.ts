import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseListing, withinWindow } from "./listing-feed.js";
import type { FeedListing, ListingMarket } from "./listing-feed.js";

/**
 * Reading the feed, and the queue that is built from it.
 *
 * The sweep's job is not to fetch — it is to fetch without disturbing work
 * somebody is halfway through. So what is proven here is mostly what a second
 * sweep does NOT do: no duplicate row, no overwritten decision, no lost market
 * because another one failed.
 */

/** A row shaped the way the live feed actually returns one. */
function feedRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    property_id: "119010563",
    listing_id: "223442866",
    status: "for_sale",
    list_date: "2026-09-14T15:43:04.000000Z",
    flags: { is_new_listing: true },
    address: { line: "139 Oakland Ave", city: "Findlay", state_code: "OH", postal_code: "45840" },
    list_price: 224900,
    beds: 3,
    baths: 2,
    sqft: 1680,
    photo_count: 24,
    href: "/realestateandhomes-detail/139-Oakland-Ave",
    primary_photo: { href: "https://ap.rdcpix.com/x.jpg" },
    advertisers: [
      {
        fulfillment_id: "616250",
        name: "Scott Fader",
        type: "seller",
        office: "Joseph Walter Realty, LLC",
      },
    ],
    ...over,
  };
}

/** Spiro answering with no orders, so a sweep here never reaches the network. */
async function noSpiroOrders(): Promise<unknown> {
  return { content: [{ type: "text", text: JSON.stringify({ data: [], meta: {} }) }] };
}

describe("reading a listing off the feed", () => {
  it("keeps what a person deciding whether to call actually needs", () => {
    const listing = parseListing(feedRow());
    expect(listing).toMatchObject({
      propertyId: "119010563",
      address: "139 Oakland Ave",
      city: "Findlay",
      state: "OH",
      price: 224900,
      isNewListing: true,
      agentName: "Scott Fader",
      agentOffice: "Joseph Walter Realty, LLC",
      agentFeedId: "616250",
    });
    expect(listing?.listedAt).toBe(Date.parse("2026-09-14T15:43:04.000000Z"));
    // A VA clicks this, so a path has to become a link.
    expect(listing?.href).toBe("https://www.realtor.com/realestateandhomes-detail/139-Oakland-Ave");
  });

  it("takes the seller's agent, not whoever is listed first", () => {
    const listing = parseListing(
      feedRow({
        advertisers: [
          { name: "Buyer Side", type: "buyer", office: "Other Co" },
          { name: "Scott Fader", type: "seller", office: "Joseph Walter Realty, LLC" },
        ],
      }),
    );
    expect(listing?.agentName).toBe("Scott Fader");
  });

  it("drops a row with no id rather than filing a house it cannot dedupe", () => {
    expect(parseListing(feedRow({ property_id: null }))).toBeNull();
    expect(parseListing(null)).toBeNull();
  });

  it("survives a row with no agent on it", () => {
    const listing = parseListing(feedRow({ advertisers: [] }));
    expect(listing?.agentName).toBeNull();
    expect(listing?.propertyId).toBe("119010563");
  });
});

describe("the window", () => {
  const now = Date.parse("2026-09-14T18:00:00Z");
  const at = (iso: string, over: Partial<FeedListing> = {}): FeedListing => ({
    ...(parseListing(feedRow({ list_date: iso })) as FeedListing),
    ...over,
  });

  it("keeps the last day and drops the week before it", () => {
    const fresh = at("2026-09-14T15:43:04Z");
    const old = at("2026-09-08T15:43:04Z");
    expect(withinWindow([fresh, old], now, 24).map((l) => l.listedAt)).toEqual([fresh.listedAt]);
  });

  it("keeps an undated row only when the feed called it new", () => {
    const undatedNew = { ...at("2026-09-14T15:43:04Z"), listedAt: null, isNewListing: true };
    const undatedOld = { ...at("2026-09-14T15:43:04Z"), listedAt: null, isNewListing: false };
    const kept = withinWindow([undatedNew, undatedOld], now, 24);
    expect(kept).toHaveLength(1);
    expect(kept[0].isNewListing).toBe(true);
  });
});

describe("the listing queue", () => {
  let tmpDir: string;
  let store: typeof import("./listing-store.js");

  const MARKETS: ListingMarket[] = [
    { key: "findlay", label: "Findlay", query: "Findlay, OH" },
    { key: "lima", label: "Lima", query: "Lima, OH" },
  ];

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "listing-store-test-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    store = await import("./listing-store.js");
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const now = Date.parse("2026-09-14T18:00:00Z");
  const listingAt = (id: string, iso: string, over: Partial<FeedListing> = {}): FeedListing => ({
    ...(parseListing(feedRow({ property_id: id, list_date: iso })) as FeedListing),
    ...over,
  });

  it("files what is new and says what it cost", async () => {
    const result = await store.sweepListings(MARKETS, {
      now,
      spiroCall: noSpiroOrders,
      fetchMarket: async (market) => ({
        listings: [listingAt(`p-${market.key}-1`, "2026-09-14T15:00:00Z")],
        creditsRemaining: 240,
      }),
    });
    expect(result.added).toBe(2);
    expect(result.found).toBe(2);
    expect(result.creditsRemaining).toBe(240);
    expect(result.errors).toEqual([]);

    const last = await store.getLastSweep();
    expect(last).toMatchObject({ added: 2, found: 2, creditsRemaining: 240 });
  });

  it("does not file the same house twice, or disturb a decision already made", async () => {
    const queue = await store.listListings({ queueStatus: "all" });
    const first = queue[0];
    await store.dismissListing(first.id, { reason: "Already a client", actorName: "Dana" });

    const again = await store.sweepListings(MARKETS, {
      now: now + 60_000,
      spiroCall: noSpiroOrders,
      fetchMarket: async (market) => ({
        // The same two houses, plus one genuinely new one.
        listings: [
          listingAt(`p-${market.key}-1`, "2026-09-14T15:00:00Z"),
          ...(market.key === "findlay" ? [listingAt("p-findlay-2", "2026-09-14T17:00:00Z")] : []),
        ],
        creditsRemaining: 238,
      }),
    });
    expect(again.added).toBe(1);

    const after = await store.getListing(first.id);
    expect(after?.queueStatus).toBe("dismissed");
    expect(after?.dismissedReason).toBe("Already a client");
    // And still one row for that house, not two.
    const all = await store.listListings({ queueStatus: "all" });
    expect(all.filter((l) => l.propertyId === first.propertyId)).toHaveLength(1);
  });

  it("carries on when one market fails, and stops when the credits do", async () => {
    const partial = await store.sweepListings(MARKETS, {
      now: now + 120_000,
      spiroCall: noSpiroOrders,
      fetchMarket: async (market) => {
        if (market.key === "findlay") {
          throw new Error("RealtyAPI error: 500");
        }
        return { listings: [listingAt("p-lima-9", "2026-09-14T17:30:00Z")], creditsRemaining: 235 };
      },
    });
    expect(partial.added).toBe(1);
    expect(partial.errors).toEqual([{ market: "findlay", error: "RealtyAPI error: 500" }]);

    // Credits gone is different: every remaining market fails the same way and
    // each attempt is another call, so it gives up rather than proving it twice.
    const tried: string[] = [];
    const broke = await store.sweepListings(MARKETS, {
      now: now + 180_000,
      spiroCall: noSpiroOrders,
      fetchMarket: async (market) => {
        tried.push(market.key);
        throw new Error("RealtyAPI credits exhausted");
      },
    });
    expect(tried).toEqual(["findlay"]);
    expect(broke.errors).toHaveLength(1);
  });

  it("counts the queue the way the page reads it", async () => {
    const all = await store.listListings({ queueStatus: "all" });
    const summary = store.summarizeListings(all);
    expect(summary.total).toBe(all.length);
    expect(
      summary.newCount + summary.ourOrderCount + summary.sentCount + summary.dismissedCount,
    ).toBe(all.length);
    // Nothing was matched against a CRM directory or a Spiro order in this test
    // database, so every open row counts as an agent we do not know.
    expect(summary.ourOrderCount).toBe(0);
    expect(summary.unknownAgents).toBe(summary.newCount);
  });

  it("puts one back that was set aside by mistake", async () => {
    const dismissed = await store.listListings({ queueStatus: "dismissed" });
    expect(dismissed.length).toBeGreaterThan(0);
    await store.restoreListing(dismissed[0].id);
    const back = await store.getListing(dismissed[0].id);
    expect(back?.queueStatus).toBe("new");
    expect(back?.dismissedReason).toBeNull();
  });

  it("shows the newest on the market first", async () => {
    const open = await store.listListings({ queueStatus: "all" });
    const dates = open.map((l) => l.listedAt ?? 0);
    expect(dates).toEqual(dates.toSorted((a, b) => b - a));
  });
});
