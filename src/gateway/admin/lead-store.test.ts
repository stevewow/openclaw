import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("lead store", () => {
  let tmpDir: string;
  let store: typeof import("./lead-store.js");

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lead-store-test-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    store = await import("./lead-store.js");
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const base = () => ({
    name: "Dana Reyes",
    email: "dana@brokerage.com",
    marketRaw: "Columbus",
    territoryKey: "columbus",
    ownerName: "Chris Voge",
    ownerEmail: "chris@example.com",
  });

  it("files a lead with a readable number and opens its trail", async () => {
    const lead = await store.createLead({ ...base(), formName: "Contact" });
    expect(lead.number).toMatch(/^LEAD-\d+$/);
    expect(lead.status).toBe("new");
    expect(lead.notifiedAt).toBeNull();
    const events = await store.listLeadEvents(lead.id);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("created");
    expect(events[0].body).toContain("Contact");
  });

  it("numbers leads in sequence", async () => {
    const first = await store.createLead(base());
    const second = await store.createLead(base());
    const n = (r: string) => Number(/^LEAD-(\d+)$/.exec(r)?.[1]);
    expect(n(second.number)).toBe(n(first.number) + 1);
  });

  it("finds a lead by the submission id that made it, so a retry is a no-op", async () => {
    const lead = await store.createLead({ ...base(), submissionId: "sub-1" });
    expect((await store.getLeadBySubmissionId("sub-1"))?.id).toBe(lead.id);
    expect(await store.getLeadBySubmissionId("sub-none")).toBeNull();
  });

  it("keeps the form's other answers verbatim", async () => {
    const lead = await store.createLead({
      ...base(),
      fields: [{ label: "Listings per year", value: "24" }],
    });
    const read = await store.getLead(lead.id);
    expect(read?.fields).toEqual([{ label: "Listings per year", value: "24" }]);
  });

  it("records a status change on the trail with who made it", async () => {
    const lead = await store.createLead(base());
    const moved = await store.setLeadStatus(lead.id, "contacted", "Steve");
    expect(moved?.status).toBe("contacted");
    const events = await store.listLeadEvents(lead.id);
    const change = events.find((e) => e.kind === "status_change");
    expect(change?.body).toBe("New → Contacted");
    expect(change?.authorName).toBe("Steve");
  });

  it("writes no event when the status did not actually change", async () => {
    const lead = await store.createLead(base());
    await store.setLeadStatus(lead.id, "new", "Steve");
    expect(await store.listLeadEvents(lead.id)).toHaveLength(1);
  });

  it("re-routes a lead and says so on the trail", async () => {
    const lead = await store.createLead(base());
    const moved = await store.assignLead(
      lead.id,
      { territoryKey: "toledo", ownerName: "Craig Magrum", ownerEmail: "craig@example.com" },
      "Steve",
    );
    expect(moved?.ownerName).toBe("Craig Magrum");
    const events = await store.listLeadEvents(lead.id);
    expect(events.at(-1)?.body).toContain("Craig Magrum");
  });

  it("records a failed dispatch on the lead rather than losing it", async () => {
    const lead = await store.createLead(base());
    await store.recordLeadDispatch(lead.id, { ok: false, error: "no department address" });
    const read = await store.getLead(lead.id);
    expect(read?.notifiedAt).toBeNull();
    expect(read?.notifyError).toBe("no department address");
    await store.recordLeadDispatch(lead.id, { ok: true, to: "chris@example.com" });
    const sent = await store.getLead(lead.id);
    expect(sent?.notifiedAt).toBeGreaterThan(0);
    expect(sent?.notifyError).toBeNull();
  });

  it("filters by status, market and free text", async () => {
    // The suite shares one database, so this case works in its own market and
    // asserts on what it put there rather than on the table's total.
    const marker = "zzqfilter";
    const won = await store.createLead({
      name: `Won One ${marker}`,
      email: "won@x.com",
      marketRaw: "Findlay",
      territoryKey: "findlay-filter",
    });
    await store.setLeadStatus(won.id, "won", null);
    await store.createLead({
      name: `Open One ${marker}`,
      email: "open@x.com",
      marketRaw: "Findlay",
      territoryKey: "findlay-filter",
    });
    await store.createLead({ name: `Unrouted One ${marker}`, phone: "6145550111" });

    const inMarket = await store.listLeads({ territoryKey: "findlay-filter" });
    expect(inMarket).toHaveLength(2);
    const openInMarket = await store.listLeads({ territoryKey: "findlay-filter", status: "open" });
    expect(openInMarket.map((l) => l.name)).toEqual([`Open One ${marker}`]);
    const wonInMarket = await store.listLeads({ territoryKey: "findlay-filter", status: "won" });
    expect(wonInMarket.map((l) => l.name)).toEqual([`Won One ${marker}`]);
    expect(await store.listLeads({ q: marker })).toHaveLength(3);
    const unrouted = await store.listLeads({ territoryKey: "unassigned", q: marker });
    expect(unrouted.map((l) => l.name)).toEqual([`Unrouted One ${marker}`]);
    // Today's leads are inside a 30-day window, whatever the clock says.
    expect(await store.listLeads({ q: marker, days: 30 })).toHaveLength(3);
  });

  it("counts the things worth chasing: unrouted, and never emailed", () => {
    const summary = store.summarizeLeads([
      { status: "new", territoryKey: null, notifiedAt: null },
      { status: "new", territoryKey: "toledo", notifiedAt: 1 },
      { status: "won", territoryKey: "toledo", notifiedAt: 1 },
    ] as Parameters<typeof store.summarizeLeads>[0]);
    expect(summary.total).toBe(3);
    expect(summary.unrouted).toBe(1);
    expect(summary.undelivered).toBe(1);
    expect(summary.byStatus.find((s) => s.status === "new")?.count).toBe(2);
  });
});
