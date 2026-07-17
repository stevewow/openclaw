import crypto from "node:crypto";

// A short-lived, signed grant that authorizes ONE test-ticket submission to a
// chosen recipient. The public intake form (/support) is unauthenticated, so we
// must never honor a caller-supplied "send the notification here instead"
// address on trust — that would be an open relay. Instead an admin mints this
// token from the dashboard (admin-gated route), it carries the override email
// itself (so the recipient can't be tampered with client-side), and the intake
// handler only diverts the email when the token verifies.
//
// The signing key is per-process and random: tokens are demo-scoped and expire
// in an hour, so surviving a gateway restart isn't worth persisting a secret —
// the admin just re-enables test mode and mints a fresh one.

const KEY = crypto.randomBytes(32);
const DEFAULT_TTL_MS = 60 * 60 * 1000;

export type TestTokenPayload = { email: string; exp: number };

function sign(body: string): string {
  return crypto.createHmac("sha256", KEY).update(body).digest("base64url");
}

/** Mint a signed token granting a test send to `email`, valid for `ttlMs`. */
export function mintTestToken(
  email: string,
  now: number = Date.now(),
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const payload: TestTokenPayload = { email, exp: now + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Return the payload if the token is authentic and unexpired, else null. */
export function verifyTestToken(token: unknown, now: number = Date.now()): TestTokenPayload | null {
  if (typeof token !== "string") {
    return null;
  }
  const dot = token.indexOf(".");
  if (dot === -1) {
    return null;
  }
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TestTokenPayload;
    if (typeof payload.email !== "string" || !payload.email.includes("@")) {
      return null;
    }
    if (typeof payload.exp !== "number" || now >= payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
