import { describe, expect, it, vi } from "vitest";
import { answerCoachQuestion, COACH_INSTRUCTION, type CoachDeps } from "./coach-answer.js";
import type { CoachModelRequest, CoachModelResult } from "./coach-answer.runtime.js";
import type { GuideCorpus } from "./coach-guide-store.js";

/**
 * The coach, driven through its dependency seam: no database, no network, no
 * model. What is worth pinning here is not that a model answers — it is
 * everything this module does around the model, because that is what stops a
 * salesperson repeating an invented price to a client.
 */

function corpusOf(sections: Array<{ id: string; heading: string }>): GuideCorpus {
  const text = sections
    .map((s) => `### ${s.heading}\n<section id="${s.id}">body</section>`)
    .join("\n\n");
  return {
    text,
    sectionIds: sections.map((s) => s.id),
    headings: new Map(sections.map((s) => [s.id, s.heading])),
    approxTokens: Math.round(text.length / 3.7),
  };
}

const GUIDE = corpusOf([
  { id: "sec-hdr", heading: "HDR Photography" },
  { id: "sec-essentials", heading: "WOW Essentials" },
]);

function deps(over: Partial<CoachDeps> = {}) {
  const recorded: Array<Record<string, unknown>> = [];
  const sent: CoachModelRequest[] = [];
  const base: CoachDeps = {
    corpus: async () => GUIDE,
    thread: async () => [],
    callModel: async (req) => {
      sent.push(req);
      return {
        answered: true,
        answer: "Lead with WOW Essentials.",
        sectionIds: ["sec-essentials"],
        inputTokens: 100,
        cachedTokens: 90,
        outputTokens: 20,
      } satisfies CoachModelResult;
    },
    record: async (input) => {
      recorded.push(input as unknown as Record<string, unknown>);
      return "ask-1";
    },
    env: { ANTHROPIC_API_KEY: "test-key" } as NodeJS.ProcessEnv,
    ...over,
  };
  return { deps: base, recorded, sent };
}

const ask = (d: Partial<CoachDeps>, question = "What should I recommend?") =>
  answerCoachQuestion({ question, threadId: "th-1", userId: "u-1" }, d);

describe("what the coach is told", () => {
  it("sends the whole guide, and the question after it", async () => {
    const { deps: d, sent } = deps();
    await ask(d);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.corpus).toBe(GUIDE.text);
    expect(sent[0]?.question).toBe("What should I recommend?");
    expect(sent[0]?.instruction).toBe(COACH_INSTRUCTION);
  });

  it("forbids inventing a price, because someone will say it out loud", () => {
    expect(COACH_INSTRUCTION).toContain("Never invent a price");
    expect(COACH_INSTRUCTION).toContain("check with leadership");
    // Partner pricing is leadership's to give and the guide does not carry it.
    expect(COACH_INSTRUCTION).toContain("Brokerage partner pricing");
  });

  it("carries the conversation so far, trimmed", async () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      question: `q${i}`,
      answer: "a".repeat(5_000),
    }));
    const { deps: d, sent } = deps({ thread: async () => history });
    await ask(d);
    // Six turns, and no single earlier answer allowed to fill the window.
    expect(sent[0]?.history).toHaveLength(6);
    expect(sent[0]?.history[0]?.question).toBe("q4");
    expect(sent[0]?.history[0]?.answer?.length).toBe(2_000);
  });

  it("truncates a guide that has grown past what a question may cost", async () => {
    const huge = corpusOf(
      Array.from({ length: 400 }, (_, i) => ({ id: `s-${i}`, heading: "x".repeat(200) })),
    );
    const { deps: d, sent } = deps({
      corpus: async () => huge,
      env: { ANTHROPIC_API_KEY: "k", COACH_CORPUS_TOKEN_CAP: "500" } as NodeJS.ProcessEnv,
    });
    await ask(d);
    expect(sent[0]?.corpus.length).toBeLessThan(huge.text.length);
    expect(sent[0]?.corpus).toContain("longer than the coach can read");
  });
});

describe("what comes back", () => {
  it("answers, cites the section it used, and logs the cost", async () => {
    const { deps: d, recorded } = deps();
    const result = await ask(d);
    expect(result.answered).toBe(true);
    expect(result.answer).toBe("Lead with WOW Essentials.");
    expect(result.cited).toEqual([{ id: "sec-essentials", heading: "WOW Essentials" }]);
    expect(recorded[0]?.outcome).toBe("answered");
    expect(recorded[0]?.cited).toEqual(["sec-essentials"]);
    expect(recorded[0]?.cachedTokens).toBe(90);
  });

  it("drops a citation naming a section we never sent", async () => {
    // The citation is the only sign that an answer came from the guide rather
    // than from the model's training. One we cannot match is not evidence.
    const { deps: d } = deps({
      callModel: async () => ({
        answered: true,
        answer: "Our drone package is $99.",
        sectionIds: ["sec-essentials", "sec-invented"],
        inputTokens: 1,
        cachedTokens: 0,
        outputTokens: 1,
      }),
    });
    const result = await ask(d);
    expect(result.cited.map((c) => c.id)).toEqual(["sec-essentials"]);
  });

  it("says the guide does not cover it rather than guessing", async () => {
    const { deps: d, recorded } = deps({
      callModel: async () => ({
        answered: false,
        answer: "",
        sectionIds: [],
        inputTokens: 1,
        cachedTokens: 0,
        outputTokens: 1,
      }),
    });
    const result = await ask(d, "What is our refund policy?");
    expect(result.answered).toBe(false);
    expect(result.answer).toContain("does not cover that one");
    expect(recorded[0]?.outcome).toBe("no_answer");
  });

  it("turns a failed call into an answer, not a stack trace", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { deps: d, recorded } = deps({
      callModel: async () => {
        throw new Error("upstream exploded");
      },
    });
    const result = await ask(d);
    expect(result.answered).toBe(false);
    expect(result.answer).toContain("Try that again");
    expect(recorded[0]?.outcome).toBe("model_error");
    warn.mockRestore();
  });

  it("stays quiet when there is no key, and logs it against the daily count", async () => {
    const { deps: d, recorded, sent } = deps({ env: {} as NodeJS.ProcessEnv });
    const result = await ask(d);
    expect(sent).toHaveLength(0);
    expect(result.outcome).toBe("not_configured");
    // Still recorded: the ceiling counts everything, including a loop asking a
    // coach that was never switched on.
    expect(recorded[0]?.outcome).toBe("not_configured");
  });

  it("stays quiet when the guide is empty", async () => {
    const { deps: d, sent } = deps({ corpus: async () => corpusOf([]) });
    const result = await ask(d);
    expect(sent).toHaveLength(0);
    expect(result.outcome).toBe("empty_guide");
    expect(result.answer).toContain("Guide page");
  });
});
