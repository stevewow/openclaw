// Catalog context for the LLM brain. The RuntimeBrain runs with tools disabled
// and the model has no other knowledge of our catalog, so we hand it two things:
//   1. catalogReference() — the exact ids to put in the draft, so the estimator
//      can recognize the selection and compute a real price.
//   2. priceSnapshot(sqft) — the actual prices at the known square footage, which
//      the model MAY quote verbatim (and only these), so it can answer "how much
//      is X?" and compare options without inventing numbers.
// Both are derived from the catalog + estimator, so they never drift.

import { BUNDLES, SERVICES, serviceById } from "./catalog.js";
import { quote } from "./estimator.js";

export function catalogReference(): string {
  const bundles = BUNDLES.map(
    (b) =>
      `- ${b.id} — ${b.name} (includes ${b.includes.map((i) => serviceById(i)?.name ?? i).join(", ")})`,
  ).join("\n");
  const services = SERVICES.map((s) => `- ${s.id} — ${s.name}`).join("\n");
  return [
    "# CATALOG — fill the draft with these EXACT ids (the system prices them for you):",
    "Bundles → set draft.service.bundleId to ONE of:",
    bundles,
    "",
    "Individual services → set draft.service.singleServiceIds (array) and/or draft.addOns[].id:",
    services,
    "",
    'Map the visitor\'s words to ids, e.g. "photos" → hdr-photography, "photos + walkthrough video" → the wow-essentials bundle, "drone" → an aerial service.',
  ].join("\n");
}

export function priceSnapshot(squareFeet: number): string {
  const bundleLines: string[] = [];
  for (const b of BUNDLES) {
    const q = quote({ bundleId: b.id, squareFeet });
    if (q.escalations.length)
      bundleLines.push(`- ${b.name} (${b.id}): custom quote — team confirms`);
    else if (q.subtotal > 0)
      bundleLines.push(`- ${b.name} (${b.id}): $${q.subtotal.toLocaleString("en-US")}`);
  }

  const serviceLines: string[] = [];
  for (const s of SERVICES) {
    const standalone = quote({ singleServiceIds: [s.id], squareFeet });
    const addon = quote({ addOns: [{ id: s.id }], squareFeet });
    const parts: string[] = [];
    if (standalone.subtotal > 0)
      parts.push(`$${standalone.subtotal.toLocaleString("en-US")} on its own`);
    if (addon.subtotal > 0) parts.push(`$${addon.subtotal.toLocaleString("en-US")} as an add-on`);
    if (s.standalone?.kind === "perImage" || s.addOn?.kind === "perImage")
      parts.push("priced per image — ask how many");
    if (parts.length) serviceLines.push(`- ${s.name} (${s.id}): ${parts.join(" / ")}`);
    else if (standalone.escalations.length || addon.escalations.length)
      serviceLines.push(`- ${s.name} (${s.id}): custom quote — team confirms`);
  }

  return [
    `# LIVE PRICE SNAPSHOT at ${squareFeet.toLocaleString("en-US")} sq ft (standard catalog).`,
    "You MAY state these exact figures and NO others. Always call them estimates. Pricing here is our standard catalog rate; if the visitor's brokerage or team is eligible for partnership pricing, our team confirms that before final submission.",
    "Bundles:",
    ...bundleLines,
    "Services:",
    ...serviceLines,
  ].join("\n");
}
