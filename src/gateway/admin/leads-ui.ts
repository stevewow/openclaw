// The Hub's lead queue and the routing table behind it.
//
// Shaped like feedback-ui.ts and kb-searches-ui.ts — CSS, markup, modals and
// component JS exported as strings and interpolated into the admin SPA, with
// `esc` and `api` provided by the host.
//
// Two pages, one module, because they are one subject read two ways: the queue
// answers "what came in and who has it", and the routing table is the single
// place that decides the second half of that sentence. Splitting them across
// modules would put the explanation of a column somewhere other than the column.

export const LEADS_CSS = `
  .ld-bar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .ld-search { flex: 1 1 12rem; min-width: 9rem; max-width: 24rem; padding: 0.4rem 0.65rem; font-size: 0.82rem; font-family: inherit; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); }
  .ld-search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.09); }
  /* Every select in the SPA is width:100% by default, which would eat the row. */
  .ld-bar select { width: auto; max-width: 14rem; flex: 0 0 auto; font-size: 0.82rem; padding: 0.35rem 0.5rem; }
  .ld-count { font-size: 0.75rem; color: var(--text-muted); margin-left: auto; white-space: nowrap; }
  .ld-head { display: flex; gap: 0.75rem; align-items: flex-start; flex-wrap: wrap; }
  .ld-head .btn { width: auto; flex: 0 0 auto; }

  .ld-chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; white-space: nowrap; }
  .ld-chip-new { background: #c0000a; color: #fff; }
  .ld-chip-contacted { background: #2563eb; color: #fff; }
  .ld-chip-qualified { background: #7c3aed; color: #fff; }
  .ld-chip-won { background: #16a34a; color: #fff; }
  .ld-chip-lost { background: #6b7280; color: #fff; }

  .ld-who { font-weight: 600; cursor: pointer; }
  .ld-who:hover { color: var(--accent-ink); }
  .ld-sub { display: block; font-weight: 400; color: var(--text-muted); font-size: 0.76rem; }
  .ld-ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.72rem; color: var(--text-muted); }
  /* An unrouted lead is the one row that needs the eye, so it gets the warning. */
  .ld-unrouted { color: #b45309; font-weight: 700; }
  .ld-undelivered { color: #b91c1c; font-weight: 600; font-size: 0.72rem; }

  .ld-facts { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 0.35rem 0.9rem; font-size: 0.82rem; margin-bottom: 1rem; }
  .ld-facts dt { color: var(--text-muted); white-space: nowrap; }
  .ld-facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  .ld-message { white-space: pre-wrap; line-height: 1.55; font-size: 0.9rem; background: var(--surface2);
    border-left: 3px solid var(--accent); border-radius: 0 var(--radius) var(--radius) 0; padding: 0.7rem 0.85rem; margin: 0 0 1rem; }
  .ld-trail { list-style: none; margin: 0.5rem 0 0; padding: 0; max-height: 14rem; overflow-y: auto; }
  .ld-trail li { padding: 0.4rem 0; border-top: 1px solid var(--border); font-size: 0.82rem; }
  .ld-trail li:first-child { border-top: none; }
  .ld-trail-when { color: var(--text-muted); font-size: 0.72rem; }
  .ld-actions-row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end; margin-bottom: 0.75rem; }
  .ld-actions-row .form-group { flex: 1 1 10rem; margin: 0; }

  /* The stat row is styled here rather than borrowed from the admin SPA's
     .stats-grid: the portal has no such class, and one module that draws the
     same on both surfaces beats two copies of the page. */
  .ld-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); gap: 0.6rem; margin-bottom: 1rem; }
  .ld-stat { background: var(--surface); border: 1px solid var(--border, var(--hairline)); border-radius: var(--radius); padding: 0.7rem 0.9rem; }
  .ld-stat-label { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .ld-stat-value { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; }

  /* Routing table: an address missing here is why a lead went nowhere. */
  .ld-missing { color: #b45309; font-style: italic; }
  .ld-alias { font-size: 0.72rem; color: var(--text-muted); }
`;

/**
 * The queue itself, drawn the same on both signed-in surfaces.
 *
 * The admin dashboard and the portal wrap their pages differently — one hides
 * with a class, the other shows with one — so the wrapper is the caller's and
 * only the inside is shared. `canManage` is the difference between the two
 * readings of the page: an admin adds leads by hand and edits the routing table,
 * a granted teammate works the queue they were given.
 */
