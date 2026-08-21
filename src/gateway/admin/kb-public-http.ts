// The public help center's routes. No session, no cookie, no admin API.
//
// This is the whole client-facing surface of the knowledge base:
//
//   GET /help                       the index, grouped by category
//   GET /help?q=…                   search, published articles only
//   GET /help/category/<slug>       one category
//   GET /help/<slug>                one article
//
// Article slugs are unique across the base, so an article is one segment and
// keeps its address when it is refiled. A category takes a reserved
// `/category/` segment, so an article and a category that happen to share a
// slug can never fight over a URL.
//
// Everything here reads published rows and nothing else. A draft is not
// "hidden" by the page — it never leaves the store.
//
// The one thing these routes write is the search log: the query typed into the
// box, and — via the `?s=` id carried on a result link — whether it led to an
// article being opened. Nothing identifying is recorded, and a failed write
// never reaches the client. See kb-search-store.ts.

import type { IncomingMessage, ServerResponse } from "node:http";
import { readRequestBodyWithLimit } from "../../infra/http-body.js";
import { sendJson, setDefaultSecurityHeaders } from "../http-common.js";
import { answerHelpQuestion } from "./kb-answer.js";
import { askApiKey, checkAskAllowance } from "./kb-ask-limits.js";
import { escalateKbAsk, MAX_QUESTION, recordKbAsk } from "./kb-ask-store.js";
import { checkEngagementAllowance } from "./kb-engagement-limits.js";
import {
  getArticleStats,
  likeArticle,
  listArticleStats,
  MAX_NOTE,
  recordArticleNote,
  recordArticleView,
  recordHelpfulVote,
} from "./kb-engagement-store.js";
import {
  articleDate,
  articleUrl,
  HELP_ASK_PATH,
  HELP_ASK_SEND_PATH,
  HELP_CATEGORY_PREFIX,
  HELP_HELPFUL_PATH,
  HELP_LIKE_PATH,
  HELP_NOTE_PATH,
  HELP_PATH,
  HELP_SUGGEST_PATH,
  renderHelpAnswerHtml,
  renderHelpArticleHtml,
  renderHelpAskLimitedHtml,
  renderHelpCategoryHtml,
  renderHelpIndexHtml,
  renderHelpNotFoundHtml,
  renderHelpSearchHtml,
} from "./kb-public-html.js";
import { recordKbSearch, recordKbSearchClick } from "./kb-search-store.js";
import {
  getArticleBySlug,
  getCategory,
  getCategoryBySlug,
  type KbArticle,
  type KbCategory,
  listArticles,
  listCategories,
  searchArticles,
} from "./kb-store.js";

/** Where "submit a request" sends someone: the public intake form. */
const SUPPORT_URL = "/support";

/**
 * A minute. Long enough that a link doing the rounds is not re-rendered per
 * click, short enough that publishing an article does not feel broken.
 */
const PAGE_CACHE = "public, max-age=60";

/**
 * A question is a sentence. Four times the store's own character cap, so an
 * over-long one is trimmed to the cap rather than refused at the door.
 */
const MAX_ASK_BODY_BYTES = 4 * 1024;

/** How many articles the index offers as shortcuts in each highlight list. */
const HIGHLIGHT_LIMIT = 5;

/** Suggestions under the search box. A shortlist, not a results page. */
const SUGGEST_LIMIT = 6;

/**
 * A like or a vote is a slug and a boolean. Small enough that anything larger
 * is not one, and refusing early keeps a public write endpoint cheap.
 */
const MAX_ENGAGEMENT_BODY_BYTES = 2 * 1024;

/**
 * Self-declared crawlers, so they do not fill the read counts.
 *
 * The user agent is read and immediately discarded — nothing here stores it,
 * which keeps the promise the rest of these tables make. This is not a defence
 * against anything; a crawler that does not say it is one is counted as a
 * reader, and that is fine. The counts rank articles against each other, and a
 * bias that falls on all of them equally does not change the ranking.
 */
const BOT_UA = /bot|crawler|spider|crawling|preview|monitor|curl|wget|headless|slurp|fetch/i;

function looksLikeBot(req: IncomingMessage): boolean {
  const agent = req.headers["user-agent"];
  return typeof agent === "string" && BOT_UA.test(agent);
}

