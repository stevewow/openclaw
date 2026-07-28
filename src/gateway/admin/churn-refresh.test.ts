import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The pull is the one part that talks to Spiro; stub it so the runner's own
// behaviour (sequencing, failure reporting, the one-at-a-time guard) is what is
// under test.
const pullMock = vi.fn();
vi.mock("./churn-orders.js", () => ({
  pullChurnOrders: (opts: unknown) => pullMock(opts),
}));

const {
  CHURN_YEAR_CHOICES,
  churnEnginePaths,
  getChurnRefreshState,
  isChurnYears,
  resetChurnRefreshState,
  startChurnRefresh,
} = await import("./churn-refresh.js");

const savedPython = process.env.OPENCLAW_CHURN_PYTHON;
const savedReportPath = process.env.OPENCLAW_CHURN_REPORT_PATH;

/** Poll until the background job settles, so tests never sleep on a fixed delay. */
async function settled(timeoutMs = 5000): Promise<ReturnType<typeof getChurnRefreshState>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = getChurnRefreshState();
    if (state.status !== "running") return state;
    if (Date.now() > deadline) throw new Error("refresh did not settle");
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeEach(() => {
  resetChurnRefreshState();
  pullMock.mockReset();
  process.env.OPENCLAW_CHURN_REPORT_PATH = "/tmp/oc-churn-test/wow_retention.json";
});

afterEach(() => {
  if (savedPython === undefined) delete process.env.OPENCLAW_CHURN_PYTHON;
  else process.env.OPENCLAW_CHURN_PYTHON = savedPython;
  if (savedReportPath === undefined) delete process.env.OPENCLAW_CHURN_REPORT_PATH;
  else process.env.OPENCLAW_CHURN_REPORT_PATH = savedReportPath;
});

describe("isChurnYears", () => {
  it("accepts only the offered windows", () => {
    for (const y of CHURN_YEAR_CHOICES) expect(isChurnYears(y)).toBe(true);
    for (const bad of [0, 4, 10, -3, "3", null, undefined, Number.NaN]) {
      expect(isChurnYears(bad)).toBe(false);
    }
  });
});

describe("churnEnginePaths", () => {
  it("puts the cache, workbook and script beside the snapshot", () => {
    const paths = churnEnginePaths();
    const dir = path.dirname("/tmp/oc-churn-test/wow_retention.json");
    expect(paths).toEqual({
      dir,
      script: path.join(dir, "wow_retention.py"),
      cache: path.join(dir, "orders_raw.csv"),
      json: "/tmp/oc-churn-test/wow_retention.json",
      xlsx: path.join(dir, "wow_retention.xlsx"),
    });
  });
});

describe("startChurnRefresh", () => {
  it("reports a failed pull as an error state rather than throwing", async () => {
    pullMock.mockRejectedValue(new Error("Spiro says no"));
    startChurnRefresh({ years: 3, seasonal: true, byUserName: "desk" });
    const state = await settled();
    expect(state.status).toBe("error");
    expect(state.error).toContain("Spiro says no");
    expect(state.startedByName).toBe("desk");
    expect(state.finishedAt).toBeGreaterThan(0);
  });

  it("stops before the engine when the pull came back empty", async () => {
    pullMock.mockResolvedValue({ rows: 0, from: "2023-07-28", to: "2026-07-28" });
    startChurnRefresh({ years: 1, seasonal: true });
    const state = await settled();
    expect(state.status).toBe("error");
    // Worth naming the fix: an empty pull is almost always an expired connection.
    expect(state.error).toContain("/spiro-auth");
  });

  it("explains that the image needs Python when the interpreter is missing", async () => {
    pullMock.mockResolvedValue({ rows: 42, from: "2023-07-28", to: "2026-07-28" });
    process.env.OPENCLAW_CHURN_PYTHON = "/nonexistent/python-for-tests";
    startChurnRefresh({ years: 3, seasonal: false });
    const state = await settled();
    expect(state.status).toBe("error");
    expect(state.error).toContain("OPENCLAW_INSTALL_PYTHON_REPORTS");
  });

  it("refuses a second run while one is in flight", async () => {
    // A pull that never settles keeps the first job running for the assertion.
    pullMock.mockImplementation(() => new Promise(() => {}));
    startChurnRefresh({ years: 3, seasonal: true });
    expect(getChurnRefreshState().status).toBe("running");
    expect(() => startChurnRefresh({ years: 1, seasonal: true })).toThrow(/already running/);
    resetChurnRefreshState();
  });

  it("passes the chosen window and seasonal setting through to the pull", async () => {
    pullMock.mockResolvedValue({ rows: 1, from: "2025-07-28", to: "2026-07-28" });
    process.env.OPENCLAW_CHURN_PYTHON = "/nonexistent/python-for-tests";
    startChurnRefresh({ years: 1, seasonal: false });
    await settled();
    expect(pullMock).toHaveBeenCalledWith(expect.objectContaining({ years: 1 }));
    expect(getChurnRefreshState().seasonal).toBe(false);
    expect(getChurnRefreshState().years).toBe(1);
  });
});
