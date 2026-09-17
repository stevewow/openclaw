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
    // The whole cadence rides in the note rather than becoming more activities,
    // and the note is HTML because that is what Pipedrive stores: newlines are
    // dropped on the way in, which is what turned it into one run-on paragraph.
    const note = String(activity.note);
    expect(note).toContain("<li><b>Within 1 hour</b> — Call. Voicemail if no answer.</li>");
    expect(note).toContain("<li><b>Day 4</b> — Email the opener in writing.</li>");
    expect(note).toContain("<p><b>Opener</b><br />Hey Dana, Taylor with WOW Video Tours.</p>");
    expect(note).toContain("<b>Phone:</b> (614) 555-0111");
    // No link back to the Hub: the owner works this from the CRM.
    expect(note).not.toContain("hub.wowvideotours.com");
    expect(note).not.toContain("/admin#leads");

    const stored = await store.getLead(lead.id);
    expect(stored?.crmPersonId).toBe(901);
    expect(stored?.crmOrgId).toBe(900);
    expect(stored?.crmActivityId).toBe(902);
    expect(stored?.crmError).toBeNull();
    const trail = await store.listLeadEvents(lead.id);
    expect(trail.at(-1)?.body).toContain("Chris Voge");
  });

  it("lays the note out for someone reading it between showings", async () => {
    const lead = await newLead({
      message: "Two listings next week.\nCall after 4.",
      fields: [
        { label: "Listing address", value: "123 Oak St, Findlay, OH" },
        { label: "Listing link", value: "https://www.zillow.com/homedetails/123-oak" },
      ],
    });
    const { client, recorded } = makeClient();
    await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });
    const note = String(recorded.find((r) => r.call === "createActivity")?.params.note);

    // Who and how to reach them first, the script second, the cadence last.
    expect(note.indexOf("Brokerage:")).toBeLessThan(note.indexOf("What they wrote"));
    expect(note.indexOf("What they wrote")).toBeLessThan(note.indexOf("Opener"));
    expect(note.indexOf("Opener")).toBeLessThan(note.indexOf("Cadence"));
    // The listing rides along, and the link is one.
    expect(note).toContain("<b>Listing address:</b> 123 Oak St, Findlay, OH");
    expect(note).toContain(
      '<b>Listing link:</b> <a href="https://www.zillow.com/homedetails/123-oak">',
    );
    // A typed newline in what they wrote survives as a line break.
    expect(note).toContain("Two listings next week.<br />Call after 4.");
  });

  it("puts the listing photo in the note as a picture, not a link", async () => {
    // Live-checked against the real account: Pipedrive keeps <img> with src,
    // alt and width in an activity note, so the rep sees the house without
    // opening anything.
    const lead = await newLead({ photoUrl: "https://ap.rdcpix.com/x.jpg" });
    const { client, recorded } = makeClient();
    await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });
    const note = String(recorded.find((r) => r.call === "createActivity")?.params.note);

    expect(note).toContain('<img src="https://ap.rdcpix.com/x.jpg"');
    // The contact facts still come first; the picture follows them.
    expect(note.indexOf("Brokerage:")).toBeLessThan(note.indexOf("<img"));
  });

  it("refuses to put a non-https photo in the note", async () => {
    const lead = await newLead({ photoUrl: "javascript:alert(1)" });
    const { client, recorded } = makeClient();
    await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });
    const note = String(recorded.find((r) => r.call === "createActivity")?.params.note);

    expect(note).not.toContain("<img");
    expect(note).not.toContain("javascript:");
  });

  it("escapes what the lead itself supplied", async () => {
    const lead = await newLead({ company: "Comey & Shepherd", name: "<script>x</script> Dana" });
    const { client, recorded } = makeClient();
    await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });
    const note = String(recorded.find((r) => r.call === "createActivity")?.params.note);

    expect(note).toContain("Comey &amp; Shepherd");
    expect(note).not.toContain("<script>");
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

  it("tries a shorter name when Pipedrive's search finds nothing at all", async () => {
    const lead = await newLead({ company: "Farms and Estates Realty" });
    const terms: string[] = [];
    const { client, recorded } = makeClient({
      // Pipedrive requires every word in the term to appear, so the full name
      // returns nothing even though the brokerage is right there.
      searchOrganizations: async (params) => {
        terms.push(params.term);
        return params.term === "Farms and Estates"
          ? [{ id: 6_560, name: "Farms and Estates" }]
          : [];
      },
    });
    await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });

    expect(terms).toEqual(["Farms and Estates Realty", "Farms and Estates"]);
    expect(recorded.some((r) => r.call === "createOrganization")).toBe(false);
    expect(recorded.find((r) => r.call === "createPerson")?.params.org_id).toBe(6_560);
  });

  it("gives up widening rather than searching for one word", async () => {
    const lead = await newLead({ company: "Berkshire Hathaway the Westheimer Group" });
    const terms: string[] = [];
    const { client, recorded } = makeClient({
      searchOrganizations: async (params) => {
        terms.push(params.term);
        return [];
      },
    });
    await crm.syncLeadToCrm(lead, { client, playbook: PLAYBOOK });

    // Two retries and no further: "Berkshire" alone would match eight other
    // brokerages, and the whole point is not to guess.
    expect(terms).toHaveLength(3);
    expect(terms.at(-1)).toBe("Berkshire Hathaway the");
    expect(recorded.find((r) => r.call === "createOrganization")?.params.name).toBe(
      "Berkshire Hathaway the Westheimer Group",
    );
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
