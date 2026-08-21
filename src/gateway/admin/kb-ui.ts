// The Hub's help center authoring page: categories, articles, and the
// draft/publish step between writing one and a client seeing it.
//
// Shaped like task-list-ui.ts and market-ui.ts — CSS, markup and component JS
// exported as strings and interpolated into the admin SPA. The host provides
// `esc`, `api` and the modal conventions.
//
// Everything here is staff-facing. The public reader is a separate surface with
// no session and no access to any of these calls.
//
// The article body is edited through the rich-text surface in kb-editor-ui.ts;
// this module only hands it markdown on open and takes markdown back on save.

import { KB_EDITOR_CSS, KB_EDITOR_JS, KB_EDITOR_MARKUP } from "./kb-editor-ui.js";

export const KB_CSS = `
  /* Two columns on a desk, stacked on a phone: the category list is a short
     index and the article table is the work, so they do not deserve equal width. */
  .kb-cols { display: grid; grid-template-columns: minmax(0, 20rem) minmax(0, 1fr); gap: 1rem; align-items: start; }
  @media (max-width: 900px) { .kb-cols { grid-template-columns: minmax(0, 1fr); } }

  .kb-cat { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 0.4rem; background: var(--surface); }
  .kb-cat.kb-cat-on { border-color: var(--accent); background: rgba(192,0,10,0.05); }
  .kb-cat-main { flex: 1 1 auto; min-width: 0; cursor: pointer; }
  .kb-cat-title { font-weight: 600; font-size: 0.87rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kb-cat-sub { font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kb-cat-acts { flex: none; display: flex; gap: 0.15rem; }

  .kb-bar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .kb-search { flex: 1 1 12rem; min-width: 9rem; max-width: 24rem; padding: 0.4rem 0.65rem; font-size: 0.82rem; font-family: inherit; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); }
  .kb-search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.09); }
  .kb-count { font-size: 0.75rem; color: var(--text-muted); margin-left: auto; white-space: nowrap; }

  .kb-chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; color: #fff; }
  .kb-chip-draft { background: #6b7280; }
  .kb-chip-live { background: #16a34a; }

  .kb-title-cell { font-weight: 600; cursor: pointer; }
  .kb-title-cell:hover { color: var(--accent); }
  .kb-slug { display: block; font-size: 0.7rem; color: var(--text-muted); font-weight: 400; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .kb-group-row td { background: var(--surface2); font-weight: 700; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }

  .kb-hint { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem; }
${KB_EDITOR_CSS}
`;

export const KB_MARKUP = `
      <!-- Help Center: help articles and the categories they are filed in -->
      <div id="page-kb" class="page hidden">
        <div class="card" style="margin-bottom:1rem">
          <div style="font-weight:700;margin-bottom:0.35rem">Help Center</div>
          <p class="text-muted" style="font-size:0.85rem;margin:0">
            Help articles for clients. An article stays a draft — invisible outside this page — until you publish it.
            File articles in categories to group them, and use ↑ / ↓ to set the order they are read in.
          </p>
          <p class="text-muted" style="font-size:0.85rem;margin:0.5rem 0 0">
            Not sure what to write next? <a href="#kb-searches">Help Insights</a> lists what clients looked for and could not find, and how the articles you have already published are landing.
          </p>
        </div>
        <div class="kb-cols">
          <div class="card">
            <div class="flex gap-2" style="align-items:center;margin-bottom:0.6rem">
              <div style="font-weight:700;flex:1">Categories</div>
              <button class="btn btn-sm" id="kb-cat-add">＋ Add</button>
            </div>
            <div id="kb-cat-list"></div>
          </div>
          <div class="card">
            <div class="kb-bar">
              <input type="search" class="kb-search" id="kb-search" placeholder="Search articles…" aria-label="Search articles">
              <button class="btn btn-primary btn-sm" id="kb-article-add">＋ New article</button>
              <span class="kb-count" id="kb-count"></span>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Article</th><th>Status</th><th>Updated</th><th style="width:1%"></th></tr></thead>
                <tbody id="kb-article-rows"><tr><td colspan="4" class="empty-state">Loading…</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
`;

