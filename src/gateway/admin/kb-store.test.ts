import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-kb-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./kb-store.js");

/** One DB is shared by the whole file, so each test starts from a clean shelf. */
async function reset(): Promise<void> {
  for (const article of await store.listArticles()) {
    await store.deleteArticle(article.id);
  }
  for (const category of await store.listCategories()) {
    await store.deleteCategory(category.id);
  }
}

beforeEach(reset);

describe("slugify", () => {
  it("makes a URL segment out of a title", () => {
    expect(store.slugify("Reschedule a Shoot")).toBe("reschedule-a-shoot");
  });

  it("folds accents rather than dropping the letters", () => {
    expect(store.slugify("Cómo réservar")).toBe("como-reservar");
  });

  it("collapses punctuation runs and trims the edges", () => {
    expect(store.slugify("  What's new?! (2026)  ")).toBe("what-s-new-2026");
  });

  it("survives a title with nothing sluggable in it", () => {
    expect(store.slugify("!!!")).toBe("");
  });
});

describe("categories", () => {
  it("suffixes a colliding slug instead of failing the unique index", async () => {
    const first = await store.createCategory({ title: "Billing" });
    const second = await store.createCategory({ title: "Billing" });
    expect(first.slug).toBe("billing");
    expect(second.slug).toBe("billing-2");
  });

  it("keeps the slug when the title changes, so a live URL stays live", async () => {
    const created = await store.createCategory({ title: "Billing" });
    const renamed = await store.updateCategory(created.id, { title: "Billing & Payments" });
    expect(renamed?.title).toBe("Billing & Payments");
    expect(renamed?.slug).toBe("billing");
  });

  it("moves the address only when asked explicitly", async () => {
    const created = await store.createCategory({ title: "Billing" });
    const moved = await store.updateCategory(created.id, { slug: "Payments & Invoices" });
    expect(moved?.slug).toBe("payments-invoices");
  });

  it("counts only published articles, so an empty shelf reads as empty", async () => {
    const category = await store.createCategory({ title: "Scheduling" });
    await store.createArticle({ title: "Live one", categoryId: category.id, status: "published" });
    await store.createArticle({ title: "Draft one", categoryId: category.id });
    const [listed] = await store.listCategoriesWithCounts();
    expect(listed?.articleCount).toBe(1);
  });

  it("unfiles its articles when deleted rather than taking them along", async () => {
    const category = await store.createCategory({ title: "Doomed" });
    const article = await store.createArticle({ title: "Survivor", categoryId: category.id });
    await store.deleteCategory(category.id);
    const after = await store.getArticle(article.id);
    expect(after?.categoryId).toBeNull();
    expect(await store.listArticles({ categoryId: null })).toHaveLength(1);
  });

  it("reorders to the given sequence and parks unnamed ids after it", async () => {
    const a = await store.createCategory({ title: "Alpha" });
    const b = await store.createCategory({ title: "Bravo" });
    const c = await store.createCategory({ title: "Charlie" });
    // 'c' is left out of the request: it should follow, not jump the queue.
    const ordered = await store.reorderCategories([b.id, a.id]);
    expect(ordered.map((x) => x.title)).toEqual(["Bravo", "Alpha", "Charlie"]);
    expect(ordered.map((x) => x.sortOrder)).toEqual([0, 1, 2]);
    expect(c.id).toBe(ordered[2]?.id);
  });

  it("ignores ids that are not categories", async () => {
    const a = await store.createCategory({ title: "Alpha" });
    const ordered = await store.reorderCategories(["not-an-id", a.id, a.id]);
    expect(ordered.map((x) => x.title)).toEqual(["Alpha"]);
  });
});

