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

describe("an article", () => {
  it("renders its markdown", async () => {
    const res = await get("/help/reschedule-a-shoot");
    expect(res.status).toBe(200);
    expect(res.body).toContain("<h2>Steps</h2>");
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
