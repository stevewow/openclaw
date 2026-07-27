import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-churn-dismiss-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./churn-dismissals-store.js");
const userStore = await import("./user-store.js");

let deskId: string;

beforeAll(async () => {
  deskId = (await userStore.createUser({ username: "desk", password: "x", role: "admin" })).id;
});

afterEach(async () => {
  for (const d of await store.listChurnDismissals()) {
    await store.restoreChurnAgent(d.agentKey);
  }
});

describe("churn dismissals store", () => {
  it("records who hid an agent and why", async () => {
    await store.dismissChurnAgent({
      agentKey: "guid-1",
      agentName: "Dana Reyes",
      companyName: "Coldwell Banker Heritage",
      reason: "Retired in June",
      byUserId: deskId,
      byUserName: "desk",
      now: 1_700_000_000_000,
    });
    const list = await store.listChurnDismissals();
    expect(list).toEqual([
      {
        agentKey: "guid-1",
        agentName: "Dana Reyes",
        companyName: "Coldwell Banker Heritage",
        reason: "Retired in June",
        dismissedBy: deskId,
        dismissedByName: "desk",
        dismissedAt: 1_700_000_000_000,
      },
    ]);
  });

  it("re-dismissing the same agent refreshes the reason instead of failing", async () => {
    await store.dismissChurnAgent({
      agentKey: "guid-1",
      agentName: "Dana Reyes",
      reason: "Retired",
      now: 1,
    });
    await store.dismissChurnAgent({
      agentKey: "guid-1",
      agentName: "Dana Reyes",
      reason: "Actually: moved to Florida",
      byUserName: "desk",
      now: 2,
    });
    const list = await store.listChurnDismissals();
    expect(list).toHaveLength(1);
    expect(list[0]?.reason).toBe("Actually: moved to Florida");
    expect(list[0]?.dismissedByName).toBe("desk");
    expect(list[0]?.dismissedAt).toBe(2);
  });

  it("stores a blank reason as null", async () => {
    const d = await store.dismissChurnAgent({
      agentKey: "guid-2",
      agentName: "Sam Okafor",
      reason: "   ",
    });
    expect(d.reason).toBeNull();
  });

  it("lists newest first", async () => {
    await store.dismissChurnAgent({ agentKey: "a", agentName: "A", now: 10 });
    await store.dismissChurnAgent({ agentKey: "b", agentName: "B", now: 30 });
    await store.dismissChurnAgent({ agentKey: "c", agentName: "C", now: 20 });
    const keys = (await store.listChurnDismissals()).map((d) => d.agentKey);
    expect(keys).toEqual(["b", "c", "a"]);
  });

  it("restores a hidden agent, and reports when there was nothing to restore", async () => {
    await store.dismissChurnAgent({ agentKey: "guid-3", agentName: "Kim Lee" });
    expect(await store.restoreChurnAgent("guid-3")).toBe(true);
    expect(await store.listChurnDismissals()).toEqual([]);
    expect(await store.restoreChurnAgent("guid-3")).toBe(false);
  });
});
