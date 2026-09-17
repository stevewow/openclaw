// Export and print for the sales dashboard.
//
// Export CSV writes what the open tab shows: every table of the report (and the
// comparison, when one is on), or the numbers behind the chart. Values are plain
// numbers — dollars, not cents; percentages without the sign — so a spreadsheet
// can add them up. The file starts with a byte-order mark so Excel reads it as
// UTF-8, the same way report-ui.ts writes its CSVs.
//
// Print lays the open tab out for paper: the sidebar, controls and tabs go, a
// title and the period go on top, tables stop scrolling and shrink to fit a
// landscape page, and no card splits across pages. The print rules apply only
// while this page is the one printing (body.sd-print), so other Hub pages print
// as they always have.
//
// The inline JS lives in a template literal, which eats backslashes: no regex
// escapes and no backslashes in its comments, and no dollar sign followed by an
// open brace.

export const SALES_EXPORT_CSS = `
  .sd-print-head { display: none; }
  @media print {
    @page { size: landscape; margin: 0.4in; }
    body.sd-print { background: #fff !important; }
    body.sd-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body.sd-print .sidebar, body.sd-print .sidebar-backdrop, body.sd-print .impersonation-banner, body.sd-print .topbar,
    body.sd-print .sd-head-card, body.sd-print .sd-tabs, body.sd-print .sdt-filters, body.sd-print .modal-backdrop,
    body.sd-print .sdt-tip, body.sd-print .sdt-table-toggle summary,
    body.sd-print .sd-seg, body.sd-print .sd-more { display: none !important; }
    body.sd-print .sd-switch { justify-content: flex-end; }
    body.sd-print .app, body.sd-print .main, body.sd-print .page-scroll, body.sd-print #page-sales-dashboard {
      display: block !important; height: auto !important; min-height: 0 !important; overflow: visible !important; padding: 0 !important; background: #fff !important;
    }
    body.sd-print .sd-print-head { display: block; margin: 0 0 0.5rem; }
    body.sd-print .sd-print-head h1 { margin: 0; font-size: 15pt; }
    body.sd-print .sd-print-head p { margin: 0.1rem 0 0; color: #555; font-size: 9pt; }
    /* A long card may run onto the next page rather than leave a blank one; its rows and headings stay whole. */
    body.sd-print .card { margin-bottom: 0.45rem; border: 1px solid #dbdbdb; box-shadow: none !important; }
    body.sd-print tr, body.sd-print .sd-card-head, body.sd-print .sd-days { break-inside: avoid; page-break-inside: avoid; }
    body.sd-print .sd-card-head { break-after: avoid; page-break-after: avoid; }
    body.sd-print .sd-kpis { grid-template-columns: repeat(5, 1fr); gap: 0.35rem; margin-bottom: 0.45rem; }
    body.sd-print .sd-kpi { padding: 0.35rem 0.5rem; box-shadow: none; break-inside: avoid; }
    body.sd-print .sd-kpi-value { font-size: 13pt; }
    body.sd-print .sd-card-head, body.sd-print .sd-days { padding: 0.3rem 0.5rem; }
    body.sd-print .sd-table-wrap { overflow: visible !important; }
    /* Small enough for the widest table, year to date, to fit a landscape page. */
    body.sd-print table.sd-table { font-size: 6.6pt; }
    body.sd-print table.sd-table th, body.sd-print table.sd-table td { padding: 1px 3px; }
    body.sd-print .sd-pace { gap: 0.15rem; }
    body.sd-print table.sd-table th { white-space: normal; }
    body.sd-print table.sd-table td.sd-market, body.sd-print table.sd-table th.sd-market-head { position: static; box-shadow: none; }
    body.sd-print table.sd-table tbody tr:hover td { box-shadow: none; }
    body.sd-print .sdt-multiples { grid-template-columns: repeat(3, 1fr); }
    body.sd-print .sdt-mini { break-inside: avoid; }
  }
`;

