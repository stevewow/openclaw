// Admin routes for the sales coach and the guide behind it, under
// /api/admin/coach and /api/admin/guide.
//
// Auth, the session lookup and the feature gate all happen in admin-http.ts
// before this is reached, so everything here assumes a caller already granted
// `sales-coach`. The one decision left is editing: reading the guide comes with
// the grant, changing it is an admin's, because the wording is what the whole
// team then says to clients.

import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "../hooks.js";
import { sendJson } from "../http-common.js";
import { answerCoachQuestion } from "./coach-answer.js";
import {
  createGuideSection,
  deleteGuideSection,
  guideCorpus,
  listGuideDocs,
  listGuideSections,
  reorderGuideSections,
  updateGuideDoc,
  updateGuideSection,
} from "./coach-guide-store.js";
import {
  checkCoachAllowance,
  coachApiKey,
  coachCorpusTokenCap,
  coachModel,
} from "./coach-limits.js";
import { MAX_QUESTION, summarizeCoachAsks } from "./coach-store.js";

export type CoachRequestContext = {
  userId: string;
  /** Editing the guide is an admin's; asking is anyone granted. */
  isAdmin: boolean;
};

const MAX_THREAD_ID = 64;

/**
 * Four times the admin default: a guide section holds a whole product entry,
 * pricing table included, and has to fit inside this before it can be rejected
 * on length rather than truncated.
 */
const MAX_COACH_BODY_BYTES = 256 * 1024;

function sendBadRequest(res: ServerResponse, message: string): void {
  sendJson(res, 400, { error: message });
}

function sendForbidden(res: ServerResponse): void {
  sendJson(res, 403, { error: "forbidden" });
}

