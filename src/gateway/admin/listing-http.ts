// Admin routes for the new-listing queue, under /api/admin/listings.
//
// Auth and the `listings` feature gate run in admin-http.ts before anything
// here. What is decided here is what a viewer may do once inside: anybody who
// can see the queue can work it — research a row, send it, set it aside —
// because that is the job the section exists for. Only sweeping is an admin's,
// since a sweep spends metered credits and a queue page that anyone can reload
// into an empty balance is not a queue anyone can rely on.

import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "../hooks.js";
import { sendJson } from "../http-common.js";
import { syncLeadToCrmInBackground } from "./lead-crm.js";
import { dispatchLead } from "./lead-notify.js";
import { getPlaybook, listPlaybooks } from "./lead-playbooks-store.js";
import { createLead, getLead } from "./lead-store.js";
import { getTerritory, listTerritories } from "./lead-territories.js";
import { readFeedApiKey } from "./listing-feed.js";
import { listingMarkets } from "./listing-markets.js";
import {
  dismissListing,
  getLastSweep,
  getListing,
  type ListingFilter,
  type ListingQueueStatus,
  listListings,
  markListingSent,
  restoreListing,
  summarizeListings,
  type SweepDeps,
  sweepListings,
} from "./listing-store.js";

const MAX_BODY_BYTES = 32 * 1024;

export type ListingRequestContext = {
  actorName: string;
  /** Only an admin may spend credits on a sweep. */
  isAdmin: boolean;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** What the page draws itself from, in one round trip. */
async function respondWithQueue(res: ServerResponse, url: URL): Promise<void> {
  const statusParam = url.searchParams.get("status");
  const filter: ListingFilter = {
    queueStatus:
      statusParam === "all" ||
      statusParam === "open" ||
      statusParam === "new" ||
      statusParam === "sent" ||
      statusParam === "dismissed"
        ? (statusParam as ListingQueueStatus | "all" | "open")
        : "new",
    territoryKey: url.searchParams.get("territory") ?? undefined,
    hours: Number.parseInt(url.searchParams.get("hours") ?? "", 10) || undefined,
    q: url.searchParams.get("q") ?? undefined,
  };
  const listings = await listListings(filter);
  sendJson(res, 200, {
    listings,
    summary: summarizeListings(listings),
    territories: await listTerritories(),
    // What a sweep would cost, so the button can say so before it is pressed.
    marketCount: listingMarkets().length,
    lastSweep: await getLastSweep(),
    feedConfigured: Boolean(readFeedApiKey()),
    playbooks: (await listPlaybooks())
      .filter((playbook) => playbook.active)
      .map((playbook) => ({ key: playbook.key, label: playbook.label })),
  });
}

export async function handleListingAdminRequest(
  subPath: string,
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ListingRequestContext,
  deps: { sweep?: SweepDeps } = {},
): Promise<boolean> {
  if (subPath !== "/listings" && !subPath.startsWith("/listings/")) {
    return false;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";

  if (subPath === "/listings" && method === "GET") {
    await respondWithQueue(res, url);
    return true;
  }

  // Spend credits and file what is new.
  if (subPath === "/listings/refresh" && method === "POST") {
    if (!ctx.isAdmin) {
      sendJson(res, 403, { error: "forbidden" });
      return true;
    }
    if (!readFeedApiKey()) {
      sendJson(res, 400, { error: "REALTYAPI_KEY is not set" });
      return true;
    }
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    const data = body.ok ? (body.value as Record<string, unknown>) : {};
    const only = Array.isArray(data.markets)
      ? data.markets.filter((m): m is string => typeof m === "string")
      : null;
    const markets = listingMarkets().filter((m) => !only || only.includes(m.key));
    // Narrowed rather than stringified: the body is whatever was posted, and
    // an object coerced to a string parses as NaN in a way that reads as zero.
    const rawHours = data.hours;
    const hours =
      typeof rawHours === "number"
        ? rawHours
        : typeof rawHours === "string"
          ? Number.parseInt(rawHours, 10)
          : Number.NaN;
    const result = await sweepListings(markets, {
      ...deps.sweep,
      windowHours: Number.isFinite(hours) && hours > 0 ? hours : undefined,
    });
    sendJson(res, 200, { ok: result.errors.length === 0, result, lastSweep: await getLastSweep() });
    return true;
  }

  const rest = subPath.slice("/listings/".length);
  const [rawId, action] = rest.split("/");
  const id = decodeURIComponent(rawId ?? "");
  const listing = id ? await getListing(id) : null;
  if (!listing) {
    sendJson(res, 404, { error: "not_found" });
    return true;
  }

  // The whole point of the queue: this house becomes a lead the BDS gets.
  if (action === "send" && method === "POST") {
    if (listing.queueStatus === "sent") {
      sendJson(res, 409, { error: "already_sent", listing });
      return true;
    }
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendJson(res, 400, { error: body.error });
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const email = str(data.email);
    const phone = str(data.phone);
    if (!email && !phone) {
      // The feed carries no contact details by design, which is exactly the
      // research the VA does before sending. A lead nobody can ring is not a
      // lead, so the rule the rest of the queue lives by holds here too.
      sendJson(res, 400, { error: "email or phone required" });
      return true;
    }
    const territoryKey = str(data.territoryKey) ?? listing.territoryKey;
    const territory = territoryKey ? await getTerritory(territoryKey) : null;
    const playbookKey = str(data.playbookKey);
    const playbook = playbookKey ? await getPlaybook(playbookKey) : null;

    const fields: Array<{ label: string; value: string }> = [];
    const address = [listing.address, listing.city, listing.state].filter(Boolean).join(", ");
    if (address) {
      fields.push({ label: "Listing address", value: address });
    }
    if (listing.href) {
      fields.push({ label: "Listing link", value: listing.href });
    }
    if (listing.price) {
      fields.push({ label: "List price", value: `$${listing.price.toLocaleString("en-US")}` });
    }
    if (listing.listedAt) {
      fields.push({ label: "Listed", value: new Date(listing.listedAt).toISOString() });
    }

    const lead = await createLead({
      source: "listing",
      formName: null,
      playbookKey: playbook?.key ?? null,
      name: str(data.name) ?? listing.agentName,
      email,
      phone,
      company: str(data.company) ?? listing.agentOffice,
      message: str(data.message),
      marketRaw: territory?.label ?? listing.marketLabel,
      territoryKey: territory?.key ?? null,
      ownerName: territory?.ownerName ?? null,
      ownerEmail: territory?.ownerEmail ?? null,
      fields,
    });
    await markListingSent(listing.id, { leadId: lead.id, actorName: ctx.actorName });
    // Same two deliveries every other lead gets: the owner hears about it, and
    // it files itself in the CRM with the first follow-up already on their list.
    syncLeadToCrmInBackground(lead, { playbook });
    await dispatchLead(lead);
    sendJson(res, 201, {
      lead: (await getLead(lead.id)) ?? lead,
      listing: await getListing(listing.id),
    });
    return true;
  }

  if (action === "dismiss" && method === "PUT") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    const data = body.ok ? (body.value as Record<string, unknown>) : {};
    await dismissListing(listing.id, { reason: str(data.reason), actorName: ctx.actorName });
    sendJson(res, 200, { listing: await getListing(listing.id) });
    return true;
  }

  if (action === "restore" && method === "PUT") {
    await restoreListing(listing.id);
    sendJson(res, 200, { listing: await getListing(listing.id) });
    return true;
  }

  if (!action && method === "GET") {
    sendJson(res, 200, { listing });
    return true;
  }

  sendJson(res, 405, { error: "method_not_allowed" });
  return true;
}
