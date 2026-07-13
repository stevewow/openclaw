// M1 catalog estimator — pure pricing engine over the encoded product guide.
// No side effects, no external calls. Trip fees (M2) are computed separately.

import { bundleById, serviceById, TIER_SETS, type PriceSpec, type Service } from "./catalog.js";

export type AddOnSelection = { id: string; quantity?: number };

export type QuoteRequest = {
  squareFeet?: number;
  bundleId?: string;
  singleServiceIds?: string[];
  addOns?: AddOnSelection[];
};

export type QuoteLine = { name: string; price: number | null; tier?: string; note?: string };

export type QuoteResult = {
  lines: QuoteLine[];
  subtotal: number;
  flags: string[];
  escalations: string[];
};

type PriceOutcome =
  | { status: "ok"; price: number; tier?: string; detail?: string }
  | { status: "needsSqft" }
  | { status: "needsQuantity" }
  | { status: "escalate" }
  | { status: "error"; message: string };

function priceOf(
  spec: PriceSpec | null,
  opts: { squareFeet?: number; quantity?: number },
): PriceOutcome {
  if (!spec) return { status: "error", message: "not-available" };
  if (spec.kind === "flat") return { status: "ok", price: spec.price };
  if (spec.kind === "perImage") {
    if (opts.quantity == null) return { status: "needsQuantity" };
    return {
      status: "ok",
      price: spec.price * opts.quantity,
      detail: `$${spec.price} x ${opts.quantity}`,
    };
  }
  // tiered
  const tierSet = TIER_SETS[spec.tierSet];
  if (opts.squareFeet == null) return { status: "needsSqft" };
  if (tierSet.escalateAboveSqft != null && opts.squareFeet > tierSet.escalateAboveSqft) {
    return { status: "escalate" };
  }
  const idx = tierSet.tiers.findIndex(
    (t) => t.maxSqft == null || (opts.squareFeet as number) <= t.maxSqft,
  );
  const p = spec.prices[idx];
  if (p === "custom") return { status: "escalate" };
  return { status: "ok", price: p, tier: tierSet.tiers[idx].label };
}

function sizeEscalates(service: Service, sqft: number | undefined): boolean {
  return (
    !!service.escalate &&
    service.escalate.aboveSqft != null &&
    sqft != null &&
    sqft > service.escalate.aboveSqft
  );
}

export function quote(order: QuoteRequest): QuoteResult {
  const lines: QuoteLine[] = [];
  const flags: string[] = [];
  const escalations: string[] = [];
  const sqft = order.squareFeet;

  // Bundle or single base services.
  if (order.bundleId) {
    const b = bundleById(order.bundleId);
    if (!b) {
      flags.push(`Unknown bundle: ${order.bundleId}`);
    } else {
      const r = priceOf(b.pricing, { squareFeet: sqft });
      if (r.status === "needsSqft") flags.push(`Need square footage to quote ${b.name}.`);
      else if (r.status === "escalate") escalations.push(`${b.name}: custom quote.`);
      else if (r.status === "ok") lines.push({ name: b.name, price: r.price, tier: r.tier });
      if (b.escalate) escalations.push(`${b.name}: ${b.escalate.note}`);
    }
  }

  for (const id of order.singleServiceIds ?? []) {
    const s = serviceById(id);
    if (!s) {
      flags.push(`Unknown service: ${id}`);
      continue;
    }
    if (sizeEscalates(s, sqft)) {
      escalations.push(`${s.name}: ${s.escalate!.note}`);
      lines.push({ name: `${s.name} (standalone)`, price: null, note: "quote pending" });
      continue;
    }
    const r = priceOf(s.standalone, { squareFeet: sqft });
    if (r.status === "needsSqft") flags.push(`Need square footage to quote ${s.name}.`);
    else if (r.status === "escalate") escalations.push(`${s.name}: custom quote.`);
    else if (r.status === "error") flags.push(`${s.name} is not available on its own.`);
    else if (r.status === "ok")
      lines.push({ name: `${s.name} (standalone)`, price: r.price, tier: r.tier });
  }

  // Which service ids are present anywhere in the order (for dependency checks).
  const orderedIds = new Set<string>([
    ...(order.bundleId ? (bundleById(order.bundleId)?.includes ?? []) : []),
    ...(order.singleServiceIds ?? []),
    ...(order.addOns ?? []).map((a) => a.id),
  ]);

  // Add-ons use add-on pricing.
  for (const a of order.addOns ?? []) {
    const s = serviceById(a.id);
    if (!s) {
      flags.push(`Unknown add-on: ${a.id}`);
      continue;
    }
    if (sizeEscalates(s, sqft)) {
      escalations.push(`${s.name}: ${s.escalate!.note}`);
      lines.push({ name: `${s.name} (add-on)`, price: null, note: "quote pending" });
      continue;
    }
    if (s.requires) {
      const missing = s.requires.filter((req) => !orderedIds.has(req));
      if (missing.length) flags.push(s.requiresNote ?? `${s.name} requires ${missing.join(", ")}.`);
    }
    const r = priceOf(s.addOn, { squareFeet: sqft, quantity: a.quantity });
    if (r.status === "needsQuantity") flags.push(`Need image count for ${s.name}.`);
    else if (r.status === "needsSqft") flags.push(`Need square footage to quote ${s.name}.`);
    else if (r.status === "escalate") escalations.push(`${s.name}: custom quote.`);
    else if (r.status === "error") flags.push(`${s.name} is not available as an add-on.`);
    else if (r.status === "ok")
      lines.push({
        name: `${s.name} (add-on)${r.detail ? " " + r.detail : ""}`,
        price: r.price,
        tier: r.tier,
      });

    if (s.requiresAgentPresent) {
      flags.push(`${s.name}: agent must be present (affects scheduling/entry).`);
    }
    if (s.integratesWith && orderedIds.has(s.integratesWith)) {
      flags.push(`${s.name} clips will integrate into the ${serviceById(s.integratesWith)?.name}.`);
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + (l.price ?? 0), 0);
  return { lines, subtotal, flags, escalations };
}
