// Refresh runner for the Churn & Retention report.
//
// A refresh is two steps: pull order history from Spiro (churn-orders.ts), then
// run the Python retention engine over it. Both take minutes, far longer than an
// HTTP request should hold, so the route starts a job and the dashboard polls
// this module's status. One job at a time, process-wide — two concurrent runs
// would race on the same cache CSV and snapshot file.
//
// The engine is Python because that is where the Pareto/NBD fit lives; the
// gateway image carries the interpreter and its wheels (see Dockerfile,
// OPENCLAW_INSTALL_PYTHON_REPORTS).

import { spawn } from "node:child_process";
import path from "node:path";
import { pullChurnOrders } from "./churn-orders.js";
import { resolveChurnReportPath } from "./churn-store.js";

export type ChurnRefreshStatus = "idle" | "running" | "ok" | "error";

export type ChurnRefreshState = {
  status: ChurnRefreshStatus;
  step: string;
  years: number;
  seasonal: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  startedByName: string | null;
  error: string | null;
  log: string[];
};

// Enough lines to show the window-by-window pull without growing unbounded on a
// long run; the UI only ever shows the tail.
const MAX_LOG_LINES = 200;
const ENGINE_TIMEOUT_MS = 20 * 60 * 1000;

export const CHURN_YEAR_CHOICES = [1, 2, 3, 5] as const;
export type ChurnYears = (typeof CHURN_YEAR_CHOICES)[number];

export function isChurnYears(v: unknown): v is ChurnYears {
  return typeof v === "number" && (CHURN_YEAR_CHOICES as readonly number[]).includes(v);
}

let state: ChurnRefreshState = {
  status: "idle",
  step: "",
  years: 3,
  seasonal: true,
  startedAt: null,
  finishedAt: null,
  startedByName: null,
  error: null,
  log: [],
};

export function getChurnRefreshState(): ChurnRefreshState {
  return { ...state, log: [...state.log] };
}

function pushLog(line: string): void {
  const trimmed = line.trimEnd();
  if (!trimmed) return;
  state.log.push(trimmed);
  if (state.log.length > MAX_LOG_LINES) state.log = state.log.slice(-MAX_LOG_LINES);
}

function setStep(step: string): void {
  state.step = step;
  pushLog(step);
}

/** Paths the engine reads and writes, all resolved from the snapshot location. */
export function churnEnginePaths(workspaceDir?: string): {
  dir: string;
  script: string;
  cache: string;
  json: string;
  xlsx: string;
} {
  const json = resolveChurnReportPath(workspaceDir);
  const dir = path.dirname(json);
  return {
    dir,
    script: path.join(dir, "wow_retention.py"),
    cache: path.join(dir, "orders_raw.csv"),
    json,
    xlsx: path.join(dir, "wow_retention.xlsx"),
  };
}

function pythonBin(): string {
  return process.env.OPENCLAW_CHURN_PYTHON?.trim() || "python3";
}

async function runEngine(opts: {
  years: number;
  seasonal: boolean;
  workspaceDir?: string;
}): Promise<void> {
  const paths = churnEnginePaths(opts.workspaceDir);
  const args = [
    paths.script,
    "--cache",
    paths.cache,
    "--years",
    String(opts.years),
    "--output",
    paths.xlsx,
    "--json",
    paths.json,
  ];
  if (!opts.seasonal) args.push("--no-seasonal-adjust");

  await new Promise<void>((resolve, reject) => {
    // cwd is the engine directory so `import paretonbd` resolves without the
    // caller having to set PYTHONPATH.
    const child = spawn(pythonBin(), args, { cwd: paths.dir });
    let stderrTail = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`retention engine timed out after ${ENGINE_TIMEOUT_MS / 60000} minutes`));
    }, ENGINE_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      for (const line of chunk.split("\n")) pushLog(line);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-2000);
      for (const line of chunk.split("\n")) pushLog(line);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `could not start ${pythonBin()}: ${err.message}. The gateway image needs Python with pandas/numpy/scipy (build with OPENCLAW_INSTALL_PYTHON_REPORTS=1).`,
        ),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`retention engine exited ${code}: ${stderrTail.trim().slice(-500)}`));
    });
  });
}

/**
 * Start a refresh. Returns the state immediately; the work continues in the
 * background and is observed through `getChurnRefreshState`. Throws when a run
 * is already in flight.
 */
export function startChurnRefresh(opts: {
  years: ChurnYears;
  seasonal: boolean;
  byUserName?: string | null;
  workspaceDir?: string;
}): ChurnRefreshState {
  if (state.status === "running") {
    throw new Error("a refresh is already running");
  }
  state = {
    status: "running",
    step: "",
    years: opts.years,
    seasonal: opts.seasonal,
    startedAt: Date.now(),
    finishedAt: null,
    startedByName: opts.byUserName ?? null,
    error: null,
    log: [],
  };

  void (async () => {
    try {
      const paths = churnEnginePaths(opts.workspaceDir);
      setStep("Pulling order history from Spiro…");
      const pull = await pullChurnOrders({
        years: opts.years,
        cachePath: paths.cache,
        onProgress: pushLog,
      });
      if (pull.rows === 0) {
        throw new Error(
          "Spiro returned no orders for that window. Check the Spiro connection (/spiro-auth) and try again.",
        );
      }
      setStep("Running the retention engine…");
      await runEngine({
        years: opts.years,
        seasonal: opts.seasonal,
        workspaceDir: opts.workspaceDir,
      });
      state.status = "ok";
      state.step = "Done";
      state.finishedAt = Date.now();
    } catch (err) {
      state.status = "error";
      state.step = "Failed";
      state.error = err instanceof Error ? err.message : String(err);
      state.finishedAt = Date.now();
      pushLog(state.error);
    }
  })();

  return getChurnRefreshState();
}

/** Test seam: drop any recorded run so cases start from a clean slate. */
export function resetChurnRefreshState(): void {
  state = {
    status: "idle",
    step: "",
    years: 3,
    seasonal: true,
    startedAt: null,
    finishedAt: null,
    startedByName: null,
    error: null,
    log: [],
  };
}
