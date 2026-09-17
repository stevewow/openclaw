// New listings, market by market, from the realtor.com feed.
//
// This is the top of the prospecting funnel: a house that went on the market
// this morning has a listing agent who either already shoots with us or is
// about to shoot with somebody. Either way it is worth knowing about today
// rather than next quarter.
//
// Why this feed and not a crawler. Zillow's terms forbid scraping and it is
// defended accordingly, so a crawler against it breaks every few weeks —
// usually quietly, which is the worst way for a prospecting list to fail. The
// licensed feed also carries more than a crawl would: `advertisers[]` names the
// listing agent, their brokerage, and the id that joins to agent search. The
// Redfin variant of the same API was checked and returns `brokers: {}` — the
// address without the person, which is half a lead.
//
// Metered, and the meter is the real constraint: one credit per call against a
// 250-credit pool shared with the Housing Market report. So a sweep reads the
// newest page per market and stops, rather than paging an entire city — sorted
// newest-first, a day's listings are at the front, and anything past them is
// last week's news bought at the same price.

/** Where the feed lives. Overridable so a test never reaches the network. */
const FEED_BASE = "https://realtor.realtyapi.io";

export type ListingMarket = {
  /** Territory key, so a listing routes the way a lead does. */
  key: string;
  label: string;
  /** What the feed is asked for. The state qualifier is load-bearing. */
  query: string;
};

/** One listing, reduced to what a person deciding whether to call needs. */
export type FeedListing = {
  /** The feed's own id. The dedupe key: a listing seen twice is one row. */
  propertyId: string;
  listingId: string | null;
  status: string;
  /** When it went on the market, per the feed. Milliseconds. */
  listedAt: number | null;
  isNewListing: boolean;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  photoCount: number;
  /** The listing page, absolute. What the VA opens to research it. */
  href: string | null;
  photoUrl: string | null;
  /** Who listed it — the reason this row is a prospecting lead at all. */
  agentName: string | null;
  agentOffice: string | null;
  /** The feed's id for the agent, which joins to its agent search. */
  agentFeedId: string | null;
};

export type FeedPage = {
  listings: FeedListing[];
  /** What the feed says the market holds in total, for context not paging. */
  total: number | null;
  /** Credits the key has left, straight off the response header. */
  creditsRemaining: number | null;
};

export type ListingFeedDeps = {
  apiKey?: string | null;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
};

export function readFeedApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.REALTYAPI_KEY?.trim() || null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * A photo off the feed.
 *
 * `primary_photo` arrives as a bare URL string and `photos[]` as an array of
 * them; earlier code here read `.href` off both, which is undefined on a
 * string, so every row stored a null thumbnail. Objects are still accepted in
 * case the shape ever grows one. The `photos[]` copies are served over plain
 * http while `primary_photo` is https, and an http image is blocked in an email
 * client and in the CRM, so the scheme is forced up.
 */
function photoUrl(raw: unknown): string | null {
  const href =
    typeof raw === "object" && raw !== null ? str((raw as Record<string, unknown>).href) : str(raw);
  if (!href) {
    return null;
  }
  return href.startsWith("http://") ? `https://${href.slice("http://".length)}` : href;
}

/**
 * The feed's `href` is sometimes a path and sometimes absolute. A VA clicks
 * this, so it has to be a link either way.
 */
function absoluteHref(raw: unknown, host: string): string | null {
  const href = str(raw);
  if (!href) {
    return null;
  }
  if (/^https?:\/\//i.test(href)) {
    return href;
  }
  return `https://${host}${href.startsWith("/") ? "" : "/"}${href}`;
}

/** One row of the feed, as much of it as we can trust. */
export function parseListing(raw: unknown): FeedListing | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const propertyId = str(row.property_id);
  if (!propertyId) {
    // Without an id there is no dedupe key, and a prospecting list that shows
    // the same house every morning is one nobody opens twice.
    return null;
  }
  const address = (row.address ?? {}) as Record<string, unknown>;
  const flags = (row.flags ?? {}) as Record<string, unknown>;
  const advertisers = Array.isArray(row.advertisers) ? row.advertisers : [];
  // The seller's agent is the one worth calling; a row can also carry the
  // buyer's side and the office itself.
  const seller =
    advertisers.find((a) => (a as Record<string, unknown>)?.type === "seller") ?? advertisers[0];
  const agent = (seller ?? {}) as Record<string, unknown>;
  const listDate = str(row.list_date);
  const listedAt = listDate ? Date.parse(listDate) : Number.NaN;
  const photos = Array.isArray(row.photos) ? row.photos : [];

  return {
    propertyId,
    listingId: str(row.listing_id),
    status: str(row.status) ?? "unknown",
    listedAt: Number.isFinite(listedAt) ? listedAt : null,
    isNewListing: flags.is_new_listing === true,
    address: str(address.line),
    city: str(address.city),
    state: str(address.state_code) ?? str(address.state),
    zip: str(address.postal_code),
    price: num(row.list_price),
    beds: num(row.beds),
    baths: num(row.baths),
    sqft: num(row.sqft),
    photoCount: num(row.photo_count) ?? photos.length,
    href: absoluteHref(row.href, "www.realtor.com"),
    photoUrl: photoUrl(row.primary_photo) ?? photoUrl(photos[0]),
    agentName: str(agent.name),
    agentOffice: str(agent.office),
    agentFeedId: str(agent.fulfillment_id),
  };
}

/**
 * The newest listings in one market.
 *
 * Deliberately one page. Sorted newest-first the day's arrivals are at the
 * front, and every page after that costs another credit to be told about
 * houses that went on the market last week.
 */
export async function fetchNewListings(
  market: ListingMarket,
  deps: ListingFeedDeps & { pageSize?: number } = {},
): Promise<FeedPage> {
  const apiKey = deps.apiKey ?? readFeedApiKey(deps.env);
  if (!apiKey) {
    throw new Error("RealtyAPI is not configured — set REALTYAPI_KEY");
  }
  const doFetch = deps.fetchImpl ?? fetch;
  const url = new URL("/search/bylocation", deps.baseUrl ?? FEED_BASE);
  url.searchParams.set("location", market.query);
  url.searchParams.set("searchType", "For_Sale");
  url.searchParams.set("sortOrder", "Newest");
  url.searchParams.set("resultCount", String(deps.pageSize ?? 50));

  const res = await doFetch(url, { headers: { "x-realtyapi-key": apiKey } });
  if (res.status === 402) {
    throw new Error("RealtyAPI credits exhausted");
  }
  if (!res.ok) {
    throw new Error(`RealtyAPI error: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const rows = Array.isArray(body.searchResults) ? body.searchResults : [];
  return {
    listings: rows.flatMap((row) => {
      const parsed = parseListing(row);
      return parsed ? [parsed] : [];
    }),
    total: num(body.total),
    creditsRemaining: num(res.headers.get("x-credits-remaining")),
  };
}

/**
 * The ones that arrived inside the window.
 *
 * A listing with no date is kept only when the feed flagged it as new: the
 * point of the page is what changed since yesterday, and an undated row is
 * more likely to be a gap in the feed than a house that appeared from nowhere.
 */
export function withinWindow(
  listings: readonly FeedListing[],
  now: number,
  windowHours: number,
): FeedListing[] {
  const cutoff = now - windowHours * 60 * 60 * 1000;
  return listings.filter((listing) =>
    listing.listedAt === null ? listing.isNewListing : listing.listedAt >= cutoff,
  );
}
