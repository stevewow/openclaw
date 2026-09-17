// The sales coach: a full page for a working session, and a box that hovers
// over every other page in the Hub.
//
// One component, two mounts, because they are the same conversation. The moment
// someone needs a script is the moment they are already looking at a lead, an
// order or a past-due account — so the launcher sits on every page and the
// thread survives being opened from anywhere.
//
// The markup lives OUTSIDE `<main>` on both surfaces. `navigate()` hides
// everything matching `.page`, so a widget mounted inside one would vanish the
// first time someone changed page.
//
// Answers come back as markdown and are rendered with `kbMdToHtml`, the same
// renderer the guide page uses — a drafted email has headings and lists in it,
// and showing them as literal asterisks would make it useless to copy.

import { infoTip } from "./info-tip.js";

export const COACH_CSS = `
  /* ── The launcher and the panel ─────────────────────────────────────────
     z-index 70/71: above the page, below the modal backdrop's 100, so a modal
     opened from underneath still covers it. */
  .coach-launch { position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 70; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.6rem 1rem; border: 1px solid var(--border); border-radius: var(--radius-pill); background: var(--sidebar-bg); color: #fff; box-shadow: var(--shadow-lg); cursor: pointer; font: inherit; font-size: 0.85rem; font-weight: 600; }
  .coach-launch:hover { background: #3a3a3a; }
  .coach-launch .coach-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex: none; }
  .coach-launch[hidden] { display: none; }

  .coach-panel { position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 71; width: min(26rem, calc(100vw - 2.5rem)); max-height: min(38rem, calc(100vh - 3rem)); display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); overflow: hidden; }
  .coach-panel[hidden] { display: none; }
  .coach-head { display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 0.9rem; border-bottom: 1px solid var(--hairline); background: var(--surface2); }
  .coach-head-title { font-weight: 700; font-size: 0.88rem; flex: 1; min-width: 0; }
  .coach-head button { border: none; background: none; color: var(--text-muted); cursor: pointer; font: inherit; font-size: 1rem; line-height: 1; padding: 0.2rem 0.35rem; border-radius: var(--radius-sm); }
  .coach-head button:hover { background: var(--surface); color: var(--text); }

  .coach-log { flex: 1; overflow-y: auto; padding: 0.9rem; display: flex; flex-direction: column; gap: 0.7rem; }
  .coach-msg { max-width: 92%; font-size: 0.85rem; line-height: 1.55; }
  .coach-you { align-self: flex-end; background: var(--sidebar-bg); color: #fff; padding: 0.5rem 0.75rem; border-radius: var(--radius) var(--radius) 0.25rem var(--radius); }
  .coach-them { align-self: flex-start; background: var(--surface2); border: 1px solid var(--hairline); color: var(--text); padding: 0.6rem 0.8rem; border-radius: var(--radius) var(--radius) var(--radius) 0.25rem; }
  .coach-them p { margin: 0 0 0.55rem; }
  .coach-them p:last-child { margin-bottom: 0; }
  .coach-them ul, .coach-them ol { margin: 0 0 0.55rem 1.1rem; }
  .coach-them li { margin-bottom: 0.15rem; }
  .coach-them h2, .coach-them h3 { font-size: 0.88rem; margin: 0.7rem 0 0.3rem; }
  .coach-them table { border-collapse: collapse; margin: 0 0 0.55rem; font-size: 0.8rem; }
  .coach-them th, .coach-them td { border: 1px solid var(--hairline); padding: 0.25rem 0.5rem; text-align: left; }
  .coach-them blockquote { margin: 0 0 0.55rem; padding-left: 0.6rem; border-left: 2px solid var(--border); color: var(--text-muted); }

  .coach-foot { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
  .coach-copy { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; font: inherit; font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.55rem; border-radius: var(--radius-sm); }
  .coach-copy:hover { color: var(--text); border-color: var(--text-muted); }
  .coach-cites { font-size: 0.72rem; color: var(--text-muted); }
  .coach-cites a { color: var(--accent-ink); }

  .coach-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .coach-chip { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; font: inherit; font-size: 0.76rem; padding: 0.3rem 0.6rem; border-radius: var(--radius-pill); text-align: left; }
  .coach-chip:hover { color: var(--text); border-color: var(--text-muted); }

  .coach-compose { display: flex; gap: 0.5rem; align-items: flex-end; padding: 0.7rem 0.9rem; border-top: 1px solid var(--hairline); }
  .coach-compose textarea { flex: 1; min-height: 2.4rem; max-height: 8rem; padding: 0.45rem 0.6rem; font: inherit; font-size: 0.85rem; line-height: 1.45; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); resize: none; }
  .coach-compose textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  .coach-compose .btn { width: auto; flex: none; }
  .coach-note { padding: 0 0.9rem 0.7rem; font-size: 0.74rem; color: var(--text-muted); }

  /* ── The full page ─────────────────────────────────────────────────────── */
  .coach-page { display: flex; flex-direction: column; height: 100%; min-height: 26rem; }
  .coach-page .coach-log { border: 1px solid var(--hairline); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); max-height: none; }
  .coach-page .coach-msg { max-width: 46rem; }
  .coach-page .coach-compose { border: none; padding: 0.7rem 0; }

  @media print { .coach-launch, .coach-panel { display: none !important; } }
`;

