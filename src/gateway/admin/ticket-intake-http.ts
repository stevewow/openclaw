import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "../hooks.js";
import { sendJson, setDefaultSecurityHeaders } from "../http-common.js";
import { TICKET_INTAKE_HTML } from "./ticket-intake-html.js";
import { TICKET_CATEGORIES, createTicket, type TicketCategory } from "./ticket-store.js";

const INTAKE_PAGE_PATH = "/support";
const INTAKE_SUBMIT_PATH = "/api/support/intake";
const MAX_BODY_BYTES = 16 * 1024;

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

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  edit_request: "Edit request",
  additional_service: "Additional service",
  missing_media: "Missing media",
  other: "Support request",
};

function composeSubject(
  category: TicketCategory,
  mediaType: string | null,
  serviceType: string | null,
): string {
  const detail = category === "additional_service" ? serviceType : mediaType;
  const subject = detail ? `${CATEGORY_LABEL[category]} — ${detail}` : CATEGORY_LABEL[category];
  return subject.slice(0, 160);
}

function composeDescription(
  mediaType: string | null,
  serviceType: string | null,
  details: string,
): string {
  const prefix: string[] = [];
  if (mediaType) prefix.push(`Media: ${mediaType}`);
  if (serviceType) prefix.push(`Requested service: ${serviceType}`);
  return prefix.length ? `${prefix.join("\n")}\n\n${details}` : details;
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

  // Serve the form page.
  if (url.pathname === INTAKE_PAGE_PATH || url.pathname === `${INTAKE_PAGE_PATH}/`) {
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    setDefaultSecurityHeaders(res);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.end(req.method === "HEAD" ? undefined : TICKET_INTAKE_HTML);
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

    const category = data.category;
    if (!TICKET_CATEGORIES.includes(category as TicketCategory)) {
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

    const mediaType = str(data.mediaType);
    const serviceType = str(data.serviceType);
    const ticket = await createTicket({
      category: category as TicketCategory,
      subject: composeSubject(category as TicketCategory, mediaType, serviceType),
      description: composeDescription(mediaType, serviceType, details),
      source: "widget",
      requesterName,
      requesterEmail,
      requesterPhone: str(data.requesterPhone),
      orderId: str(data.orderId),
      orderAddress: str(data.orderAddress),
    });

    sendJson(res, 201, { ok: true, number: ticket.number });
    return true;
  }

  return false;
}
