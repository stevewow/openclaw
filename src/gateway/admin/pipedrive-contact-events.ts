// When a client was last genuinely *contacted*, as opposed to last touched by
// anything at all.
//
// A Pipedrive person carries `last_activity_date`, which is what the reports
// used to read. It is a poor answer to "has anyone actually spoken to them?"
// for two reasons, and this module exists to fix both:
//
//   1. It counts automated marketing. A newsletter the client never opened, or
//      a website visit we tracked, bumps the date exactly as a phone call does.
//   2. It ignores email entirely unless somebody logged an activity by hand.
//      Most real contact here happens over synced mail, and much of that mail
//      comes from the shared support@ and schedule@ inboxes — order traffic,
//      not a salesperson reaching out.
//
// So: sweep activities and keep only the types a human did, sweep mail threads
// and keep only those a real salesperson sent, and record the later of the two
// per party. Both feed `pipedrive-contacts-store`, which is what the reports
// actually read.

import {
  isConfigured,
  listActivities,
  listMailThreads,
  type MailFolder,
} from "../../../extensions/pipedrive/api.js";
import { getAdminDb } from "./user-store.js";

const ACTIVITY_PAGE_SIZE = 500;
const MAIL_PAGE_SIZE = 100;
/** 19k activities at 500/page is ~39 requests; this caps a runaway. */
const ACTIVITY_MAX_PAGES = 200;
/** Enough for the first backfill; an incremental sweep stops far sooner. */
const MAIL_MAX_PAGES = 400;
const INSERT_CHUNK = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far back the very first mail sweep reaches. Everything older simply never
 * counted as contact before this existed, and the running per-party maximum
 * means later sweeps keep extending the record forward anyway.
 */
export const MAIL_BACKFILL_DAYS = 120;

/**
 * How far behind the last sweep's watermark to restart.
 *
 * Pipedrive returns threads roughly newest-first but not strictly: inversions
 * of just over six days were measured on this account, so stopping at the first
 * thread older than the watermark would drop real messages. Overlapping by a
 * fortnight costs a handful of extra pages and makes the sweep insensitive to
 * that disorder. Re-reading a thread is harmless — the store keeps a maximum.
 */
export const MAIL_WATERMARK_OVERLAP_DAYS = 14;

const MAIL_FOLDERS: MailFolder[] = ["inbox", "sent", "archive"];

// ── Classification ─────────────────────────────────────────────────────────

/**
 * Our own addresses. A thread is only evidence of outreach if somebody on our
 * side sent it, so we have to be able to tell our parties from the client's.
 */
export const INTERNAL_EMAIL_DOMAINS = ["wowvideotours.com", "wvt.team", "pipedrivemail.com"];

/**
 * Shared inboxes whose mail is order traffic rather than sales contact. Mail
 * sent from these does not count as anyone having reached out to the client.
 */
export const EXCLUDED_INTERNAL_SENDERS = [
  "support@wowvideotours.com",
  "schedule@wowvideotours.com",
];

/**
 * Activity types that happen without a person doing anything: a bulk newsletter
 * and the opens, clicks and bounces it generates, plus tracked site visits.
 *
 * `newsletter_reply` is deliberately absent — a client replying is a human
 * act and among the strongest contact signals there is.
 */
export const AUTOMATED_ACTIVITY_TYPES = [
  "newsletter",
  "newsletter_open",
  "newsletter_clicked",
  "newsletter_bounce",
  "newsletter_unsubscribe",
  "visited_website",
];

const AUTOMATED = new Set(AUTOMATED_ACTIVITY_TYPES);
const EXCLUDED_SENDERS = new Set(EXCLUDED_INTERNAL_SENDERS);

export function isAutomatedActivityType(type: unknown): boolean {
  return typeof type === "string" && AUTOMATED.has(type.trim().toLowerCase());
}

export function isInternalAddress(email: unknown): boolean {
  if (typeof email !== "string") {
    return false;
  }
  const at = email.lastIndexOf("@");
  if (at < 0) {
    return false;
  }
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return INTERNAL_EMAIL_DOMAINS.includes(domain);
}

export function isExcludedSender(email: unknown): boolean {
  return typeof email === "string" && EXCLUDED_SENDERS.has(email.trim().toLowerCase());
}

type MailParty = {
  email_address?: unknown;
  linked_person_id?: unknown;
  linked_organization_id?: unknown;
};

function parties(raw: unknown, key: string): MailParty[] {
  const bag = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[key] : null;
  return Array.isArray(bag) ? (bag as MailParty[]) : [];
}

