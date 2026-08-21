// The knowledge base: help categories, help articles, and the full-text search
// that finds them.
//
// Separate from resource-store.ts on purpose. The resource library models links
// and files with access flags; an article has a body, a slug, a draft state and
// a place in an order. Sharing one table would mean every read of either had to
// filter out the other's rows.
//
// Nothing here renders or serves anything — this is the store only. The public
// reader and the authoring UI are built on top of it.

import crypto from "node:crypto";
import { type Kysely, sql } from "kysely";
import { type AdminDb, getAdminDb } from "./user-store.js";

/**
 * A draft is invisible outside the Hub; publishing is what puts an article in
 * front of a client. Kept to the two states we actually have: this column
 * carries a CHECK, and three separate tables in this schema have needed a
 * full rebuild to widen one, so a third state is a migration, not an edit.
 */
export type KbArticleStatus = "draft" | "published";

export type KbCategory = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  /** Published articles filed here. Only set by the listing that counts them. */
  articleCount?: number;
};

export type KbArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  bodyMd: string;
  /** Null once the owning category is deleted; the article survives, unfiled. */
  categoryId: string | null;
  status: KbArticleStatus;
  videoUrl: string | null;
  sortOrder: number;
  createdBy: string | null;
  publishedBy: string | null;
  publishedAt: number | null;
  createdAt: number;
  /**
   * When the words last changed — title, summary, body or video — and nothing
   * else. `updatedAt` moves when an article is dragged into a new order or
   * refiled, so it is the wrong thing to show a client as "last updated"; this
   * is the one the public reader prints. Null on articles written before the
   * column existed, which read as their published date instead.
   */
  contentUpdatedAt: number | null;
  updatedAt: number;
};

export type CreateCategoryParams = {
  title: string;
  description?: string | null;
  slug?: string | null;
  sortOrder?: number;
};

export type UpdateCategoryParams = Partial<CreateCategoryParams>;

export type CreateArticleParams = {
  title: string;
  summary?: string | null;
  bodyMd?: string;
  categoryId?: string | null;
  slug?: string | null;
  videoUrl?: string | null;
  status?: KbArticleStatus;
  createdBy?: string | null;
};

export type UpdateArticleParams = Partial<Omit<CreateArticleParams, "createdBy" | "status">>;

export type ListArticlesOptions = {
  /** Omit for every state; the public reader always passes `published`. */
  status?: KbArticleStatus;
  /** `null` selects the unfiled articles; omit for every category. */
  categoryId?: string | null;
};

export type SearchArticlesOptions = {
  limit?: number;
  /** Off by default so a public search can never surface an unpublished draft. */
  includeDrafts?: boolean;
};

// Caps exist so one pasted article cannot bloat every list query that reads it.
const MAX_TITLE = 200;
const MAX_SUMMARY = 400;
const MAX_SLUG = 120;
const MAX_BODY = 200_000;
const DEFAULT_SEARCH_LIMIT = 20;

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body_md: string;
  category_id: string | null;
  status: string;
  video_url: string | null;
  sort_order: number;
  created_by: string | null;
  published_by: string | null;
  published_at: number | null;
  created_at: number;
  content_updated_at: number | null;
  updated_at: number;
};

type CategoryRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

function rowToArticle(row: ArticleRow): KbArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    bodyMd: row.body_md,
    categoryId: row.category_id,
    // Widened by the CHECK, so anything else cannot reach here from SQLite.
    status: row.status as KbArticleStatus,
    videoUrl: row.video_url,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    contentUpdatedAt: row.content_updated_at,
    updatedAt: row.updated_at,
  };
}

function rowToCategory(row: CategoryRow): KbCategory {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * A title turned into a URL segment: lowercase, accents folded, runs of
 * anything else collapsed to a single hyphen.
 *
 * Hyphens rather than the underscores ticket category keys use, because these
 * land in a client-visible URL.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "");
}

/** `taken` decides the suffix, so the caller controls what it is competing with. */
function uniqueSlug(base: string, taken: Set<string>): string {
  const root = base || "untitled";
  if (!taken.has(root)) {
    return root;
  }
  let n = 2;
  // Trim the root so the counter can never push the slug past the column cap.
  while (taken.has(`${root.slice(0, MAX_SLUG - 5)}-${n}`)) {
    n += 1;
  }
  return `${root.slice(0, MAX_SLUG - 5)}-${n}`;
}

