// The public endpoint the marketing site's forms post to.
//
// Unauthenticated by default, like the support intake form: the site has to be
// able to reach it, and the shared secret is the thing that makes it trustworthy
// rather than the network. Set LEADS_WEBHOOK_SECRET (Framer's webhook signing
// secret) and every submission is verified; set LEADS_WEBHOOK_TOKEN and a token
// in the URL is accepted instead, for a form platform that cannot sign. With
// neither, submissions are accepted and the log says so once.
//
// Framer retries a webhook up to five times until it gets a 2xx, so this answers
// 200 for anything it has already recorded and reserves non-2xx for "try again".

import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson, setDefaultSecurityHeaders } from "../http-common.js";
import { hasContact, parseLeadPayload, verifyFramerSignature } from "./lead-intake.js";
import { dispatchLead } from "./lead-notify.js";
import { listPlaybooks } from "./lead-playbooks-store.js";
import { matchPlaybook } from "./lead-playbooks.js";
import { createLead, getLeadBySubmissionId, type Lead } from "./lead-store.js";
import { resolveLeadOwner } from "./lead-territories.js";

const INTAKE_PATH = "/api/leads/intake";
/** A form submission is a few fields of text; anything larger is not one. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Throttle, per source address.
 *
 * Far looser than the support form's, and deliberately: every submission from
 * the website arrives from the form platform's own servers, so all of them share
 * one address. A tight per-IP limit would not throttle an abuser, it would drop
 * a busy afternoon's real leads.
 */
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const submissions = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

function rateLimited(req: IncomingMessage, now: number): boolean {
  const key = clientKey(req);
  const entry = submissions.get(key);
  if (!entry || now >= entry.resetAt) {
    submissions.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) {
    return true;
  }
  entry.count += 1;
  return false;
}

/** Test seam: the throttle is process-wide and would leak between cases. */
export function resetLeadIntakeRateLimit(): void {
  submissions.clear();
}

/** Read the body as bytes. The signature is over what was sent, not over a reparse. */
async function readRawBody(
  req: IncomingMessage,
  maxBytes: number,
): Promise<{ ok: true; body: Buffer } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (result: { ok: true; body: Buffer } | { ok: false; error: string }) => {
      if (!settled) {
        settled = true;
        resolve(result);
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
    req.on("end", () => finish({ ok: true, body: Buffer.concat(chunks) }));
    req.on("error", () => finish({ ok: false, error: "read error" }));
  });
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name];
  return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
}

export type IntakeAuth =
  | { ok: true; mode: "signature" | "token" | "open" }
  | { ok: false; reason: string };

/**
 * Decide whether to trust a submission. The signing secret wins when both are
 * configured, because it also proves the body was not altered in transit.
 */
export function authorizeIntake(params: {
  rawBody: Buffer;
  submissionId: string;
  signature: string | undefined;
  urlToken: string | null;
  env: NodeJS.ProcessEnv;
}): IntakeAuth {
  const secret = params.env.LEADS_WEBHOOK_SECRET?.trim();
  if (secret) {
    const ok = verifyFramerSignature({
      rawBody: params.rawBody,
      submissionId: params.submissionId,
      header: params.signature,
      secret,
    });
    return ok ? { ok: true, mode: "signature" } : { ok: false, reason: "bad signature" };
  }
  const token = params.env.LEADS_WEBHOOK_TOKEN?.trim();
  if (token) {
    return params.urlToken === token
      ? { ok: true, mode: "token" }
      : { ok: false, reason: "bad token" };
  }
  return { ok: true, mode: "open" };
}

let warnedOpen = false;

export type LeadIntakeDeps = {
  env?: NodeJS.ProcessEnv;
  logger?: { info: (m: string) => void; error: (m: string) => void };
  /** Injected in tests so a submission does not try to send mail. */
  dispatch?: (lead: Lead) => Promise<unknown>;
};

/**
 * POST /api/leads/intake — one form submission.
 *
 * Returns 200 with the lead number. A duplicate delivery returns 200 with the
 * lead it already made: Framer's retry must be a no-op, not a second lead and a
 * second email to the owner.
 */
