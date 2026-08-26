// The outreach notes, as rows an admin edits rather than constants a deploy ships.
//
// `lead-playbooks.ts` still holds the three the business started with, and this
// table is seeded from it once — so an install behaves identically until someone
// changes something, and the seed stays readable beside the matching rules it
// was written for. After that the table is the source of truth: the email is
// rendered from it, and the code copy is only ever a starting point again if the
// table is emptied.
//
// Sales copy is rewritten far more often than the code around it. That is the
// whole reason this moved.

import {
  type CadenceChannel,
  type CadenceStep,
  DEFAULT_ATTEMPTS_BEFORE_STANDARD,
  DEFAULT_STANDARD_FOLLOW_UP,
  isCadenceChannel,
  type LeadPlaybook,
  seedPlaybooks,
} from "./lead-playbooks.js";
import { getAdminDb } from "./user-store.js";

/** Ceilings so an admin typo cannot produce an unreadable email. */
const MAX_STEPS = 12;
const MAX_TEXT = 4000;
const MAX_LABEL = 120;
const MAX_TERMS = 24;

export type LeadSettings = {
  standardFollowUp: string;
  attemptsBeforeStandard: number;
};

type PlaybookRow = {
  key: string;
  label: string;
  signal: string;
  opener: string;
  soft_close: string;
  match_terms: string;
  steps: string;
  active: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

function parseStrings(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

/**
 * Read the stored steps back.
 *
 * Anything malformed is dropped rather than thrown on: a playbook with one bad
 * step should send the rest, because the alternative is an email with no
 * cadence in it at all.
 */
function parseSteps(raw: string): CadenceStep[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const out: CadenceStep[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const when = (entry as { when?: unknown }).when;
    const action = (entry as { action?: unknown }).action;
    const channel = (entry as { channel?: unknown }).channel;
    if (typeof when !== "string" || typeof action !== "string") {
      continue;
    }
    out.push({
      step: out.length + 1,
      when,
      action,
      channel: isCadenceChannel(channel) ? channel : "call",
    });
  }
  return out.slice(0, MAX_STEPS);
}

function rowToPlaybook(row: PlaybookRow): LeadPlaybook {
  return {
    key: row.key,
    label: row.label,
    signal: row.signal,
    opener: row.opener,
    softClose: row.soft_close,
    matchTerms: parseStrings(row.match_terms),
    steps: parseSteps(row.steps),
    active: row.active === 1,
    sortOrder: row.sort_order,
  };
}

/** Slugify a label into a stable key. Keys are never rewritten once leads use them. */
export function playbookKeyFromLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "playbook"
  );
}

let seeded = false;
/** Populate the three the business started with, once, if the table is empty. */
export async function ensurePlaybookSeed(): Promise<void> {
  if (seeded) {
    return;
  }
  seeded = true;
  const db = getAdminDb();
  const now = Date.now();
  const existingSettings = await db
    .selectFrom("admin_lead_settings")
    .select("id")
    .executeTakeFirst();
  if (!existingSettings) {
    await db
      .insertInto("admin_lead_settings")
      .values({
        id: 1,
        standard_follow_up: DEFAULT_STANDARD_FOLLOW_UP,
        attempts_before_standard: DEFAULT_ATTEMPTS_BEFORE_STANDARD,
        updated_at: now,
      })
      .execute();
  }
  const existing = await db.selectFrom("admin_lead_playbooks").select("key").executeTakeFirst();
  if (existing) {
    return;
  }
  await db
    .insertInto("admin_lead_playbooks")
    .values(
      seedPlaybooks().map((p, i) => ({
        key: p.key,
        label: p.label,
        signal: p.signal,
        opener: p.opener,
        soft_close: p.softClose,
        match_terms: JSON.stringify(p.matchTerms),
        steps: JSON.stringify(
          p.steps.map((s) => ({ when: s.when, channel: s.channel, action: s.action })),
        ),
        active: 1,
        sort_order: i,
        created_at: now,
        updated_at: now,
      })),
    )
    .execute();
}

export async function listPlaybooks(): Promise<LeadPlaybook[]> {
  await ensurePlaybookSeed();
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_lead_playbooks")
    .selectAll()
    .orderBy("sort_order")
    .orderBy("label")
    .execute();
  return rows.map(rowToPlaybook);
}

export async function getPlaybook(key: string | null | undefined): Promise<LeadPlaybook | null> {
  if (!key) {
    return null;
  }
  await ensurePlaybookSeed();
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_lead_playbooks")
    .selectAll()
    .where("key", "=", key)
    .executeTakeFirst();
  return row ? rowToPlaybook(row) : null;
}

export async function getLeadSettings(): Promise<LeadSettings> {
  await ensurePlaybookSeed();
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_lead_settings")
    .selectAll()
    .where("id", "=", 1)
    .executeTakeFirst();
  return {
    standardFollowUp: row?.standard_follow_up ?? DEFAULT_STANDARD_FOLLOW_UP,
    attemptsBeforeStandard: row?.attempts_before_standard ?? DEFAULT_ATTEMPTS_BEFORE_STANDARD,
  };
}

