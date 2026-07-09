/**
 * Per-portal-user chat session namespacing.
 *
 * All portal users share a single gateway credential, so without scoping every
 * portal user's web chat lands in the same `agent:<id>:main` conversation. To
 * isolate them, the control UI builds session keys whose `rest` segment is
 * prefixed with a stable per-user token, and the gateway filters
 * `sessions.list` for portal clients to only their own namespace.
 *
 * IMPORTANT: the prefix format here is mirrored on the client in
 * `ui/src/ui/app-portal-scope.ts` (`portalUserSessionRest`). Keep them in sync.
 */

export const PORTAL_SESSION_REST_PREFIX = "u-";

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
