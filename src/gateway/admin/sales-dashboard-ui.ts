// The sales dashboard, as markup and inline JS shared by both signed-in
// surfaces: goals against booked units, revenue and ASP per market for a month
// and the year, with the pace each is on — the sales tracker sheet, fed from
// Spiro rather than a pasted order report.
//
// The inline JS below lives in a template literal, which eats backslashes: no
// regex escapes and no backslashes in its comments. It also must not contain a
// dollar sign followed by an open brace.

export const SALES_DASHBOARD_CSS = `
  .sd-head { display: flex; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .sd-head-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
  .sd-head-actions input[type=month] { width: auto; max-width: 11rem; }
  .sd-sync { color: var(--text-muted); font-size: 0.8rem; margin: 0.5rem 0 0; }
  .sd-warn { color: var(--warning); font-weight: 600; }
  .sd-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr)); gap: 0.75rem; margin-bottom: 1.15rem; }
  .sd-kpi { background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--radius-sm); padding: 0.8rem 0.95rem; box-shadow: var(--shadow); }
  .sd-kpi-label { color: var(--text-muted); font-size: 0.69rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  .sd-kpi-value { font-size: 1.5rem; font-weight: 700; margin-top: 0.15rem; font-variant-numeric: tabular-nums; }
  .sd-kpi-sub { color: var(--text-muted); font-size: 0.78rem; margin-top: 0.2rem; }
  .card.sd-card { padding: 0; overflow: hidden; }
  .sd-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem 1rem; flex-wrap: wrap; padding: 0.9rem 1.1rem; border-bottom: 1px solid var(--hairline); }
  .sd-card-title { font-weight: 700; }
  .sd-card-note { color: var(--text-muted); font-size: 0.78rem; }
  .sd-card-foot { color: var(--text-muted); font-size: 0.78rem; padding: 0.6rem 1.1rem; }
  .sd-legend { display: flex; gap: 0.4rem 0.9rem; flex-wrap: wrap; color: var(--text-muted); font-size: 0.76rem; }
  .sd-days { display: flex; gap: 0.4rem 1.4rem; flex-wrap: wrap; padding: 0.6rem 1.1rem; border-bottom: 1px solid var(--hairline); color: var(--text-muted); font-size: 0.8rem; }
  .sd-days b { color: var(--text); font-variant-numeric: tabular-nums; }
  .sd-table-wrap { overflow-x: auto; }
  table.sd-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
  table.sd-table th { text-align: left; color: var(--text-muted); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; background: var(--surface2); padding: 0.45rem 0.7rem; white-space: nowrap; }
  table.sd-table th.num { text-align: right; }
  table.sd-table th.sd-group { text-align: center; color: var(--text); }
  table.sd-table td { padding: 0.5rem 0.7rem; border-bottom: 1px solid var(--hairline); white-space: nowrap; }
  table.sd-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.sd-table .sd-sep { border-left: 1px solid var(--hairline); }
  table.sd-table td.sd-market { font-weight: 600; }
  /* The wide tables scroll sideways; the market stays in view while they do. */
  table.sd-table td.sd-market, table.sd-table th.sd-market-head { position: sticky; left: 0; z-index: 1; background: var(--surface); box-shadow: inset -1px 0 0 var(--hairline); }
  table.sd-table th.sd-market-head { background: var(--surface2); }
  table.sd-table tr.sd-total td { font-weight: 700; background: var(--surface2); border-top: 2px solid var(--border); border-bottom: 0; }
  .sd-pace { display: inline-flex; align-items: center; gap: 0.3rem; }
  .sd-pace-icon { font-size: 0.72rem; line-height: 1; }
  .sd-pace-good .sd-pace-icon { color: #0ca30c; }
  .sd-pace-close .sd-pace-icon { color: #fab219; }
  .sd-pace-behind .sd-pace-icon { color: #d03b3b; }
  .sd-muted { color: var(--text-muted); }
  .sd-empty { color: var(--text-muted); font-size: 0.85rem; padding: 1rem 1.1rem; white-space: normal; }
  .sd-modal-box { max-width: 700px; }
  .sd-hint { color: var(--text-muted); font-size: 0.8rem; margin: 0 0 0.9rem; }
  .sd-inline { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end; }
  .sd-inline .form-group { margin-bottom: 0.75rem; }
  .sd-inline input[type=month], .sd-inline input[type=date] { width: auto; }
  .sd-inline > input[type=text] { flex: 1; min-width: 10rem; width: auto; }
  table.sd-goal-grid td { padding: 0.3rem 0.5rem; }
  table.sd-goal-grid input { width: 100%; min-width: 6rem; text-align: right; }
  table.sd-goal-grid tr.sd-goal-total td { background: var(--surface2); border-top: 2px solid var(--border); }
  .sd-list { display: flex; flex-direction: column; gap: 0.4rem; margin: 0.6rem 0; }
  .sd-item { display: flex; align-items: center; gap: 0.6rem; border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.65rem; }
  .sd-item-main { flex: 1; min-width: 0; font-size: 0.85rem; }
  .sd-error { color: var(--danger); font-size: 0.85rem; margin-top: 0.75rem; }
  .sd-ok { color: var(--success); font-size: 0.85rem; margin-top: 0.75rem; }
`;

