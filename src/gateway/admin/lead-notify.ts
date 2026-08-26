// Getting a lead in front of the person who can work it.
//
// Two sends, one transport. The dispatch is immediate and goes to the territory
// owner; the digest is one morning summary of the day before and goes to whoever
// watches the whole board. Both reuse the ticket mailer's Postmark transport and
// its never-throws contract: a dead mail provider must not lose a lead, which is
// already saved and visible in the Hub before any of this runs.

import { adminBaseUrl } from "./brand.js";
import {
  digestSubject,
  type LeadDigestView,
  leadSubject,
  renderDigestHtml,
  renderDigestText,
  renderLeadEmailHtml,
  renderLeadEmailText,
} from "./lead-email-render.js";
import { getLeadSettings, getPlaybook } from "./lead-playbooks-store.js";
import { type Lead, listLeadsBetween, recordLeadDispatch } from "./lead-store.js";
import { emailLogoUrl } from "./ticket-brand.js";
import {
  type EmailConfig,
  type OutboundEmail,
  PostmarkMailer,
  readEmailConfig,
  type SendResult,
  type TicketMailer,
} from "./ticket-mailer.js";
import { getAdminDb } from "./user-store.js";

/** Default hour, in the digest timezone, that the morning summary goes out. */
const DEFAULT_DIGEST_HOUR = 7;
const DEFAULT_DIGEST_TZ = "America/New_York";

export type LeadEmailSettings = {
  /** Where a lead goes when no territory owner matched its market. */
  fallbackTo: string | null;
  /** Who gets the morning digest. */
  digestTo: string | null;
  digestHour: number;
  digestTimeZone: string;
};

export function readLeadEmailSettings(env: NodeJS.ProcessEnv = process.env): LeadEmailSettings {
  const digestTo = env.LEADS_DIGEST_TO?.trim() || null;
  const hour = Number.parseInt(env.LEADS_DIGEST_HOUR?.trim() ?? "", 10);
  return {
    // An unrouted lead is the case that most needs a human, so it falls back
    // through every address configured before it is allowed to reach nobody.
    fallbackTo:
      env.LEADS_FALLBACK_TO?.trim() || digestTo || env.TICKET_EMAIL_FALLBACK_TO?.trim() || null,
    digestTo,
    digestHour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_DIGEST_HOUR,
    digestTimeZone: env.LEADS_DIGEST_TZ?.trim() || DEFAULT_DIGEST_TZ,
  };
}

export type LeadNotifyDeps = {
  config?: EmailConfig | null;
  mailer?: TicketMailer | null;
  settings?: LeadEmailSettings;
  logger?: { info: (m: string) => void; error: (m: string) => void };
  env?: NodeJS.ProcessEnv;
};

function resolveMailer(deps: LeadNotifyDeps): {
  config: EmailConfig | null;
  mailer: TicketMailer | null;
} {
  const config = deps.config !== undefined ? deps.config : readEmailConfig(deps.env);
  const mailer =
    deps.mailer !== undefined ? deps.mailer : config ? new PostmarkMailer(config) : null;
  return { config, mailer };
}

/**
 * Compose the dispatch. Reply-To is the lead's own address when they gave one,
 * so the owner answers the person rather than the Hub; without one it falls back
 * to the from-address, which a human does read.
 */
export function formatLeadEmail(
  lead: Lead,
  config: EmailConfig,
  to: string,
  env: NodeJS.ProcessEnv = process.env,
  tips: {
    playbook?: import("./lead-playbooks.js").LeadPlaybook | null;
    standardFollowUp?: string;
    attemptsBeforeStandard?: number;
  } = {},
): OutboundEmail {
  const view = {
    lead,
    logoUrl: emailLogoUrl(env),
    ...tips,
  };
  return {
    to,
    from: config.from,
    replyTo: lead.email?.trim() || config.from,
    subject: leadSubject(lead),
    textBody: renderLeadEmailText(view),
    htmlBody: renderLeadEmailHtml(view),
  };
}

