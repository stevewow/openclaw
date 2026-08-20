import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// The search log exists to answer three questions that look alike and are not:
// which articles are missing, which are mis-titled, and what the help center is
// for. The grouping and the split between those three are what is pinned here.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-kb-searchlog-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./kb-search-store.js");
const kb = await import("./kb-store.js");
const { getAdminDb } = await import("./user-store.js");

const DAY = 24 * 60 * 60 * 1000;

/** A real article id: clicked_article_id carries a live foreign key. */
let articleId: string;
let otherArticleId: string;

beforeAll(async () => {
  articleId = (await kb.createArticle({ title: "Reschedule a shoot", bodyMd: "Call us." })).id;
  otherArticleId = (await kb.createArticle({ title: "Cancel a shoot", bodyMd: "Call us." })).id;
});

beforeEach(async () => {
  await getAdminDb().deleteFrom("admin_kb_searches").execute();
});

describe("searchKey", () => {
  it("folds case, punctuation and spacing so one term is one row", () => {
    expect(store.searchKey("Floor Plans")).toBe("floor plans");
    expect(store.searchKey("  floor   plan?  ")).toBe("floor plan");
    expect(store.searchKey("Floor-Plans")).toBe("floor plans");
  });

  it("folds accents the way article slugs do", () => {
    expect(store.searchKey("Résumé")).toBe("resume");
  });

  it("is empty for a query with nothing in it to group on", () => {
    expect(store.searchKey("   ")).toBe("");
    expect(store.searchKey("???")).toBe("");
  });

  it("does not stem, so a plural stays its own term", () => {
    // Deliberate. Folding "floor plan" into "floor plans" would need a stemmer,
    // and a stemmer that is wrong merges two real questions into one row and
    // hides whichever was asked less. Near-identical terms next to each other
    // on the report cost a second of reading; a bad merge costs an article.
    expect(store.searchKey("floor plan")).not.toBe(store.searchKey("floor plans"));
  });
});

describe("recordKbSearch", () => {
  it("returns an id for a real query and null for an empty one", async () => {
    expect(await store.recordKbSearch({ query: "floor plan", resultCount: 0 })).toBeTruthy();
    expect(await store.recordKbSearch({ query: "  ", resultCount: 0 })).toBeNull();
    expect(await store.recordKbSearch({ query: "!!!", resultCount: 0 })).toBeNull();
  });

  it("records nothing identifying — only the query, its count and the time", async () => {
    await store.recordKbSearch({ query: "twilight photos", resultCount: 2 });
    const rows = await getAdminDb().selectFrom("admin_kb_searches").selectAll().execute();
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).toSorted()).toEqual([
      "clicked_article_id",
      "clicked_at",
      "created_at",
      "id",
      "query",
      "query_key",
      "result_count",
    ]);
  });

  it("caps the stored query so no one can log an essay", async () => {
    await store.recordKbSearch({ query: "x".repeat(5_000), resultCount: 0 });
    const row = await getAdminDb()
      .selectFrom("admin_kb_searches")
      .select("query")
      .executeTakeFirstOrThrow();
    expect(row.query.length).toBe(200);
  });
});

describe("recordKbSearchClick", () => {
  it("stamps the search that led to the article", async () => {
    const id = (await store.recordKbSearch({ query: "reschedule", resultCount: 3 }))!;
    await store.recordKbSearchClick(id, articleId, 5_000);
    const row = await getAdminDb()
      .selectFrom("admin_kb_searches")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row.clicked_article_id).toBe(articleId);
    expect(row.clicked_at).toBe(5_000);
  });

  it("keeps the first open only, so a forwarded link cannot inflate a term", async () => {
    const id = (await store.recordKbSearch({ query: "reschedule", resultCount: 3 }))!;
    await store.recordKbSearchClick(id, articleId, 5_000);
    await store.recordKbSearchClick(id, otherArticleId, 9_000);
    const row = await getAdminDb()
      .selectFrom("admin_kb_searches")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row.clicked_article_id).toBe(articleId);
    expect(row.clicked_at).toBe(5_000);
  });

  it("does nothing for an id that names no search", async () => {
    await expect(store.recordKbSearchClick("no-such-search", articleId)).resolves.toBeUndefined();
  });
});