/**
 * Run a search-log write without letting it reach the client.
 *
 * The log is a reporting convenience; the help center is not. A locked
 * database or a schema that has not caught up must cost us a row on a report,
 * never a client's answer, so everything written from these routes goes
 * through here.
 */
async function logQuietly<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (err) {
    console.warn("kb: search log write failed:", err);
    return null;
  }
}

function sendHtml(
  res: ServerResponse,
  status: number,
  html: string,
  opts: { cache: string; head: boolean; location?: string },
): void {
  setDefaultSecurityHeaders(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", opts.cache);
  if (opts.location) {
    res.setHeader("Location", opts.location);
  }
  if (opts.head) {
    res.end();
    return;
  }
  res.end(html);
}

/** Published articles, in the order they were given within their category. */
async function publishedArticles(): Promise<KbArticle[]> {
  return listArticles({ status: "published" });
}

/**
 * Categories worth offering: the ones with something published in them.
 *
 * The index has always left an empty shelf out — sending a client somewhere
 * with nothing on it is worse than not mentioning it — and the browse row has
 * to obey the same rule, or it would advertise the very pages the index hides.
 */
async function browsableCategories(): Promise<KbCategory[]> {
  const [categories, articles] = await Promise.all([listCategories(), publishedArticles()]);
  const filled = new Set(articles.map((a) => a.categoryId).filter(Boolean));
  return categories.filter((c) => filled.has(c.id));
}

export async function handleKbPublicRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path !== HELP_PATH && !path.startsWith(`${HELP_PATH}/`)) {
    return false;
  }
  // POST /help/ask is the one route here that is not a read. Everything else
  // is a page, and a non-read of a page is not ours to answer — it falls
  // through rather than inventing a 405 for a surface that only serves pages.
  if (path === HELP_ASK_PATH || path === HELP_ASK_SEND_PATH) {
    if (req.method !== "POST") {
      return false;
    }
    if (path === HELP_ASK_SEND_PATH) {
      await handleAskSend(req, res);
    } else {
      await handleAsk(req, res);
    }
    return true;
  }
  // Liking an article and voting on it. Exact-match, not prefixed: the note
  // route sits under the vote route's path, and a prefix test would give one
  // of them the other's handler.
  if (path === HELP_LIKE_PATH || path === HELP_HELPFUL_PATH || path === HELP_NOTE_PATH) {
    if (req.method !== "POST") {
      return false;
    }
    await handleEngagement(req, res, path);
    return true;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }
  const head = req.method === "HEAD";

  // GET /help/suggest?q= — the search box's own shortlist.
  //
  // Deliberately NOT logged. The gap report counts searches somebody chose to
  // run; logging keystrokes would fill it with the prefixes of words and bury
  // the questions actually asked underneath them.
  if (path === HELP_SUGGEST_PATH) {
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const results = query.length >= 2 ? await searchArticles(query, { limit: SUGGEST_LIMIT }) : [];
    sendJson(res, 200, {
      articles: results.map((article) => ({
        title: article.title,
        summary: article.summary,
        url: articleUrl(article),
      })),
    });
    return true;
  }

  // Read once: the widget is drawn on every page, so every renderer below
  // needs the same answer.
  const askEnabled = Boolean(askApiKey());

  // GET /help — the index, or search when the box has been used.
  if (path === HELP_PATH) {
    const query = (url.searchParams.get("q") ?? "").trim();
    if (query) {
      const [results, categories] = await Promise.all([
        searchArticles(query, { limit: 25 }),
        browsableCategories(),
      ]);
      // HEAD is a prefetcher, a link unfurler or a monitor, not a client with a
      // question — logging it would put words on the gap report nobody typed.
      const searchId = head
        ? null
        : await logQuietly(() => recordKbSearch({ query, resultCount: results.length }));
      // Results turn over with the query; nothing about them is worth caching.
      sendHtml(
        res,
        200,
        renderHelpSearchHtml({
          query,
          results,
          categories,
          supportUrl: SUPPORT_URL,
          searchId,
          askEnabled,
        }),
        {
          cache: "no-store",
          head,
        },
      );
      return true;
    }
    const [categories, articles] = await Promise.all([listCategories(), publishedArticles()]);
    const byCategory = new Map<string, KbArticle[]>();
    const unfiled: KbArticle[] = [];
    for (const article of articles) {
      if (!article.categoryId) {
        unfiled.push(article);
        continue;
      }
      const list = byCategory.get(article.categoryId);
      if (list) {
        list.push(article);
      } else {
        byCategory.set(article.categoryId, [article]);
      }
    }
    // An empty category is left out entirely: offering a client somewhere with
    // nothing in it is worse than not mentioning it.
    const groups = [];
    for (const category of categories) {
      const filed = byCategory.get(category.id);
      if (filed?.length) {
        groups.push(Object.assign(category, { articles: filed }));
      }
    }
    // The two shortcut lists. Read counts come from their own table, and an
    // article with no row there has simply not been opened yet — it sorts as
    // zero rather than dropping out.
    const stats = (await logQuietly(() => listArticleStats())) ?? new Map();
    const popular = articles
      .filter((article) => (stats.get(article.id)?.views ?? 0) > 0)
      .toSorted((a, b) => (stats.get(b.id)?.views ?? 0) - (stats.get(a.id)?.views ?? 0))
      .slice(0, HIGHLIGHT_LIMIT);
    const recent = articles
      .toSorted((a, b) => articleDate(b).at - articleDate(a).at)
      .slice(0, HIGHLIGHT_LIMIT);
    sendHtml(
      res,
      200,
      renderHelpIndexHtml({ categories: groups, unfiled, askEnabled, popular, recent }),
      { cache: PAGE_CACHE, head },
    );
    return true;
  }

  // GET /help/category/<slug>
  if (path.startsWith(HELP_CATEGORY_PREFIX)) {
    const slug = decodeSlug(path.slice(HELP_CATEGORY_PREFIX.length));
    const category = slug ? await getCategoryBySlug(slug) : null;
    if (!category) {
      sendHtml(res, 404, renderHelpNotFoundHtml(SUPPORT_URL, askEnabled), {
        cache: "no-store",
        head,
      });
      return true;
    }
    const [articles, categories] = await Promise.all([
      listArticles({ status: "published", categoryId: category.id }),
      browsableCategories(),
    ]);
    sendHtml(res, 200, renderHelpCategoryHtml({ category, articles, categories, askEnabled }), {
      cache: PAGE_CACHE,
      head,
    });
    return true;
  }

  // GET /help/<slug> — one article, published only.
  const slug = decodeSlug(path.slice(HELP_PATH.length + 1));
  const article = slug ? await getArticleBySlug(slug) : null;
  if (!article || article.status !== "published") {
    // A draft and a typo get the same page: which one it was is not a client's
    // business, and neither answer helps them.
    sendHtml(res, 404, renderHelpNotFoundHtml(SUPPORT_URL, askEnabled), {
      cache: "no-store",
      head,
    });
    return true;
  }
  // Opened from a results page: settle the search that offered this article.
  // The id only ever arrives on a link we wrote, and names a row that already
  // exists, so this can stamp one — it cannot create one.
  const fromSearch = url.searchParams.get("s");
  if (!head && fromSearch) {
    await logQuietly(() => recordKbSearchClick(fromSearch, article.id));
  }
  // One more read. HEAD is a prefetcher or an unfurler rather than a reader,
  // and a self-declared crawler is not one either; both would otherwise make
  // the most-linked article look like the most-read one.
  if (!head && !looksLikeBot(req)) {
    await logQuietly(() => recordArticleView(article.id));
  }
  const [category, siblings, stats] = await Promise.all([
    article.categoryId ? getCategory(article.categoryId) : Promise.resolve(null),
    listArticles({ status: "published", categoryId: article.categoryId ?? null }),
    logQuietly(() => getArticleStats(article.id)),
  ]);
  sendHtml(
    res,
    200,
    renderHelpArticleHtml({
      article,
      category,
      siblings,
      supportUrl: SUPPORT_URL,
      askEnabled,
      likes: stats?.likes ?? 0,
    }),
    // The like count is inside a cached page, so it can be up to a minute
    // stale. The script corrects it the moment anyone presses the button, and
    // a number that lags by a minute is not worth making every article page
    // uncacheable for.
    { cache: PAGE_CACHE, head },
  );
  return true;
}