/** Both modals live outside the page div, alongside the SPA's other backdrops. */
export const KB_MODALS = `
<div id="kb-cat-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:460px">
    <div class="modal-title" id="kb-cat-modal-title">New Category</div>
    <div id="kb-cat-modal-error" class="alert alert-error hidden"></div>
    <form id="kb-cat-form">
      <div class="form-group">
        <label>Title</label>
        <input id="kb-cat-title" required placeholder="Scheduling">
      </div>
      <div class="form-group">
        <label>Description <span class="text-muted" style="font-weight:400">(optional)</span></label>
        <input id="kb-cat-desc" placeholder="Booking, rescheduling and cancellations">
      </div>
      <div class="form-group" id="kb-cat-slug-group">
        <label>Web address</label>
        <input id="kb-cat-slug" placeholder="scheduling">
        <div class="kb-hint">Changing this breaks links clients may already have.</div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="kb-cat-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="kb-cat-submit">Create Category</button>
      </div>
    </form>
  </div>
</div>

<div id="kb-article-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:760px">
    <div class="modal-title" id="kb-article-modal-title">New Article</div>
    <div id="kb-article-modal-error" class="alert alert-error hidden"></div>
    <form id="kb-article-form">
      <div class="form-group">
        <label>Title</label>
        <input id="kb-article-title" required placeholder="How to reschedule a shoot">
      </div>
      <div class="flex gap-2" style="flex-wrap:wrap">
        <div class="form-group" style="flex:1 1 14rem">
          <label>Category</label>
          <select id="kb-article-category"><option value="">Unfiled</option></select>
        </div>
        <div class="form-group" style="flex:1 1 14rem">
          <label>Video link <span class="text-muted" style="font-weight:400">(optional)</span></label>
          <input id="kb-article-video" placeholder="https://…">
          <div class="kb-vid-preview" id="kb-video-preview"></div>
        </div>
      </div>
      <div class="form-group">
        <label>Summary <span class="text-muted" style="font-weight:400">(optional)</span></label>
        <input id="kb-article-summary" placeholder="One line shown under the title in the list">
      </div>
      <div class="form-group">
        <label>Article</label>
${KB_EDITOR_MARKUP}
      </div>
      <div class="form-group hidden" id="kb-article-slug-group">
        <label>Web address</label>
        <input id="kb-article-slug" placeholder="reschedule-a-shoot">
        <div class="kb-hint">Changing this breaks links clients may already have.</div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="kb-article-cancel">Cancel</button>
        <button type="submit" class="btn" id="kb-article-submit">Save Draft</button>
        <button type="button" class="btn btn-primary" id="kb-article-publish">Save &amp; Publish</button>
      </div>
    </form>
  </div>
</div>
`;

