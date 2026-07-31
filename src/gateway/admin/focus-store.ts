// The sales Focus report: for one BDS, their clients ranked by shoots and
// revenue over a period, next to how that compares with the period before and
// when anyone last spoke to them.
//
// Three caches feed it, all swept from Spiro:
//   - companies, for the service area that decides a client's region
//   - agents, for the email that joins them to the CRM
//   - orders, which carry both the shoot count and the revenue
//
// Orders are the expensive one. Spiro's reporting endpoint caps a request at a
// 31-day range and 500 rows, so a year is ~12 windows and a year-on-year view
// needs two of those. That is a sweep, not a page load — hence the cache.

import { callTool, listTools } from "../../../extensions/spiro/api.js";
import {
  assignOwners,
  type BdsName,
  isSplitRegion,
  regionLabel,
  splitExplainer,
} from "./focus-regions.js";
import { type ContactIndex, loadContactIndex, lookupContact } from "./pipedrive-contacts-store.js";
import { getAdminDb } from "./user-store.js";

const PAGE_SIZE = 500;
const MAX_PAGES = 60;
const INSERT_CHUNK = 200;
/** Spiro caps a reporting request at 31 days; stay just inside it. */
const WINDOW_DAYS = 30;
const REFRESH_LOG_KEY = "focus";

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// The MCP reply is {content:[{type:"text", text:"<json>"}]} wrapping
// {data:[...], meta:{...}}; fall back defensively if the envelope changes.
function parsePaged(result: unknown): {
  rows: Array<Record<string, unknown>>;
  hasNextPage: boolean;
  resultSetAsOf: string | null;
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
    return {
      rows: payload as Array<Record<string, unknown>>,
      hasNextPage: false,
      resultSetAsOf: null,
    };
  }
  const obj = asObject(payload);
  if (obj) {
    for (const key of ["data", "items", "results"]) {
      const v = obj[key];
      if (Array.isArray(v)) {
        const meta = asObject(obj.meta);
        return {
          rows: v as Array<Record<string, unknown>>,
          // The reporting endpoint says hasMoreData; the others say hasNextPage.
          hasNextPage: meta?.hasNextPage === true || meta?.hasMoreData === true,
          resultSetAsOf: str(meta?.resultSetAsOf),
        };
      }
    }
  }
  return { rows: [], hasNextPage: false, resultSetAsOf: null };
}

async function resolveTool(preferred: string, patterns: RegExp[], what: string): Promise<string> {
  const tools = await listTools();
  const names = tools.map((t) => t.name);
  if (names.includes(preferred)) {
    return preferred;
  }
  for (const re of patterns) {
    const hit = names.find((n) => re.test(n));
    if (hit) {
      return hit;
    }
  }
  throw new Error(`Spiro has no ${what} tool available`);
}

// ── Date helpers ───────────────────────────────────────────────────────────

/** `YYYY-MM-DD` in local time — Spiro reads these in the account's timezone. */
export function ymd(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseYmd(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) {
    return Number.NaN;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

const DAY = 86400000;

/** The report's default window: the trailing 12 months ending at `toMs`. */
export function defaultFrom(toMs: number): string {
  const d = new Date(toMs);
  d.setFullYear(d.getFullYear() - 1);
  d.setDate(d.getDate() + 1);
  return ymd(d.getTime());
}

/** Split a range into windows Spiro will accept. */
export function dateWindows(fromMs: number, toMs: number): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  let cursor = fromMs;
  while (cursor <= toMs) {
    const end = Math.min(cursor + (WINDOW_DAYS - 1) * DAY, toMs);
    out.push({ from: ymd(cursor), to: ymd(end) });
    cursor = end + DAY;
  }
  return out;
}

/**
 * The period to compare against. Year-on-year shifts back 12 months (the
 * default: seasonality dominates this business); "previous" takes the same
 * number of days immediately before the window.
 */
export function comparisonWindow(
  fromMs: number,
  toMs: number,
  mode: "yoy" | "previous",
): { from: number; to: number } {
  if (mode === "previous") {
    const span = toMs - fromMs + DAY;
    return { from: fromMs - span, to: fromMs - DAY };
  }
  const shift = (ms: number) => {
    const d = new Date(ms);
    d.setFullYear(d.getFullYear() - 1);
    return d.getTime();
  };
  return { from: shift(fromMs), to: shift(toMs) };
}

// ── Refresh ────────────────────────────────────────────────────────────────

type OrderRow = {
  order_id: string;
  agent_id: string;
  agent_name: string;
  company_id: string | null;
  company_name: string | null;
  order_date: number;
  total: number;
  status: string;
};

/** Companies, for the service area that decides a client's region. */
async function sweepCompanies(): Promise<number> {
  const tool = await resolveTool("search_spiro_companies", [/compan/i], "companies");
  const rows = new Map<string, { company_id: string; name: string; region: string | null }>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { rows: batch, hasNextPage } = parsePaged(
      await callTool(tool, { page, pageSize: PAGE_SIZE }),
    );
    for (const raw of batch) {
      const id = str(raw.companyId);
      if (!id) {
        continue;
      }
      const area = asObject(raw.serviceArea);
      rows.set(id, {
        company_id: id,
        name: str(raw.name) ?? "Unknown company",
        region: str(area?.name),
      });
    }
    if (!hasNextPage || batch.length === 0) {
      break;
    }
  }
  const db = getAdminDb();
  const now = Date.now();
  await db.transaction().execute(async (tx) => {
    await tx.deleteFrom("admin_focus_companies").execute();
    const list = [...rows.values()].map((r) => ({
      company_id: r.company_id,
      name: r.name,
      region: r.region,
      cached_at: now,
    }));
    for (let i = 0; i < list.length; i += INSERT_CHUNK) {
      await tx
        .insertInto("admin_focus_companies")
        .values(list.slice(i, i + INSERT_CHUNK))
        .execute();
    }
  });
  return rows.size;
}

