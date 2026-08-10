import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

// The roster sweep decides who gets a VIP badge anywhere in the dashboard.
//
// It used to ask Spiro for `status: "current"` agents only, which silently lost
// most of the VIP list: 179 agents carry settings.vip but only 79 are "current",
// so a VIP who had gone former rendered as an ordinary client. This pins the
// filter off, and pins that the status is stored rather than thrown away.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-focus-sweep-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const listTools = vi.fn();
const callTool = vi.fn();
vi.mock("../../../extensions/spiro/api.js", () => ({
  listTools: () => listTools(),
  callTool: (name: string, args: Record<string, unknown>) => callTool(name, args),
}));

const store = await import("./focus-store.js");
const userStore = await import("./user-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

function agent(id: string, first: string, status: string, vip: boolean) {
  return {
    identity: { agentId: id, firstName: first, lastName: "Tester", status },
    contact: { emailAddress: `${first}@example.com` },
    company: { companyId: "c1" },
    settings: { vip },
  };
}

/** Wrap rows the way Spiro's MCP layer does: text content holding {data, meta}. */
function page(rows: unknown[], hasNextPage = false) {
  return {
    content: [{ type: "text", text: JSON.stringify({ data: rows, meta: { hasNextPage } }) }],
  };
}

describe("the agent roster sweep", () => {
  it("sweeps every status, and keeps a non-current VIP's badge", async () => {
    listTools.mockResolvedValue([
      { name: "search_spiro_companies" },
      { name: "search_spiro_agents" },
      { name: "search_spiro_reporting_orders" },
    ]);
    callTool.mockImplementation((name: string) =>
      Promise.resolve(
        name === "search_spiro_agents"
          ? page([
              agent("a1", "Current", "current", true),
              agent("a2", "Former", "former", true),
              agent("a3", "Unclassified", "unclassified", false),
            ])
          : page([]),
      ),
    );

    // sweepAgents is internal; refreshFocusData is how it is reached. The order
    // sweep runs against the same stub and simply yields nothing usable.
    await store.refreshFocusData({ from: "2026-07-01", to: "2026-07-31" });

    const rows = await userStore
      .getAdminDb()
      .selectFrom("admin_focus_agents")
      .selectAll()
      .orderBy("agent_id")
      .execute();
    expect(rows.map((r) => [r.agent_id, r.status, r.vip])).toEqual([
      ["a1", "current", 1],
      ["a2", "former", 1],
      ["a3", "unclassified", 0],
    ]);

    // The point of the fix: no status filter is sent, so nothing is lost.
    const agentCalls = callTool.mock.calls.filter(([name]) => name === "search_spiro_agents");
    expect(agentCalls.length).toBeGreaterThan(0);
    for (const [, args] of agentCalls) {
      expect(args).not.toHaveProperty("status");
    }
  });
});
