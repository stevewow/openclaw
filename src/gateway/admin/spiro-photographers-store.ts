import { callTool, listTools } from "../../../extensions/spiro/api.js";
import { getAdminDb } from "./user-store.js";

// Photographer roster report, sourced entirely from Spiro. Spiro exposes only a
// photographer's identity, their service areas (markets), active/deactivated
// status, and — via completed appointments — how many shoots they've done. The
// operational facts WOW also tracks (timing adjustments, restrictions, VIP
// approval, agent-account bans, availability) are NOT in Spiro, so they are
// deliberately absent here.
//
// Shape mirrors the other Spiro report stores: a snapshot cache refreshed on an
// hourly, stale-guarded schedule, read back for the dashboard. Shoot counts are
// bucketed by month so the report can total any selectable range.

export type PhotographerRow = {
  photographerId: string;
  name: string;
  markets: string[];
  active: boolean;
  shoots: number;
};

export type PhotographersReport = {
  from: string; // YYYY-MM
  to: string; // YYYY-MM
  rows: PhotographerRow[];
  refreshedAt: number | null;
};

const REFRESH_LOG_KEY = "photographers";

function firstString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }
  return null;
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

// ── Spiro tool resolution (fuzzy, like spiro-report-store) ──────────────────
let photographersToolName: string | null = null;
let appointmentsToolName: string | null = null;
let serviceAreasToolName: string | null = null;

async function resolveTool(
  cached: string | null,
  preferred: string,
  patterns: RegExp[],
  label: string,
): Promise<string> {
  if (cached) {
    return cached;
  }
  const tools = await listTools();
  let match = tools.find((t) => t.name === preferred);
  for (const re of patterns) {
    if (!match) {
      match = tools.find((t) => re.test(t.name));
    }
  }
  if (!match) {
    throw new Error(`No Spiro tool matching '${label}' found. Run /spiro-auth to connect Spiro.`);
  }
  return match.name;
}

async function resolvePhotographersTool(): Promise<string> {
  photographersToolName ??= await resolveTool(
    photographersToolName,
    "search_spiro_photographers",
    [/^search.*photographer/i, /photographer/i],
    "photographers",
  );
  return photographersToolName;
}
async function resolveAppointmentsTool(): Promise<string> {
  appointmentsToolName ??= await resolveTool(
    appointmentsToolName,
    "search_spiro_appointments",
    [/^search.*appointment/i, /appointment/i],
    "appointments",
  );
  return appointmentsToolName;
}
async function resolveServiceAreasTool(): Promise<string> {
  serviceAreasToolName ??= await resolveTool(
    serviceAreasToolName,
    "get_spiro_photographer_service_areas",
    [/photographer.*service.*area/i, /service.*area/i],
    "photographer service areas",
  );
  return serviceAreasToolName;
}

// The MCP reply is {content:[{type:"text", text:"<json>"}]} where the JSON is
// {data:[...], meta:{hasNextPage,...}}; fall back to a few shapes defensively.
function parsePaged(result: unknown): {
  rows: Array<Record<string, unknown>>;
  hasNextPage: boolean;
} {
  let payload: unknown = result;
  const outer = asObject(result);
  if (outer) {
    const content = (outer as { content?: Array<{ type: string; text?: string }> }).content;
    const textPart = content?.find((c) => c.type === "text")?.text;
    if (textPart) {
      try {
        payload = JSON.parse(textPart) as unknown;
      } catch {
        payload = outer;
      }
    }
  }
  if (Array.isArray(payload)) {
    return { rows: payload as Array<Record<string, unknown>>, hasNextPage: false };
  }
  const obj = asObject(payload);
  if (obj) {
    for (const key of ["data", "items", "results"]) {
      const v = obj[key];
      if (Array.isArray(v)) {
        const meta = asObject(obj.meta);
        return {
          rows: v as Array<Record<string, unknown>>,
          hasNextPage: meta?.hasNextPage === true,
        };
      }
    }
  }
  return { rows: [], hasNextPage: false };
}

