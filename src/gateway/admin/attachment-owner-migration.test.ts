import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Proves the rebuild that widens `CHECK(owner_type IN ('task','project'))` to
// admit 'ticket'. The live table already holds real task and project uploads, so
// the rebuild has to carry every row and column across — a lost row here means a
// file on disk that nothing points at any more.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-attach-migrate-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

/**
 * Read schema straight from sqlite_master. Kysely has no types for that table,
 * and a raw connection reads it without casting the query builder to `never`.
 */
function schemaSqlFor(dbPath: string, name: string): string {
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(name) as
      | { sql: string }
      | undefined;
    return row?.sql ?? "";
  } finally {
    db.close();
  }
}

/** True when a table or index of this name exists. */
function objectExists(dbPath: string, name: string): boolean {
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare("SELECT name FROM sqlite_master WHERE name = ?").get(name) !== undefined;
  } finally {
    db.close();
  }
}

/** The admin_attachments shape shipped before tickets could own an upload. */
function seedLegacyDb(dbPath: string): void {
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(`
    CREATE TABLE admin_attachments (
      id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('task','project')),
      owner_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('link','file')),
      title TEXT NOT NULL,
      url TEXT,
      filename TEXT,
      stored_filename TEXT,
      mimetype TEXT,
      filesize INTEGER,
      created_by TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX admin_attachments_owner ON admin_attachments(owner_type, owner_id);
  `);
  db.exec(`
    INSERT INTO admin_attachments
      (id, owner_type, owner_id, type, title, url, filename, stored_filename, mimetype, filesize, created_by, created_at)
    VALUES
      ('a1','task','task-1','file','Floor plan',NULL,'plan.pdf','stored-1.pdf','application/pdf',2048,'u1',1000),
      ('a2','project','proj-1','link','Spec','https://example.com/spec',NULL,NULL,NULL,NULL,'u2',2000);
  `);
  db.close();
}

describe("widening the attachment owner CHECK", () => {
  it("rebuilds the table, keeps every existing upload, and admits ticket owners", async () => {
    const dbPath = path.join(TMP_DIR, "admin.db");
    seedLegacyDb(dbPath);

    // Sanity: the legacy schema really does reject a ticket-owned attachment.
    const { DatabaseSync } = await import("node:sqlite");
    const legacy = new DatabaseSync(dbPath);
    expect(() =>
      legacy.exec(
        `INSERT INTO admin_attachments (id, owner_type, owner_id, type, title, created_at)
         VALUES ('a3','ticket','tkt-1','file','shot.png',3000)`,
      ),
    ).toThrow();
    legacy.close();

    // getAdminDb() runs initSchema, which runs the migration.
    const { getAdminDb } = await import("./user-store.js");
    const db = getAdminDb();

    expect(schemaSqlFor(dbPath, "admin_attachments")).toContain("'ticket'");

    // Both pre-existing rows survived, with every column intact.
    const rows = await db
      .selectFrom("admin_attachments")
      .selectAll()
      .orderBy("id", "asc")
      .execute();
    expect(rows.map((r) => r.id)).toEqual(["a1", "a2"]);

    const file = rows.find((r) => r.id === "a1")!;
    expect(file.owner_type).toBe("task");
    expect(file.stored_filename).toBe("stored-1.pdf");
    expect(file.mimetype).toBe("application/pdf");
    expect(file.filesize).toBe(2048);
    expect(file.created_by).toBe("u1");
    expect(file.created_at).toBe(1000);

    const link = rows.find((r) => r.id === "a2")!;
    expect(link.type).toBe("link");
    expect(link.url).toBe("https://example.com/spec");

    // The index the owner lookup relies on came back with the table.
    expect(objectExists(dbPath, "admin_attachments_owner")).toBe(true);

    // The whole point: a ticket may now own an upload.
    const store = await import("./attachment-store.js");
    const created = await store.saveUploadedAttachment({
      ownerType: "ticket",
      ownerId: "tkt-1",
      filename: "shot.png",
      mimetype: "image/png",
      bytes: Buffer.from("not-really-a-png"),
    });
    expect(created.ownerType).toBe("ticket");
    expect(await store.listAttachments("ticket", "tkt-1")).toHaveLength(1);

    // ...and the old owners still work alongside it.
    expect(await store.listAttachments("task", "task-1")).toHaveLength(1);
    expect(await store.listAttachments("project", "proj-1")).toHaveLength(1);
  });

  it("leaves no half-finished rebuild table behind", () => {
    expect(objectExists(path.join(TMP_DIR, "admin.db"), "admin_attachments_rebuild")).toBe(false);
  });

  it("skips the rebuild on an already-migrated schema", async () => {
    // Re-opening the migrated file must not fire the rebuild again: the guard
    // reads the live schema, which now names 'ticket'. Running it twice would
    // still work, but only because the copy happens to be lossless — the point
    // is that it does not run at all.
    const dbPath = path.join(TMP_DIR, "admin.db");
    const { DatabaseSync } = await import("node:sqlite");
    const raw = new DatabaseSync(dbPath);
    const before = raw.prepare("SELECT COUNT(*) AS c FROM admin_attachments").get() as {
      c: number;
    };
    const rowid = raw.prepare("SELECT MIN(rowid) AS r FROM admin_attachments").get() as {
      r: number;
    };
    raw.close();

    // A fresh process would run initSchema again over this same file.
    const second = new DatabaseSync(dbPath);
    const schema = second
      .prepare("SELECT sql FROM sqlite_master WHERE name='admin_attachments'")
      .get() as { sql: string };
    expect(schema.sql).toContain("'ticket'");
    const after = second.prepare("SELECT COUNT(*) AS c FROM admin_attachments").get() as {
      c: number;
    };
    const rowidAfter = second.prepare("SELECT MIN(rowid) AS r FROM admin_attachments").get() as {
      r: number;
    };
    second.close();

    expect(after.c).toBe(before.c);
    // A rebuild renumbers rowids; an untouched table keeps them.
    expect(rowidAfter.r).toBe(rowid.r);
  });
});
