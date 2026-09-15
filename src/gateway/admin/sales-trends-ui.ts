// The sales dashboard's Charts tab: any metric, for the company, one market or
// every market side by side, over a range of months, drawn as inline SVG.
//
// Chart rules (the dataviz method): one filter row above the chart; one y-axis;
// thin marks (2px lines, 8px dots with a surface ring, columns no wider than
// 24px with 4px rounded ends); hairline grid; a legend whenever two or more
// series share a plot, and none for one; text in text colors, never series
// colors; a crosshair tooltip on hover and on keyboard focus; and the same
// numbers in a table below. Series colors were run through the palette
// validator against the Hub's white surface: blue #2a78d6 and orange #eb6834
// pass every check. Goal lines are gray: they are context, not a series to
// tell apart by hue.
//
// Markets side by side share one scale, so their heights compare, and draw in
// one color: the market's name above each chart carries identity, not hue.
//
// The inline JS lives in a template literal, which eats backslashes: no regex
// escapes and no backslashes in its comments, and no dollar sign followed by an
// open brace.

export const SALES_TRENDS_CSS = `
  #sd-view-trends { --sdt-series-1: #2a78d6; --sdt-series-2: #eb6834; --sdt-goal: #8a8a8a; }
  .sdt-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.6rem 0.9rem; margin: 0 0 0.9rem; }
  .sdt-field { display: flex; flex-direction: column; gap: 0.2rem; color: var(--text-muted); font-size: 0.69rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; }
  .sdt-field select, .sdt-custom input { width: auto; min-width: 8.5rem; font-size: 0.85rem; font-weight: 400; letter-spacing: normal; text-transform: none; }
  .sdt-custom { display: flex; align-items: center; gap: 0.35rem; color: var(--text-muted); }
  .sdt-single { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.9rem; }
  .sdt-seg { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius-pill); overflow: hidden; background: var(--surface); }
  .sdt-seg button { border: 0; background: transparent; color: var(--text-muted); cursor: pointer; font: inherit; font-size: 0.82rem; padding: 0.4rem 0.85rem; }
  .sdt-seg button[aria-checked="true"] { background: var(--surface2); color: var(--text); font-weight: 600; }
  .sdt-check { display: inline-flex; align-items: center; gap: 0.35rem; margin: 0; color: var(--text); cursor: pointer; font-size: 0.85rem; font-weight: 400; letter-spacing: normal; text-transform: none; white-space: nowrap; }
  .sdt-check input { width: auto; margin: 0; }
  .sdt-check.sdt-off { color: var(--text-muted); cursor: default; }
  .sdt-legend { display: flex; flex-wrap: wrap; gap: 0.35rem 1rem; color: var(--text-muted); font-size: 0.78rem; }
  .sdt-legend-item { display: inline-flex; align-items: center; gap: 0.4rem; }
  .sdt-key { display: inline-block; flex-shrink: 0; width: 14px; height: 2px; border-radius: 2px; }
  .sdt-key-box { width: 10px; height: 10px; border-radius: 3px; }
  .sdt-body { padding: 0.9rem 1.1rem 0.5rem; transition: opacity 0.15s ease; }
  .sdt-body.sdt-loading { opacity: 0.5; }
  .sdt-plot { position: relative; }
  .sdt-svg { display: block; width: 100%; height: auto; overflow: visible; outline: none; touch-action: pan-y; }
  .sdt-svg:focus-visible { box-shadow: 0 0 0 3px var(--accent-ring); border-radius: 6px; }
  .sdt-gridline { stroke: var(--hairline); stroke-width: 1; }
  .sdt-baseline { stroke: var(--border); stroke-width: 1; }
  .sdt-tick { fill: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .sdt-end { fill: var(--text); font-size: 12px; font-weight: 600; }
  .sdt-line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .sdt-line-partial { opacity: 0.4; }
  #sdt-table { width: auto; min-width: min(100%, 34rem); }
  .sdt-dot { stroke: var(--surface); stroke-width: 2; }
  .sdt-dot-partial { fill: var(--surface); stroke-width: 2; }
  .sdt-bar-partial { opacity: 0.45; }
  .sdt-cross { stroke: var(--text-muted); stroke-width: 1; pointer-events: none; }
  .sdt-hover-band { fill: rgba(44, 44, 44, 0.05); pointer-events: none; }
  .sdt-hit { fill: transparent; }
  .sdt-tip { position: absolute; z-index: 5; min-width: 9rem; padding: 0.5rem 0.65rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); font-size: 0.8rem; pointer-events: none; }
  .sdt-tip-head { margin-bottom: 0.25rem; color: var(--text-muted); font-size: 0.72rem; white-space: nowrap; }
  .sdt-tip-row { display: flex; align-items: center; gap: 0.45rem; white-space: nowrap; }
  .sdt-tip-row strong { color: var(--text); font-variant-numeric: tabular-nums; }
  .sdt-tip-name { color: var(--text-muted); }
  .sdt-multiples { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(15rem, 100%), 1fr)); gap: 0.75rem; }
  .sdt-mini { border: 1px solid var(--hairline); border-radius: var(--radius-sm); padding: 0.55rem 0.65rem 0.2rem; }
  .sdt-mini-head { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.82rem; }
  .sdt-mini-name { font-weight: 600; }
  .sdt-mini-value { color: var(--text-muted); }
  .sdt-table-toggle { border-top: 1px solid var(--hairline); }
  .sdt-table-toggle summary { padding: 0.6rem 1.1rem; color: var(--text-muted); cursor: pointer; font-size: 0.82rem; font-weight: 600; }
`;

