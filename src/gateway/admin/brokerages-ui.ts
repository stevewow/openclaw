// Brokerage partnerships, as markup and inline JS shared by both signed-in
// surfaces: the agreements we hold and the brokerages we want next, what each
// sends us this year, which order page they use, and the paperwork behind it.
//
// The inline JS below lives in a template literal, which eats backslashes: no
// regex escapes and no backslashes in its comments. It also must not contain a
// dollar sign followed by an open brace.

import { infoTip } from "./info-tip.js";

export const BROKERAGES_CSS = `
  .brk-head { display: flex; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .brk-head-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .brk-sync { color: var(--text-muted); font-size: 0.8rem; margin: 0.5rem 0 0; }
  .brk-warn { color: #b45309; font-weight: 600; }
  .brk-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
  .brk-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem 0.9rem; }
  .brk-stat-label { color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .brk-stat-value { font-size: 1.45rem; font-weight: 700; margin-top: 0.15rem; font-variant-numeric: tabular-nums; }
  .brk-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); }
  .brk-search { flex: 1; min-width: 12rem; }
  .brk-count { color: var(--text-muted); font-size: 0.82rem; margin-left: auto; }
  .brk-table-wrap { overflow-x: auto; }
  table.brk-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  table.brk-table th { text-align: left; color: var(--text-muted); font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background: var(--surface2); padding: 0.55rem 0.75rem; white-space: nowrap; }
  table.brk-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  table.brk-table tr.brk-row { cursor: pointer; }
  table.brk-table tr.brk-row:hover td { background: var(--surface2); }
  table.brk-table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .brk-name { font-weight: 700; }
  .brk-sub { color: var(--text-muted); font-size: 0.76rem; margin-top: 0.1rem; }
  .brk-stage { display: inline-block; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
  .brk-stage-active { background: #dcfce7; color: #166534; }
  .brk-stage-expired { background: #f1f5f9; color: #475569; }
  .brk-stage-negotiating { background: #fef3c7; color: #92400e; }
  .brk-stage-target { background: #dbeafe; color: #1e40af; }
  .brk-due { display: block; font-size: 0.72rem; font-weight: 700; color: #b45309; }
  .brk-due.is-past { color: #b91c1c; }
  .brk-modal-box { max-width: 820px; }
  .brk-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr)); gap: 0 0.9rem; }
  .brk-grid .brk-wide { grid-column: 1 / -1; }
  .brk-hint { color: var(--text-muted); font-size: 0.75rem; margin-top: 0.25rem; }
  .brk-section { border-top: 1px solid var(--border); margin-top: 1rem; padding-top: 0.9rem; }
  .brk-section-title { font-weight: 700; margin-bottom: 0.2rem; }
  .brk-list { display: flex; flex-direction: column; gap: 0.4rem; margin: 0.6rem 0; }
  .brk-item { display: flex; align-items: center; gap: 0.6rem; border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 0.65rem; background: var(--surface); }
  .brk-item-main { flex: 1; min-width: 0; }
  .brk-item-main .brk-name { font-size: 0.85rem; overflow-wrap: anywhere; }
  .brk-item .num { font-size: 0.8rem; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .brk-empty { color: var(--text-muted); font-size: 0.82rem; }
  .brk-hits { max-height: 16rem; overflow-y: auto; }
  .brk-inline { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
  .brk-inline input[type=text], .brk-inline input[type=url] { flex: 1; min-width: 10rem; }
  .brk-error { color: var(--danger, #c0000a); font-size: 0.85rem; margin-top: 0.75rem; }
  .brk-ok { color: #15803d; font-size: 0.85rem; margin-top: 0.75rem; }
  .brk-danger { color: var(--danger, #c0000a); }
`;