export async function handleLeadIntakeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: LeadIntakeDeps = {},
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== INTAKE_PATH) {
    return false;
  }
  setDefaultSecurityHeaders(res);
  const env = deps.env ?? process.env;
  const log = deps.logger ?? {
    info: (m: string) => console.log(`[leads] ${m}`),
    error: (m: string) => console.error(`[leads] ${m}`),
  };

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Framer-Signature");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.statusCode = 204;
    res.end();
    return true;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }
  const now = Date.now();
  if (rateLimited(req, now)) {
    // 429, not 200: this is exactly the case Framer's retry is for.
    sendJson(res, 429, { error: "rate_limited" });
    return true;
  }

  const raw = await readRawBody(req, MAX_BODY_BYTES);
  if (!raw.ok) {
    sendJson(res, 413, { error: raw.error });
    return true;
  }
  let payload: unknown;
  try {
    payload = raw.body.length > 0 ? JSON.parse(raw.body.toString("utf8")) : {};
  } catch {
    sendJson(res, 400, { error: "invalid_json" });
    return true;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    sendJson(res, 400, { error: "invalid_payload" });
    return true;
  }

  const submissionId = headerValue(req, "framer-webhook-submission-id")?.trim() ?? "";
  const auth = authorizeIntake({
    rawBody: raw.body,
    submissionId,
    signature: headerValue(req, "framer-signature"),
    urlToken: url.searchParams.get("token"),
    env,
  });
  if (!auth.ok) {
    log.error(`rejected a submission: ${auth.reason}`);
    sendJson(res, 401, { error: "unauthorized" });
    return true;
  }
  if (auth.mode === "open" && !warnedOpen) {
    warnedOpen = true;
    log.info(
      "lead intake is accepting unsigned submissions — set LEADS_WEBHOOK_SECRET to the Framer webhook secret",
    );
  }

  // A retry of a submission already recorded. Answered 200 with the same lead
  // number so Framer stops retrying and nobody is emailed twice.
  if (submissionId) {
    const existing = await getLeadBySubmissionId(submissionId);
    if (existing) {
      sendJson(res, 200, { ok: true, lead: existing.number, duplicate: true });
      return true;
    }
  }

  const parsed = parseLeadPayload(payload as Record<string, unknown>);
  if (!hasContact(parsed)) {
    // 200, not 400: a form with no contact details is not a delivery problem,
    // and retrying it four more times will not add an email address.
    log.info("dropped a submission with no email or phone");
    sendJson(res, 200, { ok: true, dropped: "no_contact" });
    return true;
  }

  const owner = await resolveLeadOwner(parsed.market);
  // Which lead magnet they came in on decides the script the owner is sent, so
  // it is resolved here and stored on the lead rather than matched again later.
  const pageUrl = parsed.pageUrl ?? headerValue(req, "referer") ?? null;
  const playbook = matchPlaybook(await listPlaybooks(), {
    formName: parsed.formName,
    pageUrl,
    fields: parsed.fields,
  });
  const lead = await createLead({
    source: "framer",
    formName: parsed.formName,
    playbookKey: playbook?.key ?? null,
    submissionId: submissionId || null,
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    company: parsed.company,
    message: parsed.message,
    marketRaw: parsed.market,
    territoryKey: owner.territory?.key ?? null,
    ownerName: owner.ownerName,
    ownerEmail: owner.ownerEmail,
    // The payload's own answer first; a browser-side post may add a Referer,
    // but a webhook delivered server to server carries none.
    pageUrl,
    fields: parsed.fields,
  });

  // The lead is saved before anything is emailed, and the send is not awaited
  // against the response: Framer is holding a connection open, and a slow mail
  // provider must not turn a recorded lead into a retried one.
  const dispatch = deps.dispatch ?? ((l: Lead) => dispatchLead(l));
  void Promise.resolve(dispatch(lead)).catch((err: unknown) => {
    log.error(`dispatch failed for ${lead.number}: ${String(err)}`);
  });

  sendJson(res, 200, { ok: true, lead: lead.number });
  return true;
}
