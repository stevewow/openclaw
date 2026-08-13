// How a new ticket reads in the department's inbox.
//
// The desk works tickets from email, so this is the primary surface, not a
// notification: everything needed to act — who is asking, which property, what
// they want, what it was quoted at — has to be legible at a glance, above the
// fold, without opening the dashboard.
//
// Both bodies are built from one set of rows so the plain-text and HTML
// versions can never describe the same ticket differently. HTML is table-based
// with inline styles because the desks read this in Outlook, which supports
// neither flexbox nor a <style> block reliably.

import { formatPriceCents } from "./ticket-category-store.js";
import { type DescriptionBlock, partitionDescription } from "./ticket-description-format.js";
import type { Ticket } from "./ticket-store.js";

/** Brand palette, matching the public intake form. */
const WOW_RED = "#ff0000";
const INK = "#2c2c2c";
const MUTED = "#888888";
const HAIRLINE = "#ececec";
const PAGE_BG = "#f3f3f3";
const FONT = "Montserrat,'Segoe UI',Helvetica,Arial,sans-serif";

/** One file on the ticket, and whether it rode along on this email. */
export type TicketEmailAttachment = {
  filename: string;
  /** Bytes on disk; null when the size was not recorded. */
  filesize: number | null;
  /** False when it was left behind (too large for one message). */
  attached: boolean;
};

export type TicketEmailView = {
  ticket: Ticket;
  categoryLabel: string;
  attachments: TicketEmailAttachment[];
  /** Absolute URL of the logo; null falls back to the typeset wordmark. */
  logoUrl?: string | null;
};

/**
 * The masthead every ticket email carries.
 *
 * Mail clients block remote images until the reader trusts the sender, so the
 * alt text is styled to stand in for the mark rather than left to render as
 * default 12px serif: a blocked header then still reads as the brand instead of
 * looking broken. `display:block` kills the baseline gap Outlook adds under an
 * image, and the width/height attributes reserve the space so the card below
 * does not jump when the image lands.
 */