function brokeragesPageMarkup(): string {
  return `
        <div class="card" style="margin-bottom:1rem">
          <div class="brk-head">
            <div style="flex:1;min-width:min(16rem,100%)">
              <div style="font-weight:700">Brokerage Partnerships${infoTip(
                `<p>The brokerages we have an agreement with, and the ones we want to sign next. Each one links
                   every Spiro company that belongs to it — most brokerages have one per office — so its order
                   count and revenue are the whole brokerage's this year.</p>
                 <p>Open one to set its order page, keep its contract and other documents, and note what was
                   agreed.</p>`,
                { label: "About brokerage partnerships" },
              )}</div>
              <p class="brk-sync" id="brk-sync"></p>
            </div>
            <div class="brk-head-actions">
              <button type="button" class="btn btn-ghost" id="brk-refresh" title="Read this year's Spiro orders again now. Totals also refresh on their own every 6 hours.">Refresh totals</button>
              <button type="button" class="btn btn-ghost" id="brk-pages-open">Order pages</button>
              <button type="button" class="btn btn-primary" id="brk-new">Add brokerage</button>
            </div>
          </div>
        </div>

        <div class="brk-stats" id="brk-stats"></div>

        <div class="card">
          <div class="brk-bar">
            <input id="brk-search" class="brk-search" type="search" placeholder="Search brokerage, market, BDS or Spiro company…" />
            <select id="brk-view">
              <option value="agreements">Agreements</option>
              <option value="active">Active agreements</option>
              <option value="targets">Targets</option>
              <option value="all">All</option>
            </select>
            <span class="brk-count" id="brk-count"></span>
          </div>
          <div class="brk-table-wrap">
            <table class="brk-table">
              <thead>
                <tr>
                  <th>Brokerage</th>
                  <th>Stage</th>
                  <th>Order page</th>
                  <th class="num">Spiro companies</th>
                  <th class="num" id="brk-th-orders">Orders YTD</th>
                  <th class="num" id="brk-th-revenue">Revenue YTD</th>
                  <th>Renews</th>
                  <th class="num">Documents</th>
                </tr>
              </thead>
              <tbody id="brk-body"><tr><td colspan="8" class="brk-empty">Loading…</td></tr></tbody>
            </table>
          </div>
        </div>`;
}

export const BROKERAGES_MARKUP = `
      <!-- Brokerage partnerships: agreements, targets, order pages, documents -->
      <div id="page-brokerages" class="page hidden">
${brokeragesPageMarkup()}
      </div>`;

export const BROKERAGES_PORTAL_MARKUP = `
    <div id="page-brokerages" class="page">
      <div class="topbar"><h2>Brokerage Partnerships</h2></div>
      <div class="page-scroll">
${brokeragesPageMarkup()}
      </div>
    </div>`;

export const BROKERAGES_MODALS = `
<div id="brk-modal" class="modal-backdrop hidden">
  <div class="modal brk-modal-box">
    <div class="modal-title" id="brk-modal-title">Add brokerage</div>
    <div class="brk-grid">
      <div class="form-group brk-wide">
        <label for="brk-name">Brokerage</label>
        <input id="brk-name" type="text" placeholder="Coldwell Banker Heritage" />
        <p class="brk-hint">The brokerage as a whole. Its offices are linked under Spiro companies below.</p>
      </div>
      <div class="form-group">
        <label for="brk-stage">Stage</label>
        <select id="brk-stage">
          <option value="target">Target — want an agreement</option>
          <option value="negotiating">Negotiating</option>
          <option value="active">Active agreement</option>
          <option value="expired">Expired agreement</option>
        </select>
        <p class="brk-hint">Targets and negotiations sit on the Targets list; active and expired are agreements.</p>
      </div>
      <div class="form-group">
        <label for="brk-order-page">Order page</label>
        <select id="brk-order-page"></select>
        <p class="brk-hint">The page this brokerage's agents order from. Add or rename pages under Order pages.</p>
      </div>
      <div class="form-group">
        <label for="brk-market">Market</label>
        <input id="brk-market" type="text" placeholder="Dayton" />
      </div>
      <div class="form-group">
        <label for="brk-owner">BDS</label>
        <input id="brk-owner" type="text" placeholder="Who looks after the relationship" />
      </div>
      <div class="form-group">
        <label for="brk-signed">Signed on</label>
        <input id="brk-signed" type="date" />
      </div>
      <div class="form-group">
        <label for="brk-renews">Renews or ends on</label>
        <input id="brk-renews" type="date" />
        <p class="brk-hint">Flagged on the list 60 days ahead.</p>
      </div>
      <div class="form-group">
        <label for="brk-contact-name">Brokerage contact</label>
        <input id="brk-contact-name" type="text" placeholder="Managing broker or office manager" />
      </div>
      <div class="form-group">
        <label for="brk-contact-email">Contact email</label>
        <input id="brk-contact-email" type="email" />
      </div>
      <div class="form-group">
        <label for="brk-contact-phone">Contact phone</label>
        <input id="brk-contact-phone" type="tel" />
      </div>
      <div class="form-group brk-wide">
        <label for="brk-terms">What was agreed</label>
        <textarea id="brk-terms" rows="3" placeholder="Pricing, exclusivity, marketing commitments, who pays"></textarea>
        <p class="brk-hint">The terms in a sentence or two, so nobody has to open the contract to answer a question.</p>
      </div>
      <div class="form-group brk-wide">
        <label for="brk-notes">Notes</label>
        <textarea id="brk-notes" rows="2" placeholder="For a target: who we have spoken to and what is next"></textarea>
      </div>
    </div>

    <div class="brk-section">
      <div class="brk-section-title">Spiro companies</div>
      <p class="brk-hint" style="margin:0">Add every Spiro company that belongs to this brokerage — each office and team is usually its own — so the totals cover all of it.</p>
      <div class="brk-list" id="brk-co-list"></div>
      <input id="brk-co-search" type="search" placeholder="Search Spiro companies by name…" />
      <div class="brk-list brk-hits" id="brk-co-results"></div>
    </div>

    <div class="brk-section">
      <div class="brk-section-title">Documents</div>
      <p class="brk-hint" style="margin:0" id="brk-doc-hint">The signed agreement, amendments, rate sheets. PDF, Word, Excel, PowerPoint or an image, up to 15 MB each.</p>
      <div class="brk-list" id="brk-doc-list"></div>
      <div class="brk-inline" id="brk-doc-new">
        <input id="brk-doc-title" type="text" placeholder="What it is (optional), e.g. Signed agreement 2026" />
        <input id="brk-doc-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.heic" />
        <button type="button" class="btn btn-sm btn-primary" id="brk-doc-upload">Upload</button>
      </div>
    </div>

    <div id="brk-modal-msg" class="hidden"></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost brk-danger hidden" id="brk-delete">Delete</button>
      <span style="flex:1"></span>
      <button type="button" class="btn btn-ghost" id="brk-cancel">Close</button>
      <button type="button" class="btn btn-primary" id="brk-save">Save</button>
    </div>
  </div>
</div>

<div id="brk-pages-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:640px">
    <div class="modal-title">Order pages</div>
    <p class="brk-hint" style="margin:0 0 0.5rem">The pages brokerages order from. Each agreement picks one, so a page is spelled the same way everywhere and its link opens it.</p>
    <div class="brk-list" id="brk-pages-list"></div>
    <div class="brk-section">
      <div class="brk-section-title">Add a page</div>
      <div class="brk-inline" style="margin-top:0.5rem">
        <input id="brk-page-name" type="text" placeholder="Name, e.g. Coldwell Banker Heritage pricing" />
        <input id="brk-page-url" type="url" placeholder="https://…" />
        <button type="button" class="btn btn-sm btn-primary" id="brk-page-add">Add</button>
      </div>
    </div>
    <div id="brk-pages-msg" class="brk-error hidden"></div>
    <div class="modal-actions">
      <span style="flex:1"></span>
      <button type="button" class="btn btn-ghost" id="brk-pages-close">Close</button>
    </div>
  </div>
</div>`;

