// The intake "brain" seam. A brain turns (conversation so far + latest visitor
// message) into a reply, an updated draft, and — when the order is complete — a
// handoff notification. This file has NO platform/SDK imports so it stays fully
// testable; the LLM-backed brain lives in ./runtime-brain.ts.

import { bundleById, serviceById } from "./catalog.js";
import { quote } from "./estimator.js";
import { formatHandoff, type HandoffNotification, type HandoffSender } from "./handoff.js";
import { toQuoteRequest, type OrderDraft } from "./order-draft.js";
import { GREETING } from "./prompt.js";
import type { IntakeSession } from "./session-store.js";

export type BrainTurn = {
  reply: string;
  draft: OrderDraft;
  handoff?: HandoffNotification;
};

export interface IntakeBrain {
  readonly kind: string;
  // greeting() is sent when a fresh conversation opens (no visitor message yet).
  greeting(): string;
  respond(input: { session: IntakeSession; message: string }): Promise<BrainTurn>;
}

// ---------------------------------------------------------------------------
// ScriptedBrain — a deterministic slot-filling intake that needs no LLM. It is
// the M0 walking-skeleton brain: it genuinely collects an order, quotes from the
// catalog, and hands off. The LLM brain (runtime-brain.ts) is the richer,
// conversational version that replaces it in production.
// ---------------------------------------------------------------------------

type Slot = {
  id: string;
  filled: (d: OrderDraft) => boolean;
  question: string;
  apply: (d: OrderDraft, answer: string) => void;
};