const PACE_LEGEND = `<div class="sd-legend">
              <span class="sd-pace sd-pace-good"><span class="sd-pace-icon" aria-hidden="true">▲</span>On pace, 100% or more</span>
              <span class="sd-pace sd-pace-close"><span class="sd-pace-icon" aria-hidden="true">●</span>Within 10%</span>
              <span class="sd-pace sd-pace-behind"><span class="sd-pace-icon" aria-hidden="true">▼</span>Behind</span>
            </div>`;

function salesPageMarkup(): string {
  return `
        <div class="card">
          <div class="sd-head">
            <div style="flex:1;min-width:min(16rem,100%)">
              <div style="font-weight:700;margin-bottom:0.35rem">Sales Dashboard</div>
              <p class="text-muted" style="font-size:0.85rem;margin:0">
                Each market's goals against what it has booked — units, revenue and average order value (ASP) for the
                month and the year so far — and where the month and the year are trending. Every order placed counts
                except $0 orders, in the market of the client's company in Spiro.
              </p>
              <p class="sd-sync" id="sd-sync"></p>
            </div>
            <div class="sd-head-actions">
              <input id="sd-month" type="month" aria-label="Month" />
              <button type="button" class="btn btn-ghost" id="sd-refresh" title="Read Spiro orders again now. They also refresh on their own every 2 hours.">Refresh</button>
              <button type="button" class="btn btn-ghost hidden" id="sd-holidays-open">Holidays</button>
              <button type="button" class="btn btn-primary hidden" id="sd-goals-open">Goals</button>
            </div>
          </div>
        </div>

        <div class="sd-kpis" id="sd-kpis"></div>

        <div class="card sd-card">
          <div class="sd-card-head">
            <div class="sd-card-title" id="sd-mtd-title">Month to date</div>
            <div class="sd-card-note">Per-day goal is the unit goal ÷ business days in the month, rounded up.</div>
          </div>
          <div class="sd-days" id="sd-days"></div>
          <div class="sd-table-wrap"><table class="sd-table" id="sd-mtd"></table></div>
        </div>

        <div class="card sd-card">
          <div class="sd-card-head">
            <div class="sd-card-title">End-of-month trend</div>
            ${PACE_LEGEND}
          </div>
          <div class="sd-table-wrap"><table class="sd-table" id="sd-eom"></table></div>
          <div class="sd-card-foot">Month to date ÷ business days completed × business days in the month, against the month's goal.</div>
        </div>

        <div class="card sd-card">
          <div class="sd-card-head">
            <div class="sd-card-title" id="sd-ytd-title">Year to date</div>
            ${PACE_LEGEND}
          </div>
          <div class="sd-table-wrap"><table class="sd-table" id="sd-ytd"></table></div>
          <div class="sd-card-foot">Goal to date is every earlier month's goal plus this month's, prorated by business days completed. Year-end trend carries the pace so far to the last business day of the year, against the year's goal.</div>
        </div>`;
}

export const SALES_DASHBOARD_MARKUP = `
      <!-- Sales dashboard: goals against booked units, revenue and ASP per market -->
      <div id="page-sales-dashboard" class="page hidden">
${salesPageMarkup()}
      </div>`;

export const SALES_DASHBOARD_PORTAL_MARKUP = `
    <div id="page-sales-dashboard" class="page">
      <div class="topbar"><h2>Sales Dashboard</h2></div>
      <div class="page-scroll">
${salesPageMarkup()}
      </div>
    </div>`;

