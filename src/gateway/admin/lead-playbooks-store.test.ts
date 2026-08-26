import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { matchPlaybook } from "./lead-playbooks.js";

describe("the editable outreach notes", () => {
  let tmpDir: string;
  let store: typeof import("./lead-playbooks-store.js");

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lead-playbooks-store-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    store = await import("./lead-playbooks-store.js");
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("seeds the three the business started with, so a fresh install sends what it always did", async () => {
    const all = await store.listPlaybooks();
    expect(all.map((p) => p.key)).toEqual([
      "getting_ready_guide",
      "pricing_list",
      "listing_presentation",
    ]);
    const guide = await store.getPlaybook("getting_ready_guide");
    expect(guide?.opener).toContain("Taylor with WOW Video Tours");
    expect(guide?.steps).toHaveLength(3);
    expect(guide?.steps[0].when).toBe("Within 1 hour");
  });

  it("seeds the shared closing sentence too", async () => {
    const settings = await store.getLeadSettings();
    expect(settings.attemptsBeforeStandard).toBe(3);
    expect(settings.standardFollowUp).toContain("quarterly");
  });

  it("takes an edit to the copy and hands it straight back", async () => {
    const updated = await store.updatePlaybook("pricing_list", {
      opener: "Hey [Name], Taylor here — saw you were pricing things out.",
      steps: [
        { when: "Within 2 hours", channel: "call", action: "Call. Text if no answer." },
        { when: "Day 2", channel: "email", action: "Email the package comparison." },
      ],
    });
    expect(updated?.opener).toContain("saw you were pricing things out");
    expect(updated?.steps.map((s) => s.when)).toEqual(["Within 2 hours", "Day 2"]);
    // Renumbered from position, so a removed step cannot leave a gap in the list.
    expect(updated?.steps.map((s) => s.step)).toEqual([1, 2]);
  });

  it("keeps the key when the label is rewritten, because leads are filed under it", async () => {
    const updated = await store.updatePlaybook("pricing_list", { label: "Pricing Sheet" });
    expect(updated?.key).toBe("pricing_list");
    expect(updated?.label).toBe("Pricing Sheet");
  });

  it("adds a source, and matches leads to it by the words an admin gave it", async () => {
    const created = await store.createPlaybook({
      label: "Home Valuation Tool",
      matchTerms: ["valuation", "home value"],
      opener: "Hey [Name], Taylor with WOW Video Tours.",
      steps: [{ when: "Day 1", channel: "call", action: "Call." }],
    });
    expect(created.key).toBe("home_valuation_tool");
    const book = await store.listPlaybooks();
    expect(
      matchPlaybook(book, { fields: [{ label: "Source", value: "Home Value Report" }] })?.key,
    ).toBe("home_valuation_tool");
    await expect(store.createPlaybook({ label: "Home Valuation Tool" })).rejects.toThrow(
      "playbook_exists",
    );
  });

  it("matches a new source on its own name before anybody adds a term", async () => {
    await store.createPlaybook({ label: "Open House Kit" });
    const book = await store.listPlaybooks();
    expect(matchPlaybook(book, { formName: "Open House Kit" })?.key).toBe("open_house_kit");
  });

  it("stops sending a note that is switched off, without deleting the copy", async () => {
    await store.updatePlaybook("open_house_kit", { active: false });
    const book = await store.listPlaybooks();
    expect(matchPlaybook(book, { formName: "Open House Kit" })).toBeNull();
    expect((await store.getPlaybook("open_house_kit"))?.opener).toBeDefined();
  });

  it("clamps an attempts figure somebody fat-fingered", async () => {
    expect(
      (await store.setLeadSettings({ attemptsBeforeStandard: 900 })).attemptsBeforeStandard,
    ).toBe(12);
    expect(
      (await store.setLeadSettings({ attemptsBeforeStandard: 0 })).attemptsBeforeStandard,
    ).toBe(1);
    await store.setLeadSettings({ attemptsBeforeStandard: 3 });
  });

  it("drops a malformed step rather than losing the whole cadence", async () => {
    const updated = await store.updatePlaybook("getting_ready_guide", {
      steps: [
        { when: "Day 1", channel: "call", action: "Call." },
        { when: "", channel: "call", action: "" },
        { when: "Day 3", channel: "nonsense", action: "Email." },
      ],
    });
    expect(updated?.steps).toHaveLength(2);
    // An unknown channel falls back rather than rejecting the step.
    expect(updated?.steps[1].channel).toBe("call");
  });

  it("reorders the list from the order it is sent", async () => {
    const before = (await store.listPlaybooks()).map((p) => p.key);
    const moved = await store.reorderPlaybooks([before[2], before[0]]);
    expect(moved[0].key).toBe(before[2]);
    expect(moved[1].key).toBe(before[0]);
    // Anything left out keeps its place at the end rather than disappearing.
    expect(moved).toHaveLength(before.length);
  });

  it("leaves a deleted source's leads alone", async () => {
    await store.deletePlaybook("open_house_kit");
    expect(await store.getPlaybook("open_house_kit")).toBeNull();
  });
});
