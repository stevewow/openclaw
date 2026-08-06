// BDS ownership for the Churn & Retention report.
//
// The retention engine knows nothing about sales territory: its rows carry an
// agent, a brokerage and a revenue figure, and nothing about where the client
// is. But "who should call this person" is the first question anyone asks of an
// outreach queue, so the same ownership rule the sales Focus report uses is
// applied here — one rule, one module (`focus-regions.ts`), so the two reports
// can never name different owners for the same client.
//
// Region comes from the Focus caches: agent → company → service area. Those are
// swept by the Focus refresh, not this report's, so an unrefreshed cache leaves
// the columns blank rather than wrong.

import { churnAgentKey } from "./churn-store.js";
import {
  assignOwners,
  type BdsName,
  type OwnedClient,
  regionKey,
  regionLabel,
} from "./focus-regions.js";
import { getAdminDb } from "./user-store.js";

export type ChurnOwnership = {
  /** Display region, e.g. "Columbus". Null when nothing resolved it. */
  region: string | null;
  bds: BdsName | null;
};

/** Where a churn row's region can be looked up from. */
export type ChurnRegionIndex = {
  /** Spiro agent GUID → service area. The reliable join. */
  byAgentId: Map<string, string>;
  /**
   * Normalized brokerage name → service area, holding only names that resolve
   * to exactly one region. A churned agent can be off the current roster, so
   * the brokerage is the fallback — but brokerage names are duplicated across
   * company records (the report's own data-quality table lists them), and a
   * name spanning two regions must answer "unknown" rather than pick one.
   */
  byCompanyName: Map<string, string>;
};

function normalizeCompany(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Region for one churn row, agent GUID first and brokerage name as fallback. */
export function lookupChurnRegion(
  index: ChurnRegionIndex,
  row: Record<string, unknown>,
): string | null {
  const agentId = typeof row.agent_id === "string" ? row.agent_id.trim() : "";
  const viaAgent = agentId ? index.byAgentId.get(agentId) : undefined;
  if (viaAgent) {
    return viaAgent;
  }
  const company = typeof row.company_name === "string" ? row.company_name : "";
  if (!company.trim()) {
    return null;
  }
  return index.byCompanyName.get(normalizeCompany(company)) ?? null;
}

function revenueOf(row: Record<string, unknown>): number {
  const v = row.revenue;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Work out region and owner for a set of churn rows.
 *
 * The Columbus/Dayton cut needs a revenue ranking, and the one this report has
 * is the snapshot's own window revenue — not the Focus report's selected
 * period. The two therefore agree on the rule but can disagree on a client
 * sitting right at the line, which is the honest answer: each report ranks by
 * the money it is actually showing.
 *
 * Rows are deduplicated by agent key first, because the outreach queue is a
 * subset of the agent scores and a client ranked twice would distort the cut.
 */
export function churnOwnership(
  rows: Array<Record<string, unknown>>,
  index: ChurnRegionIndex,
): Map<string, ChurnOwnership> {
  const byKey = new Map<string, OwnedClient>();
  for (const row of rows) {
    const key = churnAgentKey(row);
    if (!key || byKey.has(key)) {
      continue;
    }
    byKey.set(key, { key, region: lookupChurnRegion(index, row), revenue: revenueOf(row) });
  }
  const owners = assignOwners([...byKey.values()]);
  const out = new Map<string, ChurnOwnership>();
  for (const [key, client] of byKey) {
    out.set(key, {
      region: regionKey(client.region) ? regionLabel(client.region) : null,
      bds: owners.get(key) ?? null,
    });
  }
  return out;
}

/** Build the region index from the Focus caches. */
export async function loadChurnRegionIndex(): Promise<ChurnRegionIndex> {
  const db = getAdminDb();
  const companies = await db
    .selectFrom("admin_focus_companies")
    .select(["company_id", "name", "region"])
    .execute();
  const regionByCompanyId = new Map<string, string>();
  // A name seen in two different regions is recorded as ambiguous and then
  // never answered, rather than resolving to whichever row was read last.
  const regionByName = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const c of companies) {
    if (!c.region) {
      continue;
    }
    regionByCompanyId.set(c.company_id, c.region);
    const name = normalizeCompany(c.name ?? "");
    if (!name) {
      continue;
    }
    const seen = regionByName.get(name);
    if (seen && regionKey(seen) !== regionKey(c.region)) {
      ambiguous.add(name);
    } else if (!seen) {
      regionByName.set(name, c.region);
    }
  }
  for (const name of ambiguous) {
    regionByName.delete(name);
  }

  const agents = await db
    .selectFrom("admin_focus_agents")
    .select(["agent_id", "company_id"])
    .execute();
  const byAgentId = new Map<string, string>();
  for (const a of agents) {
    const region = a.company_id ? regionByCompanyId.get(a.company_id) : undefined;
    if (region) {
      byAgentId.set(a.agent_id, region);
    }
  }
  return { byAgentId, byCompanyName: regionByName };
}

/**
 * Add `region` and `bds` to every row of both churn tables.
 *
 * Rows are display records the dashboard renders column by column, so this is
 * additive: the snapshot on disk is untouched and an older snapshot simply
 * gains two more fields.
 */
export function attachChurnOwnership(
  tables: Array<Array<Record<string, unknown>>>,
  index: ChurnRegionIndex,
): { owned: number; unknownRegion: number } {
  const all = tables.flat();
  const owners = churnOwnership(all, index);
  let owned = 0;
  let unknownRegion = 0;
  for (const row of all) {
    const o = owners.get(churnAgentKey(row));
    row.region = o?.region ?? null;
    row.bds = o?.bds ?? null;
  }
  for (const o of owners.values()) {
    if (o.bds) {
      owned += 1;
    }
    if (!o.region) {
      unknownRegion += 1;
    }
  }
  return { owned, unknownRegion };
}
