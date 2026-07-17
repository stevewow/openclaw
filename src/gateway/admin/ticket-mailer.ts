import { getCategoryShortLabel } from "./ticket-category-store.js";
import { getDepartmentEmail } from "./ticket-department-store.js";
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
};

/**
 * Pure: render the department notification for a ticket. The category label is
 * passed in (rather than looked up) because categories are admin-managed data —
 * resolving them is the caller's async job, and this stays testable.
 */
export function formatDepartmentEmail(
  ticket: Ticket,
  config: EmailConfig,
  to: string,
  categoryLabel: string = FALLBACK_CATEGORY_LABEL,
): OutboundEmail {
  const lines: string[] = [];
  if (ticket.isTest) {
    lines.push("⚠ TEST TICKET — this is a demonstration of the support flow.");
    lines.push("No client is waiting and no action is required.");
    lines.push("");
  }
  lines.push(`New support ticket ${ticket.number} — ${categoryLabel}`);
  lines.push("");
  const who = ticket.requesterName ?? "A client";
  const contact = ticket.requesterEmail ? ` <${ticket.requesterEmail}>` : "";
  lines.push(`From: ${who}${contact}`);
  if (ticket.requesterPhone) lines.push(`Phone: ${ticket.requesterPhone}`);
  if (ticket.orderAddress) lines.push(`Property: ${ticket.orderAddress}`);
  if (ticket.orderId) lines.push(`Order: ${ticket.orderId}`);
  lines.push("");
  lines.push(ticket.description ?? "(no details provided)");
  lines.push("");
  lines.push("—");
  lines.push("Reply to this email to update the client's ticket:");
  lines.push("  • Start your reply with UPDATE to log progress (keeps it open).");
  lines.push("  • Start your reply with RESOLVED to close it.");
  lines.push("Anything else is flagged for review in the dashboard.");
  lines.push(`Ticket ${ticket.number}`);

  return {
    to,
    from: config.from,
    replyTo: replyToAddress(config.inboundAddress, ticket.replyToken),
    subject: `${ticket.isTest ? "[TEST] " : ""}[${ticket.number}] ${ticket.subject}`,
    textBody: lines.join("\n"),
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
  const msg = formatDepartmentEmail(ticket, config, to, categoryLabel);
  const result = await mailer.send(msg);
  await addTicketEvent(ticket.id, {
    kind: "email_out",
    authorType: "system",
    authorName: null,
    body: result.ok ? `Emailed ${to}` : `Email to ${to} failed: ${result.detail ?? "unknown"}`,
    meta: { to, ok: result.ok },
  });
  if (!result.ok) log.error(`email send failed for ${ticket.number}: ${result.detail}`);
  return result;
}
