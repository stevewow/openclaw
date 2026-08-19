// The public team-feedback form, served at /feedback.
//
// Styled from the shared public shell so it is the ticket intake form's twin:
// same palette, type, card and breakpoint. The form-control rules below are
// the intake page's own, repeated here rather than imported because the shell
// deliberately holds only the chrome both pages share — see ticket-public-shell.ts.
//
// The field list mirrors the ClickUp form this replaces; feedback-store.ts owns
// the option lists so the page and the validator can never disagree.

import {
  APPOINTMENT_CATEGORY,
  FEEDBACK_CATEGORIES,
  FEEDBACK_SERVICES,
  FEEDBACK_SOURCES,
  FEEDBACK_SUBMITTERS,
} from "./feedback-store.js";
import {
  ACCEPTED_FILE_LABEL,
  MAX_INTAKE_FILE_BYTES,
  MAX_INTAKE_FILES,
} from "./ticket-attachment-intake.js";
import { BRAND_HEADER_HTML, PUBLIC_HEAD_TAGS, PUBLIC_SHELL_CSS } from "./ticket-public-shell.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Checkbox rows for a multi-select field. */
function checkList(name: string, options: readonly string[]): string {
  return options
    .map(
      (o, i) =>
        `<label class="opt"><input type="checkbox" name="${name}" id="${name}-${i}" value="${esc(o)}" /> <span>${esc(o)}</span></label>`,
    )
    .join("\n        ");
}

const FORM_CSS = `
  label, .fieldlabel { display:block; font-weight:600; font-size:0.78rem; letter-spacing:0.02em; margin:0 0 0.4rem; }
  .field { margin-bottom:1.25rem; }
  input[type=text], input[type=url], input[type=datetime-local], select, textarea {
    width:100%; padding:0.7rem 0.85rem; border:1px solid var(--border); border-radius:10px;
    font-family:var(--font); font-size:1rem; background:var(--surface); color:var(--ink);
    -webkit-appearance:none; appearance:none;
  }
  select { background-image:url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20fill%3D%22%23888%22%20d%3D%22M1%201l5%205%205-5%22%2F%3E%3C%2Fsvg%3E");
    background-repeat:no-repeat; background-position:right 0.85rem center; background-size:12px; padding-right:2.2rem; }
  input[type=file] { font-size:0.85rem; color:var(--muted); max-width:100%; }
  input:focus, select:focus, textarea:focus { outline:none; border-color:var(--wow); box-shadow:0 0 0 3px var(--wow-tint); }
  textarea { resize:vertical; min-height:140px; }
  .hint { color:var(--muted); font-size:0.76rem; font-weight:400; margin-top:0.35rem; line-height:1.45; }
  .req { color:var(--wow); }
  /* Real checkboxes, so keyboard and screen-reader behaviour stays native. */
  .opts { display:grid; gap:0.5rem; }
  .opt { display:flex; align-items:flex-start; gap:0.6rem; font-weight:400; font-size:0.9rem;
    border:1px solid var(--border); border-radius:10px; padding:0.65rem 0.8rem; margin:0;
    background:var(--surface); cursor:pointer; line-height:1.4; }
  .opt:has(input:checked) { border-color:var(--wow); background:var(--wow-tint); }
  .opt input { margin:0.15rem 0 0; flex:0 0 auto; accent-color:var(--wow); }
  .opt span { display:block; }
  .branch { border-left:3px solid var(--wow); background:var(--surface); border-radius:0 10px 10px 0;
    padding:1rem 1rem 0.25rem; margin:0 0 1.25rem; }
  .branch .eyebrow { margin-top:0; }
  .two { display:grid; gap:0 1rem; grid-template-columns:1fr; }
  .error { color:var(--wow-dark); font-size:0.85rem; font-weight:600; margin:0 0 0.75rem; display:none; }
  .error.on { display:block; }
  .success { text-align:center; padding:1.25rem 0; }
  .success .check { width:56px; height:56px; border-radius:50%; background:var(--wow); color:#fff;
    font-size:1.6rem; display:flex; align-items:center; justify-content:center; margin:0 auto 1.15rem; }
  .success .num { font-size:1.4rem; font-weight:800; letter-spacing:0.02em; margin:0.4rem 0; }
  @media (min-width:640px) {
    .two { grid-template-columns:1fr 1fr; }
    .success .num { font-size:1.6rem; }
  }
`;

