// What the client reads — the two emails a requester gets about their own
// ticket: we have it, and it's done.
//
// A different job from the department notification in ticket-email-render.ts.
// That one is a work order: everything the desk needs to act, dense and
// scannable. These are reassurance. The client already knows what they asked
// for, so repeating the brief back at them in full is noise; what they cannot
// see is that a human has it, what its number is, and how to reach us if the
// answer is wrong.
//
// Same construction rules as the department email: one set of facts feeds both
// bodies so they can never disagree, and the HTML is table-based with inline
// styles because Outlook supports neither flexbox nor a reliable <style> block.

import { brandHeaderHtml, escapeHtml } from "./ticket-email-render.js";
import type { Ticket } from "./ticket-store.js";

/** Brand palette, matching the intake form and the department email. */
const WOW_RED = "#ff0000";
const INK = "#2c2c2c";
const MUTED = "#888888";
const HAIRLINE = "#ececec";
const PAGE_BG = "#f3f3f3";
const FONT = "Montserrat,'Segoe UI',Helvetica,Arial,sans-serif";

/** Where a client is pointed when something still isn't right. */
export const DEFAULT_SUPPORT_EMAIL = "support@wowvideotours.com";

export function supportEmailAddress(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.TICKET_SUPPORT_EMAIL?.trim();
  return raw && raw.includes("@") ? raw : DEFAULT_SUPPORT_EMAIL;
}

/**
 * A `mailto:` that arrives already labelled with the ticket, so a reply lands on
 * the desk with its number instead of as an unattributed "this looks wrong".
 */
export function supportMailto(ticket: Ticket, supportEmail: string): string {
  const subject = encodeURIComponent(`${ticket.number} — something doesn't look right`);
  return `mailto:${supportEmail}?subject=${subject}`;
}

export type ClientEmailView = {
  ticket: Ticket;
  categoryLabel: string;
  /** How many files rode in with the request; 0 hides the line. */
  attachmentCount: number;
  /** Absolute URL of the logo; null falls back to the typeset wordmark. */
  logoUrl?: string | null;
};

export type ResolvedEmailView = ClientEmailView & {
  supportEmail: string;
  /** Landing page for a 👍, already carrying the ticket's feedback token. */
  feedbackUpUrl: string;
  feedbackDownUrl: string;
};

/** Subject lines. Kept `[WVT-1042]`-prefixed so a client's inbox threads them. */
export function clientCreatedSubject(ticket: Ticket): string {
  return `${ticket.isTest ? "[TEST] " : ""}[${ticket.number}] We've got your request`;
}

export function clientResolvedSubject(ticket: Ticket): string {
  return `${ticket.isTest ? "[TEST] " : ""}[${ticket.number}] Your request is complete`;
}

/** First name only — "Hi Jordan" reads like a person, "Hi Jordan Reyes" like a form. */
export function greetingName(ticket: Ticket): string | null {
  const first = ticket.requesterName?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

/** The property line, falling back to the order id when we were given no address. */
function propertyLine(ticket: Ticket): string | null {
  if (ticket.orderAddress) {
    return ticket.orderAddress;
  }
  return ticket.orderId ? `Order ${ticket.orderId}` : null;
}

function greetingLine(ticket: Ticket): string {
  const name = greetingName(ticket);
  return name ? `Hi ${name},` : "Hi,";
}

// ── Shared HTML furniture ─────────────────────────────────────────────────

function htmlShell(opts: {
  title: string;
  preheader: string;
  body: string;
  footerNote: string;
  logoUrl?: string | null;
}): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${PAGE_BG}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:600px">

${brandHeaderHtml(opts.logoUrl)}

${opts.body}

<tr><td style="padding:14px 4px 0;color:${MUTED};font-size:12px;line-height:1.6">${opts.footerNote}</td></tr>

</table>
</td></tr></table>
</body>
</html>`;
}

/** The white card every one of these emails puts its message inside. */
function card(inner: string): string {
  return `<tr><td style="background:#ffffff;border:1px solid ${HAIRLINE};border-radius:16px;padding:26px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${inner}
</table>
</td></tr>`;
}

function numberChip(ticket: Ticket, caption: string): string {
  return `<tr><td style="padding:0 0 14px">
<span style="display:inline-block;background:${WOW_RED};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.06em;padding:4px 10px;border-radius:6px">${escapeHtml(ticket.number)}</span>
<span style="color:${MUTED};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding-left:10px">${escapeHtml(caption)}</span>
</td></tr>`;
}

function paragraph(text: string, topPad = 0): string {
  return `<tr><td style="padding:${topPad}px 0 0;color:${INK};font-size:15px;line-height:1.65">${text}</td></tr>`;
}

/** A bulletproof-ish button: a padded, rounded anchor Outlook renders acceptably. */
function button(href: string, label: string, background: string, color: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${background};color:${color};font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px;border:1px solid ${background === "#ffffff" ? HAIRLINE : background}">${escapeHtml(label)}</a>`;
}

