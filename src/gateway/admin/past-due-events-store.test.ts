import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-past-due-events-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./past-due-events-store.js");
const userStore = await import("./user-store.js");

beforeAll(async () => {
  // Touch the DB so the schema is built before the first insert.
  await userStore.listUsers();
});

describe("past-due events", () => {
  it("appends an event and reads it back on the account", async () => {
    const written = await store.recordPastDueEvent({
      accountKey: "agent:one",
      kind: "stage",
      summary: "Stage moved from New to Working",
      actorId: "u1",
      actorName: "Casey Ruiz",
      now: 1_000,
    });
    expect(written?.kind).toBe("stage");
    const events = await store.listPastDueEvents("agent:one");
    expect(events).toHaveLength(1);
    expect(events[0]?.summary).toBe("Stage moved from New to Working");
    expect(events[0]?.actorName).toBe("Casey Ruiz");
  });

  it("orders an account's history newest first", async () => {
    await store.recordPastDueEvent({
      accountKey: "agent:two",
      kind: "stage",
      summary: "first",
      now: 1_000,
    });
    await store.recordPastDueEvent({
      accountKey: "agent:two",
      kind: "promise",
      summary: "second",
      now: 2_000,
    });
    expect((await store.listPastDueEvents("agent:two")).map((e) => e.summary)).toEqual([
      "second",
      "first",
    ]);
  });

  it("keeps one account's history out of another's", async () => {
    const keys = (await store.listPastDueEvents("agent:one")).map((e) => e.accountKey);
    expect(new Set(keys)).toEqual(new Set(["agent:one"]));
  });

  it("trims a long summary and drops an empty detail", async () => {
    const written = await store.recordPastDueEvent({
      accountKey: "agent:trim",
      kind: "note" as never,
      summary: "x".repeat(400),
      detail: "   ",
      now: 3_000,
    });
    expect(written?.summary).toHaveLength(300);
    expect(written?.detail).toBeNull();
  });

  it("reads an unknown kind back as a stage change rather than failing", async () => {
    await store.recordPastDueEvent({
      accountKey: "agent:odd",
      kind: "from_the_future" as never,
      summary: "written by a later version",
      now: 4_000,
    });
    expect((await store.listPastDueEvents("agent:odd"))[0]?.kind).toBe("stage");
  });

  it("gives the report the latest event of a kind per account in one read", async () => {
    await store.recordPastDueEvent({
      accountKey: "agent:latest",
      kind: "promise",
      summary: "promised Monday",
      now: 5_000,
    });
    await store.recordPastDueEvent({
      accountKey: "agent:latest",
      kind: "promise",
      summary: "promised Friday",
      now: 6_000,
    });
    const latest = await store.latestEventByAccount("promise");
    expect(latest.get("agent:latest")?.summary).toBe("promised Friday");
    // Other kinds on the same account do not leak into the answer.
    expect(latest.get("agent:one")).toBeUndefined();
  });
});

describe("timeline merge", () => {
  const events = [
    {
      id: "e1",
      accountKey: "agent:one",
      kind: "stage" as const,
      summary: "Stage moved from New to Working",
      detail: null,
      actorId: "u1",
      actorName: "Casey Ruiz",
      createdAt: 3_000,
    },
  ];
  const contacts = [
    {
      id: "c1",
      contactedAt: 2_000,
      channel: "call",
      note: "Left a voicemail.",
      createdByName: "Casey Ruiz",
    },
  ];
  const notes = [
    { id: "n1", body: "Client says Friday.", createdByName: "Casey Ruiz", createdAt: 1_000 },
  ];

  it("merges all three sources newest first", () => {
    const timeline = store.buildTimeline({ events, contacts, notes });
    expect(timeline.map((t) => t.kind)).toEqual(["stage", "contact", "note"]);
    expect(timeline.map((t) => t.at)).toEqual([3_000, 2_000, 1_000]);
  });

  it("labels a logged contact by its channel and carries its note as detail", () => {
    const timeline = store.buildTimeline({
      events: [],
      contacts,
      notes: [],
      channelLabel: (c) => (c === "call" ? "Phone call" : c),
    });
    expect(timeline[0]?.summary).toBe("Phone call logged");
    expect(timeline[0]?.detail).toBe("Left a voicemail.");
  });

  it("keeps a stable order when entries land in the same millisecond", () => {
    const tied = { ...events[0], createdAt: 2_000 };
    const sameMs = store.buildTimeline({ events: [tied], contacts, notes: [] });
    // Ties break on kind then id, so the order does not depend on input order.
    expect(sameMs.map((t) => t.id)).toEqual(
      store.buildTimeline({ contacts, events: [tied], notes: [] }).map((t) => t.id),
    );
    expect(sameMs.map((t) => t.kind)).toEqual(["contact", "stage"]);
  });

  it("reads as empty when the account has no history at all", () => {
    expect(store.buildTimeline({ events: [], contacts: [], notes: [] })).toEqual([]);
  });
});
