import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { EmailConfig, OutboundEmail, SendResult } from "./ticket-mailer.js";

const CONFIG: EmailConfig = {
  provider: "postmark",
  serverToken: "token",
  from: "hub@wowvideotours.com",
  inboundAddress: "hub@wowvideotours.com",
  messageStream: "outbound",
  departmentEmails: {},
  fallbackTo: null,
  logoUrl: "https://example.com/logo.png",
};

/** Captures what would have been sent, and can be told to fail. */
function recorder(ok = true) {
  const sent: OutboundEmail[] = [];
  return {
    sent,
    mailer: {
      send: async (msg: OutboundEmail): Promise<SendResult> => {
        sent.push(msg);
        return ok ? { ok: true } : { ok: false, detail: "postmark 422: inactive recipient" };
      },
    },
  };
}

const quiet = { info: () => {}, error: () => {} };

describe("dispatching a lead", () => {
  let tmpDir: string;
  let store: typeof import("./lead-store.js");
  let notify: typeof import("./lead-notify.js");

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lead-notify-test-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    store = await import("./lead-store.js");
    notify = await import("./lead-notify.js");
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const settings = {
    fallbackTo: "steve@wowvideotours.com",
    digestTo: "steve@wowvideotours.com",
    digestHour: 7,
    digestTimeZone: "America/New_York",
  };

  it("emails the territory owner and marks the lead sent", async () => {
    const lead = await store.createLead({
      name: "Dana Reyes",
      email: "dana@brokerage.com",
      phone: "(614) 555-0111",
      marketRaw: "Columbus",
      territoryKey: "columbus",
      ownerName: "Chris Voge",
      ownerEmail: "chris@example.com",
    });
    const rec = recorder();
    const result = await notify.dispatchLead(lead, {
      config: CONFIG,
      mailer: rec.mailer,
      settings,
      logger: quiet,
    });
    expect(result.ok).toBe(true);
    expect(rec.sent[0].to).toBe("chris@example.com");
    expect(rec.sent[0].subject).toContain("Dana Reyes");
    expect(rec.sent[0].subject).toContain("Columbus");
    // Replying answers the lead, not the Hub.
    expect(rec.sent[0].replyTo).toBe("dana@brokerage.com");
    expect(rec.sent[0].textBody).toContain("(614) 555-0111");
    const read = await store.getLead(lead.id);
    expect(read?.notifiedAt).toBeGreaterThan(0);
    expect((await store.listLeadEvents(lead.id)).at(-1)?.body).toContain("chris@example.com");
  });

  it("sends an unrouted lead to the fallback address and says so in the email", async () => {
    const lead = await store.createLead({ name: "No Market", email: "nm@x.com" });
    const rec = recorder();
    await notify.dispatchLead(lead, {
      config: CONFIG,
      mailer: rec.mailer,
      settings,
      logger: quiet,
    });
    expect(rec.sent[0].to).toBe("steve@wowvideotours.com");
    expect(rec.sent[0].textBody).toContain("No territory owner matched");
    expect(rec.sent[0].htmlBody).toContain("No territory owner matched this market");
  });

  it("records why nothing was sent when there is no address at all", async () => {
    const lead = await store.createLead({ name: "Nowhere", email: "nw@x.com" });
    const rec = recorder();
    const result = await notify.dispatchLead(lead, {
      config: CONFIG,
      mailer: rec.mailer,
      settings: { ...settings, fallbackTo: null },
      logger: quiet,
    });
    expect(result.ok).toBe(false);
    expect(rec.sent).toHaveLength(0);
    const read = await store.getLead(lead.id);
    expect(read?.notifyError).toContain("no territory matched");
  });

  it("keeps the lead when the mail provider refuses it", async () => {
    const lead = await store.createLead({
      name: "Bounced",
      email: "b@x.com",
      ownerEmail: "chris@example.com",
      ownerName: "Chris Voge",
      territoryKey: "columbus",
    });
    const rec = recorder(false);
    const result = await notify.dispatchLead(lead, {
      config: CONFIG,
      mailer: rec.mailer,
      settings,
      logger: quiet,
    });
    expect(result.ok).toBe(false);
    const read = await store.getLead(lead.id);
    expect(read?.notifiedAt).toBeNull();
    expect(read?.notifyError).toContain("inactive recipient");
  });

  it("does not throw when email is not configured", async () => {
    const lead = await store.createLead({ name: "Unconfigured", email: "u@x.com" });
    const result = await notify.dispatchLead(lead, {
      config: null,
      mailer: null,
      settings,
      logger: quiet,
    });
    expect(result.ok).toBe(false);
    expect((await store.getLead(lead.id))?.notifyError).toBe("email not configured");
  });
});

