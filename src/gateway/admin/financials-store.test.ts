import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  bucketForDays,
  PAST_DUE_BUCKETS,
  paymentPlanTerms,
  policyAction,
} from "./financials-store.js";

// Mock the Spiro MCP client so refreshInvoices runs against controlled pages.
const listTools = vi.fn();
const callTool = vi.fn();
vi.mock("../../../extensions/spiro/api.js", () => ({
  listTools: () => listTools(),
  callTool: (name: string, args: Record<string, unknown>) => callTool(name, args),
}));

const DAY = 24 * 60 * 60 * 1000;

function invoice(
  id: string,
  opts: {
    dateFullyPaid?: string | null;
    amount?: number;
    amountPaid?: number;
    status?: string;
    agentId?: string;
  } = {},
) {
  const total = opts.amount ?? 100;
  const paid = opts.amountPaid ?? 0;
  const agentId = opts.agentId ?? `a-${id}`;
  return {
    invoiceId: id,
    referenceNumber: id,
    status: opts.status ?? "open",
    dateDue: new Date(Date.now() - 90 * DAY).toISOString(),
    dateFullyPaid: opts.dateFullyPaid ?? null,
    // Mirrors Spiro's InvoiceAmountModel: amountDue is the total less payments.
    amount: { total, amountPaid: paid, amountDue: total - paid },
    party: { payeeType: "agent", agentId, agentName: `Agent ${agentId}` },
  };
}

function page(invoices: unknown[], hasNextPage: boolean) {
  return {
    content: [{ type: "text", text: JSON.stringify({ data: invoices, meta: { hasNextPage } }) }],
  };
}

describe("bucketForDays", () => {
  it("maps day counts to the correct collections-policy bucket at each boundary", () => {
    expect(bucketForDays(1)).toBe("1-44");
    expect(bucketForDays(44)).toBe("1-44");
    expect(bucketForDays(45)).toBe("45-59");
    expect(bucketForDays(59)).toBe("45-59");
    expect(bucketForDays(60)).toBe("60-89");
    expect(bucketForDays(89)).toBe("60-89");
    expect(bucketForDays(90)).toBe("90-119");
    expect(bucketForDays(119)).toBe("90-119");
    expect(bucketForDays(120)).toBe("120+");
    expect(bucketForDays(400)).toBe("120+");
  });

  it("has a policy action for every bucket", () => {
    for (const bucket of PAST_DUE_BUCKETS) {
      const action = policyAction(bucket);
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.detail.length).toBeGreaterThan(0);
    }
  });

  it("surfaces BDS + collections referral only in the escalated buckets", () => {
    expect(policyAction("60-89").detail).toMatch(/BDS/);
    expect(policyAction("120+").detail).toMatch(/collections/i);
    expect(policyAction("1-44").detail).not.toMatch(/BDS/);
  });
});

describe("paymentPlanTerms", () => {
  it("requires 10% down", () => {
    expect(paymentPlanTerms(1000).requiredDown).toBe(100);
    expect(paymentPlanTerms(2500).requiredDown).toBe(250);
  });

  it("caps the plan at 3 months under $1,000 and 6 months at/over $1,000", () => {
    expect(paymentPlanTerms(999.99).maxMonths).toBe(3);
    expect(paymentPlanTerms(1000).maxMonths).toBe(6);
    expect(paymentPlanTerms(5000).maxMonths).toBe(6);
  });

  it("rounds the down payment to cents", () => {
    expect(paymentPlanTerms(333.33).requiredDown).toBe(33.33);
  });
});

