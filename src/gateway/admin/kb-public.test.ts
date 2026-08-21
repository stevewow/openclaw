import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The client-facing side of the knowledge base. Two things matter most here and
// both are pinned below: a draft must never leave the store, and an article
// body is written by staff but rendered into a stranger's browser — so raw HTML
// in it must come out as text, not as markup.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-kb-public-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleKbPublicRequest } = await import("./kb-public-http.js");
const { renderMarkdown, videoEmbedUrl } = await import("./kb-public-html.js");
const store = await import("./kb-store.js");
const { getAdminDb } = await import("./user-store.js");

let server: Server;
let baseUrl: string;

async function get(
  p: string,
  method = "GET",
): Promise<{ status: number; body: string; headers: Headers }> {
  const res = await fetch(`${baseUrl}${p}`, { method });
  return { status: res.status, body: await res.text(), headers: res.headers };
}

beforeAll(async () => {
  const scheduling = await store.createCategory({
    title: "Scheduling",
    description: "Booking and rescheduling",
  });
  await store.createCategory({ title: "Empty shelf" });

  const live = await store.createArticle({
    title: "Reschedule a shoot",
    summary: "Move an appointment",
    bodyMd: "## Steps\n\n1. Call us\n2. Pick a new time\n\n[Book now](https://example.com/book)",
    categoryId: scheduling.id,
    // Carries a video so the embed's attributes are covered by a real page.
    videoUrl: "https://www.youtube.com/watch?v=wkETgVGM0fI",
  });
  await store.publishArticle(live.id, "steve");

  const second = await store.createArticle({
    title: "Cancel a shoot",
    bodyMd: "Call the office.",
    categoryId: scheduling.id,
  });
  await store.publishArticle(second.id, "steve");

  await store.createArticle({
    title: "Secret roadmap",
    bodyMd: "Unreleased plans",
    categoryId: scheduling.id,
  });

  const unfiled = await store.createArticle({
    title: "Where are my photos",
    bodyMd: "Check the delivery email.",
  });
  await store.publishArticle(unfiled.id, "steve");

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

describe("the index", () => {
  it("lists published articles under their category", async () => {
    const res = await get("/help");
    expect(res.status).toBe(200);
    expect(res.body).toContain("Scheduling");
    expect(res.body).toContain("Reschedule a shoot");
    expect(res.body).toContain("/help/reschedule-a-shoot");
  });

  it("shows an unfiled article rather than dropping it", async () => {
    const res = await get("/help");
    expect(res.body).toContain("Where are my photos");
    expect(res.body).toContain("More help");
  });

  it("leaves out a category with nothing published in it", async () => {
    const res = await get("/help");
    expect(res.body).not.toContain("Empty shelf");
  });

  it("never mentions a draft", async () => {
    const res = await get("/help");
    expect(res.body).not.toContain("Secret roadmap");
  });

  it("takes a trailing slash as the same page", async () => {
    expect((await get("/help/")).status).toBe(200);
  });

  it("answers HEAD without a body", async () => {
    const res = await get("/help", "HEAD");
    expect(res.status).toBe(200);
    expect(res.body).toBe("");
  });
});

describe("the offer to submit a request", () => {
  // Removed from the listing pages on purpose (Steve, 2026-08-20): browsing is
  // not the moment to be pointed at the ticket form. The article page keeps its
  // "Still stuck?" line, where the reader has actually tried an answer.
  it("is gone from the index and the category pages", async () => {
    const index = await get("/help");
    expect(index.body).not.toContain("Can't find what you need?");
    expect(index.body).not.toContain("Submit a request");

    const category = await get("/help/category/scheduling");
    expect(category.body).not.toContain("Can't find what you need?");
    expect(category.body).not.toContain("Submit a request");
  });

  it("still ends an article, where the reader has tried an answer", async () => {
    const article = await get("/help/reschedule-a-shoot");
    expect(article.body).toContain("Still stuck?");
    expect(article.body).toContain("/support");
  });
});

describe("the video embed", () => {
  it("carries a referrer policy the player will accept", async () => {
    // The site sends `Referrer-Policy: no-referrer`. Without a referring
    // origin YouTube's player renders "Error 153 Video player configuration
    // error" instead of the video — reproduced in a real browser. The
    // attribute overrides the document policy for this request alone and
    // sends the origin only, never the article's path.
    const res = await get("/help/reschedule-a-shoot");
    expect(res.body).toContain("youtube.com/embed/");
    expect(res.body).toContain('referrerpolicy="strict-origin-when-cross-origin"');
  });
});

describe("spelling", () => {
  it("says Center, the American spelling this product uses", async () => {
    for (const path of ["/help", "/help?q=reschedule", "/help/category/scheduling"]) {
      const body = (await get(path)).body;
      expect(body).toContain("Help Center");
      expect(body).not.toContain("Centre");
    }
  });
});

describe("browsing by category", () => {
  it("offers every category with something published in it as a link", async () => {
    const res = await get("/help");
    // The index grouped by category from the start, but nothing linked to the
    // category pages that already existed, so a visitor could only scroll.
    expect(res.body).toContain('class="hc-cats"');
    expect(res.body).toContain('href="/help/category/scheduling"');
  });

  it("does not advertise a category the index itself hides", async () => {
    // A pill for an empty shelf would send a client to a page with nothing on
    // it — exactly what leaving it out of the index avoids.
    const res = await get("/help");
    expect(res.body).not.toContain("Empty shelf");
    expect(res.body).not.toContain("/help/category/empty-shelf");
  });

  it("keeps the chooser on a category page and marks the current shelf", async () => {
    const res = await get("/help/category/scheduling");
    expect(res.status).toBe(200);
    expect(res.body).toContain('class="hc-cats"');
    expect(res.body).toContain("hc-cat-on");
  });

  it("puts the search box on the category page too", async () => {
    const res = await get("/help/category/scheduling");
    expect(res.body).toContain('name="q"');
  });

  it("offers categories alongside search results, including a fruitless one", async () => {
    const hit = await get("/help?q=reschedule");
    expect(hit.body).toContain('class="hc-cats"');

    const miss = await get("/help?q=zzzznothingmatchesthis");
    expect(miss.body).toContain("Nothing matched");
    expect(miss.body).toContain('class="hc-cats"');
  });

  it("widens the listing pages but leaves an article at a readable measure", async () => {
    // Long help text at 1040px is tiring to read, so only the scanning pages
    // take the extra width. Assert on the wrap element, not the page: the
    // stylesheet is inlined on every page, so the class name always appears.
    const wrap = (body: string) => /<div class="wrap([^"]*)"/.exec(body)?.[1] ?? "";
    expect(wrap((await get("/help")).body)).toContain("hc-wide");
    expect(wrap((await get("/help/category/scheduling")).body)).toContain("hc-wide");
    expect(wrap((await get("/help?q=reschedule")).body)).toContain("hc-wide");
    expect(wrap((await get("/help/reschedule-a-shoot")).body)).toBe("");
  });

  it("keeps the wide layout single-column until there is room for two", async () => {
    const res = await get("/help");
    expect(res.body).toContain(".hc-groups { display:grid; grid-template-columns:1fr;");
    expect(res.body).toContain("@media (min-width:820px)");
  });
});

