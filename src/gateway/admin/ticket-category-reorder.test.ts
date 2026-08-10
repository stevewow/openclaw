import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Request types had a sort_order the form already ordered by, but nothing could
// change it: new types landed at max + 1 and stayed in creation order forever.
// reorderCategories takes the whole key order and rewrites every row's index,
// so the order is always total — no ties, no gaps.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-cat-reorder-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const cats = await import("./ticket-category-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

const SEEDED = ["edit_request", "additional_service", "missing_media", "other"];

beforeAll(async () => {
  await cats.ensureCategorySeed();
});

/** The key order the public form would render, straight from the store. */
async function formOrder(): Promise<string[]> {
  return (await cats.listCategories()).map((c) => c.key);
}

describe("reordering request types", () => {
  it("applies the given order and reports it back", async () => {
    const wanted = ["other", "missing_media", "edit_request", "additional_service"];
    const returned = await cats.reorderCategories(wanted);

    expect(returned.map((c) => c.key)).toEqual(wanted);
    expect(await formOrder()).toEqual(wanted);
  });

  it("numbers the rows 0..n-1 so the order can never tie", async () => {
    await cats.reorderCategories(SEEDED);
    const list = await cats.listCategories();
    expect(list.map((c) => c.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it("survives a round trip back to the original order", async () => {
    await cats.reorderCategories(SEEDED.toReversed());
    await cats.reorderCategories(SEEDED);
    expect(await formOrder()).toEqual(SEEDED);
  });

  it("keeps categories the caller left out instead of dropping them", async () => {
    await cats.reorderCategories(SEEDED);
    // Name only the last one; the other three must survive, in their old order.
    const returned = await cats.reorderCategories(["other"]);

    expect(returned.map((c) => c.key)).toEqual([
      "other",
      "edit_request",
      "additional_service",
      "missing_media",
    ]);
    expect(returned).toHaveLength(SEEDED.length);
  });

  it("ignores unknown keys rather than inventing rows for them", async () => {
    await cats.reorderCategories(SEEDED);
    const returned = await cats.reorderCategories(["ghost_type", "other", "edit_request"]);

    expect(returned.map((c) => c.key)).not.toContain("ghost_type");
    expect(returned).toHaveLength(SEEDED.length);
    expect(returned.map((c) => c.key).slice(0, 2)).toEqual(["other", "edit_request"]);
  });

  it("ignores a repeated key instead of double-placing it", async () => {
    const returned = await cats.reorderCategories(["other", "other", "edit_request"]);
    expect(returned.filter((c) => c.key === "other")).toHaveLength(1);
    expect(returned).toHaveLength(SEEDED.length);
  });

  it("places a newly added type last, then lets it be moved to the top", async () => {
    await cats.reorderCategories(SEEDED);
    const added = await cats.createCategory({ label: "Reshoot request" });
    expect((await formOrder()).at(-1)).toBe(added.key);

    await cats.reorderCategories([added.key, ...SEEDED]);
    expect((await formOrder())[0]).toBe(added.key);

    // Leave the table as we found it for any later case.
    await cats.removeCategory(added.key);
  });

  it("orders the public (active-only) form the same way", async () => {
    await cats.reorderCategories(["missing_media", "other", "edit_request", "additional_service"]);
    const active = await cats.listCategories({ activeOnly: true });
    expect(active.map((c) => c.key)).toEqual([
      "missing_media",
      "other",
      "edit_request",
      "additional_service",
    ]);
  });
});
