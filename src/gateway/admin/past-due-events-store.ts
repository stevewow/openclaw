/**
 * What happened to a collections case, in the order it happened.
 *
 * Contacts and notes already have their own tables — those are things a person
 * wrote, and they are worth writing on their own terms. This records the state
 * changes nobody would otherwise be able to reconstruct: who moved the stage,
 * who the account was handed to, what the client promised and when, who
 * escalated it and why. Together the three make one timeline, assembled on read
 * rather than duplicated on write.
 *
 * Events are append-only. A case is a record of work done on someone's debt, so
 * its history is not something a later edit gets to rewrite.
 */

import { randomUUID } from "node:crypto";
import { getAdminDb } from "./user-store.js";

export type PastDueEventKind =
  | "stage"
  | "assignment"
  | "next_action"
  | "due"
  | "promise"
  | "review"
  | "followup"
  | "escalation";

export type PastDueEvent = {
  id: string;
  accountKey: string;
  kind: PastDueEventKind;
  /** One line, already written for a human — the UI does not re-phrase it. */
  summary: string;
  detail: string | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: number;
};

type Row = {
  id: string;
  account_key: string;
  kind: string;
  summary: string;
  detail: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: number;
};

const KINDS = new Set<string>([
  "stage",
  "assignment",
  "next_action",
  "due",
  "promise",
  "review",
  "followup",
  "escalation",
]);

const MAX_SUMMARY = 300;
const MAX_DETAIL = 2000;

function rowToEvent(r: Row): PastDueEvent {
  return {
    id: r.id,
    accountKey: r.account_key,
    kind: (KINDS.has(r.kind) ? r.kind : "stage") as PastDueEventKind,
    summary: r.summary,
    detail: r.detail,
    actorId: r.actor_id,
    actorName: r.actor_name,
    createdAt: r.created_at,
  };
}

/**
 * Append one event. Never throws: an audit line is worth having, but losing one
 * must not fail the stage change that produced it — the change is the thing the
 * collector actually asked for.
 */
export async function recordPastDueEvent(params: {
  accountKey: string;
  kind: PastDueEventKind;
  summary: string;
  detail?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  now?: number;
}): Promise<PastDueEvent | null> {
  const row: Row = {
    id: randomUUID(),
    account_key: params.accountKey,
    kind: params.kind,
    summary: params.summary.slice(0, MAX_SUMMARY),
    detail: params.detail?.trim() ? params.detail.trim().slice(0, MAX_DETAIL) : null,
    actor_id: params.actorId ?? null,
    actor_name: params.actorName ?? null,
    created_at: params.now ?? Date.now(),
  };
  try {
    await getAdminDb().insertInto("admin_past_due_events").values(row).execute();
  } catch (err) {
    console.error(
      `[past-due] could not record ${params.kind} on ${params.accountKey}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }
  return rowToEvent(row);
}

/** Every event on one account, most recent first. */
export async function listPastDueEvents(accountKey: string): Promise<PastDueEvent[]> {
  const rows = (await getAdminDb()
    .selectFrom("admin_past_due_events")
    .selectAll()
    .where("account_key", "=", accountKey)
    .orderBy("created_at", "desc")
    .execute()) as Row[];
  return rows.map(rowToEvent);
}

/**
 * The latest event of one kind per account, for the report table. One query for
 * the whole board rather than one per row.
 */
export async function latestEventByAccount(
  kind: PastDueEventKind,
): Promise<Map<string, PastDueEvent>> {
  const rows = (await getAdminDb()
    .selectFrom("admin_past_due_events")
    .selectAll()
    .where("kind", "=", kind)
    .orderBy("created_at", "desc")
    .execute()) as Row[];
  const out = new Map<string, PastDueEvent>();
  for (const row of rows) {
    // Rows arrive newest-first, so the first hit per account is the latest.
    if (!out.has(row.account_key)) {
      out.set(row.account_key, rowToEvent(row));
    }
  }
  return out;
}

// ── Timeline ───────────────────────────────────────────────────────────────

/**
 * One entry in the merged history of an account. `kind` says which table it
 * came from so the UI can style a logged call differently from a stage move,
 * and every entry carries the same shape so the merge is a plain sort.
 */
export type TimelineEntry = {
  id: string;
  /** `event` kinds keep their own key; the other two name their table. */
  kind: PastDueEventKind | "contact" | "note";
  at: number;
  summary: string;
  detail: string | null;
  actorName: string | null;
};

/**
 * Merge events, logged contacts and notes into one descending timeline.
 *
 * Pure so the ordering is testable without a database: the three lists are read
 * by the caller. Ties break on kind then id, which keeps the order stable when
 * a contact and the event it triggered land in the same millisecond.
 */
export function buildTimeline(params: {
  events: readonly PastDueEvent[];
  contacts: ReadonlyArray<{
    id: string;
    contactedAt: number;
    channel: string;
    note: string | null;
    createdByName: string | null;
  }>;
  notes: ReadonlyArray<{
    id: string;
    body: string;
    createdByName: string | null;
    createdAt: number;
  }>;
  channelLabel?: (channel: string) => string;
}): TimelineEntry[] {
  const label = params.channelLabel ?? ((c: string) => c);
  const entries: TimelineEntry[] = [
    ...params.events.map((e) => ({
      id: e.id,
      kind: e.kind,
      at: e.createdAt,
      summary: e.summary,
      detail: e.detail,
      actorName: e.actorName,
    })),
    ...params.contacts.map((c) => ({
      id: c.id,
      kind: "contact" as const,
      at: c.contactedAt,
      summary: `${label(c.channel)} logged`,
      detail: c.note,
      actorName: c.createdByName,
    })),
    ...params.notes.map((n) => ({
      id: n.id,
      kind: "note" as const,
      at: n.createdAt,
      summary: "Note added",
      detail: n.body,
      actorName: n.createdByName,
    })),
  ];
  return entries.toSorted(
    (a, b) => b.at - a.at || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
  );
}
