// Every delivery event Spiro sends, kept whole.
//
// The raw body is stored for the same reason the parser is defensive: nobody
// has documented what Spiro posts, so the first real event is the spec. An
// event that matched nothing is worth more here than in a log line — it can be
// read, mapped, and replayed once the mapping is fixed.
//
// The table is also the dedupe: one task per order, decided by asking whether
// this order already has an event that made one. Spiro's retry behavior is
// unknown, and a delivery that fires twice must not give Maricel two of the
// same card.

import { randomUUID } from "node:crypto";
import { getAdminDb } from "./user-store.js";

/**
 * What became of an event. A closed set rather than free text: the events view
 * groups by it, and "why did nothing happen" is the question it exists to
 * answer.
 */
export type SpiroHookOutcome =
  /** Bundle matched, task created. */
  | "created"
  /** Bundle matched, but this order already had a task. */
  | "duplicate"
  /** Read fine, bundle was something else. Most events land here. */
  | "ignored_bundle"
  /** No order id anywhere in the payload — the mapping needs a look. */
  | "no_order"
  /** Had an order id, but the bundle could not be established. */
  | "unresolved";

export type SpiroHookEvent = {
  id: string;
  receivedAt: number;
  eventName: string | null;
  orderId: string | null;
  orderNumber: string | null;
  bundleName: string | null;
  /** Where the bundle name came from: the payload, or Spiro's own order record. */
  bundleSource: "payload" | "spiro" | null;
  outcome: SpiroHookOutcome;
  detail: string | null;
  taskId: string | null;
  /** The body exactly as posted, so a mapping can be fixed against the truth. */
  raw: string;
};

type Row = {
  id: string;
  received_at: number;
  event_name: string | null;
  order_id: string | null;
  order_number: string | null;
  bundle_name: string | null;
  bundle_source: string | null;
  outcome: string;
  detail: string | null;
  task_id: string | null;
  raw: string;
};

function rowToEvent(row: Row): SpiroHookEvent {
  return {
    id: row.id,
    receivedAt: row.received_at,
    eventName: row.event_name,
    orderId: row.order_id,
    orderNumber: row.order_number,
    bundleName: row.bundle_name,
    bundleSource:
      row.bundle_source === "payload" || row.bundle_source === "spiro" ? row.bundle_source : null,
    outcome: row.outcome as SpiroHookOutcome,
    detail: row.detail,
    taskId: row.task_id,
    raw: row.raw,
  };
}

export type RecordHookEventParams = {
  eventName?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  bundleName?: string | null;
  bundleSource?: "payload" | "spiro" | null;
  outcome: SpiroHookOutcome;
  detail?: string | null;
  taskId?: string | null;
  raw: string;
  now?: number;
};

/** A body larger than this is not a delivery event; store the head of it. */
const MAX_RAW_BYTES = 32 * 1024;

export async function recordHookEvent(params: RecordHookEventParams): Promise<SpiroHookEvent> {
  const db = getAdminDb();
  const id = randomUUID();
  const receivedAt = params.now ?? Date.now();
  const raw =
    params.raw.length > MAX_RAW_BYTES
      ? `${params.raw.slice(0, MAX_RAW_BYTES)}…[truncated]`
      : params.raw;
  await db
    .insertInto("admin_spiro_hook_events")
    .values({
      id,
      received_at: receivedAt,
      event_name: params.eventName ?? null,
      order_id: params.orderId ?? null,
      order_number: params.orderNumber ?? null,
      bundle_name: params.bundleName ?? null,
      bundle_source: params.bundleSource ?? null,
      outcome: params.outcome,
      detail: params.detail ?? null,
      task_id: params.taskId ?? null,
      raw,
    })
    .execute();
  return {
    id,
    receivedAt,
    eventName: params.eventName ?? null,
    orderId: params.orderId ?? null,
    orderNumber: params.orderNumber ?? null,
    bundleName: params.bundleName ?? null,
    bundleSource: params.bundleSource ?? null,
    outcome: params.outcome,
    detail: params.detail ?? null,
    taskId: params.taskId ?? null,
    raw,
  };
}

/**
 * The task already raised for this order, if there is one.
 *
 * Joined against `admin_tasks` rather than trusting the stored id: a task
 * deleted by hand should let the next event raise a fresh one, otherwise a
 * mistaken delete silently retires the order forever.
 */
export async function findTaskForOrder(orderId: string): Promise<string | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_spiro_hook_events")
    .innerJoin("admin_tasks", "admin_tasks.id", "admin_spiro_hook_events.task_id")
    .select("admin_spiro_hook_events.task_id as task_id")
    .where("admin_spiro_hook_events.order_id", "=", orderId)
    .where("admin_spiro_hook_events.task_id", "is not", null)
    .orderBy("admin_spiro_hook_events.received_at", "desc")
    .executeTakeFirst();
  return (row?.task_id as string | undefined) ?? null;
}

export async function listHookEvents(limit = 50): Promise<SpiroHookEvent[]> {
  const db = getAdminDb();
  const rows = (await db
    .selectFrom("admin_spiro_hook_events")
    .selectAll()
    .orderBy("received_at", "desc")
    .limit(Math.min(Math.max(limit, 1), 200))
    .execute()) as Row[];
  return rows.map(rowToEvent);
}

export async function getHookEvent(id: string): Promise<SpiroHookEvent | null> {
  const db = getAdminDb();
  const row = (await db
    .selectFrom("admin_spiro_hook_events")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst()) as Row | undefined;
  return row ? rowToEvent(row) : null;
}