// ── Date helpers ────────────────────────────────────────────────────────────
export function last12Months(now: number): string[] {
  const out: string[] = [];
  const d = new Date(now);
  d.setUTCDate(1);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function monthOf(iso: string): string | null {
  // "2025-01-02T09:45:00-05:00" → "2025-01" (leading YYYY-MM is enough).
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

const PAGE_SIZE = 200;
const MAX_ROSTER_PAGES = 40;
const MAX_APPT_PAGES = 60; // 12k completed appts/photographer ceiling

// ── Fetch ────────────────────────────────────────────────────────────────────
async function fetchRoster(toolName: string): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= MAX_ROSTER_PAGES; page++) {
    const { rows, hasNextPage } = parsePaged(
      await callTool(toolName, { page, pageSize: PAGE_SIZE }),
    );
    all.push(...rows);
    if (!hasNextPage || rows.length === 0) {
      break;
    }
  }
  return all;
}

async function fetchMarkets(toolName: string, photographerId: string): Promise<string[]> {
  const { rows } = parsePaged(await callTool(toolName, { photographerId }));
  const names: string[] = [];
  for (const r of rows) {
    const name = firstString(r, ["name", "serviceAreaName", "displayName"]);
    if (name) {
      names.push(name);
    }
  }
  return names;
}

// Completed shoots for one photographer over [from,to], bucketed by month.
async function fetchShootCounts(
  toolName: string,
  photographerId: string,
  from: string,
  to: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (let page = 1; page <= MAX_APPT_PAGES; page++) {
    const { rows, hasNextPage } = parsePaged(
      await callTool(toolName, {
        photographerId,
        status: "completed",
        arrivalWindowStartFrom: from,
        arrivalWindowStartTo: to,
        page,
        pageSize: PAGE_SIZE,
      }),
    );
    for (const r of rows) {
      const events = asObject(r.events);
      const start =
        (events && firstString(events, ["arrivalWindowStart"])) ??
        firstString(r, ["arrivalWindowStart", "scheduledAt", "date"]);
      const month = start ? monthOf(start) : null;
      if (month) {
        counts[month] = (counts[month] ?? 0) + 1;
      }
    }
    if (!hasNextPage || rows.length === 0) {
      break;
    }
  }
  return counts;
}

export type PhotographerFetch = {
  photographerId: string;
  name: string;
  markets: string[];
  active: boolean;
  monthlyShoots: Record<string, number>;
};

function photographerName(raw: Record<string, unknown>): string {
  const first = firstString(raw, ["firstName", "first_name"]) ?? "";
  const last = firstString(raw, ["lastName", "last_name"]) ?? "";
  const full = `${first} ${last}`.trim();
  return full || firstString(raw, ["name", "fullName", "displayName"]) || "Unknown";
}

