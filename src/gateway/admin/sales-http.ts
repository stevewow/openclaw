// Admin routes for the sales dashboard, under /api/admin/sales-dashboard.
//
// Auth and the `sales-dashboard` feature gate run in admin-http.ts before
// anything here. Whoever holds the grant may read the dashboard, its markets and
// listings, and ask for a fresh Spiro read. Markets, goals, new listings and
// the holiday list are an admin's to change, since they decide what every
// percentage on the page means.

import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "../hooks.js";
import { sendJson } from "../http-common.js";
import { accountToday } from "./brokerage-orders.js";
import { addDays, isYmd } from "./sales-calendar.js";
import {
  addSalesHoliday,
  deleteSalesHoliday,
  getSalesDashboard,
  listSalesGoals,
  listSalesHolidays,
  saveSalesGoals,
} from "./sales-dashboard.js";
import {
  addSalesMarket,
  listSalesListings,
  listSalesMarkets,
  SalesInputError,
  saveSalesListings,
  setSalesMarketRemoval,
  suggestSalesMarkets,
} from "./sales-markets.js";
import { getSalesSync, refreshSalesData, type SalesSweepDeps } from "./sales-orders.js";

const MAX_BODY_BYTES = 128 * 1024;

export type SalesRequestContext = {
  actorName: string;
  /** Only an admin may change markets, goals, listings or holidays. */
  isAdmin: boolean;
};

export type SalesDeps = {
  now?: () => number;
  sweep?: SalesSweepDeps;
};

async function readObject(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<Record<string, unknown> | null> {
  const body = await readJsonBody(req, MAX_BODY_BYTES);
  if (!body.ok) {
    sendJson(res, body.error === "payload too large" ? 413 : 400, { error: body.error });
    return null;
  }
  const value = body.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    sendJson(res, 400, { error: "expected a JSON object" });
    return null;
  }
  return value as Record<string, unknown>;
}

/** Store validation errors are the caller's to fix; anything else is ours. */
async function guarded(res: ServerResponse, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (err) {
    if (err instanceof SalesInputError) {
      sendJson(res, 400, { error: err.message });
      return;
    }
    throw err;
  }
}

