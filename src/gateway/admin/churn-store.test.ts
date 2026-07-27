import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getChurnReport, resolveChurnReportPath } from "./churn-store.js";

const ENV_KEYS = ["OPENCLAW_CHURN_REPORT_PATH", "OPENCLAW_WORKSPACE_DIR"] as const;

describe("churn-store", () => {
  let tmp: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "churn-store-"));
  });

  afterEach(async () => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = saved[k];
      }
    }
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("resolves the snapshot under the workspace dir by default", () => {
    expect(resolveChurnReportPath("/ws")).toBe(
      path.join("/ws", "reports", "wow_retention", "wow_retention.json"),
    );
  });

  it("honors the OPENCLAW_CHURN_REPORT_PATH override", () => {
    process.env.OPENCLAW_CHURN_REPORT_PATH = "/custom/report.json";
    expect(resolveChurnReportPath("/ws")).toBe("/custom/report.json");
  });

  it("reports not_generated when the snapshot is missing", async () => {
    const result = await getChurnReport(tmp);
    expect(result).toEqual({ ok: false, status: "not_generated" });
  });

  it("reports unreadable on malformed JSON", async () => {
    const file = resolveChurnReportPath(tmp);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "{ not json");
    const result = await getChurnReport(tmp);
    expect(result).toEqual({ ok: false, status: "unreadable" });
  });

  it("reports unreadable when the payload is not a versioned snapshot", async () => {
    const file = resolveChurnReportPath(tmp);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ hello: "world" }));
    const result = await getChurnReport(tmp);
    expect(result).toEqual({ ok: false, status: "unreadable" });
  });

  it("returns the parsed snapshot when present and valid", async () => {
    const file = resolveChurnReportPath(tmp);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const snapshot = {
      schema_version: 1,
      generated_at: "2026-07-27T12:00:00",
      observation_end: "2026-07-27",
      seasonal_adjust: true,
      orders_kept: 10,
      orders_total: 12,
      agents_total: 3,
      headline: { grr: 0.83 },
      health_tiers: { Healthy: 2, "Likely churned": 1 },
      model: { r: 1.5 },
      identity_audit: { guid_stable: true },
      revenue_retention: [],
      second_order_conversion: [],
      seasonality: [],
      data_quality: [],
      agent_scores: [],
      outreach_queue: [],
    };
    await fs.writeFile(file, JSON.stringify(snapshot));
    const result = await getChurnReport(tmp);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.schema_version).toBe(1);
      expect(result.report.health_tiers["Likely churned"]).toBe(1);
    }
  });
});
