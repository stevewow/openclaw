import { getAdminDb } from "./user-store.js";

// Support departments + per-category routing, managed from the dashboard instead
// of hardcoded/env config. A department is the desk a ticket is assigned to and
// (once email is on) the address it's emailed to. Category routing decides which
// department a new ticket lands in by default. Seeded once with the original
// defaults so behavior is unchanged until an admin edits the table.

export type Department = {
  key: string;
  label: string;
  email: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

const TICKET_CATEGORIES = ["edit_request", "additional_service", "missing_media", "other"] as const;
type TicketCategory = (typeof TICKET_CATEGORIES)[number];

// Last-resort routing for the seeded four, used before seeding runs and by unit
// tests that don't seed. It is not a default an admin can land on: every request
// type must name its department when it is created, so a live category always
// has an explicit row here.
const FALLBACK_ROUTE: Record<TicketCategory, string> = {
  edit_request: "editing",
  additional_service: "operations",
  missing_media: "operations",
  other: "general",
};

const SEED_DEPARTMENTS: Array<{ key: string; label: string }> = [
  { key: "editing", label: "Editing" },
  { key: "operations", label: "Operations" },
  { key: "billing", label: "Billing" },
  { key: "general", label: "General" },
];

type DepartmentRow = {
  key: string;
  label: string;
  email: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

function rowToDepartment(row: DepartmentRow): Department {
  return {
    key: row.key,
    label: row.label,
    email: row.email,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Slugify a label into a stable department key (lowercase, alnum + dashes). */
export function departmentKeyFromLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "dept"
  );
}

let seeded = false;
/** Populate the defaults once if the table is empty. Idempotent. */
export async function ensureDepartmentSeed(): Promise<void> {
  if (seeded) return;
  seeded = true;
  const db = getAdminDb();
  const existing = await db.selectFrom("admin_ticket_departments").select("key").executeTakeFirst();
  if (existing) return;
  const now = Date.now();
  await db
    .insertInto("admin_ticket_departments")
    .values(
      SEED_DEPARTMENTS.map((d, i) => ({
        key: d.key,
        label: d.label,
        email: null,
        sort_order: i,
        created_at: now,
        updated_at: now,
      })),
    )
    .execute();
  await db
    .insertInto("admin_ticket_category_routes")
    .values(TICKET_CATEGORIES.map((c) => ({ category: c, department_key: FALLBACK_ROUTE[c] })))
    .execute();
}

export async function listDepartments(): Promise<Department[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_ticket_departments")
    .selectAll()
    .orderBy("sort_order", "asc")
    .orderBy("label", "asc")
    .execute();
  return rows.map(rowToDepartment);
}

export async function getDepartment(key: string): Promise<Department | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_ticket_departments")
    .selectAll()
    .where("key", "=", key)
    .executeTakeFirst();
  return row ? rowToDepartment(row) : null;
}

export type CreateDepartmentParams = {
  key?: string;
  label: string;
  email?: string | null;
  sortOrder?: number;
};

export async function createDepartment(params: CreateDepartmentParams): Promise<Department> {
  const db = getAdminDb();
  const key = (params.key?.trim() || departmentKeyFromLabel(params.label)).toLowerCase();
  const now = Date.now();
  const max = await db
    .selectFrom("admin_ticket_departments")
    .select((eb) => eb.fn.max("sort_order").as("m"))
    .executeTakeFirst();
  await db
    .insertInto("admin_ticket_departments")
    .values({
      key,
      label: params.label.trim(),
      email: params.email?.trim() || null,
      sort_order: params.sortOrder ?? Number(max?.m ?? -1) + 1,
      created_at: now,
      updated_at: now,
    })
    .execute();
  return (await getDepartment(key))!;
}

export type UpdateDepartmentParams = {
  label?: string;
  email?: string | null;
  sortOrder?: number;
};

export async function updateDepartment(
  key: string,
  params: UpdateDepartmentParams,
): Promise<Department | null> {
  const db = getAdminDb();
  const updates: Record<string, unknown> = { updated_at: Date.now() };
  if (params.label !== undefined) updates.label = params.label.trim();
  if (params.email !== undefined) updates.email = params.email?.trim() || null;
  if (params.sortOrder !== undefined) updates.sort_order = params.sortOrder;
  await db.updateTable("admin_ticket_departments").set(updates).where("key", "=", key).execute();
  return getDepartment(key);
}

export async function deleteDepartment(key: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_ticket_departments").where("key", "=", key).execute();
  // Repoint any category routed here back to the fallback so routing stays valid.
  await db
    .updateTable("admin_ticket_category_routes")
    .set({ department_key: "general" })
    .where("department_key", "=", key)
    .execute();
}

export async function getCategoryRoutes(): Promise<Record<string, string>> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_ticket_category_routes")
    .select(["category", "department_key"])
    .execute();
  const out: Record<string, string> = {};
  for (const r of rows) out[r.category] = r.department_key;
  return out;
}

/**
 * Point a category at a department. Categories are admin-managed, so any key is
 * accepted — validating against a fixed list here silently dropped routes for
 * admin-added categories.
 */
export async function setCategoryRoute(category: string, departmentKey: string): Promise<void> {
  const db = getAdminDb();
  const existing = await db
    .selectFrom("admin_ticket_category_routes")
    .select("category")
    .where("category", "=", category)
    .executeTakeFirst();
  if (existing) {
    await db
      .updateTable("admin_ticket_category_routes")
      .set({ department_key: departmentKey })
      .where("category", "=", category)
      .execute();
  } else {
    await db
      .insertInto("admin_ticket_category_routes")
      .values({ category, department_key: departmentKey })
      .execute();
  }
}

/** The department a new ticket in this category should land in. */
export async function resolveDepartmentForCategory(category: string): Promise<string> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_ticket_category_routes")
    .select("department_key")
    .where("category", "=", category)
    .executeTakeFirst();
  if (row?.department_key) return row.department_key;
  return FALLBACK_ROUTE[category as TicketCategory] ?? "general";
}

/** The email address for a department key, or null when unset/unknown. */
export async function getDepartmentEmail(key: string): Promise<string | null> {
  const dept = await getDepartment(key);
  return dept?.email ?? null;
}
