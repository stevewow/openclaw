import fs from "node:fs/promises";
import os from "node:os";
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
const savedVenv = process.env.OPENCLAW_PYTHON_REPORTS_VENV;
const savedPath = process.env.PATH;
const savedReportPath = process.env.OPENCLAW_CHURN_REPORT_PATH;

// A real directory holding a stand-in engine script: the runner preflights that
// the script exists and the directory is writable before it pulls anything.
let reportDir = "";

/**
 * An executable that succeeds whatever it is handed, standing in for a Python
 * with the engine's wheels installed. Lets a case exercise the whole run without
 * the test host needing pandas.
 */
async function writeStubPython(body = "exit 0"): Promise<string> {
  const bin = path.join(reportDir, `python-stub-${body.length}`);
  await fs.writeFile(bin, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return bin;
}

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

/**
 * A stand-in for the image's report venv: a directory laid out like one, whose
 * `bin/python3` is the given stub. Used to prove the runner reaches the venv
 * interpreter directly rather than trusting PATH lookup.
 */
async function writeStubVenv(body: string): Promise<string> {
  const venv = path.join(reportDir, "stub-venv");
  await fs.mkdir(path.join(venv, "bin"), { recursive: true });
  await fs.writeFile(path.join(venv, "bin", "python3"), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return venv;
}

beforeEach(async () => {
  resetChurnRefreshState();
  pullMock.mockReset();
  delete process.env.OPENCLAW_PYTHON_REPORTS_VENV;
  reportDir = await fs.mkdtemp(path.join(os.tmpdir(), "oc-churn-test-"));
  await fs.writeFile(path.join(reportDir, "wow_retention.py"), "# stand-in engine\n");
  process.env.OPENCLAW_CHURN_REPORT_PATH = path.join(reportDir, "wow_retention.json");
});

afterEach(async () => {
  if (savedPython === undefined) delete process.env.OPENCLAW_CHURN_PYTHON;
  else process.env.OPENCLAW_CHURN_PYTHON = savedPython;
  if (savedVenv === undefined) delete process.env.OPENCLAW_PYTHON_REPORTS_VENV;
  else process.env.OPENCLAW_PYTHON_REPORTS_VENV = savedVenv;
  if (savedPath === undefined) delete process.env.PATH;
  else process.env.PATH = savedPath;
  if (savedReportPath === undefined) delete process.env.OPENCLAW_CHURN_REPORT_PATH;
  else process.env.OPENCLAW_CHURN_REPORT_PATH = savedReportPath;
  await fs.rm(reportDir, { recursive: true, force: true });
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
    expect(paths).toEqual({
      dir: reportDir,
      script: path.join(reportDir, "wow_retention.py"),
      cache: path.join(reportDir, "orders_raw.csv"),
      json: path.join(reportDir, "wow_retention.json"),
      xlsx: path.join(reportDir, "wow_retention.xlsx"),
    });
  });
});

