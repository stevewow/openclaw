// Shared inline JS for the reusable report table, embedded verbatim by both
// the admin dashboard (admin-ui-html.ts) and the user portal (user-portal-html.ts)
// so their tables behave identically. The host SPA provides `esc` and
// `currentUser` in scope. This is a string of browser JS, not a module — it is
// interpolated into each SPA's outer template literal.
export const REPORT_TABLE_COMPONENT_JS = `
  // ── Reusable report table ────────────────────────────────────────────────
  // A data table with sortable + drag-reorderable + hideable columns, an
  // optional frozen first column, and CSV (Excel) export. The column layout
  // (order, hidden, sort) is saved per user in localStorage so each person's
  // arrangement is private to them. Column config: { key, label, value(row),
  // render(row)?, type:'num'|'text' }. value() feeds sort + CSV; render()
  // returns display HTML (defaults to the escaped value). Optional
  // cfg.rowClass(row) returns a class for the <tr>.
  function reportTableStorageKey(reportKey){
    return 'oc_rtbl_' + (currentUser && currentUser.id ? currentUser.id : 'anon') + '_' + reportKey;
  }
  function createReportTable(cfg){
    var reportKey = cfg.reportKey;
    var cols = cfg.columns;
    var frozenFirst = cfg.frozenFirst === true;
    var emptyMsg = cfg.emptyMsg || 'No data.';
    var byKey = {};
    cols.forEach(function(c){ byKey[c.key] = c; });

    var state = { order: cols.map(function(c){ return c.key; }), hidden: {}, sort: null };
    try {
      var saved = JSON.parse(localStorage.getItem(reportTableStorageKey(reportKey)) || 'null');
      if (saved && Array.isArray(saved.order)) {
        // Keep only keys that still exist, then append any new columns.
        var kept = saved.order.filter(function(k){ return byKey[k]; });
        cols.forEach(function(c){ if (kept.indexOf(c.key) === -1) kept.push(c.key); });
        state.order = kept;
        state.hidden = saved.hidden && typeof saved.hidden === 'object' ? saved.hidden : {};
        state.sort = saved.sort && byKey[saved.sort.key] ? saved.sort : null;
      }
    } catch (e) { /* ignore corrupt layout */ }

    var rows = [];
    var errored = false;
    var el = document.getElementById(cfg.containerId);

    function persist(){
      try { localStorage.setItem(reportTableStorageKey(reportKey), JSON.stringify(state)); } catch (e) { /* quota */ }
    }
    function visibleCols(){
      return state.order.map(function(k){ return byKey[k]; }).filter(function(c){ return c && !state.hidden[c.key]; });
    }
    function rawValue(c, row){
      try { return c.value ? c.value(row) : null; } catch (e) { return null; }
    }
    // Export value. Defaults to the sort value; a column whose sort key is not
    // what a reader wants in a spreadsheet (a count standing in for the text
    // behind it) overrides with cfg.csv.
    function csvValue(c, row){
      if (!c.csv) return rawValue(c, row);
      try { return c.csv(row); } catch (e) { return null; }
    }
    function cellHtml(c, row){
      if (c.render) return c.render(row);
      var v = rawValue(c, row);
      return esc(v === null || v === undefined ? '' : String(v));
    }
    function sortedRows(){
      if (!state.sort) return rows.slice();
      var c = byKey[state.sort.key];
      if (!c) return rows.slice();
      var dir = state.sort.dir === 'desc' ? -1 : 1;
      return rows.slice().sort(function(a, b){
        var av = rawValue(c, a), bv = rawValue(c, b);
        if (av === null || av === undefined) av = '';
        if (bv === null || bv === undefined) bv = '';
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
      });
    }

    function csvCell(v){
      if (v === null || v === undefined) v = '';
      v = String(v);
      if (/[",\\n\\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    function exportCsv(){
      var vc = visibleCols();
      var lines = [vc.map(function(c){ return csvCell(c.label); }).join(',')];
      sortedRows().forEach(function(row){
        lines.push(vc.map(function(c){ return csvCell(csvValue(c, row)); }).join(','));
      });
      var blob = new Blob(['\\ufeff' + lines.join('\\r\\n')], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = reportKey + '-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    }

    function render(){
      var vc = visibleCols();
      var html = '';
      html += '<div class="rt-toolbar">';
      html += '<div class="rt-cols-wrap"><button type="button" class="btn btn-sm rt-cols-btn">Columns \\u25be</button><div class="rt-cols-menu hidden"></div></div>';
      html += '<button type="button" class="btn btn-sm rt-csv-btn">\\u21e9 Export CSV</button>';
      html += '</div>';
      html += '<div class="table-wrap"><table class="rt-table"><thead><tr>';
      vc.forEach(function(c, i){
        var frozen = frozenFirst && i === 0 ? ' rt-frozen' : '';
        var arrow = state.sort && state.sort.key === c.key ? (state.sort.dir === 'desc' ? ' \\u25be' : ' \\u25b4') : '';
        html += '<th class="rt-th' + frozen + '" draggable="true" data-key="' + esc(c.key) + '"><span class="rt-grip">\\u2237</span><span class="rt-th-label">' + esc(c.label) + arrow + '</span></th>';
      });
      html += '</tr></thead><tbody></tbody></table></div>';
      el.innerHTML = html;
      renderBody();
      bind();
    }
    function renderBody(){
      var vc = visibleCols();
      var tbody = el.querySelector('tbody');
      if (errored) { tbody.innerHTML = '<tr><td colspan="' + vc.length + '" class="empty-state">Failed to load.</td></tr>'; return; }
      if (!rows.length) { tbody.innerHTML = '<tr><td colspan="' + vc.length + '" class="empty-state">' + esc(emptyMsg) + '</td></tr>'; return; }
      tbody.innerHTML = sortedRows().map(function(row){
        // Optional per-row class, e.g. to mute a row the viewer has hidden.
        var rowCls = '';
        if (cfg.rowClass) { try { rowCls = cfg.rowClass(row) || ''; } catch (e) { rowCls = ''; } }
        return '<tr' + (rowCls ? ' class="' + esc(rowCls) + '"' : '') + '>' + vc.map(function(c, i){
          var frozen = frozenFirst && i === 0 ? ' class="rt-frozen"' : '';
          return '<td' + frozen + '>' + cellHtml(c, row) + '</td>';
        }).join('') + '</tr>';
      }).join('');
    }

    var justDragged = false;
    function bind(){
      var csvBtn = el.querySelector('.rt-csv-btn');
      if (csvBtn) csvBtn.addEventListener('click', exportCsv);
      var colsBtn = el.querySelector('.rt-cols-btn');
      var menu = el.querySelector('.rt-cols-menu');
      if (colsBtn && menu) {
        colsBtn.addEventListener('click', function(e){
          e.stopPropagation();
          if (menu.classList.contains('hidden')) { buildColsMenu(menu); menu.classList.remove('hidden'); }
          else menu.classList.add('hidden');
        });
      }
      el.querySelectorAll('.rt-th').forEach(function(th){
        var key = th.dataset.key;
        th.addEventListener('click', function(){
          if (justDragged) return;
          toggleSort(key);
        });
        th.addEventListener('dragstart', function(e){ dragKey = key; if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; });
        th.addEventListener('dragend', function(){ justDragged = true; setTimeout(function(){ justDragged = false; }, 0); });
        th.addEventListener('dragover', function(e){ e.preventDefault(); });
        th.addEventListener('drop', function(e){ e.preventDefault(); reorder(dragKey, key); });
      });
    }
    var dragKey = null;
    function buildColsMenu(menu){
      menu.innerHTML = state.order.map(function(k){
        var c = byKey[k];
        var checked = state.hidden[k] ? '' : ' checked';
        return '<label class="rt-cols-item"><input type="checkbox" data-key="' + esc(k) + '"' + checked + ' /> ' + esc(c.label) + '</label>';
      }).join('');
      menu.querySelectorAll('input[type=checkbox]').forEach(function(cb){
        cb.addEventListener('change', function(){
          var k = cb.dataset.key;
          // Never let them hide the last remaining column.
          if (!cb.checked && visibleCols().length <= 1) { cb.checked = true; return; }
          if (cb.checked) delete state.hidden[k]; else state.hidden[k] = true;
          persist(); render();
        });
      });
    }
    function toggleSort(key){
      if (state.sort && state.sort.key === key) {
        state.sort = state.sort.dir === 'asc' ? { key: key, dir: 'desc' } : null;
      } else {
        state.sort = { key: key, dir: 'asc' };
      }
      persist(); render();
    }
    function reorder(src, dst){
      if (!src || src === dst) return;
      var order = state.order.slice();
      var from = order.indexOf(src), to = order.indexOf(dst);
      if (from === -1 || to === -1) return;
      order.splice(from, 1);
      order.splice(order.indexOf(dst) + (from < to ? 1 : 0), 0, src);
      state.order = order;
      persist(); render();
    }

    // Close any open column menu when clicking elsewhere.
    document.addEventListener('click', function(){
      var menu = el.querySelector('.rt-cols-menu');
      if (menu) menu.classList.add('hidden');
    });

    render();
    return {
      setData: function(data){ rows = Array.isArray(data) ? data : []; errored = false; renderBody(); },
      setError: function(){ errored = true; renderBody(); },
    };
  }

`;
