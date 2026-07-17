import { describe, expect, it } from "vitest";
import { mintTestToken, verifyTestToken } from "./ticket-test-token.js";

describe("ticket test token", () => {
  it("round-trips a valid token and returns the embedded email", () => {
    const token = mintTestToken("demo@wow.co");
    const payload = verifyTestToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.email).toBe("demo@wow.co");
  });

  it("rejects a tampered payload (email can't be swapped without the key)", () => {
    const token = mintTestToken("demo@wow.co");
    const [, sig] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ email: "attacker@evil.co", exp: Date.now() + 60_000 }),
    ).toString("base64url");
    expect(verifyTestToken(`${forgedBody}.${sig}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const now = 1_000_000;
    const token = mintTestToken("demo@wow.co", now, 1000);
    expect(verifyTestToken(token, now + 500)).not.toBeNull();
    expect(verifyTestToken(token, now + 2000)).toBeNull();
  });

  it("rejects malformed / empty / non-string input", () => {
    expect(verifyTestToken("")).toBeNull();
    expect(verifyTestToken("no-dot")).toBeNull();
    expect(verifyTestToken("a.b.c")).toBeNull();
    expect(verifyTestToken(null)).toBeNull();
    expect(verifyTestToken(42)).toBeNull();
  });
});
