// What the coach is allowed to cost, and how often one person may use it.
//
// Same two-ceiling shape as `kb-ask-limits.ts`, with one deliberate change: the
// per-client key there is a forgeable `x-forwarded-for` hop, because the help
// center answers anonymous strangers. Here every caller has signed in, so the
// key is the user id and the limit means what it says.
//
// The hourly cap is generous on purpose. Someone working a call list should
// never meet it; it exists so a stuck loop in a browser tab cannot spend the
// day's budget before anyone notices.

import { countCoachAsksSince } from "./coach-store.js";

/** Off unless a key is configured. The same key the help center uses. */
export function coachApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.ANTHROPIC_API_KEY?.trim() || null;
}

/**
 * The model behind the coach.
 *
 * Its own variable rather than sharing `KB_ASK_MODEL`: the help center answers
 * three short excerpts to a client, this one drafts an email against the whole
 * guide, and those two jobs should be able to sit on different models.
 */
export function coachModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.COACH_MODEL?.trim() || "claude-opus-5";
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Questions from everyone, per day, before the coach switches itself off. */
export function coachDailyCap(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.COACH_DAILY_CAP, 600);
}

/** Questions from one person per hour. */
export function coachHourlyCap(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.COACH_HOURLY_CAP, 60);
}

/**
 * How much guide the model may be sent.
 *
 * The guide is ~16k tokens as it shipped, and every question pays for it. This
 * is the ceiling at which the Guide page starts warning that an edit is making
 * every question more expensive, and past which the corpus is truncated rather
 * than silently billed.
 */
export function coachCorpusTokenCap(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.COACH_CORPUS_TOKEN_CAP, 40_000);
}

type Window = { at: number[] };

const HOUR_MS = 60 * 60 * 1000;
const hourly = new Map<string, Window>();

/** One person's recent asks, pruned to the last hour. */
function recent(userId: string, now: number): number[] {
  const window = hourly.get(userId) ?? { at: [] };
  window.at = window.at.filter((t) => now - t < HOUR_MS);
  hourly.set(userId, window);
  return window.at;
}

export type CoachAllowance = { ok: true } | { ok: false; reason: "user" | "daily" };

/**
 * May this person ask right now?
 *
 * The memory check runs before the counted one for the usual reason — it is
 * free, and it catches the runaway tab. A slot is taken on allowance rather
 * than on a successful answer, so a failing model cannot be retried into a
 * large bill.
 */
export async function checkCoachAllowance(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CoachAllowance> {
  const now = Date.now();
  const at = recent(userId, now);
  if (at.length >= coachHourlyCap(env)) {
    return { ok: false, reason: "user" };
  }
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const today = await countCoachAsksSince(startOfDay);
  if (today >= coachDailyCap(env)) {
    return { ok: false, reason: "daily" };
  }
  at.push(now);
  return { ok: true };
}

/** Tests only. The window is process memory and nothing else reads it. */
export function resetCoachLimits(): void {
  hourly.clear();
}
