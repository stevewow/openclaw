import { emailLogoUrl } from "./ticket-brand.js";
import { getCategoryShortLabel } from "./ticket-category-store.js";
import { getDepartmentEmail } from "./ticket-department-store.js";
import {
  type LoadedEmailAttachment,
  loadTicketEmailAttachments,
  type TicketEmailAttachmentLoad,
} from "./ticket-email-attachments.js";
import {
  type ClientReplyView,
  clientReplySubject,
  renderClientReplyHtml,
  renderClientReplyText,
  renderTicketEmailHtml,
  renderTicketEmailText,
  type TicketEmailAttachment,
} from "./ticket-email-render.js";
import { addTicketEvent, type Ticket } from "./ticket-store.js";

// Outbound department notification for a ticket. Sent via Postmark's HTTP API
// (no SMTP dependency), mirroring the fetch-based Slack-handoff pattern:
// injectable fetch, a hard timeout, and failure logging so a ticket is never
// silently dropped. When email isn't configured we log and no-op — the ticket
// still lives in the dashboard.

const POSTMARK_ENDPOINT = "https://api.postmarkapp.com/email";
const SEND_TIMEOUT_MS = 10_000;

/** Last-resort label when a ticket's category has since been deleted. */
const FALLBACK_CATEGORY_LABEL = "Support request";

export type EmailConfig = {
  provider: "postmark";
  serverToken: string;
  from: string;
  /** Base inbound address; the ticket token is inserted as a +hash for replies. */
  inboundAddress: string;
  messageStream: string;
  departmentEmails: Record<string, string>;
  fallbackTo: string | null;
  /** Absolute URL of the masthead logo, resolved once from the same env. */
  logoUrl: string;
};

/**
 * Read email config from the environment. Returns null when the minimum needed
 * to send (token + from + a routable To) isn't present, so callers cleanly fall
 * back to log-only. Kept env-driven since this is core (no plugin config here);
 * the department map can move to a DB/UI table later.
 */
export function readEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig | null {
  const serverToken = env.POSTMARK_SERVER_TOKEN?.trim();
  const from = env.TICKET_EMAIL_FROM?.trim();
  if (!serverToken || !from) return null;

  let departmentEmails: Record<string, string> = {};
  const raw = env.TICKET_DEPARTMENT_EMAILS?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" && v.includes("@")) departmentEmails[k] = v;
      }
    } catch {
      departmentEmails = {};
    }
  }
  const fallbackTo = env.TICKET_EMAIL_FALLBACK_TO?.trim() || null;
  // Department addresses now live in the managed departments table; the env map
  // and fallback are optional back-compat, so token + from is enough here.

  return {
    provider: "postmark",
    serverToken,
    from,
    inboundAddress: env.TICKET_EMAIL_INBOUND_ADDRESS?.trim() || from,
    messageStream: env.POSTMARK_MESSAGE_STREAM?.trim() || "outbound",
    departmentEmails,
    fallbackTo,
    logoUrl: emailLogoUrl(env),
  };
}

export function resolveDepartmentEmail(department: string, config: EmailConfig): string | null {
  return config.departmentEmails[department] ?? config.fallbackTo ?? null;
}

/** Insert the ticket reply token as a +hash so replies route back by address. */
export function replyToAddress(base: string, replyToken: string): string {
  const at = base.indexOf("@");
  if (at === -1) return base;
  return `${base.slice(0, at)}+${replyToken}${base.slice(at)}`;
}

export type OutboundEmail = {
  to: string;
  from: string;
  replyTo: string;
  subject: string;
  textBody: string;
  /** Rendered alongside the text body; clients pick whichever they support. */
  htmlBody?: string;
  attachments?: LoadedEmailAttachment[];
};

/**
 * Pure: render the department notification for a ticket. The category label and
 * the attachment list are passed in (rather than looked up) because both are
 * async I/O — resolving them is the caller's job, and this stays testable.
 */
export function formatDepartmentEmail(
  ticket: Ticket,
  config: EmailConfig,
  to: string,
  categoryLabel: string = FALLBACK_CATEGORY_LABEL,
  attachments: TicketEmailAttachment[] = [],
): OutboundEmail {
  const view = { ticket, categoryLabel, attachments, logoUrl: config.logoUrl };
  return {
    to,
    from: config.from,
    replyTo: replyToAddress(config.inboundAddress, ticket.replyToken),
    subject: `${ticket.isTest ? "[TEST] " : ""}[${ticket.number}] ${ticket.subject}`,
    textBody: renderTicketEmailText(view),
    htmlBody: renderTicketEmailHtml(view),
  };
}

