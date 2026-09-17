// What one person, rather than the company, has chosen about a page.
//
// Deliberately generic and deliberately tiny: a key and a string value per
// user. The first caller is the sales dashboard, where Joy works Charlotte and
// should not have to pick it out of a dropdown every morning, but nothing here
// knows that. A preference is a convenience, never a permission — what a user
// may see is decided by their grants, and a stale or missing preference must
// always fall back to the page's own default rather than to an error.
//
// Stored server-side rather than in localStorage because a default that lives
// in one browser is not a default: it is a setting the same person loses on
// their phone, on a second machine, and every time the cache is cleared.

import { getAdminDb } from "./user-store.js";

/** The keys in use. A closed set so a typo cannot quietly create a new one. */
export type UserPrefKey = "sales.defaultMarket" | "sales.metric" | "sales.expanded";

const PREF_KEYS: readonly UserPrefKey[] = ["sales.defaultMarket", "sales.metric", "sales.expanded"];

/** Long enough for a market key or a short choice, short enough to be safe. */
const MAX_VALUE_LENGTH = 200;

export function isUserPrefKey(value: unknown): value is UserPrefKey {
  return typeof value === "string" && (PREF_KEYS as readonly string[]).includes(value);
}

/** Every preference this user has set, as a plain object for the page to read. */
export async function getUserPrefs(userId: string): Promise<Partial<Record<UserPrefKey, string>>> {
  const rows = await getAdminDb()
    .selectFrom("admin_user_prefs")
    .select(["key", "value"])
    .where("user_id", "=", userId)
    .execute();
  const out: Partial<Record<UserPrefKey, string>> = {};
  for (const row of rows) {
    if (isUserPrefKey(row.key)) {
      out[row.key] = row.value;
    }
  }
  return out;
}

/**
 * Set one preference, or clear it.
 *
 * An empty value removes the row rather than storing a blank, so "no default"
 * and "a default that happens to be empty" cannot drift apart.
 */
export async function setUserPref(
  userId: string,
  key: UserPrefKey,
  value: string | null,
): Promise<void> {
  const db = getAdminDb();
  const trimmed = value?.trim().slice(0, MAX_VALUE_LENGTH) ?? "";
  if (!trimmed) {
    await db
      .deleteFrom("admin_user_prefs")
      .where("user_id", "=", userId)
      .where("key", "=", key)
      .execute();
    return;
  }
  const now = Date.now();
  await db
    .insertInto("admin_user_prefs")
    .values({ user_id: userId, key, value: trimmed, updated_at: now })
    .onConflict((oc) =>
      oc.columns(["user_id", "key"]).doUpdateSet({ value: trimmed, updated_at: now }),
    )
    .execute();
}