function partyId(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export type PartyRef = { type: "person" | "organization"; id: number };

export type MailThreadVerdict = {
  /** True when a real salesperson on our side sent into this thread. */
  countsAsContact: boolean;
  /** When the thread last moved, or null when Pipedrive reported no time. */
  at: number | null;
  /** The client-side parties the thread is about. */
  clients: PartyRef[];
};

/**
 * Decide whether one mail thread is evidence that a salesperson contacted a
 * client, and if so, who.
 *
 * The test is on the SENDERS: at least one of our own addresses that is not a
 * shared order inbox must have sent into the thread. A thread only support@
 * ever sent is order traffic however many people it reached. A thread the
 * client started and nobody answered is likewise not us reaching out.
 *
 * Note this counts a thread a BDS sent even if the client never replied —
 * "when did we last reach out" is the question the reports ask.
 */
export function classifyMailThread(thread: unknown): MailThreadVerdict {
  const raw = thread && typeof thread === "object" ? (thread as Record<string, unknown>) : {};
  const from = parties(raw.parties, "from");
  const countsAsContact = from.some(
    (p) => isInternalAddress(p.email_address) && !isExcludedSender(p.email_address),
  );

  const clients: PartyRef[] = [];
  const seen = new Set<string>();
  for (const key of ["from", "to", "cc"]) {
    for (const p of parties(raw.parties, key)) {
      // Our own staff are Pipedrive persons too; the client is the party that
      // is not one of us.
      if (isInternalAddress(p.email_address)) {
        continue;
      }
      const person = partyId(p.linked_person_id);
      const org = partyId(p.linked_organization_id);
      for (const ref of [
        person === null ? null : ({ type: "person", id: person } as const),
        org === null ? null : ({ type: "organization", id: org } as const),
      ]) {
        if (!ref) {
          continue;
        }
        const dedupe = `${ref.type}:${ref.id}`;
        if (!seen.has(dedupe)) {
          seen.add(dedupe);
          clients.push(ref);
        }
      }
    }
  }

  const stamp = raw.last_message_timestamp;
  const at = typeof stamp === "string" ? Date.parse(stamp) : Number.NaN;
  return { countsAsContact, at: Number.isFinite(at) ? at : null, clients };
}

/** Pipedrive activity dates are `YYYY-MM-DD`; anchor them at local midday. */
function parseActivityDay(raw: unknown): number | null {
  if (typeof raw !== "string") {
    return null;
  }
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return null;
  }
  const ms = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * When a human-run activity happened, or null if this one does not count.
 * Prefers the time it was marked done over the time it was scheduled for: a
 * task dated next month is not contact that has already happened.
 */
export function activityContactAt(activity: unknown, now: number = Date.now()): number | null {
  const raw = activity && typeof activity === "object" ? (activity as Record<string, unknown>) : {};
  if (isAutomatedActivityType(raw.type)) {
    return null;
  }
  const doneAt =
    typeof raw.marked_as_done_time === "string"
      ? Date.parse(`${raw.marked_as_done_time.replace(" ", "T")}Z`)
      : Number.NaN;
  if (Number.isFinite(doneAt)) {
    return doneAt;
  }
  const due = parseActivityDay(raw.due_date);
  // An activity still in the future has not happened yet.
  return due !== null && due <= now ? due : null;
}

// ── Sweep ──────────────────────────────────────────────────────────────────

type ContactRow = { party_type: string; party_id: number; last_contact_at: number };

/** Keep the latest timestamp per party. */
function record(into: Map<string, ContactRow>, ref: PartyRef, at: number): void {
  const key = `${ref.type}:${ref.id}`;
  const seen = into.get(key);
  if (!seen || at > seen.last_contact_at) {
    into.set(key, { party_type: ref.type, party_id: ref.id, last_contact_at: at });
  }
}

async function sweepActivities(now: number): Promise<Map<string, ContactRow>> {
  const out = new Map<string, ContactRow>();
  let start = 0;
  for (let page = 0; page < ACTIVITY_MAX_PAGES; page++) {
    const res = await listActivities({ start, limit: ACTIVITY_PAGE_SIZE });
    for (const row of res.data) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const activity = row as Record<string, unknown>;
      const at = activityContactAt(activity, now);
      if (at === null) {
        continue;
      }
      const person = partyId(activity.person_id);
      if (person !== null) {
        record(out, { type: "person", id: person }, at);
      }
      const org = partyId(activity.org_id);
      if (org !== null) {
        record(out, { type: "organization", id: org }, at);
      }
    }
    if (!res.moreItems) {
      break;
    }
    start = res.nextStart ?? start + ACTIVITY_PAGE_SIZE;
  }
  return out;
}

