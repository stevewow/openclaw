// Where the customer-facing support surfaces live, and how the emails reach the
// logo.
//
// Its own module because both mailers need it: the department notification
// (ticket-mailer.ts) and the client emails (ticket-client-notify.ts), and the
// latter already imports the former — so parking these there would close an
// import cycle. Nothing here reaches back into either.

import { adminBaseUrl } from "./brand.js";
import { WOW_LOGO_PATH } from "./wow-logo.js";

/**
 * Where the public support pages are reachable, for links we hand a client.
 *
 * Defaults to wherever the dashboard lives — both are served by the same gateway
 * — but is overridable on its own, because the address a client is given need
 * not be the address staff use.
 */
export function supportBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.SUPPORT_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : adminBaseUrl(env);
}

/**
 * The logo, absolute, for an email header.
 *
 * Email cannot resolve a site-relative path, so this is the same file the public
 * pages use, addressed from outside. Served by our own gateway rather than
 * hotlinked from marketing, so the header cannot break because a CDN moved a
 * file — and it is the reason a mail client's "download pictures" prompt is
 * worth designing around rather than avoiding (see the alt text in
 * ticket-email-render.ts).
 */
export function emailLogoUrl(env: NodeJS.ProcessEnv = process.env): string {
  return `${supportBaseUrl(env)}${WOW_LOGO_PATH}`;
}
