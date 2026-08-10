// The badges that follow a real-estate agent around the dashboard.
//
// Two of them, from two different sources:
//   - VIP, which Spiro owns on the agent's `settings.vip`
//   - top 20%, cut once per refresh from trailing-twelve-month revenue within
//     the agent's own region (see refreshRosterTopPercent in focus-store)
//
// Both are read from the same roster cache here so that every surface showing
// an agent renders the same badges. A report that recomputed its own cut would
// badge someone on one screen and not the next, which is exactly the confusion
// this module exists to prevent.

import { regionLabel } from "./focus-regions.js";
import { getAdminDb } from "./user-store.js";

export type AgentBadges = {
  vip: boolean;
  topPercent: boolean;
  /** Region the top-20% cut was made in, for the badge tooltip. */
  region: string | null;
};

export const NO_BADGES: AgentBadges = { vip: false, topPercent: false, region: null };

/**
 * Agent names arrive from two places that disagree about spacing and case —
 * the roster's `firstName lastName` and the order's `client.agentName`. This
 * is only ever a fallback for rows with no agent id; the id is authoritative.
 */
export function normalizeAgentName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export type AgentBadgeIndex = {
  /** Badges for one agent, by id where known and by name otherwise. */
  lookup: (ref: { agentId?: string | null; name?: string | null }) => AgentBadges;
  /** How many agents carry each badge, for report headers. */
  counts: { vip: number; topPercent: number };
};

/**
 * Load every agent's badges once, for a report about to render many rows.
 *
 * Returns a lookup rather than a map so callers cannot accidentally key it the
 * wrong way. Names that two different agents share are dropped from the name
 * index: badging the wrong agent is worse than badging neither, and the id path
 * still resolves both of them correctly.
 */
export async function loadAgentBadges(): Promise<AgentBadgeIndex> {
  const rows = await getAdminDb()
    .selectFrom("admin_focus_agents")
    .select(["agent_id", "name", "vip", "region", "top_percent"])
    .execute();

  const byId = new Map<string, AgentBadges>();
  const byName = new Map<string, AgentBadges | null>();
  let vipCount = 0;
  let topCount = 0;

  for (const row of rows) {
    const badges: AgentBadges = {
      vip: row.vip === 1,
      topPercent: row.top_percent === 1,
      region: row.region ? regionLabel(row.region) : null,
    };
    if (badges.vip) {
      vipCount += 1;
    }
    if (badges.topPercent) {
      topCount += 1;
    }
    byId.set(row.agent_id, badges);
    const key = normalizeAgentName(row.name);
    if (!key) {
      continue;
    }
    // null marks a name more than one agent answers to.
    byName.set(key, byName.has(key) ? null : badges);
  }

  return {
    lookup: (ref) => {
      if (ref.agentId) {
        const hit = byId.get(ref.agentId);
        if (hit) {
          return hit;
        }
      }
      if (ref.name) {
        return byName.get(normalizeAgentName(ref.name)) ?? NO_BADGES;
      }
      return NO_BADGES;
    },
    counts: { vip: vipCount, topPercent: topCount },
  };
}
