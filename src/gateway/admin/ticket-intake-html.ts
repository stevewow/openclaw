// White-label public intake form served at /support. The Spiro media-delivery
// page's "Submit Ticket or Request" button links here with ?orderId= (and an
// optional ?address=). No platform references — this is a customer surface.
//
// Request types, their follow-up question, and their details copy are all
// admin-managed (admin_ticket_categories) and injected as JSON, so adding a
// category in the dashboard changes this form with no redeploy. Inline JS uses
// string concatenation only (no template literals) so the outer TS template
// string stays intact.

/** The per-category form config handed to the page. */
export type IntakeCategoryView = {
  key: string;
  label: string;
  extraField: "none" | "select" | "text";
  extraLabel: string | null;
  extraOptions: string[];
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
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>WOW Video Tours — Submit a Request</title>
<style>
  :root { --wow:#E11B22; --wow-dark:#b3151b; --ink:#1a1a1a; --muted:#6b7280; --border:#e5e7eb; --bg:#f6f7f9; --surface:#ffffff; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:var(--bg); color:var(--ink); line-height:1.5; }
  .wrap { max-width:640px; margin:0 auto; padding:1.5rem 1rem 3rem; }
  .brand { display:flex; align-items:center; gap:0.6rem; margin:0.5rem 0 1.25rem; }
  .brand .dot { width:14px; height:14px; border-radius:50%; background:var(--wow); }
  .brand h1 { font-size:1.15rem; margin:0; font-weight:800; letter-spacing:-0.01em; }
  .card { background:var(--surface); border:1px solid var(--border); border-radius:14px; box-shadow:0 1px 3px rgba(0,0,0,0.06); padding:1.5rem; }
  .lead { color:var(--muted); font-size:0.95rem; margin:0 0 1.25rem; }
  .ctx { background:#fff5f5; border:1px solid #f6d5d7; border-radius:10px; padding:0.7rem 0.9rem; font-size:0.85rem; margin-bottom:1.25rem; color:#7a1a1e; }
  label { display:block; font-weight:600; font-size:0.85rem; margin:0 0 0.35rem; }
  .field { margin-bottom:1.1rem; }
  input[type=text], input[type=email], input[type=tel], select, textarea {
    width:100%; padding:0.6rem 0.7rem; border:1px solid var(--border); border-radius:9px; font:inherit; background:#fff; color:var(--ink);
  }
  input:focus, select:focus, textarea:focus { outline:none; border-color:var(--wow); box-shadow:0 0 0 3px rgba(225,27,34,0.12); }
  textarea { resize:vertical; min-height:96px; }
  .row { display:flex; gap:0.75rem; flex-wrap:wrap; }
  .row > .field { flex:1; min-width:180px; }
  .hint { color:var(--muted); font-size:0.78rem; margin-top:0.3rem; }
  .btn { background:var(--wow); color:#fff; border:none; border-radius:10px; padding:0.75rem 1.25rem; font-weight:700; font-size:0.95rem; cursor:pointer; width:100%; }
  .btn:hover { background:var(--wow-dark); }
  .btn:disabled { opacity:0.6; cursor:default; }
  .error { color:var(--wow-dark); font-size:0.85rem; margin:0 0 0.75rem; display:none; }
  .hidden { display:none !important; }
  .success { text-align:center; padding:1rem 0; }
  .success .check { width:56px; height:56px; border-radius:50%; background:#e8f7ee; color:#16a34a; font-size:1.8rem; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; }
  .success .num { font-size:1.4rem; font-weight:800; letter-spacing:-0.01em; margin:0.25rem 0; }
  .foot { text-align:center; color:var(--muted); font-size:0.75rem; margin-top:1.25rem; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand"><span class="dot"></span><h1>WOW Video Tours — Support</h1></div>
    <div class="card">
      <div id="intake-form-view">
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
          </div>

          <div class="field">
            <label for="f-details" id="details-label">Details</label>
            <textarea id="f-details" placeholder="Tell us what you need…"></textarea>
            <div class="hint" id="details-hint">The more specific, the faster we can turn it around.</div>
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
        <p style="margin:0;color:var(--muted)">Your request has been received.</p>
        <p class="num" id="success-num">WVT-0000</p>
        <p style="margin:0.25rem 0 0;color:var(--muted);font-size:0.9rem">The right team has been notified and will follow up by email. Please keep this number for reference.</p>
        <p style="margin-top:1.25rem"><a href="#" id="another-link" style="color:var(--wow);font-weight:600;text-decoration:none">Submit another request</a></p>
      </div>
    </div>
    <div class="foot">WOW Video Tours · This form is for existing orders and media deliveries.</div>
  </div>

<script id="intake-config" type="application/json">${embedJson({ categories })}</script>
<script>
(function(){
  'use strict';
  var config = {};
  try { config = JSON.parse(document.getElementById('intake-config').textContent || '{}'); } catch (e) { config = {}; }
  var cats = Array.isArray(config.categories) ? config.categories : [];

  var params = new URLSearchParams(location.search);
  var orderId = (params.get('orderId') || params.get('order') || '').trim();
  var address = (params.get('address') || params.get('listing') || '').trim();

  var ctx = document.getElementById('ctx');
  if (orderId || address) {
    var parts = [];
    if (address) parts.push(address);
    if (orderId) parts.push('Order ' + orderId);
    ctx.textContent = 'This request will be linked to: ' + parts.join(' · ');
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

  function syncBranches() {
    var c = currentCat();
    if (!c) return;
    var kind = c.extraField || 'none';
    if (kind === 'none') {
      extraWrap.classList.add('hidden');
      extraSelect.classList.add('hidden');
      extraText.classList.add('hidden');
    } else {
      extraWrap.classList.remove('hidden');
      extraLabel.textContent = c.extraLabel || '';
      if (kind === 'select') {
        extraText.classList.add('hidden');
        extraSelect.classList.remove('hidden');
        extraLabel.setAttribute('for', 'f-extra-select');
        while (extraSelect.firstChild) extraSelect.removeChild(extraSelect.firstChild);
        var blank = document.createElement('option');
        blank.value = '';
        blank.textContent = 'Select…';
        extraSelect.appendChild(blank);
        (c.extraOptions || []).forEach(function(opt){
          var o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          extraSelect.appendChild(o);
        });
      } else {
        extraSelect.classList.add('hidden');
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

  document.getElementById('intake-form').addEventListener('submit', async function(e){
    e.preventDefault();
    clearErr();
    var c = currentCat();
    var extraValue = null;
    if (c && c.extraField === 'select') extraValue = extraSelect.value || null;
    else if (c && c.extraField === 'text') extraValue = extraText.value.trim() || null;

    var payload = {
      category: catEl.value,
      extraValue: extraValue,
      details: document.getElementById('f-details').value.trim(),
      requesterName: document.getElementById('f-name').value.trim(),
      requesterEmail: document.getElementById('f-email').value.trim(),
      requesterPhone: document.getElementById('f-phone').value.trim() || null,
      orderId: orderId || null,
      orderAddress: address || null
    };
    if (!payload.requesterName) { showErr('Please enter your name.'); return; }
    if (!payload.requesterEmail || payload.requesterEmail.indexOf('@') === -1) { showErr('Please enter a valid email so the team can reach you.'); return; }
    if (!payload.details) { showErr('Please add a few details about your request.'); return; }

    var btn = document.getElementById('submit-btn');
    btn.disabled = true; btn.textContent = 'Submitting…';
    var res, data;
    try {
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
    syncBranches();
    document.getElementById('intake-success-view').classList.add('hidden');
    document.getElementById('intake-form-view').classList.remove('hidden');
  });
})();
</script>
</body>
</html>`;
}
