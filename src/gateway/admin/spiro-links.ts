/**
 * Deep links back into the Spiro admin web app.
 *
 * Spiro's public API never returns a web-app URL — only its own REST `selfUrl`
 * and (sometimes) a PDF export — so the browsable link has to be composed from
 * the tenant's admin host plus the invoice id. The host is configurable because
 * it is per-tenant; the path shape is Spiro's and is shared by every tenant.
 */

const DEFAULT_SPIRO_ADMIN_BASE_URL = "https://admins.wowvideotours.com";

/** A well-formed Spiro id: the UUID Spiro puts in the URL, nothing else. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function spiroAdminBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.SPIRO_ADMIN_BASE_URL?.trim();
  if (!raw) {
    return DEFAULT_SPIRO_ADMIN_BASE_URL;
  }
  // A trailing slash would double up against the path below.
  return raw.replace(/\/+$/, "");
}

/**
 * Link to an unpaid invoice in Spiro. The path lives under `pending-invoices`,
 * which is the section that holds anything not yet settled — exactly the set
 * this report deals with — so a paid-off invoice is not guaranteed to resolve
 * there. Returns null when the id is not a UUID, so a malformed row renders as
 * plain text instead of a broken link.
 */
export function spiroInvoiceUrl(
  invoiceId: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!UUID_RE.test(invoiceId)) {
    return null;
  }
  // Spiro's own links carry the id upper-cased; mirror that rather than relying
  // on the route being case-insensitive.
  return `${spiroAdminBaseUrl(env)}/invoices/clients/pending-invoices/${invoiceId.toUpperCase()}`;
}
