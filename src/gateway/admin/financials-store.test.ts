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

function invoice(id: string, opts: { dateFullyPaid?: string | null; amount?: number } = {}) {
  return {
    invoiceId: id,
    referenceNumber: id,
    status: "open",
    dateDue: new Date(Date.now() - 90 * DAY).toISOString(),
    dateFullyPaid: opts.dateFullyPaid ?? null,
    amount: { total: opts.amount ?? 100 },
    party: { payeeType: "agent", agentId: `a-${id}`, agentName: `Agent ${id}` },
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

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "financials-store-test-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    const mod = await import("./financials-store.js");
    refreshInvoices = mod.refreshInvoices;
    getPastDueBreakdown = mod.getPastDueBreakdown;
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
});