/** Agents, for the email that joins a client to the CRM. */
async function sweepAgents(): Promise<number> {
  const tool = await resolveTool("search_spiro_agents", [/agent/i], "agents");
  const rows = new Map<
    string,
    { agent_id: string; name: string; email: string | null; company_id: string | null }
  >();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { rows: batch, hasNextPage } = parsePaged(
      await callTool(tool, { page, pageSize: PAGE_SIZE, status: "current" }),
    );
    for (const raw of batch) {
      const identity = asObject(raw.identity) ?? raw;
      const id = str(identity.agentId);
      if (!id) {
        continue;
      }
      const contact = asObject(raw.contact);
      const company = asObject(raw.company);
      const name = [str(identity.firstName), str(identity.lastName)].filter(Boolean).join(" ");
      rows.set(id, {
        agent_id: id,
        name: name || "Unknown agent",
        email: str(contact?.emailAddress)?.toLowerCase() ?? null,
        company_id: str(company?.companyId),
      });
    }
    if (!hasNextPage || batch.length === 0) {
      break;
    }
  }
  const db = getAdminDb();
  const now = Date.now();
  await db.transaction().execute(async (tx) => {
    await tx.deleteFrom("admin_focus_agents").execute();
    const list = [...rows.values()].map((r) => ({
      agent_id: r.agent_id,
      name: r.name,
      email: r.email,
      company_id: r.company_id,
      cached_at: now,
    }));
    for (let i = 0; i < list.length; i += INSERT_CHUNK) {
      await tx
        .insertInto("admin_focus_agents")
        .values(list.slice(i, i + INSERT_CHUNK))
        .execute();
    }
  });
  return rows.size;
}

/**
 * Orders across a range, windowed to what Spiro will serve. Replaces the cache
 * for exactly the range swept, so an older range already cached is left alone.
 */
async function sweepOrders(fromMs: number, toMs: number): Promise<number> {
  const tool = await resolveTool(
    "search_spiro_reporting_orders",
    [/reporting.*order/i, /order/i],
    "reporting orders",
  );
  const collected = new Map<string, OrderRow>();
  for (const window of dateWindows(fromMs, toMs)) {
    let resultSetAsOf: string | null = null;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const args: Record<string, unknown> = {
        from: window.from,
        to: window.to,
        page,
        pageSize: PAGE_SIZE,
      };
      // Holding the snapshot steady stops a row shifting pages mid-sweep.
      if (resultSetAsOf) {
        args.resultSetAsOf = resultSetAsOf;
      }
      const parsed = parsePaged(await callTool(tool, args));
      resultSetAsOf = resultSetAsOf ?? parsed.resultSetAsOf;
      for (const raw of parsed.rows) {
        const id = str(raw.orderId);
        const agent = asObject(raw.agent);
        const agentId = str(agent?.id);
        const dateRaw = str(raw.orderDate);
        if (!id || !agentId || !dateRaw) {
          continue;
        }
        const ms = Date.parse(dateRaw);
        if (!Number.isFinite(ms)) {
          continue;
        }
        const company = asObject(raw.company);
        collected.set(id, {
          order_id: id,
          agent_id: agentId,
          agent_name: str(agent?.name) ?? "Unknown agent",
          company_id: str(company?.id),
          company_name: str(company?.name),
          order_date: ms,
          total: num(raw.total),
          status: str(raw.status) ?? "unknown",
        });
      }
      if (!parsed.hasNextPage || parsed.rows.length === 0) {
        break;
      }
    }
  }

  const db = getAdminDb();
  const now = Date.now();
  await db.transaction().execute(async (tx) => {
    await tx
      .deleteFrom("admin_focus_orders")
      .where("order_date", ">=", fromMs)
      .where("order_date", "<=", toMs + DAY - 1)
      .execute();
    const list = [...collected.values()].map((r) => ({
      order_id: r.order_id,
      agent_id: r.agent_id,
      agent_name: r.agent_name,
      company_id: r.company_id,
      company_name: r.company_name,
      order_date: r.order_date,
      total: r.total,
      status: r.status,
      cached_at: now,
    }));
    for (let i = 0; i < list.length; i += INSERT_CHUNK) {
      await tx
        .insertInto("admin_focus_orders")
        .values(list.slice(i, i + INSERT_CHUNK))
        .execute();
    }
  });
  return collected.size;
}

