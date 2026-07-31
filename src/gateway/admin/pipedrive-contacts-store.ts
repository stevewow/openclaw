// When a client was last touched, according to Pipedrive.
//
// Two reports want this: Past Due Accounts ("has anyone actually called them?")
// and the sales Focus report ("which of my clients has gone quiet?"). Both ask
// the same question about the same people, so the directory is cached once here
// rather than looked up per row.
//
// The join is by NAME, because neither report carries a Pipedrive id: a Spiro
// agent matches a Pipedrive person, and a Spiro company matches a Pipedrive
// organization. Names are normalized before matching and the matched name is
// handed back with the result, so a wrong match is visible rather than silent.
//
// The whole directory is ~17k persons and ~2.6k organizations — about 40
// requests — so it is swept on a schedule and cached, never fetched per lookup.

import { isConfigured, listOrganizations, listPersons } from "../../../extensions/pipedrive/api.js";
import { getAdminDb } from "./user-store.js";

export type PipedriveMatch = {
  /** Milliseconds at local midnight of the last activity day, or null. */
  lastActivityAt: number | null;
  /** What we matched against, so a bad match can be spotted. */
  matchedName: string;
  matchedType: "person" | "organization";
  pipedriveId: number;
};

export type PipedriveContactStatus = {
  configured: boolean;
  refreshedAt: number | null;
  personCount: number;
  organizationCount: number;
};

const PAGE_SIZE = 500;
// 17.5k persons at 500/page is 36 requests; this caps a runaway at ~50k rows.
const MAX_PAGES = 100;
const INSERT_CHUNK = 200;
const REFRESH_LOG_KEY = "pipedrive_contacts";
/** Re-sweep at most this often on the schedule. */
const STALE_MS = 6 * 60 * 60 * 1000;

/**
 * Fold a name to something two systems can agree on: case, punctuation and
 * runs of whitespace all vary between Spiro and Pipedrive.
 */
export function normalizeContactName(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,'"`’]/g, "")
    .replace(/\b(llc|inc|ltd|co|corp|company|realtors?|realty|group|team|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Pipedrive dates are plain `YYYY-MM-DD`; anchor them at local midnight. */
function parseActivityDate(raw: unknown): number | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return null;
  }
  const ms = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function readEmail(row: Record<string, unknown>): string | null {
  const primary = row.primary_email;
  if (typeof primary === "string" && primary.trim()) {
    return primary.trim().toLowerCase();
  }
  const list = row.email;
  if (Array.isArray(list)) {
    for (const entry of list) {
      const value = (entry as { value?: unknown })?.value;
      if (typeof value === "string" && value.trim()) {
        return value.trim().toLowerCase();
      }
    }
  }
  return null;
}

type PersonRow = {
  person_id: number;
  name: string;
  name_key: string;
  email: string | null;
  org_name: string | null;
  last_activity_at: number | null;
};

type OrgRow = {
  org_id: number;
  name: string;
  name_key: string;
  last_activity_at: number | null;
};

// ── Refresh ────────────────────────────────────────────────────────────────

async function sweep(
  fetchPage: (
    start: number,
  ) => Promise<{ data: unknown[]; moreItems: boolean; nextStart: number | null }>,
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let start = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchPage(start);
    for (const row of res.data) {
      if (row && typeof row === "object") {
        out.push(row as Record<string, unknown>);
      }
    }
    if (!res.moreItems) {
      break;
    }
    // Pipedrive can report more items without handing back a cursor; stepping
    // by the page size ourselves keeps the sweep from stalling on page one.
    start = res.nextStart ?? start + PAGE_SIZE;
  }
  return out;
}

/**
 * Replace the cached directory. Written inside one transaction so a mid-sweep
 * failure cannot leave the reports with an empty index — the same trap the
 * invoice cache fell into.
 */
export async function refreshPipedriveContacts(
  opts: { manual: boolean } = { manual: false },
): Promise<{ persons: number; organizations: number }> {
  if (!isConfigured()) {
    throw new Error(
      "Pipedrive is not configured. Run /pipedrive-setup in chat and enter the API token.",
    );
  }

  const rawPersons = await sweep((start) => listPersons({ start, limit: PAGE_SIZE }));
  const rawOrgs = await sweep((start) => listOrganizations({ start, limit: PAGE_SIZE }));

  const persons = new Map<number, PersonRow>();
  for (const row of rawPersons) {
    const id = typeof row.id === "number" ? row.id : null;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (id === null || !name) {
      continue;
    }
    const org = row.org_id;
    const orgName =
      typeof row.org_name === "string"
        ? row.org_name
        : org && typeof org === "object" && typeof (org as { name?: unknown }).name === "string"
          ? (org as { name: string }).name
          : null;
    persons.set(id, {
      person_id: id,
      name,
      name_key: normalizeContactName(name),
      email: readEmail(row),
      org_name: orgName,
      last_activity_at: parseActivityDate(row.last_activity_date),
    });
  }

  const orgs = new Map<number, OrgRow>();
  for (const row of rawOrgs) {
    const id = typeof row.id === "number" ? row.id : null;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (id === null || !name) {
      continue;
    }
    orgs.set(id, {
      org_id: id,
      name,
      name_key: normalizeContactName(name),
      last_activity_at: parseActivityDate(row.last_activity_date),
    });
  }

  const db = getAdminDb();
  const now = Date.now();
  await db.transaction().execute(async (tx) => {
    await tx.deleteFrom("admin_pipedrive_persons").execute();
    await tx.deleteFrom("admin_pipedrive_orgs").execute();
    const personRows = [...persons.values()].map((p) => ({
      person_id: p.person_id,
      name: p.name,
      name_key: p.name_key,
      email: p.email,
      org_name: p.org_name,
      last_activity_at: p.last_activity_at,
      cached_at: now,
    }));
    for (let i = 0; i < personRows.length; i += INSERT_CHUNK) {
      await tx
        .insertInto("admin_pipedrive_persons")
        .values(personRows.slice(i, i + INSERT_CHUNK))
        .execute();
    }
    const orgRows = [...orgs.values()].map((o) => ({
      org_id: o.org_id,
      name: o.name,
      name_key: o.name_key,
      last_activity_at: o.last_activity_at,
      cached_at: now,
    }));
    for (let i = 0; i < orgRows.length; i += INSERT_CHUNK) {
      await tx
        .insertInto("admin_pipedrive_orgs")
        .values(orgRows.slice(i, i + INSERT_CHUNK))
        .execute();
    }
    await tx
      .insertInto("admin_pipedrive_refresh_log")
      .values({ id: REFRESH_LOG_KEY, refreshed_at: now, manual: opts.manual ? 1 : 0 })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({ refreshed_at: now, manual: opts.manual ? 1 : 0 }),
      )
      .execute();
  });

  return { persons: persons.size, organizations: orgs.size };
}

