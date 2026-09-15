// Talking to Spiro for the sales dashboard: unwrap what the MCP layer hands
// back, wait out the rate limit, and tell a timeout apart from everything else.
//
// The dashboard shares one Spiro API key with every other sweep the gateway
// runs, and that key is rate limited — "retry in about a minute" after roughly
// fifty quick calls (measured 2026-09-15). The reporting endpoint also times out
// on a wide range at a large page size. Both are normal here, so both are
// conditions rather than failures: a rate limit waits, and a timeout goes back
// to the caller to narrow what it asked for.

export type SpiroCall = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/**
 * Order statuses, as the cache stores them (lower case), that mean the shoot is
 * done and the order can no longer be cancelled out from under the numbers.
 * Everything before — pending, confirmed, rescheduled, in progress — is not yet
 * secured; cancelled never is.
 */
export const COMPLETED_ORDER_STATUSES: readonly string[] = [
  "appointmentcompleted",
  "editing",
  "delivered",
];

export type SpiroFailure = "rate_limited" | "timeout" | "not_found" | "other";

export class SpiroReadError extends Error {
  readonly kind: SpiroFailure;

  constructor(message: string, kind: SpiroFailure) {
    super(message);
    this.name = "SpiroReadError";
    this.kind = kind;
  }
}

export type SpiroIo = {
  call: SpiroCall;
  sleep: (ms: number) => Promise<void>;
  /** Calls made so far, for the sweep's summary. */
  calls: number;
};

const RATE_LIMIT_WAIT_MS = 65_000;
const MAX_RATE_LIMIT_WAITS = 5;
const RETRY_DELAYS_MS: readonly number[] = [1000, 3000];

export function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The first 200 characters of whatever came back, for an error message. */
export function quote(value: unknown): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return (raw ?? String(value)).slice(0, 200);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function failureFor(status: number | null, text: string): SpiroFailure {
  if (status === 429 || /rate limit/i.test(text)) {
    return "rate_limited";
  }
  if (status === 504 || status === 408 || /timeout|timed out/i.test(text)) {
    return "timeout";
  }
  if (status === 404) {
    return "not_found";
  }
  return "other";
}

/**
 * Unwrap `{content:[{type:"text", text:"<json>"}]}`. Spiro's own errors arrive
 * inside that envelope as `{error, statusCode, body}` rather than as a throw,
 * so they are raised here — a 504 that parsed as "no rows" would read as a day
 * with no orders.
 */
export function parseSpiroReply(result: unknown): {
  data: unknown;
  meta: Record<string, unknown> | null;
} {
  let payload: unknown = result;
  const content = asObject(result)?.content;
  if (Array.isArray(content)) {
    const part = content
      .map((c) => asObject(c))
      .find((c) => c?.type === "text" && typeof c.text === "string");
    const text = typeof part?.text === "string" ? part.text : null;
    if (text !== null) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        throw new SpiroReadError(`Spiro answered: ${quote(text)}`, failureFor(null, text));
      }
    }
  }
  const obj = asObject(payload);
  if (!obj) {
    throw new SpiroReadError(`Spiro answered with nothing usable: ${quote(payload)}`, "other");
  }
  const status = typeof obj.statusCode === "number" ? obj.statusCode : null;
  if (typeof obj.error === "string" || (status !== null && status >= 400)) {
    const detail = typeof obj.body === "string" ? obj.body : JSON.stringify(obj.body ?? obj.error);
    throw new SpiroReadError(
      `Spiro answered ${status ?? "with an error"}: ${quote(detail)}`,
      failureFor(status, detail),
    );
  }
  return { data: "data" in obj ? obj.data : obj, meta: asObject(obj.meta) };
}

/**
 * One Spiro call. A rate limit waits a minute and asks again; an unexplained
 * failure is retried twice; a timeout or a missing record is the caller's to
 * handle, since only the caller knows how to ask for less.
 */
export async function callSpiro(
  io: SpiroIo,
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; meta: Record<string, unknown> | null }> {
  let rateLimitWaits = 0;
  let retries = 0;
  for (;;) {
    io.calls++;
    let failure: SpiroReadError;
    try {
      return parseSpiroReply(await io.call(name, args));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failure =
        err instanceof SpiroReadError
          ? err
          : new SpiroReadError(message, failureFor(null, message));
    }
    if (failure.kind === "rate_limited" && rateLimitWaits < MAX_RATE_LIMIT_WAITS) {
      rateLimitWaits++;
      await io.sleep(RATE_LIMIT_WAIT_MS);
      continue;
    }
    if (failure.kind === "other" && retries < RETRY_DELAYS_MS.length) {
      await io.sleep(RETRY_DELAYS_MS[retries] ?? 1000);
      retries++;
      continue;
    }
    throw failure;
  }
}
