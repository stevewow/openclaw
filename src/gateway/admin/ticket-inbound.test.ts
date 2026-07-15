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