export function brandHeaderHtml(logoUrl: string | null | undefined): string {
  const mark = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="${EMAIL_LOGO_WIDTH}" height="${EMAIL_LOGO_HEIGHT}" alt="WOW Video Tours" style="display:block;border:0;outline:none;text-decoration:none;width:${EMAIL_LOGO_WIDTH}px;height:auto;max-width:100%;font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${WOW_RED}" />`
    : `<span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${WOW_RED}">WOW</span>
<span style="font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${INK};padding-left:6px">Video Tours</span>`;
  return `<tr><td style="padding:0 0 18px">${mark}</td></tr>`;
}

/** Rendered size of the masthead. The source file is 512×241. */
export const EMAIL_LOGO_WIDTH = 150;
export const EMAIL_LOGO_HEIGHT = 71;

/** A label/value pair on the ticket summary; `href` makes the value a link. */
type DetailRow = { label: string; value: string; href?: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Shoot dates arrive as whatever string Spiro put in the link. A parseable one
 * is shown the way a person would say it; anything else is passed through
 * untouched rather than being coerced into a wrong date.
 */
export function formatShootDate(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  // Date-only strings ("2026-08-11") parse as UTC midnight; reading them back
  // in UTC keeps them on the day that was written.
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? "UTC" : undefined,
  });
}

/** The estimate as the client saw it — a firm number or the band they were shown. */
export function formatTicketEstimate(ticket: Ticket): string | null {
  if (ticket.estimateCents === null) {
    return null;
  }
  const low = formatPriceCents(ticket.estimateCents);
  if (ticket.estimateMaxCents !== null && ticket.estimateMaxCents !== ticket.estimateCents) {
    return `${low}–${formatPriceCents(ticket.estimateMaxCents)}`;
  }
  return low;
}

/**
 * The ticket summary, in the order a desk reads it: who is asking, how to reach
 * them, which property, then what the job is worth. Rows with nothing to say
 * are dropped rather than shown empty — a wall of dashes is what made the old
 * notification hard to scan.
 */
export function ticketDetailRows(view: TicketEmailView): DetailRow[] {
  const t = view.ticket;
  const rows: DetailRow[] = [{ label: "Request", value: view.categoryLabel }];

  const who = [t.requesterName, t.agentTitle].filter(Boolean).join(" · ");
  if (who) {
    rows.push({ label: "From", value: who });
  }
  if (t.agentCompany) {
    rows.push({ label: "Company", value: t.agentCompany });
  }
  if (t.requesterEmail) {
    rows.push({ label: "Email", value: t.requesterEmail, href: `mailto:${t.requesterEmail}` });
  }
  if (t.requesterPhone) {
    rows.push({ label: "Phone", value: t.requesterPhone, href: `tel:${t.requesterPhone}` });
  }
  // Only worth a line when someone other than the agent pressed the button —
  // otherwise it repeats the From row.
  if (t.submittedBy && t.submittedBy !== t.requesterName) {
    rows.push({ label: "Submitted by", value: t.submittedBy });
  }
  if (t.orderAddress) {
    rows.push({ label: "Property", value: t.orderAddress });
  }
  if (t.orderId) {
    rows.push({ label: "Order", value: t.orderId });
  }
  if (t.orderLink) {
    rows.push({ label: "Order Link", value: t.orderLink, href: t.orderLink });
  }
  if (t.photographerName) {
    rows.push({ label: "Photographer", value: t.photographerName });
  }
  const shot = formatShootDate(t.shootDate);
  if (shot) {
    rows.push({ label: "Shoot date", value: shot });
  }

  const estimate = formatTicketEstimate(view.ticket);
  if (estimate) {
    rows.push({
      label: "Estimate",
      value: t.quoteRequired ? `${estimate} — quote before starting` : estimate,
    });
  } else if (t.quoteRequired) {
    rows.push({ label: "Estimate", value: "To be quoted before starting" });
  }
  return rows;
}

const REPLY_LINES = [
  "Start your reply with UPDATE to log progress (keeps the ticket open).",
  "Start your reply with RESOLVED to close it.",
  "Anything else is flagged for review in the dashboard.",
];

function attachmentNote(view: TicketEmailView): { attached: string[]; pending: string[] } {
  const attached: string[] = [];
  const pending: string[] = [];
  for (const file of view.attachments) {
    const size = formatFileSize(file.filesize);
    const line = size ? `${file.filename} (${size})` : file.filename;
    (file.attached ? attached : pending).push(line);
  }
  return { attached, pending };
}

export function renderTicketEmailText(view: TicketEmailView): string {
  const t = view.ticket;
  const lines: string[] = [];
  if (t.isTest) {
    lines.push("** TEST TICKET — this is a demonstration of the support flow.");
    lines.push("** No client is waiting and no action is required.");
    lines.push("");
  }
  lines.push(`${t.number} — ${view.categoryLabel}`);
  lines.push(t.subject);
  lines.push("");

  const rows = ticketDetailRows(view);
  const width = Math.max(...rows.map((r) => r.label.length));
  for (const row of rows) {
    lines.push(`${row.label.padEnd(width)}  ${row.value}`);
  }

  lines.push("");
  lines.push("WHAT THEY NEED");
  lines.push(t.description ?? "(no details provided)");

  const { attached, pending } = attachmentNote(view);
  if (attached.length > 0 || pending.length > 0) {
    lines.push("");
    lines.push("FILES");
    for (const file of attached) {
      lines.push(`  - ${file} — attached to this email`);
    }
    for (const file of pending) {
      lines.push(`  - ${file} — too large to attach; open ${t.number} in the dashboard`);
    }
  }

  lines.push("");
  lines.push("—");
  lines.push("Reply to this email to update the client's ticket:");
  for (const line of REPLY_LINES) {
    lines.push(`  • ${line}`);
  }
  lines.push(`Ticket ${t.number}`);
  return lines.join("\n");
}

// ── The client wrote back ─────────────────────────────────────────────────

/**
 * What the desk sees when a client replies to their ticket.
 *
 * A client's reply is logged on the thread and parks the ticket in `needs_review`
 * — but the desk works from their inbox, so without this the client's words sit
 * in a dashboard nobody is looking at and the ticket goes quiet. Deliberately
 * lighter than the new-ticket notification: the desk already has that email, so
 * this carries the message, the ticket it belongs to, and how to answer.
 */
export type ClientReplyView = {
  ticket: Ticket;
  /** Address the reply came from, when the provider gave us one. */
  fromEmail: string | null;
  /** The reply with its quoted history already stripped. */
  message: string;
  /** True when the sender is the address on the ticket, not a bystander. */
  fromRequester: boolean;
  logoUrl?: string | null;
};

export function clientReplySubject(ticket: Ticket): string {
  return `${ticket.isTest ? "[TEST] " : ""}[${ticket.number}] Client reply — ${ticket.subject}`;
}

/** "Jordan Reyes (jordan@…)" — whichever halves we actually have. */
function replyAuthor(view: ClientReplyView): string {
  const name = view.fromRequester ? view.ticket.requesterName?.trim() : null;
  if (name && view.fromEmail) {
    return `${name} (${view.fromEmail})`;
  }
  return name || view.fromEmail || "the client";
}

export function renderClientReplyText(view: ClientReplyView): string {
  const t = view.ticket;
  const lines: string[] = [];
  if (t.isTest) {
    lines.push("** TEST TICKET — a demonstration of the support flow.");
    lines.push("");
  }
  lines.push(`${t.number} — ${t.subject}`);
  if (t.orderAddress) {
    lines.push(t.orderAddress);
  }
  lines.push("");
  lines.push(`${replyAuthor(view)} replied:`);
  lines.push("");
  for (const line of (view.message || "(no text)").split("\n")) {
    lines.push(`  ${line}`);
  }
  lines.push("");
  if (!view.fromRequester) {
    lines.push("Note: this came from an address that is not the one on the ticket.");
    lines.push("");
  }
  lines.push(`${t.number} is now flagged for review in the dashboard, because a`);
  lines.push("client's reply is never allowed to move a ticket on its own.");
  lines.push("");
  lines.push("—");
  lines.push("Reply to this email to update the ticket:");
  for (const line of REPLY_LINES) {
    lines.push(`  • ${line}`);
  }
  lines.push(`Ticket ${t.number}`);
  return lines.join("\n");
}

export function renderClientReplyHtml(view: ClientReplyView): string {
  const t = view.ticket;
  const property = t.orderAddress
    ? `<tr><td style="padding:4px 0 0;color:${MUTED};font-size:14px">${escapeHtml(t.orderAddress)}</td></tr>`
    : "";
  const strangerNote = view.fromRequester
    ? ""
    : `<tr><td style="padding:14px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff8e1;border:1px solid #f0d9a0;border-radius:8px">
<tr><td style="padding:10px 14px;color:#7a5c00;font-size:13px;line-height:1.5">This came from an address that is not the one on the ticket.</td></tr>
</table></td></tr>`;

  const testBanner = t.isTest
    ? `<tr><td style="padding:0 0 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff8e1;border:1px solid #f0d9a0;border-radius:10px">
<tr><td style="padding:12px 16px;font-size:13px;color:#7a5c00;line-height:1.5">
<strong>TEST TICKET</strong> — a demonstration of the support flow. No client is waiting and no action is required.
</td></tr></table></td></tr>`
    : "";

  const message = escapeHtml(view.message || "(no text)").replace(/\n/g, "<br />");

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(t.number)}</title></head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(`${replyAuthor(view)} replied to ${t.number}`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${PAGE_BG}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:600px">

${brandHeaderHtml(view.logoUrl)}
${testBanner}

<tr><td style="background:#ffffff;border:1px solid ${HAIRLINE};border-radius:16px;padding:26px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">

<tr><td style="padding:0 0 4px">
<span style="display:inline-block;background:${WOW_RED};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.06em;padding:4px 10px;border-radius:6px">${escapeHtml(t.number)}</span>
<span style="color:${MUTED};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding-left:10px">Client reply</span>
</td></tr>

<tr><td style="padding:10px 0 0;font-size:19px;font-weight:700;color:${INK};line-height:1.35">${escapeHtml(t.subject)}</td></tr>
${property}

<tr><td style="padding:18px 0 0;color:${INK};font-size:14px;font-weight:600">${escapeHtml(replyAuthor(view))} replied:</td></tr>
<tr><td style="padding:8px 0 0">
<div style="background:#fafafa;border-left:3px solid ${WOW_RED};border-radius:0 10px 10px 0;padding:14px 16px;color:${INK};font-size:14px;line-height:1.7">${message}</div>
</td></tr>
${strangerNote}

<tr><td style="padding:16px 0 0;color:${MUTED};font-size:13px;line-height:1.6">${escapeHtml(t.number)} is now flagged for review in the dashboard — a client's reply is never allowed to move a ticket on its own.</td></tr>

</table>
</td></tr>

<tr><td style="padding:16px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:16px">
<tr><td style="padding:18px 22px">
<div style="color:${INK};font-size:14px;font-weight:700;padding-bottom:8px">Reply to this email to update the ticket</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${REPLY_LINES.map(
  (line) =>
    `<tr><td style="padding:3px 0;color:${MUTED};font-size:13px;line-height:1.5">• ${escapeHtml(line)}</td></tr>`,
).join("\n")}
</table>
</td></tr></table>
</td></tr>

<tr><td style="padding:14px 4px 0;color:${MUTED};font-size:12px">Ticket ${escapeHtml(t.number)} · WOW Video Tours</td></tr>

</table>
</td></tr></table>
</body>
</html>`;
}

