import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-rankings-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./spiro-report-store.js");
const userStore = await import("./user-store.js");

type Order = {
  id: string;
  client: string;
  agentId?: string | null;
  company: string | null;
  companyId?: string | null;
  market: string | null;
  status: string;
};

async function seed(month: string, orders: Order[]): Promise<void> {
  const db = userStore.getAdminDb();
  await db
    .insertInto("admin_spiro_orders")
    .values(
      orders.map((o) => ({
        id: `${month}:${o.id}`,
        month,
        client: o.client,
        company: o.company,
        agent_id: o.agentId ?? null,
        company_id: o.companyId ?? null,
        market: o.market,
        status: o.status,
        cached_at: 0,
      })),
    )
    .execute();
}

async function seedRoster(
  agents: Array<{ id: string; name: string; vip: boolean; top: boolean; region?: string }>,
): Promise<void> {
  const db = userStore.getAdminDb();
  await db
    .insertInto("admin_focus_agents")
    .values(
      agents.map((a) => ({
        agent_id: a.id,
        name: a.name,
        email: null,
        company_id: null,
        vip: a.vip ? 1 : 0,
        status: "current",
        region: a.region ?? "Columbus, Ohio",
        top_percent: a.top ? 1 : 0,
        cached_at: 0,
      })),
    )
    .execute();
}

beforeAll(async () => {
  userStore.getAdminDb(); // initialize schema
  await seed("2026-05", [
    {
      id: "1",
      client: "Alice",
      agentId: "a-alice",
      company: "Acme",
      companyId: "c-acme",
      market: "CLE",
      status: "delivered",
    },
    {
      id: "2",
      client: "Alice",
      agentId: "a-alice",
      company: "Acme",
      companyId: "c-acme",
      market: "CLE",
      status: "cancelled",
    },
    {
      id: "3",
      client: "Bob",
      agentId: "a-bob",
      company: "Acme",
      companyId: "c-acme",
      market: "CLE",
      status: "delivered",
    },
    {
      id: "4",
      client: "Bob",
      agentId: "a-bob",
      company: "Globex",
      companyId: "c-globex",
      market: "CMH",
      status: "rescheduled",
    },
    {
      id: "5",
      client: "Bob",
      agentId: "a-bob",
      company: "Globex",
      companyId: "c-globex",
      market: "CMH",
      status: "delivered",
    },
    // No agent id: an order cached before the ids were stored still has to rank.
    { id: "6", client: "Carol", company: null, market: "CLE", status: "delivered" },
  ]);
  await seedRoster([
    { id: "a-alice", name: "Alice", vip: true, top: false },
    { id: "a-bob", name: "Bob", vip: false, top: true },
  ]);
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("getAgentRankingsReport", () => {
  it("ranks agents by order volume with cancellation stats", async () => {
    const r = await store.getAgentRankingsReport({ from: "2026-01", to: "2026-12" });
    expect(r.rows.map((a) => [a.rank, a.name, a.totalOrders])).toEqual([
      [1, "Bob", 3],
      [2, "Alice", 2],
      [3, "Carol", 1],
    ]);
    const alice = r.rows.find((a) => a.name === "Alice")!;
    expect(alice.cancellations).toBe(1);
    expect(alice.cancelledOrRescheduledPct).toBe(50);
  });

  it("carries each agent's VIP and top-20% badges", async () => {
    const r = await store.getAgentRankingsReport({ from: "2026-01", to: "2026-12" });
    const byName = new Map(r.rows.map((a) => [a.name, a]));
    expect(byName.get("Alice")).toMatchObject({ vip: true, topPercent: false, region: "Columbus" });
    expect(byName.get("Bob")).toMatchObject({ vip: false, topPercent: true });
    // Not on the roster at all — badgeless rather than wrongly badged.
    expect(byName.get("Carol")).toMatchObject({ vip: false, topPercent: false, region: null });
  });

  it("honors the market filter", async () => {
    const r = await store.getAgentRankingsReport({ from: "2026-01", to: "2026-12", market: "CMH" });
    expect(r.rows.map((a) => a.name)).toEqual(["Bob"]);
  });
});

describe("getCompanyRankingsReport", () => {
  it("ranks companies and skips orders with no company", async () => {
    const r = await store.getCompanyRankingsReport({ from: "2026-01", to: "2026-12" });
    // Carol's company-less order is excluded from company ranking.
    expect(r.rows.map((c) => [c.rank, c.name, c.totalOrders])).toEqual([
      [1, "Acme", 3],
      [2, "Globex", 2],
    ]);
  });

  it("honors the market filter", async () => {
    const r = await store.getCompanyRankingsReport({
      from: "2026-01",
      to: "2026-12",
      market: "CMH",
    });
    expect(r.rows.map((c) => c.name)).toEqual(["Globex"]);
  });
});
