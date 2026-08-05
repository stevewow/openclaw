// Fetch and cache the housing-market series behind the Market report.
//
// The upstream is metered per call and the series it serves is monthly, so a
// refresh is nine requests (the nation plus each region) and is never automatic.
// Raw payloads are cached rather than parsed rows: the parser is far more
// likely to change than a month-old series is, and re-parsing costs nothing
// while re-fetching costs credits.

import {
  type AreaInput,
  buildMarketReport,
  MARKET_REGIONS,
  type MarketReport,
  parseMarketTrends,
} from "./market-trends.js";
import { getAdminDb } from "./user-store.js";

const BASE_URL = "https://redfin.realtyapi.io";
const NATIONAL_KEY = "national";
const NATIONAL_LABEL = "United States";
/** Upstream is monthly; a week between refreshes still catches every update. */
export const MARKET_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;
/** Courtesy gap between calls in a sweep. */
const REQUEST_GAP_MS = 250;

export type MarketFetchDeps = {
  fetchArea: (area: { key: string; query: string }) => Promise<unknown>;
  now: () => number;
};

export class MarketKeyMissingError extends Error {
  constructor() {
    super(
      "REALTYAPI_KEY is not set. Add it to the gateway environment to refresh the market report.",
    );
    this.name = "MarketKeyMissingError";
  }
}

export function marketApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.REALTYAPI_KEY;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function isMarketConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return marketApiKey(env) !== null;
}

/**
 * One area's series. The national figures live at their own endpoint — it takes
 * no location and carries a supply block the regional one does not.
 */
async function fetchAreaLive(area: { key: string; query: string }): Promise<unknown> {
  const key = marketApiKey();
  if (!key) {
    throw new MarketKeyMissingError();
  }
  const url =
    area.key === NATIONAL_KEY
      ? `${BASE_URL}/usHousingMarketTrends`
      : `${BASE_URL}/housingMarketTrends?location=${encodeURIComponent(area.query)}`;
  const res = await fetch(url, {
    headers: { "x-realtyapi-key": key },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 402) {
    throw new Error("Out of RealtyAPI credits for this plan period.");
  }
  if (res.status === 401) {
    throw new Error("RealtyAPI rejected the key.");
  }
  if (!res.ok) {
    throw new Error(`Upstream returned HTTP ${res.status}.`);
  }
  return await res.json();
}

const liveDeps: MarketFetchDeps = { fetchArea: fetchAreaLive, now: () => Date.now() };

type AreaSpec = { key: string; label: string; query: string };

/** The nation first, then every region we serve. */
export function marketAreas(): AreaSpec[] {
  return [
    { key: NATIONAL_KEY, label: NATIONAL_LABEL, query: "" },
    ...MARKET_REGIONS.map((r) => ({ key: r.key, label: r.label, query: r.query })),
  ];
}

export type MarketRefreshResult = {
  /** Areas that came back. Named for the count it is — the HTTP envelope has
   *  its own boolean `ok`, and one shadowing the other is a real hazard. */
  refreshed: number;
  failed: number;
  errors: Array<{ area: string; error: string }>;
};

/**
 * Sweep every area and replace the cache.
 *
 * One area failing does not abandon the rest: the error is stored against that
 * area so the report can say which market is missing and why, instead of the
 * whole refresh reporting failure because Lima timed out.
 */
export async function refreshMarketData(
  deps: MarketFetchDeps = liveDeps,
): Promise<MarketRefreshResult> {
  if (deps === liveDeps && !isMarketConfigured()) {
    throw new MarketKeyMissingError();
  }
  const result: MarketRefreshResult = { refreshed: 0, failed: 0, errors: [] };

  for (const area of marketAreas()) {
    let payload = "{}";
    let error: string | null = null;
    try {
      payload = JSON.stringify(await deps.fetchArea(area));
      result.refreshed += 1;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      result.failed += 1;
      result.errors.push({ area: area.key, error });
      // A key or credit failure kills every remaining area too; stop rather
      // than burn the rest of the sweep proving it eight more times.
      if (err instanceof MarketKeyMissingError || /credits|rejected the key/i.test(error)) {
        await writeSnapshot(area, payload, error, deps.now());
        break;
      }
    }
    await writeSnapshot(area, payload, error, deps.now());
    if (REQUEST_GAP_MS > 0 && deps === liveDeps) {
      await new Promise((r) => setTimeout(r, REQUEST_GAP_MS));
    }
  }

  return result;
}

async function writeSnapshot(
  area: AreaSpec,
  payload: string,
  error: string | null,
  now: number,
): Promise<void> {
  await getAdminDb()
    .insertInto("admin_market_snapshots")
    .values({
      area_key: area.key,
      label: area.label,
      query: area.query,
      payload,
      error,
      fetched_at: now,
    })
    .onConflict((oc) =>
      oc.column("area_key").doUpdateSet({
        label: area.label,
        query: area.query,
        payload,
        error,
        fetched_at: now,
      }),
    )
    .execute();
}

function toAreaInput(row: {
  area_key: string;
  label: string;
  query: string;
  payload: string;
  error: string | null;
  fetched_at: number;
}): AreaInput {
  let parsed = null;
  let error = row.error;
  if (!error) {
    try {
      parsed = parseMarketTrends(JSON.parse(row.payload));
    } catch {
      // A payload that will not parse is a cache problem, not a market one.
      error = "Cached response could not be read. Refresh to re-fetch.";
    }
  }
  return {
    key: row.area_key,
    label: row.label,
    query: row.query,
    parsed,
    error,
    fetchedAt: row.fetched_at,
  };
}

export type MarketReportEnvelope = MarketReport & {
  /** Whether a key is present, so the UI offers refresh only when it can work. */
  configured: boolean;
  /** True when nothing has ever been cached — a different empty from a failure. */
  neverRefreshed: boolean;
  stale: boolean;
};

/** Read the cache and shape the report. Never fetches. */
export async function getMarketReport(now = Date.now()): Promise<MarketReportEnvelope> {
  const rows = await getAdminDb()
    .selectFrom("admin_market_snapshots")
    .select(["area_key", "label", "query", "payload", "error", "fetched_at"])
    .execute();

  const byKey = new Map(rows.map((r) => [r.area_key, r]));
  const nationalRow = byKey.get(NATIONAL_KEY);
  const national = nationalRow ? toAreaInput(nationalRow) : null;

  // Driven by the region catalog, not by what happens to be cached, so a region
  // added to the business shows up as an un-refreshed row rather than vanishing.
  const regions: AreaInput[] = MARKET_REGIONS.map((r) => {
    const row = byKey.get(r.key);
    if (row) {
      return toAreaInput(row);
    }
    return {
      key: r.key,
      label: r.label,
      query: r.query,
      parsed: null,
      error: "Not refreshed yet.",
      fetchedAt: null,
    };
  });

  const fetchedAts = rows.map((r) => r.fetched_at).filter((t) => Number.isFinite(t));
  const refreshedAt = fetchedAts.length > 0 ? Math.max(...fetchedAts) : null;

  return {
    ...buildMarketReport({ national, regions, refreshedAt, now }),
    configured: isMarketConfigured(),
    neverRefreshed: rows.length === 0,
    stale: refreshedAt === null || now - refreshedAt > MARKET_STALE_MS,
  };
}
