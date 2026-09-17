import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * The two ceilings. They are the answer to "what is the worst this can cost
 * me", so they are worth pinning: one stops a stuck browser tab, the other
 * stops the month.
 */
describe("what the coach is allowed to cost", () => {
  let tmpDir: string;
  let limits: typeof import("./coach-limits.js");
  let store: typeof import("./coach-store.js");

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "coach-limits-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    limits = await import("./coach-limits.js");
    store = await import("./coach-store.js");
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    limits.resetCoachLimits();
  });

  it("is off unless a key is configured", () => {
    expect(limits.coachApiKey({} as NodeJS.ProcessEnv)).toBe(null);
    expect(limits.coachApiKey({ ANTHROPIC_API_KEY: "  " } as NodeJS.ProcessEnv)).toBe(null);
    expect(limits.coachApiKey({ ANTHROPIC_API_KEY: "sk-x" } as NodeJS.ProcessEnv)).toBe("sk-x");
  });

  it("has its own model knob, apart from the help center's", () => {
    expect(limits.coachModel({} as NodeJS.ProcessEnv)).toBe("claude-opus-5");
    expect(limits.coachModel({ COACH_MODEL: "claude-sonnet-5" } as NodeJS.ProcessEnv)).toBe(
      "claude-sonnet-5",
    );
    // KB_ASK_MODEL is the other feature's and must not reach in here.
    expect(limits.coachModel({ KB_ASK_MODEL: "something-else" } as NodeJS.ProcessEnv)).toBe(
      "claude-opus-5",
    );
  });

  it("stops one person asking in a loop", async () => {
    const env = { COACH_HOURLY_CAP: "3" } as NodeJS.ProcessEnv;
    for (let i = 0; i < 3; i++) {
      expect((await limits.checkCoachAllowance("u-loop", env)).ok, `ask ${i}`).toBe(true);
    }
    const blocked = await limits.checkCoachAllowance("u-loop", env);
    expect(blocked).toEqual({ ok: false, reason: "user" });
    // Someone else is unaffected: the key is the person, not the box.
    expect((await limits.checkCoachAllowance("u-other", env)).ok).toBe(true);
  });

  it("counts a slot on allowance, so a failing model cannot be retried into a bill", async () => {
    const env = { COACH_HOURLY_CAP: "1" } as NodeJS.ProcessEnv;
    expect((await limits.checkCoachAllowance("u-fail", env)).ok).toBe(true);
    // No answer was ever produced, and the slot is still gone.
    expect((await limits.checkCoachAllowance("u-fail", env)).ok).toBe(false);
  });

  it("stops the whole team once the day's ceiling is reached", async () => {
    const env = { COACH_DAILY_CAP: "2", COACH_HOURLY_CAP: "99" } as NodeJS.ProcessEnv;
    for (let i = 0; i < 2; i++) {
      await store.recordCoachAsk({
        userId: null,
        threadId: "th-1",
        question: `q${i}`,
        outcome: "answered",
      });
    }
    const blocked = await limits.checkCoachAllowance("u-anyone", env);
    expect(blocked).toEqual({ ok: false, reason: "daily" });
  });

  it("counts the asks that never reached a model too", async () => {
    // An install with no key is still something asking in a loop, and the
    // ceiling is what stops it.
    const before = await store.countCoachAsksSince(0);
    await store.recordCoachAsk({
      userId: null,
      threadId: "th-2",
      question: "q",
      outcome: "not_configured",
    });
    expect(await store.countCoachAsksSince(0)).toBe(before + 1);
  });

  it("will not let one edit make every question cost more without anyone choosing it", () => {
    expect(limits.coachCorpusTokenCap({} as NodeJS.ProcessEnv)).toBe(40_000);
    expect(
      limits.coachCorpusTokenCap({ COACH_CORPUS_TOKEN_CAP: "12000" } as NodeJS.ProcessEnv),
    ).toBe(12_000);
    // A nonsense value falls back rather than removing the ceiling.
    expect(
      limits.coachCorpusTokenCap({ COACH_CORPUS_TOKEN_CAP: "nope" } as NodeJS.ProcessEnv),
    ).toBe(40_000);
  });
});

describe("a coach conversation", () => {
  let tmpDir: string;
  let store: typeof import("./coach-store.js");
  // Real rows: user_id carries a foreign key, so an ask cannot be attributed
  // to an account that does not exist.
  let alice: string;
  let bob: string;
  let carol: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "coach-thread-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    store = await import("./coach-store.js");
    const users = await import("./user-store.js");
    const make = async (username: string) =>
      (await users.createUser({ username, password: "pw-for-test-only", role: "user" })).id;
    alice = await make("alice");
    bob = await make("bob");
    carol = await make("carol");
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("belongs to the person who had it", async () => {
    await store.recordCoachAsk({
      userId: alice,
      threadId: "th-shared",
      question: "mine",
      answer: "an answer",
      outcome: "answered",
    });
    // Knowing a thread id must not be enough to read someone else's.
    expect(await store.listCoachThread("th-shared", bob)).toEqual([]);
    const own = await store.listCoachThread("th-shared", alice);
    expect(own).toEqual([{ question: "mine", answer: "an answer" }]);
  });

  it("carries only the turns that actually got an answer", async () => {
    await store.recordCoachAsk({
      userId: carol,
      threadId: "th-mixed",
      question: "answered one",
      answer: "yes",
      outcome: "answered",
    });
    await store.recordCoachAsk({
      userId: carol,
      threadId: "th-mixed",
      question: "broken one",
      outcome: "model_error",
    });
    const turns = await store.listCoachThread("th-mixed", carol);
    expect(turns.map((t) => t.question)).toEqual(["answered one"]);
  });
});
