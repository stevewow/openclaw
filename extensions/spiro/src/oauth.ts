import { createHash, randomBytes } from "node:crypto";
import { expiresAt, saveTokens, SPIRO_AUTH_BASE, SPIRO_SCOPE, type SpiroTokens } from "./config.js";

export const CALLBACK_PATH = "/plugin/spiro/callback";
const REGISTER_URL = `${SPIRO_AUTH_BASE}/oauth/register`;
const AUTHORIZE_URL = `${SPIRO_AUTH_BASE}/oauth/authorize`;
const TOKEN_URL = `${SPIRO_AUTH_BASE}/oauth/token`;
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

type PendingAuth = {
  verifier: string;
  clientId: string;
  redirectUri: string;
  timer: ReturnType<typeof setTimeout>;
  resolve: () => void;
  reject: (err: Error) => void;
};

const pending = new Map<string, PendingAuth>();

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("hex");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function registerClient(redirectUri: string): Promise<string> {
  const res = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "OpenClaw Spiro Plugin",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: "none",
      scope: SPIRO_SCOPE,
    }),
  });
  if (!res.ok) throw new Error(`Client registration failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { client_id: string };
  return data.client_id;
}

export type AuthResult =
  | { ok: true; authorizeUrl: string; awaitCallback: () => Promise<void> }
  | { ok: false; error: string };

export async function startAuth(callbackBase: string): Promise<AuthResult> {
  const redirectUri = `${callbackBase.replace(/\/$/, "")}${CALLBACK_PATH}`;
  let clientId: string;
  try {
    clientId = await registerClient(redirectUri);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = pkce();

  const qs = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SPIRO_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: "https://mcp.spiro.media/mcp",
  });
  const authorizeUrl = `${AUTHORIZE_URL}?${qs}`;

  const awaitCallback = (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(state);
        reject(new Error("Timed out waiting for Spiro OAuth callback (5 min)."));
      }, CALLBACK_TIMEOUT_MS);
      pending.set(state, { verifier, clientId, redirectUri, timer, resolve, reject });
    });

  return { ok: true, authorizeUrl, awaitCallback };
}

export async function handleCallback(url: URL): Promise<string> {
  const error = url.searchParams.get("error");
  if (error) {
    const desc = url.searchParams.get("error_description") ?? error;
    return `<html><body><h2>Spiro authorization failed</h2><p>${desc}</p><p>You can close this tab and run /spiro-auth again.</p></body></html>`;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) throw new Error("OAuth callback missing code or state.");

  const entry = pending.get(state);
  if (!entry) {
    return `<html><body><h2>Session expired or already used.</h2><p>Run /spiro-auth again.</p></body></html>`;
  }
  pending.delete(state);
  clearTimeout(entry.timer);

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: entry.redirectUri,
      client_id: entry.clientId,
      code_verifier: entry.verifier,
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    const tokens: SpiroTokens = {
      client_id: entry.clientId,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt(data.expires_in),
    };
    await saveTokens(tokens);
    entry.resolve();
    return `<html><body><h2>Spiro connected!</h2><p>You can close this tab and return to chat.</p></body></html>`;
  } catch (err) {
    entry.reject(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}

export async function refreshTokens(tokens: SpiroTokens): Promise<SpiroTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: tokens.client_id,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const next: SpiroTokens = {
    client_id: tokens.client_id,
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: expiresAt(data.expires_in),
  };
  await saveTokens(next);
  return next;
}