async function sweepMail(
  sinceMs: number,
): Promise<{ rows: Map<string, ContactRow>; newest: number }> {
  const out = new Map<string, ContactRow>();
  let newest = 0;
  // Folders overlap — a thread can sit in both sent and archive — so dedupe.
  const seenThreads = new Set<unknown>();
  for (const folder of MAIL_FOLDERS) {
    let start = 0;
    for (let page = 0; page < MAIL_MAX_PAGES; page++) {
      const res = await listMailThreads({ folder, start, limit: MAIL_PAGE_SIZE });
      let pageNewest = 0;
      for (const row of res.data) {
        if (!row || typeof row !== "object") {
          continue;
        }
        const id = (row as { id?: unknown }).id;
        const verdict = classifyMailThread(row);
        if (verdict.at !== null) {
          pageNewest = Math.max(pageNewest, verdict.at);
          newest = Math.max(newest, verdict.at);
        }
        if (id !== undefined && seenThreads.has(id)) {
          continue;
        }
        if (id !== undefined) {
          seenThreads.add(id);
        }
        if (!verdict.countsAsContact || verdict.at === null) {
          continue;
        }
        for (const client of verdict.clients) {
          record(out, client, verdict.at);
        }
      }
      // Stop once a whole page sits entirely behind the watermark. Threads are
      // only roughly ordered, hence a page at a time rather than a thread.
      if (!res.moreItems || (pageNewest > 0 && pageNewest < sinceMs)) {
        break;
      }
      start = res.nextStart ?? start + MAIL_PAGE_SIZE;
    }
  }
  return { rows: out, newest };
}

/**
 * Shares `admin_pipedrive_refresh_log` with the directory sweep under its own
 * id. What is stored is the newest thread timestamp seen, not the clock time of
 * the run — that is what the next sweep has to resume from.
 */
const WATERMARK_KEY = "pipedrive_mail";

async function readWatermark(): Promise<number | null> {
  const row = await getAdminDb()
    .selectFrom("admin_pipedrive_refresh_log")
    .select(["refreshed_at"])
    .where("id", "=", WATERMARK_KEY)
    .executeTakeFirst();
  return row?.refreshed_at ?? null;
}

export type ContactEventsResult = {
  activityParties: number;
  mailParties: number;
  parties: number;
};

/**
 * Refresh the record of when each party was last genuinely contacted.
 *
 * Activities are swept whole (only ~19k on this account); mail is swept from a
 * watermark, so the first run reaches back {@link MAIL_BACKFILL_DAYS} and later
 * ones only cover what has arrived since, plus an overlap for out-of-order
 * threads. Written in one transaction so a mid-sweep failure cannot leave the
 * reports reading a half-built index.
 */
export async function refreshPipedriveContactEvents(
  opts: { now?: number } = {},
): Promise<ContactEventsResult> {
  if (!isConfigured()) {
    throw new Error(
      "Pipedrive is not configured. Run /pipedrive-setup in chat and enter the API token.",
    );
  }
  const now = opts.now ?? Date.now();
  const watermark = await readWatermark();
  const since =
    watermark === null
      ? now - MAIL_BACKFILL_DAYS * DAY_MS
      : watermark - MAIL_WATERMARK_OVERLAP_DAYS * DAY_MS;

  const fromActivities = await sweepActivities(now);
  const { rows: fromMail, newest } = await sweepMail(since);

  const merged = new Map<string, ContactRow>();
  for (const source of [fromActivities, fromMail]) {
    for (const [key, row] of source) {
      const seen = merged.get(key);
      if (!seen || row.last_contact_at > seen.last_contact_at) {
        merged.set(key, row);
      }
    }
  }

  const db = getAdminDb();
  await db.transaction().execute(async (tx) => {
    // Mail is incremental, so a party contacted before this window still has a
    // valid row from an earlier sweep: merge upward rather than replacing.
    const list = [...merged.values()];
    for (let i = 0; i < list.length; i += INSERT_CHUNK) {
      await tx
        .insertInto("admin_pipedrive_contact_events")
        .values(
          list.slice(i, i + INSERT_CHUNK).map((r) => ({
            party_type: r.party_type,
            party_id: r.party_id,
            last_contact_at: r.last_contact_at,
            cached_at: now,
          })),
        )
        .onConflict((oc) =>
          oc.columns(["party_type", "party_id"]).doUpdateSet((eb) => ({
            last_contact_at: eb.fn("max", [
              eb.ref("admin_pipedrive_contact_events.last_contact_at"),
              eb.ref("excluded.last_contact_at"),
            ]),
            cached_at: now,
          })),
        )
        .execute();
    }
    // Advance only to what was actually seen, so a failed sweep cannot skip a
    // window; never past `now`.
    const advanced = newest > 0 ? Math.min(newest, now) : (watermark ?? since);
    await tx
      .insertInto("admin_pipedrive_refresh_log")
      .values({ id: WATERMARK_KEY, refreshed_at: advanced, manual: 0 })
      .onConflict((oc) => oc.column("id").doUpdateSet({ refreshed_at: advanced }))
      .execute();
  });

  return {
    activityParties: fromActivities.size,
    mailParties: fromMail.size,
    parties: merged.size,
  };
}

/** Every party's last genuine contact, keyed `"person:123"` / `"organization:45"`. */
export async function loadContactEvents(): Promise<Map<string, number>> {
  const rows = await getAdminDb()
    .selectFrom("admin_pipedrive_contact_events")
    .selectAll()
    .execute();
  const out = new Map<string, number>();
  for (const r of rows) {
    out.set(`${r.party_type}:${r.party_id}`, r.last_contact_at);
  }
  return out;
}
