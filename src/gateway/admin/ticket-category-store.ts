import { getAdminDb } from "./user-store.js";

// Request types offered on the public intake form, managed from the dashboard
// rather than hardcoded. A category owns its form copy (option label, the
// optional follow-up question, the details label/hint) and its short label for
// email subjects. Which department it routes to lives in the routing table
// (ticket-department-store). Seeded once with the original four so the form is
// unchanged until an admin edits it.
//
// Categories are managed data, not a closed runtime union — same as departments.
// Ticket rows store the key as free text; validation happens at the intake
// boundary against this table.

/** Shape of the follow-up question a category asks before the details box. */
export type CategoryExtraField = "none" | "select" | "text";

export const CATEGORY_EXTRA_FIELDS: CategoryExtraField[] = ["none", "select", "text"];

export type TicketCategoryDef = {
  key: string;
  /** Option text on the intake form's request-type dropdown. */
  label: string;
  /** Compact label for email subjects, e.g. "Edit request". */
  shortLabel: string;
  extraField: CategoryExtraField;
  /** Question shown above the extra field. */
  extraLabel: string | null;
  /** Choices when extraField is "select". */
  extraOptions: string[];
  /** Placeholder when extraField is "text". */
  extraPlaceholder: string | null;
  detailsLabel: string;
  detailsHint: string | null;
  sortOrder: number;
  /** Inactive categories stay on historical tickets but leave the form. */
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

const MEDIA_OPTIONS = [
  "Photos",
  "Video / Walkthrough",
  "Aerial / Drone",
  "Floor plan",
  "Virtual tour / Matterport",
  "Twilight",
  "Other",
];

/** The original four, copy-for-copy identical to the pre-managed form. */
const SEED_CATEGORIES: Array<Omit<TicketCategoryDef, "createdAt" | "updatedAt">> = [
  {
    key: "edit_request",
    label: "Request an edit to my media",
    shortLabel: "Edit request",
    extraField: "select",
    extraLabel: "Which media?",
    extraOptions: MEDIA_OPTIONS,
    extraPlaceholder: null,
    detailsLabel: "What change would you like?",
    detailsHint: "Describe the edit — which photo/clip, and what to change.",
    sortOrder: 0,
    active: true,
  },
  {
    key: "additional_service",
    label: "Order an additional service",
    shortLabel: "Additional service",
    extraField: "text",
    extraLabel: "Which service would you like to add?",
    extraOptions: [],
    extraPlaceholder: "e.g. Virtual staging, extra aerials, twilight edit…",
    detailsLabel: "Details",
    detailsHint: "Any timing needs or specifics for the team.",
    sortOrder: 1,
    active: true,
  },
  {
    key: "missing_media",
    label: "Report missing or incorrect media",
    shortLabel: "Missing media",
    extraField: "select",
    extraLabel: "Which media?",
    extraOptions: MEDIA_OPTIONS,
    extraPlaceholder: null,
    detailsLabel: "What's missing or wrong?",
    detailsHint: "Tell us which shots or rooms are missing or incorrect.",
    sortOrder: 2,
    active: true,
  },
  {
    key: "other",
    label: "Something else",
    shortLabel: "Support request",
    extraField: "none",
    extraLabel: null,
    extraOptions: [],
    extraPlaceholder: null,
    detailsLabel: "How can we help?",
    detailsHint: "Describe your request.",
    sortOrder: 3,
    active: true,
  },
];

type CategoryRow = {
  key: string;
  label: string;
  short_label: string;
  extra_field: string;
  extra_label: string | null;
  extra_options: string | null;
  extra_placeholder: string | null;
  details_label: string;
  details_hint: string | null;
  sort_order: number;
  active: number;
  created_at: number;
  updated_at: number;
};

function parseOptions(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

function normalizeExtraField(raw: string): CategoryExtraField {
  return CATEGORY_EXTRA_FIELDS.includes(raw as CategoryExtraField)
    ? (raw as CategoryExtraField)
    : "none";
}

function rowToCategory(row: CategoryRow): TicketCategoryDef {
  return {
    key: row.key,
    label: row.label,
    shortLabel: row.short_label,
    extraField: normalizeExtraField(row.extra_field),
    extraLabel: row.extra_label,
    extraOptions: parseOptions(row.extra_options),
    extraPlaceholder: row.extra_placeholder,
    detailsLabel: row.details_label,
    detailsHint: row.details_hint,
    sortOrder: row.sort_order,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Slugify a label into a stable category key (lowercase, alnum + underscores). */
export function categoryKeyFromLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "category"
  );
}

let seeded = false;
/** Populate the original four once if the table is empty. Idempotent. */
export async function ensureCategorySeed(): Promise<void> {
  if (seeded) {
    return;
  }
  seeded = true;
  const db = getAdminDb();
  const existing = await db.selectFrom("admin_ticket_categories").select("key").executeTakeFirst();
  if (existing) {
    return;
  }
  const now = Date.now();
  await db
    .insertInto("admin_ticket_categories")
    .values(
      SEED_CATEGORIES.map((c) => ({
        key: c.key,
        label: c.label,
        short_label: c.shortLabel,
        extra_field: c.extraField,
        extra_label: c.extraLabel,
        extra_options: JSON.stringify(c.extraOptions),
        extra_placeholder: c.extraPlaceholder,
        details_label: c.detailsLabel,
        details_hint: c.detailsHint,
        sort_order: c.sortOrder,
        active: 1,
        created_at: now,
        updated_at: now,
      })),
    )
    .execute();
}

export async function listCategories(
  opts: { activeOnly?: boolean } = {},
): Promise<TicketCategoryDef[]> {
  const db = getAdminDb();
  let q = db.selectFrom("admin_ticket_categories").selectAll();
  if (opts.activeOnly) {
    q = q.where("active", "=", 1);
  }
  const rows = await q.orderBy("sort_order", "asc").orderBy("label", "asc").execute();
  return rows.map(rowToCategory);
}

export async function getCategory(key: string): Promise<TicketCategoryDef | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_ticket_categories")
    .selectAll()
    .where("key", "=", key)
    .executeTakeFirst();
  return row ? rowToCategory(row) : null;
}

export type CreateCategoryParams = {
  key?: string;
  label: string;
  shortLabel?: string;
  extraField?: CategoryExtraField;
  extraLabel?: string | null;
  extraOptions?: string[];
  extraPlaceholder?: string | null;
  detailsLabel?: string;
  detailsHint?: string | null;
  sortOrder?: number;
  active?: boolean;
};

export async function createCategory(params: CreateCategoryParams): Promise<TicketCategoryDef> {
  const db = getAdminDb();
  const key = (params.key?.trim() || categoryKeyFromLabel(params.label)).toLowerCase();
  const now = Date.now();
  const max = await db
    .selectFrom("admin_ticket_categories")
    .select((eb) => eb.fn.max("sort_order").as("m"))
    .executeTakeFirst();
  await db
    .insertInto("admin_ticket_categories")
    .values({
      key,
      label: params.label.trim(),
      short_label: params.shortLabel?.trim() || params.label.trim(),
      extra_field: params.extraField ?? "none",
      extra_label: params.extraLabel?.trim() || null,
      extra_options: JSON.stringify(params.extraOptions ?? []),
      extra_placeholder: params.extraPlaceholder?.trim() || null,
      details_label: params.detailsLabel?.trim() || "Details",
      details_hint: params.detailsHint?.trim() || null,
      sort_order: params.sortOrder ?? (max?.m ?? -1) + 1,
      active: params.active === false ? 0 : 1,
      created_at: now,
      updated_at: now,
    })
    .execute();
  return (await getCategory(key))!;
}

export type UpdateCategoryParams = {
  label?: string;
  shortLabel?: string;
  extraField?: CategoryExtraField;
  extraLabel?: string | null;
  extraOptions?: string[];
  extraPlaceholder?: string | null;
  detailsLabel?: string;
  detailsHint?: string | null;
  sortOrder?: number;
  active?: boolean;
};

export async function updateCategory(
  key: string,
  params: UpdateCategoryParams,
): Promise<TicketCategoryDef | null> {
  const db = getAdminDb();
  const updates: Record<string, unknown> = { updated_at: Date.now() };
  if (params.label !== undefined) {
    updates.label = params.label.trim();
  }
  if (params.shortLabel !== undefined) {
    updates.short_label = params.shortLabel.trim();
  }
  if (params.extraField !== undefined) {
    updates.extra_field = params.extraField;
  }
  if (params.extraLabel !== undefined) {
    updates.extra_label = params.extraLabel?.trim() || null;
  }
  if (params.extraOptions !== undefined) {
    updates.extra_options = JSON.stringify(params.extraOptions);
  }
  if (params.extraPlaceholder !== undefined) {
    updates.extra_placeholder = params.extraPlaceholder?.trim() || null;
  }
  if (params.detailsLabel !== undefined) {
    updates.details_label = params.detailsLabel.trim();
  }
  if (params.detailsHint !== undefined) {
    updates.details_hint = params.detailsHint?.trim() || null;
  }
  if (params.sortOrder !== undefined) {
    updates.sort_order = params.sortOrder;
  }
  if (params.active !== undefined) {
    updates.active = params.active ? 1 : 0;
  }
  await db.updateTable("admin_ticket_categories").set(updates).where("key", "=", key).execute();
  return getCategory(key);
}

/**
 * Rewrite the form order from a list of keys, first to last.
 *
 * Takes the whole order rather than a single move so two admins reordering at
 * once cannot interleave into a half-applied sequence, and rewrites every row's
 * `sort_order` to its index so the ties and gaps left by `max + 1` creation
 * cannot make the order ambiguous. Keys the caller omits (and unknown keys it
 * invents) are not dropped or created — omitted categories keep their relative
 * order and settle after the ones named here.
 */
export async function reorderCategories(orderedKeys: string[]): Promise<TicketCategoryDef[]> {
  const db = getAdminDb();
  const current = await listCategories();
  const known = new Set(current.map((c) => c.key));
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const key of orderedKeys) {
    if (known.has(key) && !seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }
  for (const c of current) {
    if (!seen.has(c.key)) {
      ordered.push(c.key);
    }
  }
  const now = Date.now();
  await db.transaction().execute(async (trx) => {
    for (const [index, key] of ordered.entries()) {
      await trx
        .updateTable("admin_ticket_categories")
        .set({ sort_order: index, updated_at: now })
        .where("key", "=", key)
        .execute();
    }
  });
  return listCategories();
}

/** How many tickets still reference a category. Drives delete-vs-deactivate. */
export async function countTicketsInCategory(key: string): Promise<number> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_tickets")
    .select((eb) => eb.fn.countAll().as("c"))
    .where("category", "=", key)
    .executeTakeFirst();
  return Number(row?.c ?? 0);
}

