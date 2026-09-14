// Putting a lead into the CRM.
//
// A lead is worked in Pipedrive, not here: the Hub is the intake queue, and the
// moment a lead has an owner it needs to exist where that owner already spends
// their day. So every lead — typed in by a VA or sent by the website — is
// pushed straight through to three records: the brokerage, the person, and one
// activity on the owner's list telling them to make the first call.
//
// Two rules shape the whole module.
//
// First, find before create. Sales reps have spent years creating a second
// organization per branch office (see the Pipedrive Cleanup report), and a lead
// queue that creates one more on every download would out-produce the cleanup.
// A brokerage is matched on its folded name and only created when nothing
// matches; a person is matched on their email address, then their phone number,
// because those are the two things a lead actually carries.
//
// Second, never update. A found person keeps whatever a rep typed — the lead's
// details ride along in the activity note instead. The only thing this module
// adds to an existing record is the activity, which is the point of the push.
//
// Nothing here throws. A lead is already saved and already emailed by the time
// the sync runs; a CRM outage must show on the lead as a failed sync that can be
// retried, not swallow the lead.

import {
  createActivity,
  createOrganization,
  createPerson,
  findPersons,
  isConfigured,
  listUsers,
  type ListUsersResult,
  type SearchHit,
  type SearchPersonHit,
  searchOrganizations,
} from "../../../extensions/pipedrive/api.js";
import { localDay, readLeadEmailSettings } from "./lead-notify.js";
import { getPlaybook } from "./lead-playbooks-store.js";
import type { LeadPlaybook } from "./lead-playbooks.js";
import { type Lead, recordLeadCrmSync } from "./lead-store.js";
import { escapeHtml } from "./ticket-email-render.js";

/** What the push did, in the order it did it. Recorded on the lead's trail. */
export type LeadCrmResult = {
  personId: number;
  organizationId: number | null;
  activityId: number;
  ownerUserId: number | null;
  personCreated: boolean;
  organizationCreated: boolean;
  /** The owner's name as Pipedrive knows it, for the trail line. */
  ownerName: string | null;
};

export type LeadCrmOutcome =
  | { ok: true; result: LeadCrmResult }
  | { ok: false; error: string; skipped?: "not_configured" | "already_synced" };

/**
 * The slice of the Pipedrive plugin this module uses, named so a test can pass
 * its own. The plugin barrel is the default and the only production value.
 */
export type LeadCrmClient = {
  isConfigured(): boolean;
  listUsers(): Promise<ListUsersResult>;
  searchOrganizations(params: { term: string; limit?: number }): Promise<SearchHit[]>;
  findPersons(params: {
    term: string;
    fields?: string;
    limit?: number;
  }): Promise<SearchPersonHit[]>;
  createOrganization(params: { name: string; owner_id?: number }): Promise<number>;
  createPerson(params: {
    name: string;
    email?: string | null;
    phone?: string | null;
    org_id?: number;
    owner_id?: number;
  }): Promise<number>;
  createActivity(params: {
    subject: string;
    type: string;
    due_date?: string;
    person_id?: number;
    org_id?: number;
    user_id?: number;
    note?: string;
  }): Promise<number>;
};

const defaultClient: LeadCrmClient = {
  isConfigured,
  listUsers,
  searchOrganizations,
  findPersons,
  createOrganization,
  createPerson,
  createActivity,
};

export type LeadCrmDeps = {
  client?: LeadCrmClient;
  env?: NodeJS.ProcessEnv;
  now?: number;
  /** Resolved for the caller in tests; read from the playbook table otherwise. */
  playbook?: LeadPlaybook | null;
  logger?: { info: (m: string) => void; error: (m: string) => void };
};

/**
 * Fold a name to something two spellings of one brokerage can meet in.
 *
 * Deliberately harsher than the contacts directory's fold: "RE/MAX Victory +
 * Affiliates" and "ReMax Victory and Affiliates" are one brokerage, and a lead
 * that creates the second spelling has made work for the cleanup report rather
 * than a record anyone wanted.
 */
