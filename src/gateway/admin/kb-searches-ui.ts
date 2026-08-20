// The Hub's help-center search report: what clients typed into /help, and what
// it got them.
//
// Shaped like feedback-ui.ts and kb-ui.ts — CSS, markup and component JS
// exported as strings and interpolated into the admin SPA. The host provides
// `esc` and `api`.
//
// The page is three readings of one list, and keeping them apart is the whole
// point: a term that matched nothing needs an article written, a term that
// matched something nobody opened needs an article retitled, and the busiest
// terms say what the help center is for. Rolling them into one "top searches"
// table would hide the first two behind the third.

export const KB_SEARCHES_CSS = `
  .kbs-bar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  /* Every select in the SPA is width:100% by default, which would eat the row. */
  .kbs-bar select { width: auto; max-width: 14rem; flex: 0 0 auto; font-size: 0.82rem; padding: 0.35rem 0.5rem; }
  .kbs-count { font-size: 0.75rem; color: var(--text-muted); margin-left: auto; white-space: nowrap; }

  .kbs-sect { margin-bottom: 1rem; }
  .kbs-sect h3 { font-size: 0.95rem; font-weight: 700; margin: 0 0 0.15rem; }
  .kbs-why { font-size: 0.8rem; color: var(--text-muted); margin: 0 0 0.75rem; }

  .kbs-term { font-weight: 600; }
  /* Numbers line up column-wise so a long list can be scanned rather than read. */
  .kbs-num { text-align: right; font-variant-numeric: tabular-nums; width: 1%; white-space: nowrap; }
  .kbs-when { color: var(--text-muted); font-size: 0.78rem; white-space: nowrap; }
  .kbs-try { font-size: 0.75rem; color: var(--text-muted); text-decoration: none; white-space: nowrap; }
  .kbs-try:hover { color: var(--accent); text-decoration: underline; }

  /* The gap list is the one that costs us something, so it reads as a warning. */
  .kbs-sect-gap .stat-card, .kbs-gap-head { border-top-color: #b45309; }
`;

export const KB_SEARCHES_MARKUP = `
      <!-- Help searches: the knowledge base's gaps, in clients' own words -->
      <div id="page-kb-searches" class="page hidden">
        <div class="card" style="margin-bottom:1rem">
          <div style="font-weight:700;margin-bottom:0.35rem">Help Searches</div>
          <p class="text-muted" style="font-size:0.85rem;margin:0">
            What clients searched for in the <a href="/help" target="_blank" rel="noopener">help center</a>.
            Nothing here identifies anyone — only the words typed and whether they led to an article.
          </p>
        </div>

        <div class="kbs-bar">
          <select id="kbs-days" aria-label="Time period">
            <option value="7">Last 7 days</option>
            <option value="30" selected>Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <span class="kbs-count" id="kbs-count"></span>
        </div>

        <div class="stats-grid" id="kbs-stats"></div>

        <div class="card kbs-sect">
          <h3>Nothing matched</h3>
          <p class="kbs-why">Searches that came back empty. These are the articles the help center is missing — the wording is the client's, so it is also a decent title.</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Search</th><th class="kbs-num">Times</th><th>Last searched</th><th style="width:1%"></th></tr></thead>
              <tbody id="kbs-gap-rows"><tr><td colspan="4" class="empty-state">Loading…</td></tr></tbody>
            </table>
          </div>
        </div>

        <div class="card kbs-sect">
          <h3>Found something, opened nothing</h3>
          <p class="kbs-why">These searches matched published articles and no one opened one. Usually the article exists but is titled in our words rather than theirs — open the search to see what they saw.</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Search</th><th class="kbs-num">Times</th><th>Last searched</th><th style="width:1%"></th></tr></thead>
              <tbody id="kbs-unhelpful-rows"><tr><td colspan="4" class="empty-state">Loading…</td></tr></tbody>
            </table>
          </div>
        </div>

        <div class="card kbs-sect">
          <h3>Most searched</h3>
          <p class="kbs-why">Every term by volume, whatever became of it. What the help center is actually being used for.</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Search</th><th class="kbs-num">Times</th><th class="kbs-num">Matched</th><th class="kbs-num">Opened</th><th>Last searched</th><th style="width:1%"></th></tr></thead>
              <tbody id="kbs-top-rows"><tr><td colspan="6" class="empty-state">Loading…</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
`;

