// The Sales Guide page: the product guide and the call scripts, as the team's
// own editable copy.
//
// This is the page the coach answers out of, which is the whole reason it is a
// page rather than a document somewhere. Sales leadership edits a price or an
// objection line here and the next question anyone asks the coach is answered
// from the new wording — no redeploy, no Doc round trip, no second copy to
// forget about.
//
// Editing is markdown with a live preview rather than the rich-text surface
// help articles use. The guide is reference material — pricing tables, two-deep
// objection scripts — and the editor in `kb-editor-ui.ts` is bound to the
// article modal's own element ids. Sharing it would mean rewiring the surface
// staff publish client-facing articles through, which is not a risk this page
// is worth. The preview is drawn with the same `kbMdToHtml` the round trip uses,
// so what an editor sees is what the page renders.
//
// Shared by both signed-in surfaces, like the other `*-ui.ts` components: the
// host supplies `esc` and `api`.

import { infoTip } from "./info-tip.js";

export const GUIDE_CSS = `
  .gd-head { display: flex; gap: 0.75rem; align-items: flex-start; flex-wrap: wrap; }
  .gd-head .btn { width: auto; flex: 0 0 auto; }
  .gd-tabs { display: inline-flex; gap: 0.2rem; padding: 0.15rem; background: var(--surface2); border: 1px solid var(--hairline); border-radius: var(--radius-pill); }
  .gd-tabs button { border: 1px solid transparent; background: transparent; color: var(--text-muted); cursor: pointer; font: inherit; font-size: 0.82rem; font-weight: 600; padding: 0.3rem 0.85rem; border-radius: var(--radius-pill); }
  .gd-tabs button:hover { color: var(--text); }
  .gd-tabs button[aria-pressed="true"] { background: var(--surface); border-color: var(--border); color: var(--text); box-shadow: var(--shadow); }
  .gd-bar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
  .gd-search { flex: 1 1 14rem; min-width: 10rem; max-width: 26rem; padding: 0.4rem 0.65rem; font-size: 0.85rem; font-family: inherit; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); }
  .gd-search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  .gd-count { font-size: 0.75rem; color: var(--text-muted); margin-left: auto; white-space: nowrap; }

  .gd-group { margin: 1.4rem 0 0.6rem; font-size: 0.69rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--accent-ink); }
  .gd-group:first-child { margin-top: 0; }

  .gd-section { background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 0.7rem; overflow: hidden; }
  .gd-section-head { display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 0.95rem; cursor: pointer; }
  .gd-section-head:hover { background: var(--surface2); }
  .gd-section-title { font-weight: 700; font-size: 0.92rem; flex: 1; min-width: 0; }
  .gd-caret { width: 1rem; color: var(--text-muted); flex: none; transition: transform 0.12s; }
  .gd-section.is-open .gd-caret { transform: rotate(90deg); }
  .gd-section-actions { display: flex; gap: 0.3rem; flex: none; }
  .gd-act { border: 1px solid transparent; background: none; color: var(--text-muted); cursor: pointer; font: inherit; font-size: 0.75rem; padding: 0.2rem 0.45rem; border-radius: var(--radius-sm); }
  .gd-act:hover { border-color: var(--border); background: var(--surface); color: var(--text); }
  .gd-body { display: none; padding: 0 0.95rem 0.95rem; border-top: 1px solid var(--hairline); }
  .gd-section.is-open .gd-body { display: block; }

  /* The rendered guide. Pricing is a table and has to read like one. */
  .gd-md { font-size: 0.87rem; line-height: 1.6; color: var(--text); padding-top: 0.75rem; }
  .gd-md h2 { font-size: 1rem; margin: 1rem 0 0.4rem; }
  .gd-md h3 { font-size: 0.9rem; margin: 0.9rem 0 0.35rem; }
  .gd-md p { margin: 0 0 0.6rem; }
  .gd-md ul, .gd-md ol { margin: 0 0 0.6rem 1.1rem; }
  .gd-md li { margin-bottom: 0.2rem; }
  .gd-md ul ul, .gd-md ol ol, .gd-md ul ol, .gd-md ol ul { margin-bottom: 0.15rem; }
  .gd-md blockquote { margin: 0 0 0.6rem; padding-left: 0.7rem; border-left: 2px solid var(--border); color: var(--text-muted); }
  .gd-md table { border-collapse: collapse; margin: 0 0 0.7rem; font-size: 0.84rem; }
  .gd-md th { text-align: left; background: var(--surface2); color: var(--text-muted); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; padding: 0.35rem 0.7rem; border: 1px solid var(--hairline); white-space: nowrap; }
  .gd-md td { padding: 0.35rem 0.7rem; border: 1px solid var(--hairline); font-variant-numeric: tabular-nums; }
  .gd-md strong { font-weight: 700; }

  .gd-edit { padding-top: 0.75rem; }
  .gd-edit-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .gd-edit-row input { flex: 1 1 12rem; padding: 0.4rem 0.6rem; font: inherit; font-size: 0.85rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); }
  .gd-split { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  @media (max-width: 820px) { .gd-split { grid-template-columns: 1fr; } }
  .gd-split textarea { width: 100%; min-height: 18rem; padding: 0.6rem 0.7rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; line-height: 1.55; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); resize: vertical; }
  .gd-split textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  .gd-preview { border: 1px dashed var(--border); border-radius: var(--radius-sm); padding: 0 0.7rem 0.7rem; overflow-x: auto; max-height: 26rem; overflow-y: auto; }
  .gd-edit-actions { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.6rem; }
  .gd-edit-actions .btn { width: auto; }
  .gd-edit-note { font-size: 0.75rem; color: var(--text-muted); }

  .gd-warn { color: var(--warning); font-weight: 600; font-size: 0.8rem; }
  .gd-empty { color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem; text-align: center; }
`;

