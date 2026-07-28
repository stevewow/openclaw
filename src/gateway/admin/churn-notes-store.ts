// Notes against an agent on the Churn & Retention report.
//
// Same reasoning as the dismissals store: the snapshot is a read-only file the
// Python engine rewrites, so anything a human types has to live in the admin DB
// and be re-attached on every read. Notes are shared and append-only — "called,
// left voicemail" from last month is the context that makes this month's call
// worth making, so nothing is overwritten. Deleting a single note is allowed for
// typos; there is no edit-in-place.
//
// Keyed by `agent_key` — the same identity as a dismissal (see `churnAgentKey`
// in churn-store.ts), so a note and a hide describe the same agent.

import { randomUUID } from "node:crypto";
import { getAdminDb } from "./user-store.js";

export type ChurnNote = {
  id: string;
  agentKey: string;
  agentName: string;
  companyName: string | null;
  body: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: number;
};

type ChurnNoteRow = {
  id: string;
  agent_key: string;
  agent_name: string;
  company_name: string | null;
  body: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: number;
};

const MAX_BODY_LEN = 2000;

function rowToNote(r: ChurnNoteRow): ChurnNote {
  return {
    id: r.id,
    agentKey: r.agent_key,
    agentName: r.agent_name,
    companyName: r.company_name,
    body: r.body,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  };
}

/**
 * Every note, newest first. The report loads all of them in one go and groups
 * them client-side: the agent tables need a per-agent count on every row, so
 * per-agent fetching would be one request per visible row.
 */
export async function listChurnNotes(): Promise<ChurnNote[]> {
  const db = getAdminDb();
  const rows = (await db
    .selectFrom("admin_churn_notes")
    .selectAll()
    .orderBy("created_at", "desc")
    .execute()) as ChurnNoteRow[];
  return rows.map(rowToNote);
}

/** Notes for one agent, newest first. */
export async function listChurnNotesForAgent(agentKey: string): Promise<ChurnNote[]> {
  const db = getAdminDb();
  const rows = (await db
    .selectFrom("admin_churn_notes")
    .selectAll()
    .where("agent_key", "=", agentKey)
    .orderBy("created_at", "desc")
    .execute()) as ChurnNoteRow[];
  return rows.map(rowToNote);
}

export async function addChurnNote(input: {
  agentKey: string;
  agentName: string;
  companyName?: string | null;
  body: string;
  byUserId?: string | null;
  byUserName?: string | null;
  now?: number;
}): Promise<ChurnNote> {
  const db = getAdminDb();
  const row: ChurnNoteRow = {
    id: randomUUID(),
    agent_key: input.agentKey,
    agent_name: input.agentName,
    company_name: input.companyName ?? null,
    body: input.body.trim().slice(0, MAX_BODY_LEN),
    created_by: input.byUserId ?? null,
    created_by_name: input.byUserName ?? null,
    created_at: input.now ?? Date.now(),
  };
  await db.insertInto("admin_churn_notes").values(row).execute();
  return rowToNote(row);
}

/** Returns false when the note id does not exist. */
export async function deleteChurnNote(id: string): Promise<boolean> {
  const db = getAdminDb();
  const result = await db.deleteFrom("admin_churn_notes").where("id", "=", id).executeTakeFirst();
  return Number(result.numDeletedRows ?? 0) > 0;
}