describe("the tips in the dispatch email", () => {
  let store: typeof import("./lead-store.js");
  let notify: typeof import("./lead-notify.js");
  const settings = {
    fallbackTo: "steve@wowvideotours.com",
    digestTo: "steve@wowvideotours.com",
    digestHour: 7,
    digestTimeZone: "America/New_York",
  };

  beforeAll(async () => {
    store = await import("./lead-store.js");
    notify = await import("./lead-notify.js");
  });

  async function dispatchWith(over: Record<string, unknown>) {
    const lead = await store.createLead({
      name: "Dana Reyes",
      email: "dana@brokerage.com",
      ownerName: "Chris Voge",
      ownerEmail: "chris@example.com",
      territoryKey: "columbus",
      marketRaw: "Columbus",
      ...over,
    });
    const rec = recorder();
    await notify.dispatchLead(lead, {
      config: CONFIG,
      mailer: rec.mailer,
      settings,
      logger: quiet,
    });
    return rec.sent[0];
  }

  it("carries the opener, the soft close and the cadence for the source it came in on", async () => {
    const sent = await dispatchWith({ playbookKey: "pricing_list" });
    expect(sent.textBody).toContain("Comparing vendors right now");
    expect(sent.textBody).toContain("Looks like you're pricing out media");
    expect(sent.textBody).toContain("What's the property?");
    expect(sent.textBody).toContain("1. Within 24 hours — Call. Voicemail + text if no answer.");
    expect(sent.textBody).toContain('3. Day 7 — Call. "Did you get that shoot handled?"');
    expect(sent.htmlBody).toContain("Pricing List");
    expect(sent.htmlBody).toContain("Soft close");
  });

  it("shows only that source's tips, never the other two", async () => {
    const sent = await dispatchWith({ playbookKey: "getting_ready_guide" });
    expect(sent.textBody).toContain("listing coming up");
    expect(sent.textBody).not.toContain("pricing out media");
    expect(sent.textBody).not.toContain("listing presentation");
    expect(sent.htmlBody).not.toContain("Pricing List");
  });

  it("greets them by their first name", async () => {
    const sent = await dispatchWith({ playbookKey: "listing_presentation", name: "Dana Reyes" });
    expect(sent.textBody).toContain("Hey Dana, Taylor with WOW Video Tours");
    expect(sent.textBody).not.toContain("[Name]");
  });

  it("says where the lead goes after three attempts", async () => {
    const sent = await dispatchWith({ playbookKey: "getting_ready_guide" });
    expect(sent.textBody).toContain("After 3 attempts with no answer");
    expect(sent.textBody).toContain("quarterly check-in");
    expect(sent.htmlBody).toContain("After 3 attempts with no answer");
  });

  it("sends the plain email when the form matched no playbook", async () => {
    const sent = await dispatchWith({ playbookKey: null });
    expect(sent.textBody).toContain("Dana Reyes");
    expect(sent.textBody).not.toContain("Taylor with WOW Video Tours");
    expect(sent.textBody).not.toContain("Cadence:");
  });
});

