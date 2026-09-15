// Days, for the sales dashboard. Everything is a `YYYY-MM-DD` string in the
// Spiro account's timezone — the same text Spiro writes on an order — so no
// timezone conversion can slide an evening order into the next day.
//
// A business day is Monday to Friday and not on the holiday list the team keeps
// in the Hub. The sheet this replaces counted weekdays only; the list is what
// stops Thanksgiving counting against the month's pace.

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isYmd(value: unknown): value is string {
  if (typeof value !== "string" || !YMD.test(value)) {
    return false;
  }
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function minYmd(a: string, b: string): string {
  return a < b ? a : b;
}

export function maxYmd(a: string, b: string): string {
  return a > b ? a : b;
}

/** Days from `from` to `to`, both included. */
export function dayCount(from: string, to: string): number {
  return (
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  );
}

export function monthStart(year: number, month: number): string {
  return `${year}-${pad(month)}-01`;
}

export function monthEnd(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

/** The same date a year earlier; February 29 becomes February 28. */
export function oneYearBefore(ymd: string): string {
  const year = Number(ymd.slice(0, 4)) - 1;
  const month = Number(ymd.slice(5, 7));
  const lastDay = Number(monthEnd(year, month).slice(8, 10));
  const day = Math.min(Number(ymd.slice(8, 10)), lastDay);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Business days from `from` to `to`, both included; zero when `to` is earlier. */
export function businessDays(from: string, to: string, holidays: ReadonlySet<string>): number {
  let count = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(day)) {
      count++;
    }
  }
  return count;
}
