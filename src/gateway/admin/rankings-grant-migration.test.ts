import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// The combined "Agent & Company Rankings" report became two reports with two
// grants. Splitting a report must not quietly take access away from anyone who
// already had it, so the old grant has to expand into both new ones.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-rankings-grant-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

/** Grant the legacy permission directly, as a database written before the split has it. */
function seedLegacyGrant(dbPath: string, userId: string): void {
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_user_permissions (
      user_id TEXT NOT NULL,
      permission_type TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, permission_type, value)
    );
  `);
  db.prepare(
    "INSERT OR IGNORE INTO admin_user_permissions (user_id, permission_type, value) VALUES (?, 'report', ?)",
  ).run(userId, "rankings");
  // An unrelated grant, to prove the migration is surgical.
  db.prepare(
    "INSERT OR IGNORE INTO admin_user_permissions (user_id, permission_type, value) VALUES (?, 'report', ?)",
  ).run(userId, "photographers");
  db.close();
}

describe("the rankings split migration", () => {
  it("expands an existing rankings grant into both new reports", async () => {
    const dbPath = path.join(TMP_DIR, "admin.db");
    seedLegacyGrant(dbPath, "user-1");

    const userStore = await import("./user-store.js");
    userStore.getAdminDb(); // opening the database runs the migrations

    const values = (await userStore.getUserPermissions("user-1"))
      .filter((p) => p.permissionType === "report")
      .map((p) => p.value)
      .toSorted();
    expect(values).toEqual(["photographers", "rankings-agents", "rankings-companies"]);
    // The retired key does not linger — it grants nothing now.
    expect(values).not.toContain("rankings");
  });
});
