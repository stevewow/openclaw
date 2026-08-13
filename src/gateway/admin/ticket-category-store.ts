import { isTicketIconKey, SEED_CATEGORY_ICONS } from "./ticket-icons.js";
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

/**
 * Shape of the follow-up question a category asks before the details box.
 * "multiselect" lets a client tick several priced choices and see a running
 * total; "select" stays single-choice.
 */
export type CategoryExtraField = "none" | "select" | "text" | "multiselect";

export const CATEGORY_EXTRA_FIELDS: CategoryExtraField[] = [
  "none",
  "select",
  "text",
  "multiselect",
];

/** True when the field presents a list of choices the client picks from. */
export function isChoiceField(field: CategoryExtraField): boolean {
  return field === "select" || field === "multiselect";
}

/** How a follow-up question attached to one choice is answered. */
export type FollowUpKind = "text" | "textarea" | "select";

const FOLLOW_UP_KINDS = new Set<string>(["text", "textarea", "select"]);

/** Ceilings that keep an admin typo from producing an unusable public form. */
export const MAX_OPTION_QUANTITY = 99;
const MAX_FOLLOW_UPS_PER_OPTION = 8;
/** Long enough for "per finished image", short enough to sit beside a price. */
const MAX_UNIT_LABEL = 40;
const MAX_FOLLOW_UP_CHOICES = 40;
const MAX_FOLLOW_UP_LABEL = 200;

/**
 * A question asked only when its choice is picked — "3 virtual staging images"
 * needs a style and a room list; the other choices don't. Answers are keyed by
 * `id`, so renaming the question text keeps in-flight answers attached.
 */
export type CategoryFollowUp = {
  id: string;
  /** Question text shown above the input. */
  label: string;
  kind: FollowUpKind;
  /** Choices when kind is "select". */
  choices: string[];
  /** Placeholder for text/textarea. */
  placeholder: string | null;
  required: boolean;
};

/**
 * One choice on a select/multiselect question. Was a bare string; the object
 * form adds an optional thumbnail, a price, an orderable quantity and its own
 * follow-up questions. Legacy rows are still plain strings and older object
 * rows lack the newer keys, so reads coerce and writes always emit the full
 * object form.
 */
export type CategoryOption = {
  label: string;
  /** Thumbnail shown beside the choice, or null. */
  imageUrl: string | null;
  /**
   * Price in whole cents, or null when the choice isn't priced. With
   * `priceMaxCents` set this is the low end of a range instead of a firm price.
   */
  priceCents: number | null;
  /**
   * High end of a price range, or null for a firm price. Set only alongside a
   * `priceCents` it exceeds. A range means the job has to be sized before it can
   * be billed, so setting one also forces `quoteRequired`.
   */
  priceMaxCents: number | null;
  /**
   * Whether the desk has to quote this choice and have the client accept before
   * work starts. Firm-priced choices start immediately; ranged and figure-less
   * choices (custom retouching, decluttering) do not. Always true when
   * `priceMaxCents` is set — normalization enforces it, so runtime code can read
   * this one field instead of re-deriving the rule.
   */
  quoteRequired: boolean;
  /**
   * What one unit of the price is, written the way a client should read it —
   * "per image", "per room", "per 1,000 sq ft". Null falls back to "each",
   * which is right for a countable thing and wrong for most else.
   */
  unitLabel: string | null;
  /**
   * Most units of this choice a client may order. 1 (the default) means the
   * choice is a plain tick with no quantity selector.
   */
  maxQuantity: number;
  /** Questions revealed under the choice once it is picked. */
  followUps: CategoryFollowUp[];
};

/** Slugify a question label into a stable answer key. */
function followUpIdFromLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "question"
  );
}

