import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { LeadCrmClient } from "./lead-crm.js";
import type { LeadPlaybook } from "./lead-playbooks.js";
import type { Lead } from "./lead-store.js";

/**
 * The push into Pipedrive, against a stand-in for the plugin.
 *
 * What is worth proving here is not that four calls are made — it is that the
 * module refuses to make the CRM messier than it found it: an existing
 * brokerage is reused however it is spelled, an existing person is matched on
 * their address, and neither is written back to.
 */

type Recorded = { call: string; params: Record<string, unknown> };

function makeClient(overrides: Partial<LeadCrmClient> & { recorded?: Recorded[] } = {}): {
  client: LeadCrmClient;
  recorded: Recorded[];
} {
  const recorded = overrides.recorded ?? [];
  const client: LeadCrmClient = {
    isConfigured: () => true,
    listUsers: async () => [
      { id: 12_087_058, name: "Chris Voge", email: "chris@example.com", activeFlag: true },
      { id: 13_453_651, name: "Gone Away", email: "gone@example.com", activeFlag: false },
    ],
    searchOrganizations: async (params) => {
      recorded.push({ call: "searchOrganizations", params });
      return [];
    },
    findPersons: async (params) => {
      recorded.push({ call: "findPersons", params });
      return [];
    },
    createOrganization: async (params) => {
      recorded.push({ call: "createOrganization", params });
      return 900;
    },
    createPerson: async (params) => {
      recorded.push({ call: "createPerson", params });
      return 901;
    },
    createActivity: async (params) => {
      recorded.push({ call: "createActivity", params });
      return 902;
    },
    ...overrides,
  };
  return { client, recorded };
}

const PLAYBOOK: LeadPlaybook = {
  key: "getting_ready_guide",
  label: "Getting Ready Guide",
  signal: "Listing imminent — days, not weeks.",
  opener: "Hey [Name], Taylor with WOW Video Tours.",
  softClose: "When are you looking to shoot it?",
  matchTerms: ["getting ready"],
  steps: [
    { step: 1, when: "Within 1 hour", channel: "call", action: "Call. Voicemail if no answer." },
    { step: 2, when: "Day 4", channel: "email", action: "Email the opener in writing." },
  ],
  active: true,
  sortOrder: 0,
};

