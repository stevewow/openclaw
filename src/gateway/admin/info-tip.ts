// The Hub's "i" describer: the paragraph explaining what a page or a section
// shows, folded behind a small info button beside its heading.
//
// Every Hub page used to open with two or three sentences of prose above the
// numbers. Read once, they cost a band of vertical space on every visit after
// that, which is the space the numbers wanted. So the prose moves into a
// popover: the heading keeps a round "i" next to it, hovering or focusing the
// button shows the text, tapping it pins the text open, and Escape or a click
// away puts it back. Nothing is lost — the words are in the DOM, so they are
// still found by the browser's own find-in-page and read out by a screen
// reader through `aria-describedby`.
//
// This is the house pattern for describers. A new page or card explaining
// itself calls `infoTip()` rather than adding another paragraph.
//
// What does NOT belong behind an "i":
//   - Warnings, errors and "still loading" notes. Anything a reader has to act
//     on stays on the page, where it cannot be missed.
//   - The one-line hint under a form field. It is short, it is read while
//     typing, and hiding it would cost a click mid-task.
//
// Shared verbatim by the admin SPA and the user portal, like the other
// `*-ui.ts` components: CSS into the page's `<style>`, the JS into its
// `<script>`, and the markup wherever a heading needs one.
//
// The script below lives in a template literal, which eats backslashes: no
// regex escapes and no backslashes in its comments.

/**
 * A describer button plus the popover it opens.
 *
 * `body` is trusted markup written in this repo (it carries `<strong>`,
 * `<code>` and links), not anything a user typed — escape first if that ever
 * changes. `label` is what a screen reader announces for the button, so it
 * should name the thing being described: "About the sales dashboard".
 */
export function infoTip(body: string, opts: { label?: string } = {}): string {
  const label = opts.label ?? "What this shows";
  return (
    `<span class="info-tip">` +
    `<button type="button" class="info-btn" aria-label="${label}" aria-expanded="false">i</button>` +
    `<span class="info-pop" role="tooltip" hidden>${body.trim()}</span>` +
    `</span>`
  );
}

/**
 * A describer whose text is written in by script rather than at build time.
 *
 * Same button, same behavior; the popover is empty markup carrying `id`, so a
 * view that changes what it explains (the metric a card is showing, how fresh
 * the data is) can set `textContent` on it without rebuilding the tip.
 */
export function infoTipSlot(id: string, opts: { label?: string } = {}): string {
  const label = opts.label ?? "What this shows";
  return (
    `<span class="info-tip">` +
    `<button type="button" class="info-btn" aria-label="${label}" aria-expanded="false">i</button>` +
    `<span class="info-pop" id="${id}" role="tooltip" hidden></span>` +
    `</span>`
  );
}

export const INFO_TIP_CSS = `
  /* The button rides on the heading's baseline and keeps its own type, so a
     heading that is bold, uppercase or tracked out does not deform it. */
  .info-tip { display: inline-flex; vertical-align: middle; position: relative; }
  .info-btn { width: 1.1rem; height: 1.1rem; flex-shrink: 0; margin-left: 0.4rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 50%; background: var(--surface2); color: var(--text-muted); cursor: pointer; font-family: var(--font); font-size: 0.7rem; font-weight: 700; font-style: italic; line-height: 1; letter-spacing: 0; text-transform: none; }
  .info-btn:hover, .info-btn[aria-expanded="true"] { background: var(--surface); border-color: var(--text-muted); color: var(--text); }
  /* Fixed, because a describer usually sits inside a card that scrolls or
     clips, and the popover must not be cut off by it. Placed by script. */
  .info-pop { position: fixed; left: 0; top: 0; z-index: 90; width: max-content; max-width: min(32rem, calc(100vw - 1.5rem)); padding: 0.7rem 0.85rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); color: var(--text-muted); font-family: var(--font); font-size: 0.82rem; font-weight: 400; font-style: normal; line-height: 1.55; letter-spacing: 0; text-align: left; text-transform: none; white-space: normal; }
  .info-pop[hidden] { display: none; }
  /* A slot tip the view had nothing to say for: no button either. */
  .info-tip:has(> .info-pop:empty) { display: none; }
  .info-pop p { margin: 0 0 0.55rem; }
  .info-pop p:last-child { margin-bottom: 0; }
  .info-pop strong { color: var(--text); }
  .info-pop a { color: var(--accent-ink); }
  /* Paper gets the numbers, not the describers. */
  @media print { .info-tip { display: none !important; } }
`;

