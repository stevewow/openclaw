// What a dispatched lead and the daily digest look like in an inbox.
//
// Pure rendering, no I/O, so both can be asserted on directly. The palette and
// the masthead come from the ticket email so everything the Hub sends looks
// like one system; what differs is the job the email has to do. A dispatch is
// read on a phone between showings, so the contact details come first and the
// answers second, and the reply-to is the lead's own address — the fastest path
// from "I got the email" to "I called them" is hitting reply.

import { adminBaseUrl } from "./brand.js";
import {
  DEFAULT_ATTEMPTS_BEFORE_STANDARD,
  DEFAULT_STANDARD_FOLLOW_UP,
  type LeadPlaybook,
  personalizeOpener,
} from "./lead-playbooks.js";
import type { Lead } from "./lead-store.js";
import { brandHeaderHtml, escapeHtml } from "./ticket-email-render.js";

const WOW_RED = "#ff0000";
const INK = "#2c2c2c";
const MUTED = "#888888";
const HAIRLINE = "#ececec";
const PAGE_BG = "#f3f3f3";
const FONT = "Montserrat,'Segoe UI',Helvetica,Arial,sans-serif";

export type LeadEmailView = {
  lead: Lead;
  logoUrl: string;
  /** Absolute link to the lead in the Hub. */
  leadUrl: string;
  /**
   * The outreach note for the source this lead came in on, already loaded.
   *
   * Passed in rather than looked up here: the playbooks are editable rows now,
   * and a renderer that reached for the database could not be asserted on
   * without one. Null renders the plain email, which is what a lead matching no
   * source gets.
   */
  playbook?: LeadPlaybook | null;
  /** What the email says happens after the playbook is spent. Editable copy. */
  standardFollowUp?: string;
  attemptsBeforeStandard?: number;
};

/** Where the Hub opens this lead. The Leads page takes an id in its hash. */
export function leadUrl(lead: Lead, env: NodeJS.ProcessEnv = process.env): string {
  return `${adminBaseUrl(env)}/admin#leads?lead=${encodeURIComponent(lead.id)}`;
}

export function leadDisplayName(lead: Lead): string {
  return lead.name?.trim() || lead.email?.trim() || lead.company?.trim() || lead.number;
}

export function leadMarketLabel(lead: Lead): string {
  return lead.marketRaw?.trim() || "Not given";
}

export function leadSubject(lead: Lead): string {
  const market = lead.marketRaw?.trim();
  return `New lead — ${leadDisplayName(lead)}${market ? ` (${market})` : ""}`;
}

type Row = { label: string; value: string; href?: string };

/**
 * The lead as a list of rows. Contact first: a name with no way to reach it is
 * not a lead. Empty answers are dropped rather than shown blank, so a short
 * form does not render as a page of dashes.
 */
export function leadDetailRows(lead: Lead): Row[] {
  const rows: Row[] = [];
  const push = (label: string, value: string | null, href?: string) => {
    const v = value?.trim();
    if (v) {
      rows.push({ label, value: v, href });
    }
  };
  push("Name", lead.name);
  push("Email", lead.email, lead.email ? `mailto:${lead.email}` : undefined);
  push("Phone", lead.phone, lead.phone ? `tel:${lead.phone.replace(/[^\d+]/g, "")}` : undefined);
  push("Brokerage", lead.company);
  push("Market", lead.marketRaw);
  push("Form", lead.formName);
  push("Page", lead.pageUrl, lead.pageUrl ?? undefined);
  for (const field of lead.fields) {
    push(field.label, field.value);
  }
  return rows;
}

/**
 * How to work this one, for the source it came in on.
 *
 * Only the matching playbook is rendered. An owner reading this on a phone
 * between showings needs the script for the person who just downloaded the
 * pricing list — not all three and a decision about which one applies.
 */
function playbookTextBlock(view: LeadEmailView): string[] {
  const { lead, playbook } = view;
  if (!playbook) {
    return [];
  }
  return [
    "",
    `— ${playbook.label.toUpperCase()} —`,
    playbook.signal,
    "",
    "Opener:",
    personalizeOpener(playbook.opener, lead.name),
    "",
    "Soft close, once they engage:",
    playbook.softClose,
    "",
    "Cadence:",
    // The action names its own channel ("Call. Voicemail + text if no answer"),
    // so the step is when and what — printing the channel too reads as a stutter.
    ...playbook.steps.map((s) => `${s.step}. ${s.when} — ${s.action}`),
    "",
    `After ${view.attemptsBeforeStandard ?? DEFAULT_ATTEMPTS_BEFORE_STANDARD} attempts with no answer, move to the standard follow-up — ${view.standardFollowUp ?? DEFAULT_STANDARD_FOLLOW_UP}.`,
  ];
}