/**
 * Email the territory owner about a new lead and record the attempt on it.
 * Never throws: the lead is already in the queue, and a failed send shows there
 * as an undelivered dispatch rather than disappearing into a log.
 */
export async function dispatchLead(lead: Lead, deps: LeadNotifyDeps = {}): Promise<SendResult> {
  const log = deps.logger ?? {
    info: (m: string) => console.log(`[leads] ${m}`),
    error: (m: string) => console.error(`[leads] ${m}`),
  };
  const env = deps.env ?? process.env;
  const settings = deps.settings ?? readLeadEmailSettings(env);
  const { config, mailer } = resolveMailer(deps);
  if (!config || !mailer) {
    const detail = "email not configured";
    log.info(`${detail} — ${lead.number} logged only`);
    await recordLeadDispatch(lead.id, { ok: false, error: detail });
    return { ok: false, detail };
  }
  const to = lead.ownerEmail?.trim() || settings.fallbackTo;
  if (!to) {
    const detail = lead.territoryKey
      ? `no address on the ${lead.territoryKey} territory`
      : "no territory matched and no fallback address";
    log.error(`${detail} — ${lead.number}`);
    await recordLeadDispatch(lead.id, { ok: false, error: detail });
    return { ok: false, detail };
  }
  // The outreach note is loaded here rather than inside the renderer, which
  // stays pure. A playbook deleted since the lead arrived simply sends the
  // plain email: the tips are guidance, never a reason to hold up a lead.
  const [playbook, leadSettings] = await Promise.all([
    getPlaybook(lead.playbookKey).catch(() => null),
    getLeadSettings().catch(() => null),
  ]);
  let result: SendResult;
  try {
    result = await mailer.send(
      formatLeadEmail(lead, config, to, env, {
        playbook,
        standardFollowUp: leadSettings?.standardFollowUp,
        attemptsBeforeStandard: leadSettings?.attemptsBeforeStandard,
      }),
    );
  } catch (err) {
    result = { ok: false, detail: err instanceof Error ? err.message : "send error" };
  }
  if (result.ok) {
    log.info(`${lead.number} dispatched to ${to}`);
    await recordLeadDispatch(lead.id, { ok: true, to });
  } else {
    log.error(`${lead.number} not dispatched: ${result.detail ?? "unknown error"}`);
    await recordLeadDispatch(lead.id, { ok: false, error: result.detail ?? "send failed" });
  }
  return result;
}

// ── The morning digest ────────────────────────────────────────────────────
// Days are counted in the sales team's own timezone, not the server's: a lead
// that arrives at 8pm Eastern belongs to that day's summary, and on a UTC box
// it would otherwise be filed under tomorrow.

/** Offset between the given instant and how the timezone renders it. */
function tzOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string): number => {
    const value = parts.find((p) => p.type === type)?.value ?? "0";
    return Number.parseInt(value, 10);
  };
  // Some ICU builds render midnight as hour 24 under hour12:false.
  const hour = get("hour") % 24;
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The calendar day an instant falls on in a timezone, as YYYY-MM-DD. */
export function localDay(instant: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const pick = (type: string): string => parts.find((p) => p.type === type)?.value ?? "01";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** The hour of the day an instant falls on in a timezone, 0–23. */
export function localHour(instant: number, timeZone: string): number {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
  }).format(new Date(instant));
  return Number.parseInt(value, 10) % 24;
}

/**
 * Midnight that starts a local day, as an epoch. Computed twice because the
 * offset used to place the guess can itself be the wrong side of a DST change.
 */
export function startOfLocalDay(day: string, timeZone: string): number {
  const [y, m, d] = day.split("-").map((n) => Number.parseInt(n, 10));
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const first = guess - tzOffsetMs(guess, timeZone);
  return guess - tzOffsetMs(first, timeZone);
}

/** The day before a YYYY-MM-DD day, in the same timezone. */
export function previousDay(day: string, timeZone: string): string {
  return localDay(startOfLocalDay(day, timeZone) - 12 * 60 * 60 * 1000, timeZone);
}

