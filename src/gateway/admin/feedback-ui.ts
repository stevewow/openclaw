// The Hub's team-feedback page: everything the ClickUp form's list view was
// for — read a submission, see what it was about, and move it along.
//
// Shaped like kb-ui.ts — CSS, markup, modals and component JS exported as
// strings and interpolated into the admin SPA. The host provides `esc` and
// `api` and the modal conventions.
//
// The option lists are not repeated here: every filter is built from what
// GET /api/admin/feedback returns, so the page cannot drift from the store.

export const FEEDBACK_CSS = `
  .fb-bar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .fb-search { flex: 1 1 12rem; min-width: 9rem; max-width: 24rem; padding: 0.4rem 0.65rem; font-size: 0.82rem; font-family: inherit; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); }
  .fb-search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.09); }
  /* Every select in the SPA is width:100% by default, which would eat the row. */
  .fb-bar select { width: auto; max-width: 16rem; flex: 0 0 auto; font-size: 0.82rem; padding: 0.35rem 0.5rem; }
  .fb-count { font-size: 0.75rem; color: var(--text-muted); margin-left: auto; white-space: nowrap; }
  /* The button drops under the blurb on a narrow window rather than squeezing it. */
  .fb-head { display: flex; gap: 0.75rem; align-items: flex-start; flex-wrap: wrap; }
  .fb-head .btn { width: auto; flex: 0 0 auto; }

  .fb-chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; white-space: nowrap; }
  .fb-chip-to_review { background: #6b7280; color: #fff; }
  .fb-chip-photographers { background: #2563eb; color: #fff; }
  .fb-chip-appointment_availability { background: #7c3aed; color: #fff; }
  .fb-chip-billing { background: #b45309; color: #fff; }
  .fb-chip-complete { background: #16a34a; color: #fff; }

  .fb-tag { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 0.68rem; font-weight: 600;
    background: var(--surface2); color: var(--text-muted); border: 1px solid var(--border); margin: 0 0.2rem 0.2rem 0; }
  .fb-tag-client { background: rgba(192,0,10,0.07); color: var(--accent); border-color: rgba(192,0,10,0.25); }

  .fb-body-cell { cursor: pointer; font-weight: 500; max-width: 40rem; }
  .fb-body-cell:hover { color: var(--accent); }
  .fb-snippet { display: block; font-weight: 400; color: var(--text-muted); font-size: 0.76rem;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .fb-ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.72rem; color: var(--text-muted); }

  .fb-detail-body { white-space: pre-wrap; line-height: 1.55; font-size: 0.9rem; margin: 0 0 1rem; }
  .fb-facts { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 0.35rem 0.9rem; font-size: 0.82rem; margin-bottom: 1rem; }
  .fb-facts dt { color: var(--text-muted); white-space: nowrap; }
  .fb-facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  .fb-files { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .fb-file { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.6rem;
    border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.78rem; background: var(--surface); }
`;

export const FEEDBACK_MARKUP = `
<div id="page-feedback" class="page hidden">
  <div class="card" style="margin-bottom:1rem">
    <div class="fb-head">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;margin-bottom:0.35rem">Feedback</div>
        <p class="text-muted" style="font-size:0.85rem;margin:0">
          What the team and our clients told us. Anyone can file feedback from the public form —
          share <code>/feedback</code> with whoever needs it, or use the button to open it yourself.
        </p>
      </div>
      <button type="button" class="btn btn-primary" id="fb-new">＋ Submit feedback</button>
    </div>
  </div>

  <div class="stats-grid" id="fb-stats"></div>

  <div class="card">
    <div class="fb-bar">
      <input id="fb-search" class="fb-search" type="search" placeholder="Search feedback…" />
      <select id="fb-status"><option value="all">All statuses</option></select>
      <select id="fb-category"><option value="">All categories</option></select>
      <select id="fb-source"><option value="">Everyone</option></select>
      <span class="fb-count" id="fb-count"></span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Feedback</th><th>About</th><th>Submitted</th><th>Status</th><th style="width:1%"></th></tr></thead>
        <tbody id="fb-rows"><tr><td colspan="5" class="empty-state">Loading…</td></tr></tbody>
      </table>
    </div>
  </div>
</div>`;

export const FEEDBACK_MODALS = `
<div id="fb-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:640px">
    <div class="modal-title"><span id="fb-modal-ref" class="fb-ref"></span></div>
    <p class="fb-detail-body" id="fb-modal-body"></p>
    <dl class="fb-facts" id="fb-modal-facts"></dl>
    <div id="fb-modal-files-wrap" class="hidden">
      <label>Attachments</label>
      <div class="fb-files" id="fb-modal-files"></div>
    </div>
    <div class="form-group" style="margin-top:1rem">
      <label for="fb-modal-status">Status</label>
      <select id="fb-modal-status"></select>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-danger" id="fb-modal-delete">Delete</button>
      <button type="button" class="btn btn-ghost" id="fb-modal-close">Close</button>
    </div>
  </div>
</div>`;

