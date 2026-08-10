import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// A database written before folders existed already has `admin_resources`, so
// the CREATE TABLE that carries `folder_id` is a no-op there and the column
// arrives by ALTER instead. Anything that touches `folder_id` before that ALTER
// throws and aborts the rest of initSchema, leaving every later migration
// unapplied — which is how the live library and reports broke while a fresh
// database looked fine.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-resource-folder-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

/** Write the tables in their pre-folder shape, as a database due for upgrade has them. */
function seedPreFolderDb(dbPath: string): void {
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_resources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('link','file')),
      url TEXT,
      filename TEXT,
      stored_filename TEXT,
      mimetype TEXT,
      filesize INTEGER,
      tags TEXT NOT NULL DEFAULT '[]',
      ai_access INTEGER NOT NULL DEFAULT 1,
      user_access INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_spiro_orders (
      id TEXT PRIMARY KEY,
      month TEXT,
      client TEXT,
      market TEXT,
      status TEXT,
      cached_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS admin_user_permissions (
      user_id TEXT NOT NULL,
      permission_type TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, permission_type, value)
    );
  `);
  db.prepare(
    "INSERT OR IGNORE INTO admin_user_permissions (user_id, permission_type, value) VALUES (?, 'report', ?)",
  ).run("user-1", "rankings");
  db.prepare(
    "INSERT INTO admin_resources (id, title, type, url, created_at, updated_at) VALUES (?, ?, 'link', ?, 1, 1)",
  ).run("res-1", "Existing resource", "https://example.com");
  db.close();
}

function columnsOf(dbPath: string, table: string): string[] {
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
    (c) => c.name,
  );
  db.close();
  return cols;
}

describe("upgrading a pre-folder database", () => {
  it("adds folder_id and still runs the migrations that follow it", async () => {
    const dbPath = path.join(TMP_DIR, "admin.db");
    seedPreFolderDb(dbPath);

    const userStore = await import("./user-store.js");
    userStore.getAdminDb(); // opening the database runs the migrations

    // The column the resource library queries.
    expect(columnsOf(dbPath, "admin_resources")).toContain("folder_id");

    // Migrations sequenced *after* the folder work: an abort earlier in
    // initSchema silently skipped these, which is what broke the reports.
    expect(columnsOf(dbPath, "admin_spiro_orders")).toEqual(
      expect.arrayContaining(["agent_id", "company_id"]),
    );
    const values = (await userStore.getUserPermissions("user-1"))
      .filter((p) => p.permissionType === "report")
      .map((p) => p.value)
      .toSorted();
    expect(values).toEqual(["rankings-agents", "rankings-companies"]);

    // The existing row survives the upgrade unchanged.
    const resources = await userStore
      .getAdminDb()
      .selectFrom("admin_resources")
      .selectAll()
      .execute();
    expect(resources).toHaveLength(1);
    expect(resources[0]?.folder_id).toBeNull();
  });
});