export function renderLeadEmailText(view: LeadEmailView): string {
  const { lead } = view;
  const lines = [
    `New lead — ${lead.number}`,
    "",
    ...leadDetailRows(lead).map((r) => `${r.label}: ${r.value}`),
  ];
  if (lead.message?.trim()) {
    lines.push("", "What they wrote:", lead.message.trim());
  }
  lines.push(...playbookTextBlock(view));
  lines.push(
    "",
    lead.ownerName
      ? `Routed to you as the ${leadMarketLabel(lead)} territory owner.`
      : "No territory owner matched this market — please pick it up or reassign it.",
    "",
    `Open it in the Hub: ${view.leadUrl}`,
    "",
    "Reply to this email to answer the lead directly.",
  );
  return lines.join("\n");
}

function htmlRow(row: Row): string {
  const value = row.href
    ? `<a href="${escapeHtml(row.href)}" style="color:${WOW_RED};text-decoration:none">${escapeHtml(row.value)}</a>`
    : escapeHtml(row.value);
  return `<tr>
<td style="padding:6px 14px 6px 0;vertical-align:top;color:${MUTED};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap">${escapeHtml(row.label)}</td>
<td style="padding:6px 0;vertical-align:top;color:${INK};font-size:14px;line-height:1.5">${value}</td>
</tr>`;
}

/**
 * The playbook as it reads in an inbox: what the download says about them, the
 * two scripts set apart so they can be read off the screen while the phone is
 * ringing, and the cadence as a numbered list with the timing in its own column.
 */
function playbookHtmlBlock(view: LeadEmailView): string {
  const { lead, playbook } = view;
  if (!playbook) {
    return "";
  }
  const script = (label: string, body: string): string =>
    `<tr><td style="padding:14px 0 0">
<div style="color:${MUTED};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:6px">${escapeHtml(label)}</div>
<div style="background:#fafafa;border-left:3px solid ${WOW_RED};border-radius:0 10px 10px 0;padding:14px 16px;color:${INK};font-size:14px;line-height:1.7">${escapeHtml(body)}</div>
</td></tr>`;

  const steps = playbook.steps
    .map(
      (s) => `<tr>
<td style="padding:7px 12px 7px 0;vertical-align:top;color:${WOW_RED};font-size:13px;font-weight:700;white-space:nowrap">${s.step}.</td>
<td style="padding:7px 12px 7px 0;vertical-align:top;color:${INK};font-size:13px;font-weight:700;white-space:nowrap">${escapeHtml(s.when)}</td>
<td style="padding:7px 0;vertical-align:top;color:${INK};font-size:13px;line-height:1.6">${escapeHtml(s.action)}</td>
</tr>`,
    )
    .join("\n");

  return `<tr><td style="padding:24px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid ${HAIRLINE}">
<tr><td style="padding:18px 0 0">
<span style="display:inline-block;background:${INK};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border-radius:6px">${escapeHtml(playbook.label)}</span>
<div style="padding:10px 0 0;color:${INK};font-size:14px;font-weight:600">${escapeHtml(playbook.signal)}</div>
</td></tr>
${script("Opener", personalizeOpener(playbook.opener, lead.name))}
${script("Soft close, once they engage", playbook.softClose)}
<tr><td style="padding:18px 0 0">
<div style="color:${MUTED};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:6px">Cadence</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${steps}
</table>
<div style="padding:12px 0 0;color:${MUTED};font-size:12px;line-height:1.6">After ${view.attemptsBeforeStandard ?? DEFAULT_ATTEMPTS_BEFORE_STANDARD} attempts with no answer, move to the standard follow-up — ${escapeHtml(view.standardFollowUp ?? DEFAULT_STANDARD_FOLLOW_UP)}.</div>
</td></tr>
</table>
</td></tr>`;
}

export function renderLeadEmailHtml(view: LeadEmailView): string {
  const { lead } = view;
  const rows = leadDetailRows(lead).map(htmlRow).join("\n");
  const message = lead.message?.trim()
    ? `<tr><td style="padding:22px 0 0">
<div style="color:${MUTED};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:8px">What they wrote</div>
<div style="background:#fafafa;border-left:3px solid ${WOW_RED};border-radius:0 10px 10px 0;padding:14px 16px;color:${INK};font-size:14px;line-height:1.7">${escapeHtml(lead.message.trim()).replace(/\n/g, "<br />")}</div>
</td></tr>`
    : "";
  // An unrouted lead says so in the email itself. It still has to reach a human,
  // and that human needs to know nobody else was told.
  const routing = lead.ownerName
    ? `<tr><td style="padding:16px 0 0;color:${MUTED};font-size:13px;line-height:1.6">Routed to you as the ${escapeHtml(leadMarketLabel(lead))} territory owner.</td></tr>`
    : `<tr><td style="padding:16px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff8e1;border:1px solid #f0d9a0;border-radius:10px">
<tr><td style="padding:12px 16px;font-size:13px;color:#7a5c00;line-height:1.5"><strong>No territory owner matched this market.</strong> Please pick it up or reassign it in the Hub.</td></tr>
</table></td></tr>`;

  const preheader = [leadDisplayName(lead), leadMarketLabel(lead), lead.phone ?? lead.email ?? ""]
    .filter(Boolean)
    .join(" · ");

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(lead.number)}</title></head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${PAGE_BG}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:600px">