export const FEEDBACK_COMPONENT_JS = `
  var fbEntries = [];
  var fbStatuses = [];
  var fbCategories = [];
  var fbSources = [];
  var fbSummary = null;
  var fbOpenId = null;
  var fbSearchTimer = null;

  function fbStatusLabel(key){
    for (var i=0;i<fbStatuses.length;i++){ if(fbStatuses[i].key === key) return fbStatuses[i].label; }
    return key;
  }

  function fbWhen(ts){
    if(!ts) return '—';
    var d = new Date(ts);
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  }

  function fbWhenLong(ts){
    if(!ts) return '—';
    return new Date(ts).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
  }

  /** Whoever filed it: the roster pick, else the name typed on the public form. */
  function fbWho(e){
    return e.submittedBy || e.submittedByName || 'Anonymous';
  }

  /**
   * The filters are sent to the server rather than applied here, so a status
   * count and the rows below it can never disagree about what is in scope.
   */
  async function loadFeedback(){
    var qs = [];
    var status = document.getElementById('fb-status').value;
    var category = document.getElementById('fb-category').value;
    var source = document.getElementById('fb-source').value;
    var q = document.getElementById('fb-search').value.trim();
    if(status && status !== 'all') qs.push('status=' + encodeURIComponent(status));
    if(category) qs.push('category=' + encodeURIComponent(category));
    if(source) qs.push('source=' + encodeURIComponent(source));
    if(q) qs.push('q=' + encodeURIComponent(q));
    var r = await api('GET','/feedback' + (qs.length ? '?' + qs.join('&') : ''));
    if(!r.ok){
      document.getElementById('fb-rows').innerHTML = '<tr><td colspan="5" class="empty-state">Could not load feedback.</td></tr>';
      return;
    }
    fbEntries = (r.data && r.data.entries) || [];
    fbSummary = (r.data && r.data.summary) || null;
    fbStatuses = (r.data && r.data.statuses) || [];
    fbCategories = (r.data && r.data.categories) || [];
    fbSources = (r.data && r.data.sources) || [];
    fbFillFilters();
    renderFeedbackStats();
    renderFeedbackRows();
  }

  /** Options are filled once; refilling on every load would drop the selection. */
  function fbFillFilters(){
    var st = document.getElementById('fb-status');
    if(st.options.length <= 1){
      fbStatuses.forEach(function(s){
        var o = document.createElement('option'); o.value = s.key; o.textContent = s.label; st.appendChild(o);
      });
    }
    var cat = document.getElementById('fb-category');
    if(cat.options.length <= 1){
      fbCategories.forEach(function(c){
        var o = document.createElement('option'); o.value = c;
        // The ClickUp labels carry a parenthetical example; the picker shows
        // only the name so the row stays readable.
        o.textContent = c.replace(/\\s*\\(.*\\)\\s*$/, '');
        cat.appendChild(o);
      });
    }
    var src = document.getElementById('fb-source');
    if(src.options.length <= 1){
      fbSources.forEach(function(s){
        var o = document.createElement('option'); o.value = s; o.textContent = s; src.appendChild(o);
      });
    }
  }

  function renderFeedbackStats(){
    var el = document.getElementById('fb-stats');
    if(!fbSummary){ el.innerHTML = ''; return; }
    var html = '<div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">' + fbSummary.total + '</div></div>';
    (fbSummary.byStatus || []).forEach(function(s){
      html += '<div class="stat-card"><div class="stat-label">' + esc(s.label) + '</div><div class="stat-value">' + s.count + '</div></div>';
    });
    el.innerHTML = html;
  }

  function renderFeedbackRows(){
    var body = document.getElementById('fb-rows');
    document.getElementById('fb-count').textContent =
      fbEntries.length + (fbEntries.length === 1 ? ' entry' : ' entries');
    if(fbEntries.length === 0){
      body.innerHTML = '<tr><td colspan="5" class="empty-state">No feedback matches that.</td></tr>';
      return;
    }
    var html = '';
    fbEntries.forEach(function(e){
      var about = (e.categories || []).map(function(c){
        return '<span class="fb-tag">' + esc(c.replace(/\\s*\\(.*\\)\\s*$/, '')) + '</span>';
      }).join('');
      var src = (e.source || []).map(function(s){
        var cls = s === 'Client Feedback' ? 'fb-tag fb-tag-client' : 'fb-tag';
        return '<span class="' + cls + '">' + esc(s.replace(' Feedback','')) + '</span>';
      }).join('');
      var files = (e.attachments || []).length;
      html += '<tr data-id="' + esc(e.id) + '">' +
        '<td class="fb-body-cell fb-open">' +
          '<span class="fb-ref">' + esc(e.reference) + '</span>' +
          (files ? ' <span class="fb-tag">📎 ' + files + '</span>' : '') +
          '<span class="fb-snippet">' + esc((e.body || '').slice(0,180)) + '</span>' +
        '</td>' +
        '<td>' + src + about + '</td>' +
        '<td>' + esc(fbWho(e)) + '<span class="fb-snippet">' + esc(fbWhen(e.createdAt)) + '</span></td>' +
        '<td><span class="fb-chip fb-chip-' + esc(e.status) + '">' + esc(fbStatusLabel(e.status)) + '</span></td>' +
        '<td><button class="btn btn-sm btn-ghost fb-open">Open</button></td>' +
      '</tr>';
    });
    body.innerHTML = html;
    body.querySelectorAll('.fb-open').forEach(function(el){
      el.addEventListener('click', function(){
        openFeedbackModal(el.closest('tr').getAttribute('data-id'));
      });
    });
  }

  function fbEntryById(id){
    for (var i=0;i<fbEntries.length;i++){ if(fbEntries[i].id === id) return fbEntries[i]; }
    return null;
  }

  function openFeedbackModal(id){
    var e = fbEntryById(id);
    if(!e) return;
    fbOpenId = id;
    document.getElementById('fb-modal-ref').textContent = e.reference;
    document.getElementById('fb-modal-body').textContent = e.body || '(no text)';

    var facts = '';
    function fact(label, value){
      if(!value) return;
      facts += '<dt>' + esc(label) + '</dt><dd>' + value + '</dd>';
    }
    fact('Submitted by', esc(fbWho(e)));
    fact('Received', esc(fbWhenLong(e.createdAt)));
    fact('Source', esc((e.source || []).join(', ')));
    fact('Category', esc((e.categories || []).join(', ')));
    if(e.appointmentLink){
      fact('Appointment', '<a href="' + esc(e.appointmentLink) + '" target="_blank" rel="noopener">' + esc(e.appointmentLink) + '</a>');
    }
    fact('Listing address', esc(e.listingAddress || ''));
    fact('Services', esc((e.selectedServices || []).join(', ')));
    if(e.requestedAt) fact('Requested', esc(fbWhenLong(e.requestedAt)));
    if(e.firstAvailableAt) fact('First available', esc(fbWhenLong(e.firstAvailableAt)));
    document.getElementById('fb-modal-facts').innerHTML = facts;

    var files = e.attachments || [];
    document.getElementById('fb-modal-files-wrap').classList.toggle('hidden', files.length === 0);
    document.getElementById('fb-modal-files').innerHTML = files.map(function(f){
      var kb = f.byteSize ? ' (' + Math.max(1, Math.round(f.byteSize/1024)) + ' KB)' : '';
      return '<span class="fb-file">📎 ' + esc(f.filename) + esc(kb) + '</span>';
    }).join('');

    var sel = document.getElementById('fb-modal-status');
    sel.innerHTML = fbStatuses.map(function(s){
      return '<option value="' + esc(s.key) + '"' + (s.key === e.status ? ' selected' : '') + '>' + esc(s.label) + '</option>';
    }).join('');
    document.getElementById('fb-modal').classList.remove('hidden');
  }

  function closeFeedbackModal(){
    fbOpenId = null;
    document.getElementById('fb-modal').classList.add('hidden');
  }

  async function saveFeedbackStatus(){
    if(!fbOpenId) return;
    var status = document.getElementById('fb-modal-status').value;
    var r = await api('PUT','/feedback/' + encodeURIComponent(fbOpenId) + '/status', { status: status });
    if(r.ok) await loadFeedback();
  }

  async function removeFeedback(){
    if(!fbOpenId) return;
    if(!confirm('Delete this feedback and its attachments? This cannot be undone.')) return;
    var r = await api('DELETE','/feedback/' + encodeURIComponent(fbOpenId));
    closeFeedbackModal();
    if(r.ok) await loadFeedback();
  }

  // Opens the public form rather than duplicating it. It is ten fields with a
  // conditional branch and file upload; a second copy in the SPA would drift
  // from the one clients actually use.
  document.getElementById('fb-new').addEventListener('click', function(){
    window.open('/feedback', '_blank', 'noopener');
  });

  document.getElementById('fb-status').addEventListener('change', loadFeedback);
  document.getElementById('fb-category').addEventListener('change', loadFeedback);
  document.getElementById('fb-source').addEventListener('change', loadFeedback);
  document.getElementById('fb-search').addEventListener('input', function(){
    if(fbSearchTimer) clearTimeout(fbSearchTimer);
    fbSearchTimer = setTimeout(loadFeedback, 220);
  });
  document.getElementById('fb-modal-status').addEventListener('change', saveFeedbackStatus);
  document.getElementById('fb-modal-close').addEventListener('click', closeFeedbackModal);
  document.getElementById('fb-modal-delete').addEventListener('click', removeFeedback);
`;
