import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "../hooks.js";
import { sendJson, setDefaultSecurityHeaders } from "../http-common.js";
import {
  ensureCategorySeed,
  listCategories,
  type TicketCategoryDef,
} from "./ticket-category-store.js";
import { listDepartmentEmails } from "./ticket-department-store.js";
import { applyInboundReply, type PostmarkInboundPayload } from "./ticket-inbound.js";
import { renderTicketIntakeHtml } from "./ticket-intake-html.js";
import { notifyDepartment } from "./ticket-mailer.js";
import { createTicket } from "./ticket-store.js";
import { verifyTestToken } from "./ticket-test-token.js";

const INTAKE_PAGE_PATH = "/support";
const INTAKE_SUBMIT_PATH = "/api/support/intake";
const INBOUND_PATH = "/api/support/inbound";
const MAX_BODY_BYTES = 16 * 1024;
const INBOUND_MAX_BODY_BYTES = 512 * 1024; // email bodies + quoted history

/** Extra addresses allowed to drive ticket state, beyond the department desks. */
export function staffAllowlist(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.TICKET_STAFF_ALLOWLIST?.trim();
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

/**
 * Who may drive ticket state by replying: every department address we send to,
 * plus any explicit extras in TICKET_STAFF_ALLOWLIST. The env var alone listed
 * one person, so a reply from any other desk was parked in needs_review and its
 * UPDATE/RESOLVED silently dropped. Empty (no desks, no extras) still means
 * allow-all, matching the pre-configuration default.
 */
export async function replyAllowlist(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const desks = await listDepartmentEmails();
  return [...new Set([...staffAllowlist(env), ...desks])];
}

/** Constant-ish check that the inbound webhook carried the configured shared secret. */
function inboundSecretOk(
  req: IncomingMessage,
  url: URL,
  env: NodeJS.ProcessEnv = process.env,
): {
  configured: boolean;
  ok: boolean;
} {
  const secret = env.TICKET_INBOUND_SECRET?.trim();
  if (!secret) return { configured: false, ok: false };
  const q = url.searchParams.get("token");
  const auth = req.headers["authorization"];
  const bearer =
    typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  return { configured: true, ok: q === secret || bearer === secret };
}

// Lightweight per-IP throttle so a public endpoint can't be spammed into the
// dashboard. Fixed window, in-memory — resets on restart, which is fine for a
// basic abuse brake (not a security control).
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const submissions = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}

