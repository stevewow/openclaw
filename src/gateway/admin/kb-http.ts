// Admin routes for the knowledge base, under /api/admin/kb.
//
// Its own module rather than more of admin-http.ts, which is already past
// 3,800 lines. Auth, the session lookup and the feature gate all happen in
// admin-http.ts before this is reached — everything here assumes a caller that
// has already been granted `knowledge-base`.
//
// The public reader is deliberately NOT here. It has no session, so it gets its
// own surface rather than a loosened branch of an authenticated one.

import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "../hooks.js";
import { sendJson } from "../http-common.js";
import { summarizeKbSearches } from "./kb-search-store.js";
import {
  type CreateArticleParams,
  type CreateCategoryParams,
  createArticle,
  createCategory,
  deleteArticle,
  deleteCategory,
  getArticle,
  getCategory,
  listArticles,
  listCategoriesWithCounts,
  publishArticle,
  reorderArticles,
  reorderCategories,
  searchArticles,
  unpublishArticle,
  updateArticle,
  updateCategory,
} from "./kb-store.js";

/**
 * Eight times the admin default, because an article body is capped at 200,000
 * characters in the store and multi-byte text has to fit inside this before it
 * can be rejected on length rather than truncated by the reader.
 */
const MAX_KB_BODY_BYTES = 512 * 1024;

export type KbRequestContext = {
  /** Recorded as the author and, on publish, as the reviewer. */
  userId: string;
};

function sendBadRequest(res: ServerResponse, message: string): void {
  sendJson(res, 400, { error: message });
}

function sendNotFound(res: ServerResponse): void {
  sendJson(res, 404, { error: "not_found" });
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Optional free text, where an explicitly sent empty string means "clear it"
 * and an absent key means "leave it alone" — the store draws the same
 * distinction between `null` and `undefined`.
 */
function optional(data: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in data)) {
    return undefined;
  }
  const value = data[key];
  if (value === null) {
    return null;
  }
  return typeof value === "string" ? value.trim() || null : undefined;
}

/**
 * Only http(s) links may be stored as an article's video.
 *
 * The reader renders this into an embed, so a `javascript:` or `data:` URL here
 * would be stored XSS. Rejecting at the boundary keeps the reader from having
 * to be clever about a value it did not choose.
 */
function readVideoUrl(value: unknown): { ok: true; url: string | null } | { ok: false } {
  if (value === null) {
    return { ok: true, url: null };
  }
  if (typeof value !== "string") {
    return { ok: false };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, url: null };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false };
  }
  return { ok: true, url: trimmed };
}

/** `null` is a real value here — it files an article on the unfiled shelf. */
function readCategoryId(data: Record<string, unknown>): string | null | undefined {
  if (!("categoryId" in data)) {
    return undefined;
  }
  const value = data.categoryId;
  if (value === null || value === "") {
    return null;
  }
  return typeof value === "string" ? value : undefined;
}

function readIdList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) {
    return null;
  }
  return value as string[];
}

/** Categories and articles together: both lists are small and always shown as one. */
async function sendWorkspace(res: ServerResponse, status = 200): Promise<void> {
  sendJson(res, status, {
    categories: await listCategoriesWithCounts(),
    articles: await listArticles(),
  });
}

/**
 * Returns false when `subPath` is not a knowledge-base route, so the caller
 * keeps looking. Anything under `/kb` that IS matched is answered here.
 */
