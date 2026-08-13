import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { EmailConfig, OutboundEmail, SendResult, TicketMailer } from "./ticket-mailer.js";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-client-notify-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./ticket-store.js");
const notify = await import("./ticket-client-notify.js");

const CONFIG: EmailConfig = {
  provider: "postmark",
  serverToken: "tok",
  from: "steve@wowvideotours.com",
  inboundAddress: "ticket@tickets.wowvideotours.com",
  messageStream: "outbound",
  departmentEmails: {},
  fallbackTo: null,
};

/** Captures what would have been sent, so nothing here touches the network. */
class CapturingMailer implements TicketMailer {
  sent: OutboundEmail[] = [];
  async send(msg: OutboundEmail): Promise<SendResult> {
    this.sent.push(msg);
    return { ok: true };
  }
}

const ENV = {
  SUPPORT_BASE_URL: "https://hub.wowvideotours.com",
  TICKET_SUPPORT_EMAIL: "support@wowvideotours.com",
} as unknown as NodeJS.ProcessEnv;

const QUIET = { info: () => {}, error: () => {} };

function deps(mailer: TicketMailer) {
  return { config: CONFIG, mailer, env: ENV, logger: QUIET };
}

async function newTicket(overrides: Partial<Parameters<typeof store.createTicket>[0]> = {}) {
  return store.createTicket({
    category: "edit_request",
    subject: "Edit request — Photos",
    description: "Please brighten the kitchen photos.",
    source: "widget",
    requesterName: "Dana Agent",
    requesterEmail: "dana@example.com",
    orderAddress: "5 Elm St",
    ...overrides,
  });
}

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("client confirmation email", () => {
  it("emails the requester, threading on the ticket's reply address", async () => {
    const ticket = await newTicket();
    const mailer = new CapturingMailer();
    const result = await notify.notifyClientTicketCreated(ticket, deps(mailer));

    expect(result.ok).toBe(true);
    expect(mailer.sent).toHaveLength(1);
    const msg = mailer.sent[0];
    expect(msg.to).toBe("dana@example.com");
    expect(msg.subject).toBe(`[${ticket.number}] We've got your request`);
    // A client reply has to land back on the ticket, not in the from-mailbox.
    expect(msg.replyTo).toBe(`ticket+${ticket.replyToken}@tickets.wowvideotours.com`);
    expect(msg.textBody).toContain(ticket.number);
    expect(msg.textBody).toContain("Hi Dana,");
    expect(msg.htmlBody).toContain("5 Elm St");

    // The attempt is on the thread, marked as the client's copy so it can be
    // told apart from the department's.
    const events = await store.listTicketEvents(ticket.id);
    const out = events.filter((e) => e.kind === "email_out");
    expect(out).toHaveLength(1);
    expect(out[0].meta?.audience).toBe("client");
  });

  it("sends nothing when the client unticked updates on the form", async () => {
    const ticket = await newTicket({ notifyClient: false });
    const mailer = new CapturingMailer();
    const result = await notify.notifyClientTicketCreated(ticket, deps(mailer));

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe("client opted out of updates");
    expect(mailer.sent).toHaveLength(0);
    // A send that never happened must not leave a line claiming it did.
    const events = await store.listTicketEvents(ticket.id);
    expect(events.filter((e) => e.kind === "email_out")).toHaveLength(0);
  });

  it("sends nothing when the ticket has no requester email", async () => {
    const ticket = await newTicket({ requesterEmail: null });
    const mailer = new CapturingMailer();
    const result = await notify.notifyClientTicketCreated(ticket, deps(mailer));
    expect(result.skipped).toBe("no requester email");
    expect(mailer.sent).toHaveLength(0);
  });

  it("keeps a demo off a real client's inbox unless an override says where", async () => {
    const ticket = await newTicket({ isTest: true, requesterEmail: "real.client@example.com" });
    const blocked = new CapturingMailer();
    expect((await notify.notifyClientTicketCreated(ticket, deps(blocked))).skipped).toBe(
      "test ticket with no override recipient",
    );
    expect(blocked.sent).toHaveLength(0);

    const diverted = new CapturingMailer();
    await notify.notifyClientTicketCreated(ticket, {
      ...deps(diverted),
      overrideTo: "admin@wowvideotours.com",
    });
    expect(diverted.sent[0].to).toBe("admin@wowvideotours.com");
  });

  it("no-ops when email is unconfigured, rather than throwing", async () => {
    const ticket = await newTicket();
    const result = await notify.notifyClientTicketCreated(ticket, {
      config: null,
      mailer: null,
      env: ENV,
      logger: QUIET,
    });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe("email not configured");
  });
});