export async function refreshPhotographers(opts: { manual: boolean }): Promise<{ count: number }> {
  const [photographersTool, appointmentsTool, serviceAreasTool] = await Promise.all([
    resolvePhotographersTool(),
    resolveAppointmentsTool(),
    resolveServiceAreasTool(),
  ]);
  const window = last12Months(Date.now());
  const windowFrom = `${window[0]}-01`;
  const windowTo = `${window[window.length - 1]}-31`;

  const roster = await fetchRoster(photographersTool);
  const fetched: PhotographerFetch[] = [];
  for (const raw of roster) {
    const photographerId = firstString(raw, ["photographerId", "id", "photographer_id"]);
    if (!photographerId) {
      continue;
    }
    const active = raw.deactivated !== true;
    const [markets, monthlyShoots] = await Promise.all([
      fetchMarkets(serviceAreasTool, photographerId).catch(() => [] as string[]),
      fetchShootCounts(appointmentsTool, photographerId, windowFrom, windowTo).catch(() => ({})),
    ]);
    fetched.push({
      photographerId,
      name: photographerName(raw),
      markets,
      active,
      monthlyShoots,
    });
  }

  const db = getAdminDb();
  const now = Date.now();
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("admin_spiro_photographers").execute();
    await trx.deleteFrom("admin_spiro_photographer_shoots").execute();
    if (fetched.length > 0) {
      await trx
        .insertInto("admin_spiro_photographers")
        .values(
          fetched.map((p) => ({
            photographer_id: p.photographerId,
            name: p.name,
            markets: JSON.stringify(p.markets),
            active: p.active ? 1 : 0,
            cached_at: now,
          })),
        )
        .execute();
      const shootRows = fetched.flatMap((p) =>
        Object.entries(p.monthlyShoots).map(([month, shoots]) => ({
          photographer_id: p.photographerId,
          month,
          shoots,
        })),
      );
      const CHUNK = 200;
      for (let i = 0; i < shootRows.length; i += CHUNK) {
        await trx
          .insertInto("admin_spiro_photographer_shoots")
          .values(shootRows.slice(i, i + CHUNK))
          .execute();
      }
    }
  });
  await db
    .insertInto("admin_spiro_photographer_refresh_log")
    .values({ id: REFRESH_LOG_KEY, refreshed_at: now, manual: opts.manual ? 1 : 0 })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({ refreshed_at: now, manual: opts.manual ? 1 : 0 }),
    )
    .execute();
  return { count: fetched.length };
}

// ── Read ─────────────────────────────────────────────────────────────────────
export async function getPhotographersReport(range: {
  from: string;
  to: string;
}): Promise<PhotographersReport> {
  const db = getAdminDb();
  const roster = await db.selectFrom("admin_spiro_photographers").selectAll().execute();
  const shootRows = await db
    .selectFrom("admin_spiro_photographer_shoots")
    .selectAll()
    .where("month", ">=", range.from)
    .where("month", "<=", range.to)
    .execute();
  const shootsById = new Map<string, number>();
  for (const s of shootRows) {
    shootsById.set(s.photographer_id, (shootsById.get(s.photographer_id) ?? 0) + s.shoots);
  }
  const log = await db
    .selectFrom("admin_spiro_photographer_refresh_log")
    .selectAll()
    .where("id", "=", REFRESH_LOG_KEY)
    .executeTakeFirst();

  const rows: PhotographerRow[] = roster.map((r) => {
    let markets: string[] = [];
    try {
      markets = JSON.parse(r.markets) as string[];
    } catch {
      markets = [];
    }
    return {
      photographerId: r.photographer_id,
      name: r.name,
      markets,
      active: r.active === 1,
      shoots: shootsById.get(r.photographer_id) ?? 0,
    };
  });
  // Busiest first — the report's default lens is "who's doing the work".
  rows.sort((a, b) => b.shoots - a.shoots || a.name.localeCompare(b.name));
  return { from: range.from, to: range.to, rows, refreshedAt: log?.refreshed_at ?? null };
}

// ── Scheduler ────────────────────────────────────────────────────────────────
let schedulerStarted = false;
export function ensurePhotographersScheduler(): void {
  if (schedulerStarted) {
    return;
  }
  schedulerStarted = true;
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
  const STALE_MS = 6 * 60 * 60 * 1000;
  const tick = async () => {
    try {
      const db = getAdminDb();
      const log = await db
        .selectFrom("admin_spiro_photographer_refresh_log")
        .selectAll()
        .where("id", "=", REFRESH_LOG_KEY)
        .executeTakeFirst();
      if (!log?.refreshed_at || Date.now() - log.refreshed_at > STALE_MS) {
        await refreshPhotographers({ manual: false });
      }
    } catch {
      /* Spiro not connected yet, or transient — retry next tick. */
    }
  };
  void tick();
  setInterval(() => void tick(), CHECK_INTERVAL_MS).unref();
}
