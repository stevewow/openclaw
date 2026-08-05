// Shared inline JS for the Housing Market report, embedded verbatim by both the
// admin dashboard (admin-ui-html.ts) and the user portal (user-portal-html.ts)
// so the two read identically. The host SPA provides `esc`, `money` and
// `createReportTable` in scope. This is a string of browser JS, not a module —
// it is interpolated into each SPA's outer template literal, so it uses string
// concatenation throughout rather than nested template literals.
//
// The report's whole point is the rolling-year change measured against the
// nation: order volume alone cannot say whether a region's shoots fell because
// the market fell or because we lost share, and those need opposite responses.

export const MARKET_CSS = `
  /* The national row is the yardstick every other row is measured against, not
     a market we serve — kept visually apart wherever a sort puts it. */
  .market-national-row { background: var(--bg-subtle, rgba(127,127,127,0.07)); }
`;

export const MARKET_COMPONENT_JS = `
  // ── Housing Market report ──────────────────────────────────────────────────
  function marketFmt(value, format) {
    if (value === null || value === undefined || !isFinite(value)) return '—';
    if (format === 'money') return money(Math.round(value));
    if (format === 'percent') {
      // The feed sends sale-to-list as a ratio and price drops as a percent.
      var pct = value <= 1.5 ? value * 100 : value;
      return (Math.round(pct * 10) / 10) + '%';
    }
    if (format === 'days') return Math.round(value) + ' days';
    if (format === 'months') return (Math.round(value * 10) / 10) + ' mo';
    return Math.round(value).toLocaleString();
  }

  // Signed, so a reader never has to work out the direction.
  function marketPct(pct) {
    if (pct === null || pct === undefined || !isFinite(pct)) return '—';
    var r = Math.round(pct * 10) / 10;
    return (r > 0 ? '+' : '') + r + '%';
  }

  // Good/bad depends on the metric, not on the sign: rising days-on-market is
  // bad news, and months of supply is deliberately neither.
  function marketClass(pct, direction) {
    if (pct === null || pct === undefined || !isFinite(pct) || direction === 'neutral') return '';
    if (Math.abs(pct) < 0.05) return '';
    var good = direction === 'down' ? pct < 0 : pct > 0;
    return good ? 'focus-up' : 'focus-down';
  }

  /** Every area in report order: the nation first, then the regions. */
  function marketAreasOf(report) {
    if (!report) return [];
    return (report.national ? [report.national] : []).concat(report.regions || []);
  }

  /** The chosen metric pulled out of each area, failed areas included. */
  function marketRowsFor(report, key) {
    return marketAreasOf(report).map(function(a) {
      var m = (a.metrics || []).filter(function(x){ return x.key === key; })[0] || null;
      return { key: a.key, label: a.label, error: a.error, vsNationalPct: a.vsNationalPct, metric: m };
    });
  }

  /**
   * The metrics actually present in the payload, so one Redfin drops stops
   * being offered instead of showing a table of dashes.
   */
  function marketMetricOptions(report) {
    var seen = [];
    marketAreasOf(report).forEach(function(a){
      (a.metrics || []).forEach(function(m){
        if (!seen.some(function(x){ return x.key === m.key; })) seen.push({ key: m.key, label: m.label });
      });
    });
    return seen.length ? seen : [{ key: 'homesSold', label: 'Homes Sold' }];
  }

  /**
   * Everything a reader needs in order to distrust the numbers appropriately.
   * adminHints decides whether an unconfigured key reads as a task for you or
   * as something to ask an admin about.
   */
  function marketWarnings(report, adminHints) {
    var warn = [];
    if (!report) return warn;
    if (!report.configured) {
      warn.push(adminHints
        ? 'No RealtyAPI key is configured, so this report cannot be refreshed. Set REALTYAPI_KEY in the gateway environment.'
        : 'Market data is not set up yet. Ask an admin to configure it.');
    }
    if (report.neverRefreshed) {
      warn.push(adminHints ? 'Nothing has been pulled yet.' : 'No market data has been pulled yet.');
    } else if (report.lagMonths !== null && report.lagMonths !== undefined && report.lagMonths >= 1) {
      warn.push('The newest month in this data is ' + String(report.dataThrough || '').slice(0, 7) +
        ' — about ' + report.lagMonths + ' month' + (report.lagMonths === 1 ? '' : 's') +
        ' behind. The series is published monthly and always trails.');
    }
    if ((report.missingRegions || []).length) {
      warn.push('No market query for: ' + report.missingRegions.join(', ') + '.');
    }
    return warn;
  }

  /** getKey() supplies the metric the table is currently showing. */
  function marketCols(getKey) {
    return [
      { key: 'market', label: 'Market', type: 'text',
        value: function(r){ return r.label; },
        render: function(r){
          return '<strong>' + esc(r.label) + '</strong>' +
            (r.error ? '<div class="text-muted" style="font-size:0.75rem">' + esc(r.error) + '</div>' : '');
        } },
      { key: 'latest', label: 'Latest month', type: 'num',
        value: function(r){ return r.metric ? r.metric.latest : null; },
        render: function(r){
          if (!r.metric) return '<span class="text-muted">—</span>';
          // Redfin's own formatted string when it sent one; ours otherwise.
          return esc(r.metric.display || marketFmt(r.metric.latest, r.metric.format));
        } },
      { key: 'yoy', label: 'Redfin YoY', type: 'text',
        value: function(r){ return r.metric && r.metric.yoy ? r.metric.yoy : ''; },
        render: function(r){
          if (!r.metric || !r.metric.yoy) return '<span class="text-muted">—</span>';
          return '<span class="text-muted">' + esc(r.metric.yoy) + '</span>';
        } },
      { key: 'rolling', label: 'Last 12 mo', type: 'num',
        value: function(r){ return r.metric && r.metric.rolling ? r.metric.rolling.current : null; },
        render: function(r){
          var ro = r.metric && r.metric.rolling;
          if (!ro) return '<span class="text-muted">—</span>';
          return esc(marketFmt(ro.current, r.metric.format)) +
            '<span class="text-muted" style="font-size:0.72rem"> ' + (ro.mode === 'sum' ? 'total' : 'avg') + '</span>';
        } },
      { key: 'prior', label: 'Prior 12 mo', type: 'num',
        value: function(r){ return r.metric && r.metric.rolling ? r.metric.rolling.prior : null; },
        render: function(r){
          var ro = r.metric && r.metric.rolling;
          return ro ? esc(marketFmt(ro.prior, r.metric.format)) : '<span class="text-muted">—</span>';
        } },
      { key: 'change', label: 'Change', type: 'num',
        value: function(r){ return r.metric && r.metric.rolling ? r.metric.rolling.changePct : null; },
        render: function(r){
          var ro = r.metric && r.metric.rolling;
          if (!ro || ro.changePct === null) return '<span class="text-muted">—</span>';
          return '<span class="' + marketClass(ro.changePct, r.metric.direction) + '">' + esc(marketPct(ro.changePct)) + '</span>';
        } },
      { key: 'vsNational', label: 'vs national', type: 'num',
        value: function(r){ return r.vsNationalPct; },
        render: function(r){
          // The comparison is computed on homes sold alone, so beside a median
          // price it would be a number that means nothing.
          if (getKey() !== 'homesSold') return '<span class="text-muted">—</span>';
          if (r.vsNationalPct === null || r.vsNationalPct === undefined) return '<span class="text-muted">—</span>';
          var r1 = Math.round(r.vsNationalPct * 10) / 10;
          return '<span class="' + (r1 > 0 ? 'focus-up' : r1 < 0 ? 'focus-down' : '') + '">' +
            esc((r1 > 0 ? '+' : '') + r1 + ' pts') + '</span>';
        } }
    ];
  }

  /**
   * Mount the report into a host's elements. Every target beyond the table and
   * the metric picker is optional, so a surface can show as much of the
   * apparatus as it has room for.
   *
   * cfg: { metricSelectId, tableId, reportKey, nationalId?, noteId?,
   *        warningId?, refreshedAtId?, emptyMsg?, adminHints? }
   */
  function createMarketReport(cfg) {
    var table = null;
    var report = null;

    function selectedKey() {
      var sel = document.getElementById(cfg.metricSelectId);
      return (sel && sel.value) || 'homesSold';
    }
    function ensureTable() {
      if (!table) {
        table = createReportTable({
          containerId: cfg.tableId,
          reportKey: cfg.reportKey || 'market',
          frozenFirst: true,
          emptyMsg: cfg.emptyMsg || 'No market data cached yet.',
          columns: marketCols(selectedKey),
          rowClass: function(r){ return r.key === 'national' ? 'market-national-row' : ''; }
        });
      }
      return table;
    }
    function syncMetricOptions() {
      var sel = document.getElementById(cfg.metricSelectId);
      if (!sel) return;
      var opts = marketMetricOptions(report);
      var keep = sel.value;
      sel.innerHTML = opts.map(function(m){
        return '<option value="' + esc(m.key) + '">' + esc(m.label) + '</option>';
      }).join('');
      // A metric that vanished from the feed would otherwise leave the picker
      // blank while the table kept filtering on it.
      sel.value = opts.some(function(m){ return m.key === keep; }) ? keep : opts[0].key;
    }
    function setText(id, text) {
      if (!id) return;
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }
    function render() {
      var key = selectedKey();
      ensureTable().setData(marketRowsFor(report, key));

      // The note explains why the metric matters to us, so a figure is never bare.
      var def = null;
      var areas = marketAreasOf(report);
      for (var i = 0; i < areas.length && !def; i++) {
        def = (areas[i].metrics || []).filter(function(x){ return x.key === key; })[0] || null;
      }
      setText(cfg.noteId, def ? def.note : '');

      if (cfg.nationalId) {
        var natEl = document.getElementById(cfg.nationalId);
        if (natEl) {
          var nat = report && report.national;
          var natMetric = nat ? (nat.metrics || []).filter(function(x){ return x.key === key; })[0] : null;
          if (!natMetric) {
            natEl.innerHTML = '<span class="text-muted">No national figure cached' +
              (nat && nat.error ? ': ' + esc(nat.error) : '.') + '</span>';
          } else {
            var ro = natMetric.rolling;
            natEl.innerHTML =
              '<span style="font-weight:700">United States</span>' +
              '<span>' + esc(natMetric.display || marketFmt(natMetric.latest, natMetric.format)) + '</span>' +
              (ro ? '<span class="text-muted">last 12 mo ' + esc(marketFmt(ro.current, natMetric.format)) +
                ' vs ' + esc(marketFmt(ro.prior, natMetric.format)) + '</span>' +
                '<span class="' + marketClass(ro.changePct, natMetric.direction) + '">' +
                esc(marketPct(ro.changePct)) + '</span>' : '');
          }
        }
      }

      if (cfg.warningId) {
        var warnEl = document.getElementById(cfg.warningId);
        if (warnEl) {
          var warn = marketWarnings(report, cfg.adminHints === true);
          warnEl.classList.toggle('hidden', warn.length === 0);
          warnEl.innerHTML = warn.map(function(w){ return '<div>' + esc(w) + '</div>'; }).join('');
        }
      }

      setText(cfg.refreshedAtId, report && report.refreshedAt
        ? 'Updated ' + new Date(report.refreshedAt).toLocaleString() + (report.stale ? ' (stale)' : '')
        : 'Never refreshed');
    }

    var metricSel = document.getElementById(cfg.metricSelectId);
    if (metricSel) metricSel.onchange = render;

    return {
      setReport: function(r){ report = r; syncMetricOptions(); render(); },
      setError: function(){ ensureTable().setError(); },
      render: render
    };
  }
`;
