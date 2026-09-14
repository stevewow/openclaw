import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-listing-http-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleListingAdminRequest } = await import("./listing-http.js");
const listings = await import("./listing-store.js");
const leads = await import("./lead-store.js");
const territories = await import("./lead-territories.js");
const { parseListing } = await import("./listing-feed.js");
import type { FeedListing } from "./listing-feed.js";

/**
 * The queue's routes as admin-http.ts reaches them — auth and the `listings`
 * grant have already run. What is decided here is the two things this module
 * decides on its own: that sweeping is an admin's because it spends credits,
 * and that sending a listing on produces a lead nobody has to chase separately.
 */
let server: Server;
let base: string;
let asAdmin = true;
/** What Spiro answers with. Empty unless a test is about the Spiro check. */
let spiroOrders: unknown[] = [];

async function spiroCall(): Promise<unknown> {
  return {
    content: [{ type: "text", text: JSON.stringify({ data: spiroOrders, meta: {} }) }],
  };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const handled = await handleListingAdminRequest(
        url.pathname,
        req,
        res,
        { actorName: "Dana", isAdmin: asAdmin },
        { sweep: { spiroCall } },
      );
      if (!handled) {
        res.statusCode = 404;
        res.end("not found");
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  await territories.ensureTerritorySeed();
  await territories.updateTerritory("findlay", { ownerEmail: "craig@example.com" });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.OPENCLAW_STATE_DIR;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

async function call(
  method: string,
  route: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${base}${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as Record<string, unknown> };
}

function feedListing(id: string): FeedListing {
  return parseListing({
    property_id: id,
    listing_id: "l-" + id,
    status: "for_sale",
    list_date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    flags: { is_new_listing: true },
    address: { line: "139 Oakland Ave", city: "Findlay", state_code: "OH", postal_code: "45840" },
    list_price: 224900,
    beds: 3,
    baths: 2,
    href: "/realestateandhomes-detail/139-Oakland-Ave",
    advertisers: [
      {
        fulfillment_id: "616250",
        name: "Scott Fader",
        type: "seller",
        office: "Joseph Walter Realty, LLC",
      },
    ],
  }) as FeedListing;
}

async function seed(id: string): Promise<string> {
  await listings.sweepListings([{ key: "findlay", label: "Findlay", query: "Findlay, OH" }], {
    fetchMarket: async () => ({ listings: [feedListing(id)], creditsRemaining: 200 }),
    spiroCall,
  });
  const all = await listings.listListings({ queueStatus: "all" });
  return all.find((l) => l.propertyId === id)!.id;
}

describe("the new-listing queue", () => {
  it("hands the page its rows, its markets and what a sweep would cost", async () => {
    await seed("p-1");
    const res = await call("GET", "/listings");
    expect(res.status).toBe(200);
    expect((res.data.listings as unknown[]).length).toBeGreaterThan(0);
    expect((res.data.territories as unknown[]).length).toBe(8);
    // The page says what pressing Refresh will spend before it is pressed: the
    // eight market-report regions plus Cleveland.
    expect(res.data.marketCount).toBe(9);
    expect(res.data).toHaveProperty("feedConfigured");
    expect(res.data).toHaveProperty("lastSweep");
    expect(res.data.spiroOrders).toMatchObject({ orders: 0 });
    expect(res.data.summary).toMatchObject({ ourOrderCount: 0 });
  });

  it("will not let a non-admin spend credits", async () => {
    asAdmin = false;
    const res = await call("POST", "/listings/refresh", {});
    expect(res.status).toBe(403);
    asAdmin = true;
  });

  it("turns a listing into a lead the BDS actually gets", async () => {
    const id = await seed("p-2");
    const res = await call("POST", `/listings/${id}/send`, {
      email: "scott@joseph-walter.com",
      playbookKey: "getting_ready_guide",
      message: "Phone photos on the listing — worth a call.",
    });
    expect(res.status).toBe(201);

    const lead = res.data.lead as Record<string, unknown>;
    // It routes exactly like a website lead: the market decides the owner.
    expect(lead.source).toBe("listing");
    expect(lead.territoryKey).toBe("findlay");
    expect(lead.ownerEmail).toBe("craig@example.com");
    expect(lead.name).toBe("Scott Fader");
    expect(lead.company).toBe("Joseph Walter Realty, LLC");
    expect(lead.playbookKey).toBe("getting_ready_guide");
    // The house rides along as answers, so it reaches the owner's email and
    // the Pipedrive note by the route every other answer takes.
    const fields = lead.fields as Array<{ label: string; value: string }>;
    expect(fields.find((f) => f.label === "Listing address")?.value).toContain("139 Oakland Ave");
    expect(fields.find((f) => f.label === "Listing link")?.value).toContain("realtor.com");
    expect(fields.find((f) => f.label === "List price")?.value).toBe("$224,900");

    // And the row is off the queue, pointing at what it became.
    const listing = res.data.listing as Record<string, unknown>;
    expect(listing.queueStatus).toBe("sent");
    expect(listing.leadId).toBe(lead.id);
    expect(listing.actionedBy).toBe("Dana");
    expect(await leads.getLead(String(lead.id))).not.toBeNull();
  });

  it("insists on a way to reach the agent, which is the research step", async () => {
    const id = await seed("p-3");
    const res = await call("POST", `/listings/${id}/send`, { name: "Scott Fader" });
    expect(res.status).toBe(400);
    expect(String(res.data.error)).toContain("email or phone");
    // Still on the queue — a refused send must not quietly consume the row.
    expect((await listings.getListing(id))?.queueStatus).toBe("new");
  });

  it("refuses to send the same listing twice", async () => {
    const id = await seed("p-4");
    expect((await call("POST", `/listings/${id}/send`, { phone: "4199797361" })).status).toBe(201);
    const again = await call("POST", `/listings/${id}/send`, { phone: "4199797361" });
    expect(again.status).toBe(409);
    expect(again.data.error).toBe("already_sent");
  });

  it("sets one aside with the reason, and puts it back", async () => {
    const id = await seed("p-5");
    const off = await call("PUT", `/listings/${id}/dismiss`, { reason: "Already a client" });
    expect(off.status).toBe(200);
    expect((off.data.listing as Record<string, unknown>).queueStatus).toBe("dismissed");
    expect((off.data.listing as Record<string, unknown>).dismissedReason).toBe("Already a client");

    const back = await call("PUT", `/listings/${id}/restore`);
    expect((back.data.listing as Record<string, unknown>).queueStatus).toBe("new");
  });

  it("lets anyone working the queue check it against our Spiro orders", async () => {
    const id = await seed("p-6");
    spiroOrders = [
      {
        orderId: "55555555-5555-4555-8555-555555555555",
        trackingCode: "abc123",
        status: "delivered",
        dateSubmitted: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        property: {
          address: {
            streetAddress: "139 Oakland Avenue",
            city: "Findlay",
            stateOrProvince: "OH",
            postalCode: "45840",
          },
        },
        client: { agentName: "Scott Fader", companyName: "Joseph Walter Realty, LLC" },
      },
    ];
    // Not an admin: the check spends no feed credits.
    asAdmin = false;
    const res = await call("POST", "/listings/spiro-check", {});
    asAdmin = true;
    spiroOrders = [];
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect((res.data.result as Record<string, unknown>).flagged).toBeGreaterThan(0);
    expect(res.data.spiroOrders).toMatchObject({ orders: 1 });

    const ours = await call("GET", "/listings?status=ours");
    const rows = ours.data.listings as Array<Record<string, unknown>>;
    expect(rows.map((l) => l.id)).toContain(id);
    // Off the worklist, and counted where the tiles can see it from any tab.
    const toWork = await call("GET", "/listings?status=new");
    expect((toWork.data.listings as Array<Record<string, unknown>>).map((l) => l.id)).not.toContain(
      id,
    );
    expect((toWork.data.summary as Record<string, number>).ourOrderCount).toBe(rows.length);
  });

  it("answers for a listing nobody has", async () => {
    expect((await call("GET", "/listings/nope")).status).toBe(404);
  });
});