describe("refreshInvoices", () => {
  let tmpDir: string;
  let refreshInvoices: typeof import("./financials-store.js").refreshInvoices;
  let getPastDueBreakdown: typeof import("./financials-store.js").getPastDueBreakdown;
  let getAccountInvoices: typeof import("./financials-store.js").getAccountInvoices;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "financials-store-test-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    const mod = await import("./financials-store.js");
    refreshInvoices = mod.refreshInvoices;
    getPastDueBreakdown = mod.getPastDueBreakdown;
    getAccountInvoices = mod.getAccountInvoices;
    listTools.mockResolvedValue([{ name: "search_spiro_invoices" }]);
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("dedupes invoices repeated across pages instead of crashing on the PK", async () => {
    // Sorting by the all-null dateFullyPaid block is unstable, so INV2 shows up
    // on both pages. Page 3 starts the paid block, stopping the scan.
    callTool
      .mockResolvedValueOnce(page([invoice("INV1"), invoice("INV2")], true))
      .mockResolvedValueOnce(page([invoice("INV2"), invoice("INV3")], true))
      .mockResolvedValueOnce(page([invoice("INV4", { dateFullyPaid: "2026-01-01" })], true));

    const { count } = await refreshInvoices({ manual: true });
    expect(count).toBe(3); // INV1, INV2, INV3 — INV2 counted once

    const breakdown = await getPastDueBreakdown();
    expect(breakdown.invoiceCount).toBe(3);
    // Each unpaid invoice is $100; the duplicate must not double-count.
    expect(breakdown.totalPastDue).toBe(300);
  });

  it("leaves the prior snapshot intact when a refresh fails mid-scan", async () => {
    callTool.mockReset();
    callTool.mockRejectedValueOnce(new Error("Spiro token expired"));
    await expect(refreshInvoices({ manual: true })).rejects.toThrow(/expired/);

    // The previous successful snapshot (3 invoices) must still be readable.
    const breakdown = await getPastDueBreakdown();
    expect(breakdown.invoiceCount).toBe(3);
    expect(breakdown.totalPastDue).toBe(300);
  });

  describe("partial payments", () => {
    it("owes only what is still due and flags the account for manual review", async () => {
      callTool.mockReset();
      callTool.mockResolvedValueOnce(
        page(
          [
            invoice("PART", { amount: 300, amountPaid: 250, status: "PartiallyPaid" }),
            invoice("FULL", { amount: 200, agentId: "clean" }),
          ],
          false,
        ),
      );
      await refreshInvoices({ manual: true });

      const breakdown = await getPastDueBreakdown();
      // $50 still owed on the partly paid invoice, not the $300 invoiced.
      expect(breakdown.totalPastDue).toBe(250);
      expect(breakdown.manualReviewCount).toBe(1);

      const flagged = breakdown.accounts.find((a) => a.accountKey === "agent:a-PART");
      expect(flagged?.balance).toBe(50);
      expect(flagged?.invoiced).toBe(300);
      expect(flagged?.paid).toBe(250);
      expect(flagged?.partiallyPaidCount).toBe(1);
      expect(flagged?.needsManualReview).toBe(true);

      const clean = breakdown.accounts.find((a) => a.accountKey === "agent:clean");
      expect(clean?.balance).toBe(200);
      expect(clean?.needsManualReview).toBe(false);
    });

    it("flags a payment Spiro reports without the PartiallyPaid label", async () => {
      callTool.mockReset();
      callTool.mockResolvedValueOnce(
        page([invoice("QUIET", { amount: 400, amountPaid: 100, status: "sent" })], false),
      );
      await refreshInvoices({ manual: true });

      const { invoices } = await getAccountInvoices("agent:a-QUIET");
      expect(invoices[0]?.partiallyPaid).toBe(true);
      expect(invoices[0]?.outstanding).toBe(300);
      expect(invoices[0]?.amountPaid).toBe(100);
    });

    it("falls back to the invoiced total when Spiro reports no amounts", async () => {
      callTool.mockReset();
      callTool.mockResolvedValueOnce(
        page(
          [
            {
              invoiceId: "BARE",
              referenceNumber: "BARE",
              status: "sent",
              dateDue: new Date(Date.now() - 90 * DAY).toISOString(),
              dateFullyPaid: null,
              amount: { total: 175 },
              party: { payeeType: "agent", agentId: "bare", agentName: "Agent bare" },
            },
          ],
          false,
        ),
      );
      await refreshInvoices({ manual: true });

      const { invoices } = await getAccountInvoices("agent:bare");
      expect(invoices[0]?.amountPaid).toBeNull();
      expect(invoices[0]?.outstanding).toBe(175);
      expect(invoices[0]?.partiallyPaid).toBe(false);
    });
  });
});