function trimTo(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function optionalText(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

// ── Categories ─────────────────────────────────────────────────────────────

export async function listCategories(): Promise<KbCategory[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_kb_categories")
    .selectAll()
    .orderBy("sort_order", "asc")
    .orderBy("title", "asc")
    .execute();
  return rows.map(rowToCategory);
}

/**
 * Categories with their published-article counts, which is what both the public
 * index and the authoring list need — an empty category should not be offered
 * to a client as somewhere to look.
 */
export async function listCategoriesWithCounts(): Promise<KbCategory[]> {
  const db = getAdminDb();
  const categories = await listCategories();
  const counts = await db
    .selectFrom("admin_kb_articles")
    .select(["category_id", (eb) => eb.fn.countAll<number>().as("c")])
    .where("status", "=", "published")
    .groupBy("category_id")
    .execute();
  const byId = new Map(counts.map((r) => [r.category_id, r.c]));
  for (const category of categories) {
    category.articleCount = byId.get(category.id) ?? 0;
  }
  return categories;
}

export async function getCategoryBySlug(slug: string): Promise<KbCategory | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_kb_categories")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  return row ? rowToCategory(row) : null;
}

export async function getCategory(id: string): Promise<KbCategory | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_kb_categories")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? rowToCategory(row) : null;
}

export async function createCategory(params: CreateCategoryParams): Promise<KbCategory> {
  const db = getAdminDb();
  const title = trimTo(params.title, MAX_TITLE);
  if (!title) {
    throw new Error("kb: category title is required");
  }
  const existing = await db.selectFrom("admin_kb_categories").select("slug").execute();
  const slug = uniqueSlug(
    slugify(params.slug?.trim() || title),
    new Set(existing.map((r) => r.slug)),
  );
  const max = await db
    .selectFrom("admin_kb_categories")
    .select((eb) => eb.fn.max<number>("sort_order").as("m"))
    .executeTakeFirst();
  const now = Date.now();
  const row: CategoryRow = {
    id: crypto.randomUUID(),
    slug,
    title,
    description: optionalText(params.description, MAX_SUMMARY),
    sort_order: params.sortOrder ?? (max?.m ?? -1) + 1,
    created_at: now,
    updated_at: now,
  };
  await db.insertInto("admin_kb_categories").values(row).execute();
  return rowToCategory(row);
}

export async function updateCategory(
  id: string,
  params: UpdateCategoryParams,
): Promise<KbCategory | null> {
  const db = getAdminDb();
  const current = await getCategory(id);
  if (!current) {
    return null;
  }

  const updates: Partial<CategoryRow> = { updated_at: Date.now() };
  if (params.title !== undefined) {
    const title = trimTo(params.title, MAX_TITLE);
    if (!title) {
      throw new Error("kb: category title is required");
    }
    updates.title = title;
  }
  if (params.description !== undefined) {
    updates.description = optionalText(params.description, MAX_SUMMARY);
  }
  if (params.sortOrder !== undefined) {
    updates.sort_order = params.sortOrder;
  }
  // Renaming a category leaves its slug alone: the old URL is already out
  // there. Changing the address stays an explicit act.
  if (params.slug !== undefined && params.slug !== null) {
    const others = await db
      .selectFrom("admin_kb_categories")
      .select("slug")
      .where("id", "!=", id)
      .execute();
    updates.slug = uniqueSlug(slugify(params.slug), new Set(others.map((r) => r.slug)));
  }

  await db.updateTable("admin_kb_categories").set(updates).where("id", "=", id).execute();
  return getCategory(id);
}

/**
 * Deleting a category unfiles its articles rather than taking them with it —
 * the same stance resource folders take, and for the same reason: a mis-click
 * should not be able to destroy written work.
 */
export async function deleteCategory(id: string): Promise<void> {
  await getAdminDb().deleteFrom("admin_kb_categories").where("id", "=", id).execute();
}