function rateLimited(req: IncomingMessage, now: number): boolean {
  const key = clientKey(req);
  const entry = submissions.get(key);
  if (!entry || now >= entry.resetAt) {
    submissions.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count += 1;
  return false;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** "Edit request — Photos": the category's short label plus its answer. */
export function composeSubject(category: TicketCategoryDef, extraValue: string | null): string {
  const subject = extraValue ? `${category.shortLabel} — ${extraValue}` : category.shortLabel;
  return subject.slice(0, 160);
}

/**
 * Lead with the follow-up question and its answer so the department reads the
 * specifics before the free text. The question doubles as the label, which keeps
 * custom categories self-describing without a second field to configure.
 */
export function composeDescription(
  category: TicketCategoryDef,
  extraValue: string | null,
  details: string,
): string {
  if (!extraValue) {
    return details;
  }
  const label = category.extraLabel?.trim() || "Details";
  return `${label} ${extraValue}\n\n${details}`;
}

/**
 * Public, unauthenticated intake surface. Serves the white-label form at
 * `/support` and accepts submissions at `POST /api/support/intake`, opening a
 * `source:"widget"` ticket. Returns true when it handled the request.
 */
export async function handleTicketIntakeRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");

  // Serve the form page, built from the admin-managed categories so dashboard
  // edits show up immediately (no-cache already prevents a stale form).
  if (url.pathname === INTAKE_PAGE_PATH || url.pathname === `${INTAKE_PAGE_PATH}/`) {
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    setDefaultSecurityHeaders(res);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    if (req.method === "HEAD") {
      res.end();
      return true;
    }
    await ensureCategorySeed();
    const categories = await listCategories({ activeOnly: true });
    res.end(
      renderTicketIntakeHtml(
        categories.map((c) => ({
          key: c.key,
          label: c.label,
          extraField: c.extraField,
          extraLabel: c.extraLabel,
          extraOptions: c.extraOptions,
          extraPlaceholder: c.extraPlaceholder,
          detailsLabel: c.detailsLabel,
          detailsHint: c.detailsHint,
        })),
      ),
    );
    return true;
  }

  // Accept a submission.
  if (url.pathname === INTAKE_SUBMIT_PATH) {
    if (req.method !== "POST") return false;
    setDefaultSecurityHeaders(res);

    if (rateLimited(req, Date.now())) {
      sendJson(res, 429, { error: "Too many requests. Please try again in a few minutes." });
      return true;
    }

    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendJson(res, 400, { error: body.error });
      return true;
    }
    const data = body.value as Record<string, unknown>;

    // Validate against the managed table: only an active category is
    // submittable, so a deactivated one can't be posted by a stale page.
    await ensureCategorySeed();
    const categoryKey = str(data.category);
    const active = await listCategories({ activeOnly: true });
    const category = active.find((c) => c.key === categoryKey);
    if (!category) {
      sendJson(res, 400, { error: "Please choose a request type." });
      return true;
    }
    const details = str(data.details);
    const requesterName = str(data.requesterName);
    const requesterEmail = str(data.requesterEmail);
    if (!requesterName) {
      sendJson(res, 400, { error: "Please enter your name." });
      return true;
    }
    if (!requesterEmail || !requesterEmail.includes("@")) {
      sendJson(res, 400, { error: "Please enter a valid email." });
      return true;
    }
    if (!details) {
      sendJson(res, 400, { error: "Please add a few details about your request." });
      return true;
    }

    // Test mode: an admin mints a signed token from the dashboard that carries
    // the override recipient. We never trust a raw "send it here" address on
    // this public endpoint — only a token that verifies diverts the email. A
    // present-but-invalid token is rejected so a stale demo can't silently mail
    // the real department.
    const testToken = str(data.testToken);
    const testGrant = testToken ? verifyTestToken(testToken) : null;
    if (testToken && !testGrant) {
      sendJson(res, 400, {
        error: "Your test session expired. Reload the preview and try again.",
      });
      return true;
    }

    // `mediaType`/`serviceType` are the pre-managed field names, still accepted
    // so an already-open form page keeps working across a deploy.
    const extraValue = str(data.extraValue) ?? str(data.mediaType) ?? str(data.serviceType);
    const ticket = await createTicket({
      category: category.key,
      subject: composeSubject(category, extraValue),
      description: composeDescription(category, extraValue, details),
      source: "widget",
      requesterName,
      requesterEmail,
      requesterPhone: str(data.requesterPhone),
      orderId: str(data.orderId),
      orderAddress: str(data.orderAddress),
      isTest: Boolean(testGrant),
    });

    // Notify the department out-of-band; a slow/failed email must not delay or
    // fail the client's submission (the ticket is already saved). A test ticket
    // diverts to the admin-authorized override address.
    void notifyDepartment(ticket, testGrant ? { overrideTo: testGrant.email } : {}).catch(() => {});

    sendJson(res, 201, { ok: true, number: ticket.number, test: Boolean(testGrant) });
    return true;
  }

  // Inbound email webhook (Postmark). Secret-gated so it isn't an open endpoint.
  if (url.pathname === INBOUND_PATH) {
    if (req.method !== "POST") return false;
    const secret = inboundSecretOk(req, url);
    // Hide the endpoint entirely when unconfigured; reject bad secrets.
    if (!secret.configured) return false;
    setDefaultSecurityHeaders(res);
    if (!secret.ok) {
      sendJson(res, 403, { error: "forbidden" });
      return true;
    }
    const body = await readJsonBody(req, INBOUND_MAX_BODY_BYTES);
    if (!body.ok) {
      sendJson(res, 400, { error: body.error });
      return true;
    }
    const outcome = await applyInboundReply(body.value as PostmarkInboundPayload, {
      allowlist: await replyAllowlist(),
    });
    // Every inbound reply leaves a line. Without one, a reply that changed
    // nothing was indistinguishable from one that never arrived, which is most
    // of why this was hard to trust.
    if (outcome.status === "applied") {
      console.log(
        `[tickets] inbound ${outcome.ticketNumber}: ${outcome.command} → ${outcome.newStatus}`,
      );
    } else if (outcome.status === "unverified") {
      console.error(
        `[tickets] inbound ${outcome.ticketNumber}: sender ${outcome.fromEmail ?? "(unknown)"} not on the reply allowlist — parked in needs_review`,
      );
    } else if (outcome.status === "no_match") {
      console.error(`[tickets] inbound: no ticket for reply token ${outcome.replyToken}`);
    } else {
      console.error("[tickets] inbound: no ticket token on the message");
    }
    // Always 200 so the provider doesn't retry on unmatched mail.
    sendJson(res, 200, outcome);
    return true;
  }

  return false;
}
