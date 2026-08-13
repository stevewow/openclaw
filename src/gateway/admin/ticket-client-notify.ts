// Client-facing ticket email: the confirmation on submit, and the "it's done"
// on resolve.
//
// Separate from notifyDepartment because the two answer to different rules. The
// department notification is operational — it always goes, because a desk that
// misses one has an unworked job. These are courtesy, and courtesy that a client
// declined is spam: every send here is gated on the opt-out they set on the
// intake form, and a ticket with no requester email simply has no one to tell.
//
// Same never-throws contract as the department mailer: a client's submission
// must not fail because Postmark was slow, and a resolution must not be blocked
// because a mailbox bounced. Failures are logged and recorded on the thread.

import { supportBaseUrl } from "./ticket-brand.js";
import { getCategoryShortLabel } from "./ticket-category-store.js";
import {
  clientCreatedSubject,
  clientResolvedSubject,
  renderClientCreatedHtml,
  renderClientCreatedText,
  renderClientResolvedHtml,
  renderClientResolvedText,
  supportEmailAddress,
} from "./ticket-client-email-render.js";
import { countTicketAttachments } from "./ticket-email-attachments.js";
import {
  type EmailConfig,
  type FetchLike,
  type OutboundEmail,
  readEmailConfig,
  replyToAddress,
  resolveTicketMailer,
  type SendResult,
  type TicketMailer,
} from "./ticket-mailer.js";
import { addTicketEvent, ensureFeedbackToken, type Ticket } from "./ticket-store.js";

/** Last-resort label when a ticket's category has since been deleted. */
const FALLBACK_CATEGORY_LABEL = "Support request";

// Lives in ticket-brand.ts now that the department mailer needs it too; kept
// exported from here because this is where the feedback links are built.
export { supportBaseUrl };

/** The one-click rating link carried by the resolution email. */
export function feedbackUrl(
  token: string,
  rating: "up" | "down",
  env: NodeJS.ProcessEnv = process.env,
): string {
  return `${supportBaseUrl(env)}/support/feedback?t=${encodeURIComponent(token)}&r=${rating}`;
}

export type ClientNotifyDeps = {
  config?: EmailConfig | null;
  mailer?: TicketMailer | null;
  logger?: { info: (m: string) => void; error: (m: string) => void };
  env?: NodeJS.ProcessEnv;
  /**
   * Divert to this address instead of the requester's. Set for admin-authorized
   * test tickets, whose "client" is the admin running the demo — a demonstration
   * must never put mail in a real client's inbox.
   */
  overrideTo?: string | null;
  fetchImpl?: FetchLike;
};

export type ClientNotifyOutcome = SendResult & { skipped?: string };

/**
 * Everything both sends need, or a reason not to send. Resolving this once keeps
 * the two entry points from drifting on who counts as notifiable.
 */
function resolveRecipient(
  ticket: Ticket,
  deps: ClientNotifyDeps,
): { to: string } | { skip: string } {
  if (!ticket.notifyClient) {
    return { skip: "client opted out of updates" };
  }
  // A test ticket may only reach the admin who minted the demo token. Without
  // one there is nobody safe to write to, so it goes nowhere.
  if (ticket.isTest) {
    const to = deps.overrideTo?.trim();
    return to ? { to } : { skip: "test ticket with no override recipient" };
  }
  const to = deps.overrideTo?.trim() || ticket.requesterEmail?.trim();
  if (!to || !to.includes("@")) {
    return { skip: "no requester email" };
  }
  return { to };
}

type NotifyLogger = { info: (m: string) => void; error: (m: string) => void };

/** Send and log one client email, recording the attempt on the ticket thread. */
async function deliver(
  ticket: Ticket,
  msg: OutboundEmail,
  kind: "confirmation" | "resolution",
  mailer: TicketMailer,
  log: NotifyLogger,
): Promise<ClientNotifyOutcome> {
  const result = await mailer.send(msg);
  await addTicketEvent(ticket.id, {
    kind: "email_out",
    authorType: "system",
    authorName: null,
    body: result.ok
      ? `Emailed the client (${kind}) at ${msg.to}`
      : `Client ${kind} email to ${msg.to} failed: ${result.detail ?? "unknown"}`,
    meta: { to: msg.to, ok: result.ok, audience: "client", kind },
  });
  if (!result.ok) {
    log.error(`client ${kind} email failed for ${ticket.number}: ${result.detail}`);
  }
  return result;
}

type PreparedSend =
  | { ready: true; config: EmailConfig; mailer: TicketMailer; to: string; log: NotifyLogger }
  | { ready: false; outcome: ClientNotifyOutcome };

