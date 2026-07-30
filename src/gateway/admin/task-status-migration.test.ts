import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";

/**
 * The status CHECK removal rebuilds admin_tasks in place on databases that
 * already hold real work. admin_task_assignees and admin_task_events both
 * cascade off it and admin_tasks references itself for subtasks, so a rebuild
 * with foreign keys left on would silently delete every assignment, comment
 * thread and subtask.
 *
 * These cases build a pre-migration database by hand, run the real store
 * against it, and check that nothing was lost — the failure mode is data loss
 * on someone's live board, which no amount of after-the-fact testing undoes.
 */

/**
 * A realistic pre-migration database: let the real store build the current
 * schema, then put the old CHECK back on admin_tasks and fill every table that
 * cascades off it. Hand-writing the whole schema would drift from the real one.
 */
async function makeLegacyDb(dir: string): Promise<string> {
  const store = await openThroughStore(dir);
  await store.listUsers();
  const file = path.join(dir, "admin.db");

  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys=OFF");
  db.exec(`
    BEGIN;
    CREATE TABLE admin_tasks_legacy (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES admin_projects(id) ON DELETE CASCADE,
      parent_task_id TEXT REFERENCES admin_tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','review','done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      due_date INTEGER,
      assigned_to TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      position INTEGER NOT NULL DEFAULT 0,
      recurrence TEXT CHECK(recurrence IN ('daily','weekly','monthly','yearly')),
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    DROP TABLE admin_tasks;
    ALTER TABLE admin_tasks_legacy RENAME TO admin_tasks;
    -- Undo the marker so the seeder and rebuild both run again on reopen.
    DELETE FROM admin_migrations WHERE id = 'default_task_statuses_v1';
    DELETE FROM admin_task_statuses;
    COMMIT;
  `);
  db.exec("PRAGMA foreign_keys=ON");

  db.prepare(
    "INSERT INTO admin_users (id, username, password_hash, role, created_at, updated_at) VALUES (?,?,?,?,?,?)",
  ).run("u1", "steve", "x", "admin", 1, 1);
  db.prepare(
    "INSERT INTO admin_projects (id, title, status, color, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
  ).run("p1", "Shoots", "active", "#c0000a", "[]", 1, 1);
  const insertTask = db.prepare(
    `INSERT INTO admin_tasks (id, project_id, parent_task_id, title, description, status,
       priority, due_date, assigned_to, tags, position, recurrence, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertTask.run(
    "t1",
    "p1",
    null,
    "Parent",
    "desc",
    "review",
    "high",
    1700,
    null,
    '["a"]',
    3,
    "weekly",
    "u1",
    1,
    2,
  );
  insertTask.run(
    "t2",
    "p1",
    "t1",
    "Subtask",
    null,
    "todo",
    "low",
    null,
    null,
    "[]",
    0,
    null,
    "u1",
    1,
    2,
  );
  db.prepare("INSERT INTO admin_task_assignees (task_id, user_id) VALUES (?, ?)").run("t1", "u1");
  db.prepare(
    `INSERT INTO admin_task_events (id, task_id, kind, body, meta, mentions, author_id, author_name, created_at, edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("e1", "t1", "comment", "Waiting on the floor plan.", null, "[]", "u1", "steve", 10, null);
  db.close();
  return file;
}

async function openThroughStore(dir: string) {
  process.env.OPENCLAW_STATE_DIR = dir;
  // Fresh module registry per case so the DB singleton re-initialises against
  // this directory and runs the migration on open.
  vi.resetModules();
  return import("./user-store.js");
}

describe("task status CHECK removal", () => {
  it("frees the column while keeping every task, subtask, assignee and comment", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-status-mig-"));
    const file = await makeLegacyDb(dir);

    const store = await openThroughStore(dir);
    // Touching the DB triggers schema init + migrations.
    await store.listUsers();

    const db = new DatabaseSync(file, { readOnly: true });
    const schema = (
      db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_tasks'")
        .get() as { sql?: string } | undefined
    )?.sql;
    expect(schema).not.toContain("CHECK(status IN");
    // The other constraints must survive the rebuild.
    expect(schema).toContain("CHECK(priority IN");
    expect(schema).toContain("CHECK(recurrence IN");

    const tasks = db
      .prepare(
        "SELECT id, status, priority, recurrence, parent_task_id, tags, position FROM admin_tasks ORDER BY id",
      )
      .all() as Array<Record<string, unknown>>;
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      id: "t1",
      status: "review",
      priority: "high",
      recurrence: "weekly",
      tags: '["a"]',
      position: 3,
    });
    // The subtask link is the self-reference that a careless rebuild drops.
    expect(tasks[1]).toMatchObject({ id: "t2", parent_task_id: "t1" });

    // The two cascading children are the real hazard.
    expect(db.prepare("SELECT COUNT(*) c FROM admin_task_assignees").get()).toMatchObject({ c: 1 });
    expect(db.prepare("SELECT COUNT(*) c FROM admin_task_events").get()).toMatchObject({ c: 1 });
    expect(db.prepare("SELECT body FROM admin_task_events WHERE id='e1'").get()).toMatchObject({
      body: "Waiting on the floor plan.",
    });

    // Foreign keys must be back on afterwards, not left disabled.
    expect(db.prepare("PRAGMA foreign_keys").get()).toBeDefined();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("accepts a status the old constraint rejected, once migrated", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-status-mig2-"));
    const file = await makeLegacyDb(dir);
    const store = await openThroughStore(dir);
    await store.listUsers();

    const db = new DatabaseSync(file);
    expect(() =>
      db
        .prepare(
          `INSERT INTO admin_tasks (id, title, status, priority, tags, position, created_at, updated_at)
           VALUES ('t9', 'Custom', 'delivered', 'medium', '[]', 0, 1, 1)`,
        )
        .run(),
    ).not.toThrow();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("is a no-op on a database that has already been freed", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-status-mig3-"));
    await makeLegacyDb(dir);
    const store = await openThroughStore(dir);
    await store.listUsers();
    // Second open must not rebuild again or disturb the rows.
    const store2 = await openThroughStore(dir);
    await store2.listUsers();
    const db = new DatabaseSync(path.join(dir, "admin.db"), { readOnly: true });
    expect(db.prepare("SELECT COUNT(*) c FROM admin_tasks").get()).toMatchObject({ c: 2 });
    expect(db.prepare("SELECT COUNT(*) c FROM admin_task_events").get()).toMatchObject({ c: 1 });
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
