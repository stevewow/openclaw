import { callTool, listTools } from "../../../extensions/spiro/api.js";
import { getAdminDb } from "./user-store.js";

export type AgentCancellationRow = {
  client: string;
  totalOrders: number;
  cancellations: number;
  reschedules: number;
  cancelledOrRescheduledPct: number;
};

export type AgentCancellationReport = {
  from: string; // YYYY-MM
  to: string; // YYYY-MM
  market: string | null;
  rows: AgentCancellationRow[];
  totals: Omit<AgentCancellationRow, "client">;
};

export type RankingRow = {
  rank: number;
  name: string;
  totalOrders: number;
  cancellations: number;
  reschedules: number;
  cancelledOrRescheduledPct: number;
};

export type RankingsReport = {
  from: string; // YYYY-MM
  to: string; // YYYY-MM
  market: string | null;
  agents: RankingRow[];
  companies: RankingRow[];
};

export type MonthRefreshStatus = {
  month: string;
  refreshedAt: number | null;
  manual: boolean;
};

type RefreshLogRow = {
  month: string;
  refreshed_at: number;
  manual: number;
};

// Spiro's MCP server exposes ~15 order-related tools (get_spiro_order_photos,
// get_spiro_agent_orders, search_spiro_reporting_orders, ...). The one that supports
// paginated, date/status-filtered order search is named exactly "search_spiro_orders" —
// confirmed live against a connected account. Fuzzy-matching on "order" alone picks the
// wrong tool, so this only falls back to fuzzy search if Spiro ever renames it.
const PREFERRED_ORDERS_TOOL = "search_spiro_orders";

let ordersToolName: string | null = null;

async function resolveOrdersToolName(): Promise<string> {
  if (ordersToolName) return ordersToolName;
  const tools = await listTools();
  const match =
    tools.find((t) => t.name === PREFERRED_ORDERS_TOOL) ??
    tools.find((t) => /^search.*order/i.test(t.name)) ??
    tools.find((t) => /order/i.test(t.name));
  if (!match) {
    throw new Error(
      "No Spiro tool matching 'order' found. Run /spiro-auth to connect Spiro, then check available tools.",
    );
  }
  ordersToolName = match.name;
  return match.name;
}

function firstString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

// Spiro's order model (OrderListItemModel / client: OrderClientSummaryModel) identifies the
// customer by the real-estate agent who placed the order, with the brokerage as a secondary
// grouping. Prefer the agent name — that's the "client" this report is meant to track.
function extractClientName(raw: Record<string, unknown>): string {
  const direct = firstString(raw, [
    "agentName",
    "agent_name",
    "client_name",
    "customer",
    "companyName",
    "company_name",
  ]);
  if (direct) return direct;
  const client = asObject(raw.client);
  if (client) {
    const nested = firstString(client, [
      "agentName",
      "agent_name",
      "companyName",
      "company_name",
      "name",
    ]);
    if (nested) return nested;
  }
  return "Unknown";
}

// The brokerage/company the order belongs to, kept separately from the agent so the
// rankings report can group by company. OrderClientSummaryModel exposes companyName /
// brokerage; fall back to the nested client object. Returns null when unknown.
function extractCompanyName(raw: Record<string, unknown>): string | null {
  const direct = firstString(raw, ["companyName", "company_name", "brokerage", "brokerageName"]);
  if (direct) return direct;
  const client = asObject(raw.client);
  if (client) {
    const nested = firstString(client, [
      "companyName",
      "company_name",
      "brokerage",
      "brokerageName",
    ]);
    if (nested) return nested;
  }
  return null;
}

// No single "market" field exists on an order. Spiro's MCP layer documents a "location" filter,
// which this falls back to; the REST API otherwise only exposes city/stateShort per order (a
// company-level "service area" name is the closest true market concept but isn't on the order).
function extractMarket(raw: Record<string, unknown>): string | null {
  const direct = firstString(raw, ["market", "location", "region", "serviceArea", "service_area"]);
  if (direct) return direct;
  const city = firstString(raw, ["city"]);
  const state = firstString(raw, ["stateShort", "state_short", "state"]);
  if (city && state) return `${city}, ${state}`;
  return city ?? state ?? null;
}

// Confirmed against Spiro's public OpenAPI spec (status enum on OrderListItemModel):
// pending, awaitingConfirmation, confirmed, rescheduled, cancelled, inProgress,
// appointmentCompleted, editing, delivered, unknown.
function classifyStatus(status: string | null): "cancelled" | "rescheduled" | "other" {
  const s = (status ?? "").toLowerCase();
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("resched")) return "rescheduled";
  return "other";
}

