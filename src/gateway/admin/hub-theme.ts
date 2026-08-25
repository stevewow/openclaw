/**
 * The Hub's design tokens, shared by the admin SPA and the user portal.
 *
 * The palette, the type and the shape language are lifted from the public
 * intake surfaces (`ticket-public-shell.ts`): Montserrat throughout, charcoal
 * ink on a light grey ground, brand red, soft-shadowed rounded cards, and the
 * uppercase letter-spaced eyebrow the marketing site sets above every section
 * heading. Signed-in and signed-out therefore read as one product.
 *
 * Both SPAs are standalone template literals with no stylesheet to link, so the
 * tokens live here rather than being pasted into each: a brand tweak lands in
 * one place instead of drifting between the two pages.
 *
 * Layout is deliberately *not* here. Each surface keeps its own sizing,
 * density and component rules; this module only decides what things look like,
 * never how big they are.
 */

import { PUBLIC_FONT_FAMILY } from "./ticket-public-shell.js";

/**
 * Head tags the brand font needs.
 *
 * Preconnected because the stylesheet and the font files come from two
 * different origins, and the second request cannot start until the first
 * resolves. Weights are the ones the Hub actually sets — 300 is absent because
 * nothing signed-in uses it.
 */
export const HUB_FONT_TAGS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

/**
 * The token block, dropped in as the `:root` of both surfaces.
 *
 * Two reds rather than one: `--accent` is the brand's own `#ff0000` and is what
 * fills a button, tints an active row or draws a focus ring, exactly as on the
 * public form. `--accent-ink` is the slightly deeper red reserved for *text* —
 * pure red on white lands at about 4:1, under the 4.5:1 a body-sized string
 * needs, and the Hub has far more small red text than a one-screen form does.
 * Anything a user has to read uses the ink; anything they merely see uses the
 * brand red.
 *
 * The sidebar's ground is the same charcoal as the body ink, so the dark rail
 * belongs to this palette rather than being a separate near-black.
 */
export const HUB_TOKENS_CSS = `  :root {
    --bg: #f3f3f3;
    --surface: #ffffff;
    --surface2: #f7f7f7;
    --border: #dbdbdb;
    --hairline: #ececec;
    --accent: #ff0000;
    --accent-ink: #d40000;
    --accent-hover: #d40000;
    --accent-tint: rgba(255,0,0,0.08);
    --accent-ring: rgba(255,0,0,0.16);
    --danger: #d40000;
    --danger-hover: #a80000;
    --success: #166534;
    --warning: #b45309;
    --text: #2c2c2c;
    --text-muted: #888888;
    --sidebar-bg: #2c2c2c;
    --sidebar-text: rgba(255,255,255,0.64);
    --sidebar-text-active: #ffffff;
    --sidebar-active-bg: rgba(255,0,0,0.22);
    --sidebar-border: rgba(255,255,255,0.09);
    --radius: 14px;
    --radius-sm: 10px;
    --radius-pill: 999px;
    --shadow: 0 2px 14px rgba(0,0,0,0.05);
    --shadow-lg: 0 10px 34px rgba(0,0,0,0.10);
    --font: ${PUBLIC_FONT_FAMILY};
    --banner-h: 0px;
  }`;

/**
 * Rules both surfaces want once the tokens are in place.
 *
 * The eyebrow is the site's section label — uppercase, tracked out, brand red —
 * and is what carries the marketing typography into a dense dashboard without
 * shouting: headings stay sentence case and the small caps do the signalling.
 *
 * The reduced-motion block is here rather than in either page because it should
 * hold for every animation on either surface, including ones added later.
 */
export const HUB_BASE_CSS = `
  .eyebrow { color: var(--accent-ink); font-size: 0.69rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; }
  ::selection { background: var(--accent-tint); }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
  }`;
