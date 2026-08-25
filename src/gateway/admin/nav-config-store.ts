/**
 * The saved sidebar arrangement: which sections appear, in what order, under
 * which heading, and which of those headings collapse.
 *
 * Stored as one JSON row per surface rather than a table of items and a table
 * of groups. The whole layout is always read together, always written together
 * by the Navigation editor, and never queried across — so rows and joins would
 * buy nothing and cost a migration every time the shape grows. The trade is
 * that the column is opaque to SQL, which is why every read goes through
 * `resolveNavConfig` instead of being trusted.
 *
 * A stored layout is a *preference*, never a permission. It cannot grant a
 * section to someone who lacks the grant, and hiding a section here does not
 * revoke anything — both surfaces still run every item past their own access
 * check before drawing it.
 */

import { z } from "zod";
import { navCatalogGroups, navCatalogItems, type NavSurface } from "./nav-catalog.js";
import { getAdminDb } from "./user-store.js";

export type NavGroup = {
  id: string;
  /** Heading text. Empty renders the group with no heading. */
  label: string;
  /** Render as an expandable submenu instead of a plain labelled run of links. */
  collapsible: boolean;
};

export type NavItem = {
  /** Page key, from the catalog. */
  id: string;
  label: string;
  icon: string;
  /** Id of the group it sits in. */
  group: string;
  /** Kept out of the sidebar. The page itself stays reachable by URL. */
  hidden: boolean;
};

export type NavConfig = { groups: NavGroup[]; items: NavItem[] };

/** Caps: generous for a real sidebar, small enough that a bad body cannot bloat the row. */
const MAX_GROUPS = 24;
const MAX_LABEL = 40;
const MAX_ICON = 8;

/**
 * Lenient on read, strict on write.
 *
 * Unknown fields are stripped and malformed entries are dropped rather than
 * failing the whole parse: a layout saved by an older build should degrade to
 * "some items fall back to their defaults", never to "the sidebar is empty".
 * `resolveNavConfig` fills whatever is missing afterwards.
 */
const groupSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().max(MAX_LABEL).default(""),
  collapsible: z.boolean().default(false),
});

const itemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().max(MAX_LABEL).default(""),
  icon: z.string().max(MAX_ICON).default(""),
  group: z.string().min(1).max(64),
  hidden: z.boolean().default(false),
});

const configSchema = z.object({
  groups: z.array(groupSchema).max(MAX_GROUPS).default([]),
  items: z.array(itemSchema).default([]),
});

/** Shape of a layout arriving from the Navigation editor. */
export type NavConfigInput = z.input<typeof configSchema>;

/** Parse an untrusted layout, or `null` if it is not even the right shape. */
export function parseNavConfig(raw: unknown): NavConfig | null {
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

/**
 * Merge a saved layout over the catalog into the list both SPAs render.
 *
 * The catalog wins on existence, the saved layout wins on arrangement:
 *
 * - a saved entry for a section that no longer ships is dropped, so removing a
 *   page in code removes it from everyone's sidebar;
 * - a section that ships but is not in the saved layout is appended to its
 *   default group, so adding a page in code does not require every admin to
 *   re-save their layout to see it;
 * - a saved entry pointing at a group that was deleted lands in the first
 *   group rather than vanishing.
 *
 * Empty label or icon means "no override" and falls back to the catalog, which
 * is also how the editor clears a rename.
 */
export function resolveNavConfig(surface: NavSurface, stored: NavConfig | null): NavConfig {
  const catalogItems = navCatalogItems(surface);
  const catalogById = new Map(catalogItems.map((i) => [i.id, i]));
  const defaults = defaultNavConfig(surface);

  const groups: NavGroup[] = [];
  const seenGroups = new Set<string>();
  for (const g of stored?.groups ?? []) {
    if (seenGroups.has(g.id)) {
      continue;
    }
    seenGroups.add(g.id);
    groups.push({ id: g.id, label: g.label, collapsible: g.collapsible });
  }
  if (groups.length === 0) {
    groups.push(...defaults.groups);
    for (const g of groups) {
      seenGroups.add(g.id);
    }
  }
  const homeless = groups[0]?.id ?? "main";

  const items: NavItem[] = [];
  const placed = new Set<string>();
  for (const entry of stored?.items ?? []) {
    const fromCatalog = catalogById.get(entry.id);
    if (!fromCatalog || placed.has(entry.id)) {
      continue;
    }
    placed.add(entry.id);
    items.push({
      id: entry.id,
      label: entry.label.trim() || fromCatalog.label,
      icon: entry.icon.trim() || fromCatalog.icon,
      group: seenGroups.has(entry.group) ? entry.group : homeless,
      hidden: entry.hidden,
    });
  }
  for (const fromCatalog of catalogItems) {
    if (placed.has(fromCatalog.id)) {
      continue;
    }
    items.push({
      id: fromCatalog.id,
      label: fromCatalog.label,
      icon: fromCatalog.icon,
      group: seenGroups.has(fromCatalog.group) ? fromCatalog.group : homeless,
      hidden: false,
    });
  }
  return { groups, items };
}

/** The shipped arrangement, as a config — what "Reset to default" restores. */
export function defaultNavConfig(surface: NavSurface): NavConfig {
  return {
    groups: navCatalogGroups(surface).map((g) => ({
      id: g.id,
      label: g.label,
      collapsible: false,
    })),
    items: navCatalogItems(surface).map((i) => ({
      id: i.id,
      label: i.label,
      icon: i.icon,
      group: i.group,
      hidden: false,
    })),
  };
}

/** The saved layout for a surface, already merged with the catalog. */
export async function getNavConfig(surface: NavSurface): Promise<NavConfig> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_nav_config")
    .select("config")
    .where("surface", "=", surface)
    .executeTakeFirst();
  if (!row) {
    return resolveNavConfig(surface, null);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(row.config);
  } catch {
    // A row we cannot read is a row we ignore: the default sidebar is always a
    // safe answer, and refusing to render one is not.
    return resolveNavConfig(surface, null);
  }
  return resolveNavConfig(surface, parseNavConfig(raw));
}

/**
 * Save a layout, normalized through the same merge the readers use.
 *
 * Storing the resolved form rather than the raw body means the row is always a
 * complete, catalog-checked layout, so a later read costs no repair work and
 * the editor gets back exactly what it will see next time.
 */
export async function setNavConfig(
  surface: NavSurface,
  input: NavConfig,
  updatedBy: string | null,
): Promise<NavConfig> {
  const resolved = resolveNavConfig(surface, input);
  const db = getAdminDb();
  const values = {
    surface,
    config: JSON.stringify(resolved),
    updated_at: Date.now(),
    updated_by: updatedBy,
  };
  await db
    .insertInto("admin_nav_config")
    .values(values)
    .onConflict((oc) =>
      oc.column("surface").doUpdateSet({
        config: values.config,
        updated_at: values.updated_at,
        updated_by: values.updated_by,
      }),
    )
    .execute();
  return resolved;
}

/** Drop a surface's saved layout, putting it back to the shipped arrangement. */
export async function resetNavConfig(surface: NavSurface): Promise<NavConfig> {
  const db = getAdminDb();
  await db.deleteFrom("admin_nav_config").where("surface", "=", surface).execute();
  return resolveNavConfig(surface, null);
}