describe("articles", () => {
  it("starts as a draft so nothing reaches a client by accident", async () => {
    const article = await store.createArticle({ title: "Half written" });
    expect(article.status).toBe("draft");
    expect(article.publishedAt).toBeNull();
  });

  it("records who published it and when", async () => {
    const article = await store.createArticle({ title: "Ready" });
    const published = await store.publishArticle(article.id, "steve@wowvideotours.com");
    expect(published?.status).toBe("published");
    expect(published?.publishedBy).toBe("steve@wowvideotours.com");
    expect(published?.publishedAt).toBeGreaterThan(0);
  });

  it("keeps the first-published stamp when it goes back to a draft", async () => {
    const article = await store.createArticle({ title: "Pulled back" });
    const published = await store.publishArticle(article.id, "steve@wowvideotours.com");
    const pulled = await store.unpublishArticle(article.id);
    expect(pulled?.status).toBe("draft");
    expect(pulled?.publishedAt).toBe(published?.publishedAt);
  });

  it("keeps its address when it is refiled", async () => {
    const from = await store.createCategory({ title: "Old home" });
    const to = await store.createCategory({ title: "New home" });
    const article = await store.createArticle({ title: "Portable", categoryId: from.id });
    const moved = await store.updateArticle(article.id, { categoryId: to.id });
    expect(moved?.categoryId).toBe(to.id);
    expect(moved?.slug).toBe(article.slug);
    expect(await store.getArticleBySlug(article.slug)).not.toBeNull();
  });

  it("returns null for an update to something that is gone", async () => {
    expect(await store.updateArticle("missing", { title: "Nope" })).toBeNull();
  });

  it("refuses to blank a title", async () => {
    const article = await store.createArticle({ title: "Named" });
    await expect(store.updateArticle(article.id, { title: "   " })).rejects.toThrow(/title/);
  });

  it("orders within one category and leaves the other alone", async () => {
    const one = await store.createCategory({ title: "One" });
    const two = await store.createCategory({ title: "Two" });
    const a = await store.createArticle({ title: "A", categoryId: one.id });
    const b = await store.createArticle({ title: "B", categoryId: one.id });
    const outsider = await store.createArticle({ title: "C", categoryId: two.id });
    const ordered = await store.reorderArticles(one.id, [b.id, a.id, outsider.id]);
    expect(ordered.map((x) => x.title)).toEqual(["B", "A"]);
    expect(ordered.map((x) => x.sortOrder)).toEqual([0, 1]);
    // A new article takes the next sort_order across the whole base, so the
    // outsider sits at 2; reordering one category must not renumber it.
    expect((await store.getArticle(outsider.id))?.sortOrder).toBe(outsider.sortOrder);
  });
});

describe("toMatchQuery", () => {
  it("quotes each term and lets the last one still be half-typed", () => {
    expect(store.toMatchQuery("reschedule shoot")).toBe('"reschedule" AND "shoot"*');
  });

  it("strips the punctuation FTS5 would read as syntax", () => {
    // A bare AND / OR / NEAR or a stray quote is a syntax error, not a search.
    expect(store.toMatchQuery('agent\'s "photos" AND')).toBe(
      '"agent" AND "s" AND "photos" AND "and"*',
    );
  });

  it("says nothing is searchable rather than matching everything", () => {
    expect(store.toMatchQuery("   ")).toBeNull();
    expect(store.toMatchQuery("*")).toBeNull();
  });
});

