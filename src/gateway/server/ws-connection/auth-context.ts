import type { IncomingMessage } from "node:http";
import { normalizeOptionalString } from "../../../shared/string-coerce.js";
import {
  AUTH_RATE_LIMIT_SCOPE_DEVICE_TOKEN,
  AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET,
  type AuthRateLimiter,
} from "../../auth-rate-limit.js";
import {
  authorizeHttpGatewayConnect,
  authorizeWsControlUiGatewayConnect,
  type GatewayAuthResult,
  type ResolvedGatewayAuth,
} from "../../auth.js";

type HandshakeConnectAuth = {
  token?: string;
  bootstrapToken?: string;
  deviceToken?: string;
  password?: string;
};

export type DeviceTokenCandidateSource = "explicit-device-token" | "shared-token-fallback";

export type ConnectAuthState = {
  authResult: GatewayAuthResult;
  authOk: boolean;
  authMethod: GatewayAuthResult["method"];
  sharedAuthOk: boolean;
  sharedAuthProvided: boolean;
  bootstrapTokenCandidate?: string;
  deviceTokenCandidate?: string;
  deviceTokenCandidateSource?: DeviceTokenCandidateSource;
  /** Set when the presented token resolved to an admin portal session. */
  portalUserId?: string;
};

type VerifyDeviceTokenResult = { ok: boolean; reason?: string };
type VerifyBootstrapTokenResult = { ok: boolean; reason?: string };

export type ConnectAuthDecision = {
  authResult: GatewayAuthResult;
  authOk: boolean;
  authMethod: GatewayAuthResult["method"];
  portalUserId?: string;
};

/**
 * Resolve a presented token as an admin portal session.
 *
 * Portal users are handed their own admin session token instead of the shared
 * gateway secret, so this is the credential check for the portal. It is
 * deliberately confined to the WS control-UI surface: a portal session must
 * never authorize the gateway's HTTP APIs.
 *
 * The admin module is imported lazily so gateways running without it (or with
 * no admin database) simply fail this check instead of failing to boot.
 */