/**
 * POST /help/ask — one question, one answer, no conversation.
 *
 * Single-turn on purpose. There is no thread to steer and nothing carried from
 * one question into the next, so there is no walking the model somewhere over
 * several messages. It also means the page works with no JavaScript at all,
 * which is why this is a plain form POST rather than a chat widget.
 *
 * The order below is the cost control: refuse before reading, read before
 * retrieving, retrieve before spending. Every question is logged whatever
 * became of it, because that log is what the daily ceiling counts.
 */
async function handleAsk(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const wantsJson = prefersJson(req);

  // Not configured: nothing was ever drawn that could send this, so it is a
  // hand-made request. Give it the page a mistyped link gets.
  if (!askApiKey()) {
    if (wantsJson) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    sendHtml(res, 404, renderHelpNotFoundHtml(SUPPORT_URL), { cache: "no-store", head: false });
    return;
  }

  const allowance = await checkAskAllowance(req);
  if (!allowance.allowed) {
    // 429 so a script is told plainly. Search is not limited and is what most
    // of these questions wanted anyway, so the page still leads with it.
    if (wantsJson) {
      sendJson(res, 429, { limited: true, reason: allowance.reason });
      return;
    }
    sendHtml(
      res,
      429,
      renderHelpAskLimitedHtml({ question: "", reason: allowance.reason, supportUrl: SUPPORT_URL }),
      { cache: "no-store", head: false },
    );
    return;
  }

  const question = await readQuestion(req);
  if (!question) {
    if (wantsJson) {
      sendJson(res, 400, { error: "question required" });
      return;
    }
    sendHtml(res, 303, "", { cache: "no-store", head: false, location: HELP_PATH });
    return;
  }

  const { outcome, topScore, slugs } = await answerHelpQuestion(question);

  const askId = await logQuietly(() =>
    recordKbAsk({
      question,
      answered: outcome.kind === "answered",
      declineReason: outcome.kind === "declined" ? outcome.reason : null,
      articleSlugs: slugs,
      topScore,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
    }),
  );

  if (wantsJson) {
    sendJson(res, 200, {
      answer: outcome.kind === "answered" ? outcome.answer : null,
      articles: outcome.articles.map((a) => ({ title: a.title, url: articleUrl(a) })),
      // The widget offers "send this to a person" against this id. It names a
      // row that already exists, so it can stamp one and never create one.
      askId,
    });
    return;
  }

  sendHtml(
    res,
    200,
    renderHelpAnswerHtml({
      question,
      answer: outcome.kind === "answered" ? outcome.answer : null,
      articles: outcome.articles,
      supportUrl: SUPPORT_URL,
      askEnabled: true,
    }),
    // An answer is generated once for one person; nothing may cache it.
    { cache: "no-store", head: false },
  );
}