export async function handleKbAdminRequest(
  subPath: string,
  req: IncomingMessage,
  res: ServerResponse,
  ctx: KbRequestContext,
): Promise<boolean> {
  if (subPath !== "/kb" && !subPath.startsWith("/kb/")) {
    return false;
  }
  const method = req.method ?? "GET";

  // GET /api/admin/kb — the whole authoring workspace in one call.
  if (subPath === "/kb" && (method === "GET" || method === "HEAD")) {
    await sendWorkspace(res);
    return true;
  }

  // GET /api/admin/kb/search?q= — drafts included; this side is staff-only.
  if (subPath === "/kb/search" && method === "GET") {
    const url = new URL(req.url ?? "/", "http://localhost");
    const query = url.searchParams.get("q") ?? "";
    sendJson(res, 200, {
      articles: await searchArticles(query, { includeDrafts: true }),
    });
    return true;
  }

  // GET /api/admin/kb/searches?days= — the help center's search report:
  // what clients looked for and what it got them. Read-only; the rows it
  // summarizes are written by the public reader, not from here.
  if (subPath === "/kb/searches" && method === "GET") {
    const url = new URL(req.url ?? "/", "http://localhost");
    const rawDays = Number.parseInt(url.searchParams.get("days") ?? "", 10);
    sendJson(res, 200, {
      summary: await summarizeKbSearches(Number.isFinite(rawDays) ? { days: rawDays } : {}),
    });
    return true;
  }

  // ── Categories ───────────────────────────────────────────────────────────

  if (subPath === "/kb/categories" && method === "POST") {
    const body = await readJsonBody(req, MAX_KB_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const title = text(data.title);
    if (!title) {
      sendBadRequest(res, "title required");
      return true;
    }
    const params: CreateCategoryParams = { title };
    const description = optional(data, "description");
    if (description !== undefined) {
      params.description = description;
    }
    const slug = text(data.slug);
    if (slug) {
      params.slug = slug;
    }
    const category = await createCategory(params);
    sendJson(res, 201, { category });
    return true;
  }

  // Must precede /kb/categories/:id, which would otherwise read "reorder" as an id.
  if (subPath === "/kb/categories/reorder" && method === "PUT") {
    const body = await readJsonBody(req, MAX_KB_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const ids = readIdList((body.value as Record<string, unknown>).ids);
    if (!ids) {
      sendBadRequest(res, "ids must be an array of category ids");
      return true;
    }
    await reorderCategories(ids);
    await sendWorkspace(res);
    return true;
  }

  const categoryMatch = subPath.match(/^\/kb\/categories\/([^/]+)$/);
  if (categoryMatch && method === "PUT") {
    const body = await readJsonBody(req, MAX_KB_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const params: Parameters<typeof updateCategory>[1] = {};
    const title = text(data.title);
    if (title) {
      params.title = title;
    }
    const description = optional(data, "description");
    if (description !== undefined) {
      params.description = description;
    }
    const slug = text(data.slug);
    if (slug) {
      params.slug = slug;
    }
    const updated = await updateCategory(categoryMatch[1], params);
    if (!updated) {
      sendNotFound(res);
      return true;
    }
    sendJson(res, 200, { category: updated });
    return true;
  }

  if (categoryMatch && method === "DELETE") {
    const id = categoryMatch[1];
    if (!(await getCategory(id))) {
      sendNotFound(res);
      return true;
    }
    // The articles filed here survive as unfiled; the client is told how many
    // moved so "delete" never quietly loses sight of them.
    const orphaned = (await listArticles({ categoryId: id })).length;
    await deleteCategory(id);
    sendJson(res, 200, { ok: true, unfiled: orphaned });
    return true;
  }

  // ── Articles ─────────────────────────────────────────────────────────────

  if (subPath === "/kb/articles" && method === "POST") {
    const body = await readJsonBody(req, MAX_KB_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const title = text(data.title);
    if (!title) {
      sendBadRequest(res, "title required");
      return true;
    }
    const video = readVideoUrl("videoUrl" in data ? data.videoUrl : null);
    if (!video.ok) {
      sendBadRequest(res, "videoUrl must be an http(s) link");
      return true;
    }
    const params: CreateArticleParams = { title, createdBy: ctx.userId };
    const summary = optional(data, "summary");
    if (summary !== undefined) {
      params.summary = summary;
    }
    if (typeof data.bodyMd === "string") {
      params.bodyMd = data.bodyMd;
    }
    const categoryId = readCategoryId(data);
    if (categoryId !== undefined) {
      params.categoryId = categoryId;
    }
    const slug = text(data.slug);
    if (slug) {
      params.slug = slug;
    }
    params.videoUrl = video.url;
    // Publishing is its own request, so a create can never skip that step.
    const article = await createArticle(params);
    sendJson(res, 201, { article });
    return true;
  }

  if (subPath === "/kb/articles/reorder" && method === "PUT") {
    const body = await readJsonBody(req, MAX_KB_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const ids = readIdList(data.ids);
    if (!ids) {
      sendBadRequest(res, "ids must be an array of article ids");
      return true;
    }
    const categoryId = readCategoryId(data);
    if (categoryId === undefined) {
      sendBadRequest(res, "categoryId required (null for unfiled)");
      return true;
    }
    await reorderArticles(categoryId, ids);
    await sendWorkspace(res);
    return true;
  }

  const publishMatch = subPath.match(/^\/kb\/articles\/([^/]+)\/(publish|unpublish)$/);
  if (publishMatch && method === "POST") {
    const id = publishMatch[1];
    if (!(await getArticle(id))) {
      sendNotFound(res);
      return true;
    }
    const article =
      publishMatch[2] === "publish"
        ? await publishArticle(id, ctx.userId)
        : await unpublishArticle(id);
    sendJson(res, 200, { article });
    return true;
  }

  const articleMatch = subPath.match(/^\/kb\/articles\/([^/]+)$/);
  if (articleMatch && method === "PUT") {
    const body = await readJsonBody(req, MAX_KB_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const params: Parameters<typeof updateArticle>[1] = {};
    const title = text(data.title);
    if (title) {
      params.title = title;
    }
    const summary = optional(data, "summary");
    if (summary !== undefined) {
      params.summary = summary;
    }
    if (typeof data.bodyMd === "string") {
      params.bodyMd = data.bodyMd;
    }
    const categoryId = readCategoryId(data);
    if (categoryId !== undefined) {
      params.categoryId = categoryId;
    }
    const slug = text(data.slug);
    if (slug) {
      params.slug = slug;
    }
    if ("videoUrl" in data) {
      const video = readVideoUrl(data.videoUrl);
      if (!video.ok) {
        sendBadRequest(res, "videoUrl must be an http(s) link");
        return true;
      }
      params.videoUrl = video.url;
    }
    const updated = await updateArticle(articleMatch[1], params);
    if (!updated) {
      sendNotFound(res);
      return true;
    }
    sendJson(res, 200, { article: updated });
    return true;
  }

  if (articleMatch && method === "DELETE") {
    const id = articleMatch[1];
    if (!(await getArticle(id))) {
      sendNotFound(res);
      return true;
    }
    await deleteArticle(id);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // A known prefix with no matching verb is a 404 from here, not a fall-through
  // to some later route that happens to share the shape.
  sendNotFound(res);
  return true;
}
