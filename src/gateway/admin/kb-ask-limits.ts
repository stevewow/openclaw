// What the answering box is allowed to cost, and how often one visitor may use
// it.
//
// Two ceilings, deliberately different in kind:
//
//   * a per-client rate limit, held in memory and never written down. The help
//     center records what was asked and not who asked it, and that promise
//     would not survive a table of addresses — so the address lives in RAM for
//     a few minutes and nowhere else. A restart forgiving a few requests is a
//     price worth paying for it; the daily ceiling below is the real backstop.
//   * a daily ceiling on the total number of questions, counted from the ask
//     log. This one is the answer to "what is the worst this can cost me": once
//     it is reached the box stops being offered until tomorrow, whatever anyone
//     does.

import type { IncomingMessage } from "node:http";
import { countKbAsksSince } from "./kb-ask-store.js";

/** Off unless a key is configured. There is no default model credential here. */
export function askApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.ANTHROPIC_API_KEY?.trim() || null;
}

/**
 * The model behind the box.
 *
 * Overridable because it is the one knob that changes what an answer costs, and
 * that is an operator's call rather than something to bury in a build.
 */
export function askModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.KB_ASK_MODEL?.trim() || "claude-opus-5";
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Questions from everyone, per day, before the box switches itself off. */
export function askDailyCap(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.KB_ASK_DAILY_CAP, 200);
}

/** Questions from one client per hour. */
export function askClientHourlyCap(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.KB_ASK_CLIENT_HOURLY_CAP, 10);
}

/** Questions from one client per minute, so a script cannot spend the hour at once. */
export function askClientMinuteCap(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.KB_ASK_CLIENT_MINUTE_CAP, 3);
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Who a rate limit applies to.
 *
 * The gateway sits behind a proxy on this deployment, so the socket address is
 * the proxy's for every visitor and `x-forwarded-for` is what distinguishes
 * them. The header is client-controlled and therefore forgeable — a determined
 * abuser can rotate it and buy themselves more per-client allowance. That is
 * why the daily ceiling exists and is counted server-side from the log: this
 * function shapes ordinary traffic, it does not hold the line.
 */
export function clientKey(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const claimed = first?.split(",")[0]?.trim();
  return claimed || req.socket?.remoteAddress || "unknown";
}

/** Ask times for one client, newest last. Trimmed on every read. */
const recent = new Map<string, number[]>();

/**
 * Bound the map itself. Without this, a rotating `x-forwarded-for` grows it
 * forever — the limiter would become the memory leak it exists to prevent.
 */
const MAX_TRACKED_CLIENTS = 10_000;

function prune(now: number): void {
  for (const [key, times] of recent) {
    const live = times.filter((t) => now - t < HOUR);
    if (live.length === 0) {
      recent.delete(key);
    } else {
      recent.set(key, live);
    }
  }
}

export type AskAllowance =
  | { allowed: true }
  | { allowed: false; reason: "client_rate" | "daily_cap" };

/**
 * May this client ask right now?
 *
 * Checks the cheap in-memory limits before the daily count, so a client already
 * over their own limit costs a map lookup rather than a query.
 */
export async function checkAskAllowance(
  req: IncomingMessage,
  opts: { now?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<AskAllowance> {
  const now = opts.now ?? Date.now();
  const env = opts.env ?? process.env;
  const key = clientKey(req);

  if (recent.size > MAX_TRACKED_CLIENTS) {
    prune(now);
    if (recent.size > MAX_TRACKED_CLIENTS) {
      recent.clear();
    }
  }

  const times = (recent.get(key) ?? []).filter((t) => now - t < HOUR);
  const lastMinute = times.filter((t) => now - t < MINUTE).length;
  if (lastMinute >= askClientMinuteCap(env) || times.length >= askClientHourlyCap(env)) {
    recent.set(key, times);
    return { allowed: false, reason: "client_rate" };
  }

  const startOfDay = now - (now % (24 * HOUR));
  if ((await countKbAsksSince(startOfDay)) >= askDailyCap(env)) {
    return { allowed: false, reason: "daily_cap" };
  }

  times.push(now);
  recent.set(key, times);
  return { allowed: true };
}

/** Tests share a module registry; state that outlives a case would leak into the next. */
export function resetAskLimits(): void {
  recent.clear();
}
