// The coach's log: what was asked, what came back, and what it cost.
//
// Written for every ask, answered or not, because the two readings this table
// is for both need the failures. The daily cap counts rows here, so a question
// that never reached a model still has to take a slot. And the useful report
// later — which objections the team keeps looking up, what the guide does not
// cover — is mostly in the asks that came back empty.
//
// Unlike the help center's log this keeps the user id. These are staff on work
// accounts asking an internal tool; attribution is the normal expectation, and
// "who is stuck on this" is the point of reading it.

import crypto from "node:crypto";
import { sql } from "kysely";
import { getAdminDb } from "./user-store.js";

/** A question is a sentence or two. This is a backstop against a paste. */
export const MAX_QUESTION = 2_000;

/** Why no answer came back. Null-ish outcomes are closed codes, not free text. */
export type CoachOutcome =
  | "answered"
  | "not_configured"
  | "empty_guide"
  | "model_error"
  | "no_answer";

export type CoachAskInput = {
  userId: string | null;
  threadId: string;
  question: string;
  answer?: string | null;
  outcome: CoachOutcome;
  cited?: string[];
  inputTokens?: number | null;
  cachedTokens?: number | null;
  outputTokens?: number | null;
  model?: string | null;
};

export async function recordCoachAsk(input: CoachAskInput): Promise<string | null> {
  const question = input.question.trim().slice(0, MAX_QUESTION);
  if (!question) {
    return null;
  }
  const id = crypto.randomUUID();
  await getAdminDb()
    .insertInto("admin_coach_asks")
    .values({
      id,
      user_id: input.userId,
      thread_id: input.threadId,
      question,
      answer: input.answer?.trim() || null,
      outcome: input.outcome,
      cited: JSON.stringify(input.cited ?? []),
      input_tokens: input.inputTokens ?? null,
      cached_tokens: input.cachedTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      model: input.model ?? null,
      created_at: Date.now(),
    })
    .execute();
  return id;
}

/**
 * Every ask since a moment, whatever came of it.
 *
 * The spend ceiling counts this, so it deliberately includes the ones that
 * never reached a model: an install with no key configured, or an empty guide,
 * is still something asking questions in a loop.
 */
export async function countCoachAsksSince(since: number): Promise<number> {
  const row = await getAdminDb()
    .selectFrom("admin_coach_asks")
    .select(({ fn }) => fn.countAll<number>().as("count"))
    .where("created_at", ">=", since)
    .executeTakeFirst();
  return row?.count ?? 0;
}

export type CoachThreadTurn = { question: string; answer: string | null };

/**
 * The turns of one conversation, oldest first.
 *
 * Read back from here rather than trusted from the browser: the client sends a
 * thread id, and what was actually said is ours. A tampered history would
 * otherwise be a way to put words in the coach's mouth.
 */
export async function listCoachThread(
  threadId: string,
  userId: string | null,
  limit = 12,
): Promise<CoachThreadTurn[]> {
  let query = getAdminDb()
    .selectFrom("admin_coach_asks")
    .select(["question", "answer"])
    .where("thread_id", "=", threadId)
    .where("outcome", "=", "answered");
  // A thread belongs to the person who started it. Without this, knowing a
  // thread id would be enough to read someone else's conversation.
  query = userId ? query.where("user_id", "=", userId) : query.where("user_id", "is", null);
  const rows = await query.orderBy("created_at", "desc").limit(limit).execute();
  return rows.toReversed().map((r) => ({ question: r.question, answer: r.answer }));
}

export type CoachUsageSummary = {
  asks: number;
  answered: number;
  people: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
};

/** Totals since a moment, for an operator wondering what this costs. */
export async function summarizeCoachAsks(since: number): Promise<CoachUsageSummary> {
  const row = await getAdminDb()
    .selectFrom("admin_coach_asks")
    .select([
      sql<number>`count(*)`.as("asks"),
      sql<number>`sum(case when outcome = 'answered' then 1 else 0 end)`.as("answered"),
      sql<number>`count(distinct user_id)`.as("people"),
      sql<number>`coalesce(sum(input_tokens), 0)`.as("input_tokens"),
      sql<number>`coalesce(sum(cached_tokens), 0)`.as("cached_tokens"),
      sql<number>`coalesce(sum(output_tokens), 0)`.as("output_tokens"),
    ])
    .where("created_at", ">=", since)
    .executeTakeFirst();
  return {
    asks: row?.asks ?? 0,
    answered: row?.answered ?? 0,
    people: row?.people ?? 0,
    inputTokens: row?.input_tokens ?? 0,
    cachedTokens: row?.cached_tokens ?? 0,
    outputTokens: row?.output_tokens ?? 0,
  };
}
