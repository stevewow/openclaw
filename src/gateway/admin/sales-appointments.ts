// Spiro appointments for the sales dashboard: the day each order's shoot
// happened.
//
// An order counts once its shoot is done, on the day of the shoot (Steve,
// 2026-09-15), and the reporting orders carry only the day an order was placed.
// So appointments are cached too, one row each under the day of their arrival
// window, and replaced a span of days at a time like the orders. Planning and
// coverage live with the order sweep (sales-orders.ts); this file reads and
// stores.
//
// Spiro caps an appointments page at 100 rows and about 65 appointments land on
// a weekday, so a span is read a day at a time: nearly every day is one page, and
// no row can slip between two pages of a list that changed mid-read.

import { addDays } from "./sales-calendar.js";
import { asObject, callSpiro, quote, type SpiroIo, SpiroReadError, str } from "./sales-spiro.js";
import { getAdminDb } from "./user-store.js";

const APPOINTMENTS_TOOL = "search_spiro_appointments";
export const APPOINTMENT_SYNC_ID = "appointments";
/** The public API's cap, whatever is asked for. */
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const INSERT_CHUNK = 200;

export type SalesAppointmentRow = {
  appointment_id: string;
  order_id: string;
  arrival_day: string;
  status: string;
};

/**
 * One appointment. The day is read off the arrival window's own text
 * (`2026-09-10T08:30:00-04:00`), which Spiro writes in the account's timezone.
 */
export function toAppointmentRow(raw: Record<string, unknown>): SalesAppointmentRow | null {
  const appointmentId = str(raw.appointmentId);
  const orderId = str(raw.orderId) ?? str(asObject(raw.order)?.orderId);
  const start = str(asObject(raw.events)?.arrivalWindowStart);
  const day = start ? start.slice(0, 10) : null;
  if (!appointmentId || !orderId || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return null;
  }
  return {
    appointment_id: appointmentId,
    order_id: orderId,
    arrival_day: day,
    status: (str(raw.status) ?? "unknown").toLowerCase(),
  };
}

async function readDay(io: SpiroIo, day: string): Promise<SalesAppointmentRow[]> {
  const rows = new Map<string, SalesAppointmentRow>();
  for (let page = 1; ; page++) {
    if (page > MAX_PAGES) {
      throw new SpiroReadError(`Appointments on ${day} ran past ${MAX_PAGES} pages`, "other");
    }
    const { data, meta } = await callSpiro(io, APPOINTMENTS_TOOL, {
      arrivalWindowStartFrom: `${day}T00:00:00`,
      arrivalWindowStartTo: `${day}T23:59:59`,
      sort: "arrivalWindowStart",
      page,
      pageSize: PAGE_SIZE,
    });
    if (!Array.isArray(data)) {
      throw new SpiroReadError(
        `Spiro answered without an appointment list: ${quote(data)}`,
        "other",
      );
    }
    for (const raw of data) {
      const obj = asObject(raw);
      const row = obj ? toAppointmentRow(obj) : null;
      if (row) {
        rows.set(row.appointment_id, row);
      }
    }
    if (meta?.hasNextPage !== true || data.length === 0) {
      return [...rows.values()];
    }
  }
}

/** Every appointment whose arrival window starts from `from` to `to`, both included. */
export async function readAppointmentSpan(
  io: SpiroIo,
  from: string,
  to: string,
): Promise<SalesAppointmentRow[]> {
  const rows: SalesAppointmentRow[] = [];
  for (let day = to; day >= from; day = addDays(day, -1)) {
    rows.push(...(await readDay(io, day)));
  }
  return rows;
}

/** Replace a span's appointments with what was just read, and record the coverage given. */
export async function storeAppointmentSpan(
  from: string,
  to: string,
  rows: readonly SalesAppointmentRow[],
  coverage: { coveredFrom: string; coveredTo: string },
): Promise<void> {
  const inSpan = new Map<string, SalesAppointmentRow>();
  for (const row of rows) {
    if (row.arrival_day >= from && row.arrival_day <= to) {
      inSpan.set(row.appointment_id, row);
    }
  }
  const list = [...inSpan.values()];
  await getAdminDb()
    .transaction()
    .execute(async (trx) => {
      await trx
        .deleteFrom("admin_sales_appointments")
        .where("arrival_day", ">=", from)
        .where("arrival_day", "<=", to)
        .execute();
      for (let i = 0; i < list.length; i += INSERT_CHUNK) {
        const chunk = list.slice(i, i + INSERT_CHUNK);
        // A rescheduled appointment moves days; clear it wherever it sat before.
        await trx
          .deleteFrom("admin_sales_appointments")
          .where(
            "appointment_id",
            "in",
            chunk.map((r) => r.appointment_id),
          )
          .execute();
        await trx.insertInto("admin_sales_appointments").values(chunk).execute();
      }
      await trx
        .updateTable("admin_sales_sync")
        .set({ covered_from: coverage.coveredFrom, covered_to: coverage.coveredTo })
        .where("id", "=", APPOINTMENT_SYNC_ID)
        .execute();
    });
}