export const SALES_DASHBOARD_MODALS = `
<div id="sd-goals-modal" class="modal-backdrop hidden">
  <div class="modal sd-modal-box">
    <div class="modal-title">Sales goals</div>
    <p class="sd-hint">Set one month at a time; the year's goal is its twelve months added up. Leave ASP blank to use revenue ÷ units. Clear a row to remove that market's goal.</p>
    <div class="sd-inline">
      <div class="form-group"><label for="sd-goal-month">Month</label><input id="sd-goal-month" type="month" /></div>
      <div class="form-group"><label for="sd-goal-copy">Start from another month</label><input id="sd-goal-copy" type="month" /></div>
      <div class="form-group"><button type="button" class="btn btn-ghost" id="sd-goal-copy-btn">Copy in</button></div>
    </div>
    <div class="sd-table-wrap">
      <table class="sd-table sd-goal-grid">
        <thead><tr><th>Market</th><th class="num">Units</th><th class="num">Revenue ($)</th><th class="num">ASP ($)</th></tr></thead>
        <tbody id="sd-goal-body"></tbody>
      </table>
    </div>
    <p class="sd-hint" style="margin-top:0.5rem">Company total is optional. Fill it in when the company goal is not simply the markets added up; the greyed numbers are what the markets add up to.</p>
    <div class="sd-inline">
      <input id="sd-goal-new-market" type="text" placeholder="Add a market, e.g. Cleveland" aria-label="New market" />
      <button type="button" class="btn btn-ghost" id="sd-goal-add-market">Add market</button>
    </div>
    <p class="sd-hint" style="margin-top:0.5rem">Name a market the way its Spiro service area starts — Fort Wayne for Fort Wayne, Indiana — so its orders line up with its goal.</p>
    <div id="sd-goals-msg" class="hidden"></div>
    <div class="modal-actions">
      <span style="flex:1"></span>
      <button type="button" class="btn btn-ghost" id="sd-goals-close">Close</button>
      <button type="button" class="btn btn-primary" id="sd-goals-save">Save month</button>
    </div>
  </div>
</div>

<div id="sd-holidays-modal" class="modal-backdrop hidden">
  <div class="modal sd-modal-box">
    <div class="modal-title">Holidays</div>
    <p class="sd-hint">Weekdays that do not count as business days, for per-day goals and every trend. Weekends never count.</p>
    <div class="sd-inline">
      <div class="form-group"><label for="sd-holiday-day">Date</label><input id="sd-holiday-day" type="date" /></div>
      <div class="form-group" style="flex:1;min-width:10rem"><label for="sd-holiday-label">Holiday</label><input id="sd-holiday-label" type="text" placeholder="Thanksgiving" /></div>
      <div class="form-group"><button type="button" class="btn btn-primary" id="sd-holiday-add">Add</button></div>
    </div>
    <div class="sd-list" id="sd-holiday-list"></div>
    <div id="sd-holidays-msg" class="hidden"></div>
    <div class="modal-actions">
      <span style="flex:1"></span>
      <button type="button" class="btn btn-ghost" id="sd-holidays-close">Close</button>
    </div>
  </div>
</div>`;

