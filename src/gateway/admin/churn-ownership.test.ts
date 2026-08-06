import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// The admin DB opens lazily on first use, so pointing it at a temp dir here is
// early enough for the index test below.
process.env.OPENCLAW_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-churn-own-"));

import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import {
  attachChurnOwnership,
  type ChurnRegionIndex,
  churnOwnership,
  loadChurnRegionIndex,
  lookupChurnRegion,
} from "./churn-ownership.js";
import { getAdminDb } from "./user-store.js";

/**
 * The churn queue says who to call; this decides whose call it is. A wrong
 * answer sends a BDS after someone else's client, so the join has to prefer the
 * agent GUID and refuse to guess when only an ambiguous brokerage name is left.
 */

const index = (
  agents: Record<string, string>,
  companies: Record<string, string> = {},
): ChurnRegionIndex => ({
  byAgentId: new Map(Object.entries(agents)),
  byCompanyName: new Map(Object.entries(companies)),
});

// Churn rows are loose display records the engine authors, and `region`/`bds`
// are written onto them after the fact — so the fixture is typed the way the
// code sees them, not as the narrow literal the object would otherwise infer.
type ChurnRowLike = Record<string, unknown> & { agent_id: string };

const row = (agentId: string, company: string, revenue: number): ChurnRowLike => ({
  agent_id: agentId,
  agent_name: "Agent " + agentId,
  company_name: company,
  revenue,
});

describe("lookupChurnRegion", () => {
  it("joins on the agent GUID first", () => {
    const idx = index({ a1: "Toledo, Ohio" }, { "cincy realty": "Cincinnati, Ohio" });
    expect(lookupChurnRegion(idx, row("a1", "Cincy Realty", 10))).toBe("Toledo, Ohio");
  });

  it("falls back to the brokerage for an agent off the current roster", () => {
    // Churn is about lapsed clients, so the roster sweep (current agents only)
    // is exactly where they go missing.
    const idx = index({}, { "cincy realty": "Cincinnati, Ohio" });
    expect(lookupChurnRegion(idx, row("gone", "Cincy Realty", 10))).toBe("Cincinnati, Ohio");
    expect(lookupChurnRegion(idx, row("gone", "  CINCY   REALTY ", 10))).toBe("Cincinnati, Ohio");
  });

  it("answers unknown rather than guessing when nothing matches", () => {
    const idx = index({}, {});
    expect(lookupChurnRegion(idx, row("x", "Nowhere Homes", 10))).toBeNull();
    expect(lookupChurnRegion(idx, { agent_id: "x", revenue: 1 })).toBeNull();
  });
});

describe("churnOwnership", () => {
  it("hands a sole-owner region to its BDS", () => {
    const owners = churnOwnership(
      [row("a1", "Cincy Realty", 500)],
      index({ a1: "Cincinnati, Ohio" }),
    );
    expect(owners.get("a1")).toEqual({ region: "Cincinnati", bds: "Pam Branam" });
  });

  it("splits Columbus and Dayton at each city's own top 20%", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => row(`col${i}`, "Columbus Homes", 1000 - i)),
      ...Array.from({ length: 5 }, (_, i) => row(`day${i}`, "Dayton Group", 10 - i)),
    ];
    const idx = index(
      Object.fromEntries([
        ...rows.slice(0, 5).map((r) => [r.agent_id, "Columbus, Ohio"]),
        ...rows.slice(5).map((r) => [r.agent_id, "Dayton, Ohio"]),
      ]),
    );
    const owners = churnOwnership(rows, idx);
    expect(owners.get("col0")?.bds).toBe("Chris Voge");
    expect(owners.get("col1")?.bds).toBe("Ryan Bowersock");
    // Dayton bills a hundredth of Columbus and still keeps a top client.
    expect(owners.get("day0")?.bds).toBe("Chris Voge");
    expect(owners.get("day1")?.bds).toBe("Ryan Bowersock");
  });

  it("leaves an unknown region unowned rather than assigning someone", () => {
    const owners = churnOwnership([row("a9", "Mystery Group", 900)], index({}));
    expect(owners.get("a9")).toEqual({ region: null, bds: null });
  });

  it("does not let the queue's duplicate of an agent distort the cut", () => {
    // The outreach queue is a subset of the agent scores, so every queued agent
    // arrives twice. Counted twice, a 5-client city would cut its top slice at
    // 2 instead of 1.
    const scores = Array.from({ length: 5 }, (_, i) => row(`c${i}`, "Columbus Homes", 100 - i));
    const idx = index(Object.fromEntries(scores.map((r) => [r.agent_id, "Columbus, Ohio"])));
    const withDupes = churnOwnership([...scores, ...scores.slice(0, 3)], idx);
    const clean = churnOwnership(scores, idx);
    for (const r of scores) {
      expect(withDupes.get(r.agent_id)).toEqual(clean.get(r.agent_id));
    }
    expect(clean.get("c1")?.bds).toBe("Ryan Bowersock");
  });

  it("treats a missing revenue figure as zero instead of throwing", () => {
    const owners = churnOwnership(
      [{ agent_id: "a1", company_name: "Lima Realty" }],
      index({ a1: "Lima, Ohio" }),
    );
    expect(owners.get("a1")?.bds).toBe("Ryan Bowersock");
  });
});

