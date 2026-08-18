// The public help centre: what a client sees at /help.
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

/** Where the help centre lives. Article slugs are unique base-wide, so an
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
`;

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${PUBLIC_HEAD_TAGS}
<title>${escapeHtml(title)}</title>
<style>${PUBLIC_SHELL_CSS}${HELP_STYLES}</style>
</head>
<body>
  <div class="wrap">
    ${BRAND_HEADER_HTML}
    <div class="card">
${body}
    </div>
    <p class="foot">WOW Video Tours</p>
  </div>
</body>
</html>`;
}

function searchForm(query: string): string {
  return `      <form class="hc-search" method="get" action="${HELP_PATH}" role="search">
        <input type="search" name="q" value="${escapeHtml(query)}" placeholder="Search help articles…" aria-label="Search help articles" />
        <button class="btn" type="submit">Search</button>
      </form>`;
}

function articleListItem(article: KbArticle): string {
  return `          <li><a href="${articleUrl(article)}">${escapeHtml(article.title)}${
    article.summary ? `<span class="hc-sum">${escapeHtml(article.summary)}</span>` : ""
  }</a></li>`;
}

export type HelpIndexView = {
  /** Categories in their authored order; empty ones are left out by the caller. */
  categories: Array<KbCategory & { articles: KbArticle[] }>;
  /** Published articles filed nowhere. Shown last, under their own heading. */
  unfiled: KbArticle[];
  supportUrl: string;
};

export function renderHelpIndexHtml(view: HelpIndexView): string {
  const groups = view.categories.map(
    (category) => `      <section class="hc-group">
        <h2>${escapeHtml(category.title)}</h2>
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
  const body = `      <p class="eyebrow">Help Centre</p>
      <h1 class="title">How can we help?</h1>
${searchForm("")}
${
  groups.length > 0
    ? groups.join("\n")
    : `      <p class="hc-empty">There are no help articles yet.</p>`
}
      <div class="hc-more">
        <p class="hc-empty">Can't find what you need? <a href="${escapeHtml(view.supportUrl)}">Submit a request</a> and we'll help.</p>
      </div>`;
  return page("Help Centre — WOW Video Tours", body);
}

export type HelpSearchView = {
  query: string;
  results: KbArticle[];
  supportUrl: string;
};

export function renderHelpSearchHtml(view: HelpSearchView): string {
  const body = `      <p class="eyebrow">Help Centre</p>
      <h1 class="title">Search results</h1>
${searchForm(view.query)}
${
  view.results.length > 0
    ? `      <ul class="hc-list">
${view.results.map(articleListItem).join("\n")}
      </ul>`
    : `      <p class="hc-empty">Nothing matched “${escapeHtml(view.query)}”. Try a shorter word — searching for less finds more.</p>`
}
      <div class="hc-more">
        <p class="hc-empty"><a href="${HELP_PATH}">Back to all help articles</a> · <a href="${escapeHtml(view.supportUrl)}">Submit a request</a></p>
      </div>`;
  return page(`Search — Help Centre`, body);
}

export type HelpCategoryView = {
  category: KbCategory;
  articles: KbArticle[];
  supportUrl: string;
};

export function renderHelpCategoryHtml(view: HelpCategoryView): string {
  const body = `      <a class="hc-back" href="${HELP_PATH}">← All help articles</a>
      <p class="eyebrow">Help Centre</p>
      <h1 class="title">${escapeHtml(view.category.title)}</h1>
      ${view.category.description ? `<p class="lead">${escapeHtml(view.category.description)}</p>` : ""}
${
  view.articles.length > 0
    ? `      <ul class="hc-list">
${view.articles.map(articleListItem).join("\n")}
      </ul>`
    : `      <p class="hc-empty">Nothing here yet.</p>`
}`;
  return page(`${view.category.title} — Help Centre`, body);
}

export type HelpArticleView = {
  article: KbArticle;
  /** The shelf it sits on, when it is filed; drives the back link. */
  category: KbCategory | null;
  /** Its published shelf-mates, for reading on. */
  siblings: KbArticle[];
  supportUrl: string;
};

export function renderHelpArticleHtml(view: HelpArticleView): string {
  const { article, category } = view;
  const embed = article.videoUrl ? videoEmbedUrl(article.videoUrl) : null;
  const video = embed
    ? `      <div class="hc-video"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(article.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
    : article.videoUrl
      ? `      <a class="hc-videolink" href="${escapeHtml(article.videoUrl)}" target="_blank" rel="noopener noreferrer">▶ Watch the video</a>`
      : "";
  const others = view.siblings.filter((s) => s.id !== article.id);
  const body = `      <a class="hc-back" href="${category ? categoryUrl(category) : HELP_PATH}">← ${escapeHtml(category ? category.title : "All help articles")}</a>
      <p class="eyebrow">${escapeHtml(category ? category.title : "Help Centre")}</p>
      <h1 class="title">${escapeHtml(article.title)}</h1>
      ${article.summary ? `<p class="lead">${escapeHtml(article.summary)}</p>` : ""}
${video}
      <div class="hc-body">
${renderMarkdown(article.bodyMd)}
      </div>
      <div class="hc-more">
${
  others.length > 0
    ? `        <h2 class="eyebrow">More in ${escapeHtml(category ? category.title : "the help centre")}</h2>
        <ul class="hc-list">
${others.map(articleListItem).join("\n")}
        </ul>`
    : ""
}
        <p class="hc-empty" style="margin-top:0.9rem">Still stuck? <a href="${escapeHtml(view.supportUrl)}">Submit a request</a> and we'll help.</p>
      </div>`;
  return page(`${article.title} — Help Centre`, body);
}

/**
 * One page for "no such article" and "that article is a draft" alike: which of
 * the two it is tells an outsider something about unpublished work, and there
 * is nothing they could do with either answer.
 */
export function renderHelpNotFoundHtml(supportUrl: string): string {
  const body = `      <p class="eyebrow">Help Centre</p>
      <h1 class="title">We couldn't find that page</h1>
      <p class="lead">The link may be out of date, or the article may have moved.</p>
${searchForm("")}
      <p class="hc-empty"><a href="${HELP_PATH}">Browse all help articles</a> · <a href="${escapeHtml(supportUrl)}">Submit a request</a></p>`;
  return page("Not found — Help Centre", body);
}
