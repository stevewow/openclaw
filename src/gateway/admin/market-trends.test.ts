import { describe, expect, it } from "vitest";
import { ALL_REGIONS } from "./focus-regions.js";
import {
  type AreaInput,
  buildMarketReport,
  lagMonths,
  MARKET_REGIONS,
  METRIC_ORDER,
  type MarketPoint,
  parseMarketTrends,
  parseMetricNumber,
  regionsMissingQuery,
  rollingChange,
} from "./market-trends.js";

/** Monthly points newest-first, the way the feed sends them. */
function points(values: number[], startYear = 2026, startMonth = 5): unknown[] {
  return values.map((value, i) => {
    const m = startMonth - i;
    const year = startYear + Math.floor((m - 1) / 12);
    const month = ((((m - 1) % 12) + 12) % 12) + 1;
    return { date: `${year}-${String(month).padStart(2, "0")}-28`, value: String(value) };
  });
}

function metric(label: string, value: string, values: number[]): unknown {
  return { label, value, aggregateData: points(values) };
}

describe("parseMetricNumber", () => {
  it("strips the formatting the feed mixes in", () => {
    expect(parseMetricNumber("$289,827")).toBe(289827);
    expect(parseMetricNumber("98.6%")).toBe(98.6);
    expect(parseMetricNumber("0.9857410668")).toBeCloseTo(0.98574, 5);
    expect(parseMetricNumber("870")).toBe(870);
  });

  it("refuses junk rather than coercing it to zero", () => {
    for (const bad of ["", "  ", "n/a", "--", null, undefined, {}, Number.NaN]) {
      expect(parseMetricNumber(bad)).toBeNull();
    }
  });

  it("takes a real number as-is", () => {
    expect(parseMetricNumber(42)).toBe(42);
    expect(parseMetricNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("parseMarketTrends", () => {
  // The national feed files Days on Market under "supply" while the regional
  // one files it under "overview" — matching by label across every section is
  // the whole reason this does not model sections at all.
  const nationalish = {
    regionName: "United States",
    sections: [
      {
        section: "overview",
        metrics: [metric("# of Homes Sold", "308,446", [300, 290])],
      },
      {
        section: "supply",
        metrics: [
          metric("Median Days on Market", "49", [49, 46]),
          metric("# of Newly Listed Homes", "396,181", [396, 380]),
        ],
      },
    ],
  };

  it("finds a metric whichever section it was filed under", () => {
    const p = parseMarketTrends(nationalish);
    const keys = p.metrics.map((m) => m.key);
    expect(keys).toContain("daysOnMarket");
    expect(keys).toContain("homesSold");
    expect(keys).toContain("newlyListed");
    expect(p.resolvedName).toBe("United States");
  });

  it("returns metrics in catalog order, not payload order", () => {
    const p = parseMarketTrends(nationalish);
    const keys = p.metrics.map((m) => m.key);
    const expected = METRIC_ORDER.filter((k) => keys.includes(k));
    expect(keys).toEqual(expected);
  });

  it("keeps Redfin's formatted value and its own year-over-year note", () => {
    const raw = {
      sections: [
        {
          section: "overview",
          metrics: [
            {
              label: "Median Sale Price",
              value: "$289,827",
              aggregateData: [{ date: "2026-05-31", value: "289827", yoy: "+5.4%" }],
            },
          ],
        },
      ],
    };
    const m = parseMarketTrends(raw).metrics[0];
    expect(m.display).toBe("$289,827");
    expect(m.latest).toBe(289827);
    expect(m.yoy).toBe("+5.4%");
  });

  it("reports the newest month it saw anywhere", () => {
    expect(parseMarketTrends(nationalish).dataThrough).toBe("2026-05-28");
  });

  it("orders points newest-first even if the feed does not", () => {
    const raw = {
      sections: [
        {
          section: "overview",
          metrics: [
            {
              label: "# of Homes Sold",
              value: "3",
              aggregateData: [
                { date: "2026-01-31", value: "1" },
                { date: "2026-03-31", value: "3" },
                { date: "2026-02-28", value: "2" },
              ],
            },
          ],
        },
      ],
    };
    expect(parseMarketTrends(raw).metrics[0].points.map((p: MarketPoint) => p.value)).toEqual([
      3, 2, 1,
    ]);
  });

  it("drops points missing a date or a usable number", () => {
    const raw = {
      sections: [
        {
          section: "overview",
          metrics: [
            {
              label: "# of Homes Sold",
              value: "1",
              aggregateData: [
                { date: "2026-03-31", value: "3" },
                { date: null, value: "9" },
                { date: "2026-01-31", value: "n/a" },
              ],
            },
          ],
        },
      ],
    };
    expect(parseMarketTrends(raw).metrics[0].points).toHaveLength(1);
  });

  it("ignores labels it does not know instead of inventing a metric", () => {
    const raw = {
      sections: [
        { section: "overview", metrics: [metric("Median Sale Price Per Sq Ft", "1", [1])] },
      ],
    };
    expect(parseMarketTrends(raw).metrics).toHaveLength(0);
  });

  it("survives a payload with nothing in it", () => {
    for (const bad of [null, undefined, {}, { sections: "nope" }, { sections: [null] }]) {
      const p = parseMarketTrends(bad);
      expect(p.metrics).toEqual([]);
      expect(p.dataThrough).toBeNull();
    }
  });
});

describe("rollingChange", () => {
  const p = (values: number[]): MarketPoint[] =>
    values.map((value, i) => ({ date: `2026-${String(24 - i).padStart(2, "0")}`, value }));

  it("sums a flow and reports the change against the prior year", () => {
    // 12 months of 10 against 12 months of 5 — double.
    const r = rollingChange(p([...Array(12).fill(10), ...Array(12).fill(5)]), "sum");
    expect(r).not.toBeNull();
    expect(r?.current).toBe(120);
    expect(r?.prior).toBe(60);
    expect(r?.changePct).toBeCloseTo(100, 6);
    expect(r?.mode).toBe("sum");
  });

  it("averages a level rather than summing it", () => {
    const r = rollingChange(p([...Array(12).fill(10), ...Array(12).fill(5)]), "average");
    expect(r?.current).toBe(10);
    expect(r?.prior).toBe(5);
    expect(r?.changePct).toBeCloseTo(100, 6);
  });

  it("refuses to compute without two full years", () => {
    expect(rollingChange(p(Array(23).fill(1)), "sum")).toBeNull();
    expect(rollingChange([], "sum")).toBeNull();
  });

  it("returns a null change rather than dividing by a zero prior year", () => {
    const r = rollingChange(p([...Array(12).fill(10), ...Array(12).fill(0)]), "sum");
    expect(r?.prior).toBe(0);
    expect(r?.changePct).toBeNull();
  });

  it("is steadier than a single month, which is the reason it exists", () => {
    // A market down ~10% on the year, but the newest month happens to be flat.
    const recent = [100, ...Array(11).fill(90)];
    const prior = Array(12).fill(100);
    const r = rollingChange(p([...recent, ...prior]), "sum");
    expect(r?.changePct).toBeLessThan(0);
    expect(r?.changePct).toBeGreaterThan(-15);
  });
});

describe("MARKET_REGIONS", () => {
  it("covers every region the business serves", () => {
    expect(MARKET_REGIONS.map((r) => r.key).toSorted()).toEqual([...ALL_REGIONS].toSorted());
    expect(regionsMissingQuery()).toEqual([]);
  });

  it("qualifies every query with a state, or the wrong city is resolved", () => {
    // A bare "Columbus" or "Charlotte" lands in the wrong state.
    for (const r of MARKET_REGIONS) {
      expect(r.query).toMatch(/, [A-Z]{2}$/);
    }
  });

  it("keeps Charlotte in North Carolina and Fort Wayne in Indiana", () => {
    const byKey = new Map(MARKET_REGIONS.map((r) => [r.key, r.query]));
    expect(byKey.get("charlotte")).toBe("Charlotte, NC");
    expect(byKey.get("fort wayne")).toBe("Fort Wayne, IN");
    expect(byKey.get("columbus")).toBe("Columbus, OH");
  });
});

describe("lagMonths", () => {
  it("counts whole months from the newest datum", () => {
    expect(lagMonths("2026-05-31", Date.parse("2026-08-05T00:00:00Z"))).toBe(3);
    expect(lagMonths("2026-08-31", Date.parse("2026-08-05T00:00:00Z"))).toBe(0);
  });

  it("never reports a negative lag when the feed runs ahead", () => {
    expect(lagMonths("2026-12-31", Date.parse("2026-08-05T00:00:00Z"))).toBe(0);
  });

  it("has no answer without a date", () => {
    expect(lagMonths(null, Date.now())).toBeNull();
    expect(lagMonths("not-a-date", Date.now())).toBeNull();
  });
});

describe("buildMarketReport", () => {
  const area = (key: string, sold: number[], err: string | null = null): AreaInput => ({
    key,
    label: key,
    query: key,
    parsed: err
      ? null
      : parseMarketTrends({
          regionName: key,
          sections: [{ section: "overview", metrics: [metric("# of Homes Sold", "1", sold)] }],
        }),
    error: err,
    fetchedAt: 1000,
  });

  // National flat at 100/mo; one region growing, one shrinking.
  const flat = [...Array(24).fill(100)];
  const growing = [...Array(12).fill(120), ...Array(12).fill(100)];
  const shrinking = [...Array(12).fill(80), ...Array(12).fill(100)];

  it("scores each region against the nation, not against zero", () => {
    const r = buildMarketReport({
      national: area("us", flat),
      regions: [area("up", growing), area("down", shrinking)],
      refreshedAt: 5,
      now: Date.parse("2026-08-05T00:00:00Z"),
    });
    const up = r.regions.find((x) => x.key === "up");
    const down = r.regions.find((x) => x.key === "down");
    expect(up?.vsNationalPct).toBeCloseTo(20, 4);
    expect(down?.vsNationalPct).toBeCloseTo(-20, 4);
  });

  it("does not score the nation against itself", () => {
    const r = buildMarketReport({
      national: area("us", flat),
      regions: [],
      refreshedAt: null,
      now: Date.now(),
    });
    expect(r.national?.vsNationalPct).toBeNull();
  });

  it("leaves the comparison null when there is no national figure to compare to", () => {
    const r = buildMarketReport({
      national: null,
      regions: [area("up", growing)],
      refreshedAt: null,
      now: Date.now(),
    });
    expect(r.regions[0].vsNationalPct).toBeNull();
  });

  it("keeps a failed region in the table with its reason", () => {
    // Dropping it would read as "no market here", which is the wrong conclusion.
    const r = buildMarketReport({
      national: area("us", flat),
      regions: [area("broken", [], "HTTP 502"), area("up", growing)],
      refreshedAt: null,
      now: Date.now(),
    });
    expect(r.regions).toHaveLength(2);
    const broken = r.regions.find((x) => x.key === "broken");
    expect(broken?.error).toBe("HTTP 502");
    expect(broken?.metrics).toEqual([]);
    expect(broken?.vsNationalPct).toBeNull();
  });

  it("reports the freshest month it has and how stale that is", () => {
    const r = buildMarketReport({
      national: area("us", flat),
      regions: [area("up", growing)],
      refreshedAt: 5,
      now: Date.parse("2026-08-05T00:00:00Z"),
    });
    expect(r.dataThrough).toBe("2026-05-28");
    expect(r.lagMonths).toBe(3);
    expect(r.refreshedAt).toBe(5);
  });
});
