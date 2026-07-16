import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Proves the rebuild that drops `CHECK(category IN (...))` from admin_tickets.
// Two things must hold: admin-defined categories become insertable, and nothing
// is lost — admin_ticket_events references admin_tickets ON DELETE CASCADE, so a
// rebuild with foreign keys left ON would silently wipe every activity thread.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-migrate-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

/** Build the pre-migration schema (the shape shipped before categories were managed). */
function seedLegacyDb(dbPath: string): void {
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(`
    CREATE TABLE admin_users (id TEXT PRIMARY KEY, username TEXT);
    CREATE TABLE admin_tickets (
      id TEXT PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      reply_token TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('edit_request','additional_service','missing_media','other')),
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','needs_review','resolved','closed')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('widget','email','manual')),
      subject TEXT NOT NULL,
      description TEXT,
      department TEXT NOT NULL DEFAULT 'general',
      requester_name TEXT,
      requester_email TEXT,
      requester_phone TEXT,
      order_id TEXT,
      order_address TEXT,
      assigned_to TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
    CREATE TABLE admin_ticket_events (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES admin_tickets(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('created','comment','status_change','assignment','email_out','email_in')),
      author_type TEXT NOT NULL CHECK(author_type IN ('client','staff','system')),
      author_name TEXT,
      body TEXT,
      meta TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  db.exec(`
    INSERT INTO admin_tickets (id, number, reply_token, category, status, subject, department, created_at, updated_at, resolved_at)
    VALUES ('t1','WVT-9001','wvt-9001','edit_request','resolved','Brighten kitchen','editing',1000,2000,5000);
  `);
  db.exec(`
    INSERT INTO admin_ticket_events (id, ticket_id, kind, author_type, author_name, body, created_at)
    VALUES ('e1','t1','created','client','Dana','opened',1000),
           ('e2','t1','email_in','staff','edits@wow.co','RESOLVED done',4000);
  `);
  db.close();
}

describe("dropping the legacy category CHECK constraint", () => {
  it("rebuilds the table, keeps tickets and their events, and accepts custom categories", async () => {
    const dbPath = path.join(TMP_DIR, "admin.db");
    seedLegacyDb(dbPath);

    // Sanity: the legacy schema really does reject a custom category.
    const { DatabaseSync } = await import("node:sqlite");
    const legacy = new DatabaseSync(dbPath);
    expect(() =>
      legacy.exec(
        `INSERT INTO admin_tickets (id,number,reply_token,category,subject,created_at,updated_at)
         VALUES ('t2','WVT-1002','wvt-1002','address_change','x',1,1)`,
      ),
    ).toThrow();
    legacy.close();

    // getAdminDb() runs initSchema, which runs the migration.
    const { getAdminDb } = await import("./user-store.js");
    const db = getAdminDb();

    const sql = (await db
      .selectFrom("sqlite_master" as never)
      .select("sql" as never)
      .where("name" as never, "=", "admin_tickets")
      .executeTakeFirst()) as { sql: string } | undefined;
    expect(sql?.sql).not.toContain("CHECK(category IN");

    // The ticket survived, with every column intact.
    const ticket = await db
      .selectFrom("admin_tickets")
      .selectAll()
      .where("id", "=", "t1")
      .executeTakeFirst();
    expect(ticket).toBeTruthy();
    expect(ticket!.category).toBe("edit_request");
    expect(ticket!.status).toBe("resolved");
    expect(ticket!.resolved_at).toBe(5000);

    // The activity thread survived: FK cascade did not fire during the rebuild.
    const events = await db
      .selectFrom("admin_ticket_events")
      .selectAll()
      .where("ticket_id", "=", "t1")
      .execute();
    expect(events.map((e) => e.id).toSorted()).toEqual(["e1", "e2"]);

    // The whole point: an admin-defined category now inserts.
    const store = await import("./ticket-store.js");
    const created = await store.createTicket({ category: "address_change", subject: "Wrong st" });
    expect(created.category).toBe("address_change");

    // And the events FK still works against the rebuilt table.
    await store.addTicketEvent(created.id, {
      kind: "comment",
      authorType: "staff",
      authorName: "me",
      body: "on it",
    });
    const after = await store.listTicketEvents(created.id);
    expect(after.some((e) => e.body === "on it")).toBe(true);
  });
});