export function leadsQueueMarkup(opts: { canManage: boolean }): string {
  const addButton = opts.canManage
    ? `<button type="button" class="btn btn-primary" id="ld-new">＋ Add a lead</button>`
    : "";
  const routingNote = opts.canManage
    ? `<a href="#lead-routing" data-page="lead-routing">Lead Routing</a> decides who that is.`
    : `Who that is comes from the market's owner in the Hub's routing table.`;
  return `
        <div class="card" style="margin-bottom:1rem">
          <div class="ld-head">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;margin-bottom:0.35rem">Leads</div>
              <p class="text-muted" style="font-size:0.85rem;margin:0">
                Every enquiry the website forms send, in one place. Each one is emailed to whoever owns
                that market the moment it arrives — ${routingNote}
              </p>
            </div>
            ${addButton}
          </div>
        </div>

        <div class="ld-stats" id="ld-stats"></div>

        <div class="card">
          <div class="ld-bar">
            <input id="ld-search" class="ld-search" type="search" placeholder="Search leads…" />
            <select id="ld-status">
              <option value="open">Open</option>
              <option value="all">All statuses</option>
            </select>
            <select id="ld-territory"><option value="">All markets</option></select>
            <select id="ld-days">
              <option value="">Any time</option>
              <option value="7">Last 7 days</option>
              <option value="30" selected>Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <span class="ld-count" id="ld-count"></span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Lead</th><th>Market</th><th>Owner</th><th>Received</th><th>Status</th><th style="width:1%"></th></tr></thead>
              <tbody id="ld-rows"><tr><td colspan="6" class="empty-state">Loading…</td></tr></tbody>
            </table>
          </div>
        </div>`;
}

export const LEADS_MARKUP = `
      <!-- Lead queue: everything the website forms sent, and who has it -->
      <div id="page-leads" class="page hidden">
${leadsQueueMarkup({ canManage: true })}
      </div>

      <!-- Lead routing: market → the desk that hears about it -->
      <div id="page-lead-routing" class="page hidden">
        <div class="card" style="margin-bottom:1rem">
          <div class="ld-head">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;margin-bottom:0.35rem">Lead Routing</div>
              <p class="text-muted" style="font-size:0.85rem;margin:0">
                Who gets told about a new lead, market by market. A market with no address here cannot be
                emailed — its leads fall to the fallback address and wait in the queue. Aliases catch the other
                spellings a website form might send for the same place.
              </p>
            </div>
            <button type="button" class="btn btn-primary" id="ld-terr-new">＋ Add a market</button>
          </div>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Market</th><th>Owner</th><th>Email</th><th>Also matches</th><th style="width:1%"></th></tr></thead>
              <tbody id="ld-terr-rows"><tr><td colspan="5" class="empty-state">Loading…</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>`;

/** The portal's copy: the queue only. Routing is an admin's page. */
export const LEADS_PORTAL_MARKUP = `
    <div id="page-leads" class="page">
      <div class="topbar"><h2>Leads</h2></div>
      <div class="page-scroll">
${leadsQueueMarkup({ canManage: false })}
      </div>
    </div>`;

export const LEAD_DETAIL_MODAL = `
<div id="ld-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:680px">
    <div class="modal-title"><span id="ld-modal-ref" class="ld-ref"></span> <span id="ld-modal-who"></span></div>
    <dl class="ld-facts" id="ld-modal-facts"></dl>
    <div id="ld-modal-message-wrap" class="hidden">
      <label>What they wrote</label>
      <p class="ld-message" id="ld-modal-message"></p>
    </div>
    <div class="ld-actions-row">
      <div class="form-group">
        <label for="ld-modal-status">Status</label>
        <select id="ld-modal-status"></select>
      </div>
      <div class="form-group">
        <label for="ld-modal-territory">Market owner</label>
        <select id="ld-modal-territory"></select>
      </div>
      <button type="button" class="btn btn-ghost" id="ld-modal-resend">Resend email</button>
    </div>
    <div class="form-group">
      <label for="ld-modal-note">Add a note</label>
      <textarea id="ld-modal-note" rows="2" placeholder="Called and left a voicemail…"></textarea>
    </div>
    <button type="button" class="btn btn-secondary" id="ld-modal-note-save">Save note</button>
    <label style="margin-top:1rem">Activity</label>
    <ul class="ld-trail" id="ld-modal-trail"></ul>
    <div class="modal-actions">
      <button type="button" class="btn btn-danger" id="ld-modal-delete">Delete</button>
      <button type="button" class="btn btn-ghost" id="ld-modal-close">Close</button>
    </div>
  </div>
</div>`;