function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1));
  const end = new Date(Date.UTC(y!, m!, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}

// search_spiro_orders replies as {content:[{type:"text", text:"<json>"}]} where the JSON
// parses to {data: Order[], meta: {hasNextPage, currentPage, ...}}. Falls back to a few
// other reasonable shapes defensively in case the MCP tool's envelope changes.
function parsePagedOrdersResult(result: unknown): {
  orders: Array<Record<string, unknown>>;
  hasNextPage: boolean;
} {
  let payload: unknown = result;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    const content = (obj as { content?: Array<{ type: string; text?: string }> }).content;
    const textPart = content?.find((c) => c.type === "text")?.text;
    if (textPart) {
      try {
        payload = JSON.parse(textPart) as unknown;
      } catch {
        payload = obj;
      }
    }
  }
  if (Array.isArray(payload))
    return { orders: payload as Array<Record<string, unknown>>, hasNextPage: false };
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["data", "orders", "items", "results"]) {
      const v = obj[key];
      if (Array.isArray(v)) {
        const meta = asObject(obj.meta);
        return {
          orders: v as Array<Record<string, unknown>>,
          hasNextPage: meta?.hasNextPage === true,
        };
      }
    }
  }
  return { orders: [], hasNextPage: false };
}

const PAGE_SIZE = 200;
const MAX_PAGES_PER_MONTH = 200; // 200 * 200/page = 40,000 orders/month ceiling, generous safety cap

async function fetchAllOrdersForMonth(
  toolName: string,
  from: string,
  to: string,
): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= MAX_PAGES_PER_MONTH; page++) {
    const result = await callTool(toolName, {
      dateSubmittedFrom: from,
      dateSubmittedTo: to,
      page,
      pageSize: PAGE_SIZE,
    });
    const { orders, hasNextPage } = parsePagedOrdersResult(result);
    all.push(...orders);
    if (!hasNextPage || orders.length === 0) break;
  }
  return all;
}

export async function refreshMonth(
  month: string,
  opts: { manual: boolean },
): Promise<{ count: number }> {
  const toolName = await resolveOrdersToolName();
  const { from, to } = monthBounds(month);
  const orders = await fetchAllOrdersForMonth(toolName, from, to);

  const db = getAdminDb();
  const now = Date.now();
  await db.deleteFrom("admin_spiro_orders").where("month", "=", month).execute();
  if (orders.length > 0) {
    await db
      .insertInto("admin_spiro_orders")
      .values(
        orders.map((raw, i) => {
          const id = firstString(raw, ["orderId", "order_id", "id"]) ?? `${month}-${i}`;
          const client = extractClientName(raw);
          const company = extractCompanyName(raw);
          const market = extractMarket(raw);
          const status = firstString(raw, ["status", "order_status", "cancellation_status"]) ?? "";
          return {
            id: `${month}:${id}`,
            month,
            client,
            company,
            market,
            status,
            cached_at: now,
          };
        }),
      )
      .execute();
  }

  await db
    .insertInto("admin_spiro_refresh_log")
    .values({ month, refreshed_at: now, manual: opts.manual ? 1 : 0 })
    .onConflict((oc) =>
      oc.column("month").doUpdateSet({ refreshed_at: now, manual: opts.manual ? 1 : 0 }),
    )
    .execute();

  return { count: orders.length };
}

export async function getRefreshStatus(months: string[]): Promise<MonthRefreshStatus[]> {
  const db = getAdminDb();
  const rows =
    months.length === 0
      ? []
      : await db
          .selectFrom("admin_spiro_refresh_log")
          .selectAll()
          .where("month", "in", months)
          .execute();
  const byMonth = new Map(rows.map((r: RefreshLogRow) => [r.month, r]));
  return months.map((month) => {
    const row = byMonth.get(month);
    return { month, refreshedAt: row?.refreshed_at ?? null, manual: !!row?.manual };
  });
}

