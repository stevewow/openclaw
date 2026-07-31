// "My Work" — one person's own tasks, grouped by when they are due. Shared
// verbatim by the admin dashboard and the user portal, like report-ui.ts,
// task-list-ui.ts, task-status-ui.ts and project-calendar-ui.ts. The host SPA
// provides `esc` and the shared due-date helpers from task-list-ui.ts.
//
// This is the landing view on both surfaces. A board answers "where does all
// the work stand?", which is the wrong first question for someone who just
// wants to know what to do next — so the default is a short, personal list and
// the board is one click away.

export const MY_WORK_CSS = `
  .mw-group { margin-bottom: 1.25rem; }
  .mw-group-head { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.4rem; padding: 0 0.15rem; }
  .mw-group-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }
  .mw-group-count { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); opacity: 0.7; }
  .mw-group.mw-overdue .mw-group-title { color: #991b1b; }

  .mw-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.55rem 0.7rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 0.3rem; cursor: pointer; }
  .mw-row:hover { border-color: var(--text-muted); }
  .mw-check { flex-shrink: 0; width: 16px; height: 16px; cursor: pointer; }
  .mw-body { flex: 1; min-width: 0; }
  .mw-title { font-size: 0.86rem; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mw-sub { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.15rem; font-size: 0.7rem; color: var(--text-muted); }
  .mw-proj-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .mw-meta { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
  .mw-prio { font-size: 0.65rem; font-weight: 700; padding: 0.08rem 0.35rem; border-radius: 4px; }
  .mw-prio-urgent { background: #fee2e2; color: #991b1b; }
  .mw-prio-high { background: #ffedd5; color: #9a3412; }
  .mw-prio-medium { background: var(--surface2); color: var(--text-muted); }
  .mw-prio-low { background: var(--surface2); color: var(--text-muted); }
  .mw-chevron { color: var(--text-muted); font-size: 0.8rem; flex-shrink: 0; }

  .mw-empty { padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); }
  .mw-empty-big { font-size: 1.6rem; margin-bottom: 0.5rem; }
`;

export const MY_WORK_COMPONENT_JS = `
  // ── My Work ──────────────────────────────────────────────────────────────

  // Ordered deliberately: what is late, then what is due, then everything else.
  // "Someday" sits last so undated work never crowds out dated work.
  var MW_PRIO_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

  var MW_GROUPS = [
    { key: 'overdue', label: 'Overdue' },
    { key: 'today', label: 'Today' },
    { key: 'soon', label: 'This week' },
    { key: 'later', label: 'Later' },
    { key: 'none', label: 'Someday' }
  ];

  /**
   * Bucket tasks by how their due date reads. Pure over (tasks, now, isDone) so
   * it can be tested without a DOM. Finished tasks are dropped: My Work is a
   * to-do list, not a record of what was done.
   */
  function groupMyWork(tasks, now, isDone) {
    var buckets = {};
    MW_GROUPS.forEach(function(g) { buckets[g.key] = []; });
    (tasks || []).forEach(function(t) {
      if (isDone && isDone(t)) return;
      // dueState already knows the day boundaries; reuse it so a chip and the
      // group it sits under can never disagree.
      var state = dueState(t.dueDate, t.status, now, t);
      if (state === 'done') return;
      (buckets[state] || buckets.none).push(t);
    });
    MW_GROUPS.forEach(function(g) {
      buckets[g.key].sort(function(a, b) {
        // Within a bucket: soonest first, then by priority, then board order.
        var ad = a.dueDate || 0, bd = b.dueDate || 0;
        if (ad !== bd) {
          if (!ad) return 1;
          if (!bd) return -1;
          return ad - bd;
        }
        var ap = MW_PRIO_RANK[a.priority] === undefined ? 9 : MW_PRIO_RANK[a.priority];
        var bp = MW_PRIO_RANK[b.priority] === undefined ? 9 : MW_PRIO_RANK[b.priority];
        if (ap !== bp) return ap - bp;
        return (a.position || 0) - (b.position || 0);
      });
    });
    return MW_GROUPS
      .map(function(g) { return { key: g.key, label: g.label, tasks: buckets[g.key] }; })
      .filter(function(g) { return g.tasks.length > 0; });
  }

  /** Tasks belonging to one person. Subtasks count — they are still their work. */
  function myWorkTasks(tasks, userId) {
    if (!userId) return [];
    return (tasks || []).filter(function(t) {
      return (t.assigneeIds || []).indexOf(userId) !== -1;
    });
  }

  /**
   * cfg: {
   *   rootId, tasks(), currentUserId(), isDone(task), projectFor(task),
   *   onOpen(id), onToggleDone(id, done), now?()
   * }
   * Returns { render }.
   */
  function createMyWork(cfg) {
    var root = document.getElementById(cfg.rootId);
    if (!root) return { render: function() {} };

    function row(t) {
      var proj = cfg.projectFor ? cfg.projectFor(t) : null;
      var prio = t.priority || 'medium';
      return '<div class="mw-row" data-id="' + esc(t.id) + '">'
        + '<input type="checkbox" class="mw-check" data-id="' + esc(t.id) + '" title="Mark done">'
        + '<div class="mw-body">'
          + '<div class="mw-title">' + esc(t.title) + '</div>'
          + (proj
            ? '<div class="mw-sub"><span class="mw-proj-dot" style="background:' + esc(proj.color) + '"></span>' + esc(proj.title) + '</div>'
            : '')
        + '</div>'
        + '<div class="mw-meta">'
          + (prio === 'urgent' || prio === 'high' ? '<span class="mw-prio mw-prio-' + esc(prio) + '">' + esc(prio) + '</span>' : '')
          + dueChip(t, cfg.now ? cfg.now() : undefined)
          + '<span class="mw-chevron">&#9656;</span>'
        + '</div>'
      + '</div>';
    }

    function render() {
      var mine = myWorkTasks(cfg.tasks ? cfg.tasks() : [], cfg.currentUserId ? cfg.currentUserId() : null);
      var groups = groupMyWork(mine, cfg.now ? cfg.now() : undefined, cfg.isDone);
      if (!groups.length) {
        root.innerHTML = '<div class="mw-empty"><div class="mw-empty-big">&#9749;</div>'
          + '<div>Nothing assigned to you right now.</div></div>';
        return;
      }
      root.innerHTML = groups.map(function(g) {
        return '<div class="mw-group' + (g.key === 'overdue' ? ' mw-overdue' : '') + '">'
          + '<div class="mw-group-head">'
            + '<span class="mw-group-title">' + esc(g.label) + '</span>'
            + '<span class="mw-group-count">' + g.tasks.length + '</span>'
          + '</div>'
          + g.tasks.map(row).join('')
        + '</div>';
      }).join('');
    }

    root.addEventListener('click', function(e) {
      var check = e.target.closest('.mw-check');
      if (check) {
        // The checkbox is an action, not navigation — do not open the task too.
        e.stopPropagation();
        if (cfg.onToggleDone) cfg.onToggleDone(check.dataset.id, check.checked);
        return;
      }
      var r = e.target.closest('.mw-row');
      if (r && cfg.onOpen) cfg.onOpen(r.dataset.id);
    });

    return { render: render };
  }
`;