export function foldOrgName(raw: string): string {
  return (
    raw
      .toLowerCase()
      // Joining words first, because "+" and "and" are the same word: without
      // this, "RE/MAX Victory + Affiliates" and "ReMax Victory and Affiliates"
      // fold apart and the lead makes the duplicate it was trying to avoid.
      .replace(/[&+]/g, " ")
      .replace(/\b(and|the|of)\b/g, " ")
      // Then the words every brokerage shares, which distinguish nothing.
      .replace(/\b(llc|inc|co|corp|ltd|group|realty|realtors|real estate)\b/g, " ")
      .replace(/[^a-z0-9]+/g, "")
      .trim()
  );
}

/** Digits only, so "(614) 555-0134" and "6145550134" are the same number. */
export function foldPhone(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  // A US number typed with its country code is the same person as one without.
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

const DEFAULT_CRM_APP_URL = "https://wowvideotours.pipedrive.com";

/**
 * Where a Pipedrive record is readable by a human.
 *
 * The API is addressed at api.pipedrive.com for everyone; the app is addressed
 * per company. Only the Hub's own links need this, so it is here rather than in
 * the plugin, and it is overridable for an install that is not ours.
 */
export function crmBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.PIPEDRIVE_APP_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : DEFAULT_CRM_APP_URL;
}

const USER_CACHE_MS = 10 * 60 * 1000;
let userCache: { at: number; users: ListUsersResult } | null = null;

/** Reset between tests; the directory is otherwise cached for ten minutes. */
export function resetLeadCrmUserCache(): void {
  userCache = null;
}

async function activeUsers(client: LeadCrmClient, now: number): Promise<ListUsersResult> {
  if (userCache && now - userCache.at < USER_CACHE_MS) {
    return userCache.users;
  }
  const users = await client.listUsers();
  userCache = { at: now, users };
  return users;
}

/**
 * The territory owner's Pipedrive account, found by the address the routing
 * table dispatches to. Inactive accounts are skipped: a deactivated user can
 * own a record but will never see the activity, so an unassigned activity in
 * the account owner's list is the more visible failure.
 */
export async function resolveOwnerUser(
  client: LeadCrmClient,
  email: string | null,
  now: number,
): Promise<{ id: number; name: string } | null> {
  const wanted = email?.trim().toLowerCase();
  if (!wanted) {
    return null;
  }
  const match = (await activeUsers(client, now)).find(
    (user) => user.activeFlag && user.email.trim().toLowerCase() === wanted,
  );
  return match ? { id: match.id, name: match.name } : null;
}

/** How many words to drop off the end of a brokerage name before giving up. */
const ORG_SEARCH_RETRIES = 2;

/**
 * Everything Pipedrive knows that might be this brokerage.
 *
 * Pipedrive's search requires EVERY word in the term to appear, so a name with
 * a team on the end of it finds nothing at all rather than finding the
 * brokerage: searching "Farms and Estates Realty" against an account that holds
 * "Farms and Estates" returns an empty list. So a search that finds nothing is
 * tried again with the last word dropped, twice, which is the difference
 * between matching that brokerage and filing a second one beside it. Only an
 * empty result is retried — a search that found the wrong things has answered.
 */
async function searchOrgCandidates(client: LeadCrmClient, name: string): Promise<SearchHit[]> {
  let words = name.split(/\s+/).filter(Boolean);
  for (let attempt = 0; attempt <= ORG_SEARCH_RETRIES; attempt++) {
    const hits = await client.searchOrganizations({ term: words.join(" "), limit: 20 });
    if (hits.length > 0 || words.length <= 2) {
      return hits;
    }
    words = words.slice(0, -1);
  }
  return [];
}

/** The brokerage, found by name or created. Null when the lead named none. */
async function resolveOrganization(
  client: LeadCrmClient,
  company: string | null,
  ownerId: number | undefined,
): Promise<{ id: number; created: boolean } | null> {
  const name = company?.trim();
  if (!name) {
    return null;
  }
  const folded = foldOrgName(name);
  if (folded) {
    const hits = await searchOrgCandidates(client, name);
    // Pipedrive ranks by its own relevance; we only accept a name that folds to
    // the same thing, because a near miss here is exactly how the duplicate
    // organizations in the cleanup report were made. That gate is what makes the
    // widening search above safe: a broader net still lands nothing unless the
    // name itself agrees.
    const exact = hits.find((hit) => foldOrgName(hit.name) === folded);
    if (exact) {
      return { id: exact.id, created: false };
    }
  }
  return { id: await client.createOrganization({ name, owner_id: ownerId }), created: true };
}

