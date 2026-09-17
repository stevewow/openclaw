// The new-listing queue, as markup and inline JS shared by both signed-in
// surfaces. The dashboard and the portal have no view code in common, so a
// section built in one is invisible in the other — and this one is a VA's
// section before it is an admin's, so the portal is the surface that matters.
//
// The page is a worklist, not a report: every row is a decision — research it,
// send it to the BDS, or set it aside — and the point of the layout is that the
// decision is obvious without opening anything.
//
// The inline JS below lives in a template literal, which eats backslashes: no
// regex escapes and no backslashes in its comments.

import { infoTip } from "./info-tip.js";

export const LISTINGS_CSS = `
  .lst-head { display: flex; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .lst-head-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .lst-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); }
  .lst-search { flex: 1; min-width: 12rem; }
  .lst-count { color: var(--text-muted); font-size: 0.82rem; margin-left: auto; }
  .lst-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
  .lst-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem 0.9rem; }
  .lst-stat-label { color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .lst-stat-value { font-size: 1.45rem; font-weight: 700; margin-top: 0.15rem; }
  .lst-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(21rem, 100%), 1fr)); gap: 0.85rem; padding: 1rem; }
  .lst-card { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); display: flex; flex-direction: column; }
  .lst-card.is-ours { border-color: #93c5fd; }
  .lst-photo { width: 100%; height: 9.5rem; object-fit: cover; background: #f1f1f1; display: block; }
  .lst-no-photo { width: 100%; height: 9.5rem; background: #f1f1f1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.8rem; }
  .lst-body { padding: 0.8rem 0.9rem; flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
  .lst-addr { font-weight: 700; font-size: 0.95rem; line-height: 1.3; }
  .lst-meta { color: var(--text-muted); font-size: 0.8rem; }
  .lst-agent { font-size: 0.85rem; margin-top: 0.15rem; }
  .lst-agent strong { font-weight: 700; }
  .lst-when { font-size: 0.75rem; font-weight: 700; color: #15803d; }
  .lst-badges { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .lst-known { display: inline-block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 5px; background: #fef3c7; color: #92400e; }
  .lst-new-agent { display: inline-block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 5px; background: #dcfce7; color: #166534; }
  .lst-ours { display: inline-block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 5px; background: #dbeafe; color: #1e40af; }
  .lst-ours-note { font-size: 0.78rem; color: #1e40af; line-height: 1.35; }
  .lst-ours-note a { color: inherit; font-weight: 600; }
  .lst-actions { display: flex; gap: 0.4rem; padding: 0.7rem 0.9rem; border-top: 1px solid var(--border); }
  .lst-actions .btn { flex: 1; }
  .lst-sent { padding: 0.7rem 0.9rem; border-top: 1px solid var(--border); font-size: 0.8rem; color: var(--text-muted); }
  .lst-sweep { color: var(--text-muted); font-size: 0.8rem; }
  .lst-warn { color: #b45309; font-weight: 600; font-size: 0.82rem; }
`;

/**
 * The queue itself. `canSweep` is the admin's: a sweep spends metered credits,
 * and a Refresh button anyone can lean on is a balance nobody can rely on. The
 * Spiro check costs no credits, so it is everybody's.
 */
