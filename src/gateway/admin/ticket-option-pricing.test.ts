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
let staging: Awaited<ReturnType<typeof cats.createCategory>>;

beforeAll(async () => {
  await cats.ensureCategorySeed();
  // The shape this feature exists for: several units of one choice, and the
  // questions that only make sense once it is picked.
  staging = await cats.createCategory({
    label: "Order an additional service",
    extraField: "multiselect",
    extraLabel: "Which services?",
    extraOptions: [
      {
        label: "Virtual staging",
        priceCents: 5000,
        maxQuantity: 10,
        followUps: [
          {
            id: "style",
            label: "Preferred style",
            kind: "select",
            choices: ["Modern", "Farmhouse", "Coastal"],
            required: true,
          },
          { label: "Which image numbers / rooms?", kind: "textarea", required: true },
          { label: "Anything to avoid?", kind: "text", required: false },
        ],
      },
      { label: "Twilight edit", priceCents: 7500 },
    ],
  });
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
      maxQuantity: 1,
      followUps: [],
    });
    expect(reloaded.extraOptions[3].priceCents).toBeNull();
  });

  it("still reads the legacy bare-string form", () => {
    expect(cats.toCategoryOption("Photos")).toEqual({
      label: "Photos",
      imageUrl: null,
      priceCents: null,
      maxQuantity: 1,
      followUps: [],
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
      { label: "ok", imageUrl: null, priceCents: null, maxQuantity: 1, followUps: [] },
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
    // A selection carries a label, a quantity and answers — never a price. The
    // one it tried to smuggle in is ignored in favour of our own $150.
    const { estimateCents } = intake.resolveSelectedOptions(priced, [
      { label: "Aerial / Drone", priceCents: 1 },
    ] as unknown);
    expect(estimateCents).toBe(15000);
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
      selections: [],
      estimateCents: null,
      missingAnswer: null,
    });
  });
});

describe("quantities and per-choice questions", () => {
  it("round-trips the quantity ceiling and the questions", async () => {
    const reloaded = (await cats.getCategory(staging.key))!;
    const option = reloaded.extraOptions[0];
    expect(option.maxQuantity).toBe(10);
    expect(option.followUps.map((f) => f.id)).toEqual([
      "style",
      "which_image_numbers_rooms",
      "anything_to_avoid",
    ]);
    expect(option.followUps[0].choices).toEqual(["Modern", "Farmhouse", "Coastal"]);
    // A choice with no quantity set is a plain tick, not an unbounded order.
    expect(reloaded.extraOptions[1].maxQuantity).toBe(1);
  });

  it("prices a quantity as price × units", () => {
    const { selections, estimateCents } = intake.resolveSelectedOptions(staging, [
      { label: "Virtual staging", quantity: 3, answers: [{ id: "style", value: "Modern" }] },
      { label: "Twilight edit" },
    ]);
    expect(selections[0].quantity).toBe(3);
    expect(selections[0].lineTotalCents).toBe(15000);
    expect(estimateCents).toBe(22500);
  });

  it("clamps a quantity to the ceiling the admin set", () => {
    const { selections, estimateCents } = intake.resolveSelectedOptions(staging, [
      { label: "Virtual staging", quantity: 500, answers: { style: "Modern" } },
    ]);
    expect(selections[0].quantity).toBe(10);
    expect(estimateCents).toBe(50000);
  });

  it("floors a junk or fractional quantity at one", () => {
    for (const quantity of [0, -4, 2.7, Number.NaN, "3", null]) {
      const { selections } = intake.resolveSelectedOptions(staging, [
        { label: "Virtual staging", quantity, answers: { style: "Modern" } },
      ]);
      expect(selections[0].quantity).toBe(quantity === 2.7 ? 2 : 1);
    }
  });

  it("refuses a choice whose only quantity is on a tick-once option", () => {
    const { selections } = intake.resolveSelectedOptions(staging, [
      { label: "Twilight edit", quantity: 4 },
    ]);
    expect(selections[0].quantity).toBe(1);
    expect(selections[0].lineTotalCents).toBe(7500);
  });

  it("keeps the answers to questions we asked and drops the rest", () => {
    const { selections } = intake.resolveSelectedOptions(staging, [
      {
        label: "Virtual staging",
        quantity: 2,
        answers: [
          { id: "style", value: "  Coastal  " },
          { id: "which_image_numbers_rooms", value: "3, 7, 12" },
          { id: "not_a_question", value: "ignored" },
        ],
      },
    ]);
    expect(selections[0].answers).toEqual([
      { id: "style", label: "Preferred style", value: "Coastal" },
      { id: "which_image_numbers_rooms", label: "Which image numbers / rooms?", value: "3, 7, 12" },
    ]);
  });

  it("names the first required question left blank", () => {
    const { missingAnswer } = intake.resolveSelectedOptions(staging, [
      { label: "Virtual staging", quantity: 2, answers: [{ id: "style", value: "Modern" }] },
    ]);
    expect(missingAnswer).toEqual({
      option: "Virtual staging",
      question: "Which image numbers / rooms?",
    });
  });

  it("is satisfied once every required question is answered", () => {
    const { missingAnswer } = intake.resolveSelectedOptions(staging, [
      {
        label: "Virtual staging",
        answers: { style: "Modern", which_image_numbers_rooms: "Kitchen" },
      },
    ]);
    expect(missingAnswer).toBeNull();
  });

  it("asks nothing of a choice that was never picked", () => {
    const { missingAnswer, selections } = intake.resolveSelectedOptions(staging, ["Twilight edit"]);
    expect(missingAnswer).toBeNull();
    expect(selections).toHaveLength(1);
  });
});