export type SendResult = { ok: boolean; detail?: string };

export interface TicketMailer {
  send(msg: OutboundEmail): Promise<SendResult>;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Postmark transactional send over its HTTP API. */
export class PostmarkMailer implements TicketMailer {
  constructor(
    private readonly config: EmailConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async send(msg: OutboundEmail): Promise<SendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const res = await this.fetchImpl(POSTMARK_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": this.config.serverToken,
        },
        body: JSON.stringify({
          From: msg.from,
          To: msg.to,
          ReplyTo: msg.replyTo,
          Subject: msg.subject,
          TextBody: msg.textBody,
          ...(msg.htmlBody ? { HtmlBody: msg.htmlBody } : {}),
          ...(msg.attachments?.length
            ? {
                Attachments: msg.attachments.map((a) => ({
                  Name: a.filename,
                  Content: a.content,
                  ContentType: a.contentType,
                })),
              }
            : {}),
          MessageStream: this.config.messageStream,
        }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { ErrorCode?: number; Message?: string };
      if (res.ok && (data.ErrorCode === 0 || data.ErrorCode === undefined)) return { ok: true };
      return { ok: false, detail: `postmark ${res.status}: ${data.Message ?? "send failed"}` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : "send error" };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function resolveTicketMailer(
  config: EmailConfig | null,
  fetchImpl: FetchLike = fetch,
): TicketMailer | null {
  if (!config) return null;
  return new PostmarkMailer(config, fetchImpl);
}

export type NotifyDeps = {
  config?: EmailConfig | null;
  mailer?: TicketMailer | null;
  logger?: { info: (m: string) => void; error: (m: string) => void };
  /**
   * Divert the notification to this address instead of the mapped department.
   * Used for admin-authorized test tickets so a demo doesn't email the real
   * desk. The caller is responsible for authorizing the override (see
   * `ticket-test-token.ts`); this function trusts what it's handed.
   */
  overrideTo?: string | null;
  /**
   * The client's uploads, already read and encoded. Injected in tests; left
   * unset in production so the ticket's stored files are loaded here.
   */
  attachments?: TicketEmailAttachmentLoad;
};

/**
 * Email the mapped department about a new ticket and record the attempt on the
 * ticket thread. Never throws. When email is unconfigured, logs and no-ops (the
 * ticket is already visible in the dashboard).
 */
export async function notifyDepartment(ticket: Ticket, deps: NotifyDeps = {}): Promise<SendResult> {
  const log = deps.logger ?? {
    info: (m: string) => console.log(`[tickets] ${m}`),
    error: (m: string) => console.error(`[tickets] ${m}`),
  };
  const config = deps.config !== undefined ? deps.config : readEmailConfig();
  const mailer = deps.mailer !== undefined ? deps.mailer : resolveTicketMailer(config);
  if (!config || !mailer) {
    log.info(`email not configured — ${ticket.number} (${ticket.department}) logged only`);
    return { ok: false, detail: "email not configured" };
  }
  // An admin-authorized override wins (test tickets); otherwise prefer the
  // managed departments table, then the optional env map.
  const to =
    deps.overrideTo?.trim() ||
    (await getDepartmentEmail(ticket.department)) ||
    resolveDepartmentEmail(ticket.department, config);
  if (!to) {
    log.error(`no email mapped for department "${ticket.department}" — ${ticket.number}`);
    return { ok: false, detail: "no department address" };
  }
  const categoryLabel = (await getCategoryShortLabel(ticket.category)) || FALLBACK_CATEGORY_LABEL;
  // A file we cannot read must not cost the desk its notification, so the load
  // failing at all falls back to sending without attachments.
  let loaded: TicketEmailAttachmentLoad = { files: [], summaries: [] };
  if (deps.attachments) {
    loaded = deps.attachments;
  } else {
    try {
      loaded = await loadTicketEmailAttachments(ticket.id);
    } catch (err) {
      log.error(`could not load attachments for ${ticket.number}: ${String(err)}`);
    }
  }
  const msg = formatDepartmentEmail(ticket, config, to, categoryLabel, loaded.summaries);
  const result = await mailer.send({ ...msg, attachments: loaded.files });
  const carried = loaded.files.length;
  await addTicketEvent(ticket.id, {
    kind: "email_out",
    authorType: "system",
    authorName: null,
    body: result.ok
      ? `Emailed ${to}${carried > 0 ? ` with ${carried} file${carried === 1 ? "" : "s"}` : ""}`
      : `Email to ${to} failed: ${result.detail ?? "unknown"}`,
    meta: { to, ok: result.ok, attached: carried },
  });
  if (!result.ok) log.error(`email send failed for ${ticket.number}: ${result.detail}`);
  return result;
}

export type ClientReplyForward = {
  /** Address the reply came from, lowercased, when the provider gave us one. */
  fromEmail: string | null;
  /** The reply with its quoted history already stripped. */
  message: string;
};

/**
 * Pass a client's reply on to the department working the ticket.
 *
 * The desk lives in its inbox: a reply that only lands in the dashboard is a
 * reply nobody reads. The ticket is parked in `needs_review` by the inbound
 * handler either way — this is what tells someone to go and look.
 *
 * Reply-To is the ticket's own token address, so the desk answering this email
 * drives the ticket exactly as answering the original notification does, rather
 * than writing back to a client who cannot see the thread.
 *
 * Never throws, for the same reason as `notifyDepartment`: the webhook has to
 * answer the provider 200 whatever happens here, or the reply is retried.
 */
export async function forwardClientReplyToDepartment(
  ticket: Ticket,
  reply: ClientReplyForward,
  deps: NotifyDeps = {},
): Promise<SendResult> {
  const log = deps.logger ?? {
    info: (m: string) => console.log(`[tickets] ${m}`),
    error: (m: string) => console.error(`[tickets] ${m}`),
  };
  const config = deps.config !== undefined ? deps.config : readEmailConfig();
  const mailer = deps.mailer !== undefined ? deps.mailer : resolveTicketMailer(config);
  if (!config || !mailer) {
    log.info(`email not configured — reply on ${ticket.number} logged only`);
    return { ok: false, detail: "email not configured" };
  }
  // A demo ticket may only ever reach the admin who minted it. The inbound
  // webhook carries no test grant, so there is no authorized address to divert
  // to and a real desk must not be told about a rehearsal.
  if (ticket.isTest && !deps.overrideTo?.trim()) {
    log.info(`test ticket ${ticket.number} — reply not forwarded to a real desk`);
    return { ok: false, detail: "test ticket without override recipient" };
  }
  const to =
    deps.overrideTo?.trim() ||
    (await getDepartmentEmail(ticket.department)) ||
    resolveDepartmentEmail(ticket.department, config);
  if (!to) {
    log.error(`no email mapped for department "${ticket.department}" — reply on ${ticket.number}`);
    return { ok: false, detail: "no department address" };
  }
  // A reply from the address on the ticket is the client; anything else is a
  // bystander on the thread, and the desk is told which it was.
  const requesterEmail = ticket.requesterEmail?.trim().toLowerCase() || null;
  const view: ClientReplyView = {
    ticket,
    fromEmail: reply.fromEmail,
    message: reply.message,
    fromRequester: requesterEmail !== null && reply.fromEmail === requesterEmail,
    logoUrl: config.logoUrl,
  };
  const result = await mailer.send({
    to,
    from: config.from,
    replyTo: replyToAddress(config.inboundAddress, ticket.replyToken),
    subject: clientReplySubject(ticket),
    textBody: renderClientReplyText(view),
    htmlBody: renderClientReplyHtml(view),
  });
  await addTicketEvent(ticket.id, {
    kind: "email_out",
    authorType: "system",
    authorName: null,
    body: result.ok
      ? `Forwarded the client's reply to ${to}`
      : `Forwarding the client's reply to ${to} failed: ${result.detail ?? "unknown"}`,
    meta: { to, ok: result.ok, audience: "department", kind: "client_reply" },
  });
  if (!result.ok) {
    log.error(`reply forward failed for ${ticket.number}: ${result.detail}`);
  }
  return result;
}