export const SALES_EXPORT_COMPONENT_JS = `
  // ── Export ──
  function sdCsvCell(v){
    if(v === null || v === undefined) v = '';
    v = String(v);
    var needsQuotes = v.indexOf('"') >= 0 || v.indexOf(',') >= 0 ||
      v.indexOf(String.fromCharCode(10)) >= 0 || v.indexOf(String.fromCharCode(13)) >= 0;
    return needsQuotes ? '"' + v.split('"').join('""') + '"' : v;
  }

  function sdDownloadCsv(filename, rows){
    var text = rows.map(function(row){ return row.map(sdCsvCell).join(','); }).join(String.fromCharCode(13, 10));
    var blob = new Blob([String.fromCharCode(65279) + text], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

  function sdCsvNum(n){ return (n === null || n === undefined) ? '' : String(Math.round(n * 100) / 100); }
  function sdCsvDollars(cents){ return (cents === null || cents === undefined) ? '' : (cents / 100).toFixed(2); }
  function sdCsvChange(now, then){
    if(now === null || now === undefined || then === null || then === undefined || !(then > 0)) return '';
    return ((now - then) / then * 100).toFixed(1);
  }
  function sdCsvPoints(now, then){
    if(now === null || now === undefined || then === null || then === undefined) return '';
    return (now - then).toFixed(2);
  }

  function sdCompareCsv(out, title, rows, total, priorRows, priorTotal){
    var prior = {};
    priorRows.forEach(function(p){ prior[p.key] = p; });
    out.push([]);
    out.push([title]);
    out.push(['Market', 'Units now', 'Units then', 'Units change %', 'Revenue now ($)', 'Revenue then ($)', 'Revenue change %',
      'ASP now ($)', 'ASP then ($)', 'ASP change %', 'New clients now', 'New clients then', 'New clients change %',
      'Market share now %', 'Market share then %', 'Market share change (points)']);
    var all = rows.concat([total]);
    all.forEach(function(row, i){
      var p = i === all.length - 1 ? priorTotal : (prior[row.key] || null);
      var pa = p ? p.actual : null;
      var clientsThen = p ? sdClients(p.newClients) : null;
      var shareThen = p ? p.share.pct : null;
      out.push([row.label,
        sdCsvNum(row.actual.units), pa ? sdCsvNum(pa.units) : '', sdCsvChange(row.actual.units, pa && pa.units),
        sdCsvDollars(row.actual.revenueCents), pa ? sdCsvDollars(pa.revenueCents) : '', sdCsvChange(row.actual.revenueCents, pa && pa.revenueCents),
        sdCsvDollars(row.actual.aspCents), pa ? sdCsvDollars(pa.aspCents) : '', sdCsvChange(row.actual.aspCents, pa && pa.aspCents),
        sdCsvNum(sdClients(row.newClients)), sdCsvNum(clientsThen), sdCsvChange(sdClients(row.newClients), clientsThen),
        sdCsvNum(row.share.pct), sdCsvNum(shareThen), sdCsvPoints(row.share.pct, shareThen)]);
    });
  }

  function sdReportCsvRows(){
    var r = sdData.report;
    var rows = [['Sales Dashboard', sdMonthName(sdData.monthKey), sdMarketLabel(),
      'Completed shoots, on the shoot day, through ' + sdDate(r.throughDay)], []];
    var month = sdScopeRows('mtd');
    rows.push(['Month to date']);
    rows.push(['Market', 'Units', 'Unit goal', 'Units % to goal', 'Per-day goal', 'Revenue ($)', 'Revenue goal ($)', 'Revenue % to goal',
      'ASP ($)', 'ASP goal ($)', 'ASP % to goal', 'New clients: first-ever', 'New clients: returning', 'New listings', 'Market share %']);
    month.forEach(function(row){
      var g = sdHasGoal(row.goal);
      var nc = row.newClients;
      rows.push([row.label, sdCsvNum(row.actual.units), g ? sdCsvNum(row.goal.units) : '', sdCsvNum(row.pct.units), sdCsvNum(row.goal.unitsPerDay),
        sdCsvDollars(row.actual.revenueCents), g ? sdCsvDollars(row.goal.revenueCents) : '', sdCsvNum(row.pct.revenue),
        sdCsvDollars(row.actual.aspCents), g ? sdCsvDollars(row.goal.aspCents) : '', sdCsvNum(row.pct.asp),
        nc ? nc.first : '', nc ? nc.returning : '', sdCsvNum(row.share.listings), sdCsvNum(row.share.pct)]);
    });
    rows.push([]);
    rows.push(['End-of-month trend']);
    rows.push(['Market', 'Units trend', 'Units trend % of goal', 'Revenue trend ($)', 'Revenue trend % of goal', 'ASP ($)']);
    month.forEach(function(row){
      rows.push([row.label, sdCsvNum(row.trend.units), sdCsvNum(row.trend.unitsPct), sdCsvDollars(row.trend.revenueCents),
        sdCsvNum(row.trend.revenuePct), sdCsvDollars(row.actual.aspCents)]);
    });
    rows.push([]);
    rows.push([r.year + ' year to date']);
    rows.push(['Market', 'Units', 'Units goal to date', 'Units % to goal', 'Units year-end trend', 'Units % of year goal',
      'Revenue ($)', 'Revenue goal to date ($)', 'Revenue % to goal', 'Revenue year-end trend ($)', 'Revenue % of year goal',
      'ASP ($)', 'ASP % to goal', 'New clients: first-ever', 'New clients: returning', 'New listings', 'Market share %']);
    sdScopeRows('ytd').forEach(function(row){
      var g = sdHasGoal(row.annualGoal);
      var nc = row.newClients;
      rows.push([row.label, sdCsvNum(row.actual.units), g ? sdCsvNum(row.goalToDate.units) : '', sdCsvNum(row.pct.units),
        sdCsvNum(row.trend.units), sdCsvNum(row.trend.unitsPct),
        sdCsvDollars(row.actual.revenueCents), g ? sdCsvDollars(row.goalToDate.revenueCents) : '', sdCsvNum(row.pct.revenue),
        sdCsvDollars(row.trend.revenueCents), sdCsvNum(row.trend.revenuePct),
        sdCsvDollars(row.actual.aspCents), sdCsvNum(row.pct.asp),
        nc ? nc.first : '', nc ? nc.returning : '', sdCsvNum(row.share.listings), sdCsvNum(row.share.pct)]);
    });
    var c = sdComparison();
    if(c){
      sdCompareCsv(rows, sdMonthName(sdData.monthKey) + ' to date vs ' + sdPeriod(c),
        sdFilterRows(r.mtd.rows), r.mtd.total, sdFilterRows(c.mtd.rows), c.mtd.total);
      if(sdCompare === 'yoy') sdCompareCsv(rows, r.year + ' to date vs ' + sdYearPeriod(c),
        sdFilterRows(r.ytd.rows), r.ytd.total, sdFilterRows(c.ytd.rows), c.ytd.total);
    }
    return rows;
  }

  function sdExport(){
    if(!sdData) return;
    if(sdView === 'trends'){
      var chartRows = sdtCsvRows();
      if(!chartRows){ alert('There is nothing on the chart to export yet.'); return; }
      var range = sdtRange();
      sdDownloadCsv('sales-chart-' + sdtState.metric + '-' + range.from + '-to-' + range.to + '.csv', chartRows);
      return;
    }
    sdDownloadCsv('sales-dashboard-' + sdData.monthKey + (sdMarket ? '-' + sdMarket : '') + '.csv', sdReportCsvRows());
  }

  // ── Print ──
  function sdPrintHead(){
    var head = sdEl('sd-print-head');
    if(!head || !sdData) return;
    var trends = sdView === 'trends';
    var title = document.createElement('h1');
    title.textContent = trends
      ? 'Sales Dashboard · ' + sdEl('sdt-title').textContent
      : 'Sales Dashboard · ' + sdMonthName(sdData.monthKey) + ' · ' + sdMarketLabel();
    var detail = document.createElement('p');
    var parts = ['Completed shoots, on the day of the shoot'];
    if(!trends){
      parts.push('through ' + sdDate(sdData.report.throughDay));
      if(sdCompare !== 'off') parts.push(sdCompare === 'mom' ? 'compared with last month' : 'compared with last year');
    }
    parts.push('printed ' + new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }));
    detail.textContent = parts.join(' · ');
    head.textContent = '';
    head.appendChild(title);
    head.appendChild(detail);
  }

  var sdTablesOpenedForPrint = false;
  function sdBeforePrint(){
    var page = sdEl('page-sales-dashboard');
    if(!page || page.offsetParent === null) return;
    document.body.classList.add('sd-print');
    sdPrintHead();
    // The chart's numbers belong on paper too.
    var numbers = document.querySelector('#sd-view-trends .sdt-table-toggle');
    sdTablesOpenedForPrint = !!(numbers && sdView === 'trends' && !numbers.open);
    if(sdTablesOpenedForPrint) numbers.open = true;
  }
  function sdAfterPrint(){
    document.body.classList.remove('sd-print');
    var numbers = document.querySelector('#sd-view-trends .sdt-table-toggle');
    if(numbers && sdTablesOpenedForPrint) numbers.open = false;
    sdTablesOpenedForPrint = false;
  }
  window.addEventListener('beforeprint', sdBeforePrint);
  window.addEventListener('afterprint', sdAfterPrint);

  sdOn('sd-export', 'click', sdExport);
  sdOn('sd-print', 'click', function(){
    if(!sdData) return;
    window.print();
  });
`;