export const SALES_DASHBOARD_COMPONENT_JS = `
  var sdData = null;
  var sdGoalRows = [];
  var sdGoalTotal = { units: '', revenue: '', asp: '' };
  var sdPollTimer = null;
  var SD_PACE_BANDS = [
    { min: 100, cls: 'good', icon: '▲', label: 'On pace' },
    { min: 90, cls: 'close', icon: '●', label: 'Within 10% of pace' },
    { min: -Infinity, cls: 'behind', icon: '▼', label: 'Behind pace' }
  ];

  function sdEl(id){ return document.getElementById(id); }
  function sdNum(n){ return (n === null || n === undefined) ? '—' : Math.round(n).toLocaleString('en-US'); }
  function sdMoney(cents){
    if(cents === null || cents === undefined) return '—';
    return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function sdPct(p){ return (p === null || p === undefined) ? '—' : p.toFixed(2) + '%'; }
  function sdPace(p){
    if(p === null || p === undefined) return '<span class="sd-muted">—</span>';
    var band = SD_PACE_BANDS.filter(function(b){ return p >= b.min; })[0];
    return '<span class="sd-pace sd-pace-' + band.cls + '" title="' + esc(band.label) + '"><span class="sd-pace-icon" aria-hidden="true">' +
      band.icon + '</span>' + esc(sdPct(p)) + '</span>';
  }
  function sdHasGoal(m){ return !!m && (m.units > 0 || m.revenueCents > 0); }
  function sdCell(html, cls){ return '<td class="num' + (cls ? ' ' + cls : '') + '">' + html + '</td>'; }
  function sdDateOf(ymd){ var p = ymd.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function sdDate(ymd){
    if(!ymd) return '—';
    return sdDateOf(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function sdWeekday(ymd){ return sdDateOf(ymd).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }); }
  function sdMonthName(key){
    var p = key.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  function sdAgo(ts){
    if(!ts) return 'never';
    var mins = Math.round((Date.now() - ts) / 60000);
    if(mins < 1) return 'just now';
    if(mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    var hrs = Math.round(mins / 60);
    if(hrs < 36) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    return Math.round(hrs / 24) + ' days ago';
  }

  async function loadSalesDashboard(){
    var input = sdEl('sd-month');
    var q = input && input.value ? '?month=' + encodeURIComponent(input.value) : '';
    var r = await api('GET', '/sales-dashboard' + q);
    if(!r.ok){
      sdEl('sd-kpis').innerHTML = '<div class="sd-empty">' + esc('Could not load the sales dashboard: ' + ((r.data && r.data.error) || 'unknown error')) + '</div>';
      return;
    }
    sdData = r.data;
    if(input){
      input.min = sdData.months.min;
      input.max = sdData.months.max;
      input.value = sdData.monthKey;
    }
    sdEl('sd-goals-open').classList.toggle('hidden', !sdData.canEdit);
    sdEl('sd-holidays-open').classList.toggle('hidden', !sdData.canEdit);
    sdRenderSync();
    sdRenderKpis();
    sdRenderTables();
    sdSchedulePoll();
  }

  // While a read runs, look again now and then so the page fills in without a reload.
  function sdSchedulePoll(){
    clearTimeout(sdPollTimer);
    if(!sdData || !sdData.sync || !sdData.sync.running) return;
    sdPollTimer = setTimeout(function(){
      var page = sdEl('page-sales-dashboard');
      if(page && page.offsetParent !== null) loadSalesDashboard();
    }, 20000);
  }

  function sdRenderSync(){
    var s = sdData.sync || {};
    var r = sdData.report;
    var parts = [];
    if(!s.coveredTo){
      parts.push(esc('Spiro orders have not been read yet. Press Refresh: the first read goes back to January ' +
        (s.historyFloor ? s.historyFloor.slice(0, 4) : 'of last year') + ', this month first, and takes a while.'));
    } else {
      parts.push(esc('Orders read from Spiro ' + sdAgo(s.refreshedAt) + ', back to ' + sdDate(s.coveredFrom) + '. They refresh every 2 hours.'));
      if(s.coveredFrom > r.year + '-01-01'){
        parts.push('<span class="sd-warn">' + esc('Older orders are still being read, so totals before ' + sdDate(s.coveredFrom) + ' are incomplete.') + '</span>');
      }
    }
    if(r.clientsPending > 0){
      parts.push(esc('New clients are still being checked against older order history for ' + r.clientsPending +
        (r.clientsPending === 1 ? ' agent.' : ' agents.')));
    }
    if(s.error && (!s.refreshedAt || (s.attemptedAt || 0) > s.refreshedAt)){
      parts.push('<span class="sd-warn">' + esc('The last read failed ' + sdAgo(s.attemptedAt) + ': ' + s.error) + '</span>');
    }
    if(s.running) parts.push('<span class="sd-warn">Reading now…</span>');
    sdEl('sd-sync').innerHTML = parts.join(' ');
  }

  function sdRenderKpis(){
    var t = sdData.report.mtd.total;
    var nc = t.newClients;
    var goal = sdHasGoal(t.goal);
    var tiles = [
      { label: 'Units', value: sdNum(t.actual.units), sub: goal ? esc('of ' + sdNum(t.goal.units) + ' · ' + sdPct(t.pct.units)) : 'No goal set' },
      { label: 'Revenue', value: sdMoney(t.actual.revenueCents), sub: goal ? esc('of ' + sdMoney(t.goal.revenueCents) + ' · ' + sdPct(t.pct.revenue)) : 'No goal set' },
      { label: 'ASP', value: sdMoney(t.actual.aspCents), sub: goal ? esc('goal ' + sdMoney(t.goal.aspCents) + ' · ' + sdPct(t.pct.asp)) : 'No goal set' },
      { label: 'New clients', value: nc ? sdNum(nc.first + nc.returning) : '—', sub: nc ? esc(nc.first + ' first-ever · ' + nc.returning + ' returning') : 'Needs a year of order history first' },
      { label: 'Units trend', value: sdNum(t.trend.units), sub: goal ? sdPace(t.trend.unitsPct) + ' of goal' : 'At this pace by month end' },
      { label: 'Revenue trend', value: sdMoney(t.trend.revenueCents), sub: goal ? sdPace(t.trend.revenuePct) + ' of goal' : 'At this pace by month end' }
    ];
    sdEl('sd-kpis').innerHTML = tiles.map(function(x){
      return '<div class="sd-kpi"><div class="sd-kpi-label">' + esc(x.label) + '</div><div class="sd-kpi-value">' + esc(x.value) +
        '</div><div class="sd-kpi-sub">' + x.sub + '</div></div>';
    }).join('');
  }

  function sdTotalClass(i, all){ return i === all.length - 1 ? ' class="sd-total"' : ''; }

  function sdRenderTables(){
    var r = sdData.report;
    sdEl('sd-mtd-title').textContent = sdMonthName(sdData.monthKey) + ' · month to date';
    sdEl('sd-ytd-title').textContent = r.year + ' · year to date';
    var bd = r.businessDays;
    sdEl('sd-days').innerHTML = [
      ['Month', sdDate(r.monthStart) + ' – ' + sdDate(r.monthEnd)],
      ['Business days', String(bd.month)],
      ['Completed', String(bd.monthCompleted)],
      ['Orders through', sdDate(r.throughDay)],
      ['Year', bd.yearCompleted + ' of ' + bd.year + ' business days']
    ].map(function(x){ return '<span>' + esc(x[0]) + ' <b>' + esc(x[1]) + '</b></span>'; }).join('');

    if(!r.mtd.rows.length){
      var empty = '<tbody><tr><td class="sd-empty">' + esc(sdData.sync && sdData.sync.coveredTo
        ? 'No orders or goals for ' + r.year + ' yet.'
        : 'No Spiro orders have been read yet.') + '</td></tr></tbody>';
      sdEl('sd-mtd').innerHTML = empty;
      sdEl('sd-eom').innerHTML = empty;
      sdEl('sd-ytd').innerHTML = empty;
      return;
    }

    var month = r.mtd.rows.concat([r.mtd.total]);
    sdEl('sd-mtd').innerHTML =
      '<thead><tr><th rowspan="2" class="sd-market-head">Market</th><th colspan="4" class="sd-group sd-sep">Units</th><th colspan="3" class="sd-group sd-sep">Revenue</th>' +
      '<th colspan="3" class="sd-group sd-sep">ASP</th><th colspan="2" class="sd-group sd-sep">New clients</th></tr>' +
      '<tr><th class="num sd-sep">Actual</th><th class="num">Goal</th><th class="num">% to goal</th><th class="num">Per-day goal</th>' +
      '<th class="num sd-sep">Actual</th><th class="num">Goal</th><th class="num">% to goal</th>' +
      '<th class="num sd-sep">Actual</th><th class="num">Goal</th><th class="num">% to goal</th>' +
      '<th class="num sd-sep">First-ever</th><th class="num">Returning</th></tr></thead><tbody>' +
      month.map(function(row, i){
        var g = sdHasGoal(row.goal);
        var nc = row.newClients;
        return '<tr' + sdTotalClass(i, month) + '><td class="sd-market">' + esc(row.label) + '</td>' +
          sdCell(sdNum(row.actual.units), 'sd-sep') + sdCell(g ? sdNum(row.goal.units) : '—') + sdCell(sdPct(row.pct.units)) + sdCell(sdNum(row.goal.unitsPerDay)) +
          sdCell(sdMoney(row.actual.revenueCents), 'sd-sep') + sdCell(g ? sdMoney(row.goal.revenueCents) : '—') + sdCell(sdPct(row.pct.revenue)) +
          sdCell(sdMoney(row.actual.aspCents), 'sd-sep') + sdCell(g ? sdMoney(row.goal.aspCents) : '—') + sdCell(sdPct(row.pct.asp)) +
          sdCell(nc ? sdNum(nc.first) : '—', 'sd-sep') + sdCell(nc ? sdNum(nc.returning) : '—') + '</tr>';
      }).join('') + '</tbody>';

    sdEl('sd-eom').innerHTML =
      '<thead><tr><th class="sd-market-head">Market</th><th class="num sd-sep">Units</th><th class="num">Units %</th><th class="num sd-sep">Revenue</th>' +
      '<th class="num">Revenue %</th><th class="num sd-sep">ASP</th></tr></thead><tbody>' +
      month.map(function(row, i){
        return '<tr' + sdTotalClass(i, month) + '><td class="sd-market">' + esc(row.label) + '</td>' +
          sdCell(sdNum(row.trend.units), 'sd-sep') + sdCell(sdPace(row.trend.unitsPct)) +
          sdCell(sdMoney(row.trend.revenueCents), 'sd-sep') + sdCell(sdPace(row.trend.revenuePct)) +
          sdCell(sdMoney(row.actual.aspCents), 'sd-sep') + '</tr>';
      }).join('') + '</tbody>';

    var year = r.ytd.rows.concat([r.ytd.total]);
    sdEl('sd-ytd').innerHTML =
      '<thead><tr><th rowspan="2" class="sd-market-head">Market</th><th colspan="5" class="sd-group sd-sep">Units</th><th colspan="5" class="sd-group sd-sep">Revenue</th>' +
      '<th colspan="2" class="sd-group sd-sep">ASP</th><th colspan="2" class="sd-group sd-sep">New clients</th></tr>' +
      '<tr><th class="num sd-sep">Actual</th><th class="num">Goal to date</th><th class="num">% to goal</th><th class="num">Year-end trend</th><th class="num">% of year goal</th>' +
      '<th class="num sd-sep">Actual</th><th class="num">Goal to date</th><th class="num">% to goal</th><th class="num">Year-end trend</th><th class="num">% of year goal</th>' +
      '<th class="num sd-sep">Actual</th><th class="num">% to goal</th>' +
      '<th class="num sd-sep">First-ever</th><th class="num">Returning</th></tr></thead><tbody>' +
      year.map(function(row, i){
        var g = sdHasGoal(row.annualGoal);
        var nc = row.newClients;
        return '<tr' + sdTotalClass(i, year) + '><td class="sd-market">' + esc(row.label) + '</td>' +
          sdCell(sdNum(row.actual.units), 'sd-sep') + sdCell(g ? sdNum(row.goalToDate.units) : '—') + sdCell(sdPace(row.pct.units)) +
          sdCell(sdNum(row.trend.units)) + sdCell(sdPace(row.trend.unitsPct)) +
          sdCell(sdMoney(row.actual.revenueCents), 'sd-sep') + sdCell(g ? sdMoney(row.goalToDate.revenueCents) : '—') + sdCell(sdPace(row.pct.revenue)) +
          sdCell(sdMoney(row.trend.revenueCents)) + sdCell(sdPace(row.trend.revenuePct)) +
          sdCell(sdMoney(row.actual.aspCents), 'sd-sep') + sdCell(sdPct(row.pct.asp)) +
          sdCell(nc ? sdNum(nc.first) : '—', 'sd-sep') + sdCell(nc ? sdNum(nc.returning) : '—') + '</tr>';
      }).join('') + '</tbody>';
  }

  async function sdRefresh(){
    var btn = sdEl('sd-refresh');
    btn.disabled = true;
    var r = await api('POST', '/sales-dashboard/refresh', {});
    btn.disabled = false;
    if(!r.ok){ alert('Could not start a read: ' + ((r.data && r.data.error) || 'unknown error')); return; }
    await loadSalesDashboard();
  }

  // ── Goals ──
  function sdGoalMsg(text, ok){
    var el = sdEl('sd-goals-msg');
    el.className = text ? (ok ? 'sd-ok' : 'sd-error') : 'hidden';
    el.textContent = text || '';
  }

  function sdDollars(cents){ return (cents === null || cents === undefined) ? '' : String(Math.round(cents) / 100); }

  function sdParse(v){
    var n = Number(String(v || '').split(',').join('').split('$').join('').trim());
    return isFinite(n) ? n : 0;
  }

  async function sdFetchGoalYear(year){
    var r = await api('GET', '/sales-dashboard/goals?year=' + encodeURIComponent(year));
    if(!r.ok) throw new Error((r.data && r.data.error) || 'Could not load goals.');
    return r.data;
  }

  // One month's goals as editor rows: every known market, filled in where it has a goal.
  function sdGoalsFor(data, month, withMarkets){
    var byKey = {};
    var total = { units: '', revenue: '', asp: '' };
    (data.goals || []).filter(function(g){ return g.month === month; }).forEach(function(g){
      var row = { label: g.marketLabel, units: String(g.units || ''), revenue: g.revenueCents ? sdDollars(g.revenueCents) : '', asp: sdDollars(g.aspCents) };
      if(g.marketKey === 'total') total = row;
      else byKey[g.marketKey] = row;
    });
    if(withMarkets){
      (data.markets || []).forEach(function(m){
        if(!byKey[m.key]) byKey[m.key] = { label: m.label, units: '', revenue: '', asp: '' };
      });
    }
    var rows = Object.keys(byKey).map(function(k){ return byKey[k]; });
    rows.sort(function(a, b){ return a.label.localeCompare(b.label); });
    return { rows: rows, total: total };
  }

  async function sdOpenGoals(){
    sdGoalMsg('');
    sdEl('sd-goal-month').value = (sdData && sdData.monthKey) || '';
    sdEl('sd-goal-copy').value = '';
    sdEl('sd-goals-modal').classList.remove('hidden');
    await sdLoadGoalMonth();
  }

  async function sdLoadGoalMonth(){
    var key = sdEl('sd-goal-month').value;
    sdGoalMsg('');
    if(!key){ sdGoalRows = []; sdGoalTotal = { units: '', revenue: '', asp: '' }; sdRenderGoalRows(); return; }
    try {
      var picked = sdGoalsFor(await sdFetchGoalYear(key.slice(0, 4)), Number(key.slice(5, 7)), true);
      sdGoalRows = picked.rows;
      sdGoalTotal = picked.total;
      sdRenderGoalRows();
    } catch (err) {
      sdGoalMsg(err.message);
    }
  }

  function sdGoalInput(i, field, value, label, placeholder){
    return '<td><input type="text" inputmode="decimal" data-i="' + i + '" data-f="' + field + '" value="' + esc(value) + '"' +
      (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + ' aria-label="' + esc(label) + '" /></td>';
  }

  function sdMarketSums(){
    var units = 0;
    var revenue = 0;
    sdGoalRows.forEach(function(row){ units += sdParse(row.units); revenue += sdParse(row.revenue); });
    return { units: units, revenue: revenue };
  }

  function sdAspHint(units, revenue){ return units > 0 ? (revenue / units).toFixed(2) : ''; }

  function sdRenderGoalRows(){
    var body = sdEl('sd-goal-body');
    var sums = sdMarketSums();
    var html = sdGoalRows.map(function(row, i){
      return '<tr><td>' + esc(row.label) + '</td>' +
        sdGoalInput(i, 'units', row.units, row.label + ' units', '') +
        sdGoalInput(i, 'revenue', row.revenue, row.label + ' revenue', '') +
        sdGoalInput(i, 'asp', row.asp, row.label + ' ASP', sdAspHint(sdParse(row.units), sdParse(row.revenue))) + '</tr>';
    }).join('');
    if(!sdGoalRows.length) html = '<tr><td colspan="4" class="sd-empty">No markets yet. Add one below.</td></tr>';
    var totalUnits = sdParse(sdGoalTotal.units) || sums.units;
    var totalRevenue = sdParse(sdGoalTotal.revenue) || sums.revenue;
    html += '<tr class="sd-goal-total"><td><b>Company total</b></td>' +
      sdGoalInput('total', 'units', sdGoalTotal.units, 'Company total units', sums.units ? String(sums.units) : '') +
      sdGoalInput('total', 'revenue', sdGoalTotal.revenue, 'Company total revenue', sums.revenue ? sums.revenue.toFixed(2) : '') +
      sdGoalInput('total', 'asp', sdGoalTotal.asp, 'Company total ASP', sdAspHint(totalUnits, totalRevenue)) + '</tr>';
    body.innerHTML = html;
    body.querySelectorAll('input').forEach(function(inp){
      inp.addEventListener('change', function(){
        var i = inp.getAttribute('data-i');
        var row = i === 'total' ? sdGoalTotal : sdGoalRows[Number(i)];
        if(row) row[inp.getAttribute('data-f')] = inp.value;
        sdRenderGoalRows();
      });
    });
  }

  async function sdCopyGoals(){
    var from = sdEl('sd-goal-copy').value;
    if(!from){ sdGoalMsg('Pick the month to copy from.'); return; }
    try {
      var source = sdGoalsFor(await sdFetchGoalYear(from.slice(0, 4)), Number(from.slice(5, 7)), false);
      var hasTotal = !!(source.total.units || source.total.revenue || source.total.asp);
      if(!source.rows.length && !hasTotal){ sdGoalMsg(sdMonthName(from) + ' has no goals to copy.'); return; }
      var byLabel = {};
      sdGoalRows.forEach(function(row){ byLabel[row.label.toLowerCase()] = row; });
      source.rows.forEach(function(s){
        var target = byLabel[s.label.toLowerCase()];
        if(target){ target.units = s.units; target.revenue = s.revenue; target.asp = s.asp; }
        else sdGoalRows.push(s);
      });
      sdGoalRows.sort(function(a, b){ return a.label.localeCompare(b.label); });
      if(hasTotal) sdGoalTotal = source.total;
      sdRenderGoalRows();
      sdGoalMsg('Copied from ' + sdMonthName(from) + '. Nothing is saved until you press Save month.', true);
    } catch (err) {
      sdGoalMsg(err.message);
    }
  }

  function sdAddGoalMarket(){
    var input = sdEl('sd-goal-new-market');
    var label = input.value.trim();
    if(!label) return;
    var taken = sdGoalRows.some(function(row){ return row.label.toLowerCase() === label.toLowerCase(); });
    if(taken){ sdGoalMsg(label + ' is already listed.'); return; }
    sdGoalRows.push({ label: label, units: '', revenue: '', asp: '' });
    sdGoalRows.sort(function(a, b){ return a.label.localeCompare(b.label); });
    input.value = '';
    sdGoalMsg('');
    sdRenderGoalRows();
  }

  async function sdSaveGoals(){
    var key = sdEl('sd-goal-month').value;
    if(!key){ sdGoalMsg('Pick the month these goals are for.'); return; }
    // A value typed but not yet committed by leaving its box still counts.
    sdEl('sd-goal-body').querySelectorAll('input').forEach(function(inp){
      var i = inp.getAttribute('data-i');
      var row = i === 'total' ? sdGoalTotal : sdGoalRows[Number(i)];
      if(row) row[inp.getAttribute('data-f')] = inp.value;
    });
    var goals = sdGoalRows.map(function(row){
      return { marketLabel: row.label, units: row.units, revenue: row.revenue, asp: row.asp };
    });
    goals.push({ marketKey: 'total', marketLabel: 'Company total', units: sdGoalTotal.units, revenue: sdGoalTotal.revenue, asp: sdGoalTotal.asp });
    var btn = sdEl('sd-goals-save');
    btn.disabled = true;
    var r = await api('PUT', '/sales-dashboard/goals', { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)), goals: goals });
    btn.disabled = false;
    if(!r.ok){ sdGoalMsg('Could not save: ' + ((r.data && r.data.error) || 'unknown error')); return; }
    sdGoalMsg('Saved goals for ' + sdMonthName(key) + '.', true);
    loadSalesDashboard();
  }

  // ── Holidays ──
  function sdHolidayMsg(text){
    var el = sdEl('sd-holidays-msg');
    el.className = text ? 'sd-error' : 'hidden';
    el.textContent = text || '';
  }

  async function sdOpenHolidays(){
    sdHolidayMsg('');
    sdEl('sd-holidays-modal').classList.remove('hidden');
    await sdLoadHolidays();
  }

  async function sdLoadHolidays(){
    var box = sdEl('sd-holiday-list');
    var r = await api('GET', '/sales-dashboard/holidays');
    if(!r.ok){ box.innerHTML = '<div class="sd-error">Could not load holidays.</div>'; return; }
    var list = r.data.holidays || [];
    if(!list.length){ box.innerHTML = '<div class="sd-muted" style="font-size:0.85rem">No holidays yet, so every weekday counts.</div>'; return; }
    box.innerHTML = list.map(function(h){
      return '<div class="sd-item"><div class="sd-item-main"><b>' + esc(sdDate(h.day)) + '</b> <span class="sd-muted">' + esc(sdWeekday(h.day)) +
        '</span> · ' + esc(h.label) + '</div><button type="button" class="btn btn-sm btn-ghost sd-holiday-del" data-day="' + esc(h.day) + '">Remove</button></div>';
    }).join('');
    box.querySelectorAll('.sd-holiday-del').forEach(function(b){
      b.addEventListener('click', async function(){
        var res = await api('DELETE', '/sales-dashboard/holidays/' + encodeURIComponent(b.getAttribute('data-day')));
        if(!res.ok){ sdHolidayMsg('Could not remove that holiday.'); return; }
        await sdLoadHolidays();
        loadSalesDashboard();
      });
    });
  }

  async function sdAddHoliday(){
    var day = sdEl('sd-holiday-day').value;
    var label = sdEl('sd-holiday-label').value.trim();
    if(!day || !label){ sdHolidayMsg('Give the date and the holiday' + "'" + 's name.'); return; }
    var r = await api('POST', '/sales-dashboard/holidays', { day: day, label: label });
    if(!r.ok){ sdHolidayMsg('Could not add it: ' + ((r.data && r.data.error) || 'unknown error')); return; }
    sdEl('sd-holiday-day').value = '';
    sdEl('sd-holiday-label').value = '';
    sdHolidayMsg('');
    await sdLoadHolidays();
    loadSalesDashboard();
  }

  function sdOn(id, ev, fn){
    var el = sdEl(id);
    if(el) el.addEventListener(ev, fn);
  }

  sdOn('sd-month', 'change', function(){ loadSalesDashboard(); });
  sdOn('sd-refresh', 'click', sdRefresh);
  sdOn('sd-goals-open', 'click', sdOpenGoals);
  sdOn('sd-goal-month', 'change', sdLoadGoalMonth);
  sdOn('sd-goal-copy-btn', 'click', sdCopyGoals);
  sdOn('sd-goal-add-market', 'click', sdAddGoalMarket);
  sdOn('sd-goals-save', 'click', sdSaveGoals);
  sdOn('sd-goals-close', 'click', function(){ sdEl('sd-goals-modal').classList.add('hidden'); });
  sdOn('sd-holidays-open', 'click', sdOpenHolidays);
  sdOn('sd-holiday-add', 'click', sdAddHoliday);
  sdOn('sd-holidays-close', 'click', function(){ sdEl('sd-holidays-modal').classList.add('hidden'); });
`;
