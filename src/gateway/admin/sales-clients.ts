// New clients, for the sales dashboard.
//
// Steve's rule (2026-09-15): a client counts as new in the month of their first
// paid order that is either
//   - first-ever: they have never had a paid order before, or
//   - returning:  their last paid order was more than 12 months earlier.
// "Paid" means a total above $0, the same scrub the unit counts use.
//
// The order cache reaches back to January 1 of the year before the first read
// (the floor), so for any order in a later year the twelve months before it are
// cached and "returning" is decided from the cache alone. "First-ever" is not:
// an agent whose first cached paid order is after the floor may still have
// ordered before it. That one fact per agent is asked of Spiro — a summary of
// their orders from 2020, when the account's history starts, up to the floor —
// and kept, since the past does not change.

import { addDays, maxYmd, oneYearBefore } from "./sales-calendar.js";
import { asObject, callSpiro, quote, type SpiroIo, SpiroReadError } from "./sales-spiro.js";
import { getAdminDb } from "./user-store.js";

const SUMMARY_TOOL = "summarize_spiro_reporting_orders";
/** The account's first orders were placed in 2020 (two that year); nothing earlier exists. */
export const HISTORY_START = "2020-01-01";
/** Spiro's cap on a summary's range. */
const SUMMARY_SPAN_DAYS = 1096;
/** A pause between agents, so the history check never crowds out other sweeps on the key. */
const PROBE_GAP_MS = 1000;
export const CLIENT_PROBES_PER_RUN = 150;

export type ClientKind = "first" | "returning";

export type PaidOrder = { agentId: string; day: string; marketKey: string };

export type ClientEvent = { agentId: string; day: string; marketKey: string; kind: ClientKind };

/**
 * Find each agent's new-client order within `range`.
 *
 * `orders` are paid orders from the floor onward. `priorPaid` says, per agent,
 * whether they had a paid order before the floor; an agent missing from it who
 * needs the answer is returned as pending and counted nowhere until it is known.
 *
 * The caller keeps `range.from` at least a year after the floor, which is what
 * lets an agent with only pre-floor history be called returning without knowing
 * the date of that history.
 *
 * At most one event per agent: within a year there is no room for a second gap
 * of twelve months.
 */
export function classifyClients(
  orders: readonly PaidOrder[],
  priorPaid: ReadonlyMap<string, boolean>,
  range: { from: string; to: string },
): { events: ClientEvent[]; pendingAgents: string[] } {
  const byAgent = new Map<string, PaidOrder[]>();
  for (const order of orders) {
    if (order.day > range.to) {
      continue;
    }
    const list = byAgent.get(order.agentId);
    if (list) {
      list.push(order);
    } else {
      byAgent.set(order.agentId, [order]);
    }
  }

  const events: ClientEvent[] = [];
  const pending: string[] = [];
  for (const [agentId, list] of byAgent) {
    list.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    let previous: string | null = null;
    for (const order of list) {
      if (order.day >= range.from) {
        if (previous === null) {
          const hadPaid = priorPaid.get(agentId);
          if (hadPaid === undefined) {
            pending.push(agentId);
          } else {
            events.push({
              agentId,
              day: order.day,
              marketKey: order.marketKey,
              kind: hadPaid ? "returning" : "first",
            });
          }
          break;
        }
        if (previous < oneYearBefore(order.day)) {
          events.push({ agentId, day: order.day, marketKey: order.marketKey, kind: "returning" });
          break;
        }
      }
      previous = order.day;
    }
  }
  return { events, pendingAgents: pending.toSorted() };
}

/** Whether an agent had any paid order before `floor`, newest span asked first. */
export async function probePriorPaid(
  io: SpiroIo,
  agentId: string,
  floor: string,
): Promise<boolean> {
  let to = addDays(floor, -1);
  while (to >= HISTORY_START) {
    const from = maxYmd(HISTORY_START, addDays(to, -(SUMMARY_SPAN_DAYS - 1)));
    const { data } = await callSpiro(io, SUMMARY_TOOL, { agentId, from, to, span: "year" });
    if (!Array.isArray(data)) {
      throw new SpiroReadError(`Spiro answered without a summary: ${quote(data)}`, "other");
    }
    const paid = data.some((bucket) => {
      const total = asObject(bucket)?.orderTotal;
      return typeof total === "number" && total > 0;
    });
    if (paid) {
      return true;
    }
    to = addDays(from, -1);
  }
  return false;
}

/**
 * Ask Spiro about agents whose answer the dashboard is waiting on, most recent
 * first, up to `budget` of them. Only agents whose first cached paid order falls
 * in a year the dashboard can show need asking.
 */
export async function resolveClientHistory(
  io: SpiroIo,
  floor: string,
  opts: { budget: number; now: number },
): Promise<{ checked: number; pending: number }> {
  const db = getAdminDb();
  const yearAfterFloor = `${Number(floor.slice(0, 4)) + 1}-01-01`;
  const rows = await db
    .selectFrom("admin_sales_orders as o")
    .leftJoin("admin_sales_agent_history as h", "h.agent_id", "o.agent_id")
    .select((eb) => ["o.agent_id", eb.fn.min<string>("o.order_day").as("first_day")])
    .where("o.total_cents", ">", 0)
    .where("o.agent_id", "is not", null)
    .where("h.agent_id", "is", null)
    .groupBy("o.agent_id")
    .execute();
  const waiting = rows
    .filter((r): r is { agent_id: string; first_day: string } => !!r.agent_id)
    .filter((r) => r.first_day >= yearAfterFloor)
    .toSorted((a, b) => (a.first_day < b.first_day ? 1 : a.first_day > b.first_day ? -1 : 0));

  let checked = 0;
  for (const row of waiting.slice(0, opts.budget)) {
    if (checked > 0) {
      await io.sleep(PROBE_GAP_MS);
    }
    const hadPaid = (await probePriorPaid(io, row.agent_id, floor)) ? 1 : 0;
    await db
      .insertInto("admin_sales_agent_history")
      .values({ agent_id: row.agent_id, floor, had_paid: hadPaid, checked_at: opts.now })
      .onConflict((oc) =>
        oc.column("agent_id").doUpdateSet({ floor, had_paid: hadPaid, checked_at: opts.now }),
      )
      .execute();
    checked++;
  }
  return { checked, pending: waiting.length - checked };
}