function firstNumber(s: string): number | undefined {
  const m = s.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

function isYes(s: string): boolean {
  return /\b(yes|yeah|yep|sure|ok|okay|agree|agreed|i agree|correct)\b/i.test(s);
}

// Match a free-text message to a bundle or service id from the catalog.
function matchSelection(s: string): { bundleId?: string; serviceId?: string } {
  const lower = s.toLowerCase();
  const bundles = [
    ["luxury", "luxury-listing"],
    ["essentials + aerial", "wow-essentials-silver-aerial"],
    ["essentials plus aerial", "wow-essentials-silver-aerial"],
    ["zillow showcase", "zillow-showcase"],
    ["essentials", "wow-essentials"],
  ] as const;
  for (const [needle, id] of bundles) if (lower.includes(needle)) return { bundleId: id };
  const services = [
    ["cinematic", "cinematic-walkthrough"],
    ["matterport", "matterport-3d"],
    ["photo", "hdr-photography"],
    ["hdr", "hdr-photography"],
  ] as const;
  for (const [needle, id] of services) if (lower.includes(needle)) return { serviceId: id };
  return {};
}

const SLOTS: Slot[] = [
  {
    id: "address",
    filled: (d) => !!d.property.address,
    question: "What's the address of the listing you'd like to book?",
    apply: (d, a) => {
      d.property.address = a.trim();
    },
  },
  {
    id: "service",
    filled: (d) => !!d.service.bundleId || (d.service.singleServiceIds?.length ?? 0) > 0,
    question:
      "Great — what would you like to book for it? We have bundles like WOW Essentials, WOW Essentials + Aerial Silver, and the Luxury Listing Package, or individual services.",
    apply: (d, a) => {
      const m = matchSelection(a);
      if (m.bundleId) d.service.bundleId = m.bundleId;
      else if (m.serviceId)
        d.service.singleServiceIds = [...(d.service.singleServiceIds ?? []), m.serviceId];
    },
  },
  {
    id: "squareFeet",
    filled: (d) => d.property.squareFeet != null,
    question: "Roughly how many square feet is the home? (Pricing is based on square footage.)",
    apply: (d, a) => {
      const n = firstNumber(a);
      if (n != null) d.property.squareFeet = n;
    },
  },
  {
    id: "listingPrice",
    filled: (d) => d.property.listingPrice != null,
    question: "What's the listing price?",
    apply: (d, a) => {
      const n = firstNumber(a);
      if (n != null) d.property.listingPrice = n;
    },
  },
  {
    id: "vacancy",
    filled: (d) => !!d.property.vacancy,
    question: "Is the home vacant or occupied?",
    apply: (d, a) => {
      d.property.vacancy = /vacant|empty/i.test(a) ? "vacant" : "occupied";
    },
  },
  {
    id: "agentName",
    filled: (d) => !!d.agent.firstName && !!d.agent.lastName,
    question: "Let's get your details so the team can follow up. What's your first and last name?",
    apply: (d, a) => {
      const parts = a.trim().split(/\s+/);
      d.agent.firstName = parts[0];
      d.agent.lastName = parts.slice(1).join(" ") || parts[0];
    },
  },
  {
    id: "agentCompany",
    filled: (d) => !!d.agent.companyName,
    question: "Which brokerage or company are you with?",
    apply: (d, a) => {
      d.agent.companyName = a.trim();
    },
  },
  {
    id: "agentPhone",
    filled: (d) => !!d.agent.phone,
    question: "Best phone number to reach you?",
    apply: (d, a) => {
      d.agent.phone = a.trim();
    },
  },
  {
    id: "agentEmail",
    filled: (d) => !!d.agent.email,
    question: "And your email?",
    apply: (d, a) => {
      d.agent.email = a.trim();
    },
  },
  {
    id: "filming",
    filled: (d) => !!d.customAnswers.appointmentInfoAndFilmingInstructions,
    question: "Any filming instructions? (Features to highlight, areas to avoid, gate codes, etc.)",
    apply: (d, a) => {
      d.customAnswers.appointmentInfoAndFilmingInstructions = a.trim();
    },
  },
  {
    id: "entry",
    filled: (d) => !!d.entry?.method,
    question:
      "How should our photographer access the property? (e.g. lockbox, you'll meet on-site, homeowner present)",
    apply: (d, a) => {
      d.entry = { method: a.trim() };
    },
  },
  {
    id: "scheduling",
    filled: (d) => !!d.scheduling,
    question:
      "When would you like the shoot? (ASAP, or a preferred day/time — we'll confirm availability.)",
    apply: (d, a) => {
      d.scheduling = /asap|soon|earliest/i.test(a)
        ? { kind: "asap" }
        : { kind: "window", window: a.trim() };
    },
  },
  {
    id: "terms",
    filled: (d) => d.termsAgreed === true,
    question:
      "Last step: do you agree to WOW Video Tours' terms of service (camera-ready property, payment before download, 24-hour cancellation policy)? Reply 'I agree' to confirm.",
    apply: (d, a) => {
      if (isYes(a)) d.termsAgreed = true;
    },
  },
];

export function runningEstimate(d: OrderDraft): string {
  const hasService = !!d.service.bundleId || (d.service.singleServiceIds?.length ?? 0) > 0;
  if (!hasService || d.property.squareFeet == null) return "";
  const est = quote(toQuoteRequest(d));
  if (est.escalations.length) {
    return `\n\nYour estimate is pending — this order needs a custom quote (${est.escalations[0]}). Our team will confirm the exact price.`;
  }
  if (est.subtotal > 0) {
    const name = d.service.bundleId
      ? bundleById(d.service.bundleId)?.name
      : (d.service.singleServiceIds ?? []).map((id) => serviceById(id)?.name).join(" + ");
    return `\n\nEstimated total for ${name} at ${d.property.squareFeet.toLocaleString("en-US")} sq ft: $${est.subtotal.toLocaleString("en-US")} (standard catalog estimate, subject to verification).`;
  }
  return "";
}

export class ScriptedBrain implements IntakeBrain {
  readonly kind = "scripted";
  constructor(private readonly sender: HandoffSender) {}

  greeting(): string {
    return GREETING;
  }

  async respond({
    session,
    message,
  }: {
    session: IntakeSession;
    message: string;
  }): Promise<BrainTurn> {
    const d = session.draft;

    // Apply the visitor's answer to the first not-yet-filled slot.
    const current = SLOTS.find((s) => !s.filled(d));
    if (current) current.apply(d, message);

    // Find the next unfilled slot to ask about.
    const next = SLOTS.find((s) => !s.filled(d));

    if (!next) {
      // Everything collected — hand off.
      const notification = formatHandoff(d);
      await this.sender.send(notification);
      session.handedOff = true;
      return {
        reply:
          "Perfect — I've got everything I need. Your order draft has been sent to the WOW Video Tours team, who'll confirm scheduling and final pricing shortly. Thanks!" +
          runningEstimate(d),
        draft: d,
        handoff: notification,
      };
    }

    // Acknowledge + ask the next question, showing a running estimate once we can.
    return {
      reply: next.question + runningEstimate(d),
      draft: d,
    };
  }
}
