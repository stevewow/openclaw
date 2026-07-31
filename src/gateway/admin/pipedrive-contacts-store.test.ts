import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-pipedrive-contacts-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./pipedrive-contacts-store.js");

const match = (name: string, at: number | null, type: "person" | "organization" = "person") => ({
  lastActivityAt: at,
  matchedName: name,
  matchedType: type,
  pipedriveId: 1,
});

describe("normalizeContactName", () => {
  it("folds case, punctuation and spacing", () => {
    expect(store.normalizeContactName("  Amber   Fairbanks ")).toBe("amber fairbanks");
    expect(store.normalizeContactName("O'Brien, Pat.")).toBe("obrien pat");
  });

  it("ignores the boilerplate that differs between the two systems", () => {
    // Spiro says "Cowan Realtors", Pipedrive says "Cowan Realty Group LLC".
    expect(store.normalizeContactName("Cowan Realtors")).toBe(
      store.normalizeContactName("Cowan Realty Group LLC"),
    );
    expect(store.normalizeContactName("The Smith Team")).toBe("smith");
  });

  it("treats & and 'and' as the same word", () => {
    expect(store.normalizeContactName("Hall & Oates")).toBe(
      store.normalizeContactName("Hall and Oates"),
    );
  });

  it("returns empty for a name with nothing to match on", () => {
    expect(store.normalizeContactName("   ")).toBe("");
    expect(store.normalizeContactName("LLC")).toBe("");
  });
});

describe("lookupContact", () => {
  const index = {
    byEmail: new Map([["amber@example.com", match("Amber By Email", 500)]]),
    byPersonName: new Map([
      ["amber fairbanks", match("Amber Fairbanks", 300)],
      ["cowan", match("Cowan Person", 100)],
    ]),
    byOrgName: new Map([["cowan", match("Cowan Realtors", 200, "organization")]]),
  };

  it("trusts an email over any name", () => {
    const hit = store.lookupContact(index, {
      name: "Amber Fairbanks",
      email: "AMBER@example.com",
      type: "agent",
    });
    expect(hit?.matchedName).toBe("Amber By Email");
  });

  it("matches an agent to a person", () => {
    expect(
      store.lookupContact(index, { name: "amber  FAIRBANKS", type: "agent" })?.matchedName,
    ).toBe("Amber Fairbanks");
  });

  it("matches a company to an organization before a person of the same name", () => {
    const hit = store.lookupContact(index, { name: "Cowan Realty LLC", type: "company" });
    expect(hit?.matchedType).toBe("organization");
    expect(hit?.matchedName).toBe("Cowan Realtors");
  });

  it("lets an agent fall back to an organization when no person matches", () => {
    const onlyOrg = { byEmail: new Map(), byPersonName: new Map(), byOrgName: index.byOrgName };
    expect(store.lookupContact(onlyOrg, { name: "Cowan", type: "agent" })?.matchedType).toBe(
      "organization",
    );
  });

  it("returns nothing rather than a wrong guess", () => {
    expect(store.lookupContact(index, { name: "Someone Unknown", type: "agent" })).toBeNull();
    expect(store.lookupContact(index, { name: "   ", type: "agent" })).toBeNull();
  });
});

describe("status", () => {
  it("reports an unconfigured, never-swept directory without throwing", async () => {
    const status = await store.getPipedriveContactStatus();
    expect(status.configured).toBe(false);
    expect(status.refreshedAt).toBeNull();
    expect(status.personCount).toBe(0);
    expect(status.organizationCount).toBe(0);
  });

  it("refuses to sweep when Pipedrive is not configured, and says why", async () => {
    await expect(store.refreshPipedriveContacts({ manual: true })).rejects.toThrow(
      /not configured/i,
    );
  });
});
