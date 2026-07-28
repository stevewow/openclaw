// Order-history pull for the Churn & Retention engine.
//
// The Python engine can pull its own history, but only with a Spiro public API
// key (SPIRO_API_KEY) that this deployment does not hold. The gateway already
// has an authenticated Spiro connection through the plugin's MCP client, so the
// pull happens here and the engine is handed a cache CSV to read — the engine
// keeps every calculation, this file only acquires rows.
//
// The CSV schema below is the engine's cache schema (`_flatten` in
// wow_retention.py). Change both together.

import fs from "node:fs/promises";
import path from "node:path";
import { callTool, listTools } from "../../../extensions/spiro/api.js";

// The reporting dataset is the one that carries order date, dollar total and the
// agent GUID — search_spiro_orders (used by the cancellations report) does not.
// Confirmed live against the connected account.
const PREFERRED_REPORTING_TOOL = "search_spiro_reporting_orders";

// Public API hard caps, mirrored from the endpoint's own `meta`: a request may
// not span more than 31 days, and a page may not exceed 500 rows.
const MAX_SPAN_DAYS = 31;
const PAGE_SIZE = 500;
// A month of orders is ~1.3k rows today, so 40 pages (20k rows) per window is a
// runaway guard, not a real ceiling.
const MAX_PAGES_PER_WINDOW = 40;

export const CSV_COLUMNS = [
  "order_id",
  "order_number",
  "order_date",
  "status",
  "total",
  "agent_id",
  "agent_name",
  "company_id",
  "company_name",
  "product_bundle",
] as const;

export type ChurnOrderRow = Record<(typeof CSV_COLUMNS)[number], string>;

let reportingToolName: string | null = null;

async function resolveReportingToolName(): Promise<string> {
  if (reportingToolName) return reportingToolName;
  const tools = await listTools();
  const match =
    tools.find((t) => t.name === PREFERRED_REPORTING_TOOL) ??
    tools.find((t) => /reporting.*order/i.test(t.name));
  if (!match) {
    throw new Error(
      "Spiro has no reporting-orders tool. Run /spiro-auth to reconnect Spiro, then retry.",
    );
  }
  reportingToolName = match.name;
  return match.name;
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** Flatten one reporting row to the engine's cache schema. */
export function flattenOrderRow(raw: Record<string, unknown>): ChurnOrderRow {
  const agent = asObject(raw.agent) ?? {};
  const company = asObject(raw.company) ?? {};
  // The purchased bundle is the line the customer actually bought; included
  // services and add-ons hang off it and would double-count as a "product".
  let bundle = "";
  const products = Array.isArray(raw.products) ? raw.products : [];
  for (const p of products) {
    const prod = asObject(p);
    if (prod?.source === "purchasedBundle") {
      bundle = str(prod.name);
      break;
    }
  }
  return {
    order_id: str(raw.orderId),
    order_number: str(raw.orderNumber),
    order_date: str(raw.orderDate),
    status: str(raw.status),
    total: str(raw.total ?? 0) || "0",
    agent_id: str(agent.id),
    agent_name: str(agent.name),
    company_id: str(company.id),
    company_name: str(company.name),
    product_bundle: bundle,
  };
}

/**
 * MCP replies as {content:[{type:"text",text:"<json>"}]} wrapping the REST
 * payload {data:[...], meta:{hasMoreData, resultSetAsOf}}. `resultSetAsOf` is
 * the endpoint's snapshot ceiling — passing it back unchanged on later pages is
 * what stops an order written mid-pull from shifting the pagination window.
 */
export function parseReportingResult(result: unknown): {
  orders: Array<Record<string, unknown>>;
  hasMoreData: boolean;
  resultSetAsOf: string | null;
} {
  let payload: unknown = result;
  const obj = asObject(result);
  if (obj) {
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
  const parsed = asObject(payload);
  if (!parsed) return { orders: [], hasMoreData: false, resultSetAsOf: null };
  const data = Array.isArray(parsed.data) ? parsed.data : [];
  const meta = asObject(parsed.meta) ?? {};
  return {
    orders: data as Array<Record<string, unknown>>,
    hasMoreData: meta.hasMoreData === true,
    resultSetAsOf: typeof meta.resultSetAsOf === "string" ? meta.resultSetAsOf : null,
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

/** [from, to] date pairs, none wider than the endpoint's 31-day cap. */
export function orderWindows(start: Date, end: Date): Array<{ from: string; to: string }> {
  const windows: Array<{ from: string; to: string }> = [];
  const endMs = end.getTime();
  for (let fromMs = start.getTime(); fromMs <= endMs; ) {
    const toMs = Math.min(fromMs + (MAX_SPAN_DAYS - 1) * DAY_MS, endMs);
    windows.push({ from: isoDate(new Date(fromMs)), to: isoDate(new Date(toMs)) });
    fromMs = toMs + DAY_MS;
  }
  return windows;
}

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function ordersToCsv(rows: ChurnOrderRow[]): string {
  const head = CSV_COLUMNS.join(",");
  const body = rows.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return [head, ...body].join("\n") + "\n";
}

export type PullProgress = (message: string) => void;

/**
 * Pull `years` of order history and write the engine's cache CSV.
 *
 * Windows are pulled oldest-first so a partial failure leaves a shorter but
 * still coherent history rather than a hole in the middle; the CSV is written
 * once at the end, through a temp file, so a crashed pull never leaves the
 * engine reading a half-written cache.
 */
export async function pullChurnOrders(opts: {
  years: number;
  cachePath: string;
  now?: Date;
  onProgress?: PullProgress;
}): Promise<{ rows: number; from: string; to: string }> {
  const toolName = await resolveReportingToolName();
  const end = opts.now ?? new Date();
  const start = new Date(end.getTime() - Math.round(opts.years * 365) * 86_400_000);
  const windows = orderWindows(start, end);
  const rows: ChurnOrderRow[] = [];
  opts.onProgress?.(
    `Pulling ${opts.years} year(s) of orders from Spiro in ${windows.length} windows (${isoDate(start)} → ${isoDate(end)})…`,
  );

  for (const [i, w] of windows.entries()) {
    let resultSetAsOf: string | null = null;
    for (let page = 1; page <= MAX_PAGES_PER_WINDOW; page++) {
      const args: Record<string, unknown> = {
        from: w.from,
        to: w.to,
        page,
        pageSize: PAGE_SIZE,
      };
      if (resultSetAsOf) args.resultSetAsOf = resultSetAsOf;
      const result = await callTool(toolName, args);
      const parsed = parseReportingResult(result);
      for (const raw of parsed.orders) rows.push(flattenOrderRow(raw));
      resultSetAsOf = parsed.resultSetAsOf ?? resultSetAsOf;
      if (!parsed.hasMoreData || parsed.orders.length === 0) break;
    }
    opts.onProgress?.(`  [${i + 1}/${windows.length}] ${w.from}..${w.to}: ${rows.length} rows`);
  }

  const tmp = `${opts.cachePath}.tmp`;
  await fs.mkdir(path.dirname(opts.cachePath), { recursive: true });
  await fs.writeFile(tmp, ordersToCsv(rows), "utf8");
  await fs.rename(tmp, opts.cachePath);
  opts.onProgress?.(`Cached ${rows.length} orders to ${opts.cachePath}`);
  return { rows: rows.length, from: isoDate(start), to: isoDate(end) };
}

/** Test seam: forget the resolved tool name between cases. */
export function resetChurnOrdersToolCache(): void {
  reportingToolName = null;
}
