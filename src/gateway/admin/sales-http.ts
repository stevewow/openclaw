// Admin routes for the sales dashboard, under /api/admin/sales-dashboard.
//
// Auth and the `sales-dashboard` feature gate run in admin-http.ts before
// anything here. Whoever holds the grant may read the dashboard and ask for a
// fresh Spiro read; goals and the holiday list are an admin's to change, since
// they decide what every percentage on the page means.

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
  listSalesMarkets,
  SalesInputError,
  saveSalesGoals,
} from "./sales-dashboard.js";
import { getSalesSync, refreshSalesData, type SalesSweepDeps } from "./sales-orders.js";

const MAX_BODY_BYTES = 128 * 1024;

export type SalesRequestContext = {
  actorName: string;
  /** Only an admin may change goals or holidays. */
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

  if (subPath === "/sales-dashboard/goals") {
    if (method === "GET") {
      const year = Number(url.searchParams.get("year"));
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        sendJson(res, 400, { error: "year must be a four-digit year" });
        return true;
      }
      sendJson(res, 200, {
        year,
        goals: await listSalesGoals(year),
        markets: await listSalesMarkets(year),
      });
      return true;
    }
    if (method === "PUT") {
      if (!ctx.isAdmin) {
        sendJson(res, 403, { error: "forbidden" });
        return true;
      }
      const data = await readObject(req, res);
      if (data) {
        await guarded(res, async () => {
          sendJson(res, 200, { goals: await saveSalesGoals(data, ctx.actorName, now) });
        });
      }
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
      if (!ctx.isAdmin) {
        sendJson(res, 403, { error: "forbidden" });
        return true;
      }
      const data = await readObject(req, res);
      if (data) {
        await guarded(res, async () => {
          const holiday = await addSalesHoliday(data, ctx.actorName, now);
          sendJson(res, 201, { holiday, holidays: await listSalesHolidays() });
        });
      }
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
