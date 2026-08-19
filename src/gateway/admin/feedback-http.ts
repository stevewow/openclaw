// Public routes for the team feedback form: the page itself and its submit
// endpoint. The in-Hub views hang off the authenticated admin API in
// admin-http.ts instead, because they read every submission rather than write
// one.
//
// Like the ticket intake form this is unauthenticated, so nothing the browser
// says about the form's own options is trusted — feedback-store.ts drops any
// label that is not on its list.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { readJsonBody } from "../hooks.js";
import { sendJson, setDefaultSecurityHeaders } from "../http-common.js";
import { ensureAttachmentsDir, resolveAttachmentFilePath } from "./attachment-store.js";
import { FEEDBACK_INTAKE_HTML } from "./feedback-intake-html.js";
import { addFeedbackAttachment, createFeedback } from "./feedback-store.js";
import { MAX_INTAKE_BODY_BYTES, parseIntakeFiles } from "./ticket-attachment-intake.js";

const FEEDBACK_PAGE_PATH = "/feedback";
const FEEDBACK_SUBMIT_PATH = "/api/feedback/submit";

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function handleFeedbackIntakeRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === FEEDBACK_PAGE_PATH) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return false;
    }
    setDefaultSecurityHeaders(res);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // The page is compiled in, but it changes with a deploy and is small, so
    // it is revalidated rather than cached hard like the logo.
    res.setHeader("Cache-Control", "no-cache");
    if (req.method === "HEAD") {
      res.end();
      return true;
    }
    res.end(FEEDBACK_INTAKE_HTML);
    return true;
  }

  if (url.pathname === FEEDBACK_SUBMIT_PATH) {
    if (req.method !== "POST") {
      return false;
    }
    setDefaultSecurityHeaders(res);

    const body = await readJsonBody(req, MAX_INTAKE_BODY_BYTES);
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "Please fill the form in and try again." });
      return true;
    }
    const payload = body as Record<string, unknown>;

    const text = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!text) {
      sendJson(res, 400, { error: "Please tell us what happened." });
      return true;
    }
    const source = asStringArray(payload.source);
    const categories = asStringArray(payload.categories);
    if (source.length === 0) {
      sendJson(res, 400, { error: "Please say whether this is employee or client feedback." });
      return true;
    }
    if (categories.length === 0) {
      sendJson(res, 400, { error: "Please pick at least one category." });
      return true;
    }

    // Same rule as the ticket form: a bad attachment fails the whole
    // submission with a fixable message, rather than filing feedback whose
    // evidence silently vanished.
    const parsed = parseIntakeFiles(payload.files);
    if (!parsed.ok) {
      sendJson(res, 400, { error: parsed.error });
      return true;
    }

    let entry: Awaited<ReturnType<typeof createFeedback>>;
    try {
      entry = await createFeedback({
        source,
        categories,
        body: text,
        submittedBy: asStringOrNull(payload.submittedBy),
        submittedByName: asStringOrNull(payload.submittedByName),
        appointmentLink: asStringOrNull(payload.appointmentLink),
        listingAddress: asStringOrNull(payload.listingAddress),
        selectedServices: asStringArray(payload.selectedServices),
        requestedAt: asNumberOrNull(payload.requestedAt),
        firstAvailableAt: asNumberOrNull(payload.firstAvailableAt),
      });
    } catch {
      sendJson(res, 500, { error: "Something went wrong. Please try again." });
      return true;
    }

    // Files go beside every other admin attachment but are recorded in
    // admin_feedback_attachments rather than admin_attachments: that table's
    // owner_type CHECK covers task/project/ticket only, and widening it would
    // mean rebuilding the table for no gain — feedback already owns its own.
    if (parsed.files.length > 0) {
      await ensureAttachmentsDir();
    }
    for (const file of parsed.files) {
      try {
        const stored = `${crypto.randomUUID()}${path.extname(file.filename).slice(0, 12)}`;
        await fs.writeFile(resolveAttachmentFilePath(stored), file.bytes, { mode: 0o600 });
        await addFeedbackAttachment(entry.id, {
          filename: file.filename,
          mimeType: file.mimetype,
          byteSize: file.bytes.length,
          storedPath: stored,
        });
      } catch {
        // The feedback itself is already filed and is the thing that matters;
        // losing one screenshot must not lose the words with it.
      }
    }

    sendJson(res, 200, { ok: true, reference: entry.reference });
    return true;
  }

  return false;
}