export const SALES_TRENDS_MARKUP = `
        <div id="sd-view-trends" class="hidden">
          <div class="sdt-filters" role="group" aria-label="Chart options">
            <label class="sdt-field">Time
              <select id="sdt-range">
                <option value="6">Last 6 months</option>
                <option value="12">Last 12 months</option>
                <option value="24">Last 24 months</option>
                <option value="ytd">This year</option>
                <option value="lastyear">Last year</option>
                <option value="custom">Pick months</option>
              </select>
            </label>
            <span class="sdt-custom hidden" id="sdt-custom">
              <input type="month" id="sdt-from" aria-label="First month" /> to <input type="month" id="sdt-to" aria-label="Last month" />
            </span>
            <label class="sdt-field">Market
              <select id="sdt-show"></select>
            </label>
            <label class="sdt-field">Metric
              <select id="sdt-metric">
                <option value="units">Units</option>
                <option value="revenue">Revenue</option>
                <option value="asp">ASP</option>
                <option value="clients">New clients</option>
                <option value="share">Market share</option>
                <option value="unitsPct">Units % to goal</option>
                <option value="revenuePct">Revenue % to goal</option>
              </select>
            </label>
            <div class="sdt-single" id="sdt-single">
              <div class="sdt-seg" role="radiogroup" aria-label="Chart style" id="sdt-style">
                <button type="button" role="radio" data-style="line" aria-checked="true">Line</button>
                <button type="button" role="radio" data-style="columns" aria-checked="false">Columns</button>
              </div>
              <label class="sdt-check" id="sdt-goal-wrap"><input type="checkbox" id="sdt-goal" /> Goal</label>
              <label class="sdt-check"><input type="checkbox" id="sdt-lastyear" /> Same month last year</label>
            </div>
          </div>

          <div class="card sd-card">
            <div class="sd-card-head">
              <div class="sd-card-title" id="sdt-title">Charts</div>
              <div class="sdt-legend" id="sdt-legend"></div>
            </div>
            <div class="sdt-body" id="sdt-body">
              <div class="sdt-plot" id="sdt-plot"></div>
              <div class="sdt-multiples hidden" id="sdt-multiples"></div>
              <div class="sd-empty hidden" id="sdt-msg"></div>
            </div>
            <details class="sdt-table-toggle">
              <summary>Show the numbers</summary>
              <div class="sd-table-wrap"><table class="sd-table" id="sdt-table"></table></div>
            </details>
            <div class="sd-card-foot">Each point is that month's figure as the Report tab counts it: completed shoots, on the day of the shoot. A hollow point or pale column is the month so far, through yesterday; its goal and last year are whole months.</div>
          </div>
        </div>`;

