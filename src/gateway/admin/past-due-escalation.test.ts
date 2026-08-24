import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { EmailConfig, OutboundEmail, SendResult } from "./ticket-mailer.js";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-past-due-escalation-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const escalation = await import("./past-due-escalation.js");
const cases = await import("./past-due-cases-store.js");
const events = await import("./past-due-events-store.js");
const financials = await import("./financials-store.js");

const CONFIG: EmailConfig = {
  provider: "postmark",
  serverToken: "token",
  from: "billing@example.com",
  inboundAddress: "tickets@example.com",
  messageStream: "outbound",
  departmentEmails: {},
  fallbackTo: null,
  logoUrl: "https://example.com/logo.png",
};

/** Collects what would have been sent, so a test can read the letter. */
function recordingMailer(result: SendResult = { ok: true }) {
  const sent: OutboundEmail[] = [];
  return {
    sent,
    mailer: {
      send: async (msg: OutboundEmail) => {
        sent.push(msg);
        return result;
      },
    },
  };
}

let collectorId: string;
let adminId: string;

beforeAll(async () => {
  const userStore = await import("./user-store.js");
  collectorId = (
    await userStore.createUser({
      username: "collector",
      password: "x",
      role: "user",
      firstName: "Casey",
      lastName: "Ruiz",
    })
  ).id;
  adminId = (
    await userStore.createUser({
      username: "owner",
      password: "x",
      role: "superadmin",
      firstName: "Dana",
      lastName: "Vega",
      email: "dana@example.com",
    })
  ).id;
});

describe("who owns an escalation", () => {
  const base = { username: "u", email: null, firstName: null, lastName: null };

  it("hands it to the superadmin over a plain admin", () => {
    const owner = escalation.resolveEscalationOwner([
      { ...base, id: "a", role: "admin", createdAt: 1 },
      { ...base, id: "b", role: "superadmin", createdAt: 9 },
    ]);
    expect(owner?.id).toBe("b");
  });

  it("falls back to an admin when there is no superadmin", () => {
    const owner = escalation.resolveEscalationOwner([
      { ...base, id: "a", role: "user", createdAt: 1 },
      { ...base, id: "b", role: "admin", createdAt: 2 },
    ]);
    expect(owner?.id).toBe("b");
  });

  it("picks the earliest-created of several, so the answer is stable", () => {
    const users = [
      { ...base, id: "late", role: "admin", createdAt: 20 },
      { ...base, id: "early", role: "admin", createdAt: 10 },
    ];
    expect(escalation.resolveEscalationOwner(users)?.id).toBe("early");
    expect(escalation.resolveEscalationOwner(users.toReversed())?.id).toBe("early");
  });

  it("names the person, falling back to the login when no name is on file", () => {
    expect(
      escalation.resolveEscalationOwner([
        { ...base, id: "a", role: "admin", username: "dvega", firstName: "Dana", lastName: "Vega" },
      ])?.name,
    ).toBe("Dana Vega");
    expect(
      escalation.resolveEscalationOwner([{ ...base, id: "a", role: "admin", username: "dvega" }])
        ?.name,
    ).toBe("dvega");
  });

  it("has nobody to hand it to when no admin exists", () => {
    expect(escalation.resolveEscalationOwner([{ ...base, id: "a", role: "user" }])).toBeNull();
    expect(escalation.resolveEscalationOwner([])).toBeNull();
  });
});

describe("the escalation letter", () => {
  const params = {
    accountKey: "agent:acme",
    accountName: "Acme Realty",
    balance: 1234.5,
    invoiceCount: 3,
    oldestDaysPastDue: 127,
    actorName: "Casey Ruiz",
    recipientName: "Dana Vega",
    reason: "No response to four calls.",
    lastContactAt: Date.UTC(2026, 7, 3),
    config: CONFIG,
    to: "dana@example.com",
  };

  it("carries the facts the letter is written from", () => {
    const msg = escalation.formatEscalationEmail(params);
    expect(msg.to).toBe("dana@example.com");
    expect(msg.subject).toContain("Acme Realty");
    expect(msg.subject).toContain("$1,234.50");
    expect(msg.textBody).toContain("Casey Ruiz escalated Acme Realty");
    expect(msg.textBody).toContain("> No response to four calls.");
    expect(msg.textBody).toContain("Balance: $1,234.50");
    expect(msg.textBody).toContain("3 past due, oldest 127 days");
    expect(msg.textBody).toContain("Aug 3, 2026");
  });

  it("links straight to the account on the Past Due page", () => {
    const msg = escalation.formatEscalationEmail(params);
    expect(msg.textBody).toContain("#past-due?account=agent%3Aacme");
  });

  it("says so plainly when nobody has logged a contact yet", () => {
    const msg = escalation.formatEscalationEmail({ ...params, lastContactAt: null, reason: null });
    expect(msg.textBody).toContain("Last contact: none logged");
    expect(msg.textBody).not.toContain(">");
  });

  it("points a reply at a human rather than an address nobody reads", () => {
    expect(escalation.formatEscalationEmail(params).replyTo).toBe(CONFIG.from);
  });
});