describe("summarizeKbSearches", () => {
  it("splits gaps from mis-titled articles from sheer volume", async () => {
    // Asked four times, never matched: the article does not exist.
    for (const spelling of ["Drone photos", "drone-photos", "drone  photos", "DRONE PHOTOS"]) {
      await store.recordKbSearch({ query: spelling, resultCount: 0 });
    }
    // Matched twice, opened never: the article is there under another name.
    await store.recordKbSearch({ query: "invoice", resultCount: 2 });
    await store.recordKbSearch({ query: "Invoice", resultCount: 2 });
    // Matched and opened: working as intended.
    const answered = (await store.recordKbSearch({ query: "reschedule", resultCount: 1 }))!;
    await store.recordKbSearchClick(answered, articleId);

    const summary = await store.summarizeKbSearches();

    expect(summary.totalSearches).toBe(7);
    expect(summary.zeroResultSearches).toBe(4);
    expect(summary.clickedSearches).toBe(1);

    expect(summary.gaps.map((g) => g.queryKey)).toEqual(["drone photos"]);
    expect(summary.gaps[0].searches).toBe(4);
    // The most recent spelling, not an arbitrary one.
    expect(summary.gaps[0].query).toBe("DRONE PHOTOS");

    expect(summary.unhelpful.map((g) => g.queryKey)).toEqual(["invoice"]);
    expect(summary.unhelpful[0].searches).toBe(2);

    // "reschedule" was answered, so it is neither a gap nor unhelpful.
    expect(summary.top.map((g) => g.queryKey)).toEqual(["drone photos", "invoice", "reschedule"]);
  });

  it("drops a term from the gaps once an article starts matching it", async () => {
    await store.recordKbSearch({ query: "twilight", resultCount: 0 });
    let summary = await store.summarizeKbSearches();
    expect(summary.gaps.map((g) => g.queryKey)).toEqual(["twilight"]);

    // The article gets written; the next search finds it.
    await store.recordKbSearch({ query: "twilight", resultCount: 1 });
    summary = await store.summarizeKbSearches();
    expect(summary.gaps).toEqual([]);
    // It is not a gap any more, but nobody has opened it either.
    expect(summary.unhelpful.map((g) => g.queryKey)).toEqual(["twilight"]);
  });

  it("only counts searches inside the window", async () => {
    const now = Date.now();
    await store.recordKbSearch({ query: "old question", resultCount: 0, at: now - 60 * DAY });
    await store.recordKbSearch({ query: "new question", resultCount: 0, at: now - 2 * DAY });

    const month = await store.summarizeKbSearches({ days: 30 });
    expect(month.totalSearches).toBe(1);
    expect(month.gaps.map((g) => g.queryKey)).toEqual(["new question"]);

    const year = await store.summarizeKbSearches({ days: 365 });
    expect(year.totalSearches).toBe(2);
  });

  it("reports an empty period without inventing rows", async () => {
    const summary = await store.summarizeKbSearches();
    expect(summary.totalSearches).toBe(0);
    expect(summary.gaps).toEqual([]);
    expect(summary.unhelpful).toEqual([]);
    expect(summary.top).toEqual([]);
  });
});

describe("a deleted article", () => {
  it("leaves the search that found it on the report", async () => {
    const article = await kb.createArticle({ title: "Going away", bodyMd: "..." });
    const id = (await store.recordKbSearch({ query: "going away", resultCount: 1 }))!;
    await store.recordKbSearchClick(id, article.id);

    await kb.deleteArticle(article.id);

    const summary = await store.summarizeKbSearches();
    expect(summary.totalSearches).toBe(1);
    // The click is nulled with the article, so the term reads as one nobody
    // opened — which, with the article gone, it now is.
    expect(summary.unhelpful.map((g) => g.queryKey)).toEqual(["going away"]);
  });
});