// ── Lookup ─────────────────────────────────────────────────────────────────

export type ContactIndex = {
  byEmail: Map<string, PipedriveMatch>;
  byPersonName: Map<string, PipedriveMatch>;
  byOrgName: Map<string, PipedriveMatch>;
};

/**
 * Load the whole cached directory into maps. Callers doing many lookups (a
 * report row per account) build this once rather than querying per row.
 */
export async function loadContactIndex(): Promise<ContactIndex> {
  const db = getAdminDb();
  const byEmail = new Map<string, PipedriveMatch>();
  const byPersonName = new Map<string, PipedriveMatch>();
  const byOrgName = new Map<string, PipedriveMatch>();

  const personRows = (await db
    .selectFrom("admin_pipedrive_persons")
    .selectAll()
    .execute()) as PersonRow[];
  for (const r of personRows) {
    const match: PipedriveMatch = {
      lastActivityAt: r.last_activity_at,
      matchedName: r.name,
      matchedType: "person",
      pipedriveId: r.person_id,
    };
    // A name or email shared by several people keeps the most recently active
    // one: the question is "has anyone talked to this client", not "which row".
    if (r.email) {
      const seen = byEmail.get(r.email);
      if (!seen || (match.lastActivityAt ?? 0) > (seen.lastActivityAt ?? 0)) {
        byEmail.set(r.email, match);
      }
    }
    if (r.name_key) {
      const seen = byPersonName.get(r.name_key);
      if (!seen || (match.lastActivityAt ?? 0) > (seen.lastActivityAt ?? 0)) {
        byPersonName.set(r.name_key, match);
      }
    }
  }

  const orgRows = (await db.selectFrom("admin_pipedrive_orgs").selectAll().execute()) as OrgRow[];
  for (const r of orgRows) {
    if (!r.name_key) {
      continue;
    }
    const match: PipedriveMatch = {
      lastActivityAt: r.last_activity_at,
      matchedName: r.name,
      matchedType: "organization",
      pipedriveId: r.org_id,
    };
    const seen = byOrgName.get(r.name_key);
    if (!seen || (match.lastActivityAt ?? 0) > (seen.lastActivityAt ?? 0)) {
      byOrgName.set(r.name_key, match);
    }
  }

  return { byEmail, byPersonName, byOrgName };
}

/**
 * Find one party in the cached directory. An email is trusted over a name; an
 * agent falls back to a person-name match, a company to an organization.
 */
export function lookupContact(
  index: ContactIndex,
  party: { name: string; email?: string | null; type: "agent" | "company" | "unknown" },
): PipedriveMatch | null {
  if (party.email) {
    const hit = index.byEmail.get(party.email.trim().toLowerCase());
    if (hit) {
      return hit;
    }
  }
  const key = normalizeContactName(party.name);
  if (!key) {
    return null;
  }
  if (party.type === "company") {
    return index.byOrgName.get(key) ?? index.byPersonName.get(key) ?? null;
  }
  return index.byPersonName.get(key) ?? index.byOrgName.get(key) ?? null;
}

export async function getPipedriveContactStatus(): Promise<PipedriveContactStatus> {
  const db = getAdminDb();
  const log = await db
    .selectFrom("admin_pipedrive_refresh_log")
    .select(["refreshed_at"])
    .where("id", "=", REFRESH_LOG_KEY)
    .executeTakeFirst();
  const persons = await db
    .selectFrom("admin_pipedrive_persons")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .executeTakeFirst();
  const orgs = await db
    .selectFrom("admin_pipedrive_orgs")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .executeTakeFirst();
  return {
    configured: isConfigured(),
    refreshedAt: log?.refreshed_at ?? null,
    personCount: persons?.n ?? 0,
    organizationCount: orgs?.n ?? 0,
  };
}

let schedulerStarted = false;

/** Sweep on a slow timer. Silent when Pipedrive is not configured. */
export function ensurePipedriveContactsScheduler(): void {
  if (schedulerStarted) {
    return;
  }
  schedulerStarted = true;
  const tick = async () => {
    if (!isConfigured()) {
      return;
    }
    try {
      const status = await getPipedriveContactStatus();
      if (status.refreshedAt && Date.now() - status.refreshedAt < STALE_MS) {
        return;
      }
      await refreshPipedriveContacts({ manual: false });
    } catch {
      // A CRM outage must not take the reports down; the cache simply ages.
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), STALE_MS);
  timer.unref?.();
}
