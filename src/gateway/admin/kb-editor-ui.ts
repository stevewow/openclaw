// The rich-text editor behind the Hub's article body, plus the video preview
// that sits above it.
//
// Staff write help articles; they do not write markdown. The editor is a
// contenteditable surface driven by a toolbar, but the STORAGE FORMAT IS STILL
// MARKDOWN — the public reader, the FTS5 index and every existing test keep
// working untouched. Markdown is converted to HTML when the modal opens and
// back to markdown when it saves.
//
// The supported subset is deliberately small (h2, h3, bold, italic, ordered and
// unordered lists, links, blockquote) because both directions of the conversion
// have to agree. Widening it means widening BOTH `kbMdToHtml` and `kbHtmlToMd`
// and pinning the round trip with a test — a tag only one side knows about is
// how a staffer's formatting silently disappears on save.
//
// Split out of kb-ui.ts, which was already near the size where this stops being
// readable. Exported as strings and interpolated into the admin SPA the same way.

export const KB_EDITOR_CSS = `
  .kb-editor-wrap { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); overflow: hidden; }
  .kb-editor-wrap:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.09); }

  .kb-toolbar { display: flex; align-items: center; gap: 0.15rem; flex-wrap: wrap; padding: 0.3rem 0.35rem; border-bottom: 1px solid var(--border); background: var(--surface2); }
  .kb-tool { flex: none; min-width: 1.85rem; height: 1.85rem; padding: 0 0.45rem; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: var(--radius); background: none; color: var(--text); font-family: inherit; font-size: 0.82rem; font-weight: 600; line-height: 1; cursor: pointer; }
  .kb-tool:hover { background: var(--surface); border-color: var(--border); }
  .kb-tool.kb-tool-on { background: var(--surface); border-color: var(--accent); color: var(--accent); }
  .kb-tool-sep { flex: none; width: 1px; height: 1.15rem; margin: 0 0.25rem; background: var(--border); }

  /* Matches .kb-body-input's old height so the modal does not jump. */
  .kb-editor { min-height: 18rem; max-height: 30rem; overflow-y: auto; padding: 0.7rem 0.8rem; font-size: 0.88rem; line-height: 1.6; color: var(--text); }
  .kb-editor:focus { outline: none; }
  .kb-editor > :first-child { margin-top: 0; }
  .kb-editor h2 { font-size: 1.08rem; margin: 1.1rem 0 0.45rem; }
  .kb-editor h3 { font-size: 0.95rem; margin: 1rem 0 0.4rem; }
  .kb-editor p { margin: 0 0 0.75rem; }
  .kb-editor ul, .kb-editor ol { margin: 0 0 0.75rem; padding-left: 1.4rem; }
  .kb-editor li { margin: 0 0 0.25rem; }
  .kb-editor a { color: var(--accent); font-weight: 600; }
  .kb-editor blockquote { margin: 0 0 0.75rem; padding: 0.1rem 0 0.1rem 0.8rem; border-left: 3px solid var(--border); color: var(--text-muted); }
  .kb-editor:empty::before { content: attr(data-placeholder); color: var(--text-muted); }

  /* The preview proves the link resolved to a real player before publishing. */
  .kb-vid-preview { margin-top: 0.4rem; }
  .kb-vid-frame { position: relative; padding-top: 56.25%; border-radius: var(--radius); overflow: hidden; background: #000; }
  .kb-vid-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .kb-vid-note { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem; }
  .kb-vid-note.kb-vid-bad { color: var(--accent); }
`;

/** The toolbar and the surface. `kb-article-body-md` stays as the hidden markdown field. */
export const KB_EDITOR_MARKUP = `
        <div class="kb-editor-wrap">
          <div class="kb-toolbar" id="kb-toolbar">
            <button type="button" class="kb-tool" data-kbcmd="h2" title="Heading">H1</button>
            <button type="button" class="kb-tool" data-kbcmd="h3" title="Smaller heading">H2</button>
            <span class="kb-tool-sep"></span>
            <button type="button" class="kb-tool" data-kbcmd="bold" title="Bold" style="font-weight:800">B</button>
            <button type="button" class="kb-tool" data-kbcmd="italic" title="Italic" style="font-style:italic">I</button>
            <span class="kb-tool-sep"></span>
            <button type="button" class="kb-tool" data-kbcmd="ol" title="Numbered steps">1.</button>
            <button type="button" class="kb-tool" data-kbcmd="ul" title="Bullet list">&bull;</button>
            <span class="kb-tool-sep"></span>
            <button type="button" class="kb-tool" data-kbcmd="link" title="Link">Link</button>
            <button type="button" class="kb-tool" data-kbcmd="quote" title="Quote">&ldquo;</button>
            <button type="button" class="kb-tool" data-kbcmd="clear" title="Remove formatting">Clear</button>
          </div>
          <div id="kb-article-body" class="kb-editor" contenteditable="true"
               data-placeholder="Write the article here. Use the buttons above to add headings and numbered steps."></div>
        </div>
        <textarea id="kb-article-body-md" class="hidden"></textarea>
`;