export const BROKERAGES_COMPONENT_JS = `
  var brkRows = [];
  var brkPages = [];
  var brkSummary = null;
  var brkSync = null;
  var brkYear = null;
  var brkOpen = null;
  var brkDraftCompanies = [];
  var brkDocs = [];
  var brkHits = [];
  var brkSearchTimer = null;
  var brkCoTimer = null;
  var BRK_STAGES = { target: 'Target', negotiating: 'Negotiating', active: 'Active', expired: 'Expired' };
  var BRK_MAX_FILE = 15 * 1024 * 1024;

  function brkMoney(cents){ return '$' + Math.round((cents || 0) / 100).toLocaleString('en-US'); }
  function brkNum(n){ return Number(n || 0).toLocaleString('en-US'); }
  function brkVal(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function brkSet(id, v){ var el = document.getElementById(id); if(el) el.value = v || ''; }

  function brkAgo(ts){
    if(!ts) return 'never';
    var mins = Math.round((Date.now() - ts) / 60000);
    if(mins < 1) return 'just now';
    if(mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    var hrs = Math.round(mins / 60);
    if(hrs < 36) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    return Math.round(hrs / 24) + ' days ago';
  }

  function brkDate(ymd){
    if(!ymd) return '';
    var p = ymd.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  function brkDaysUntil(ymd){
    var p = ymd.split('-');
    var now = new Date();
    return Math.round((Date.UTC(+p[0], +p[1] - 1, +p[2]) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  }

  function brkSize(bytes){
    if(bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  function brkCanDelete(){ return typeof isAdmin === 'function' && isAdmin(); }

  async function loadBrokerages(){
    var r = await api('GET', '/brokerages');
    if(!r.ok){
      document.getElementById('brk-body').innerHTML = '<tr><td colspan="8" class="brk-empty">Could not load brokerages.</td></tr>';
      return;
    }
    brkRows = r.data.agreements || [];
    brkPages = r.data.orderPages || [];
    brkSummary = r.data.summary || null;
    brkSync = r.data.sync || null;
    brkYear = r.data.year || new Date().getFullYear();
    renderBrokerageStats();
    renderBrokerageSync();
    renderBrokerageTable();
  }

  function renderBrokerageStats(){
    var el = document.getElementById('brk-stats');
    if(!brkSummary){ el.innerHTML = ''; return; }
    var tiles = [
      ['Active agreements', brkNum(brkSummary.activeCount)],
      ['Orders ' + brkYear + ' (active)', brkNum(brkSummary.activeYtdOrders)],
      ['Revenue ' + brkYear + ' (active)', brkMoney(brkSummary.activeYtdRevenueCents)],
      ['Renewing in 60 days', brkNum(brkSummary.renewingSoonCount)],
      ['Targets', brkNum(brkSummary.targetCount)]
    ];
    el.innerHTML = tiles.map(function(t){
      return '<div class="brk-stat"><div class="brk-stat-label">' + esc(t[0]) + '</div><div class="brk-stat-value">' + esc(t[1]) + '</div></div>';
    }).join('');
    document.getElementById('brk-th-orders').textContent = 'Orders ' + brkYear;
    document.getElementById('brk-th-revenue').textContent = 'Revenue ' + brkYear;
  }

  function renderBrokerageSync(){
    var el = document.getElementById('brk-sync');
    if(!el) return;
    var s = brkSync || {};
    var html = '';
    if(s.refreshedAt){
      html = esc('Totals count every order placed in ' + brkYear + ' except cancelled ones, at the order total — ' +
        brkNum(s.ordersRead) + ' orders read from Spiro ' + brkAgo(s.refreshedAt) + '. They refresh every 6 hours.');
    } else {
      html = esc('This year' + "'" + 's Spiro orders have not been read yet, so every total shows zero. Press Refresh totals.');
    }
    if(s.error && (!s.refreshedAt || (s.attemptedAt || 0) > s.refreshedAt)){
      html += ' <span class="brk-warn">' + esc('The last read failed ' + brkAgo(s.attemptedAt) + ': ' + s.error) + '</span>';
    }
    if(s.running) html += ' <span class="brk-warn">Reading now…</span>';
    el.innerHTML = html;
  }

  function brkMatches(a, view, q){
    var signed = a.stage === 'active' || a.stage === 'expired';
    if(view === 'agreements' && !signed) return false;
    if(view === 'active' && a.stage !== 'active') return false;
    if(view === 'targets' && signed) return false;
    if(!q) return true;
    var hay = [a.name, a.market, a.ownerName, a.contactName].concat(a.companies.map(function(c){ return c.companyName; }))
      .filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function renderBrokerageTable(){
    var view = document.getElementById('brk-view').value;
    var q = brkVal('brk-search').toLowerCase();
    var rows = brkRows.filter(function(a){ return brkMatches(a, view, q); })
      .sort(function(x, y){ return (y.ytdRevenueCents - x.ytdRevenueCents) || x.name.localeCompare(y.name); });
    document.getElementById('brk-count').textContent = rows.length + (rows.length === 1 ? ' brokerage' : ' brokerages');
    var body = document.getElementById('brk-body');
    if(rows.length === 0){
      var empty = brkRows.length === 0
        ? 'No brokerages yet. Press Add brokerage to record an agreement or a target.'
        : 'Nothing matches.';
      body.innerHTML = '<tr><td colspan="8" class="brk-empty">' + esc(empty) + '</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function(a){
      var sub = [a.market, a.ownerName].filter(Boolean).join(' · ');
      var page = a.orderPage
        ? (a.orderPage.url
            ? '<a href="' + esc(a.orderPage.url) + '" target="_blank" rel="noopener" class="brk-stop">' + esc(a.orderPage.name) + '</a>'
            : esc(a.orderPage.name))
        : '<span class="text-muted">—</span>';
      var renews = '<span class="text-muted">—</span>';
      if(a.renewsOn){
        renews = esc(brkDate(a.renewsOn));
        if(a.stage === 'active'){
          var days = brkDaysUntil(a.renewsOn);
          if(days < 0) renews += '<span class="brk-due is-past">' + esc((-days) + ' days past') + '</span>';
          else if(days <= 60) renews += '<span class="brk-due">' + esc(days === 0 ? 'today' : 'in ' + days + ' days') + '</span>';
        }
      }
      var names = a.companies.map(function(c){ return c.companyName; }).join(', ');
      return '<tr class="brk-row" data-id="' + esc(a.id) + '">' +
        '<td><div class="brk-name">' + esc(a.name) + '</div>' + (sub ? '<div class="brk-sub">' + esc(sub) + '</div>' : '') + '</td>' +
        '<td><span class="brk-stage brk-stage-' + esc(a.stage) + '">' + esc(BRK_STAGES[a.stage] || a.stage) + '</span></td>' +
        '<td>' + page + '</td>' +
        '<td class="num" title="' + esc(names) + '">' + (a.companies.length ? brkNum(a.companies.length) : '<span class="brk-warn">none</span>') + '</td>' +
        '<td class="num">' + brkNum(a.ytdOrders) + '</td>' +
        '<td class="num">' + brkMoney(a.ytdRevenueCents) + '</td>' +
        '<td>' + renews + '</td>' +
        '<td class="num">' + brkNum(a.documentCount) + '</td>' +
      '</tr>';
    }).join('');
    body.querySelectorAll('.brk-row').forEach(function(tr){
      tr.addEventListener('click', function(ev){
        if(ev.target && ev.target.closest && ev.target.closest('.brk-stop')) return;
        openBrokerage(tr.getAttribute('data-id'));
      });
    });
  }

  function brkMsg(text, ok){
    var el = document.getElementById('brk-modal-msg');
    el.className = text ? (ok ? 'brk-ok' : 'brk-error') : 'hidden';
    el.textContent = text || '';
  }

  function brkFillPageSelect(selected){
    document.getElementById('brk-order-page').innerHTML = '<option value="">Not set</option>' +
      brkPages.map(function(p){
        return '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('');
  }

  function brkFillForm(a){
    brkOpen = a;
    document.getElementById('brk-modal-title').textContent = a ? a.name : 'Add brokerage';
    brkSet('brk-name', a && a.name);
    document.getElementById('brk-stage').value = (a && a.stage) || 'target';
    brkFillPageSelect(a && a.orderPageId);
    brkSet('brk-market', a && a.market);
    brkSet('brk-owner', a && a.ownerName);
    brkSet('brk-signed', a && a.signedOn);
    brkSet('brk-renews', a && a.renewsOn);
    brkSet('brk-contact-name', a && a.contactName);
    brkSet('brk-contact-email', a && a.contactEmail);
    brkSet('brk-contact-phone', a && a.contactPhone);
    brkSet('brk-terms', a && a.terms);
    brkSet('brk-notes', a && a.notes);
    brkDraftCompanies = a ? a.companies.slice() : [];
    document.getElementById('brk-delete').classList.toggle('hidden', !(a && brkCanDelete()));
    renderBrokerageCompanies();
    renderBrokerageDocs();
  }

  async function openBrokerage(id){
    brkMsg('');
    brkHits = [];
    brkSet('brk-co-search', '');
    document.getElementById('brk-co-results').innerHTML = '';
    if(!id){
      brkDocs = [];
      brkFillForm(null);
      document.getElementById('brk-modal').classList.remove('hidden');
      document.getElementById('brk-name').focus();
      return;
    }
    var r = await api('GET', '/brokerages/' + encodeURIComponent(id));
    if(!r.ok){ alert('Could not open that brokerage.'); return; }
    brkDocs = r.data.documents || [];
    brkFillForm(r.data.agreement);
    document.getElementById('brk-modal').classList.remove('hidden');
  }

  function renderBrokerageCompanies(){
    var box = document.getElementById('brk-co-list');
    if(brkDraftCompanies.length === 0){
      box.innerHTML = '<div class="brk-empty">None linked yet, so this brokerage shows no orders.</div>';
      return;
    }
    box.innerHTML = brkDraftCompanies.map(function(c, i){
      var ytd = (c.ytdOrders !== undefined)
        ? '<span class="num">' + brkNum(c.ytdOrders) + ' orders · ' + brkMoney(c.ytdRevenueCents) + '</span>'
        : '<span class="num text-muted">totals after saving</span>';
      return '<div class="brk-item"><div class="brk-item-main"><div class="brk-name">' + esc(c.companyName) + '</div>' +
        (c.serviceArea ? '<div class="brk-sub">' + esc(c.serviceArea) + '</div>' : '') + '</div>' + ytd +
        '<button type="button" class="btn btn-sm btn-ghost brk-co-remove" data-i="' + i + '">Remove</button></div>';
    }).join('');
    box.querySelectorAll('.brk-co-remove').forEach(function(b){
      b.addEventListener('click', function(){
        brkDraftCompanies.splice(Number(b.getAttribute('data-i')), 1);
        renderBrokerageCompanies();
        renderBrokerageHits();
      });
    });
  }

  function brkLinked(companyId){
    return brkDraftCompanies.some(function(c){ return c.companyId === companyId; });
  }

  function renderBrokerageHits(){
    var box = document.getElementById('brk-co-results');
    if(!brkHits.length){ box.innerHTML = ''; return; }
    box.innerHTML = brkHits.map(function(h, i){
      var where = [h.city, h.serviceArea ? 'service area ' + h.serviceArea : null, h.agentCount !== null ? h.agentCount + ' agents' : null].filter(Boolean).join(' · ');
      var button = brkLinked(h.companyId)
        ? '<span class="brk-sub">Linked</span>'
        : '<button type="button" class="btn btn-sm btn-primary brk-co-add" data-i="' + i + '">Add</button>';
      return '<div class="brk-item"><div class="brk-item-main"><div class="brk-name">' + esc(h.name) + '</div>' +
        (where ? '<div class="brk-sub">' + esc(where) + '</div>' : '') + '</div>' +
        '<span class="num">' + brkNum(h.ytdOrders) + ' orders · ' + brkMoney(h.ytdRevenueCents) + '</span>' + button + '</div>';
    }).join('');
    box.querySelectorAll('.brk-co-add').forEach(function(b){
      b.addEventListener('click', function(){
        var h = brkHits[Number(b.getAttribute('data-i'))];
        if(!h || brkLinked(h.companyId)) return;
        brkDraftCompanies.push({ companyId: h.companyId, companyName: h.name, serviceArea: h.serviceArea, ytdOrders: h.ytdOrders, ytdRevenueCents: h.ytdRevenueCents });
        renderBrokerageCompanies();
        renderBrokerageHits();
      });
    });
  }

  async function searchBrokerageCompanies(){
    var q = brkVal('brk-co-search');
    var box = document.getElementById('brk-co-results');
    if(q.length < 2){ brkHits = []; box.innerHTML = ''; return; }
    box.innerHTML = '<div class="brk-empty">Searching Spiro…</div>';
    var r = await api('GET', '/brokerages/spiro-companies?q=' + encodeURIComponent(q));
    if(brkVal('brk-co-search') !== q) return;
    if(!r.ok){
      brkHits = [];
      box.innerHTML = '<div class="brk-error">' + esc('Spiro could not be searched: ' + ((r.data && r.data.error) || 'unknown error')) + '</div>';
      return;
    }
    brkHits = r.data.companies || [];
    if(!brkHits.length){ box.innerHTML = '<div class="brk-empty">No active Spiro company has that in its name.</div>'; return; }
    renderBrokerageHits();
  }

  function renderBrokerageDocs(){
    var saved = !!brkOpen;
    document.getElementById('brk-doc-new').classList.toggle('hidden', !saved);
    var box = document.getElementById('brk-doc-list');
    if(!saved){
      box.innerHTML = '<div class="brk-empty">Save the brokerage first, then add its documents here.</div>';
      return;
    }
    if(!brkDocs.length){
      box.innerHTML = '<div class="brk-empty">No documents yet.</div>';
      return;
    }
    box.innerHTML = brkDocs.map(function(d){
      var meta = [d.title ? d.filename : null, brkSize(d.byteSize), d.uploadedBy ? 'added by ' + d.uploadedBy : null,
        new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })].filter(Boolean).join(' · ');
      return '<div class="brk-item"><div class="brk-item-main"><div class="brk-name">' + esc(d.title || d.filename) + '</div>' +
        '<div class="brk-sub">' + esc(meta) + '</div></div>' +
        '<button type="button" class="btn btn-sm btn-ghost brk-doc-get" data-id="' + esc(d.id) + '">Download</button>' +
        '<button type="button" class="btn btn-sm btn-ghost brk-danger brk-doc-del" data-id="' + esc(d.id) + '">Delete</button></div>';
    }).join('');
    box.querySelectorAll('.brk-doc-get').forEach(function(b){
      b.addEventListener('click', function(){ downloadBrokerageDoc(b.getAttribute('data-id')); });
    });
    box.querySelectorAll('.brk-doc-del').forEach(function(b){
      b.addEventListener('click', function(){ deleteBrokerageDoc(b.getAttribute('data-id')); });
    });
  }

  async function downloadBrokerageDoc(id){
    var doc = brkDocs.filter(function(d){ return d.id === id; })[0];
    var res = await fetch('/api/admin/brokerages/documents/' + encodeURIComponent(id) + '/file', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if(!res.ok){ alert('Could not download that document.'); return; }
    var blob = await res.blob();
    var objectUrl = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = objectUrl;
    a.download = (doc && doc.filename) || 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function deleteBrokerageDoc(id){
    var doc = brkDocs.filter(function(d){ return d.id === id; })[0];
    if(!confirm('Delete ' + ((doc && (doc.title || doc.filename)) || 'this document') + '? It cannot be recovered.')) return;
    var r = await api('DELETE', '/brokerages/documents/' + encodeURIComponent(id));
    if(!r.ok){ alert('Could not delete it: ' + ((r.data && r.data.error) || 'unknown error')); return; }
    brkDocs = brkDocs.filter(function(d){ return d.id !== id; });
    renderBrokerageDocs();
    loadBrokerages();
  }

  async function uploadBrokerageDoc(){
    if(!brkOpen) return;
    var input = document.getElementById('brk-doc-file');
    var file = input.files && input.files[0];
    if(!file){ alert('Choose a file first.'); return; }
    if(file.size > BRK_MAX_FILE){ alert('That file is larger than 15 MB.'); return; }
    var btn = document.getElementById('brk-doc-upload');
    btn.disabled = true;
    btn.textContent = 'Uploading…';
    var dataUrl = await new Promise(function(resolve){
      var reader = new FileReader();
      reader.onload = function(){ resolve(reader.result); };
      reader.onerror = function(){ resolve(null); };
      reader.readAsDataURL(file);
    });
    if(!dataUrl){
      btn.disabled = false; btn.textContent = 'Upload';
      alert('Could not read that file.');
      return;
    }
    var r = await api('POST', '/brokerages/' + encodeURIComponent(brkOpen.id) + '/documents', {
      filename: file.name, title: brkVal('brk-doc-title') || null, data: String(dataUrl)
    });
    btn.disabled = false;
    btn.textContent = 'Upload';
    if(!r.ok){ alert('Could not upload it: ' + ((r.data && r.data.error) || 'unknown error')); return; }
    brkDocs = r.data.documents || brkDocs;
    input.value = '';
    brkSet('brk-doc-title', '');
    renderBrokerageDocs();
    loadBrokerages();
  }

  async function saveBrokerage(){
    var payload = {
      name: brkVal('brk-name'),
      stage: document.getElementById('brk-stage').value,
      orderPageId: document.getElementById('brk-order-page').value || null,
      market: brkVal('brk-market'),
      ownerName: brkVal('brk-owner'),
      signedOn: brkVal('brk-signed') || null,
      renewsOn: brkVal('brk-renews') || null,
      contactName: brkVal('brk-contact-name'),
      contactEmail: brkVal('brk-contact-email'),
      contactPhone: brkVal('brk-contact-phone'),
      terms: brkVal('brk-terms'),
      notes: brkVal('brk-notes'),
      companies: brkDraftCompanies.map(function(c){ return { companyId: c.companyId, companyName: c.companyName, serviceArea: c.serviceArea || null }; })
    };
    if(!payload.name){ brkMsg('A brokerage name is required.'); return; }
    var creating = !brkOpen;
    var btn = document.getElementById('brk-save');
    btn.disabled = true;
    var r = creating
      ? await api('POST', '/brokerages', payload)
      : await api('PUT', '/brokerages/' + encodeURIComponent(brkOpen.id), payload);
    btn.disabled = false;
    if(!r.ok){ brkMsg('Could not save: ' + ((r.data && r.data.error) || 'unknown error')); return; }
    loadBrokerages();
    if(creating){
      brkDocs = r.data.documents || [];
      brkFillForm(r.data.agreement);
      brkMsg('Saved. You can add its documents below now.', true);
      return;
    }
    closeBrokerage();
  }

  async function deleteBrokerage(){
    if(!brkOpen) return;
    var docs = brkDocs.length;
    if(!confirm('Delete ' + brkOpen.name + (docs ? ' and its ' + docs + (docs === 1 ? ' document' : ' documents') : '') + '? This cannot be undone.')) return;
    var r = await api('DELETE', '/brokerages/' + encodeURIComponent(brkOpen.id));
    if(!r.ok){ brkMsg('Could not delete: ' + ((r.data && r.data.error) || 'unknown error')); return; }
    closeBrokerage();
    loadBrokerages();
  }

  function closeBrokerage(){
    document.getElementById('brk-modal').classList.add('hidden');
    brkOpen = null;
    brkHits = [];
  }

  async function refreshBrokerageTotals(){
    var btn = document.getElementById('brk-refresh');
    btn.disabled = true;
    btn.textContent = 'Reading this year' + "'" + 's orders…';
    var r = await api('POST', '/brokerages/refresh', {});
    btn.disabled = false;
    btn.textContent = 'Refresh totals';
    if(!r.ok) alert('Spiro could not be read: ' + ((r.data && r.data.error) || 'unknown error'));
    await loadBrokerages();
  }

  // ── Order pages ──
  function brkPagesMsg(text){
    var el = document.getElementById('brk-pages-msg');
    el.classList.toggle('hidden', !text);
    el.textContent = text || '';
  }

  function renderOrderPages(){
    var box = document.getElementById('brk-pages-list');
    if(!brkPages.length){ box.innerHTML = '<div class="brk-empty">No order pages yet.</div>'; return; }
    box.innerHTML = brkPages.map(function(p){
      var used = brkRows.filter(function(a){ return a.orderPageId === p.id; }).length;
      return '<div class="brk-item" style="flex-wrap:wrap"><div class="brk-inline" style="flex:1">' +
        '<input type="text" class="brk-page-edit-name" data-id="' + esc(p.id) + '" value="' + esc(p.name) + '" />' +
        '<input type="url" class="brk-page-edit-url" data-id="' + esc(p.id) + '" value="' + esc(p.url || '') + '" placeholder="https://…" /></div>' +
        '<span class="brk-sub">' + esc(used + (used === 1 ? ' brokerage' : ' brokerages')) + '</span>' +
        '<button type="button" class="btn btn-sm btn-ghost brk-page-save" data-id="' + esc(p.id) + '">Save</button>' +
        '<button type="button" class="btn btn-sm btn-ghost brk-danger brk-page-del" data-id="' + esc(p.id) + '">Delete</button></div>';
    }).join('');
    box.querySelectorAll('.brk-page-save').forEach(function(b){
      b.addEventListener('click', async function(){
        var id = b.getAttribute('data-id');
        var name = box.querySelector('.brk-page-edit-name[data-id="' + id + '"]').value.trim();
        var url = box.querySelector('.brk-page-edit-url[data-id="' + id + '"]').value.trim();
        var r = await api('PUT', '/brokerages/order-pages/' + encodeURIComponent(id), { name: name, url: url || null });
        if(!r.ok){ brkPagesMsg((r.data && r.data.error) || 'Could not save that page.'); return; }
        brkPagesMsg('');
        await loadBrokerages();
        renderOrderPages();
      });
    });
    box.querySelectorAll('.brk-page-del').forEach(function(b){
      b.addEventListener('click', async function(){
        var id = b.getAttribute('data-id');
        var used = brkRows.filter(function(a){ return a.orderPageId === id; }).length;
        if(!confirm(used ? 'Delete this page? ' + used + (used === 1 ? ' brokerage uses' : ' brokerages use') + ' it and will show no order page.' : 'Delete this page?')) return;
        var r = await api('DELETE', '/brokerages/order-pages/' + encodeURIComponent(id));
        if(!r.ok){ brkPagesMsg((r.data && r.data.error) || 'Could not delete that page.'); return; }
        await loadBrokerages();
        renderOrderPages();
      });
    });
  }

  async function addOrderPage(){
    var name = brkVal('brk-page-name');
    var url = brkVal('brk-page-url');
    if(!name){ brkPagesMsg('Give the page a name.'); return; }
    var r = await api('POST', '/brokerages/order-pages', { name: name, url: url || null });
    if(!r.ok){ brkPagesMsg((r.data && r.data.error) || 'Could not add that page.'); return; }
    brkPagesMsg('');
    brkSet('brk-page-name', '');
    brkSet('brk-page-url', '');
    await loadBrokerages();
    renderOrderPages();
    // Opened from inside an agreement: keep its picker current.
    if(!document.getElementById('brk-modal').classList.contains('hidden')){
      brkFillPageSelect(document.getElementById('brk-order-page').value);
    }
  }

  function brkOn(id, ev, fn){
    var el = document.getElementById(id);
    if(el) el.addEventListener(ev, fn);
  }

  brkOn('brk-new', 'click', function(){ openBrokerage(null); });
  brkOn('brk-refresh', 'click', refreshBrokerageTotals);
  brkOn('brk-save', 'click', saveBrokerage);
  brkOn('brk-cancel', 'click', closeBrokerage);
  brkOn('brk-delete', 'click', deleteBrokerage);
  brkOn('brk-doc-upload', 'click', uploadBrokerageDoc);
  brkOn('brk-view', 'change', renderBrokerageTable);
  brkOn('brk-search', 'input', function(){
    clearTimeout(brkSearchTimer);
    brkSearchTimer = setTimeout(renderBrokerageTable, 150);
  });
  brkOn('brk-co-search', 'input', function(){
    clearTimeout(brkCoTimer);
    brkCoTimer = setTimeout(searchBrokerageCompanies, 300);
  });
  brkOn('brk-pages-open', 'click', function(){
    brkPagesMsg('');
    renderOrderPages();
    document.getElementById('brk-pages-modal').classList.remove('hidden');
  });
  brkOn('brk-pages-close', 'click', function(){
    document.getElementById('brk-pages-modal').classList.add('hidden');
  });
  brkOn('brk-page-add', 'click', addOrderPage);
`;