describe("filing a lead in Pipedrive", () => {
  let tmpDir: string;
  let crm: typeof import("./lead-crm.js");
  let store: typeof import("./lead-store.js");

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lead-crm-test-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    crm = await import("./lead-crm.js");
    store = await import("./lead-store.js");
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    crm.resetLeadCrmUserCache();
  });

  const newLead = (over: Partial<Lead> = {}): Promise<Lead> =>
    store.createLead({
      source: "manual",
      name: "Dana Reyes",
      email: "dana@brokerage.com",
      phone: "(614) 555-0111",
      company: "Keller Williams Capital",
      marketRaw: "Columbus",
      territoryKey: "columbus",
      ownerName: "Chris Voge",
      ownerEmail: "chris@example.com",
      ...over,
    });

  it("creates the brokerage, the person and one follow-up for the market's owner", async () => {
    const lead = await newLead();
    const { client, recorded } = makeClient();
    const out = await crm.syncLeadToCrm(lead, {
      client,
      playbook: PLAYBOOK,
      env: { LEADS_DIGEST_TZ: "America/New_York" },
      now: Date.parse("2026-09-14T16:00:00Z"),
    });

    expect(out.ok).toBe(true);
    const activity = recorded.find((r) => r.call === "createActivity")?.params ?? {};
    expect(activity.user_id).toBe(12_087_058);
    expect(activity.person_id).toBe(901);
    expect(activity.org_id).toBe(900);
    // The opening step is a call, so the activity is one.
    expect(activity.type).toBe("call");
    expect(activity.due_date).toBe("2026-09-14");
    expect(activity.subject).toContain(lead.number);
    expect(activity.subject).toContain("Getting Ready Guide");
    // The whole cadence rides in the note rather than becoming more activities.
    expect(String(activity.note)).toContain("Within 1 hour");
    expect(String(activity.note)).toContain("Day 4");
    expect(String(activity.note)).toContain("Hey Dana, Taylor with WOW Video Tours.");

    const stored = await store.getLead(lead.id);
    expect(stored?.crmPersonId).toBe(901);
    expect(stored?.crmOrgId).toBe(900);
    expect(stored?.crmActivityId).toBe(902);
    expect(stored?.crmError).toBeNull();
    const trail = await store.listLeadEvents(lead.id);
    expect(trail.at(-1)?.body).toContain("Chris Voge");
  });

  it("opens on an email when that is what the playbook says", async () => {
    const lead = await newLead();
    const { client, recorded } = makeClient();
    await crm.syncLeadToCrm(lead, {
      client,
      playbook: { ...PLAYBOOK, steps: [{ ...PLAYBOOK.steps[1], step: 1 }] },
    });
    expect(recorded.find((r) => r.call === "createActivity")?.params.type).toBe("email");
  });

  it("reuses a brokerage that is spelled differently rather than making another", async () => {
    const lead = await newLead({ company: "RE/MAX Victory + Affiliates" });
    const { client, recorded } = makeClient({
      searchOrganizations: async () => [
        { id: 4_267, name: "ReMax Victory and Affiliates Realty" },
        { id: 5_000, name: "RE/MAX Alliance" },
      ],
    });
    await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });

    expect(recorded.some((r) => r.call === "createOrganization")).toBe(false);
    expect(recorded.find((r) => r.call === "createPerson")?.params.org_id).toBe(4_267);
  });

  it("does not adopt a brokerage that merely ranks well", async () => {
    const lead = await newLead({ company: "Howard Hanna" });
    const { client, recorded } = makeClient({
      searchOrganizations: async () => [{ id: 7_000, name: "Howard Hanna Rand Realty of NJ" }],
    });
    await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });
    expect(recorded.find((r) => r.call === "createOrganization")?.params.name).toBe("Howard Hanna");
  });

  it("matches a person on their address and leaves their record alone", async () => {
    const lead = await newLead();
    const { client, recorded } = makeClient({
      findPersons: async (params) => {
        recorded.push({ call: "findPersons", params });
        return [{ id: 49_456, name: "Dana Reyes", primaryEmail: "dana@brokerage.com" }];
      },
      recorded: [],
    });
    const out = await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });

    expect(out.ok).toBe(true);
    expect(recorded.some((r) => r.call === "createPerson")).toBe(false);
    expect(recorded.find((r) => r.call === "createActivity")?.params.person_id).toBe(49_456);
    const stored = await store.getLead(lead.id);
    expect(stored?.crmPersonId).toBe(49_456);
  });

  it("falls back to the phone number when the lead left no address", async () => {
    const lead = await newLead({ email: null, phone: "+1 (614) 555-0111" });
    const recorded: Recorded[] = [];
    const { client } = makeClient({
      recorded,
      findPersons: async (params) => {
        recorded.push({ call: "findPersons", params });
        return params.fields === "phone"
          ? [{ id: 49_999, name: "Dana Reyes", primaryEmail: null }]
          : [];
      },
    });
    await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });

    const search = recorded.filter((r) => r.call === "findPersons");
    // Punctuation is dropped and the country code with it, or Pipedrive's own
    // formatting of the same number would never match.
    expect(search.at(-1)?.params.term).toBe("6145550111");
    expect(recorded.some((r) => r.call === "createPerson")).toBe(false);
  });

  it("still files the lead when the market has no Pipedrive user", async () => {
    const lead = await newLead({ ownerEmail: "nobody@example.com" });
    const { client, recorded } = makeClient();
    const out = await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });

    expect(out.ok).toBe(true);
    // Unassigned rather than dropped: an activity nobody owns is visible, and a
    // lead that quietly went nowhere is not.
    expect(recorded.find((r) => r.call === "createActivity")?.params.user_id).toBeUndefined();
    const trail = await store.listLeadEvents(lead.id);
    expect(trail.at(-1)?.body).toContain("no Pipedrive user");
  });

  it("ignores a deactivated Pipedrive account", async () => {
    const lead = await newLead({ ownerEmail: "gone@example.com" });
    const { client, recorded } = makeClient();
    await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });
    expect(recorded.find((r) => r.call === "createActivity")?.params.user_id).toBeUndefined();
  });

  it("records why a push failed and keeps the lead", async () => {
    const lead = await newLead();
    const { client } = makeClient({
      createActivity: async () => {
        throw new Error("Pipedrive API error: 401 unauthorized");
      },
    });
    const out = await crm.syncLeadToCrm(lead, {
      client,
      playbook: PLAYBOOK,
      logger: { info: () => {}, error: () => {} },
    });

    expect(out.ok).toBe(false);
    const stored = await store.getLead(lead.id);
    expect(stored?.crmError).toContain("401");
    expect(stored?.crmPersonId).toBeNull();
    const trail = await store.listLeadEvents(lead.id);
    expect(trail.at(-1)?.body).toContain("Pipedrive sync failed");
  });

  it("does not file the same lead twice unless it is asked to", async () => {
    const lead = await newLead();
    const { client, recorded } = makeClient();
    await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });
    const filed = await store.getLead(lead.id);

    const again = await crm.syncLeadToCrm(filed as Lead, { client, playbook: PLAYBOOK });
    expect(again.ok).toBe(false);
    expect(!again.ok && again.skipped).toBe("already_synced");
    expect(recorded.filter((r) => r.call === "createActivity")).toHaveLength(1);

    const forced = await crm.syncLeadToCrm(filed as Lead, {
      client,
      playbook: PLAYBOOK,
      force: true,
    });
    expect(forced.ok).toBe(true);
    expect(recorded.filter((r) => r.call === "createActivity")).toHaveLength(2);
  });

  it("says nothing about an install with no CRM connected", async () => {
    const lead = await newLead();
    const { client, recorded } = makeClient({ isConfigured: () => false });
    const out = await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });

    expect(!out.ok && out.skipped).toBe("not_configured");
    expect(recorded).toHaveLength(0);
    // No error on the lead: an unconfigured install is not a failed push, and a
    // queue of red leads would say the sync is broken when it is merely absent.
    const stored = await store.getLead(lead.id);
    expect(stored?.crmError).toBeNull();
  });
});
