// White-label public intake form served at /support. The Spiro media-delivery
// page's "Submit Ticket or Request" button links here with the order's context
// in the query string (see ticket-spiro-context.ts for the parameter contract);
// the older ?orderId= / ?address= form still works. Known contact details
// prefill the form so the client is not asked what the link already said.
// No platform references — this is a customer surface.
//
// Request types, their follow-up question, and their details copy are all
// admin-managed (admin_ticket_categories) and injected as JSON, so adding a
// category in the dashboard changes this form with no redeploy. Inline JS uses
// string concatenation only (no template literals) so the outer TS template
// string stays intact.

import { SPIRO_PARAM_MAPPINGS } from "./ticket-spiro-context.js";

/** A question shown only once its choice is picked. */
export type IntakeFollowUpView = {
  id: string;
  label: string;
  kind: "text" | "textarea" | "select";
  choices: string[];
  placeholder: string | null;
  required: boolean;
};

/** One choice, with its optional thumbnail, price, quantity and questions. */
export type IntakeOptionView = {
  label: string;
  imageUrl: string | null;
  priceCents: number | null;
  /** High end of a price range, or null for a firm price. */
  priceMaxCents: number | null;
  /** Has to be quoted and accepted before work starts. Always true when ranged. */
  quoteRequired: boolean;
  /** How the price is worded — "per image". Null reads as "each". */
  unitLabel: string | null;
  maxQuantity: number;
  followUps: IntakeFollowUpView[];
};

/** The per-category form config handed to the page. */
export type IntakeCategoryView = {
  key: string;
  label: string;
  extraField: "none" | "select" | "text" | "multiselect";
  extraLabel: string | null;
  extraOptions: IntakeOptionView[];
  extraPlaceholder: string | null;
  detailsLabel: string;
  detailsHint: string | null;
};

