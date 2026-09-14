import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-listing-spiro-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const spiro = await import("./listing-spiro-orders.js");
const store = await import("./listing-store.js");
const { parseListing } = await import("./listing-feed.js");
import type { FeedListing, ListingMarket } from "./listing-feed.js";

/**
 * The "already our order" check. What matters is the two ways it can go wrong:
 * missing a house we shot because the two systems spell the street differently,
 * and flagging a prospect because a street name happens to repeat in another
 * town — or because Spiro could not be read and that looked like "no orders".
 */

afterAll(() => {
  delete process.env.OPENCLAW_STATE_DIR;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-14T18:00:00Z");

/** An order shaped the way `search_spiro_orders` returned one from the live account. */
function orderRow(over: {
  orderId: string;
  street: string;
  city?: string;
  zip?: string;
  status?: string;
  submitted?: string;
  agentName?: string;
}): Record<string, unknown> {
  const city = over.city ?? "Dayton";
  const zip = over.zip ?? "45409";
  return {
    orderId: over.orderId,
    trackingCode: `tc-${over.orderId.slice(0, 4)}`,
    status: over.status ?? "confirmed",
    dateSubmitted: over.submitted ?? "2026-09-10T17:19:51.3884366Z",
    mediaTitle: `${over.street}, ${city}, OH ${zip}, USA`,
    property: {
      address: {
        fullAddress: `${over.street}, ${city}, OH ${zip}`,
        streetAddress: over.street,
        unitNumber: null,
        city,
        stateOrProvince: "OH",
        postalCode: zip,
        countryCode: "US",
      },
    },
    client: {
      agentId: "cf074975-2d38-4d5f-c728-08d955be1986",
      agentName: over.agentName ?? "Emily Pelligra",
      companyId: "ccf8d3b0-8de4-496b-80af-c350205dfb3f",
      companyName: "Coldwell Banker Heritage",
    },
    website: { deliveredAt: null },
  };
}

/** The MCP envelope the Spiro plugin hands back. */
function mcpPage(rows: unknown[], hasNextPage = false): unknown {
  return {
    content: [{ type: "text", text: JSON.stringify({ data: rows, meta: { hasNextPage } }) }],
  };
}

describe("an address, the way both sides write it", () => {
  it("is one street however it was abbreviated", () => {
    expect(spiro.streetKey("1630 S Main St")).toBe("1630 s main st");
    expect(spiro.streetKey("1630 South Main Street")).toBe("1630 s main st");
    expect(spiro.streetKey("1630 S. Main St., Dayton, OH 45409")).toBe("1630 s main st");
  });

  it("ignores the unit, which Spiro keeps in a field of its own", () => {
    const plain = spiro.streetKey("139 Oakland Ave");
    expect(spiro.streetKey("139 Oakland Avenue Apt 4")).toBe(plain);
    expect(spiro.streetKey("139 Oakland Ave #4")).toBe(plain);
    expect(spiro.streetKey("139 Oakland Ave Unit B")).toBe(plain);
  });

  it("will not key a street with no house number", () => {
    expect(spiro.streetKey("Main St")).toBeNull();
    expect(spiro.streetKey("")).toBeNull();
    expect(spiro.streetKey(null)).toBeNull();
  });

  it("decides the town by ZIP, and by city only when a ZIP is missing", () => {
    expect(
      spiro.sameLocality({ city: "Dayton", zip: "45409" }, { city: null, zip: "45409-1234" }),
    ).toBe(true);
    // Same city name, different ZIP: the ZIP wins.
    expect(
      spiro.sameLocality({ city: "Dayton", zip: "45409" }, { city: "Dayton", zip: "45429" }),
    ).toBe(false);
    expect(
      spiro.sameLocality({ city: "Dayton", zip: null }, { city: "dayton", zip: "45409" }),
    ).toBe(true);
    // Nothing to compare is not a match.
    expect(spiro.sameLocality({ city: null, zip: null }, { city: "Dayton", zip: "45409" })).toBe(
      false,
    );
  });
});

describe("reading an order off Spiro", () => {
  it("keeps the address, the agent and when it was submitted", () => {
    const order = spiro.parseSpiroOrder(
      orderRow({ orderId: "3717afe3-204e-4a5f-5939-08df101942af", street: "1630 S Main St" }),
    );
    expect(order).toMatchObject({
      orderId: "3717afe3-204e-4a5f-5939-08df101942af",
      streetKey: "1630 s main st",
      city: "Dayton",
      zip: "45409",
      status: "confirmed",
      agentName: "Emily Pelligra",
    });
    // Spiro writes seven fractional digits; the instant must still parse.
    expect(order?.submittedAt).toBe(Date.UTC(2026, 8, 10, 17, 19, 51, 388));
  });

  it("skips an order it cannot place", () => {
    expect(spiro.parseSpiroOrder(orderRow({ orderId: "o-1", street: "Main St" }))).toBeNull();
    expect(spiro.parseSpiroOrder({ orderId: "o-2" })).toBeNull();
    expect(spiro.parseSpiroOrder(null)).toBeNull();
  });
});

describe("flagging listings that are already our orders", () => {
  const MARKETS: ListingMarket[] = [{ key: "dayton", label: "Dayton", query: "Dayton, OH" }];

  function listing(id: string, line: string, zip: string, city = "Dayton"): FeedListing {
    return parseListing({
      property_id: id,
      status: "for_sale",
      list_date: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
      flags: { is_new_listing: true },
      address: { line, city, state_code: "OH", postal_code: zip },
      advertisers: [{ name: "Someone Listing", type: "seller", office: "Some Realty" }],
    }) as FeedListing;
  }

  const FEED = [
    // Ours: the same house, written the long way round.
    listing("p-ours", "1630 South Main Street", "45409"),
    // Only a cancelled order: a shoot that never happened is still a prospect.
    listing("p-cancelled", "22 Elm St", "45410"),
    // An order, but from four months ago.
    listing("p-old", "5 Oak Ct", "45429"),
    // Same street and number, different town.
    listing("p-elsewhere", "1630 S Main St", "45840", "Findlay"),
  ];

  const ORDERS = [
    orderRow({ orderId: "11111111-1111-4111-8111-111111111111", street: "1630 S Main St" }),
    orderRow({
      orderId: "22222222-2222-4222-8222-222222222222",
      street: "22 Elm St",
      zip: "45410",
      status: "cancelled",
    }),
    orderRow({
      orderId: "33333333-3333-4333-8333-333333333333",
      street: "5 Oak Ct",
      zip: "45429",
      submitted: new Date(NOW - 120 * DAY).toISOString(),
    }),
  ];

  async function byProperty(propertyId: string) {
    const all = await store.listListings({ queueStatus: "all" });
    return all.find((l) => l.propertyId === propertyId);
  }

  it("moves our own order off the worklist on the sweep that files it", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const result = await store.sweepListings(MARKETS, {
      now: NOW,
      fetchMarket: async () => ({ listings: FEED, creditsRemaining: 200 }),
      spiroCall: async (_name, args) => {
        calls.push(args);
        return mcpPage(ORDERS);
      },
    });
    expect(result.added).toBe(4);
    expect(result.spiro).toEqual({ fetched: 3, flagged: 1, error: null });
    // A first read covers the whole 90 days, at the page size Spiro honors.
    expect(calls[0]).toMatchObject({
      dateSubmittedFrom: new Date(NOW - 90 * DAY).toISOString(),
      pageSize: 100,
      page: 1,
    });

    const ours = await store.listListings({ queueStatus: "ours" });
    expect(ours.map((l) => l.propertyId)).toEqual(["p-ours"]);
    expect(ours[0]).toMatchObject({
      spiroOrderId: "11111111-1111-4111-8111-111111111111",
      spiroOrderAgent: "Emily Pelligra",
      spiroOrderStatus: "confirmed",
    });
    expect(ours[0]?.spiroOrderUrl).toContain("/orders/11111111-1111-4111-8111-111111111111");

    const toWork = await store.listListings({ queueStatus: "new" });
    expect(toWork.map((l) => l.propertyId).toSorted()).toEqual([
      "p-cancelled",
      "p-elsewhere",
      "p-old",
    ]);
    const summary = store.summarizeListings(await store.listListings({ queueStatus: "all" }));
    expect(summary).toMatchObject({ newCount: 3, ourOrderCount: 1 });
  });

  it("reads only what is new the next time, a day back, page by page", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const result = await spiro.checkListingsAgainstSpiro({
      now: NOW + 60 * 60 * 1000,
      call: async (_name, args) => {
        calls.push(args);
        return args.page === 1 ? mcpPage([ORDERS[0]], true) : mcpPage([]);
      },
    });
    // The newest order held was submitted 2026-09-10T17:19:51.388Z.
    expect(calls[0]?.dateSubmittedFrom).toBe(
      new Date(Date.UTC(2026, 8, 10, 17, 19, 51, 388) - DAY).toISOString(),
    );
    expect(calls.map((c) => c.page)).toEqual([1, 2]);
    expect(result.flagged).toBe(1);
    // The four-month-old order was pruned rather than kept forever.
    expect((await spiro.getSpiroOrderCacheStatus(NOW)).orders).toBe(2);
  });

  it("keeps the flags it has when Spiro cannot be read", async () => {
    const result = await store.sweepListings(MARKETS, {
      now: NOW + 2 * 60 * 60 * 1000,
      fetchMarket: async () => ({
        listings: [listing("p-later", "9 Birch Ln", "45409")],
        creditsRemaining: 199,
      }),
      spiroCall: async () => {
        throw new Error("Spiro MCP error 503: unavailable");
      },
    });
    expect(result.added).toBe(1);
    expect(result.spiro.error).toContain("503");
    expect((await byProperty("p-ours"))?.spiroOrderId).not.toBeNull();
  });

  it("treats a tool error as an error, not as an empty account", async () => {
    const result = await spiro.checkListingsAgainstSpiro({
      now: NOW + 3 * 60 * 60 * 1000,
      call: async () => ({ isError: true, content: [{ type: "text", text: "Unauthorized" }] }),
    });
    expect(result.error).toContain("Unauthorized");
    expect(result.flagged).toBe(1);
  });

  it("puts a listing back to work when its order is cancelled", async () => {
    const result = await spiro.checkListingsAgainstSpiro({
      now: NOW + 4 * 60 * 60 * 1000,
      call: async () =>
        mcpPage([
          orderRow({
            orderId: "11111111-1111-4111-8111-111111111111",
            street: "1630 S Main St",
            status: "cancelled",
          }),
        ]),
    });
    expect(result.flagged).toBe(0);
    const row = await byProperty("p-ours");
    expect(row?.spiroOrderId).toBeNull();
    expect(row?.queueStatus).toBe("new");
  });

  it("leaves a listing somebody already decided about alone", async () => {
    const elm = await byProperty("p-cancelled");
    await store.dismissListing(elm!.id, { reason: "FSBO", actorName: "Dana" });
    await spiro.checkListingsAgainstSpiro({
      now: NOW + 5 * 60 * 60 * 1000,
      call: async () =>
        mcpPage([
          orderRow({
            orderId: "44444444-4444-4444-8444-444444444444",
            street: "22 Elm Street",
            zip: "45410",
          }),
        ]),
    });
    const after = await store.getListing(elm!.id);
    expect(after?.queueStatus).toBe("dismissed");
    expect(after?.spiroOrderId).toBeNull();
  });
});
