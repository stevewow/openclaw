import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// The ask log. Its job on the report is to separate two things that both look
// like a zero: questions the knowledge base could not answer, and questions
// nothing answered because the feature itself was broken.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-kb-ask-store-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./kb-ask-store.js");
const { getAdminDb } = await import("./user-store.js");

const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await getAdminDb().deleteFrom("admin_kb_asks").execute();
});

describe("recording a question", () => {
  it("keeps the words asked and nothing about who asked", async () => {
    await store.recordKbAsk({ question: "How do I get my photos?", answered: true });
    const rows = await getAdminDb().selectFrom("admin_kb_asks").selectAll().execute();
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).toSorted()).toEqual([
      "answered",
      "article_slugs",
      "created_at",
      "decline_reason",
      "id",
      "input_tokens",
      "output_tokens",
      "question",
      "question_key",
      "top_score",
    ]);
  });

  it("groups repeats of the same question however they were typed", async () => {
    await store.recordKbAsk({ question: "How do I get my photos?", answered: true });
    await store.recordKbAsk({ question: "how do i get my photos", answered: true });
    const summary = await store.summarizeKbAsks();
    expect(summary.top).toHaveLength(1);
    expect(summary.top[0].asks).toBe(2);
  });

  it("refuses a question with no words in it", async () => {
    expect(await store.recordKbAsk({ question: "???", answered: false })).toBeNull();
  });

  it("caps the stored question", async () => {
    await store.recordKbAsk({ question: "x".repeat(5_000), answered: false });
    const row = await getAdminDb()
      .selectFrom("admin_kb_asks")
      .select("question")
      .executeTakeFirstOrThrow();
    expect(row.question.length).toBe(store.MAX_QUESTION);
  });

  it("carries the tokens it cost", async () => {
    await store.recordKbAsk({
      question: "how do I reschedule",
      answered: true,
      inputTokens: 900,
      outputTokens: 40,
    });
    const summary = await store.summarizeKbAsks();
    expect(summary.inputTokens).toBe(900);
    expect(summary.outputTokens).toBe(40);
  });
});

describe("the decline reasons", () => {
  it("separate a hole in the knowledge base from a broken feature", () => {
    expect(store.isContentDecline("no_match")).toBe(true);
    expect(store.isContentDecline("no_answer_in_articles")).toBe(true);
    expect(store.isContentDecline("not_configured")).toBe(false);
    expect(store.isContentDecline("model_error")).toBe(false);
  });

  it("are counted apart on the report", async () => {
    await store.recordKbAsk({
      question: "what does twilight cost",
      answered: false,
      declineReason: "no_match",
    });
    await store.recordKbAsk({
      question: "when will my photos be ready",
      answered: false,
      declineReason: "no_answer_in_articles",
    });
    await store.recordKbAsk({
      question: "how do I reschedule",
      answered: false,
      declineReason: "model_error",
    });
    const summary = await store.summarizeKbAsks();
    // A broken key must never be read as three missing articles.
    expect(summary.contentDeclines).toBe(2);
    expect(summary.brokenDeclines).toBe(1);
  });
});

describe("the report", () => {
  it("lists questions nothing could answer", async () => {
    await store.recordKbAsk({
      question: "Do you shoot twilight photos?",
      answered: false,
      declineReason: "no_match",
    });
    await store.recordKbAsk({
      question: "do you shoot twilight photos",
      answered: false,
      declineReason: "no_match",
    });
    await store.recordKbAsk({ question: "how do I reschedule", answered: true });

    const summary = await store.summarizeKbAsks();
    expect(summary.totalAsks).toBe(3);
    expect(summary.answeredAsks).toBe(1);
    expect(summary.unanswered.map((g) => g.questionKey)).toEqual(["do you shoot twilight photos"]);
    expect(summary.unanswered[0].asks).toBe(2);
    // The most recent phrasing, not an arbitrary one.
    expect(summary.unanswered[0].question).toBe("do you shoot twilight photos");
  });

  it("drops a question from the unanswered list once it has been answered", async () => {
    await store.recordKbAsk({
      question: "where are my photos",
      answered: false,
      declineReason: "no_match",
    });
    expect((await store.summarizeKbAsks()).unanswered).toHaveLength(1);

    // Someone writes the article; the next asking of it lands.
    await store.recordKbAsk({ question: "where are my photos", answered: true });
    expect((await store.summarizeKbAsks()).unanswered).toEqual([]);
  });

  it("only counts the window it was asked for", async () => {
    const now = Date.now();
    await store.recordKbAsk({ question: "old one", answered: true, at: now - 60 * DAY });
    await store.recordKbAsk({ question: "new one", answered: true, at: now - 2 * DAY });
    expect((await store.summarizeKbAsks({ days: 30 })).totalAsks).toBe(1);
    expect((await store.summarizeKbAsks({ days: 365 })).totalAsks).toBe(2);
  });

  it("reports an empty period as empty rather than as an error", async () => {
    const summary = await store.summarizeKbAsks();
    expect(summary.totalAsks).toBe(0);
    expect(summary.unanswered).toEqual([]);
    expect(summary.inputTokens).toBe(0);
  });
});

describe("the daily count", () => {
  it("counts only what was asked since the moment given", async () => {
    const now = Date.now();
    await store.recordKbAsk({ question: "yesterday", answered: true, at: now - 2 * DAY });
    await store.recordKbAsk({ question: "today one", answered: true, at: now - 1000 });
    await store.recordKbAsk({ question: "today two", answered: true, at: now - 500 });
    expect(await store.countKbAsksSince(now - DAY)).toBe(2);
  });
});