function sendNotFound(res: ServerResponse): void {
  sendJson(res, 404, { error: "not_found" });
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** The path after /api/admin, e.g. "/coach/ask" or "/guide/sections/:id". */
export async function handleCoachAdminRequest(
  subPath: string,
  req: IncomingMessage,
  res: ServerResponse,
  ctx: CoachRequestContext,
): Promise<boolean> {
  const method = req.method ?? "GET";

  // ── Asking ───────────────────────────────────────────────────────────────
  if (subPath === "/coach/ask" && method === "POST") {
    const parsed = await readJsonBody(req, MAX_COACH_BODY_BYTES);
    if (!parsed.ok) {
      sendBadRequest(res, parsed.error);
      return true;
    }
    const body = parsed.value as Record<string, unknown>;
    const question = str(body.question, MAX_QUESTION);
    const threadId = str(body.threadId, MAX_THREAD_ID);
    if (!question) {
      sendBadRequest(res, "question_required");
      return true;
    }
    if (!threadId) {
      sendBadRequest(res, "thread_required");
      return true;
    }
    const allowance = await checkCoachAllowance(ctx.userId);
    if (!allowance.ok) {
      sendJson(res, 429, {
        error: "rate_limited",
        reason: allowance.reason,
        message:
          allowance.reason === "user"
            ? "That is a lot of questions in an hour. Give it a few minutes."
            : "The coach has answered all it can today. It will be back tomorrow.",
      });
      return true;
    }
    const result = await answerCoachQuestion({ question, threadId, userId: ctx.userId });
    sendJson(res, 200, {
      askId: result.askId,
      answered: result.answered,
      answer: result.answer,
      cited: result.cited,
    });
    return true;
  }

  // Whether to draw the coach at all, and what to say if it is off.
  if (subPath === "/coach/status" && method === "GET") {
    const corpus = await guideCorpus();
    sendJson(res, 200, {
      enabled: Boolean(coachApiKey()),
      sections: corpus.sectionIds.length,
      approxTokens: corpus.approxTokens,
      tokenCap: coachCorpusTokenCap(),
      model: coachModel(),
    });
    return true;
  }

  if (subPath === "/coach/usage" && method === "GET") {
    if (!ctx.isAdmin) {
      sendForbidden(res);
      return true;
    }
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    sendJson(res, 200, { since, ...(await summarizeCoachAsks(since)) });
    return true;
  }

  // ── The guide ────────────────────────────────────────────────────────────
  if (subPath === "/guide" && method === "GET") {
    const docs = await listGuideDocs();
    const corpus = await guideCorpus();
    sendJson(res, 200, {
      docs,
      canEdit: ctx.isAdmin,
      approxTokens: corpus.approxTokens,
      tokenCap: coachCorpusTokenCap(),
    });
    return true;
  }

  const docSections = subPath.match(/^\/guide\/docs\/([^/]+)\/sections$/);
  if (docSections && method === "GET") {
    const docId = decodeURIComponent(docSections[1] ?? "");
    sendJson(res, 200, { sections: await listGuideSections(docId) });
    return true;
  }

  if (docSections && method === "POST") {
    if (!ctx.isAdmin) {
      sendForbidden(res);
      return true;
    }
    const docId = decodeURIComponent(docSections[1] ?? "");
    const parsed = await readJsonBody(req, MAX_COACH_BODY_BYTES);
    if (!parsed.ok) {
      sendBadRequest(res, parsed.error);
      return true;
    }
    const body = parsed.value as Record<string, unknown>;
    const created = await createGuideSection(
      docId,
      {
        heading: str(body.heading, 500),
        group: str(body.group, 500) || null,
        bodyMd: typeof body.bodyMd === "string" ? body.bodyMd : "",
      },
      ctx.userId,
    );
    if (!created) {
      sendBadRequest(res, "heading_required");
      return true;
    }
    sendJson(res, 200, { section: created });
    return true;
  }

  const docReorder = subPath.match(/^\/guide\/docs\/([^/]+)\/reorder$/);
  if (docReorder && method === "POST") {
    if (!ctx.isAdmin) {
      sendForbidden(res);
      return true;
    }
    const docId = decodeURIComponent(docReorder[1] ?? "");
    const parsed = await readJsonBody(req, MAX_COACH_BODY_BYTES);
    if (!parsed.ok) {
      sendBadRequest(res, parsed.error);
      return true;
    }
    const ids = (parsed.value as Record<string, unknown>).ids;
    if (!Array.isArray(ids)) {
      sendBadRequest(res, "ids_required");
      return true;
    }
    await reorderGuideSections(
      docId,
      ids.filter((id): id is string => typeof id === "string"),
    );
    sendJson(res, 200, { sections: await listGuideSections(docId) });
    return true;
  }

  const docUpdate = subPath.match(/^\/guide\/docs\/([^/]+)$/);
  if (docUpdate && method === "PUT") {
    if (!ctx.isAdmin) {
      sendForbidden(res);
      return true;
    }
    const parsed = await readJsonBody(req, MAX_COACH_BODY_BYTES);
    if (!parsed.ok) {
      sendBadRequest(res, parsed.error);
      return true;
    }
    const body = parsed.value as Record<string, unknown>;
    const updated = await updateGuideDoc(
      decodeURIComponent(docUpdate[1] ?? ""),
      {
        title: str(body.title, 500),
        summary: str(body.summary, 2000) || null,
      },
      ctx.userId,
    );
    if (!updated) {
      sendNotFound(res);
      return true;
    }
    sendJson(res, 200, { doc: updated });
    return true;
  }

  const sectionPath = subPath.match(/^\/guide\/sections\/([^/]+)$/);
  if (sectionPath && (method === "PUT" || method === "DELETE")) {
    if (!ctx.isAdmin) {
      sendForbidden(res);
      return true;
    }
    const id = decodeURIComponent(sectionPath[1] ?? "");
    if (method === "DELETE") {
      const ok = await deleteGuideSection(id);
      if (!ok) {
        sendNotFound(res);
        return true;
      }
      sendJson(res, 200, { ok: true });
      return true;
    }
    const parsed = await readJsonBody(req, MAX_COACH_BODY_BYTES);
    if (!parsed.ok) {
      sendBadRequest(res, parsed.error);
      return true;
    }
    const body = parsed.value as Record<string, unknown>;
    const updated = await updateGuideSection(
      id,
      {
        heading: str(body.heading, 500) || undefined,
        group: typeof body.group === "string" ? str(body.group, 500) || null : undefined,
        bodyMd: typeof body.bodyMd === "string" ? body.bodyMd : undefined,
      },
      ctx.userId,
    );
    if (!updated) {
      sendNotFound(res);
      return true;
    }
    sendJson(res, 200, { section: updated });
    return true;
  }

  return false;
}
