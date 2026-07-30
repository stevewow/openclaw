// Per-task comment thread + activity history, shared verbatim by the admin
// dashboard and the user portal (same arrangement as report-ui.ts and
// project-calendar-ui.ts). The host SPA provides `esc` in scope and passes its
// own API caller and lookups into createTaskFeed.
//
// Comments and activity render as one stream, newest at the bottom, the way
// board tools present them: "steve moved this to Review" sits in line with
// "steve: waiting on the floor plan" and the order tells the story.

export const TASK_FEED_CSS = `
  .tf-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
  .tf-list { display: flex; flex-direction: column; gap: 0.65rem; max-height: 16rem; overflow-y: auto; padding-right: 0.2rem; }
  .tf-empty { color: var(--text-muted); font-size: 0.8rem; padding: 0.35rem 0; }
  .tf-item { display: flex; gap: 0.5rem; align-items: flex-start; }
  .tf-avatar { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 0.65rem; font-weight: 700; display: flex; align-items: center; justify-content: center; text-transform: uppercase; }
  .tf-body { flex: 1; min-width: 0; }
  .tf-head { display: flex; align-items: baseline; gap: 0.4rem; flex-wrap: wrap; }
  .tf-author { font-weight: 700; font-size: 0.78rem; }
  .tf-time { font-size: 0.68rem; color: var(--text-muted); }
  .tf-edited { font-size: 0.66rem; color: var(--text-muted); font-style: italic; }
  .tf-text { font-size: 0.82rem; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
  .tf-mention { background: rgba(192,0,10,0.10); color: var(--accent); font-weight: 600; border-radius: 3px; padding: 0 0.15rem; }
  /* Activity is context, not conversation — quieter, and no avatar block. */
  .tf-activity { font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; padding-left: 2px; }
  .tf-activity b { color: var(--text); font-weight: 600; }
  .tf-actions { display: flex; gap: 0.4rem; margin-top: 0.1rem; }
  .tf-action { background: none; border: none; padding: 0; font-size: 0.68rem; color: var(--text-muted); cursor: pointer; font-family: inherit; text-decoration: underline; }
  .tf-action:hover { color: var(--accent); }
  .tf-composer { display: flex; flex-direction: column; gap: 0.35rem; position: relative; }
  .tf-composer textarea { width: 100%; min-height: 3.5rem; resize: vertical; padding: 0.5rem 0.65rem; font-size: 0.82rem; font-family: inherit; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); }
  .tf-composer-row { display: flex; align-items: center; gap: 0.5rem; }
  .tf-hint { font-size: 0.68rem; color: var(--text-muted); margin-right: auto; }
  /* @mention autocomplete, anchored above the composer. */
  .tf-mention-menu { position: absolute; bottom: 100%; left: 0; margin-bottom: 0.25rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); z-index: 40; min-width: 12rem; max-height: 10rem; overflow-y: auto; }
  .tf-mention-opt { padding: 0.35rem 0.6rem; font-size: 0.8rem; cursor: pointer; }
  .tf-mention-opt:hover, .tf-mention-opt.active { background: var(--surface2); }
`;

export const TASK_FEED_MARKUP = `
          <div class="tf-wrap">
            <div class="tf-list"></div>
            <div class="tf-composer">
              <textarea class="tf-input" rows="2" placeholder="Write a comment… use @ to mention someone"></textarea>
              <div class="tf-composer-row">
                <span class="tf-hint"></span>
                <button type="button" class="btn btn-primary btn-sm tf-send">Comment</button>
              </div>
            </div>
          </div>
`;

