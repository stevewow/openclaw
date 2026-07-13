// Handoff: format a completed OrderDraft into the private team-notification and
// deliver it. The delivery channel (Slack vs email) is deferred — M0 uses a
// stub sender that just records the notification. A real sender implements the
// HandoffSender interface later without touching the formatter.

import { OFFICE_PHONE, bundleById, serviceById } from "./catalog.js";
import { quote } from "./estimator.js";
import { checkCompleteness, toQuoteRequest, type OrderDraft } from "./order-draft.js";

export type HandoffNotification = {
  text: string;
  flags: string[];
  escalations: string[];
  complete: boolean;
  missing: string[];
};

export interface HandoffSender {
  readonly channel: string;
  send(notification: HandoffNotification): Promise<{ ok: boolean; detail?: string }>;
}

// M0 stub: records the last notification and logs it. Swap for Slack/email later.
export class StubHandoffSender implements HandoffSender {
  readonly channel = "stub";
  last: HandoffNotification | null = null;
  readonly log: HandoffNotification[] = [];

  async send(notification: HandoffNotification) {
    this.last = notification;
    this.log.push(notification);
    return { ok: true, detail: "recorded by stub sender (no channel configured yet)" };
  }
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

function contactLine(d: OrderDraft): string {
  const a = d.agent ?? {};
  const name = [a.firstName, a.lastName].filter(Boolean).join(" ") || "—";
  const parts = [name, a.companyName, a.phone].filter(Boolean);
  return parts.join(" · ");
}

function serviceLine(d: OrderDraft): string {
  const names: string[] = [];
  if (d.service.bundleId) names.push(bundleById(d.service.bundleId)?.name ?? d.service.bundleId);
  for (const id of d.service.singleServiceIds ?? []) names.push(serviceById(id)?.name ?? id);
  const sqft =
    d.property.squareFeet != null
      ? `${d.property.squareFeet.toLocaleString("en-US")} sq ft`
      : "sq ft TBD";
  return `${names.join(" + ") || "—"}  ·  ${sqft}`;
}

function addOnLine(d: OrderDraft): string {
  if (!d.addOns?.length) return "—";
  return d.addOns
    .map((a) => {
      const s = serviceById(a.id);
      const qty = a.quantity != null ? ` (×${a.quantity})` : "";
      return `${s?.name ?? a.id}${qty}`;
    })
    .join(", ");
}

function scheduleLine(d: OrderDraft): string {
  const s = d.scheduling;
  const sched = !s
    ? "TBD"
    : s.kind === "asap"
      ? "ASAP"
      : s.kind === "datetime"
        ? (s.when ?? "specific time TBD")
        : (s.window ?? "window TBD");
  const entry = d.entry?.method ? ` · ${d.entry.method} entry` : "";
  return `${sched}${entry}`;
}

export function formatHandoff(d: OrderDraft): HandoffNotification {
  const { complete, missing } = checkCompleteness(d);
  const est = quote(toQuoteRequest(d));

  const estText =
    est.subtotal > 0 ? `${money(est.subtotal)} (standard catalog estimate)` : "estimate pending";

  const flagChips: string[] = [];
  if (est.escalations.length) flagChips.push("quote pending");
  if (!complete) flagChips.push("missing info");
  const flagsText = flagChips.length ? flagChips.join(", ") : "none blocking";

  const addr = [d.property.address, d.property.unitNumber ? `Unit ${d.property.unitNumber}` : ""]
    .filter(Boolean)
    .join(", ");

  const lines = [
    `NEW ORDER DRAFT · ${addr || "address TBD"}`,
    `Contact   ${contactLine(d)}`,
    `Service   ${serviceLine(d)}`,
    `Add-ons   ${addOnLine(d)}`,
    `Estimate  ${estText}`,
    `Schedule  ${scheduleLine(d)}`,
    `Notes     ${d.customAnswers?.appointmentInfoAndFilmingInstructions ?? "—"}`,
    `Flags     ${flagsText}`,
    `Team      match account & apply VIP/company rate before entry`,
  ];

  if (est.escalations.length) {
    lines.push("", "Escalations:");
    for (const e of est.escalations) lines.push(`  · ${e}`);
    lines.push(`  (out-of-area or custom-quote items — office ${OFFICE_PHONE})`);
  }
  if (!complete) {
    lines.push("", `Still needed: ${missing.join(", ")}`);
  }

  return {
    text: lines.join("\n"),
    flags: est.flags,
    escalations: est.escalations,
    complete,
    missing,
  };
}

export async function handoff(d: OrderDraft, sender: HandoffSender) {
  const notification = formatHandoff(d);
  const result = await sender.send(notification);
  return { notification, result };
}