export function listingsQueueMarkup(opts: { canSweep: boolean }): string {
  const sweepButton = opts.canSweep
    ? `<button type="button" class="btn btn-primary" id="lst-refresh">Refresh listings</button>`
    : "";
  return `
        <div class="card" style="margin-bottom:1rem">
          <div class="lst-head">
            <div style="flex:1;min-width:min(16rem,100%)">
              <div style="font-weight:700">New Listings${infoTip(
                `<p>Houses that went on the market in our markets in the last day, and who listed them.
                   Research one, and if the agent is worth a call send it to whoever owns that market — it
                   becomes a lead, they get the email, and the follow-up lands in Pipedrive.</p>
                 <p>A house we already have a Spiro order for from the last 90 days moves to Already our order, so
                   nobody prospects a client about their own shoot.</p>`,
                { label: "About new listings" },
              )}</div>
              <p class="lst-sweep" id="lst-sweep-note" style="margin:0.5rem 0 0"></p>
            </div>
            <div class="lst-head-actions">
              <button type="button" class="btn btn-ghost" id="lst-spiro-check" title="Read new Spiro orders and re-flag the open listings. No listing credits.">Check Spiro orders</button>
              ${sweepButton}
            </div>
          </div>
        </div>

        <div class="lst-stats" id="lst-stats"></div>

        <div class="card">
          <div class="lst-bar">
            <input id="lst-search" class="lst-search" type="search" placeholder="Search address, agent or brokerage…" />
            <select id="lst-status">
              <option value="new">To work</option>
              <option value="ours">Already our order</option>
              <option value="sent">Sent</option>
              <option value="dismissed">Set aside</option>
              <option value="all">All</option>
            </select>
            <select id="lst-territory"><option value="">All markets</option></select>
            <select id="lst-hours">
              <option value="24">Last 24 hours</option>
              <option value="72">Last 3 days</option>
              <option value="168">Last week</option>
              <option value="">Any time</option>
            </select>
            <span class="lst-count" id="lst-count"></span>
          </div>
          <div class="lst-cards" id="lst-cards"><div class="empty-state">Loading…</div></div>
        </div>`;
}

export const LISTINGS_MARKUP = `
      <!-- The prospecting queue: what just hit the market, and who listed it -->
      <div id="page-listings" class="page hidden">
${listingsQueueMarkup({ canSweep: true })}
      </div>`;

export const LISTINGS_PORTAL_MARKUP = `
    <div id="page-listings" class="page">
      <div class="topbar"><h2>New Listings</h2></div>
      <div class="page-scroll">
${listingsQueueMarkup({ canSweep: false })}
      </div>
    </div>`;

/**
 * Sending one on.
 *
 * The form opens prefilled with everything the feed knew and asks for the one
 * thing it never carries: a way to reach the agent. That is the research step
 * — the feed has no phone number and no email address, ever — so the field is
 * required here exactly as it is everywhere else a lead is made.
 */
export const LISTING_SEND_MODAL = `
<div id="lst-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:560px">
    <div class="modal-title">Send to the BDS</div>
    <p class="text-muted" style="font-size:0.82rem;margin:0 0 0.9rem" id="lst-modal-sub"></p>
    <p class="lst-ours-note hidden" style="margin:0 0 0.9rem" id="lst-modal-ours"></p>
    <div class="form-group">
      <label for="lst-name">Agent</label>
      <input id="lst-name" type="text" />
      <p class="text-muted" style="font-size:0.75rem;margin-top:0.25rem">The listing agent, filled in from the listing. Correct it if their name is spelled differently.</p>
    </div>
    <div class="form-group">
      <label for="lst-company">Brokerage</label>
      <input id="lst-company" type="text" />
      <p class="text-muted" style="font-size:0.75rem;margin-top:0.25rem">Their office, filled in from the listing.</p>
    </div>
    <div class="form-group">
      <label for="lst-email">Email</label>
      <input id="lst-email" type="email" placeholder="agent@brokerage.com" />
    </div>
    <div class="form-group">
      <label for="lst-phone">Phone</label>
      <input id="lst-phone" type="tel" placeholder="(419) 555-0123" />
      <p class="text-muted" style="font-size:0.75rem;margin-top:0.25rem">The listing never includes either one — look the agent up (brokerage site, Zillow or realtor.com profile) and add at least one.</p>
    </div>
    <div class="form-group">
      <label for="lst-market">Market</label>
      <select id="lst-market"></select>
      <p class="text-muted" style="font-size:0.75rem;margin-top:0.25rem">Decides which BDS gets the email. Already set from where the house is.</p>
    </div>
    <div class="form-group">
      <label for="lst-playbook">What to open with</label>
      <select id="lst-playbook"></select>
      <p class="text-muted" style="font-size:0.75rem;margin-top:0.25rem">The pitch and follow-up steps the BDS is handed. Leave it on “Not sure” if nothing stands out.</p>
    </div>
    <div class="form-group">
      <label for="lst-note">Anything you found</label>
      <textarea id="lst-note" rows="3" placeholder="Listed with photos already — phone shots. Worth a call."></textarea>
      <p class="text-muted" style="font-size:0.75rem;margin-top:0.25rem">Optional. What made this one worth a call — the BDS sees it in their email and in Pipedrive.</p>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="lst-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="lst-send">Send to BDS</button>
    </div>
  </div>
</div>

<div id="lst-dismiss-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:460px">
    <div class="modal-title">Set this one aside</div>
    <div class="form-group">
      <label for="lst-dismiss-reason">Why, briefly</label>
      <input id="lst-dismiss-reason" type="text" placeholder="Already a client · FSBO · out of area" />
      <p class="text-muted" style="font-size:0.75rem;margin-top:0.25rem">Optional, but it is what stops the next person researching the same house.</p>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="lst-dismiss-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="lst-dismiss-save">Set aside</button>
    </div>
  </div>
</div>`;