describe("searchArticles", () => {
  it("finds a published article by its body and ranks the title match first", async () => {
    await store.createArticle({
      title: "Uploading photos",
      bodyMd: "Mentions reschedules only in passing.",
      status: "published",
    });
    await store.createArticle({
      title: "Reschedule a shoot",
      bodyMd: "How to move an appointment.",
      status: "published",
    });
    const hits = await store.searchArticles("reschedule");
    expect(hits.map((h) => h.title)).toEqual(["Reschedule a shoot", "Uploading photos"]);
  });

  it("matches a prefix so results appear mid-word", async () => {
    await store.createArticle({ title: "Reschedule a shoot", status: "published" });
    expect(await store.searchArticles("resched")).toHaveLength(1);
  });

  it("prefixes literally rather than stemming", async () => {
    // "reschedule" is not a prefix of "rescheduling" — the words diverge at the
    // 10th letter. Search is a prefix match, not a stemmer; typing less finds more.
    await store.createArticle({ title: "Rescheduling a shoot", status: "published" });
    expect(await store.searchArticles("reschedule")).toHaveLength(0);
    expect(await store.searchArticles("reschedul")).toHaveLength(1);
  });

  it("never surfaces a draft to a public search", async () => {
    await store.createArticle({ title: "Secret roadmap", bodyMd: "unreleased" });
    expect(await store.searchArticles("roadmap")).toHaveLength(0);
    expect(await store.searchArticles("roadmap", { includeDrafts: true })).toHaveLength(1);
  });

  it("returns nothing for a query with no searchable characters", async () => {
    await store.createArticle({ title: "Anything", status: "published" });
    expect(await store.searchArticles("!!!")).toEqual([]);
  });

  it("does not choke on a quote or an operator word in the query", async () => {
    await store.createArticle({ title: "Agent photos", status: "published" });
    await expect(store.searchArticles('agent\'s "photos" OR')).resolves.toBeInstanceOf(Array);
  });

  // The next three pin the external-content FTS triggers: the index holds no
  // copy of the row, so a missed trigger shows up as a stale or ghost result.
  it("follows an edited title", async () => {
    const article = await store.createArticle({ title: "Old title", status: "published" });
    await store.updateArticle(article.id, { title: "Brand new heading" });
    expect(await store.searchArticles("brand")).toHaveLength(1);
    expect(await store.searchArticles("old")).toHaveLength(0);
  });

  it("follows an edited body", async () => {
    const article = await store.createArticle({
      title: "Steady",
      bodyMd: "aardvark",
      status: "published",
    });
    await store.updateArticle(article.id, { bodyMd: "bandicoot" });
    expect(await store.searchArticles("bandicoot")).toHaveLength(1);
    expect(await store.searchArticles("aardvark")).toHaveLength(0);
  });

  it("stops matching once the article is deleted", async () => {
    const article = await store.createArticle({ title: "Transient", status: "published" });
    await store.deleteArticle(article.id);
    expect(await store.searchArticles("transient")).toHaveLength(0);
  });

  it("caps how much one query can return", async () => {
    for (let i = 0; i < 5; i += 1) {
      await store.createArticle({ title: `Capped ${i}`, status: "published" });
    }
    expect(await store.searchArticles("capped", { limit: 2 })).toHaveLength(2);
  });
});

describe("searching from a question", () => {
  // The search box and the answering box need different queries over the same
  // index. Search joins terms with AND, because every word you type should
  // narrow the results. A question is mostly grammar, and under AND would find
  // nothing at all — so the grammar is dropped and the rest is ORed.

  it("drops the grammar and keeps the subject", () => {
    expect(store.toQuestionMatchQuery("How do I get my photos?")).toBe('"photos"*');
    expect(store.toQuestionMatchQuery("where is the floor plan")).toBe('"floor"* OR "plan"*');
  });

  it("returns nothing for a question with no subject in it", () => {
    // The first gate on the answering path: no content words, no retrieval, and
    // therefore no model call.
    expect(store.toQuestionMatchQuery("how do I")).toBeNull();
    expect(store.toQuestionMatchQuery("???")).toBeNull();
    expect(store.toQuestionMatchQuery("what is it")).toBeNull();
  });

  it("does not let a pasted essay become a hundred-clause MATCH", () => {
    const query = store.toQuestionMatchQuery(
      Array.from({ length: 200 }, (_, i) => `word${i}`).join(" "),
    );
    expect(query?.split(" OR ")).toHaveLength(12);
  });

  it("counts a repeated word once", () => {
    expect(store.toQuestionMatchQuery("photos photos photos")).toBe('"photos"*');
  });

  it("finds an article a whole question is about", async () => {
    const article = await store.createArticle({
      title: "Reschedule a shoot",
      bodyMd: "Call the office to move an appointment.",
      status: "published",
    });
    const hits = await store.searchArticlesForQuestion("how do I reschedule my shoot?");
    expect(hits.map((h) => h.article.id)).toContain(article.id);
    // bm25 is more negative for a better match, so a hit always scores below 0.
    expect(hits[0].score).toBeLessThan(0);
  });

  it("finds nothing for a question about something we have not written about", async () => {
    await store.createArticle({
      title: "Reschedule a shoot",
      bodyMd: "Call the office.",
      status: "published",
    });
    expect(await store.searchArticlesForQuestion("write me a poem about the ocean")).toEqual([]);
  });

  it("never offers a draft, which is what keeps unpublished work out of an answer", async () => {
    await store.createArticle({
      title: "Zebra pricing",
      bodyMd: "Zebra shoots cost a lot.",
      status: "draft",
    });
    expect(await store.searchArticlesForQuestion("what does a zebra shoot cost")).toEqual([]);
  });
});
