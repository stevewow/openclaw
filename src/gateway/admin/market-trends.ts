// Housing-market trends for the national market and the regions we serve.
//
// Redfin publishes a monthly series, not a live feed: the newest point trails
// the current month by roughly two, so every figure here is dated on purpose
// and the report leads with how stale it is.
//
// The point of the report is to give order volume a denominator. When a
// region's shoots fall, the order history alone cannot say whether the market
// fell with it or whether we lost share — those are opposite problems with
// opposite responses, and this is the only thing that separates them.
//
// Pure module: parsing and arithmetic only, no fetching. The store owns I/O.

import { ALL_REGIONS } from "./focus-regions.js";

// ── Metric catalog ──────────────────────────────────────────────────────────

export type MarketMetricKey =
  | "medianSalePrice"
  | "homesSold"
  | "daysOnMarket"
  | "saleToList"
  | "aboveList"
  | "priceDrops"
  | "homesForSale"
  | "newlyListed"
  | "monthsOfSupply"
  | "mortgageRate";

/** How a value should be rendered. The feed sends bare numbers and ratios. */
export type MarketMetricFormat = "money" | "count" | "days" | "percent" | "months";

/**
 * Which direction is good for a real-estate media business. Mostly obvious,
 * but two are not: a longer time on market means fewer transactions per year
 * even though each listing lingers, so shorter is better; and months of supply
 * is left neutral because a thin market starves us of listings while a glutted
 * one means sellers who cannot afford us.
 */
export type MarketMetricDirection = "up" | "down" | "neutral";

type MetricDef = {
  key: MarketMetricKey;
  /** Redfin's own labels. The national and regional feeds word these alike. */
  labels: string[];
  label: string;
  format: MarketMetricFormat;
  /**
   * How twelve months reduce to one figure. Events counted during a month add
   * up; a median price, a rate, or a month-end stock does not.
   */
  reduce: "sum" | "average";
  direction: MarketMetricDirection;
  /** Why this matters to us, shown in the UI so a number is never bare. */
  note: string;
};

const METRIC_DEFS: MetricDef[] = [
  {
    key: "homesSold",
    labels: ["# of Homes Sold"],
    label: "Homes Sold",
    format: "count",
    reduce: "sum",
    direction: "up",
    note: "The addressable market. Every sale was a listing somebody had to market.",
  },
  {
    key: "newlyListed",
    labels: ["# of Newly Listed Homes"],
    label: "Newly Listed",
    format: "count",
    reduce: "sum",
    direction: "up",
    note: "New listings are where shoots come from — the closest thing to a demand signal.",
  },
  {
    key: "homesForSale",
    labels: ["# of Homes for Sale"],
    label: "Homes for Sale",
    format: "count",
    reduce: "average",
    direction: "up",
    note: "Standing inventory. A month-end stock, so averaged over the year rather than summed.",
  },
  {
    key: "daysOnMarket",
    labels: ["Median Days on Market"],
    label: "Days on Market",
    format: "days",
    reduce: "average",
    direction: "down",
    note: "Rising DOM means listings are sitting: fewer transactions, and agents under pressure to market harder.",
  },
  {
    key: "medianSalePrice",
    labels: ["Median Sale Price"],
    label: "Median Sale Price",
    format: "money",
    reduce: "average",
    direction: "up",
    note: "What the market will bear, and so which package tier fits it.",
  },
  {
    key: "priceDrops",
    labels: ["Homes with Price Drops"],
    label: "Price Drops",
    format: "percent",
    reduce: "average",
    direction: "down",
    note: "Sellers missing their number. Rising drops precede relists, and relists need fresh media.",
  },
  {
    key: "saleToList",
    labels: ["Sale-to-List Price"],
    label: "Sale-to-List",
    format: "percent",
    reduce: "average",
    direction: "up",
    note: "How close sellers get to asking. A market-heat read.",
  },
  {
    key: "aboveList",
    labels: ["Homes Sold Above List Price"],
    label: "Sold Above List",
    format: "percent",
    reduce: "average",
    direction: "up",
    note: "Bidding-war share. Falls first when a market cools.",
  },
  {
    key: "monthsOfSupply",
    labels: ["Months of Supply"],
    label: "Months of Supply",
    format: "months",
    reduce: "average",
    direction: "neutral",
    note: "Under ~4 is a seller's market, over ~6 a buyer's. Neither end is straightforwardly good for us.",
  },
  {
    key: "mortgageRate",
    labels: ["National Avg. 30-Year Fixed Mortgage Rate"],
    label: "Mortgage Rate",
    format: "percent",
    reduce: "average",
    direction: "down",
    note: "The upstream driver of transaction volume — it moves before our order count does.",
  },
];

const DEF_BY_LABEL = new Map<string, MetricDef>(
  METRIC_DEFS.flatMap((def) => def.labels.map((l) => [l.toLowerCase(), def] as const)),
);

export function metricDef(key: MarketMetricKey): MetricDef | null {
  return METRIC_DEFS.find((d) => d.key === key) ?? null;
}