export const INFO_TIP_COMPONENT_JS = `
  // -- Describer popovers ("i" buttons) -------------------------------------
  //
  // One delegated set of listeners for the whole page, so a tip rendered into
  // the DOM later works without being wired up.
  //
  // Two ways in, because there are two kinds of reader: hovering (or tabbing
  // to) the button shows the text while you are there, and clicking pins it
  // until you dismiss it. Pinning is what makes this work on a touch screen,
  // where there is no hover, and what lets you select the text or follow a
  // link inside it.
  (function(){
    var openTip = null;
    var pinned = false;
    var hideTimer = null;
    var seq = 0;
    // Escape hands focus back to the button, and focus is one of the two ways
    // in — without this the tip would reopen the instant it was dismissed.
    var refocusing = false;

    function pop(tip){ return tip ? tip.querySelector('.info-pop') : null; }
    function btn(tip){ return tip ? tip.querySelector('.info-btn') : null; }

    // Anchor under the button, then pull back inside the viewport: a describer
    // on a right-hand heading would otherwise open off the edge of the screen,
    // and one near the bottom would open below the fold.
    function place(tip){
      var p = pop(tip), b = btn(tip);
      if(!p || !b) return;
      p.style.left = '0px';
      p.style.top = '0px';
      var box = b.getBoundingClientRect();
      var size = p.getBoundingClientRect();
      var pad = 8;
      var left = box.left - 4;
      var maxLeft = window.innerWidth - pad - size.width;
      if(left > maxLeft) left = maxLeft;
      if(left < pad) left = pad;
      var top = box.bottom + 6;
      if(top + size.height > window.innerHeight - pad){
        var above = box.top - 6 - size.height;
        if(above >= pad) top = above;
        else top = Math.max(pad, window.innerHeight - pad - size.height);
      }
      p.style.left = left + 'px';
      p.style.top = top + 'px';
    }

    function hide(){
      clearTimeout(hideTimer);
      if(!openTip) return;
      var p = pop(openTip), b = btn(openTip);
      if(p) p.hidden = true;
      if(b) b.setAttribute('aria-expanded', 'false');
      openTip = null;
      pinned = false;
    }

    function show(tip, isPinned){
      clearTimeout(hideTimer);
      if(openTip && openTip !== tip) hide();
      var p = pop(tip), b = btn(tip);
      if(!p || !b) return;
      // A slot tip with nothing written into it yet has nothing to show.
      if(!p.textContent || !p.textContent.trim()) return;
      describe(tip);
      p.hidden = false;
      b.setAttribute('aria-expanded', 'true');
      openTip = tip;
      if(isPinned) pinned = true;
      place(tip);
    }

    function tipOf(node){
      return node && node.closest ? node.closest('.info-tip') : null;
    }

    // Point the button at its own text, so the description is announced with
    // the button whether or not the popover was ever opened.
    function describe(tip){
      var p = pop(tip), b = btn(tip);
      if(!p || !b || b.getAttribute('aria-describedby')) return;
      if(!p.id){
        seq += 1;
        p.id = 'info-pop-' + seq;
      }
      b.setAttribute('aria-describedby', p.id);
    }

    // The describers already in the page are wired now; ones rendered later
    // are wired the first time they open.
    Array.prototype.forEach.call(document.querySelectorAll('.info-tip'), describe);

    document.addEventListener('mouseover', function(e){
      var tip = tipOf(e.target);
      if(tip){ show(tip, pinned && tip === openTip); return; }
      if(openTip && !pinned) hideTimer = setTimeout(hide, 140);
    });

    // Tab to the button and the text appears; tab away and it goes.
    document.addEventListener('focusin', function(e){
      if(refocusing) return;
      var tip = tipOf(e.target);
      if(tip) show(tip, false);
      else if(openTip && !pinned) hide();
    });

    document.addEventListener('click', function(e){
      var tip = tipOf(e.target);
      if(!tip){ hide(); return; }
      // A click inside an open popover is reading, not toggling.
      if(e.target.closest('.info-pop')) return;
      e.preventDefault();
      if(openTip === tip && pinned) hide();
      else show(tip, true);
    });

    document.addEventListener('keydown', function(e){
      if(e.key !== 'Escape' || !openTip) return;
      var b = btn(openTip);
      hide();
      if(b){
        refocusing = true;
        b.focus();
        refocusing = false;
      }
    });

    // Fixed position does not follow the page, so keep up with it.
    window.addEventListener('scroll', function(){ if(openTip) place(openTip); }, true);
    window.addEventListener('resize', function(){ if(openTip) place(openTip); });
  })();
`;
