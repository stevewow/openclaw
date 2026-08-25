// The chrome every public support page shares: the palette, the type, the
// logo, the card it all sits in, and the rules that make it work on a phone.
//
// Both customer-facing pages (the intake form and the feedback landing page)
// are standalone template literals with no stylesheet to link, so without this
// the second page would be a copy of the first's CSS and the two would drift
// apart on the next brand tweak. Everything genuinely specific to one page
// stays in that page.

import { WOW_LOGO_HEIGHT, WOW_LOGO_PATH, WOW_LOGO_WIDTH } from "./wow-logo.js";

/** Head tags both pages need: mobile viewport, brand font, and no indexing. */
export const PUBLIC_HEAD_TAGS = `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex" />
<link rel="icon" href="${WOW_LOGO_PATH}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />`;

/**
 * The logo header.
 *
 * Width and height are declared so the header does not jump when the image
 * lands, and the alt text is the company name because this mark is the page's
 * heading, not decoration. Served from our own route rather than hotlinked, so
 * a customer-facing page cannot break because a marketing CDN moved a file.
 */
export const BRAND_HEADER_HTML = `<a class="brand" href="https://www.wowvideotours.com" target="_blank" rel="noopener">
      <img src="${WOW_LOGO_PATH}" width="${WOW_LOGO_WIDTH}" height="${WOW_LOGO_HEIGHT}" alt="WOW Video Tours" />
    </a>`;

/**
 * The brand type stack.
 *
 * Its own export because the signed-in Hub sets the same face from its own
 * token block (`hub-theme.ts`), and a fallback chain that differs between the
 * public form and the dashboard would show up the moment Montserrat fails to
 * load.
 */
export const PUBLIC_FONT_FAMILY =
  '"Montserrat",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';

/**
 * Palette, type and layout, taken from wowvideotours.com: Montserrat
 * throughout, charcoal ink on a light grey ground, pure-red accent, pill
 * buttons, and the uppercase letter-spaced eyebrow the site sets above every
 * section heading.
 *
 * Mobile-first: the base rules are the phone layout and the one breakpoint adds
 * the roomier desktop spacing, so a narrow screen never has to undo a wide
 * screen's assumptions. Font sizes are clamped rather than stepped so the type
 * scales continuously instead of snapping at one width.
 */
export const PUBLIC_SHELL_CSS = `
  :root {
    --wow:#ff0000; --wow-dark:#d40000; --wow-tint:rgba(255,0,0,0.08);
    --ink:#2c2c2c; --muted:#888888; --border:#dbdbdb; --hairline:#ececec;
    --bg:#f3f3f3; --surface:#ffffff;
    --font:${PUBLIC_FONT_FAMILY};
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin:0; font-family:var(--font); background:var(--bg); color:var(--ink);
    line-height:1.55; -webkit-font-smoothing:antialiased;
    /* Long order addresses and pasted links must not widen the page on a phone. */
    overflow-wrap:break-word;
  }
  .wrap {
    max-width:660px; margin:0 auto;
    padding:1.25rem 1rem 3rem;
    /* Respect a notched phone's safe area in landscape. */
    padding-left:max(1rem, env(safe-area-inset-left));
    padding-right:max(1rem, env(safe-area-inset-right));
  }
  .brand { display:block; margin:0 0 1.15rem; line-height:0; }
  .brand img { width:clamp(132px, 38vw, 176px); height:auto; display:block; }
  .card {
    background:var(--surface); border:1px solid var(--hairline); border-radius:18px;
    box-shadow:0 2px 14px rgba(0,0,0,0.05); padding:1.4rem 1.15rem;
  }
  .eyebrow { color:var(--wow); font-size:0.69rem; font-weight:700; letter-spacing:0.09em; text-transform:uppercase; margin:0 0 0.5rem; }
  h1.title { font-size:clamp(1.35rem, 5.2vw, 1.75rem); font-weight:700; letter-spacing:-0.02em; line-height:1.18; margin:0 0 0.6rem; }
  .lead { color:var(--muted); font-size:0.9rem; font-weight:400; margin:0 0 1.4rem; }
  .lead a { color:var(--wow); font-weight:600; text-decoration:none; border-bottom:1px solid rgba(255,0,0,0.3); }
  .lead a:hover { border-bottom-color:var(--wow); }
  .btn {
    background:var(--wow); color:#fff; border:none; border-radius:999px;
    padding:0.95rem 1.5rem; font-family:inherit; font-weight:700; font-size:0.8rem;
    letter-spacing:0.09em; text-transform:uppercase; cursor:pointer; width:100%;
    transition:background 0.15s; -webkit-appearance:none;
    /* Comfortably past the 44px minimum touch target on a phone. */
    min-height:48px;
  }
  .btn:hover { background:var(--wow-dark); }
  .btn:disabled { opacity:0.5; cursor:default; }
  .btn:focus-visible, a:focus-visible { outline:2px solid var(--wow); outline-offset:2px; }
  .foot { text-align:center; color:var(--muted); font-size:0.72rem; letter-spacing:0.02em; margin-top:1.4rem; line-height:1.6; }
  .hidden { display:none !important; }

  @media (min-width: 560px) {
    .wrap { padding:2rem 1rem 3.5rem; }
    .brand { margin-bottom:1.5rem; }
    .card { padding:2rem 1.75rem; border-radius:20px; }
    .foot { margin-top:1.5rem; }
  }
  /* Someone who asked for less motion gets none of ours. */
  @media (prefers-reduced-motion: reduce) {
    * { transition:none !important; animation:none !important; }
  }`;
