import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// Reads, likes and helpful votes. The counters are trivial arithmetic; what is
// worth pinning is the arithmetic that is NOT trivial — a like taken back that
// was never counted, and a note surviving the article it was left on.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-kb-engagement-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const engagement = await import("./kb-engagement-store.js");
const store = await import("./kb-store.js");
const { getAdminDb } = await import("./user-store.js");

let articleId = "";

/**
 * One DB is shared by the whole file, so each test starts from a clean shelf.
 *
 * Notes are cleared explicitly: deleting an article deliberately does NOT take
 * its notes with it, so leaving that to the article sweep would carry every
 * case's comments into the next one.
 */
beforeEach(async () => {
  for (const article of await store.listArticles()) {
    await store.deleteArticle(article.id);
  }
  await getAdminDb().deleteFrom("admin_kb_article_notes").execute();
  const article = await store.createArticle({ title: "Where are my photos", bodyMd: "Look here." });
  await store.publishArticle(article.id, "steve");
  articleId = article.id;
});

describe("views", () => {
  it("starts an article at zero without a row of its own", async () => {
    const stats = await engagement.getArticleStats(articleId);
    expect(stats).toMatchObject({ views: 0, likes: 0, helpfulYes: 0, helpfulNo: 0 });
  });

  it("counts up, creating the row on the first read", async () => {
    await engagement.recordArticleView(articleId);
    await engagement.recordArticleView(articleId);
    await engagement.recordArticleView(articleId);
    expect((await engagement.getArticleStats(articleId)).views).toBe(3);
  });

  it("leaves an unread article out of the stats map rather than at zero", async () => {
    const stats = await engagement.listArticleStats();
    expect(stats.has(articleId)).toBe(false);
    await engagement.recordArticleView(articleId);
    expect((await engagement.listArticleStats()).get(articleId)?.views).toBe(1);
  });
});

describe("likes", () => {
  it("returns the total after the press, not the caller's guess at it", async () => {
    expect(await engagement.likeArticle(articleId, true)).toBe(1);
    expect(await engagement.likeArticle(articleId, true)).toBe(2);
    expect(await engagement.likeArticle(articleId, false)).toBe(1);
  });

  /**
   * A browser can hold a "you liked this" flag whose like was never counted —
   * cleared by hand, lost to a failed write, restored from a backup. Taking it
   * back must not push the total below zero and show the next visitor a
   * negative number of likes.
   */
  it("floors at zero when an unlike arrives without its like", async () => {
    expect(await engagement.likeArticle(articleId, false)).toBe(0);
    expect(await engagement.likeArticle(articleId, false)).toBe(0);
    expect(await engagement.likeArticle(articleId, true)).toBe(1);
  });

  it("does not disturb the other counters", async () => {
    await engagement.recordArticleView(articleId);
    await engagement.likeArticle(articleId, true);
    expect(await engagement.getArticleStats(articleId)).toMatchObject({ views: 1, likes: 1 });
  });
});

describe("helpful votes", () => {
  it("counts yes and no apart", async () => {
    await engagement.recordHelpfulVote({ articleId, articleTitle: "T", helpful: true });
    await engagement.recordHelpfulVote({ articleId, articleTitle: "T", helpful: false });
    await engagement.recordHelpfulVote({ articleId, articleTitle: "T", helpful: false });
    expect(await engagement.getArticleStats(articleId)).toMatchObject({
      helpfulYes: 1,
      helpfulNo: 2,
    });
  });

  /**
   * The two are separate calls because they happen at separate moments — the
   * vote on the press, the comment only if one is then written. If a note ever
   * starts moving a counter, everyone who comments votes twice.
   */
  it("records a note without counting a second vote", async () => {
    await engagement.recordHelpfulVote({ articleId, articleTitle: "T", helpful: false });
    await engagement.recordArticleNote({
      articleId,
      articleTitle: "T",
      helpful: false,
      note: "It never says where the download link is.",
    });
    expect(await engagement.getArticleStats(articleId)).toMatchObject({
      helpfulYes: 0,
      helpfulNo: 1,
    });
    const notes = await engagement.listArticleNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      helpful: false,
      note: "It never says where the download link is.",
    });
  });

  it("ignores a note that is only whitespace", async () => {
    await engagement.recordArticleNote({
      articleId,
      articleTitle: "T",
      helpful: true,
      note: "   \n  ",
    });
    expect(await engagement.listArticleNotes()).toHaveLength(0);
  });

  it("caps a note rather than refusing it", async () => {
    await engagement.recordArticleNote({
      articleId,
      articleTitle: "T",
      helpful: true,
      note: "x".repeat(engagement.MAX_NOTE + 500),
    });
    expect((await engagement.listArticleNotes())[0]?.note).toHaveLength(engagement.MAX_NOTE);
  });
});

describe("notes outliving their article", () => {
  /**
   * The whole reason the foreign key is SET NULL and the title is copied onto
   * the row: "this doesn't explain X" is at its most useful once X has been
   * rewritten, which is often the moment the old article is deleted.
   */
  it("keeps the note and the title after the article is deleted", async () => {
    await engagement.recordArticleNote({
      articleId,
      articleTitle: "Where are my photos",
      helpful: false,
      note: "Nothing about the delivery email.",
    });
    await store.deleteArticle(articleId);

    const notes = await engagement.listArticleNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      articleId: null,
      articleTitle: "Where are my photos",
      note: "Nothing about the delivery email.",
    });
  });

  /** Counts, unlike notes, name nothing once their article is gone. */
  it("drops the counters with the article", async () => {
    await engagement.recordArticleView(articleId);
    await store.deleteArticle(articleId);
    expect((await engagement.listArticleStats()).size).toBe(0);
  });
});

describe("listArticleNotes", () => {
  it("returns the newest first and honours the window", async () => {
    for (const note of ["first", "second", "third"]) {
      await engagement.recordArticleNote({ articleId, articleTitle: "T", helpful: true, note });
    }
    const all = await engagement.listArticleNotes();
    expect(all.map((n) => n.note)).toEqual(["third", "second", "first"]);
    expect(await engagement.listArticleNotes({ since: Date.now() + 1000 })).toHaveLength(0);
  });
});