describe("client resolution email", () => {
  it("carries the support address and a working thumb link each way", async () => {
    const ticket = await newTicket();
    const mailer = new CapturingMailer();
    await notify.notifyClientTicketResolved(ticket, deps(mailer));

    const msg = mailer.sent[0];
    expect(msg.subject).toBe(`[${ticket.number}] Your request is complete`);
    expect(msg.textBody).toContain("support@wowvideotours.com");
    expect(msg.htmlBody).toContain("mailto:support@wowvideotours.com");

    // The token in the links has to be the one the page can actually look up.
    const stored = (await store.getTicket(ticket.id))!;
    expect(stored.feedbackToken).toBeTruthy();
    const upUrl = `https://hub.wowvideotours.com/support/feedback?t=${encodeURIComponent(stored.feedbackToken!)}&r=up`;
    expect(msg.textBody).toContain(upUrl);
    // In HTML the separator is entity-escaped, which is what makes the href
    // valid markup — assert the escaped form rather than the raw one.
    expect(msg.htmlBody).toContain(upUrl.replace("&r=up", "&amp;r=up"));
    expect(msg.htmlBody).toContain("&amp;r=down");
  });

  it("reuses the feedback token, so a link in an email already sent keeps working", async () => {
    const ticket = await newTicket();
    await notify.notifyClientTicketResolved(ticket, deps(new CapturingMailer()));
    const first = (await store.getTicket(ticket.id))!.feedbackToken;

    const again = (await store.getTicket(ticket.id))!;
    await notify.notifyClientTicketResolved(again, deps(new CapturingMailer()));
    expect((await store.getTicket(ticket.id))!.feedbackToken).toBe(first);
  });

  it("fires on the move into resolved, and not on a re-save of a resolved ticket", async () => {
    const ticket = await newTicket();
    const mailer = new CapturingMailer();

    // Any other transition owes the client nothing.
    const working = (await store.updateTicket(ticket.id, { status: "in_progress" }))!;
    expect(await notify.notifyClientOnResolution(ticket, working, deps(mailer))).toBeNull();
    expect(mailer.sent).toHaveLength(0);

    const resolved = (await store.updateTicket(ticket.id, { status: "resolved" }))!;
    expect(await notify.notifyClientOnResolution(working, resolved, deps(mailer))).not.toBeNull();
    expect(mailer.sent).toHaveLength(1);

    // Saving a priority change on an already-resolved ticket must not re-send.
    const touched = (await store.updateTicket(ticket.id, { priority: "high" }))!;
    expect(await notify.notifyClientOnResolution(resolved, touched, deps(mailer))).toBeNull();
    expect(mailer.sent).toHaveLength(1);
  });

  it("emails again when a reopened ticket is resolved a second time", async () => {
    const ticket = await newTicket();
    const mailer = new CapturingMailer();
    const resolved = (await store.updateTicket(ticket.id, { status: "resolved" }))!;
    await notify.notifyClientOnResolution(ticket, resolved, deps(mailer));

    const reopened = (await store.updateTicket(ticket.id, { status: "in_progress" }))!;
    const again = (await store.updateTicket(ticket.id, { status: "resolved" }))!;
    await notify.notifyClientOnResolution(reopened, again, deps(mailer));
    expect(mailer.sent).toHaveLength(2);
  });

  it("stays silent for a client who opted out, even on resolution", async () => {
    const ticket = await newTicket({ notifyClient: false });
    const mailer = new CapturingMailer();
    const resolved = (await store.updateTicket(ticket.id, { status: "resolved" }))!;
    await notify.notifyClientOnResolution(ticket, resolved, deps(mailer));
    expect(mailer.sent).toHaveLength(0);
  });
});
