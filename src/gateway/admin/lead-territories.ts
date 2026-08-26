// Who owns which market, for lead dispatch.
//
// The sales reports already answer "who owns this client" from `focus-regions.ts`,
// but they answer it with a revenue ranking, and a lead that arrived four minutes
// ago has no revenue to rank. So ownership for leads is a plain table: market in,
// person out. It is seeded from the same BDS book the reports use — one place to
// learn the footprint from — and is editable in the Hub afterwards, because the
// row that decides who gets the email must be changeable without a deploy.
//
// Columbus and Dayton are split by revenue in the Focus report. That cut cannot
// apply here, so both seed to the person who owns the top of those books.

import { SOLE_OWNERS, SPLIT_REGIONS } from "./focus-regions.js";
import { getAdminDb } from "./user-store.js";

export type LeadTerritory = {
  key: string;
  label: string;
  /** Other spellings a form might send for this market. */
  aliases: string[];
  ownerName: string | null;
  ownerEmail: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

/** New leads in Columbus and Dayton go to the owner of the top of those books. */
const SPLIT_REGION_LEAD_OWNER = "Chris Voge";

type TerritoryRow = {
  key: string;
  label: string;
  aliases: string;
  owner_name: string | null;
  owner_email: string | null;
  active: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

function parseAliases(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

function rowToTerritory(row: TerritoryRow): LeadTerritory {
  return {
    key: row.key,
    label: row.label,
    aliases: parseAliases(row.aliases),
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    active: row.active === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fold a market string down to something two spellings of the same place can
 * meet in: "Columbus, Ohio", "columbus oh" and "Greater Columbus" all reduce to
 * a key the table can be looked up by. Punctuation and the state suffix go,
 * because a website dropdown is written for a visitor, not for this table.
 */
export function territoryKeyFromLabel(value: string): string {
  return value
    .toLowerCase()
    .split(",")[0]
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** The BDS book is keyed in lower case ("fort wayne"); a market is shown titled. */
function titleCase(region: string): string {
  return region.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** The seeded book: every region the sales reports know, with its owner. */
export function seedTerritories(): Array<{ key: string; label: string; owner: string }> {
  const out: Array<{ key: string; label: string; owner: string }> = [];
  for (const [region, owner] of Object.entries(SOLE_OWNERS)) {
    out.push({ key: territoryKeyFromLabel(region), label: titleCase(region), owner });
  }
  for (const region of SPLIT_REGIONS) {
    out.push({
      key: territoryKeyFromLabel(region),
      label: titleCase(region),
      owner: SPLIT_REGION_LEAD_OWNER,
    });
  }
  return out.toSorted((a, b) => a.label.localeCompare(b.label));
}

let seeded = false;
/**
 * Populate the book once if the table is empty. Idempotent, and deliberately
 * seeds no addresses: a guessed address either bounces or reaches the wrong
 * person, and both are worse than the Hub saying the market needs an email.
 */
export async function ensureTerritorySeed(): Promise<void> {
  if (seeded) {
    return;
  }
  seeded = true;
  const db = getAdminDb();
  const existing = await db.selectFrom("admin_lead_territories").select("key").executeTakeFirst();
  if (existing) {
    return;
  }
  const now = Date.now();
  await db
    .insertInto("admin_lead_territories")
    .values(
      seedTerritories().map((t, i) => ({
        key: t.key,
        label: t.label,
        aliases: "[]",
        owner_name: t.owner,
        owner_email: null,
        active: 1,
        sort_order: i,
        created_at: now,
        updated_at: now,
      })),
    )
    .execute();
}

export async function listTerritories(): Promise<LeadTerritory[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_lead_territories")
    .selectAll()
    .orderBy("sort_order")
    .orderBy("label")
    .execute();
  return rows.map(rowToTerritory);
}

export async function getTerritory(key: string): Promise<LeadTerritory | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_lead_territories")
    .selectAll()
    .where("key", "=", key)
    .executeTakeFirst();
  return row ? rowToTerritory(row) : null;
}

export type TerritoryInput = {
  label: string;
  aliases?: string[];
  ownerName?: string | null;
  ownerEmail?: string | null;
  active?: boolean;
};

export async function createTerritory(input: TerritoryInput): Promise<LeadTerritory> {
  const db = getAdminDb();
  const key = territoryKeyFromLabel(input.label) || "market";
  const now = Date.now();
  const existing = await getTerritory(key);
  if (existing) {
    throw new Error("territory_exists");
  }
  const last = await db
    .selectFrom("admin_lead_territories")
    .select("sort_order")
    .orderBy("sort_order", "desc")
    .executeTakeFirst();
  await db
    .insertInto("admin_lead_territories")
    .values({
      key,
      label: input.label.trim(),
      aliases: JSON.stringify(input.aliases ?? []),
      owner_name: input.ownerName?.trim() || null,
      owner_email: input.ownerEmail?.trim().toLowerCase() || null,
      active: input.active === false ? 0 : 1,
      sort_order: (last?.sort_order ?? -1) + 1,
      created_at: now,
      updated_at: now,
    })
    .execute();
  const created = await getTerritory(key);
  if (!created) {
    throw new Error("territory_create_failed");
  }
  return created;
}

export async function updateTerritory(
  key: string,
  input: Partial<TerritoryInput>,
): Promise<LeadTerritory | null> {
  const db = getAdminDb();
  const existing = await getTerritory(key);
  if (!existing) {
    return null;
  }
  const updates: Partial<TerritoryRow> = { updated_at: Date.now() };
  if (input.label !== undefined) {
    updates.label = input.label.trim();
  }
  if (input.aliases !== undefined) {
    updates.aliases = JSON.stringify(input.aliases);
  }
  if (input.ownerName !== undefined) {
    updates.owner_name = input.ownerName?.trim() || null;
  }
  if (input.ownerEmail !== undefined) {
    updates.owner_email = input.ownerEmail?.trim().toLowerCase() || null;
  }
  if (input.active !== undefined) {
    updates.active = input.active ? 1 : 0;
  }
  await db.updateTable("admin_lead_territories").set(updates).where("key", "=", key).execute();
  return getTerritory(key);
}

/**
 * Deleting a market does not touch the leads that came through it: their owner
 * is copied onto the row at intake, so the queue still says who was emailed.
 */
export async function deleteTerritory(key: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_lead_territories").where("key", "=", key).execute();
}

/**
 * Which territory a market string belongs to.
 *
 * Three passes, cheapest first: the folded key, then an alias, then the label
 * read loosely — a dropdown reading "Columbus / Central Ohio" should still find
 * Columbus. Anything else returns null, and an unrouted lead is emailed to the
 * fallback address rather than guessed at.
 */
export function matchTerritory(
  territories: readonly LeadTerritory[],
  market: string | null | undefined,
): LeadTerritory | null {
  const raw = (market ?? "").trim();
  if (!raw) {
    return null;
  }
  const active = territories.filter((t) => t.active);
  const key = territoryKeyFromLabel(raw);
  const byKey = active.find((t) => t.key === key);
  if (byKey) {
    return byKey;
  }
  const byAlias = active.find((t) =>
    t.aliases.some(
      (a) => territoryKeyFromLabel(a) === key || a.trim().toLowerCase() === raw.toLowerCase(),
    ),
  );
  if (byAlias) {
    return byAlias;
  }
  // Last pass: the market name appearing inside a longer answer. Word-boundary
  // matched on the folded forms so "Lima" does not match "Climate".
  const folded = raw.toLowerCase();
  const contains = active.filter((t) => {
    const needle = t.label.toLowerCase();
    return new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(folded);
  });
  // A string naming two markets is ambiguous, and answering it with whichever
  // sorted first would route someone's lead to the wrong person silently.
  return contains.length === 1 ? contains[0] : null;
}

/** Resolve a market to the territory and the desk that should hear about it. */
export async function resolveLeadOwner(market: string | null | undefined): Promise<{
  territory: LeadTerritory | null;
  ownerName: string | null;
  ownerEmail: string | null;
}> {
  await ensureTerritorySeed();
  const territory = matchTerritory(await listTerritories(), market);
  return {
    territory,
    ownerName: territory?.ownerName ?? null,
    ownerEmail: territory?.ownerEmail ?? null,
  };
}
