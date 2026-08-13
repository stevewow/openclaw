// Where a 👍 or 👎 in the resolution email lands.
//
// The click has already happened by the time this renders, so the page's job is
// to confirm it, let the client change their mind, and offer the box where the
// actual reason goes — a thumb tells us the score, the sentence tells us what to
// fix.
//
// The rating is recorded by a POST the page makes on load, never by the GET that
// serves it. Inboxes prefetch links: Outlook's Safe Links and Gmail's proxy both
// fetch a URL before a human sees it, so a GET that wrote would score tickets
// nobody ever opened. Scanners don't run scripts.
//
// Inline JS uses string concatenation only (no template literals) so the outer
// TS template string stays intact.

import { escapeHtml } from "./ticket-email-render.js";
import { BRAND_HEADER_HTML, PUBLIC_HEAD_TAGS, PUBLIC_SHELL_CSS } from "./ticket-public-shell.js";

export type FeedbackPageView = {
  /** The token from the link, echoed back for the page's POST. */
  token: string;
  ticketNumber: string;
  /** What the client clicked in the email, if the link carried one. */
  rating: "up" | "down" | null;
  /** Their previous answer, when they are coming back to a rated ticket. */
  existingComment: string | null;
  supportEmail: string;
};

const FEEDBACK_STYLES = `
  .fb-head { text-align:center; }
  .fb-check {
    width:56px; height:56px; border-radius:50%; background:var(--wow); color:#fff;
    font-size:1.6rem; display:flex; align-items:center; justify-content:center;
    margin:0 auto 1.1rem;
  }
  .fb-num { font-size:0.78rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); margin:0 0 1.4rem; }
  /* Two big targets side by side, and still side by side on the narrowest
     phone — stacking them would read as a list of options rather than a pair. */
  .thumbs { display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; margin-bottom:1.5rem; }
  .thumb {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:0.4rem; padding:1rem 0.5rem; min-height:88px;
    border:1px solid var(--border); border-radius:16px; background:#fff;
    font-family:inherit; font-size:0.82rem; font-weight:600; color:var(--ink);
    cursor:pointer; transition:border-color 0.15s, box-shadow 0.15s, background 0.15s;
    -webkit-appearance:none;
  }
  .thumb .em { font-size:1.6rem; line-height:1; }
  .thumb:hover { border-color:var(--ink); }
  .thumb.picked { border-color:var(--wow); background:var(--wow-tint); box-shadow:0 0 0 2px var(--wow-tint); }
  .thumb:focus-visible { outline:2px solid var(--wow); outline-offset:2px; }
  label.fb-label { display:block; font-weight:600; font-size:0.78rem; letter-spacing:0.02em; margin:0 0 0.4rem; }
  textarea {
    display:block; width:100%; padding:0.7rem 0.85rem; border:1px solid var(--border);
    border-radius:12px; font:inherit; font-size:16px; background:#fff; color:var(--ink);
    resize:vertical; min-height:96px; transition:border-color 0.15s, box-shadow 0.15s;
  }
  textarea:focus { outline:none; border-color:var(--wow); box-shadow:0 0 0 3px var(--wow-tint); }
  .fb-hint { color:var(--muted); font-size:0.76rem; margin-top:0.4rem; line-height:1.5; }
  .fb-note { color:var(--muted); font-size:0.84rem; line-height:1.6; margin:1.4rem 0 0; text-align:center; }
  .fb-note a { color:var(--wow); font-weight:600; text-decoration:none; }
  .fb-status { color:var(--muted); font-size:0.78rem; text-align:center; margin:0.8rem 0 0; min-height:1.2em; }`;

