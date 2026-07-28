import { beforeEach, describe, expect, it, vi } from "vitest";

const loadTokens = vi.fn();
vi.mock("./config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config.js")>();
  return { ...actual, loadTokens: () => loadTokens(), saveTokens: async () => {} };
});

const { listTools } = await import("./client.js");

describe("Spiro MCP client token handling", () => {
  beforeEach(() => {
    loadTokens.mockReset();
    vi.unstubAllGlobals();
  });

  it("asks for a reconnect when an expired token has no refresh token", async () => {
    // The shape written before `offline_access` was requested: renewable by
    // nothing, so the only honest answer is "reconnect", not a token-endpoint
    // status code.
    loadTokens.mockReturnValue({
      client_id: "c",
      access_token: "a",
      expires_at: Date.now() - 1_000,
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(listTools()).rejects.toThrow(/reconnect Spiro/i);
    // No network call: nothing to renew with, so nothing was attempted.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("says reconnect when the refresh grant itself is rejected", async () => {
    loadTokens.mockReturnValue({
      client_id: "c",
      access_token: "a",
      refresh_token: "r",
      expires_at: Date.now() - 1_000,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("invalid_grant", { status: 400 })),
    );
    await expect(listTools()).rejects.toThrow(/reconnect Spiro/i);
  });

  it("reports a missing connection separately from an expired one", async () => {
    loadTokens.mockReturnValue(undefined);
    await expect(listTools()).rejects.toThrow(/not connected/i);
  });
});