const GUIDE_ABOUT = infoTip(
  `<p>What we sell and how we talk about it: every service and bundle with its pricing, positioning
     and objection responses, and the call scripts for each stage of a client relationship.</p>
   <p>This is the copy that counts. The sales coach answers out of these sections and quotes them
     back, so an edit here changes what the whole team is told to say. Prices are standard rates —
     brokerage partner pricing comes from leadership.</p>`,
  { label: "About the sales guide" },
);

function guidePageMarkup(): string {
  return `
        <div class="card" style="margin-bottom:1rem">
          <div class="gd-head">
            <div style="flex:1;min-width:min(16rem,100%)">
              <div style="font-weight:700">Sales Guide${GUIDE_ABOUT}</div>
              <p class="gd-edit-note" id="gd-sync" style="margin:0.35rem 0 0"></p>
            </div>
            <div class="gd-tabs" id="gd-docs" role="group" aria-label="Guide"></div>
            <button type="button" class="btn btn-primary" id="gd-ask">Ask the coach</button>
          </div>
        </div>

        <div class="gd-bar">
          <input type="search" class="gd-search" id="gd-search" placeholder="Search the guide — a product, an objection, a stage…" aria-label="Search the guide" />
          <button type="button" class="btn btn-sm hidden" id="gd-add">＋ Add a section</button>
          <span class="gd-count" id="gd-count"></span>
        </div>

        <div id="gd-list"><div class="gd-empty">Loading…</div></div>`;
}

export const GUIDE_MARKUP = `
      <!-- The sales guide: what we sell, and what we say -->
      <div id="page-guide" class="page hidden">
${guidePageMarkup()}
      </div>`;

export const GUIDE_PORTAL_MARKUP = `
    <div id="page-guide" class="page">
      <div class="topbar"><h2>Sales Guide</h2></div>
      <div class="page-scroll">
${guidePageMarkup()}
      </div>
    </div>`;

