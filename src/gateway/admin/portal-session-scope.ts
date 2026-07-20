/**
 * Per-portal-user chat session namespacing.
 *
 * Without scoping, every portal user's web chat lands in the same
 * `agent:<id>:main` conversation. To isolate them, the control UI builds session
 * keys whose `rest` segment is prefixed with a stable per-user token.
 *
 * Namespacing alone is presentation, not access control — it only decides what
 * the sidebar shows. Enforcement lives in `server-methods/sessions.ts`, where
 * every key-accepting RPC rejects keys outside the caller's namespace, and in
 * the connect path, which binds a portal connection to the user its credential
 * identifies rather than trusting a client-supplied hint.
 *
 * IMPORTANT: the prefix format here is mirrored on the client in
 * `ui/src/ui/app-portal-scope.ts` (`portalUserSessionRest`). Keep them in sync.
 */

export const PORTAL_SESSION_REST_PREFIX = "u-";

/**
 * Operator scopes a portal-session connection is allowed to hold.
 *
 * Portal users authenticate with their own admin session token, not the shared
 * gateway secret, so the gateway can cap what that credential is worth. Chat
 * needs read (list/get/subscribe) and write (create/send/steer/abort); it does
 * not need admin, pairing or approvals. Narrowing here is what stops a portal
 * user from driving operator-only RPCs, and it is applied after device pairing
 * so a paired browser cannot widen it back out.
 */
export const PORTAL_OPERATOR_SCOPES: readonly string[] = ["operator.read", "operator.write"];

/** The `rest` prefix for a portal user's sessions, e.g. `u-<userId>`. */
export function portalUserSessionPrefix(userId: string): string {
  return `${PORTAL_SESSION_REST_PREFIX}${userId.toLowerCase()}`;
}

/** Split an `agent:<agentId>:<rest>` key into its rest segment (or null). */
function sessionKeyRest(sessionKey: string): string | null {
  const parts = sessionKey.split(":").filter(Boolean);
  if (parts.length < 3 || parts[0] !== "agent") return null;
  return parts.slice(2).join(":");
}

/**
 * Whether a session key lives in a given portal user's namespace. Matches the
 * exact prefix or the prefix followed by a `-`/`:` separator so `u-abc` never
 * captures `u-abcd`.
 */
export function sessionKeyBelongsToPortalUser(sessionKey: string, userId: string): boolean {
  const rest = sessionKeyRest(sessionKey);
  if (rest === null) return false;
  const prefix = portalUserSessionPrefix(userId);
  return rest === prefix || rest.startsWith(`${prefix}-`) || rest.startsWith(`${prefix}:`);
}