/**
 * Pull everything the report needs for a window and its comparison period.
 * Slow by nature (dozens of Spiro requests), so it is manual or scheduled,
 * never triggered by opening the page.
 */
export async function refreshFocusData(params: {
  from: string;
  to: string;
  compare?: "yoy" | "previous";
  manual?: boolean;
}): Promise<{ companies: number; agents: number; orders: number }> {
  const fromMs = parseYmd(params.from);
  const toMs = parseYmd(params.to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
    throw new Error("from and to must be YYYY-MM-DD, with from on or before to");
  }
  const companies = await sweepCompanies();
  const agents = await sweepAgents();
  const prior = comparisonWindow(fromMs, toMs, params.compare ?? "yoy");
  // The comparison period is swept too, or every client reads as new business.
  const orders = (await sweepOrders(prior.from, prior.to)) + (await sweepOrders(fromMs, toMs));

  const now = Date.now();
  await getAdminDb()
    .insertInto("admin_focus_refresh_log")
    .values({ id: REFRESH_LOG_KEY, refreshed_at: now, manual: params.manual ? 1 : 0 })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({ refreshed_at: now, manual: params.manual ? 1 : 0 }),
    )
    .execute();
  return { companies, agents, orders };
}

// ── Read ───────────────────────────────────────────────────────────────────

export type FocusRow = {
  agentId: string;
  agentName: string;
  companyName: string | null;
  region: string;
  bds: BdsName | null;
  shoots: number;
  revenue: number;
  priorShoots: number;
  priorRevenue: number;
  /**
   * Revenue this period as a percentage change on the comparison period. Null
   * when there is nothing to compare against — a brand-new client is not
   * "infinite growth", and saying so would rank them above everyone real.
   */
  growthPct: number | null;
  lastContactAt: number | null;
  daysSinceContact: number | null;
};

export type FocusReport = {
  from: string;
  to: string;
  compare: "yoy" | "previous";
  comparisonFrom: string;
  comparisonTo: string;
  refreshedAt: number | null;
  rows: FocusRow[];
  totals: { clients: number; shoots: number; revenue: number; priorRevenue: number };
  bdsOptions: BdsName[];
  splitNote: string;
};

/** Orders are counted as shoots unless they were cancelled. */
const NON_SHOOT_STATUSES = new Set(["cancelled"]);

