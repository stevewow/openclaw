// The public help center: what a client sees at /help.
//
// Nothing on these pages is authenticated and nothing on them reaches the rest
// of the Hub. They read published articles and nothing else — no session, no
// admin API, no link back into the dashboard. That boundary is the point of
// this being its own module rather than a loosened branch of the authoring UI.
//
// Chrome comes from ticket-public-shell.ts, the same palette and logo the
// intake form and the feedback page use, so the three cannot drift apart.

import MarkdownIt from "markdown-it";
import type { KbArticle, KbCategory } from "./kb-store.js";
import { escapeHtml } from "./ticket-email-render.js";
import { BRAND_HEADER_HTML, PUBLIC_HEAD_TAGS, PUBLIC_SHELL_CSS } from "./ticket-public-shell.js";

/** Where the help center lives. Article slugs are unique base-wide, so an
 * article is one segment under this and keeps that address when it is refiled;
 * a category takes a reserved segment of its own so the two can never collide. */
export const HELP_PATH = "/help";
export const HELP_CATEGORY_PREFIX = `${HELP_PATH}/category/`;

export function articleUrl(article: { slug: string }): string {
  return `${HELP_PATH}/${encodeURIComponent(article.slug)}`;
}

export function categoryUrl(category: { slug: string }): string {
  return `${HELP_CATEGORY_PREFIX}${encodeURIComponent(category.slug)}`;
}

/**
 * `html: false` is what makes this safe to render into a page: markdown-it
 * escapes raw HTML in the source rather than passing it through, and its link
 * validator refuses `javascript:` and `vbscript:` hrefs. Staff write these, but
 * "staff wrote it" is not a security boundary worth betting a client's browser
 * on.
 */
const md = new MarkdownIt({ html: false, linkify: true, breaks: false, typographer: false });

/** Article links open in place; anything off-site opens away from the page. */
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const href = tokens[idx]?.attrGet?.("href") ?? "";
  if (/^https?:\/\//i.test(href)) {
    tokens[idx]?.attrSet?.("target", "_blank");
    tokens[idx]?.attrSet?.("rel", "noopener noreferrer");
  }
  return self.renderToken(tokens, idx, options);
};

export function renderMarkdown(source: string): string {
  return md.render(source);
}

/** A heading in an article body, for the contents list and its anchor. */
export type ArticleHeading = {
  id: string;
  text: string;
  level: number;
};

/**
 * The anchor mark a heading carries. Rendered from an id we generated in
 * renderArticleBody, never from anything in the source, so this is our markup
 * and not a hole in the `html: false` above.
 *
 * The id is read back off the opening token — two along, since markdown-it
 * emits a heading as open, inline, close — rather than stashed on the closing
 * token. Attributes on a closing token are still rendered by markdown-it's
 * default renderer, so carrying it there emits `</h2 data-anchor="…">`.
 */
md.renderer.rules.heading_close = (tokens, idx, options, _env, self) => {
  const closing = self.renderToken(tokens, idx, options);
  const open = tokens[idx - 2];
  if (open?.type !== "heading_open" || open.tag !== tokens[idx]?.tag) {
    return closing;
  }
  const anchor = open.attrGet?.("id");
  return anchor
    ? `<a class="hc-anchor" href="#${escapeHtml(anchor)}" aria-label="Link to this section">#</a>${closing}`
    : closing;
};

/** A heading turned into a fragment id: the same shape as an article slug. */
function headingId(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section"
  );
}

/**
 * An article body, plus the headings inside it.
 *
 * Rendered in one pass rather than two so the ids in the contents list and the
 * ids on the page cannot disagree — a contents list that scrolls nowhere is
 * worse than no contents list. Duplicate headings are suffixed, because "Step
 * one" appearing twice is ordinary in help writing and two elements with one id
 * would send both links to the first.
 */
