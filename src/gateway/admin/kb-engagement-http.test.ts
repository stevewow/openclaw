import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// The public write endpoints — liking an article, voting it helpful, and the
// comment left with the vote — against a real server.
//
// These are the first writes the help center accepts from an unauthenticated
// client that are not a page being read, so the file is mostly about what they
// refuse: an unpublished article, an article that does not exist, a body that
// is not one, and a client pressing faster than a person can.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-kb-engagement-http-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleKbPublicRequest } = await import("./kb-public-http.js");
const store = await import("./kb-store.js");
const engagement = await import("./kb-engagement-store.js");
const limits = await import("./kb-engagement-limits.js");
const { getAdminDb } = await import("./user-store.js");

let server: Server;
let baseUrl: string;
let publishedId = "";

async function post(
  p: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${p}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { status: res.status, data };
}

beforeAll(async () => {
  const live = await store.createArticle({
    title: "Where are my photos",
    bodyMd: "Check the delivery email.",
  });
  await store.publishArticle(live.id, "steve");
  publishedId = live.id;

  await store.createArticle({ title: "Secret roadmap", bodyMd: "Unreleased plans." });

  // The index only offers its shortcut lists once there are enough articles for
  // them to be a shortcut rather than the page beneath them written twice.
  for (const title of ["Alpha guide", "Bravo guide", "Charlie guide", "Delta guide"]) {
    const filler = await store.createArticle({ title, bodyMd: "Body." });
    await store.publishArticle(filler.id, "steve");
  }

  server = createServer((req, res) => {
    void (async () => {
      const handled = await handleKbPublicRequest(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end("not found");
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  // The limiter is module state shared by every case in the file.
  limits.resetEngagementLimits();
  await getAdminDb().deleteFrom("admin_kb_article_stats").execute();
  await getAdminDb().deleteFrom("admin_kb_article_notes").execute();
});

describe("POST /help/like", () => {
  it("counts a like and answers with the running total", async () => {
    expect(await post("/help/like", { slug: "where-are-my-photos", on: true })).toMatchObject({
      status: 200,
      data: { ok: true, likes: 1 },
    });
    expect(await post("/help/like", { slug: "where-are-my-photos", on: true })).toMatchObject({
      data: { likes: 2 },
    });
  });

  it("takes a like back", async () => {
    await post("/help/like", { slug: "where-are-my-photos", on: true });
    expect(await post("/help/like", { slug: "where-are-my-photos", on: false })).toMatchObject({
      data: { likes: 0 },
    });
  });

  /**
   * A draft answers exactly as a typo does. Anything else would turn these
   * endpoints into a way of asking "does this unpublished article exist?" —
   * the question the reader's 404 page is carefully built not to answer.
   */
  it("refuses a draft with the same answer as a slug that names nothing", async () => {
    const draft = await post("/help/like", { slug: "secret-roadmap", on: true });
    const missing = await post("/help/like", { slug: "no-such-article", on: true });
    expect(draft.status).toBe(404);
    expect(draft).toEqual(missing);
    expect((await engagement.listArticleStats()).size).toBe(0);
  });

  it("refuses a body with no slug in it", async () => {
    expect((await post("/help/like", { on: true })).status).toBe(400);
    expect((await post("/help/like", "not json")).status).toBe(400);
  });

  it("is not reachable by GET", async () => {
    const res = await fetch(`${baseUrl}/help/like`);
    expect(res.status).toBe(404);
  });
});

describe("POST /help/helpful", () => {
  it("counts a vote each way", async () => {
    await post("/help/helpful", { slug: "where-are-my-photos", helpful: true });
    await post("/help/helpful", { slug: "where-are-my-photos", helpful: false });
    expect(await engagement.getArticleStats(publishedId)).toMatchObject({
      helpfulYes: 1,
      helpfulNo: 1,
    });
  });

  /** A missing `helpful` is a no, not a yes: the generous reading of an
   * ambiguous vote is the one that does not inflate the good news. */
  it("treats an absent verdict as a no", async () => {
    await post("/help/helpful", { slug: "where-are-my-photos" });
    expect(await engagement.getArticleStats(publishedId)).toMatchObject({
      helpfulYes: 0,
      helpfulNo: 1,
    });
  });

  it("stores no note of its own", async () => {
    await post("/help/helpful", { slug: "where-are-my-photos", helpful: false });
    expect(await engagement.listArticleNotes()).toHaveLength(0);
  });
});

describe("POST /help/helpful/note", () => {
  it("stores the comment without counting the vote again", async () => {
    await post("/help/helpful", { slug: "where-are-my-photos", helpful: false });
    const res = await post("/help/helpful/note", {
      slug: "where-are-my-photos",
      helpful: false,
      note: "It never says where the download link is.",
    });
    expect(res).toMatchObject({ status: 200, data: { ok: true } });
    expect(await engagement.getArticleStats(publishedId)).toMatchObject({ helpfulNo: 1 });
    expect((await engagement.listArticleNotes())[0]).toMatchObject({
      helpful: false,
      note: "It never says where the download link is.",
      articleTitle: "Where are my photos",
    });
  });

  /**
   * The note route sits underneath the vote route's path. If the dispatcher
   * ever matched on a prefix rather than exactly, one of them would silently
   * get the other's handler — and the one that counts votes is the one that
   * would start counting them twice.
   */
  it("is not handled as a vote despite sitting under the vote's path", async () => {
    await post("/help/helpful/note", {
      slug: "where-are-my-photos",
      helpful: true,
      note: "Clear enough.",
    });
    expect(await engagement.getArticleStats(publishedId)).toMatchObject({
      helpfulYes: 0,
      helpfulNo: 0,
    });
    expect(await engagement.listArticleNotes()).toHaveLength(1);
  });

  it("refuses an empty comment rather than storing a blank row", async () => {
    const res = await post("/help/helpful/note", {
      slug: "where-are-my-photos",
      helpful: true,
      note: "   ",
    });
    expect(res.status).toBe(400);
    expect(await engagement.listArticleNotes()).toHaveLength(0);
  });
});

describe("rate limiting", () => {
  /**
   * The limit is per client and held in memory only — there is no table of
   * addresses here, deliberately. A forged header beats it, which is why the
   * worst outcome of doing so is a wrong number on a staff report.
   */
  it("stops a client pressing faster than a person could", async () => {
    const client = { "x-forwarded-for": "203.0.113.7" };
    const codes: number[] = [];
    for (let i = 0; i < 14; i += 1) {
      codes.push(
        (await post("/help/like", { slug: "where-are-my-photos", on: true }, client)).status,
      );
    }
    expect(codes.filter((c) => c === 200)).toHaveLength(10);
    expect(codes.filter((c) => c === 429)).toHaveLength(4);
  });

  it("does not hold one client's presses against another", async () => {
    for (let i = 0; i < 12; i += 1) {
      await post(
        "/help/like",
        { slug: "where-are-my-photos", on: true },
        { "x-forwarded-for": "203.0.113.7" },
      );
    }
    const other = await post(
      "/help/like",
      { slug: "where-are-my-photos", on: true },
      { "x-forwarded-for": "198.51.100.4" },
    );
    expect(other.status).toBe(200);
  });
});

describe("GET /help/suggest", () => {
  it("answers with matching articles as JSON", async () => {
    const res = await fetch(`${baseUrl}/help/suggest?q=photos`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { articles: Array<{ title: string; url: string }> };
    expect(data.articles).toEqual([
      { title: "Where are my photos", summary: null, url: "/help/where-are-my-photos" },
    ]);
  });

  it("offers nothing for a single letter", async () => {
    const res = await fetch(`${baseUrl}/help/suggest?q=p`);
    const data = (await res.json()) as { articles: unknown[] };
    expect(data.articles).toEqual([]);
  });

  it("never offers a draft", async () => {
    const res = await fetch(`${baseUrl}/help/suggest?q=roadmap`);
    const data = (await res.json()) as { articles: unknown[] };
    expect(data.articles).toEqual([]);
  });

  /**
   * Typing is not searching. A suggestion endpoint that logged would fill the
   * gap report with the prefixes of words — "p", "ph", "pho" — and bury the
   * questions somebody actually chose to ask underneath them.
   */
  it("logs nothing, however much is typed into it", async () => {
    for (const q of ["ph", "pho", "phot", "photos", "zzznothing"]) {
      await fetch(`${baseUrl}/help/suggest?q=${q}`);
    }
    const logged = await getAdminDb().selectFrom("admin_kb_searches").selectAll().execute();
    expect(logged).toHaveLength(0);
  });
});

describe("read counts", () => {
  it("counts an article page load", async () => {
    await fetch(`${baseUrl}/help/where-are-my-photos`);
    expect((await engagement.getArticleStats(publishedId)).views).toBe(1);
  });

  it("does not count a HEAD, which is a prefetcher rather than a reader", async () => {
    await fetch(`${baseUrl}/help/where-are-my-photos`, { method: "HEAD" });
    expect((await engagement.getArticleStats(publishedId)).views).toBe(0);
  });

  it("does not count a self-declared crawler", async () => {
    await fetch(`${baseUrl}/help/where-are-my-photos`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    expect((await engagement.getArticleStats(publishedId)).views).toBe(0);
  });

  it("counts nothing for a draft or a typo", async () => {
    await fetch(`${baseUrl}/help/secret-roadmap`);
    await fetch(`${baseUrl}/help/no-such-article`);
    expect((await engagement.listArticleStats()).size).toBe(0);
  });
});

describe("the index shortcuts", () => {
  it("ranks the most-read article first, and leaves unread ones out", async () => {
    for (let i = 0; i < 3; i += 1) {
      await fetch(`${baseUrl}/help/alpha-guide`);
    }
    await fetch(`${baseUrl}/help/bravo-guide`);

    const body = await (await fetch(`${baseUrl}/help`)).text();
    const popular = body.slice(body.indexOf("Most read"), body.indexOf("Recently updated"));
    expect(popular.indexOf("Alpha guide")).toBeGreaterThan(-1);
    expect(popular.indexOf("Alpha guide")).toBeLessThan(popular.indexOf("Bravo guide"));
    // Never opened, so it is not in the most-read list at all.
    expect(popular).not.toContain("Charlie guide");
  });

  it("offers what changed lately, marked as new", async () => {
    const body = await (await fetch(`${baseUrl}/help`)).text();
    expect(body).toContain("Recently updated");
    expect(body).toContain('<span class="hc-new">');
  });

  it("never puts a draft in either list", async () => {
    const body = await (await fetch(`${baseUrl}/help`)).text();
    expect(body).not.toContain("Secret roadmap");
  });
});
