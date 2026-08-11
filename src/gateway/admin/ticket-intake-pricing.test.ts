import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// End-to-end: a client ticks priced choices on /support and the ticket carries
// the total. The estimate is recomputed server-side from our own option list, so
// these cases care most about what happens when the payload disagrees with it.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-intake-pricing-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const intake = await import("./ticket-intake-http.js");
const cats = await import("./ticket-category-store.js");
const ticketStore = await import("./ticket-store.js");

let server: Server;
let base: string;
let serviceKey: string;
let stagingKey: string;

let clientCounter = 0;
async function submit(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  clientCounter += 1;
  const res = await fetch(`${base}/api/support/intake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": `198.51.100.${clientCounter}`,
    },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    json: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

async function ticketFor(number: string) {
  const all = await ticketStore.listTickets({});
  return all.find((t) => t.number === number)!;
}

beforeAll(async () => {
  await cats.ensureCategorySeed();
  const created = await cats.createCategory({
    label: "Order an additional service",
    shortLabel: "Additional service",
    extraField: "multiselect",
    extraLabel: "Which services?",
    extraOptions: [
      { label: "Twilight photos", imageUrl: "https://example.com/tw.jpg", priceCents: 7500 },
      { label: "Aerial / Drone", imageUrl: null, priceCents: 15000 },
      { label: "Floor plan", imageUrl: null, priceCents: 9500 },
      { label: "Not sure yet", imageUrl: null, priceCents: null },
    ],
  });
  serviceKey = created.key;
  const staging = await cats.createCategory({
    label: "Order staging",
    shortLabel: "Staging",
    extraField: "multiselect",
    extraLabel: "Which services?",
    extraOptions: [
      {
        label: "Virtual staging",
        priceCents: 5000,
        maxQuantity: 10,
        followUps: [
          {
            id: "style",
            label: "Preferred style",
            kind: "select",
            choices: ["Modern", "Farmhouse"],
            required: true,
          },
          { id: "rooms", label: "Which image numbers / rooms?", kind: "textarea", required: true },
        ],
      },
    ],
  });
  stagingKey = staging.key;

  server = createServer((req, res) => {
    void (async () => {
      const handled = await intake.handleTicketIntakeRequest(req, res);
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

function submission(extra: Record<string, unknown> = {}) {
  return {
    category: serviceKey,
    details: "Before the weekend if possible.",
    requesterName: "Dana Agent",
    requesterEmail: "dana@example.com",
    ...extra,
  };
}

describe("a priced multi-select submission", () => {
  it("records the picks and the total on the ticket", async () => {
    const res = await submit(submission({ extraValues: ["Twilight photos", "Aerial / Drone"] }));
    expect(res.status).toBe(201);

    const ticket = await ticketFor(res.json.number as string);
    expect(ticket.estimateCents).toBe(22500);
    expect(ticket.subject).toContain("Twilight photos, Aerial / Drone");
    expect(ticket.description).toContain("Twilight photos — $75");
    expect(ticket.description).toContain("Estimated total: $225");
  });

  it("ignores a price the client tries to send, using our own list", async () => {
    const res = await submit(
      submission({
        extraValues: ["Aerial / Drone"],
        // None of these should be read.
        estimateCents: 1,
        extraTotalCents: 1,
        prices: { "Aerial / Drone": 1 },
      }),
    );

    const ticket = await ticketFor(res.json.number as string);
    expect(ticket.estimateCents).toBe(15000);
  });

  it("drops a choice we never offered rather than quoting it", async () => {
    const res = await submit(
      submission({ extraValues: ["Aerial / Drone", "Free helicopter ride"] }),
    );

    const ticket = await ticketFor(res.json.number as string);
    expect(ticket.estimateCents).toBe(15000);
    expect(ticket.subject).not.toContain("helicopter");
    expect(ticket.description).not.toContain("helicopter");
  });

  it("leaves the estimate unset when only unpriced choices are picked", async () => {
    const res = await submit(submission({ extraValues: ["Not sure yet"] }));

    const ticket = await ticketFor(res.json.number as string);
    expect(ticket.estimateCents).toBeNull();
    expect(ticket.description).not.toContain("Estimated total");
  });

  it("still accepts a plain single answer from an older form page", async () => {
    const res = await submit(submission({ extraValue: "Floor plan" }));

    const ticket = await ticketFor(res.json.number as string);
    expect(ticket.estimateCents).toBe(9500);
    expect(ticket.subject).toContain("Floor plan");
  });

  it("opens an unpriced ticket for a category with no priced choices", async () => {
    const res = await submit({
      category: "edit_request",
      extraValue: "Photos",
      details: "Too dark.",
      requesterName: "Dana Agent",
      requesterEmail: "dana@example.com",
    });

    const ticket = await ticketFor(res.json.number as string);
    expect(ticket.estimateCents).toBeNull();
    // The unpriced single-answer wording is unchanged.
    expect(ticket.description).toBe("Which media? Photos\n\nToo dark.");
  });
});

describe("ordering several of one choice, with its own questions", () => {
  function stagingSubmission(selections: unknown) {
    return {
      category: stagingKey,
      details: "Listing goes live Monday.",
      requesterName: "Dana Agent",
      requesterEmail: "dana@example.com",
      extraSelections: selections,
    };
  }

  it("prices the quantity and briefs the desk with the answers", async () => {
    const res = await submit(
      stagingSubmission([
        {
          label: "Virtual staging",
          quantity: 3,
          answers: [
            { id: "style", value: "Modern" },
            { id: "rooms", value: "Images 3, 7 and 12" },
          ],
        },
      ]),
    );
    expect(res.status).toBe(201);

    const ticket = await ticketFor(res.json.number as string);
    expect(ticket.estimateCents).toBe(15000);
    expect(ticket.subject).toContain("Virtual staging ×3");
    expect(ticket.description).toContain("• Virtual staging ×3 — $150 ($50 each)");
    expect(ticket.description).toContain("Preferred style: Modern");
    expect(ticket.description).toContain("Which image numbers / rooms?: Images 3, 7 and 12");
  });

  it("will not order more than the ceiling the admin set", async () => {
    const res = await submit(
      stagingSubmission([
        {
          label: "Virtual staging",
          quantity: 999,
          answers: { style: "Farmhouse", rooms: "All of them" },
        },
      ]),
    );

    const ticket = await ticketFor(res.json.number as string);
    expect(ticket.estimateCents).toBe(50000);
    expect(ticket.subject).toContain("Virtual staging ×10");
  });

  it("refuses a submission that skipped a required question", async () => {
    const res = await submit(
      stagingSubmission([{ label: "Virtual staging", quantity: 2, answers: { style: "Modern" } }]),
    );

    expect(res.status).toBe(400);
    expect(String(res.json.error)).toContain("Which image numbers / rooms?");
  });
});

describe("the form the client is served", () => {
  it("carries the thumbnails and prices so the page can render them", async () => {
    const res = await fetch(`${base}/support`);
    const html = await res.text();

    expect(html).toContain("Twilight photos");
    expect(html).toContain("https://example.com/tw.jpg");
    expect(html).toContain("7500");
    expect(html).toContain("multiselect");
  });

  it("carries the quantity ceilings and the per-choice questions", async () => {
    const res = await fetch(`${base}/support`);
    const html = await res.text();

    expect(html).toContain("maxQuantity");
    expect(html).toContain("Preferred style");
    expect(html).toContain("Which image numbers / rooms?");
  });
});