/** Catalog order, so every region's table reads the same way. */
export const METRIC_ORDER: MarketMetricKey[] = METRIC_DEFS.map((d) => d.key);

// ── Regions ─────────────────────────────────────────────────────────────────

export type MarketRegionDef = {
  /** Matches the service-area key the sales reports use. */
  key: string;
  label: string;
  /** What Redfin is asked for. The state qualifier is load-bearing: a bare
   *  "Columbus" or "Charlotte" resolves to the wrong state's city. */
  query: string;
};

const REGION_QUERIES: Record<string, { label: string; query: string }> = {
  cincinnati: { label: "Cincinnati", query: "Cincinnati, OH" },
  columbus: { label: "Columbus", query: "Columbus, OH" },
  dayton: { label: "Dayton", query: "Dayton, OH" },
  toledo: { label: "Toledo", query: "Toledo, OH" },
  findlay: { label: "Findlay", query: "Findlay, OH" },
  lima: { label: "Lima", query: "Lima, OH" },
  "fort wayne": { label: "Fort Wayne", query: "Fort Wayne, IN" },
  charlotte: { label: "Charlotte", query: "Charlotte, NC" },
};

/**
 * The regions to pull, derived from the shared service-area list so adding a
 * region to the business surfaces here as a missing-query failure rather than
 * as a market report that silently covers seven of eight markets.
 */
export const MARKET_REGIONS: MarketRegionDef[] = ALL_REGIONS.map((key) => {
  const q = REGION_QUERIES[key];
  return { key, label: q?.label ?? key, query: q?.query ?? key };
});

/** Regions the business serves that nobody gave a Redfin query. */
export function regionsMissingQuery(): string[] {
  return ALL_REGIONS.filter((key) => !REGION_QUERIES[key]);
}

// ── Parsing ─────────────────────────────────────────────────────────────────

export type MarketPoint = { date: string; value: number };

/**
 * Numbers arrive as strings, sometimes pre-formatted ("$289,827", "98.6%") and
 * sometimes raw ("0.9857410668"). Strip the furniture and take what is left.
 */