/** The person, found by email then phone, or created against the brokerage. */
async function resolvePerson(
  client: LeadCrmClient,
  lead: Lead,
  orgId: number | undefined,
  ownerId: number | undefined,
): Promise<{ id: number; created: boolean }> {
  const email = lead.email?.trim();
  if (email) {
    const hits = await client.findPersons({ term: email, fields: "email", limit: 10 });
    const exact = hits.find(
      (hit) => hit.primaryEmail?.trim().toLowerCase() === email.toLowerCase(),
    );
    const match = exact ?? hits[0];
    if (match) {
      return { id: match.id, created: false };
    }
  }
  const phone = lead.phone?.trim();
  if (phone) {
    const folded = foldPhone(phone);
    if (folded.length >= 10) {
      const hits = await client.findPersons({ term: folded, fields: "phone", limit: 10 });
      const match = hits[0];
      if (match) {
        return { id: match.id, created: false };
      }
    }
  }
  const name = lead.name?.trim() || email || phone;
  if (!name) {
    throw new Error("the lead has no name, email or phone to file under");
  }
  return {
    id: await client.createPerson({
      name,
      email: lead.email,
      phone: lead.phone,
      org_id: orgId,
      owner_id: ownerId,
    }),
    created: true,
  };
}

/** Pipedrive's activity type for the channel the playbook opens on. */
export function activityTypeFor(playbook: LeadPlaybook | null): string {
  const channel = playbook?.steps?.[0]?.channel;
  return channel === "email" ? "email" : "call";
}

/** What the owner sees in their activity list. */
export function activitySubject(lead: Lead, playbook: LeadPlaybook | null): string {
  const who = lead.name?.trim() || lead.company?.trim() || lead.email?.trim() || "New lead";
  const what = playbook?.label ?? (lead.source === "manual" ? "New lead" : "Website lead");
  return `${lead.number} ${who} — ${what}`;
}

/** A value that is a link becomes one; everything else is escaped text. */
function noteValue(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return `<a href="${escapeHtml(trimmed)}">${escapeHtml(trimmed)}</a>`;
  }
  return escapeHtml(trimmed);
}

/** A block of `Label: value` lines, or nothing when it would be empty. */
function noteFacts(rows: Array<[string, string]>): string {
  if (rows.length === 0) {
    return "";
  }
  return `<p>${rows
    .map(([label, value]) => `<b>${escapeHtml(label)}:</b> ${noteValue(value)}`)
    .join("<br />")}</p>`;
}

/**
 * The note the activity carries: why they are calling, what to say, and what
 * comes after. The whole cadence goes in here rather than becoming four dated
 * activities — the owner schedules the next touch when they have made the first,
 * and a list of tasks nobody completed is worse than one they will.
 *
 * Written as HTML, because that is what Pipedrive stores an activity note as:
 * newlines are dropped on the way in, which turns a structured note into one
 * unreadable paragraph. Paragraphs, bold, lists and links all survive, so the
 * note is laid out the way the person reading it between showings needs it —
 * who they are and how to reach them first, the script second, the cadence
 * last. Every value is escaped: a brokerage name with an ampersand in it is
 * common, and a lead is untrusted input besides.
 *
 * No link back to the Hub. The owner works the lead from this activity and from
 * the CRM record it hangs on; a link into a dashboard they were not going to
 * open is one more thing between reading the lead and calling it — the same
 * reason the dispatch email dropped its own.
 */