/** Coerce one stored/posted follow-up question, or null if it has no text. */
function toCategoryFollowUp(raw: unknown, taken: Set<string>): CategoryFollowUp | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const label =
    typeof record.label === "string" ? record.label.trim().slice(0, MAX_FOLLOW_UP_LABEL) : "";
  if (!label) {
    return null;
  }
  const kind =
    typeof record.kind === "string" && FOLLOW_UP_KINDS.has(record.kind)
      ? (record.kind as FollowUpKind)
      : "text";
  const rawId = typeof record.id === "string" ? followUpIdFromLabel(record.id) : "";
  let id = rawId || followUpIdFromLabel(label);
  // Two questions that slugify the same would otherwise share one answer.
  let n = 2;
  while (taken.has(id)) {
    id = `${id}_${n}`;
    n += 1;
  }
  taken.add(id);
  const choices =
    kind === "select" && Array.isArray(record.choices)
      ? [
          ...new Set(
            record.choices
              .filter((c): c is string => typeof c === "string")
              .map((c) => c.trim().slice(0, MAX_FOLLOW_UP_LABEL))
              .filter((c) => c.length > 0),
          ),
        ].slice(0, MAX_FOLLOW_UP_CHOICES)
      : [];
  const placeholder =
    typeof record.placeholder === "string"
      ? record.placeholder.trim().slice(0, MAX_FOLLOW_UP_LABEL)
      : "";
  return {
    id,
    label,
    // A "pick one" question with nothing to pick would be a dead control.
    kind: kind === "select" && choices.length === 0 ? "text" : kind,
    choices,
    placeholder: placeholder || null,
    required: record.required === true,
  };
}

/**
 * What a caller may hand the store: a full option, a partial one (the newer
 * keys default), or a legacy bare label. Everything is normalized on write.
 */
export type CategoryFollowUpInput = { label: string } & Partial<Omit<CategoryFollowUp, "label">>;
export type CategoryOptionInput =
  | string
  | ({ label: string } & Partial<Omit<CategoryOption, "label" | "followUps">> & {
        followUps?: CategoryFollowUpInput[];
      });

/** Coerce a stored entry — string (legacy) or object — into a CategoryOption. */
export function toCategoryOption(raw: unknown): CategoryOption | null {
  if (typeof raw === "string") {
    const label = raw.trim();
    return label
      ? {
          label,
          imageUrl: null,
          priceCents: null,
          priceMaxCents: null,
          quoteRequired: false,
          unitLabel: null,
          maxQuantity: 1,
          followUps: [],
        }
      : null;
  }
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (!label) {
    return null;
  }
  const imageUrl = typeof record.imageUrl === "string" ? record.imageUrl.trim() : "";
  const price = record.priceCents;
  // Prices are whole cents; anything fractional, negative or non-finite is
  // treated as unpriced rather than silently rounded into a wrong number.
  const priceCents =
    typeof price === "number" && Number.isSafeInteger(price) && price >= 0 ? price : null;
  const rawPriceMax = record.priceMaxCents;
  // A ceiling is only a range if it sits above a floor. A max on its own, or one
  // at or below the floor, is a typo — dropping it leaves a firm price, which is
  // the reading that cannot over-quote a client.
  const priceMaxCents =
    typeof rawPriceMax === "number" &&
    Number.isSafeInteger(rawPriceMax) &&
    priceCents !== null &&
    rawPriceMax > priceCents
      ? rawPriceMax
      : null;
  // A range always needs sizing before it can be billed, so it implies the flag
  // and every later read can trust this field alone.
  const quoteRequired = priceMaxCents !== null || record.quoteRequired === true;
  // Wording only — it is never parsed back into a number, so anything an admin
  // types is honoured verbatim beyond a length cap.
  const unitLabel =
    typeof record.unitLabel === "string" ? record.unitLabel.trim().slice(0, MAX_UNIT_LABEL) : "";
  const rawMax = record.maxQuantity;
  // A junk maximum falls back to 1 — a choice you can tick — never to "any
  // number", which would let one line item quote an arbitrary total.
  const maxQuantity =
    typeof rawMax === "number" && Number.isSafeInteger(rawMax) && rawMax >= 1
      ? Math.min(rawMax, MAX_OPTION_QUANTITY)
      : 1;
  const taken = new Set<string>();
  const followUps = Array.isArray(record.followUps)
    ? record.followUps
        .map((f) => toCategoryFollowUp(f, taken))
        .filter((f): f is CategoryFollowUp => f !== null)
        .slice(0, MAX_FOLLOW_UPS_PER_OPTION)
    : [];
  return {
    label,
    imageUrl: imageUrl || null,
    priceCents,
    priceMaxCents,
    quoteRequired,
    unitLabel: unitLabel || null,
    maxQuantity,
    followUps,
  };
}