export const KB_EDITOR_JS = `
  // ── Markdown <-> HTML for the article body ────────────────────────────────
  // Both directions cover the same subset. See kb-editor-ui.ts before widening.

  function kbEscHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /** Inline markdown -> HTML. Links first so emphasis cannot eat the URL. */
  function kbInlineToHtml(text){
    var out = kbEscHtml(text);
    // The address may itself contain a balanced pair, as javascript:alert(1)
    // does, so stopping at the first ')' would leave a stray one behind.
    out = out.replace(/\\[([^\\]]+)\\]\\(((?:[^()\\s]|\\([^()\\s]*\\))+)\\)/g, function(m, label, href){
      // Only http(s) survives; a javascript: link is left as plain text.
      if(!/^https?:\\/\\//i.test(href)) return kbEscHtml(label);
      return '<a href="' + href + '">' + label + '</a>';
    });
    out = out.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\\*([^*]+)\\*/g, '$1<em>$2</em>');
    return out;
  }

  function kbMdToHtml(md){
    var lines = String(md == null ? '' : md).replace(/\\r\\n?/g, '\\n').split('\\n');
    var html = [];
    var listType = null;
    var para = [];

    function flushPara(){
      if(!para.length) return;
      html.push('<p>' + kbInlineToHtml(para.join(' ')) + '</p>');
      para = [];
    }
    function flushList(){
      if(!listType) return;
      html.push('</' + listType + '>');
      listType = null;
    }
    function openList(kind){
      if(listType === kind) return;
      flushList();
      html.push('<' + kind + '>');
      listType = kind;
    }

    for(var i=0;i<lines.length;i++){
      var line = lines[i];
      var trimmed = line.trim();
      if(!trimmed){ flushPara(); flushList(); continue; }

      var h = /^(#{1,6})\\s+(.*)$/.exec(trimmed);
      if(h){
        flushPara(); flushList();
        // Everything h1..h3 and deeper collapses into the two sizes the
        // toolbar can produce, so a round trip cannot invent a level.
        var tag = h[1].length <= 2 ? 'h2' : 'h3';
        html.push('<' + tag + '>' + kbInlineToHtml(h[2].trim()) + '</' + tag + '>');
        continue;
      }

      var ol = /^\\d+[.)]\\s+(.*)$/.exec(trimmed);
      if(ol){
        flushPara(); openList('ol');
        html.push('<li>' + kbInlineToHtml(ol[1]) + '</li>');
        continue;
      }

      var ul = /^[-*+]\\s+(.*)$/.exec(trimmed);
      if(ul){
        flushPara(); openList('ul');
        html.push('<li>' + kbInlineToHtml(ul[1]) + '</li>');
        continue;
      }

      var bq = /^>\\s?(.*)$/.exec(trimmed);
      if(bq){
        flushPara(); flushList();
        html.push('<blockquote>' + kbInlineToHtml(bq[1]) + '</blockquote>');
        continue;
      }

      flushList();
      para.push(trimmed);
    }
    flushPara(); flushList();
    return html.join('');
  }

  /** Escapes the characters that would otherwise be read back as syntax. */
  function kbEscMd(text){
    return String(text).replace(/([\\\\*_\\[\\]])/g, '\\\\$1');
  }

  function kbInlineToMd(node){
    var out = '';
    for(var i=0;i<node.childNodes.length;i++){
      var n = node.childNodes[i];
      if(n.nodeType === 3){ out += kbEscMd(n.nodeValue); continue; }
      if(n.nodeType !== 1) continue;
      var tag = n.tagName.toLowerCase();
      var inner = kbInlineToMd(n);
      if(tag === 'strong' || tag === 'b'){ out += inner.trim() ? '**' + inner + '**' : ''; }
      else if(tag === 'em' || tag === 'i'){ out += inner.trim() ? '*' + inner + '*' : ''; }
      else if(tag === 'a'){
        var href = n.getAttribute('href') || '';
        out += /^https?:\\/\\//i.test(href) ? '[' + inner + '](' + href + ')' : inner;
      }
      else if(tag === 'br'){ out += ' '; }
      else { out += inner; }
    }
    return out;
  }

  function kbHtmlToMd(root){
    var blocks = [];
    function walk(parent){
      for(var i=0;i<parent.childNodes.length;i++){
        var n = parent.childNodes[i];
        if(n.nodeType === 3){
          var t = n.nodeValue.trim();
          if(t) blocks.push(kbEscMd(t));
          continue;
        }
        if(n.nodeType !== 1) continue;
        var tag = n.tagName.toLowerCase();
        if(tag === 'h1' || tag === 'h2'){ blocks.push('## ' + kbInlineToMd(n).trim()); }
        else if(tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6'){ blocks.push('### ' + kbInlineToMd(n).trim()); }
        else if(tag === 'ul' || tag === 'ol'){
          var items = n.querySelectorAll(':scope > li');
          var out = [];
          for(var j=0;j<items.length;j++){
            var text = kbInlineToMd(items[j]).trim();
            if(text) out.push(tag === 'ol' ? (out.length + 1) + '. ' + text : '- ' + text);
          }
          if(out.length) blocks.push(out.join('\\n'));
        }
        else if(tag === 'blockquote'){
          var q = kbInlineToMd(n).trim();
          if(q) blocks.push('> ' + q);
        }
        else if(tag === 'p' || tag === 'div'){
          var p = kbInlineToMd(n).trim();
          if(p) blocks.push(p);
        }
        else if(tag === 'br'){ /* a bare break between blocks carries nothing */ }
        else { walk(n); }
      }
    }
    walk(root);
    return blocks.join('\\n\\n').replace(/\\n{3,}/g, '\\n\\n').trim();
  }

  // ── Video preview ─────────────────────────────────────────────────────────
  // Mirrors videoEmbedUrl() in kb-public-html.ts. kb-editor.test.ts pins the two
  // against the same table of URLs, so the preview cannot promise a player the
  // reader will not build.

  function kbVideoEmbedUrl(raw){
    var url;
    try { url = new URL(raw); } catch(e) { return null; }
    if(url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    var host = url.hostname.replace(/^www\\./, '');
    if(host === 'youtube.com' || host === 'm.youtube.com'){
      var id = url.searchParams.get('v');
      return id ? 'https://www.youtube.com/embed/' + encodeURIComponent(id) : null;
    }
    if(host === 'youtu.be'){
      var short = url.pathname.slice(1);
      return short ? 'https://www.youtube.com/embed/' + encodeURIComponent(short) : null;
    }
    if(host === 'vimeo.com'){
      var parts = url.pathname.split('/');
      var vid = null;
      for(var i=0;i<parts.length;i++){ if(parts[i]){ vid = parts[i]; break; } }
      return vid && /^\\d+$/.test(vid) ? 'https://player.vimeo.com/video/' + vid : null;
    }
    return null;
  }

  function renderKbVideoPreview(){
    var box = document.getElementById('kb-video-preview');
    if(!box) return;
    var raw = (document.getElementById('kb-article-video').value || '').trim();
    if(!raw){ box.innerHTML = ''; return; }
    var embed = kbVideoEmbedUrl(raw);
    if(embed){
      // referrerpolicy matches the public article page: the Hub also sends a
      // no-referrer policy, and without a referring origin YouTube answers
      // with "Error 153 Video player configuration error". No backticks in
      // this comment: the whole module is one template literal.
      box.innerHTML = '<div class="kb-vid-frame"><iframe src="' + esc(embed) +
        '" title="Video preview" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe></div>' +
        '<div class="kb-vid-note">This player appears at the top of the article.</div>';
      return;
    }
    // Say which of the two outcomes this link gets, rather than failing silently.
    var known = /^https?:\\/\\//i.test(raw);
    box.innerHTML = '<div class="kb-vid-note kb-vid-bad">' + (known
      ? 'No player for this link — clients will see a &ldquo;Watch the video&rdquo; link instead.'
      : 'That does not look like a web address. Paste the full https:// link.') + '</div>';
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────

  function kbEditorEl(){ return document.getElementById('kb-article-body'); }

  function kbExec(cmd, arg){
    var el = kbEditorEl();
    if(el) el.focus();
    try { document.execCommand(cmd, false, arg); } catch(e) { /* unsupported: leave the text alone */ }
    kbSyncToolbar();
  }

  /** Toggling a block back off returns it to a paragraph rather than nesting. */
  function kbToggleBlock(tag){
    var isOn = false;
    try { isOn = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g,'') === tag; } catch(e) {}
    kbExec('formatBlock', isOn ? 'p' : tag);
  }

  function kbRunTool(cmd){
    if(cmd === 'h2' || cmd === 'h3'){ kbToggleBlock(cmd); return; }
    if(cmd === 'bold' || cmd === 'italic'){ kbExec(cmd); return; }
    if(cmd === 'ol'){ kbExec('insertOrderedList'); return; }
    if(cmd === 'ul'){ kbExec('insertUnorderedList'); return; }
    if(cmd === 'quote'){ kbToggleBlock('blockquote'); return; }
    if(cmd === 'clear'){ kbExec('removeFormat'); return; }
    if(cmd === 'link'){
      var current = '';
      try { current = document.queryCommandValue('createLink') || ''; } catch(e) {}
      var href = prompt('Link address', current || 'https://');
      if(href === null) return;
      href = href.trim();
      if(!href){ kbExec('unlink'); return; }
      // Refused here as well as at the route: a javascript: href typed into the
      // editor would run against the Hub session, not the reader.
      if(!/^https?:\\/\\//i.test(href)){ alert('Links must start with http:// or https://'); return; }
      kbExec('createLink', href);
    }
  }

  function kbSyncToolbar(){
    var bar = document.getElementById('kb-toolbar');
    if(!bar) return;
    var block = '';
    try { block = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g,''); } catch(e) {}
    var states = { bold: false, italic: false, ol: false, ul: false };
    try {
      states.bold = document.queryCommandState('bold');
      states.italic = document.queryCommandState('italic');
      states.ol = document.queryCommandState('insertOrderedList');
      states.ul = document.queryCommandState('insertUnorderedList');
    } catch(e) {}
    var tools = bar.querySelectorAll('.kb-tool');
    for(var i=0;i<tools.length;i++){
      var cmd = tools[i].getAttribute('data-kbcmd');
      var on = cmd === 'h2' ? block === 'h2'
        : cmd === 'h3' ? block === 'h3'
        : cmd === 'quote' ? block === 'blockquote'
        : cmd === 'bold' ? states.bold
        : cmd === 'italic' ? states.italic
        : cmd === 'ol' ? states.ol
        : cmd === 'ul' ? states.ul
        : false;
      tools[i].classList.toggle('kb-tool-on', !!on);
    }
  }

  /** Called by the modal on open; returns the body to markdown on save. */
  function kbLoadEditor(md){
    var el = kbEditorEl();
    if(el) el.innerHTML = kbMdToHtml(md);
    renderKbVideoPreview();
    kbSyncToolbar();
  }

  function kbReadEditor(){
    var el = kbEditorEl();
    return el ? kbHtmlToMd(el) : '';
  }

  function wireKbEditor(){
    var bar = document.getElementById('kb-toolbar');
    if(bar){
      bar.addEventListener('mousedown', function(e){
        // Keep the selection: the button must not steal focus before the command.
        var btn = e.target.closest ? e.target.closest('.kb-tool') : null;
        if(btn) e.preventDefault();
      });
      bar.addEventListener('click', function(e){
        var btn = e.target.closest ? e.target.closest('.kb-tool') : null;
        if(!btn) return;
        e.preventDefault();
        kbRunTool(btn.getAttribute('data-kbcmd'));
      });
    }
    var el = kbEditorEl();
    if(el){
      // Paste as plain text: pasted markup would carry styling and tags that
      // neither converter knows, and the round trip would drop them anyway.
      el.addEventListener('paste', function(e){
        if(!e.clipboardData) return;
        e.preventDefault();
        var text = e.clipboardData.getData('text/plain') || '';
        try { document.execCommand('insertText', false, text); } catch(err) {}
      });
      el.addEventListener('keyup', kbSyncToolbar);
      el.addEventListener('mouseup', kbSyncToolbar);
    }
    var vid = document.getElementById('kb-article-video');
    if(vid){
      vid.addEventListener('input', renderKbVideoPreview);
      vid.addEventListener('change', renderKbVideoPreview);
    }
  }
`;