export const TASK_FEED_COMPONENT_JS = `
  // ── Shared task comment + activity feed ──────────────────────────────────
  // cfg: {
  //   rootId       element holding TASK_FEED_MARKUP
  //   api(method, path, body) -> { ok, data }   host's authenticated caller
  //   currentUserId, isAdmin                     who is looking
  //   people() -> [{ id, name }]                 for mentions and attribution
  //   labelFor(field, value) -> string|null      resolve project/user ids
  // }
  // Returns { load(taskId), clear() }.

  function tfRelativeTime(ms) {
    var diff = Date.now() - ms;
    if (diff < 45000) return 'just now';
    var mins = Math.round(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.round(hrs / 24);
    if (days < 7) return days + 'd ago';
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function tfInitials(name) {
    var n = (name || '?').trim();
    if (!n) return '?';
    var parts = n.split(/\\s+/);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : n.slice(0, 2));
  }

  var TF_STATUS_LABELS = { todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done' };

  /** One activity row as a sentence. Returns escaped HTML. */
  function tfActivitySentence(ev, labelFor) {
    function val(v) {
      if (v === null || v === undefined || v === '') return null;
      var resolved = labelFor ? labelFor(ev.field, v) : null;
      return esc(resolved !== null && resolved !== undefined ? resolved : v);
    }
    var from = val(ev.from);
    var to = val(ev.to);
    switch (ev.field) {
      case 'created':
        return 'created this task';
      case 'status':
        return 'moved this to <b>' + (to || '—') + '</b>';
      case 'priority':
        return 'set priority to <b>' + (to || '—') + '</b>';
      case 'title':
        return 'renamed this to <b>' + (to || '—') + '</b>';
      case 'dueDate':
        if (!to) return 'cleared the due date';
        return (from ? 'moved the due date to <b>' : 'set the due date to <b>') + to + '</b>';
      case 'projectId':
        if (!to) return 'removed this from its project';
        return 'moved this to <b>' + to + '</b>';
      case 'assignees':
        if (!to) return 'unassigned everyone';
        return 'assigned this to <b>' + to + '</b>';
      default:
        return 'updated this task';
    }
  }

  /** Comment text with @mentions highlighted. Escapes first, then wraps. */
  function tfRenderText(body, people) {
    var html = esc(body);
    var names = (people || [])
      .map(function(p) { return p.name; })
      .filter(function(n) { return n && n.trim(); })
      .sort(function(a, b) { return b.length - a.length; });
    names.forEach(function(name) {
      // esc() has already run, so match the escaped form of the name.
      var needle = '@' + esc(name);
      var out = '';
      var rest = html;
      for (;;) {
        var i = rest.toLowerCase().indexOf(needle.toLowerCase());
        if (i === -1) { out += rest; break; }
        var after = rest[i + needle.length];
        if (after !== undefined && /[a-zA-Z0-9_-]/.test(after)) {
          out += rest.slice(0, i + needle.length);
          rest = rest.slice(i + needle.length);
          continue;
        }
        out += rest.slice(0, i) + '<span class="tf-mention">' + rest.substr(i, needle.length) + '</span>';
        rest = rest.slice(i + needle.length);
      }
      html = out;
    });
    return html;
  }

  function createTaskFeed(cfg) {
    var root = document.getElementById(cfg.rootId);
    if (!root) return { load: function(){}, clear: function(){} };
    var listEl = root.querySelector('.tf-list');
    var inputEl = root.querySelector('.tf-input');
    var sendEl = root.querySelector('.tf-send');
    var hintEl = root.querySelector('.tf-hint');
    var taskId = null;
    var events = [];
    var editingId = null;
    var menuEl = null;
    var menuIndex = 0;
    var menuMatches = [];

    function people() { return (cfg.people ? cfg.people() : []) || []; }

    function render() {
      if (!events.length) {
        listEl.innerHTML = '<div class="tf-empty">No comments or history yet.</div>';
        return;
      }
      listEl.innerHTML = events.map(function(ev) {
        var when = '<span class="tf-time" title="' + esc(new Date(ev.createdAt).toLocaleString()) + '">'
          + esc(tfRelativeTime(ev.createdAt)) + '</span>';
        var who = esc(ev.authorName || 'someone');
        if (ev.kind === 'activity') {
          return '<div class="tf-activity"><b>' + who + '</b> '
            + tfActivitySentence(ev, cfg.labelFor) + ' · ' + when + '</div>';
        }
        var mine = ev.authorId && cfg.currentUserId && ev.authorId === cfg.currentUserId;
        var actions = (mine || cfg.isAdmin)
          ? '<div class="tf-actions">'
              + (mine ? '<button type="button" class="tf-action" data-edit="' + esc(ev.id) + '">Edit</button>' : '')
              + '<button type="button" class="tf-action" data-delete="' + esc(ev.id) + '">Delete</button>'
            + '</div>'
          : '';
        return '<div class="tf-item">'
          + '<div class="tf-avatar">' + esc(tfInitials(ev.authorName)) + '</div>'
          + '<div class="tf-body">'
            + '<div class="tf-head"><span class="tf-author">' + who + '</span>' + when
            + (ev.editedAt ? '<span class="tf-edited">edited</span>' : '') + '</div>'
            + '<div class="tf-text">' + tfRenderText(ev.body || '', people()) + '</div>'
            + actions
          + '</div>'
        + '</div>';
      }).join('');
      listEl.scrollTop = listEl.scrollHeight;
    }

    function setHint(msg) { hintEl.textContent = msg || ''; }

    async function load(id) {
      taskId = id;
      editingId = null;
      inputEl.value = '';
      sendEl.textContent = 'Comment';
      setHint('');
      if (!id) { events = []; render(); return; }
      listEl.innerHTML = '<div class="tf-empty">Loading…</div>';
      var r = await cfg.api('GET', '/tasks/' + id + '/events');
      events = r.ok ? (r.data.events || []) : [];
      if (!r.ok) { listEl.innerHTML = '<div class="tf-empty">Could not load the thread.</div>'; return; }
      render();
    }

    async function submit() {
      var text = inputEl.value.trim();
      if (!text || !taskId) return;
      sendEl.disabled = true;
      var r = editingId
        ? await cfg.api('PUT', '/tasks/' + taskId + '/events/' + editingId, { body: text })
        : await cfg.api('POST', '/tasks/' + taskId + '/events', { body: text });
      sendEl.disabled = false;
      if (!r.ok) { setHint((r.data && r.data.error) || 'Could not save that comment.'); return; }
      inputEl.value = '';
      editingId = null;
      sendEl.textContent = 'Comment';
      setHint('');
      await load(taskId);
    }

    sendEl.addEventListener('click', submit);
    // Enter sends, Shift+Enter makes a newline — the convention every chat and
    // board tool uses, so muscle memory carries over.
    inputEl.addEventListener('keydown', function(e) {
      if (menuEl && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape')) {
        if (e.key === 'Escape') { closeMenu(); e.preventDefault(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          menuIndex = (menuIndex + (e.key === 'ArrowDown' ? 1 : -1) + menuMatches.length) % menuMatches.length;
          paintMenu();
          e.preventDefault();
          return;
        }
        applyMention(menuMatches[menuIndex]);
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });

    listEl.addEventListener('click', async function(e) {
      var del = e.target.closest('[data-delete]');
      if (del) {
        if (!confirm('Delete this comment?')) return;
        var r = await cfg.api('DELETE', '/tasks/' + taskId + '/events/' + del.dataset.delete);
        if (r.ok) await load(taskId); else setHint('Could not delete that comment.');
        return;
      }
      var ed = e.target.closest('[data-edit]');
      if (ed) {
        var ev = events.find(function(x) { return x.id === ed.dataset.edit; });
        if (!ev) return;
        editingId = ev.id;
        inputEl.value = ev.body || '';
        sendEl.textContent = 'Save';
        setHint('Editing — Esc to cancel');
        inputEl.focus();
      }
    });

    inputEl.addEventListener('keyup', function(e) {
      if (e.key === 'Escape' && editingId) {
        editingId = null; inputEl.value = ''; sendEl.textContent = 'Comment'; setHint('');
        return;
      }
      maybeOpenMenu();
    });
    inputEl.addEventListener('blur', function() { setTimeout(closeMenu, 150); });

    // ── @mention autocomplete ──
    function currentMentionPrefix() {
      var upto = inputEl.value.slice(0, inputEl.selectionStart);
      var at = upto.lastIndexOf('@');
      if (at === -1) return null;
      // Only a token that starts the word counts, and it cannot span a newline.
      var before = upto[at - 1];
      if (before !== undefined && !/\\s/.test(before)) return null;
      var frag = upto.slice(at + 1);
      if (/[\\n]/.test(frag)) return null;
      return { at: at, frag: frag };
    }

    function maybeOpenMenu() {
      var ctx = currentMentionPrefix();
      if (!ctx) { closeMenu(); return; }
      var frag = ctx.frag.toLowerCase();
      menuMatches = people().filter(function(p) {
        return p.name && p.name.toLowerCase().indexOf(frag) === 0;
      }).slice(0, 6);
      if (!menuMatches.length) { closeMenu(); return; }
      menuIndex = 0;
      if (!menuEl) {
        menuEl = document.createElement('div');
        menuEl.className = 'tf-mention-menu';
        menuEl.addEventListener('mousedown', function(e) {
          var opt = e.target.closest('[data-idx]');
          if (!opt) return;
          e.preventDefault();
          applyMention(menuMatches[parseInt(opt.dataset.idx, 10)]);
        });
        root.querySelector('.tf-composer').appendChild(menuEl);
      }
      paintMenu();
    }

    function paintMenu() {
      if (!menuEl) return;
      menuEl.innerHTML = menuMatches.map(function(p, i) {
        return '<div class="tf-mention-opt' + (i === menuIndex ? ' active' : '') + '" data-idx="' + i + '">'
          + esc(p.name) + '</div>';
      }).join('');
    }

    function closeMenu() {
      if (menuEl) { menuEl.remove(); menuEl = null; }
      menuMatches = [];
    }

    function applyMention(person) {
      if (!person) return;
      var ctx = currentMentionPrefix();
      if (!ctx) { closeMenu(); return; }
      var head = inputEl.value.slice(0, ctx.at);
      var tail = inputEl.value.slice(inputEl.selectionStart);
      inputEl.value = head + '@' + person.name + ' ' + tail;
      var caret = (head + '@' + person.name + ' ').length;
      inputEl.setSelectionRange(caret, caret);
      closeMenu();
      inputEl.focus();
    }

    return {
      load: load,
      clear: function() { taskId = null; events = []; editingId = null; inputEl.value = ''; render(); },
    };
  }
`;
