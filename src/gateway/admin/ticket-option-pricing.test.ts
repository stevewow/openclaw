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
      priceMaxCents: null,
      quoteRequired: false,
      unitLabel: null,
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
      priceMaxCents: null,
      quoteRequired: false,
      unitLabel: null,
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
      {
        label: "ok",
        imageUrl: null,
        priceCents: null,
        priceMaxCents: null,
        quoteRequired: false,
        unitLabel: null,
        maxQuantity: 1,
        followUps: [],
      },
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
      estimateMaxCents: null,
      quoteRequired: false,
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
      { option, quantity: 1, answers: [], lineTotalCents: 14950, lineTotalMaxCents: null },
    ]);
    expect(body).toContain("Retouch — $149.50");
  });

  it("leaves an unpriced single answer reading exactly as before", () => {
    const plain = intake.composeDescription(priced, "Photos", "too dark", []);
    expect(plain).toBe("Which services? Photos\n\ntoo dark");
  });

  // "each" is only right for a countable thing. Virtual staging is sold per
  // image, so the desk should read the same wording the client agreed to.
  it("uses the choice's own unit wording on the line item", () => {
    const option = cats.toCategoryOption({
      label: "Virtual staging",
      priceCents: 5000,
      unitLabel: "per image",
      maxQuantity: 10,
    })!;
    const body = intake.composeDescription(priced, "Virtual staging ×3", "please", [
      { option, quantity: 3, answers: [], lineTotalCents: 15000, lineTotalMaxCents: null },
    ]);
    expect(body).toContain("• Virtual staging ×3 — $150 ($50 per image)");
  });
});

describe("unit wording", () => {
  it("keeps whatever the admin typed", () => {
    const option = cats.toCategoryOption({ label: "Staging", unitLabel: "  per image  " })!;
    expect(option.unitLabel).toBe("per image");
    expect(cats.optionUnitLabel(option)).toBe("per image");
  });

  it("falls back to each when no wording is set", () => {
    const option = cats.toCategoryOption({ label: "Staging" })!;
    expect(option.unitLabel).toBeNull();
    expect(cats.optionUnitLabel(option)).toBe("each");
  });

  it("drops a blank or non-string wording rather than storing an empty unit", () => {
    expect(cats.toCategoryOption({ label: "a", unitLabel: "   " })!.unitLabel).toBeNull();
    expect(cats.toCategoryOption({ label: "b", unitLabel: 42 })!.unitLabel).toBeNull();
  });

  it("caps a pasted essay so it cannot push the price off the choice", () => {
    const option = cats.toCategoryOption({ label: "a", unitLabel: "x".repeat(200) })!;
    expect(option.unitLabel).toHaveLength(40);
  });

  it("survives a round trip through the store", async () => {
    const saved = await cats.createCategory({
      label: "Staging menu",
      extraField: "multiselect",
      extraLabel: "Which services?",
      extraOptions: [
        { label: "Virtual staging", priceCents: 5000, unitLabel: "per image", maxQuantity: 10 },
        { label: "Twilight edit", priceCents: 7500 },
      ],
    });
    const reloaded = (await cats.getCategory(saved.key))!;
    expect(reloaded.extraOptions.map((o) => o.unitLabel)).toEqual(["per image", null]);
  });

  it("prices a choice the way the client will read it", () => {
    const of = (raw: Record<string, unknown>) => cats.formatUnitPrice(cats.toCategoryOption(raw)!);
    // A custom unit always wins, quantity picker or not.
    expect(of({ label: "a", priceCents: 5000, unitLabel: "per image", maxQuantity: 10 })) //
      .toBe("$50 per image");
    expect(of({ label: "a", priceCents: 120000, unitLabel: "per property" })) //
      .toBe("$1200 per property");
    // Without one, "each" only appears where there is something to multiply.
    expect(of({ label: "a", priceCents: 5000, maxQuantity: 10 })).toBe("$50 each");
    expect(of({ label: "a", priceCents: 7500 })).toBe("$75");
    expect(of({ label: "a", priceCents: null })).toBe("");
  });
});

