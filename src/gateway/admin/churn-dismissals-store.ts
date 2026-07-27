// Dismissed (hidden) agents on the Churn & Retention report.
//
// The report itself is a read-only snapshot the Python engine regenerates, so a
// dismissal cannot live in the snapshot — it lives here, in the admin DB, and is
// re-applied to every later snapshot. Dismissals are SHARED: one person prunes
// the outreach queue (retired agent, wrong number, already handled) and the rest
// of the team sees the pruned list, with who hid it and why.
//
// Keyed by `agent_key` — the agent GUID when the snapshot carries one, else a
// name|company fallback (see `churnAgentKey` in churn-store.ts).

import { getAdminDb } from "./user-store.js";

export type ChurnDismissal = {
  agentKey: string;
  agentName: string;
  companyName: string | null;
  reason: string | null;
  dismissedBy: string | null;
  dismissedByName: string | null;
  dismissedAt: number;
};

type ChurnDismissalRow = {
  agent_key: string;
  agent_name: string;
  company_name: string | null;
  reason: string | null;
  dismissed_by: string | null;
  dismissed_by_name: string | null;
  dismissed_at: number;
};

const MAX_REASON_LEN = 500;

function rowToDismissal(r: ChurnDismissalRow): ChurnDismissal {
  return {
    agentKey: r.agent_key,
    agentName: r.agent_name,
    companyName: r.company_name,
    reason: r.reason,
    dismissedBy: r.dismissed_by,
    dismissedByName: r.dismissed_by_name,
    dismissedAt: r.dismissed_at,
  };
}

/** Newest dismissal first — the "recently hidden" order the UI shows. */
export async function listChurnDismissals(): Promise<ChurnDismissal[]> {
  const db = getAdminDb();
  const rows = (await db
    .selectFrom("admin_churn_dismissals")
    .selectAll()
    .orderBy("dismissed_at", "desc")
    .execute()) as ChurnDismissalRow[];
  return rows.map(rowToDismissal);
}

/**
 * Hide an agent. Idempotent: re-dismissing an already-hidden agent refreshes the
 * reason and re-stamps who hid it, rather than failing.
 */
export async function dismissChurnAgent(input: {
  agentKey: string;
  agentName: string;
  companyName?: string | null;
  reason?: string | null;
  byUserId?: string | null;
  byUserName?: string | null;
  now?: number;
}): Promise<ChurnDismissal> {
  const db = getAdminDb();
  const at = input.now ?? Date.now();
  const reason = input.reason?.trim().slice(0, MAX_REASON_LEN) || null;
  const values = {
    agent_key: input.agentKey,
    agent_name: input.agentName,
    company_name: input.companyName ?? null,
    reason,
    dismissed_by: input.byUserId ?? null,
    dismissed_by_name: input.byUserName ?? null,
    dismissed_at: at,
  };
  await db
    .insertInto("admin_churn_dismissals")
    .values(values)
    .onConflict((oc) => oc.column("agent_key").doUpdateSet(values))
    .execute();
  return rowToDismissal(values);
}

/** Un-hide an agent. Returns false when they were not hidden to begin with. */
export async function restoreChurnAgent(agentKey: string): Promise<boolean> {
  const db = getAdminDb();
  const result = await db
    .deleteFrom("admin_churn_dismissals")
    .where("agent_key", "=", agentKey)
    .executeTakeFirst();
  return Number(result.numDeletedRows ?? 0) > 0;
}