/** How the digest names the day it covers: "Monday, August 25". */
export function formatDayLabel(day: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(startOfLocalDay(day, timeZone) + 12 * 60 * 60 * 1000));
}

export type DigestOutcome =
  | {
      sent: false;
      reason: "not_configured" | "too_early" | "already_sent" | "no_leads" | "send_failed";
      day?: string;
    }
  | { sent: true; day: string; leadCount: number };

/**
 * Send yesterday's summary, once, if it is time.
 *
 * Safe to call as often as you like: the day it covers is written to a table
 * keyed by that day, so a restart inside the send window cannot mail a second
 * copy. A day with no leads is logged without an email — a daily "nothing
 * happened" note trains people to ignore the digest that matters.
 */
export async function runLeadDigest(
  deps: LeadNotifyDeps & { now?: number } = {},
): Promise<DigestOutcome> {
  const log = deps.logger ?? {
    info: (m: string) => console.log(`[leads] ${m}`),
    error: (m: string) => console.error(`[leads] ${m}`),
  };
  const env = deps.env ?? process.env;
  const settings = deps.settings ?? readLeadEmailSettings(env);
  const { config, mailer } = resolveMailer(deps);
  if (!config || !mailer || !settings.digestTo) {
    return { sent: false, reason: "not_configured" };
  }
  const now = deps.now ?? Date.now();
  const tz = settings.digestTimeZone;
  const today = localDay(now, tz);
  if (localHour(now, tz) < settings.digestHour) {
    return { sent: false, reason: "too_early" };
  }
  const day = previousDay(today, tz);
  const db = getAdminDb();
  const already = await db
    .selectFrom("admin_lead_digest_log")
    .select("day")
    .where("day", "=", day)
    .executeTakeFirst();
  if (already) {
    return { sent: false, reason: "already_sent", day };
  }
  const leads = await listLeadsBetween(startOfLocalDay(day, tz), startOfLocalDay(today, tz));
  const markSent = async (): Promise<void> => {
    await db
      .insertInto("admin_lead_digest_log")
      .values({ day, sent_at: now, lead_count: leads.length })
      .execute();
  };
  if (leads.length === 0) {
    await markSent();
    return { sent: false, reason: "no_leads", day };
  }
  const view: LeadDigestView = {
    dayLabel: formatDayLabel(day, tz),
    leads,
    logoUrl: emailLogoUrl(env),
    hubUrl: `${adminBaseUrl(env)}/admin#leads`,
  };
  let result: SendResult;
  try {
    result = await mailer.send({
      to: settings.digestTo,
      from: config.from,
      replyTo: config.from,
      subject: digestSubject(view),
      textBody: renderDigestText(view),
      htmlBody: renderDigestHtml(view),
    });
  } catch (err) {
    result = { ok: false, detail: err instanceof Error ? err.message : "send error" };
  }
  if (!result.ok) {
    // Deliberately not logged as sent: the next tick tries again, which is the
    // right answer for a summary that is still useful an hour late.
    log.error(`lead digest for ${day} failed: ${result.detail ?? "unknown error"}`);
    return { sent: false, reason: "send_failed", day };
  }
  await markSent();
  log.info(`lead digest for ${day} sent to ${settings.digestTo} (${leads.length})`);
  return { sent: true, day, leadCount: leads.length };
}

let schedulerStarted = false;
/** Hourly tick, so the digest goes out within the hour of its configured time. */
export function ensureLeadDigestScheduler(): void {
  if (schedulerStarted) {
    return;
  }
  schedulerStarted = true;
  const CHECK_INTERVAL_MS = 60 * 60 * 1000;
  const tick = async () => {
    try {
      await runLeadDigest();
    } catch (err) {
      console.error(`[leads] digest tick failed: ${String(err)}`);
    }
  };
  void tick();
  setInterval(() => void tick(), CHECK_INTERVAL_MS).unref();
}
