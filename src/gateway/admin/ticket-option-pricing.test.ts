import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Priced, multi-select choices. The load-bearing rule is that the browser sends
// LABELS ONLY: every price and the total are read from our own option list, so a
// tampered form cannot quote a number we never offered.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-option-price-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const cats = await import("./ticket-category-store.js");
const intake = await import("./ticket-intake-http.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

let priced: Awaited<ReturnType<typeof cats.createCategory>>;
let single: Awaited<ReturnType<typeof cats.createCategory>>;

beforeAll(async () => {
  await cats.ensureCategorySeed();
  priced = await cats.createCategory({
    label: "Add a service",
    extraField: "multiselect",
    extraLabel: "Which services?",
    extraOptions: [
      { label: "Twilight photos", imageUrl: "https://example.com/tw.jpg", priceCents: 7500 },
      { label: "Aerial / Drone", imageUrl: null, priceCents: 15000 },
      { label: "Floor plan", imageUrl: null, priceCents: 9500 },
      { label: "Not sure yet", imageUrl: null, priceCents: null },
    ],
  });
  single = await cats.createCategory({
    label: "Pick one",
    extraField: "select",
    extraLabel: "Which media?",
    extraOptions: [
      { label: "Photos", imageUrl: null, priceCents: 5000 },
      { label: "Video", imageUrl: null, priceCents: 12000 },
    ],
  });
});

describe("storing options", () => {
  it("round-trips the label, thumbnail and price", async () => {
    const reloaded = (await cats.getCategory(priced.key))!;
    expect(reloaded.extraOptions[0]).toEqual({
      label: "Twilight photos",
      imageUrl: "https://example.com/tw.jpg",
      priceCents: 7500,
    });
    expect(reloaded.extraOptions[3].priceCents).toBeNull();
  });

  it("still reads the legacy bare-string form", () => {
    expect(cats.toCategoryOption("Photos")).toEqual({
      label: "Photos",
      imageUrl: null,
      priceCents: null,
    });
    // The seeded categories were written before options had a shape.
    expect(cats.normalizeOptions(["A", "B"]).map((o) => o.label)).toEqual(["A", "B"]);
  });

  it("refuses a price that is not a whole, non-negative number of cents", () => {
    const bad = [
      { label: "a", priceCents: -100 },
      { label: "b", priceCents: 10.5 },
      { label: "c", priceCents: Number.NaN },
      { label: "d", priceCents: "150" },
      { label: "e", priceCents: Number.POSITIVE_INFINITY },
    ];
    // Each survives as an option, but unpriced — never as a wrong price.
    for (const option of cats.normalizeOptions(bad)) {
      expect(option.priceCents).toBeNull();
    }
  });

  it("drops entries with no usable label", () => {
    expect(cats.normalizeOptions([null, "", { label: "  " }, 42, { label: "ok" }])).toEqual([
      { label: "ok", imageUrl: null, priceCents: null },
    ]);
  });
});

describe("totalling what the client picked", () => {
  it("adds up the ticked choices from our own price list", () => {
    const { picked, estimateCents } = intake.resolveSelectedOptions(priced, [
      "Twilight photos",
      "Aerial / Drone",
    ]);
    expect(picked.map((o) => o.label)).toEqual(["Twilight photos", "Aerial / Drone"]);
    expect(estimateCents).toBe(22500);
  });

  it("ignores a label we never offered", () => {
    const { picked, estimateCents } = intake.resolveSelectedOptions(priced, [
      "Aerial / Drone",
      "Free helicopter",
    ]);
    expect(picked.map((o) => o.label)).toEqual(["Aerial / Drone"]);
    expect(estimateCents).toBe(15000);
  });

  it("cannot be talked into a price by the payload", () => {
    // Whatever shape a tampered client sends, only labels are read.
    const { estimateCents } = intake.resolveSelectedOptions(priced, [
      { label: "Aerial / Drone", priceCents: 1 },
    ] as unknown);
    expect(estimateCents).toBeNull();
  });

  it("counts a repeated choice once", () => {
    const { picked, estimateCents } = intake.resolveSelectedOptions(priced, [
      "Floor plan",
      "Floor plan",
    ]);
    expect(picked).toHaveLength(1);
    expect(estimateCents).toBe(9500);
  });

  it("leaves the estimate unset when nothing priced was picked", () => {
    expect(intake.resolveSelectedOptions(priced, ["Not sure yet"]).estimateCents).toBeNull();
    expect(intake.resolveSelectedOptions(priced, []).estimateCents).toBeNull();
  });

  it("takes only the first answer for a single-choice question", () => {
    const { picked, estimateCents } = intake.resolveSelectedOptions(single, ["Photos", "Video"]);
    expect(picked.map((o) => o.label)).toEqual(["Photos"]);
    expect(estimateCents).toBe(5000);
  });

  it("has nothing to resolve for a free-text question", () => {
    const text = { ...priced, extraField: "text" as const };
    expect(intake.resolveSelectedOptions(text, ["Twilight photos"])).toEqual({
      picked: [],
      estimateCents: null,
    });
  });
});

describe("what the department reads", () => {
  it("itemizes the picks and states the total", () => {
    const { picked } = intake.resolveSelectedOptions(priced, ["Twilight photos", "Aerial / Drone"]);
    const body = intake.composeDescription(
      priced,
      "Twilight photos, Aerial / Drone",
      "ASAP please",
      picked,
    );

    expect(body).toContain("Twilight photos — $75");
    expect(body).toContain("Aerial / Drone — $150");
    expect(body).toContain("Estimated total: $225");
    expect(body).toContain("ASAP please");
  });

  it("shows a half-dollar price without mangling it", () => {
    const opts = [{ label: "Retouch", imageUrl: null, priceCents: 14950 }];
    const body = intake.composeDescription(priced, "Retouch", "please", opts);
    expect(body).toContain("Retouch — $149.50");
  });

  it("leaves an unpriced single answer reading exactly as before", () => {
    const plain = intake.composeDescription(priced, "Photos", "too dark", []);
    expect(plain).toBe("Which services? Photos\n\ntoo dark");
  });
});