describe("counting days in the sales team's own timezone", () => {
  let notify: typeof import("./lead-notify.js");
  const TZ = "America/New_York";

  beforeAll(async () => {
    notify = await import("./lead-notify.js");
  });

  it("files an evening lead under the day it was Eastern, not UTC", () => {
    // 2026-08-25 20:30 Eastern is already 2026-08-26 in UTC.
    const instant = Date.parse("2026-08-26T00:30:00Z");
    expect(notify.localDay(instant, TZ)).toBe("2026-08-25");
  });

  it("puts midnight Eastern at the right instant on both sides of a DST change", () => {
    // EDT (UTC-4) in August, EST (UTC-5) in January.
    expect(new Date(notify.startOfLocalDay("2026-08-25", TZ)).toISOString()).toBe(
      "2026-08-25T04:00:00.000Z",
    );
    expect(new Date(notify.startOfLocalDay("2026-01-15", TZ)).toISOString()).toBe(
      "2026-01-15T05:00:00.000Z",
    );
  });

  it("steps back a day across the spring-forward boundary", () => {
    // 2026-03-08 is the short day; the day before it is still 2026-03-07.
    expect(notify.previousDay("2026-03-08", TZ)).toBe("2026-03-07");
    expect(notify.previousDay("2026-01-01", TZ)).toBe("2025-12-31");
  });

  it("names the day the way the digest's subject line does", () => {
    expect(notify.formatDayLabel("2026-08-25", TZ)).toBe("Tuesday, August 25");
  });
});

describe("the morning digest", () => {
  let tmpDir: string;
  let store: typeof import("./lead-store.js");
  let notify: typeof import("./lead-notify.js");
  const TZ = "America/New_York";
  const settings = {
    fallbackTo: null,
    digestTo: "steve@wowvideotours.com",
    digestHour: 7,
    digestTimeZone: TZ,
  };
  /** 07:30 Eastern on the 26th — inside the send window, reporting the 25th. */
  const morning = Date.parse("2026-08-26T11:30:00Z");

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lead-digest-test-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    store = await import("./lead-store.js");
    notify = await import("./lead-notify.js");
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("holds off before the configured hour", async () => {
    const rec = recorder();
    const outcome = await notify.runLeadDigest({
      config: CONFIG,
      mailer: rec.mailer,
      settings,
      logger: quiet,
      now: Date.parse("2026-08-26T09:30:00Z"), // 05:30 Eastern
    });
    expect(outcome).toEqual({ sent: false, reason: "too_early" });
    expect(rec.sent).toHaveLength(0);
  });

  it("says nothing on a day with no leads, but does not keep checking all day", async () => {
    const rec = recorder();
    const first = await notify.runLeadDigest({
      config: CONFIG,
      mailer: rec.mailer,
      settings,
      logger: quiet,
      now: morning,
    });
    expect(first).toEqual({ sent: false, reason: "no_leads", day: "2026-08-25" });
    expect(rec.sent).toHaveLength(0);
    const second = await notify.runLeadDigest({
      config: CONFIG,
      mailer: rec.mailer,
      settings,
      logger: quiet,
      now: morning + 60 * 60 * 1000,
    });
    expect(second).toEqual({ sent: false, reason: "already_sent", day: "2026-08-25" });
  });

  it("retries a refused summary, then sends the day's leads once", async () => {
    // Dated from the clock the leads are actually created on: the digest covers
    // the day before the one it fires in, so the fire time is tomorrow morning.
    // The whole file shares one database, so this asserts on what it can see
    // rather than on an exact count.
    const today = notify.localDay(Date.now(), TZ);
    const tomorrow = notify.localDay(notify.startOfLocalDay(today, TZ) + 36 * 60 * 60 * 1000, TZ);
    const fireAt = notify.startOfLocalDay(tomorrow, TZ) + 8 * 60 * 60 * 1000;
    await store.createLead({
      name: "Dana Reyes",
      email: "dana@brokerage.com",
      marketRaw: "Columbus",
      territoryKey: "columbus",
      ownerName: "Chris Voge",
      ownerEmail: "chris@example.com",
    });
    await store.createLead({ name: "No Market", phone: "6145550111" });

    // A refused send is not logged as sent, so the summary is not lost.
    const refused = recorder(false);
    const first = await notify.runLeadDigest({
      config: CONFIG,
      mailer: refused.mailer,
      settings,
      logger: quiet,
      now: fireAt,
    });
    expect(first).toEqual({ sent: false, reason: "send_failed", day: today });

    const rec = recorder();
    const outcome = await notify.runLeadDigest({
      config: CONFIG,
      mailer: rec.mailer,
      settings,
      logger: quiet,
      now: fireAt + 60 * 60 * 1000,
    });
    expect(outcome.sent).toBe(true);
    if (outcome.sent) {
      expect(outcome.day).toBe(today);
      expect(outcome.leadCount).toBeGreaterThanOrEqual(2);
    }
    expect(rec.sent).toHaveLength(1);
    expect(rec.sent[0].to).toBe("steve@wowvideotours.com");
    expect(rec.sent[0].subject).toContain("new leads");
    expect(rec.sent[0].textBody).toContain("Dana Reyes");
    expect(rec.sent[0].textBody).toContain("UNASSIGNED");

    // Same morning, another tick: nothing goes out twice.
    const again = await notify.runLeadDigest({
      config: CONFIG,
      mailer: rec.mailer,
      settings,
      logger: quiet,
      now: fireAt + 2 * 60 * 60 * 1000,
    });
    expect(again).toEqual({ sent: false, reason: "already_sent", day: today });
    expect(rec.sent).toHaveLength(1);
  });

  it("is a no-op without a digest address", async () => {
    const rec = recorder();
    const outcome = await notify.runLeadDigest({
      config: CONFIG,
      mailer: rec.mailer,
      settings: { ...settings, digestTo: null },
      logger: quiet,
      now: morning,
    });
    expect(outcome).toEqual({ sent: false, reason: "not_configured" });
  });
});

