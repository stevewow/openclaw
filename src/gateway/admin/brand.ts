/**
 * Single source for the dashboard's product branding.
 *
 * The admin dashboard and the user portal are two separate HTML template
 * strings that had the same brand block pasted into each. Anything a user
 * reads as "what product is this" lives here so the two pages cannot drift.
 *
 * The logo is inlined rather than served as a file: both pages are static
 * template literals with no asset pipeline, and an inline SVG also works as a
 * `data:` favicon without touching the control UI's root-asset whitelist.
 */

/** Product name in the sidebar, the login screen, and every <title>. */
export const BRAND_NAME = "WOW Hub";

const DEFAULT_ADMIN_BASE_URL = "https://hub.wowvideotours.com";

/**
 * Where the Hub is reachable from outside — for links in email, which cannot
 * resolve a site-relative path.
 *
 * Here rather than beside the notifier that first needed it, because both
 * mailers now want it and this module imports nothing: anywhere else closes an
 * import cycle.
 */
export function adminBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.ADMIN_BASE_URL?.trim();
  if (!raw) {
    return DEFAULT_ADMIN_BASE_URL;
  }
  return raw.replace(/\/+$/, "");
}

/**
 * Login split-screen subtitle, under the brand name. Deliberately plain: the
 * sign-in page is public, so a client who lands here by mistake should read a
 * neutral description rather than internal framing they were never meant to
 * see. What the Hub actually contains is behind the login.
 */
export const BRAND_TAGLINE =
  "One place for scheduling, projects, and reporting at WOW Video Tours.";

/** Heading on the sign-in card. Works for a first visit as well as a return. */
export const LOGIN_HEADING = "Sign in";

/**
 * Sub-heading on the sign-in card. Says nothing about admin or staff: the same
 * page serves the dashboard and the team portal, and a client seeing "admin"
 * reads it as a wrong turn.
 */
export const LOGIN_SUBTITLE = "Use your WOW Video Tours account to continue.";

/** Where clients sign in for photos, videos, and orders. */
export const CLIENT_PORTAL_URL = "https://portal.wowvideotours.com/";

/**
 * Styles for the client-portal signpost under the sign-in form. Both login
 * pages paste the same `.login-card` block, so this ships beside the markup
 * that needs it instead of being pasted a third time.
 */
export const LOGIN_CLIENT_NOTE_CSS = `
  .login-alt { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border); font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; }
  .login-alt a { color: var(--accent-ink); font-weight: 600; text-decoration: none; }
  .login-alt a:hover { text-decoration: underline; }
`;

/**
 * Signpost for clients who reached the staff sign-in by mistake — the common
 * wrong turn is someone looking for their own photos and orders, so send them
 * to the client portal rather than leaving them at a login they cannot pass.
 */
export const LOGIN_CLIENT_NOTE_HTML = `<p class="login-alt">Looking for your photos, videos, or orders? Sign in at the <a href="${CLIENT_PORTAL_URL}">client portal</a>.</p>`;

/** Brand red. The same `--accent` both signed-in pages and the public forms set. */
export const BRAND_COLOR = "#ff0000";

/**
 * Red circle, white play triangle.
 *
 * The triangle's corners are rounded by stroking its own outline with
 * `stroke-linejoin: round`, so the base geometry stays a plain 3-point path.
 * The stroke inflates the shape by half its width on every side, which the
 * point coordinates already account for. The triangle sits right of the
 * circle's true center because a centroid-centered play mark reads as
 * left-leaning.
 */
function logoSvg(size: number, decorative: boolean): string {
  const a11y = decorative
    ? 'aria-hidden="true" focusable="false"'
    : `role="img" aria-label="${BRAND_NAME}"`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"`,
    ` width="${size}" height="${size}" ${a11y}>`,
    `<circle cx="24" cy="24" r="24" fill="${BRAND_COLOR}"/>`,
    `<path d="M20 17.5 L32 24 L20 30.5 Z" fill="#ffffff" stroke="#ffffff"`,
    ` stroke-width="4" stroke-linejoin="round"/>`,
    `</svg>`,
  ].join("");
}

/**
 * Logo markup for in-page use. Decorative by default: the brand name sits
 * next to it as real text, so announcing the mark too would just repeat it.
 */
export function brandLogo(size: number): string {
  return logoSvg(size, true);
}

/** `<link rel="icon">` carrying the same mark, encoded inline. */
export const BRAND_FAVICON_TAG = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
  logoSvg(48, false),
)}">`;

/** Browser tab title for a given surface, e.g. "WOW Hub — Portal". */
export function brandTitle(surface: string): string {
  return `${BRAND_NAME} — ${surface}`;
}