export const FEEDBACK_INTAKE_HTML = `<!doctype html>
<html lang="en">
<head>
${PUBLIC_HEAD_TAGS}
<title>Share Feedback — WOW Video Tours</title>
<style>
${PUBLIC_SHELL_CSS}
${FORM_CSS}
</style>
</head>
<body>
  <div class="wrap">
    ${BRAND_HEADER_HTML}
    <div class="card">
      <div id="form-view">
        <p class="eyebrow">Feedback</p>
        <h1 class="title">Tell us what happened</h1>
        <p class="lead">Anything that went wrong, went well, or should work differently. It goes straight to the team that can act on it.</p>

        <p class="error" id="err"></p>

        <form id="fb-form" novalidate>
          <div class="field">
            <span class="fieldlabel">This feedback is <span class="req">*</span></span>
            <div class="opts">
        ${checkList("source", FEEDBACK_SOURCES)}
            </div>
          </div>

          <div class="field">
            <span class="fieldlabel">What is it about? <span class="req">*</span></span>
            <div class="opts">
        ${checkList("category", FEEDBACK_CATEGORIES)}
            </div>
          </div>

          <!-- Shown only for appointment-availability feedback, which is the
               only category that ever carried these answers in ClickUp. -->
          <div class="branch hidden" id="appt-branch">
            <p class="eyebrow">Appointment details</p>
            <div class="field">
              <label for="listing-address">Listing address</label>
              <input type="text" id="listing-address" autocomplete="off" />
            </div>
            <div class="field">
              <span class="fieldlabel">Services requested</span>
              <div class="opts">
        ${checkList("service", FEEDBACK_SERVICES)}
              </div>
            </div>
            <div class="two">
              <div class="field">
                <label for="requested-at">Requested date &amp; time</label>
                <input type="datetime-local" id="requested-at" />
              </div>
              <div class="field">
                <label for="first-available-at">First available date &amp; time</label>
                <input type="datetime-local" id="first-available-at" />
              </div>
            </div>
          </div>

          <div class="field">
            <label for="body">Your feedback <span class="req">*</span></label>
            <textarea id="body" maxlength="20000" placeholder="What happened, and what would you like done about it?"></textarea>
          </div>

          <div class="field">
            <label for="submitted-by">Submitted by</label>
            <select id="submitted-by">
              <option value="">Select your name…</option>
        ${FEEDBACK_SUBMITTERS.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("\n        ")}
              <option value="__other__">Someone else…</option>
            </select>
            <div class="hint">Pick your name so we can follow up on the details.</div>
          </div>

          <div class="field hidden" id="other-name-field">
            <label for="submitted-by-name">Your name</label>
            <input type="text" id="submitted-by-name" maxlength="120" autocomplete="name" />
          </div>

          <div class="field">
            <label for="appointment-link">Appointment link</label>
            <input type="url" id="appointment-link" placeholder="https://…" autocomplete="off" />
            <div class="hint">The Spiro appointment this is about, if there is one.</div>
          </div>

          <div class="field">
            <label for="files">Screenshots or files</label>
            <input type="file" id="files" multiple accept="image/*,.pdf,.heic" />
            <div class="hint">Up to ${MAX_INTAKE_FILES} files, ${Math.floor(MAX_INTAKE_FILE_BYTES / (1024 * 1024))} MB each. ${ACCEPTED_FILE_LABEL}.</div>
          </div>

          <button type="submit" class="btn" id="submit-btn">Send feedback</button>
        </form>
      </div>

      <div class="success hidden" id="done-view">
        <div class="check">✓</div>
        <p class="eyebrow">Thank you</p>
        <div class="num" id="done-ref"></div>
        <p class="lead">Your feedback is with the team. If we need more detail, we know where to find you.</p>
        <button type="button" class="btn" id="again-btn">Send more feedback</button>
      </div>
    </div>
    <p class="foot">WOW Video Tours</p>
  </div>

<script>
(function(){
  var APPOINTMENT_CATEGORY = ${JSON.stringify(APPOINTMENT_CATEGORY)};
  var MAX_FILES = ${MAX_INTAKE_FILES};
  var MAX_BYTES = ${MAX_INTAKE_FILE_BYTES};

  function $(id){ return document.getElementById(id); }
  function checkedValues(name){
    return Array.prototype.slice.call(document.querySelectorAll('input[name="'+name+'"]:checked'))
      .map(function(el){ return el.value; });
  }
  function showErr(msg){ var e = $('err'); e.textContent = msg; e.classList.add('on'); e.scrollIntoView({behavior:'smooth', block:'center'}); }
  function clearErr(){ $('err').classList.remove('on'); }

  // The appointment questions follow the category rather than standing open,
  // so the form stays short for the 95% of feedback that is not about booking.
  function syncBranch(){
    var on = checkedValues('category').indexOf(APPOINTMENT_CATEGORY) !== -1;
    $('appt-branch').classList.toggle('hidden', !on);
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name="category"]'), function(el){
    el.addEventListener('change', syncBranch);
  });

  $('submitted-by').addEventListener('change', function(){
    $('other-name-field').classList.toggle('hidden', this.value !== '__other__');
  });

  function readFiles(){
    var input = $('files');
    var list = input.files ? Array.prototype.slice.call(input.files) : [];
    if (list.length === 0) return Promise.resolve([]);
    if (list.length > MAX_FILES) return Promise.reject(new Error('Please attach at most ' + MAX_FILES + ' files.'));
    for (var i=0;i<list.length;i++){
      if (list[i].size > MAX_BYTES) {
        return Promise.reject(new Error('"' + list[i].name + '" is larger than ' + Math.floor(MAX_BYTES/(1024*1024)) + ' MB.'));
      }
    }
    return Promise.all(list.map(function(f){
      return new Promise(function(resolve, reject){
        var r = new FileReader();
        r.onload = function(){
          var s = String(r.result || '');
          resolve({ filename: f.name, data: s.slice(s.indexOf(',') + 1) });
        };
        r.onerror = function(){ reject(new Error('Could not read "' + f.name + '".')); };
        r.readAsDataURL(f);
      });
    }));
  }

  // datetime-local gives a local wall-clock string; send epoch millis so the
  // server never has to guess a timezone.
  function whenMs(id){
    var v = $(id).value;
    if (!v) return null;
    var ms = Date.parse(v);
    return isFinite(ms) ? ms : null;
  }

  $('fb-form').addEventListener('submit', function(e){
    e.preventDefault();
    clearErr();
    var source = checkedValues('source');
    var categories = checkedValues('category');
    var body = $('body').value.trim();
    if (source.length === 0) { showErr('Please say whether this is employee or client feedback.'); return; }
    if (categories.length === 0) { showErr('Please pick at least one category.'); return; }
    if (!body) { showErr('Please tell us what happened.'); return; }

    var picked = $('submitted-by').value;
    var payload = {
      source: source,
      categories: categories,
      body: body,
      submittedBy: picked === '__other__' ? null : (picked || null),
      submittedByName: picked === '__other__' ? $('submitted-by-name').value.trim() : null,
      appointmentLink: $('appointment-link').value.trim() || null,
      listingAddress: $('listing-address').value.trim() || null,
      selectedServices: checkedValues('service'),
      requestedAt: whenMs('requested-at'),
      firstAvailableAt: whenMs('first-available-at')
    };

    var btn = $('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    readFiles().then(function(files){
      payload.files = files;
      return fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }).then(function(res){
      return res.json().then(function(data){ return { ok: res.ok, data: data }; });
    }).then(function(r){
      if (!r.ok || !r.data || !r.data.ok) {
        throw new Error((r.data && r.data.error) || 'Something went wrong. Please try again.');
      }
      $('done-ref').textContent = r.data.reference || '';
      $('form-view').classList.add('hidden');
      $('done-view').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }).catch(function(err){
      showErr(err && err.message ? err.message : 'Something went wrong. Please try again.');
    }).then(function(){
      btn.disabled = false;
      btn.textContent = 'Send feedback';
    });
  });

  $('again-btn').addEventListener('click', function(){
    $('fb-form').reset();
    syncBranch();
    $('other-name-field').classList.add('hidden');
    $('done-view').classList.add('hidden');
    $('form-view').classList.remove('hidden');
  });
})();
</script>
</body>
</html>`;
