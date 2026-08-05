import { describe, expect, it } from "vitest";
import {
  activityContactAt,
  AUTOMATED_ACTIVITY_TYPES,
  classifyMailThread,
  isAutomatedActivityType,
  isExcludedSender,
  isInternalAddress,
} from "./pipedrive-contact-events.js";

/**
 * These rules decide whether a salesperson is told a client has gone quiet, so
 * a wrong answer either hides a client who needs calling or sends someone
 * chasing one who was emailed yesterday.
 */

const party = (email: string, personId?: number, orgId?: number) => ({
  email_address: email,
  linked_person_id: personId ?? null,
  linked_organization_id: orgId ?? null,
});

const thread = (opts: {
  from: ReturnType<typeof party>[];
  to?: ReturnType<typeof party>[];
  cc?: ReturnType<typeof party>[];
  at?: string;
  id?: number;
}) => ({
  id: opts.id ?? 1,
  parties: { from: opts.from, to: opts.to ?? [], cc: opts.cc ?? [], bcc: [] },
  last_message_timestamp: opts.at ?? "2026-08-01T10:00:00.000Z",
});

const CLIENT = () => party("agent@somebrokerage.com", 500);
const BDS = () => party("joy@wowvideotours.com", 44575);

describe("address classification", () => {
  it("knows our own domains from a client's", () => {
    expect(isInternalAddress("joy@wowvideotours.com")).toBe(true);
    expect(isInternalAddress("jess@wvt.team")).toBe(true);
    expect(isInternalAddress("agent@kw.com")).toBe(false);
    // A lookalike domain is not ours.
    expect(isInternalAddress("someone@notwowvideotours.com")).toBe(false);
  });

  it("is not fooled by case or padding", () => {
    expect(isInternalAddress("  JOY@WowVideoTours.COM  ")).toBe(true);
    expect(isExcludedSender(" Support@WOWVIDEOTOURS.com ")).toBe(true);
  });

  it("treats junk as external rather than throwing", () => {
    for (const bad of ["", "no-at-sign", null, undefined, 42]) {
      expect(isInternalAddress(bad)).toBe(false);
      expect(isExcludedSender(bad)).toBe(false);
    }
  });

  it("excludes exactly the two shared order inboxes", () => {
    expect(isExcludedSender("support@wowvideotours.com")).toBe(true);
    expect(isExcludedSender("schedule@wowvideotours.com")).toBe(true);
    // A real person is not a shared inbox.
    expect(isExcludedSender("joy@wowvideotours.com")).toBe(false);
  });
});

describe("classifyMailThread", () => {
  it("counts a thread a salesperson sent", () => {
    const v = classifyMailThread(thread({ from: [BDS()], to: [CLIENT()] }));
    expect(v.countsAsContact).toBe(true);
    expect(v.clients).toEqual([{ type: "person", id: 500 }]);
    expect(v.at).toBe(Date.parse("2026-08-01T10:00:00.000Z"));
  });

  it("does not count a thread only support@ sent", () => {
    // The reported problem: order mail made every client look freshly touched.
    const v = classifyMailThread(
      thread({ from: [party("support@wowvideotours.com")], to: [CLIENT()] }),
    );
    expect(v.countsAsContact).toBe(false);
  });

  it("does not count a thread only schedule@ sent", () => {
    const v = classifyMailThread(
      thread({ from: [party("schedule@wowvideotours.com")], to: [CLIENT()] }),
    );
    expect(v.countsAsContact).toBe(false);
  });

  it("counts a thread support@ started once a real person joins in", () => {
    // Order mail that turned into an actual conversation is contact.
    const v = classifyMailThread(
      thread({ from: [party("support@wowvideotours.com"), BDS()], to: [CLIENT()] }),
    );
    expect(v.countsAsContact).toBe(true);
  });

  it("does not count a client emailing in with no reply from us", () => {
    const v = classifyMailThread(
      thread({ from: [CLIENT()], to: [party("support@wowvideotours.com")] }),
    );
    expect(v.countsAsContact).toBe(false);
  });

  it("attributes the thread to the client, never to our own staff", () => {
    const v = classifyMailThread(
      thread({ from: [BDS()], to: [CLIENT()], cc: [party("carter@wowvideotours.com", 48499)] }),
    );
    // Carter is a Pipedrive person too, but he is not the client.
    expect(v.clients).toEqual([{ type: "person", id: 500 }]);
  });

  it("picks up an organization as well as a person", () => {
    const v = classifyMailThread(
      thread({ from: [BDS()], to: [party("agent@brokerage.com", 500, 7161)] }),
    );
    expect(v.clients).toEqual([
      { type: "person", id: 500 },
      { type: "organization", id: 7161 },
    ]);
  });

  it("lists each client once however many messages they appear on", () => {
    const v = classifyMailThread(
      thread({ from: [BDS(), CLIENT()], to: [CLIENT()], cc: [CLIENT()] }),
    );
    expect(v.clients).toEqual([{ type: "person", id: 500 }]);
  });

  it("ignores an unlinked address rather than inventing a client", () => {
    const v = classifyMailThread(thread({ from: [BDS()], to: [party("stranger@nowhere.com")] }));
    expect(v.countsAsContact).toBe(true);
    expect(v.clients).toEqual([]);
  });

  it("survives a thread with no parties or no timestamp", () => {
    expect(classifyMailThread({}).countsAsContact).toBe(false);
    expect(classifyMailThread({}).at).toBeNull();
    expect(classifyMailThread(null).clients).toEqual([]);
    const undated = classifyMailThread({
      parties: { from: [BDS()], to: [CLIENT()] },
      last_message_timestamp: "not a date",
    });
    expect(undated.at).toBeNull();
  });
});

describe("activityContactAt", () => {
  const NOW = Date.parse("2026-08-05T12:00:00.000Z");

  it("ignores the automated types outright", () => {
    for (const type of AUTOMATED_ACTIVITY_TYPES) {
      expect(isAutomatedActivityType(type)).toBe(true);
      expect(
        activityContactAt({ type, marked_as_done_time: "2026-08-01 10:00:00" }, NOW),
      ).toBeNull();
    }
  });

  it("keeps a client replying to a newsletter, which is a human act", () => {
    expect(isAutomatedActivityType("newsletter_reply")).toBe(false);
    expect(
      activityContactAt(
        { type: "newsletter_reply", marked_as_done_time: "2026-08-01 10:00:00" },
        NOW,
      ),
    ).toBe(Date.parse("2026-08-01T10:00:00Z"));
  });

  it("counts a call, a meeting and a logged email", () => {
    for (const type of ["call", "meeting", "email", "justcall_outbound_call"]) {
      expect(activityContactAt({ type, marked_as_done_time: "2026-07-30 09:15:00" }, NOW)).toBe(
        Date.parse("2026-07-30T09:15:00Z"),
      );
    }
  });

  it("prefers when it was done over when it was scheduled", () => {
    const at = activityContactAt(
      { type: "call", due_date: "2026-01-01", marked_as_done_time: "2026-07-30 09:15:00" },
      NOW,
    );
    expect(at).toBe(Date.parse("2026-07-30T09:15:00Z"));
  });

  it("does not treat a future task as contact that already happened", () => {
    expect(activityContactAt({ type: "task", due_date: "2026-09-22" }, NOW)).toBeNull();
  });

  it("falls back to a past due date when nothing marked it done", () => {
    const at = activityContactAt({ type: "call", due_date: "2026-07-01" }, NOW);
    expect(at).not.toBeNull();
    expect(new Date(at as number).getFullYear()).toBe(2026);
  });
});
