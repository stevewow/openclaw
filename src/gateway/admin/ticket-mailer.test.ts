import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-mailer-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const mailer = await import("./ticket-mailer.js");
const store = await import("./ticket-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

const ENV = {
  POSTMARK_SERVER_TOKEN: "tok-123",
  TICKET_EMAIL_FROM: "support@wowvideotours.com",
  TICKET_EMAIL_INBOUND_ADDRESS: "ticket@tickets.wowvideotours.com",
  TICKET_DEPARTMENT_EMAILS: JSON.stringify({ editing: "edits@wow.co", operations: "ops@wow.co" }),
} as unknown as NodeJS.ProcessEnv;

describe("email config", () => {
  it("returns null when token/from are absent, config when present", () => {
    expect(mailer.readEmailConfig({} as NodeJS.ProcessEnv)).toBeNull();
    const cfg = mailer.readEmailConfig(ENV)!;
    expect(cfg.from).toBe("support@wowvideotours.com");
    expect(cfg.departmentEmails.editing).toBe("edits@wow.co");
    expect(mailer.resolveDepartmentEmail("operations", cfg)).toBe("ops@wow.co");
  });
});

describe("email formatting", () => {
  it("builds the [WVT-####] subject and a +token Reply-To", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const ticket = await store.createTicket({
      category: "edit_request",
      subject: "Brighten kitchen",
      description: "Please brighten the kitchen photos.",
      requesterName: "Dana",
      requesterEmail: "dana@example.com",
      orderId: "SP-9",
      orderAddress: "5 Elm St",
    });
    const to = mailer.resolveDepartmentEmail(ticket.department, cfg)!;
    const email = mailer.formatDepartmentEmail(ticket, cfg, to);
    expect(email.to).toBe("edits@wow.co");
    expect(email.subject).toBe(`[${ticket.number}] Brighten kitchen`);
    expect(email.replyTo).toBe(`ticket+${ticket.replyToken}@tickets.wowvideotours.com`);
    expect(email.textBody).toContain("RESOLVED");
    expect(email.textBody).toContain("5 Elm St");
  });
});

describe("PostmarkMailer", () => {
  it("posts to Postmark with the token header and reports success", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ ErrorCode: 0 }), { status: 200 });
    };
    const pm = new mailer.PostmarkMailer(cfg, fetchImpl);
    const res = await pm.send({
      to: "ops@wow.co",
      from: cfg.from,
      replyTo: "ticket+wvt-1@x.co",
      subject: "[WVT-1] hi",
      textBody: "body",
    });
    expect(res.ok).toBe(true);
    expect(seen!.url).toContain("postmarkapp.com");
    expect((seen!.init.headers as Record<string, string>)["X-Postmark-Server-Token"]).toBe(
      "tok-123",
    );
    const sent = JSON.parse(seen!.init.body as string);
    expect(sent.To).toBe("ops@wow.co");
    expect(sent.ReplyTo).toBe("ticket+wvt-1@x.co");
  });

  it("reports failure on a Postmark error code and on a thrown fetch", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const errMailer = new mailer.PostmarkMailer(
      cfg,
      async () =>
        new Response(JSON.stringify({ ErrorCode: 300, Message: "Invalid email" }), { status: 422 }),
    );
    const r1 = await errMailer.send({
      to: "x@y.co",
      from: cfg.from,
      replyTo: "r@y.co",
      subject: "s",
      textBody: "b",
    });
    expect(r1.ok).toBe(false);
    expect(r1.detail).toContain("Invalid email");

    const throwMailer = new mailer.PostmarkMailer(cfg, async () => {
      throw new Error("network down");
    });
    const r2 = await throwMailer.send({
      to: "x@y.co",
      from: cfg.from,
      replyTo: "r@y.co",
      subject: "s",
      textBody: "b",
    });
    expect(r2.ok).toBe(false);
    expect(r2.detail).toContain("network down");
  });
});

describe("notifyDepartment", () => {
  it("records an email_out event on success and no-ops (logs) when unconfigured", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const ticket = await store.createTicket({ category: "missing_media", subject: "no aerials" });

    const ok = await mailer.notifyDepartment(ticket, {
      config: cfg,
      mailer: { send: async () => ({ ok: true }) },
      logger: { info: () => {}, error: () => {} },
    });
    expect(ok.ok).toBe(true);
    const events = await store.listTicketEvents(ticket.id);
    const out = events.find((e) => e.kind === "email_out");
    expect(out?.meta).toMatchObject({ ok: true });
    expect(out?.body).toContain("ops@wow.co");

    // Unconfigured: returns not-ok, adds no event.
    const t2 = await store.createTicket({ category: "other", subject: "x" });
    const res = await mailer.notifyDepartment(t2, {
      config: null,
      mailer: null,
      logger: { info: () => {}, error: () => {} },
    });
    expect(res.ok).toBe(false);
    const e2 = await store.listTicketEvents(t2.id);
    expect(e2.some((e) => e.kind === "email_out")).toBe(false);
  });

  it("diverts a test ticket to the override recipient and tags the email", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const ticket = await store.createTicket({
      category: "edit_request",
      subject: "Brighten kitchen",
      isTest: true,
    });
    // Real routing would send to edits@wow.co; the override wins.
    expect(ticket.number.startsWith("TEST-")).toBe(true);
    const email = mailer.formatDepartmentEmail(ticket, cfg, "boss@wow.co");
    expect(email.subject).toBe(`[TEST] [${ticket.number}] Brighten kitchen`);
    expect(email.textBody).toContain("TEST TICKET");

    let sentTo: string | null = null;
    const ok = await mailer.notifyDepartment(ticket, {
      config: cfg,
      overrideTo: "boss@wow.co",
      mailer: {
        send: async (msg) => {
          sentTo = msg.to;
          return { ok: true };
        },
      },
      logger: { info: () => {}, error: () => {} },
    });
    expect(ok.ok).toBe(true);
    expect(sentTo).toBe("boss@wow.co");
  });
});