function htmlDetailRow(row: DetailRow): string {
  const value = row.href
    ? `<a href="${escapeHtml(row.href)}" style="color:${WOW_RED};text-decoration:none">${escapeHtml(row.value)}</a>`
    : escapeHtml(row.value);
  return `<tr>
<td style="padding:6px 14px 6px 0;vertical-align:top;color:${MUTED};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap">${escapeHtml(row.label)}</td>
<td style="padding:6px 0;vertical-align:top;color:${INK};font-size:14px;font-weight:500">${value}</td>
</tr>`;
}

/**
 * One thing the client picked: what it is on the left, what it costs on the
 * right, and any follow-up answers tucked underneath it.
 *
 * A two-column table rather than a list, because the desk scans this for money —
 * prices sitting in a right-aligned column can be read down at a glance, where
 * prices trailing sentences of different lengths cannot.
 */
function htmlItemBlock(item: DescriptionBlock & { kind: "item" }): string {
  const answers = item.answers
    .map(
      (a) =>
        `<tr><td colspan="2" style="padding:2px 0 0 14px;color:${MUTED};font-size:13px;line-height:1.5"><span style="color:${INK}">${escapeHtml(a.label)}:</span> ${escapeHtml(a.value)}</td></tr>`,
    )
    .join("\n");
  const quote = item.quoteFirst
    ? ` <span style="display:inline-block;background:#fff3cd;color:#7a5c00;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:2px 6px;border-radius:4px;white-space:nowrap">Quote first</span>`
    : "";
  const price = item.price
    ? `<td style="padding:8px 0 0 12px;vertical-align:top;text-align:right;color:${INK};font-size:14px;font-weight:700;white-space:nowrap">${escapeHtml(item.price)}</td>`
    : `<td style="padding:8px 0 0"></td>`;
  return `<tr><td style="padding:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr>
<td style="padding:8px 0 0;vertical-align:top;color:${INK};font-size:14px;font-weight:600;line-height:1.5">${escapeHtml(item.label)}${quote}</td>
${price}
</tr>
${answers}
</table>
</td></tr>`;
}