export function last12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function previousMonth(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthStart(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

export async function listAvailableMarkets(from: string, to: string): Promise<string[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_spiro_orders")
    .select("market")
    .distinct()
    .where("month", ">=", from)
    .where("month", "<=", to)
    .where("market", "is not", null)
    .execute();
  return rows.map((r) => r.market as string).sort();
}

export async function getAgentCancellationReport(params: {
  from: string;
  to: string;
  market?: string | null;
}): Promise<AgentCancellationReport> {
  const db = getAdminDb();
  let query = db
    .selectFrom("admin_spiro_orders")
    .select(["client", "status"])
    .where("month", ">=", params.from)
    .where("month", "<=", params.to);
  if (params.market) query = query.where("market", "=", params.market);
  const rows = await query.execute();

  const byClient = new Map<string, { total: number; cancelled: number; rescheduled: number }>();
  for (const row of rows as Array<{ client: string; status: string }>) {
    const entry = byClient.get(row.client) ?? { total: 0, cancelled: 0, rescheduled: 0 };
    entry.total += 1;
    const cls = classifyStatus(row.status);
    if (cls === "cancelled") entry.cancelled += 1;
    if (cls === "rescheduled") entry.rescheduled += 1;
    byClient.set(row.client, entry);
  }

  const reportRows: AgentCancellationRow[] = Array.from(byClient.entries())
    .map(([client, v]) => ({
      client,
      totalOrders: v.total,
      cancellations: v.cancelled,
      reschedules: v.rescheduled,
      cancelledOrRescheduledPct: v.total > 0 ? ((v.cancelled + v.rescheduled) / v.total) * 100 : 0,
    }))
    .sort((a, b) => b.totalOrders - a.totalOrders);

  const totals = reportRows.reduce(
    (acc, r) => {
      acc.totalOrders += r.totalOrders;
      acc.cancellations += r.cancellations;
      acc.reschedules += r.reschedules;
      return acc;
    },
    { totalOrders: 0, cancellations: 0, reschedules: 0, cancelledOrRescheduledPct: 0 },
  );
  totals.cancelledOrRescheduledPct =
    totals.totalOrders > 0
      ? ((totals.cancellations + totals.reschedules) / totals.totalOrders) * 100
      : 0;

  return {
    from: params.from,
    to: params.to,
    market: params.market ?? null,
    rows: reportRows,
    totals,
  };
}

// Rank a set of orders grouped by a name field (agent or company) by total order
// volume, descending. Rows with no name are skipped for that dimension.
function rankByName(rows: Array<{ name: string | null; status: string }>): RankingRow[] {
  const byName = new Map<string, { total: number; cancelled: number; rescheduled: number }>();
  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue;
    const entry = byName.get(name) ?? { total: 0, cancelled: 0, rescheduled: 0 };
    entry.total += 1;
    const cls = classifyStatus(row.status);
    if (cls === "cancelled") entry.cancelled += 1;
    if (cls === "rescheduled") entry.rescheduled += 1;
    byName.set(name, entry);
  }
  return Array.from(byName.entries())
    .map(([name, v]) => ({
      name,
      totalOrders: v.total,
      cancellations: v.cancelled,
      reschedules: v.rescheduled,
      cancelledOrRescheduledPct: v.total > 0 ? ((v.cancelled + v.rescheduled) / v.total) * 100 : 0,
    }))
    .sort((a, b) => b.totalOrders - a.totalOrders || a.name.localeCompare(b.name))
    .map((row, i) => ({ rank: i + 1, ...row }));
}

// Agent ranking + company ranking over the same cached orders and the same
// date/market controls as getAgentCancellationReport.
export async function getRankingsReport(params: {
  from: string;
  to: string;
  market?: string | null;
}): Promise<RankingsReport> {
  const db = getAdminDb();
  let query = db
    .selectFrom("admin_spiro_orders")
    .select(["client", "company", "status"])
    .where("month", ">=", params.from)
    .where("month", "<=", params.to);
  if (params.market) query = query.where("market", "=", params.market);
  const rows = (await query.execute()) as Array<{
    client: string;
    company: string | null;
    status: string;
  }>;

  return {
    from: params.from,
    to: params.to,
    market: params.market ?? null,
    agents: rankByName(rows.map((r) => ({ name: r.client, status: r.status }))),
    companies: rankByName(rows.map((r) => ({ name: r.company, status: r.status }))),
  };
}

let schedulerStarted = false;
export function ensureSpiroReportScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
  const tick = async () => {
    try {
      const month = previousMonth();
      const [status] = await getRefreshStatus([month]);
      const needsRefresh = !status?.refreshedAt || status.refreshedAt < currentMonthStart();
      if (needsRefresh) await refreshMonth(month, { manual: false });
    } catch {
      // Spiro not connected yet, or transient failure — retry next tick.
    }
  };
  void tick();
  setInterval(() => void tick(), CHECK_INTERVAL_MS).unref();
}
