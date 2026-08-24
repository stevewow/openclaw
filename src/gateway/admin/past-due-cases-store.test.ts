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
      action: financials.resolveAction("90-119", null),
      paymentPlan: { requiredDown: 0, maxMonths: 3 },
      case: { ...store.defaultCase(key, key, 1), assignedTo },
      lastContact: null,
      daysSinceContact: null,
      nextContact: null,
      daysUntilContact: null,
      promiseBroken: false,
      needsAttention: false,
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
      attentionCount: 0,
      promiseBrokenCount: 0,
      escalatedCount: 0,
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

describe("pinned next action", () => {
  it("is unset until someone pins it, so every account follows the policy", async () => {
    const c = await store.getPastDueCase("never-touched");
    expect(c).toBeNull();
    expect(store.defaultCase("never-touched", "Never Touched").nextAction).toBeNull();
  });

  it("persists the pinned step and survives a re-read", async () => {
    await store.setPastDueCaseNextAction({
      accountKey: "acct-pin",
      accountName: "Pinned Co",
      nextAction: "call_90",
      byUserName: "Casey",
    });
    expect((await store.getPastDueCase("acct-pin"))?.nextAction).toBe("call_90");
  });

  it("hands the account back to the policy when cleared", async () => {
    await store.setPastDueCaseNextAction({
      accountKey: "acct-clear",
      accountName: "Clear Co",
      nextAction: "letter_120",
    });
    await store.setPastDueCaseNextAction({
      accountKey: "acct-clear",
      accountName: "Clear Co",
      nextAction: null,
    });
    expect((await store.getPastDueCase("acct-clear"))?.nextAction).toBeNull();
  });

  it("leaves the stage and owner alone", async () => {
    await store.setPastDueCaseStatus({
      accountKey: "acct-both",
      accountName: "Both Co",
      status: "promised",
    });
    await store.setPastDueCaseNextAction({
      accountKey: "acct-both",
      accountName: "Both Co",
      nextAction: "email_45",
    });
    const c = await store.getPastDueCase("acct-both");
    expect(c?.status).toBe("promised");
    expect(c?.nextAction).toBe("email_45");
  });

  it("ignores a stored value that is not a step, rather than trusting it", async () => {
    // A key retired from the policy must not come back as a live step.
    await store.setPastDueCaseStatus({
      accountKey: "acct-bad",
      accountName: "Bad Co",
      status: "new",
    });
    const db = userStore.getAdminDb();
    await db
      .updateTable("admin_past_due_cases")
      .set({ next_action: "retired_step" })
      .where("account_key", "=", "acct-bad")
      .execute();
    expect((await store.getPastDueCase("acct-bad"))?.nextAction).toBeNull();
  });
});

describe("promise to pay", () => {
  const DAY = 86_400_000;

  it("records the amount and date, and moves the case to promised", async () => {
    const c = await store.setPastDueCasePromise({
      accountKey: "acct-promise",
      accountName: "Promise Co",
      promisedAmount: 500,
      promisedDate: 10 * DAY,
      byUserName: "Casey Ruiz",
    });
    expect(c.promisedAmount).toBe(500);
    expect(c.promisedDate).toBe(10 * DAY);
    expect(c.status).toBe("promised");
  });

  it("advances a case that was still only being worked", async () => {
    await store.setPastDueCaseStatus({
      accountKey: "acct-working",
      accountName: "Working Co",
      status: "working",
    });
    const c = await store.setPastDueCasePromise({
      accountKey: "acct-working",
      accountName: "Working Co",
      promisedAmount: null,
      promisedDate: 10 * DAY,
    });
    expect(c.status).toBe("promised");
  });

  it("leaves a later stage where it is — a promise there is a detail, not a step back", async () => {
    for (const status of ["plan", "escalated", "resolved"] as const) {
      const key = `acct-late-${status}`;
      await store.setPastDueCaseStatus({ accountKey: key, accountName: "Late Co", status });
      const c = await store.setPastDueCasePromise({
        accountKey: key,
        accountName: "Late Co",
        promisedAmount: 100,
        promisedDate: 10 * DAY,
      });
      expect(c.status).toBe(status);
      expect(c.promisedDate).toBe(10 * DAY);
    }
  });

  it("drops the promise without dropping the stage", async () => {
    await store.setPastDueCasePromise({
      accountKey: "acct-drop",
      accountName: "Drop Co",
      promisedAmount: 500,
      promisedDate: 10 * DAY,
    });
    const c = await store.setPastDueCasePromise({
      accountKey: "acct-drop",
      accountName: "Drop Co",
      promisedAmount: null,
      promisedDate: null,
    });
    expect(c.promisedAmount).toBeNull();
    expect(c.promisedDate).toBeNull();
    expect(c.status).toBe("promised");
  });

  it("counts a promise as broken only once its date has gone by", () => {
    const base = store.defaultCase("acct-x", "X Co", 0);
    const promised = { ...base, status: "promised" as const, promisedDate: 10 * DAY };
    expect(store.isPromiseBroken(promised, 9 * DAY)).toBe(false);
    expect(store.isPromiseBroken(promised, 11 * DAY)).toBe(true);
  });

  it("is not broken once the money arrives, whatever the date says", () => {
    const base = store.defaultCase("acct-y", "Y Co", 0);
    const paid = { ...base, status: "resolved" as const, promisedDate: 10 * DAY };
    expect(store.isPromiseBroken(paid, 11 * DAY)).toBe(false);
  });

  it("is not broken when nothing was ever promised", () => {
    const base = store.defaultCase("acct-z", "Z Co", 0);
    expect(store.isPromiseBroken({ ...base, status: "promised" }, 11 * DAY)).toBe(false);
  });
});

describe("escalation handoff", () => {
  it("moves the stage and the owner in one write", async () => {
    await store.assignPastDueCase({
      accountKey: "acct-esc",
      accountName: "Esc Co",
      assignedTo: vaId,
      byUserId: managerId,
      byUserName: "manager",
    });
    const c = await store.markPastDueCaseEscalated({
      accountKey: "acct-esc",
      accountName: "Esc Co",
      ownerId: managerId,
      reason: "  No response to four calls.  ",
      byUserId: vaId,
      byUserName: "Casey Ruiz",
      now: 5_000,
    });
    expect(c.status).toBe("escalated");
    expect(c.assignedTo).toBe(managerId);
    expect(c.escalatedAt).toBe(5_000);
    expect(c.escalatedBy).toBe(vaId);
    expect(c.escalatedByName).toBe("Casey Ruiz");
    expect(c.escalatedFrom).toBe(vaId);
    expect(c.escalatedReason).toBe("No response to four calls.");
  });

  it("escalates with no owner configured, leaving the case where it sits", async () => {
    await store.assignPastDueCase({
      accountKey: "acct-esc-noowner",
      accountName: "Esc Co",
      assignedTo: vaId,
      byUserId: managerId,
      byUserName: "manager",
    });
    const c = await store.markPastDueCaseEscalated({
      accountKey: "acct-esc-noowner",
      accountName: "Esc Co",
      ownerId: null,
      reason: null,
      byUserId: vaId,
    });
    expect(c.status).toBe("escalated");
    expect(c.assignedTo).toBe(vaId);
    expect(c.escalatedReason).toBeNull();
  });

  it("caps a long reason rather than storing it whole", async () => {
    const c = await store.markPastDueCaseEscalated({
      accountKey: "acct-esc-long",
      accountName: "Esc Co",
      ownerId: managerId,
      reason: "x".repeat(3000),
      byUserId: vaId,
    });
    expect(c.escalatedReason).toHaveLength(2000);
  });
});