/** Everything an admin can do beyond working the queue. */
export const LEADS_MODALS = `${LEAD_DETAIL_MODAL}
<div id="ld-new-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:520px">
    <div class="modal-title">Add a lead</div>
    <div class="form-group"><label for="ld-new-name">Name</label><input id="ld-new-name" type="text" /></div>
    <div class="form-group"><label for="ld-new-email">Email</label><input id="ld-new-email" type="email" /></div>
    <div class="form-group"><label for="ld-new-phone">Phone</label><input id="ld-new-phone" type="tel" /></div>
    <div class="form-group"><label for="ld-new-company">Brokerage</label><input id="ld-new-company" type="text" /></div>
    <div class="form-group"><label for="ld-new-territory">Market</label><select id="ld-new-territory"></select></div>
    <div class="form-group"><label for="ld-new-message">Notes</label><textarea id="ld-new-message" rows="3"></textarea></div>
    <p class="text-muted" style="font-size:0.78rem">An email or a phone number is required. Nothing is emailed automatically — use <strong>Resend email</strong> on the lead if the owner should hear about it.</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="ld-new-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="ld-new-save">Add lead</button>
    </div>
  </div>
</div>

<div id="ld-terr-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:520px">
    <div class="modal-title" id="ld-terr-modal-title">Market</div>
    <div class="form-group"><label for="ld-terr-label">Market name</label><input id="ld-terr-label" type="text" placeholder="Columbus" /></div>
    <div class="form-group"><label for="ld-terr-owner">Owner</label><input id="ld-terr-owner" type="text" placeholder="Chris Voge" /></div>
    <div class="form-group"><label for="ld-terr-email">Email</label><input id="ld-terr-email" type="email" placeholder="chris@wowvideotours.com" /></div>
    <div class="form-group">
      <label for="ld-terr-aliases">Also matches</label>
      <input id="ld-terr-aliases" type="text" placeholder="Central Ohio, Columbus OH" />
      <p class="text-muted" style="font-size:0.75rem;margin-top:0.25rem">Comma separated. Other spellings the website form might send for this market.</p>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-danger" id="ld-terr-delete">Delete</button>
      <button type="button" class="btn btn-ghost" id="ld-terr-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="ld-terr-save">Save</button>
    </div>
  </div>
</div>`;

/** The portal opens leads and works them; it does not create or re-route them. */
export const LEADS_PORTAL_MODALS = LEAD_DETAIL_MODAL;

