import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-market-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./market-store.js");
const { MARKET_REGIONS } = await import("./market-trends.js");
const userStore = await import("./user-store.js");

/** Month `i` back from 2026-05, as the feed's `YYYY-MM-DD`. */
function monthBack(i: number): string {
  const m = 5 - i;
  const year = 2026 + Math.floor((m - 1) / 12);
  const month = ((((m - 1) % 12) + 12) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-28`;
}

/** A payload shaped like the feed's, with two years of homes-sold points. */
function payload(name: string, sold: number[]): unknown {
  return {
    regionName: name,
    sections: [
      {
        section: "overview",
        metrics: [
          {
            label: "# of Homes Sold",
            value: String(sold[0] ?? 0),
            // Newest first, one month apart, starting 2026-05.
            aggregateData: sold.map((value, i) => ({
              date: monthBack(i),
              value: String(value),
            })),
          },
        ],
      },
    ],
  };
}

const flat24 = Array(24).fill(100) as number[];

async function clearSnapshots(): Promise<void> {
  await userStore.getAdminDb().deleteFrom("admin_market_snapshots").execute();
}

beforeEach(async () => {
  await clearSnapshots();
  delete process.env.REALTYAPI_KEY;
});

describe("marketApiKey", () => {
  it("treats blank and absent alike", () => {
    expect(store.marketApiKey({})).toBeNull();
    expect(store.marketApiKey({ REALTYAPI_KEY: "   " })).toBeNull();
    expect(store.marketApiKey({ REALTYAPI_KEY: " k " })).toBe("k");
    expect(store.isMarketConfigured({})).toBe(false);
    expect(store.isMarketConfigured({ REALTYAPI_KEY: "k" })).toBe(true);
  });
});

describe("marketAreas", () => {
  it("leads with the nation, then every region the business serves", () => {
    const areas = store.marketAreas();
    expect(areas[0].key).toBe("national");
    // The national endpoint takes no location, so it carries no query.
    expect(areas[0].query).toBe("");
    expect(areas.slice(1).map((a) => a.key)).toEqual(MARKET_REGIONS.map((r) => r.key));
    expect(areas).toHaveLength(MARKET_REGIONS.length + 1);
  });
});

describe("refreshMarketData", () => {
  it("caches every area and reports how many landed", async () => {
    const seen: string[] = [];
    const result = await store.refreshMarketData({
      fetchArea: async (area) => {
        seen.push(area.key);
        return payload(area.key, flat24);
      },
      now: () => 1000,
    });
    expect(result.refreshed).toBe(store.marketAreas().length);
    expect(result.failed).toBe(0);
    expect(seen).toEqual(store.marketAreas().map((a) => a.key));
  });

  it("keeps sweeping when one area fails, and records why", async () => {
    // A region timing out must not cost us the other eight.
    const result = await store.refreshMarketData({
      fetchArea: async (area) => {
        if (area.key === "lima") {
          throw new Error("Upstream returned HTTP 502.");
        }
        return payload(area.key, flat24);
      },
      now: () => 1000,
    });
    expect(result.failed).toBe(1);
    expect(result.refreshed).toBe(store.marketAreas().length - 1);
    expect(result.errors).toEqual([{ area: "lima", error: "Upstream returned HTTP 502." }]);

    const report = await store.getMarketReport(1000);
    const lima = report.regions.find((r) => r.key === "lima");
    expect(lima?.error).toBe("Upstream returned HTTP 502.");
    // The other regions still carry data.
    expect(report.regions.filter((r) => r.metrics.length > 0).length).toBe(
      MARKET_REGIONS.length - 1,
    );
  });

  it("stops the sweep on a credit failure instead of burning it eight more times", async () => {
    let calls = 0;
    const result = await store.refreshMarketData({
      fetchArea: async () => {
        calls += 1;
        throw new Error("Out of RealtyAPI credits for this plan period.");
      },
      now: () => 1000,
    });
    expect(calls).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.refreshed).toBe(0);
  });

  it("stops on a rejected key too", async () => {
    let calls = 0;
    await store.refreshMarketData({
      fetchArea: async () => {
        calls += 1;
        throw new Error("RealtyAPI rejected the key.");
      },
      now: () => 1000,
    });
    expect(calls).toBe(1);
  });

  it("replaces a cached area rather than accumulating rows", async () => {
    const deps = (value: number, now: number) => ({
      fetchArea: async (area: { key: string; query: string }) =>
        payload(area.key, Array(24).fill(value)),
      now: () => now,
    });
    await store.refreshMarketData(deps(100, 1000));
    await store.refreshMarketData(deps(200, 2000));
    const rows = await userStore
      .getAdminDb()
      .selectFrom("admin_market_snapshots")
      .select(["area_key", "fetched_at"])
      .execute();
    expect(rows).toHaveLength(store.marketAreas().length);
    expect(rows.every((r) => r.fetched_at === 2000)).toBe(true);
  });

  it("clears a stale error when the area comes back", async () => {
    let broken = true;
    const deps = {
      fetchArea: async (area: { key: string; query: string }) => {
        if (broken && area.key === "lima") {
          throw new Error("Upstream returned HTTP 502.");
        }
        return payload(area.key, flat24);
      },
      now: () => 1000,
    };
    await store.refreshMarketData(deps);
    broken = false;
    await store.refreshMarketData(deps);
    const report = await store.getMarketReport(1000);
    expect(report.regions.find((r) => r.key === "lima")?.error).toBeNull();
  });

  it("refuses to sweep live without a key", async () => {
    await expect(store.refreshMarketData()).rejects.toThrow(store.MarketKeyMissingError);
  });
});

describe("getMarketReport", () => {
  it("says nothing has ever been refreshed rather than showing an empty market", async () => {
    const report = await store.getMarketReport(1000);
    expect(report.neverRefreshed).toBe(true);
    expect(report.stale).toBe(true);
    expect(report.national).toBeNull();
    // Regions still appear, so the page lists the footprint it cannot yet fill.
    expect(report.regions).toHaveLength(MARKET_REGIONS.length);
    expect(report.regions.every((r) => r.error === "Not refreshed yet.")).toBe(true);
  });

  it("scores each region against the nation", async () => {
    await store.refreshMarketData({
      fetchArea: async (area) =>
        payload(
          area.key,
          area.key === "lima"
            ? [...Array(12).fill(80), ...Array(12).fill(100)]
            : Array(24).fill(100),
        ),
      now: () => 1000,
    });
    const report = await store.getMarketReport(1000);
    expect(report.national?.vsNationalPct).toBeNull();
    expect(report.regions.find((r) => r.key === "lima")?.vsNationalPct).toBeCloseTo(-20, 4);
    expect(report.regions.find((r) => r.key === "toledo")?.vsNationalPct).toBeCloseTo(0, 4);
  });

  it("goes stale a week out, and reports when it was pulled", async () => {
    await store.refreshMarketData({
      fetchArea: async (area) => payload(area.key, flat24),
      now: () => 1000,
    });
    const fresh = await store.getMarketReport(1000 + store.MARKET_STALE_MS - 1);
    expect(fresh.stale).toBe(false);
    expect(fresh.neverRefreshed).toBe(false);
    expect(fresh.refreshedAt).toBe(1000);
    const old = await store.getMarketReport(1000 + store.MARKET_STALE_MS + 1);
    expect(old.stale).toBe(true);
  });

  it("reports a cache it cannot parse as a cache problem, not a market one", async () => {
    await store.refreshMarketData({
      fetchArea: async (area) => payload(area.key, flat24),
      now: () => 1000,
    });
    await userStore
      .getAdminDb()
      .updateTable("admin_market_snapshots")
      .set({ payload: "{not json" })
      .where("area_key", "=", "lima")
      .execute();
    const report = await store.getMarketReport(1000);
    expect(report.regions.find((r) => r.key === "lima")?.error).toMatch(/Refresh/);
  });

  it("tells the UI whether a refresh could even work", async () => {
    expect((await store.getMarketReport(1000)).configured).toBe(false);
    process.env.REALTYAPI_KEY = "k";
    expect((await store.getMarketReport(1000)).configured).toBe(true);
  });
});
