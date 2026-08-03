// Task filtering, due-date signalling, and the sortable list view — shared
// verbatim by the admin dashboard and the user portal, like report-ui.ts,
// project-calendar-ui.ts and task-feed-ui.ts. The host SPA provides `esc`.
//
// The filter model is deliberately plain data (`makeTaskFilter()` returns an
// object of primitives) so the host can persist it, and `applyTaskFilter` is a
// pure function over it — which is also what makes it testable without a DOM.

export const TASK_LIST_CSS = `
  .tl-bar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .tl-search { flex: 1 1 12rem; min-width: 9rem; max-width: 22rem; padding: 0.4rem 0.65rem; font-size: 0.82rem; font-family: inherit; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); }
  .tl-search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.09); }
  /* width:auto matters: the host page styles every select as width:100%, which
     makes a select in a flex row swallow the whole line. The popover's selects
     opt back into 100% below, where filling the panel is what you want. */
  .tl-bar select { flex: 0 1 auto; width: auto; max-width: 12rem; padding: 0.38rem 0.5rem; font-size: 0.8rem; font-family: inherit; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); }
  .tl-mine { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); cursor: pointer; white-space: nowrap; }
  .tl-mine input { cursor: pointer; }
  .tl-clear { background: none; border: none; font-size: 0.78rem; color: var(--text-muted); text-decoration: underline; cursor: pointer; font-family: inherit; }
  .tl-clear:hover { color: var(--accent); }
  .tl-count { font-size: 0.75rem; color: var(--text-muted); margin-left: auto; white-space: nowrap; }

  /* Priority, due window, tag and "only mine" live behind one button. Four
     always-visible selects read as a control panel; most sessions use none of
     them, and the ones in use are named on the button itself. */
  .tl-more { position: relative; flex-shrink: 0; }
  .tl-more-btn { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.7rem; font-size: 0.8rem; font-weight: 600; font-family: inherit; color: var(--text-muted); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; white-space: nowrap; }
  .tl-more-btn:hover { color: var(--text); }
  .tl-more-btn.tl-more-on { color: var(--accent); border-color: var(--accent); background: rgba(192,0,10,0.05); }
  .tl-more-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 1.05rem; height: 1.05rem; padding: 0 0.25rem; border-radius: 999px; background: var(--accent); color: #fff; font-size: 0.62rem; font-weight: 800; }
  /* Anchored to the button's RIGHT edge so it opens leftward, back over the
     toolbar. Opening rightward pushed it off-screen: the button sits well into
     a bar that stretches to the page edge, so there is rarely 15rem to its
     right. JS narrows this further if even the left side would overflow. */
  .tl-more-pop { position: absolute; right: 0; left: auto; top: calc(100% + 0.35rem); z-index: 30; width: max-content; min-width: 15rem; max-width: min(22rem, calc(100vw - 2rem)); padding: 0.6rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0,0,0,0.12); display: flex; flex-direction: column; gap: 0.55rem; }
  .tl-more-field { display: flex; flex-direction: column; gap: 0.2rem; }
  .tl-more-field > span { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
  .tl-more-pop select { width: 100%; max-width: 100%; }
  .tl-more-foot { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding-top: 0.15rem; border-top: 1px solid var(--border); }

  /* Due-date signalling, shared by cards and rows. */
  .due-chip { display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.05rem 0.35rem; border-radius: 4px; font-size: 0.68rem; font-weight: 700; white-space: nowrap; }
  .due-overdue { background: #fee2e2; color: #991b1b; }
  .due-today { background: #ffedd5; color: #9a3412; }
  .due-soon { background: #fef9c3; color: #854d0e; }
  .due-later { background: var(--surface2); color: var(--text-muted); }
  .due-done { background: var(--surface2); color: var(--text-muted); text-decoration: line-through; }

  .tl-table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow-x: auto; }
  table.tl-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .tl-table th { text-align: left; padding: 0.55rem 0.7rem; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); background: var(--surface2); border-bottom: 1px solid var(--border); white-space: nowrap; cursor: pointer; user-select: none; }
  .tl-table th:hover { color: var(--text); }
  .tl-table th .tl-arrow { opacity: 0.5; font-size: 0.6rem; }
  .tl-table td { padding: 0.45rem 0.7rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
  .tl-table tr:last-child td { border-bottom: none; }
  .tl-table tbody tr:hover { background: var(--surface2); }
  .tl-title-cell { font-weight: 600; cursor: pointer; }
  .tl-title-cell:hover { color: var(--accent); }
  .tl-sub { display: block; font-size: 0.7rem; color: var(--text-muted); font-weight: 400; }
  .tl-inline { padding: 0.2rem 0.35rem; font-size: 0.75rem; font-family: inherit; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--text); cursor: pointer; }
  .tl-inline:hover { border-color: var(--border); background: var(--surface); }
  .tl-group-row td { background: var(--surface2); font-weight: 700; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
  .tl-empty-row td { padding: 1.25rem 0.7rem; text-align: center; color: var(--text-muted); }
  .tl-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.35rem; vertical-align: baseline; }
`;

