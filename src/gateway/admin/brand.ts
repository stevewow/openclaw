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

/** Login split-screen subtitle, under the brand name. */
export const BRAND_TAGLINE =
  "Scheduling, projects, and reporting for the WOW Video Tours team — all in one place.";

/** Brand red. Matches --accent in both pages. */
export const BRAND_COLOR = "#c0000a";

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
