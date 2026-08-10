import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-agent-badges-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const badges = await import("./agent-badges.js");
const focusStore = await import("./focus-store.js");
const userStore = await import("./user-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

type Agent = {
  id: string;
  name: string;
  vip?: number | null;
  companyId?: string | null;
  region?: string | null;
  top?: number | null;
};

async function seedAgents(agents: Agent[]): Promise<void> {
  await userStore
    .getAdminDb()
    .insertInto("admin_focus_agents")
    .values(
      agents.map((a) => ({
        agent_id: a.id,
        name: a.name,
        email: null,
        company_id: a.companyId ?? null,
        vip: a.vip ?? 0,
        status: "current",
        region: a.region ?? null,
        top_percent: a.top ?? 0,
        cached_at: 0,
      })),
    )
    .execute();
}

async function reset(): Promise<void> {
  const db = userStore.getAdminDb();
  await db.deleteFrom("admin_focus_agents").execute();
  await db.deleteFrom("admin_focus_orders").execute();
  await db.deleteFrom("admin_focus_companies").execute();
}

beforeEach(reset);

describe("the agent badge index", () => {
  it("resolves badges by agent id", async () => {
    await seedAgents([{ id: "a1", name: "Amber Fairbanks", vip: 1, region: "Columbus, Ohio" }]);
    const index = await badges.loadAgentBadges();
    expect(index.lookup({ agentId: "a1" })).toEqual({
      vip: true,
      topPercent: false,
      region: "Columbus",
    });
  });

  it("falls back to the name when a row carries no id", async () => {
    await seedAgents([{ id: "a1", name: "Amber Fairbanks", vip: 1 }]);
    const index = await badges.loadAgentBadges();
    // Spacing and case differ between the roster and the order feed.
    expect(index.lookup({ name: "  amber   fairbanks " }).vip).toBe(true);
  });

  it("refuses the name fallback when two agents share a name", async () => {
    await seedAgents([
      { id: "a1", name: "Chris Smith", vip: 1 },
      { id: "a2", name: "Chris Smith", vip: 0 },
    ]);
    const index = await badges.loadAgentBadges();
    // Badging the wrong Chris is worse than badging neither...
    expect(index.lookup({ name: "Chris Smith" }).vip).toBe(false);
    // ...but the id still resolves each of them correctly.
    expect(index.lookup({ agentId: "a1", name: "Chris Smith" }).vip).toBe(true);
  });

  it("returns no badges for an agent who is not on the roster", async () => {
    await seedAgents([{ id: "a1", name: "Amber Fairbanks", vip: 1 }]);
    const index = await badges.loadAgentBadges();
    expect(index.lookup({ agentId: "ghost", name: "Nobody" })).toEqual(badges.NO_BADGES);
    expect(index.lookup({})).toEqual(badges.NO_BADGES);
  });

  it("counts each badge, for a report header", async () => {
    await seedAgents([
      { id: "a1", name: "One", vip: 1, top: 1 },
      { id: "a2", name: "Two", vip: 1 },
      { id: "a3", name: "Three" },
    ]);
    expect((await badges.loadAgentBadges()).counts).toEqual({ vip: 2, topPercent: 1 });
  });

  it("treats a null vip column — a row cached before VIP was swept — as not VIP", async () => {
    await seedAgents([{ id: "a1", name: "Amber Fairbanks", vip: null, top: null }]);
    const index = await badges.loadAgentBadges();
    expect(index.lookup({ agentId: "a1" })).toMatchObject({ vip: false, topPercent: false });
  });
});

describe("the stored top-20% cut", () => {
  const DAY = 86400000;
  const NOW = new Date(2026, 6, 1, 12).getTime();

  async function seedRegionWithOrders(): Promise<void> {
    const db = userStore.getAdminDb();
    await db
      .insertInto("admin_focus_companies")
      .values([
        { company_id: "c-col", name: "Columbus Homes", region: "Columbus, Ohio", cached_at: 0 },
      ])
      .execute();
    // Ten agents in one region; the top 20% is two of them.
    await seedAgents(
      Array.from({ length: 10 }, (_, i) => ({
        id: `a${i}`,
        name: `Agent ${i}`,
        companyId: "c-col",
      })),
    );
    await db
      .insertInto("admin_focus_orders")
      .values(
        Array.from({ length: 10 }, (_, i) => ({
          order_id: `o${i}`,
          agent_id: `a${i}`,
          agent_name: `Agent ${i}`,
          company_id: "c-col",
          company_name: "Columbus Homes",
          order_date: NOW - 30 * DAY,
          total: (i + 1) * 100,
          status: "delivered",
          cached_at: 0,
        })),
      )
      .execute();
  }

  it("marks the top slice of each region by trailing-12-month revenue", async () => {
    await seedRegionWithOrders();
    await focusStore.refreshRosterTopPercent(NOW);

    const index = await badges.loadAgentBadges();
    // a9 and a8 bill the most of the ten.
    expect(index.lookup({ agentId: "a9" }).topPercent).toBe(true);
    expect(index.lookup({ agentId: "a8" }).topPercent).toBe(true);
    expect(index.lookup({ agentId: "a7" }).topPercent).toBe(false);
    expect(index.counts.topPercent).toBe(2);
  });

  it("ignores revenue older than the trailing year", async () => {
    await seedRegionWithOrders();
    // Everything now falls outside the window, so nobody is top of anything.
    await focusStore.refreshRosterTopPercent(NOW + 400 * DAY);
    expect((await badges.loadAgentBadges()).counts.topPercent).toBe(0);
  });

  it("clears a stale badge when an agent stops billing", async () => {
    await seedRegionWithOrders();
    await focusStore.refreshRosterTopPercent(NOW);
    expect((await badges.loadAgentBadges()).lookup({ agentId: "a9" }).topPercent).toBe(true);

    await userStore.getAdminDb().deleteFrom("admin_focus_orders").execute();
    await focusStore.refreshRosterTopPercent(NOW);
    expect((await badges.loadAgentBadges()).lookup({ agentId: "a9" }).topPercent).toBe(false);
  });

  it("does not badge a cancelled-only agent as a top biller", async () => {
    const db = userStore.getAdminDb();
    await db
      .insertInto("admin_focus_companies")
      .values([{ company_id: "c-col", name: "Cols", region: "Columbus, Ohio", cached_at: 0 }])
      .execute();
    await seedAgents([{ id: "a1", name: "Cancelled Only", companyId: "c-col" }]);
    await db
      .insertInto("admin_focus_orders")
      .values([
        {
          order_id: "o1",
          agent_id: "a1",
          agent_name: "Cancelled Only",
          company_id: "c-col",
          company_name: "Cols",
          order_date: NOW - DAY,
          total: 5000,
          status: "cancelled",
          cached_at: 0,
        },
      ])
      .execute();
    await focusStore.refreshRosterTopPercent(NOW);
    expect((await badges.loadAgentBadges()).lookup({ agentId: "a1" }).topPercent).toBe(false);
  });
});
