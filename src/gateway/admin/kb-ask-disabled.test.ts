import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The answering box with no key configured. Its own file because the state
// under test is the absence of an environment variable, and a sibling test that
// sets one would decide the outcome of every case here.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-kb-ask-off-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;
delete process.env.ANTHROPIC_API_KEY;

const { handleKbPublicRequest } = await import("./kb-public-http.js");
const store = await import("./kb-store.js");
const { getAdminDb } = await import("./user-store.js");

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const article = await store.createArticle({
    title: "How to access the portal",
    bodyMd: "Sign in with the email on your order.",
  });
  await store.publishArticle(article.id, "steve");

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

describe("with no key configured", () => {
  it("draws no form, rather than one that cannot work", async () => {
    const body = await (await fetch(`${baseUrl}/help`)).text();
    expect(body).not.toContain("Ask a question");
    expect(body).not.toContain("/help/ask");
  });

  it("leaves the rest of the help center exactly as it was", async () => {
    const body = await (await fetch(`${baseUrl}/help`)).text();
    expect(body).toContain("How to access the portal");
    expect(body).toContain('action="/help"');
  });

  it("answers a hand-made POST with the page a mistyped link gets", async () => {
    const res = await fetch(`${baseUrl}/help/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ question: "how do I sign in" }).toString(),
    });
    expect(res.status).toBe(404);
    // Nothing was logged: there was no question to answer, only a probe.
    expect(await getAdminDb().selectFrom("admin_kb_asks").selectAll().execute()).toEqual([]);
  });
});
