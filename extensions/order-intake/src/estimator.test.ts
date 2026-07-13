import { describe, expect, it } from "vitest";
import { quote } from "./estimator.js";

describe("catalog estimator", () => {
  it("reproduces the spec sample: WOW Essentials + Silver Aerial add-on @2400 + Twilight x3 = $479", () => {
    const q = quote({
      squareFeet: 2400,
      bundleId: "wow-essentials",
      addOns: [{ id: "silver-aerial" }, { id: "twilight", quantity: 3 }],
    });
    expect(q.subtotal).toBe(479);
  });

  it("prices the pre-bundled WOW Essentials + Aerial Silver @2400 at $404", () => {
    expect(quote({ squareFeet: 2400, bundleId: "wow-essentials-silver-aerial" }).subtotal).toBe(
      404,
    );
  });

  it("tiers HDR standalone by square footage", () => {
    expect(quote({ squareFeet: 1800, singleServiceIds: ["hdr-photography"] }).subtotal).toBe(160);
    expect(quote({ squareFeet: 6000, singleServiceIds: ["hdr-photography"] }).subtotal).toBe(275);
  });

  it("distinguishes add-on vs standalone pricing", () => {
    expect(
      quote({ squareFeet: 2400, bundleId: "wow-essentials", addOns: [{ id: "silver-aerial" }] })
        .subtotal,
    ).toBe(275 + 129);
    expect(quote({ squareFeet: 2400, singleServiceIds: ["silver-aerial"] }).subtotal).toBe(199);
  });

  it("tiers floor plans on the floorplan4 tier set", () => {
    expect(quote({ squareFeet: 6000, addOns: [{ id: "floor-plan" }] }).subtotal).toBe(110);
  });

  it("multiplies per-image services by quantity", () => {
    expect(
      quote({ squareFeet: 2400, addOns: [{ id: "green-grass-replacement", quantity: 4 }] })
        .subtotal,
    ).toBe(60);
  });

  it("prices the Luxury package by tier", () => {
    expect(quote({ squareFeet: 4000, bundleId: "luxury-listing" }).subtotal).toBe(574);
  });

  it("escalates Matterport above 7,500 sqft", () => {
    const q = quote({ squareFeet: 9000, singleServiceIds: ["matterport-3d"] });
    expect(q.escalations.length).toBeGreaterThan(0);
  });

  it("flags Rush Order when HDR is not in the order", () => {
    const q = quote({
      squareFeet: 2400,
      singleServiceIds: ["cinematic-walkthrough"],
      addOns: [{ id: "rush-order" }],
    });
    expect(q.flags.some((f) => /Rush/.test(f))).toBe(true);
  });

  it("does not flag Rush Order when HDR is present", () => {
    const q = quote({
      squareFeet: 2400,
      singleServiceIds: ["hdr-photography"],
      addOns: [{ id: "rush-order" }],
    });
    expect(q.flags.some((f) => /Rush/.test(f))).toBe(false);
  });

  it("asks for image count on a per-image add-on with no quantity", () => {
    const q = quote({ squareFeet: 2400, addOns: [{ id: "twilight" }] });
    expect(q.flags.some((f) => /image count/i.test(f))).toBe(true);
  });
});