export const GUIDE_COMPONENT_JS = `
  // ── The sales guide ───────────────────────────────────────────────────────
  // The host supplies esc() and api(). kbMdToHtml() comes from the article
  // editor: one renderer, so the preview, the page and the round trip agree.

  var gdState = { docs: [], docId: null, sections: [], canEdit: false, editing: null, adding: false, filter: '' };

  function gdEl(id){ return document.getElementById(id); }

  async function loadGuide(){
    var r = await api('GET', '/guide');
    if(!r.ok){
      gdEl('gd-list').innerHTML = '<div class="gd-empty">Could not load the guide.</div>';
      return;
    }
    gdState.docs = r.data.docs || [];
    gdState.canEdit = !!r.data.canEdit;
    if(!gdState.docId || !gdState.docs.some(function(d){ return d.id === gdState.docId; })){
      gdState.docId = gdState.docs.length ? gdState.docs[0].id : null;
    }
    gdRenderSync(r.data);
    gdRenderTabs();
    await gdLoadSections();
  }

  function gdRenderSync(data){
    var el = gdEl('gd-sync');
    if(!el) return;
    var doc = gdCurrentDoc();
    var parts = [];
    if(doc && doc.summary) parts.push(esc(doc.summary));
    // Every question the coach answers pays for the whole guide, so a guide
    // that has grown past what it may cost is worth saying out loud here
    // rather than discovering on a bill.
    if(data && data.approxTokens && data.tokenCap && data.approxTokens > data.tokenCap * 0.8){
      parts.push('<span class="gd-warn">' + esc('The guide is getting long (' + data.approxTokens +
        ' of ' + data.tokenCap + ' words the coach can hold). Past the limit the coach stops seeing the end of it.') + '</span>');
    }
    el.innerHTML = parts.join(' ');
  }

  function gdCurrentDoc(){
    for(var i=0;i<gdState.docs.length;i++){
      if(gdState.docs[i].id === gdState.docId) return gdState.docs[i];
    }
    return null;
  }

  function gdRenderTabs(){
    var host = gdEl('gd-docs');
    if(!host) return;
    host.innerHTML = gdState.docs.map(function(d){
      return '<button type="button" data-doc="' + esc(d.id) + '" aria-pressed="' +
        (d.id === gdState.docId ? 'true' : 'false') + '">' + esc(d.title) + '</button>';
    }).join('');
  }

  async function gdLoadSections(){
    if(!gdState.docId){
      gdEl('gd-list').innerHTML = '<div class="gd-empty">No guide yet.</div>';
      return;
    }
    var r = await api('GET', '/guide/docs/' + encodeURIComponent(gdState.docId) + '/sections');
    gdState.sections = r.ok ? (r.data.sections || []) : [];
    gdState.editing = null;
    gdState.adding = false;
    gdRenderSections();
  }

  function gdMatches(section, needle){
    if(!needle) return true;
    var hay = (section.heading + ' ' + (section.group || '') + ' ' + section.bodyMd).toLowerCase();
    return hay.indexOf(needle) >= 0;
  }

  function gdRenderSections(){
    var host = gdEl('gd-list');
    if(!host) return;
    var needle = gdState.filter.trim().toLowerCase();
    var shown = gdState.sections.filter(function(s){ return gdMatches(s, needle); });
    var count = gdEl('gd-count');
    if(count){
      count.textContent = needle
        ? shown.length + ' of ' + gdState.sections.length + ' sections'
        : gdState.sections.length + (gdState.sections.length === 1 ? ' section' : ' sections');
    }
    var addBtn = gdEl('gd-add');
    if(addBtn) addBtn.classList.toggle('hidden', !gdState.canEdit);

    if(!shown.length){
      host.innerHTML = '<div class="gd-empty">' +
        (needle ? 'Nothing in the guide matches that.' : 'This guide has no sections yet.') + '</div>';
      return;
    }
    var html = '';
    var group = null;
    for(var i=0;i<shown.length;i++){
      var s = shown[i];
      if(s.group && s.group !== group){
        group = s.group;
        html += '<div class="gd-group">' + esc(group) + '</div>';
      }
      html += gdSectionHtml(s, i, shown.length);
    }
    if(gdState.adding) html += gdEditorHtml(null);
    host.innerHTML = html;
  }

  function gdSectionHtml(s, index, total){
    var open = gdState.editing === s.id;
    var actions = '';
    if(gdState.canEdit){
      actions = '<div class="gd-section-actions">' +
        (index > 0 ? '<button type="button" class="gd-act" data-move="up" data-id="' + esc(s.id) + '" title="Move up">↑</button>' : '') +
        (index < total - 1 ? '<button type="button" class="gd-act" data-move="down" data-id="' + esc(s.id) + '" title="Move down">↓</button>' : '') +
        '<button type="button" class="gd-act" data-edit="' + esc(s.id) + '">Edit</button>' +
        '<button type="button" class="gd-act" data-del="' + esc(s.id) + '">Delete</button>' +
        '</div>';
    }
    return '<div class="gd-section' + (open ? ' is-open' : '') + '" data-section="' + esc(s.id) + '">' +
      '<div class="gd-section-head" data-toggle="' + esc(s.id) + '">' +
        '<span class="gd-caret" aria-hidden="true">▸</span>' +
        '<span class="gd-section-title">' + esc(s.heading) + '</span>' +
        actions +
      '</div>' +
      '<div class="gd-body">' +
        (open ? gdEditorHtml(s) : '<div class="gd-md">' + kbMdToHtml(s.bodyMd) + '</div>') +
      '</div>' +
    '</div>';
  }

  function gdEditorHtml(s){
    var isNew = !s;
    var wrap = isNew ? '<div class="gd-section is-open"><div class="gd-body">' : '';
    var close = isNew ? '</div></div>' : '';
    return wrap + '<div class="gd-edit" data-editor="' + esc(isNew ? 'new' : s.id) + '">' +
      '<div class="gd-edit-row">' +
        '<input type="text" data-field="heading" placeholder="Heading — the product, or the step of the call" value="' + esc(isNew ? '' : s.heading) + '" />' +
        '<input type="text" data-field="group" placeholder="Group (optional)" value="' + esc(isNew ? '' : (s.group || '')) + '" />' +
      '</div>' +
      '<div class="gd-split">' +
        '<textarea data-field="bodyMd" spellcheck="true" placeholder="Markdown. A pricing table is | a | b | rows with | --- | under the header.">' + esc(isNew ? '' : s.bodyMd) + '</textarea>' +
        '<div class="gd-preview"><div class="gd-md" data-preview></div></div>' +
      '</div>' +
      '<div class="gd-edit-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-save="' + esc(isNew ? 'new' : s.id) + '">Save</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-cancel="1">Cancel</button>' +
        '<span class="gd-edit-note">The coach answers from this the moment it is saved.</span>' +
      '</div>' +
    '</div>' + close;
  }

  function gdSyncPreview(editor){
    var textarea = editor.querySelector('[data-field="bodyMd"]');
    var preview = editor.querySelector('[data-preview]');
    if(textarea && preview) preview.innerHTML = kbMdToHtml(textarea.value);
  }

  function gdReadEditor(editor){
    function field(name){
      var el = editor.querySelector('[data-field="' + name + '"]');
      return el ? el.value : '';
    }
    return { heading: field('heading').trim(), group: field('group').trim(), bodyMd: field('bodyMd') };
  }

  async function gdSave(id){
    var editor = document.querySelector('[data-editor="' + id + '"]');
    if(!editor) return;
    var values = gdReadEditor(editor);
    if(!values.heading){ alert('Give the section a heading.'); return; }
    var r;
    if(id === 'new'){
      r = await api('POST', '/guide/docs/' + encodeURIComponent(gdState.docId) + '/sections', values);
    } else {
      r = await api('PUT', '/guide/sections/' + encodeURIComponent(id), values);
    }
    if(!r.ok){ alert('Could not save that.'); return; }
    await gdLoadSections();
  }

  async function gdMove(id, dir){
    var ids = gdState.sections.map(function(s){ return s.id; });
    var at = ids.indexOf(id);
    var to = dir === 'up' ? at - 1 : at + 1;
    if(at < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(at, 1)[0]);
    var r = await api('POST', '/guide/docs/' + encodeURIComponent(gdState.docId) + '/reorder', { ids: ids });
    if(r.ok){
      gdState.sections = r.data.sections || gdState.sections;
      gdRenderSections();
    }
  }

  function wireGuide(){
    var search = gdEl('gd-search');
    if(search){
      search.addEventListener('input', function(){
        gdState.filter = search.value;
        gdRenderSections();
      });
    }
    var docs = gdEl('gd-docs');
    if(docs){
      docs.addEventListener('click', function(e){
        var btn = e.target.closest ? e.target.closest('[data-doc]') : null;
        if(!btn) return;
        gdState.docId = btn.getAttribute('data-doc');
        gdState.filter = '';
        if(search) search.value = '';
        gdRenderTabs();
        gdRenderSync(null);
        gdLoadSections();
      });
    }
    var add = gdEl('gd-add');
    if(add){
      add.addEventListener('click', function(){
        gdState.adding = true;
        gdState.editing = null;
        gdRenderSections();
        var editor = document.querySelector('[data-editor="new"]');
        if(editor){
          gdSyncPreview(editor);
          var heading = editor.querySelector('[data-field="heading"]');
          if(heading) heading.focus();
        }
      });
    }
    var ask = gdEl('gd-ask');
    if(ask) ask.addEventListener('click', function(){ if(window.coachOpen) window.coachOpen(); });

    var list = gdEl('gd-list');
    if(!list) return;
    list.addEventListener('input', function(e){
      if(!e.target.closest) return;
      var editor = e.target.closest('[data-editor]');
      if(editor && e.target.getAttribute('data-field') === 'bodyMd') gdSyncPreview(editor);
    });
    list.addEventListener('click', function(e){
      if(!e.target.closest) return;
      var move = e.target.closest('[data-move]');
      if(move){ gdMove(move.getAttribute('data-id'), move.getAttribute('data-move')); return; }
      var edit = e.target.closest('[data-edit]');
      if(edit){
        gdState.editing = edit.getAttribute('data-edit');
        gdState.adding = false;
        gdRenderSections();
        var editor = document.querySelector('[data-editor="' + gdState.editing + '"]');
        if(editor) gdSyncPreview(editor);
        return;
      }
      var del = e.target.closest('[data-del]');
      if(del){
        var id = del.getAttribute('data-del');
        if(!confirm('Delete this section? The coach will stop answering from it.')) return;
        api('DELETE', '/guide/sections/' + encodeURIComponent(id)).then(function(){ gdLoadSections(); });
        return;
      }
      var save = e.target.closest('[data-save]');
      if(save){ gdSave(save.getAttribute('data-save')); return; }
      var cancel = e.target.closest('[data-cancel]');
      if(cancel){
        gdState.editing = null;
        gdState.adding = false;
        gdRenderSections();
        return;
      }
      var toggle = e.target.closest('[data-toggle]');
      if(toggle){
        // An open editor stays open: a stray click on the header must not throw
        // away what someone has typed.
        if(gdState.editing === toggle.getAttribute('data-toggle')) return;
        var section = toggle.closest('.gd-section');
        if(section) section.classList.toggle('is-open');
      }
    });
  }

  wireGuide();
`;