export function renderArticleBody(source: string): {
  html: string;
  headings: ArticleHeading[];
} {
  const tokens = md.parse(source, {});
  const headings: ArticleHeading[] = [];
  const used = new Map<string, number>();
  for (let i = 0; i < tokens.length; i += 1) {
    const open = tokens[i];
    if (open?.type !== "heading_open") {
      continue;
    }
    const text = (tokens[i + 1]?.content ?? "").trim();
    const level = Number.parseInt(open.tag.slice(1), 10);
    if (!text || !Number.isFinite(level) || level > 4) {
      continue;
    }
    const base = headingId(text);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}-${seen + 1}`;
    open.attrSet("id", id);
    // Only the levels a reader navigates by. An h4 gets an anchor to link to
    // and stays out of the contents, which is a summary and not an outline.
    if (level === 2 || level === 3) {
      headings.push({ id, text, level });
    }
  }
  return { html: md.renderer.render(tokens, md.options, {}), headings };
}

/**
 * How long an article takes to read, in whole minutes.
 *
 * 220 words a minute, rounded up, floor of one. Shown so someone deciding
 * whether to read now or later can tell a two-line answer from a walkthrough —
 * not as a precise claim, which is why it is never shown as "0 min".
 */
export function readingMinutes(bodyMd: string): number {
  const words = bodyMd.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

/**
 * The date to show a client, and what to call it.
 *
 * `updatedAt` is deliberately not consulted: it moves when an article is
 * dragged into a new order or refiled, so showing it would date-stamp a shelf
 * of articles nobody wrote a word on. `contentUpdatedAt` moves only when the
 * words change, and an article written before that column existed has none —
 * which reads as its publication date, the only thing actually known about it.
 */
export function articleDate(article: {
  publishedAt: number | null;
  contentUpdatedAt: number | null;
  createdAt: number;
}): { label: "Published" | "Updated"; at: number } {
  const published = article.publishedAt ?? article.createdAt;
  const changed = article.contentUpdatedAt;
  // A minute's grace: publishing writes both stamps, and an article published
  // the moment it was written has not been "updated" since.
  return changed && changed > published + 60_000
    ? { label: "Updated", at: changed }
    : { label: "Published", at: published };
}

/** A date a client reads, not an ISO stamp. Fixed to the business's own zone. */
export function formatHelpDate(at: number): string {
  return new Date(at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

/** Articles changed this recently are worth marking as new on the index. */
const NEW_FOR_DAYS = 30;

export function isRecentlyChanged(
  article: { publishedAt: number | null; contentUpdatedAt: number | null; createdAt: number },
  now = Date.now(),
): boolean {
  return now - articleDate(article).at < NEW_FOR_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * A video link becomes a player only for hosts we can build an embed URL for,
 * and a plain link otherwise. Guessing an embed URL for an unknown host would
 * produce a broken iframe where a working link used to be.
 */
export function videoEmbedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").find(Boolean);
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

const HELP_STYLES = `
  .hc-search { display:flex; gap:0.5rem; margin:0 0 1.5rem; }
  .hc-search input {
    flex:1 1 auto; min-width:0; padding:0.8rem 1rem; border:1px solid var(--border);
    border-radius:999px; font-family:inherit; font-size:1rem; color:var(--ink); background:#fff;
  }
  .hc-search input:focus { outline:none; border-color:var(--wow); box-shadow:0 0 0 3px var(--wow-tint); }
  .hc-search button { width:auto; padding:0.8rem 1.4rem; flex:0 0 auto; }

  .hc-group { margin:0 0 1.75rem; }
  .hc-group:last-child { margin-bottom:0; }
  .hc-group h2 {
    font-size:0.72rem; font-weight:700; letter-spacing:0.09em; text-transform:uppercase;
    color:var(--wow); margin:0 0 0.15rem;
  }
  .hc-group .hc-desc { color:var(--muted); font-size:0.82rem; margin:0 0 0.7rem; }
  .hc-list { list-style:none; margin:0; padding:0; }
  .hc-list li { border-top:1px solid var(--hairline); }
  .hc-list li:first-child { border-top:none; }
  .hc-list a {
    display:block; padding:0.75rem 0; color:var(--ink); text-decoration:none; font-weight:600;
    font-size:0.95rem;
  }
  .hc-list a:hover { color:var(--wow); }
  .hc-list .hc-sum { display:block; color:var(--muted); font-weight:400; font-size:0.82rem; margin-top:0.15rem; }

  .hc-back { display:inline-block; color:var(--muted); font-size:0.8rem; text-decoration:none; margin:0 0 0.9rem; }
  .hc-back:hover { color:var(--wow); }

  /* The article itself. Long help text wants a slightly larger body size than
     the form's, and headings that step down clearly on a phone. */
  .hc-body { font-size:0.97rem; line-height:1.7; }
  .hc-body h1, .hc-body h2, .hc-body h3 { line-height:1.25; letter-spacing:-0.01em; margin:1.6rem 0 0.6rem; }
  .hc-body h1 { font-size:1.3rem; }
  .hc-body h2 { font-size:1.12rem; }
  .hc-body h3 { font-size:1rem; }
  .hc-body > :first-child { margin-top:0; }
  .hc-body p { margin:0 0 1rem; }
  .hc-body ul, .hc-body ol { margin:0 0 1rem; padding-left:1.35rem; }
  .hc-body li { margin:0 0 0.35rem; }
  .hc-body a { color:var(--wow); font-weight:600; text-decoration:none; border-bottom:1px solid rgba(255,0,0,0.3); }
  .hc-body a:hover { border-bottom-color:var(--wow); }
  .hc-body code {
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:0.86em;
    background:var(--bg); border:1px solid var(--hairline); border-radius:5px; padding:0.1em 0.35em;
  }
  .hc-body pre { background:var(--bg); border:1px solid var(--hairline); border-radius:12px; padding:0.9rem 1rem; overflow-x:auto; }
  .hc-body pre code { background:none; border:none; padding:0; }
  .hc-body blockquote { margin:0 0 1rem; padding:0.15rem 0 0.15rem 0.9rem; border-left:3px solid var(--border); color:var(--muted); }
  .hc-body img { max-width:100%; height:auto; border-radius:12px; }
  .hc-body table { width:100%; border-collapse:collapse; margin:0 0 1rem; font-size:0.9rem; }
  .hc-body th, .hc-body td { border:1px solid var(--hairline); padding:0.45rem 0.6rem; text-align:left; }

  /* 16:9 without an aspect-ratio dependency, so an older phone browser still
     gets a correctly shaped player rather than a collapsed one. */
  .hc-video { position:relative; padding-top:56.25%; margin:0 0 1.3rem; border-radius:14px; overflow:hidden; background:#000; }
  .hc-video iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
  .hc-videolink { display:inline-block; margin:0 0 1.3rem; font-weight:600; color:var(--wow); text-decoration:none; }

  .hc-empty { color:var(--muted); font-size:0.9rem; margin:0; }
  .hc-more { border-top:1px solid var(--hairline); margin-top:1.6rem; padding-top:1.1rem; }

  /* The listing pages get more room than the 660px the forms want, because a
     browsable index is a scan rather than a read. The article page keeps the
     narrow measure: long help text at this width is tiring to read. */
  .wrap.hc-wide { max-width:1040px; }

  /* Browse-by-category. Pills wrap on their own, so this needs no breakpoint
     and works from a 320px phone up. */
  .hc-cats { display:flex; flex-wrap:wrap; gap:0.5rem; margin:0 0 1.6rem; }
  .hc-cat {
    display:inline-block; padding:0.5rem 0.95rem; border:1px solid var(--border);
    border-radius:999px; background:var(--surface); color:var(--ink);
    font-size:0.82rem; font-weight:600; text-decoration:none; line-height:1.3;
    /* Comfortably tappable without making the row look like buttons. */
    min-height:38px;
  }
  .hc-cat:hover { border-color:var(--wow); color:var(--wow); }
  .hc-cat.hc-cat-on { border-color:var(--wow); background:var(--wow-tint); color:var(--wow); }
  .hc-cats-label {
    flex:0 0 100%; margin:0 0 0.1rem; color:var(--muted);
    font-size:0.7rem; font-weight:700; letter-spacing:0.09em; text-transform:uppercase;
  }
  .hc-cat .hc-fold { opacity:0.55; margin-right:0.35rem; vertical-align:-1px; }

  /* A category is a shelf, not an article.
     Told apart only by type size, a category called "Your Media: Finding It,
     Downloading It, and Using It" reads exactly like something to open and
     read. So a shelf gets a card, a folder mark, the word Category and a count
     — four cues that survive a long title — while the editorial groupings keep
     the quiet label they had. The difference between the two treatments is
     itself the signal. */
  .hc-shelf {
    border:1px solid var(--border); border-radius:16px; background:var(--surface);
    padding:1.05rem 1.15rem 0.9rem;
  }
  .hc-shelf-head { display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin:0 0 0.45rem; }
  .hc-kind {
    display:inline-flex; align-items:center; gap:0.32rem; padding:0.18rem 0.55rem;
    border-radius:999px; background:var(--wow-tint); color:var(--wow);
    font-size:0.66rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;
  }
  .hc-fold { width:12px; height:12px; flex:none; }
  .hc-tally { color:var(--muted); font-size:0.74rem; font-weight:600; }
  .hc-shelf h2 {
    font-size:1.05rem; font-weight:700; letter-spacing:-0.01em; text-transform:none;
    color:var(--ink); line-height:1.3; margin:0 0 0.1rem;
  }
  .hc-shelf .hc-desc { margin:0 0 0.35rem; }
  /* The rows read as what is filed on the shelf: lighter than its title, and
     fenced off from it by the rule rather than running straight on. */
  .hc-shelf .hc-list { border-top:1px solid var(--hairline); margin-top:0.55rem; }
  .hc-shelf .hc-list li:first-child { border-top:none; }
  .hc-shelf .hc-list a { font-weight:500; font-size:0.9rem; padding:0.6rem 0; }
  /* The same chip introduces a category page, so arriving on one is not
     mistaken for arriving on an article. */
  .hc-pagekind { display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap; margin:0 0 0.5rem; }

  /* Two columns only once there is genuinely room for two readable ones. */
  .hc-groups { display:grid; grid-template-columns:1fr; gap:1.75rem; }
  @media (min-width:820px) { .hc-groups { grid-template-columns:1fr 1fr; gap:1.9rem 2.75rem; } }

  .hc-group h2 a { color:inherit; text-decoration:none; }
  .hc-group h2 a:hover { text-decoration:underline; }
  .hc-count { color:var(--muted); font-weight:600; letter-spacing:0; text-transform:none; }

  /* When the article was written, how long it takes, and the link to it. One
     quiet line: it answers "is this current and is it long" without competing
     with the title. */
  .hc-meta {
    display:flex; flex-wrap:wrap; align-items:center; gap:0.35rem 0.7rem;
    color:var(--muted); font-size:0.8rem; margin:0 0 1.3rem;
  }
  .hc-meta .hc-dot { opacity:0.5; }
  .hc-copy {
    width:auto; padding:0; border:none; background:none; cursor:pointer;
    color:var(--muted); font-family:inherit; font-size:0.8rem; text-decoration:underline;
  }
  .hc-copy:hover { color:var(--wow); }

  /* A heading's own link. Kept out of the way until the heading is hovered or
     the link itself is focused, so a printed or scanned article is not littered
     with hashes — but reachable by keyboard, which display:none would not be. */
  .hc-anchor {
    margin-left:0.4rem; color:var(--muted); text-decoration:none; font-weight:400;
    opacity:0; transition:opacity 0.12s ease;
  }
  .hc-body h1:hover .hc-anchor, .hc-body h2:hover .hc-anchor,
  .hc-body h3:hover .hc-anchor, .hc-body h4:hover .hc-anchor,
  .hc-anchor:focus { opacity:1; }
  .hc-anchor:hover { color:var(--wow); }
  /* Landing on an anchor must not tuck the heading under the top of the window. */
  .hc-body :target { scroll-margin-top:1rem; }

  .hc-toc {
    border:1px solid var(--hairline); border-radius:12px; background:var(--surface);
    padding:0.85rem 1rem; margin:0 0 1.4rem;
  }
  .hc-toc h2 {
    font-size:0.7rem; font-weight:700; letter-spacing:0.09em; text-transform:uppercase;
    color:var(--muted); margin:0 0 0.5rem;
  }
  .hc-toc ol { list-style:none; margin:0; padding:0; }
  .hc-toc li { margin:0 0 0.3rem; font-size:0.88rem; }
  .hc-toc li:last-child { margin-bottom:0; }
  .hc-toc .hc-toc-3 { padding-left:0.9rem; font-size:0.84rem; }
  .hc-toc a { color:var(--ink); text-decoration:none; }
  .hc-toc a:hover { color:var(--wow); text-decoration:underline; }

  /* Liking and voting. Both need JavaScript to do anything at all, so both are
     hidden in the markup and revealed by the script — the same rule the
     assistant launcher follows. A button that silently does nothing is worse
     than no button. */
  .hc-react[hidden], .hc-helpful[hidden] { display:none; }
  .hc-react { display:flex; align-items:center; gap:0.6rem; margin:1.4rem 0 0; }
  .hc-like {
    width:auto; display:inline-flex; align-items:center; gap:0.4rem;
    padding:0.5rem 0.95rem; border:1px solid var(--border); border-radius:999px;
    background:var(--surface); color:var(--muted); font-family:inherit;
    font-size:0.84rem; font-weight:600; cursor:pointer; min-height:38px;
  }
  .hc-like:hover { border-color:var(--wow); color:var(--wow); }
  .hc-like[aria-pressed="true"] { border-color:var(--wow); background:var(--wow-tint); color:var(--wow); }
  .hc-like .hc-heart { font-size:0.95rem; line-height:1; }

  .hc-helpful { border-top:1px solid var(--hairline); margin-top:1.5rem; padding-top:1.1rem; }
  .hc-helpful p { margin:0 0 0.6rem; font-size:0.9rem; font-weight:600; }
  .hc-vote { display:flex; gap:0.5rem; flex-wrap:wrap; }
  .hc-vote button {
    width:auto; padding:0.5rem 1.3rem; border:1px solid var(--border); border-radius:999px;
    background:#fff; color:var(--ink); font-family:inherit; font-size:0.84rem;
    font-weight:600; cursor:pointer; min-height:38px;
  }
  .hc-vote button:hover { border-color:var(--wow); color:var(--wow); }
  .hc-note { margin-top:0.75rem; }
  .hc-note textarea {
    width:100%; resize:vertical; min-height:4.5rem; padding:0.55rem 0.7rem;
    border:1px solid var(--border); border-radius:9px; font-family:inherit;
    /* 16px stops iOS zooming the viewport when the field takes focus. */
    font-size:1rem; color:var(--ink); background:#fff;
  }
  .hc-note textarea:focus { outline:none; border-color:var(--wow); }
  .hc-note button { width:auto; margin-top:0.5rem; padding:0.45rem 1.1rem; font-size:0.82rem; }
  .hc-thanks { color:var(--muted); font-size:0.88rem; font-weight:400 !important; margin:0 !important; }

  /* Suggestions under the search box. The form still works without any of
     this; the list is an accelerator laid over a page that already worked. */
  .hc-search { position:relative; }
  .hc-sugg {
    position:absolute; top:calc(100% + 0.35rem); left:0; right:0; z-index:20;
    background:#fff; border:1px solid var(--border); border-radius:12px;
    box-shadow:0 10px 30px rgba(0,0,0,0.12); padding:0.3rem; margin:0;
    list-style:none; max-height:19rem; overflow-y:auto;
  }
  .hc-sugg[hidden] { display:none; }
  .hc-sugg li a {
    display:block; padding:0.55rem 0.7rem; border-radius:8px; color:var(--ink);
    text-decoration:none; font-size:0.9rem; font-weight:600;
  }
  .hc-sugg li a:hover, .hc-sugg li a:focus, .hc-sugg li.hc-sugg-on a {
    background:var(--wow-tint); color:var(--wow); outline:none;
  }
  .hc-sugg .hc-sugg-sum { display:block; color:var(--muted); font-weight:400; font-size:0.8rem; margin-top:0.1rem; }
  .hc-sugg .hc-sugg-none { padding:0.55rem 0.7rem; color:var(--muted); font-size:0.88rem; }

  .hc-new {
    display:inline-block; margin-left:0.45rem; padding:0.05rem 0.4rem; border-radius:999px;
    background:var(--wow-tint); color:var(--wow); font-size:0.66rem; font-weight:700;
    letter-spacing:0.05em; text-transform:uppercase; vertical-align:0.1em;
  }

  /* The answer itself, and the standing reminder of where it came from. */
  .hc-answer { border:1px solid var(--border); border-left:3px solid var(--wow);
    border-radius:var(--radius, 10px); padding:1rem 1.1rem; margin:0 0 1.2rem; background:var(--surface); }
  .hc-answer-text { font-size:1rem; line-height:1.65; margin:0 0 0.8rem; }
  .hc-asked { color:var(--muted); font-size:0.82rem; margin:0 0 1rem; }
  .hc-asked span { color:var(--ink); }
  .hc-note { color:var(--muted); font-size:0.75rem; margin:0.9rem 0 0; }

  /* ── The floating assistant ────────────────────────────────────────────
     Fixed to the lower right on every help page. It sits above the content
     rather than in it, so nothing on the page has to make room and no layout
     here has to change to accommodate it. */
  .wow-bot-launch {
    position:fixed; right:1.25rem; bottom:1.25rem; z-index:60;
    display:inline-flex; align-items:center; gap:0.5rem;
    padding:0.8rem 1.15rem; border:none; border-radius:999px; cursor:pointer;
    background:var(--wow); color:#fff; font-family:inherit; font-size:0.9rem; font-weight:700;
    box-shadow:0 6px 20px rgba(0,0,0,0.22);
  }
  .wow-bot-launch:hover { filter:brightness(1.07); }
  .wow-bot-launch:focus-visible { outline:3px solid var(--wow-tint); outline-offset:2px; }

  .wow-bot-panel {
    position:fixed; right:1.25rem; bottom:1.25rem; z-index:61;
    width:min(23rem, calc(100vw - 2.5rem));
    /* Capped against the viewport so the composer stays reachable on a phone
       in landscape, where a fixed height would push it off the screen. */
    max-height:min(34rem, calc(100vh - 2.5rem));
    display:flex; flex-direction:column; overflow:hidden;
    background:#fff; border:1px solid var(--border); border-radius:14px;
    box-shadow:0 12px 40px rgba(0,0,0,0.26);
  }
  .wow-bot-panel[hidden] { display:none; }

  .wow-bot-head {
    display:flex; align-items:center; gap:0.6rem; padding:0.8rem 0.9rem;
    background:var(--wow); color:#fff; flex:0 0 auto;
  }
  .wow-bot-head strong { font-size:0.92rem; }
  .wow-bot-head span { font-size:0.72rem; opacity:0.85; display:block; font-weight:400; }
  .wow-bot-close {
    margin-left:auto; background:transparent; border:none; color:#fff; cursor:pointer;
    font-size:1.35rem; line-height:1; padding:0 0.25rem; width:auto;
  }

  .wow-bot-log { flex:1 1 auto; overflow-y:auto; padding:0.9rem; }
  .wow-bot-msg { margin:0 0 0.75rem; font-size:0.88rem; line-height:1.55; }
  .wow-bot-msg:last-child { margin-bottom:0; }
  .wow-bot-you {
    background:var(--wow-tint); color:var(--ink); border-radius:12px 12px 3px 12px;
    padding:0.5rem 0.7rem; margin-left:auto; max-width:85%; width:fit-content;
  }
  .wow-bot-them {
    background:var(--surface); border:1px solid var(--hairline);
    border-radius:12px 12px 12px 3px; padding:0.6rem 0.75rem; max-width:92%;
  }
  .wow-bot-cites { margin:0.5rem 0 0; padding:0; list-style:none; }
  .wow-bot-cites a { color:var(--wow); font-size:0.82rem; font-weight:600; text-decoration:none; }
  .wow-bot-cites a:hover { text-decoration:underline; }

  .wow-bot-send { margin-top:0.6rem; }
  .wow-bot-send input {
    width:100%; padding:0.45rem 0.6rem; border:1px solid var(--border); border-radius:8px;
    font-family:inherit; font-size:0.84rem; margin-bottom:0.4rem; color:var(--ink); background:#fff;
  }
  .wow-bot-send button { width:auto; padding:0.45rem 0.9rem; font-size:0.82rem; }
  .wow-bot-sent { color:var(--muted); font-size:0.82rem; }

  .wow-bot-compose { display:flex; gap:0.45rem; padding:0.7rem; border-top:1px solid var(--hairline); flex:0 0 auto; }
  .wow-bot-compose textarea {
    flex:1 1 auto; min-width:0; resize:none; padding:0.5rem 0.65rem;
    border:1px solid var(--border); border-radius:9px; font-family:inherit;
    /* 16px stops iOS zooming the viewport when the field takes focus. */
    font-size:1rem; color:var(--ink); background:#fff; max-height:6rem;
  }
  .wow-bot-compose textarea:focus { outline:none; border-color:var(--wow); }
  .wow-bot-compose button { width:auto; flex:0 0 auto; padding:0.5rem 0.9rem; }
  .wow-bot-compose button[disabled] { opacity:0.55; cursor:default; }

  /* Nothing here works without JavaScript, so without it the launcher is a
     plain link to the page that does. */
  .wow-bot-fallback {
    position:fixed; right:1.25rem; bottom:1.25rem; z-index:60;
    padding:0.8rem 1.15rem; border-radius:999px; background:var(--wow); color:#fff;
    font-size:0.9rem; font-weight:700; text-decoration:none;
    box-shadow:0 6px 20px rgba(0,0,0,0.22);
  }

  @media (max-width:420px) {
    .wow-bot-panel { right:0.6rem; left:0.6rem; bottom:0.6rem; width:auto; }
    .wow-bot-launch, .wow-bot-fallback { right:0.9rem; bottom:0.9rem; }
  }
`;

function page(title: string, body: string, opts: { wide?: boolean; ask?: boolean } = {}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${PUBLIC_HEAD_TAGS}
<title>${escapeHtml(title)}</title>
<style>${PUBLIC_SHELL_CSS}${HELP_STYLES}</style>
</head>
<body>
  <div class="wrap${opts.wide ? " hc-wide" : ""}">
    ${BRAND_HEADER_HTML}
    <div class="card">
${body}
    </div>
    <p class="foot">WOW Video Tours</p>
  </div>
${opts.ask ? askWidget() : ""}
</body>
</html>`;
}

/** Where the search box reads its live suggestions from. GET, and read-only. */
export const HELP_SUGGEST_PATH = `${HELP_PATH}/suggest`;

/** Where a like is sent. */
export const HELP_LIKE_PATH = `${HELP_PATH}/like`;

/** Where a "was this helpful?" vote is sent. */
export const HELP_HELPFUL_PATH = `${HELP_PATH}/helpful`;

/**
 * Where the comment left with a vote is sent.
 *
 * Its own route rather than a field on the vote, because the vote is cast the
 * moment Yes or No is pressed and the comment is written afterwards. One route
 * taking both would have to be told which of the two it was doing, and a flag
 * that decides whether a counter moves is a flag that will eventually move it
 * twice.
 */
export const HELP_NOTE_PATH = `${HELP_PATH}/helpful/note`;

/**
 * The search box, with suggestions as you type.
 *
 * The form is the real thing and works on its own: no JavaScript, no fetch, a
 * GET to /help?q=. Everything the script adds sits on top of that and can fail
 * without taking the box with it.
 *
 * Typing does NOT log a search. The gap report counts searches somebody
 * submitted, and a suggestion endpoint that logged every keystroke would fill
 * it with the prefixes of words — "f", "fl", "flo" — and bury the questions
 * actually asked. The route enforces this; the note is here because this is
 * where the temptation to "just log it too" will arrive.
 */
function searchForm(query: string): string {
  return `      <form class="hc-search" method="get" action="${HELP_PATH}" role="search">
        <input type="search" name="q" id="hc-q" value="${escapeHtml(query)}" placeholder="Search help articles…" aria-label="Search help articles" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="hc-sugg" aria-autocomplete="list" />
        <button class="btn" type="submit">Search</button>
        <ul class="hc-sugg" id="hc-sugg" role="listbox" aria-label="Suggested articles" hidden></ul>
      </form>
      <script>
      (function () {
        var input = document.getElementById('hc-q');
        var list = document.getElementById('hc-sugg');
        if (!input || !list || !window.fetch) return;
        var timer = null;
        var seq = 0;
        var cursor = -1;

        function esc(value) {
          return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
          });
        }

        function close() {
          list.hidden = true;
          list.innerHTML = '';
          cursor = -1;
          input.setAttribute('aria-expanded', 'false');
        }

        function move(step) {
          var items = list.querySelectorAll('li[data-i]');
          if (!items.length) return;
          if (cursor >= 0 && items[cursor]) items[cursor].classList.remove('hc-sugg-on');
          cursor = (cursor + step + items.length) % items.length;
          items[cursor].classList.add('hc-sugg-on');
          items[cursor].scrollIntoView({ block: 'nearest' });
        }

        function show(articles) {
          if (!articles.length) {
            // Say so rather than closing: silence reads as a broken box, and
            // "nothing matches yet" is the cue to try a shorter word.
            list.innerHTML = '<li class="hc-sugg-none">No articles match that yet — press Search to look properly.</li>';
          } else {
            list.innerHTML = articles.map(function (a, i) {
              return '<li data-i="' + i + '" role="option"><a href="' + esc(a.url) + '">' + esc(a.title) +
                (a.summary ? '<span class="hc-sugg-sum">' + esc(a.summary) + '</span>' : '') + '</a></li>';
            }).join('');
          }
          cursor = -1;
          list.hidden = false;
          input.setAttribute('aria-expanded', 'true');
        }

        input.addEventListener('input', function () {
          var q = input.value.trim();
          if (timer) clearTimeout(timer);
          if (q.length < 2) { close(); return; }
          // Debounced so a typed word is one request rather than six, and
          // sequenced so a slow early reply cannot overwrite a fast later one.
          timer = setTimeout(function () {
            var mine = ++seq;
            fetch('${HELP_SUGGEST_PATH}?q=' + encodeURIComponent(q), {
              headers: { 'Accept': 'application/json' }
            }).then(function (r) { return r.json(); }).then(function (data) {
              if (mine !== seq || input.value.trim() !== q) return;
              show((data && data.articles) || []);
            }).catch(function () { close(); });
          }, 150);
        });

        input.addEventListener('keydown', function (e) {
          if (list.hidden) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
          else if (e.key === 'Escape') { close(); }
          else if (e.key === 'Enter' && cursor >= 0) {
            var link = list.querySelectorAll('li[data-i] a')[cursor];
            if (link) { e.preventDefault(); window.location.href = link.getAttribute('href'); }
          }
        });

        // A click inside the list is a click on a link and must not race the
        // blur that closes it, so this waits a tick.
        input.addEventListener('blur', function () { setTimeout(close, 150); });

        // "/" jumps to the box, the way search does everywhere else — but not
        // while someone is typing into a field, where it is just a slash.
        document.addEventListener('keydown', function (e) {
          if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
          var el = document.activeElement;
          var tag = el && el.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || (el && el.isContentEditable)) return;
          e.preventDefault();
          input.focus();
          input.select();
        });
      })();
      </script>`;
}

/** Where a question is sent. POST, never GET — see the route for why. */
export const HELP_ASK_PATH = `${HELP_PATH}/ask`;

/** Where a client asks for a person to look at what the box could not answer. */
export const HELP_ASK_SEND_PATH = `${HELP_PATH}/ask/send`;

/**
 * The floating assistant, bottom right of every help page.
 *
 * It looks like a chat and it is not one: each question is sent on its own,
 * with no previous message attached to it. The thread in the panel is a
 * transcript the browser keeps, not a conversation the model can be walked
 * along, and that is deliberate — a thread the model could see is a thread it
 * could be steered down over several turns.
 *
 * The whole widget is inline: no framework, no external script, nothing to
 * fetch. Without JavaScript the launcher degrades to a link to /help, which
 * searches without any of this.
 */
function askWidget(): string {
  return `      <noscript><a class="wow-bot-fallback" href="${HELP_PATH}">Search help articles</a></noscript>
      <button type="button" class="wow-bot-launch" id="wow-bot-launch" aria-expanded="false" aria-controls="wow-bot-panel" hidden>
        <span aria-hidden="true">💬</span> Need help?
      </button>
      <section class="wow-bot-panel" id="wow-bot-panel" role="dialog" aria-label="Ask WOW Video Tours" hidden>
        <header class="wow-bot-head">
          <div>
            <strong>Need a hand?</strong>
            <span>Quick answers from our help library</span>
          </div>
          <button type="button" class="wow-bot-close" id="wow-bot-close" aria-label="Close">×</button>
        </header>
        <div class="wow-bot-log" id="wow-bot-log" aria-live="polite">
          <div class="wow-bot-msg wow-bot-them">Ask me anything about your photos, your listings, or the portal. If I don't have the answer, I'll get it to someone who does.</div>
        </div>
        <form class="wow-bot-compose" id="wow-bot-form">
          <textarea id="wow-bot-input" rows="1" maxlength="500" placeholder="Type your question…" aria-label="Your question"></textarea>
          <button class="btn btn-primary" type="submit" id="wow-bot-send">Send</button>
        </form>
      </section>
      <script>
      (function () {
        var launch = document.getElementById('wow-bot-launch');
        var panel = document.getElementById('wow-bot-panel');
        var log = document.getElementById('wow-bot-log');
        var form = document.getElementById('wow-bot-form');
        var input = document.getElementById('wow-bot-input');
        var send = document.getElementById('wow-bot-send');
        if (!launch || !panel || !form) return;

        // The launcher is hidden in the markup and revealed here, so a browser
        // that cannot run this never shows a button that would do nothing.
        launch.hidden = false;

        function esc(value) {
          return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
          });
        }

        function add(html, who) {
          var el = document.createElement('div');
          el.className = 'wow-bot-msg ' + (who === 'you' ? 'wow-bot-you' : 'wow-bot-them');
          el.innerHTML = html;
          log.appendChild(el);
          log.scrollTop = log.scrollHeight;
          return el;
        }

        function open(state) {
          panel.hidden = !state;
          launch.hidden = state;
          launch.setAttribute('aria-expanded', state ? 'true' : 'false');
          if (state) input.focus();
        }

        launch.addEventListener('click', function () { open(true); });
        document.getElementById('wow-bot-close').addEventListener('click', function () { open(false); });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && !panel.hidden) open(false);
        });

        // Enter sends, Shift+Enter breaks the line — what a chat box does.
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
        });

        /**
         * The offer to pass a question to a person.
         *
         * Shown only when the box could not answer. The email is optional and
         * the button works without it; asking for it as a required field would
         * turn a ten-second question into a form.
         */
        function offerHuman(askId) {
          if (!askId) return;
          var wrap = document.createElement('div');
          wrap.className = 'wow-bot-send';
          wrap.innerHTML =
            '<input type="email" placeholder="Your email (so we can reply)" aria-label="Your email, so we can reply" maxlength="200">' +
            '<button class="btn btn-primary btn-sm" type="button">SEND IT TO OUR TEAM</button>';
          var button = wrap.querySelector('button');
          var email = wrap.querySelector('input');
          button.addEventListener('click', function () {
            button.disabled = true;
            fetch('${HELP_ASK_SEND_PATH}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({ askId: askId, email: email.value })
            }).then(function (r) { return r.json(); }).then(function (data) {
              wrap.innerHTML = data && data.ok
                ? '<p class="wow-bot-sent">Sent — a person will take a look' +
                  (email.value.trim() ? ' and reply to you.' : '.') + '</p>'
                : '<p class="wow-bot-sent">That did not send. Please try again in a moment.</p>';
            }).catch(function () {
              wrap.innerHTML = '<p class="wow-bot-sent">That did not send. Please try again in a moment.</p>';
            });
          });
          log.lastChild.appendChild(wrap);
          log.scrollTop = log.scrollHeight;
        }

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var question = input.value.trim();
          if (!question) return;
          add(esc(question), 'you');
          input.value = '';
          send.disabled = true;
          var thinking = add('…', 'them');

          fetch('${HELP_ASK_PATH}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ question: question })
          }).then(function (r) {
            if (r.status === 429) return { limited: true };
            return r.json();
          }).then(function (data) {
            thinking.remove();
            if (data && data.limited) {
              add('That is a few questions in quick succession — give me a minute, or search the help articles.', 'them');
              return;
            }
            if (!data || !data.answer) {
              add(esc((data && data.message) ||
                "I don't have an answer for that one yet — but our team does. Drop your email and we'll get back to you."), 'them');
              offerHuman(data && data.askId);
              return;
            }
            var cites = (data.articles || []).map(function (a) {
              return '<li><a href="' + esc(a.url) + '">' + esc(a.title) + '</a></li>';
            }).join('');
            add(esc(data.answer) + (cites ? '<ul class="wow-bot-cites">' + cites + '</ul>' : ''), 'them');
          }).catch(function () {
            thinking.remove();
            add('Something went wrong at our end. Please try again in a moment.', 'them');
          }).then(function () {
            send.disabled = false;
            input.focus();
          });
        });
      })();
      </script>`;
}

/**
 * The contents of a long article.
 *
 * Only drawn when there is genuinely something to navigate: three headings is
 * where a list stops restating the page and starts saving a scroll. Nested one
 * level, because help articles that go deeper than that want splitting up.
 */
function tableOfContents(headings: ArticleHeading[]): string {
  if (headings.length < 3) {
    return "";
  }
  const items = headings.map(
    (h) =>
      `          <li class="hc-toc-${h.level}"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`,
  );
  return `      <nav class="hc-toc" aria-label="On this page">
        <h2>On this page</h2>
        <ol>
${items.join("\n")}
        </ol>
      </nav>`;
}

/** When it was written, how long it takes, and a link straight to it. */
function articleMeta(article: KbArticle): string {
  const { label, at } = articleDate(article);
  return `      <p class="hc-meta">
        <span>${label} ${escapeHtml(formatHelpDate(at))}</span>
        <span class="hc-dot" aria-hidden="true">·</span>
        <span>${readingMinutes(article.bodyMd)} min read</span>
        <span class="hc-dot hc-copy-only" aria-hidden="true" hidden>·</span>
        <button type="button" class="hc-copy" id="hc-copy" hidden>Copy link</button>
      </p>`;
}

/**
 * Liking an article, and saying whether it helped.
 *
 * Both are hidden in the markup and revealed by the script below, for the same
 * reason the assistant launcher is: without JavaScript neither button can do
 * anything, and a button that silently fails is worse than one that was never
 * offered.
 *
 * Whether this visitor already liked or voted lives in their own localStorage
 * and nowhere else. The server counts presses and stores no identity at all, so
 * it genuinely cannot tell one visitor from another — the browser remembering
 * is the honest version of "you already said this", not a weaker one.
 */
function engagementBlock(article: KbArticle, likes: number): string {
  const slug = escapeHtml(article.slug);
  return `      <div class="hc-react" id="hc-react" data-slug="${slug}" hidden>
        <button type="button" class="hc-like" id="hc-like" aria-pressed="false" aria-label="Like this article">
          <span class="hc-heart" aria-hidden="true">♥</span>
          <span id="hc-like-label">Helpful</span>
          <span class="hc-like-n" id="hc-like-n"${likes > 0 ? "" : " hidden"}>${likes}</span>
        </button>
      </div>
      <section class="hc-helpful" id="hc-helpful" hidden aria-label="Was this article helpful?">
        <p id="hc-helpful-q">Was this article helpful?</p>
        <div class="hc-vote" id="hc-vote">
          <button type="button" data-vote="yes">Yes</button>
          <button type="button" data-vote="no">No</button>
        </div>
        <div class="hc-note" id="hc-note" hidden>
          <textarea id="hc-note-text" maxlength="500" rows="3" aria-label="What were you looking for?"></textarea>
          <button class="btn btn-primary" type="button" id="hc-note-send">Send</button>
        </div>
        <p class="hc-thanks" id="hc-thanks" hidden></p>
      </section>
      <script>
      (function () {
        var react = document.getElementById('hc-react');
        var helpful = document.getElementById('hc-helpful');
        if (!react || !helpful || !window.fetch) return;
        var slug = react.getAttribute('data-slug');
        var like = document.getElementById('hc-like');
        var likeN = document.getElementById('hc-like-n');
        var likeLabel = document.getElementById('hc-like-label');
        var vote = document.getElementById('hc-vote');
        var note = document.getElementById('hc-note');
        var noteText = document.getElementById('hc-note-text');
        var thanks = document.getElementById('hc-thanks');
        var question = document.getElementById('hc-helpful-q');

        // Private-mode Safari throws on localStorage rather than returning
        // null, and a thrown storage read must not cost the whole block.
        function remembered(key) {
          try { return window.localStorage.getItem(key); } catch (e) { return null; }
        }
        function remember(key, value) {
          try {
            if (value === null) window.localStorage.removeItem(key);
            else window.localStorage.setItem(key, value);
          } catch (e) { /* nothing to do; the buttons still work, they just forget */ }
        }

        var likeKey = 'wow-help-like:' + slug;
        var voteKey = 'wow-help-vote:' + slug;
        var liked = remembered(likeKey) === '1';

        react.hidden = false;
        like.setAttribute('aria-pressed', liked ? 'true' : 'false');
        likeLabel.textContent = liked ? 'Liked' : 'Helpful';

        like.addEventListener('click', function () {
          liked = !liked;
          like.setAttribute('aria-pressed', liked ? 'true' : 'false');
          likeLabel.textContent = liked ? 'Liked' : 'Helpful';
          remember(likeKey, liked ? '1' : null);
          fetch('${HELP_LIKE_PATH}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ slug: slug, on: liked })
          }).then(function (r) { return r.json(); }).then(function (data) {
            // The server's count, not ours: two people liking at once should
            // both end up seeing two.
            if (!data || typeof data.likes !== 'number') return;
            likeN.textContent = String(data.likes);
            likeN.hidden = data.likes <= 0;
          }).catch(function () { /* the press stands locally; the count catches up on reload */ });
        });

        function askedAlready(answer) {
          vote.hidden = true;
          question.hidden = true;
          note.hidden = true;
          thanks.hidden = false;
          thanks.textContent = answer === 'no'
            ? "Thanks — we'll use that to improve this article."
            : 'Thanks for letting us know.';
        }

        helpful.hidden = false;
        var already = remembered(voteKey);
        if (already) askedAlready(already);

        vote.addEventListener('click', function (e) {
          var button = e.target.closest('button[data-vote]');
          if (!button) return;
          var answer = button.getAttribute('data-vote');
          remember(voteKey, answer);
          vote.hidden = true;
          // The vote is counted now. The comment below is optional and its own
          // request, so leaving without writing one still records the vote.
          fetch('${HELP_HELPFUL_PATH}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ slug: slug, helpful: answer === 'yes' })
          }).catch(function () { /* counted or not, the client is not told off for it */ });
          question.textContent = answer === 'no'
            ? 'Sorry about that. What were you looking for?'
            : 'Glad it helped. Anything we could add?';
          note.hidden = false;
          noteText.focus();
          document.getElementById('hc-note-send').addEventListener('click', function () {
            var text = noteText.value.trim();
            if (!text) { askedAlready(answer); return; }
            fetch('${HELP_NOTE_PATH}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({ slug: slug, helpful: answer === 'yes', note: text })
            }).catch(function () { /* as above */ });
            askedAlready(answer);
          }, { once: true });
        });

        var copy = document.getElementById('hc-copy');
        if (copy && navigator.clipboard) {
          copy.hidden = false;
          var dot = document.querySelector('.hc-copy-only');
          if (dot) dot.hidden = false;
          copy.addEventListener('click', function () {
            navigator.clipboard.writeText(window.location.href.split('#')[0]).then(function () {
              copy.textContent = 'Link copied';
              setTimeout(function () { copy.textContent = 'Copy link'; }, 2000);
            }).catch(function () { copy.textContent = 'Press Ctrl+C to copy'; });
          });
        }
      })();
      </script>`;
}

/**
 * A folder mark, inline so a help page still needs no asset of its own and the
 * chip keeps working where an emoji would render differently on every phone.
 */
const FOLDER_MARK =
  `<svg class="hc-fold" viewBox="0 0 16 16" aria-hidden="true" focusable="false">` +
  `<path fill="currentColor" d="M1.6 4.1c0-.94.76-1.7 1.7-1.7h2.9c.55 0 1.07.27 1.39.72l.53.75H13c.94 0 1.7.76 1.7 1.7v6.3c0 .94-.76 1.7-1.7 1.7H3.3c-.94 0-1.7-.76-1.7-1.7V4.1Z"/>` +
  `</svg>`;

/** Says "this is a shelf, not something to read" in one small chip. */
function categoryChip(): string {
  return `<span class="hc-kind">${FOLDER_MARK}Category</span>`;
}

/** "3 articles" — a count is the other thing an article never has. */
function articleTally(count: number): string {
  return `<span class="hc-tally">${count} article${count === 1 ? "" : "s"}</span>`;
}

/**
 * The browse-by-category row.
 *
 * The index already grouped articles under category headings, but nothing
 * linked to the category pages that exist, so a visitor could only scroll.
 * `active` marks the shelf being viewed when this is shown on a category page.
 */
function categoryPills(
  categories: Array<KbCategory & { articles?: KbArticle[] }>,
  active?: string,
): string {
  if (categories.length === 0) {
    return "";
  }
  const pills = categories.map((c) => {
    const on = active && c.slug === active ? " hc-cat-on" : "";
    const count = c.articles ? ` <span class="hc-count">${c.articles.length}</span>` : "";
    return `        <a class="hc-cat${on}" href="${categoryUrl(c)}">${FOLDER_MARK}${escapeHtml(
      c.title,
    )}${count}</a>`;
  });
  // Without the label the row reads as tags, or as a list of articles someone
  // picked out; naming it says what one click does.
  return `      <nav class="hc-cats" aria-label="Help categories">
        <span class="hc-cats-label">Browse by category</span>
${pills.join("\n")}
      </nav>`;
}

/**
 * One row of a help list.
 *
 * `searchId` ties an opened article back to the search that offered it, and is
 * only ever set on a results page — see searchResultItem.
 */
function listItem(article: KbArticle, searchId: string | null): string {
  const href = searchId
    ? `${articleUrl(article)}?s=${encodeURIComponent(searchId)}`
    : articleUrl(article);
  return `          <li><a href="${href}">${escapeHtml(article.title)}${
    article.summary ? `<span class="hc-sum">${escapeHtml(article.summary)}</span>` : ""
  }</a></li>`;
}

/**
 * The map-safe form. Every list here is rendered with `.map(articleListItem)`,
 * so this must stay single-argument: a second parameter would silently collect
 * the array index and stamp it onto every link as a search id.
 */
function articleListItem(article: KbArticle): string {
  return listItem(article, null);
}

/** A row on the results page, carrying the search it came from. */
function searchResultItem(article: KbArticle, searchId: string | null): string {
  return listItem(article, searchId);
}

/**
 * A row in the "recently updated" list, marked when it is genuinely new.
 *
 * Single-argument like articleListItem and for the same reason — it is called
 * with `.map()`, which would otherwise hand it the array index.
 */
function recentListItem(article: KbArticle): string {
  const badge = isRecentlyChanged(article)
    ? ` <span class="hc-new">${articleDate(article).label === "Updated" ? "Updated" : "New"}</span>`
    : "";
  return `          <li><a href="${articleUrl(article)}">${escapeHtml(article.title)}${badge}${
    article.summary ? `<span class="hc-sum">${escapeHtml(article.summary)}</span>` : ""
  }</a></li>`;
}

/**
 * The two shortcut lists at the top of the index: what people read most, and
 * what changed lately.
 *
 * Left out entirely below a handful of articles, where they would be the same
 * list as the page beneath them written twice. They are a shortcut through a
 * long index, not a feature the index needs.
 */
const HIGHLIGHT_FLOOR = 5;

function highlights(popular: KbArticle[], recent: KbArticle[], total: number): string {
  if (total < HIGHLIGHT_FLOOR) {
    return "";
  }
  const sections: string[] = [];
  if (popular.length > 0) {
    sections.push(`      <section class="hc-group">
        <h2>Most read</h2>
        <ul class="hc-list">
${popular.map(articleListItem).join("\n")}
        </ul>
      </section>`);
  }
  if (recent.length > 0) {
    sections.push(`      <section class="hc-group">
        <h2>Recently updated</h2>
        <ul class="hc-list">
${recent.map(recentListItem).join("\n")}
        </ul>
      </section>`);
  }
  if (sections.length === 0) {
    return "";
  }
  return `      <div class="hc-groups">
${sections.join("\n")}
      </div>
`;
}

export type HelpIndexView = {
  /** Categories in their authored order; empty ones are left out by the caller. */
  categories: Array<KbCategory & { articles: KbArticle[] }>;
  /** Published articles filed nowhere. Shown last, under their own heading. */
  unfiled: KbArticle[];
  /** Whether the answering box is configured. Off means no form is drawn. */
  askEnabled?: boolean;
  /** Most-read published articles, already ordered and capped by the caller. */
  popular?: KbArticle[];
  /** Most recently written or rewritten, newest first. */
  recent?: KbArticle[];
};

export function renderHelpIndexHtml(view: HelpIndexView): string {
  const groups = view.categories.map(
    (category) => `      <section class="hc-group hc-shelf">
        <div class="hc-shelf-head">${categoryChip()}${articleTally(category.articles.length)}</div>
        <h2><a href="${categoryUrl(category)}">${escapeHtml(category.title)}</a></h2>
        ${category.description ? `<p class="hc-desc">${escapeHtml(category.description)}</p>` : ""}
        <ul class="hc-list">
${category.articles.map(articleListItem).join("\n")}
        </ul>
      </section>`,
  );
  if (view.unfiled.length > 0) {
    groups.push(`      <section class="hc-group">
        <h2>More help</h2>
        <ul class="hc-list">
${view.unfiled.map(articleListItem).join("\n")}
        </ul>
      </section>`);
  }
  const total =
    view.categories.reduce((sum, category) => sum + category.articles.length, 0) +
    view.unfiled.length;
  const body = `      <p class="eyebrow">Help Center</p>
      <h1 class="title">How can we help?</h1>
${searchForm("")}
${categoryPills(view.categories)}
${highlights(view.popular ?? [], view.recent ?? [], total)}
${
  groups.length > 0
    ? `      <div class="hc-groups">
${groups.join("\n")}
      </div>`
    : `      <p class="hc-empty">There are no help articles yet.</p>`
}
`;
  return page("Help Center — WOW Video Tours", body, { wide: true, ask: view.askEnabled });
}

export type HelpSearchView = {
  query: string;
  results: KbArticle[];
  /** So a fruitless search still offers somewhere to go next. */
  categories: KbCategory[];
  supportUrl: string;
  /** Whether the answering box is configured. Off means no form is drawn. */
  askEnabled?: boolean;
  /**
   * The logged search these results answer, when it was logged. Rides on the
   * result links so that opening one records which search it settled — the
   * difference between "we have an article for that" and "we have an article
   * for that and it looked like the answer".
   */
  searchId?: string | null;
};

export function renderHelpSearchHtml(view: HelpSearchView): string {
  const body = `      <p class="eyebrow">Help Center</p>
      <h1 class="title">Search results</h1>
${searchForm(view.query)}
${categoryPills(view.categories)}
${
  view.results.length > 0
    ? `      <ul class="hc-list">
${view.results.map((article) => searchResultItem(article, view.searchId ?? null)).join("\n")}
      </ul>`
    : `      <p class="hc-empty">Nothing matched “${escapeHtml(view.query)}”. Try a shorter word — searching for less finds more, or pick a category above.</p>`
}
      <div class="hc-more">
        <p class="hc-empty"><a href="${HELP_PATH}">Back to all help articles</a> · <a href="${escapeHtml(view.supportUrl)}">Submit a request</a></p>
      </div>`;
  return page(`Search — Help Center`, body, { wide: true, ask: view.askEnabled });
}

export type HelpCategoryView = {
  category: KbCategory;
  articles: KbArticle[];
  /** Every category, so a visitor can move sideways without going back first. */
  categories: KbCategory[];
  askEnabled?: boolean;
};

export function renderHelpCategoryHtml(view: HelpCategoryView): string {
  // The chip and the count do here what the shelf card does on the index:
  // an eyebrow reading "Help Center" over a title looked exactly like an
  // article page.
  const body = `      <a class="hc-back" href="${HELP_PATH}">← All help articles</a>
      <p class="hc-pagekind">${categoryChip()}${articleTally(view.articles.length)}</p>
      <h1 class="title">${escapeHtml(view.category.title)}</h1>
      ${view.category.description ? `<p class="lead">${escapeHtml(view.category.description)}</p>` : ""}
${searchForm("")}
${categoryPills(view.categories, view.category.slug)}
${
  view.articles.length > 0
    ? `      <ul class="hc-list">
${view.articles.map(articleListItem).join("\n")}
      </ul>`
    : `      <p class="hc-empty">Nothing here yet.</p>`
}
`;
  return page(`${view.category.title} — Help Center`, body, { wide: true, ask: view.askEnabled });
}

export type HelpArticleView = {
  article: KbArticle;
  /** The shelf it sits on, when it is filed; drives the back link. */
  category: KbCategory | null;
  /** Its published shelf-mates, for reading on. */
  siblings: KbArticle[];
  supportUrl: string;
  askEnabled?: boolean;
  /** Likes so far. Rendered server-side so the number is right before any script runs. */
  likes?: number;
};

export function renderHelpArticleHtml(view: HelpArticleView): string {
  const { article, category } = view;
  const rendered = renderArticleBody(article.bodyMd);
  const embed = article.videoUrl ? videoEmbedUrl(article.videoUrl) : null;
  const video = embed
    ? // referrerpolicy is load-bearing: the site sends `Referrer-Policy:
      // no-referrer`, and YouTube's player answers an embed it cannot attribute
      // to a referring origin with "Error 153 Video player configuration
      // error". The attribute overrides the document policy for this one
      // request and sends the origin only — never the article's path.
      `      <div class="hc-video"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(article.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe></div>`
    : article.videoUrl
      ? `      <a class="hc-videolink" href="${escapeHtml(article.videoUrl)}" target="_blank" rel="noopener noreferrer">▶ Watch the video</a>`
      : "";
  const others = view.siblings.filter((s) => s.id !== article.id);
  const body = `      <a class="hc-back" href="${category ? categoryUrl(category) : HELP_PATH}">← ${escapeHtml(category ? category.title : "All help articles")}</a>
      <p class="eyebrow">${category ? `In ${escapeHtml(category.title)}` : "Help Center"}</p>
      <h1 class="title">${escapeHtml(article.title)}</h1>
      ${article.summary ? `<p class="lead">${escapeHtml(article.summary)}</p>` : ""}
${articleMeta(article)}
${video}
${tableOfContents(rendered.headings)}
      <div class="hc-body">
${rendered.html}
      </div>
${engagementBlock(article, view.likes ?? 0)}
      <div class="hc-more">
${
  others.length > 0
    ? `        <h2 class="eyebrow">More in ${escapeHtml(category ? category.title : "the help center")}</h2>
        <ul class="hc-list">
${others.map(articleListItem).join("\n")}
        </ul>`
    : ""
}
        <p class="hc-empty" style="margin-top:0.9rem">Still stuck? <a href="${escapeHtml(view.supportUrl)}">Submit a request</a> and we'll help.</p>
      </div>`;
  return page(`${article.title} — Help Center`, body, { ask: view.askEnabled });
}

export type HelpAnswerView = {
  question: string;
  /** The answer, or null when none could be given. */
  answer: string | null;
  /**
   * Articles to offer: the ones the answer cited, or — when there is no answer
   * — whatever retrieval found. A question we could not answer is still worth
   * pointing somewhere, and this is the closest thing we have.
   */
  articles: KbArticle[];
  supportUrl: string;
  askEnabled?: boolean;
};

/**
 * The answer page.
 *
 * Two things are non-negotiable in this markup. The answer is escaped, not
 * rendered as Markdown: it is model output, the only text on this site not
 * written by a person, and it is not going to be the first thing here allowed
 * to emit tags. And the cited articles are always shown — an answer without the
 * articles behind it asks a client to take a machine's word for it, when the
 * real answer is one click away and was written by someone who knows.
 */
export function renderHelpAnswerHtml(view: HelpAnswerView): string {
  const reading =
    view.articles.length > 0
      ? `        <h2 class="eyebrow">${escapeHtml(view.answer ? "Where this came from" : "You might want")}</h2>
        <ul class="hc-list">
${view.articles.map(articleListItem).join("\n")}
        </ul>`
      : "";
  const body = `      <a class="hc-back" href="${HELP_PATH}">← All help articles</a>
      <p class="eyebrow">Help Center</p>
      <h1 class="title">${escapeHtml(view.answer ? "Here's what we found" : "We don't have an answer for that")}</h1>
      <p class="hc-asked">You asked: <span>${escapeHtml(view.question)}</span></p>
${
  view.answer
    ? `      <div class="hc-answer">
        <p class="hc-answer-text">${escapeHtml(view.answer)}</p>
${reading}
        <p class="hc-note">Answered from the help articles on this site. If it does not match what you were told, trust the article — or <a href="${escapeHtml(view.supportUrl)}">submit a request</a> and a person will help.</p>
      </div>`
    : `      <p class="lead">Nothing in our help articles covers that yet. <a href="${escapeHtml(view.supportUrl)}">Submit a request</a> and a person will get back to you.</p>
${reading ? `      <div class="hc-more">\n${reading}\n      </div>` : ""}`
}
      <div class="hc-more">
        <p class="hc-empty"><a href="${HELP_PATH}">Back to all help articles</a></p>
      </div>`;
  return page("Help Center — WOW Video Tours", body, { ask: view.askEnabled });
}

/**
 * What someone sees when they have asked too often, or when the day's questions
 * are spent.
 *
 * Searching still works and is not rate limited, so the page leads with it
 * rather than with an apology — the thing they wanted is still available.
 */
export function renderHelpAskLimitedHtml(view: {
  question: string;
  reason: "client_rate" | "daily_cap";
  supportUrl: string;
}): string {
  const body = `      <p class="eyebrow">Help Center</p>
      <h1 class="title">${escapeHtml(view.reason === "daily_cap" ? "The answer box is resting" : "One moment")}</h1>
      <p class="lead">${escapeHtml(
        view.reason === "daily_cap"
          ? "It has had a busy day and is back tomorrow. Searching still works, and a person can help with anything it would have answered."
          : "That's a few questions in quick succession. Try again in a minute — or search, which has no such limit.",
      )}</p>
${searchForm(view.question)}
      <p class="hc-empty"><a href="${HELP_PATH}">Browse all help articles</a> · <a href="${escapeHtml(view.supportUrl)}">Submit a request</a></p>`;
  return page("Help Center — WOW Video Tours", body);
}

/**
 * One page for "no such article" and "that article is a draft" alike: which of
 * the two it is tells an outsider something about unpublished work, and there
 * is nothing they could do with either answer.
 */
export function renderHelpNotFoundHtml(supportUrl: string, askEnabled = false): string {
  const body = `      <p class="eyebrow">Help Center</p>
      <h1 class="title">We couldn't find that page</h1>
      <p class="lead">The link may be out of date, or the article may have moved.</p>
${searchForm("")}
      <p class="hc-empty"><a href="${HELP_PATH}">Browse all help articles</a> · <a href="${escapeHtml(supportUrl)}">Submit a request</a></p>`;
  return page("Not found — Help Center", body, { ask: askEnabled });
}
