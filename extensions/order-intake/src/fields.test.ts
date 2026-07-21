import { describe, expect, it } from "vitest";
import { ScriptedBrain } from "./brain.js";
import { coerceFields } from "./runtime-brain.js";
import { emptyDraft, type IntakeSession } from "./session-store.js";
import { chatPageHtml } from "./widget.js";

function session(): IntakeSession {
  return {
    visitorId: "v1",
    listingId: undefined,
    history: [],
    draft: emptyDraft(),
    handedOff: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

const noopSender = { send: async () => ({ ok: true as const }) };

describe("scripted brain structured asks", () => {
  it("offers tap-able choices for an enumerable question", async () => {
    const brain = new ScriptedBrain(noopSender);
    const s = session();
    // First slot is the address; answering it moves on to the service choice.
    const turn = await brain.respond({ session: s, message: "123 Main St, Dayton OH" });
    expect(turn.fields).toBeDefined();
    const [field] = turn.fields!;
    expect(field.type).toBe("choice");
    expect((field.options ?? []).length).toBeGreaterThan(1);
    // Option labels are what sit on the buttons, so they must stay short.
    for (const opt of field.options ?? []) {
      expect(opt.label.split(/\s+/).length).toBeLessThanOrEqual(3);
    }
  });

  it("asks for square footage as a number box", async () => {
    const brain = new ScriptedBrain(noopSender);
    const s = session();
    await brain.respond({ session: s, message: "123 Main St" });
    const turn = await brain.respond({ session: s, message: "WOW Essentials" });
    expect(turn.fields?.[0]?.type).toBe("number");
    expect(turn.fields?.[0]?.key).toBe("squareFeet");
  });

  it("keeps the vacancy question to two options", async () => {
    const brain = new ScriptedBrain(noopSender);
    const s = session();
    await brain.respond({ session: s, message: "123 Main St" });
    await brain.respond({ session: s, message: "WOW Essentials" });
    await brain.respond({ session: s, message: "2400" });
    const turn = await brain.respond({ session: s, message: "310000" });
    expect((turn.fields?.[0]?.options ?? []).map((o) => o.value)).toEqual(["vacant", "occupied"]);
  });
});

describe("coerceFields rejects anything off-contract", () => {
  it("passes a well-formed choice through", () => {
    const fields = coerceFields([
      {
        key: "vacancy",
        label: "Vacant or occupied?",
        type: "choice",
        options: [{ value: "vacant", label: "Vacant" }],
      },
    ]);
    expect(fields).toHaveLength(1);
    expect(fields![0].options).toEqual([{ value: "vacant", label: "Vacant" }]);
  });

  it("drops a choice with no options rather than rendering a dead end", () => {
    expect(coerceFields([{ key: "x", label: "Pick one", type: "choice" }])).toBeUndefined();
    expect(
      coerceFields([{ key: "x", label: "Pick one", type: "choice", options: [] }]),
    ).toBeUndefined();
  });

  it("drops unknown types and fields missing a key or label", () => {
    expect(coerceFields([{ key: "x", label: "X", type: "password" }])).toBeUndefined();
    expect(coerceFields([{ label: "X", type: "text" }])).toBeUndefined();
    expect(coerceFields([{ key: "x", type: "text" }])).toBeUndefined();
  });

  it("caps runaway field and option counts", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      key: `k${i}`,
      label: `L${i}`,
      type: "text",
    }));
    expect(coerceFields(many)).toHaveLength(6);
    const manyOptions = coerceFields([
      {
        key: "k",
        label: "L",
        type: "choice",
        options: Array.from({ length: 20 }, (_, i) => ({ value: `v${i}`, label: `L${i}` })),
      },
    ]);
    expect(manyOptions![0].options).toHaveLength(6);
  });

  it("returns undefined for non-arrays and empty results", () => {
    expect(coerceFields(undefined)).toBeUndefined();
    expect(coerceFields("fields")).toBeUndefined();
    expect(coerceFields([])).toBeUndefined();
    expect(coerceFields([null, 42, "x"])).toBeUndefined();
  });

  it("falls back to the value when an option label is missing", () => {
    const fields = coerceFields([
      { key: "k", label: "L", type: "choice", options: [{ value: "asap" }] },
    ]);
    expect(fields![0].options).toEqual([{ value: "asap", label: "asap" }]);
  });
});

describe("widget", () => {
  it("ships a script that parses", () => {
    const html = chatPageHtml("/wow-intake");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    // The widget is a template string, so nothing else typechecks or lints it.
    // oxlint-disable-next-line no-implied-eval
    expect(() => new Function(script!)).not.toThrow();
  });

  it("renders structured asks and keeps the free-text box", () => {
    const html = chatPageHtml("/wow-intake");
    expect(html).toContain("showAsk");
    expect(html).toContain("renderChips");
    expect(html).toContain("renderForm");
    expect(html).toContain('id="m"');
  });
});