export const KB_SEARCHES_COMPONENT_JS = `
  // ── Help searches ──────────────────────────────────────────────────────────
  var kbsSummary = null;
  var kbsDays = 30;

  async function loadKbSearches(){
    var r = await api('GET', '/kb/searches?days=' + kbsDays);
    if(!r.ok){
      kbsSummary = null;
      kbsFail('Could not load the search report.');
      return;
    }
    kbsSummary = (r.data && r.data.summary) || null;
    renderKbSearches();
  }

  function kbsFail(message){
    document.getElementById('kbs-stats').innerHTML = '';
    document.getElementById('kbs-count').textContent = '';
    [['kbs-gap-rows',4],['kbs-unhelpful-rows',4],['kbs-top-rows',6]].forEach(function(pair){
      document.getElementById(pair[0]).innerHTML =
        '<tr><td colspan="' + pair[1] + '" class="empty-state">' + esc(message) + '</td></tr>';
    });
  }

  function kbsWhen(ts){
    if (!ts) return '—';
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  }

  /** Whole percent of a total, and a dash rather than 0% when nothing happened. */
  function kbsPct(part, total){
    if (!total) return '—';
    return Math.round((part / total) * 100) + '%';
  }

  /**
   * The link that runs the search again on the public page. Staff guessing at
   * why a term went nowhere are guessing about a page they can just open.
   */
  function kbsTryLink(term){
    return '<a class="kbs-try" href="/help?q=' + encodeURIComponent(term) +
      '" target="_blank" rel="noopener" title="Run this search on the help center">Open ↗</a>';
  }

  function kbsRows(host, groups, columns, build){
    var body = document.getElementById(host);
    if (!groups || groups.length === 0){
      body.innerHTML = '<tr><td colspan="' + columns + '" class="empty-state">Nothing in this period.</td></tr>';
      return;
    }
    body.innerHTML = groups.map(build).join('');
  }

  function renderKbSearches(){
    if (!kbsSummary) return;
    var s = kbsSummary;

    document.getElementById('kbs-stats').innerHTML =
      '<div class="stat-card"><div class="stat-label">Searches</div><div class="stat-value">' + s.totalSearches + '</div></div>' +
      '<div class="stat-card"><div class="stat-label">Found nothing</div><div class="stat-value">' + s.zeroResultSearches + '</div>' +
        '<div class="stat-label" style="margin:0.35rem 0 0">' + kbsPct(s.zeroResultSearches, s.totalSearches) + ' of searches</div></div>' +
      '<div class="stat-card"><div class="stat-label">Opened an article</div><div class="stat-value">' + s.clickedSearches + '</div>' +
        '<div class="stat-label" style="margin:0.35rem 0 0">' + kbsPct(s.clickedSearches, s.totalSearches) + ' of searches</div></div>' +
      '<div class="stat-card"><div class="stat-label">Articles to write</div><div class="stat-value">' + s.gaps.length + '</div>' +
        '<div class="stat-label" style="margin:0.35rem 0 0">terms with no match</div></div>';

    document.getElementById('kbs-count').textContent =
      s.totalSearches ? s.totalSearches + ' search' + (s.totalSearches===1?'':'es') + ' since ' + kbsWhen(s.since) : '';

    kbsRows('kbs-gap-rows', s.gaps, 4, function(g){
      return '<tr><td class="kbs-term">' + esc(g.query) + '</td>' +
        '<td class="kbs-num">' + g.searches + '</td>' +
        '<td class="kbs-when">' + kbsWhen(g.lastAt) + '</td>' +
        '<td>' + kbsTryLink(g.query) + '</td></tr>';
    });

    kbsRows('kbs-unhelpful-rows', s.unhelpful, 4, function(g){
      return '<tr><td class="kbs-term">' + esc(g.query) + '</td>' +
        '<td class="kbs-num">' + g.searches + '</td>' +
        '<td class="kbs-when">' + kbsWhen(g.lastAt) + '</td>' +
        '<td>' + kbsTryLink(g.query) + '</td></tr>';
    });

    kbsRows('kbs-top-rows', s.top, 6, function(g){
      return '<tr><td class="kbs-term">' + esc(g.query) + '</td>' +
        '<td class="kbs-num">' + g.searches + '</td>' +
        '<td class="kbs-num">' + g.withResults + '</td>' +
        '<td class="kbs-num">' + g.clicks + '</td>' +
        '<td class="kbs-when">' + kbsWhen(g.lastAt) + '</td>' +
        '<td>' + kbsTryLink(g.query) + '</td></tr>';
    });
  }

  document.getElementById('kbs-days').addEventListener('change', function(e){
    kbsDays = parseInt(e.target.value, 10) || 30;
    loadKbSearches();
  });
`;
