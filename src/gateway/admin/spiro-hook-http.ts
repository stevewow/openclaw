// The endpoint Spiro's delivery webhook posts to.
//
// Public, like the lead and ticket intakes, and trusted by a shared secret
// rather than by the network: Spiro has to be able to reach it from outside.
// Set SPIRO_WEBHOOK_TOKEN and the token must arrive in the URL (`?token=`) or
// in an `X-Webhook-Token` header. With no token configured it accepts anything
// and says so once in the log — the same posture as the lead intake, and the
// reason the setup notes ask for a token before the hook is pointed here.
//
// Everything that arrives is recorded before anything is decided, so a payload
// that does not parse the way this code expects is still readable afterwards.
// That is the point: Spiro publishes no webhook contract, and the first real
// event is the only specification there will be.
//
// Answers 200 to anything it has stored, including events it deliberately
// ignored. A non-2xx is reserved for "we did not take this, send it again" —
// otherwise an unknown retry policy on Spiro's side turns one ignored delivery
// into a retry loop.

import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson, setDefaultSecurityHeaders } from "../http-common.js";
import { readHookFacts, type SpiroHookFacts } from "./spiro-hook-payload.js";
import {
  findTaskForOrder,
  recordHookEvent,
  type SpiroHookEvent,
  type SpiroHookOutcome,
} from "./spiro-hook-store.js";
import {
  bundleMatches,
  createStockMediaTask,
  fetchOrderDetail,
  orderFromDetail,
  orderFromFacts,
  type StockMediaOrder,
} from "./spiro-stock-media.js";
import { notifyTaskPeople } from "./task-notifier.js";

const HOOK_PATH = "/api/spiro/hook";
/** A delivery event is a few fields; an order detail dump is still far under this. */
const MAX_BODY_BYTES = 128 * 1024;

/** Deliveries arrive in ones and twos. This is an abuse ceiling, not a throttle. */
const RATE_LIMIT = 240;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

function rateLimited(req: IncomingMessage, now: number): boolean {
  const key = clientKey(req);
  const entry = hits.get(key);
  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) {
    return true;
  }
  entry.count += 1;
  return false;
}

/** Test seam: the throttle is process-wide and would leak between cases. */
export function resetSpiroHookRateLimit(): void {
  hits.clear();
}

async function readRawBody(
  req: IncomingMessage,
  maxBytes: number,
): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (r: { ok: true; body: string } | { ok: false; error: string }) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        finish({ ok: false, error: "payload too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => finish({ ok: true, body: Buffer.concat(chunks).toString("utf8") }));
    req.on("error", () => finish({ ok: false, error: "read error" }));
  });
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name];
  return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
}

export type HookAuth = { ok: true; mode: "token" | "open" } | { ok: false; reason: string };

/**
 * Constant-time-ish token compare. Length is allowed to leak; the token is a
 * shared secret in a URL Spiro holds, not a password store.
 */