/**
 * POST /help/ask/send — pass a question to a person.
 *
 * Deliberately not the ticket form. Someone who has already typed their
 * question into the box should not have to type it again into a form with a
 * request type and an attachment field; the question is already recorded, and
 * this only marks that they would like a human to see it. The email is
 * optional, and the whole thing works without one — it just cannot be answered
 * back.
 *
 * The id is the authority here, and it only ever came from an answer we served.
 */
async function handleAskSend(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let askId = "";
  let email: string | null = null;
  try {
    const raw = await readRequestBodyWithLimit(req, { maxBytes: MAX_ASK_BODY_BYTES });
    const parsed = JSON.parse(raw) as { askId?: unknown; email?: unknown };
    askId = typeof parsed.askId === "string" ? parsed.askId : "";
    email = typeof parsed.email === "string" ? parsed.email : null;
  } catch {
    sendJson(res, 400, { error: "bad request" });
    return;
  }
  if (!askId) {
    sendJson(res, 400, { error: "askId required" });
    return;
  }

  const outcome = await logQuietly(() => escalateKbAsk(askId, { email }));
  // A second press of the same button is still a promise we will keep, so it
  // reads as sent. An id naming nothing is NOT: saying "sent" there would leave
  // someone waiting on a reply nobody can send, which is the one outcome this
  // whole feature exists to avoid.
  if (outcome === "marked" || outcome === "already") {
    sendJson(res, 200, { ok: true });
    return;
  }
  sendJson(res, outcome === "unknown" ? 404 : 500, { ok: false });
}