describe("an article", () => {
  it("renders its markdown", async () => {
    const res = await get("/help/reschedule-a-shoot");
    expect(res.status).toBe(200);
    // Headings carry an id and an anchor mark so a step can be linked to
    // directly; the heading text itself is unchanged.
    expect(res.body).toContain('<h2 id="steps">Steps');
    expect(res.body).toContain('href="#steps"');
    expect(res.body).toContain("<li>Call us</li>");
    expect(res.body).toContain('href="https://example.com/book"');
  });

  it("offers the rest of its category to read on", async () => {
    const res = await get("/help/reschedule-a-shoot");
    expect(res.body).toContain("Cancel a shoot");
    // Its own entry is not repeated in that list.
    expect(res.body.match(/\/help\/reschedule-a-shoot/g)?.length ?? 0).toBeLessThan(3);
  });

  it("404s a draft with the same page a typo gets", async () => {
    const draft = await get("/help/secret-roadmap");
    const typo = await get("/help/no-such-article");
    expect(draft.status).toBe(404);
    expect(typo.status).toBe(404);
    // Nothing about the draft leaks — not even that it exists.
    expect(draft.body).not.toContain("Secret roadmap");
    expect(draft.body).toBe(typo.body);
  });

  it("does not cache a 404, so publishing fixes the link immediately", async () => {
    const res = await get("/help/no-such-article");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("caches a page briefly", async () => {
    const res = await get("/help/reschedule-a-shoot");
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
  });
});

describe("a category page", () => {
  it("lists only what is published in it", async () => {
    const res = await get("/help/category/scheduling");
    expect(res.status).toBe(200);
    expect(res.body).toContain("Reschedule a shoot");
    expect(res.body).toContain("Cancel a shoot");
    expect(res.body).not.toContain("Secret roadmap");
  });

  it("404s an unknown category", async () => {
    expect((await get("/help/category/nope")).status).toBe(404);
  });

  it("says so plainly when a category is empty", async () => {
    const res = await get("/help/category/empty-shelf");
    expect(res.status).toBe(200);
    expect(res.body).toContain("Nothing here yet");
  });
});

describe("search", () => {
  it("finds a published article", async () => {
    const res = await get("/help?q=reschedul");
    expect(res.status).toBe(200);
    expect(res.body).toContain("Reschedule a shoot");
  });

  it("cannot reach a draft", async () => {
    const res = await get("/help?q=roadmap");
    expect(res.body).not.toContain("Secret roadmap");
    expect(res.body).toContain("Nothing matched");
  });

  it("survives punctuation that would be FTS5 syntax", async () => {
    const res = await get(`/help?q=${encodeURIComponent('agent\'s "photos" AND')}`);
    expect(res.status).toBe(200);
  });
});

describe("the boundary", () => {
  it("needs no session at all", async () => {
    // Every request in this file is sent without an Authorization header; if
    // any page were gated, they would all have failed.
    expect((await get("/help")).status).toBe(200);
  });

  it("offers no way into the Hub from a public page", async () => {
    const pages = await Promise.all([
      get("/help"),
      get("/help/reschedule-a-shoot"),
      get("/help/category/scheduling"),
      get("/help?q=reschedul"),
    ]);
    for (const page of pages) {
      expect(page.body).not.toContain("/admin");
      expect(page.body).not.toContain("/api/admin");
      expect(page.body.toLowerCase()).not.toContain("sign in");
    }
  });

  it("leaves a non-read method to someone else", async () => {
    // Not ours to answer: the harness's fall-through replies instead.
    const res = await fetch(`${baseUrl}/help`, { method: "POST" });
    expect(await res.text()).toBe("not found");
  });
});

describe("rendering markdown", () => {
  it("escapes HTML in the body instead of passing it through", async () => {
    const nasty = await store.createArticle({
      title: "Injection attempt",
      bodyMd: '<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">',
    });
    await store.publishArticle(nasty.id, "steve");
    const res = await get("/help/injection-attempt");
    expect(res.status).toBe(200);
    // It comes out as visible text, which is the whole point: no live tag, and
    // no attribute smuggled onto a real one (the page's own logo is an <img>).
    expect(res.body).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(res.body).toContain("&lt;img src=x");
    expect(res.body).not.toContain("<script>alert(1)");
    expect(res.body).not.toMatch(/<img[^>]*onerror/);
  });

  it("refuses to make a link out of a javascript: URL", () => {
    // markdown-it's link validator rejects the href, so the whole construct
    // stays literal text — no anchor at all, which is the safe outcome.
    const html = renderMarkdown("[click me](javascript:alert(1))");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("click me");
  });

  it("sends an outbound link away from the page", () => {
    expect(renderMarkdown("[docs](https://example.com)")).toContain('rel="noopener noreferrer"');
  });
});

describe("video links", () => {
  it("builds an embed for the hosts we know", () => {
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://www.youtube.com/embed/abc123",
    );
    expect(videoEmbedUrl("https://youtu.be/abc123")).toBe("https://www.youtube.com/embed/abc123");
    expect(videoEmbedUrl("https://vimeo.com/12345")).toBe("https://player.vimeo.com/video/12345");
  });

  it("refuses to guess for anything else", () => {
    expect(videoEmbedUrl("https://example.com/video.mp4")).toBeNull();
    expect(videoEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(videoEmbedUrl("not a url")).toBeNull();
  });

  it("shows a player for a known host and a link otherwise", async () => {
    const embedded = await store.createArticle({
      title: "Watch this",
      bodyMd: "See the video.",
      videoUrl: "https://vimeo.com/12345",
    });
    await store.publishArticle(embedded.id, "steve");
    const linked = await store.createArticle({
      title: "Watch that",
      bodyMd: "See the video.",
      videoUrl: "https://files.example.com/clip.mp4",
    });
    await store.publishArticle(linked.id, "steve");

    const withPlayer = await get("/help/watch-this");
    expect(withPlayer.body).toContain('src="https://player.vimeo.com/video/12345"');

    const withLink = await get("/help/watch-that");
    expect(withLink.body).not.toContain("<iframe");
    expect(withLink.body).toContain("https://files.example.com/clip.mp4");
  });
});

describe("when an article was written", () => {
  it("reads as published until the words change", async () => {
    const article = await store.createArticle({ title: "Dated one", bodyMd: "First draft." });
    await store.publishArticle(article.id, "steve");
    const res = await get("/help/dated-one");
    expect(res.body).toMatch(/Published \w+ \d+, \d{4}/);
    expect(res.body).not.toContain("Updated ");
  });

  /**
   * The reason content_updated_at exists at all. `updated_at` moves when an
   * article is dragged into a new order or filed somewhere else, so showing it
   * would date-stamp a whole shelf of articles nobody wrote a word on.
   */
  it("does not read as updated after a reorder or a refile", async () => {
    const shelf = await store.createCategory({ title: "Shelf" });
    const article = await store.createArticle({ title: "Dated two", bodyMd: "First draft." });
    await store.publishArticle(article.id, "steve");
    await store.updateArticle(article.id, { categoryId: shelf.id });
    await store.reorderArticles(shelf.id, [article.id]);

    const res = await get("/help/dated-two");
    expect(res.body).not.toContain("Updated ");
    expect(res.body).toMatch(/Published \w+ \d+, \d{4}/);
  });

  it("reads as updated once the body actually changes", async () => {
    const article = await store.createArticle({ title: "Dated three", bodyMd: "First draft." });
    await store.publishArticle(article.id, "steve");
    // Publishing stamps both dates in the same tick, and the label only flips
    // once the change is a minute clear of publication.
    await store.updateArticle(article.id, { bodyMd: "Rewritten properly." });
    const stamped = await store.getArticle(article.id);
    await getAdminDb()
      .updateTable("admin_kb_articles")
      .set({ content_updated_at: (stamped?.publishedAt ?? 0) + 5 * 60_000 })
      .where("id", "=", article.id)
      .execute();

    const res = await get("/help/dated-three");
    expect(res.body).toMatch(/Updated \w+ \d+, \d{4}/);
  });

  it("says roughly how long it takes to read", async () => {
    const res = await get("/help/reschedule-a-shoot");
    expect(res.body).toMatch(/\d+ min read/);
    // Never zero: the number is an orientation, not a measurement.
    expect(res.body).not.toContain("0 min read");
  });
});

describe("linking into an article", () => {
  it("gives every heading an id and an anchor of its own", async () => {
    const article = await store.createArticle({
      title: "Deep linked",
      bodyMd:
        "## First step\n\nDo this.\n\n### A detail\n\nAnd this.\n\n## Second step\n\nThen that.",
    });
    await store.publishArticle(article.id, "steve");
    const res = await get("/help/deep-linked");
    expect(res.body).toContain('<h2 id="first-step">First step');
    expect(res.body).toContain('<h3 id="a-detail">A detail');
    expect(res.body).toContain('href="#second-step"');
  });

  /** Two headings with one id would send both links to the first of them. */
  it("suffixes a heading that repeats rather than reusing its id", async () => {
    const article = await store.createArticle({
      title: "Repeated headings",
      bodyMd: "## Step one\n\nA.\n\n## Step one\n\nB.\n\n## Step one\n\nC.",
    });
    await store.publishArticle(article.id, "steve");
    const res = await get("/help/repeated-headings");
    expect(res.body).toContain('<h2 id="step-one">');
    expect(res.body).toContain('<h2 id="step-one-2">');
    expect(res.body).toContain('<h2 id="step-one-3">');
  });

  /**
   * markdown-it's default renderer prints a token's attributes on a CLOSING
   * tag as happily as on an opening one, so an id carried on the close token
   * emits `</h2 data-anchor="…">`. Every other assertion in this file passed
   * while that was the output.
   */
  it("closes the heading cleanly, with the anchor inside it", async () => {
    const res = await get("/help/deep-linked");
    expect(res.body).toContain(
      '<a class="hc-anchor" href="#first-step" aria-label="Link to this section">#</a></h2>',
    );
    expect(res.body).not.toMatch(/<\/h[1-6] /);
  });

  it("offers a contents list once there is something to navigate", async () => {
    const res = await get("/help/deep-linked");
    expect(res.body).toContain("On this page");
    expect(res.body).toContain('<a href="#first-step">First step</a>');
  });

  /** Two headings is a page, not an outline; a contents list there is noise. */
  it("leaves the contents list off a short article", async () => {
    const res = await get("/help/reschedule-a-shoot");
    expect(res.body).not.toContain("On this page");
  });

  it("still refuses raw HTML in a heading", async () => {
    const article = await store.createArticle({
      title: "Hostile heading",
      bodyMd: "## <img src=x onerror=alert(1)>\n\nBody.",
    });
    await store.publishArticle(article.id, "steve");
    const res = await get("/help/hostile-heading");
    expect(res.body).not.toContain("<img src=x");
    expect(res.body).toContain("&lt;img");
  });
});

describe("liking and voting", () => {
  it("offers both on an article, hidden until the script reveals them", async () => {
    const res = await get("/help/reschedule-a-shoot");
    expect(res.body).toContain('id="hc-react"');
    expect(res.body).toContain("Was this article helpful?");
    // Neither does anything without JavaScript, so neither is shown without it.
    expect(res.body).toContain(
      'class="hc-react" id="hc-react" data-slug="reschedule-a-shoot" hidden',
    );
    expect(res.body).toContain('id="hc-helpful" hidden');
  });

  it("keeps them off the listing pages, which have nothing to vote on", async () => {
    const index = await get("/help");
    expect(index.body).not.toContain('id="hc-react"');
    const category = await get("/help/category/scheduling");
    expect(category.body).not.toContain('id="hc-react"');
  });
});

describe("search suggestions", () => {
  it("wires the box up on every page that has one", async () => {
    for (const page of ["/help", "/help?q=shoot", "/help/category/scheduling"]) {
      const res = await get(page);
      expect(res.body).toContain('id="hc-sugg"');
      expect(res.body).toContain("/help/suggest");
    }
  });

  /** The form is the real thing; the suggestions are laid over a page that
   * already worked without them. */
  it("leaves the plain form intact underneath", async () => {
    const res = await get("/help");
    expect(res.body).toContain(
      '<form class="hc-search" method="get" action="/help" role="search">',
    );
    expect(res.body).toContain('<button class="btn" type="submit">Search</button>');
  });
});
