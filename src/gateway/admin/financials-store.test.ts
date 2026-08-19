import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  bucketForDays,
  PAST_DUE_BUCKETS,
  PAST_DUE_MIN_DAYS,
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
    dueDaysAgo?: number;
  } = {},
) {
  const total = opts.amount ?? 100;
  const paid = opts.amountPaid ?? 0;
  const agentId = opts.agentId ?? `a-${id}`;
  return {
    invoiceId: id,
    referenceNumber: id,
    status: opts.status ?? "open",
    dateDue: new Date(Date.now() - (opts.dueDaysAgo ?? 90) * DAY).toISOString(),
    dateFullyPaid: opts.dateFullyPaid ?? null,
    // Mirrors Spiro's InvoiceAmountModel: amountDue is the total less payments.
    amount: { total, amountPaid: paid, amountDue: total - paid },
    // Field name and capitalization copied from a live mcp.spiro.media response.
    payee: {
      payeeType: "Agent",
      agentId,
      agentName: `Agent ${agentId}`,
      companyId: null,
      companyName: null,
    },
  };
}

function page(invoices: unknown[], hasNextPage: boolean) {
  return {
    content: [{ type: "text", text: JSON.stringify({ data: invoices, meta: { hasNextPage } }) }],
  };
}

describe("bucketForDays", () => {
  it("maps day counts to the correct collections-policy bucket at each boundary", () => {
    expect(bucketForDays(45)).toBe("45-59");
    expect(bucketForDays(59)).toBe("45-59");
    expect(bucketForDays(60)).toBe("60-89");
    expect(bucketForDays(89)).toBe("60-89");
    expect(bucketForDays(90)).toBe("90-119");
    expect(bucketForDays(119)).toBe("90-119");
    expect(bucketForDays(120)).toBe("120+");
    expect(bucketForDays(400)).toBe("120+");
  });

  it("has no bucket below the 45-day collections floor", () => {
    expect(bucketForDays(44)).toBeNull();
    expect(bucketForDays(1)).toBeNull();
    expect(bucketForDays(0)).toBeNull();
    expect(bucketForDays(-5)).toBeNull();
    expect(PAST_DUE_MIN_DAYS).toBe(45);
    expect(PAST_DUE_BUCKETS).not.toContain("1-44");
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
    expect(policyAction("45-59").detail).not.toMatch(/BDS/);
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

  describe("payee identity", () => {
    // This block exists because a silent payee-parse failure shipped: the code
    // read `raw.party` while Spiro sends `raw.payee`, so every invoice in
    // production collapsed into one "Unknown payee" account while the unit
    // tests stayed green against a fixture that invented the same wrong key.
    // These payloads are copied verbatim from live mcp.spiro.media responses.
    const LIVE_AGENT_INVOICE = {
      invoiceId: "63db7dbf-50e6-4bd6-9e80-4d8e741395a6",
      referenceNumber: "WVT076908",
      status: "Sent",
      payee: {
        payeeType: "Agent",
        agentId: "3b987a9a-d0e5-421f-ab5a-d34247de5463",
        agentName: "Sue Corigliano",
        companyId: null,
        companyName: null,
      },
      amount: {
        subtotal: 300,
        adjustmentTotal: 0,
        total: 300,
        amountPaid: 0,
        creditAmountUsed: 0,
        amountApplied: 0,
        amountDue: 300,
        salesTax: 0,
        cancellationAmount: 0,
        rescheduleAmount: 0,
      },
      dateCreated: "2026-05-19T12:36:38.9552015Z",
      dateFullyPaid: null,
      isPaidInFull: false,
      orderCount: 1,
      isVisibleToClient: true,
    };

    const LIVE_COMPANY_INVOICE = {
      invoiceId: "ba68c547-c469-4fb0-9279-cb730ef8c13b",
      referenceNumber: "WVT076841",
      status: "Sent",
      payee: {
        payeeType: "Company",
        agentId: null,
        agentName: null,
        companyId: "117e7c0e-71f8-41d1-994a-e427f8fc8738",
        companyName: "Lake Group Realty",
      },
      amount: { total: 250, amountPaid: 0, amountDue: 250 },
      dateCreated: "2026-05-19T05:00:01.0929569Z",
      dateFullyPaid: null,
      isPaidInFull: false,
      orderCount: 1,
      isVisibleToClient: true,
    };

    const aged = (raw: Record<string, unknown>) => ({
      ...raw,
      dateDue: new Date(Date.now() - 90 * DAY).toISOString(),
    });

    it("names the account from a live agent-payee invoice", async () => {
      callTool.mockReset();
      callTool.mockResolvedValueOnce(page([aged(LIVE_AGENT_INVOICE)], false));
      await refreshInvoices({ manual: true });

      const breakdown = await getPastDueBreakdown();
      expect(breakdown.accounts).toHaveLength(1);
      expect(breakdown.accounts[0]).toMatchObject({
        accountKey: "agent:3b987a9a-d0e5-421f-ab5a-d34247de5463",
        accountName: "Sue Corigliano",
        accountType: "agent",
      });
    });

    it("names the account from a live company-payee invoice", async () => {
      callTool.mockReset();
      callTool.mockResolvedValueOnce(page([aged(LIVE_COMPANY_INVOICE)], false));
      await refreshInvoices({ manual: true });

      const breakdown = await getPastDueBreakdown();
      expect(breakdown.accounts).toHaveLength(1);
      expect(breakdown.accounts[0]).toMatchObject({
        accountKey: "company:117e7c0e-71f8-41d1-994a-e427f8fc8738",
        accountName: "Lake Group Realty",
        accountType: "company",
      });
    });

    it("still reads the legacy `party` block so an upstream rollback is safe", async () => {
      const { payee, ...rest } = LIVE_AGENT_INVOICE;
      callTool.mockReset();
      callTool.mockResolvedValueOnce(page([aged({ ...rest, party: payee })], false));
      await refreshInvoices({ manual: true });

      const breakdown = await getPastDueBreakdown();
      expect(breakdown.accounts[0]?.accountName).toBe("Sue Corigliano");
    });

    it("rejects the refresh when no invoice carries a payee, keeping the last snapshot", async () => {
      // Seed a good snapshot, then serve a page whose payee block is gone.
      callTool.mockReset();
      callTool.mockResolvedValueOnce(page([aged(LIVE_AGENT_INVOICE)], false));
      await refreshInvoices({ manual: true });

      const stripped = Array.from({ length: 12 }, (_, i) => {
        const { payee: _payee, ...rest } = LIVE_AGENT_INVOICE;
        return aged({ ...rest, invoiceId: `SHAPE-DRIFT-${i}` });
      });
      callTool.mockReset();
      callTool.mockResolvedValueOnce(page(stripped, false));

      await expect(refreshInvoices({ manual: true })).rejects.toThrow(/none carried a payee/);

      // The named snapshot survived rather than being replaced by unknowns.
      const breakdown = await getPastDueBreakdown();
      expect(breakdown.accounts).toHaveLength(1);
      expect(breakdown.accounts[0]?.accountName).toBe("Sue Corigliano");
    });
  });

  describe("the 45-day collections floor", () => {
    it("leaves out invoices and accounts that have not reached 45 days past due", async () => {
      callTool.mockReset();
      callTool.mockResolvedValueOnce(
        page(
          [
            invoice("YOUNG", { amount: 500, dueDaysAgo: 44, agentId: "young" }),
            invoice("RIPE", { amount: 200, dueDaysAgo: 45, agentId: "ripe" }),
          ],
          false,
        ),
      );
      await refreshInvoices({ manual: true });

      const breakdown = await getPastDueBreakdown();
      // The 44-day invoice is stored but contributes nothing to the report.
      expect(breakdown.accounts.map((a) => a.accountKey)).toEqual(["agent:ripe"]);
      expect(breakdown.totalPastDue).toBe(200);
      expect(breakdown.invoiceCount).toBe(1);
      expect(breakdown.accounts[0]?.bucket).toBe("45-59");
      expect(await getAccountInvoices("agent:young")).toMatchObject({ invoices: [] });
    });

    it("counts only the 45+ invoices of an account that qualifies, so the modal reconciles", async () => {
      callTool.mockReset();
      callTool.mockResolvedValueOnce(
        page(
          [
            invoice("OLD", { amount: 300, dueDaysAgo: 100, agentId: "mixed" }),
            invoice("NEW", { amount: 700, dueDaysAgo: 10, agentId: "mixed" }),
          ],
          false,
        ),
      );
      await refreshInvoices({ manual: true });

      const breakdown = await getPastDueBreakdown();
      const acct = breakdown.accounts.find((a) => a.accountKey === "agent:mixed");
      expect(acct?.balance).toBe(300);
      expect(acct?.invoiceCount).toBe(1);
      expect(acct?.bucket).toBe("90-119");

      const { invoices } = await getAccountInvoices("agent:mixed");
      expect(invoices.map((i) => i.referenceNumber)).toEqual(["OLD"]);
      expect(invoices.reduce((s, i) => s + i.outstanding, 0)).toBe(acct?.balance);
    });

    it("carries a Spiro deep link when the invoice id is a UUID", async () => {
      const uuid = "52dfa04c-682e-4dfb-a165-848875809d07";
      callTool.mockReset();
      callTool.mockResolvedValueOnce(
        page([invoice(uuid, { amount: 150, agentId: "linkable" })], false),
      );
      await refreshInvoices({ manual: true });

      const { invoices } = await getAccountInvoices("agent:linkable");
      expect(invoices[0]?.spiroUrl).toBe(
        "https://admins.wowvideotours.com/invoices/clients/pending-invoices/52DFA04C-682E-4DFB-A165-848875809D07",
      );
    });

    it("leaves the link null when the invoice id is not a UUID", async () => {
      callTool.mockReset();
      callTool.mockResolvedValueOnce(
        page([invoice("WVT076170", { amount: 150, agentId: "unlinkable" })], false),
      );
      await refreshInvoices({ manual: true });

      const { invoices } = await getAccountInvoices("agent:unlinkable");
      expect(invoices[0]?.spiroUrl).toBeNull();
    });
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
              payee: {
                payeeType: "Agent",
                agentId: "bare",
                agentName: "Agent bare",
                companyId: null,
                companyName: null,
              },
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