describe("escalating an account", () => {
  it("moves ownership, pins the letter step, and tells the new owner", async () => {
    const { sent, mailer } = recordingMailer();
    const result = await escalation.escalatePastDueCase(
      {
        accountKey: "agent:handoff",
        accountName: "Handoff Realty",
        reason: "Four calls, no answer.",
        actor: { id: collectorId, name: "Casey Ruiz" },
        facts: { balance: 900, invoiceCount: 2, oldestDaysPastDue: 130, lastContactAt: 1_000 },
      },
      { config: CONFIG, mailer },
    );

    expect(result.case.status).toBe("escalated");
    expect(result.case.assignedTo).toBe(adminId);
    expect(result.case.nextAction).toBe(escalation.ESCALATION_ACTION_KEY);
    expect(result.case.escalatedBy).toBe(collectorId);
    expect(result.case.escalatedByName).toBe("Casey Ruiz");
    expect(result.case.escalatedReason).toBe("Four calls, no answer.");
    expect(result.owner?.name).toBe("Dana Vega");
    expect(result.notified?.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("dana@example.com");
  });

  it("writes the handoff to the timeline and the notes thread", async () => {
    const { mailer } = recordingMailer();
    await escalation.escalatePastDueCase(
      {
        accountKey: "agent:trail",
        accountName: "Trail Realty",
        reason: "Broken promise twice.",
        actor: { id: collectorId, name: "Casey Ruiz" },
      },
      { config: CONFIG, mailer },
    );
    const trail = await events.listPastDueEvents("agent:trail");
    expect(trail[0]?.kind).toBe("escalation");
    expect(trail[0]?.summary).toContain("Dana Vega");
    expect(trail[0]?.actorName).toBe("Casey Ruiz");
    const notes = await financials.listNotes("agent:trail");
    expect(notes[0]?.body).toBe("Escalated: Broken promise twice.");
    expect(notes[0]?.createdByName).toBe("Casey Ruiz");
  });

  it("names who it came off, so the trail has both people", async () => {
    await cases.assignPastDueCase({
      accountKey: "agent:from",
      accountName: "From Realty",
      assignedTo: collectorId,
      byUserId: adminId,
      byUserName: "Dana Vega",
    });
    const { mailer } = recordingMailer();
    const result = await escalation.escalatePastDueCase(
      {
        accountKey: "agent:from",
        accountName: "From Realty",
        reason: null,
        actor: { id: collectorId, name: "Casey Ruiz" },
      },
      { config: CONFIG, mailer },
    );
    expect(result.case.escalatedFrom).toBe(collectorId);
    expect(result.case.assignedTo).toBe(adminId);
  });

  it("leaves a deliberately chosen step alone", async () => {
    await cases.setPastDueCaseNextAction({
      accountKey: "agent:pinned",
      accountName: "Pinned Realty",
      nextAction: "call_60",
      byUserName: "Casey Ruiz",
    });
    const { mailer } = recordingMailer();
    const result = await escalation.escalatePastDueCase(
      {
        accountKey: "agent:pinned",
        accountName: "Pinned Realty",
        reason: null,
        actor: { id: collectorId, name: "Casey Ruiz" },
        hasPinnedAction: true,
      },
      { config: CONFIG, mailer },
    );
    expect(result.case.nextAction).toBe("call_60");
    expect(result.case.status).toBe("escalated");
  });

  it("does not email the escalator their own handoff", async () => {
    const { sent, mailer } = recordingMailer();
    const result = await escalation.escalatePastDueCase(
      {
        accountKey: "agent:self",
        accountName: "Self Realty",
        reason: null,
        actor: { id: adminId, name: "Dana Vega" },
      },
      { config: CONFIG, mailer },
    );
    expect(result.case.status).toBe("escalated");
    expect(result.notified).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it("still escalates when mail is not configured", async () => {
    const result = await escalation.escalatePastDueCase(
      {
        accountKey: "agent:nomail",
        accountName: "No Mail Realty",
        reason: null,
        actor: { id: collectorId, name: "Casey Ruiz" },
      },
      { config: null, mailer: null, logger: { info: () => {}, error: () => {} } },
    );
    expect(result.case.status).toBe("escalated");
    expect(result.notified).toBeNull();
  });

  it("still escalates when the send fails", async () => {
    const { mailer } = recordingMailer({ ok: false, detail: "provider down" });
    const result = await escalation.escalatePastDueCase(
      {
        accountKey: "agent:senderror",
        accountName: "Send Error Realty",
        reason: null,
        actor: { id: collectorId, name: "Casey Ruiz" },
      },
      { config: CONFIG, mailer, logger: { info: () => {}, error: () => {} } },
    );
    expect(result.case.status).toBe("escalated");
    expect(result.notified?.ok).toBe(false);
    expect((await cases.getPastDueCase("agent:senderror"))?.status).toBe("escalated");
  });

  it("escalates with nobody to hand it to, leaving the case where it is", async () => {
    const result = await escalation.escalatePastDueCase(
      {
        accountKey: "agent:noowner",
        accountName: "No Owner Realty",
        reason: null,
        actor: { id: collectorId, name: "Casey Ruiz" },
      },
      { loadUsers: async () => [], logger: { info: () => {}, error: () => {} } },
    );
    expect(result.case.status).toBe("escalated");
    expect(result.case.assignedTo).toBeNull();
    expect(result.owner).toBeNull();
    const trail = await events.listPastDueEvents("agent:noowner");
    expect(trail[0]?.summary).toContain("no escalation owner");
  });
});
