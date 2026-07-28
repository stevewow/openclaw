import fs from "node:fs";
import path from "node:path";

export const SPIRO_MCP_URL = "https://mcp.spiro.media/mcp";
export const SPIRO_AUTH_BASE = "https://ai-auth.spiro.media";
// `offline_access` is what makes the authorization server return a refresh
// token; without it every connection dies silently when the access token lapses
// (~24h) and only a hand-run reconnect brings it back. Advertised in the
// server's `scopes_supported`, and granted on registration.
export const SPIRO_SCOPE = "spiro.public_api.read offline_access";

// `refresh_token` is optional on purpose: the authorization server only issues
// one when `offline_access` is granted, and tokens saved before that scope was
// requested have none. Callers must treat a missing one as "reconnect needed"
// rather than assume renewal is always possible.
export type SpiroTokens = {
  client_id: string;
  access_token: string;
  refresh_token?: string;
  expires_at: number;
};

function tokenPath(): string {
  const state =
    process.env.OPENCLAW_STATE_DIR?.trim() ?? path.join(process.env.HOME ?? "~", ".openclaw");
  const creds = process.env.OPENCLAW_OAUTH_DIR?.trim() ?? path.join(state, "credentials");
  return path.join(creds, "spiro.json");
}

export function loadTokens(): SpiroTokens | undefined {
  try {
    return JSON.parse(fs.readFileSync(tokenPath(), "utf8")) as SpiroTokens;
  } catch {
    return undefined;
  }
}

export async function saveTokens(tokens: SpiroTokens): Promise<void> {
  const dest = tokenPath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp.${process.pid}`;
  await fs.promises.writeFile(tmp, JSON.stringify(tokens, null, 2), "utf8");
  await fs.promises.rename(tmp, dest);
}

export function isExpired(tokens: SpiroTokens): boolean {
  return Date.now() >= tokens.expires_at;
}

export function expiresAt(expiresInSeconds: number): number {
  return Date.now() + expiresInSeconds * 1000 - 60_000;
}