/** The test-mode banner, so a demo can never be mistaken for a real ticket. */
function testBanner(ticket: Ticket): string {
  if (!ticket.isTest) {
    return "";
  }
  return `<tr><td style="padding:0 0 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff8e1;border:1px solid #f0d9a0;border-radius:10px">
<tr><td style="padding:12px 16px;font-size:13px;color:#7a5c00;line-height:1.5">
<strong>TEST</strong> — a demonstration of the support flow. This is not a real request.
</td></tr></table></td></tr>`;
}

// ── "We've got it" ────────────────────────────────────────────────────────

/**
 * The line that tells a client what we understood, without replaying their whole
 * brief back at them. The category and the property are the two facts they can
 * check at a glance to know we filed the right thing.
 */
function receivedFacts(view: ClientEmailView): string[] {
  const facts: string[] = [view.categoryLabel];
  const property = propertyLine(view.ticket);
  if (property) {
    facts.push(property);
  }
  return facts;
}

export function renderClientCreatedText(view: ClientEmailView): string {
  const t = view.ticket;
  const lines: string[] = [];
  if (t.isTest) {
    lines.push("** TEST — a demonstration of the support flow, not a real request.");
    lines.push("");
  }
  lines.push(greetingLine(t));
  lines.push("");
  lines.push(`Thanks — we've got your request and it's with the right team.`);
  lines.push("");
  lines.push(`Your reference is ${t.number}.`);
  lines.push(`  ${receivedFacts(view).join(" · ")}`);
  if (view.attachmentCount > 0) {
    lines.push(
      `  ${view.attachmentCount} file${view.attachmentCount === 1 ? "" : "s"} received with your request`,
    );
  }
  lines.push("");
  lines.push("WHAT HAPPENS NEXT");
  lines.push("Someone from the team will begin working on your listing and follow up");
  lines.push("by email. We'll let you know as soon as it's done!");
  lines.push("");
  lines.push("You can reply to this email if you need to add anything.");
  lines.push("");
  lines.push("—");
  lines.push(`WOW Video Tours · Ticket ${t.number}`);
  return lines.join("\n");
}

export function renderClientCreatedHtml(view: ClientEmailView): string {
  const t = view.ticket;
  const facts = receivedFacts(view)
    .map((f) => escapeHtml(f))
    .join(` <span style="color:${MUTED}">·</span> `);
  const files =
    view.attachmentCount > 0
      ? `<tr><td style="padding:8px 0 0;color:${MUTED};font-size:13px">${view.attachmentCount} file${view.attachmentCount === 1 ? "" : "s"} received with your request</td></tr>`
      : "";

  const body = `${testBanner(t)}
${card(`${numberChip(t, "Request received")}
${paragraph(escapeHtml(greetingLine(t)))}
${paragraph(`Thanks — we've got your request and it's with the right team.`, 12)}

<tr><td style="padding:18px 0 0">
<div style="background:#fafafa;border-left:3px solid ${WOW_RED};border-radius:0 10px 10px 0;padding:14px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td style="color:${MUTED};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:6px">Your reference</td></tr>
<tr><td style="color:${INK};font-size:18px;font-weight:800;letter-spacing:0.02em;padding-bottom:4px">${escapeHtml(t.number)}</td></tr>
<tr><td style="color:${INK};font-size:14px;line-height:1.5">${facts}</td></tr>
${files}
</table>
</div>
</td></tr>

<tr><td style="padding:22px 0 0">
<div style="color:${MUTED};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:8px">What happens next</div>
<div style="color:${INK};font-size:14px;line-height:1.65">Someone from the team will begin working on your listing and follow up by email. We'll let you know as soon as it's done!</div>
</td></tr>

${paragraph(`<span style="color:${MUTED};font-size:13px">Need to add something? Just reply to this email.</span>`, 18)}`)}`;

  return htmlShell({
    title: t.number,
    preheader: `We've got your request — ${t.number}`,
    body,
    footerNote: `Ticket ${escapeHtml(t.number)} · WOW Video Tours`,
    logoUrl: view.logoUrl,
  });
}

