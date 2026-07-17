import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-photog-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./spiro-photographers-store.js");
const { getAdminDb } = await import("./user-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

async function seed() {
  const db = getAdminDb();
  await db
    .insertInto("admin_spiro_photographers")
    .values([
      {
        photographer_id: "p1",
        name: "Amy Ames",
        markets: JSON.stringify(["Dayton, Ohio"]),
        active: 1,
        cached_at: 1,
      },
      {
        photographer_id: "p2",
        name: "Bob Brown",
        markets: JSON.stringify(["Toledo", "Lima"]),
        active: 0,
        cached_at: 1,
      },
      { photographer_id: "p3", name: "Cara Cole", markets: "[]", active: 1, cached_at: 1 },
    ])
    .execute();
  await db
    .insertInto("admin_spiro_photographer_shoots")
    .values([
      { photographer_id: "p1", month: "2025-01", shoots: 5 },
      { photographer_id: "p1", month: "2025-02", shoots: 7 },
      { photographer_id: "p1", month: "2025-03", shoots: 3 }, // out of range below
      { photographer_id: "p2", month: "2025-02", shoots: 20 },
    ])
    .execute();
  await db
    .insertInto("admin_spiro_photographer_refresh_log")
    .values({ id: "photographers", refreshed_at: 123, manual: 0 })
    .execute();
}

describe("last12Months", () => {
  it("returns 12 ascending YYYY-MM ending at the current month", () => {
    const months = store.last12Months(Date.UTC(2025, 5, 15)); // June 2025
    expect(months.length).toBe(12);
    expect(months[11]).toBe("2025-06");
    expect(months[0]).toBe("2024-07");
    expect(months.toSorted()).toEqual(months);
  });
});

describe("getPhotographersReport", () => {
  it("sums shoots within the range, parses markets, and sorts busiest-first", async () => {
    await seed();
    const report = await store.getPhotographersReport({ from: "2025-01", to: "2025-02" });
    expect(report.refreshedAt).toBe(123);
    // p2 (20) > p1 (5+7=12, March excluded) > p3 (0)
    expect(report.rows.map((r) => r.photographerId)).toEqual(["p2", "p1", "p3"]);
    const p1 = report.rows.find((r) => r.photographerId === "p1")!;
    expect(p1.shoots).toBe(12);
    expect(p1.markets).toEqual(["Dayton, Ohio"]);
    expect(p1.active).toBe(true);
    const p2 = report.rows.find((r) => r.photographerId === "p2")!;
    expect(p2.markets).toEqual(["Toledo", "Lima"]);
    expect(p2.active).toBe(false);
    // p3 has no shoot rows → 0, still listed
    expect(report.rows.find((r) => r.photographerId === "p3")!.shoots).toBe(0);
  });
});
