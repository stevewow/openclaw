/**
 * The handoff at the end of the collections process.
 *
 * Escalating is the one stage change that is not just a label: at that point
 * the account stops being a collector's to chase and becomes the admin's to
 * write the final letter on and refer to collections. So moving a case to
 * `escalated` also moves ownership, pins the letter step, records who handed it
 * over and why, and emails the new owner. Doing it here rather than in the UI
 * means it happens the same way from the dashboard, from the portal, and from
 * anything that calls the API later.
 *
 * Nothing in here throws. A dead mail provider must not fail the stage change —
 * the case is escalated in the database either way, and the admin inbox on the
 * report is built from the case, not from the email.
 */

import { adminBaseUrl, BRAND_NAME } from "./brand.js";
import { addNote } from "./financials-store.js";
import {
  markPastDueCaseEscalated,
  type PastDueCase,
  setPastDueCaseNextAction,
} from "./past-due-cases-store.js";
import { recordPastDueEvent } from "./past-due-events-store.js";
import { actionForKey } from "./past-due-policy.js";
import {
  type EmailConfig,
  type FetchLike,
  type OutboundEmail,
  PostmarkMailer,
  readEmailConfig,
  type SendResult,
  type TicketMailer,
} from "./ticket-mailer.js";
import { listUsers } from "./user-store.js";

/** The step escalation puts the account on: letter, then refer to collections. */
export const ESCALATION_ACTION_KEY = "letter_120" as const;

export type EscalationCandidate = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  createdAt?: number;
};

export type EscalationOwner = {
  id: string;
  name: string;
  email: string | null;
};

function displayName(u: EscalationCandidate): string {
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return full || u.username;
}

/**
 * Who the final letter belongs to.
 *
 * The superadmin owns the business's collections escalations, so they win; a
 * plain admin is the fallback for an installation that has no superadmin, and
 * the earliest-created one is picked so the answer is stable rather than
 * depending on row order. Pure, and takes the user list, so the choice is
 * testable without a database.
 */
export function resolveEscalationOwner(
  users: readonly EscalationCandidate[],
): EscalationOwner | null {
  const byAge = (a: EscalationCandidate, b: EscalationCandidate) =>
    (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id);
  const pick =
    users.filter((u) => u.role === "superadmin").toSorted(byAge)[0] ??
    users.filter((u) => u.role === "admin").toSorted(byAge)[0] ??
    null;
  return pick ? { id: pick.id, name: displayName(pick), email: pick.email } : null;
}