export const KB_COMPONENT_JS = `
${KB_EDITOR_JS}

  // ── Help Center ────────────────────────────────────────────────────────────
  var kbCategories = [];
  var kbArticles = [];
  var kbCategoryFilter = null;   // null = every category
  var kbSearchHits = null;       // article ids from the last search, or null
  var kbEditingCategoryId = null;
  var kbEditingArticleId = null;

  async function loadKb(){
    var r = await api('GET','/kb');
    if(!r.ok){ document.getElementById('kb-article-rows').innerHTML = '<tr><td colspan="4" class="empty-state">Could not load the Help Center.</td></tr>'; return; }
    kbCategories = (r.data && r.data.categories) || [];
    kbArticles = (r.data && r.data.articles) || [];
    renderKbCategories();
    renderKbArticles();
  }

  function kbCategoryById(id){
    for (var i=0;i<kbCategories.length;i++){ if(kbCategories[i].id === id) return kbCategories[i]; }
    return null;
  }

  function renderKbCategories(){
    var host = document.getElementById('kb-cat-list');
    var rows = ['<div class="kb-cat'+(kbCategoryFilter===null?' kb-cat-on':'')+'" data-id="">'+
      '<div class="kb-cat-main"><div class="kb-cat-title">All articles</div>'+
      '<div class="kb-cat-sub">'+kbArticles.length+' article'+(kbArticles.length===1?'':'s')+'</div></div></div>'];
    rows = rows.concat(kbCategories.map(function(c, i){
      var n = c.articleCount || 0;
      return '<div class="kb-cat'+(kbCategoryFilter===c.id?' kb-cat-on':'')+'" data-id="'+esc(c.id)+'">'+
        '<div class="kb-cat-main"><div class="kb-cat-title">'+esc(c.title)+'</div>'+
        '<div class="kb-cat-sub">'+n+' published'+(c.description?' · '+esc(c.description):'')+'</div></div>'+
        '<div class="kb-cat-acts">'+
          '<button class="btn btn-ghost btn-sm kb-cat-up" title="Move up"'+(i===0?' disabled':'')+'>↑</button>'+
          '<button class="btn btn-ghost btn-sm kb-cat-down" title="Move down"'+(i===kbCategories.length-1?' disabled':'')+'>↓</button>'+
          '<button class="btn btn-ghost btn-sm kb-cat-edit" title="Edit">✎</button>'+
          '<button class="btn btn-ghost btn-sm kb-cat-del" title="Delete">✕</button>'+
        '</div></div>';
    }));
    // The unfiled shelf only exists when something is on it.
    var unfiled = kbArticles.filter(function(a){ return !a.categoryId; }).length;
    if (unfiled) {
      rows.push('<div class="kb-cat'+(kbCategoryFilter==='__unfiled__'?' kb-cat-on':'')+'" data-id="__unfiled__">'+
        '<div class="kb-cat-main"><div class="kb-cat-title">Unfiled</div>'+
        '<div class="kb-cat-sub">'+unfiled+' article'+(unfiled===1?'':'s')+'</div></div></div>');
    }
    host.innerHTML = rows.join('');
    host.querySelectorAll('.kb-cat-main').forEach(function(el){
      el.addEventListener('click', function(){
        var id = el.closest('.kb-cat').getAttribute('data-id');
        kbCategoryFilter = id === '' ? null : id;
        renderKbCategories();
        renderKbArticles();
      });
    });
    host.querySelectorAll('.kb-cat-edit').forEach(function(b){ b.addEventListener('click', function(){ openKbCategoryModal(b.closest('.kb-cat').getAttribute('data-id')); }); });
    host.querySelectorAll('.kb-cat-del').forEach(function(b){ b.addEventListener('click', function(){ removeKbCategory(b.closest('.kb-cat').getAttribute('data-id')); }); });
    host.querySelectorAll('.kb-cat-up').forEach(function(b){ b.addEventListener('click', function(){ moveKbCategory(b.closest('.kb-cat').getAttribute('data-id'), -1); }); });
    host.querySelectorAll('.kb-cat-down').forEach(function(b){ b.addEventListener('click', function(){ moveKbCategory(b.closest('.kb-cat').getAttribute('data-id'), 1); }); });
  }

  /** Articles for the current filter, in the order the reader will see them. */
  function kbVisibleArticles(){
    var list = kbArticles.slice();
    if (kbSearchHits) {
      list = list.filter(function(a){ return kbSearchHits.indexOf(a.id) !== -1; });
      // Keep the server's ranking rather than re-sorting by category.
      list.sort(function(x, y){ return kbSearchHits.indexOf(x.id) - kbSearchHits.indexOf(y.id); });
      return list;
    }
    if (kbCategoryFilter === '__unfiled__') return list.filter(function(a){ return !a.categoryId; });
    if (kbCategoryFilter) return list.filter(function(a){ return a.categoryId === kbCategoryFilter; });
    // No filter: group by category in category order, unfiled last.
    var order = {};
    kbCategories.forEach(function(c, i){ order[c.id] = i; });
    return list.sort(function(x, y){
      var cx = x.categoryId ? order[x.categoryId] : 9999;
      var cy = y.categoryId ? order[y.categoryId] : 9999;
      if (cx !== cy) return cx - cy;
      return (x.sortOrder || 0) - (y.sortOrder || 0);
    });
  }

  function kbWhen(ts){
    if (!ts) return '—';
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  }

  function renderKbArticles(){
    var body = document.getElementById('kb-article-rows');
    var list = kbVisibleArticles();
    var count = document.getElementById('kb-count');
    var live = list.filter(function(a){ return a.status === 'published'; }).length;
    count.textContent = list.length ? list.length + ' article' + (list.length===1?'':'s') + ' · ' + live + ' published' : '';
    if(!list.length){
      body.innerHTML = '<tr><td colspan="4" class="empty-state">'+(kbSearchHits ? 'No articles match that search.' : 'No articles yet.')+'</td></tr>';
      return;
    }
    // Group headings only make sense when nothing is narrowing the list.
    var grouped = !kbSearchHits && !kbCategoryFilter;
    var lastGroup = null;
    var html = '';
    list.forEach(function(a, i){
      if (grouped) {
        var name = a.categoryId ? (kbCategoryById(a.categoryId) || {}).title || 'Unfiled' : 'Unfiled';
        if (name !== lastGroup) {
          lastGroup = name;
          html += '<tr class="kb-group-row"><td colspan="4">'+esc(name)+'</td></tr>';
        }
      }
      var prev = list[i-1];
      var next = list[i+1];
      var sameGroup = function(other){ return other && (other.categoryId || null) === (a.categoryId || null); };
      html += '<tr data-id="'+esc(a.id)+'">'+
        '<td><span class="kb-title-cell kb-open">'+esc(a.title)+'</span>'+
          (a.summary ? '<span class="kb-slug" style="font-family:inherit">'+esc(a.summary)+'</span>' : '')+
          '<span class="kb-slug">/'+esc(a.slug)+'</span></td>'+
        '<td>'+(a.status === 'published'
          ? '<span class="kb-chip kb-chip-live">Published</span>'
          : '<span class="kb-chip kb-chip-draft">Draft</span>')+'</td>'+
        '<td style="font-size:0.8rem;white-space:nowrap">'+kbWhen(a.updatedAt)+'</td>'+
        '<td style="white-space:nowrap">'+
          // Only a published article has a public page to look at.
          (a.status === 'published'
            ? '<a class="btn btn-ghost btn-sm kb-view" href="/help/'+esc(a.slug)+'" target="_blank" rel="noopener" title="Open the public page">View</a> '
            : '')+
          '<button class="btn btn-ghost btn-sm kb-up" title="Move up"'+(sameGroup(prev)?'':' disabled')+'>↑</button> '+
          '<button class="btn btn-ghost btn-sm kb-down" title="Move down"'+(sameGroup(next)?'':' disabled')+'>↓</button> '+
          '<button class="btn btn-sm kb-pub">'+(a.status === 'published' ? 'Unpublish' : 'Publish')+'</button> '+
          '<button class="btn btn-ghost btn-sm kb-del" title="Delete">✕</button>'+
        '</td>'+
        '</tr>';
    });
    body.innerHTML = html;
    body.querySelectorAll('.kb-open').forEach(function(el){ el.addEventListener('click', function(){ openKbArticleModal(el.closest('tr').getAttribute('data-id')); }); });
    body.querySelectorAll('.kb-pub').forEach(function(b){ b.addEventListener('click', function(){ toggleKbPublish(b.closest('tr').getAttribute('data-id')); }); });
    body.querySelectorAll('.kb-del').forEach(function(b){ b.addEventListener('click', function(){ removeKbArticle(b.closest('tr').getAttribute('data-id')); }); });
    body.querySelectorAll('.kb-up').forEach(function(b){ b.addEventListener('click', function(){ moveKbArticle(b.closest('tr').getAttribute('data-id'), -1); }); });
    body.querySelectorAll('.kb-down').forEach(function(b){ b.addEventListener('click', function(){ moveKbArticle(b.closest('tr').getAttribute('data-id'), 1); }); });
  }

  // ── Category editing ──────────────────────────────────────────────────────

  function openKbCategoryModal(id){
    var c = id ? kbCategoryById(id) : null;
    kbEditingCategoryId = c ? c.id : null;
    document.getElementById('kb-cat-modal-title').textContent = c ? 'Edit Category' : 'New Category';
    document.getElementById('kb-cat-title').value = c ? c.title : '';
    document.getElementById('kb-cat-desc').value = (c && c.description) || '';
    document.getElementById('kb-cat-slug').value = c ? c.slug : '';
    // A slug is derived from the title on create; it is only editable once it exists.
    document.getElementById('kb-cat-slug-group').classList.toggle('hidden', !c);
    document.getElementById('kb-cat-submit').textContent = c ? 'Save Changes' : 'Create Category';
    document.getElementById('kb-cat-modal-error').classList.add('hidden');
    document.getElementById('kb-cat-modal').classList.remove('hidden');
  }

  function closeKbCategoryModal(){ document.getElementById('kb-cat-modal').classList.add('hidden'); }

  async function saveKbCategory(){
    var payload = {
      title: document.getElementById('kb-cat-title').value.trim(),
      description: document.getElementById('kb-cat-desc').value.trim()
    };
    if (kbEditingCategoryId) payload.slug = document.getElementById('kb-cat-slug').value.trim();
    if (!payload.title) { kbCategoryError('A title is required.'); return; }
    var r = kbEditingCategoryId
      ? await api('PUT','/kb/categories/'+encodeURIComponent(kbEditingCategoryId), payload)
      : await api('POST','/kb/categories', payload);
    if(!r.ok){ kbCategoryError((r.data && r.data.error) || 'Could not save the category.'); return; }
    closeKbCategoryModal();
    await loadKb();
  }

  function kbCategoryError(msg){
    var el = document.getElementById('kb-cat-modal-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  async function removeKbCategory(id){
    var c = kbCategoryById(id);
    if (!c) return;
    var filed = kbArticles.filter(function(a){ return a.categoryId === id; }).length;
    var warning = filed
      ? '\\n\\n' + filed + ' article' + (filed===1?'':'s') + ' filed here will become Unfiled. Nothing is deleted with it.'
      : '';
    if (!confirm('Delete the category "' + c.title + '"?' + warning)) return;
    var r = await api('DELETE','/kb/categories/'+encodeURIComponent(id));
    if(!r.ok){ alert((r.data && r.data.error) || 'Could not delete the category.'); return; }
    if (kbCategoryFilter === id) kbCategoryFilter = null;
    await loadKb();
  }

  // Send the whole order, not "move this one" — the server rewrites every
  // sort_order from it, so two people reordering cannot leave a tie behind.
  async function moveKbCategory(id, delta){
    var ids = kbCategories.map(function(c){ return c.id; });
    var from = ids.indexOf(id);
    var to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    var r = await api('PUT','/kb/categories/reorder',{ids:ids});
    if(!r.ok){ alert((r.data && r.data.error) || 'Could not reorder.'); return; }
    kbCategories = (r.data && r.data.categories) || kbCategories;
    kbArticles = (r.data && r.data.articles) || kbArticles;
    renderKbCategories();
    renderKbArticles();
  }

  // ── Article editing ───────────────────────────────────────────────────────

  function openKbArticleModal(id){
    var a = null;
    for (var i=0;i<kbArticles.length;i++){ if(kbArticles[i].id === id) a = kbArticles[i]; }
    kbEditingArticleId = a ? a.id : null;
    document.getElementById('kb-article-modal-title').textContent = a ? 'Edit Article' : 'New Article';
    document.getElementById('kb-article-title').value = a ? a.title : '';
    document.getElementById('kb-article-summary').value = (a && a.summary) || '';
    document.getElementById('kb-article-video').value = (a && a.videoUrl) || '';
    kbLoadEditor((a && a.bodyMd) || '');
    document.getElementById('kb-article-slug').value = a ? a.slug : '';
    document.getElementById('kb-article-slug-group').classList.toggle('hidden', !a);
    var sel = document.getElementById('kb-article-category');
    sel.innerHTML = '<option value="">Unfiled</option>' + kbCategories.map(function(c){
      return '<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>';
    }).join('');
    // A new article lands in whichever category is being looked at.
    var wanted = a ? (a.categoryId || '') : (kbCategoryFilter && kbCategoryFilter !== '__unfiled__' ? kbCategoryFilter : '');
    sel.value = wanted || '';
    document.getElementById('kb-article-submit').textContent = a ? 'Save' : 'Save Draft';
    var pub = document.getElementById('kb-article-publish');
    pub.textContent = a && a.status === 'published' ? 'Save & Unpublish' : 'Save & Publish';
    document.getElementById('kb-article-modal-error').classList.add('hidden');
    document.getElementById('kb-article-modal').classList.remove('hidden');
  }

  function closeKbArticleModal(){ document.getElementById('kb-article-modal').classList.add('hidden'); }

  function kbArticleError(msg){
    var el = document.getElementById('kb-article-modal-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  /** andPublish flips the published state after the save, not instead of it. */
  async function saveKbArticle(andPublish){
    var payload = {
      title: document.getElementById('kb-article-title').value.trim(),
      summary: document.getElementById('kb-article-summary').value.trim(),
      bodyMd: kbReadEditor(),
      videoUrl: document.getElementById('kb-article-video').value.trim(),
      categoryId: document.getElementById('kb-article-category').value || null
    };
    if (kbEditingArticleId) payload.slug = document.getElementById('kb-article-slug').value.trim();
    if (!payload.title) { kbArticleError('A title is required.'); return; }
    var r = kbEditingArticleId
      ? await api('PUT','/kb/articles/'+encodeURIComponent(kbEditingArticleId), payload)
      : await api('POST','/kb/articles', payload);
    if(!r.ok){ kbArticleError((r.data && r.data.error) || 'Could not save the article.'); return; }
    var saved = r.data && r.data.article;
    if (andPublish && saved) {
      var verb = saved.status === 'published' ? 'unpublish' : 'publish';
      var p = await api('POST','/kb/articles/'+encodeURIComponent(saved.id)+'/'+verb);
      // The text is saved either way; say so rather than implying it was lost.
      if(!p.ok){ kbArticleError('Saved, but could not ' + verb + ' it.'); await loadKb(); return; }
    }
    closeKbArticleModal();
    await loadKb();
  }

  async function toggleKbPublish(id){
    var a = null;
    for (var i=0;i<kbArticles.length;i++){ if(kbArticles[i].id === id) a = kbArticles[i]; }
    if (!a) return;
    var verb = a.status === 'published' ? 'unpublish' : 'publish';
    var r = await api('POST','/kb/articles/'+encodeURIComponent(id)+'/'+verb);
    if(!r.ok){ alert((r.data && r.data.error) || 'Could not change the status.'); return; }
    await loadKb();
  }

  async function removeKbArticle(id){
    var a = null;
    for (var i=0;i<kbArticles.length;i++){ if(kbArticles[i].id === id) a = kbArticles[i]; }
    if (!a) return;
    if (!confirm('Delete "' + a.title + '"?\\n\\nThis cannot be undone.')) return;
    var r = await api('DELETE','/kb/articles/'+encodeURIComponent(id));
    if(!r.ok){ alert((r.data && r.data.error) || 'Could not delete the article.'); return; }
    await loadKb();
  }

  async function moveKbArticle(id, delta){
    var a = null;
    for (var i=0;i<kbArticles.length;i++){ if(kbArticles[i].id === id) a = kbArticles[i]; }
    if (!a) return;
    // Order is per category, so only its shelf-mates take part.
    var siblings = kbArticles.filter(function(x){ return (x.categoryId || null) === (a.categoryId || null); })
      .sort(function(x, y){ return (x.sortOrder || 0) - (y.sortOrder || 0); });
    var ids = siblings.map(function(x){ return x.id; });
    var from = ids.indexOf(id);
    var to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    var r = await api('PUT','/kb/articles/reorder',{categoryId: a.categoryId || null, ids: ids});
    if(!r.ok){ alert((r.data && r.data.error) || 'Could not reorder.'); return; }
    kbCategories = (r.data && r.data.categories) || kbCategories;
    kbArticles = (r.data && r.data.articles) || kbArticles;
    renderKbCategories();
    renderKbArticles();
  }

  // ── Search ────────────────────────────────────────────────────────────────

  var kbSearchTimer = null;
  function kbQueueSearch(){
    if (kbSearchTimer) clearTimeout(kbSearchTimer);
    kbSearchTimer = setTimeout(runKbSearch, 200);
  }

  async function runKbSearch(){
    var q = document.getElementById('kb-search').value.trim();
    if (!q) { kbSearchHits = null; renderKbArticles(); return; }
    // Server-side, so the authoring list searches article bodies the same way
    // a client will — including the drafts only this page can see.
    var r = await api('GET','/kb/search?q='+encodeURIComponent(q));
    if(!r.ok){ return; }
    kbSearchHits = ((r.data && r.data.articles) || []).map(function(a){ return a.id; });
    renderKbArticles();
  }

  document.getElementById('kb-cat-add').addEventListener('click', function(){ openKbCategoryModal(null); });
  document.getElementById('kb-cat-cancel').addEventListener('click', closeKbCategoryModal);
  document.getElementById('kb-cat-form').addEventListener('submit', function(e){ e.preventDefault(); saveKbCategory(); });
  document.getElementById('kb-article-add').addEventListener('click', function(){ openKbArticleModal(null); });
  document.getElementById('kb-article-cancel').addEventListener('click', closeKbArticleModal);
  document.getElementById('kb-article-form').addEventListener('submit', function(e){ e.preventDefault(); saveKbArticle(false); });
  document.getElementById('kb-article-publish').addEventListener('click', function(){ saveKbArticle(true); });
  document.getElementById('kb-search').addEventListener('input', kbQueueSearch);
  wireKbEditor();
`;
