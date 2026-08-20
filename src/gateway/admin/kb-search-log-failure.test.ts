import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The search log is a reporting convenience. The help center is not.
//
// Its own file because the only honest way to prove this is to make the log
// fail, and a failure stubbed in for one case must not follow the reader into
// every other one.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-kb-searchlog-fail-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

vi.mock("./kb-search-store.js", () => ({
  recordKbSearch: () => Promise.reject(new Error("database is locked")),
  recordKbSearchClick: () => Promise.reject(new Error("database is locked")),
}));

const { handleKbPublicRequest } = await import("./kb-public-http.js");
const store = await import("./kb-store.js");

let server: Server;
let baseUrl: string;
let articleSlug: string;

async function get(p: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${baseUrl}${p}`);
  return { status: res.status, body: await res.text() };
}

beforeAll(async () => {
  const article = await store.createArticle({
    title: "Reschedule a shoot",
    bodyMd: "Call the office.",
  });
  await store.publishArticle(article.id, "steve");
  articleSlug = article.slug;

  // The reader warns on a failed write; the warning is the expected outcome
  // here, so keep it out of the run's output.
  vi.spyOn(console, "warn").mockImplementation(() => {});

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
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("when the search log cannot be written", () => {
  it("still answers the search", async () => {
    const res = await get("/help?q=reschedule");
    expect(res.status).toBe(200);
    expect(res.body).toContain("Reschedule a shoot");
  });

  it("falls back to plain result links rather than a broken one", async () => {
    const res = await get("/help?q=reschedule");
    expect(res.body).toContain(`href="/help/${articleSlug}"`);
    expect(res.body).not.toContain("?s=");
  });

  it("still serves an article opened from a result", async () => {
    const res = await get(`/help/${articleSlug}?s=some-search-id`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Reschedule a shoot");
  });
});