describe("what the digest says", () => {
  let render: typeof import("./lead-email-render.js");

  beforeAll(async () => {
    render = await import("./lead-email-render.js");
  });

  const lead = (over: Record<string, unknown>) =>
    ({
      id: "id",
      number: "LEAD-1001",
      source: "framer",
      formName: null,
      submissionId: null,
      name: "Dana Reyes",
      email: "dana@brokerage.com",
      phone: null,
      company: null,
      message: null,
      marketRaw: "Columbus",
      territoryKey: "columbus",
      ownerName: "Chris Voge",
      ownerEmail: "chris@example.com",
      status: "new",
      pageUrl: null,
      fields: [],
      notifiedAt: null,
      notifyError: null,
      createdAt: 0,
      updatedAt: 0,
      ...over,
    }) as import("./lead-store.js").Lead;

  it("counts the day's leads in the subject", () => {
    const view = {
      dayLabel: "Tuesday, August 25",
      leads: [lead({}), lead({ id: "b" })],
      logoUrl: "",
      hubUrl: "https://hub.example.com/admin#leads",
    };
    expect(render.digestSubject(view)).toBe("2 new leads — Tuesday, August 25");
    expect(render.renderDigestText(view)).toContain("Chris Voge");
  });

  it("calls out the ones nobody owns", () => {
    const view = {
      dayLabel: "Tuesday, August 25",
      leads: [lead({ territoryKey: null, ownerName: null, marketRaw: null })],
      logoUrl: "",
      hubUrl: "https://hub.example.com/admin#leads",
    };
    expect(render.renderDigestText(view)).toContain("UNASSIGNED");
    expect(render.renderDigestText(view)).toContain("1 did not match a territory");
    expect(render.renderDigestHtml(view)).toContain("still need routing");
  });
});