export type RemoveCategoryResult =
  | { outcome: "deleted" }
  | { outcome: "deactivated"; ticketCount: number }
  | { outcome: "not_found" };

/**
 * Remove a category. Hard-deletes only when no ticket references it; otherwise
 * deactivates so history keeps its real label and stays filterable, while the
 * category leaves the public form either way.
 */
export async function removeCategory(key: string): Promise<RemoveCategoryResult> {
  const existing = await getCategory(key);
  if (!existing) {
    return { outcome: "not_found" };
  }
  const ticketCount = await countTicketsInCategory(key);
  const db = getAdminDb();
  if (ticketCount > 0) {
    await updateCategory(key, { active: false });
    return { outcome: "deactivated", ticketCount };
  }
  await db.deleteFrom("admin_ticket_categories").where("key", "=", key).execute();
  await db.deleteFrom("admin_ticket_category_routes").where("category", "=", key).execute();
  return { outcome: "deleted" };
}

/** True when the key names a category clients may still submit. */
export async function isSubmittableCategory(key: string): Promise<boolean> {
  const cat = await getCategory(key);
  return cat?.active === true;
}

/**
 * Display label for a category key. Falls back to the raw key so tickets in a
 * deleted category still render something meaningful.
 */
export async function getCategoryShortLabel(key: string): Promise<string> {
  const cat = await getCategory(key);
  return cat?.shortLabel ?? key;
}
