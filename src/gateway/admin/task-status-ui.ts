// Board columns in the browser — shared verbatim by the admin dashboard and the
// user portal, like report-ui.ts, task-list-ui.ts and project-calendar-ui.ts.
// The host SPA provides `esc` and an `api(method, path, body)` helper.
//
// Columns are data (see task-status-store.ts): a global set plus optional
// per-project overrides. Two things follow from that, and they are what this
// registry exists to handle:
//
//   - "Finished" is a property of a column, not the string 'done'. Everything
//     that used to test `status === 'done'` asks `isDoneTask(task)` instead, so
//     a board whose last column is called "Delivered" still completes tasks.
//   - A board showing several projects at once has no single column set. The
//     view falls back to the global one and appends any column a visible task
//     actually holds, because a card that matches no column would vanish while
//     still counting in every total.

export const TASK_STATUS_CSS = `
  .board-col-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.4rem; vertical-align: middle; }
  .board-col-count.over-wip { background: #fee2e2; border-color: #fecaca; color: #991b1b; }
  .board-col-wip { font-size: 0.68rem; color: var(--text-muted); font-weight: 600; }
`;

export const TASK_STATUS_COMPONENT_JS = `
  // ── Board columns registry ───────────────────────────────────────────────

  // What a board looks like before its real columns arrive, and what a task
  // holding an unknown status falls back to. These are the keys every board
  // started with, so a first paint is never blank.
  var TS_SEED = [
    { key: 'todo', label: 'Todo', color: '#6b7280', sortOrder: 0, isDone: false, wipLimit: null },
    { key: 'in_progress', label: 'In Progress', color: '#3b82f6', sortOrder: 1, isDone: false, wipLimit: null },
    { key: 'review', label: 'Review', color: '#f59e0b', sortOrder: 2, isDone: false, wipLimit: null },
    { key: 'done', label: 'Done', color: '#16a34a', sortOrder: 3, isDone: true, wipLimit: null }
  ];

  /** 'awaiting_edit' → 'Awaiting Edit', for a key no board defines any more. */
  function tsHumanize(key) {
    return String(key || '')
      .split(/[_-]+/)
      .filter(Boolean)
      .map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); })
      .join(' ') || String(key || '');
  }

  function tsFallbackColumn(key) {
    return {
      key: key,
      label: tsHumanize(key),
      color: '#6b7280',
      sortOrder: 99,
      // A stranded key is not treated as finished: guessing "done" would tick
      // tasks off and roll recurrences over on nothing but a name.
      isDone: false,
      wipLimit: null,
      missing: true
    };
  }

  /**
   * cfg: { api(method, path, body) }
   *
   * Every read is synchronous against a cache so rendering never awaits; call
   * ensure() with the project ids in view before painting.
   */
  function createStatusRegistry(cfg) {
    var cache = {};   // projectId ('' = global) -> { statuses: [], custom: bool }
    var inflight = {};

    function entry(projectId) {
      return cache[projectId || ''] || null;
    }

    async function fetchSets(projectIds) {
      var wanted = [];
      (projectIds || []).forEach(function(id) {
        var key = id || '';
        if (cache[key] || inflight[key] || wanted.indexOf(key) !== -1) return;
        wanted.push(key);
      });
      if (!cache[''] && wanted.indexOf('') === -1) wanted.push('');
      if (!wanted.length) return;
      wanted.forEach(function(k) { inflight[k] = true; });
      var qs = wanted.filter(Boolean).join(',');
      var r = await cfg.api('GET', '/task-statuses/sets' + (qs ? '?projectIds=' + encodeURIComponent(qs) : ''));
      wanted.forEach(function(k) { delete inflight[k]; });
      if (!r.ok || !r.data || !r.data.sets) return;
      Object.keys(r.data.sets).forEach(function(k) {
        cache[k] = {
          statuses: r.data.sets[k] || [],
          custom: !!(r.data.custom && r.data.custom[k])
        };
      });
      // A project the server said nothing about has no columns of its own.
      wanted.forEach(function(k) {
        if (!cache[k]) cache[k] = { statuses: cache[''] ? cache[''].statuses : TS_SEED, custom: false };
      });
    }

    /** Load the column sets for these projects (global always included). */
    async function ensure(projectIds) {
      await fetchSets(projectIds || []);
    }

    /** The columns a board draws for one project, or the global set for ''. */
    function columnsFor(projectId) {
      var e = entry(projectId);
      if (e && e.statuses.length) return e.statuses;
      var g = entry('');
      return g && g.statuses.length ? g.statuses : TS_SEED;
    }

    /** The definition of one key on one board, real or reconstructed. */
    function columnOf(projectId, key) {
      var cols = columnsFor(projectId);
      for (var i = 0; i < cols.length; i++) {
        if (cols[i].key === key) return cols[i];
      }
      return tsFallbackColumn(key);
    }

    /**
     * Columns for a view that may span projects: the selected board's set, plus
     * a column for any status a visible task holds that it does not define.
     */
    function columnsForView(projectId, tasks) {
      var out = columnsFor(projectId).slice();
      var seen = {};
      out.forEach(function(c) { seen[c.key] = true; });
      (tasks || []).forEach(function(t) {
        if (!t || !t.status || seen[t.status]) return;
        seen[t.status] = true;
        // Prefer how the task's own project names the column over a bare key.
        out.push(columnOf(t.projectId || '', t.status));
      });
      return out;
    }

    function isDone(projectId, key) {
      return !!columnOf(projectId, key).isDone;
    }

    /** Whether a task sits in a finished column on its own board. */
    function isDoneTask(task) {
      return !!task && isDone(task.projectId || '', task.status);
    }

    /** The key a new task takes on a board — its first column. */
    function defaultKey(projectId) {
      var cols = columnsFor(projectId);
      return cols.length ? cols[0].key : 'todo';
    }

    /** The key that marks a task finished on a board — its first done column. */
    function doneKey(projectId) {
      var cols = columnsFor(projectId);
      for (var i = 0; i < cols.length; i++) {
        if (cols[i].isDone) return cols[i].key;
      }
      return cols.length ? cols[cols.length - 1].key : 'done';
    }

    function labelOf(projectId, key) { return columnOf(projectId, key).label; }
    function colorOf(projectId, key) { return columnOf(projectId, key).color; }

    /** Left-to-right position of a key, for sorting a list by status. */
    function rankOf(projectId, key) {
      var cols = columnsFor(projectId);
      for (var i = 0; i < cols.length; i++) {
        if (cols[i].key === key) return i;
      }
      return cols.length;
    }

    /** True when this project has its own columns rather than the global set. */
    function isCustom(projectId) {
      var e = entry(projectId);
      return !!(e && e.custom);
    }

    /** Drop a cached set after an edit so the next ensure() refetches it. */
    function invalidate(projectId) {
      if (projectId === undefined) cache = {};
      else delete cache[projectId || ''];
    }

    /** <option> list for a status picker on a given board. */
    function optionsHtml(projectId, selected, tasks) {
      return columnsForView(projectId, tasks || []).map(function(c) {
        return '<option value="' + esc(c.key) + '"' + (c.key === selected ? ' selected' : '') + '>'
          + esc(c.label) + '</option>';
      }).join('');
    }

    return {
      ensure: ensure,
      columnsFor: columnsFor,
      columnsForView: columnsForView,
      columnOf: columnOf,
      isDone: isDone,
      isDoneTask: isDoneTask,
      defaultKey: defaultKey,
      doneKey: doneKey,
      labelOf: labelOf,
      colorOf: colorOf,
      rankOf: rankOf,
      isCustom: isCustom,
      invalidate: invalidate,
      optionsHtml: optionsHtml
    };
  }
`;