export async function setLeadSettings(input: Partial<LeadSettings>): Promise<LeadSettings> {
  await ensurePlaybookSeed();
  const db = getAdminDb();
  const updates: Record<string, unknown> = { updated_at: Date.now() };
  if (input.standardFollowUp !== undefined) {
    updates.standard_follow_up = input.standardFollowUp.trim().slice(0, MAX_TEXT);
  }
  if (input.attemptsBeforeStandard !== undefined) {
    // One is a cadence of one call; a dozen is somebody's typo. Clamped rather
    // than rejected, because the field is a number box on a form.
    updates.attempts_before_standard = Math.min(12, Math.max(1, input.attemptsBeforeStandard));
  }
  await db.updateTable("admin_lead_settings").set(updates).where("id", "=", 1).execute();
  return getLeadSettings();
}

export type PlaybookInput = {
  label: string;
  signal?: string;
  opener?: string;
  softClose?: string;
  matchTerms?: string[];
  steps?: Array<{ when: string; channel: string; action: string }>;
  active?: boolean;
};

function normalizeSteps(
  steps: PlaybookInput["steps"],
): Array<{ when: string; channel: CadenceChannel; action: string }> {
  return (steps ?? [])
    .filter((s) => s && (s.when?.trim() || s.action?.trim()))
    .slice(0, MAX_STEPS)
    .map((s) => ({
      when: (s.when ?? "").trim().slice(0, MAX_LABEL),
      channel: isCadenceChannel(s.channel) ? s.channel : "call",
      action: (s.action ?? "").trim().slice(0, MAX_TEXT),
    }));
}

function normalizeTerms(terms: string[] | undefined): string[] {
  return (terms ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TERMS);
}

export async function createPlaybook(input: PlaybookInput): Promise<LeadPlaybook> {
  await ensurePlaybookSeed();
  const db = getAdminDb();
  const key = playbookKeyFromLabel(input.label);
  if (await getPlaybook(key)) {
    throw new Error("playbook_exists");
  }
  const last = await db
    .selectFrom("admin_lead_playbooks")
    .select("sort_order")
    .orderBy("sort_order", "desc")
    .executeTakeFirst();
  const now = Date.now();
  await db
    .insertInto("admin_lead_playbooks")
    .values({
      key,
      label: input.label.trim().slice(0, MAX_LABEL),
      signal: (input.signal ?? "").trim().slice(0, MAX_TEXT),
      opener: (input.opener ?? "").trim().slice(0, MAX_TEXT),
      soft_close: (input.softClose ?? "").trim().slice(0, MAX_TEXT),
      // A new source with no terms of its own still matches on its label, which
      // is nearly always the wording the form uses anyway.
      match_terms: JSON.stringify(
        normalizeTerms(input.matchTerms?.length ? input.matchTerms : [input.label]),
      ),
      steps: JSON.stringify(normalizeSteps(input.steps)),
      active: input.active === false ? 0 : 1,
      sort_order: (last?.sort_order ?? -1) + 1,
      created_at: now,
      updated_at: now,
    })
    .execute();
  const created = await getPlaybook(key);
  if (!created) {
    throw new Error("playbook_create_failed");
  }
  return created;
}

export async function updatePlaybook(
  key: string,
  input: Partial<PlaybookInput>,
): Promise<LeadPlaybook | null> {
  const existing = await getPlaybook(key);
  if (!existing) {
    return null;
  }
  const db = getAdminDb();
  const updates: Record<string, unknown> = { updated_at: Date.now() };
  if (input.label !== undefined) {
    // The label is editable, the key never is: leads already carry it.
    updates.label = input.label.trim().slice(0, MAX_LABEL);
  }
  if (input.signal !== undefined) {
    updates.signal = input.signal.trim().slice(0, MAX_TEXT);
  }
  if (input.opener !== undefined) {
    updates.opener = input.opener.trim().slice(0, MAX_TEXT);
  }
  if (input.softClose !== undefined) {
    updates.soft_close = input.softClose.trim().slice(0, MAX_TEXT);
  }
  if (input.matchTerms !== undefined) {
    updates.match_terms = JSON.stringify(normalizeTerms(input.matchTerms));
  }
  if (input.steps !== undefined) {
    updates.steps = JSON.stringify(normalizeSteps(input.steps));
  }
  if (input.active !== undefined) {
    updates.active = input.active ? 1 : 0;
  }
  await db.updateTable("admin_lead_playbooks").set(updates).where("key", "=", key).execute();
  return getPlaybook(key);
}

/**
 * Delete a playbook. Leads that came in on it keep the key they were filed
 * under — the email they triggered has already been sent, and rewriting their
 * history to say they arrived on nothing would be a lie about what happened.
 */
export async function deletePlaybook(key: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_lead_playbooks").where("key", "=", key).execute();
}

/** Reorder, the way the request-type list does: send the whole order, renumber all. */
export async function reorderPlaybooks(orderedKeys: string[]): Promise<LeadPlaybook[]> {
  const db = getAdminDb();
  const current = await listPlaybooks();
  const known = new Set(current.map((p) => p.key));
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const key of orderedKeys) {
    if (known.has(key) && !seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }
  for (const p of current) {
    if (!seen.has(p.key)) {
      ordered.push(p.key);
    }
  }
  const now = Date.now();
  await db.transaction().execute(async (trx) => {
    for (const [index, key] of ordered.entries()) {
      await trx
        .updateTable("admin_lead_playbooks")
        .set({ sort_order: index, updated_at: now })
        .where("key", "=", key)
        .execute();
    }
  });
  return listPlaybooks();
}
