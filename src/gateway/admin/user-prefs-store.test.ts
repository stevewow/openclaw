import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Per-user preferences.
 *
 * What is worth proving is that one person's choice never leaks into another's
 * — a default market is the first thing a page shows, and showing Joy's
 * Charlotte to someone in Toledo is worse than showing nobody a default at all.
 */
describe("user preferences", () => {
  let tmpDir: string;
  let prefs: typeof import("./user-prefs-store.js");
  let joyId: string;
  let taylorId: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "user-prefs-test-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    prefs = await import("./user-prefs-store.js");
    const userStore = await import("./user-store.js");
    joyId = (await userStore.createUser({ username: "joy", password: "x", role: "user" })).id;
    taylorId = (await userStore.createUser({ username: "taylor", password: "x", role: "user" })).id;
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("has nothing to say about a user who has set nothing", async () => {
    expect(await prefs.getUserPrefs(taylorId)).toEqual({});
  });

  it("remembers one person's default market without touching anyone else's", async () => {
    await prefs.setUserPref(joyId, "sales.defaultMarket", "charlotte");
    expect(await prefs.getUserPrefs(joyId)).toEqual({ "sales.defaultMarket": "charlotte" });
    expect(await prefs.getUserPrefs(taylorId)).toEqual({});
  });

  it("replaces a preference rather than stacking a second one", async () => {
    await prefs.setUserPref(joyId, "sales.defaultMarket", "cleveland");
    expect(await prefs.getUserPrefs(joyId)).toEqual({ "sales.defaultMarket": "cleveland" });
  });

  it("keeps different keys apart", async () => {
    await prefs.setUserPref(joyId, "sales.metric", "revenue");
    expect(await prefs.getUserPrefs(joyId)).toEqual({
      "sales.defaultMarket": "cleveland",
      "sales.metric": "revenue",
    });
  });

  it("clears a preference rather than storing a blank one", async () => {
    await prefs.setUserPref(joyId, "sales.metric", "   ");
    expect(await prefs.getUserPrefs(joyId)).toEqual({ "sales.defaultMarket": "cleveland" });
    await prefs.setUserPref(joyId, "sales.defaultMarket", null);
    expect(await prefs.getUserPrefs(joyId)).toEqual({});
  });

  it("only recognises the keys the pages actually use", () => {
    expect(prefs.isUserPrefKey("sales.defaultMarket")).toBe(true);
    expect(prefs.isUserPrefKey("sales.defaultMarkets")).toBe(false);
    expect(prefs.isUserPrefKey("")).toBe(false);
    expect(prefs.isUserPrefKey(null)).toBe(false);
  });
});