export const SALES_TRENDS_COMPONENT_JS = `
  // ── Report and Charts tabs ──
  var sdView = (function(){
    try {
      return localStorage.getItem('sd-view') === 'trends' ? 'trends' : 'report';
    } catch (e) {
      return 'report';
    }
  })();

  function sdApplyView(){
    var report = sdEl('sd-view-report');
    var charts = sdEl('sd-view-trends');
    if(!report || !charts) return;
    var trends = sdView === 'trends';
    report.classList.toggle('hidden', trends);
    charts.classList.toggle('hidden', !trends);
    sdEl('sd-tab-report').setAttribute('aria-selected', trends ? 'false' : 'true');
    sdEl('sd-tab-trends').setAttribute('aria-selected', trends ? 'true' : 'false');
    // The month picker and comparison belong to the report; the charts have their own range.
    ['sd-month', 'sd-compare'].forEach(function(id){
      var el = sdEl(id);
      if(el) el.classList.toggle('hidden', trends);
    });
    if(trends) sdtOpen();
  }

  function sdSetView(view){
    sdView = view === 'trends' ? 'trends' : 'report';
    try { localStorage.setItem('sd-view', sdView); } catch (e) { /* this browser keeps no settings */ }
    sdApplyView();
  }

  // ── Charts ──
  var SDT_METRICS = {
    units: { label: 'Units', field: 'units', goal: 'goalUnits', fmt: 'num' },
    revenue: { label: 'Revenue', field: 'revenueCents', goal: 'goalRevenueCents', fmt: 'money' },
    asp: { label: 'ASP', field: 'aspCents', goal: null, fmt: 'money' },
    clients: { label: 'New clients', field: 'newClients', goal: null, fmt: 'num' },
    share: { label: 'Market share', field: 'sharePct', goal: null, fmt: 'pct' },
    unitsPct: { label: 'Units % to goal', field: 'unitsPct', goal: null, fmt: 'pct' },
    revenuePct: { label: 'Revenue % to goal', field: 'revenuePct', goal: null, fmt: 'pct' }
  };
  var SDT_DEFAULTS = { range: '12', from: '', to: '', show: 'total', metric: 'units', style: 'line', goal: true, lastYear: false };
  var SDT_MAX_PICKED = 36;
  var sdtState = (function(){
    var state = {};
    Object.keys(SDT_DEFAULTS).forEach(function(k){ state[k] = SDT_DEFAULTS[k]; });
    try {
      var saved = JSON.parse(localStorage.getItem('sd-trends') || '{}');
      Object.keys(SDT_DEFAULTS).forEach(function(k){
        if(saved && typeof saved[k] === typeof SDT_DEFAULTS[k]) state[k] = saved[k];
      });
    } catch (e) { /* defaults */ }
    if(!SDT_METRICS[state.metric]) state.metric = 'units';
    return state;
  })();
  var sdtData = null;
  var sdtAsked = null;
  var sdtRequest = 0;
  var sdtResizeTimer = null;
  // What the chart last drew, for its table and its CSV.
  var sdtLast = null;

  function sdtMetric(){ return SDT_METRICS[sdtState.metric] || SDT_METRICS.units; }
  function sdtBounds(){
    return { min: (sdData && sdData.months.min) || '2025-01', max: (sdData && sdData.months.max) || sdThisMonth() };
  }
  function sdtAddMonths(key, n){
    var index = (+key.slice(0, 4)) * 12 + (+key.slice(5, 7) - 1) + n;
    return Math.floor(index / 12) + '-' + String(index % 12 + 1).padStart(2, '0');
  }
  function sdtMonthCount(from, to){
    return ((+to.slice(0, 4)) * 12 + (+to.slice(5, 7))) - ((+from.slice(0, 4)) * 12 + (+from.slice(5, 7))) + 1;
  }
  function sdtRange(){
    var max = sdtBounds().max;
    var r = sdtState.range;
    if(r === 'custom' && sdtState.from && sdtState.to){
      return sdtState.from <= sdtState.to ? { from: sdtState.from, to: sdtState.to } : { from: sdtState.to, to: sdtState.from };
    }
    if(r === 'ytd') return { from: max.slice(0, 4) + '-01', to: max };
    if(r === 'lastyear'){
      var year = +max.slice(0, 4) - 1;
      return { from: year + '-01', to: year + '-12' };
    }
    var n = r === '6' ? 6 : (r === '24' ? 24 : 12);
    return { from: sdtAddMonths(max, -(n - 1)), to: max };
  }
  function sdtShortMonth(key){ return SD_MONTHS[+key.slice(5, 7) - 1] + ' ' + key.slice(0, 4); }
  function sdtShowLabel(){
    var sel = sdEl('sdt-show');
    var option = sel && sel.options[sel.selectedIndex];
    return option ? option.textContent : 'Company total';
  }

  function sdtCompactNum(n){
    if(Math.abs(n) >= 10000) return (Math.round(n / 100) / 10).toLocaleString('en-US') + 'K';
    return (Math.round(n * 10) / 10).toLocaleString('en-US');
  }
  function sdtCompactMoney(cents){
    var d = cents / 100;
    if(Math.abs(d) >= 1000000) return '$' + (Math.round(d / 100000) / 10) + 'M';
    if(Math.abs(d) >= 10000) return '$' + Math.round(d / 1000) + 'K';
    if(Math.abs(d) >= 1000) return '$' + (Math.round(d / 100) / 10) + 'K';
    return '$' + Math.round(d);
  }
  function sdtFormat(v, fmt, compact){
    if(v === null || v === undefined) return '—';
    if(fmt === 'money') return compact ? sdtCompactMoney(v) : sdMoney(v);
    if(fmt === 'pct') return (compact ? String(Math.round(v)) : v.toFixed(2)) + '%';
    return compact ? sdtCompactNum(v) : sdNum(v);
  }
  function sdtValue(point, field){
    if(!point) return null;
    var v = point[field];
    return v === undefined ? null : v;
  }
  function sdtPoint(month, key){
    if(!month) return null;
    if(key === 'total') return month.total;
    return (month.rows || []).filter(function(r){ return r.key === key; })[0] || null;
  }

  // Round tick steps: 1, 2, 2.5 or 5 of a power of ten; whole numbers only for counts.
  function sdtScale(maxV, count, whole){
    if(!(maxV > 0)) return { max: count, step: 1 };
    var raw = maxV / count;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var steps = [1, 2, 2.5, 5, 10];
    var step = mag * 10;
    for(var i = 0; i < steps.length; i++){
      var s = mag * steps[i];
      if(whole && s % 1 !== 0) continue;
      if(s >= raw){ step = s; break; }
    }
    return { max: Math.ceil(maxV / step) * step, step: step };
  }

  function sdtOpen(){
    var sel = sdEl('sdt-show');
    if(!sel) return;
    var options = [{ v: 'total', t: 'Company total' }, { v: 'all', t: 'All markets, side by side' }];
    ((sdData && sdData.markets) || []).forEach(function(m){
      options.push({ v: m.key, t: m.label + (m.removedFrom ? ' (stopped)' : '') });
    });
    options.push({ v: 'other', t: 'Other markets' });
    sel.textContent = '';
    options.forEach(function(o){
      var el = document.createElement('option');
      el.value = o.v;
      el.textContent = o.t;
      sel.appendChild(el);
    });
    if(!options.some(function(o){ return o.v === sdtState.show; })) sdtState.show = 'total';
    sdtSyncControls();
    sdtLoad();
  }

  function sdtSyncControls(){
    var metric = sdtMetric();
    var bounds = sdtBounds();
    var range = sdtRange();
    sdEl('sdt-range').value = sdtState.range;
    sdEl('sdt-custom').classList.toggle('hidden', sdtState.range !== 'custom');
    ['sdt-from', 'sdt-to'].forEach(function(id){
      var el = sdEl(id);
      el.min = bounds.min;
      el.max = bounds.max;
    });
    sdEl('sdt-from').value = range.from;
    sdEl('sdt-to').value = range.to;
    sdEl('sdt-show').value = sdtState.show;
    sdEl('sdt-metric').value = sdtState.metric;
    sdEl('sdt-single').classList.toggle('hidden', sdtState.show === 'all');
    sdEl('sdt-style').querySelectorAll('button').forEach(function(b){
      b.setAttribute('aria-checked', b.getAttribute('data-style') === sdtState.style ? 'true' : 'false');
    });
    var goal = sdEl('sdt-goal');
    goal.disabled = !metric.goal;
    goal.checked = !!metric.goal && sdtState.goal;
    sdEl('sdt-goal-wrap').classList.toggle('sdt-off', !metric.goal);
    sdEl('sdt-goal-wrap').title = metric.goal ? '' : 'Goals are set for units and revenue';
    sdEl('sdt-lastyear').checked = sdtState.lastYear;
  }

  function sdtSet(patch){
    Object.keys(patch).forEach(function(k){ sdtState[k] = patch[k]; });
    try { localStorage.setItem('sd-trends', JSON.stringify(sdtState)); } catch (e) { /* not kept */ }
    sdtSyncControls();
    sdtLoad();
  }

  function sdtMessage(text){
    var el = sdEl('sdt-msg');
    el.classList.toggle('hidden', !text);
    el.textContent = text || '';
  }

  async function sdtLoad(){
    var range = sdtRange();
    var from = sdtState.lastYear && sdtState.show !== 'all' ? sdtAddMonths(range.from, -12) : range.from;
    // What was already fetched covers a narrower ask too.
    if(sdtData && sdtAsked && sdtAsked.from <= from && sdtAsked.to >= range.to){
      sdtRender();
      return;
    }
    var body = sdEl('sdt-body');
    body.classList.add('sdt-loading');
    var mine = ++sdtRequest;
    var r = await api('GET', '/sales-dashboard/trends?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(range.to));
    if(mine !== sdtRequest) return;
    body.classList.remove('sdt-loading');
    if(!r.ok){
      sdtMessage('Could not load the charts: ' + sdError(r));
      return;
    }
    sdtData = r.data;
    sdtAsked = { from: from, to: range.to };
    sdtRender();
  }

  function sdtRender(){
    if(!sdtData) return;
    var metric = sdtMetric();
    var range = sdtRange();
    var months = (sdtData.months || []).filter(function(m){ return m.month >= range.from && m.month <= range.to; });
    var plot = sdEl('sdt-plot');
    var grid = sdEl('sdt-multiples');
    var all = sdtState.show === 'all';
    sdtMessage('');
    sdEl('sdt-title').textContent = metric.label + ' · ' + sdtShowLabel() +
      (months.length ? ' · ' + sdtShortMonth(months[0].month) + (months.length > 1 ? ' – ' + sdtShortMonth(months[months.length - 1].month) : '') : '');
    plot.classList.toggle('hidden', all);
    grid.classList.toggle('hidden', !all);
    plot.textContent = '';
    grid.textContent = '';
    sdEl('sdt-legend').textContent = '';
    if(!months.length){
      sdtMessage('There are no months with numbers in this range. The order history starts in ' + sdMonthName(sdtData.range.min) + '.');
      sdtTable(null, null, metric.fmt);
      return;
    }
    if(all){
      sdtTable(months, sdtMultiples(grid, months, metric), metric.fmt);
      return;
    }
    var series = sdtSeries(months, metric);
    sdtLegend(series);
    sdtDraw(plot, months, series, { fmt: metric.fmt, label: sdEl('sdt-title').textContent });
    sdtTable(months, series, metric.fmt);
  }

  function sdtSeries(months, metric){
    var key = sdtState.show;
    var byMonth = {};
    (sdtData.months || []).forEach(function(m){ byMonth[m.month] = m; });
    var series = [{
      name: sdtShowLabel(),
      color: 'var(--sdt-series-1)',
      kind: sdtState.style === 'columns' ? 'columns' : 'line',
      values: months.map(function(m){ return sdtValue(sdtPoint(m, key), metric.field); })
    }];
    if(metric.goal && sdtState.goal){
      series.push({ name: 'Goal', color: 'var(--sdt-goal)', kind: 'line', values: months.map(function(m){ return sdtValue(sdtPoint(m, key), metric.goal); }) });
    }
    if(sdtState.lastYear){
      series.push({
        name: 'Same month last year',
        color: 'var(--sdt-series-2)',
        kind: 'line',
        values: months.map(function(m){ return sdtValue(sdtPoint(byMonth[sdtAddMonths(m.month, -12)], key), metric.field); })
      });
    }
    return series;
  }

  function sdtLegend(series){
    var box = sdEl('sdt-legend');
    box.textContent = '';
    if(series.length < 2) return;
    series.forEach(function(s){
      var item = document.createElement('span');
      item.className = 'sdt-legend-item';
      var key = document.createElement('span');
      key.className = s.kind === 'columns' ? 'sdt-key sdt-key-box' : 'sdt-key';
      key.style.background = s.color;
      item.appendChild(key);
      item.appendChild(document.createTextNode(s.name));
      box.appendChild(item);
    });
  }

  function sdtLastIndex(values){
    for(var i = values.length - 1; i >= 0; i--){ if(values[i] !== null) return i; }
    return -1;
  }

  // One chart. The SVG is drawn at the width it has and scales with it, so a
  // print or a resize keeps its proportions.
  function sdtDraw(host, months, series, opts){
    var compact = !!opts.compact;
    var width = Math.max(compact ? 220 : 320, Math.round(host.clientWidth || (compact ? 280 : 720)));
    var height = compact ? 150 : 300;
    var pad = compact ? { l: 46, r: 14, t: 12, b: 26 } : { l: 64, r: 70, t: 18, b: 30 };
    var plotW = width - pad.l - pad.r;
    var plotH = height - pad.t - pad.b;
    var n = months.length;
    var maxV = 0;
    if(opts.yMax !== undefined) maxV = opts.yMax;
    else series.forEach(function(s){ s.values.forEach(function(v){ if(v !== null && v > maxV) maxV = v; }); });
    var scale = sdtScale(maxV, compact ? 3 : 5, opts.fmt === 'num');
    var band = plotW / Math.max(n, 1);
    var base = pad.t + plotH;
    var r1 = function(v){ return Math.round(v * 10) / 10; };
    var xAt = function(i){ return r1(pad.l + band * (i + 0.5)); };
    var yAt = function(v){ return r1(base - (v / scale.max) * plotH); };
    var hasColumns = series.some(function(s){ return s.kind === 'columns'; });

    var svg = '<svg class="sdt-svg" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height +
      '" role="img" tabindex="0" aria-label="' + esc(opts.label || 'Chart') + '. Use the left and right arrow keys to read each month.">';
    var ticks = Math.round(scale.max / scale.step);
    for(var k = 0; k <= ticks; k++){
      var t = k * scale.step;
      var gy = yAt(t);
      svg += '<line class="' + (k === 0 ? 'sdt-baseline' : 'sdt-gridline') + '" x1="' + pad.l + '" x2="' + (pad.l + plotW) + '" y1="' + gy + '" y2="' + gy + '"/>';
      svg += '<text class="sdt-tick" x="' + (pad.l - 8) + '" y="' + (gy + 4) + '" text-anchor="end">' + esc(sdtFormat(t, opts.fmt, true)) + '</text>';
    }
    var room = Math.max(1, Math.floor(plotW / (compact ? 70 : 58)));
    var every = Math.max(1, Math.ceil(n / room));
    months.forEach(function(m, i){
      var first = i === 0;
      var last = i === n - 1;
      if(compact ? !(first || last) : i % every !== 0) return;
      var anchor = compact ? (first && n > 1 ? 'start' : (last && n > 1 ? 'end' : 'middle')) : 'middle';
      var x = compact && n > 1 ? (first ? pad.l : pad.l + plotW) : xAt(i);
      var label = SD_MONTHS[+m.month.slice(5, 7) - 1] + (first || m.month.slice(5) === '01' ? " '" + m.month.slice(2, 4) : '');
      svg += '<text class="sdt-tick" x="' + x + '" y="' + (height - 8) + '" text-anchor="' + anchor + '">' + esc(label) + '</text>';
    });

    svg += hasColumns
      ? '<rect class="sdt-hover-band" x="0" y="' + pad.t + '" width="' + r1(band) + '" height="' + plotH + '" visibility="hidden"/>'
      : '<line class="sdt-cross" x1="0" x2="0" y1="' + pad.t + '" y2="' + base + '" visibility="hidden"/>';

    series.forEach(function(s, si){
      var lastI = sdtLastIndex(s.values);
      if(s.kind === 'columns'){
        var w = Math.min(24, band * 0.62);
        s.values.forEach(function(v, i){
          if(v === null || !(v > 0)) return;
          var x0 = r1(xAt(i) - w / 2);
          var x1 = r1(x0 + w);
          var top = yAt(v);
          var rr = r1(Math.min(4, w / 2, base - top));
          svg += '<path class="sdt-bar' + (months[i].partial ? ' sdt-bar-partial' : '') + '" style="fill:' + s.color + '" d="M' + x0 + ' ' + base +
            'V' + r1(top + rr) + 'Q' + x0 + ' ' + top + ' ' + r1(x0 + rr) + ' ' + top + 'H' + r1(x1 - rr) + 'Q' + x1 + ' ' + top + ' ' + x1 + ' ' + r1(top + rr) + 'V' + base + 'Z"/>';
        });
      } else {
        // The step into the month so far is drawn faint, so a month that is not
        // over yet does not read as a collapse. Goal and last year are whole months.
        var solid = '';
        var faint = '';
        s.values.forEach(function(v, i){
          if(v === null || i === 0 || s.values[i - 1] === null) return;
          var step = 'M' + xAt(i - 1) + ' ' + yAt(s.values[i - 1]) + 'L' + xAt(i) + ' ' + yAt(v);
          if(si === 0 && months[i].partial) faint += step;
          else solid += step;
        });
        if(solid) svg += '<path class="sdt-line" style="stroke:' + s.color + '" d="' + solid + '"/>';
        if(faint) svg += '<path class="sdt-line sdt-line-partial" style="stroke:' + s.color + '" d="' + faint + '"/>';
        s.values.forEach(function(v, i){
          if(v === null || (compact && i !== lastI)) return;
          var partial = si === 0 && months[i].partial;
          svg += '<circle class="sdt-dot' + (partial ? ' sdt-dot-partial' : '') + '" cx="' + xAt(i) + '" cy="' + yAt(s.values[i]) + '" r="4" style="' +
            (partial ? 'stroke:' : 'fill:') + s.color + '"/>';
        });
      }
      // One direct label: the latest value of the series the chart is about.
      if(!compact && si === 0 && lastI >= 0){
        var lv = s.values[lastI];
        svg += s.kind === 'columns'
          ? '<text class="sdt-end" x="' + xAt(lastI) + '" y="' + (yAt(lv) - 8) + '" text-anchor="middle">' + esc(sdtFormat(lv, opts.fmt, true)) + '</text>'
          : '<text class="sdt-end" x="' + (xAt(lastI) + 10) + '" y="' + (yAt(lv) + 4) + '">' + esc(sdtFormat(lv, opts.fmt, true)) + '</text>';
      }
    });
    svg += '<rect class="sdt-hit" x="' + pad.l + '" y="' + pad.t + '" width="' + r1(plotW) + '" height="' + plotH + '"/></svg>';
    host.innerHTML = svg + '<div class="sdt-tip hidden" role="status"></div>';

    var svgEl = host.querySelector('svg');
    var tip = host.querySelector('.sdt-tip');
    var marker = host.querySelector(hasColumns ? '.sdt-hover-band' : '.sdt-cross');
    var current = -1;
    function hide(){
      current = -1;
      marker.setAttribute('visibility', 'hidden');
      tip.classList.add('hidden');
    }
    function show(i){
      if(n === 0) return;
      current = Math.max(0, Math.min(n - 1, i));
      if(hasColumns){
        marker.setAttribute('x', r1(xAt(current) - band / 2));
      } else {
        marker.setAttribute('x1', xAt(current));
        marker.setAttribute('x2', xAt(current));
      }
      marker.setAttribute('visibility', 'visible');
      sdtTip(tip, months[current], series, opts.fmt, current);
      tip.classList.remove('hidden');
      var rect = svgEl.getBoundingClientRect();
      var px = (xAt(current) / width) * rect.width;
      var left = px + 14;
      if(left + tip.offsetWidth > host.clientWidth) left = px - tip.offsetWidth - 14;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = (compact ? 2 : 8) + 'px';
    }
    svgEl.addEventListener('pointermove', function(e){
      var rect = svgEl.getBoundingClientRect();
      var x = (e.clientX - rect.left) * (width / rect.width);
      show(Math.floor((x - pad.l) / band));
    });
    svgEl.addEventListener('pointerleave', hide);
    svgEl.addEventListener('blur', hide);
    svgEl.addEventListener('focus', function(){ if(current < 0) show(n - 1); });
    svgEl.addEventListener('keydown', function(e){
      if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
        e.preventDefault();
        show(current < 0 ? n - 1 : current + (e.key === 'ArrowRight' ? 1 : -1));
      } else if(e.key === 'Escape'){
        hide();
      }
    });
  }

  function sdtTip(tip, month, series, fmt, i){
    tip.textContent = '';
    var head = document.createElement('div');
    head.className = 'sdt-tip-head';
    head.textContent = sdMonthName(month.month) + (month.partial ? ' · through ' + sdShortDate(month.throughDay) : '');
    tip.appendChild(head);
    series.forEach(function(s){
      var row = document.createElement('div');
      row.className = 'sdt-tip-row';
      var key = document.createElement('span');
      key.className = 'sdt-key';
      key.style.background = s.color;
      var value = document.createElement('strong');
      value.textContent = sdtFormat(s.values[i], fmt, false);
      var name = document.createElement('span');
      name.className = 'sdt-tip-name';
      name.textContent = s.name;
      row.appendChild(key);
      row.appendChild(value);
      row.appendChild(name);
      tip.appendChild(row);
    });
  }

  // Every market as its own small chart, on one shared scale so heights compare.
  function sdtMultiples(grid, months, metric){
    var labels = {};
    var keys = [];
    months.slice().reverse().forEach(function(m){
      (m.rows || []).forEach(function(r){
        if(labels[r.key] === undefined){ labels[r.key] = r.label; keys.push(r.key); }
      });
    });
    keys.sort(function(a, b){
      if(a === 'other' || b === 'other') return a === 'other' ? 1 : -1;
      return labels[a].localeCompare(labels[b]);
    });
    var maxV = 0;
    var columns = keys.map(function(k){
      var values = months.map(function(m){ return sdtValue(sdtPoint(m, k), metric.field); });
      values.forEach(function(v){ if(v !== null && v > maxV) maxV = v; });
      return { name: labels[k], color: 'var(--sdt-series-1)', kind: 'line', values: values };
    });
    columns.forEach(function(col){
      var card = document.createElement('div');
      card.className = 'sdt-mini';
      var head = document.createElement('div');
      head.className = 'sdt-mini-head';
      var name = document.createElement('span');
      name.className = 'sdt-mini-name';
      name.textContent = col.name;
      var lastI = sdtLastIndex(col.values);
      var latest = document.createElement('span');
      latest.className = 'sdt-mini-value';
      latest.textContent = lastI >= 0 ? SD_MONTHS[+months[lastI].month.slice(5, 7) - 1] + ': ' + sdtFormat(col.values[lastI], metric.fmt, false) : '—';
      head.appendChild(name);
      head.appendChild(latest);
      var plot = document.createElement('div');
      plot.className = 'sdt-plot';
      card.appendChild(head);
      card.appendChild(plot);
      grid.appendChild(card);
      sdtDraw(plot, months, [col], { fmt: metric.fmt, compact: true, yMax: maxV, label: metric.label + ', ' + col.name });
    });
    return columns;
  }

  function sdtTable(months, columns, fmt){
    var table = sdEl('sdt-table');
    sdtLast = months && columns && columns.length ? { months: months, columns: columns, fmt: fmt } : null;
    if(!sdtLast){
      table.innerHTML = '';
      return;
    }
    var spans = [1].concat(columns.map(function(){ return 1; }));
    table.innerHTML = sdCols(spans) + '<thead><tr><th class="sd-market-head">Month</th>' +
      columns.map(function(c){ return '<th class="num">' + esc(c.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      months.map(function(m, i){
        return '<tr><td class="sd-market">' + esc(sdMonthName(m.month) + (m.partial ? ' (so far)' : '')) + '</td>' +
          columns.map(function(c){ return sdCell(esc(sdtFormat(c.values[i], fmt, false))); }).join('') + '</tr>';
      }).join('') + '</tbody>';
  }

  // The chart's numbers for a CSV: plain values, dollars rather than cents.
  function sdtCsvRows(){
    if(!sdtLast) return null;
    var raw = function(v){
      if(v === null || v === undefined) return '';
      if(sdtLast.fmt === 'money') return (v / 100).toFixed(2);
      if(sdtLast.fmt === 'pct') return v.toFixed(2);
      return String(Math.round(v * 100) / 100);
    };
    var unit = sdtLast.fmt === 'money' ? ' ($)' : (sdtLast.fmt === 'pct' ? ' (%)' : '');
    var rows = [[sdEl('sdt-title').textContent], [], ['Month'].concat(sdtLast.columns.map(function(c){ return c.name + unit; }))];
    sdtLast.months.forEach(function(m, i){
      rows.push([m.month + (m.partial ? ' (so far)' : '')].concat(sdtLast.columns.map(function(c){ return raw(c.values[i]); })));
    });
    return rows;
  }

  sdOn('sd-tab-report', 'click', function(){ sdSetView('report'); });
  sdOn('sd-tab-trends', 'click', function(){ sdSetView('trends'); });
  sdOn('sdt-range', 'change', function(){
    var value = sdEl('sdt-range').value;
    if(value === 'custom'){
      var current = sdtRange();
      sdtSet({ range: 'custom', from: current.from, to: current.to });
    } else {
      sdtSet({ range: value });
    }
  });
  ['sdt-from', 'sdt-to'].forEach(function(id){
    sdOn(id, 'change', function(){
      var from = sdEl('sdt-from').value;
      var to = sdEl('sdt-to').value;
      if(!from || !to) return;
      if(from > to){ var swap = from; from = to; to = swap; }
      // Keep the end the reader just picked, and pull the other end in to fit.
      if(sdtMonthCount(from, to) > SDT_MAX_PICKED){
        if(id === 'sdt-from') to = sdtAddMonths(from, SDT_MAX_PICKED - 1);
        else from = sdtAddMonths(to, -(SDT_MAX_PICKED - 1));
      }
      sdtSet({ range: 'custom', from: from, to: to });
    });
  });
  sdOn('sdt-show', 'change', function(){ sdtSet({ show: sdEl('sdt-show').value }); });
  sdOn('sdt-metric', 'change', function(){ sdtSet({ metric: sdEl('sdt-metric').value }); });
  sdOn('sdt-goal', 'change', function(){ sdtSet({ goal: sdEl('sdt-goal').checked }); });
  sdOn('sdt-lastyear', 'change', function(){ sdtSet({ lastYear: sdEl('sdt-lastyear').checked }); });
  (function(){
    var seg = sdEl('sdt-style');
    if(!seg) return;
    seg.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click', function(){ sdtSet({ style: b.getAttribute('data-style') }); });
    });
  })();
  window.addEventListener('resize', function(){
    clearTimeout(sdtResizeTimer);
    sdtResizeTimer = setTimeout(function(){
      var charts = sdEl('sd-view-trends');
      if(charts && charts.offsetParent !== null && sdtData) sdtRender();
    }, 150);
  });
`;