/**
 * POST /help/like, /help/helpful and /help/helpful/note.
 *
 * The first writes the public help center accepts that are not a page being
 * read, so the shape is deliberately narrow: a slug that must name a published
 * article, a boolean, and — on the note route only — some text. Nothing here
 * can create an article, name one that is not published, or write anything
 * about who pressed the button.
 *
 * A draft is treated exactly as a typo is, the way the reader treats it: the
 * same 404, so the vote endpoints cannot be used to probe for unpublished work
 * that the pages themselves refuse to confirm exists.
 */
async function handleEngagement(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Promise<void> {
  if (!checkEngagementAllowance(req)) {
    sendJson(res, 429, { ok: false, limited: true });
    return;
  }

  let slug = "";
  let on = true;
  let helpful = true;
  let note = "";
  try {
    const raw = await readRequestBodyWithLimit(req, { maxBytes: MAX_ENGAGEMENT_BODY_BYTES });
    const parsed = JSON.parse(raw) as {
      slug?: unknown;
      on?: unknown;
      helpful?: unknown;
      note?: unknown;
    };
    slug = typeof parsed.slug === "string" ? parsed.slug : "";
    on = parsed.on !== false;
    helpful = parsed.helpful === true;
    note = typeof parsed.note === "string" ? parsed.note.trim().slice(0, MAX_NOTE) : "";
  } catch {
    sendJson(res, 400, { ok: false, error: "bad request" });
    return;
  }
  if (!slug) {
    sendJson(res, 400, { ok: false, error: "slug required" });
    return;
  }

  const article = await getArticleBySlug(slug);
  if (!article || article.status !== "published") {
    sendJson(res, 404, { ok: false });
    return;
  }

  if (path === HELP_LIKE_PATH) {
    const likes = await logQuietly(() => likeArticle(article.id, on));
    // A failed write costs a count, never the press: the button has already
    // moved in the client's own browser and telling them it did not is worse
    // than a number that catches up on the next page load.
    sendJson(res, 200, { ok: true, likes: likes ?? 0 });
    return;
  }

  if (path === HELP_NOTE_PATH) {
    // Note-only. The vote itself was counted when the button was pressed; this
    // route must not count it a second time, which is why `recordHelpfulVote`
    // is not what runs here.
    if (!note) {
      sendJson(res, 400, { ok: false, error: "note required" });
      return;
    }
    await logQuietly(() =>
      recordArticleNote({ articleId: article.id, articleTitle: article.title, helpful, note }),
    );
    sendJson(res, 200, { ok: true });
    return;
  }

  await logQuietly(() =>
    recordHelpfulVote({ articleId: article.id, articleTitle: article.title, helpful }),
  );
  sendJson(res, 200, { ok: true });
}

/** Whether the caller wants JSON — the widget — rather than a page. */
function prefersJson(req: IncomingMessage): boolean {
  const accept = req.headers.accept ?? "";
  return accept.includes("application/json");
}

/**
 * The question, from either shape the box can be used in: the widget sends
 * JSON, the no-JS form sends url-encoded fields.
 */
async function readQuestion(req: IncomingMessage): Promise<string> {
  let raw = "";
  try {
    raw = await readRequestBodyWithLimit(req, { maxBytes: MAX_ASK_BODY_BYTES });
  } catch {
    // An over-long or abandoned body is not a question.
    return "";
  }
  const type = req.headers["content-type"] ?? "";
  if (type.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw) as { question?: unknown };
      return typeof parsed.question === "string"
        ? parsed.question.trim().slice(0, MAX_QUESTION)
        : "";
    } catch {
      return "";
    }
  }
  return (new URLSearchParams(raw).get("question") ?? "").trim().slice(0, MAX_QUESTION);
}

/** A slug segment, or null when it is empty or not decodable. */
function decodeSlug(raw: string): string | null {
  if (!raw || raw.includes("/")) {
    return null;
  }
  try {
    return decodeURIComponent(raw) || null;
  } catch {
    return null;
  }
}
