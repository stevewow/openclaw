import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-cat-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const cats = await import("./ticket-category-store.js");
const dept = await import("./ticket-department-store.js");
const store = await import("./ticket-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("category seeding", () => {
  it("seeds the original four with their form copy intact, idempotently", async () => {
    await cats.ensureCategorySeed();
    await cats.ensureCategorySeed(); // second call must not duplicate
    const list = await cats.listCategories();
    expect(list.map((c) => c.key)).toEqual([
      "edit_request",
      "additional_service",
      "missing_media",
      "other",
    ]);

    // The seed must reproduce the pre-managed form exactly.
    const edit = list.find((c) => c.key === "edit_request")!;
    expect(edit.shortLabel).toBe("Edit request");
    expect(edit.extraField).toBe("select");
    expect(edit.extraLabel).toBe("Which media?");
    expect(edit.extraOptions).toContain("Aerial / Drone");
    expect(edit.detailsLabel).toBe("What change would you like?");

    const service = list.find((c) => c.key === "additional_service")!;
    expect(service.extraField).toBe("text");
    expect(service.extraPlaceholder).toContain("Virtual staging");

    const other = list.find((c) => c.key === "other")!;
    expect(other.extraField).toBe("none");
    expect(other.shortLabel).toBe("Support request");
  });
});

describe("admin-defined categories", () => {
  it("accepts a brand-new category and files tickets under it", async () => {
    // The exact case that the old CHECK constraint rejected outright.
    const created = await cats.createCategory({
      label: "Change the property address",
      shortLabel: "Address change",
      extraField: "none",
      detailsLabel: "What should the address say?",
    });
    expect(created.key).toBe("change_the_property_address");
    expect(created.active).toBe(true);

    await dept.ensureDepartmentSeed();
    await dept.setCategoryRoute(created.key, "operations");

    const ticket = await store.createTicket({
      category: created.key,
      subject: "Address is wrong",
    });
    expect(ticket.category).toBe("change_the_property_address");
    // Proves setCategoryRoute no longer silently drops unknown categories.
    expect(ticket.department).toBe("operations");
  });

  it("slugs labels into stable keys", () => {
    expect(cats.categoryKeyFromLabel("Re-shoot / Twilight!")).toBe("re_shoot_twilight");
  });

  it("only offers active categories to the form", async () => {
    const temp = await cats.createCategory({ label: "Seasonal promo" });
    expect(await cats.isSubmittableCategory(temp.key)).toBe(true);
    await cats.updateCategory(temp.key, { active: false });
    expect(await cats.isSubmittableCategory(temp.key)).toBe(false);
    const active = await cats.listCategories({ activeOnly: true });
    expect(active.map((c) => c.key)).not.toContain(temp.key);
    // Still listed for filtering historical tickets.
    expect((await cats.listCategories()).map((c) => c.key)).toContain(temp.key);
  });
});

describe("removing a category", () => {
  it("hard-deletes when unused", async () => {
    const unused = await cats.createCategory({ label: "Never used" });
    const result = await cats.removeCategory(unused.key);
    expect(result.outcome).toBe("deleted");
    expect(await cats.getCategory(unused.key)).toBeNull();
  });

  it("deactivates instead of deleting when tickets reference it, keeping history", async () => {
    const used = await cats.createCategory({ label: "Drone re-fly" });
    const ticket = await store.createTicket({ category: used.key, subject: "re-fly please" });

    const result = await cats.removeCategory(used.key);
    expect(result).toEqual({ outcome: "deactivated", ticketCount: 1 });

    // The category survives (so the label resolves) but leaves the form.
    const still = await cats.getCategory(used.key);
    expect(still).toBeTruthy();
    expect(still!.active).toBe(false);
    expect(await cats.getCategoryShortLabel(used.key)).toBe("Drone re-fly");

    // The historical ticket keeps its real category, not a rewritten "other".
    const reloaded = await store.getTicket(ticket.id);
    expect(reloaded!.category).toBe(used.key);
  });

  it("reports not_found for an unknown key", async () => {
    expect(await cats.removeCategory("nope")).toEqual({ outcome: "not_found" });
  });
});
