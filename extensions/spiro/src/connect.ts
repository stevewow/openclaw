import { isExpired, loadTokens } from "./config.js";
import { startAuth } from "./oauth.js";

export type SpiroConnection = { connected: boolean; expiresAt: number | null };

// Lightweight connection probe for UI surfaces (e.g. the admin Financials page)
// that need to know whether a live Spiro token exists without making an MCP call.
export function getConnection(): SpiroConnection {
  const tokens = loadTokens();
  if (!tokens) return { connected: false, expiresAt: null };
  return { connected: !isExpired(tokens), expiresAt: tokens.expires_at };
}

// Publicly reachable gateway base the OAuth redirect_uri is built from. Mirrors
// index.ts's GATEWAY_URL so a browser-initiated reconnect uses the same callback.
const DEFAULT_BASE =
  process.env.SPIRO_GATEWAY_URL?.trim().replace(/\/$/u, "") ?? "https://openclaw.wowvideotours.com";

// Begin an OAuth flow and return the authorize URL for the browser to open. The
// pending callback is armed in the background so the CALLBACK_PATH route can
// resolve this state when the user returns (a 5-min timeout cleans it up if not).
export async function beginAuth(
  base: string = DEFAULT_BASE,
): Promise<{ ok: true; authorizeUrl: string } | { ok: false; error: string }> {
  const result = await startAuth(base);
  if (!result.ok) return { ok: false, error: result.error };
  void result.awaitCallback().catch(() => {});
  return { ok: true, authorizeUrl: result.authorizeUrl };
}
