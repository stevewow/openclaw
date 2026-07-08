import { beforeEach, describe, expect, it, vi } from "vitest";

const loadTokens = vi.fn();
vi.mock("./config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config.js")>();
  return { ...actual, loadTokens: () => loadTokens() };
});

const { getConnection } = await import("./connect.js");

describe("getConnection", () => {
  beforeEach(() => loadTokens.mockReset());

  it("reports disconnected when no tokens are stored", () => {
    loadTokens.mockReturnValue(undefined);
    expect(getConnection()).toEqual({ connected: false, expiresAt: null });
  });

  it("reports connected for an unexpired token", () => {
    const expiresAt = Date.now() + 60_000;
    loadTokens.mockReturnValue({
      client_id: "c",
      access_token: "a",
      refresh_token: "",
      expires_at: expiresAt,
    });
    expect(getConnection()).toEqual({ connected: true, expiresAt });
  });

  it("reports an expired token as disconnected but keeps expiresAt for the UI", () => {
    const expiresAt = Date.now() - 1_000;
    loadTokens.mockReturnValue({
      client_id: "c",
      access_token: "a",
      refresh_token: "",
      expires_at: expiresAt,
    });
    expect(getConnection()).toEqual({ connected: false, expiresAt });
  });
});
