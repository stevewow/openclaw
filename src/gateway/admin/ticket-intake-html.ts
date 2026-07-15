// White-label public intake form served at /support. The Spiro media-delivery
// page's "Submit Ticket or Request" button links here with ?orderId= (and an
// optional ?address=). No platform references — this is a customer surface. The
// form branches by request type, then POSTs to /api/support/intake, which opens
// a ticket in the dashboard. Inline JS uses string concatenation only (no
// template literals) so the outer TS template string stays intact.
export const TICKET_INTAKE_HTML = `<!doctype html>
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
            <select id="f-category">
              <option value="edit_request">Request an edit to my media</option>
              <option value="additional_service">Order an additional service</option>
              <option value="missing_media">Report missing or incorrect media</option>
              <option value="other">Something else</option>
            </select>
          </div>

          <div class="field branch" data-for="edit_request missing_media">
            <label for="f-media">Which media?</label>
            <select id="f-media">
              <option value="">Select…</option>
              <option>Photos</option>
              <option>Video / Walkthrough</option>
              <option>Aerial / Drone</option>
              <option>Floor plan</option>
              <option>Virtual tour / Matterport</option>
              <option>Twilight</option>
              <option>Other</option>
            </select>
          </div>

          <div class="field branch" data-for="additional_service">
            <label for="f-service">Which service would you like to add?</label>
            <input type="text" id="f-service" placeholder="e.g. Virtual staging, extra aerials, twilight edit…" />
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

<script>
(function(){
  'use strict';
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
  var branches = Array.prototype.slice.call(document.querySelectorAll('.branch'));
  function syncBranches() {
    var cat = catEl.value;
    branches.forEach(function(b){
      var applies = b.getAttribute('data-for').split(' ').indexOf(cat) !== -1;
      b.classList.toggle('hidden', !applies);
    });
    var label = document.getElementById('details-label');
    var hint = document.getElementById('details-hint');
    if (cat === 'edit_request') { label.textContent = 'What change would you like?'; hint.textContent = 'Describe the edit — which photo/clip, and what to change.'; }
    else if (cat === 'missing_media') { label.textContent = "What's missing or wrong?"; hint.textContent = 'Tell us which shots or rooms are missing or incorrect.'; }
    else if (cat === 'additional_service') { label.textContent = 'Details'; hint.textContent = 'Any timing needs or specifics for the team.'; }
    else { label.textContent = 'How can we help?'; hint.textContent = 'Describe your request.'; }
  }
  catEl.addEventListener('change', syncBranches);
  syncBranches();

  var err = document.getElementById('err');
  function showErr(msg){ err.textContent = msg; err.style.display = 'block'; }
  function clearErr(){ err.style.display = 'none'; }

  document.getElementById('intake-form').addEventListener('submit', async function(e){
    e.preventDefault();
    clearErr();
    var cat = catEl.value;
    var payload = {
      category: cat,
      mediaType: document.getElementById('f-media').value || null,
      serviceType: document.getElementById('f-service').value.trim() || null,
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