async function resolvePortalSessionAuth(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { resolveSessionUser } = await import("../../admin/user-store.js");
    const user = await resolveSessionUser(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function mapDeviceTokenAuthFailureReason(params: {
  tokenCheckReason?: string;
  candidateSource?: DeviceTokenCandidateSource;
  fallbackReason?: string;
}): string {
  if (
    params.tokenCheckReason === "scope-mismatch" ||
    params.tokenCheckReason === "scope_mismatch"
  ) {
    return "scope_mismatch";
  }
  if (params.candidateSource === "explicit-device-token") {
    return "device_token_mismatch";
  }
  return params.fallbackReason ?? "device_token_mismatch";
}

function resolveSharedConnectAuth(
  connectAuth: HandshakeConnectAuth | null | undefined,
): { token?: string; password?: string } | undefined {
  const token = normalizeOptionalString(connectAuth?.token);
  const password = normalizeOptionalString(connectAuth?.password);
  if (!token && !password) {
    return undefined;
  }
  return { token, password };
}

function resolveDeviceTokenCandidate(connectAuth: HandshakeConnectAuth | null | undefined): {
  token?: string;
  source?: DeviceTokenCandidateSource;
} {
  const explicitDeviceToken = normalizeOptionalString(connectAuth?.deviceToken);
  if (explicitDeviceToken) {
    return { token: explicitDeviceToken, source: "explicit-device-token" };
  }
  const fallbackToken = normalizeOptionalString(connectAuth?.token);
  if (!fallbackToken) {
    return {};
  }
  return { token: fallbackToken, source: "shared-token-fallback" };
}

export async function resolveConnectAuthState(params: {
  resolvedAuth: ResolvedGatewayAuth;
  connectAuth: HandshakeConnectAuth | null | undefined;
  hasDeviceIdentity: boolean;
  req: IncomingMessage;
  trustedProxies: string[];
  allowRealIpFallback: boolean;
  rateLimiter?: AuthRateLimiter;
  clientIp?: string;
}): Promise<ConnectAuthState> {
  const sharedConnectAuth = resolveSharedConnectAuth(params.connectAuth);
  const sharedAuthProvided = Boolean(sharedConnectAuth);
  const bootstrapTokenCandidate = params.hasDeviceIdentity
    ? normalizeOptionalString(params.connectAuth?.bootstrapToken)
    : undefined;
  const { token: deviceTokenCandidate, source: deviceTokenCandidateSource } =
    params.hasDeviceIdentity ? resolveDeviceTokenCandidate(params.connectAuth) : {};

  let authResult: GatewayAuthResult = await authorizeWsControlUiGatewayConnect({
    auth: params.resolvedAuth,
    connectAuth: sharedConnectAuth,
    req: params.req,
    trustedProxies: params.trustedProxies,
    allowRealIpFallback: params.allowRealIpFallback,
    rateLimiter: sharedAuthProvided ? params.rateLimiter : undefined,
    clientIp: params.clientIp,
    rateLimitScope: AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET,
  });

  const sharedAuthResult =
    sharedConnectAuth &&
    (await authorizeHttpGatewayConnect({
      auth: { ...params.resolvedAuth, allowTailscale: false },
      connectAuth: sharedConnectAuth,
      req: params.req,
      trustedProxies: params.trustedProxies,
      allowRealIpFallback: params.allowRealIpFallback,
      // Shared-auth probe only; rate-limit side effects are handled in the
      // primary auth flow (or deferred for device-token candidates).
      rateLimitScope: AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET,
    }));
  // Trusted-proxy auth is semantically shared: the proxy vouches for identity,
  // no per-device credential needed. Include it so operator connections
  // can skip device identity via roleCanSkipDeviceIdentity().
  const sharedAuthOk =
    (sharedAuthResult?.ok === true &&
      (sharedAuthResult.method === "token" || sharedAuthResult.method === "password")) ||
    (authResult.ok && authResult.method === "trusted-proxy");

  // A token that is not the shared secret may still be a portal session token.
  // Checked only after the shared-secret path declines, so operator connections
  // never pay for the lookup and the shared secret keeps its normal meaning.
  let portalUserId: string | undefined;
  if (!authResult.ok && !sharedAuthOk) {
    const resolvedPortalUserId = await resolvePortalSessionAuth(sharedConnectAuth?.token);
    if (resolvedPortalUserId) {
      portalUserId = resolvedPortalUserId;
      authResult = { ok: true, method: "portal-session", portalUserId: resolvedPortalUserId };
      // The shared-secret path already recorded a failure for this attempt.
      params.rateLimiter?.reset(params.clientIp, AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET);
    }
  }

  return {
    authResult,
    authOk: authResult.ok,
    authMethod:
      authResult.method ?? (params.resolvedAuth.mode === "password" ? "password" : "token"),
    // Portal sessions are explicitly NOT shared auth: they must not inherit the
    // pairing bypass that trusted operator credentials get.
    sharedAuthOk,
    sharedAuthProvided,
    bootstrapTokenCandidate,
    deviceTokenCandidate,
    deviceTokenCandidateSource,
    ...(portalUserId ? { portalUserId } : {}),
  };
}

export async function resolveConnectAuthDecision(params: {
  state: ConnectAuthState;
  hasDeviceIdentity: boolean;
  deviceId?: string;
  publicKey?: string;
  role: string;
  scopes: string[];
  rateLimiter?: AuthRateLimiter;
  clientIp?: string;
  verifyBootstrapToken: (params: {
    deviceId: string;
    publicKey: string;
    token: string;
    role: string;
    scopes: string[];
  }) => Promise<VerifyBootstrapTokenResult>;
  verifyDeviceToken: (params: {
    deviceId: string;
    token: string;
    role: string;
    scopes: string[];
  }) => Promise<VerifyDeviceTokenResult>;
}): Promise<ConnectAuthDecision> {
  let authResult = params.state.authResult;
  let authOk = params.state.authOk;
  let authMethod = params.state.authMethod;

  const bootstrapTokenCandidate = params.state.bootstrapTokenCandidate;
  if (params.hasDeviceIdentity && params.deviceId && params.publicKey && bootstrapTokenCandidate) {
    const tokenCheck = await params.verifyBootstrapToken({
      deviceId: params.deviceId,
      publicKey: params.publicKey,
      token: bootstrapTokenCandidate,
      role: params.role,
      scopes: params.scopes,
    });
    if (tokenCheck.ok) {
      // Prefer an explicit valid bootstrap token even when another auth path
      // (for example tailscale serve header auth) already succeeded. QR pairing
      // relies on the server classifying the handshake as bootstrap-token so the
      // initial node pairing can be silently auto-approved and the bootstrap
      // token can be revoked after approval.
      authOk = true;
      authMethod = "bootstrap-token";
    } else if (!authOk) {
      authResult = { ok: false, reason: tokenCheck.reason ?? "bootstrap_token_invalid" };
    }
  }

  const portalUserId = params.state.portalUserId;
  const deviceTokenCandidate = params.state.deviceTokenCandidate;
  if (!params.hasDeviceIdentity || !params.deviceId || authOk || !deviceTokenCandidate) {
    return { authResult, authOk, authMethod, ...(portalUserId ? { portalUserId } : {}) };
  }

  let deviceTokenRateLimited = false;
  if (params.rateLimiter) {
    const deviceRateCheck = params.rateLimiter.check(
      params.clientIp,
      AUTH_RATE_LIMIT_SCOPE_DEVICE_TOKEN,
    );
    if (!deviceRateCheck.allowed) {
      deviceTokenRateLimited = true;
      authResult = {
        ok: false,
        reason: "rate_limited",
        rateLimited: true,
        retryAfterMs: deviceRateCheck.retryAfterMs,
      };
    }
  }
  if (!deviceTokenRateLimited) {
    const tokenCheck = await params.verifyDeviceToken({
      deviceId: params.deviceId,
      token: deviceTokenCandidate,
      role: params.role,
      scopes: params.scopes,
    });
    if (tokenCheck.ok) {
      authOk = true;
      authMethod = "device-token";
      params.rateLimiter?.reset(params.clientIp, AUTH_RATE_LIMIT_SCOPE_DEVICE_TOKEN);
      if (params.state.sharedAuthProvided) {
        params.rateLimiter?.reset(params.clientIp, AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET);
      }
    } else {
      authResult = {
        ok: false,
        reason: mapDeviceTokenAuthFailureReason({
          tokenCheckReason: tokenCheck.reason,
          candidateSource: params.state.deviceTokenCandidateSource,
          fallbackReason: authResult.reason,
        }),
      };
      params.rateLimiter?.recordFailure(params.clientIp, AUTH_RATE_LIMIT_SCOPE_DEVICE_TOKEN);
    }
  }

  return { authResult, authOk, authMethod, ...(portalUserId ? { portalUserId } : {}) };
}
