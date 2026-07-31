import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-past-due-contacts-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./past-due-contacts-store.js");
const financials = await import("./financials-store.js");
const userStore = await import("./user-store.js");

let collectorId: string;

beforeAll(async () => {
  collectorId = (await userStore.createUser({ username: "casey", password: "x", role: "user" })).id;
});

const DAY = 86400000;

describe("logging a contact", () => {
  it("records who reached the client, how, and when", async () => {
    const c = await store.logContact({
      accountKey: "agent:a1",
      channel: "call",
      note: "Left a message with the front desk",
      userId: collectorId,
      userName: "Casey",
    });
    expect(c.channel).toBe("call");
    expect(c.createdByName).toBe("Casey");
    const list = await store.listContacts("agent:a1");
    expect(list.map((x) => x.id)).toContain(c.id);
  });

  it("backdates a contact that already happened", async () => {
    const when = Date.now() - 3 * DAY;
    const c = await store.logContact({
      accountKey: "agent:backdate",
      contactedAt: when,
      channel: "email",
      userId: collectorId,
      userName: "Casey",
    });
    expect(c.contactedAt).toBe(when);
  });

  it("refuses to date a contact in the future", async () => {
    const c = await store.logContact({
      accountKey: "agent:future",
      contactedAt: Date.now() + 30 * DAY,
      channel: "call",
      userId: collectorId,
      userName: "Casey",
    });
    // A contact that has not happened yet is a reminder, not a contact.
    expect(c.contactedAt).toBeLessThanOrEqual(Date.now());
  });

  it("lists an account's contacts newest first", async () => {
    const key = "agent:many";
    await store.logContact({
      accountKey: key,
      contactedAt: Date.now() - 5 * DAY,
      channel: "email",
      userId: collectorId,
      userName: "Casey",
    });
    await store.logContact({
      accountKey: key,
      contactedAt: Date.now() - 1 * DAY,
      channel: "call",
      userId: collectorId,
      userName: "Casey",
    });
    const list = await store.listContacts(key);
    expect(list[0].channel).toBe("call");
    expect(list[1].channel).toBe("email");
  });

  it("keeps one account's log out of another's", async () => {
    const list = await store.listContacts("agent:a1");
    expect(list.every((c) => c.accountKey === "agent:a1")).toBe(true);
  });

  it("reports the latest contact per account in one pass", async () => {
    const map = await store.lastContactByAccount();
    expect(map.get("agent:many")?.channel).toBe("call");
    expect(map.get("agent:nobody")).toBeUndefined();
  });

  it("removes a contact from the log", async () => {
    const c = await store.logContact({
      accountKey: "agent:gone",
      channel: "text",
      userId: collectorId,
      userName: "Casey",
    });
    await store.deleteContact(c.id);
    expect(await store.getContact(c.id)).toBeNull();
  });

  it("rejects a channel it does not know", () => {
    expect(store.isContactChannel("call")).toBe(true);
    expect(store.isContactChannel("carrier_pigeon")).toBe(false);
  });
});

describe("resolveLastContact", () => {
  const index = {
    byEmail: new Map(),
    byPersonName: new Map([
      [
        "amber fairbanks",
        {
          lastActivityAt: new Date(2026, 5, 1).getTime(),
          matchedName: "Amber Fairbanks",
          matchedType: "person" as const,
          pipedriveId: 7,
        },
      ],
    ]),
    byOrgName: new Map(),
  };

  it("prefers a logged contact over CRM activity", () => {
    const out = financials.resolveLastContact({
      logged: { at: new Date(2026, 6, 1).getTime(), channel: "call", byName: "Casey" },
      pipedrive: index,
      name: "Amber Fairbanks",
      type: "agent",
    });
    // The logged call is about this debt; the CRM touch could be anything.
    expect(out?.source).toBe("logged");
    expect(out?.byName).toBe("Casey");
  });

  it("still prefers the logged contact when it is the same day", () => {
    const same = new Date(2026, 5, 1).getTime();
    const out = financials.resolveLastContact({
      logged: { at: same, channel: "email", byName: "Casey" },
      pipedrive: index,
      name: "Amber Fairbanks",
      type: "agent",
    });
    expect(out?.source).toBe("logged");
  });

  it("falls back to CRM activity when it is more recent", () => {
    const out = financials.resolveLastContact({
      logged: { at: new Date(2026, 3, 1).getTime(), channel: "call", byName: "Casey" },
      pipedrive: index,
      name: "Amber Fairbanks",
      type: "agent",
    });
    expect(out?.source).toBe("pipedrive");
    // The matched name rides along so a wrong name match is visible.
    expect(out?.matchedName).toBe("Amber Fairbanks");
  });

  it("uses CRM activity when nothing was logged", () => {
    const out = financials.resolveLastContact({
      logged: null,
      pipedrive: index,
      name: "Amber Fairbanks",
      type: "agent",
    });
    expect(out?.source).toBe("pipedrive");
  });

  it("reports nothing rather than guessing when neither source knows them", () => {
    expect(
      financials.resolveLastContact({
        logged: null,
        pipedrive: index,
        name: "Nobody At All",
        type: "agent",
      }),
    ).toBeNull();
  });

  it("works with no CRM directory at all", () => {
    const out = financials.resolveLastContact({
      logged: { at: 1000, channel: "call", byName: "Casey" },
      pipedrive: null,
      name: "Amber Fairbanks",
      type: "agent",
    });
    expect(out?.source).toBe("logged");
  });
});
