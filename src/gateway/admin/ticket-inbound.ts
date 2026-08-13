import { notifyClientOnResolution } from "./ticket-client-notify.js";
import { type ClientReplyForward, forwardClientReplyToDepartment } from "./ticket-mailer.js";
import {
  addTicketEvent,
  getTicketByReplyToken,
  parseReplyCommand,
  statusForReplyCommand,
  type Ticket,
  TICKET_NUMBER_PREFIXES,
  updateTicket,
} from "./ticket-store.js";

// Inbound department replies. A department works a ticket from their inbox; we
// match the reply back to the ticket by its reply token (the +hash on the To
// address — Postmark surfaces it as MailboxHash), read the first-line command
// (UPDATE / RESOLVED), and move the ticket. A sender allowlist gates command
// application so a client CC'd on the thread can't drive state; unverified
// replies are still logged, parked in needs_review, and forwarded to the
// department so the desk reads them where it works.

export type PostmarkInboundPayload = {
  From?: string;
  FromFull?: { Email?: string };
  MailboxHash?: string;
  OriginalRecipient?: string;
  ToFull?: Array<{ Email?: string; MailboxHash?: string }>;
  Subject?: string;
  TextBody?: string;
  StrippedTextReply?: string;
};

export type NormalizedInbound = {
  replyToken: string | null;
  fromEmail: string | null;
  text: string;
};

// Built from the minting prefixes so a new ticket class can never become
// unreplyable: `(?:wvt|test)-\d+`.
const PREFIX_ALTERNATION = TICKET_NUMBER_PREFIXES.map((p) =>
  p.replace(/-$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
).join("|");
const TOKEN_RE = new RegExp(`(?:${PREFIX_ALTERNATION})-\\d+`, "i");
/** Anchored variant for pulling a token out of a larger string. */
const TOKEN_CAPTURE_RE = new RegExp(`((?:${PREFIX_ALTERNATION})-\\d+)`, "i");

/** Pull the ticket reply token from a Postmark inbound payload, best-effort. */
export function extractReplyToken(payload: PostmarkInboundPayload): string | null {
  const hash = payload.MailboxHash?.trim();
  if (hash && TOKEN_RE.test(hash)) return hash.toLowerCase();

  const recipients: string[] = [];
  if (payload.OriginalRecipient) recipients.push(payload.OriginalRecipient);
  for (const t of payload.ToFull ?? []) {
    if (t.MailboxHash && TOKEN_RE.test(t.MailboxHash)) return t.MailboxHash.toLowerCase();
    if (t.Email) recipients.push(t.Email);
  }
  for (const addr of recipients) {
    // ticket+wvt-1042@domain → wvt-1042
    const plus = addr.match(/\+(\w+-\d+)@/i);
    if (plus && TOKEN_RE.test(plus[1]!)) return plus[1]!.toLowerCase();
  }

  // Subject carries `[WVT-1042]` (and `[TEST] [TEST-1001]` for demos), so match
  // the bracketed token rather than assuming which prefix it uses.
  const subj = payload.Subject?.match(new RegExp(`\\[${TOKEN_CAPTURE_RE.source}\\]`, "i"));
  if (subj) return subj[1]!.toLowerCase();
  return null;
}

export function normalizeInbound(payload: PostmarkInboundPayload): NormalizedInbound {
  const fromEmail = (payload.FromFull?.Email ?? payload.From ?? "").trim().toLowerCase() || null;
  const text = (payload.StrippedTextReply ?? payload.TextBody ?? "").trim();
  return { replyToken: extractReplyToken(payload), fromEmail, text };
}

export type InboundOutcome =
  | { status: "no_token" }
  | { status: "no_match"; replyToken: string }
  | { status: "unverified"; ticketNumber: string; fromEmail: string | null }
  | {
      status: "applied";
      ticketNumber: string;
      command: "update" | "resolved" | "none";
      newStatus: string;
    };

export type ApplyInboundOptions = {
  /** Lowercased department/staff addresses allowed to drive ticket state. Empty/undefined = allow all. */
  allowlist?: string[];
  /**
   * How a client's reply reaches the desk. Injected in tests; production uses
   * the real mailer, which no-ops when email is unconfigured.
   */
  forwardReply?: (ticket: Ticket, reply: ClientReplyForward) => Promise<unknown>;
};

/**
 * Match an inbound reply to its ticket and apply the command. Never throws for
 * business outcomes; returns a discriminated result the webhook logs.
 */
export async function applyInboundReply(
  payload: PostmarkInboundPayload,
  options: ApplyInboundOptions = {},
): Promise<InboundOutcome> {
  const { replyToken, fromEmail, text } = normalizeInbound(payload);
  if (!replyToken) return { status: "no_token" };

  const ticket = await getTicketByReplyToken(replyToken);
  if (!ticket) return { status: "no_match", replyToken };

  const allowlist = options.allowlist ?? [];
  const senderAllowed =
    allowlist.length === 0 || (fromEmail !== null && allowlist.includes(fromEmail));

  if (!senderAllowed) {
    // Log the reply but don't let an unverified sender move state.
    await addTicketEvent(ticket.id, {
      kind: "email_in",
      authorType: "client",
      authorName: fromEmail,
      body: text || "(no text)",
      meta: { from: fromEmail, verified: false },
    });
    await updateTicket(ticket.id, { status: "needs_review" }, { authorType: "system", name: null });
    // Tell the desk. Parking the ticket in needs_review only helps someone
    // already looking at the dashboard, and the department works from email —
    // so the client's words go where the work happens. Out-of-band for the same
    // reason as the resolution email: the webhook must answer the provider 200
    // regardless, or Postmark retries the whole reply.
    const forward = options.forwardReply ?? forwardClientReplyToDepartment;
    void forward(ticket, { fromEmail, message: text }).catch(() => {});
    return { status: "unverified", ticketNumber: ticket.number, fromEmail };
  }

  const parsed = parseReplyCommand(text);
  const newStatus = statusForReplyCommand(parsed.command);
  await addTicketEvent(ticket.id, {
    kind: "email_in",
    authorType: "staff",
    authorName: fromEmail,
    body: parsed.body || "(no text)",
    meta: { from: fromEmail, command: parsed.command, verified: true },
  });
  const updated = await updateTicket(
    ticket.id,
    { status: newStatus },
    { authorType: "staff", name: fromEmail },
  );
  // A desk closing a ticket from their inbox is the commonest way one gets
  // resolved, so the client hears about it from here as often as from the
  // dashboard. Out-of-band: the webhook must still answer the provider 200 even
  // if the courtesy email fails, or Postmark retries the whole reply.
  void notifyClientOnResolution(ticket, updated).catch(() => {});
  return { status: "applied", ticketNumber: ticket.number, command: parsed.command, newStatus };
}