describe("attachChurnOwnership", () => {
  it("writes region and bds onto the rows of both tables", () => {
    const scores = [row("a1", "Cincy Realty", 100), row("a2", "Mystery Group", 50)];
    const queue = [scores[0]];
    const stats = attachChurnOwnership([scores, queue], index({ a1: "Cincinnati, Ohio" }));
    expect(scores[0].region).toBe("Cincinnati");
    expect(scores[0].bds).toBe("Pam Branam");
    // Explicitly null, not absent: the column renders "—" rather than undefined.
    expect(scores[1].region).toBeNull();
    expect(scores[1].bds).toBeNull();
    expect(stats).toEqual({ owned: 1, unknownRegion: 1 });
  });

  it("leaves every row unowned when the Focus cache is empty", () => {
    // The cache is swept by the Focus report, not this one, so a deployment that
    // has never run that sweep must still render the churn report.
    const scores = [row("a1", "Cincy Realty", 100)];
    const stats = attachChurnOwnership([scores, []], index({}));
    expect(scores[0].bds).toBeNull();
    expect(stats.owned).toBe(0);
  });
});

describe("loadChurnRegionIndex", () => {
  beforeAll(async () => {
    const db = getAdminDb();
    const now = Date.now();
    await db
      .insertInto("admin_focus_companies")
      .values([
        { company_id: "c-cin", name: "Cincy Realty", region: "Cincinnati, Ohio", cached_at: now },
        // The same brokerage name held under two company records in two
        // different regions — the report's own data-quality table lists these.
        { company_id: "c-kw1", name: "Keller Williams", region: "Columbus, Ohio", cached_at: now },
        { company_id: "c-kw2", name: "Keller Williams", region: "Toledo, Ohio", cached_at: now },
        // Duplicated within one region: still answerable.
        { company_id: "c-re1", name: "RE/MAX", region: "Lima, Ohio", cached_at: now },
        { company_id: "c-re2", name: "RE/MAX", region: "Lima, Ohio", cached_at: now },
        { company_id: "c-none", name: "No Area Co", region: null, cached_at: now },
      ])
      .execute();
    await db
      .insertInto("admin_focus_agents")
      .values([
        { agent_id: "a1", name: "A One", email: null, company_id: "c-cin", vip: 0, cached_at: now },
        {
          agent_id: "a2",
          name: "A Two",
          email: null,
          company_id: "c-none",
          vip: 0,
          cached_at: now,
        },
      ])
      .execute();
  });

  it("maps an agent through their brokerage to a service area", async () => {
    const idx = await loadChurnRegionIndex();
    expect(idx.byAgentId.get("a1")).toBe("Cincinnati, Ohio");
  });

  it("omits an agent whose brokerage has no service area", async () => {
    const idx = await loadChurnRegionIndex();
    expect(idx.byAgentId.has("a2")).toBe(false);
  });

  it("refuses a brokerage name that spans two regions", async () => {
    const idx = await loadChurnRegionIndex();
    // Answering "Columbus" here would hand a Toledo client to the wrong BDS.
    expect(idx.byCompanyName.has("keller williams")).toBe(false);
    expect(idx.byCompanyName.get("re/max")).toBe("Lima, Ohio");
    expect(idx.byCompanyName.get("cincy realty")).toBe("Cincinnati, Ohio");
  });
});

/**
 * The dashboard side is one inline template string that no type or lint pass
 * reads, so these are the wiring facts nothing else catches: a container the
 * script writes into but the page never renders fails silently at runtime.
 */
describe("the churn page wires the territory surface", () => {
  it("renders the container the filter is written into", () => {
    expect(ADMIN_UI_HTML).toContain('id="churn-bds-row"');
    expect(ADMIN_UI_HTML).toContain("getElementById('churn-bds-row')");
  });

  it("puts the region and BDS columns in both churn tables", () => {
    // Defined once, used twice — the queue and the full scores table.
    expect(ADMIN_UI_HTML.split("var CHURN_BDS_COL").length - 1).toBe(1);
    expect(ADMIN_UI_HTML.split("CHURN_BDS_COL,").length - 1).toBe(2);
    expect(ADMIN_UI_HTML.split("CHURN_REGION_COL,").length - 1).toBe(2);
  });

  it("opts the filter select out of the global full-width rule", () => {
    // `input, select, textarea { width: 100% }` is global here; a select in a
    // flex row that does not opt out swallows the whole line.
    expect(ADMIN_UI_HTML).toContain(".churn-bds-row select { width: auto");
  });
});