/** The money lines, set apart from the picks by a rule above them. */
function htmlSummaryBlock(block: DescriptionBlock & { kind: "summary" }, first: boolean): string {
  const border = first ? `border-top:1px solid ${HAIRLINE};margin-top:10px;padding-top:10px` : "";
  return `<tr><td style="padding:4px 0 0">
<div style="${border}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr>
<td style="color:${MUTED};font-size:13px;line-height:1.5">${escapeHtml(block.label)}</td>
<td style="text-align:right;color:${INK};font-size:14px;font-weight:700;white-space:nowrap;padding-left:12px">${escapeHtml(block.value ?? "")}</td>
</tr></table></div></td></tr>`;
}

function htmlCalloutBlock(text: string): string {
  return `<tr><td style="padding:12px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff8e1;border:1px solid #f0d9a0;border-radius:8px">
<tr><td style="padding:10px 14px;color:#7a5c00;font-size:13px;font-weight:600;line-height:1.5">${escapeHtml(text)}</td></tr>
</table></td></tr>`;
}

/**
 * What the client asked for, laid out rather than pasted.
 *
 * The picks and the prose are shown as two different things: the specifics are
 * a work order the desk reads down, the free text is the client speaking and is
 * quoted as such. A description with no structure to find — a hand-written
 * ticket, or one from before the form itemized anything — is all prose, which
 * renders as the quoted block alone.
 */
function htmlNeedsSection(view: TicketEmailView): string {
  const { structured, notes } = partitionDescription(view.ticket.description);
  const eyebrow = `<div style="color:${MUTED};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:10px">What they need</div>`;

  if (structured.length === 0 && notes.length === 0) {
    return `<tr><td style="padding:22px 0 0">${eyebrow}
<div style="color:${MUTED};font-size:14px;font-style:italic">(no details provided)</div></td></tr>`;
  }

  let seenSummary = false;
  const rows = structured
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return `<tr><td style="padding:0 0 2px;color:${INK};font-size:14px;font-weight:700;line-height:1.5">${escapeHtml(block.text)}</td></tr>`;
        case "item":
          return htmlItemBlock(block);
        case "summary": {
          const row = htmlSummaryBlock(block, !seenSummary);
          seenSummary = true;
          return row;
        }
        case "callout":
          return htmlCalloutBlock(block.text);
        default:
          return "";
      }
    })
    .join("\n");

  const picks =
    structured.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:10px">
