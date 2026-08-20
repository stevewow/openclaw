import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// The help center writing to the search log. Two things matter and both are
// pinned here: a search a client runs has to reach the report, and nothing the
// log does may ever cost that client their answer.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-kb-searchlog-http-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleKbPublicRequest } = await import("./kb-public-http.js");
const store = await import("./kb-store.js");
const log = await import("./kb-search-store.js");
const { getAdminDb } = await import("./user-store.js");

let server: Server;
let baseUrl: string;
let articleSlug: string;
let articleId: string;

async function get(p: string, method = "GET"): Promise<{ status: number; body: string }> {
  const res = await fetch(`${baseUrl}${p}`, { method });
  return { status: res.status, body: await res.text() };
}

async function rows() {
  return getAdminDb()
    .selectFrom("admin_kb_searches")
    .selectAll()
    .orderBy("created_at", "asc")
    .execute();
}

beforeAll(async () => {
  const article = await store.createArticle({
    title: "Reschedule a shoot",
    summary: "Move an appointment",
    bodyMd: "Call the office.",
  });
  await store.publishArticle(article.id, "steve");
  articleId = article.id;
  articleSlug = article.slug;

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
  await getAdminDb().deleteFrom("admin_kb_searches").execute();
});

describe("searching the help center", () => {
  it("logs the query and how many articles it matched", async () => {
    await get("/help?q=reschedule");
    const logged = await rows();
    expect(logged).toHaveLength(1);
    expect(logged[0].query).toBe("reschedule");
    expect(logged[0].result_count).toBe(1);
  });

  it("logs a search that found nothing — the whole point of the report", async () => {
    await get("/help?q=drone%20photos");
    const logged = await rows();
    expect(logged).toHaveLength(1);
    expect(logged[0].query).toBe("drone photos");
    expect(logged[0].result_count).toBe(0);
  });

  it("logs nothing for browsing, only for searching", async () => {
    await get("/help");
    await get(`/help/${articleSlug}`);
    expect(await rows()).toHaveLength(0);
  });

  it("ignores HEAD, which is a prefetcher rather than a client with a question", async () => {
    await get("/help?q=reschedule", "HEAD");
    expect(await rows()).toHaveLength(0);
  });
});

describe("opening a result", () => {
  it("settles the search that offered it", async () => {
    const search = await get("/help?q=reschedule");
    const [logged] = await rows();
    // The results page carries the search id on every result link.
    expect(search.body).toContain(`/help/${articleSlug}?s=${logged.id}`);

    await get(`/help/${articleSlug}?s=${logged.id}`);

    const [after] = await rows();
    expect(after.clicked_article_id).toBe(articleId);
    expect(after.clicked_at).toBeGreaterThan(0);
  });

  it("shows the article normally when the search id names nothing", async () => {
    const res = await get(`/help/${articleSlug}?s=not-a-real-search`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Reschedule a shoot");
  });

  it("leaves plain article links unstamped", async () => {
    await get("/help?q=reschedule");
    await get(`/help/${articleSlug}`);
    const [logged] = await rows();
    expect(logged.clicked_article_id).toBeNull();
  });

  it("does not put a search id on links outside the results page", async () => {
    const index = await get("/help");
    expect(index.body).not.toContain("?s=");
    const article = await get(`/help/${articleSlug}`);
    expect(article.body).not.toContain("?s=");
  });
});

describe("the report", () => {
  it("reads back what the help center wrote", async () => {
    await get("/help?q=drone%20photos");
    await get("/help?q=Drone%20Photos");
    const search = await get("/help?q=reschedule");
    expect(search.status).toBe(200);
    const logged = await rows();
    const answered = logged.find((r) => r.query === "reschedule")!;
    await get(`/help/${articleSlug}?s=${answered.id}`);

    const summary = await log.summarizeKbSearches();
    expect(summary.totalSearches).toBe(3);
    expect(summary.zeroResultSearches).toBe(2);
    expect(summary.clickedSearches).toBe(1);
    expect(summary.gaps.map((g) => g.queryKey)).toEqual(["drone photos"]);
    expect(summary.gaps[0].searches).toBe(2);
  });
});