export type TicketCategoryDef = {
  key: string;
  /** Option text on the intake form's request-type dropdown. */
  label: string;
  /** Compact label for email subjects, e.g. "Edit request". */
  shortLabel: string;
  extraField: CategoryExtraField;
  /** Question shown above the extra field. */
  extraLabel: string | null;
  /** Choices when extraField is "select" or "multiselect". */
  extraOptions: CategoryOption[];
  /** Placeholder when extraField is "text". */
  extraPlaceholder: string | null;
  detailsLabel: string;
  detailsHint: string | null;
  sortOrder: number;
  /** Inactive categories stay on historical tickets but leave the form. */
  active: boolean;
  /**
   * Which mark the request-type card shows on the intake form. A key from
   * `ticket-icons.ts`, or null to draw the generic one — an unknown key resolves
   * to the same fallback, so a renamed icon can never leave a blank card.
   */
  icon: string | null;
  createdAt: number;
  updatedAt: number;
};

/** Unpriced, thumbnail-less choices — the shape the form shipped with. */
const MEDIA_OPTIONS: CategoryOption[] = [
  "Photos",
  "Video / Walkthrough",
  "Aerial / Drone",
  "Floor plan",
  "Virtual tour / Matterport",
  "Twilight",
  "Other",
].map((label) => ({
  label,
  imageUrl: null,
  priceCents: null,
  priceMaxCents: null,
  quoteRequired: false,
  unitLabel: null,
  maxQuantity: 1,
  followUps: [],
}));

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
    icon: "pencil",
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
    icon: "plus",
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
    icon: "image-alert",
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
    icon: "question",
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
  icon: string | null;
  created_at: number;
  updated_at: number;
};

function parseOptions(raw: string | null): CategoryOption[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(toCategoryOption).filter((o): o is CategoryOption => o !== null);
  } catch {
    return [];
  }
}

/** Coerce whatever a caller supplied into storable options, dropping junk. */
export function normalizeOptions(raw: unknown): CategoryOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(toCategoryOption).filter((o): o is CategoryOption => o !== null);
}