function readYear(url: URL): number | null {
  const year = Number(url.searchParams.get("year"));
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

/** An admin-only write: 403 for anyone else, then the body, then the work. */
async function adminWrite(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: SalesRequestContext,
  work: (data: Record<string, unknown>) => Promise<void>,
): Promise<void> {
  if (!ctx.isAdmin) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  const data = await readObject(req, res);
  if (data) {
    await guarded(res, () => work(data));
  }
}

export async function handleSalesAdminRequest(
  subPath: string,
  req: IncomingMessage,
  res: ServerResponse,
  ctx: SalesRequestContext,
  deps: SalesDeps = {},
): Promise<boolean> {
  if (subPath !== "/sales-dashboard" && !subPath.startsWith("/sales-dashboard/")) {
    return false;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";
  const now = (deps.now ?? Date.now)();

  if (subPath === "/sales-dashboard" && method === "GET") {
    const wanted = url.searchParams.get("month");
    const match = wanted ? /^(\d{4})-(\d{2})$/.exec(wanted) : null;
    // With no month asked for, show the one yesterday belongs to: on the 1st,
    // the month just finished is the one with numbers in it.
    const fallback = addDays(accountToday(now), -1);
    const year = Number(match ? match[1] : fallback.slice(0, 4));
    const month = Number(match ? match[2] : fallback.slice(5, 7));
    if ((wanted && !match) || month < 1 || month > 12 || year < 2000 || year > 2100) {
      sendJson(res, 400, { error: "month must be YYYY-MM" });
      return true;
    }
    const dashboard = await getSalesDashboard({ year, month, now });
    sendJson(res, 200, { ...dashboard, canEdit: ctx.isAdmin });
    return true;
  }

  // A read can run for minutes the first time, so it is started, not awaited;
  // the page watches `sync.running`.
  if (subPath === "/sales-dashboard/refresh" && method === "POST") {
    void refreshSalesData(deps.sweep).catch(() => {
      // Recorded on the sync row, which the page shows.
    });
    sendJson(res, 202, { ok: true, sync: await getSalesSync() });
    return true;
  }

  if (subPath === "/sales-dashboard/markets") {
    if (method === "GET") {
      const lastYear = Number(accountToday(now).slice(0, 4)) - 1;
      sendJson(res, 200, {
        markets: await listSalesMarkets(),
        suggestions: await suggestSalesMarkets(`${lastYear}-01-01`),
      });
      return true;
    }
    if (method === "POST") {
      await adminWrite(req, res, ctx, async (data) => {
        const market = await addSalesMarket(data, ctx.actorName, now);
        sendJson(res, 201, { market, markets: await listSalesMarkets() });
      });
      return true;
    }
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }

  const marketMatch = /^\/sales-dashboard\/markets\/([^/]+)$/.exec(subPath);
  if (marketMatch) {
    if (method !== "PATCH") {
      sendJson(res, 405, { error: "method_not_allowed" });
      return true;
    }
    await adminWrite(req, res, ctx, async (data) => {
      const market = await setSalesMarketRemoval(
        decodeURIComponent(marketMatch[1] ?? ""),
        data,
        now,
      );
      if (!market) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      sendJson(res, 200, { market, markets: await listSalesMarkets() });
    });
    return true;
  }

  if (subPath === "/sales-dashboard/goals") {
    if (method === "GET") {
      const year = readYear(url);
      if (year === null) {
        sendJson(res, 400, { error: "year must be a four-digit year" });
        return true;
      }
      sendJson(res, 200, {
        year,
        goals: await listSalesGoals(year),
        markets: await listSalesMarkets(),
      });
      return true;
    }
    if (method === "PUT") {
      await adminWrite(req, res, ctx, async (data) => {
        sendJson(res, 200, { goals: await saveSalesGoals(data, ctx.actorName, now) });
      });
      return true;
    }
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }

  if (subPath === "/sales-dashboard/listings") {
    if (method === "GET") {
      const year = readYear(url);
      if (year === null) {
        sendJson(res, 400, { error: "year must be a four-digit year" });
        return true;
      }
      sendJson(res, 200, {
        year,
        listings: await listSalesListings(year),
        markets: await listSalesMarkets(),
      });
      return true;
    }
    if (method === "PUT") {
      await adminWrite(req, res, ctx, async (data) => {
        sendJson(res, 200, { listings: await saveSalesListings(data, ctx.actorName, now) });
      });
      return true;
    }
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }

  if (subPath === "/sales-dashboard/holidays") {
    if (method === "GET") {
      sendJson(res, 200, { holidays: await listSalesHolidays() });
      return true;
    }
    if (method === "POST") {
      await adminWrite(req, res, ctx, async (data) => {
        const holiday = await addSalesHoliday(data, ctx.actorName, now);
        sendJson(res, 201, { holiday, holidays: await listSalesHolidays() });
      });
      return true;
    }
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }

  const holidayMatch = /^\/sales-dashboard\/holidays\/([^/]+)$/.exec(subPath);
  if (holidayMatch) {
    if (method !== "DELETE") {
      sendJson(res, 405, { error: "method_not_allowed" });
      return true;
    }
    if (!ctx.isAdmin) {
      sendJson(res, 403, { error: "forbidden" });
      return true;
    }
    const day = decodeURIComponent(holidayMatch[1] ?? "");
    const removed = isYmd(day) && (await deleteSalesHoliday(day));
    sendJson(res, removed ? 200 : 404, removed ? { ok: true } : { error: "not_found" });
    return true;
  }

  sendJson(res, 404, { error: "not_found" });
  return true;
}
