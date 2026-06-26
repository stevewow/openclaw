import path from "node:path";
import { loadJsonFile, writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";

export const SPIRO_MCP_URL =
  "https://spiro-mcp-production-gngugpeecja6huds.eastus-01.azurewebsites.net/mcp";

export const SPIRO_AUTH_BASE =
  "https://spiro-mcp-auth-production-d3bzc2aza9enfves.eastus-01.azurewebsites.net";

export const SPIRO_SCOPES = ["spiro.public_api.read"];

export type SpiroTokens = {
  client_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

function resolveTokenPath(): string {
  const stateDir =
    process.env.OPENCLAW_STATE_DIR?.trim() || path.join(process.env.HOME ?? "~", ".openclaw");
  const credDir = process.env.OPENCLAW_OAUTH_DIR?.trim() || path.join(stateDir, "credentials");
  return path.join(credDir, "spiro.json");
}

export function loadSpiroTokens(): SpiroTokens | undefined {
  return loadJsonFile<SpiroTokens>(resolveTokenPath());
}

export async function saveSpiroTokens(tokens: SpiroTokens): Promise<void> {
  await writeJsonFileAtomically(resolveTokenPath(), tokens);
}

export function tokenIsExpired(tokens: SpiroTokens): boolean {
  return Date.now() >= tokens.expires_at;
}

export function expiresAt(expiresInSeconds: number): number {
  return Date.now() + expiresInSeconds * 1000 - 60_000;
}