/** Deep link that opens this account on the Past Due page. */
export function pastDueAccountUrl(
  accountKey: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return `${adminBaseUrl(env)}/admin#past-due?account=${encodeURIComponent(accountKey)}`;
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type EscalationEmailParams = {
  accountKey: string;
  accountName: string;
  /** Still owed on the account, for the letter. */
  balance: number;
  invoiceCount: number;
  oldestDaysPastDue: number;
  /** Who escalated it — the collector handing the account over. */
  actorName: string;
  recipientName: string;
  reason: string | null;
  /** Last contact made on the debt, so the 14-day letter clock is readable. */
  lastContactAt: number | null;
  config: EmailConfig;
  to: string;
  env?: NodeJS.ProcessEnv;
};

/**
 * Pure: the note that lands in the admin's inbox when an account is escalated.
 * It carries the facts the letter needs — balance, age, last contact, and the
 * collector's reason — so the letter can be written without opening the report,
 * while still linking straight to the account.
 */
export function formatEscalationEmail(params: EscalationEmailParams): OutboundEmail {
  const step = actionForKey(ESCALATION_ACTION_KEY);
  const lines: string[] = [];
  lines.push(`Hi ${params.recipientName},`);
  lines.push("");
  lines.push(
    `${params.actorName} escalated ${params.accountName}. It is now assigned to you for the final letter.`,
  );
  lines.push("");
  if (params.reason) {
    for (const line of params.reason.split("\n")) {
      lines.push(`> ${line}`);
    }
    lines.push("");
  }
  lines.push(`Balance: ${money(params.balance)}`);
  lines.push(`Invoices: ${params.invoiceCount} past due, oldest ${params.oldestDaysPastDue} days`);
  lines.push(
    `Last contact: ${params.lastContactAt ? shortDate(params.lastContactAt) : "none logged"}`,
  );
  lines.push("");
  lines.push(`Next step — ${step.label}: ${step.detail}`);
  lines.push("");
  lines.push(`Open the account: ${pastDueAccountUrl(params.accountKey, params.env)}`);
  lines.push("");
  lines.push("—");
  lines.push(`You're getting this because you own collections escalations in ${BRAND_NAME}.`);

  return {
    to: params.to,
    from: params.config.from,
    // One-way: nothing parses replies to this, so a reply should reach a human
    // on the from-address rather than bouncing off an address nobody reads.
    replyTo: params.config.from,
    subject: `Escalated: ${params.accountName} — ${money(params.balance)} for final letter`,
    textBody: lines.join("\n"),
  };
}

export type EscalationDeps = {
  config?: EmailConfig | null;
  mailer?: TicketMailer | null;
  logger?: { info: (m: string) => void; error: (m: string) => void };
  env?: NodeJS.ProcessEnv;
  /** Injected for tests; production reads the admin user table. */
  loadUsers?: () => Promise<EscalationCandidate[]>;
  fetchImpl?: FetchLike;
};

export type EscalationInput = {
  accountKey: string;
  accountName: string;
  reason: string | null;
  actor: { id: string; name: string };
  /** Account facts for the email. Absent when the invoice snapshot has moved on. */
  facts?: {
    balance: number;
    invoiceCount: number;
    oldestDaysPastDue: number;
    lastContactAt: number | null;
  } | null;
  /** Whether the case already pins a step; the letter is not forced over one. */
  hasPinnedAction?: boolean;
  now?: number;
};

export type EscalationResult = {
  case: PastDueCase;
  owner: EscalationOwner | null;
  /** Null when nothing was sent — no owner, no address, or no mail config. */
  notified: SendResult | null;
};

/**
 * Escalate one account: hand it to the escalation owner, put it on the letter
 * step, write the trail, and tell the new owner.
 *
 * The step is only pinned when nobody had pinned one. Someone who deliberately
 * set the account to a different step and then escalated meant both things, and
 * silently overwriting their choice would be the kind of hidden edit that makes
 * a collector stop trusting the board.
 */
export async function escalatePastDueCase(
  input: EscalationInput,
  deps: EscalationDeps = {},
): Promise<EscalationResult> {
  const log = deps.logger ?? {
    info: (m: string) => console.log(`[past-due] ${m}`),
    error: (m: string) => console.error(`[past-due] ${m}`),
  };
  const now = input.now ?? Date.now();
  const users = await (deps.loadUsers ?? listUsers)();
  const owner = resolveEscalationOwner(users);

  const updated = await markPastDueCaseEscalated({
    accountKey: input.accountKey,
    accountName: input.accountName,
    ownerId: owner?.id ?? null,
    reason: input.reason,
    byUserId: input.actor.id,
    byUserName: input.actor.name,
    now,
  });

  let finalCase = updated;
  if (!input.hasPinnedAction) {
    finalCase = await setPastDueCaseNextAction({
      accountKey: input.accountKey,
      accountName: input.accountName,
      nextAction: ESCALATION_ACTION_KEY,
      byUserName: input.actor.name,
      now,
    });
  }

  await recordPastDueEvent({
    accountKey: input.accountKey,
    kind: "escalation",
    summary: owner
      ? `Escalated to ${owner.name} for the final letter`
      : "Escalated — no escalation owner configured",
    detail: input.reason,
    actorId: input.actor.id,
    actorName: input.actor.name,
    now,
  });

  // The reason is also written to the notes thread. The timeline shows it
  // either way, but notes are what someone reads when they open the account
  // cold, and an escalation reason is exactly that kind of context.
  if (input.reason?.trim()) {
    try {
      await addNote({
        accountKey: input.accountKey,
        body: `Escalated: ${input.reason.trim()}`,
        createdBy: input.actor.id,
        createdByName: input.actor.name,
      });
    } catch (err) {
      log.error(
        `escalation note on ${input.accountKey} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const notified = await notifyEscalationOwner(input, owner, deps, log);
  return { case: finalCase, owner, notified };
}

async function notifyEscalationOwner(
  input: EscalationInput,
  owner: EscalationOwner | null,
  deps: EscalationDeps,
  log: { info: (m: string) => void; error: (m: string) => void },
): Promise<SendResult | null> {
  if (!owner) {
    log.error(`no admin to escalate ${input.accountKey} to — case left with its current owner`);
    return null;
  }
  // Escalating your own account is a note to self; the case still moves, there
  // is just nobody else to tell.
  if (owner.id === input.actor.id) {
    return null;
  }
  if (!owner.email) {
    log.info(`no email on file for ${owner.name} — escalation not emailed`);
    return null;
  }
  const config = deps.config !== undefined ? deps.config : readEmailConfig(deps.env);
  const mailer =
    deps.mailer !== undefined
      ? deps.mailer
      : config
        ? new PostmarkMailer(config, deps.fetchImpl ?? fetch)
        : null;
  if (!config || !mailer) {
    log.info(`email not configured — escalation of ${input.accountKey} not sent`);
    return null;
  }
  const facts = input.facts ?? null;
  const msg = formatEscalationEmail({
    accountKey: input.accountKey,
    accountName: input.accountName,
    balance: facts?.balance ?? 0,
    invoiceCount: facts?.invoiceCount ?? 0,
    oldestDaysPastDue: facts?.oldestDaysPastDue ?? 0,
    actorName: input.actor.name,
    recipientName: owner.name,
    reason: input.reason,
    lastContactAt: facts?.lastContactAt ?? null,
    config,
    to: owner.email,
    env: deps.env,
  });
  const result = await mailer.send(msg);
  if (!result.ok) {
    log.error(`escalation email to ${owner.email} failed: ${result.detail ?? "unknown"}`);
  }
  return result;
}