// ── "It's done" ───────────────────────────────────────────────────────────

export function renderClientResolvedText(view: ResolvedEmailView): string {
  const t = view.ticket;
  const lines: string[] = [];
  if (t.isTest) {
    lines.push("** TEST — a demonstration of the support flow, not a real request.");
    lines.push("");
  }
  lines.push(greetingLine(t));
  lines.push("");
  lines.push(`Good news — your request is complete.`);
  lines.push("");
  lines.push(`${t.number} · ${receivedFacts(view).join(" · ")}`);
  lines.push("");
  lines.push("DOESN'T LOOK RIGHT?");
  lines.push(`Tell us and we'll put it straight — email ${view.supportEmail}`);
  lines.push("or just reply to this email. Either way it comes back to us with");
  lines.push(`ticket ${t.number} attached.`);
  lines.push("");
  lines.push("HOW DID WE DO?");
  lines.push("One click, and it helps more than you'd think:");
  lines.push(`  Looks great → ${view.feedbackUpUrl}`);
  lines.push(`  Not quite   → ${view.feedbackDownUrl}`);
  lines.push("");
  lines.push("—");
  lines.push(`WOW Video Tours · Ticket ${t.number}`);
  return lines.join("\n");
}

export function renderClientResolvedHtml(view: ResolvedEmailView): string {
  const t = view.ticket;
  const facts = receivedFacts(view)
    .map((f) => escapeHtml(f))
    .join(` <span style="color:${MUTED}">·</span> `);

  const body = `${testBanner(t)}
${card(`${numberChip(t, "Complete")}
${paragraph(escapeHtml(greetingLine(t)))}
${paragraph(`Good news — your request is complete.`, 12)}

<tr><td style="padding:18px 0 0">
<div style="background:#fafafa;border-left:3px solid ${WOW_RED};border-radius:0 10px 10px 0;padding:14px 16px;color:${INK};font-size:14px;line-height:1.5">
<strong style="letter-spacing:0.02em">${escapeHtml(t.number)}</strong><br />${facts}
</div>
</td></tr>

<tr><td style="padding:24px 0 0;border-top:1px solid ${HAIRLINE}"></td></tr>

<tr><td style="padding:18px 0 0">
<div style="color:${INK};font-size:15px;font-weight:700;padding-bottom:6px">Doesn't look right?</div>
<div style="color:${INK};font-size:14px;line-height:1.65">Tell us and we'll put it straight — email <a href="${escapeHtml(supportMailtoFromView(view))}" style="color:${WOW_RED};font-weight:600;text-decoration:none">${escapeHtml(view.supportEmail)}</a>, or just reply to this email. Either way it comes back to us with ticket ${escapeHtml(t.number)} attached.</div>
</td></tr>

<tr><td style="padding:18px 0 0">
${button(supportMailtoFromView(view), "Email support", "#ffffff", INK)}
</td></tr>`)}

<tr><td style="padding:16px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:16px">
<tr><td align="center" style="padding:22px">
<div style="color:${INK};font-size:15px;font-weight:700;padding-bottom:4px">How did we do?</div>
<div style="color:${MUTED};font-size:13px;line-height:1.6;padding-bottom:16px">One click — it helps more than you'd think.</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 auto"><tr>
<td style="padding:0 6px">${button(view.feedbackUpUrl, "👍  Looks great", WOW_RED, "#ffffff")}</td>
<td style="padding:0 6px">${button(view.feedbackDownUrl, "👎  Not quite", "#ffffff", INK)}</td>
</tr></table>
</td></tr></table>
</td></tr>`;

  return htmlShell({
    title: t.number,
    preheader: `${t.number} is complete — how did we do?`,
    body,
    footerNote: `Ticket ${escapeHtml(t.number)} · WOW Video Tours`,
    logoUrl: view.logoUrl,
  });
}

function supportMailtoFromView(view: ResolvedEmailView): string {
  return supportMailto(view.ticket, view.supportEmail);
}