/**
 * Rewrites every category's `sort_order` to its index. Takes the whole order so
 * two people reordering at once cannot interleave into a half-applied sequence,
 * and ids the caller omits keep their relative order after the ones named here.
 */
export async function reorderCategories(orderedIds: string[]): Promise<KbCategory[]> {
  const db = getAdminDb();
  const ordered = resolveOrder(
    orderedIds,
    (await listCategories()).map((c) => c.id),
  );
  const now = Date.now();
  await db.transaction().execute(async (trx) => {
    for (const [index, id] of ordered.entries()) {
      await trx
        .updateTable("admin_kb_categories")
        .set({ sort_order: index, updated_at: now })
        .where("id", "=", id)
        .execute();
    }
  });
  return listCategories();
}

/** Requested ids first (known and de-duplicated), then everything left behind. */
function resolveOrder(requested: string[], current: string[]): string[] {
  const known = new Set(current);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of requested) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  for (const id of current) {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  }
  return ordered;
}

// ── Articles ───────────────────────────────────────────────────────────────

export async function listArticles(opts: ListArticlesOptions = {}): Promise<KbArticle[]> {
  const db = getAdminDb();
  let q = db.selectFrom("admin_kb_articles").selectAll();
  if (opts.status) {
    q = q.where("status", "=", opts.status);
  }
  if (opts.categoryId !== undefined) {
    q =
      opts.categoryId === null
        ? q.where("category_id", "is", null)
        : q.where("category_id", "=", opts.categoryId);
  }
  const rows = await q.orderBy("sort_order", "asc").orderBy("title", "asc").execute();
  return rows.map(rowToArticle);
}

export async function getArticle(id: string): Promise<KbArticle | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_kb_articles")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? rowToArticle(row) : null;
}

/**
 * Article slugs are unique across the whole knowledge base, not just within a
 * category, so an article keeps its address when it is refiled. That is what
 * lets a nested `/help/<category>/<article>` URL resolve on the article segment
 * alone and redirect when the category part has gone stale.
 */
export async function getArticleBySlug(slug: string): Promise<KbArticle | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_kb_articles")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  return row ? rowToArticle(row) : null;
}

export async function createArticle(params: CreateArticleParams): Promise<KbArticle> {
  const db = getAdminDb();
  const title = trimTo(params.title, MAX_TITLE);
  if (!title) {
    throw new Error("kb: article title is required");
  }
  const existing = await db.selectFrom("admin_kb_articles").select("slug").execute();
  const slug = uniqueSlug(
    slugify(params.slug?.trim() || title),
    new Set(existing.map((r) => r.slug)),
  );
  const max = await db
    .selectFrom("admin_kb_articles")
    .select((eb) => eb.fn.max<number>("sort_order").as("m"))
    .executeTakeFirst();
  const now = Date.now();
  // Everything an agent or an editor creates starts as a draft; publishing is
  // its own call, so nothing reaches a client by default.
  const status: KbArticleStatus = params.status === "published" ? "published" : "draft";
  const row: ArticleRow = {
    id: crypto.randomUUID(),
    slug,
    title,
    summary: optionalText(params.summary, MAX_SUMMARY),
    body_md: (params.bodyMd ?? "").slice(0, MAX_BODY),
    category_id: params.categoryId ?? null,
    status,
    video_url: optionalText(params.videoUrl, MAX_SLUG * 8),
    sort_order: (max?.m ?? -1) + 1,
    created_by: params.createdBy ?? null,
    published_by: null,
    published_at: status === "published" ? now : null,
    created_at: now,
    content_updated_at: now,
    updated_at: now,
  };
  await db.insertInto("admin_kb_articles").values(row).execute();
  return rowToArticle(row);
}

