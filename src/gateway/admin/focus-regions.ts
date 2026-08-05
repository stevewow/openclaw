// Who owns which client, for the sales Focus report.
//
// A client's region is the service area of the company they belong to. Six of
// the eight regions belong outright to one BDS. Columbus and Dayton are shared:
// the top slice of clients by revenue is one person's, the rest is another's —
// so ownership there is not a lookup, it is recomputed from the revenue of the
// period being viewed. A client who grows into the top slice changes hands, and
// the report should say so rather than quietly keep them where they were.

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
 * Decide who owns each client. Sole-owner regions are a lookup; the shared
 * Columbus/Dayton book is ranked by revenue across BOTH cities together (that is
 * how the split was described) and cut at the top 20% of clients by count.
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

  if (shared.length > 0) {
    // Ties are broken by key so the same input always cuts the same way; a
    // client should not swap owners between two identical page loads.
    const ranked = shared.toSorted((a, b) => b.revenue - a.revenue || a.key.localeCompare(b.key));
    // "Top 20% of clients", so a share of the count, not of the money. At least
    // one client is in the top slice whenever the shared book is not empty.
    const topCount = Math.max(1, Math.ceil(ranked.length * SPLIT_TOP_SHARE));
    ranked.forEach((c, i) => {
      out.set(c.key, i < topCount ? SPLIT_TOP_OWNER : SPLIT_REST_OWNER);
    });
  }

  return out;
}

/**
 * Which clients sit in the top slice of their OWN region by revenue.
 *
 * Deliberately not the same computation as `assignOwners`. Ownership ranks
 * Columbus and Dayton as one combined book, because that is how the BDS split
 * was described; this tag ranks every region on its own, because it answers
 * "is this one of my best clients here?" and the report shows Columbus and
 * Dayton as separate regions. The two can therefore disagree for those two
 * cities, which is intended rather than a bug.
 *
 * A region with no revenue at all yields no tags: everyone tying on zero would
 * otherwise hand the label to whoever sorted first.
 */
export function assignRegionTopPercentile(
  clients: OwnedClient[],
  share: number = SPLIT_TOP_SHARE,
): Set<string> {
  const byRegion = new Map<string, OwnedClient[]>();
  for (const c of clients) {
    const key = regionKey(c.region);
    if (!key) {
      continue;
    }
    const bucket = byRegion.get(key);
    if (bucket) {
      bucket.push(c);
    } else {
      byRegion.set(key, [c]);
    }
  }

  const top = new Set<string>();
  for (const bucket of byRegion.values()) {
    if (bucket.every((c) => c.revenue <= 0)) {
      continue;
    }
    // Ties broken by key so two identical page loads cut the same way.
    const ranked = bucket.toSorted((a, b) => b.revenue - a.revenue || a.key.localeCompare(b.key));
    const topCount = Math.max(1, Math.ceil(ranked.length * share));
    for (const c of ranked.slice(0, topCount)) {
      // A client billing nothing is never "top" of anything, even if the
      // region is small enough that the slice would otherwise reach them.
      if (c.revenue > 0) {
        top.add(c.key);
      }
    }
  }
  return top;
}

/** Plain-English note for the report header, so the split is not a mystery. */
export function splitExplainer(sharedCount: number): string {
  if (sharedCount === 0) {
    return "No Columbus or Dayton clients in this period.";
  }
  const top = Math.max(1, Math.ceil(sharedCount * SPLIT_TOP_SHARE));
  return `Columbus and Dayton are split by revenue over this period: the top ${top} of ${sharedCount} clients go to ${SPLIT_TOP_OWNER}, the remaining ${sharedCount - top} to ${SPLIT_REST_OWNER}.`;
}
