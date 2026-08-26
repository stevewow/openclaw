import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { matchTerritory, seedTerritories, territoryKeyFromLabel } from "./lead-territories.js";

/** A stored row, minus the timestamps the matcher does not read. */
function territory(over: Partial<import("./lead-territories.js").LeadTerritory>) {
  return {
    key: "columbus",
    label: "Columbus",
    aliases: [],
    ownerName: "Chris Voge",
    ownerEmail: "chris@example.com",
    active: true,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe("the seeded routing book", () => {
  it("covers every region the sales reports know", () => {
    const keys = seedTerritories().map((t) => t.key);
    expect(keys.toSorted()).toEqual([
      "charlotte",
      "cincinnati",
      "columbus",
      "dayton",
      "findlay",
      "fort-wayne",
      "lima",
      "toledo",
    ]);
  });

  it("hands the two split cities to the owner of the top of those books", () => {
    const seeded = seedTerritories();
    expect(seeded.find((t) => t.key === "columbus")?.owner).toBe("Chris Voge");
    expect(seeded.find((t) => t.key === "dayton")?.owner).toBe("Chris Voge");
  });

  it("keeps the sole owners the Focus report already names", () => {
    const byKey = new Map(seedTerritories().map((t) => [t.key, t.owner]));
    expect(byKey.get("cincinnati")).toBe("Pam Branam");
    expect(byKey.get("lima")).toBe("Ryan Bowersock");
    expect(byKey.get("fort-wayne")).toBe("Chris Voge");
  });

  it("titles the labels a website visitor would recognize", () => {
    expect(seedTerritories().find((t) => t.key === "fort-wayne")?.label).toBe("Fort Wayne");
  });
});

describe("matching a market to a territory", () => {
  const book = [
    territory({}),
    territory({ key: "fort-wayne", label: "Fort Wayne", ownerName: "Chris Voge" }),
    territory({ key: "lima", label: "Lima", ownerName: "Ryan Bowersock" }),
  ];

  it("folds spellings of the same place onto one key", () => {
    expect(territoryKeyFromLabel("Columbus, Ohio")).toBe("columbus");
    expect(territoryKeyFromLabel("columbus")).toBe("columbus");
    expect(territoryKeyFromLabel("Fort Wayne")).toBe("fort-wayne");
  });

  it("matches the market a dropdown sent", () => {
    expect(matchTerritory(book, "Columbus")?.key).toBe("columbus");
    expect(matchTerritory(book, "Fort Wayne, Indiana")?.key).toBe("fort-wayne");
  });

  it("matches an alias an admin added for the site's own wording", () => {
    const withAlias = [territory({ aliases: ["Central Ohio"] })];
    expect(matchTerritory(withAlias, "Central Ohio")?.key).toBe("columbus");
  });

  it("finds a market named inside a longer answer", () => {
    expect(matchTerritory(book, "Greater Columbus area")?.key).toBe("columbus");
  });

  it("does not match a market whose name is only part of another word", () => {
    expect(matchTerritory(book, "climate controlled storage")).toBeNull();
  });

  it("refuses to choose when an answer names two markets", () => {
    expect(matchTerritory(book, "Columbus and Lima")).toBeNull();
  });

  it("ignores a paused market", () => {
    expect(matchTerritory([territory({ active: false })], "Columbus")).toBeNull();
  });

  it("answers nothing for an empty market rather than guessing", () => {
    expect(matchTerritory(book, "")).toBeNull();
    expect(matchTerritory(book, null)).toBeNull();
  });
});

describe("the stored routing table", () => {
  let tmpDir: string;
  let store: typeof import("./lead-territories.js");

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lead-territory-test-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    store = await import("./lead-territories.js");
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("seeds the book once, with no addresses guessed", async () => {
    await store.ensureTerritorySeed();
    const rows = await store.listTerritories();
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => r.ownerEmail === null)).toBe(true);
    expect(rows.find((r) => r.key === "columbus")?.ownerName).toBe("Chris Voge");
  });

  it("takes an address and then routes to it", async () => {
    await store.updateTerritory("columbus", { ownerEmail: "Chris@Example.com " });
    const resolved = await store.resolveLeadOwner("Columbus, Ohio");
    expect(resolved.territory?.key).toBe("columbus");
    expect(resolved.ownerName).toBe("Chris Voge");
    // Lower-cased on the way in, so two spellings of one desk are one address.
    expect(resolved.ownerEmail).toBe("chris@example.com");
  });

  it("answers nobody for a market it does not have", async () => {
    const resolved = await store.resolveLeadOwner("Nashville");
    expect(resolved.territory).toBeNull();
    expect(resolved.ownerEmail).toBeNull();
  });

  it("adds a market and refuses to add it twice", async () => {
    const created = await store.createTerritory({
      label: "Indianapolis",
      ownerName: "Joy Kiser",
      ownerEmail: "joy@example.com",
      aliases: ["Indy"],
    });
    expect(created.key).toBe("indianapolis");
    expect((await store.resolveLeadOwner("Indy")).ownerEmail).toBe("joy@example.com");
    await expect(store.createTerritory({ label: "Indianapolis" })).rejects.toThrow(
      "territory_exists",
    );
  });
});
