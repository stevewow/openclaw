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
import { setDefaultSecurityHeaders } from "../http-common.js";
import {
  HELP_CATEGORY_PREFIX,
  HELP_PATH,
  renderHelpArticleHtml,
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
  opts: { cache: string; head: boolean },
): void {
  setDefaultSecurityHeaders(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", opts.cache);
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
  // Anything but a read of a page is not ours to answer; let the request fall
  // through rather than inventing a 405 for a surface that only serves pages.
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }
  const head = req.method === "HEAD";

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
        renderHelpSearchHtml({ query, results, categories, supportUrl: SUPPORT_URL, searchId }),
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
    sendHtml(res, 200, renderHelpIndexHtml({ categories: groups, unfiled }), {
      cache: PAGE_CACHE,
      head,
    });
    return true;
  }

  // GET /help/category/<slug>
  if (path.startsWith(HELP_CATEGORY_PREFIX)) {
    const slug = decodeSlug(path.slice(HELP_CATEGORY_PREFIX.length));
    const category = slug ? await getCategoryBySlug(slug) : null;
    if (!category) {
      sendHtml(res, 404, renderHelpNotFoundHtml(SUPPORT_URL), { cache: "no-store", head });
      return true;
    }
    const [articles, categories] = await Promise.all([
      listArticles({ status: "published", categoryId: category.id }),
      browsableCategories(),
    ]);
    sendHtml(res, 200, renderHelpCategoryHtml({ category, articles, categories }), {
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
    sendHtml(res, 404, renderHelpNotFoundHtml(SUPPORT_URL), { cache: "no-store", head });
    return true;
  }
  // Opened from a results page: settle the search that offered this article.
  // The id only ever arrives on a link we wrote, and names a row that already
  // exists, so this can stamp one — it cannot create one.
  const fromSearch = url.searchParams.get("s");
  if (!head && fromSearch) {
    await logQuietly(() => recordKbSearchClick(fromSearch, article.id));
  }
  const [category, siblings] = await Promise.all([
    article.categoryId ? getCategory(article.categoryId) : Promise.resolve(null),
    listArticles({ status: "published", categoryId: article.categoryId ?? null }),
  ]);
  sendHtml(
    res,
    200,
    renderHelpArticleHtml({ article, category, siblings, supportUrl: SUPPORT_URL }),
    { cache: PAGE_CACHE, head },
  );
  return true;
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
