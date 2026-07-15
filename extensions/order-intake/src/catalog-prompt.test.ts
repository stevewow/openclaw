import { describe, expect, it } from "vitest";
import { catalogReference, priceSnapshot } from "./catalog-prompt.js";

describe("catalog prompt context", () => {
  it("lists bundle and service ids the estimator recognizes", () => {
    const ref = catalogReference();
    expect(ref).toContain("wow-essentials");
    expect(ref).toContain("hdr-photography");
    expect(ref).toContain("cinematic-walkthrough");
  });

  it("computes real prices at a given square footage", () => {
    const snap = priceSnapshot(2500);
    // WOW Essentials at the 2,001-3,500 tier is $275 (matches the estimator).
    expect(snap).toContain("WOW Essentials");
    expect(snap).toContain("$275");
    // Individual photography is priced so the model can compare photos vs bundle.
    expect(snap).toContain("HDR Photography");
    expect(snap).toMatch(/2,500 sq ft/);
  });

  it("names the partnership-pricing caveat so quotes never look final", () => {
    expect(priceSnapshot(2500).toLowerCase()).toContain("partnership pricing");
  });
});