${brandHeaderHtml(view.logoUrl)}

<tr><td style="background:#ffffff;border:1px solid ${HAIRLINE};border-radius:16px;padding:26px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">

<tr><td style="padding:0 0 4px">
<span style="display:inline-block;background:${WOW_RED};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.06em;padding:4px 10px;border-radius:6px">${escapeHtml(lead.number)}</span>
<span style="color:${MUTED};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding-left:10px">New lead</span>
</td></tr>

<tr><td style="padding:10px 0 18px;font-size:19px;font-weight:700;color:${INK};line-height:1.35">${escapeHtml(leadDisplayName(lead))}</td></tr>

<tr><td style="padding:0 0 4px;border-top:1px solid ${HAIRLINE}"></td></tr>
<tr><td style="padding:10px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${rows}
</table>
</td></tr>

${message}
${playbookHtmlBlock(view)}
${routing}

<tr><td style="padding:22px 0 0">
<a href="${escapeHtml(view.leadUrl)}" style="display:inline-block;background:${WOW_RED};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:8px">Open in the Hub</a>
</td></tr>

</table>
</td></tr>

<tr><td style="padding:14px 4px 0;color:${MUTED};font-size:12px">Reply to this email to answer the lead directly · WOW Video Tours</td></tr>

</table>
</td></tr></table>
</body>
</html>`;
}

export type LeadDigestView = {
  /** The day being reported, already formatted for a subject line. */
  dayLabel: string;
  leads: Lead[];
  logoUrl: string;
  hubUrl: string;
};

export function digestSubject(view: LeadDigestView): string {
  const n = view.leads.length;
  return n === 0
    ? `No new leads — ${view.dayLabel}`
    : `${n} new lead${n === 1 ? "" : "s"} — ${view.dayLabel}`;
}

/** One digest line: who, where, and who has it. */
function digestLineText(lead: Lead): string {
  const who = leadDisplayName(lead);
  const owner = lead.ownerName ?? "UNASSIGNED";
  const contact = [lead.phone, lead.email].filter(Boolean).join(" · ");
  return `• ${who} — ${leadMarketLabel(lead)} → ${owner}${contact ? ` (${contact})` : ""}`;
}

export function renderDigestText(view: LeadDigestView): string {
  if (view.leads.length === 0) {
    return [`No new leads came in ${view.dayLabel}.`, "", view.hubUrl].join("\n");
  }
  const unrouted = view.leads.filter((l) => !l.territoryKey);
  return [
    `${view.leads.length} new lead${view.leads.length === 1 ? "" : "s"} — ${view.dayLabel}`,
    "",
    ...view.leads.map(digestLineText),
    ...(unrouted.length > 0
      ? ["", `${unrouted.length} did not match a territory and need routing.`]
      : []),
    "",
    view.hubUrl,
  ].join("\n");
}

export function renderDigestHtml(view: LeadDigestView): string {
  const unrouted = view.leads.filter((l) => !l.territoryKey).length;
  const rows =
    view.leads.length === 0
      ? `<tr><td style="padding:18px 0;color:${MUTED};font-size:14px">No new leads came in ${escapeHtml(view.dayLabel)}.</td></tr>`
      : view.leads
          .map(
            (lead) => `<tr><td style="padding:10px 0;border-top:1px solid ${HAIRLINE}">
<div style="color:${INK};font-size:14px;font-weight:700">${escapeHtml(leadDisplayName(lead))}</div>
<div style="color:${MUTED};font-size:13px;line-height:1.6">${escapeHtml(leadMarketLabel(lead))} → ${
              lead.ownerName
                ? escapeHtml(lead.ownerName)
                : `<span style="color:#b45309;font-weight:700">unassigned</span>`
            }${
              lead.phone || lead.email
                ? ` · ${escapeHtml([lead.phone, lead.email].filter(Boolean).join(" · "))}`
                : ""
            }</div>
</td></tr>`,
          )
          .join("\n");

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(digestSubject(view))}</title></head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(digestSubject(view))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${PAGE_BG}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:600px">

${brandHeaderHtml(view.logoUrl)}

<tr><td style="background:#ffffff;border:1px solid ${HAIRLINE};border-radius:16px;padding:26px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td style="padding:0 0 10px;font-size:19px;font-weight:700;color:${INK}">${escapeHtml(digestSubject(view))}</td></tr>
${rows}
${
  unrouted > 0
    ? `<tr><td style="padding:16px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff8e1;border:1px solid #f0d9a0;border-radius:10px"><tr><td style="padding:12px 16px;font-size:13px;color:#7a5c00">${unrouted} lead${unrouted === 1 ? "" : "s"} did not match a territory and still need routing.</td></tr></table></td></tr>`
    : ""
}
<tr><td style="padding:22px 0 0">
<a href="${escapeHtml(view.hubUrl)}" style="display:inline-block;background:${WOW_RED};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:8px">Open the lead queue</a>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:14px 4px 0;color:${MUTED};font-size:12px">Yesterday's leads · WOW Video Tours</td></tr>

</table>
</td></tr></table>
</body>
</html>`;
}
