// The embeddable web-chat widget (spec §2). Self-contained HTML/CSS/JS, no
// external assets, white-label WOW Video Tours branding — no reference to the
// platform behind it. Served by the chat service.
//
//   GET  {base}/            -> full chat page (also used as the iframe src)
//   GET  {base}/embed.js    -> one-line snippet that injects a launcher + iframe
//   POST {base}/chat        -> { visitorId, listingId?, message } -> { reply, done }
//   GET  {base}/session     -> { history, done } for resume

import { GREETING } from "./prompt.js";

const BRAND = "WOW Video Tours";
const ACCENT = "#E11B22";

export function chatPageHtml(base: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${BRAND} — Book your shoot</title>
<style>
  :root { --accent: ${ACCENT}; --ink: #1a1d1f; --ink-2: #5a6066; --line: #e4e4de; --bg: #f6f6f3; --bubble: #f0eeec; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg); color: var(--ink); display: flex; flex-direction: column; height: 100dvh; }
  header { padding: 14px 18px; background: #fff; border-bottom: 1px solid var(--line); flex: none; }
  header .name { font-weight: 700; font-size: 15px; }
  header .tag { font-size: 12px; color: var(--ink-2); margin-top: 2px; }
  #log { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
  .msg { max-width: 82%; padding: 10px 13px; border-radius: 14px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; }
  .msg.assistant { background: var(--bubble); color: var(--ink); align-self: flex-start; border-bottom-left-radius: 4px; }
  .msg.visitor { background: var(--accent); color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
  .typing { align-self: flex-start; color: var(--ink-2); font-size: 13px; padding: 4px 6px; }
  form { display: flex; gap: 8px; padding: 12px; background: #fff; border-top: 1px solid var(--line); flex: none; }
  input[type=text] { flex: 1; padding: 11px 13px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; }
  input[type=text]:focus { outline: none; border-color: var(--accent); }
  button { background: var(--accent); color: #fff; border: 0; border-radius: 10px; padding: 0 16px; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  .disclaimer { font-size: 11px; color: var(--ink-2); text-align: center; padding: 6px 12px 10px; background: #fff; }
</style>
</head>
<body>
  <header>
    <div class="name">${BRAND}</div>
    <div class="tag">Tell us about your listing and we'll put together an order.</div>
  </header>
  <div id="log" role="log" aria-live="polite"></div>
  <form id="f" autocomplete="off">
    <input id="m" type="text" placeholder="Type your message…" aria-label="Message" />
    <button id="send" type="submit">Send</button>
  </form>
  <div class="disclaimer">Estimates shown are from our standard catalog and subject to verification.</div>
<script>
(function () {
  var BASE = ${JSON.stringify(base)};
  var log = document.getElementById("log");
  var form = document.getElementById("f");
  var input = document.getElementById("m");
  var send = document.getElementById("send");

  var qs = new URLSearchParams(location.search);
  var listingId = qs.get("listing") || undefined;
  // Start a fresh session every time the widget is opened. We deliberately do
  // NOT persist the visitor id, so a reopen or a hard refresh never resumes a
  // prior (even day-old) conversation. Clear the legacy persisted id too, so
  // returning visitors don't keep replaying their old transcript.
  try { localStorage.removeItem("wow_intake_visitor"); } catch (e) {}
  var visitorId = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);

  function bubble(role, text) {
    var d = document.createElement("div");
    d.className = "msg " + role;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function setBusy(b) { send.disabled = b; input.disabled = b; }

  function post(path, body) {
    return fetch(BASE + path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(function (r) { return r.json(); });
  }

  // Resume any prior conversation, else greet.
  fetch(BASE + "/session?visitorId=" + encodeURIComponent(visitorId) + (listingId ? "&listingId=" + encodeURIComponent(listingId) : ""))
    .then(function (r) { return r.json(); })
    .then(function (s) {
      if (s && s.history && s.history.length) {
        s.history.forEach(function (m) { bubble(m.role, m.text); });
      } else if (s && s.greeting) {
        bubble("assistant", s.greeting);
      }
      if (s && s.done) setBusy(true);
    })
    .catch(function () { bubble("assistant", ${JSON.stringify(GREETING)}); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    bubble("visitor", text);
    input.value = "";
    setBusy(true);
    var typing = document.createElement("div");
    typing.className = "typing"; typing.textContent = "…";
    log.appendChild(typing); log.scrollTop = log.scrollHeight;

    post("/chat", { visitorId: visitorId, listingId: listingId, message: text })
      .then(function (res) {
        typing.remove();
        bubble("assistant", (res && res.reply) || "Sorry, something went wrong. Please try again.");
        setBusy(!!(res && res.done));
        if (!(res && res.done)) input.focus();
      })
      .catch(function () {
        typing.remove();
        bubble("assistant", "Sorry, something went wrong. Please try again.");
        setBusy(false); input.focus();
      });
  });
  input.focus();
})();
</script>
</body>
</html>`;
}

// One-line embed: <script src="{base}/embed.js" async></script> injects a
// floating launcher button that opens the chat page in an iframe overlay.
export function embedJs(base: string): string {
  return `(function(){
  // The iframe must load from the gateway origin (where this script is served),
  // not the host page's origin — otherwise a path-relative src resolves against
  // the customer's own site and loads a blank/404 page. Derive the origin from
  // this script tag and build an absolute base URL.
  var self=document.currentScript;
  if(!self){var ss=document.getElementsByTagName("script");for(var i=ss.length-1;i>=0;i--){if(ss[i].src&&ss[i].src.indexOf("/embed.js")>-1){self=ss[i];break;}}}
  var ORIGIN=self&&self.src?new URL(self.src,location.href).origin:location.origin;
  var BASE=ORIGIN+${JSON.stringify(base)};
  var open=false, frame, btn;
  function el(t,s){var e=document.createElement(t);for(var k in s)e.style[k]=s[k];return e;}
  btn=el("button",{position:"fixed",right:"20px",bottom:"20px",zIndex:"2147483000",width:"58px",height:"58px",borderRadius:"50%",border:"0",background:"${ACCENT}",color:"#fff",fontSize:"24px",cursor:"pointer",boxShadow:"0 6px 20px rgba(0,0,0,.25)"});
  btn.setAttribute("aria-label","Chat with ${BRAND}");
  btn.textContent="\\uD83D\\uDCAC";
  function toggle(){
    open=!open;
    if(open){
      frame=el("iframe",{position:"fixed",right:"20px",bottom:"88px",zIndex:"2147483000",width:"380px",height:"600px",maxWidth:"calc(100vw - 40px)",maxHeight:"calc(100vh - 120px)",border:"1px solid #e4e4de",borderRadius:"14px",boxShadow:"0 10px 40px rgba(0,0,0,.28)",background:"#fff"});
      frame.src=BASE+"/"+(window.__wowListingId?("?listing="+encodeURIComponent(window.__wowListingId)):"");
      document.body.appendChild(frame);
      btn.textContent="\\u2715";
    } else if(frame){ frame.remove(); btn.textContent="\\uD83D\\uDCAC"; }
  }
  btn.addEventListener("click",toggle);
  if(document.body)document.body.appendChild(btn);
  else document.addEventListener("DOMContentLoaded",function(){document.body.appendChild(btn);});
})();`;
}
