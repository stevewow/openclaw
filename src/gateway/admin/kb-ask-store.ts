// The help center's answering box: what clients asked, and what came back.
//
// The sibling of kb-search-store.ts and it exists for the same reason — an
// unanswered question is the clearest statement of what the knowledge base is
// missing, and here it arrives in whole sentences rather than in keywords.
//
// Two extra jobs this log does that the search log does not:
//
//   * it is the daily spend ceiling. Every question counts a row, and the count
//     of today's rows is what the reader checks before it will call a model.
//   * it carries the token counts, so what the feature costs can be read off
//     the same table rather than out of a provider console.
//
// Still no IP, no user agent, no session. Rate limiting per client happens in
// memory (see kb-ask-limits.ts) precisely so that promise survives this file.

import crypto from "node:crypto";
import { sql } from "kysely";
import { searchKey } from "./kb-search-store.js";
import { getAdminDb } from "./user-store.js";

/** Long enough for a real question, short enough that no one can log an essay. */
export const MAX_QUESTION = 500;

/**
 * Why a question came back without an answer.
 *
 * A closed set rather than free text, because the report divides on it: the
 * first two mean the knowledge base is missing something, and the last two mean
 * the feature is broken or switched off. Reading a mix of the two as one number
 * is how a broken key gets mistaken for a content gap.
 */
export type KbAskDeclineReason =
  /** Retrieval found nothing to answer from; no model was called. */
  | "no_match"
  /** Articles were found and did not answer the question. */
  | "no_answer_in_articles"
  /** No API key configured — the box should not have been offered at all. */
  | "not_configured"
  /** The provider call failed. */
  | "model_error";

/** The reasons that say something about the knowledge base rather than the plumbing. */
const CONTENT_DECLINES = new Set<KbAskDeclineReason>(["no_match", "no_answer_in_articles"]);

export function isContentDecline(reason: KbAskDeclineReason): boolean {
  return CONTENT_DECLINES.has(reason);
}

export type RecordAskParams = {
  question: string;
  answered: boolean;
  declineReason?: KbAskDeclineReason | null;
  /** Slugs cited, or what retrieval offered when nothing was cited. */
  articleSlugs?: string[];
  topScore?: number | null;
  inputTokens?: number;
  outputTokens?: number;
  at?: number;
};

export async function recordKbAsk(params: RecordAskParams): Promise<string | null> {
  const question = params.question.trim().slice(0, MAX_QUESTION);
  const questionKey = searchKey(question);
  if (!questionKey) {
    return null;
  }
  const id = crypto.randomUUID();
  await getAdminDb()
    .insertInto("admin_kb_asks")
    .values({
      id,
      question,
      question_key: questionKey,
      answered: params.answered ? 1 : 0,
      decline_reason: params.declineReason ?? null,
      article_slugs: JSON.stringify(params.articleSlugs ?? []),
      top_score: params.topScore ?? null,
      input_tokens: Math.max(0, Math.trunc(params.inputTokens ?? 0)),
      output_tokens: Math.max(0, Math.trunc(params.outputTokens ?? 0)),
      // A question starts life as nobody's to answer but the box's; asking for
      // a person is a separate act, and a separate write.
      escalated_at: null,
      contact_email: null,
      created_at: params.at ?? Date.now(),
    })
    .execute();
  return id;
}

/**
 * How many questions have been asked since `since`.
 *
 * This is the hard ceiling on what the feature can cost, so it counts every
 * question — including the ones that never reached a model. A flood that
 * retrieval turned away still says the box is being hammered, and the right
 * response to that is the same: stop offering it for today.
 */
export async function countKbAsksSince(since: number): Promise<number> {
  const row = await getAdminDb()
    .selectFrom("admin_kb_asks")
    .select((eb) => eb.fn.countAll<number>().as("c"))
    .where("created_at", ">=", since)
    .executeTakeFirst();
  return row?.c ?? 0;
}

/**
 * An address is only kept when a client typed one into "send this to our team",
 * so this is generous on shape and strict on length. Rejecting a real address
 * for looking unusual would lose the request; what matters is that a reply can
 * be attempted and that nobody can paste an essay into the column.
 */
const MAX_EMAIL = 200;

