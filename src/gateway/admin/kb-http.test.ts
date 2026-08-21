import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The knowledge base's admin API: the grant that opens it, the draft/publish
// step, and the routes whose order or input handling could quietly do the wrong
// thing (reorder vs :id, a script URL in the video field).

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-kb-http-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleAdminHttpRequest } = await import("./admin-http.js");
const userStore = await import("./user-store.js");
const { PORTAL_FEATURES } = await import("./types.js");

let server: Server;
let base: string;
let adminToken: string;
let adminId: string;
let grantedToken: string;
let strangerToken: string;

type Json = Record<string, unknown> | null;

async function call(
  method: string,
  p: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${base}/api/admin${p}`, {
    method,
    headers: {
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  let json: Json = null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

type Article = {
  id: string;
  slug: string;
  title: string;
  status: string;
  categoryId: string | null;
  videoUrl: string | null;
  publishedBy: string | null;
  publishedAt: number | null;
};
type Category = { id: string; slug: string; title: string; articleCount?: number };

async function newCategory(title: string): Promise<Category> {
  const res = await call("POST", "/kb/categories", { token: adminToken, body: { title } });
  return res.json?.category as Category;
}

async function newArticle(body: Record<string, unknown>): Promise<Article> {
  const res = await call("POST", "/kb/articles", { token: adminToken, body });
  return res.json?.article as Article;
}

beforeAll(async () => {
  const admin = await userStore.createUser({ username: "kb-admin", password: "pw", role: "admin" });
  adminId = admin.id;
  adminToken = (await userStore.createSession(admin.id)).token;

  const granted = await userStore.createUser({ username: "writer", password: "pw", role: "user" });
  await userStore.setUserPermissions(granted.id, [
    { permissionType: "feature", value: "knowledge-base" },
  ]);
  grantedToken = (await userStore.createSession(granted.id)).token;

  const stranger = await userStore.createUser({ username: "nobody", password: "pw", role: "user" });
  await userStore.setUserPermissions(stranger.id, [
    { permissionType: "feature", value: "tickets" },
  ]);
  strangerToken = (await userStore.createSession(stranger.id)).token;

  server = createServer((req, res) => {
    void (async () => {
      const handled = await handleAdminHttpRequest(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end("not found");
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("access", () => {
  it("refuses an unauthenticated caller", async () => {
    expect((await call("GET", "/kb")).status).toBe(401);
  });

  it("opens for the knowledge-base grant and stays shut without it", async () => {
    expect((await call("GET", "/kb", { token: grantedToken })).status).toBe(200);
    expect((await call("GET", "/kb", { token: strangerToken })).status).toBe(403);
  });

  it("gates writing on the same grant, not just reading", async () => {
    const res = await call("POST", "/kb/articles", {
      token: strangerToken,
      body: { title: "Sneaky" },
    });
    expect(res.status).toBe(403);
  });

  it("404s an unknown route under /kb instead of falling through", async () => {
    expect((await call("GET", "/kb/nonsense", { token: adminToken })).status).toBe(404);
  });
});

describe("articles", () => {
  it("creates a draft and records the author", async () => {
    const article = await newArticle({ title: "Reschedule a shoot", bodyMd: "# Steps" });
    expect(article.status).toBe("draft");
    expect(article.slug).toBe("reschedule-a-shoot");
    expect(article.publishedAt).toBeNull();
  });

  it("publishes and unpublishes, recording who reviewed it", async () => {
    const article = await newArticle({ title: "Upload extra photos" });
    const published = await call("POST", `/kb/articles/${article.id}/publish`, {
      token: adminToken,
    });
    expect(published.status).toBe(200);
    expect((published.json?.article as Article).status).toBe("published");
    expect((published.json?.article as Article).publishedBy).toBe(adminId);

    const pulled = await call("POST", `/kb/articles/${article.id}/unpublish`, {
      token: adminToken,
    });
    expect((pulled.json?.article as Article).status).toBe("draft");
  });

  it("rejects a video link that is not http(s)", async () => {
    const res = await call("POST", "/kb/articles", {
      token: adminToken,
      body: { title: "Nasty", videoUrl: "javascript:alert(1)" },
    });
    expect(res.status).toBe(400);
    // Stored as-is it would run when the public reader built an embed from it.
    expect(String(res.json?.error)).toMatch(/videoUrl/);
  });

  it("keeps a real video link", async () => {
    const article = await newArticle({
      title: "Watch the walkthrough",
      videoUrl: "https://vimeo.com/12345",
    });
    expect(article.videoUrl).toBe("https://vimeo.com/12345");
  });

  it("files an article, and takes null as the unfiled shelf", async () => {
    const category = await newCategory("Scheduling");
    const article = await newArticle({ title: "Filed away", categoryId: category.id });
    expect(article.categoryId).toBe(category.id);

    const moved = await call("PUT", `/kb/articles/${article.id}`, {
      token: adminToken,
      body: { categoryId: null },
    });
    expect((moved.json?.article as Article).categoryId).toBeNull();
  });

  it("404s an edit, a publish or a delete of something that is gone", async () => {
    expect(
      (await call("PUT", "/kb/articles/missing", { token: adminToken, body: { title: "x" } }))
        .status,
    ).toBe(404);
    expect((await call("POST", "/kb/articles/missing/publish", { token: adminToken })).status).toBe(
      404,
    );
    expect((await call("DELETE", "/kb/articles/missing", { token: adminToken })).status).toBe(404);
  });

  it("requires a title", async () => {
    const res = await call("POST", "/kb/articles", { token: adminToken, body: { bodyMd: "hi" } });
    expect(res.status).toBe(400);
  });
});

describe("categories", () => {
  it("reorders instead of being captured by the :id route", async () => {
    const a = await newCategory("Alpha reorder");
    const b = await newCategory("Bravo reorder");
    const res = await call("PUT", "/kb/categories/reorder", {
      token: adminToken,
      body: { ids: [b.id, a.id] },
    });
    expect(res.status).toBe(200);
    const ids = (res.json?.categories as Category[]).map((c) => c.id);
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id));

    // The :id route would have tried to rename a category with id "reorder".
    const listed = (res.json?.categories as Category[]).map((c) => c.title);
    expect(listed).not.toContain("reorder");
  });

  it("rejects a reorder that is not a list of ids", async () => {
    const res = await call("PUT", "/kb/categories/reorder", {
      token: adminToken,
      body: { ids: "everything" },
    });
    expect(res.status).toBe(400);
  });

  it("unfiles the articles it held rather than deleting them", async () => {
    const category = await newCategory("Doomed shelf");
    const article = await newArticle({ title: "Survives deletion", categoryId: category.id });

    const res = await call("DELETE", `/kb/categories/${category.id}`, { token: adminToken });
    expect(res.status).toBe(200);
    expect(res.json?.unfiled).toBe(1);

    const after = await call("GET", "/kb", { token: adminToken });
    const still = (after.json?.articles as Article[]).find((a) => a.id === article.id);
    expect(still?.categoryId).toBeNull();
  });

  it("counts only published articles per category", async () => {
    const category = await newCategory("Counted");
    const live = await newArticle({ title: "Counted live", categoryId: category.id });
    await newArticle({ title: "Counted draft", categoryId: category.id });
    await call("POST", `/kb/articles/${live.id}/publish`, { token: adminToken });

    const res = await call("GET", "/kb", { token: adminToken });
    const found = (res.json?.categories as Category[]).find((c) => c.id === category.id);
    expect(found?.articleCount).toBe(1);
  });
});

describe("search", () => {
  it("finds a draft, because this side is staff-only", async () => {
    await newArticle({ title: "Hidden zebra guide", bodyMd: "zebra" });
    const res = await call("GET", "/kb/search?q=zebra", { token: adminToken });
    expect(res.status).toBe(200);
    expect((res.json?.articles as Article[]).some((a) => a.title === "Hidden zebra guide")).toBe(
      true,
    );
  });

  it("returns nothing for an empty query rather than the whole base", async () => {
    const res = await call("GET", "/kb/search?q=", { token: adminToken });
    expect(res.json?.articles).toEqual([]);
  });
});

describe("the search report", () => {
  type Summary = {
    since: number;
    totalSearches: number;
    zeroResultSearches: number;
    gaps: Array<{ query: string; searches: number }>;
  };

  it("rides on the knowledge-base grant, like the rest of this surface", async () => {
    expect((await call("GET", "/kb/searches", { token: grantedToken })).status).toBe(200);
    expect((await call("GET", "/kb/searches", { token: strangerToken })).status).toBe(403);
  });

  it("answers with an empty report rather than an error before anyone has searched", async () => {
    const res = await call("GET", "/kb/searches", { token: adminToken });
    expect(res.status).toBe(200);
    const summary = res.json?.summary as Summary;
    expect(summary.totalSearches).toBe(0);
    expect(summary.gaps).toEqual([]);
  });

  it("takes a window, and ignores one it cannot read", async () => {
    const week = (await call("GET", "/kb/searches?days=7", { token: adminToken })).json
      ?.summary as Summary;
    const nonsense = (await call("GET", "/kb/searches?days=banana", { token: adminToken })).json
      ?.summary as Summary;
    // A week's window starts later than the default month's; a window that is
    // not a number falls back to the default rather than to zero days.
    expect(week.since).toBeGreaterThan(nonsense.since);
  });

  it("carries the questions alongside the searches, in one call", async () => {
    const res = await call("GET", "/kb/searches", { token: adminToken });
    expect(res.status).toBe(200);
    // Two readings of the same thing; fetching them apart would show one stale.
    expect(res.json?.summary).toBeTruthy();
    expect((res.json?.asks as { totalAsks: number }).totalAsks).toBe(0);
  });

  it("is read-only — the rows come from the public reader", async () => {
    expect((await call("POST", "/kb/searches", { token: adminToken })).status).toBe(404);
  });
});

describe("the article performance report", () => {
  it("carries a row per published article alongside the searches", async () => {
    const res = await call("GET", "/kb/searches", { token: adminToken });
    expect(res.status).toBe(200);
    const articles = res.json?.articles as Array<Record<string, unknown>>;
    expect(Array.isArray(articles)).toBe(true);
    // Counters for an article nobody has opened read as zero, not as missing.
    for (const article of articles) {
      expect(article).toMatchObject({ views: 0, likes: 0, helpfulYes: 0, helpfulNo: 0 });
      expect(typeof article.title).toBe("string");
      expect(typeof article.url).toBe("string");
      expect(["Published", "Updated"]).toContain(article.dateLabel);
    }
  });

  it("answers with an empty comment list rather than an error before anyone comments", async () => {
    const res = await call("GET", "/kb/searches", { token: adminToken });
    expect(res.json?.notes).toEqual([]);
  });
});

describe("the Help Center grant", () => {
  /**
   * The label on this feature became "Help Center"; the stored value must not
   * follow it. `knowledge-base` is written into every grant row that already
   * exists, so renaming the value would quietly revoke everyone's access to the
   * page it names.
   */
  it("keeps its stored value while carrying the new label", () => {
    const feature = PORTAL_FEATURES.find((f) => f.value === "knowledge-base");
    expect(feature).toBeTruthy();
    expect(feature?.label).toBe("Help Center");
    expect(PORTAL_FEATURES.some((f) => (f.value as string) === "help-center")).toBe(false);
  });
});
