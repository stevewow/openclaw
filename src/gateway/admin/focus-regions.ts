// Who owns which client, for the sales Focus report.
//
// A client's region is the service area of the company they belong to. Six of
// the eight regions belong outright to one BDS. Columbus and Dayton are shared:
// in each of those two cities the top slice of clients by revenue is one
// person's and the rest is another's — so ownership there is not a lookup, it is
// recomputed from the revenue of the period being viewed. A client who grows
// into the top slice changes hands, and the report should say so rather than
// quietly keep them where they were.
//
// The two cities are cut separately, not as one combined book: a 20% slice of
// the pair would be filled by whichever city bills more, and the smaller one
// would end up with no top clients of its own.

export type BdsName = "Pam Branam" | "Joy Kiser" | "Craig Magrum" | "Chris Voge" | "Ryan Bowersock";

export const BDS_NAMES: BdsName[] = [
  "Pam Branam",
  "Joy Kiser",
  "Craig Magrum",
  "Chris Voge",
  "Ryan Bowersock",
];

/** Regions one person owns outright, whatever the numbers say. */
const SOLE_OWNERS: Record<string, BdsName> = {
  cincinnati: "Pam Branam",
  charlotte: "Joy Kiser",
  toledo: "Craig Magrum",
  findlay: "Craig Magrum",
  "fort wayne": "Chris Voge",
  lima: "Ryan Bowersock",
};

/** Regions split by revenue rank rather than owned outright. */
export const SPLIT_REGIONS = ["columbus", "dayton"] as const;

/**
 * Every region the business serves, sole-owned and split alike. Exported so a
 * report that needs the whole footprint rather than the ownership of it — the
 * market report does — reads the same list the BDS map is built from instead of
 * keeping a second copy that quietly drifts when a region is added.
 */
export const ALL_REGIONS: readonly string[] = [
  ...Object.keys(SOLE_OWNERS),
  ...SPLIT_REGIONS,
].toSorted();

/** Chris Voge takes this share of the shared book; Ryan Bowersock takes the rest. */
export const SPLIT_TOP_SHARE = 0.2;
const SPLIT_TOP_OWNER: BdsName = "Chris Voge";
const SPLIT_REST_OWNER: BdsName = "Ryan Bowersock";

/**
 * Spiro names a service area "Cincinnati, Ohio"; the BDS book says
 * "Cincinnati". Reduce both to the city so they meet.
 */
export function regionKey(serviceArea: string | null | undefined): string {
  return (serviceArea ?? "").split(",")[0].trim().toLowerCase();
}

/** A region label fit to show, e.g. "Fort Wayne" from "Fort Wayne, Indiana". */
export function regionLabel(serviceArea: string | null | undefined): string {
  const raw = (serviceArea ?? "").split(",")[0].trim();
  return raw || "Unknown";
}

export function isSplitRegion(serviceArea: string | null | undefined): boolean {
  return (SPLIT_REGIONS as readonly string[]).includes(regionKey(serviceArea));
}

export type OwnedClient = {
  /** Any stable id; only used to key the result. */
  key: string;
  region: string | null;
  revenue: number;
};

/**
 * Rank a book by revenue, breaking ties by key so the same input always cuts the
 * same way; a client should not swap owners between two identical page loads.
 */
function rankByRevenue(clients: OwnedClient[]): OwnedClient[] {
  return clients.toSorted((a, b) => b.revenue - a.revenue || a.key.localeCompare(b.key));
}

/**
 * How many clients the top slice holds. "Top 20% of clients", so a share of the
 * count, not of the money — and at least one whenever the book is not empty.
 */
export function topSliceCount(total: number, share: number = SPLIT_TOP_SHARE): number {
  return total <= 0 ? 0 : Math.max(1, Math.ceil(total * share));
}

/** Group clients by region key, dropping any whose region is unknown. */
function groupByRegion(clients: OwnedClient[]): Map<string, OwnedClient[]> {
  const out = new Map<string, OwnedClient[]>();
  for (const c of clients) {
    const key = regionKey(c.region);
    if (!key) {
      continue;
    }
    const bucket = out.get(key);
    if (bucket) {
      bucket.push(c);
    } else {
      out.set(key, [c]);
    }
  }
  return out;
}

/**
 * Decide who owns each client. Sole-owner regions are a lookup; Columbus and
 * Dayton are each ranked by revenue on their own and cut at the top 20% of that
 * city's clients by count.
 *
 * Returns a map of client key → BDS, leaving out clients in regions nobody owns
 * so they surface as unassigned rather than being quietly handed to someone.
 */
export function assignOwners(clients: OwnedClient[]): Map<string, BdsName> {
  const out = new Map<string, BdsName>();
  const shared: OwnedClient[] = [];

  for (const c of clients) {
    const key = regionKey(c.region);
    if (!key) {
      continue;
    }
    const sole = SOLE_OWNERS[key];
    if (sole) {
      out.set(c.key, sole);
    } else if ((SPLIT_REGIONS as readonly string[]).includes(key)) {
      shared.push(c);
    }
  }

  for (const bucket of groupByRegion(shared).values()) {
    const ranked = rankByRevenue(bucket);
    const topCount = topSliceCount(ranked.length);
    ranked.forEach((c, i) => {
      out.set(c.key, i < topCount ? SPLIT_TOP_OWNER : SPLIT_REST_OWNER);
    });
  }

  return out;
}

/**
 * Which clients sit in the top slice of their OWN region by revenue.
 *
 * Every region is ranked on its own, so in Columbus and Dayton this tag now
 * agrees with the ownership cut by construction; elsewhere it answers "is this
 * one of my best clients here?" for regions that have a single owner anyway.
 * It stays a separate computation because it covers all eight regions and
 * ownership only has an opinion about two.
 *
 * A region with no revenue at all yields no tags: everyone tying on zero would
 * otherwise hand the label to whoever sorted first.
 */
export function assignRegionTopPercentile(
  clients: OwnedClient[],
  share: number = SPLIT_TOP_SHARE,
): Set<string> {
  const top = new Set<string>();
  for (const bucket of groupByRegion(clients).values()) {
    if (bucket.every((c) => c.revenue <= 0)) {
      continue;
    }
    const ranked = rankByRevenue(bucket);
    for (const c of ranked.slice(0, topSliceCount(ranked.length, share))) {
      // A client billing nothing is never "top" of anything, even if the
      // region is small enough that the slice would otherwise reach them.
      if (c.revenue > 0) {
        top.add(c.key);
      }
    }
  }
  return top;
}

/**
 * Plain-English note for the report header, so the split is not a mystery.
 *
 * Takes the clients rather than a count because the cut is per city now: the
 * header has to state both cuts, and doing the ceil arithmetic here keeps the
 * sentence and `assignOwners` from ever disagreeing about where the line falls.
 */
export function splitExplainer(clients: OwnedClient[]): string {
  const byRegion = groupByRegion(clients);
  const parts: string[] = [];
  for (const key of SPLIT_REGIONS) {
    const bucket = byRegion.get(key);
    if (!bucket || bucket.length === 0) {
      continue;
    }
    const label = regionLabel(bucket[0].region);
    const top = topSliceCount(bucket.length);
    parts.push(
      `${label} — top ${top} of ${bucket.length} to ${SPLIT_TOP_OWNER}, the other ${bucket.length - top} to ${SPLIT_REST_OWNER}`,
    );
  }
  if (parts.length === 0) {
    return "No Columbus or Dayton clients in this period.";
  }
  return `Columbus and Dayton are split by revenue over this period, each city cut on its own: ${parts.join("; ")}.`;
}
