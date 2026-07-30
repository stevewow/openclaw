// Shared month calendar over projects and tasks, embedded verbatim by both the
// admin dashboard (admin-ui-html.ts) and the user portal (user-portal-html.ts)
// so the two render and behave identically. Like report-ui.ts these are strings
// of browser JS/CSS/markup, not modules — each SPA interpolates them into its
// own outer template literal, and provides `esc` in scope.
//
// The host owns the data and the click targets; the component owns the month
// arithmetic and the drawing. Instantiate with createProjectCalendar(cfg).

/** Calendar styles. Scoped under .cal-*, so both SPAs can drop them in as-is. */
export const PROJECT_CALENDAR_CSS = `
  .cal-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
  .cal-header { display: flex; align-items: center; justify-content: space-between; padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border); }
  .cal-title { font-weight: 700; font-size: 1.05rem; letter-spacing: -0.01em; }
  .cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--border); background: var(--surface2); }
  .cal-weekday { padding: 0.5rem 0.4rem; text-align: center; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-right: 1px solid var(--border); }
  .cal-weekday:last-child { border-right: none; }
  .cal-days { display: grid; grid-template-columns: repeat(7, 1fr); }
  .cal-day { min-height: 90px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 0.35rem 0.4rem; cursor: pointer; transition: background 0.1s; }
  .cal-day:hover { background: var(--surface2); }
  .cal-day:nth-child(7n) { border-right: none; }
  .cal-day-num { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.2rem; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
  .cal-day.today .cal-day-num { background: var(--accent); color: #fff; }
  .cal-day.other-month { background: #fafafa; cursor: default; }
  .cal-day.other-month .cal-day-num { color: #d1d5db; }
  /* Read-only viewers get no "click a day to add" affordance. */
  .cal-days.cal-readonly .cal-day { cursor: default; }
  .cal-task-chip { display: block; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.65rem; font-weight: 600; color: #fff; margin-bottom: 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
  .cal-task-chip:hover { opacity: 0.85; }
  .cal-more { font-size: 0.65rem; color: var(--text-muted); font-weight: 600; padding: 0 0.3rem; }
  .cal-proj-bar { display: block; font-size: 0.62rem; font-weight: 700; color: var(--text); padding: 0.05rem 0.3rem; margin-bottom: 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; border-left: 3px solid transparent; }
  .cal-proj-bar.cal-proj-start { border-radius: 3px 0 0 3px; }
  .cal-proj-bar.cal-proj-end { border-radius: 0 3px 3px 0; }
  .cal-proj-bar.cal-proj-solo { border-radius: 3px; }
  .cal-proj-bar:hover { filter: brightness(0.95); }
  @media (max-width: 640px) {
    .cal-day { min-height: 64px; padding: 0.25rem; }
    .cal-day-num { font-size: 0.7rem; width: 18px; height: 18px; }
    .cal-task-chip { font-size: 0.6rem; }
    .cal-weekday { font-size: 0.6rem; padding: 0.4rem 0.2rem; }
  }
`;

/**
 * Calendar markup, to be placed inside the host's own container element (whose
 * id is what createProjectCalendar takes). Hooks are classes rather than ids so
 * the same markup can appear more than once in a page without colliding.
 */
export const PROJECT_CALENDAR_MARKUP = `
          <div class="cal-wrap">
            <div class="cal-header">
              <button type="button" class="btn btn-ghost btn-sm cal-prev">← Prev</button>
              <span class="cal-title"></span>
              <button type="button" class="btn btn-ghost btn-sm cal-next">Next →</button>
            </div>
            <div class="cal-weekdays">
              <div class="cal-weekday">Sun</div><div class="cal-weekday">Mon</div><div class="cal-weekday">Tue</div>
              <div class="cal-weekday">Wed</div><div class="cal-weekday">Thu</div><div class="cal-weekday">Fri</div>
              <div class="cal-weekday">Sat</div>
            </div>
            <div class="cal-days"></div>
          </div>
`;

