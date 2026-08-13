import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-inbound-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const inbound = await import("./ticket-inbound.js");
const store = await import("./ticket-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("extractReplyToken", () => {
  it("reads the token from MailboxHash, recipients, or the subject", () => {
    expect(inbound.extractReplyToken({ MailboxHash: "wvt-1042" })).toBe("wvt-1042");
    expect(
      inbound.extractReplyToken({
        ToFull: [{ Email: "ticket+wvt-77@t.co", MailboxHash: "wvt-77" }],
      }),
    ).toBe("wvt-77");
    expect(inbound.extractReplyToken({ OriginalRecipient: "ticket+wvt-5@t.co" })).toBe("wvt-5");
    expect(inbound.extractReplyToken({ Subject: "Re: [WVT-9] Missing media" })).toBe("wvt-9");
    expect(inbound.extractReplyToken({ Subject: "no token here" })).toBeNull();
  });
});

describe("applyInboundReply", () => {
  it("returns no_token / no_match when it cannot resolve a ticket", async () => {
    expect(await inbound.applyInboundReply({ Subject: "hello" })).toEqual({ status: "no_token" });
    const r = await inbound.applyInboundReply({ MailboxHash: "wvt-99999" });
    expect(r).toEqual({ status: "no_match", replyToken: "wvt-99999" });
  });

  it("resolves a ticket when an allowed sender replies RESOLVED", async () => {
    const t = await store.createTicket({ category: "edit_request", subject: "edit" });
    const outcome = await inbound.applyInboundReply(
      {
        FromFull: { Email: "Edits@wow.co" },
        MailboxHash: t.replyToken,
        StrippedTextReply: "RESOLVED\nDelivered the new edit.",
      },
      { allowlist: ["edits@wow.co"] },
    );
    expect(outcome).toMatchObject({
      status: "applied",
      command: "resolved",
      newStatus: "resolved",
    });
    const after = await store.getTicket(t.id);
    expect(after!.status).toBe("resolved");
    const events = await store.listTicketEvents(t.id);
    const inEvt = events.find((e) => e.kind === "email_in");
    expect(inEvt?.body).toBe("Delivered the new edit.");
    expect(inEvt?.meta).toMatchObject({ verified: true, command: "resolved" });
    expect(events.some((e) => e.kind === "status_change")).toBe(true);
  });

  it("parks an unrecognized reply in needs_review", async () => {
    const t = await store.createTicket({ category: "other", subject: "q" });
    const outcome = await inbound.applyInboundReply(
      { From: "ops@wow.co", MailboxHash: t.replyToken, TextBody: "Which photo did you mean?" },
      { allowlist: ["ops@wow.co"] },
    );
    expect(outcome).toMatchObject({
      status: "applied",
      command: "none",
      newStatus: "needs_review",
    });
    expect((await store.getTicket(t.id))!.status).toBe("needs_review");
  });

  it("does not let an unverified sender drive state, but logs the reply", async () => {
    const t = await store.createTicket({ category: "missing_media", subject: "m" });
    const outcome = await inbound.applyInboundReply(
      {
        From: "client@random.com",
        MailboxHash: t.replyToken,
        StrippedTextReply: "RESOLVED all good",
      },
      { allowlist: ["ops@wow.co"] },
    );
    expect(outcome.status).toBe("unverified");
    const after = await store.getTicket(t.id);
    // Not resolved by an outsider — parked for a human instead.
    expect(after!.status).toBe("needs_review");
    const inEvt = (await store.listTicketEvents(t.id)).find((e) => e.kind === "email_in");
    expect(inEvt?.meta).toMatchObject({ verified: false });
  });
});

