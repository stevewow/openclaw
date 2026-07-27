// Churn & Retention report store.
//
// Unlike the Spiro reports (which compute from cached order data in the DB),
// this report is produced out-of-band by the Python retention engine in the
// workspace (`reports/wow_retention/wow_retention.py`), which writes a JSON
// snapshot. The dashboard simply reads and renders that snapshot — no compute
// here. Refresh = re-run the Python engine (cron or by hand); the workspace is
// bind-mounted into the gateway container so the file is read in place.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// The snapshot is authored by the Python engine (schema_version 1). We keep the
// nested arrays loosely typed (rows are display records) rather than mirroring
// every column, so a Python-side additive change does not require a TS edit.
export interface ChurnReportSnapshot {
  schema_version: number;
  generated_at: string;
  observation_end: string;
  seasonal_adjust: boolean;
  orders_kept: number;
  orders_total: number;
  agents_total: number;
  headline: Record<string, number | string | null>;
  health_tiers: Record<string, number>;
  model: Record<string, number>;
  identity_audit: Record<string, unknown>;
  revenue_retention: Array<Record<string, unknown>>;
  second_order_conversion: Array<Record<string, unknown>>;
  seasonality: Array<Record<string, unknown>>;
  data_quality: Array<Record<string, unknown>>;
  agent_scores: Array<Record<string, unknown>>;
  outreach_queue: Array<Record<string, unknown>>;
}

export type ChurnReportResult =
  | { ok: true; report: ChurnReportSnapshot }
  | { ok: false; status: "not_generated" | "unreadable" };

const REPORT_RELATIVE_PATH = ["reports", "wow_retention", "wow_retention.json"];

/**
 * Absolute path to the churn snapshot. `OPENCLAW_CHURN_REPORT_PATH` overrides;
 * otherwise it sits under the given workspace dir (the bind-mounted workspace in
 * production), falling back to `~/.openclaw/workspace` when none is passed.
 */
export function resolveChurnReportPath(workspaceDir?: string): string {
  const override = process.env.OPENCLAW_CHURN_REPORT_PATH?.trim();
  if (override) {
    return override;
  }
  const base =
    workspaceDir?.trim() ||
    process.env.OPENCLAW_WORKSPACE_DIR?.trim() ||
    path.join(os.homedir(), ".openclaw", "workspace");
  return path.join(base, ...REPORT_RELATIVE_PATH);
}

/**
 * Read the churn snapshot. Returns a discriminated result so the caller can
 * distinguish "engine has not run yet" (ENOENT) from a corrupt/unreadable file.
 */
export async function getChurnReport(workspaceDir?: string): Promise<ChurnReportResult> {
  const file = resolveChurnReportPath(workspaceDir);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, status: "not_generated" };
    }
    return { ok: false, status: "unreadable" };
  }
  try {
    const report = JSON.parse(raw) as ChurnReportSnapshot;
    if (!report || typeof report !== "object" || typeof report.schema_version !== "number") {
      return { ok: false, status: "unreadable" };
    }
    return { ok: true, report };
  } catch {
    return { ok: false, status: "unreadable" };
  }
}
