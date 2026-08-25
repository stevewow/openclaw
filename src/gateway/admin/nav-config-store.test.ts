import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { navCatalogItems } from "./nav-catalog.js";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-nav-config-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./nav-config-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("resolving a saved arrangement against the catalog", () => {
  it("ships the default order when nothing has been saved", () => {
    const resolved = store.resolveNavConfig("admin", null);
    expect(resolved.items.map((i) => i.id)).toEqual(navCatalogItems("admin").map((i) => i.id));
    expect(resolved.groups[0]?.id).toBe("main");
    expect(resolved.items.every((i) => !i.hidden)).toBe(true);
  });

  it("keeps a saved order and appends sections added since it was saved", () => {
    // A layout saved before "Navigation" or "Feedback" existed: the two it
    // names stay where they were put, and everything else still appears.
    const resolved = store.resolveNavConfig("admin", {
      groups: [{ id: "main", label: "Main", collapsible: false }],
      items: [
        { id: "users", label: "People", icon: "🧑", group: "main", hidden: false },
        { id: "dashboard", label: "", icon: "", group: "main", hidden: true },
      ],
    });
    expect(resolved.items[0]?.id).toBe("users");
    expect(resolved.items[0]?.label).toBe("People");
    expect(resolved.items[1]?.id).toBe("dashboard");
    // Empty label/icon means "no override": the catalog's own text comes back.
    expect(resolved.items[1]?.label).toBe("Dashboard");
    expect(resolved.items[1]?.hidden).toBe(true);
    const ids = resolved.items.map((i) => i.id);
    for (const item of navCatalogItems("admin")) {
      expect(ids).toContain(item.id);
    }
  });

  it("drops a saved section that no longer ships", () => {
    const resolved = store.resolveNavConfig("admin", {
      groups: [{ id: "main", label: "Main", collapsible: false }],
      items: [{ id: "retired-page", label: "Gone", icon: "x", group: "main", hidden: false }],
    });
    expect(resolved.items.map((i) => i.id)).not.toContain("retired-page");
  });

  it("rehomes a section whose group was deleted instead of losing it", () => {
    const resolved = store.resolveNavConfig("admin", {
      groups: [{ id: "only", label: "Only", collapsible: true }],
      items: [{ id: "users", label: "", icon: "", group: "deleted-group", hidden: false }],
    });
    expect(resolved.items.find((i) => i.id === "users")?.group).toBe("only");
    // Every appended catalog item lands somewhere real too.
    expect(resolved.items.every((i) => i.group === "only")).toBe(true);
  });

  it("keeps the two surfaces' catalogs apart", () => {
    const portal = store.resolveNavConfig("portal", null);
    expect(portal.items.map((i) => i.id)).toEqual([
      "chat",
      "tasks",
      "reports",
      "resources",
      "account",
    ]);
    // The portal has no Users page, so an admin item saved against it is dropped.
    const bogus = store.resolveNavConfig("portal", {
      groups: [{ id: "main", label: "", collapsible: false }],
      items: [{ id: "users", label: "", icon: "", group: "main", hidden: false }],
    });
    expect(bogus.items.map((i) => i.id)).not.toContain("users");
  });
});

describe("parsing an untrusted layout", () => {
  it("accepts a well-formed body and fills the optional fields", () => {
    const parsed = store.parseNavConfig({
      groups: [{ id: "main" }],
      items: [{ id: "users", group: "main" }],
    });
    expect(parsed?.groups[0]).toEqual({ id: "main", label: "", collapsible: false });
    expect(parsed?.items[0]).toEqual({
      id: "users",
      label: "",
      icon: "",
      group: "main",
      hidden: false,
    });
  });

  it("refuses a body that is not a layout at all", () => {
    expect(store.parseNavConfig(null)).toBeNull();
    expect(store.parseNavConfig("main")).toBeNull();
    expect(store.parseNavConfig({ groups: [{ label: "no id" }], items: [] })).toBeNull();
  });
});

describe("saving and reading back", () => {
  it("round-trips a layout, and reset returns the shipped order", async () => {
    const saved = await store.setNavConfig(
      "admin",
      {
        groups: [
          { id: "ops", label: "Operations", collapsible: true },
          { id: "rest", label: "", collapsible: false },
        ],
        items: [{ id: "tickets", label: "Queue", icon: "🎫", group: "ops", hidden: false }],
      },
      "user-1",
    );
    expect(saved.items[0]?.id).toBe("tickets");
    expect(saved.items[0]?.label).toBe("Queue");
    expect(saved.groups[0]?.collapsible).toBe(true);

    const read = await store.getNavConfig("admin");
    expect(read.items[0]?.label).toBe("Queue");
    expect(read.groups.map((g) => g.id)).toEqual(["ops", "rest"]);

    const after = await store.resetNavConfig("admin");
    expect(after.items.map((i) => i.id)).toEqual(navCatalogItems("admin").map((i) => i.id));
    expect((await store.getNavConfig("admin")).groups.map((g) => g.id)).toEqual([
      "main",
      "workspace",
      "support",
      "financials",
      "settings",
    ]);
  });

  it("falls back to the default sidebar when the stored row is unreadable", async () => {
    const { getAdminDb } = await import("./user-store.js");
    await getAdminDb()
      .insertInto("admin_nav_config")
      .values({ surface: "portal", config: "{not json", updated_at: 1, updated_by: null })
      .onConflict((oc) => oc.column("surface").doUpdateSet({ config: "{not json" }))
      .execute();
    const read = await store.getNavConfig("portal");
    expect(read.items.map((i) => i.id)).toEqual(navCatalogItems("portal").map((i) => i.id));
  });
});
