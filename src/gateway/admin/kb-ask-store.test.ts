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
      "contact_email",
      "created_at",
      "decline_reason",
      "escalated_at",
      "id",
      "input_tokens",
      "output_tokens",
      "question",
      "question_key",
      "top_score",
    ]);
    // The one column that could identify anyone stays empty unless a client
    // types an address into "send this to our team".
    expect(rows[0].contact_email).toBeNull();
    expect(rows[0].escalated_at).toBeNull();
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

describe("passing a question to a person", () => {
  it("reports whether it found the question to mark", async () => {
    const id = (await store.recordKbAsk({ question: "where are my photos", answered: false }))!;
    expect(await store.escalateKbAsk(id, { email: "agent@example.com" })).toBe(true);
    // An id naming nothing changes nothing — this can stamp a row, never make one.
    expect(await store.escalateKbAsk("no-such-ask", { email: "x@example.com" })).toBe(false);
  });

  it("keeps each request separately rather than grouping them", async () => {
    // Two people asking the same thing are two people waiting, and rolling them
    // into a row with a 2 on it would lose one of them.
    const first = (await store.recordKbAsk({ question: "where are my photos", answered: false }))!;
    const second = (await store.recordKbAsk({
      question: "Where are my photos?",
      answered: false,
    }))!;
    await store.escalateKbAsk(first, { email: "one@example.com" });
    await store.escalateKbAsk(second, { email: "two@example.com" });

    const requests = await store.listKbAskRequests();
    expect(requests).toHaveLength(2);
    expect(
      requests.map((r) => r.email).toSorted((a, b) => (a ?? "").localeCompare(b ?? "")),
    ).toEqual(["one@example.com", "two@example.com"]);
  });

  it("lists the newest first, since the report is a queue of people waiting", async () => {
    const now = Date.now();
    const older = (await store.recordKbAsk({ question: "older one", answered: false }))!;
    const newer = (await store.recordKbAsk({ question: "newer one", answered: false }))!;
    await store.escalateKbAsk(older, { at: now - 60_000 });
    await store.escalateKbAsk(newer, { at: now });
    expect((await store.listKbAskRequests()).map((r) => r.question)).toEqual([
      "newer one",
      "older one",
    ]);
  });

  it("says whether the box had already answered when they asked for a person", async () => {
    const id = (await store.recordKbAsk({ question: "that did not help", answered: true }))!;
    await store.escalateKbAsk(id);
    expect((await store.listKbAskRequests())[0].wasAnswered).toBe(true);
  });

  it("leaves unsent questions off the list entirely", async () => {
    await store.recordKbAsk({ question: "just curious", answered: false });
    expect(await store.listKbAskRequests()).toEqual([]);
  });

  it("rides along on the report", async () => {
    const id = (await store.recordKbAsk({ question: "where are my photos", answered: false }))!;
    await store.escalateKbAsk(id, { email: "agent@example.com" });
    const summary = await store.summarizeKbAsks();
    expect(summary.requests.map((r) => r.email)).toEqual(["agent@example.com"]);
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