export function activityNote(lead: Lead, playbook: LeadPlaybook | null): string {
  const out: string[] = [];
  const market = lead.marketRaw?.trim();
  const origin = lead.source === "manual" ? "Lead added in the WOW Hub" : "Website lead";
  out.push(`<p><b>${escapeHtml(origin)}${market ? ` — ${escapeHtml(market)}` : ""}</b></p>`);

  const facts: Array<[string, string]> = [];
  if (lead.company?.trim()) {
    facts.push(["Brokerage", lead.company.trim()]);
  }
  if (lead.email?.trim()) {
    facts.push(["Email", lead.email.trim()]);
  }
  if (lead.phone?.trim()) {
    facts.push(["Phone", lead.phone.trim()]);
  }
  // Whatever else was asked — the listing and where it was found, on a lead
  // taken by hand; the form's own questions on one from the website.
  for (const field of lead.fields) {
    if (field.value.trim()) {
      facts.push([field.label, field.value]);
    }
  }
  out.push(noteFacts(facts));

  if (lead.message?.trim()) {
    out.push(
      `<p><b>What they wrote</b><br />${escapeHtml(lead.message.trim()).replace(/\n/g, "<br />")}</p>`,
    );
  }

  if (playbook) {
    out.push(`<p><b>${escapeHtml(playbook.label)}</b> — ${escapeHtml(playbook.signal)}</p>`);
    const firstName = lead.name?.trim().split(/\s+/)[0];
    out.push(
      `<p><b>Opener</b><br />${escapeHtml(playbook.opener.replace(/\[Name\]/g, firstName || "there"))}</p>`,
    );
    out.push(`<p><b>Once they engage</b><br />${escapeHtml(playbook.softClose)}</p>`);
    if (playbook.steps.length > 0) {
      out.push(
        `<p><b>Cadence</b></p><ol>${playbook.steps
          .map((step) => `<li><b>${escapeHtml(step.when)}</b> — ${escapeHtml(step.action)}</li>`)
          .join("")}</ol>`,
      );
    }
  }
  return out.filter(Boolean).join("");
}

/**
 * Push one lead into Pipedrive and record what happened on it.
 *
 * Idempotent by default: a lead that already carries a person id is left alone,
 * so a retry of a webhook or a second press of the button cannot make a second
 * activity. `force` is for the retry button on a lead whose sync failed.
 */
export async function syncLeadToCrm(
  lead: Lead,
  deps: LeadCrmDeps & { force?: boolean } = {},
): Promise<LeadCrmOutcome> {
  const client = deps.client ?? defaultClient;
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now();
  const log = deps.logger ?? {
    info: (m: string) => console.log(`[leads] ${m}`),
    error: (m: string) => console.error(`[leads] ${m}`),
  };

  if (lead.crmPersonId && !deps.force) {
    return { ok: false, error: "already in Pipedrive", skipped: "already_synced" };
  }
  if (!client.isConfigured()) {
    // Not an error on the lead: an install with no CRM token is a configuration
    // state, not a failed push, and marking every lead red would say otherwise.
    return { ok: false, error: "Pipedrive is not connected", skipped: "not_configured" };
  }

  try {
    const playbook =
      deps.playbook !== undefined
        ? deps.playbook
        : lead.playbookKey
          ? await getPlaybook(lead.playbookKey)
          : null;
    const owner = await resolveOwnerUser(client, lead.ownerEmail, now);
    const ownerId = owner?.id;
    const org = await resolveOrganization(client, lead.company, ownerId);
    const person = await resolvePerson(client, lead, org?.id, ownerId);
    const activityId = await client.createActivity({
      subject: activitySubject(lead, playbook),
      type: activityTypeFor(playbook),
      // Today, wherever the business is. Every playbook opens the same day; the
      // hour inside it is the cadence's business and is written in the note.
      due_date: localDay(now, readLeadEmailSettings(env).digestTimeZone),
      person_id: person.id,
      org_id: org?.id,
      user_id: ownerId,
      note: activityNote(lead, playbook),
    });
    const result: LeadCrmResult = {
      personId: person.id,
      organizationId: org?.id ?? null,
      activityId,
      ownerUserId: ownerId ?? null,
      personCreated: person.created,
      organizationCreated: org?.created ?? false,
      ownerName: owner?.name ?? null,
    };
    await recordLeadCrmSync(lead.id, { ok: true, ...result, at: now });
    return { ok: true, result };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error(`Pipedrive sync failed for ${lead.number}: ${error}`);
    await recordLeadCrmSync(lead.id, { ok: false, error, at: now });
    return { ok: false, error };
  }
}

/**
 * Fire the sync without making the caller wait for it.
 *
 * Both intake paths use this: a website submission is holding a webhook
 * connection open that Framer will retry if it is slow, and a VA pressing "Add
 * lead" should get their lead back at once. The result is already recorded on
 * the lead, so nothing is lost by not awaiting it.
 */
export function syncLeadToCrmInBackground(lead: Lead, deps: LeadCrmDeps = {}): void {
  void syncLeadToCrm(lead, deps).catch((err: unknown) => {
    console.error(`[leads] Pipedrive sync threw for ${lead.number}: ${String(err)}`);
  });
}