describe("forwarding a client's reply to the department", () => {
  const QUIET = { info: () => {}, error: () => {} };

  /** Captures the one message the forward would send. */
  function capture() {
    const sent: import("./ticket-mailer.js").OutboundEmail[] = [];
    return {
      sent,
      mailer: {
        send: async (msg: import("./ticket-mailer.js").OutboundEmail) => {
          sent.push(msg);
          return { ok: true };
        },
      },
    };
  }

  async function replyTicket(overrides: Record<string, unknown> = {}) {
    return store.createTicket({
      category: "edit_request",
      subject: "Brighten kitchen",
      description: "Please brighten the kitchen photos.",
      requesterName: "Dana Agent",
      requesterEmail: "dana@example.com",
      orderAddress: "5 Elm St",
      ...overrides,
    });
  }

  it("sends the client's words to the department, answerable on the thread", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const ticket = await replyTicket();
    const cap = capture();
    const res = await mailer.forwardClientReplyToDepartment(
      ticket,
      { fromEmail: "dana@example.com", message: "Any update on this?" },
      { config: cfg, mailer: cap.mailer, logger: QUIET },
    );

    expect(res.ok).toBe(true);
    const msg = cap.sent[0];
    expect(msg.to).toBe("edits@wow.co");
    expect(msg.subject).toBe(`[${ticket.number}] Client reply — Brighten kitchen`);
    // The desk replying to THIS email must drive the ticket, exactly as
    // replying to the original notification does.
    expect(msg.replyTo).toBe(`ticket+${ticket.replyToken}@tickets.wowvideotours.com`);
    expect(msg.textBody).toContain("Any update on this?");
    expect(msg.textBody).toContain("Dana Agent (dana@example.com)");
    expect(msg.htmlBody).toContain("Any update on this?");
    // The desk is told what state the ticket is in without opening it.
    expect(msg.textBody).toContain("flagged for review");
    expect(msg.textBody).toContain("RESOLVED");
  });

  it("records the forward on the ticket thread", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const ticket = await replyTicket();
    const cap = capture();
    await mailer.forwardClientReplyToDepartment(
      ticket,
      { fromEmail: "dana@example.com", message: "Any update?" },
      { config: cfg, mailer: cap.mailer, logger: QUIET },
    );
    const events = await store.listTicketEvents(ticket.id);
    expect(
      events.some((e) => e.kind === "email_out" && (e.body ?? "").includes("Forwarded the client")),
    ).toBe(true);
  });

  // A reply can arrive from an assistant, a co-agent, or a spoofer. The desk
  // decides what to do with it, but it must be able to see which it was.
  it("marks a reply from an address other than the ticket's", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const ticket = await replyTicket();
    const cap = capture();
    await mailer.forwardClientReplyToDepartment(
      ticket,
      { fromEmail: "someone-else@example.com", message: "Hello" },
      { config: cfg, mailer: cap.mailer, logger: QUIET },
    );
    const msg = cap.sent[0];
    expect(msg.textBody).toContain("not the one on the ticket");
    expect(msg.htmlBody).toContain("not the one on the ticket");
  });

  it("says nothing about the sender's address when it matches the ticket", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const ticket = await replyTicket();
    const cap = capture();
    await mailer.forwardClientReplyToDepartment(
      ticket,
      { fromEmail: "dana@example.com", message: "Hello" },
      { config: cfg, mailer: cap.mailer, logger: QUIET },
    );
    expect(cap.sent[0].textBody).not.toContain("not the one on the ticket");
  });

  // The inbound webhook carries no test grant, so a rehearsal has no authorized
  // recipient — and a real desk must never be paged about a demo.
  it("refuses to forward a test ticket's reply to a real desk", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const ticket = await replyTicket({ isTest: true });
    const cap = capture();
    const res = await mailer.forwardClientReplyToDepartment(
      ticket,
      { fromEmail: "dana@example.com", message: "Hello" },
      { config: cfg, mailer: cap.mailer, logger: QUIET },
    );
    expect(res.ok).toBe(false);
    expect(res.detail).toBe("test ticket without override recipient");
    expect(cap.sent).toHaveLength(0);
  });

  it("forwards a test ticket's reply to the authorized override instead", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const ticket = await replyTicket({ isTest: true });
    const cap = capture();
    const res = await mailer.forwardClientReplyToDepartment(
      ticket,
      { fromEmail: "dana@example.com", message: "Hello" },
      { config: cfg, mailer: cap.mailer, overrideTo: "boss@wow.co", logger: QUIET },
    );
    expect(res.ok).toBe(true);
    expect(cap.sent[0].to).toBe("boss@wow.co");
    expect(cap.sent[0].subject).toMatch(/^\[TEST\] /);
  });

  it("no-ops when email is unconfigured rather than throwing", async () => {
    const ticket = await replyTicket();
    const res = await mailer.forwardClientReplyToDepartment(
      ticket,
      { fromEmail: "dana@example.com", message: "Hello" },
      { config: null, mailer: null, logger: QUIET },
    );
    expect(res.ok).toBe(false);
    expect(res.detail).toBe("email not configured");
    const events = await store.listTicketEvents(ticket.id);
    expect(events.some((e) => e.kind === "email_out")).toBe(false);
  });
});