const COACH_ABOUT = infoTip(
  `<p>Ask it what to say. It answers only from the <a href="#guide">Sales Guide</a> — our products,
     pricing, positioning and the call scripts — and quotes that wording back rather than inventing
     its own.</p>
   <p>It does not know who you are talking about: tell it the situation and it will work from that.
     It never sends anything to a client; what it writes is yours to copy and check.</p>`,
  { label: "About the sales coach" },
);

/** The four things people open it for, so the first question costs no typing. */
const CHIPS = [
  "Write an outreach script for a new lead",
  "How do I handle “I already use someone else”?",
  "Draft a follow-up email after a delivery",
  "What should I recommend for a 4,000 sq ft listing?",
];

function chipsMarkup(): string {
  return CHIPS.map(
    (c) =>
      `<button type="button" class="coach-chip" data-coach-chip="${c.replace(/"/g, "&quot;")}">${c}</button>`,
  ).join("");
}

/** The hovering box. Mounted once per surface, outside `<main>`. */
export const COACH_WIDGET_MARKUP = `
<button type="button" class="coach-launch" id="coach-launch" aria-expanded="false" aria-controls="coach-panel" hidden>
  <span class="coach-dot" aria-hidden="true"></span>Sales coach
</button>
<div class="coach-panel" id="coach-panel" role="dialog" aria-label="Sales coach" hidden>
  <div class="coach-head">
    <span class="coach-head-title">Sales coach</span>
    <button type="button" id="coach-full" title="Open the full page">⤢</button>
    <button type="button" id="coach-close" title="Close" aria-label="Close">✕</button>
  </div>
  <div class="coach-log" id="coach-log" aria-live="polite"></div>
  <div class="coach-compose">
    <textarea id="coach-input" rows="1" placeholder="What do you need to say?" aria-label="Ask the sales coach"></textarea>
    <button type="button" class="btn btn-primary btn-sm" id="coach-send">Ask</button>
  </div>
</div>`;

function coachPageMarkup(): string {
  return `
        <div class="card" style="margin-bottom:1rem">
          <div style="font-weight:700">Sales Coach${COACH_ABOUT}</div>
          <p class="coach-note" id="coach-page-note" style="padding:0.35rem 0 0"></p>
        </div>
        <div class="coach-page">
          <div class="coach-log" id="coach-page-log" aria-live="polite"></div>
          <div class="coach-compose">
            <textarea id="coach-page-input" rows="2" placeholder="What do you need to say?" aria-label="Ask the sales coach"></textarea>
            <button type="button" class="btn btn-primary" id="coach-page-send">Ask</button>
          </div>
        </div>`;
}