/** Shared setup: config, mailer, recipient and the logger the callers share. */
function prepare(ticket: Ticket, deps: ClientNotifyDeps): PreparedSend {
  const log: NotifyLogger = deps.logger ?? {
    info: (m: string) => console.log(`[tickets] ${m}`),
    error: (m: string) => console.error(`[tickets] ${m}`),
  };
  const config = deps.config !== undefined ? deps.config : readEmailConfig(deps.env);
  const mailer =
    deps.mailer !== undefined ? deps.mailer : resolveTicketMailer(config, deps.fetchImpl ?? fetch);
  if (!config || !mailer) {
    log.info(`client email not configured — ${ticket.number} not notified`);
    return { ready: false, outcome: { ok: false, skipped: "email not configured" } };
  }
  const recipient = resolveRecipient(ticket, deps);
  if ("skip" in recipient) {
    log.info(`client not emailed for ${ticket.number}: ${recipient.skip}`);
    return { ready: false, outcome: { ok: false, skipped: recipient.skip } };
  }
  return { ready: true, config, mailer, to: recipient.to, log };
}

/**
 * Tell the client we have their request. Fired alongside the department
 * notification, and just as fire-and-forget: the ticket is already saved, and
 * the submission has already succeeded from the client's point of view.
 */
export async function notifyClientTicketCreated(
  ticket: Ticket,
  deps: ClientNotifyDeps = {},
): Promise<ClientNotifyOutcome> {
  const prepared = prepare(ticket, deps);
  if (!prepared.ready) {
    return prepared.outcome;
  }
  const { config, mailer, to, log } = prepared;
  const categoryLabel = (await getCategoryShortLabel(ticket.category)) || FALLBACK_CATEGORY_LABEL;
  // Counted, not loaded: the client sent these files, so listing them back is
  // reassurance that they arrived, not content they need re-sent.
  let attachmentCount = 0;
  try {
    attachmentCount = await countTicketAttachments(ticket.id);
  } catch (err) {
    log.error(`could not count attachments for ${ticket.number}: ${String(err)}`);
  }
  const view = { ticket, categoryLabel, attachmentCount, logoUrl: config.logoUrl };
  return deliver(
    ticket,
    {
      to,
      from: config.from,
      // A client reply routes back onto the ticket thread. They are not on the
      // reply allowlist, so their words are logged and the ticket is flagged for
      // review rather than driven by them — which is exactly what a client
      // adding "one more thing" should do.
      replyTo: replyToAddress(config.inboundAddress, ticket.replyToken),
      subject: clientCreatedSubject(ticket),
      textBody: renderClientCreatedText(view),
      htmlBody: renderClientCreatedHtml(view),
    },
    "confirmation",
    mailer,
    log,
  );
}

/**
 * Send the resolution email only when this update is the move into `resolved`.
 *
 * Both resolve paths — the dashboard's status dropdown and a desk replying
 * `RESOLVED` — go through here so the rule lives once. Re-saving a ticket that
 * was already resolved must not email the client again, and a reopen followed by
 * a second resolve legitimately does: the transition, not the state, is what the
 * client is being told about.
 */
export async function notifyClientOnResolution(
  before: Ticket,
  after: Ticket | null,
  deps: ClientNotifyDeps = {},
): Promise<ClientNotifyOutcome | null> {
  if (!after || after.status !== "resolved" || before.status === "resolved") {
    return null;
  }
  return notifyClientTicketResolved(after, deps);
}

/**
 * Tell the client their request is done, and ask how it went.
 *
 * Called from every path that resolves a ticket — the dashboard and an inbound
 * `RESOLVED` reply alike — so the client hears the same thing however the desk
 * closed it.
 */
export async function notifyClientTicketResolved(
  ticket: Ticket,
  deps: ClientNotifyDeps = {},
): Promise<ClientNotifyOutcome> {
  const prepared = prepare(ticket, deps);
  if (!prepared.ready) {
    return prepared.outcome;
  }
  const { config, mailer, to, log } = prepared;
  const categoryLabel = (await getCategoryShortLabel(ticket.category)) || FALLBACK_CATEGORY_LABEL;
  // Minted now rather than at creation: only a ticket that actually reached a
  // client ever needs one, and the same token is reused if this is re-sent.
  const token = await ensureFeedbackToken(ticket.id);
  if (!token) {
    log.error(`could not mint a feedback token for ${ticket.number}`);
    return { ok: false, skipped: "no feedback token" };
  }
  const env = deps.env ?? process.env;
  const view = {
    ticket,
    categoryLabel,
    attachmentCount: 0,
    logoUrl: config.logoUrl,
    supportEmail: supportEmailAddress(env),
    feedbackUpUrl: feedbackUrl(token, "up", env),
    feedbackDownUrl: feedbackUrl(token, "down", env),
  };
  return deliver(
    ticket,
    {
      to,
      from: config.from,
      replyTo: replyToAddress(config.inboundAddress, ticket.replyToken),
      subject: clientResolvedSubject(ticket),
      textBody: renderClientResolvedText(view),
      htmlBody: renderClientResolvedHtml(view),
    },
    "resolution",
    mailer,
    log,
  );
}
