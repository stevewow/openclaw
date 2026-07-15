import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-intake-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleTicketIntakeRequest } = await import("./ticket-intake-http.js");
const store = await import("./ticket-store.js");

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    void (async () => {
      const handled = await handleTicketIntakeRequest(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end("not found");
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

async function submit(body: unknown) {
  const res = await fetch(`${base}/api/support/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    data: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

describe("ticket intake form", () => {
  it("serves the white-label form page at /support with no platform leak", async () => {
    const res = await fetch(`${base}/support`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("WOW Video Tours");
    expect(html).toContain("Submit a Request");
    expect(html.toLowerCase()).not.toContain("openclaw");
  });

  it("opens a widget-sourced ticket from a valid submission and returns its number", async () => {
    const { status, data } = await submit({
      category: "edit_request",
      mediaType: "Photos",
      details: "Please brighten the kitchen photos.",
      requesterName: "Dana Agent",
      requesterEmail: "dana@example.com",
      orderId: "SP-77",
      orderAddress: "5 Elm St",
    });
    expect(status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.number).toBe("WVT-1001");

    const tickets = await store.listTickets({ q: "elm" });
    const t = tickets.find((x) => x.orderAddress === "5 Elm St");
    expect(t).toBeTruthy();
    expect(t!.source).toBe("widget");
    expect(t!.category).toBe("edit_request");
    expect(t!.department).toBe("editing");
    expect(t!.subject).toBe("Edit request — Photos");
    expect(t!.description).toContain("Media: Photos");
    expect(t!.description).toContain("brighten the kitchen");
    expect(t!.requesterEmail).toBe("dana@example.com");
  });

  it("composes the subject from the service for additional-service requests", async () => {
    const { status, data } = await submit({
      category: "additional_service",
      serviceType: "Virtual staging",
      details: "Stage the living room.",
      requesterName: "Sam",
      requesterEmail: "sam@example.com",
    });
    expect(status).toBe(201);
    const t = await store.getTicketByNumber(data.number as string);
    expect(t!.subject).toBe("Additional service — Virtual staging");
    expect(t!.department).toBe("operations");
  });

  it("rejects submissions missing required fields", async () => {
    expect((await submit({ category: "other", details: "hi", requesterName: "A" })).status).toBe(
      400,
    );
    expect(
      (
        await submit({
          category: "other",
          details: "hi",
          requesterName: "A",
          requesterEmail: "bad",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await submit({
          category: "nope",
          details: "hi",
          requesterName: "A",
          requesterEmail: "a@b.co",
        })
      ).status,
    ).toBe(400);
  });
});
