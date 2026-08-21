// How help center articles are actually doing: read, liked, and voted useful
// or not.
//
// The search log next door records what people looked for. This records what
// happened once they found it — which is the other half of the same question,
// and the half you cannot answer by reading your own articles.
//
//   views                  → what the help center is really for.
//   likes                  → what a client would send a colleague.
//   helpful yes/no + note  → the article exists and still did not land.
//
// Same privacy stance as kb-search-store.ts and kb-ask-store.ts: how many,
// never who. There is no client identifier anywhere in here — no IP, no user
// agent, no cookie, no session. That is a deliberate limit and not an
// oversight: it is exactly why a like can be pressed once from each of two
// browsers, and why the "you already voted" memory lives in the client's own
// localStorage rather than in a row here. Counting honestly and identifying
// nobody are in tension, and this file resolves it the same way the rest of
// the help center does.
//
// Counters, not an event table. A view is written on every article load, so a
// row per view would be the largest thing in this database inside a month
// while answering nothing the running totals cannot.

import crypto from "node:crypto";
import { sql } from "kysely";
import { getAdminDb } from "./user-store.js";

/** A comment, not an essay. Longer than a ticket subject, far shorter than a body. */
export const MAX_NOTE = 500;

/** The report's window when the caller does not name one. */
export const DEFAULT_ENGAGEMENT_WINDOW_DAYS = 30;

export type KbArticleStats = {
  articleId: string;
  views: number;
  likes: number;
  helpfulYes: number;
  helpfulNo: number;
};

export type KbArticleNote = {
  id: string;
  /** Null once the article is deleted; the note survives it deliberately. */
  articleId: string | null;
  /** The title as it stood when the note was left — the article may be renamed. */
  articleTitle: string;
  helpful: boolean;
  note: string;
  createdAt: number;
};

const EMPTY: Omit<KbArticleStats, "articleId"> = {
  views: 0,
  likes: 0,
  helpfulYes: 0,
  helpfulNo: 0,
};

/**
 * Add to one counter, creating the row if this is the article's first anything.
 *
 * A single INSERT … ON CONFLICT rather than a read-then-write: two clients
 * opening the same article in the same tick would otherwise both read the same
 * number and both write it back, losing a view. SQLite does the arithmetic.
 */
async function bump(
  articleId: string,
  column: "views" | "likes" | "helpful_yes" | "helpful_no",
  delta: number,
): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();
  await db
    .insertInto("admin_kb_article_stats")
    .values({
      article_id: articleId,
      views: column === "views" ? Math.max(0, delta) : 0,
      likes: column === "likes" ? Math.max(0, delta) : 0,
      helpful_yes: column === "helpful_yes" ? Math.max(0, delta) : 0,
      helpful_no: column === "helpful_no" ? Math.max(0, delta) : 0,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.column("article_id").doUpdateSet({
        // MAX(0, …) so an unlike whose like was never counted — a stale
        // localStorage flag, a row cleared by hand — cannot drive the total
        // below zero and show a client a negative number of likes.
        [column]: sql`MAX(0, ${sql.ref(`admin_kb_article_stats.${column}`)} + ${delta})`,
        updated_at: now,
      }),
    )
    .execute();
}

/**
 * One more read of this article.
 *
 * Called from the page route, so it must never throw into a client's request;
 * the caller wraps it. Undercounts behind the page cache, which is the right
 * trade — these numbers rank articles against each other, and they all sit
 * behind the same cache.
 */
export async function recordArticleView(articleId: string): Promise<void> {
  await bump(articleId, "views", 1);
}

/**
 * Like, or take a like back.
 *
 * Returns the total afterwards so the button can show the real number rather
 * than the client's guess at it — two people liking at once should both see
 * two, and only the server knows that.
 */
export async function likeArticle(articleId: string, on: boolean): Promise<number> {
  await bump(articleId, "likes", on ? 1 : -1);
  return (await getArticleStats(articleId)).likes;
}

/**
 * A "was this helpful?" vote. Counted, and nothing else.
 *
 * Separate from recordArticleNote because the two happen at different moments:
 * the vote the instant Yes or No is pressed, the comment only if one is then
 * written. Folding them into one call would mean either losing the votes of
 * everyone who leaves without commenting, or counting a vote twice when they
 * do.
 */
export async function recordHelpfulVote(params: {
  articleId: string;
  articleTitle: string;
  helpful: boolean;
}): Promise<void> {
  await bump(params.articleId, params.helpful ? "helpful_yes" : "helpful_no", 1);
}

/**
 * The comment left with a vote already cast. Moves no counter.
 *
 * The title is copied onto the row because the note outlives both the
 * article's name and, thanks to the SET NULL on its foreign key, the article
 * itself — "this doesn't explain X" is at its most useful once X has been
 * rewritten and the note can no longer point at what it was about.
 */
export async function recordArticleNote(params: {
  articleId: string;
  articleTitle: string;
  helpful: boolean;
  note: string;
}): Promise<void> {
  const note = params.note.trim().slice(0, MAX_NOTE);
  if (!note) {
    return;
  }
  await getAdminDb()
    .insertInto("admin_kb_article_notes")
    .values({
      id: crypto.randomUUID(),
      article_id: params.articleId,
      article_title: params.articleTitle.slice(0, 200),
      helpful: params.helpful ? 1 : 0,
      note,
      created_at: Date.now(),
    })
    .execute();
}

export async function getArticleStats(articleId: string): Promise<KbArticleStats> {
  const row = await getAdminDb()
    .selectFrom("admin_kb_article_stats")
    .selectAll()
    .where("article_id", "=", articleId)
    .executeTakeFirst();
  return row
    ? {
        articleId,
        views: row.views,
        likes: row.likes,
        helpfulYes: row.helpful_yes,
        helpfulNo: row.helpful_no,
      }
    : { articleId, ...EMPTY };
}

/**
 * Stats for every article that has any, keyed by id.
 *
 * A map rather than a list because every caller is joining it onto articles it
 * already holds, and an article with no row yet must read as zeroes rather
 * than as missing.
 */
export async function listArticleStats(): Promise<Map<string, KbArticleStats>> {
  const rows = await getAdminDb().selectFrom("admin_kb_article_stats").selectAll().execute();
  return new Map(
    rows.map((row) => [
      row.article_id,
      {
        articleId: row.article_id,
        views: row.views,
        likes: row.likes,
        helpfulYes: row.helpful_yes,
        helpfulNo: row.helpful_no,
      },
    ]),
  );
}

/** The comments left with helpful votes, newest first. */
export async function listArticleNotes(
  opts: { since?: number; limit?: number } = {},
): Promise<KbArticleNote[]> {
  let query = getAdminDb().selectFrom("admin_kb_article_notes").selectAll();
  if (opts.since !== undefined) {
    query = query.where("created_at", ">=", opts.since);
  }
  const rows = await query
    .orderBy("created_at", "desc")
    .limit(opts.limit ?? 50)
    .execute();
  return rows.map((row) => ({
    id: row.id,
    articleId: row.article_id,
    articleTitle: row.article_title,
    helpful: row.helpful === 1,
    note: row.note,
    createdAt: row.created_at,
  }));
}
