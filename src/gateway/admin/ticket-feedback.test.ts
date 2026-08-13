import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-feedback-"));
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
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

async function resolvedTicket() {
  const ticket = await store.createTicket({
    category: "edit_request",
    subject: "Edit request — Photos",
    source: "widget",
    requesterName: "Dana Agent",
    requesterEmail: "dana@example.com",
  });
  await store.updateTicket(ticket.id, { status: "resolved" });
  const token = await store.ensureFeedbackToken(ticket.id);
  return { id: ticket.id, number: ticket.number, token: token! };
}

async function postFeedback(body: unknown) {
  const res = await fetch(`${base}/api/support/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    data: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

describe("feedback tokens", () => {
  it("mints once and keeps returning the same handle", async () => {
    const { id } = await resolvedTicket();
    const first = await store.ensureFeedbackToken(id);
    const second = await store.ensureFeedbackToken(id);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it("resolves back to exactly its own ticket, and nothing to a stranger's token", async () => {
    const a = await resolvedTicket();
    const b = await resolvedTicket();
    expect(a.token).not.toBe(b.token);
    expect((await store.getTicketByFeedbackToken(a.token))!.id).toBe(a.id);
    expect(await store.getTicketByFeedbackToken("not-a-real-token")).toBeNull();
    expect(await store.getTicketByFeedbackToken("")).toBeNull();
  });
});

describe("recording feedback", () => {
  it("stores the rating and comment and logs them on the thread", async () => {
    const { id } = await resolvedTicket();
    await store.recordTicketFeedback(id, { rating: "down", comment: "The kitchen is still dark." });

    const t = (await store.getTicket(id))!;
    expect(t.feedbackRating).toBe("down");
    expect(t.feedbackComment).toBe("The kitchen is still dark.");
    expect(t.feedbackAt).toBeGreaterThan(0);

    const events = await store.listTicketEvents(id);
    const logged = events.find((e) => e.meta?.feedback === true);
    expect(logged?.body).toContain("The kitchen is still dark.");
    expect(logged?.authorType).toBe("client");
  });

  it("lets a client change their mind, keeping the latest answer", async () => {
    const { id } = await resolvedTicket();
    await store.recordTicketFeedback(id, { rating: "down" });
    await store.recordTicketFeedback(id, { rating: "up", comment: "Sorted, thanks." });
    const t = (await store.getTicket(id))!;
    expect(t.feedbackRating).toBe("up");
    expect(t.feedbackComment).toBe("Sorted, thanks.");
  });

  it("keeps a comment sent on its own, without a rating", async () => {
    const { id } = await resolvedTicket();
    await store.recordTicketFeedback(id, { comment: "Just a note." });
    const t = (await store.getTicket(id))!;
    expect(t.feedbackRating).toBeNull();
    expect(t.feedbackComment).toBe("Just a note.");
  });

  it("caps a comment rather than storing an unbounded body", async () => {
    const { id } = await resolvedTicket();
    await store.recordTicketFeedback(id, { comment: "x".repeat(store.MAX_FEEDBACK_COMMENT + 500) });
    const t = (await store.getTicket(id))!;
    expect(t.feedbackComment!.length).toBe(store.MAX_FEEDBACK_COMMENT);
  });

  it("counts up and down in the dashboard stats, ignoring unrated tickets", async () => {
    const before = await store.getTicketStats();
    const good = await resolvedTicket();
    const bad = await resolvedTicket();
    await resolvedTicket(); // never rated — must not move the counts
    await store.recordTicketFeedback(good.id, { rating: "up" });
    await store.recordTicketFeedback(bad.id, { rating: "down", comment: "not right" });

    const after = await store.getTicketStats();
    expect(after.feedback.up).toBe(before.feedback.up + 1);
    expect(after.feedback.down).toBe(before.feedback.down + 1);
    expect(after.feedback.comments).toBe(before.feedback.comments + 1);
  });
});

describe("the public feedback page", () => {
  it("renders the ticket's number and both thumbs for a live token", async () => {
    const { token, number } = await resolvedTicket();
    const res = await fetch(`${base}/support/feedback?t=${encodeURIComponent(token)}&r=up`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(number);
    expect(html).toContain("thumb-up");
    expect(html).toContain("thumb-down");
    expect(html.toLowerCase()).not.toContain("openclaw");
  });

  /**
   * The property that matters most here. Outlook Safe Links and Gmail's image
   * proxy both fetch a URL before any human opens the mail, so a GET that wrote
   * would score tickets nobody ever read. The page's own POST does the writing.
   */
  it("records nothing on the GET, so a link scanner cannot rate a ticket", async () => {
    const { id, token } = await resolvedTicket();
    await fetch(`${base}/support/feedback?t=${encodeURIComponent(token)}&r=down`);
    const t = (await store.getTicket(id))!;
    expect(t.feedbackRating).toBeNull();
    expect(t.feedbackAt).toBeNull();
  });

  it("gives an unknown token the same neutral page, leaking nothing", async () => {
    const res = await fetch(`${base}/support/feedback?t=nope`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("no longer active");
    expect(html).not.toContain("WVT-");
  });

  it("serves the logo the pages point at, cached hard and revalidating cheaply", async () => {
    const res = await fetch(`${base}/support/logo.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");

    const etag = res.headers.get("etag")!;
    const again = await fetch(`${base}/support/logo.png`, { headers: { "if-none-match": etag } });
    expect(again.status).toBe(304);
  });
});

describe("the feedback endpoint", () => {
  it("records a rating posted with a valid token", async () => {
    const { id, token } = await resolvedTicket();
    const { status, data } = await postFeedback({ token, rating: "up" });
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
    expect((await store.getTicket(id))!.feedbackRating).toBe("up");
  });

  it("refuses an unknown token, and says no more than that", async () => {
    const { status } = await postFeedback({ token: "made-up", rating: "up" });
    expect(status).toBe(404);
  });

  it("refuses a post carrying neither a rating nor a note", async () => {
    const { token } = await resolvedTicket();
    const { status } = await postFeedback({ token });
    expect(status).toBe(400);
  });

  it("ignores a rating that is not a thumb, rather than storing it", async () => {
    const { id, token } = await resolvedTicket();
    // Junk rating alone is nothing to record; with a comment it saves the comment
    // and leaves the rating unset.
    expect((await postFeedback({ token, rating: "5 stars" })).status).toBe(400);
    expect((await postFeedback({ token, rating: "5 stars", comment: "ok" })).status).toBe(200);
    const t = (await store.getTicket(id))!;
    expect(t.feedbackRating).toBeNull();
    expect(t.feedbackComment).toBe("ok");
  });

  it("never accepts a ticket id in place of a token", async () => {
    const { id } = await resolvedTicket();
    const { status } = await postFeedback({ token: id, rating: "up" });
    expect(status).toBe(404);
    expect((await store.getTicket(id))!.feedbackRating).toBeNull();
  });
});