/** The page a good or bad link both reach; an unknown token gets `renderFeedbackExpiredHtml`. */
export function renderTicketFeedbackHtml(view: FeedbackPageView): string {
  const config = JSON.stringify({
    token: view.token,
    rating: view.rating,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
${PUBLIC_HEAD_TAGS}
<title>WOW Video Tours — How did we do?</title>
<style>${PUBLIC_SHELL_CSS}${FEEDBACK_STYLES}
</style>
</head>
<body>
  <div class="wrap">
    ${BRAND_HEADER_HTML}
    <div class="card">
      <div class="fb-head">
        <div class="fb-check" aria-hidden="true">✓</div>
        <p class="eyebrow">Thanks for the feedback</p>
        <h1 class="title">How did we do?</h1>
        <p class="fb-num">Ticket ${escapeHtml(view.ticketNumber)}</p>
      </div>

      <div class="thumbs" role="group" aria-label="Rate this request">
        <button type="button" class="thumb" id="thumb-up" data-rating="up" aria-pressed="false">
          <span class="em" aria-hidden="true">👍</span><span>Looks great</span>
        </button>
        <button type="button" class="thumb" id="thumb-down" data-rating="down" aria-pressed="false">
          <span class="em" aria-hidden="true">👎</span><span>Not quite</span>
        </button>
      </div>

      <div>
        <label class="fb-label" for="fb-comment">Anything you'd like to add? (optional)</label>
        <textarea id="fb-comment" placeholder="Tell us what worked, or what we should put right…">${escapeHtml(view.existingComment ?? "")}</textarea>
        <div class="fb-hint">If something needs fixing, say so here and we'll reopen this ticket.</div>
      </div>

      <p class="fb-status" id="fb-status"></p>
      <p style="margin-top:0.6rem"><button type="button" class="btn" id="fb-send">Send feedback</button></p>

      <p class="fb-note">Prefer to email us? <a href="mailto:${escapeHtml(view.supportEmail)}?subject=${encodeURIComponent(`${view.ticketNumber} — something doesn't look right`)}">${escapeHtml(view.supportEmail)}</a></p>
    </div>
    <div class="foot">WOW Video Tours · Ticket ${escapeHtml(view.ticketNumber)}</div>
  </div>

<script id="fb-config" type="application/json">${config}</script>
<script>
(function(){
  'use strict';
  var config = {};
  try { config = JSON.parse(document.getElementById('fb-config').textContent || '{}'); } catch (e) { config = {}; }

  var upBtn = document.getElementById('thumb-up');
  var downBtn = document.getElementById('thumb-down');
  var commentEl = document.getElementById('fb-comment');
  var sendBtn = document.getElementById('fb-send');
  var statusEl = document.getElementById('fb-status');
  var rating = config.rating === 'up' || config.rating === 'down' ? config.rating : null;

  function paint(){
    [upBtn, downBtn].forEach(function(btn){
      var on = btn.getAttribute('data-rating') === rating;
      btn.classList.toggle('picked', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /** Post whatever we currently know. Silent on the automatic first call. */
  function save(includeComment, quiet){
    var payload = { token: config.token, rating: rating };
    if (includeComment) payload.comment = commentEl.value;
    return fetch('/api/support/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(res){
      if (!res.ok) throw new Error('save failed');
      if (!quiet) statusEl.textContent = 'Thanks — we\\'ve got it.';
      return true;
    }).catch(function(){
      if (!quiet) statusEl.textContent = 'We could not save that. Please try again.';
      return false;
    });
  }

  paint();
  // The thumb came from the email link; record it now so a client who reads the
  // page and closes it has still told us something.
  if (rating) save(false, true);

  [upBtn, downBtn].forEach(function(btn){
    btn.addEventListener('click', function(){
      rating = btn.getAttribute('data-rating');
      paint();
      statusEl.textContent = '';
      save(false, true);
    });
  });

  sendBtn.addEventListener('click', function(){
    if (!rating && !commentEl.value.trim()) {
      statusEl.textContent = 'Pick a thumb or leave a note first.';
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    save(true, false).then(function(ok){
      sendBtn.textContent = ok ? 'Sent — thank you' : 'Send feedback';
      sendBtn.disabled = ok;
    });
  });
})();
</script>
</body>
</html>`;
}

/**
 * What an unrecognized token gets. Deliberately says nothing about whether the
 * ticket exists — this link is emailed, forwarded and pasted, and a stranger
 * holding a stale one learns nothing from it.
 */
export function renderFeedbackExpiredHtml(supportEmail: string): string {
  return `<!doctype html>
<html lang="en">
<head>
${PUBLIC_HEAD_TAGS}
<title>WOW Video Tours — Feedback</title>
<style>${PUBLIC_SHELL_CSS}
  .fb-note { color:var(--muted); font-size:0.9rem; line-height:1.7; margin:0.6rem 0 0; }
  .fb-note a { color:var(--wow); font-weight:600; text-decoration:none; }
</style>
</head>
<body>
  <div class="wrap">
    ${BRAND_HEADER_HTML}
    <div class="card">
      <p class="eyebrow">Feedback</p>
      <h1 class="title">This link is no longer active</h1>
      <p class="fb-note">It may have already been used, or the request it belonged to has since been removed. If there's something you'd like us to look at, email <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a> and we'll pick it up.</p>
    </div>
    <div class="foot">WOW Video Tours</div>
  </div>
</body>
</html>`;
}
