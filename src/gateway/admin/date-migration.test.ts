import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrateDueDatesOffMidnight } from "./user-store.js";

/**
 * Dates written before the local-noon fix sit at UTC midnight, which every
 * day-binning surface reads as the previous day west of Greenwich. The
 * migration lifts them to midday; these cases pin which rows it touches, and
 * — just as important — which it leaves alone.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOON = 12 * 60 * 60 * 1000;
/** 2026-08-06T00:00:00Z — exactly what `new Date('2026-08-06')` used to yield. */
const AUG6_UTC_MIDNIGHT = Date.UTC(2026, 7, 6);

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE admin_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);
    CREATE TABLE admin_tasks (id TEXT PRIMARY KEY, due_date INTEGER);
    CREATE TABLE admin_projects (id TEXT PRIMARY KEY, start_date INTEGER, end_date INTEGER);
  `);
  return db;
}

const dueDates = (db: DatabaseSync) =>
  (
    db.prepare("SELECT id, due_date FROM admin_tasks ORDER BY id").all() as Array<{
      id: string;
      due_date: number | null;
    }>
  ).map((r) => [r.id, r.due_date] as const);

describe("migrateDueDatesOffMidnight", () => {
  it("lifts a UTC-midnight due date to midday, keeping its calendar day", () => {
    const db = freshDb();
    db.prepare("INSERT INTO admin_tasks (id, due_date) VALUES (?, ?)").run("t1", AUG6_UTC_MIDNIGHT);
    migrateDueDatesOffMidnight(db);
    const [[, moved]] = dueDates(db);
    expect(moved).toBe(AUG6_UTC_MIDNIGHT + NOON);
    // The whole point: still the 6th, and now nowhere near a midnight boundary.
    expect(new Date(moved as number).toISOString()).toBe("2026-08-06T12:00:00.000Z");
  });

  it("moves project start and end dates too", () => {
    const db = freshDb();
    db.prepare("INSERT INTO admin_projects (id, start_date, end_date) VALUES (?, ?, ?)").run(
      "p1",
      AUG6_UTC_MIDNIGHT,
      AUG6_UTC_MIDNIGHT + 7 * DAY,
    );
    migrateDueDatesOffMidnight(db);
    const row = db.prepare("SELECT start_date, end_date FROM admin_projects").get() as {
      start_date: number;
      end_date: number;
    };
    expect(row.start_date).toBe(AUG6_UTC_MIDNIGHT + NOON);
    expect(row.end_date).toBe(AUG6_UTC_MIDNIGHT + 7 * DAY + NOON);
  });

  it("leaves nulls and already-migrated rows alone", () => {
    const db = freshDb();
    const insert = db.prepare("INSERT INTO admin_tasks (id, due_date) VALUES (?, ?)");
    insert.run("t-null", null);
    // A row the new save path wrote: local noon, never on a midnight boundary.
    insert.run("t-noon", AUG6_UTC_MIDNIGHT + 16 * 60 * 60 * 1000);
    insert.run("t-old", AUG6_UTC_MIDNIGHT);
    migrateDueDatesOffMidnight(db);
    expect(dueDates(db)).toEqual([
      ["t-noon", AUG6_UTC_MIDNIGHT + 16 * 60 * 60 * 1000],
      ["t-null", null],
      ["t-old", AUG6_UTC_MIDNIGHT + NOON],
    ]);
  });

  it("runs once, so a second boot does not shift the same row twice", () => {
    const db = freshDb();
    db.prepare("INSERT INTO admin_tasks (id, due_date) VALUES (?, ?)").run("t1", AUG6_UTC_MIDNIGHT);
    migrateDueDatesOffMidnight(db);
    migrateDueDatesOffMidnight(db);
    migrateDueDatesOffMidnight(db);
    expect(dueDates(db)).toEqual([["t1", AUG6_UTC_MIDNIGHT + NOON]]);
  });

  it("is idempotent even if the marker is lost, because noon never re-matches", () => {
    const db = freshDb();
    db.prepare("INSERT INTO admin_tasks (id, due_date) VALUES (?, ?)").run("t1", AUG6_UTC_MIDNIGHT);
    migrateDueDatesOffMidnight(db);
    db.exec("DELETE FROM admin_migrations");
    migrateDueDatesOffMidnight(db);
    expect(dueDates(db)).toEqual([["t1", AUG6_UTC_MIDNIGHT + NOON]]);
  });
});
