import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Proves the rebuild that widens `CHECK(extra_field IN ('none','select','text'))`
// to admit 'multiselect'. The live table holds the admin's real request types
// and their form copy, so the rebuild must carry every row across intact — a
// dropped row is a request type that vanishes off the public form.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-extrafield-migrate-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

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

/** The categories table as it shipped before multiselect existed. */
function seedLegacyDb(dbPath: string): void {
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE admin_ticket_categories (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      short_label TEXT NOT NULL,
      extra_field TEXT NOT NULL DEFAULT 'none' CHECK(extra_field IN ('none','select','text')),
      extra_label TEXT,
      extra_options TEXT,
      extra_placeholder TEXT,
      details_label TEXT NOT NULL,
      details_hint TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  // Legacy options are bare strings — the shape before choices grew a price.
  db.exec(`
    INSERT INTO admin_ticket_categories
      (key, label, short_label, extra_field, extra_label, extra_options, extra_placeholder,
       details_label, details_hint, sort_order, active, created_at, updated_at)
    VALUES
      ('edit_request','Request an edit','Edit request','select','Which media?',
       '["Photos","Aerial / Drone"]',NULL,'What change?','Be specific.',0,1,1000,1000),
      ('retired_type','Old thing','Old','text','Which?',NULL,'e.g. something',
       'Details',NULL,7,0,2000,2500);
  `);
  db.close();
}

describe("widening the request-type extra_field CHECK", () => {
  it("rebuilds the table, keeps every request type, and admits multiselect", async () => {
    const dbPath = path.join(TMP_DIR, "admin.db");
    seedLegacyDb(dbPath);

    // Sanity: the legacy schema really does reject multiselect.
    const { DatabaseSync } = await import("node:sqlite");
    const legacy = new DatabaseSync(dbPath);
    expect(() =>
      legacy.exec(
        `INSERT INTO admin_ticket_categories
           (key,label,short_label,extra_field,details_label,created_at,updated_at)
         VALUES ('svc','Services','Services','multiselect','Details',1,1)`,
      ),
    ).toThrow();
    legacy.close();

    // The migration is lazy: it fires on the first getAdminDb(), not on import.
    const cats = await import("./ticket-category-store.js");
    const { getAdminDb } = await import("./user-store.js");
    getAdminDb();
    expect(schemaSqlFor(dbPath, "admin_ticket_categories")).toContain("'multiselect'");

    // Both rows survived, with their copy and their flags.
    const all = await cats.listCategories();
    expect(all.map((c) => c.key).toSorted()).toEqual(["edit_request", "retired_type"]);

    const edit = all.find((c) => c.key === "edit_request")!;
    expect(edit.extraField).toBe("select");
    expect(edit.extraLabel).toBe("Which media?");
    expect(edit.detailsHint).toBe("Be specific.");
    // Legacy bare-string options still read, now as structured choices.
    expect(edit.extraOptions).toEqual([
      {
        label: "Photos",
        imageUrl: null,
        priceCents: null,
        priceMaxCents: null,
        quoteRequired: false,
        unitLabel: null,
        maxQuantity: 1,
        followUps: [],
      },
      {
        label: "Aerial / Drone",
        imageUrl: null,
        priceCents: null,
        priceMaxCents: null,
        quoteRequired: false,
        unitLabel: null,
        maxQuantity: 1,
        followUps: [],
      },
    ]);

    // The retired one keeps being retired rather than coming back to the form.
    const retired = all.find((c) => c.key === "retired_type")!;
    expect(retired.active).toBe(false);
    expect(retired.sortOrder).toBe(7);
    expect(retired.updatedAt).toBe(2500);
    expect(await cats.listCategories({ activeOnly: true })).toHaveLength(1);

    // The whole point: a multiselect request type with priced choices now saves.
    const created = await cats.createCategory({
      label: "Add a service",
      extraField: "multiselect",
      extraLabel: "Which services?",
      extraOptions: [{ label: "Twilight", imageUrl: null, priceCents: 7500 }],
    });
    expect(created.extraField).toBe("multiselect");
    expect((await cats.getCategory(created.key))!.extraOptions[0].priceCents).toBe(7500);
  });

  it("leaves no half-finished rebuild table behind", () => {
    expect(schemaSqlFor(path.join(TMP_DIR, "admin.db"), "admin_ticket_categories_rebuild")).toBe(
      "",
    );
  });
});
