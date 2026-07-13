// The web-chat transport: a Node HTTP handler that serves the widget and runs
// the intake brain per visitor turn. No platform/SDK imports — it is driven by
// an injected SessionStore + IntakeBrain, so it is fully testable against a real
// http.Server. The plugin entry (index.ts) wires it to api.registerHttpRoute.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { IntakeBrain } from "./brain.js";
import type { SessionStore } from "./session-store.js";
import { chatPageHtml, embedJs } from "./widget.js";

export type ChatServiceOptions = {
  store: SessionStore;
  brain: IntakeBrain;
  basePath: string; // e.g. "/wow-intake" (no trailing slash)
  now?: () => number; // injectable clock (Date.now unavailable in some sandboxes)
};

const MAX_BODY_BYTES = 16 * 1024;

function send(res: ServerResponse, status: number, body: string, contentType: string): void {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  send(res, status, JSON.stringify(value), "application/json; charset=utf-8");
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return await new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function createChatService(opts: ChatServiceOptions) {
  const base = opts.basePath.replace(/\/+$/, "");
  const clock = opts.now ?? (() => 0);

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://localhost");
    let path = url.pathname;
    if (!path.startsWith(base)) return false;
    let rel = path.slice(base.length) || "/";
    if (rel.length > 1) rel = rel.replace(/\/+$/, "") || "/";

    if (req.method === "OPTIONS") {
      send(res, 204, "", "text/plain");
      return true;
    }

    // GET widget page
    if (req.method === "GET" && rel === "/") {
      send(res, 200, chatPageHtml(base), "text/html; charset=utf-8");
      return true;
    }
    // GET embed snippet
    if (req.method === "GET" && rel === "/embed.js") {
      send(res, 200, embedJs(base), "application/javascript; charset=utf-8");
      return true;
    }
    // GET session (resume)
    if (req.method === "GET" && rel === "/session") {
      const visitorId = str(url.searchParams.get("visitorId"));
      const listingId = str(url.searchParams.get("listingId"));
      if (!visitorId) {
        sendJson(res, 400, { error: "visitorId required" });
        return true;
      }
      const session = opts.store.get(visitorId, listingId);
      sendJson(res, 200, {
        history: session?.history ?? [],
        done: session?.handedOff ?? false,
        greeting: session ? undefined : opts.brain.greeting(),
      });
      return true;
    }
    // POST a chat turn
    if (req.method === "POST" && rel === "/chat") {
      const body = await readJsonBody(req);
      if (!body) {
        sendJson(res, 400, { error: "invalid body" });
        return true;
      }
      const visitorId = str(body.visitorId);
      const listingId = str(body.listingId);
      const message = str(body.message);
      if (!visitorId || !message) {
        sendJson(res, 400, { error: "visitorId and message required" });
        return true;
      }
      const now = clock();
      const session = opts.store.getOrCreate(visitorId, listingId, now);
      if (session.handedOff) {
        sendJson(res, 200, {
          reply:
            "Your order has already been sent to our team — they'll be in touch shortly. Thanks!",
          done: true,
        });
        return true;
      }
      session.history.push({ role: "visitor", text: message, at: now });
      try {
        const turn = await opts.brain.respond({ session, message });
        session.draft = turn.draft;
        session.history.push({ role: "assistant", text: turn.reply, at: now });
        session.updatedAt = now;
        opts.store.save(session);
        sendJson(res, 200, { reply: turn.reply, done: session.handedOff });
      } catch {
        sendJson(res, 500, { error: "intake error" });
      }
      return true;
    }

    sendJson(res, 404, { error: "not found" });
    return true;
  }

  return { handle, basePath: base };
}
