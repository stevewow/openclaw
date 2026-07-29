import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-past-due-cases-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./past-due-cases-store.js");
const financials = await import("./financials-store.js");
const userStore = await import("./user-store.js");

let managerId: string;
let vaId: string;

beforeAll(async () => {
  managerId = (await userStore.createUser({ username: "manager", password: "x", role: "admin" }))
    .id;
  vaId = (
    await userStore.createUser({
      username: "collector",
      password: "x",
      role: "user",
      firstName: "Casey",
      lastName: "Ruiz",
    })
  ).id;
});

describe("past-due cases", () => {
  it("reads as new and unassigned until someone touches the account", async () => {
    expect(await store.getPastDueCase("agent:untouched")).toBeNull();
    const implicit = store.defaultCase("agent:untouched", "Agent Untouched");
    expect(implicit.status).toBe("new");
    expect(implicit.assignedTo).toBeNull();
  });

  it("creates the case on first stage change", async () => {
    const updated = await store.setPastDueCaseStatus({
      accountKey: "agent:one",
      accountName: "Agent One",
      status: "promised",
      byUserName: "manager",
    });
    expect(updated.status).toBe("promised");
    expect(updated.updatedByName).toBe("manager");
    expect((await store.getPastDueCase("agent:one"))?.status).toBe("promised");
  });

  it("starts a newly assigned account working and names the owner", async () => {
    const assigned = await store.assignPastDueCase({
      accountKey: "agent:two",
      accountName: "Agent Two",
      assignedTo: vaId,
      byUserId: managerId,
      byUserName: "manager",
    });
    expect(assigned.assignedTo).toBe(vaId);
    expect(assigned.assignedToName).toBe("Casey Ruiz");
    expect(assigned.assignedBy).toBe(managerId);
    // Handing the account over is the moment it starts being worked.
    expect(assigned.status).toBe("working");
  });

  it("keeps a stage the assignee already moved past when reassigning", async () => {
    await store.setPastDueCaseStatus({
      accountKey: "agent:three",
      accountName: "Agent Three",
      status: "escalated",
    });
    const assigned = await store.assignPastDueCase({
      accountKey: "agent:three",
      accountName: "Agent Three",
      assignedTo: vaId,
      byUserId: managerId,
    });
    expect(assigned.status).toBe("escalated");
  });

  it("releases the account back to unassigned", async () => {
    await store.assignPastDueCase({
      accountKey: "agent:four",
      accountName: "Agent Four",
      assignedTo: vaId,
      byUserId: managerId,
    });
    const released = await store.assignPastDueCase({
      accountKey: "agent:four",
      accountName: "Agent Four",
      assignedTo: null,
      byUserId: managerId,
    });
    expect(released.assignedTo).toBeNull();
    expect(released.assignedAt).toBeNull();
    expect(released.assignedToName).toBeNull();
  });

  it("records and reopens the partial-payment review sign-off", async () => {
    const cleared = await store.setPastDueCaseReviewCleared({
      accountKey: "agent:five",
      accountName: "Agent Five",
      cleared: true,
      byUserId: vaId,
      byUserName: "collector",
      now: 1_700_000_000_000,
    });
    expect(cleared.reviewClearedAt).toBe(1_700_000_000_000);
    expect(cleared.reviewClearedByName).toBe("collector");

    const reopened = await store.setPastDueCaseReviewCleared({
      accountKey: "agent:five",
      accountName: "Agent Five",
      cleared: false,
      byUserId: managerId,
    });
    expect(reopened.reviewClearedAt).toBeNull();
    expect(reopened.reviewClearedBy).toBeNull();
  });

  it("stores and clears the next-action date", async () => {
    const due = await store.setPastDueCaseDueAt({
      accountKey: "agent:six",
      accountName: "Agent Six",
      dueAt: 1_800_000_000_000,
    });
    expect(due.dueAt).toBe(1_800_000_000_000);
    expect(
      (
        await store.setPastDueCaseDueAt({
          accountKey: "agent:six",
          accountName: "Agent Six",
          dueAt: null,
        })
      ).dueAt,
    ).toBeNull();
  });

  it("rejects a stage outside the board", () => {
    expect(store.isPastDueCaseStatus("working")).toBe(true);
    expect(store.isPastDueCaseStatus("done")).toBe(false);
    expect(store.isPastDueCaseStatus(null)).toBe(false);
  });
});

describe("scopeBreakdownToAssignee", () => {
  function account(key: string, balance: number, assignedTo: string | null, partial = 0) {
    return {
      accountKey: key,
      accountName: key,
      accountType: "agent" as const,
      balance,
      invoiced: balance,
      paid: 0,
      invoiceCount: 1,
      partiallyPaidCount: partial,
      needsManualReview: partial > 0,
      oldestDaysPastDue: 100,
      bucket: "90-119" as const,
      action: { label: "x", detail: "y" },
      paymentPlan: { requiredDown: 0, maxMonths: 3 },
      case: { ...store.defaultCase(key, key, 1), assignedTo },
    };
  }

  it("keeps only the viewer's accounts and recomputes the totals over them", () => {
    const breakdown = {
      generatedAt: 1,
      refreshedAt: 1,
      totalPastDue: 600,
      accountCount: 3,
      invoiceCount: 3,
      manualReviewCount: 2,
      byBucket: [],
      byStatus: [],
      accounts: [account("a", 100, "u1", 1), account("b", 200, "u2", 1), account("c", 300, null)],
    };
    const scoped = financials.scopeBreakdownToAssignee(breakdown, "u1");
    expect(scoped.accounts.map((a) => a.accountKey)).toEqual(["a"]);
    expect(scoped.totalPastDue).toBe(100);
    expect(scoped.accountCount).toBe(1);
    expect(scoped.manualReviewCount).toBe(1);
    // The bucket rollup describes the scoped list, not the company-wide one.
    expect(scoped.byBucket.find((b) => b.bucket === "90-119")).toEqual({
      bucket: "90-119",
      accounts: 1,
      amount: 100,
    });
  });
});
