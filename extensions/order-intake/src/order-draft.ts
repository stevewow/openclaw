// The OrderDraft contract (spec §3). The agent fills this progressively; the
// order of conversation need not follow page order. This is the single object
// the completeness check, the estimator, and the handoff payload all hang off.

import type { QuoteResult } from "./estimator.js";

export type Vacancy = "vacant" | "occupied";
export type ShootChoice = "shoot" | "skip" | "none";

export type PropertyDraft = {
  address?: string; // required
  unitNumber?: string;
  listingPrice?: number; // required
  squareFeet?: number; // required — gates all quoting
  vacancy?: Vacancy;
  basement?: ShootChoice;
  garageInterior?: ShootChoice;
  attachments?: Array<{ kind: "map" | "floorplan" | "other"; note?: string }>;
};

export type Contact = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  companyName?: string;
};

export type SchedulingDraft =
  | { kind: "asap" }
  | { kind: "datetime"; when?: string }
  | { kind: "window"; window?: string };

export type OrderDraft = {
  service: { bundleId?: string; singleServiceIds?: string[] };
  property: PropertyDraft;
  addOns: Array<{ id: string; quantity?: number }>;
  agent: Contact; // required (page 4)
  homeowner?: Contact; // optional — appointment updates
  coAgent?: Contact; // optional — order updates
  customAnswers: {
    appointmentInfoAndFilmingInstructions?: string;
    [key: string]: string | undefined;
  };
  entry?: { method?: string; notes?: string };
  scheduling?: SchedulingDraft;
  termsAgreed?: boolean;
  meta?: {
    escalations?: string[];
    missingFields?: string[];
    estimate?: QuoteResult;
    confidence?: number;
  };
};

export type CompletenessResult = { complete: boolean; missing: string[] };

// Minimum viable draft for handoff. Missing items are surfaced to the agent so
// it keeps collecting rather than stopping (spec: escalate but keep going).
export function checkCompleteness(d: OrderDraft): CompletenessResult {
  const missing: string[] = [];

  const hasService = !!d.service.bundleId || (d.service.singleServiceIds?.length ?? 0) > 0;
  if (!hasService) missing.push("service (a bundle or at least one service)");

  if (!d.property.address) missing.push("property.address");
  if (d.property.listingPrice == null) missing.push("property.listingPrice");
  if (d.property.squareFeet == null) missing.push("property.squareFeet");
  if (!d.property.vacancy) missing.push("property.vacancy");

  const a = d.agent ?? {};
  if (!a.firstName) missing.push("agent.firstName");
  if (!a.lastName) missing.push("agent.lastName");
  if (!a.phone) missing.push("agent.phone");
  if (!a.email) missing.push("agent.email");
  if (!a.companyName) missing.push("agent.companyName");

  if (!d.customAnswers?.appointmentInfoAndFilmingInstructions) {
    missing.push("customAnswers.appointmentInfoAndFilmingInstructions");
  }
  if (!d.scheduling) missing.push("scheduling");
  if (!d.entry?.method) missing.push("entry.method");
  if (d.termsAgreed !== true) missing.push("termsAgreed");

  return { complete: missing.length === 0, missing };
}

// Coerce an untrusted object (e.g. LLM output) into a valid OrderDraft shape,
// falling back to a previous draft's structure. Keeps required containers
// present so downstream code (estimator, handoff) never sees undefined holes.
export function coerceDraft(value: unknown, prev: OrderDraft): OrderDraft {
  const base: OrderDraft = {
    service: { ...prev.service },
    property: { ...prev.property },
    addOns: [...(prev.addOns ?? [])],
    agent: { ...prev.agent },
    homeowner: prev.homeowner,
    coAgent: prev.coAgent,
    customAnswers: { ...prev.customAnswers },
    entry: prev.entry ? { ...prev.entry } : undefined,
    scheduling: prev.scheduling,
    termsAgreed: prev.termsAgreed,
    meta: prev.meta,
  };
  if (typeof value !== "object" || value === null) return base;
  const v = value as Record<string, unknown>;
  if (v.service && typeof v.service === "object") base.service = v.service as OrderDraft["service"];
  if (v.property && typeof v.property === "object")
    base.property = v.property as OrderDraft["property"];
  if (Array.isArray(v.addOns)) base.addOns = v.addOns as OrderDraft["addOns"];
  if (v.agent && typeof v.agent === "object") base.agent = v.agent as OrderDraft["agent"];
  if (v.homeowner && typeof v.homeowner === "object") base.homeowner = v.homeowner as Contact;
  if (v.coAgent && typeof v.coAgent === "object") base.coAgent = v.coAgent as Contact;
  if (v.customAnswers && typeof v.customAnswers === "object")
    base.customAnswers = v.customAnswers as OrderDraft["customAnswers"];
  if (v.entry && typeof v.entry === "object") base.entry = v.entry as OrderDraft["entry"];
  if (v.scheduling && typeof v.scheduling === "object")
    base.scheduling = v.scheduling as SchedulingDraft;
  if (typeof v.termsAgreed === "boolean") base.termsAgreed = v.termsAgreed;
  return base;
}

// Map a draft's service selection into an estimator request.
export function toQuoteRequest(d: OrderDraft): {
  squareFeet?: number;
  bundleId?: string;
  singleServiceIds?: string[];
  addOns: Array<{ id: string; quantity?: number }>;
} {
  return {
    squareFeet: d.property.squareFeet,
    bundleId: d.service.bundleId,
    singleServiceIds: d.service.singleServiceIds,
    addOns: d.addOns ?? [],
  };
}