export const COACH_MARKUP = `
      <!-- The sales coach, as a page of its own -->
      <div id="page-coach" class="page hidden">
${coachPageMarkup()}
      </div>`;

export const COACH_PORTAL_MARKUP = `
    <div id="page-coach" class="page">
      <div class="topbar"><h2>Sales Coach</h2></div>
      <div class="page-scroll">
${coachPageMarkup()}
      </div>
    </div>`;

export const COACH_COMPONENT_JS = `
  // ── The sales coach ───────────────────────────────────────────────────────
  // The host supplies esc() and api(); kbMdToHtml() renders the answer.
  //
  // One thread per browser session, held here and echoed to the server with
  // each question. The server reads the conversation back out of its own log
  // rather than trusting a history sent up, so this id is a key, not content.

  var coachThread = 'th-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  var coachBusy = false;
  var coachReady = false;
  var coachGreeted = {};

  function coachEl(id){ return document.getElementById(id); }

  /** The panel and the page are the same conversation in two places. */
  function coachSurfaces(){
    return [
      { log: coachEl('coach-log'), input: coachEl('coach-input'), send: coachEl('coach-send') },
      { log: coachEl('coach-page-log'), input: coachEl('coach-page-input'), send: coachEl('coach-page-send') }
    ].filter(function(s){ return s.log; });
  }

  function coachGreet(surface){
    if(!surface.log || coachGreeted[surface.log.id]) return;
    coachGreeted[surface.log.id] = true;
    coachAppend(surface.log, 'them',
      '<p>Tell me the situation and I will give you the words — from the guide, not from thin air.</p>' +
      '<div class="coach-chips">' + ${JSON.stringify(chipsMarkup())} + '</div>');
  }

  function coachAppend(log, who, html){
    if(!log) return null;
    var div = document.createElement('div');
    div.className = 'coach-msg coach-' + who;
    div.innerHTML = html;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function coachCites(cited){
    if(!cited || !cited.length) return '';
    var links = cited.map(function(c){
      return '<a href="#guide" data-page="guide" data-coach-cite="' + esc(c.id) + '">' + esc(c.heading) + '</a>';
    }).join(', ');
    return '<span class="coach-cites">From ' + links + '</span>';
  }

  async function coachAsk(question){
    if(coachBusy || !question.trim()) return;
    coachBusy = true;
    var surfaces = coachSurfaces();
    for(var i=0;i<surfaces.length;i++){
      coachAppend(surfaces[i].log, 'you', esc(question));
      if(surfaces[i].send) surfaces[i].send.disabled = true;
    }
    var pending = surfaces.map(function(s){ return coachAppend(s.log, 'them', '<p>…</p>'); });

    var r;
    try {
      r = await api('POST', '/coach/ask', { question: question, threadId: coachThread });
    } catch (e) {
      r = { ok: false, data: {} };
    }

    var html;
    if(r.status === 429){
      html = '<p>' + esc(r.data && r.data.message ? r.data.message : 'That is a lot of questions at once.') + '</p>';
    } else if(!r.ok){
      html = '<p>Something went wrong reaching the coach. Try that again.</p>';
    } else {
      html = kbMdToHtml(r.data.answer || '');
      var foot = [];
      if(r.data.answered) foot.push('<button type="button" class="coach-copy" data-coach-copy="1">Copy</button>');
      var cites = coachCites(r.data.cited);
      if(cites) foot.push(cites);
      if(foot.length) html += '<div class="coach-foot">' + foot.join('') + '</div>';
    }
    for(var j=0;j<pending.length;j++){
      if(pending[j]){
        pending[j].innerHTML = html;
        // Kept on the node so Copy hands over the markdown that was drafted,
        // not the rendered HTML with its tags stripped by the clipboard.
        if(r.ok && r.data.answer) pending[j].setAttribute('data-coach-md', r.data.answer);
      }
    }
    for(var k=0;k<surfaces.length;k++){
      if(surfaces[k].send) surfaces[k].send.disabled = false;
      if(surfaces[k].log) surfaces[k].log.scrollTop = surfaces[k].log.scrollHeight;
    }
    coachBusy = false;
  }

  function coachOpen(){
    var panel = coachEl('coach-panel');
    var launch = coachEl('coach-launch');
    if(!panel) return;
    panel.hidden = false;
    if(launch){ launch.hidden = true; launch.setAttribute('aria-expanded', 'true'); }
    var surface = coachSurfaces()[0];
    if(surface) coachGreet(surface);
    var input = coachEl('coach-input');
    if(input) input.focus();
  }

  function coachClose(){
    var panel = coachEl('coach-panel');
    var launch = coachEl('coach-launch');
    if(panel) panel.hidden = true;
    if(launch && coachReady){ launch.hidden = false; launch.setAttribute('aria-expanded', 'false'); }
  }

  /** Only drawn for someone who may actually use it. */
  async function initCoach(){
    var launch = coachEl('coach-launch');
    if(!launch) return;
    var r = await api('GET', '/coach/status');
    if(!r.ok || !r.data.enabled || !r.data.sections){
      // No key, or nothing in the guide to answer from: no launcher at all
      // rather than a button that apologises.
      return;
    }
    coachReady = true;
    launch.hidden = false;
  }

  function coachCopy(node){
    var md = node.getAttribute('data-coach-md') || node.textContent || '';
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(md);
    }
  }

  function coachLoadPage(){
    var surface = coachSurfaces()[1];
    if(surface) coachGreet(surface);
    var note = coachEl('coach-page-note');
    if(note && !note.textContent){
      note.textContent = 'Answers come from the Sales Guide. Nothing here is sent to a client.';
    }
  }

  function wireCoach(){
    var launch = coachEl('coach-launch');
    if(launch) launch.addEventListener('click', coachOpen);
    var close = coachEl('coach-close');
    if(close) close.addEventListener('click', coachClose);
    var full = coachEl('coach-full');
    if(full){
      full.addEventListener('click', function(){
        coachClose();
        if(typeof navigate === 'function') navigate('coach');
      });
    }

    document.addEventListener('keydown', function(e){
      if(e.key !== 'Escape') return;
      var panel = coachEl('coach-panel');
      if(panel && !panel.hidden) coachClose();
    });

    var surfaces = coachSurfaces();
    for(var i=0;i<surfaces.length;i++){
      (function(s){
        if(s.send) s.send.addEventListener('click', function(){
          var q = s.input ? s.input.value : '';
          if(s.input) s.input.value = '';
          coachAsk(q);
        });
        if(s.input) s.input.addEventListener('keydown', function(e){
          if(e.key === 'Enter' && !e.shiftKey){
            e.preventDefault();
            var q = s.input.value;
            s.input.value = '';
            coachAsk(q);
          }
        });
        if(s.log) s.log.addEventListener('click', function(e){
          if(!e.target.closest) return;
          var chip = e.target.closest('[data-coach-chip]');
          if(chip){ coachAsk(chip.getAttribute('data-coach-chip')); return; }
          var copy = e.target.closest('[data-coach-copy]');
          if(copy){
            var msg = copy.closest('.coach-msg');
            if(msg){
              coachCopy(msg);
              copy.textContent = 'Copied';
              setTimeout(function(){ copy.textContent = 'Copy'; }, 1500);
            }
          }
        });
      })(surfaces[i]);
    }
  }

  // The guide page's "Ask the coach" button reaches this, and showApp() calls
  // initCoach once there is a session — the status probe is an authenticated
  // route, so asking before sign-in would only ever 401.
  window.coachOpen = coachOpen;
  window.coachInit = initCoach;

  wireCoach();
`;
