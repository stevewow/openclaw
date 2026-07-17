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
