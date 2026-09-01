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
 * Login split-screen subtitle, under the brand name. Says plainly that this is
 * the staff hub: the sign-in page is public, and a client who lands here is
 * better served by recognizing the wrong door in one line than by neutral copy
 * that leaves them wondering whether they should have a password.
 */
export const BRAND_TAGLINE =
  "The internal hub for the WOW Video Tours team — scheduling, projects, and reporting in one place.";

/** Heading on the sign-in card. Names the audience before asking for a password. */
export const LOGIN_HEADING = "Team sign-in";

/** Sub-heading on the sign-in card. Same on both surfaces; both are staff-only. */
export const LOGIN_SUBTITLE = "For WOW Video Tours staff. Sign in with your team account.";

/** Where clients sign in for photos, videos, and orders. */
export const CLIENT_PORTAL_URL = "https://portal.wowvideotours.com/";

/**
 * Styles for the client hand-off under the sign-in form. A tinted card rather
 * than a footnote: a client who has already decided they are lost stops reading
 * small print, and this is the one thing on the page meant for them. Both login
 * pages paste the same `.login-card` block, so this ships beside the markup
 * that needs it instead of being pasted a third time.
 */
export const LOGIN_CLIENT_NOTE_CSS = `
  .login-alt { margin-top: 1.75rem; padding: 1rem 1.1rem; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); }
  .login-alt-title { font-size: 0.9rem; font-weight: 700; margin-bottom: 0.3rem; }
  .login-alt p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; margin: 0 0 0.75rem; }
  .login-alt a { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 600; color: var(--accent-ink); text-decoration: none; }
  .login-alt a:hover { text-decoration: underline; }
`;

/**
 * Hand-off for clients who reached the staff sign-in by mistake — the common
 * wrong turn is somebody looking for their own photos and orders, so name what
 * they came for and send them to the portal rather than leaving them at a login
 * they cannot pass.
 */
export const LOGIN_CLIENT_NOTE_HTML = [
  `<div class="login-alt">`,
  `<div class="login-alt-title">Are you a WOW Video Tours client?</div>`,
  `<p>This page is just for our team. Your photos, videos, and orders are waiting for you in the client portal.</p>`,
  `<a href="${CLIENT_PORTAL_URL}">Go to the client portal <span aria-hidden="true">&rarr;</span></a>`,
  `</div>`,
].join("");

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
