import { describe, expect, it } from "vitest";
import {
  CSV_COLUMNS,
  flattenOrderRow,
  ordersToCsv,
  orderWindows,
  parseReportingResult,
} from "./churn-orders.js";

// One real row from the Spiro reporting endpoint, trimmed.
const SAMPLE_ORDER = {
  orderId: "b537a8a4-6c3d-4eab-b77c-08ded36e21d6",
  orderNumber: "kfw298g5k",
  orderDate: "2026-07-01T04:16:23.004817-04:00",
  status: "delivered",
  total: 245,
  agent: { id: "8443437d-2075-403b-a6e1-e87788f86f63", name: "Amber Fairbanks" },
  company: { id: "ec3b9940-336b-444f-873d-048d894b5648", name: "Coldwell Banker Heritage" },
  products: [
    { id: "p1", name: "Floor Plan", kind: "addOn", source: "applicableAddOn" },
    { id: "p2", name: "Photography", kind: "baseType", source: "includedBundleService" },
    {
      id: "p3",
      name: "WOW Essentials: HDR Photography",
      kind: "bundle",
      source: "purchasedBundle",
    },
  ],
};

describe("flattenOrderRow", () => {
  it("maps a reporting row onto the engine's cache schema", () => {
    expect(flattenOrderRow(SAMPLE_ORDER)).toEqual({
      order_id: "b537a8a4-6c3d-4eab-b77c-08ded36e21d6",
      order_number: "kfw298g5k",
      order_date: "2026-07-01T04:16:23.004817-04:00",
      status: "delivered",
      total: "245",
      agent_id: "8443437d-2075-403b-a6e1-e87788f86f63",
      agent_name: "Amber Fairbanks",
      company_id: "ec3b9940-336b-444f-873d-048d894b5648",
      company_name: "Coldwell Banker Heritage",
      product_bundle: "WOW Essentials: HDR Photography",
    });
  });

  it("takes the purchased bundle, not an add-on or an included service", () => {
    const row = flattenOrderRow(SAMPLE_ORDER);
    expect(row.product_bundle).toBe("WOW Essentials: HDR Photography");
  });

  it("survives an order with no agent, company or products", () => {
    const row = flattenOrderRow({ orderId: "x", status: "cancelled" });
    // The engine drops agent-less rows during cleaning; the puller's job is to
    // hand them over intact rather than to decide.
    expect(row.agent_id).toBe("");
    expect(row.agent_name).toBe("");
    expect(row.product_bundle).toBe("");
    expect(row.total).toBe("0");
  });
});

describe("parseReportingResult", () => {
  it("unwraps the MCP text envelope and reads the pagination meta", () => {
    const payload = {
      data: [SAMPLE_ORDER],
      meta: { hasMoreData: true, resultSetAsOf: "2026-07-28T17:57:36+00:00" },
    };
    const parsed = parseReportingResult({
      content: [{ type: "text", text: JSON.stringify(payload) }],
    });
    expect(parsed.orders).toHaveLength(1);
    expect(parsed.hasMoreData).toBe(true);
    expect(parsed.resultSetAsOf).toBe("2026-07-28T17:57:36+00:00");
  });

  it("treats a missing or unparseable envelope as an empty last page", () => {
    expect(parseReportingResult(null)).toEqual({
      orders: [],
      hasMoreData: false,
      resultSetAsOf: null,
    });
    expect(parseReportingResult({ content: [{ type: "text", text: "not json" }] })).toEqual({
      orders: [],
      hasMoreData: false,
      resultSetAsOf: null,
    });
  });
});

describe("orderWindows", () => {
  it("never exceeds the endpoint's 31-day span cap", () => {
    const windows = orderWindows(new Date("2024-01-01"), new Date("2026-07-28"));
    for (const w of windows) {
      const span = (Date.parse(w.to) - Date.parse(w.from)) / 86_400_000;
      expect(span).toBeLessThanOrEqual(30);
    }
  });

  it("covers the range end to end with no gap and no overlap", () => {
    const windows = orderWindows(new Date("2026-01-01"), new Date("2026-03-15"));
    expect(windows[0]?.from).toBe("2026-01-01");
    expect(windows.at(-1)?.to).toBe("2026-03-15");
    for (let i = 1; i < windows.length; i++) {
      const prevTo = Date.parse(windows[i - 1].to);
      expect(Date.parse(windows[i].from) - prevTo).toBe(86_400_000);
    }
  });

  it("returns a single window when the range is shorter than the cap", () => {
    expect(orderWindows(new Date("2026-07-01"), new Date("2026-07-10"))).toEqual([
      { from: "2026-07-01", to: "2026-07-10" },
    ]);
  });
});

describe("ordersToCsv", () => {
  it("writes the engine's header and quotes cells containing commas or quotes", () => {
    const rows = [
      flattenOrderRow({
        ...SAMPLE_ORDER,
        company: { id: "c1", name: 'Realty, "Inc"' },
      }),
    ];
    const csv = ordersToCsv(rows);
    const [header, body] = csv.trim().split("\n");
    expect(header).toBe(CSV_COLUMNS.join(","));
    expect(body).toContain('"Realty, ""Inc"""');
  });

  it("writes a header-only file when nothing came back", () => {
    expect(ordersToCsv([])).toBe(`${CSV_COLUMNS.join(",")}\n`);
  });
});