export const LISTINGS_COMPONENT_JS = `
  var lstRows = [];
  var lstTerritories = [];
  var lstPlaybooks = [];
  var lstSummary = null;
  var lstLast = null;
  var lstSpiro = null;
  var lstMarketCount = 0;
  var lstFeedOk = true;
  var lstOpenId = null;
  var lstSearchTimer = null;

  function lstMoney(n){
    if(!n && n !== 0) return '';
    return '$' + Number(n).toLocaleString('en-US');
  }

  /** "22 minutes ago" reads as urgency; a date does not. */
  function lstAgo(ts){
    if(!ts) return 'date unknown';
    var mins = Math.round((Date.now() - ts) / 60000);
    if(mins < 1) return 'just now';
    if(mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    var hrs = Math.round(mins / 60);
    if(hrs < 36) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    return Math.round(hrs / 24) + ' days ago';
  }

  function lstDate(ts){
    if(!ts) return 'an unknown date';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /** Spiro's statuses are camelCase codes: appointmentCompleted reads as "appointment completed". */
  function lstOrderStatus(s){
    return String(s || '').replace(/([A-Z])/g, ' $1').toLowerCase();
  }

  /** Which order, when, for whom, and where it is in Spiro. Plain text first, link after. */
  function lstOursText(l){
    var bits = ['Our Spiro order from ' + lstDate(l.spiroOrderedAt)];
    if(l.spiroOrderAgent) bits.push('for ' + l.spiroOrderAgent);
    if(l.spiroOrderStatus) bits.push(lstOrderStatus(l.spiroOrderStatus));
    return bits.join(' · ');
  }

  async function loadListings(){
    var qs = [];
    var status = document.getElementById('lst-status').value;
    var territory = document.getElementById('lst-territory').value;
    var hours = document.getElementById('lst-hours').value;
    var q = document.getElementById('lst-search').value.trim();
    if(status) qs.push('status=' + encodeURIComponent(status));
    if(territory) qs.push('territory=' + encodeURIComponent(territory));
    if(hours) qs.push('hours=' + encodeURIComponent(hours));
    if(q) qs.push('q=' + encodeURIComponent(q));
    var r = await api('GET','/listings' + (qs.length ? '?' + qs.join('&') : ''));
    if(!r.ok){
      document.getElementById('lst-cards').innerHTML = '<div class="empty-state">Could not load listings.</div>';
      return;
    }
    lstRows = (r.data && r.data.listings) || [];
    lstSummary = (r.data && r.data.summary) || null;
    lstTerritories = (r.data && r.data.territories) || [];
    lstPlaybooks = (r.data && r.data.playbooks) || [];
    lstLast = (r.data && r.data.lastSweep) || null;
    lstSpiro = (r.data && r.data.spiroOrders) || null;
    lstMarketCount = (r.data && r.data.marketCount) || 0;
    lstFeedOk = !(r.data && r.data.feedConfigured === false);
    lstFillFilters();
    renderListingStats();
    renderSweepNote();
    renderListingCards();
  }

  function lstFillFilters(){
    var terr = document.getElementById('lst-territory');
    if(terr.options.length <= 1){
      lstTerritories.forEach(function(t){
        var o = document.createElement('option'); o.value = t.key; o.textContent = t.label; terr.appendChild(o);
      });
    }
  }

  function renderListingStats(){
    var el = document.getElementById('lst-stats');
    if(!lstSummary){ el.innerHTML = ''; return; }
    var html = '';
    html += '<div class="lst-stat"><div class="lst-stat-label">To work</div><div class="lst-stat-value">' + lstSummary.newCount + '</div></div>';
    html += '<div class="lst-stat"><div class="lst-stat-label">Not in the CRM</div><div class="lst-stat-value">' + lstSummary.unknownAgents + '</div></div>';
    html += '<div class="lst-stat"><div class="lst-stat-label">Already our order</div><div class="lst-stat-value">' + (lstSummary.ourOrderCount || 0) + '</div></div>';
    html += '<div class="lst-stat"><div class="lst-stat-label">Sent</div><div class="lst-stat-value">' + lstSummary.sentCount + '</div></div>';
    html += '<div class="lst-stat"><div class="lst-stat-label">Set aside</div><div class="lst-stat-value">' + lstSummary.dismissedCount + '</div></div>';
    el.innerHTML = html;
  }

  function renderSweepNote(){
    var el = document.getElementById('lst-sweep-note');
    if(!el) return;
    if(!lstFeedOk){
      el.innerHTML = '<span class="lst-warn">The listing feed is not configured — REALTYAPI_KEY is not set, so nothing can be swept.</span>';
      return;
    }
    var bits = [];
    if(lstLast){
      bits.push('Last swept ' + lstAgo(lstLast.startedAt) + ' — ' + lstLast.added + ' new of ' + lstLast.found + ' found');
      if(lstLast.creditsRemaining !== null && lstLast.creditsRemaining !== undefined){
        bits.push(lstLast.creditsRemaining + ' credits left');
      }
      if(lstLast.error) bits.push('some markets failed');
    } else {
      bits.push('Never swept');
    }
    if(lstMarketCount) bits.push('a sweep reads ' + lstMarketCount + ' markets and costs about ' + lstMarketCount + ' credits');
    if(lstSpiro && lstSpiro.orders){
      bits.push('checked against ' + Number(lstSpiro.orders).toLocaleString('en-US') + ' Spiro orders from the last 90 days' +
        (lstSpiro.refreshedAt ? ', read ' + lstAgo(lstSpiro.refreshedAt) : ''));
    } else {
      bits.push('not yet checked against Spiro orders');
    }
    el.textContent = bits.join(' · ');
  }

  function renderListingCards(){
    var box = document.getElementById('lst-cards');
    document.getElementById('lst-count').textContent =
      lstRows.length + (lstRows.length === 1 ? ' listing' : ' listings');
    if(lstRows.length === 0){
      var status = document.getElementById('lst-status').value;
      box.innerHTML = status === 'ours'
        ? '<div class="empty-state">None of the open listings are houses we already have a Spiro order for.</div>'
        : '<div class="empty-state">Nothing here. Press Refresh listings to read the last day.</div>';
      return;
    }
    box.innerHTML = lstRows.map(function(l){
      var addr = [l.address, l.city].filter(Boolean).join(', ') || 'Address not given';
      var specs = [];
      if(l.beds) specs.push(l.beds + ' bd');
      if(l.baths) specs.push(l.baths + ' ba');
      if(l.sqft) specs.push(Number(l.sqft).toLocaleString('en-US') + ' sqft');
      var badges = '';
      if(l.spiroOrderId) badges += '<span class="lst-ours">Already our order</span>';
      if(l.agentName){
        badges += l.knownPersonId
          ? '<span class="lst-known">Already in the CRM</span>'
          : '<span class="lst-new-agent">New to us</span>';
      }
      var ours = l.spiroOrderId
        ? '<div class="lst-ours-note">' + esc(lstOursText(l)) +
            (l.spiroOrderUrl ? ' · <a href="' + esc(l.spiroOrderUrl) + '" target="_blank" rel="noopener">Open in Spiro</a>' : '') +
          '</div>'
        : '';
      var photo = l.photoUrl
        ? '<img class="lst-photo" src="' + esc(l.photoUrl) + '" alt="" loading="lazy" />'
        : '<div class="lst-no-photo">No photo</div>';
      var actions = l.queueStatus === 'new'
        ? '<div class="lst-actions">' +
            (l.href ? '<a class="btn btn-sm btn-ghost" href="' + esc(l.href) + '" target="_blank" rel="noopener">Research</a>' : '') +
            '<button class="btn btn-sm btn-primary lst-send-btn" data-id="' + esc(l.id) + '">' + (l.spiroOrderId ? 'Send anyway' : 'Send to BDS') + '</button>' +
            '<button class="btn btn-sm btn-ghost lst-dismiss-btn" data-id="' + esc(l.id) + '">Set aside</button>' +
          '</div>'
        : (l.queueStatus === 'sent'
            ? '<div class="lst-sent">Sent by ' + esc(l.actionedBy || 'somebody') + ' · ' + esc(lstAgo(l.actionedAt)) + '</div>'
            : '<div class="lst-sent">Set aside' + (l.dismissedReason ? ' — ' + esc(l.dismissedReason) : '') +
              ' <button class="btn btn-sm btn-ghost lst-restore-btn" data-id="' + esc(l.id) + '">Put back</button></div>');
      return '<div class="lst-card' + (l.spiroOrderId ? ' is-ours' : '') + '">' + photo +
        '<div class="lst-body">' +
          '<div class="lst-when">' + esc(lstAgo(l.listedAt)) + ' · ' + esc(l.marketLabel) + '</div>' +
          '<div class="lst-addr">' + esc(addr) + '</div>' +
          '<div class="lst-meta">' + esc([lstMoney(l.price)].concat(specs).filter(Boolean).join(' · ')) + '</div>' +
          '<div class="lst-agent">' + (l.agentName
              ? '<strong>' + esc(l.agentName) + '</strong>' + (l.agentOffice ? '<br />' + esc(l.agentOffice) : '')
              : '<span class="text-muted">Listing agent not given</span>') + '</div>' +
          ours +
          '<div class="lst-badges">' + badges + '</div>' +
        '</div>' + actions + '</div>';
    }).join('');

    box.querySelectorAll('.lst-send-btn').forEach(function(el){
      el.addEventListener('click', function(){ openSendListing(el.getAttribute('data-id')); });
    });
    box.querySelectorAll('.lst-dismiss-btn').forEach(function(el){
      el.addEventListener('click', function(){ openDismissListing(el.getAttribute('data-id')); });
    });
    box.querySelectorAll('.lst-restore-btn').forEach(function(el){
      el.addEventListener('click', function(){ restoreListing(el.getAttribute('data-id')); });
    });
  }

  function lstById(id){
    for (var i=0;i<lstRows.length;i++){ if(lstRows[i].id === id) return lstRows[i]; }
    return null;
  }

  function openSendListing(id){
    var l = lstById(id);
    if(!l) return;
    lstOpenId = id;
    document.getElementById('lst-modal-sub').textContent =
      [l.address, l.city].filter(Boolean).join(', ') + ' · listed ' + lstAgo(l.listedAt);
    // The one thing worth knowing before sending a house we already shot: whose order it was.
    var oursEl = document.getElementById('lst-modal-ours');
    if(l.spiroOrderId){
      oursEl.textContent = lstOursText(l) + '. Send it only if the listing agent is somebody other than our client.';
      oursEl.classList.remove('hidden');
    } else {
      oursEl.textContent = '';
      oursEl.classList.add('hidden');
    }
    document.getElementById('lst-name').value = l.agentName || '';
    document.getElementById('lst-company').value = l.agentOffice || '';
    document.getElementById('lst-email').value = '';
    document.getElementById('lst-phone').value = '';
    document.getElementById('lst-note').value = '';
    document.getElementById('lst-market').innerHTML =
      lstTerritories.map(function(t){
        return '<option value="' + esc(t.key) + '"' + (t.key === l.territoryKey ? ' selected' : '') + '>' +
          esc(t.label) + (t.ownerName ? ' — ' + esc(t.ownerName) : '') + '</option>';
      }).join('');
    document.getElementById('lst-playbook').innerHTML =
      '<option value="">Not sure</option>' + lstPlaybooks.map(function(pb){
        return '<option value="' + esc(pb.key) + '">' + esc(pb.label) + '</option>';
      }).join('');
    document.getElementById('lst-modal').classList.remove('hidden');
  }

  async function sendListing(){
    if(!lstOpenId) return;
    var payload = {
      name: document.getElementById('lst-name').value.trim(),
      company: document.getElementById('lst-company').value.trim(),
      email: document.getElementById('lst-email').value.trim(),
      phone: document.getElementById('lst-phone').value.trim(),
      territoryKey: document.getElementById('lst-market').value || null,
      playbookKey: document.getElementById('lst-playbook').value || null,
      message: document.getElementById('lst-note').value.trim()
    };
    if(!payload.email && !payload.phone){
      alert('An email or a phone number is required — that is what makes it a lead somebody can work.');
      return;
    }
    var r = await api('POST','/listings/' + encodeURIComponent(lstOpenId) + '/send', payload);
    if(!r.ok){
      alert('Could not send it: ' + ((r.data && r.data.error) || 'unknown error'));
      return;
    }
    document.getElementById('lst-modal').classList.add('hidden');
    lstOpenId = null;
    await loadListings();
  }

  function openDismissListing(id){
    lstOpenId = id;
    var l = lstById(id);
    document.getElementById('lst-dismiss-reason').value = l && l.spiroOrderId ? 'Already our order' : '';
    document.getElementById('lst-dismiss-modal').classList.remove('hidden');
  }

  async function saveDismissListing(){
    if(!lstOpenId) return;
    await api('PUT','/listings/' + encodeURIComponent(lstOpenId) + '/dismiss',
      { reason: document.getElementById('lst-dismiss-reason').value.trim() || null });
    document.getElementById('lst-dismiss-modal').classList.add('hidden');
    lstOpenId = null;
    await loadListings();
  }

  async function restoreListing(id){
    await api('PUT','/listings/' + encodeURIComponent(id) + '/restore');
    await loadListings();
  }

  async function refreshListings(){
    var btn = document.getElementById('lst-refresh');
    if(!btn) return;
    if(!confirm('Read the last 24 hours across ' + lstMarketCount + ' markets? That spends about ' + lstMarketCount + ' API credits.')) return;
    btn.disabled = true;
    btn.textContent = 'Reading…';
    var r = await api('POST','/listings/refresh', {});
    btn.disabled = false;
    btn.textContent = 'Refresh listings';
    var result = r.data && r.data.result;
    if(!r.ok){
      alert('The sweep failed: ' + ((r.data && r.data.error) || 'unknown error'));
    } else if(result && result.errors && result.errors.length){
      alert('Some markets could not be read: ' + result.errors.map(function(e){ return e.market; }).join(', '));
    } else if(result && result.spiro && result.spiro.error){
      alert('The listings are in, but Spiro could not be read, so the Already our order flags are from the last good check: ' + result.spiro.error);
    }
    await loadListings();
  }

  async function checkSpiroOrders(){
    var btn = document.getElementById('lst-spiro-check');
    if(!btn) return;
    btn.disabled = true;
    // The first check reads 90 days of orders and takes a minute; after that it is a page or two.
    btn.textContent = (lstSpiro && lstSpiro.orders) ? 'Checking…' : 'Reading 90 days of orders…';
    var r = await api('POST','/listings/spiro-check', {});
    btn.disabled = false;
    btn.textContent = 'Check Spiro orders';
    var err = !r.ok ? ((r.data && r.data.error) || 'unknown error') : (r.data && r.data.result && r.data.result.error);
    if(err) alert('Spiro could not be read: ' + err);
    await loadListings();
  }

  function lstOn(id, ev, fn){
    var el = document.getElementById(id);
    if(el) el.addEventListener(ev, fn);
  }

  lstOn('lst-refresh', 'click', refreshListings);
  lstOn('lst-spiro-check', 'click', checkSpiroOrders);
  lstOn('lst-send', 'click', sendListing);
  lstOn('lst-cancel', 'click', function(){
    document.getElementById('lst-modal').classList.add('hidden'); lstOpenId = null;
  });
  lstOn('lst-dismiss-save', 'click', saveDismissListing);
  lstOn('lst-dismiss-cancel', 'click', function(){
    document.getElementById('lst-dismiss-modal').classList.add('hidden'); lstOpenId = null;
  });
  ['lst-status','lst-territory','lst-hours'].forEach(function(id){
    lstOn(id, 'change', loadListings);
  });
  lstOn('lst-search', 'input', function(){
    clearTimeout(lstSearchTimer);
    lstSearchTimer = setTimeout(loadListings, 250);
  });
`;