export async function getFocusReport(params: {
  from: string;
  to: string;
  compare?: "yoy" | "previous";
  bds?: string | null;
  now?: number;
}): Promise<FocusReport> {
  const fromMs = parseYmd(params.from);
  const toMs = parseYmd(params.to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
    throw new Error("from and to must be YYYY-MM-DD, with from on or before to");
  }
  const compare = params.compare ?? "yoy";
  const prior = comparisonWindow(fromMs, toMs, compare);
  const now = params.now ?? Date.now();
  const db = getAdminDb();

  const companies = await db.selectFrom("admin_focus_companies").selectAll().execute();
  const regionByCompany = new Map(companies.map((c) => [c.company_id, c.region]));
  const agents = await db.selectFrom("admin_focus_agents").selectAll().execute();
  const agentById = new Map(agents.map((a) => [a.agent_id, a]));

  const windowEnd = toMs + DAY - 1;
  const orders = await db
    .selectFrom("admin_focus_orders")
    .selectAll()
    .where("order_date", ">=", Math.min(prior.from, fromMs))
    .where("order_date", "<=", Math.max(prior.to + DAY - 1, windowEnd))
    .execute();

  type Agg = {
    agentId: string;
    agentName: string;
    companyId: string | null;
    companyName: string | null;
    shoots: number;
    revenue: number;
    priorShoots: number;
    priorRevenue: number;
  };
  const byAgent = new Map<string, Agg>();
  for (const o of orders) {
    const inCurrent = o.order_date >= fromMs && o.order_date <= windowEnd;
    const inPrior = o.order_date >= prior.from && o.order_date <= prior.to + DAY - 1;
    if (!inCurrent && !inPrior) {
      continue;
    }
    const entry = byAgent.get(o.agent_id) ?? {
      agentId: o.agent_id,
      agentName: o.agent_name,
      companyId: o.company_id,
      companyName: o.company_name,
      shoots: 0,
      revenue: 0,
      priorShoots: 0,
      priorRevenue: 0,
    };
    const counts = !NON_SHOOT_STATUSES.has(o.status);
    if (inCurrent) {
      if (counts) {
        entry.shoots += 1;
      }
      entry.revenue += o.total;
    } else {
      if (counts) {
        entry.priorShoots += 1;
      }
      entry.priorRevenue += o.total;
    }
    // A client who changed brokerage mid-period reads under their latest one.
    if (o.company_id) {
      entry.companyId = o.company_id;
      entry.companyName = o.company_name;
    }
    byAgent.set(o.agent_id, entry);
  }

  let crm: ContactIndex | null = null;
  try {
    crm = await loadContactIndex();
  } catch {
    crm = null;
  }

  const aggs = [...byAgent.values()];
  const regionOf = (a: Agg): string | null => {
    // The order's company decides the region; the roster is the fallback for a
    // client whose orders carried no company.
    const viaOrder = a.companyId ? regionByCompany.get(a.companyId) : null;
    if (viaOrder) {
      return viaOrder;
    }
    const roster = agentById.get(a.agentId);
    const viaRoster = roster?.company_id ? regionByCompany.get(roster.company_id) : null;
    return viaRoster ?? null;
  };

  const owners = assignOwners(
    aggs.map((a) => ({ key: a.agentId, region: regionOf(a), revenue: a.revenue })),
  );

  const rows: FocusRow[] = aggs.map((a) => {
    const roster = agentById.get(a.agentId);
    const match = crm
      ? lookupContact(crm, {
          name: a.agentName,
          email: roster?.email ?? undefined,
          type: "agent",
        })
      : null;
    const lastContactAt = match?.lastActivityAt ?? null;
    return {
      agentId: a.agentId,
      agentName: a.agentName,
      companyName: a.companyName,
      region: regionLabel(regionOf(a)),
      bds: owners.get(a.agentId) ?? null,
      shoots: a.shoots,
      revenue: Math.round(a.revenue * 100) / 100,
      priorShoots: a.priorShoots,
      priorRevenue: Math.round(a.priorRevenue * 100) / 100,
      growthPct:
        a.priorRevenue > 0
          ? Math.round(((a.revenue - a.priorRevenue) / a.priorRevenue) * 1000) / 10
          : null,
      lastContactAt,
      daysSinceContact:
        lastContactAt === null ? null : Math.max(0, Math.floor((now - lastContactAt) / DAY)),
    };
  });

  const filtered = params.bds ? rows.filter((r) => r.bds === params.bds) : rows;
  const ranked = filtered.toSorted((a, b) => b.revenue - a.revenue || b.shoots - a.shoots);

  const log = await db
    .selectFrom("admin_focus_refresh_log")
    .select(["refreshed_at"])
    .where("id", "=", REFRESH_LOG_KEY)
    .executeTakeFirst();

  const sharedCount = aggs.filter((a) => isSplitRegion(regionOf(a))).length;

  return {
    from: params.from,
    to: params.to,
    compare,
    comparisonFrom: ymd(prior.from),
    comparisonTo: ymd(prior.to),
    refreshedAt: log?.refreshed_at ?? null,
    rows: ranked,
    totals: {
      clients: ranked.length,
      shoots: ranked.reduce((s, r) => s + r.shoots, 0),
      revenue: Math.round(ranked.reduce((s, r) => s + r.revenue, 0) * 100) / 100,
      priorRevenue: Math.round(ranked.reduce((s, r) => s + r.priorRevenue, 0) * 100) / 100,
    },
    bdsOptions: [...new Set(rows.map((r) => r.bds).filter((b): b is BdsName => !!b))].toSorted(),
    splitNote: splitExplainer(sharedCount),
  };
}