export const PROJECT_CALENDAR_COMPONENT_JS = `
  // ── Shared project/task month calendar ───────────────────────────────────
  // cfg: {
  //   rootId    id of the element holding PROJECT_CALENDAR_MARKUP
  //   tasks()   tasks to draw; only those with a dueDate are used
  //   projects() projects to draw as date ranges; only those with a date are used
  //   taskColor(task) -> css color for the task's chip
  //   onTask(id) / onProject(id)  click handlers (optional)
  //   onDay(ms)  click on empty day space (optional; omit for read-only)
  // }
  // Returns { render, goTo, today } — the host calls render() whenever its data
  // changes, and the component redraws the month it is currently showing.
  var CAL_MONTH_NAMES = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];

  function calSameDay(a, b) {
    var x = new Date(a), y = new Date(b);
    return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
  }

  /**
   * A timestamp as the yyyy-mm-dd an <input type="date"> expects, in LOCAL time.
   * toISOString() would answer in UTC and hand back the previous day for anyone
   * east of Greenwich, so clicking a calendar cell would prefill the wrong date.
   */
  function calDateInputValue(ms) {
    var d = new Date(ms);
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function calFormatRange(start, end) {
    var opts = { month: 'short', day: 'numeric' };
    if (start && end) {
      if (calSameDay(start, end)) return new Date(start).toLocaleDateString(undefined, opts);
      return new Date(start).toLocaleDateString(undefined, opts) + ' – ' + new Date(end).toLocaleDateString(undefined, opts);
    }
    var only = start || end;
    return only ? new Date(only).toLocaleDateString(undefined, opts) : '';
  }

  function createProjectCalendar(cfg) {
    var root = document.getElementById(cfg.rootId);
    if (!root) return { render: function(){}, goTo: function(){}, today: function(){} };
    var titleEl = root.querySelector('.cal-title');
    var daysEl = root.querySelector('.cal-days');
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth(); // 0-11

    if (!cfg.onDay) daysEl.classList.add('cal-readonly');

    function render() {
      titleEl.textContent = CAL_MONTH_NAMES[month] + ' ' + year;
      var tasks = (cfg.tasks ? cfg.tasks() : []).filter(function(t) { return t.dueDate; });
      // A project needs at least one date to be placeable; a one-sided range
      // marks only the date it actually has.
      var projects = (cfg.projects ? cfg.projects() : []).filter(function(p) { return p.startDate || p.endDate; });
      var firstDay = new Date(year, month, 1).getDay(); // 0=Sun
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var today = new Date(); today.setHours(0, 0, 0, 0);

      var html = '';
      // Leading blanks so the 1st lands on its weekday.
      for (var i = 0; i < firstDay; i++) html += '<div class="cal-day other-month"></div>';
      for (var d = 1; d <= daysInMonth; d++) {
        var dayStart = new Date(year, month, d).getTime();
        var dayEnd = dayStart + 86400000;
        var weekday = new Date(year, month, d).getDay();
        var isToday = calSameDay(dayStart, today.getTime());
        html += '<div class="cal-day' + (isToday ? ' today' : '') + '" data-date="' + dayStart + '">';
        html += '<div class="cal-day-num">' + d + '</div>';

        // Project ranges first — they frame the day.
        var dayProjects = projects.filter(function(p) {
          var from = p.startDate || p.endDate;
          var to = p.endDate || p.startDate;
          return from < dayEnd && to >= dayStart;
        });
        dayProjects.slice(0, 2).forEach(function(p) {
          var from = p.startDate || p.endDate;
          var to = p.endDate || p.startDate;
          var isStart = from >= dayStart && from < dayEnd;
          var isEnd = to >= dayStart && to < dayEnd;
          var shape = isStart && isEnd ? ' cal-proj-solo' : isStart ? ' cal-proj-start' : isEnd ? ' cal-proj-end' : '';
          // Repeat the name at each week break so a long run stays readable.
          var label = isStart || weekday === 0 ? p.title : '&nbsp;';
          html += '<div class="cal-proj-bar' + shape + '" data-project-id="' + esc(p.id) + '"' +
            ' style="background:' + esc(p.color) + '22;border-left-color:' + (isStart ? esc(p.color) : 'transparent') + '"' +
            ' title="' + esc(p.title + ' · ' + calFormatRange(p.startDate, p.endDate)) + '">' +
            (label === '&nbsp;' ? label : esc(label)) + '</div>';
        });
        if (dayProjects.length > 2) html += '<div class="cal-more">+' + (dayProjects.length - 2) + ' project' + (dayProjects.length - 2 === 1 ? '' : 's') + '</div>';

        var dayTasks = tasks.filter(function(t) { return t.dueDate >= dayStart && t.dueDate < dayEnd; });
        dayTasks.slice(0, 3).forEach(function(t) {
          var color = cfg.taskColor ? cfg.taskColor(t) : '#6b7280';
          html += '<div class="cal-task-chip" data-id="' + esc(t.id) + '" style="background:' + esc(color) + '" title="' + esc(t.title) + '">' + esc(t.title) + '</div>';
        });
        if (dayTasks.length > 3) html += '<div class="cal-more">+' + (dayTasks.length - 3) + ' more</div>';
        html += '</div>';
      }
      daysEl.innerHTML = html;
    }

    root.querySelector('.cal-prev').addEventListener('click', function() {
      month--; if (month < 0) { month = 11; year--; }
      render();
    });
    root.querySelector('.cal-next').addEventListener('click', function() {
      month++; if (month > 11) { month = 0; year++; }
      render();
    });
    root.addEventListener('click', function(e) {
      var bar = e.target.closest('.cal-proj-bar');
      if (bar) { if (cfg.onProject) cfg.onProject(bar.dataset.projectId); return; }
      var chip = e.target.closest('.cal-task-chip');
      if (chip) { if (cfg.onTask) cfg.onTask(chip.dataset.id); return; }
      var day = e.target.closest('.cal-day[data-date]');
      if (day && cfg.onDay) cfg.onDay(parseInt(day.dataset.date, 10));
    });

    return {
      render: render,
      goTo: function(y, m) { year = y; month = m; render(); },
      today: function() { var n = new Date(); year = n.getFullYear(); month = n.getMonth(); render(); },
    };
  }
`;