export function parseMetricNumber(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const cleaned = raw.replace(/[$,%\s]/g, "");
  if (!cleaned) {
    return null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Newest first, and only points that carry both a date and a real number. */
function parsePoints(raw: unknown): MarketPoint[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const points: MarketPoint[] = [];
  for (const entry of raw) {
    const rec = asRecord(entry);
    if (!rec) {
      continue;
    }
    const date = typeof rec.date === "string" ? rec.date : null;
    const value = parseMetricNumber(rec.value);
    if (!date || value === null) {
      continue;
    }
    points.push({ date, value });
  }
  return points.toSorted((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export type RollingChange = {
  /** Trailing twelve months, summed or averaged per the metric. */
  current: number;
  /** The twelve before those. */
  prior: number;
  /** Percent change, or null when the prior window is zero. */
  changePct: number | null;
  mode: "sum" | "average";
};

/**
 * Twelve months against the twelve before them.
 *
 * A single month's year-over-year is what Redfin shows, but it is noisy enough
 * to mislead — Cincinnati read -5%, -10%, and -12% in three consecutive months.
 * A rolling year is the honest measure of whether a market is shrinking, and it
 * disposes of seasonality without needing a seasonal adjustment.
 */
export function rollingChange(
  points: MarketPoint[],
  reduce: "sum" | "average",
): RollingChange | null {
  if (points.length < 24) {
    return null;
  }
  const fold = (xs: MarketPoint[]): number => {
    const total = xs.reduce((s, p) => s + p.value, 0);
    return reduce === "sum" ? total : total / xs.length;
  };
  const current = fold(points.slice(0, 12));
  const prior = fold(points.slice(12, 24));
  return {
    current,
    prior,
    changePct: prior === 0 ? null : ((current - prior) / prior) * 100,
    mode: reduce,
  };
}

export type MarketMetric = {
  key: MarketMetricKey;
  label: string;
  format: MarketMetricFormat;
  direction: MarketMetricDirection;
  note: string;
  /** Redfin's formatted current value, e.g. "$289,827". */
  display: string | null;
  /** Newest month as a number. */
  latest: number | null;
  /** Redfin's own year-over-year note: "+5.4%", "-0.8 pt", "+4". */
  yoy: string | null;
  points: MarketPoint[];
  rolling: RollingChange | null;
};

export type ParsedTrends = {
  resolvedName: string | null;
  metrics: MarketMetric[];
  /** Newest month present anywhere in the payload. */
  dataThrough: string | null;
};

/**
 * Read the sections/metrics envelope into our own shape.
 *
 * Metrics are matched by label across every section rather than per section:
 * the national feed files Days on Market under "supply" and the regional one
 * files it under "overview", and that difference is not worth modelling.
 */
export function parseMarketTrends(raw: unknown): ParsedTrends {
  const root = asRecord(raw);
  const sections = root && Array.isArray(root.sections) ? root.sections : [];
  const byKey = new Map<MarketMetricKey, MarketMetric>();
  let dataThrough: string | null = null;

  for (const section of sections) {
    const sec = asRecord(section);
    const metrics = sec && Array.isArray(sec.metrics) ? sec.metrics : [];
    for (const entry of metrics) {
      const rec = asRecord(entry);
      if (!rec) {
        continue;
      }
      const label = typeof rec.label === "string" ? rec.label : "";
      const def = DEF_BY_LABEL.get(label.toLowerCase());
      if (!def || byKey.has(def.key)) {
        continue;
      }
      const points = parsePoints(rec.aggregateData);
      const newest = points[0] ?? null;
      const aggRec = Array.isArray(rec.aggregateData) ? asRecord(rec.aggregateData[0]) : null;
      if (newest && (!dataThrough || newest.date > dataThrough)) {
        dataThrough = newest.date;
      }
      byKey.set(def.key, {
        key: def.key,
        label: def.label,
        format: def.format,
        direction: def.direction,
        note: def.note,
        display: typeof rec.value === "string" ? rec.value : null,
        latest: newest ? newest.value : null,
        yoy: aggRec && typeof aggRec.yoy === "string" ? aggRec.yoy : null,
        points,
        rolling: rollingChange(points, def.reduce),
      });
    }
  }

  return {
    resolvedName: root && typeof root.regionName === "string" ? root.regionName : null,
    // Catalog order, not payload order, so tables line up across regions.
    metrics: METRIC_ORDER.map((k) => byKey.get(k)).filter((m): m is MarketMetric => Boolean(m)),
    dataThrough,
  };
}

// ── Report assembly ─────────────────────────────────────────────────────────

export type MarketArea = {
  key: string;
  label: string;
  query: string;
  resolvedName: string | null;
  metrics: MarketMetric[];
  dataThrough: string | null;
  /**
   * Rolling-year change in homes sold, less the nation's. Positive means the
   * region grew faster than the country — the number that says whether a soft
   * patch is ours or everyone's. Null for the national row itself.
   */
  vsNationalPct: number | null;
  /** Why this area has no data, when it has none. */
  error: string | null;
  fetchedAt: number | null;
};

export type MarketReport = {
  national: MarketArea | null;
  regions: MarketArea[];
  dataThrough: string | null;
  /** Whole months between the newest datum and now. The headline caveat. */
  lagMonths: number | null;
  refreshedAt: number | null;
  /** Regions the business serves that this report cannot cover. */
  missingRegions: string[];
};

function metricByKey(area: ParsedTrends | null, key: MarketMetricKey): MarketMetric | null {
  return area?.metrics.find((m) => m.key === key) ?? null;
}

/** Whole months from a `YYYY-MM-DD` datum to now, floored at zero. */
export function lagMonths(dataThrough: string | null, now: number): number | null {
  if (!dataThrough) {
    return null;
  }
  const then = Date.parse(dataThrough);
  if (!Number.isFinite(then)) {
    return null;
  }
  const a = new Date(then);
  const b = new Date(now);
  const months =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  return Math.max(0, months);
}

export type AreaInput = {
  key: string;
  label: string;
  query: string;
  parsed: ParsedTrends | null;
  error: string | null;
  fetchedAt: number | null;
};

/**
 * Stitch the national row and the regional rows into the report, computing each
 * region's performance against the nation. Areas that failed to load are kept
 * with their error rather than dropped — a region missing from the table reads
 * as "no market here", which is the wrong conclusion.
 */
export function buildMarketReport(params: {
  national: AreaInput | null;
  regions: AreaInput[];
  refreshedAt: number | null;
  now: number;
}): MarketReport {
  const nationalSold = metricByKey(params.national?.parsed ?? null, "homesSold");
  const nationalPct = nationalSold?.rolling?.changePct ?? null;

  const toArea = (input: AreaInput, isNational: boolean): MarketArea => {
    const sold = metricByKey(input.parsed, "homesSold");
    const pct = sold?.rolling?.changePct ?? null;
    return {
      key: input.key,
      label: input.label,
      query: input.query,
      resolvedName: input.parsed?.resolvedName ?? null,
      metrics: input.parsed?.metrics ?? [],
      dataThrough: input.parsed?.dataThrough ?? null,
      vsNationalPct: isNational || pct === null || nationalPct === null ? null : pct - nationalPct,
      error: input.error,
      fetchedAt: input.fetchedAt,
    };
  };

  const national = params.national ? toArea(params.national, true) : null;
  const regions = params.regions.map((r) => toArea(r, false));
  const dates = [national?.dataThrough, ...regions.map((r) => r.dataThrough)].filter(
    (d): d is string => Boolean(d),
  );
  const dataThrough = dates.length > 0 ? (dates.toSorted().at(-1) ?? null) : null;

  return {
    national,
    regions,
    dataThrough,
    lagMonths: lagMonths(dataThrough, params.now),
    refreshedAt: params.refreshedAt,
    missingRegions: regionsMissingQuery(),
  };
}
