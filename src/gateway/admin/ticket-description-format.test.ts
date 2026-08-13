import { describe, expect, it } from "vitest";
import { parseDescriptionBlocks, partitionDescription } from "./ticket-description-format.js";

// The parser reads back what composeDescription writes, so the cases here are
// real emitter output rather than invented shapes — if the two ever drift, the
// department email quietly loses its structure and these are what catch it.

describe("parsing an itemized description", () => {
  const ITEMIZED = [
    "Which services?",
    "  • Virtual staging ×3 — $150 ($50 per image)",
    "      Preferred style: Modern",
    "      Which image numbers / rooms?: Images 3, 7 and 12",
    "  • Item removal ×2 — $50–$150 ($25–$75 per photo)  [QUOTE FIRST]",
    "  Starts right away: $150",
    "  Quoted before we start: $50–$150",
    "  Estimated total: $200–$300",
    "  ** Send a quote and get it accepted before starting the quoted items. **",
    "",
    "Before Friday please.",
  ].join("\n");

  it("reads the follow-up question as the heading", () => {
    const blocks = parseDescriptionBlocks(ITEMIZED);
    expect(blocks[0]).toEqual({ kind: "heading", text: "Which services?" });
  });

  it("splits a choice from its price", () => {
    const blocks = parseDescriptionBlocks(ITEMIZED);
    const first = blocks.find((b) => b.kind === "item");
    expect(first).toMatchObject({
      kind: "item",
      label: "Virtual staging ×3",
      price: "$150 ($50 per image)",
      quoteFirst: false,
    });
  });

  it("attaches each follow-up answer to the choice above it", () => {
    const blocks = parseDescriptionBlocks(ITEMIZED);
    const first = blocks.find((b) => b.kind === "item");
    expect(first && "answers" in first ? first.answers : []).toEqual([
      { label: "Preferred style", value: "Modern" },
      { label: "Which image numbers / rooms?", value: "Images 3, 7 and 12" },
    ]);
  });

  it("flags the line that cannot start before a quote is accepted", () => {
    const items = parseDescriptionBlocks(ITEMIZED).filter((b) => b.kind === "item");
    expect(items[1]).toMatchObject({
      label: "Item removal ×2",
      price: "$50–$150 ($25–$75 per photo)",
      quoteFirst: true,
    });
  });

  it("reads the money lines as label/value pairs", () => {
    const summaries = parseDescriptionBlocks(ITEMIZED).filter((b) => b.kind === "summary");
    expect(summaries).toEqual([
      { kind: "summary", label: "Starts right away", value: "$150" },
      { kind: "summary", label: "Quoted before we start", value: "$50–$150" },
      { kind: "summary", label: "Estimated total", value: "$200–$300" },
    ]);
  });

  it("lifts the quote instruction out of its asterisks", () => {
    const callout = parseDescriptionBlocks(ITEMIZED).find((b) => b.kind === "callout");
    expect(callout).toEqual({
      kind: "callout",
      text: "Send a quote and get it accepted before starting the quoted items.",
    });
  });

  it("keeps the client's own words apart from the specifics", () => {
    const { structured, notes } = partitionDescription(ITEMIZED);
    expect(notes).toEqual(["Before Friday please."]);
    expect(structured.some((b) => b.kind === "paragraph")).toBe(false);
  });
});

describe("descriptions with nothing to structure", () => {
  // A ticket typed straight into the dashboard, or one written before the form
  // itemized anything. Everything is prose, and none of it may be lost.
  it("treats a hand-written ticket as prose", () => {
    const { structured, notes } = partitionDescription(
      "Client called about the drone shots.\n\nThey want them reshot on Tuesday.",
    );
    expect(structured).toEqual([]);
    expect(notes).toEqual([
      "Client called about the drone shots.",
      "They want them reshot on Tuesday.",
    ]);
  });

  // The unpriced single-answer form still writes "Label Value" on one line.
  // There is no indented block under it, so it must stay a sentence rather than
  // being promoted to a section heading with nothing beneath it.
  it("does not promote a lone first line to a heading", () => {
    const blocks = parseDescriptionBlocks("Which services? Photos\n\ntoo dark");
    expect(blocks.every((b) => b.kind === "paragraph")).toBe(true);
    expect(blocks).toHaveLength(2);
  });

  it("returns nothing for an empty description", () => {
    expect(parseDescriptionBlocks(null)).toEqual([]);
    expect(parseDescriptionBlocks("   \n  ")).toEqual([]);
  });

  it("survives Windows line endings", () => {
    const blocks = parseDescriptionBlocks("Which media?\r\n  • Photos — $50\r\n\r\nplease");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "item", "paragraph"]);
  });

  // An indented answer with no choice above it would otherwise vanish, and it is
  // still something the client wrote.
  it("keeps an orphaned answer as prose rather than dropping it", () => {
    const blocks = parseDescriptionBlocks("      Preferred style: Modern");
    expect(blocks).toEqual([{ kind: "paragraph", text: "Preferred style: Modern" }]);
  });
});
