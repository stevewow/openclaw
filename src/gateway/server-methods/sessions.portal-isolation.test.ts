import { describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";
import { sessionsHandlers } from "./sessions.js";
import type { GatewayRequestContext, RespondFn } from "./types.js";

/**
 * Session-key namespacing only hides other users' chats from the sidebar. These
 * tests pin the actual enforcement: every RPC that accepts a caller-supplied key
 * must refuse keys outside the portal user's own namespace, so a portal user
 * cannot reach another user's session by naming it directly.
 */

const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const FOREIGN_KEY = `agent:main:u-${OTHER}`;

function portalClient(userId: string) {
  return {
    connId: "conn-1",
    connect: { scopes: ["operator.read", "operator.write"] },
    portalUser: { id: userId, role: "user", permissions: [] },
  } as never;
}

function stubContext(): GatewayRequestContext {
  return {
    chatAbortControllers: new Map(),
    broadcastToConnIds: vi.fn(),
    getSessionEventSubscriberConnIds: () => new Set<string>(),
    subscribeSessionMessageEvents: vi.fn(),
    unsubscribeSessionMessageEvents: vi.fn(),
    getRuntimeConfig: () => ({}),
  } as unknown as GatewayRequestContext;
}

// Every handler that takes a key, with params minimal-but-valid for its schema.
const GUARDED: Array<[keyof typeof sessionsHandlers, Record<string, unknown>]> = [
  ["sessions.send", { message: "hi" }],
  ["sessions.get", {}],
  ["sessions.describe", {}],
  ["sessions.abort", {}],
  ["sessions.reset", {}],
  ["sessions.delete", {}],
  ["sessions.compaction.restore", { checkpointId: "cp-1" }],
  ["sessions.patch", { label: "renamed" }],
  ["sessions.compact", {}],
  ["sessions.compaction.list", {}],
  ["sessions.compaction.get", { checkpointId: "cp-1" }],
  ["sessions.compaction.branch", { checkpointId: "cp-1" }],
  ["sessions.messages.subscribe", {}],
  ["sessions.messages.unsubscribe", {}],
];

describe("portal session isolation", () => {
  for (const [method, extraParams] of GUARDED) {
    it(`${method} refuses a key in another portal user's namespace`, async () => {
      const respond = vi.fn() as unknown as RespondFn;

      await sessionsHandlers[method]({
        req: { id: "req-1" } as never,
        params: { key: FOREIGN_KEY, ...extraParams },
        respond,
        context: stubContext(),
        client: portalClient(OWNER),
        isWebchatConnect: () => false,
      } as never);

      // Indistinguishable from a missing session: the namespace must not be
      // probeable for which other users exist.
      expect(respond).toHaveBeenCalledWith(false, undefined, {
        code: ErrorCodes.INVALID_REQUEST,
        message: "session not found",
      });
    });
  }

  it("sessions.create refuses planting a session in another user's namespace", async () => {
    const respond = vi.fn() as unknown as RespondFn;

    await sessionsHandlers["sessions.create"]({
      req: { id: "req-1" } as never,
      params: { key: FOREIGN_KEY },
      respond,
      context: stubContext(),
      client: portalClient(OWNER),
      isWebchatConnect: () => false,
    } as never);

    expect(respond).toHaveBeenCalledWith(false, undefined, {
      code: ErrorCodes.INVALID_REQUEST,
      message: "session not found",
    });
  });

  it("sessions.preview drops foreign keys instead of failing the batch", async () => {
    const respond = vi.fn() as unknown as RespondFn;

    await sessionsHandlers["sessions.preview"]({
      req: { id: "req-1" } as never,
      params: { keys: [FOREIGN_KEY, `agent:main:u-${OWNER}`] },
      respond,
      context: stubContext(),
      client: portalClient(OWNER),
      isWebchatConnect: () => false,
    } as never);

    const [ok, result] = (respond as unknown as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    expect(ok).toBe(true);
    const previews = (result as { previews?: Array<{ key: string }> } | undefined)?.previews ?? [];
    expect(previews.every((p) => !p.key.includes(OTHER))).toBe(true);
  });

  it("leaves non-portal (operator) connections unrestricted", async () => {
    const respond = vi.fn() as unknown as RespondFn;

    await sessionsHandlers["sessions.compaction.list"]({
      req: { id: "req-1" } as never,
      params: { key: FOREIGN_KEY },
      respond,
      context: stubContext(),
      client: null,
      isWebchatConnect: () => false,
    } as never);

    // No portalUser on the client => the guard is inert; the call proceeds and
    // must not be rejected as "session not found".
    const rejected = (respond as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
      (call) => call[0] === false && call[2]?.message === "session not found",
    );
    expect(rejected).toBe(false);
  });
});