describe("startChurnRefresh", () => {
  it("reports a failed pull as an error state rather than throwing", async () => {
    process.env.OPENCLAW_CHURN_PYTHON = await writeStubPython();
    pullMock.mockRejectedValue(new Error("Spiro says no"));
    startChurnRefresh({ years: 3, seasonal: true, byUserName: "desk" });
    const state = await settled();
    expect(state.status).toBe("error");
    expect(state.error).toContain("Spiro says no");
    expect(state.startedByName).toBe("desk");
    expect(state.finishedAt).toBeGreaterThan(0);
  });

  it("stops before the engine when the pull came back empty", async () => {
    process.env.OPENCLAW_CHURN_PYTHON = await writeStubPython();
    pullMock.mockResolvedValue({ rows: 0, from: "2023-07-28", to: "2026-07-28" });
    startChurnRefresh({ years: 1, seasonal: true });
    const state = await settled();
    expect(state.status).toBe("error");
    // Worth naming the fix: an empty pull is almost always an expired connection.
    expect(state.error).toContain("/spiro-auth");
  });

  it("explains that the image needs Python, without pulling first", async () => {
    pullMock.mockResolvedValue({ rows: 42, from: "2023-07-28", to: "2026-07-28" });
    process.env.OPENCLAW_CHURN_PYTHON = "/nonexistent/python-for-tests";
    startChurnRefresh({ years: 3, seasonal: false });
    const state = await settled();
    expect(state.status).toBe("error");
    expect(state.error).toContain("OPENCLAW_INSTALL_PYTHON_REPORTS");
    // The pull costs minutes; a deployment fault should not spend them first.
    expect(pullMock).not.toHaveBeenCalled();
  });

  it("names the missing wheels when the interpreter cannot import them", async () => {
    pullMock.mockResolvedValue({ rows: 42, from: "2023-07-28", to: "2026-07-28" });
    process.env.OPENCLAW_CHURN_PYTHON = await writeStubPython(
      "echo \"ModuleNotFoundError: No module named 'pandas'\" >&2; exit 1",
    );
    startChurnRefresh({ years: 3, seasonal: true });
    const state = await settled();
    expect(state.status).toBe("error");
    expect(state.error).toContain("pandas");
    expect(state.error).toContain("OPENCLAW_INSTALL_PYTHON_REPORTS");
    expect(pullMock).not.toHaveBeenCalled();
  });

  it("stops when the engine script is not mounted", async () => {
    process.env.OPENCLAW_CHURN_PYTHON = await writeStubPython();
    await fs.rm(path.join(reportDir, "wow_retention.py"));
    startChurnRefresh({ years: 3, seasonal: true });
    const state = await settled();
    expect(state.status).toBe("error");
    expect(state.error).toContain("wow_retention.py");
    expect(pullMock).not.toHaveBeenCalled();
  });

  it("refuses a second run while one is in flight", async () => {
    process.env.OPENCLAW_CHURN_PYTHON = await writeStubPython();
    // A pull that never settles keeps the first job running for the assertion.
    pullMock.mockImplementation(() => new Promise(() => {}));
    startChurnRefresh({ years: 3, seasonal: true });
    expect(getChurnRefreshState().status).toBe("running");
    expect(() => startChurnRefresh({ years: 1, seasonal: true })).toThrow(/already running/);
    resetChurnRefreshState();
  });

  // The gateway hardens PATH at startup (src/infra/path-env.ts prepends /usr/bin
  // and /bin), which pushes the image's report venv behind the system
  // interpreter — so a bare `python3` finds one without the engine's wheels.
  // The runner has to address the venv directly.
  it("uses the report venv's interpreter rather than PATH lookup", async () => {
    pullMock.mockResolvedValue({ rows: 42, from: "2023-07-28", to: "2026-07-28" });
    // Fails loudly, so the assertion holds whether or not the test host's own
    // python3 happens to have the wheels.
    process.env.OPENCLAW_PYTHON_REPORTS_VENV = await writeStubVenv(
      "echo stub-venv-interpreter >&2; exit 1",
    );
    startChurnRefresh({ years: 3, seasonal: true });
    const state = await settled();
    expect(state.status).toBe("error");
    expect(state.error).toContain("stub-venv-interpreter");
    expect(state.error).toContain(path.join("stub-venv", "bin", "python3"));
  });

  it("falls back to PATH when the venv has no interpreter", async () => {
    pullMock.mockResolvedValue({ rows: 42, from: "2023-07-28", to: "2026-07-28" });
    process.env.OPENCLAW_PYTHON_REPORTS_VENV = path.join(reportDir, "not-a-venv");
    // Resolve `python3` to a stub of this test's own rather than whatever the
    // host has, so the case does not depend on the machine running it.
    await fs.writeFile(path.join(reportDir, "python3"), "#!/bin/sh\necho on-path >&2\nexit 1\n", {
      mode: 0o755,
    });
    process.env.PATH = `${reportDir}${path.delimiter}${savedPath}`;
    startChurnRefresh({ years: 3, seasonal: true });
    const state = await settled();
    expect(state.status).toBe("error");
    expect(state.error).toContain("on-path");
    // The bare name went to PATH lookup; no path inside the absent venv was tried.
    expect(state.error).not.toContain("not-a-venv");
  });

  it("lets an explicit interpreter override the venv", async () => {
    pullMock.mockResolvedValue({ rows: 42, from: "2023-07-28", to: "2026-07-28" });
    process.env.OPENCLAW_PYTHON_REPORTS_VENV = await writeStubVenv("exit 0");
    process.env.OPENCLAW_CHURN_PYTHON = await writeStubPython("echo explicit-override >&2; exit 1");
    startChurnRefresh({ years: 3, seasonal: true });
    const state = await settled();
    expect(state.status).toBe("error");
    expect(state.error).toContain("explicit-override");
  });

  it("runs preflight, pull and engine through to a finished snapshot", async () => {
    pullMock.mockResolvedValue({ rows: 1, from: "2025-07-28", to: "2026-07-28" });
    process.env.OPENCLAW_CHURN_PYTHON = await writeStubPython();
    startChurnRefresh({ years: 1, seasonal: false });
    const state = await settled();
    expect(state.error).toBeNull();
    expect(state.status).toBe("ok");
    expect(state.step).toBe("Done");
    expect(pullMock).toHaveBeenCalledWith(expect.objectContaining({ years: 1 }));
    expect(state.seasonal).toBe(false);
    expect(state.years).toBe(1);
  });
});