<tr><td style="padding:14px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${rows}
</table>
</td></tr></table>`
      : "";

  const prose =
    notes.length > 0
      ? `<div style="background:#fafafa;border-left:3px solid ${WOW_RED};border-radius:0 10px 10px 0;padding:14px 16px;color:${INK};font-size:14px;line-height:1.7;margin-top:${structured.length > 0 ? "12px" : "0"}">
${notes.map((n) => `<div style="padding:0 0 8px">${escapeHtml(n).replace(/\n/g, "<br />")}</div>`).join("\n")}
</div>`
      : "";

  return `<tr><td style="padding:22px 0 0">${eyebrow}${picks}${prose}</td></tr>`;
}

export function renderTicketEmailHtml(view: TicketEmailView): string {
  const t = view.ticket;
  const rows = ticketDetailRows(view).map(htmlDetailRow).join("\n");
  const { attached, pending } = attachmentNote(view);

  const testBanner = t.isTest
    ? `<tr><td style="padding:0 0 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff8e1;border:1px solid #f0d9a0;border-radius:10px">
<tr><td style="padding:12px 16px;font-size:13px;color:#7a5c00;line-height:1.5">
<strong>TEST TICKET</strong> — a demonstration of the support flow. No client is waiting and no action is required.
</td></tr></table></td></tr>`
    : "";

  const filesBlock =
    attached.length > 0 || pending.length > 0
      ? `<tr><td style="padding:22px 0 0">
<div style="color:${MUTED};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:8px">Files</div>
<ul style="margin:0;padding-left:18px;color:${INK};font-size:14px;line-height:1.7">
${attached.map((f) => `<li>${escapeHtml(f)} <span style="color:${MUTED}">— attached to this email</span></li>`).join("\n")}
${pending.map((f) => `<li>${escapeHtml(f)} <span style="color:${MUTED}">— too large to attach; open the ticket in the dashboard</span></li>`).join("\n")}
</ul></td></tr>`
      : "";

  // Preheader: the grey line inboxes show beside the subject. Without one, the
  // client picks up the first body text, which would be the brand mark.
  const preheader = [view.categoryLabel, t.orderAddress, t.requesterName]
    .filter(Boolean)
    .join(" · ");

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(t.number)}</title></head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${PAGE_BG}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:600px">

${brandHeaderHtml(view.logoUrl)}
${testBanner}

<tr><td style="background:#ffffff;border:1px solid ${HAIRLINE};border-radius:16px;padding:26px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">

<tr><td style="padding:0 0 4px">
<span style="display:inline-block;background:${WOW_RED};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.06em;padding:4px 10px;border-radius:6px">${escapeHtml(t.number)}</span>
<span style="color:${MUTED};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding-left:10px">${escapeHtml(view.categoryLabel)}</span>
</td></tr>

<tr><td style="padding:10px 0 18px;font-size:19px;font-weight:700;color:${INK};line-height:1.35">${escapeHtml(t.subject)}</td></tr>

<tr><td style="padding:0 0 4px;border-top:1px solid ${HAIRLINE}"></td></tr>
<tr><td style="padding:10px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${rows}
</table>
</td></tr>

${htmlNeedsSection(view)}
${filesBlock}

</table>
</td></tr>

<tr><td style="padding:16px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:16px">
<tr><td style="padding:18px 22px">
<div style="color:${INK};font-size:14px;font-weight:700;padding-bottom:8px">Reply to this email to update the ticket</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${REPLY_LINES.map(
  (line) =>
    `<tr><td style="padding:3px 0;color:${MUTED};font-size:13px;line-height:1.5">• ${escapeHtml(line)}</td></tr>`,
).join("\n")}
</table>
</td></tr></table>
</td></tr>

<tr><td style="padding:14px 4px 0;color:${MUTED};font-size:12px">Ticket ${escapeHtml(t.number)} · WOW Video Tours</td></tr>

</table>
</td></tr></table>
</body>
</html>`;
}
