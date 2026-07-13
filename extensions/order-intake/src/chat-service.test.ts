import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ScriptedBrain } from "./brain.js";
import { createChatService } from "./chat-service.js";
import { StubHandoffSender } from "./handoff.js";
import { InMemorySessionStore } from "./session-store.js";

const BASE = "/wow-intake";

function startServer(): Promise<{ server: Server; url: string; sender: StubHandoffSender }> {
  const sender = new StubHandoffSender();
  const service = createChatService({
    store: new InMemorySessionStore(),
    brain: new ScriptedBrain(sender),
    basePath: BASE,
    now: () => 1,
  });
  const server = createServer((req, res) => {
    void service.handle(req, res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}`, sender });
    });
  });
}

describe("web-chat service (M0)", () => {
  let ctx: { server: Server; url: string; sender: StubHandoffSender };
  beforeEach(async () => {
    ctx = await startServer();
  });
  afterEach(() => {
    ctx.server.close();
  });

  async function say(visitorId: string, message: string) {
    const r = await fetch(`${ctx.url}${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, message }),
    });
    return (await r.json()) as { reply: string; done: boolean };
  }

  it("serves the widget page", async () => {
    const r = await fetch(`${ctx.url}${BASE}/`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
    const html = await r.text();
    expect(html).toContain("WOW Video Tours");
  });

  it("serves the embed snippet", async () => {
    const r = await fetch(`${ctx.url}${BASE}/embed.js`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("javascript");
  });

  it("greets a fresh visitor via /session", async () => {
    const r = await fetch(`${ctx.url}${BASE}/session?visitorId=v1`);
    const s = (await r.json()) as { history: unknown[]; greeting?: string };
    expect(s.history).toHaveLength(0);
    expect(s.greeting).toBeTruthy();
  });

  it("runs a full intake to handoff and persists/ resumes", async () => {
    const v = "v-full";
    await say(v, "I'd like the WOW Essentials bundle");
    const afterSqft = await say(v, "About 2400 square feet");
    expect(afterSqft.reply).toContain("2,400");
    await say(v, "850 E Dorothy Ln, Kettering OH 45419");
    await say(v, "$425,000");
    await say(v, "occupied");
    await say(v, "Wendy Klawon");
    await say(v, "Coldwell Banker Heritage");
    await say(v, "(555) 123-4567");
    await say(v, "wendy@example.com");
    await say(v, "Highlight the kitchen; avoid the garage");
    await say(v, "lockbox");
    await say(v, "ASAP");
    const done = await say(v, "I agree");
    expect(done.done).toBe(true);
    expect(ctx.sender.log).toHaveLength(1);
    expect(ctx.sender.last?.text).toContain("$275"); // WOW Essentials @2400
    expect(ctx.sender.last?.complete).toBe(true);

    // Resume shows the full transcript and a closed conversation.
    const resume = await fetch(`${ctx.url}${BASE}/session?visitorId=${v}`);
    const s = (await resume.json()) as { history: unknown[]; done: boolean };
    expect(s.done).toBe(true);
    expect(s.history.length).toBeGreaterThan(20);
  });

  it("rejects a chat with no message", async () => {
    const r = await fetch(`${ctx.url}${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: "x" }),
    });
    expect(r.status).toBe(400);
  });

  it("404s unknown subpaths under the base", async () => {
    const r = await fetch(`${ctx.url}${BASE}/nope`);
    expect(r.status).toBe(404);
  });
});
