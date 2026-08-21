// How often one visitor may press a button on the public help center.
//
// Liking an article and voting it useful are the first writes the help center
// accepts from an unauthenticated client that were not simply a page being
// read. They cost nothing to serve and nothing to store, so the risk is not
// spend — it is a script quietly making one article look loved, or burying
// another under votes nobody cast.
//
// The defence is the same shape as kb-ask-limits.ts and for the same reason:
// an in-memory window keyed on the client address, held for an hour and
// written down nowhere. The help center records how many, never who, and a
// table of addresses would end that whether or not anyone read it. A restart
// forgiving a few presses is the price.
//
// This shapes ordinary traffic; it does not hold a line against a determined
// abuser, who can rotate `x-forwarded-for` the same way they can against the
// ask limiter. What holds is that the worst outcome is a wrong number on a
// report, not a cost or a leak — which is why nothing further is spent here.

import type { IncomingMessage } from "node:http";
import { clientKey } from "./kb-ask-limits.js";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Presses per client. Generous on purpose: someone working through the help
 * center may genuinely like four articles in a minute, and a limit that
 * catches real use to catch a script is the wrong limit.
 */
const PER_MINUTE = 10;
const PER_HOUR = 60;

/** Press times for one client, newest last. Trimmed on every read. */
const recent = new Map<string, number[]>();

/**
 * Bound the map. Without this a rotating `x-forwarded-for` grows it forever and
 * the limiter becomes the memory leak it exists to prevent.
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

/**
 * May this client press right now?
 *
 * Records the press when it says yes, so callers must not ask twice about one
 * request.
 */
export function checkEngagementAllowance(
  req: IncomingMessage,
  opts: { now?: number } = {},
): boolean {
  const now = opts.now ?? Date.now();
  const key = clientKey(req);

  if (recent.size > MAX_TRACKED_CLIENTS) {
    prune(now);
    if (recent.size > MAX_TRACKED_CLIENTS) {
      recent.clear();
    }
  }

  const times = (recent.get(key) ?? []).filter((t) => now - t < HOUR);
  const lastMinute = times.filter((t) => now - t < MINUTE).length;
  if (lastMinute >= PER_MINUTE || times.length >= PER_HOUR) {
    recent.set(key, times);
    return false;
  }
  times.push(now);
  recent.set(key, times);
  return true;
}

/** Tests share a module registry; state that outlives a case would leak into the next. */
export function resetEngagementLimits(): void {
  recent.clear();
}