function cleanEmail(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim().slice(0, MAX_EMAIL);
  if (!trimmed.includes("@") || /\s/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * What became of a request to pass a question to a person.
 *
 * Three outcomes, not two, and the difference matters to the client: "already"
 * is a second press of the same button and is still a promise we will keep,
 * while "unknown" means nothing was recorded and telling them it was sent would
 * leave them waiting for a reply that is never coming.
 */
export type KbEscalateResult = "marked" | "already" | "unknown";

/**
 * Note that a client asked for a person to look at their question.
 *
 * Only the first request counts, the same rule the search log's click follows:
 * the id travels to the browser, so a second press must not read as a second
 * person waiting. The id names a row that already exists — this can stamp one,
 * never create one.
 */
export async function escalateKbAsk(
  askId: string,
  opts: { email?: string | null; at?: number } = {},
): Promise<KbEscalateResult> {
  const db = getAdminDb();
  const result = await db
    .updateTable("admin_kb_asks")
    .set({ escalated_at: opts.at ?? Date.now(), contact_email: cleanEmail(opts.email) })
    .where("id", "=", askId)
    .where("escalated_at", "is", null)
    .executeTakeFirst();
  if ((result?.numUpdatedRows ?? 0n) > 0n) {
    return "marked";
  }
  // Nothing changed for one of two very different reasons. Ask which.
  const existing = await db
    .selectFrom("admin_kb_asks")
    .select("id")
    .where("id", "=", askId)
    .executeTakeFirst();
  return existing ? "already" : "unknown";
}

/** One question a client asked a person to look at. */
export type KbAskRequest = {
  id: string;
  question: string;
  /** Null when they did not leave one — you can read it, not answer it. */
  email: string | null;
  /** Whether the box had already answered when they asked for a person. */
  wasAnswered: boolean;
  escalatedAt: number;
};

/**
 * Requests for a person, newest first.
 *
 * Ungrouped, unlike everything else on the report: each of these is one client
 * waiting rather than a trend to read, and rolling two people's identical
 * question into a row with a "2" on it would lose one of them.
 */
export async function listKbAskRequests(
  opts: { days?: number; limit?: number } = {},
): Promise<KbAskRequest[]> {
  const days = Math.max(1, Math.min(Math.trunc(opts.days ?? 30), 365));
  const limit = Math.max(1, Math.min(Math.trunc(opts.limit ?? 100), 500));
  const rows = await getAdminDb()
    .selectFrom("admin_kb_asks")
    .select(["id", "question", "contact_email", "answered", "escalated_at"])
    .where("escalated_at", "is not", null)
    .where("escalated_at", ">=", Date.now() - days * 24 * 60 * 60 * 1000)
    .orderBy("escalated_at", "desc")
    .limit(limit)
    .execute();
  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    email: row.contact_email,
    wasAnswered: row.answered === 1,
    escalatedAt: row.escalated_at ?? 0,
  }));
}

export type KbAskGroup = {
  question: string;
  questionKey: string;
  asks: number;
  answered: number;
  lastAt: number;
};

export type KbAskSummary = {
  since: number;
  totalAsks: number;
  answeredAsks: number;
  /** Declines that mean the knowledge base is missing something. */
  contentDeclines: number;
  /** Declines that mean the feature itself is unwell. Read separately. */
  brokenDeclines: number;
  inputTokens: number;
  outputTokens: number;
  /** Questions a client asked a person to look at. Each one is someone waiting. */
  requests: KbAskRequest[];
  /** Questions nothing published could answer: the articles to write. */
  unanswered: KbAskGroup[];
  /** Every question by volume. */
  top: KbAskGroup[];
};

type AskGroupRow = {
  question: string;
  question_key: string;
  asks: number;
  answered: number;
  last_at: number;
};

export async function summarizeKbAsks(
  opts: { days?: number; limit?: number } = {},
): Promise<KbAskSummary> {
  const days = Math.max(1, Math.min(Math.trunc(opts.days ?? 30), 365));
  const limit = Math.max(1, Math.min(Math.trunc(opts.limit ?? 50), 500));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const db = getAdminDb();

  const totals = await sql<{
    total: number;
    answered: number;
    content_declines: number;
    broken_declines: number;
    input_tokens: number;
    output_tokens: number;
  }>`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN answered = 1 THEN 1 ELSE 0 END) AS answered,
      SUM(CASE WHEN answered = 0 AND decline_reason IN ('no_match','no_answer_in_articles') THEN 1 ELSE 0 END) AS content_declines,
      SUM(CASE WHEN answered = 0 AND decline_reason NOT IN ('no_match','no_answer_in_articles') THEN 1 ELSE 0 END) AS broken_declines,
      COALESCE(SUM(input_tokens), 0) AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens
    FROM admin_kb_asks
    WHERE created_at >= ${since}
  `.execute(db);

  // `question` is a bare column beside exactly one max() aggregate, which in
  // SQLite takes its value from that same row — the most recent phrasing.
  const grouped = await sql<AskGroupRow>`
    SELECT
      question,
      question_key,
      COUNT(*) AS asks,
      SUM(CASE WHEN answered = 1 THEN 1 ELSE 0 END) AS answered,
      MAX(created_at) AS last_at
    FROM admin_kb_asks
    WHERE created_at >= ${since}
    GROUP BY question_key
    ORDER BY asks DESC, last_at DESC
  `.execute(db);

  const groups: KbAskGroup[] = grouped.rows.map((row) => ({
    question: row.question,
    questionKey: row.question_key,
    asks: row.asks,
    answered: row.answered,
    lastAt: row.last_at,
  }));

  const t = totals.rows[0];
  return {
    requests: await listKbAskRequests({ days, limit }),
    since,
    totalAsks: t?.total ?? 0,
    answeredAsks: t?.answered ?? 0,
    contentDeclines: t?.content_declines ?? 0,
    brokenDeclines: t?.broken_declines ?? 0,
    inputTokens: t?.input_tokens ?? 0,
    outputTokens: t?.output_tokens ?? 0,
    // Never answered in the window. A question answered once is no longer a
    // hole, the same rule the search report's gap list follows.
    unanswered: groups.filter((g) => g.answered === 0).slice(0, limit),
    top: groups.slice(0, limit),
  };
}