function tokenMatches(expected: string, given: string | null): boolean {
  if (!given || given.length !== expected.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

export function authorizeHook(params: {
  urlToken: string | null;
  headerToken: string | undefined;
  env: NodeJS.ProcessEnv;
}): HookAuth {
  const expected = params.env.SPIRO_WEBHOOK_TOKEN?.trim();
  if (!expected) {
    return { ok: true, mode: "open" };
  }
  const given = params.urlToken ?? params.headerToken?.trim() ?? null;
  return tokenMatches(expected, given)
    ? { ok: true, mode: "token" }
    : { ok: false, reason: "bad token" };
}

export type HookLogger = { info: (m: string) => void; error: (m: string) => void };

export type SpiroHookDeps = {
  env?: NodeJS.ProcessEnv;
  logger?: HookLogger;
  /** Injected in tests so a delivery neither calls Spiro nor sends mail. */
  loadOrder?: (orderId: string) => Promise<StockMediaOrder | null>;
  createTask?: typeof createStockMediaTask;
  notify?: typeof notifyTaskPeople;
};

/** Spiro's own record, when it can be had. Failure is normal, not exceptional. */
async function defaultLoadOrder(orderId: string, log: HookLogger): Promise<StockMediaOrder | null> {
  try {
    const detail = await fetchOrderDetail(orderId);
    return detail ? orderFromDetail(orderId, detail) : null;
  } catch (err) {
    log.error(`could not read order ${orderId} from Spiro: ${String(err)}`);
    return null;
  }
}

export type HookDecision = {
  outcome: SpiroHookOutcome;
  detail: string | null;
  taskId: string | null;
  bundleName: string | null;
  bundleSource: "payload" | "spiro" | null;
  orderNumber: string | null;
};

/**
 * Decide what one event deserves.
 *
 * Spiro's own record wins over the payload's claim about the bundle: the
 * webhook is hearsay and the order is the account's answer. When Spiro cannot
 * be reached the payload's bundle is used if it carries one, and an event that
 * names neither is left `unresolved` rather than dropped — it is the case where
 * something real may have been missed, so it stays visible and replayable.
 */
export async function decideHook(
  facts: SpiroHookFacts,
  deps: SpiroHookDeps & { log: HookLogger },
): Promise<HookDecision> {
  const base = {
    taskId: null,
    bundleName: facts.bundleName,
    bundleSource: null,
    orderNumber: facts.orderNumber,
  } as const;
  if (!facts.orderId) {
    return {
      ...base,
      outcome: "no_order",
      detail: "no order id in the payload",
      bundleSource: null,
    };
  }

  const loadOrder = deps.loadOrder ?? ((id: string) => defaultLoadOrder(id, deps.log));
  const fromSpiro = await loadOrder(facts.orderId);
  const order = fromSpiro ?? orderFromFacts(facts);
  const bundleName = fromSpiro?.bundleName ?? facts.bundleName;
  const bundleSource: "payload" | "spiro" | null = fromSpiro?.bundleName
    ? "spiro"
    : facts.bundleName
      ? "payload"
      : null;
  const orderNumber = fromSpiro?.orderNumber ?? facts.orderNumber;

  if (!bundleName) {
    return {
      outcome: "unresolved",
      detail: "no bundle in the payload and Spiro could not be read",
      taskId: null,
      bundleName: null,
      bundleSource: null,
      orderNumber,
    };
  }
  if (!bundleMatches(bundleName)) {
    return {
      outcome: "ignored_bundle",
      detail: `bundle is ${bundleName}`,
      taskId: null,
      bundleName,
      bundleSource,
      orderNumber,
    };
  }

  // Matched. One task per order, whatever Spiro's retry policy turns out to be.
  const existing = await findTaskForOrder(facts.orderId);
  if (existing) {
    return {
      outcome: "duplicate",
      detail: "this order already has a task",
      taskId: existing,
      bundleName,
      bundleSource,
      orderNumber,
    };
  }

  const create = deps.createTask ?? createStockMediaTask;
  const result = await create(order as StockMediaOrder, { env: deps.env });
  // Told, not just given: the board is not somewhere anyone watches all day.
  if (result.assigneeId) {
    const notify = deps.notify ?? notifyTaskPeople;
    void Promise.resolve(
      notify(
        {
          kind: "assignment",
          task: result.task,
          recipientIds: [result.assigneeId],
          actor: { id: "spiro-hook", name: "Spiro" },
        },
        { env: deps.env },
      ),
    ).catch((err: unknown) => {
      deps.log.error(`assignment email failed for task ${result.task.id}: ${String(err)}`);
    });
  }
  return {
    outcome: "created",
    detail: result.assigneeId ? null : "nobody matched the configured assignee",
    taskId: result.task.id,
    bundleName,
    bundleSource,
    orderNumber,
  };
}

let warnedOpen = false;

/** Test seam: the "running without a token" warning fires once per process. */
export function resetSpiroHookWarning(): void {
  warnedOpen = false;
}

/**
 * Record and act on one event. Exported so a stored event can be replayed
 * through exactly the path a live delivery takes.
 */
export async function ingestHookBody(
  rawBody: string,
  deps: SpiroHookDeps = {},
): Promise<SpiroHookEvent> {
  const log = deps.logger ?? {
    info: (m: string) => console.log(`[spiro-hook] ${m}`),
    error: (m: string) => console.error(`[spiro-hook] ${m}`),
  };
  let payload: unknown = null;
  try {
    payload = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    // Kept, not rejected: a body that is not JSON is the loudest possible
    // signal that the mapping assumption is wrong, and it is only visible if
    // it is stored.
    return recordHookEvent({
      outcome: "no_order",
      detail: "body was not JSON",
      raw: rawBody,
    });
  }
  const facts = readHookFacts(payload);
  const decision = await decideHook(facts, { ...deps, log });
  const event = await recordHookEvent({
    eventName: facts.eventName,
    orderId: facts.orderId,
    orderNumber: decision.orderNumber,
    bundleName: decision.bundleName,
    bundleSource: decision.bundleSource,
    outcome: decision.outcome,
    detail: decision.detail,
    taskId: decision.taskId,
    raw: rawBody,
  });
  if (decision.outcome === "created") {
    log.info(`created task ${decision.taskId} for order ${facts.orderId}`);
  } else if (decision.outcome === "unresolved" || decision.outcome === "no_order") {
    log.info(`event ${event.id} needs a look: ${decision.detail ?? decision.outcome}`);
  }
  return event;
}

/**
 * POST /api/spiro/hook — one delivery event from Spiro.
 */
export async function handleSpiroHookRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: SpiroHookDeps = {},
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== HOOK_PATH) {
    return false;
  }
  setDefaultSecurityHeaders(res);
  const env = deps.env ?? process.env;
  const log = deps.logger ?? {
    info: (m: string) => console.log(`[spiro-hook] ${m}`),
    error: (m: string) => console.error(`[spiro-hook] ${m}`),
  };

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Token");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.statusCode = 204;
    res.end();
    return true;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }
  if (rateLimited(req, Date.now())) {
    sendJson(res, 429, { error: "rate_limited" });
    return true;
  }

  const auth = authorizeHook({
    urlToken: url.searchParams.get("token"),
    headerToken: headerValue(req, "x-webhook-token"),
    env,
  });
  if (!auth.ok) {
    log.error(`rejected an event: ${auth.reason}`);
    sendJson(res, 401, { error: "unauthorized" });
    return true;
  }
  if (auth.mode === "open" && !warnedOpen) {
    warnedOpen = true;
    log.info(
      "accepting unauthenticated events — set SPIRO_WEBHOOK_TOKEN and add it to the hook URL",
    );
  }

  const raw = await readRawBody(req, MAX_BODY_BYTES);
  if (!raw.ok) {
    sendJson(res, 413, { error: raw.error });
    return true;
  }

  try {
    const event = await ingestHookBody(raw.body, { ...deps, env, logger: log });
    sendJson(res, 200, {
      ok: true,
      event: event.id,
      outcome: event.outcome,
      task: event.taskId,
    });
  } catch (err) {
    // A write that failed is the one case worth retrying, so this is the one
    // path that answers 5xx.
    log.error(`failed to record an event: ${String(err)}`);
    sendJson(res, 503, { error: "not_recorded" });
  }
  return true;
}