export const LEADS_COMPONENT_JS = `
  var ldLeads = [];
  var ldStatuses = [];
  var ldTerritories = [];
  var ldSummary = null;
  var ldOpenId = null;
  var ldSearchTimer = null;
  var ldTerrEditingKey = null;

  function ldStatusLabel(key){
    for (var i=0;i<ldStatuses.length;i++){ if(ldStatuses[i].key === key) return ldStatuses[i].label; }
    return key;
  }

  function ldWhen(ts){
    if(!ts) return '—';
    return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  }

  function ldWhenLong(ts){
    if(!ts) return '—';
    return new Date(ts).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
  }

  /** Whoever it is: the name, else whatever contact detail they left. */
  function ldWho(l){
    return l.name || l.email || l.company || l.number;
  }

  function ldTerritoryLabel(key){
    for (var i=0;i<ldTerritories.length;i++){ if(ldTerritories[i].key === key) return ldTerritories[i].label; }
    return null;
  }

  /**
   * Filters are applied by the server, so the stat cards and the rows under
   * them are counted from the same list and cannot disagree.
   */
  async function loadLeads(){
    var qs = [];
    var status = document.getElementById('ld-status').value;
    var territory = document.getElementById('ld-territory').value;
    var days = document.getElementById('ld-days').value;
    var q = document.getElementById('ld-search').value.trim();
    if(status) qs.push('status=' + encodeURIComponent(status));
    if(territory) qs.push('territory=' + encodeURIComponent(territory));
    if(days) qs.push('days=' + encodeURIComponent(days));
    if(q) qs.push('q=' + encodeURIComponent(q));
    var r = await api('GET','/leads' + (qs.length ? '?' + qs.join('&') : ''));
    if(!r.ok){
      document.getElementById('ld-rows').innerHTML = '<tr><td colspan="6" class="empty-state">Could not load leads.</td></tr>';
      return;
    }
    ldLeads = (r.data && r.data.leads) || [];
    ldSummary = (r.data && r.data.summary) || null;
    ldStatuses = (r.data && r.data.statuses) || [];
    ldTerritories = (r.data && r.data.territories) || [];
    ldFillFilters();
    renderLeadStats();
    renderLeadRows();
  }

  /** Options are filled once; refilling on every load would drop the selection. */
  function ldFillFilters(){
    var st = document.getElementById('ld-status');
    if(st.options.length <= 2){
      ldStatuses.forEach(function(s){
        var o = document.createElement('option'); o.value = s.key; o.textContent = s.label; st.appendChild(o);
      });
    }
    var terr = document.getElementById('ld-territory');
    if(terr.options.length <= 1){
      ldTerritories.forEach(function(t){
        var o = document.createElement('option'); o.value = t.key; o.textContent = t.label; terr.appendChild(o);
      });
      var un = document.createElement('option');
      un.value = 'unassigned'; un.textContent = 'Unrouted';
      terr.appendChild(un);
    }
  }

  function renderLeadStats(){
    var el = document.getElementById('ld-stats');
    if(!ldSummary){ el.innerHTML = ''; return; }
    var html = '<div class="ld-stat"><div class="ld-stat-label">Leads</div><div class="ld-stat-value">' + ldSummary.total + '</div></div>';
    (ldSummary.byStatus || []).forEach(function(s){
      if(s.count === 0 && s.status !== 'new') return;
      html += '<div class="ld-stat"><div class="ld-stat-label">' + esc(s.label) + '</div><div class="ld-stat-value">' + s.count + '</div></div>';
    });
    if(ldSummary.unrouted > 0){
      html += '<div class="ld-stat"><div class="ld-stat-label">Unrouted</div><div class="ld-stat-value ld-unrouted">' + ldSummary.unrouted + '</div></div>';
    }
    if(ldSummary.undelivered > 0){
      html += '<div class="ld-stat"><div class="ld-stat-label">Not emailed</div><div class="ld-stat-value ld-undelivered">' + ldSummary.undelivered + '</div></div>';
    }
    el.innerHTML = html;
  }

  function renderLeadRows(){
    var body = document.getElementById('ld-rows');
    document.getElementById('ld-count').textContent =
      ldLeads.length + (ldLeads.length === 1 ? ' lead' : ' leads');
    if(ldLeads.length === 0){
      body.innerHTML = '<tr><td colspan="6" class="empty-state">No leads match that.</td></tr>';
      return;
    }
    var html = '';
    ldLeads.forEach(function(l){
      var contact = [l.phone, l.email].filter(Boolean).join(' · ');
      var market = l.marketRaw ? esc(l.marketRaw) : '<span class="ld-unrouted">Not given</span>';
      var owner = l.ownerName
        ? esc(l.ownerName) + (l.notifiedAt ? '' : '<span class="ld-sub ld-undelivered">not emailed</span>')
        : '<span class="ld-unrouted">Unrouted</span>';
      html += '<tr data-id="' + esc(l.id) + '">' +
        '<td class="ld-who ld-open">' + esc(ldWho(l)) +
          '<span class="ld-sub">' + esc(l.company || '') + (l.company && contact ? ' · ' : '') + esc(contact) + '</span>' +
        '</td>' +
        '<td>' + market + '</td>' +
        '<td>' + owner + '</td>' +
        '<td>' + esc(ldWhen(l.createdAt)) + '</td>' +
        '<td><span class="ld-chip ld-chip-' + esc(l.status) + '">' + esc(ldStatusLabel(l.status)) + '</span></td>' +
        '<td><button class="btn btn-sm btn-ghost ld-open">Open</button></td>' +
      '</tr>';
    });
    body.innerHTML = html;
    body.querySelectorAll('.ld-open').forEach(function(el){
      el.addEventListener('click', function(){
        openLeadModal(el.closest('tr').getAttribute('data-id'));
      });
    });
  }

  function ldLeadById(id){
    for (var i=0;i<ldLeads.length;i++){ if(ldLeads[i].id === id) return ldLeads[i]; }
    return null;
  }

  function ldRenderTrail(events){
    document.getElementById('ld-modal-trail').innerHTML = (events || []).slice().reverse().map(function(e){
      var who = e.authorName ? esc(e.authorName) + ' · ' : '';
      return '<li>' + esc(e.body || e.kind) +
        '<div class="ld-trail-when">' + who + esc(ldWhenLong(e.createdAt)) + '</div></li>';
    }).join('') || '<li class="text-muted">Nothing yet.</li>';
  }

  async function openLeadModal(id){
    var l = ldLeadById(id);
    if(!l) return;
    ldOpenId = id;
    document.getElementById('ld-modal-ref').textContent = l.number;
    document.getElementById('ld-modal-who').textContent = ldWho(l);

    var facts = '';
    function fact(label, value){
      if(!value) return;
      facts += '<dt>' + esc(label) + '</dt><dd>' + value + '</dd>';
    }
    if(l.email) fact('Email', '<a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a>');
    if(l.phone) fact('Phone', '<a href="tel:' + esc(l.phone) + '">' + esc(l.phone) + '</a>');
    fact('Brokerage', esc(l.company || ''));
    fact('Market', esc(l.marketRaw || 'Not given'));
    fact('Owner', l.ownerName ? esc(l.ownerName) + (l.ownerEmail ? ' &lt;' + esc(l.ownerEmail) + '&gt;' : '') : '<span class="ld-unrouted">Unrouted</span>');
    fact('Received', esc(ldWhenLong(l.createdAt)));
    fact('Emailed', l.notifiedAt
      ? esc(ldWhenLong(l.notifiedAt))
      : '<span class="ld-undelivered">' + esc(l.notifyError || 'not sent') + '</span>');
    if(l.formName) fact('Form', esc(l.formName));
    if(l.pageUrl) fact('Page', '<a href="' + esc(l.pageUrl) + '" target="_blank" rel="noopener">' + esc(l.pageUrl) + '</a>');
    (l.fields || []).forEach(function(f){ fact(f.label, esc(f.value)); });
    document.getElementById('ld-modal-facts').innerHTML = facts;

    document.getElementById('ld-modal-message-wrap').classList.toggle('hidden', !l.message);
    document.getElementById('ld-modal-message').textContent = l.message || '';

    document.getElementById('ld-modal-status').innerHTML = ldStatuses.map(function(s){
      return '<option value="' + esc(s.key) + '"' + (s.key === l.status ? ' selected' : '') + '>' + esc(s.label) + '</option>';
    }).join('');
    document.getElementById('ld-modal-territory').innerHTML =
      '<option value="">Unrouted</option>' + ldTerritories.map(function(t){
        return '<option value="' + esc(t.key) + '"' + (t.key === l.territoryKey ? ' selected' : '') + '>' +
          esc(t.label) + (t.ownerName ? ' — ' + esc(t.ownerName) : '') + '</option>';
      }).join('');
    document.getElementById('ld-modal-note').value = '';
    document.getElementById('ld-modal').classList.remove('hidden');

    var r = await api('GET','/leads/' + encodeURIComponent(id));
    if(r.ok && r.data) ldRenderTrail(r.data.events);
  }

  function closeLeadModal(){
    ldOpenId = null;
    document.getElementById('ld-modal').classList.add('hidden');
  }

  /** Every write refreshes the list, so the row behind the modal stays true. */
  async function ldAfterWrite(r){
    if(r.ok && r.data && r.data.events) ldRenderTrail(r.data.events);
    await loadLeads();
    if(ldOpenId){
      var l = ldLeadById(ldOpenId);
      if(l && r.ok && r.data && r.data.lead){
        document.getElementById('ld-modal-status').value = r.data.lead.status;
      }
    }
  }

  async function saveLeadStatus(){
    if(!ldOpenId) return;
    var r = await api('PUT','/leads/' + encodeURIComponent(ldOpenId) + '/status',
      { status: document.getElementById('ld-modal-status').value });
    await ldAfterWrite(r);
  }

  async function saveLeadTerritory(){
    if(!ldOpenId) return;
    var r = await api('PUT','/leads/' + encodeURIComponent(ldOpenId) + '/assign',
      { territoryKey: document.getElementById('ld-modal-territory').value || null });
    await ldAfterWrite(r);
  }

  async function saveLeadNote(){
    if(!ldOpenId) return;
    var note = document.getElementById('ld-modal-note').value.trim();
    if(!note) return;
    var r = await api('POST','/leads/' + encodeURIComponent(ldOpenId) + '/notes', { body: note });
    document.getElementById('ld-modal-note').value = '';
    await ldAfterWrite(r);
  }

  async function resendLead(){
    if(!ldOpenId) return;
    var r = await api('POST','/leads/' + encodeURIComponent(ldOpenId) + '/dispatch');
    if(!r.ok || (r.data && r.data.ok === false)){
      alert('Could not send it: ' + ((r.data && r.data.detail) || 'the mail provider refused it.'));
    }
    await ldAfterWrite(r);
  }

  async function removeLead(){
    if(!ldOpenId) return;
    if(!confirm('Delete this lead and its activity? This cannot be undone.')) return;
    var r = await api('DELETE','/leads/' + encodeURIComponent(ldOpenId));
    closeLeadModal();
    if(r.ok) await loadLeads();
  }

  function openNewLead(){
    ['ld-new-name','ld-new-email','ld-new-phone','ld-new-company','ld-new-message'].forEach(function(id){
      document.getElementById(id).value = '';
    });
    document.getElementById('ld-new-territory').innerHTML =
      '<option value="">Unrouted</option>' + ldTerritories.map(function(t){
        return '<option value="' + esc(t.key) + '">' + esc(t.label) + (t.ownerName ? ' — ' + esc(t.ownerName) : '') + '</option>';
      }).join('');
    document.getElementById('ld-new-modal').classList.remove('hidden');
  }

  async function saveNewLead(){
    var payload = {
      name: document.getElementById('ld-new-name').value.trim(),
      email: document.getElementById('ld-new-email').value.trim(),
      phone: document.getElementById('ld-new-phone').value.trim(),
      company: document.getElementById('ld-new-company').value.trim(),
      territoryKey: document.getElementById('ld-new-territory').value || null,
      message: document.getElementById('ld-new-message').value.trim()
    };
    if(!payload.email && !payload.phone){
      alert('An email or a phone number is required.');
      return;
    }
    var r = await api('POST','/leads', payload);
    if(!r.ok){
      alert('Could not add the lead.');
      return;
    }
    document.getElementById('ld-new-modal').classList.add('hidden');
    await loadLeads();
  }

  // ── Lead routing ─────────────────────────────────────────────────────────

  async function loadLeadRouting(){
    var r = await api('GET','/lead-territories');
    var body = document.getElementById('ld-terr-rows');
    if(!r.ok){
      body.innerHTML = '<tr><td colspan="5" class="empty-state">Could not load the routing table.</td></tr>';
      return;
    }
    ldTerritories = (r.data && r.data.territories) || [];
    if(ldTerritories.length === 0){
      body.innerHTML = '<tr><td colspan="5" class="empty-state">No markets yet.</td></tr>';
      return;
    }
    body.innerHTML = ldTerritories.map(function(t){
      return '<tr data-key="' + esc(t.key) + '">' +
        '<td><strong>' + esc(t.label) + '</strong>' + (t.active ? '' : '<span class="ld-sub">paused</span>') + '</td>' +
        '<td>' + (t.ownerName ? esc(t.ownerName) : '<span class="ld-missing">nobody</span>') + '</td>' +
        '<td>' + (t.ownerEmail ? esc(t.ownerEmail) : '<span class="ld-missing">no address — leads fall back</span>') + '</td>' +
        '<td class="ld-alias">' + esc((t.aliases || []).join(', ')) + '</td>' +
        '<td><button class="btn btn-sm btn-ghost ld-terr-edit">Edit</button></td>' +
      '</tr>';
    }).join('');
    body.querySelectorAll('.ld-terr-edit').forEach(function(el){
      el.addEventListener('click', function(){
        openTerritoryModal(el.closest('tr').getAttribute('data-key'));
      });
    });
  }

  function ldTerritoryByKey(key){
    for (var i=0;i<ldTerritories.length;i++){ if(ldTerritories[i].key === key) return ldTerritories[i]; }
    return null;
  }

  function openTerritoryModal(key){
    ldTerrEditingKey = key || null;
    var t = key ? ldTerritoryByKey(key) : null;
    document.getElementById('ld-terr-modal-title').textContent = t ? t.label : 'Add a market';
    document.getElementById('ld-terr-label').value = t ? t.label : '';
    document.getElementById('ld-terr-owner').value = (t && t.ownerName) || '';
    document.getElementById('ld-terr-email').value = (t && t.ownerEmail) || '';
    document.getElementById('ld-terr-aliases').value = t ? (t.aliases || []).join(', ') : '';
    document.getElementById('ld-terr-delete').classList.toggle('hidden', !t);
    document.getElementById('ld-terr-modal').classList.remove('hidden');
  }

  async function saveTerritory(){
    var payload = {
      label: document.getElementById('ld-terr-label').value.trim(),
      ownerName: document.getElementById('ld-terr-owner').value.trim(),
      ownerEmail: document.getElementById('ld-terr-email').value.trim(),
      aliases: document.getElementById('ld-terr-aliases').value
    };
    if(!payload.label){
      alert('A market name is required.');
      return;
    }
    var r = ldTerrEditingKey
      ? await api('PUT','/lead-territories/' + encodeURIComponent(ldTerrEditingKey), payload)
      : await api('POST','/lead-territories', payload);
    if(!r.ok){
      alert(r.data && r.data.error === 'territory_exists' ? 'That market already exists.' : 'Could not save it.');
      return;
    }
    document.getElementById('ld-terr-modal').classList.add('hidden');
    await loadLeadRouting();
  }

  async function removeTerritory(){
    if(!ldTerrEditingKey) return;
    if(!confirm('Delete this market? Leads already routed through it keep the owner they were sent to.')) return;
    var r = await api('DELETE','/lead-territories/' + encodeURIComponent(ldTerrEditingKey));
    document.getElementById('ld-terr-modal').classList.add('hidden');
    if(r.ok) await loadLeadRouting();
  }

  /**
   * Wire a control only if this surface drew it. The portal renders the queue
   * and the lead panel but neither the add-a-lead form nor the routing table,
   * and one shared script beats a second copy of the page that drifts.
   */
  function ldOn(id, event, fn){
    var el = document.getElementById(id);
    if(el) el.addEventListener(event, fn);
  }

  ldOn('ld-status', 'change', loadLeads);
  ldOn('ld-territory', 'change', loadLeads);
  ldOn('ld-days', 'change', loadLeads);
  ldOn('ld-search', 'input', function(){
    if(ldSearchTimer) clearTimeout(ldSearchTimer);
    ldSearchTimer = setTimeout(loadLeads, 220);
  });
  ldOn('ld-modal-status', 'change', saveLeadStatus);
  ldOn('ld-modal-territory', 'change', saveLeadTerritory);
  ldOn('ld-modal-note-save', 'click', saveLeadNote);
  ldOn('ld-modal-resend', 'click', resendLead);
  ldOn('ld-modal-delete', 'click', removeLead);
  ldOn('ld-modal-close', 'click', closeLeadModal);
  ldOn('ld-new', 'click', openNewLead);
  ldOn('ld-new-cancel', 'click', function(){
    document.getElementById('ld-new-modal').classList.add('hidden');
  });
  ldOn('ld-new-save', 'click', saveNewLead);
  ldOn('ld-terr-new', 'click', function(){ openTerritoryModal(null); });
  ldOn('ld-terr-cancel', 'click', function(){
    document.getElementById('ld-terr-modal').classList.add('hidden');
  });
  ldOn('ld-terr-save', 'click', saveTerritory);
  ldOn('ld-terr-delete', 'click', removeTerritory);
`;
