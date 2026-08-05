/**
 * WOW Video Tours' written collections process, as data.
 *
 * Pure policy — aging buckets, the ordered sequence of collection steps, and
 * payment-plan terms — with no database or Spiro dependency. It sits on its own
 * so both the report (`financials-store`) and the worklist (`past-due-cases-store`)
 * can read it without importing each other.
 */

// ── Collections policy ────────────────────────────────────────────────────
// Buckets and next-actions mirror WOW Video Tours' written collection process.
// A bucket is chosen by an account's OLDEST past-due invoice (worst case).
export type PastDueBucket = "45-59" | "60-89" | "90-119" | "120+";

export const PAST_DUE_BUCKETS: PastDueBucket[] = ["45-59", "60-89", "90-119", "120+"];

/**
 * The report starts where the collections process does. Nothing is owed to a
 * collector before the 45-day billing email, so an invoice younger than this is
 * left out of every figure on the report — balances, counts and tiles included —
 * rather than being shown and then filtered in the UI.
 */
export const PAST_DUE_MIN_DAYS = 45;

// Policy action surfaced per bucket. Kept declarative so the UI and any future
// automation read the same source of truth.
export function bucketForDays(daysPastDue: number): PastDueBucket | null {
  if (daysPastDue >= 120) {
    return "120+";
  }
  if (daysPastDue >= 90) {
    return "90-119";
  }
  if (daysPastDue >= 60) {
    return "60-89";
  }
  if (daysPastDue >= PAST_DUE_MIN_DAYS) {
    return "45-59";
  }
  return null;
}

/** Stable id for one step of the collections process. */
export type PastDueActionKey = "email_45" | "call_60" | "call_90" | "letter_120";

export type PastDueActionDef = {
  key: PastDueActionKey;
  /** 1-based position in the sequence. The picker shows it so the order reads. */
  step: number;
  label: string;
  detail: string;
  /** The aging bucket that calls for this step when nobody has overridden it. */
  bucket: PastDueBucket;
};

/**
 * The collections process in the order it happens. Aging picks a step by
 * default, but the two can legitimately disagree — an account can be worked
 * ahead of its age (the email already went early) or behind it (nobody has
 * called yet at 90 days) — so a case may pin its own step. Order here is the
 * source of truth for the picker and for the step numbers shown beside it.
 */
export const PAST_DUE_ACTIONS: PastDueActionDef[] = [
  {
    key: "email_45",
    step: 1,
    label: "Send billing email",
    detail: "45-day billing email from billing.",
    bucket: "45-59",
  },
  {
    key: "call_60",
    step: 2,
    label: "Billing call + notify BDS",
    detail: "60-day billing call. Notify BDS. Switch payment plan to pay-at-download.",
    bucket: "60-89",
  },
  {
    key: "call_90",
    step: 3,
    label: "Billing call / final email",
    detail:
      "90-day billing call. If no answer, send final collection email. Switch payment plan to pay-at-order.",
    bucket: "90-119",
  },
  {
    key: "letter_120",
    step: 4,
    label: "Letter → refer to collections",
    detail:
      "Letter sent 14 days after last contact with a 30-day deadline. Notify BDS. Refer to collections if no payment or plan by the deadline.",
    bucket: "120+",
  },
];

const ACTIONS_BY_KEY = new Map<string, PastDueActionDef>(PAST_DUE_ACTIONS.map((a) => [a.key, a]));

export function isPastDueActionKey(value: unknown): value is PastDueActionKey {
  return typeof value === "string" && ACTIONS_BY_KEY.has(value);
}

export function actionForKey(key: PastDueActionKey): PastDueActionDef {
  // Every key in the type has an entry, so the fallback is unreachable; it
  // keeps the return type honest without an assertion.
  return ACTIONS_BY_KEY.get(key) ?? PAST_DUE_ACTIONS[0];
}

/** What the written process calls for at this age, ignoring any override. */
export function policyAction(bucket: PastDueBucket): PastDueActionDef {
  return PAST_DUE_ACTIONS.find((a) => a.bucket === bucket) ?? PAST_DUE_ACTIONS[0];
}

export type ResolvedAction = PastDueActionDef & {
  /** Whether a human pinned this step or the account's age chose it. */
  source: "policy" | "override";
  /** What the age alone would call for — shown alongside an override. */
  policyKey: PastDueActionKey;
};

/** The step to show for an account: its override if it has one, else policy. */
export function resolveAction(
  bucket: PastDueBucket,
  override: PastDueActionKey | null,
): ResolvedAction {
  const fromPolicy = policyAction(bucket);
  if (!override) {
    return { ...fromPolicy, source: "policy", policyKey: fromPolicy.key };
  }
  return { ...actionForKey(override), source: "override", policyKey: fromPolicy.key };
}

// ── Pay-at-order prompt ────────────────────────────────────────────────────

/**
 * How many separate past-due invoices make a pattern rather than a bad month.
 *
 * Chosen against the live book rather than picked round: at three, 13 of the 79
 * past-due accounts qualify — 16% of accounts carrying 41% of the balance. Two
 * would flag 37% of accounts, which is a list nobody works; the account's age
 * is not used at all, because 76% of the book is already past 90 days and a
 * prompt that fires on three quarters of the report is wallpaper.
 */
export const PAY_AT_ORDER_MIN_INVOICES = 3;

export type PayAtOrderPrompt = {
  /** Whether to prompt for switching this client's future orders. */
  recommended: boolean;
  /** Separate past-due invoices behind the call, so the UI can say why. */
  invoiceCount: number;
  /** One line explaining the recommendation, or why there isn't one. */
  detail: string;
};

/**
 * Whether a client's future orders should be moved to pay-at-order.
 *
 * This is about the NEXT order, not this debt: one big unpaid invoice is a
 * collections problem, but several separately-billed shoots left unpaid is the
 * client's payment behaviour, and taking payment up front is what stops the
 * same balance rebuilding while collections works the existing one.
 *
 * Deliberately distinct from the collections step. Step 3 already tells a
 * collector to switch the plan at 90 days on this account; this answers the
 * different question of which clients keep doing it.
 */
export function payAtOrderPrompt(invoiceCount: number): PayAtOrderPrompt {
  const count = Number.isFinite(invoiceCount) ? Math.max(0, Math.trunc(invoiceCount)) : 0;
  if (count < PAY_AT_ORDER_MIN_INVOICES) {
    return {
      recommended: false,
      invoiceCount: count,
      detail:
        count === 1
          ? "One past-due invoice — a single miss, not yet a pattern."
          : `${count} past-due invoices — under the ${PAY_AT_ORDER_MIN_INVOICES} that mark a pattern.`,
    };
  }
  return {
    recommended: true,
    invoiceCount: count,
    detail: `${count} separate past-due invoices. Switch this client's future orders to Pay at order so the balance stops rebuilding while collections works the existing one.`,
  };
}

// Payment-plan terms per policy: 10% down, term capped by balance size.
export function paymentPlanTerms(balance: number): { requiredDown: number; maxMonths: number } {
  return {
    requiredDown: Math.round(balance * 0.1 * 100) / 100,
    maxMonths: balance < 1000 ? 3 : 6,
  };
}
