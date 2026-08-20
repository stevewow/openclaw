import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// The two ceilings on the answering box. The per-client one shapes ordinary
// traffic; the daily one is the answer to "what is the worst this can cost me",
// and is the only one a forged header cannot walk around.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-kb-ask-limits-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const limits = await import("./kb-ask-limits.js");
const asks = await import("./kb-ask-store.js");
const { getAdminDb } = await import("./user-store.js");

function req(ip = "203.0.113.7", headers: Record<string, string> = {}): IncomingMessage {
  return {
    headers: { "x-forwarded-for": ip, ...headers },
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as IncomingMessage;
}

const ENV = {} as NodeJS.ProcessEnv;

beforeEach(async () => {
  limits.resetAskLimits();
  await getAdminDb().deleteFrom("admin_kb_asks").execute();
});

describe("who a limit applies to", () => {
  it("reads the forwarded address, since every visitor shares the proxy's socket", () => {
    expect(limits.clientKey(req("203.0.113.7"))).toBe("203.0.113.7");
  });

  it("takes the first hop of a chain", () => {
    expect(limits.clientKey(req("203.0.113.7, 10.0.0.1, 10.0.0.2"))).toBe("203.0.113.7");
  });

  it("falls back to the socket when nothing is forwarded", () => {
    const bare = { headers: {}, socket: { remoteAddress: "198.51.100.4" } } as IncomingMessage;
    expect(limits.clientKey(bare)).toBe("198.51.100.4");
  });
});

describe("the per-client limit", () => {
  it("allows a normal run of questions", async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const allowance = await limits.checkAskAllowance(req(), { now: now + i * 1000, env: ENV });
      expect(allowance.allowed).toBe(true);
    }
  });

  it("stops a burst inside one minute", async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await limits.checkAskAllowance(req(), { now: now + i * 1000, env: ENV });
    }
    const blocked = await limits.checkAskAllowance(req(), { now: now + 4000, env: ENV });
    expect(blocked).toEqual({ allowed: false, reason: "client_rate" });
  });

  it("lets the same client back in once the minute has passed", async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await limits.checkAskAllowance(req(), { now: now + i * 1000, env: ENV });
    }
    const later = await limits.checkAskAllowance(req(), { now: now + 61_000, env: ENV });
    expect(later.allowed).toBe(true);
  });

  it("holds an hourly ceiling above the per-minute one", async () => {
    let now = Date.now();
    let allowed = 0;
    // Spaced a minute apart, so only the hourly cap can be what stops it.
    for (let i = 0; i < 15; i++) {
      const a = await limits.checkAskAllowance(req(), { now, env: ENV });
      if (a.allowed) {
        allowed += 1;
      }
      now += 61_000;
    }
    expect(allowed).toBe(10);
  });

  it("does not let one client's burst block another", async () => {
    const now = Date.now();
    for (let i = 0; i < 4; i++) {
      await limits.checkAskAllowance(req("203.0.113.7"), { now: now + i * 1000, env: ENV });
    }
    const other = await limits.checkAskAllowance(req("198.51.100.9"), {
      now: now + 5000,
      env: ENV,
    });
    expect(other.allowed).toBe(true);
  });
});

describe("the daily ceiling", () => {
  it("counts every question, including the ones no model ever saw", async () => {
    const now = Date.now();
    // A flood retrieval turned away still says the box is being hammered.
    for (let i = 0; i < 200; i++) {
      await asks.recordKbAsk({
        question: `question ${i}`,
        answered: false,
        declineReason: "no_match",
        at: now - 1000,
      });
    }
    const blocked = await limits.checkAskAllowance(req("198.51.100.30"), { now, env: ENV });
    expect(blocked).toEqual({ allowed: false, reason: "daily_cap" });
  });

  it("is not reached by yesterday's questions", async () => {
    const now = Date.now();
    for (let i = 0; i < 200; i++) {
      await asks.recordKbAsk({
        question: `question ${i}`,
        answered: false,
        declineReason: "no_match",
        at: now - 48 * 60 * 60 * 1000,
      });
    }
    const allowance = await limits.checkAskAllowance(req("198.51.100.31"), { now, env: ENV });
    expect(allowance.allowed).toBe(true);
  });

  it("is what a rotated forwarded header still runs into", async () => {
    const now = Date.now();
    for (let i = 0; i < 200; i++) {
      await asks.recordKbAsk({ question: `q ${i}`, answered: true, at: now - 1000 });
    }
    // A fresh address every time defeats the per-client limit and not this one.
    for (const ip of ["198.51.100.1", "198.51.100.2", "198.51.100.3"]) {
      expect(await limits.checkAskAllowance(req(ip), { now, env: ENV })).toEqual({
        allowed: false,
        reason: "daily_cap",
      });
    }
  });

  it("can be raised or lowered by an operator", async () => {
    const now = Date.now();
    await asks.recordKbAsk({ question: "one", answered: true, at: now - 1000 });
    const tiny = { KB_ASK_DAILY_CAP: "1" } as NodeJS.ProcessEnv;
    expect(await limits.checkAskAllowance(req("198.51.100.40"), { now, env: tiny })).toEqual({
      allowed: false,
      reason: "daily_cap",
    });
  });
});

describe("configuration", () => {
  it("is off entirely until a key is set", () => {
    expect(limits.askApiKey({} as NodeJS.ProcessEnv)).toBeNull();
    expect(limits.askApiKey({ ANTHROPIC_API_KEY: "  " } as NodeJS.ProcessEnv)).toBeNull();
    expect(limits.askApiKey({ ANTHROPIC_API_KEY: "sk-x" } as NodeJS.ProcessEnv)).toBe("sk-x");
  });

  it("lets an operator pick the model, since that is what an answer costs", () => {
    expect(limits.askModel({} as NodeJS.ProcessEnv)).toBe("claude-opus-5");
    expect(limits.askModel({ KB_ASK_MODEL: "claude-haiku-4-5" } as NodeJS.ProcessEnv)).toBe(
      "claude-haiku-4-5",
    );
  });
});
