import { describe, expect, it, vi } from "vitest";
import { answerHelpQuestion, buildUserContent } from "./kb-answer.js";
import type { KbArticle } from "./kb-store.js";

// The answering pipeline, with retrieval and the model both injected — no
// database and no network. What is pinned here is the safety argument: a
// question that matches nothing never reaches a model, and an answer that
// cannot point at one of OUR articles is thrown away.

function article(over: Partial<KbArticle> = {}): KbArticle {
  return {
    id: "art-1",
    slug: "reschedule-a-shoot",
    title: "Reschedule a shoot",
    summary: "Move an appointment",
    bodyMd: "Call the office and we will move it.",
    categoryId: null,
    status: "published",
    videoUrl: null,
    sortOrder: 0,
    createdBy: null,
    publishedBy: null,
    publishedAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const ENV = { ANTHROPIC_API_KEY: "test-key" } as NodeJS.ProcessEnv;

function found(articles: KbArticle[], score = -3.2) {
  return () => Promise.resolve(articles.map((a) => ({ article: a, score })));
}

function replies(over: Record<string, unknown> = {}) {
  return vi.fn(() =>
    Promise.resolve({
      answered: true,
      answer: "Call the office and we will move it.",
      articleSlugs: ["reschedule-a-shoot"],
      inputTokens: 900,
      outputTokens: 40,
      ...over,
    }),
  );
}

describe("the retrieval gate", () => {
  it("refuses without calling a model when nothing matches", async () => {
    const callModel = replies();
    const result = await answerHelpQuestion("write me a poem about the ocean", {
      search: found([]),
      callModel,
      env: ENV,
    });
    expect(callModel).not.toHaveBeenCalled();
    expect(result.outcome.kind).toBe("declined");
    expect(result.outcome.kind === "declined" && result.outcome.reason).toBe("no_match");
    // Nothing was spent, and the log should say so.
    expect(result.outcome.inputTokens).toBe(0);
    expect(result.outcome.outputTokens).toBe(0);
    expect(result.topScore).toBeNull();
  });

  it("reports the best score, so a cut-off can be chosen from real numbers later", async () => {
    const result = await answerHelpQuestion("how do I reschedule", {
      search: found([article()], -8.5),
      callModel: replies(),
      env: ENV,
    });
    expect(result.topScore).toBe(-8.5);
  });
});

describe("the model's reply", () => {
  it("is accepted when it answers and cites an article we retrieved", async () => {
    const result = await answerHelpQuestion("how do I reschedule my shoot", {
      search: found([article()]),
      callModel: replies(),
      env: ENV,
    });
    expect(result.outcome.kind).toBe("answered");
    if (result.outcome.kind !== "answered") {
      return;
    }
    expect(result.outcome.answer).toBe("Call the office and we will move it.");
    expect(result.outcome.articles.map((a) => a.slug)).toEqual(["reschedule-a-shoot"]);
    expect(result.slugs).toEqual(["reschedule-a-shoot"]);
    expect(result.outcome.inputTokens).toBe(900);
  });

  it("is discarded when it cites an article retrieval never offered", async () => {
    // The citation is the proof it used our corpus rather than its training.
    const result = await answerHelpQuestion("how do I reschedule", {
      search: found([article()]),
      callModel: replies({ articleSlugs: ["some-article-we-do-not-have"] }),
      env: ENV,
    });
    expect(result.outcome.kind).toBe("declined");
    expect(result.outcome.kind === "declined" && result.outcome.reason).toBe(
      "no_answer_in_articles",
    );
  });

  it("is discarded when it cites nothing at all", async () => {
    const result = await answerHelpQuestion("how do I reschedule", {
      search: found([article()]),
      callModel: replies({ articleSlugs: [] }),
      env: ENV,
    });
    expect(result.outcome.kind).toBe("declined");
  });

  it("is honoured when it says the articles do not answer the question", async () => {
    const result = await answerHelpQuestion("what does a twilight shoot cost", {
      search: found([article()]),
      callModel: replies({ answered: false, answer: "" }),
      env: ENV,
    });
    expect(result.outcome.kind).toBe("declined");
    expect(result.outcome.kind === "declined" && result.outcome.reason).toBe(
      "no_answer_in_articles",
    );
    // The tokens it cost are still recorded.
    expect(result.outcome.inputTokens).toBe(900);
  });

  it("is discarded when it claims an answer but writes nothing", async () => {
    const result = await answerHelpQuestion("how do I reschedule", {
      search: found([article()]),
      callModel: replies({ answer: "   " }),
      env: ENV,
    });
    expect(result.outcome.kind).toBe("declined");
  });

  it("still offers the articles retrieval found when it declines", async () => {
    const result = await answerHelpQuestion("what does a twilight shoot cost", {
      search: found([article()]),
      callModel: replies({ answered: false, answer: "" }),
      env: ENV,
    });
    expect(result.outcome.articles.map((a) => a.slug)).toEqual(["reschedule-a-shoot"]);
  });
});

describe("when the call fails", () => {
  it("declines as broken rather than as a gap in the knowledge base", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await answerHelpQuestion("how do I reschedule", {
      search: found([article()]),
      callModel: () => Promise.reject(new Error("503 upstream")),
      env: ENV,
    });
    expect(result.outcome.kind === "declined" && result.outcome.reason).toBe("model_error");
    vi.restoreAllMocks();
  });

  it("declines as not configured when there is no key, without calling anything", async () => {
    const callModel = replies();
    const result = await answerHelpQuestion("how do I reschedule", {
      search: found([article()]),
      callModel,
      env: {} as NodeJS.ProcessEnv,
    });
    expect(callModel).not.toHaveBeenCalled();
    expect(result.outcome.kind === "declined" && result.outcome.reason).toBe("not_configured");
  });
});

describe("what the model is shown", () => {
  it("puts the articles first and the question last, inside a delimiter", async () => {
    const content = buildUserContent("how do I reschedule?", [article()]);
    expect(content.indexOf("Help articles:")).toBeLessThan(content.indexOf("Question:"));
    expect(content).toContain('<article slug="reschedule-a-shoot">');
    expect(content).toContain("<question>\nhow do I reschedule?\n</question>");
    // Everything it is meant to obey is established before it reads the
    // client's words.
    expect(content.trimEnd().endsWith("</question>")).toBe(true);
  });

  it("truncates a long body rather than letting one article set the bill", async () => {
    const content = buildUserContent("q", [article({ bodyMd: "x".repeat(50_000) })]);
    expect(content.length).toBeLessThan(6_000);
  });

  it("carries the question through to the call verbatim", async () => {
    const callModel = replies();
    await answerHelpQuestion("  how do I reschedule?  ", {
      search: found([article()]),
      callModel,
      env: ENV,
    });
    const sent = callModel.mock.calls[0]?.[0] as { userContent: string; system: string };
    expect(sent.userContent).toContain("how do I reschedule?");
    expect(sent.system).toContain("only from the article excerpts");
  });

  it("caps an over-long question before it reaches the model", async () => {
    const callModel = replies();
    await answerHelpQuestion("reschedule ".repeat(500), {
      search: found([article()]),
      callModel,
      env: ENV,
    });
    const sent = callModel.mock.calls[0]?.[0] as { userContent: string };
    const asked = sent.userContent.split("<question>")[1]?.split("</question>")[0]?.trim() ?? "";
    expect(asked.length).toBeLessThanOrEqual(500);
  });
});