// Some add-ons are firm ($25 a twilight image) and some depend on how big the
// job turns out to be (decluttering, item removal). A firm ticket can be
// scheduled on arrival; a ranged one cannot start until the client accepts a
// number. The two must never be blended into one confident-looking total.
describe("choices that have to be quoted", () => {
  const ranged = (over: Record<string, unknown> = {}) =>
    cats.toCategoryOption({
      label: "Item removal",
      priceCents: 2500,
      priceMaxCents: 7500,
      unitLabel: "per photo",
      maxQuantity: 10,
      ...over,
    })!;
  const firm = (over: Record<string, unknown> = {}) =>
    cats.toCategoryOption({ label: "Twilight edit", priceCents: 7500, ...over })!;

  describe("storing the range", () => {
    it("keeps a high end above the low one and forces the quote flag", () => {
      const option = ranged();
      expect(option.priceCents).toBe(2500);
      expect(option.priceMaxCents).toBe(7500);
      // Never a separate switch to forget: a range is quote-required by nature.
      expect(option.quoteRequired).toBe(true);
    });

    it("drops a high end that is not above the low one", () => {
      // Equal or inverted is a typo. Falling back to the firm low price is the
      // reading that cannot over-quote a client.
      expect(ranged({ priceMaxCents: 2500 }).priceMaxCents).toBeNull();
      expect(ranged({ priceMaxCents: 1000 }).priceMaxCents).toBeNull();
      expect(ranged({ priceMaxCents: 2500 }).quoteRequired).toBe(false);
    });

    it("drops a high end with no low end to anchor it", () => {
      const option = cats.toCategoryOption({ label: "a", priceMaxCents: 7500 })!;
      expect(option.priceMaxCents).toBeNull();
      expect(option.priceCents).toBeNull();
    });

    it("refuses a fractional or negative high end", () => {
      for (const bad of [10.5, -100, Number.NaN, "75", Number.POSITIVE_INFINITY]) {
        expect(ranged({ priceMaxCents: bad }).priceMaxCents).toBeNull();
      }
    });

    it("carries a bare quote flag with no figures at all", () => {
      const option = cats.toCategoryOption({ label: "Custom retouching", quoteRequired: true })!;
      expect(option.quoteRequired).toBe(true);
      expect(option.priceCents).toBeNull();
      expect(cats.formatUnitPrice(option)).toBe("");
    });

    it("survives a round trip through the store", async () => {
      const saved = await cats.createCategory({
        label: "Editing menu",
        extraField: "multiselect",
        extraLabel: "Which edits?",
        extraOptions: [
          { label: "Item removal", priceCents: 2500, priceMaxCents: 7500, maxQuantity: 10 },
          { label: "Custom retouching", quoteRequired: true },
          { label: "Twilight edit", priceCents: 7500 },
        ],
      });
      const reloaded = (await cats.getCategory(saved.key))!;
      expect(reloaded.extraOptions.map((o) => [o.priceMaxCents, o.quoteRequired])).toEqual([
        [7500, true],
        [null, true],
        [null, false],
      ]);
    });
  });

  describe("wording the price", () => {
    it("shows a range as a span", () => {
      expect(cats.formatUnitPrice(ranged())).toBe("$25–$75 per photo");
    });

    it("still reads as each when a ranged choice has no unit wording", () => {
      expect(cats.formatUnitPrice(ranged({ unitLabel: null }))).toBe("$25–$75 each");
    });
  });

  describe("splitting the total", () => {
    const sum = (lines: Array<[ReturnType<typeof firm>, number]>) =>
      cats.summarizeEstimate(lines.map(([option, quantity]) => ({ option, quantity })));

    it("keeps firm money apart from quoted money", () => {
      const totals = sum([
        [firm(), 1],
        [ranged(), 2],
      ]);
      expect(totals.firmCents).toBe(7500);
      expect(totals.quotedLowCents).toBe(5000);
      expect(totals.quotedHighCents).toBe(15000);
      expect(totals.needsQuote).toBe(true);
      expect(cats.formatEstimateRange(totals)).toBe("$125–$225");
    });

    it("reads as a single firm number when nothing needs quoting", () => {
      const totals = sum([[firm(), 2]]);
      expect(totals.needsQuote).toBe(false);
      expect(totals.quotedHighCents).toBe(0);
      expect(cats.formatEstimateRange(totals)).toBe("$150");
    });

    it("counts a figure-less quoted choice without letting it move the numbers", () => {
      const totals = sum([
        [firm(), 1],
        [cats.toCategoryOption({ label: "Custom", quoteRequired: true })!, 1],
      ]);
      expect(totals.firmCents).toBe(7500);
      expect(totals.unquotedCount).toBe(1);
      expect(totals.needsQuote).toBe(true);
      // The band is complete for what we can price; the caller has to say the
      // rest is still to come rather than imply $75 is the whole job.
      expect(cats.formatEstimateRange(totals)).toBe("$75");
    });

    it("is empty when nothing picked carries a price or a quote", () => {
      expect(sum([[cats.toCategoryOption({ label: "Photos" })!, 1]]).empty).toBe(true);
    });
  });

  describe("what the client and the desk are told", () => {
    let menu: Awaited<ReturnType<typeof cats.createCategory>>;
    beforeAll(async () => {
      menu = await cats.createCategory({
        label: "Editing",
        extraField: "multiselect",
        extraLabel: "Which edits?",
        extraOptions: [
          { label: "Twilight edit", priceCents: 7500 },
          {
            label: "Item removal",
            priceCents: 2500,
            priceMaxCents: 7500,
            unitLabel: "per photo",
            maxQuantity: 10,
          },
          { label: "Custom retouching", quoteRequired: true },
        ],
      });
    });

    it("returns a banded estimate and the quote flag", () => {
      const r = intake.resolveSelectedOptions(menu, [
        "Twilight edit",
        { label: "Item removal", quantity: 2 },
      ]);
      expect(r.estimateCents).toBe(12500);
      expect(r.estimateMaxCents).toBe(22500);
      expect(r.quoteRequired).toBe(true);
    });

    it("leaves a firm-only ticket reading exactly as it always did", () => {
      const r = intake.resolveSelectedOptions(menu, ["Twilight edit"]);
      expect(r.estimateCents).toBe(7500);
      expect(r.estimateMaxCents).toBeNull();
      expect(r.quoteRequired).toBe(false);
    });

    it("flags a quote even when the only quoted pick has no figures", () => {
      const r = intake.resolveSelectedOptions(menu, ["Twilight edit", "Custom retouching"]);
      expect(r.estimateCents).toBe(7500);
      expect(r.estimateMaxCents).toBeNull();
      expect(r.quoteRequired).toBe(true);
    });

    it("splits the department email so the desk knows what it can start", () => {
      const { selections } = intake.resolveSelectedOptions(menu, [
        "Twilight edit",
        { label: "Item removal", quantity: 2 },
      ]);
      const body = intake.composeDescription(menu, null, "Before Friday", selections);
      expect(body).toContain("• Twilight edit — $75");
      expect(body).toContain("• Item removal ×2 — $50–$150 ($25–$75 per photo)  [QUOTE FIRST]");
      expect(body).toContain("Starts right away: $75");
      expect(body).toContain("Quoted before we start: $50–$150");
      expect(body).toContain("Estimated total: $125–$225");
      expect(body).toContain("Send a quote and get it accepted");
    });

    it("says a figure-less line is still to be priced", () => {
      const { selections } = intake.resolveSelectedOptions(menu, [
        "Twilight edit",
        "Custom retouching",
      ]);
      const body = intake.composeDescription(menu, null, "thanks", selections);
      expect(body).toContain("• Custom retouching — to be quoted  [QUOTE FIRST]");
      expect(body).toContain("Quoted before we start: to be quoted");
      expect(body).toContain("Estimated total: $75 + items still to price");
    });

    it("leaves a firm-only email without any quote wording", () => {
      const { selections } = intake.resolveSelectedOptions(menu, ["Twilight edit"]);
      const body = intake.composeDescription(menu, null, "thanks", selections);
      expect(body).toContain("Estimated total: $75");
      expect(body).not.toContain("QUOTE FIRST");
      expect(body).not.toContain("Starts right away");
    });
  });
});