describe("what the department reads", () => {
  it("itemizes a quantity, its line total and its answers", () => {
    const { selections } = intake.resolveSelectedOptions(staging, [
      {
        label: "Virtual staging",
        quantity: 3,
        answers: { style: "Modern", which_image_numbers_rooms: "Images 3, 7 and 12" },
      },
      { label: "Twilight edit" },
    ]);
    const body = intake.composeDescription(
      staging,
      intake.composeExtraValue(selections),
      "Before Friday please",
      selections,
    );
    expect(body).toContain("• Virtual staging ×3 — $150 ($50 each)");
    expect(body).toContain("Preferred style: Modern");
    expect(body).toContain("Which image numbers / rooms?: Images 3, 7 and 12");
    expect(body).toContain("• Twilight edit — $75");
    expect(body).toContain("Estimated total: $225");
    expect(body).toContain("Before Friday please");
  });

  it("carries the quantity onto the subject line", () => {
    const { selections } = intake.resolveSelectedOptions(staging, [
      {
        label: "Virtual staging",
        quantity: 3,
        answers: { style: "M", which_image_numbers_rooms: "x" },
      },
    ]);
    expect(intake.composeExtraValue(selections)).toBe("Virtual staging ×3");
  });

  it("itemizes the picks and states the total", () => {
    const { selections } = intake.resolveSelectedOptions(priced, [
      "Twilight photos",
      "Aerial / Drone",
    ]);
    const body = intake.composeDescription(
      priced,
      "Twilight photos, Aerial / Drone",
      "ASAP please",
      selections,
    );

    expect(body).toContain("Twilight photos — $75");
    expect(body).toContain("Aerial / Drone — $150");
    expect(body).toContain("Estimated total: $225");
    expect(body).toContain("ASAP please");
  });

  it("shows a half-dollar price without mangling it", () => {
    const option = cats.toCategoryOption({ label: "Retouch", priceCents: 14950 })!;
    const body = intake.composeDescription(priced, "Retouch", "please", [
      { option, quantity: 1, answers: [], lineTotalCents: 14950 },
    ]);
    expect(body).toContain("Retouch — $149.50");
  });

  it("leaves an unpriced single answer reading exactly as before", () => {
    const plain = intake.composeDescription(priced, "Photos", "too dark", []);
    expect(plain).toBe("Which services? Photos\n\ntoo dark");
  });
});