/**
 * Embed data in a <script type="application/json"> block. Escaping `<` is what
 * stops a category label containing `</script>` from breaking out of the block
 * (labels are admin-authored, but this is a public page — no injection either
 * way).
 */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function renderTicketIntakeHtml(categories: IntakeCategoryView[]): string {
  // The page's inline JS cannot import, so the Spiro parameter contract is
  // embedded as data rather than restated here — one list, both sides.
  const spiroParams = SPIRO_PARAM_MAPPINGS;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>WOW Video Tours — Submit a Request</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  /* Palette, type and shapes taken from wowvideotours.com: Montserrat throughout,
     charcoal ink on a light grey ground, pure-red accent, pill buttons, and the
     uppercase letter-spaced eyebrow the site uses above every section heading. */
  :root {
    --wow:#ff0000; --wow-dark:#d40000; --wow-tint:rgba(255,0,0,0.08);
    --ink:#2c2c2c; --muted:#888888; --border:#dbdbdb; --hairline:#ececec;
    --bg:#f3f3f3; --surface:#ffffff;
    --font:"Montserrat",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin:0; font-family:var(--font); background:var(--bg); color:var(--ink); line-height:1.55; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:660px; margin:0 auto; padding:2rem 1rem 3.5rem; }
  /* Wordmark, set rather than imaged: the page is a self-contained template with
     no asset pipeline, and a hotlinked logo would break the header if it moved. */
  .brand { display:flex; align-items:baseline; gap:0.45rem; margin:0 0 1.5rem; }
  .brand .wow { font-size:1.5rem; font-weight:800; letter-spacing:-0.02em; color:var(--wow); line-height:1; }
  .brand .vt { font-size:0.95rem; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:var(--ink); line-height:1; }
  .card { background:var(--surface); border:1px solid var(--hairline); border-radius:20px; box-shadow:0 2px 14px rgba(0,0,0,0.05); padding:2rem 1.75rem; }
  .eyebrow { color:var(--wow); font-size:0.69rem; font-weight:700; letter-spacing:0.09em; text-transform:uppercase; margin:0 0 0.5rem; }
  h1.title { font-size:1.75rem; font-weight:700; letter-spacing:-0.02em; line-height:1.15; margin:0 0 0.6rem; }
  .lead { color:var(--muted); font-size:0.92rem; font-weight:400; margin:0 0 1.5rem; }
  .ctx { background:#fafafa; border:1px solid var(--hairline); border-left:3px solid var(--wow); border-radius:0 12px 12px 0; padding:0.75rem 1rem; font-size:0.85rem; margin-bottom:1.5rem; color:var(--ink); }
  label { display:block; font-weight:600; font-size:0.78rem; letter-spacing:0.02em; margin:0 0 0.4rem; }
  .field { margin-bottom:1.25rem; }
  input[type=text], input[type=email], input[type=tel], select, textarea {
    /* Block, not inline-block: an inline textarea sits on the text baseline and
       leaves a stray gap between it and the hint underneath. */
    display:block; width:100%; padding:0.7rem 0.85rem; border:1px solid var(--border); border-radius:12px; font:inherit; font-size:0.92rem; background:#fff; color:var(--ink); transition:border-color 0.15s, box-shadow 0.15s;
  }
  input[type=file] { font-size:0.85rem; color:var(--muted); }
  input:focus, select:focus, textarea:focus { outline:none; border-color:var(--wow); box-shadow:0 0 0 3px var(--wow-tint); }
  textarea { resize:vertical; min-height:104px; }
  .row { display:flex; gap:0.75rem; flex-wrap:wrap; }
  .row > .field { flex:1; min-width:180px; }
  .hint { color:var(--muted); font-size:0.76rem; font-weight:400; margin-top:0.35rem; line-height:1.45; }
  /* Pickable choices, optionally with a thumbnail and a price. Sized so a phone
     shows one per row and a laptop shows two or three. */
  .choices { display:grid; grid-template-columns:repeat(auto-fill,minmax(195px,1fr)); gap:0.6rem; }
  .choice { display:flex; flex-wrap:wrap; align-items:center; gap:0.6rem; padding:0.7rem 0.8rem; border:1px solid var(--border); border-radius:14px; background:#fff; transition:border-color 0.15s, box-shadow 0.15s; }
  .choice:hover { border-color:var(--ink); }
  .choice.picked { border-color:var(--wow); box-shadow:0 0 0 2px var(--wow-tint); }
  .choice .pick { display:flex; align-items:center; gap:0.6rem; flex:1 1 100%; margin:0; font-weight:400; letter-spacing:0; cursor:pointer; }
  .choice input[type=checkbox], .choice input[type=radio] { margin:0; flex:none; width:auto; accent-color:var(--wow); }
  .choice img { width:46px; height:46px; object-fit:cover; border-radius:10px; flex:none; background:var(--bg); }
  .choice .cl { font-size:0.87rem; font-weight:500; line-height:1.3; }
  .choice .cp { display:block; color:var(--wow); font-size:0.72rem; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; margin-top:0.15rem; }
  /* Quantity sits under the tick so a long choice label never squeezes it. */
  .choice .qty { flex:1 1 100%; display:flex; align-items:center; gap:0.45rem; padding-top:0.5rem; border-top:1px solid var(--hairline); }
  .choice .qty span { font-size:0.7rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:var(--muted); }
  .choice .qty select { width:auto; padding:0.3rem 1.6rem 0.3rem 0.6rem; border-radius:999px; font-size:0.85rem; }
  /* Per-choice questions get the full width — they are typed into, not scanned. */
  .followups { display:grid; gap:0.7rem; margin-top:0.85rem; }
  .followup-group { border:1px solid var(--hairline); border-left:3px solid var(--wow); border-radius:0 14px 14px 0; padding:0.85rem 1rem; background:#fafafa; }
  .followup-group .fg-title { font-size:0.8rem; font-weight:700; letter-spacing:0.03em; margin:0; }
  .followup { margin-top:0.7rem; }
  .followup label { font-size:0.76rem; font-weight:600; }
  .followup .req { color:var(--wow); }
  .followup textarea { min-height:68px; }
  .choice .cq { display:inline-block; margin-top:0.3rem; font-size:0.62rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--muted); background:var(--bg); border:1px solid var(--border); border-radius:999px; padding:0.12rem 0.45rem; }
  /* The total is a small statement, not one number: what can start today and
     what waits on a quote are different promises and are kept on their own rows. */
  .choice-total { margin-top:0.9rem; padding-top:0.75rem; border-top:1px solid var(--hairline); }
  .choice-total .tot-row { display:flex; justify-content:space-between; gap:1rem; align-items:baseline; padding:0.12rem 0; font-size:0.8rem; font-weight:600; color:var(--muted); }
  .choice-total .tot-row .amt-sm { color:var(--ink); font-weight:700; white-space:nowrap; }
  .choice-total .tot-grand { display:flex; justify-content:space-between; gap:1rem; align-items:baseline; margin-top:0.5rem; padding-top:0.55rem; border-top:1px solid var(--hairline); font-weight:700; font-size:0.88rem; letter-spacing:0.03em; text-transform:uppercase; }
  .choice-total .tot-grand.solo { margin-top:0; padding-top:0; border-top:none; }
  .choice-total .tot-grand .amt { color:var(--wow); font-size:1.25rem; letter-spacing:-0.02em; text-transform:none; white-space:nowrap; }
  .choice-total .tot-note { font-weight:400; font-size:0.72rem; color:var(--muted); margin:0.45rem 0 0; line-height:1.45; }
  .btn { background:var(--wow); color:#fff; border:none; border-radius:999px; padding:0.9rem 1.5rem; font-family:inherit; font-weight:700; font-size:0.8rem; letter-spacing:0.09em; text-transform:uppercase; cursor:pointer; width:100%; transition:background 0.15s; }
  .btn:hover { background:var(--wow-dark); }
  .btn:disabled { opacity:0.5; cursor:default; }
  .error { color:var(--wow-dark); font-size:0.85rem; font-weight:600; margin:0 0 0.75rem; display:none; }
  .hidden { display:none !important; }
  .success { text-align:center; padding:1.5rem 0; }
  .success .check { width:60px; height:60px; border-radius:50%; background:var(--wow); color:#fff; font-size:1.7rem; display:flex; align-items:center; justify-content:center; margin:0 auto 1.25rem; }
  .success .num { font-size:1.6rem; font-weight:800; letter-spacing:0.02em; margin:0.4rem 0; }
  .foot { text-align:center; color:var(--muted); font-size:0.72rem; letter-spacing:0.02em; margin-top:1.5rem; }
  .testbar { background:#fffbeb; border:1px solid #f0dda0; color:#7a5b00; border-radius:12px; padding:0.75rem 1rem; font-size:0.83rem; margin-bottom:1rem; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand"><span class="wow">WOW</span><span class="vt">Video Tours</span></div>
    <div id="test-banner" class="testbar hidden">🧪 <strong>Test mode</strong> — this is a demonstration. The notification goes to <span id="test-dest">the test recipient</span> instead of the real department, and the ticket is tagged as a test.</div>
    <div class="card">
      <div id="intake-form-view">
        <p class="eyebrow">Support &amp; Requests</p>
        <h1 class="title">How can we help?</h1>
        <p class="lead">Need an edit, an extra service, or something looks off with your media? Tell us below and we'll open a ticket for the right team.</p>
        <div id="ctx" class="ctx hidden"></div>
        <div id="err" class="error"></div>
        <form id="intake-form" autocomplete="on">
          <div class="field">
            <label for="f-category">What can we help with?</label>
            <select id="f-category"></select>
          </div>

          <div class="field hidden" id="extra-field">
            <label id="extra-label" for="f-extra-select"></label>
            <select id="f-extra-select" class="hidden"></select>
            <input type="text" id="f-extra-text" class="hidden" />
            <div id="f-extra-choices" class="choices hidden"></div>
            <div id="f-extra-followups" class="followups hidden"></div>
            <div id="choice-total" class="choice-total hidden"></div>
          </div>

          <div class="field">
            <label for="f-details" id="details-label">Details</label>
            <textarea id="f-details" placeholder="Tell us what you need…"></textarea>
            <div class="hint" id="details-hint">The more specific, the faster we can turn it around.</div>
          </div>

          <div class="field">
            <label for="f-files">Attach a photo or screenshot (optional)</label>
            <input type="file" id="f-files" multiple accept="image/jpeg,image/png,image/gif,image/webp,image/heic,application/pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.pdf" />
            <div class="hint" id="files-hint">Up to 5 files, 6 MB each — JPG, PNG, GIF, WEBP, HEIC or PDF. A screenshot of the shot you mean is the fastest way to show us.</div>
            <div id="file-list" class="hint"></div>
          </div>

          <div class="row">
            <div class="field"><label for="f-name">Your name</label><input type="text" id="f-name" autocomplete="name" /></div>
            <div class="field"><label for="f-email">Email</label><input type="email" id="f-email" autocomplete="email" /></div>
          </div>
          <div class="field"><label for="f-phone">Phone (optional)</label><input type="tel" id="f-phone" autocomplete="tel" /></div>

          <button type="submit" class="btn" id="submit-btn">Submit request</button>
        </form>
      </div>

      <div id="intake-empty-view" class="hidden" style="text-align:center;padding:1rem 0;color:var(--muted)">
        <p style="margin:0">This form is being updated. Please email us and we'll take care of it.</p>
      </div>

      <div id="intake-success-view" class="success hidden">
        <div class="check">✓</div>
        <p class="eyebrow" style="margin-bottom:0.35rem">Request received</p>
        <p class="num" id="success-num">WVT-0000</p>
        <p style="margin:0.25rem auto 0;max-width:26rem;color:var(--muted);font-size:0.88rem">The right team has been notified and will follow up by email. Please keep this number for reference.</p>
        <p style="margin-top:1.5rem"><a href="#" id="another-link" style="color:var(--wow);font-weight:700;font-size:0.75rem;letter-spacing:0.09em;text-transform:uppercase;text-decoration:none">Submit another request</a></p>
      </div>
    </div>
    <div class="foot">WOW Video Tours · This form is for existing orders and media deliveries.</div>
  </div>

<script id="intake-config" type="application/json">${embedJson({ categories, spiroParams })}</script>
<script>
(function(){
  'use strict';
  var config = {};
  try { config = JSON.parse(document.getElementById('intake-config').textContent || '{}'); } catch (e) { config = {}; }
  var cats = Array.isArray(config.categories) ? config.categories : [];

  // Read the query string case-insensitively: the Spiro button and the older
  // hand-built links do not agree on casing, and a link is not worth losing
  // over a capital letter.
  var rawParams = new URLSearchParams(location.search);
  var lowered = {};
  rawParams.forEach(function(value, key){ lowered[key.toLowerCase()] = value; });
  function param(name){
    var v = lowered[String(name).toLowerCase()];
    return (v == null ? '' : String(v)).trim();
  }

  // The Spiro handoff, keyed by the payload field each parameter feeds.
  var spiro = {};
  (Array.isArray(config.spiroParams) ? config.spiroParams : []).forEach(function(m){
    var v = param(m.param);
    if (v) spiro[m.field] = v;
  });

  var orderId = param('orderId') || param('order') || '';
  var address = spiro.orderAddress || param('address') || param('listing') || '';
  var agentName = [spiro.agentFirstName, spiro.agentLastName].filter(Boolean).join(' ');

  // Prefill what the link already told us, leaving every field editable: the
  // person at the keyboard may be correcting exactly this.
  function prefill(id, value){
    if (!value) return;
    var el = document.getElementById(id);
    if (el && !el.value) el.value = value;
  }
  prefill('f-name', agentName);
  prefill('f-email', spiro.requesterEmail);
  prefill('f-phone', spiro.requesterPhone);

  // Test mode is driven entirely by a signed token an admin adds to the URL
  // (?test=<token>). testEmail is display-only; the authoritative recipient is
  // baked into the token and checked server-side.
  var testToken = param('test');
  var testEmail = param('testEmail');
  if (testToken) {
    if (testEmail) document.getElementById('test-dest').textContent = testEmail;
    document.getElementById('test-banner').classList.remove('hidden');
  }

  var ctx = document.getElementById('ctx');
  var ctxParts = [];
  if (address) ctxParts.push(address);
  if (!address && orderId) ctxParts.push('Order ' + orderId);
  // Confirms we already know which shoot they mean, so nobody re-types it.
  var shot = [];
  if (spiro.shootDate) shot.push('Shot ' + spiro.shootDate);
  if (spiro.photographerName) shot.push((shot.length ? 'by ' : 'Photographer ') + spiro.photographerName);
  if (shot.length) ctxParts.push(shot.join(' '));
  if (ctxParts.length) {
    ctx.textContent = 'This request will be linked to: ' + ctxParts.join(' · ');
    ctx.classList.remove('hidden');
  }

  var catEl = document.getElementById('f-category');
  var extraWrap = document.getElementById('extra-field');
  var extraLabel = document.getElementById('extra-label');
  var extraSelect = document.getElementById('f-extra-select');
  var extraText = document.getElementById('f-extra-text');

  // No active categories: nothing sensible to ask, so don't show a broken form.
  if (!cats.length) {
    document.getElementById('intake-form-view').classList.add('hidden');
    document.getElementById('intake-empty-view').classList.remove('hidden');
    return;
  }

  cats.forEach(function(c){
    var o = document.createElement('option');
    o.value = c.key;
    o.textContent = c.label;
    catEl.appendChild(o);
  });

  function currentCat() {
    var key = catEl.value;
    for (var i = 0; i < cats.length; i++) { if (cats[i].key === key) return cats[i]; }
    return null;
  }

  var choicesEl = document.getElementById('f-extra-choices');
  var followupsEl = document.getElementById('f-extra-followups');
  var totalEl = document.getElementById('choice-total');

  // Answers live here, keyed "<option index>::<question id>", not in the DOM:
  // the panels are rebuilt whenever a tick changes, and a client who unticks a
  // choice by accident should get their typing back when they re-tick it.
  var answers = {};
  function answerKey(idx, id){ return idx + '::' + id; }

  function money(cents){
    var d = cents / 100;
    return '$' + (d === Math.floor(d) ? String(d) : d.toFixed(2));
  }
  function optionAt(idx){
    var c = currentCat();
    var list = (c && c.extraOptions) || [];
    return list[idx] || null;
  }
  function hasQuantity(opt){ return !!opt && Number(opt.maxQuantity) > 1; }
  // "$50 per image" when the admin worded the unit, "$50 each" when the client
  // can order several, plain "$50" for a one-off, "$25–$75 per image" when the
  // job has to be sized. Mirrors formatUnitPrice on the server so the form and
  // the ticket read the same.
  function unitPrice(opt){
    var price = hasRange(opt)
      ? money(opt.priceCents) + '–' + money(opt.priceMaxCents)
      : money(opt.priceCents);
    if (opt.unitLabel) return price + ' ' + opt.unitLabel;
    return hasQuantity(opt) ? price + ' each' : price;
  }
  function hasPrice(opt){ return !!opt && opt.priceCents !== null && opt.priceCents !== undefined; }
  function hasRange(opt){
    return !!opt && opt.priceMaxCents !== null && opt.priceMaxCents !== undefined;
  }
  function needsQuote(opt){ return !!opt && opt.quoteRequired === true; }
  function followUpsOf(opt){ return (opt && opt.followUps) || []; }

  /** Every ticked choice, in form order, with its quantity and answers. */
  function pickedSelections(){
    var out = [];
    choicesEl.querySelectorAll('.choice-input:checked').forEach(function(input){
      var idx = parseInt(input.getAttribute('data-index'), 10);
      var opt = optionAt(idx);
      if (!opt) return;
      var qtyEl = choicesEl.querySelector('.qty-select[data-index="' + idx + '"]');
      var quantity = qtyEl ? parseInt(qtyEl.value, 10) || 1 : 1;
      var given = [];
      followUpsOf(opt).forEach(function(f){
        var value = (answers[answerKey(idx, f.id)] || '').trim();
        if (value) given.push({ id: f.id, value: value });
      });
      out.push({ index: idx, label: opt.label, quantity: quantity, answers: given, option: opt });
    });
    return out;
  }
  /**
   * Split the picks into what we can start on and what we have to price first.
   * Mirrors summarizeEstimate on the server — this is only the client's running
   * preview, and the server recomputes every figure from its own list, so a
   * stale page can never quote a number we honour.
   */
  function estimate(){
    var firm = 0, quotedLow = 0, quotedHigh = 0, unquoted = 0, quote = false, priced = false;
    pickedSelections().forEach(function(s){
      var opt = s.option;
      if (needsQuote(opt)) quote = true;
      if (!hasPrice(opt)) {
        if (needsQuote(opt)) unquoted++;
        return;
      }
      priced = true;
      var low = opt.priceCents * s.quantity;
      if (needsQuote(opt)) {
        quotedLow += low;
        quotedHigh += (hasRange(opt) ? opt.priceMaxCents : opt.priceCents) * s.quantity;
      } else {
        firm += low;
      }
    });
    return {
      firm: firm, quotedLow: quotedLow, quotedHigh: quotedHigh,
      unquoted: unquoted, quote: quote, empty: !priced && unquoted === 0
    };
  }
  function span(low, high){
    return low === high ? money(low) : money(low) + '–' + money(high);
  }
  function row(label, amount){
    return '<div class="tot-row"><span>' + label + '</span>' +
      '<span class="amt-sm">' + amount + '</span></div>';
  }
  function renderTotal(){
    var e = estimate();
    if (e.empty) { totalEl.classList.add('hidden'); totalEl.textContent = ''; return; }
    totalEl.classList.remove('hidden');
    // Nothing needs quoting: one firm number, exactly as before.
    if (!e.quote) {
      totalEl.innerHTML =
        '<div class="tot-grand solo"><span>Estimated total</span>' +
        '<span class="amt">' + money(e.firm) + '</span></div>';
      return;
    }
    // The two halves are kept apart because they mean different things: one is
    // work we can start today, the other waits on a number the client accepts.
    var quoted = e.quotedHigh === 0
      ? 'To be quoted'
      : span(e.quotedLow, e.quotedHigh) + (e.unquoted > 0 ? ' +' : '');
    var html = '';
    if (e.firm > 0) html += row('Starts right away', money(e.firm));
    html += row('Quoted before we start', quoted);
    html += '<div class="tot-grand"><span>Estimated total</span><span class="amt">' +
      span(e.firm + e.quotedLow, e.firm + e.quotedHigh) + (e.unquoted > 0 ? ' +' : '') +
      '</span></div>';
    html += '<p class="tot-note">We\\'ll email a quote for the items that need one. ' +
      'Nothing is charged until you approve it.</p>';
    totalEl.innerHTML = html;
  }
  /** One question's control, wired to write straight into the answers map. */
  function renderFollowUp(idx, f){
    var wrap = document.createElement('div');
    wrap.className = 'followup';
    var id = 'fu-' + idx + '-' + f.id;
    var label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = f.label;
    if (f.required) {
      var star = document.createElement('span');
      star.className = 'req';
      star.textContent = ' *';
      label.appendChild(star);
    }
    wrap.appendChild(label);
    var key = answerKey(idx, f.id);
    var current = answers[key] || '';
    var control;
    if (f.kind === 'select') {
      control = document.createElement('select');
      var blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Select…';
      control.appendChild(blank);
      (f.choices || []).forEach(function(choice){
        var o = document.createElement('option');
        o.value = choice;
        o.textContent = choice;
        control.appendChild(o);
      });
    } else if (f.kind === 'textarea') {
      control = document.createElement('textarea');
      control.placeholder = f.placeholder || '';
    } else {
      control = document.createElement('input');
      control.type = 'text';
      control.placeholder = f.placeholder || '';
    }
    control.id = id;
    control.value = current;
    control.setAttribute('data-answer-key', key);
    control.addEventListener('input', function(){ answers[key] = control.value; });
    control.addEventListener('change', function(){ answers[key] = control.value; });
    wrap.appendChild(control);
    return wrap;
  }
  /** Rebuild the question panels for whatever is ticked right now. */
  function renderFollowUps(){
    while (followupsEl.firstChild) followupsEl.removeChild(followupsEl.firstChild);
    var shown = 0;
    pickedSelections().forEach(function(s){
      var list = followUpsOf(s.option);
      if (!list.length) return;
      shown++;
      var group = document.createElement('div');
      group.className = 'followup-group';
      var title = document.createElement('p');
      title.className = 'fg-title';
      title.textContent = s.quantity > 1 ? s.label + ' × ' + s.quantity : s.label;
      group.appendChild(title);
      list.forEach(function(f){ group.appendChild(renderFollowUp(s.index, f)); });
      followupsEl.appendChild(group);
    });
    followupsEl.classList.toggle('hidden', shown === 0);
  }
  /** Re-run everything a tick or a quantity change affects. */
  function syncChoiceState(){
    choicesEl.querySelectorAll('.choice').forEach(function(el){
      var input = el.querySelector('.choice-input');
      var picked = !!(input && input.checked);
      el.classList.toggle('picked', picked);
      var qty = el.querySelector('.qty');
      if (qty) qty.classList.toggle('hidden', !picked);
    });
    renderFollowUps();
    renderTotal();
  }
  /** Build the checkbox/radio grid for a select or multiselect question. */
  function renderChoices(c, multiple){
    while (choicesEl.firstChild) choicesEl.removeChild(choicesEl.firstChild);
    (c.extraOptions || []).forEach(function(opt, idx){
      var card = document.createElement('div');
      card.className = 'choice';
      // The tick, its thumbnail and its price are one label so the whole row is
      // clickable; the quantity control stays outside it or picking a number
      // would toggle the choice off.
      var pick = document.createElement('label');
      pick.className = 'pick';
      var input = document.createElement('input');
      input.type = multiple ? 'checkbox' : 'radio';
      input.name = 'extra-choice';
      input.className = 'choice-input';
      input.value = opt.label;
      input.setAttribute('data-index', String(idx));
      if (opt.priceCents !== null && opt.priceCents !== undefined) {
        input.setAttribute('data-price', String(opt.priceCents));
      }
      input.addEventListener('change', syncChoiceState);
      pick.appendChild(input);
      if (opt.imageUrl) {
        var img = document.createElement('img');
        // Set via property, not markup, so a URL can never inject attributes.
        img.src = opt.imageUrl;
        img.alt = '';
        img.loading = 'lazy';
        // A broken link should not leave a torn box on a customer page.
        img.addEventListener('error', function(){ img.remove(); });
        pick.appendChild(img);
      }
      var text = document.createElement('span');
      text.className = 'cl';
      text.textContent = opt.label;
      if (hasPrice(opt)) {
        var price = document.createElement('span');
        price.className = 'cp';
        price.textContent = unitPrice(opt);
        text.appendChild(price);
      }
      // Says up front that ticking this will not start work — a client should
      // learn that here, not after they submit.
      if (needsQuote(opt)) {
        var flag = document.createElement('span');
        flag.className = 'cq';
        flag.textContent = hasPrice(opt) ? 'Quoted first' : 'Priced on request';
        text.appendChild(flag);
      }
      pick.appendChild(text);
      card.appendChild(pick);
      if (hasQuantity(opt)) {
        var qty = document.createElement('div');
        qty.className = 'qty hidden';
        var qtyLabel = document.createElement('span');
        qtyLabel.textContent = 'How many?';
        var select = document.createElement('select');
        select.className = 'qty-select';
        select.setAttribute('data-index', String(idx));
        select.id = 'qty-' + idx;
        for (var n = 1; n <= Number(opt.maxQuantity); n++) {
          var o = document.createElement('option');
          o.value = String(n);
          o.textContent = String(n);
          select.appendChild(o);
        }
        select.addEventListener('change', syncChoiceState);
        qtyLabel.setAttribute('id', 'qty-label-' + idx);
        select.setAttribute('aria-labelledby', 'qty-label-' + idx);
        qty.appendChild(qtyLabel);
        qty.appendChild(select);
        card.appendChild(qty);
      }
      choicesEl.appendChild(card);
    });
    syncChoiceState();
  }

  function syncBranches() {
    var c = currentCat();
    if (!c) return;
    var kind = c.extraField || 'none';
    // Answers belong to the request type that asked; switching type drops them.
    answers = {};
    extraSelect.classList.add('hidden');
    extraText.classList.add('hidden');
    choicesEl.classList.add('hidden');
    followupsEl.classList.add('hidden');
    while (followupsEl.firstChild) followupsEl.removeChild(followupsEl.firstChild);
    totalEl.classList.add('hidden');
    if (kind === 'none') {
      extraWrap.classList.add('hidden');
    } else {
      extraWrap.classList.remove('hidden');
      extraLabel.textContent = c.extraLabel || '';
      if (kind === 'select' || kind === 'multiselect') {
        // A plain unpriced, image-less list stays the familiar dropdown; the
        // richer grid appears only when there is something to show in it — or
        // when a choice carries a quantity or its own questions, which a bare
        // <select> has nowhere to put.
        var rich = (c.extraOptions || []).some(function(o){
          return o.imageUrl || hasPrice(o) || needsQuote(o) ||
            hasQuantity(o) || followUpsOf(o).length > 0;
        });
        if (kind === 'multiselect' || rich) {
          choicesEl.classList.remove('hidden');
          extraLabel.removeAttribute('for');
          renderChoices(c, kind === 'multiselect');
        } else {
          extraSelect.classList.remove('hidden');
          extraLabel.setAttribute('for', 'f-extra-select');
          while (extraSelect.firstChild) extraSelect.removeChild(extraSelect.firstChild);
          var blank = document.createElement('option');
          blank.value = '';
          blank.textContent = 'Select…';
          extraSelect.appendChild(blank);
          (c.extraOptions || []).forEach(function(opt){
            var o = document.createElement('option');
            o.value = opt.label;
            o.textContent = opt.label;
            extraSelect.appendChild(o);
          });
        }
      } else {
        extraText.classList.remove('hidden');
        extraLabel.setAttribute('for', 'f-extra-text');
        extraText.placeholder = c.extraPlaceholder || '';
        extraText.value = '';
      }
    }
    document.getElementById('details-label').textContent = c.detailsLabel || 'Details';
    document.getElementById('details-hint').textContent = c.detailsHint || '';
  }
  catEl.addEventListener('change', syncBranches);
  syncBranches();

  var err = document.getElementById('err');
  function showErr(msg){ err.textContent = msg; err.style.display = 'block'; }
  function clearErr(){ err.style.display = 'none'; }

  // Attachments. These limits mirror the server's so the client gets an instant,
  // specific message instead of uploading megabytes only to be refused. The
  // server re-checks everything — this is courtesy, not enforcement.
  var MAX_FILES = 5;
  var MAX_FILE_BYTES = 6 * 1024 * 1024;
  var MAX_TOTAL_BYTES = 15 * 1024 * 1024;
  var filesEl = document.getElementById('f-files');
  var fileListEl = document.getElementById('file-list');

  function prettySize(n){
    if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.max(1, Math.round(n / 1024)) + ' KB';
  }
  function selectedFiles(){
    return filesEl && filesEl.files ? Array.prototype.slice.call(filesEl.files) : [];
  }
  /** Null when the selection is fine, otherwise the message to show. */
  function fileSelectionError(list){
    if (list.length > MAX_FILES) return 'Please attach at most ' + MAX_FILES + ' files.';
    var total = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].size > MAX_FILE_BYTES) return '"' + list[i].name + '" is larger than 6 MB.';
      total += list[i].size;
    }
    if (total > MAX_TOTAL_BYTES) return 'Your attachments add up to more than 15 MB in total.';
    return null;
  }
  function renderFileList(){
    if (!fileListEl) return;
    var list = selectedFiles();
    if (!list.length) { fileListEl.textContent = ''; return; }
    var names = list.map(function(f){ return f.name + ' (' + prettySize(f.size) + ')'; });
    fileListEl.textContent = names.join(', ');
  }
  if (filesEl) {
    filesEl.addEventListener('change', function(){
      clearErr();
      renderFileList();
      var problem = fileSelectionError(selectedFiles());
      if (problem) showErr(problem);
    });
  }
  /** Read one File into base64, without the data: prefix. */
  function readFileBase64(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){
        var out = String(reader.result || '');
        var comma = out.indexOf(',');
        resolve({ filename: file.name, dataBase64: comma === -1 ? out : out.slice(comma + 1) });
      };
      reader.onerror = function(){ reject(new Error('read failed')); };
      reader.readAsDataURL(file);
    });
  }

  document.getElementById('intake-form').addEventListener('submit', async function(e){
    e.preventDefault();
    clearErr();
    var c = currentCat();
    var extraValue = null;
    var extraValues = null;
    var extraSelections = null;
    var kindNow = c ? (c.extraField || 'none') : 'none';
    if (kindNow === 'select' || kindNow === 'multiselect') {
      // Whichever control is on screen for this category.
      if (choicesEl.classList.contains('hidden')) {
        extraValues = extraSelect.value ? [extraSelect.value] : [];
        extraSelections = extraValues.map(function(label){
          return { label: label, quantity: 1, answers: [] };
        });
      } else {
        var picks = pickedSelections();
        // A question we asked and they skipped: point at the field rather than
        // filing a job the desk cannot start.
        for (var i = 0; i < picks.length; i++) {
          var pick = picks[i];
          var missing = null;
          followUpsOf(pick.option).forEach(function(f){
            if (!missing && f.required && !pick.answers.some(function(a){ return a.id === f.id; })) missing = f;
          });
          if (missing) {
            showErr('Please answer "' + missing.label + '" for ' + pick.label + '.');
            var el = followupsEl.querySelector('[data-answer-key="' + answerKey(pick.index, missing.id) + '"]');
            if (el) el.focus();
            return;
          }
        }
        extraValues = picks.map(function(s){ return s.label; });
        extraSelections = picks.map(function(s){
          return { label: s.label, quantity: s.quantity, answers: s.answers };
        });
      }
      extraValue = extraValues.length ? extraValues.join(', ') : null;
    } else if (kindNow === 'text') {
      extraValue = extraText.value.trim() || null;
    }

    // The Spiro context rides along as-sent; the server derives the order id
    // from the PWE link rather than trusting one parsed here.
    var payload = {
      category: catEl.value,
      extraValue: extraValue,
      extraValues: extraValues,
      extraSelections: extraSelections,
      details: document.getElementById('f-details').value.trim(),
      requesterName: document.getElementById('f-name').value.trim(),
      requesterEmail: document.getElementById('f-email').value.trim(),
      requesterPhone: document.getElementById('f-phone').value.trim() || null,
      orderId: orderId || null,
      orderAddress: address || null,
      orderLink: spiro.orderLink || null,
      agentTitle: spiro.agentTitle || null,
      agentCompany: spiro.agentCompany || null,
      submittedBy: spiro.submittedBy || null,
      photographerName: spiro.photographerName || null,
      shootDate: spiro.shootDate || null,
      testToken: testToken || null
    };
    if (!payload.requesterName) { showErr('Please enter your name.'); return; }
    if (!payload.requesterEmail || payload.requesterEmail.indexOf('@') === -1) { showErr('Please enter a valid email so the team can reach you.'); return; }
    if (!payload.details) { showErr('Please add a few details about your request.'); return; }

    var chosen = selectedFiles();
    var fileProblem = fileSelectionError(chosen);
    if (fileProblem) { showErr(fileProblem); return; }

    var btn = document.getElementById('submit-btn');
    btn.disabled = true; btn.textContent = 'Submitting…';
    var res, data;
    try {
      if (chosen.length) {
        btn.textContent = 'Uploading…';
        payload.files = await Promise.all(chosen.map(readFileBase64));
      }
      res = await fetch('/api/support/intake', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      data = await res.json().catch(function(){ return {}; });
    } catch (e2) {
      btn.disabled = false; btn.textContent = 'Submit request';
      showErr('Could not reach the server. Please try again.');
      return;
    }
    btn.disabled = false; btn.textContent = 'Submit request';
    if (!res.ok || !data.ok) { showErr((data && data.error) || 'Something went wrong. Please try again.'); return; }
    document.getElementById('success-num').textContent = data.number || 'Received';
    document.getElementById('intake-form-view').classList.add('hidden');
    document.getElementById('intake-success-view').classList.remove('hidden');
    window.scrollTo(0,0);
  });

  document.getElementById('another-link').addEventListener('click', function(e){
    e.preventDefault();
    document.getElementById('intake-form').reset();
    renderFileList();
    syncBranches();
    document.getElementById('intake-success-view').classList.add('hidden');
    document.getElementById('intake-form-view').classList.remove('hidden');
  });
})();
</script>
</body>
</html>`;
}