describe("test tickets are replyable", () => {
  // Regression: TEST- tickets were minted with a `test-####` reply token and a
  // `[TEST] [TEST-####]` subject, but inbound matching was hardcoded to `wvt-`.
  // Every reply to a demo ticket was silently dropped as no_token, so UPDATE and
  // RESOLVED appeared to do nothing.
  it("extracts a token from a TEST ticket's hash, reply address, and subject", () => {
    expect(inbound.extractReplyToken({ MailboxHash: "test-1001" })).toBe("test-1001");
    expect(
      inbound.extractReplyToken({ OriginalRecipient: "ticket+test-1001@tickets.example.com" }),
    ).toBe("test-1001");
    expect(
      inbound.extractReplyToken({ Subject: "Re: [TEST] [TEST-1001] Additional service" }),
    ).toBe("test-1001");
  });

  it("applies RESOLVED to a test ticket end to end", async () => {
    const t = await store.createTicket({
      category: "additional_service",
      subject: "demo",
      isTest: true,
    });
    expect(t.number.startsWith("TEST-")).toBe(true);

    const outcome = await inbound.applyInboundReply(
      {
        FromFull: { Email: "steve@wowvideotours.com" },
        MailboxHash: t.replyToken,
        StrippedTextReply: "RESOLVED\nDemo complete.",
      },
      { allowlist: ["steve@wowvideotours.com"] },
    );

    expect(outcome).toEqual({
      status: "applied",
      ticketNumber: t.number,
      command: "resolved",
      newStatus: "resolved",
    });
    const after = await store.getTicket(t.id);
    expect(after?.status).toBe("resolved");
    expect(after?.resolvedAt).toBeTruthy();
  });

  it("applies UPDATE to a test ticket without closing it", async () => {
    const t = await store.createTicket({ category: "other", subject: "demo2", isTest: true });
    const outcome = await inbound.applyInboundReply(
      {
        FromFull: { Email: "steve@wowvideotours.com" },
        MailboxHash: t.replyToken,
        StrippedTextReply: "UPDATE: still working on it",
      },
      { allowlist: ["steve@wowvideotours.com"] },
    );
    expect(outcome).toMatchObject({
      status: "applied",
      command: "update",
      newStatus: "in_progress",
    });
    const after = await store.getTicket(t.id);
    expect(after?.status).toBe("in_progress");
    expect(after?.resolvedAt).toBeFalsy();
  });
});

describe("a client reply reaches the department", () => {
  // The desk works from its inbox. Parking the ticket in needs_review only
  // helps someone already watching the dashboard, so the client's words have to
  // be carried to where the work actually happens.
  it("forwards an unverified reply to the desk, with the client's text", async () => {
    const ticket = await store.createTicket({
      category: "edit_request",
      subject: "Brighten kitchen",
      requesterEmail: "dana@example.com",
    });
    const forwarded: Array<{ number: string; from: string | null; message: string }> = [];
    const outcome = await inbound.applyInboundReply(
      {
        MailboxHash: ticket.replyToken,
        FromFull: { Email: "dana@example.com" },
        StrippedTextReply: "Any update on this?",
      },
      {
        allowlist: ["edits@wow.co"],
        forwardReply: async (t, reply) => {
          forwarded.push({ number: t.number, from: reply.fromEmail, message: reply.message });
        },
      },
    );

    expect(outcome.status).toBe("unverified");
    expect(forwarded).toEqual([
      { number: ticket.number, from: "dana@example.com", message: "Any update on this?" },
    ]);
    // And it is still parked, because a client may not move their own ticket.
    const after = await store.getTicket(ticket.id);
    expect(after?.status).toBe("needs_review");
  });

  // A desk reply is already handled by the command path; bouncing it back to
  // the same desk would be a loop.
  it("does not forward a verified desk reply", async () => {
    const ticket = await store.createTicket({ category: "edit_request", subject: "Kitchen" });
    let forwards = 0;
    const outcome = await inbound.applyInboundReply(
      {
        MailboxHash: ticket.replyToken,
        FromFull: { Email: "edits@wow.co" },
        StrippedTextReply: "UPDATE working on it",
      },
      {
        allowlist: ["edits@wow.co"],
        forwardReply: async () => {
          forwards += 1;
        },
      },
    );
    expect(outcome.status).toBe("applied");
    expect(forwards).toBe(0);
  });

  // The webhook has to answer Postmark 200 whatever happens, or the whole reply
  // is retried — so a failing forward must not take the handler down with it.
  it("still records the reply when the forward fails", async () => {
    const ticket = await store.createTicket({ category: "edit_request", subject: "Kitchen" });
    const outcome = await inbound.applyInboundReply(
      {
        MailboxHash: ticket.replyToken,
        FromFull: { Email: "client@example.com" },
        StrippedTextReply: "hello?",
      },
      {
        allowlist: ["edits@wow.co"],
        forwardReply: async () => {
          throw new Error("postmark down");
        },
      },
    );
    expect(outcome.status).toBe("unverified");
    const events = await store.listTicketEvents(ticket.id);
    expect(events.some((e) => e.kind === "email_in" && e.body === "hello?")).toBe(true);
  });
});
