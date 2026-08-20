// The help center's search log: what clients typed, whether it matched
// anything, and whether they opened what it matched.
//
// The point of this is the gap report. A knowledge base is only ever as good
// as its guess about what people will ask, and the searches that came back
// empty — or came back full and were ignored — are that guess being corrected
// in the client's own words.
//
// Three questions, and they are not the same question:
//
//   nothing matched          → the article does not exist. Write it.
//   matched, nothing opened  → the article probably exists but is titled in
//                              our words rather than theirs. Rename it.
//   asked most often         → what the help center is for.
//
// What is stored is the query text and nothing else: no IP, no user agent, no
// cookie, no session. The reader at /help has no identity to record and this
// module deliberately does not invent one.

import crypto from "node:crypto";
import { sql } from "kysely";
import { getAdminDb } from "./user-store.js";

/** Long enough for a typed question, short enough that no one can log an essay. */
const MAX_QUERY = 200;

/** The report's window when the caller does not name one. */
export const DEFAULT_SEARCH_WINDOW_DAYS = 30;

/** Rows per section. A gap list longer than this is a backlog, not a report. */
const DEFAULT_GROUP_LIMIT = 50;

export type KbSearchGroup = {
  /** The most recent spelling of this term, shown back on the report. */
  query: string;
  /** Folded form; identifies the group and is what a re-search would match. */
  queryKey: string;
  searches: number;
  /** How many of those searches matched at least one published article. */
  withResults: number;
  /** How many led to an article being opened. */
  clicks: number;
  lastAt: number;
};

export type KbSearchSummary = {
  /** Start of the window, so the page can say what it is showing. */
  since: number;
  totalSearches: number;
  /** Searches that matched nothing at all. */
  zeroResultSearches: number;
  /** Searches that ended with an article being opened. */
  clickedSearches: number;
  /** Terms that have never matched anything: the missing articles. */
  gaps: KbSearchGroup[];
  /** Terms that match something no one opens: the mis-titled articles. */
  unhelpful: KbSearchGroup[];
  /** Every term by volume, whatever became of it. */
  top: KbSearchGroup[];
};

/**
 * The grouping key: case folded, punctuation dropped, whitespace collapsed.
 *
 * Without this the report is a list of near-identical one-off searches —
 * "Floor Plans", "floor plan", "floor plans?" — none of which look worth
 * acting on alone, when together they are the loudest thing on the page.
 */
export function searchKey(query: string): string {
  return query
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Record one search of the public help center.
 *
 * Returns the row id, which the reader hands to the results page so that
 * opening a result can be tied back to the search that offered it. Returns
 * null for a query that folds away to nothing — a box submitted empty, or with
 * only punctuation in it, is not a question anyone asked.
 */
export async function recordKbSearch(params: {
  query: string;
  resultCount: number;
  at?: number;
}): Promise<string | null> {
  const query = params.query.trim().slice(0, MAX_QUERY);
  const queryKey = searchKey(query);
  if (!queryKey) {
    return null;
  }
  const id = crypto.randomUUID();
  await getAdminDb()
    .insertInto("admin_kb_searches")
    .values({
      id,
      query,
      query_key: queryKey,
      result_count: Math.max(0, Math.trunc(params.resultCount)),
      clicked_article_id: null,
      clicked_at: null,
      created_at: params.at ?? Date.now(),
    })
    .execute();
  return id;
}

/**
 * Note that a search led to an article being opened.
 *
 * Only the first open counts. The search id travels in a link, so it can be
 * shared or revisited, and a term that was answered once should not read as
 * more popular because someone forwarded the URL.
 */
export async function recordKbSearchClick(
  searchId: string,
  articleId: string,
  at = Date.now(),
): Promise<void> {
  await getAdminDb()
    .updateTable("admin_kb_searches")
    .set({ clicked_article_id: articleId, clicked_at: at })
    .where("id", "=", searchId)
    .where("clicked_article_id", "is", null)
    .execute();
}

type GroupRow = {
  query: string;
  query_key: string;
  searches: number;
  with_results: number;
  clicks: number;
  last_at: number;
};

export type SummarizeOptions = {
  /** How far back to look. Defaults to DEFAULT_SEARCH_WINDOW_DAYS. */
  days?: number;
  /** Rows per section. */
  limit?: number;
};

/**
 * The whole report in one pass.
 *
 * Grouped once and split in TypeScript rather than run as three near-identical
 * queries: the sections are three readings of the same rows, and computing
 * them apart is how they drift apart.
 */
export async function summarizeKbSearches(opts: SummarizeOptions = {}): Promise<KbSearchSummary> {
  const days = Math.max(1, Math.min(Math.trunc(opts.days ?? DEFAULT_SEARCH_WINDOW_DAYS), 365));
  const limit = Math.max(1, Math.min(Math.trunc(opts.limit ?? DEFAULT_GROUP_LIMIT), 500));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const db = getAdminDb();

  // `query` is a bare column beside exactly one max() aggregate, which in
  // SQLite takes its value from that same row — so the report shows the most
  // recent spelling of the term rather than an arbitrary one.
  const grouped = await sql<GroupRow>`
    SELECT
      query,
      query_key,
      COUNT(*) AS searches,
      SUM(CASE WHEN result_count > 0 THEN 1 ELSE 0 END) AS with_results,
      SUM(CASE WHEN clicked_article_id IS NOT NULL THEN 1 ELSE 0 END) AS clicks,
      MAX(created_at) AS last_at
    FROM admin_kb_searches
    WHERE created_at >= ${since}
    GROUP BY query_key
    ORDER BY searches DESC, last_at DESC
  `.execute(db);

  const groups: KbSearchGroup[] = grouped.rows.map((row) => ({
    query: row.query,
    queryKey: row.query_key,
    searches: row.searches,
    withResults: row.with_results,
    clicks: row.clicks,
    lastAt: row.last_at,
  }));

  let totalSearches = 0;
  let zeroResultSearches = 0;
  let clickedSearches = 0;
  for (const group of groups) {
    totalSearches += group.searches;
    zeroResultSearches += group.searches - group.withResults;
    clickedSearches += group.clicks;
  }

  return {
    since,
    totalSearches,
    zeroResultSearches,
    clickedSearches,
    // A term counts as a gap only when it has never matched anything in the
    // window. One search answered by an article published mid-window is not a
    // hole any more, and listing it would send someone to write a duplicate.
    gaps: groups.filter((g) => g.withResults === 0).slice(0, limit),
    unhelpful: groups.filter((g) => g.withResults > 0 && g.clicks === 0).slice(0, limit),
    top: groups.slice(0, limit),
  };
}