export async function updateArticle(
  id: string,
  params: UpdateArticleParams,
): Promise<KbArticle | null> {
  const db = getAdminDb();
  const current = await getArticle(id);
  if (!current) {
    return null;
  }

  const now = Date.now();
  const updates: Partial<ArticleRow> = { updated_at: now };
  // Whether the words changed, as opposed to where the article sits. Compared
  // against the current value rather than merely "was this field sent": the
  // editor PATCHes the whole article on every save, so presence would stamp a
  // new date on an article whose author only pressed Save. See content_updated_at.
  let contentChanged = false;
  if (params.title !== undefined) {
    const title = trimTo(params.title, MAX_TITLE);
    if (!title) {
      throw new Error("kb: article title is required");
    }
    updates.title = title;
    contentChanged ||= title !== current.title;
  }
  if (params.summary !== undefined) {
    updates.summary = optionalText(params.summary, MAX_SUMMARY);
    contentChanged ||= updates.summary !== current.summary;
  }
  if (params.bodyMd !== undefined) {
    updates.body_md = params.bodyMd.slice(0, MAX_BODY);
    contentChanged ||= updates.body_md !== current.bodyMd;
  }
  if (params.categoryId !== undefined) {
    updates.category_id = params.categoryId;
  }
  if (params.videoUrl !== undefined) {
    updates.video_url = optionalText(params.videoUrl, MAX_SLUG * 8);
    contentChanged ||= updates.video_url !== current.videoUrl;
  }
  if (contentChanged) {
    updates.content_updated_at = now;
  }
  // As with categories: a retitle never silently moves a published article.
  if (params.slug !== undefined && params.slug !== null) {
    const others = await db
      .selectFrom("admin_kb_articles")
      .select("slug")
      .where("id", "!=", id)
      .execute();
    updates.slug = uniqueSlug(slugify(params.slug), new Set(others.map((r) => r.slug)));
  }

  await db.updateTable("admin_kb_articles").set(updates).where("id", "=", id).execute();
  return getArticle(id);
}

/** Who published it is recorded, because publishing is the reviewed step. */
export async function publishArticle(
  id: string,
  publishedBy: string | null,
): Promise<KbArticle | null> {
  const db = getAdminDb();
  const now = Date.now();
  await db
    .updateTable("admin_kb_articles")
    .set({ status: "published", published_by: publishedBy, published_at: now, updated_at: now })
    .where("id", "=", id)
    .execute();
  return getArticle(id);
}

/**
 * Back to a draft. `published_at` survives so a re-published article can still
 * report when it first went live.
 */
export async function unpublishArticle(id: string): Promise<KbArticle | null> {
  const db = getAdminDb();
  await db
    .updateTable("admin_kb_articles")
    .set({ status: "draft", updated_at: Date.now() })
    .where("id", "=", id)
    .execute();
  return getArticle(id);
}

export async function deleteArticle(id: string): Promise<void> {
  await getAdminDb().deleteFrom("admin_kb_articles").where("id", "=", id).execute();
}

/** Order within one category. Ids from other categories are ignored. */
export async function reorderArticles(
  categoryId: string | null,
  orderedIds: string[],
): Promise<KbArticle[]> {
  const db = getAdminDb();
  const current = await listArticles({ categoryId });
  const ordered = resolveOrder(
    orderedIds,
    current.map((a) => a.id),
  );
  const now = Date.now();
  await db.transaction().execute(async (trx) => {
    for (const [index, id] of ordered.entries()) {
      await trx
        .updateTable("admin_kb_articles")
        .set({ sort_order: index, updated_at: now })
        .where("id", "=", id)
        .execute();
    }
  });
  return listArticles({ categoryId });
}

// ── Search ─────────────────────────────────────────────────────────────────

/**
 * Turn what someone typed into an FTS5 MATCH expression.
 *
 * Raw input cannot go to FTS5: bare `AND`, an unbalanced quote or a lone `*`
 * are all query syntax, and a client searching `agent's photos` would get a
 * syntax error rather than results. So we keep only letter/number runs and
 * quote each one as a literal phrase. The last term gets a prefix `*` so
 * "resched" finds "reschedule" while someone is still typing.
 *
 * Returns null when nothing searchable is left, which callers treat as "no
 * results" rather than "match everything".
 */
export function toMatchQuery(raw: string): string | null {
  const terms = raw.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!terms || terms.length === 0) {
    return null;
  }
  return terms
    .map((term, i) => (i === terms.length - 1 ? `"${term}"*` : `"${term}"`))
    .join(" AND ");
}