export const TASK_LIST_MARKUP = `
          <div class="tl-bar">
            <input type="search" class="tl-search" placeholder="Search tasks…">
            <select class="tl-assignee"><option value="">Anyone</option></select>
            <div class="tl-more">
              <button type="button" class="tl-more-btn">Filters <span class="tl-more-caret">▾</span></button>
              <div class="tl-more-pop hidden">
                <label class="tl-more-field">
                  <span>Priority</span>
                  <select class="tl-priority">
                    <option value="">Any priority</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <label class="tl-more-field">
                  <span>Due</span>
                  <select class="tl-due">
                    <option value="">Any due date</option>
                    <option value="overdue">Overdue</option>
                    <option value="today">Due today</option>
                    <option value="week">Due this week</option>
                    <option value="none">No due date</option>
                  </select>
                </label>
                <label class="tl-more-field">
                  <span>Tag</span>
                  <select class="tl-tag"><option value="">Any tag</option></select>
                </label>
                <div class="tl-more-foot">
                  <label class="tl-mine"><input type="checkbox" class="tl-mine-chk"> Only mine</label>
                  <button type="button" class="tl-clear hidden">Clear</button>
                </div>
              </div>
            </div>
            <span class="tl-count"></span>
          </div>
`;

export const TASK_LIST_COMPONENT_JS = `
  // ── Shared task filtering + list view ────────────────────────────────────

  var TL_PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
  var TL_STATUS_RANK = { todo: 0, in_progress: 1, review: 2, done: 3 };
  var TL_STATUS_LABELS = { todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done' };
  var TL_STATUS_COLORS = { todo: '#6b7280', in_progress: '#3b82f6', review: '#f59e0b', done: '#16a34a' };
  var TL_PRIORITY_LABELS = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };

  /**
   * How a status reads. Board columns are per-project data (task-status-ui.ts),
   * and a task's project decides what its status means — so the list asks the
   * host rather than assuming the four keys every board started with. The
   * defaults below are those four, which keeps this component working on its
   * own before a host installs a registry.
   */
  var TL_STATUS = {
    isDone: function(status) { return status === 'done'; },
    label: function(status) { return TL_STATUS_LABELS[status] || status; },
    color: function(status) { return TL_STATUS_COLORS[status] || '#6b7280'; },
    rank: function(status) {
      var r = TL_STATUS_RANK[status];
      return r === undefined ? 99 : r;
    },
    /** Ordered columns to offer or group by, given the tasks in view. */
    all: function() {
      return Object.keys(TL_STATUS_LABELS).map(function(k) {
        return { key: k, label: TL_STATUS_LABELS[k] };
      });
    }
  };

  /** Install per-project status resolution. Partial overrides are fine. */
  function setTaskStatusResolver(r) {
    Object.keys(r || {}).forEach(function(k) {
      if (typeof r[k] === 'function') TL_STATUS[k] = r[k];
    });
  }

  /** A fresh, empty filter. Everything off means "show me everything". */
  function makeTaskFilter() {
    return { text: '', assignee: '', priority: '', due: '', tag: '', mine: false };
  }

  function taskFilterIsActive(f) {
    return !!(f.text || f.assignee || f.priority || f.due || f.tag || f.mine);
  }

  /**
   * How many of the tucked-away filters are on. Search and assignee stay in the
   * bar where you can see them, so they are not counted here — the badge is
   * there to say what the button is hiding.
   */
  function tlHiddenFilterCount(f) {
    return (f.priority ? 1 : 0) + (f.due ? 1 : 0) + (f.tag ? 1 : 0) + (f.mine ? 1 : 0);
  }

  /** Local midnight for a timestamp — the boundary humans mean by "today". */
  function tlStartOfDay(ms) {
    var d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /**
   * How a due date should read, relative to now. A finished status
   * short-circuits: a done task is not overdue no matter when it was due, and
   * colouring it red is just noise on the board. The task argument is optional
   * and only needed so the resolver can tell which board the status belongs to.
   */
  function dueState(dueDate, status, now, task) {
    if (TL_STATUS.isDone(status, task)) return dueDate ? 'done' : 'none';
    if (!dueDate) return 'none';
    var today = tlStartOfDay(now === undefined ? Date.now() : now);
    var due = tlStartOfDay(dueDate);
    if (due < today) return 'overdue';
    if (due === today) return 'today';
    if (due <= today + 6 * 86400000) return 'soon';
    return 'later';
  }

  function dueLabel(dueDate, status, now, task) {
    var state = dueState(dueDate, status, now, task);
    if (state === 'none') return '';
    var d = new Date(dueDate);
    var text = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (state === 'overdue') {
      var days = Math.round((tlStartOfDay(now === undefined ? Date.now() : now) - tlStartOfDay(dueDate)) / 86400000);
      return days === 1 ? '1 day overdue' : days + ' days overdue';
    }
    if (state === 'today') return 'Due today';
    return text;
  }

  function dueChip(task, now) {
    var state = dueState(task.dueDate, task.status, now, task);
    if (state === 'none') return '';
    return '<span class="due-chip due-' + state + '">' + esc(dueLabel(task.dueDate, task.status, now, task)) + '</span>';
  }

  /**
   * Filter a task list. Pure over (tasks, filter, ctx) so it can be tested
   * without a DOM. ctx.userId decides what "only mine" means; ctx.now pins the
   * due-date windows.
   */
  function applyTaskFilter(tasks, f, ctx) {
    ctx = ctx || {};
    var needle = (f.text || '').trim().toLowerCase();
    return tasks.filter(function(t) {
      if (needle) {
        var hay = (t.title || '') + ' ' + (t.description || '') + ' ' + ((t.tags || []).join(' '));
        if (hay.toLowerCase().indexOf(needle) === -1) return false;
      }
      if (f.assignee) {
        var ids = t.assigneeIds || [];
        if (ids.indexOf(f.assignee) === -1) return false;
      }
      if (f.mine) {
        if (!ctx.userId) return false;
        var mineIds = t.assigneeIds || [];
        if (mineIds.indexOf(ctx.userId) === -1) return false;
      }
      if (f.priority && t.priority !== f.priority) return false;
      if (f.tag && (t.tags || []).indexOf(f.tag) === -1) return false;
      if (f.due) {
        var state = dueState(t.dueDate, t.status, ctx.now, t);
        if (f.due === 'none' && state !== 'none') return false;
        if (f.due === 'overdue' && state !== 'overdue') return false;
        if (f.due === 'today' && state !== 'today') return false;
        if (f.due === 'week' && !(state === 'overdue' || state === 'today' || state === 'soon')) return false;
      }
      return true;
    });
  }

  /** Sort a filtered list. Unknown keys fall back to manual board order. */
  function sortTasks(tasks, key, dir) {
    var sign = dir === 'desc' ? -1 : 1;
    var out = tasks.slice();
    out.sort(function(a, b) {
      var av, bv;
      switch (key) {
        case 'title': av = (a.title || '').toLowerCase(); bv = (b.title || '').toLowerCase(); break;
        case 'status': av = TL_STATUS.rank(a.status, a); bv = TL_STATUS.rank(b.status, b); break;
        case 'priority': av = TL_PRIORITY_RANK[a.priority]; bv = TL_PRIORITY_RANK[b.priority]; break;
        case 'due':
          // Undated tasks sort last in both directions: "no date" is not later
          // than every date, it is simply not on the schedule.
          if (!a.dueDate && !b.dueDate) return (a.position || 0) - (b.position || 0);
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          av = a.dueDate; bv = b.dueDate; break;
        default:
          return (a.position || 0) - (b.position || 0) || (a.createdAt || 0) - (b.createdAt || 0);
      }
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return (a.position || 0) - (b.position || 0);
    });
    return out;
  }

  /**
   * Wire a filter bar. cfg: {
   *   rootId, onChange(), people(), tags(), currentUserId
   * } and returns { filter(), apply(tasks), setCount(n, total), reset() }.
   */
  function createTaskFilterBar(cfg) {
    var root = document.getElementById(cfg.rootId);
    if (!root) return { filter: makeTaskFilter, apply: function(t) { return t; }, setCount: function(){}, reset: function(){} };
    var f = makeTaskFilter();
    var searchEl = root.querySelector('.tl-search');
    var assigneeEl = root.querySelector('.tl-assignee');
    var priorityEl = root.querySelector('.tl-priority');
    var dueEl = root.querySelector('.tl-due');
    var tagEl = root.querySelector('.tl-tag');
    var mineEl = root.querySelector('.tl-mine-chk');
    var clearEl = root.querySelector('.tl-clear');
    var countEl = root.querySelector('.tl-count');
    var moreBtn = root.querySelector('.tl-more-btn');
    var morePop = root.querySelector('.tl-more-pop');

    function refreshOptions() {
      var people = (cfg.people ? cfg.people() : []) || [];
      var keepA = assigneeEl.value;
      assigneeEl.innerHTML = '<option value="">Anyone</option>' + people.map(function(p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>';
      }).join('');
      assigneeEl.value = keepA;
      var tags = (cfg.tags ? cfg.tags() : []) || [];
      var keepT = tagEl.value;
      tagEl.innerHTML = '<option value="">Any tag</option>' + tags.map(function(t) {
        return '<option value="' + esc(t) + '">' + esc(t) + '</option>';
      }).join('');
      tagEl.value = keepT;
    }

    /** Say on the button what the popover is hiding, so nothing filters silently. */
    function paintMoreButton() {
      if (!moreBtn) return;
      var n = tlHiddenFilterCount(f);
      moreBtn.classList.toggle('tl-more-on', n > 0);
      moreBtn.innerHTML = 'Filters ' + (n > 0
        ? '<span class="tl-more-badge">' + n + '</span>'
        : '<span class="tl-more-caret">▾</span>');
    }

    function sync() {
      f.text = searchEl.value;
      f.assignee = assigneeEl.value;
      f.priority = priorityEl.value;
      f.due = dueEl.value;
      f.tag = tagEl.value;
      f.mine = mineEl.checked;
      clearEl.classList.toggle('hidden', !taskFilterIsActive(f));
      paintMoreButton();
      if (cfg.onChange) cfg.onChange();
    }

    [searchEl, assigneeEl, priorityEl, dueEl, tagEl, mineEl].forEach(function(el) {
      el.addEventListener('input', sync);
      el.addEventListener('change', sync);
    });
    clearEl.addEventListener('click', function() {
      searchEl.value = ''; assigneeEl.value = ''; priorityEl.value = '';
      dueEl.value = ''; tagEl.value = ''; mineEl.checked = false;
      sync();
    });

    /**
     * Keep the open popover inside the viewport. Right-anchoring covers the
     * common case, but the bar can sit anywhere — narrow screens, a collapsed
     * sidebar, the portal's different layout — so measure once on open and
     * nudge it back by however far it actually spills.
     */
    function placeMorePop() {
      if (!morePop || morePop.classList.contains('hidden')) return;
      morePop.style.marginLeft = '';
      var box = morePop.getBoundingClientRect();
      var pad = 8;
      if (box.left < pad) {
        morePop.style.marginLeft = (pad - box.left) + 'px';
      } else if (box.right > window.innerWidth - pad) {
        morePop.style.marginLeft = (window.innerWidth - pad - box.right) + 'px';
      }
    }

    if (moreBtn && morePop) {
      moreBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        morePop.classList.toggle('hidden');
        placeMorePop();
      });
      window.addEventListener('resize', placeMorePop);
      // Clicks inside the popover are filter edits, not a request to dismiss it.
      morePop.addEventListener('click', function(e) { e.stopPropagation(); });
      document.addEventListener('click', function() { morePop.classList.add('hidden'); });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') morePop.classList.add('hidden');
      });
      paintMoreButton();
    }

    return {
      filter: function() { return f; },
      refreshOptions: refreshOptions,
      apply: function(tasks) {
        return applyTaskFilter(tasks, f, { userId: cfg.currentUserId ? cfg.currentUserId() : null });
      },
      setCount: function(shown, total) {
        countEl.textContent = shown === total
          ? total + (total === 1 ? ' task' : ' tasks')
          : shown + ' of ' + total + ' tasks';
      },
      reset: function() { clearEl.click(); },
    };
  }

  /**
   * Render the list view. cfg: {
   *   rootId, tasks(), projectFor(task), userLabel(id),
   *   onOpen(id), onPatch(id, patch), groupBy()
   * }
   * Returns { render, sortKey, setSort }.
   */
  function createTaskList(cfg) {
    var root = document.getElementById(cfg.rootId);
    if (!root) return { render: function(){} };
    var sortKey = 'due';
    var sortDir = 'asc';

    var COLUMNS = [
      { key: 'title', label: 'Task' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'due', label: 'Due' },
      { key: 'assignees', label: 'Assignees', nosort: true },
      { key: 'project', label: 'Project', nosort: true },
    ];

    function header() {
      return '<tr>' + COLUMNS.map(function(c) {
        var arrow = (!c.nosort && sortKey === c.key)
          ? ' <span class="tl-arrow">' + (sortDir === 'asc' ? '▲' : '▼') + '</span>' : '';
        return '<th' + (c.nosort ? '' : ' data-sort="' + c.key + '"') + '>' + esc(c.label) + arrow + '</th>';
      }).join('') + '</tr>';
    }

    function row(t) {
      var proj = cfg.projectFor ? cfg.projectFor(t) : null;
      var names = (t.assigneeIds || []).map(function(id) {
        return cfg.userLabel ? cfg.userLabel(id) : id;
      });
      // Options come from this task's own board, so a row never offers a column
      // its project does not have.
      var statusOpts = TL_STATUS.all([t]).map(function(c) {
        return '<option value="' + esc(c.key) + '"' + (t.status === c.key ? ' selected' : '') + '>' + esc(c.label) + '</option>';
      }).join('');
      var prioOpts = Object.keys(TL_PRIORITY_LABELS).map(function(k) {
        return '<option value="' + k + '"' + (t.priority === k ? ' selected' : '') + '>' + TL_PRIORITY_LABELS[k] + '</option>';
      }).join('');
      return '<tr data-id="' + esc(t.id) + '">'
        + '<td class="tl-title-cell" data-open="' + esc(t.id) + '">'
          + '<span class="tl-dot" style="background:' + esc(TL_STATUS.color(t.status, t)) + '"></span>'
          + esc(t.title)
          + (t.description ? '<span class="tl-sub">' + esc(String(t.description).slice(0, 90)) + '</span>' : '')
        + '</td>'
        + '<td><select class="tl-inline" data-field="status">' + statusOpts + '</select></td>'
        + '<td><select class="tl-inline" data-field="priority">' + prioOpts + '</select></td>'
        + '<td>' + (dueChip(t) || '<span class="text-muted">—</span>') + '</td>'
        + '<td>' + (names.length ? esc(names.join(', ')) : '<span class="text-muted">—</span>') + '</td>'
        + '<td>' + (proj
            ? '<span class="tl-dot" style="background:' + esc(proj.color) + '"></span>' + esc(proj.title)
            : '<span class="text-muted">—</span>') + '</td>'
      + '</tr>';
    }

    function render() {
      var tasks = (cfg.tasks ? cfg.tasks() : []) || [];
      var sorted = sortTasks(tasks, sortKey, sortDir);
      var body;
      if (!sorted.length) {
        body = '<tr class="tl-empty-row"><td colspan="' + COLUMNS.length + '">No tasks match these filters.</td></tr>';
      } else {
        var groupBy = cfg.groupBy ? cfg.groupBy() : '';
        if (groupBy === 'status' || groupBy === 'priority') {
          var groups = groupBy === 'status'
            ? TL_STATUS.all(sorted)
            : Object.keys(TL_PRIORITY_LABELS).map(function(k) {
                return { key: k, label: TL_PRIORITY_LABELS[k] };
              });
          body = groups.map(function(g) {
            var inGroup = sorted.filter(function(t) { return t[groupBy] === g.key; });
            if (!inGroup.length) return '';
            return '<tr class="tl-group-row"><td colspan="' + COLUMNS.length + '">'
              + esc(g.label) + ' · ' + inGroup.length + '</td></tr>'
              + inGroup.map(row).join('');
          }).join('');
        } else {
          body = sorted.map(row).join('');
        }
      }
      root.innerHTML = '<div class="tl-table-wrap"><table class="tl-table"><thead>'
        + header() + '</thead><tbody>' + body + '</tbody></table></div>';
    }

    root.addEventListener('click', function(e) {
      var th = e.target.closest('th[data-sort]');
      if (th) {
        var key = th.dataset.sort;
        if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = key; sortDir = 'asc'; }
        render();
        return;
      }
      var open = e.target.closest('[data-open]');
      if (open && cfg.onOpen) cfg.onOpen(open.dataset.open);
    });

    // Inline edits go straight through — the whole point of the list view is
    // changing many tasks without opening each one.
    root.addEventListener('change', function(e) {
      var sel = e.target.closest('select[data-field]');
      if (!sel || !cfg.onPatch) return;
      var tr = sel.closest('tr[data-id]');
      if (!tr) return;
      var patch = {};
      patch[sel.dataset.field] = sel.value;
      cfg.onPatch(tr.dataset.id, patch);
    });

    return {
      render: render,
      setSort: function(key, dir) { sortKey = key; sortDir = dir || 'asc'; render(); },
    };
  }
`;
