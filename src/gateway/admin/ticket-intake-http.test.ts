import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-intake-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleTicketIntakeRequest } = await import("./ticket-intake-http.js");
const store = await import("./ticket-store.js");
const cats = await import("./ticket-category-store.js");

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

// The intake endpoint rate-limits per client IP (6 per 10 min). Each test sends
// from its own X-Forwarded-For so tests don't spend each other's budget.
async function submit(body: unknown, ip = "203.0.113.1") {
  const res = await fetch(`${base}/api/support/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    data: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

function validBodyFor(category: string) {
  return {
    category,
    details: "Some details here.",
    requesterName: "Test User",
    requesterEmail: "test@example.com",
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
    const { status, data } = await submit(
      {
        category: "edit_request",
        mediaType: "Photos",
        details: "Please brighten the kitchen photos.",
        requesterName: "Dana Agent",
        requesterEmail: "dana@example.com",
        orderId: "SP-77",
        orderAddress: "5 Elm St",
      },
      "203.0.113.10",
    );
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
    // The category's own question labels its answer, so a custom category is
    // self-describing without configuring a second label.
    expect(t!.description).toContain("Which media? Photos");
    expect(t!.description).toContain("brighten the kitchen");
    expect(t!.requesterEmail).toBe("dana@example.com");
  });

  it("serves admin-added categories on the form and accepts them", async () => {
    // The end-to-end version of what the old CHECK constraint blocked: an admin
    // adds a request type, and it works on the public form with no redeploy.
    await cats.createCategory({
      label: "Change the property address",
      shortLabel: "Address change",
      extraField: "text",
      extraLabel: "What should the address say?",
      extraPlaceholder: "123 Main St",
      detailsLabel: "Anything else?",
    });

    const html = await (await fetch(`${base}/support`)).text();
    expect(html).toContain("Change the property address");
    expect(html).toContain("What should the address say?");

    const { status, data } = await submit(
      {
        category: "change_the_property_address",
        extraValue: "456 Oak Ave",
        details: "Listing shows the old street.",
        requesterName: "Pat",
        requesterEmail: "pat@example.com",
      },
      "203.0.113.11",
    );
    expect(status).toBe(201);
    const t = await store.getTicketByNumber(data.number as string);
    expect(t!.category).toBe("change_the_property_address");
    expect(t!.subject).toBe("Address change — 456 Oak Ave");
    expect(t!.description).toContain("What should the address say? 456 Oak Ave");
  });

  it("rejects a category that has been retired from the form", async () => {
    const retired = await cats.createCategory({ label: "Old promo" });
    expect((await submit(validBodyFor(retired.key), "203.0.113.12")).status).toBe(201);
    await cats.updateCategory(retired.key, { active: false });
    // A stale page can't post a retired type.
    expect((await submit(validBodyFor(retired.key), "203.0.113.12")).status).toBe(400);
  });

  it("composes the subject from the service for additional-service requests", async () => {
    const { status, data } = await submit(
      {
        category: "additional_service",
        serviceType: "Virtual staging",
        details: "Stage the living room.",
        requesterName: "Sam",
        requesterEmail: "sam@example.com",
      },
      "203.0.113.13",
    );
    expect(status).toBe(201);
    const t = await store.getTicketByNumber(data.number as string);
    expect(t!.subject).toBe("Additional service — Virtual staging");
    expect(t!.department).toBe("operations");
  });

  it("rejects submissions missing required fields", async () => {
    expect(
      (await submit({ category: "other", details: "hi", requesterName: "A" }, "203.0.113.14"))
        .status,
    ).toBe(400);
    expect(
      (
        await submit(
          { category: "other", details: "hi", requesterName: "A", requesterEmail: "bad" },
          "203.0.113.14",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await submit(
          { category: "nope", details: "hi", requesterName: "A", requesterEmail: "a@b.co" },
          "203.0.113.14",
        )
      ).status,
    ).toBe(400);
  });
});
