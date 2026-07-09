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
  company: string | null;
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
        market: o.market,
        status: o.status,
        cached_at: 0,
      })),
    )
    .execute();
}

beforeAll(async () => {
  userStore.getAdminDb(); // initialize schema
  await seed("2026-05", [
    { id: "1", client: "Alice", company: "Acme", market: "CLE", status: "delivered" },
    { id: "2", client: "Alice", company: "Acme", market: "CLE", status: "cancelled" },
    { id: "3", client: "Bob", company: "Acme", market: "CLE", status: "delivered" },
    { id: "4", client: "Bob", company: "Globex", market: "CMH", status: "rescheduled" },
    { id: "5", client: "Bob", company: "Globex", market: "CMH", status: "delivered" },
    { id: "6", client: "Carol", company: null, market: "CLE", status: "delivered" },
  ]);
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("getRankingsReport", () => {
  it("ranks agents by order volume with cancellation stats", async () => {
    const r = await store.getRankingsReport({ from: "2026-01", to: "2026-12" });
    expect(r.agents.map((a) => [a.rank, a.name, a.totalOrders])).toEqual([
      [1, "Bob", 3],
      [2, "Alice", 2],
      [3, "Carol", 1],
    ]);
    const alice = r.agents.find((a) => a.name === "Alice")!;
    expect(alice.cancellations).toBe(1);
    expect(alice.cancelledOrRescheduledPct).toBe(50);
  });

  it("ranks companies and skips orders with no company", async () => {
    const r = await store.getRankingsReport({ from: "2026-01", to: "2026-12" });
    // Carol's company-less order is excluded from company ranking.
    expect(r.companies.map((c) => [c.rank, c.name, c.totalOrders])).toEqual([
      [1, "Acme", 3],
      [2, "Globex", 2],
    ]);
  });

  it("honors the market filter", async () => {
    const r = await store.getRankingsReport({ from: "2026-01", to: "2026-12", market: "CMH" });
    expect(r.agents.map((a) => a.name)).toEqual(["Bob"]);
    expect(r.companies.map((c) => c.name)).toEqual(["Globex"]);
  });
});