/**
 * Words too common to narrow anything, dropped before a question is turned into
 * a MATCH.
 *
 * Deliberately small and closed: these are the words that carry a question's
 * grammar rather than its subject. Trimming further starts discarding words a
 * client might genuinely be searching for.
 */
const QUESTION_STOPWORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "any",
  "are",
  "at",
  "be",
  "but",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "get",
  "got",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "should",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

/** A long paste must not become a MATCH with a hundred clauses in it. */
const MAX_QUESTION_TERMS = 12;

/**
 * Turn a typed question into an FTS query.
 *
 * Different from toMatchQuery on purpose. That one joins with AND, which is
 * right for a search box — every word you type narrows the result. A question
 * is mostly grammar: "how do I get my photos from the portal" under AND
 * requires one article to contain all eight words and finds nothing. So the
 * grammar is dropped and what is left is ORed, ranked by bm25.
 *
 * Returns null when nothing but stopwords was typed, which is the first gate on
 * the answering path: no content words means no retrieval, and no retrieval
 * means no model call.
 */
export function toQuestionMatchQuery(raw: string): string | null {
  const terms = raw.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!terms) {
    return null;
  }
  const content: string[] = [];
  for (const term of terms) {
    // Single characters match nearly everything under a prefix search.
    if (term.length < 2 || QUESTION_STOPWORDS.has(term) || content.includes(term)) {
      continue;
    }
    content.push(term);
    if (content.length === MAX_QUESTION_TERMS) {
      break;
    }
  }
  if (content.length === 0) {
    return null;
  }
  return content.map((term) => `"${term}"*`).join(" OR ");
}

/** An article and how well it matched. More negative is a better bm25 match. */
export type ScoredArticle = {
  article: KbArticle;
  score: number;
};

/**
 * Published articles that bear on a question, best first, with their scores.
 *
 * The score is returned rather than thresholded here because there is no
 * defensible threshold to pick yet: bm25 is relative to the corpus, and this
 * one is small. It is logged with every question instead, so a cut-off can be
 * chosen later from real numbers rather than guessed at now.
 */
export async function searchArticlesForQuestion(
  question: string,
  opts: { limit?: number } = {},
): Promise<ScoredArticle[]> {
  const match = toQuestionMatchQuery(question);
  if (!match) {
    return [];
  }
  const db: Kysely<AdminDb> = getAdminDb();
  const limit = Math.max(1, Math.min(opts.limit ?? 3, 10));
  const result = await sql<ArticleRow & { score: number }>`
    SELECT a.*, bm25(admin_kb_search, 10.0, 4.0, 1.0) AS score
    FROM admin_kb_articles a
    JOIN admin_kb_search ON admin_kb_search.rowid = a.rowid
    WHERE admin_kb_search MATCH ${match}
      AND a.status = 'published'
    ORDER BY score
    LIMIT ${limit}
  `.execute(db);
  return result.rows.map((row) => ({ article: rowToArticle(row), score: row.score }));
}

/**
 * Full-text search over titles, summaries and bodies, ranked by bm25 with the
 * title weighted hardest — someone searching "reschedule" wants the article
 * called Reschedule a shoot, not the one that mentions it in passing.
 *
 * bm25() returns a more-negative score for a better match, so plain ascending
 * order is best-first.
 */
export async function searchArticles(
  query: string,
  opts: SearchArticlesOptions = {},
): Promise<KbArticle[]> {
  const match = toMatchQuery(query);
  if (!match) {
    return [];
  }
  const db: Kysely<AdminDb> = getAdminDb();
  const limit = Math.max(1, Math.min(opts.limit ?? DEFAULT_SEARCH_LIMIT, 100));
  const statusFilter = opts.includeDrafts ? sql`1 = 1` : sql`a.status = 'published'`;
  const result = await sql<ArticleRow>`
    SELECT a.*
    FROM admin_kb_articles a
    JOIN admin_kb_search ON admin_kb_search.rowid = a.rowid
    WHERE admin_kb_search MATCH ${match}
      AND ${statusFilter}
    ORDER BY bm25(admin_kb_search, 10.0, 4.0, 1.0)
    LIMIT ${limit}
  `.execute(db);
  return result.rows.map(rowToArticle);
}