/** "$150" / "$149.50" — trailing ".00" dropped because most prices are whole. */
export function formatPriceCents(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars.toString() : dollars.toFixed(2)}`;
}

/**
 * How one unit of a choice is worded next to its price. "each" only reads
 * correctly for a countable thing, so an admin can override it per choice —
 * virtual staging is priced "per image", a large floor plan "per 1,000 sq ft".
 */
export function optionUnitLabel(option: Pick<CategoryOption, "unitLabel">): string {
  return option.unitLabel ?? "each";
}

/**
 * "$50 each" / "$50 per image" / "$25–$75 per image", or "" for a choice with
 * no figures at all. The bare "$50" form is used when neither a custom unit nor
 * a quantity picker gives the client anything to multiply.
 */
export function formatUnitPrice(option: CategoryOption): string {
  if (option.priceCents === null) {
    return "";
  }
  const price =
    option.priceMaxCents === null
      ? formatPriceCents(option.priceCents)
      : `${formatPriceCents(option.priceCents)}–${formatPriceCents(option.priceMaxCents)}`;
  if (option.unitLabel) {
    return `${price} ${option.unitLabel}`;
  }
  return option.maxQuantity > 1 ? `${price} each` : price;
}

/**
 * What a set of picks adds up to, split by whether the desk can start on it.
 *
 * The two halves answer different questions and must not be blended: `firmCents`
 * is money we can bill on submission, while the quoted band is an expectation we
 * still have to confirm. `unquotedCount` is the choices carrying no figures at
 * all — they belong to the quoted half but cannot move its numbers, so a total
 * built from this has to say "and more to price" rather than imply the band is
 * the whole story.
 */
export type EstimateBreakdown = {
  /** Firm-priced lines: billable now, work can start. */
  firmCents: number;
  /** Low end of the ranged lines, 0 when none carry figures. */
  quotedLowCents: number;
  /** High end of the ranged lines, 0 when none carry figures. */
  quotedHighCents: number;
  /** Quote-required lines with no figures to contribute. */
  unquotedCount: number;
  /** True when anything picked has to be quoted and accepted first. */
  needsQuote: boolean;
  /** True when nothing picked carries a price at all. */
  empty: boolean;
};

/** Add up already-resolved lines. Callers supply price × quantity per line. */
export function summarizeEstimate(
  lines: Array<{ option: CategoryOption; quantity: number }>,
): EstimateBreakdown {
  let firmCents = 0;
  let quotedLowCents = 0;
  let quotedHighCents = 0;
  let unquotedCount = 0;
  let needsQuote = false;
  let priced = false;
  for (const { option, quantity } of lines) {
    if (option.quoteRequired) {
      needsQuote = true;
    }
    if (option.priceCents === null) {
      // A quote-required choice with no figures still has to be quoted; an
      // ordinary unpriced choice is simply not part of the money at all.
      if (option.quoteRequired) {
        unquotedCount += 1;
      }
      continue;
    }
    priced = true;
    const low = option.priceCents * quantity;
    if (option.quoteRequired) {
      quotedLowCents += low;
      quotedHighCents += (option.priceMaxCents ?? option.priceCents) * quantity;
    } else {
      firmCents += low;
    }
  }
  return {
    firmCents,
    quotedLowCents,
    quotedHighCents,
    unquotedCount,
    needsQuote,
    empty: !priced && unquotedCount === 0,
  };
}

/** "$150" or "$125–$225" — the whole estimate as one span, ignoring figure-less lines. */
export function formatEstimateRange(breakdown: EstimateBreakdown): string {
  const low = breakdown.firmCents + breakdown.quotedLowCents;
  const high = breakdown.firmCents + breakdown.quotedHighCents;
  return low === high
    ? formatPriceCents(low)
    : `${formatPriceCents(low)}–${formatPriceCents(high)}`;
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
    icon: isTicketIconKey(row.icon) ? row.icon : null,
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
        icon: c.icon,
        created_at: now,
        updated_at: now,
      })),
    )
    .execute();
}

/**
 * Give the seeded request types their icons on a database that predates them.
 *
 * The seed itself only runs on an empty table, so an existing install would
 * otherwise show four fallback marks until an admin picked each one by hand.
 * Only fills blanks — a chosen icon is never overwritten.
 */
export async function backfillSeedCategoryIcons(): Promise<void> {
  const db = getAdminDb();
  for (const [key, icon] of Object.entries(SEED_CATEGORY_ICONS)) {
    await db
      .updateTable("admin_ticket_categories")
      .set({ icon })
      .where("key", "=", key)
      .where("icon", "is", null)
      .execute();
  }
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
  extraOptions?: CategoryOptionInput[];
  extraPlaceholder?: string | null;
  detailsLabel?: string;
  detailsHint?: string | null;
  sortOrder?: number;
  active?: boolean;
  icon?: string | null;
};

/** Keep only an icon key we can draw; anything else stores as null. */
function normalizeIcon(raw: unknown): string | null {
  return isTicketIconKey(raw) ? raw : null;
}

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
      extra_options: JSON.stringify(normalizeOptions(params.extraOptions)),
      extra_placeholder: params.extraPlaceholder?.trim() || null,
      details_label: params.detailsLabel?.trim() || "Details",
      details_hint: params.detailsHint?.trim() || null,
      sort_order: params.sortOrder ?? (max?.m ?? -1) + 1,
      active: params.active === false ? 0 : 1,
      icon: normalizeIcon(params.icon),
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
  extraOptions?: CategoryOptionInput[];
  extraPlaceholder?: string | null;
  detailsLabel?: string;
  detailsHint?: string | null;
  sortOrder?: number;
  active?: boolean;
  icon?: string | null;
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
    updates.extra_options = JSON.stringify(normalizeOptions(params.extraOptions));
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
  if (params.icon !== undefined) {
    updates.icon = normalizeIcon(params.icon);
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
