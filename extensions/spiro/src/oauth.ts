import { randomBytes } from "node:crypto";
import { generateHexPkceVerifierChallenge } from "openclaw/plugin-sdk/provider-auth";
import {
  expiresAt,
  saveSpiroTokens,
  SPIRO_AUTH_BASE,
  SPIRO_MCP_URL,
  SPIRO_SCOPES,
  type SpiroTokens,
} from "./config.js";

// The gateway is accessible at this public URL — must match the allowed redirect_uri
// registered with Spiro's OAuth server.
export const SPIRO_CALLBACK_PATH = "/plugin/spiro/callback";
const REGISTER_ENDPOINT = `${SPIRO_AUTH_BASE}/oauth/register`;
const AUTHORIZE_ENDPOINT = `${SPIRO_AUTH_BASE}/oauth/authorize`;
const TOKEN_ENDPOINT = `${SPIRO_AUTH_BASE}/oauth/token`;
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

type PendingAuth = {
  verifier: string;
  clientId: string;
  timer: ReturnType<typeof setTimeout>;
  resolve: () => void;
  reject: (err: Error) => void;
};

// Keyed by OAuth `state` param
const pendingAuthStates = new Map<string, PendingAuth>();

type DynamicClientResult = {
  client_id: string;
};

async function registerClient(redirectUri: string): Promise<DynamicClientResult> {
  const res = await fetch(REGISTER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "OpenClaw Spiro Plugin",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: "none",
      scope: SPIRO_SCOPES.join(" "),
    }),
  });
  if (!res.ok) {
    throw new Error(`Spiro client registration failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as DynamicClientResult;
}

function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const qs = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: SPIRO_SCOPES.join(" "),
    state: params.state,
    code_challenge: params.challenge,
    code_challenge_method: "S256",
    resource: SPIRO_MCP_URL,
  });
  return `${AUTHORIZE_ENDPOINT}?${qs}`;
}

async function exchangeCode(params: {
  clientId: string;
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<SpiroTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.verifier,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Spiro token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    client_id: params.clientId,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt(data.expires_in),
  };
}

export async function refreshSpiroTokens(tokens: SpiroTokens): Promise<SpiroTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: tokens.client_id,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Spiro token refresh failed: ${res.status} ${await res.text()}`);
  }
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
  await saveSpiroTokens(next);
  return next;
}

/**
 * Called by the plugin's HTTP route handler when the OAuth callback arrives.
 * Returns an HTML response string or throws on error.
 */
export async function handleSpiroOAuthCallback(callbackUrl: URL): Promise<string> {
  const code = callbackUrl.searchParams.get("code");
  const state = callbackUrl.searchParams.get("state");
  const error = callbackUrl.searchParams.get("error");

  if (error) {
    return `<html><body><h2>Spiro authorization failed: ${error}</h2><p>You can close this tab.</p></body></html>`;
  }

  if (!code || !state) {
    throw new Error("OAuth callback missing code or state.");
  }

  const pending = pendingAuthStates.get(state);
  if (!pending) {
    return `<html><body><h2>OAuth state not found or expired.</h2><p>Please run /spiro-auth again.</p></body></html>`;
  }

  pendingAuthStates.delete(state);
  clearTimeout(pending.timer);

  const redirectUri = `${callbackUrl.protocol}//${callbackUrl.host}${SPIRO_CALLBACK_PATH}`;
  try {
    const tokens = await exchangeCode({
      clientId: pending.clientId,
      code,
      verifier: pending.verifier,
      redirectUri,
    });
    await saveSpiroTokens(tokens);
    pending.resolve();
    return `<html><body><h2>Spiro connected successfully!</h2><p>You can close this tab.</p></body></html>`;
  } catch (err) {
    pending.reject(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}

export type SpiroAuthResult =
  | { ok: true; authorizeUrl: string; awaitCallback: () => Promise<void> }
  | { ok: false; error: string };

export async function startSpiroOAuth(params: {
  callbackBaseUrl: string;
}): Promise<SpiroAuthResult> {
  const redirectUri = `${params.callbackBaseUrl.replace(/\/$/, "")}${SPIRO_CALLBACK_PATH}`;

  let client: DynamicClientResult;
  try {
    client = await registerClient(redirectUri);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = generateHexPkceVerifierChallenge();
  const authorizeUrl = buildAuthorizeUrl({
    clientId: client.client_id,
    redirectUri,
    state,
    challenge,
  });

  const awaitCallback = (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingAuthStates.delete(state);
        reject(new Error("Timed out waiting for Spiro OAuth callback (5 min)."));
      }, CALLBACK_TIMEOUT_MS);

      pendingAuthStates.set(state, {
        verifier,
        clientId: client.client_id,
        timer,
        resolve,
        reject,
      });
    });
  };

  return { ok: true, authorizeUrl, awaitCallback };
}
