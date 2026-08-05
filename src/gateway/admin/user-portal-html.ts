import { BRAND_FAVICON_TAG, BRAND_NAME, BRAND_TAGLINE, brandLogo, brandTitle } from "./brand.js";
import { MY_WORK_COMPONENT_JS, MY_WORK_CSS } from "./my-work-ui.js";
import {
  PROJECT_CALENDAR_COMPONENT_JS,
  PROJECT_CALENDAR_CSS,
  PROJECT_CALENDAR_MARKUP,
} from "./project-calendar-ui.js";
import { REPORT_TABLE_COMPONENT_JS } from "./report-ui.js";
import { TASK_FEED_COMPONENT_JS, TASK_FEED_CSS, TASK_FEED_MARKUP } from "./task-feed-ui.js";
import { TASK_LIST_COMPONENT_JS, TASK_LIST_CSS, TASK_LIST_MARKUP } from "./task-list-ui.js";
import { TASK_STATUS_COMPONENT_JS, TASK_STATUS_CSS } from "./task-status-ui.js";

export const USER_PORTAL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${brandTitle("Portal")}</title>
${BRAND_FAVICON_TAG}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f4f4f5;
    --surface: #ffffff;
    --surface2: #f4f4f5;
    --border: #e4e4e7;
    --accent: #c0000a;
    --accent-hover: #950008;
    --text: #111111;
    --text-muted: #71717a;
    --sidebar-bg: #111111;
    --sidebar-text: rgba(255,255,255,0.65);
    --sidebar-text-active: #ffffff;
    --sidebar-active-bg: rgba(192,0,10,0.18);
    --sidebar-border: rgba(255,255,255,0.08);
    --radius: 10px;
    --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
    --font: system-ui, -apple-system, 'Segoe UI', sans-serif;
    --banner-h: 0px;
  }
  html, body { height: 100%; }
  body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  a { color: var(--accent); text-decoration: none; }

  /* Login */
  .login-wrap { display: flex; min-height: 100vh; }
  .login-left { flex: 1; background: var(--sidebar-bg); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; }
  .login-left-inner { max-width: 340px; width: 100%; }
  .login-brand { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2.5rem; }
  .login-brand-icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .login-brand-name { color: #ffffff; font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; }
  .login-tagline { color: rgba(255,255,255,0.45); font-size: 0.9rem; line-height: 1.6; }
  .login-right { width: 440px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 3rem; background: var(--surface); }
  .login-card { width: 100%; max-width: 360px; }
  .login-card h2 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.4rem; }
  .login-card .subtitle { color: var(--text-muted); margin-bottom: 2rem; font-size: 0.9rem; }
  @media (max-width: 640px) {
    .login-wrap { flex-direction: column; }
    .login-left { display: none; }
    .login-right { width: 100%; min-height: 100vh; }
  }

  /* Impersonation banner */
  .impersonation-banner { display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 0.5rem 1rem; background: #f59e0b; color: #111; font-size: 0.8rem; font-weight: 600; text-align: center; }
  .impersonation-banner .btn { padding: 0.3rem 0.75rem; font-size: 0.75rem; background: #111; color: #fff; border: none; }
  .impersonation-banner .btn:hover { background: #292929; }

  /* App layout — full height with sidebar */
  .app { display: flex; height: calc(100vh - var(--banner-h)); overflow: hidden; }
  .sidebar { width: 220px; background: var(--sidebar-bg); display: flex; flex-direction: column; flex-shrink: 0; height: calc(100vh - var(--banner-h)); }
  .sidebar-logo { padding: 1.25rem 1.25rem 1rem; display: flex; align-items: center; gap: 0.75rem; border-bottom: 1px solid var(--sidebar-border); }
  .sidebar-logo-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sidebar-logo-name { color: #ffffff; font-weight: 700; font-size: 1rem; letter-spacing: -0.01em; }
  .sidebar-user { padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--sidebar-border); }
  .sidebar-user .name { color: var(--sidebar-text-active); font-weight: 600; font-size: 0.875rem; }
  .sidebar-user .role { color: var(--sidebar-text); font-size: 0.75rem; margin-top: 0.1rem; text-transform: capitalize; }
  nav { flex: 1; padding: 0.625rem 0.75rem; overflow-y: auto; }
  nav a { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.625rem; color: var(--sidebar-text); border-radius: 7px; transition: background 0.12s, color 0.12s; margin-bottom: 1px; font-size: 0.875rem; cursor: pointer; }
  nav a:hover { background: rgba(255,255,255,0.07); color: var(--sidebar-text-active); }
  nav a.active { background: var(--sidebar-active-bg); color: var(--sidebar-text-active); border-left: 2.5px solid var(--accent); }
  nav a .icon { width: 20px; text-align: center; font-size: 0.95rem; }
  .sidebar-footer { padding: 0.875rem 0.75rem; border-top: 1px solid var(--sidebar-border); }
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

  /* Pages */
  .page { display: none; flex: 1; flex-direction: column; overflow: hidden; }
  .page.active { display: flex; }
  .page-scroll { flex: 1; overflow-y: auto; padding: 1.75rem; }
  .topbar { padding: 1rem 1.75rem; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .topbar h2 { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.01em; }

  /* Chat iframe page — full height, no scroll */
  #page-chat { background: #000; }
  #chat-frame { flex: 1; width: 100%; border: none; display: block; }

  /* Cards */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1rem; box-shadow: var(--shadow); }
  .card-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 0.75rem; letter-spacing: -0.01em; }

  /* Forms */
  .form-group { margin-bottom: 1.125rem; }
  label { display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
  input { width: 100%; padding: 0.6rem 0.875rem; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; color: var(--text); font-size: 14px; font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.1); }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.125rem; border-radius: 7px; border: 1px solid transparent; cursor: pointer; font-size: 13px; font-family: inherit; font-weight: 600; transition: background 0.12s, box-shadow 0.12s, opacity 0.12s; letter-spacing: 0.01em; }
  .btn-primary { background: var(--accent); color: #fff; box-shadow: 0 1px 2px rgba(192,0,10,0.25); }
  .btn-primary:hover { background: var(--accent-hover); box-shadow: 0 2px 6px rgba(192,0,10,0.35); }
  .btn-ghost { background: transparent; border-color: var(--border); color: var(--text-muted); }
  .btn-ghost:hover { background: var(--surface2); color: var(--text); border-color: #d1d1d6; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-sm { padding: 0.35rem 0.75rem; font-size: 12px; }

  /* Alert */
  .alert { padding: 0.7rem 1rem; border-radius: 7px; margin-bottom: 1rem; font-size: 0.875rem; font-weight: 500; }
  .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
  .alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
  .alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }

  .hidden { display: none !important; }
  .text-muted { color: var(--text-muted); }
  .empty-state { text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-size: 0.875rem; }
  .empty-state p { margin-bottom: 0.5rem; }

  /* Reports + shared report table */
  .table-wrap { overflow-x: auto; }
  table.rt-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  table.rt-table th, table.rt-table td { text-align: left; padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--border); white-space: nowrap; }
  table.rt-table thead th { background: var(--surface2); }
  .rt-toolbar { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.9rem; border-bottom: 1px solid var(--border); }
  .rt-cols-wrap { position: relative; }
  .rt-cols-menu { position: absolute; top: calc(100% + 4px); left: 0; z-index: 20; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 0.35rem; min-width: 200px; max-height: 320px; overflow-y: auto; }
  .rt-cols-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; font-size: 0.85rem; border-radius: 6px; cursor: pointer; white-space: nowrap; }
  .rt-cols-item:hover { background: var(--surface2); }
  .rt-csv-btn { margin-left: auto; }
  table.rt-table th.rt-th { cursor: pointer; user-select: none; }
  table.rt-table th.rt-th[draggable=true] { cursor: grab; }
  .rt-grip { color: var(--text-muted); opacity: 0.5; margin-right: 0.35rem; cursor: grab; font-size: 0.8rem; }
  .rt-th-label { font-weight: 700; }
  table.rt-table td.rt-frozen, table.rt-table th.rt-frozen { position: sticky; left: 0; background: var(--surface); z-index: 1; }
  table.rt-table th.rt-frozen { background: var(--surface2); z-index: 3; }
  .report-picker { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .report-tab { padding: 0.5rem 0.9rem; border: 1px solid var(--border); background: var(--surface); border-radius: 8px; cursor: pointer; font: inherit; font-weight: 600; font-size: 0.85rem; color: var(--text-muted); }
  .report-tab.active { border-color: var(--accent); color: var(--accent); }
  .report-controls { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; margin-bottom: 1rem; }
  .report-controls label { text-transform: none; letter-spacing: 0; font-weight: 600; font-size: 0.8rem; color: var(--text); }
  .report-controls select { padding: 0.45rem 0.6rem; border: 1px solid var(--border); border-radius: 7px; font: inherit; background: var(--surface); margin-left: 0.4rem; }
  .report-subhead { padding: 0.75rem 1rem; font-weight: 700; border-bottom: 1px solid var(--border); }

  /* Resources */
  .resources-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
  .resource-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
  .resource-card-body { padding: 1rem 1.25rem; }
  .resource-title { font-weight: 700; font-size: 0.9rem; letter-spacing: -0.01em; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.5rem; }
  .resource-desc { font-size: 0.825rem; color: var(--text-muted); margin-bottom: 0.75rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .resource-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .resource-tag { padding: 0.15rem 0.5rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 999px; font-size: 0.7rem; font-weight: 600; color: var(--text-muted); }
  .resource-card-footer { padding: 0.625rem 1.25rem; background: var(--surface2); border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: flex-end; }

  /* Account */
  .account-section { max-width: 480px; }

  /* Projects & Tasks */
  select, textarea { width: 100%; padding: 0.6rem 0.875rem; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; color: var(--text); font-size: 14px; font-family: inherit; }
  select:focus, textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.1); }
  .tasks-toolbar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .tasks-toolbar .spacer { margin-left: auto; }
  /* Board/Calendar switch, styled to match the dashboard's view toggle. */
  .pt-view-toggle { display: inline-flex; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 2px; gap: 2px; }
  .pt-view-btn { background: none; border: none; border-radius: calc(var(--radius) - 3px); padding: 0.35rem 0.7rem; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); cursor: pointer; font-family: inherit; transition: background 0.1s, color 0.1s; }
  .pt-view-btn:hover { color: var(--text); }
  .pt-view-btn.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow); }
${PROJECT_CALENDAR_CSS}
${TASK_FEED_CSS}
${TASK_LIST_CSS}
${TASK_STATUS_CSS}
${MY_WORK_CSS}
  .focus-up { color: #15803d; font-weight: 700; }
  .focus-down { color: #b91c1c; font-weight: 700; }
  /* Client tags, matching the dashboard's Focus report. */
  .focus-tag { display: inline-block; padding: 0.05rem 0.35rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.02em; white-space: nowrap; border: 1px solid transparent; }
  .focus-tag + .focus-tag { margin-left: 0.25rem; }
  .focus-tag-vip { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
  .focus-tag-top { background: #dcfce7; color: #166534; border-color: #86efac; }
  .focus-never { font-weight: 700; color: #991b1b; }
  /* One filter row: project picker, the shared filter bar, and an overflow menu
     holding what used to sit loose in the toolbar. */
  .board-tools { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.75rem; }
  .board-tools .tl-bar { margin-bottom: 0; }
  .tool-menu { position: relative; flex-shrink: 0; }
  .tool-menu-pop { position: absolute; right: 0; top: calc(100% + 0.3rem); z-index: 30; min-width: 12rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 0.3rem; display: flex; flex-direction: column; gap: 0.1rem; }
  .tool-menu-item { display: flex; align-items: center; gap: 0.4rem; width: 100%; text-align: left; padding: 0.4rem 0.5rem; font-size: 0.8rem; font-family: inherit; font-weight: 500; color: var(--text); background: none; border: none; border-radius: 5px; cursor: pointer; white-space: nowrap; }
  .tool-menu-item:hover:not(:disabled) { background: var(--surface2); }
  .tool-menu-item:disabled { opacity: 0.4; cursor: default; }
  @media (max-width: 720px) { .board-tools { flex-wrap: wrap; } }
  /* A board can have any number of columns now, so they scroll sideways rather
     than being squeezed into a fixed four-up grid. */
  .board-wrap { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(200px, 1fr); gap: 0.875rem; align-items: start; overflow-x: auto; padding-bottom: 0.5rem; }
  @media (max-width: 900px) { .board-wrap { grid-auto-columns: minmax(180px, 70vw); } }
  .board-col { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.625rem; }
  .board-col-head { display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 0.8rem; margin-bottom: 0.5rem; padding: 0 0.15rem; }
  .board-col-count { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 0 0.45rem; font-size: 0.7rem; color: var(--text-muted); }
  .task-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.625rem 0.7rem; margin-bottom: 0.5rem; box-shadow: var(--shadow); cursor: grab; }
  .task-card:hover { border-color: #d1d1d6; }
  .task-card:active { cursor: grabbing; }
  .task-card.dragging { opacity: 0.45; cursor: grabbing; }
  .board-col.drag-over { border-color: var(--accent); border-style: dashed; background: rgba(0,0,0,0.02); }
  .task-drop-slot { height: 2px; background: var(--accent); border-radius: 2px; margin: 0.25rem 0 0.6rem; }
  .task-card-proj { font-size: 11px; color: var(--text-muted); margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .task-card-title { font-weight: 650; font-size: 0.88rem; line-height: 1.35; }
  .task-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.35rem; }
  .task-card-desc { font-size: 0.76rem; line-height: 1.45; color: var(--text-muted); margin-bottom: 0.4rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
  .task-card-meta { display: flex; flex-wrap: wrap; gap: 0.3rem; font-size: 0.7rem; margin-top: 0.3rem; }
  .attach-list { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.5rem; }
  .attach-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.55rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; font-size: 0.8rem; }
  .attach-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); text-decoration: none; }
  .attach-name:hover { text-decoration: underline; }
  .attach-size { flex-shrink: 0; font-size: 0.7rem; color: var(--text-muted); }
  .attach-del { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1rem; line-height: 1; padding: 0 0.15rem; }
  .attach-empty { font-size: 0.78rem; color: var(--text-muted); padding: 0.25rem 0; }
  .attach-actions { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
  .attach-url-input { flex: 1; min-width: 160px; }
  .task-chip { padding: 0.05rem 0.45rem; border-radius: 999px; background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted); font-weight: 600; }
  .task-chip.overdue { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
  .prio-urgent { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
  .prio-high { color: #b45309; }
  .board-empty { color: var(--text-muted); font-size: 0.75rem; padding: 0.5rem 0.15rem; }

  /* Modals */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: flex-start; justify-content: center; padding: 2rem 1rem; z-index: 50; overflow-y: auto; }
  .modal-box { background: var(--surface); border-radius: var(--radius); box-shadow: 0 10px 40px rgba(0,0,0,0.25); width: 100%; max-width: 500px; padding: 1.5rem; }
  .modal-box h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; }
  .modal-actions { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }
  .modal-actions .spacer { flex: 1; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .member-picker { border: 1px solid var(--border); border-radius: 7px; padding: 0.35rem; max-height: 140px; overflow-y: auto; background: var(--surface); }
  .member-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.4rem; border-radius: 5px; cursor: pointer; font-size: 0.85rem; }
  .member-row:hover { background: var(--surface2); }
  .member-row input { width: auto; margin: 0; }
  .member-sub { color: var(--text-muted); font-size: 0.75rem; }
  .member-empty { color: var(--text-muted); font-size: 0.8rem; padding: 0.4rem; }
</style>
</head>
<body>

<!-- Login screen -->
<div id="login-screen" class="login-wrap">
  <div class="login-left">
    <div class="login-left-inner">
      <div class="login-brand">
        <div class="login-brand-icon">${brandLogo(44)}</div>
        <div class="login-brand-name">${BRAND_NAME}</div>
      </div>
      <p class="login-tagline">${BRAND_TAGLINE}</p>
    </div>
  </div>
  <div class="login-right">
    <div class="login-card">
      <h2>Welcome back</h2>
      <p class="subtitle">Sign in to your portal</p>
      <div id="login-error" class="alert alert-error hidden"></div>
      <form id="login-form">
        <div class="form-group">
          <label for="login-username">Username</label>
          <input id="login-username" type="text" autocomplete="username" required placeholder="username">
        </div>
        <div class="form-group">
          <label for="login-password">Password</label>
          <input id="login-password" type="password" autocomplete="current-password" required placeholder="••••••••">
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:0.65rem 1rem;font-size:14px" id="login-btn">Sign in</button>
      </form>
    </div>
  </div>
</div>

<div id="impersonation-banner" class="impersonation-banner hidden">
  <span>Viewing as <strong id="impersonation-target"></strong></span>
  <button type="button" class="btn" id="return-to-admin-btn">Return to admin</button>
</div>

<!-- Main app -->
<div id="app" class="app hidden">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">${brandLogo(32)}</div>
      <div class="sidebar-logo-name">${BRAND_NAME}</div>
    </div>
    <div class="sidebar-user">
      <div class="name" id="sidebar-username"></div>
      <div class="role" id="sidebar-role"></div>
    </div>
    <nav>
      <a class="nav-link active" data-page="chat" data-feature="chat"><span class="icon">💬</span> Chat</a>
      <a class="nav-link" data-page="tasks" data-feature="projects"><span class="icon">📋</span> Projects &amp; Tasks</a>
      <a class="nav-link" data-page="reports" data-feature="reports"><span class="icon">📊</span> Reports</a>
      <a class="nav-link" data-page="resources" data-feature="resources"><span class="icon">📚</span> Resources</a>
      <a class="nav-link" data-page="account"><span class="icon">👤</span> My Account</a>
    </nav>
    <div class="sidebar-footer">
      <button class="btn btn-ghost btn-sm" id="logout-btn" style="width:100%">Sign out</button>
    </div>
  </aside>

  <main class="main">

    <!-- Chat — embedded control UI -->
    <div id="page-chat" class="page active">
      <iframe id="chat-frame" title="${BRAND_NAME} Chat" allow="microphone"></iframe>
    </div>

    <!-- Projects & Tasks -->
    <div id="page-tasks" class="page">
      <div class="topbar">
        <h2>Projects &amp; Tasks</h2>
        <div class="flex gap-2" style="display:flex;gap:0.5rem">
          <button class="btn btn-ghost btn-sm" id="pt-new-project">+ New Project</button>
          <button class="btn btn-primary btn-sm" id="pt-new-task">+ New Task</button>
        </div>
      </div>
      <div class="page-scroll">
        <!-- Same two-row shape as the dashboard: what you are looking at, then
             one filter row with the project picker and an overflow menu. -->
        <div class="tasks-toolbar">
          <div class="pt-view-toggle">
            <button type="button" class="pt-view-btn active" id="pt-view-mywork">🙋 My Work</button>
            <button type="button" class="pt-view-btn" id="pt-view-board">⊞ Board</button>
            <button type="button" class="pt-view-btn" id="pt-view-cal">📅 Calendar</button>
            <button type="button" class="pt-view-btn" id="pt-view-list">☰ List</button>
          </div>
        </div>
        <div class="board-tools">
          <select id="pt-project-filter" style="max-width:220px"><option value="all">All Projects</option></select>
          <div id="pt-filter-bar" style="flex:1 1 20rem;min-width:0">${TASK_LIST_MARKUP}</div>
          <div class="tool-menu">
            <button type="button" class="btn btn-ghost btn-sm" id="pt-tool-menu-btn" title="More">⚙</button>
            <div class="tool-menu-pop hidden" id="pt-tool-menu-pop">
              <button type="button" class="tool-menu-item" id="pt-edit-project" disabled>✎ Edit project</button>
            </div>
          </div>
        </div>
        <div id="pt-mywork"></div>
        <div id="pt-board" class="hidden"></div>
        <div id="pt-calendar" class="hidden">${PROJECT_CALENDAR_MARKUP}</div>
        <div id="pt-tasklist" class="hidden"></div>
      </div>
    </div>

    <!-- Resources -->
    <div id="page-resources" class="page">
      <div class="topbar"><h2>Resources</h2></div>
      <div class="page-scroll">
        <div id="resources-container"></div>
      </div>
    </div>

    <!-- Reports -->
    <div id="page-reports" class="page">
      <div class="topbar"><h2>Reports</h2></div>
      <div class="page-scroll">
        <div id="report-picker" class="report-picker"></div>
        <div id="report-controls" class="report-controls hidden">
          <label>From <select id="prep-from"></select></label>
          <label>To <select id="prep-to"></select></label>
          <label>Market <select id="prep-market"><option value="">All markets</option></select></label>
        </div>
        <div id="report-area"></div>
      </div>
    </div>

    <!-- Account -->
    <div id="page-account" class="page">
      <div class="topbar"><h2>My Account</h2></div>
      <div class="page-scroll">
        <div class="account-section">
          <div class="card">
            <div class="card-title">Account Info</div>
            <div id="account-info" style="font-size:0.875rem;color:var(--text-muted)"></div>
          </div>
          <div class="card" style="margin-top:1rem">
            <div class="card-title">Change Password</div>
            <div id="pw-alert" class="alert hidden"></div>
            <form id="pw-form">
              <div class="form-group">
                <label for="pw-current">Current Password</label>
                <input id="pw-current" type="password" autocomplete="current-password" required>
              </div>
              <div class="form-group">
                <label for="pw-new">New Password</label>
                <input id="pw-new" type="password" autocomplete="new-password" required>
              </div>
              <div class="form-group">
                <label for="pw-confirm">Confirm New Password</label>
                <input id="pw-confirm" type="password" autocomplete="new-password" required>
              </div>
              <button type="submit" class="btn btn-primary" id="pw-btn">Update Password</button>
            </form>
          </div>
        </div>
      </div>
    </div>

  </main>
</div>

<!-- Task modal -->
<div id="pt-task-modal" class="modal-backdrop hidden">
  <div class="modal-box">
    <h3 id="pt-task-title">New Task</h3>
    <div id="pt-task-error" class="alert alert-error hidden"></div>
    <form id="pt-task-form">
      <div class="form-group">
        <label for="pt-t-title">Title</label>
        <input id="pt-t-title" required placeholder="What needs to be done?">
      </div>
      <div class="form-group">
        <label for="pt-t-desc">Description</label>
        <textarea id="pt-t-desc" rows="2"></textarea>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label for="pt-t-status">Status</label>
          <!-- Options track the task's project board; see ptSyncStatusOptions. -->
          <select id="pt-t-status"></select>
        </div>
        <div class="form-group">
          <label for="pt-t-priority">Priority</label>
          <select id="pt-t-priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label for="pt-t-project">Project</label>
          <select id="pt-t-project"><option value="">— No Project —</option></select>
        </div>
        <div class="form-group">
          <label for="pt-t-due">Due Date</label>
          <input id="pt-t-due" type="date">
        </div>
      </div>
      <div class="form-group">
        <label>Assigned To</label>
        <select id="pt-t-assignee"></select>
      </div>
      <div id="pt-attach-section" class="form-group hidden">
        <label>Links &amp; Files</label>
        <div id="pt-attach-list" class="attach-list"></div>
        <div class="attach-actions">
          <input id="pt-attach-url" class="attach-url-input" placeholder="Paste a link (https://…)">
          <button type="button" class="btn btn-ghost btn-sm" id="pt-attach-link-btn">Add Link</button>
          <button type="button" class="btn btn-ghost btn-sm" id="pt-attach-file-btn">Upload File</button>
          <input type="file" id="pt-attach-file" class="hidden">
        </div>
      </div>
      <div id="pt-feed-section" class="form-group hidden">
        <label>Comments &amp; Activity</label>
        <div id="pt-feed">${TASK_FEED_MARKUP}</div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost btn-sm hidden" id="pt-task-delete" style="color:#991b1b">Delete</button>
        <div class="spacer"></div>
        <button type="button" class="btn btn-ghost" id="pt-task-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="pt-task-save">Save Task</button>
      </div>
    </form>
  </div>
</div>

<!-- Project modal -->
<div id="pt-project-modal" class="modal-backdrop hidden">
  <div class="modal-box">
    <h3 id="pt-project-title">New Project</h3>
    <div id="pt-project-error" class="alert alert-error hidden"></div>
    <form id="pt-project-form">
      <div class="form-group">
        <label for="pt-p-name">Project Name</label>
        <input id="pt-p-name" required>
      </div>
      <div class="form-group">
        <label for="pt-p-desc">Description</label>
        <textarea id="pt-p-desc" rows="2"></textarea>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label for="pt-p-start">Begin Date</label>
          <input id="pt-p-start" type="date">
        </div>
        <div class="form-group">
          <label for="pt-p-end">Goal End Date</label>
          <input id="pt-p-end" type="date">
        </div>
      </div>
      <div class="form-group">
        <label for="pt-p-status">Status</label>
        <select id="pt-p-status">
          <option value="planning">Planning</option>
          <option value="active" selected>Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div class="form-group">
        <label>Members</label>
        <div id="pt-p-members" class="member-picker"></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost btn-sm hidden" id="pt-project-delete" style="color:#991b1b">Delete</button>
        <div class="spacer"></div>
        <button type="button" class="btn btn-ghost" id="pt-project-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="pt-project-save">Save Project</button>
      </div>
    </form>
  </div>
</div>

<script>
  let token = localStorage.getItem('oc_portal_token');
  let currentUser = null;
  let gatewayConfig = null;
  let impersonatedBy = null;

  function updateImpersonationBanner() {
    const banner = document.getElementById('impersonation-banner');
    document.documentElement.style.setProperty('--banner-h', impersonatedBy ? '40px' : '0px');
    banner.classList.toggle('hidden', !impersonatedBy);
    if (impersonatedBy) {
      document.getElementById('impersonation-target').textContent =
        (currentUser ? currentUser.username : '') + ' (impersonated by ' + impersonatedBy.username + ')';
    }
  }

  document.getElementById('return-to-admin-btn').addEventListener('click', async () => {
    const returnToken = localStorage.getItem('oc_impersonator_token');
    await api('POST', '/auth/logout').catch(() => {});
    localStorage.removeItem('oc_impersonator_token');
    localStorage.removeItem('oc_portal_token');
    localStorage.removeItem('oc_admin_token');
    if (returnToken) localStorage.setItem('oc_admin_token', returnToken);
    window.location.replace('/admin');
  });

  // Escapes both quote styles: esc() output lands inside single-quoted JS string
  // literals in inline handlers (onclick="fn('...')"), so missing ' is a breakout.
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch('/api/admin' + path, opts);
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }
${REPORT_TABLE_COMPONENT_JS}
${PROJECT_CALENDAR_COMPONENT_JS}
${TASK_FEED_COMPONENT_JS}
${TASK_LIST_COMPONENT_JS}
${TASK_STATUS_COMPONENT_JS}
${MY_WORK_COMPONENT_JS}
  // ── Access helpers ──────────────────────────────────────────────────────────
  function userPermissions(){ return (currentUser && currentUser.permissions) || []; }
  function hasFeature(f){ return userPermissions().some(function(p){ return p.permissionType === 'feature' && p.value === f; }); }
  function hasReport(k){ return userPermissions().some(function(p){ return p.permissionType === 'report' && p.value === k; }); }

  var PORTAL_REPORTS = [
    { key: 'report-cancellations', title: 'Agent Cancellation Report' },
    { key: 'rankings', title: 'Agent & Company Rankings' },
    { key: 'photographers', title: 'Photographers' },
    { key: 'focus', title: 'Sales Focus' },
    { key: 'pipedrive-cleanup', title: 'Pipedrive Cleanup' },
    { key: 'past-due', title: 'Collections Queue' }
  ];
  function anyReportGranted(){ return PORTAL_REPORTS.some(function(r){ return hasReport(r.key); }); }

  // Deny-by-default: show a nav item only when the section is granted.
  function applyAccess(){
    document.querySelectorAll('.nav-link[data-feature]').forEach(function(a){
      var feat = a.dataset.feature;
      var ok = feat === 'reports' ? anyReportGranted() : hasFeature(feat);
      a.style.display = ok ? '' : 'none';
    });
  }
  function firstAllowedPage(){
    if (hasFeature('chat')) return 'chat';
    if (hasFeature('projects')) return 'tasks';
    if (anyReportGranted()) return 'reports';
    if (hasFeature('resources')) return 'resources';
    return 'account';
  }

  // ── Reports (read-only view of cached report data) ──────────────────────────
  var portalReportMonths = [];
  var portalReportTables = {};
  var portalActiveReport = null;
  var portalReportsBuilt = false;
  function monthLabelP(m){ var d = new Date(m + '-01T00:00:00Z'); return d.toLocaleString('en-US', { month:'short', year:'numeric', timeZone:'UTC' }); }
  function portalCancelCols(){ return [
    { key:'client', label:'Client', value:function(r){ return r.client; } },
    { key:'totalOrders', label:'Total Orders', type:'num', value:function(r){ return r.totalOrders; } },
    { key:'cancellations', label:'Cancellations', type:'num', value:function(r){ return r.cancellations; } },
    { key:'reschedules', label:'Reschedules', type:'num', value:function(r){ return r.reschedules; } },
    { key:'pct', label:'% Cancelled/Rescheduled', type:'num', value:function(r){ return Number(r.cancelledOrRescheduledPct.toFixed(1)); }, render:function(r){ return r.cancelledOrRescheduledPct.toFixed(1) + '%'; } }
  ]; }
  function portalRankCols(nameLabel){ return [
    { key:'rank', label:'#', type:'num', value:function(r){ return r.rank; } },
    { key:'name', label:nameLabel, value:function(r){ return r.name; } },
    { key:'totalOrders', label:'Orders', type:'num', value:function(r){ return r.totalOrders; } },
    { key:'cancellations', label:'Cancellations', type:'num', value:function(r){ return r.cancellations; } },
    { key:'reschedules', label:'Reschedules', type:'num', value:function(r){ return r.reschedules; } },
    { key:'pct', label:'% Canc./Resch.', type:'num', value:function(r){ return Number(r.cancelledOrRescheduledPct.toFixed(1)); }, render:function(r){ return r.cancelledOrRescheduledPct.toFixed(1) + '%'; } }
  ]; }
  function portalPhotographerCols(){ return [
    { key:'name', label:'Photographer', value:function(r){ return r.name; } },
    { key:'markets', label:'Markets', value:function(r){ return (r.markets || []).join(', '); } },
    { key:'shoots', label:'# Shoots', type:'num', value:function(r){ return r.shoots; } },
    { key:'status', label:'Status', value:function(r){ return r.active ? 'Active' : 'Inactive'; } }
  ]; }
  // Same columns the dashboard draws, so a BDS and their manager read one
  // report rather than two that drift.
  function pFocusMoney(n){ return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
  /** Mirrors focusTagList on the dashboard; the two must read the same. */
  function pFocusTags(r){
    var out = [];
    if (r.vip) out.push('VIP');
    if (r.topPercent) out.push('Top 20%');
    return out;
  }
  function portalFocusCols(){ return [
    { key:'agent', label:'Client', value:function(r){ return r.agentName; } },
    { key:'tags', label:'Tags', type:'num',
      value:function(r){ return (r.vip ? 2 : 0) + (r.topPercent ? 1 : 0); },
      csv:function(r){ return pFocusTags(r).join(' '); },
      render:function(r){ return pFocusTags(r).map(function(t){
        return '<span class="focus-tag focus-tag-' + (t === 'VIP' ? 'vip' : 'top') + '">' + esc(t) + '</span>';
      }).join('') || '<span class="text-muted">—</span>'; } },
    { key:'company', label:'Brokerage', value:function(r){ return r.companyName || '—'; } },
    { key:'region', label:'Region', value:function(r){ return r.region; } },
    { key:'bds', label:'BDS', value:function(r){ return r.bds || 'Unassigned'; } },
    { key:'shoots', label:'# Shoots', type:'num', value:function(r){ return r.shoots; } },
    { key:'revenue', label:'Revenue', type:'num', value:function(r){ return r.revenue; }, render:function(r){ return pFocusMoney(r.revenue); } },
    { key:'priorRevenue', label:'Prior Revenue', type:'num', value:function(r){ return r.priorRevenue; }, render:function(r){ return pFocusMoney(r.priorRevenue); } },
    { key:'growth', label:'Growth', type:'num',
      value:function(r){ return r.growthPct === null ? -Infinity : r.growthPct; },
      csv:function(r){ return r.growthPct === null ? 'New' : r.growthPct; },
      render:function(r){
        if (r.growthPct === null) return '<span class="text-muted">New</span>';
        var cls = r.growthPct > 0 ? 'focus-up' : r.growthPct < 0 ? 'focus-down' : '';
        return '<span class="' + cls + '">' + (r.growthPct > 0 ? '+' : '') + r.growthPct.toFixed(1) + '%</span>';
      } },
    { key:'lastContact', label:'Days Since Contact', type:'num',
      value:function(r){ return r.daysSinceContact === null ? Number.MAX_SAFE_INTEGER : r.daysSinceContact; },
      csv:function(r){ return r.daysSinceContact === null ? 'Never' : r.daysSinceContact; },
      render:function(r){
        if (r.daysSinceContact === null) return '<span class="focus-never">Never</span>';
        var d = r.daysSinceContact;
        return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : d + 'd ago';
      } }
  ]; }

  function loadReportsPage(){
    var granted = PORTAL_REPORTS.filter(function(r){ return hasReport(r.key); });
    var picker = document.getElementById('report-picker');
    var area = document.getElementById('report-area');
    if (!granted.length){
      picker.innerHTML = '';
      document.getElementById('report-controls').classList.add('hidden');
      area.innerHTML = '<div class="empty-state"><p>No reports are available to you.</p></div>';
      return;
    }
    picker.innerHTML = granted.map(function(r){ return '<button class="report-tab" data-key="' + esc(r.key) + '">' + esc(r.title) + '</button>'; }).join('');
    picker.querySelectorAll('.report-tab').forEach(function(b){ b.addEventListener('click', function(){ selectPortalReport(b.dataset.key); }); });
    if (!portalReportsBuilt){
      for (var i = 0; i < 12; i++){ var d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - (11 - i)); portalReportMonths.push(d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')); }
      var opts = portalReportMonths.map(function(m){ return '<option value="' + m + '">' + monthLabelP(m) + '</option>'; }).join('');
      var fromSel = document.getElementById('prep-from'), toSel = document.getElementById('prep-to');
      fromSel.innerHTML = opts; toSel.innerHTML = opts;
      fromSel.value = portalReportMonths[0]; toSel.value = portalReportMonths[portalReportMonths.length - 1];
      var onChange = function(){ if (portalActiveReport) renderPortalReport(portalActiveReport); };
      fromSel.onchange = toSel.onchange = document.getElementById('prep-market').onchange = onChange;
      // Persistent containers so the shared table instances keep a live element.
      area.innerHTML =
        '<div class="report-view" data-view="report-cancellations" style="display:none"><div class="card" style="padding:0" id="prt-cancel"></div></div>' +
        '<div class="report-view" data-view="rankings" style="display:none"><div class="card" style="padding:0;margin-bottom:1rem"><div class="report-subhead">🧑‍💼 Agent Ranking</div><div id="prt-rank-agents"></div></div><div class="card" style="padding:0"><div class="report-subhead">🏢 Company Ranking</div><div id="prt-rank-companies"></div></div></div>' +
        '<div class="report-view" data-view="photographers" style="display:none"><div class="card" style="padding:0" id="prt-photographers"></div></div>' +
        '<div class="report-view" data-view="focus" style="display:none">' +
          '<div class="card" style="margin-bottom:1rem;padding:0.6rem 0.9rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">' +
            '<label style="font-size:0.8rem;font-weight:600">BDS <select id="prt-focus-bds"><option value="">Everyone</option></select></label>' +
            '<label style="font-size:0.8rem;font-weight:600">Region <select id="prt-focus-region"><option value="">All regions</option></select></label>' +
            '<label style="font-size:0.8rem;font-weight:600">Compare <select id="prt-focus-compare"><option value="yoy">Same period last year</option><option value="previous">The period before</option></select></label>' +
            '<span class="text-muted" id="prt-focus-note" style="font-size:0.78rem"></span>' +
          '</div>' +
          '<div class="card" style="padding:0" id="prt-focus"></div>' +
        '</div>' +
        '<div class="report-view" data-view="pipedrive-cleanup" style="display:none"><div id="prt-pdc"></div></div>' +
        '<div class="report-view" data-view="past-due" style="display:none"><div id="prt-pastdue"></div></div>';
      portalReportTables['report-cancellations'] = createReportTable({ containerId:'prt-cancel', reportKey:'p-cancellations', frozenFirst:true, emptyMsg:'No data cached for this range yet.', columns: portalCancelCols() });
      portalReportTables['rankings-agents'] = createReportTable({ containerId:'prt-rank-agents', reportKey:'p-rankings-agents', emptyMsg:'No data cached for this range yet.', columns: portalRankCols('Agent') });
      portalReportTables['rankings-companies'] = createReportTable({ containerId:'prt-rank-companies', reportKey:'p-rankings-companies', emptyMsg:'No data cached for this range yet.', columns: portalRankCols('Company') });
      portalReportTables['photographers'] = createReportTable({ containerId:'prt-photographers', reportKey:'p-photographers', frozenFirst:true, emptyMsg:'No photographers cached yet.', columns: portalPhotographerCols() });
      portalReportTables['focus'] = createReportTable({ containerId:'prt-focus', reportKey:'p-focus', frozenFirst:true, emptyMsg:'No orders cached for this range yet. Ask an admin to refresh it.', columns: portalFocusCols() });
      document.getElementById('prt-focus-bds').onchange = function(){ renderPortalReport('focus'); };
      document.getElementById('prt-focus-region').onchange = function(){ renderPortalReport('focus'); };
      document.getElementById('prt-focus-compare').onchange = function(){ renderPortalReport('focus'); };
      portalReportsBuilt = true;
      loadPortalMarkets();
    }
    document.getElementById('report-controls').classList.remove('hidden');
    var stillActive = portalActiveReport && granted.some(function(r){ return r.key === portalActiveReport; });
    selectPortalReport(stillActive ? portalActiveReport : granted[0].key);
  }
  async function loadPortalMarkets(){
    var from = document.getElementById('prep-from').value, to = document.getElementById('prep-to').value;
    var r = await api('GET', '/reports/agent-cancellations/markets?from=' + from + '&to=' + to);
    var sel = document.getElementById('prep-market');
    var markets = r.ok ? (r.data.markets || []) : [];
    sel.innerHTML = '<option value="">All markets</option>' + markets.map(function(m){ return '<option value="' + esc(m) + '">' + esc(m) + '</option>'; }).join('');
  }
  function selectPortalReport(key){
    portalActiveReport = key;
    document.querySelectorAll('#report-picker .report-tab').forEach(function(b){ b.classList.toggle('active', b.dataset.key === key); });
    document.querySelectorAll('#report-area .report-view').forEach(function(v){ v.style.display = v.dataset.view === key ? '' : 'none'; });
    // The date/market controls only apply to the Spiro data reports; the cleanup
    // worklist and the collections queue are live worklists, so hide them there.
    document.getElementById('report-controls').classList.toggle('hidden', key === 'pipedrive-cleanup' || key === 'past-due');
    renderPortalReport(key);
  }
  async function renderPortalReport(key){
    var from = document.getElementById('prep-from').value, to = document.getElementById('prep-to').value, market = document.getElementById('prep-market').value;
    var qs = 'from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + (market ? '&market=' + encodeURIComponent(market) : '');
    if (key === 'report-cancellations'){
      var r = await api('GET', '/reports/agent-cancellations?' + qs);
      if (!r.ok){ portalReportTables['report-cancellations'].setError(); return; }
      portalReportTables['report-cancellations'].setData(r.data.report.rows);
    } else if (key === 'rankings'){
      var r2 = await api('GET', '/reports/rankings?' + qs);
      if (!r2.ok){ portalReportTables['rankings-agents'].setError(); portalReportTables['rankings-companies'].setError(); return; }
      portalReportTables['rankings-agents'].setData(r2.data.report.agents);
      portalReportTables['rankings-companies'].setData(r2.data.report.companies);
    } else if (key === 'photographers'){
      var r3 = await api('GET', '/reports/photographers?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
      if (!r3.ok){ portalReportTables['photographers'].setError(); return; }
      portalReportTables['photographers'].setData(r3.data.report.rows);
    } else if (key === 'focus'){
      // The shared controls are month-granular; the Focus API wants whole days,
      // so the picked months are widened to cover themselves completely.
      var fFrom = from + '-01';
      var toParts = to.split('-');
      var lastDay = new Date(Number(toParts[0]), Number(toParts[1]), 0).getDate();
      var fTo = to + '-' + String(lastDay).padStart(2, '0');
      var bds = document.getElementById('prt-focus-bds').value;
      var focusRegion = document.getElementById('prt-focus-region').value;
      var cmp = document.getElementById('prt-focus-compare').value;
      var r4 = await api('GET', '/reports/focus?from=' + encodeURIComponent(fFrom) + '&to=' + encodeURIComponent(fTo) +
        '&compare=' + encodeURIComponent(cmp) + '&bds=' + encodeURIComponent(bds) +
        '&region=' + encodeURIComponent(focusRegion));
      if (!r4.ok){ portalReportTables['focus'].setError(); return; }
      portalReportTables['focus'].setData(r4.data.rows);
      var bsel = document.getElementById('prt-focus-bds');
      var keep = bsel.value;
      bsel.innerHTML = '<option value="">Everyone</option>' +
        (r4.data.bdsOptions || []).map(function(b){ return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('');
      bsel.value = keep;
      var gsel = document.getElementById('prt-focus-region');
      var keepRegion = gsel.value;
      gsel.innerHTML = '<option value="">All regions</option>' +
        (r4.data.regionOptions || []).map(function(g){ return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join('');
      gsel.value = (r4.data.regionOptions || []).indexOf(keepRegion) >= 0 ? keepRegion : '';
      document.getElementById('prt-focus-note').textContent =
        [r4.data.splitNote, r4.data.topPercentNote].filter(Boolean).join(' ');
    } else if (key === 'pipedrive-cleanup'){
      await renderPortalCleanup();
    } else if (key === 'past-due'){
      await renderPortalPastDue();
    }
  }

  // ── Collections queue (past-due accounts assigned to this user) ─────────────
  // The server only returns accounts assigned to the viewer, so this page is
  // their queue by construction — no client-side filtering to get wrong.
  var portalPastDueOpen = {}; // accountKey -> detail expanded
  function pdMoney(n){ return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
  function pdDate(ms){ return ms ? new Date(ms).toLocaleDateString() : '—'; }
  async function renderPortalPastDue(){
    var host = document.getElementById('prt-pastdue');
    host.innerHTML = '<div class="text-muted" style="padding:1rem">Loading…</div>';
    var r = await api('GET', '/financials/past-due');
    if (!r.ok){ host.innerHTML = '<div class="empty-state"><p>Could not load your collections queue.</p></div>'; return; }
    var accounts = (r.data.breakdown && r.data.breakdown.accounts) || [];
    var statuses = r.data.statuses || [];
    if (!accounts.length){
      host.innerHTML = '<div class="empty-state"><p>Nothing assigned to you yet — accounts show up here once someone assigns them.</p></div>';
      return;
    }
    var review = accounts.filter(function(a){ return a.needsManualReview && !(a.case && a.case.reviewClearedAt); }).length;
    var head = '<div class="card" style="margin-bottom:0.75rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">' +
      '<div style="font-weight:700">Your collections queue</div>' +
      '<div class="text-muted" style="font-size:0.85rem">' + accounts.length + ' account' + (accounts.length === 1 ? '' : 's') +
      ' · ' + pdMoney(r.data.breakdown.totalPastDue) + ' outstanding' +
      (review ? ' · ' + review + ' needing review' : '') + '</div></div>';
    host.innerHTML = head + accounts.map(function(a){ return portalPastDueCard(a, statuses); }).join('');
    bindPortalPastDue();
  }
  /**
   * The step, numbered so its place in the sequence is visible, and marked when
   * someone pinned it against what the account's age would call for.
   */
  function portalActionLabel(a){
    var act = a.action || {};
    var step = act.step ? act.step + ' · ' : '';
    return step + (act.label || '') + (act.source === 'override' ? ' (pinned)' : '');
  }

  /** Scheduled next contact, from the follow-up task raised on the account. */
  function portalNextContactLine(a){
    if (!a.nextContact) return '';
    var days = a.daysUntilContact;
    var when = days === 0 ? 'today' : days === 1 ? 'tomorrow'
      : days < 0 ? (days === -1 ? 'yesterday' : (-days) + ' days ago') : 'in ' + days + ' days';
    var late = days != null && days <= 0 ? 'color:#b7791f;font-weight:600' : '';
    return '<div class="text-muted" style="font-size:0.8rem;margin-top:0.2rem;' + late + '">' +
      'Next contact ' + esc(when) + ' · ' + esc(pdDate(a.nextContact.at)) + '</div>';
  }

  function portalPastDueCard(a, statuses){
    var c = a.case || {};
    var flagOpen = a.needsManualReview && !c.reviewClearedAt;
    var flag = flagOpen
      ? '<span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:999px;background:#fbf1dd;color:#b7791f;margin-left:0.4rem">⚠ Manual review</span>'
      : (a.needsManualReview ? '<span class="text-muted" style="font-size:0.72rem;margin-left:0.4rem">Reviewed</span>' : '');
    var due = c.dueAt ? '<span class="text-muted" style="font-size:0.78rem">Next action ' + esc(pdDate(c.dueAt)) + '</span>' : '';
    return '<div class="card" style="margin-bottom:0.5rem">' +
      '<div style="display:flex;gap:0.6rem;align-items:baseline;flex-wrap:wrap">' +
        '<span style="font-weight:600">' + esc(a.accountName) + '</span>' + flag +
        '<span style="margin-left:auto;font-weight:700">' + pdMoney(a.balance) + '</span>' +
      '</div>' +
      '<div class="text-muted" style="font-size:0.82rem;margin-top:0.2rem">' +
        esc(a.oldestDaysPastDue + ' days past due (' + a.bucket + ') · ' + a.invoiceCount + ' invoice' + (a.invoiceCount === 1 ? '' : 's')) +
        (a.partiallyPaidCount ? esc(', ' + a.partiallyPaidCount + ' partly paid') : '') +
      '</div>' +
      '<div class="text-muted" style="font-size:0.82rem;margin-top:0.2rem">' +
        '<strong>' + esc(portalActionLabel(a)) + ':</strong> ' + esc(a.action.detail) + '</div>' +
      portalNextContactLine(a) +
      (flagOpen ? '<div style="font-size:0.8rem;margin-top:0.4rem;padding:0.4rem 0.55rem;border-left:3px solid #b7791f;background:var(--surface2,#f6f7f9);border-radius:6px">' +
        'A partial payment sits behind this balance. Confirm what was agreed before the next collections step. ' +
        '<button class="btn btn-sm" data-pd-review="' + esc(a.accountKey) + '">Mark reviewed</button></div>' : '') +
      '<div style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;margin-top:0.5rem">' +
        '<label class="text-muted" style="font-size:0.78rem">Stage ' +
          '<select data-pd-status="' + esc(a.accountKey) + '" style="font-size:0.8rem;padding:0.25rem 0.4rem;margin-left:0.25rem">' +
          statuses.map(function(s){ return '<option value="' + esc(s.key) + '"' + (s.key === c.status ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') +
          '</select></label>' + due +
        '<button class="btn btn-sm" data-pd-toggle="' + esc(a.accountKey) + '" style="margin-left:auto">' +
          (portalPastDueOpen[a.accountKey] ? 'Hide notes' : 'Notes &amp; invoices') + '</button>' +
      '</div>' +
      '<div data-pd-detail="' + esc(a.accountKey) + '"' + (portalPastDueOpen[a.accountKey] ? '' : ' style="display:none"') + '></div>' +
    '</div>';
  }
  function bindPortalPastDue(){
    var host = document.getElementById('prt-pastdue');
    host.querySelectorAll('[data-pd-status]').forEach(function(sel){
      sel.addEventListener('change', async function(){
        var res = await api('PUT', '/financials/accounts/' + encodeURIComponent(sel.dataset.pdStatus) + '/status', { status: sel.value });
        if (!res.ok){ alert((res.data && res.data.error) || 'Could not update the stage.'); }
        await renderPortalPastDue();
      });
    });
    host.querySelectorAll('[data-pd-review]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        var res = await api('PUT', '/financials/accounts/' + encodeURIComponent(btn.dataset.pdReview) + '/review', { cleared: true });
        if (!res.ok){ alert((res.data && res.data.error) || 'Could not record the review.'); }
        await renderPortalPastDue();
      });
    });
    host.querySelectorAll('[data-pd-toggle]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        var key = btn.dataset.pdToggle;
        portalPastDueOpen[key] = !portalPastDueOpen[key];
        var panel = host.querySelector('[data-pd-detail="' + CSS.escape(key) + '"]');
        if (!portalPastDueOpen[key]){ panel.style.display = 'none'; btn.innerHTML = 'Notes &amp; invoices'; return; }
        panel.style.display = '';
        btn.textContent = 'Hide notes';
        await renderPortalPastDueDetail(key, panel);
      });
    });
    // Restore any panel left open across a re-render.
    Object.keys(portalPastDueOpen).forEach(function(key){
      if (!portalPastDueOpen[key]) return;
      var panel = host.querySelector('[data-pd-detail="' + CSS.escape(key) + '"]');
      if (panel) void renderPortalPastDueDetail(key, panel);
    });
  }
  async function renderPortalPastDueDetail(accountKey, panel){
    panel.innerHTML = '<div class="text-muted" style="font-size:0.8rem;padding:0.5rem 0">Loading…</div>';
    var r = await api('GET', '/financials/accounts/' + encodeURIComponent(accountKey));
    if (!r.ok){ panel.innerHTML = '<div class="text-muted" style="font-size:0.8rem">Could not load this account.</div>'; return; }
    var invoices = (r.data.invoices || []).map(function(i){
      var ref = esc(i.referenceNumber || i.invoiceId);
      // Opens the invoice in Spiro when the id is linkable; plain text if not.
      if (i.spiroUrl){
        ref = '<a href="' + esc(i.spiroUrl) + '" target="_blank" rel="noopener" title="Open in Spiro">' + ref + '</a>';
      }
      return '<tr><td>' + ref + (i.partiallyPaid ? ' <strong style="color:#b7791f">partial</strong>' : '') + '</td>' +
        '<td>' + pdMoney(i.amount) + '</td><td>' + (i.amountPaid === null ? '—' : pdMoney(i.amountPaid)) + '</td>' +
        '<td>' + pdMoney(i.outstanding) + '</td><td>' + esc(pdDate(i.dateDue)) + '</td><td>' + i.daysPastDue + '</td></tr>';
    }).join('');
    var notes = (r.data.notes || []).map(function(n){
      return '<div style="border:1px solid var(--border);border-radius:7px;padding:0.45rem 0.6rem;margin-bottom:0.35rem">' +
        '<div style="font-size:0.85rem">' + esc(n.body) + '</div>' +
        '<div class="text-muted" style="font-size:0.72rem;margin-top:0.2rem">' + esc(n.createdByName || 'Unknown') + ' · ' + esc(new Date(n.createdAt).toLocaleString()) + '</div>' +
      '</div>';
    }).join('') || '<div class="text-muted" style="font-size:0.8rem">No notes yet.</div>';
    panel.innerHTML =
      '<div style="margin-top:0.6rem;font-weight:700;font-size:0.85rem">Past-due invoices</div>' +
      '<div class="table-wrap"><table style="font-size:0.8rem"><thead><tr><th>Reference</th><th>Invoiced</th><th>Paid</th><th>Outstanding</th><th>Due</th><th>Days</th></tr></thead><tbody>' +
      (invoices || '<tr><td colspan="6" class="empty-state">No past-due invoices.</td></tr>') + '</tbody></table></div>' +
      '<div style="margin-top:0.6rem;font-weight:700;font-size:0.85rem">Notes</div>' +
      '<form data-pd-note-form="' + esc(accountKey) + '" style="display:flex;gap:0.4rem;margin:0.35rem 0 0.5rem">' +
        '<input type="text" placeholder="Add a note…" autocomplete="off" style="flex:1;font-size:0.82rem;padding:0.3rem 0.5rem" />' +
        '<button type="submit" class="btn btn-sm">Add</button></form>' +
      notes;
    var form = panel.querySelector('[data-pd-note-form]');
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      var input = form.querySelector('input');
      var body = input.value.trim();
      if (!body) return;
      var res = await api('POST', '/financials/notes', { accountKey: accountKey, body: body });
      if (!res.ok){ alert((res.data && res.data.error) || 'Could not add the note.'); return; }
      input.value = '';
      await renderPortalPastDueDetail(accountKey, panel);
    });
  }

  // ── Pipedrive Cleanup worklist (the one writable report) ────────────────────
  var PDC_CAT = {
    'duplicate-org':['Duplicate org','#7c3aed'], 'duplicate-person':['Duplicate person','#7c3aed'],
    'fields':['Missing fields','#2563eb'], 'dead-record':['Dead record','#b5473b'],
    'no-contacts':['No contacts','#b7791f'], 'no-deals':['No deals','#b7791f'],
    'orphan-deal':['Orphan deal','#b7791f'], 'uncontactable':['No contact info','#b7791f'],
    'not-brokerage':['Not a brokerage','#b5473b'], 'ambiguous':['Review','#b7791f']
  };
  var PDC_KIND = { merge:['Merge','#7c3aed'], fill:['Set office','#2563eb'], exclude:['Not a brokerage','#b5473b'], review:['Review','#b7791f'] };
  function pdcBadge(it){
    var cat = it.payload && it.payload.category;
    var m = PDC_CAT[cat] || PDC_KIND[it.kind] || [it.kind, '#666666'];
    return '<span style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;padding:2px 7px;border-radius:5px;background:'+m[1]+'1a;color:'+m[1]+'">'+esc(m[0])+'</span>';
  }
  function pdcRecords(payload){
    var recs = payload && payload.records;
    if (!recs || !recs.length) return '';
    var cards = recs.map(function(r){
      var role = r.role ? '<span style="font-size:0.62rem;font-weight:700;text-transform:uppercase;color:'+(r.role==='Keep'?'#16855c':'#b5473b')+'">'+esc(r.role)+'</span> ' : '';
      var href = (r.url && (r.url.indexOf('https://')===0 || r.url.indexOf('http://')===0)) ? r.url : null;
      var name = href
        ? '<a href="'+esc(href)+'" target="_blank" rel="noopener" style="font-weight:600;color:var(--accent,#2563eb);text-decoration:none">'+esc(r.label)+' ↗</a>'
        : '<span style="font-weight:600">'+esc(r.label)+'</span>';
      var meta = r.meta ? '<div class="text-muted" style="font-size:0.72rem">'+esc(r.meta)+'</div>' : '';
      return '<div style="padding:0.35rem 0.5rem;border:1px solid var(--border);border-radius:7px">'+role+name+meta+'</div>';
    }).join('');
    return '<div style="display:grid;gap:0.3rem;margin-top:0.45rem;margin-left:1.6rem">'+cards+'</div>';
  }
  async function renderPortalCleanup(){
    var host = document.getElementById('prt-pdc');
    host.innerHTML = '<div class="text-muted" style="padding:1rem">Loading…</div>';
    var r = await api('GET', '/reports/pipedrive-cleanup');
    if (!r.ok){ host.innerHTML = '<div class="empty-state"><p>Could not load your worklist.</p></div>'; return; }
    var items = (r.data.items || []).filter(function(i){ return i.status === 'approved' || i.status === 'done'; });
    if (!items.length){ host.innerHTML = '<div class="empty-state"><p>Nothing to do yet — approved tasks show up here.</p></div>'; return; }
    var done = items.filter(function(i){ return i.status === 'done'; }).length;
    var head = '<div class="card" style="margin-bottom:0.75rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap"><div style="font-weight:700">Your worklist</div><div class="text-muted" style="font-size:0.85rem">' + done + ' of ' + items.length + ' done</div></div>';
    var rows = items.map(function(it){
      var checked = it.status === 'done' ? ' checked' : '';
      var office = it.office ? '<span style="font-family:monospace;font-size:0.8rem;background:var(--border);border-radius:5px;padding:1px 6px;margin-left:0.4rem">Office: ' + esc(it.office) + '</span>' : '';
      var verify = it.verify ? '<span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:999px;background:#fbf1dd;color:#b7791f;margin-left:0.4rem">⚠ Verify first</span>' : '';
      return '<div class="card" style="margin-bottom:0.5rem' + (it.status === 'done' ? ';opacity:0.65' : '') + '">' +
        '<label style="display:flex;gap:0.6rem;align-items:flex-start;cursor:pointer">' +
        '<input type="checkbox" data-pdc-done="' + esc(it.id) + '"' + checked + ' style="margin-top:0.2rem">' +
        '<span>' + pdcBadge(it) + ' <span style="font-weight:600">' + esc(it.title) + '</span>' + verify + office +
        '<div class="text-muted" style="font-size:0.85rem;margin-top:0.2rem">' + esc(it.detail) + '</div></span>' +
        '</label>' +
        pdcRecords(it.payload) +
        '<div style="margin-top:0.4rem;padding-left:1.6rem"><input type="text" placeholder="Add a note (optional)" data-pdc-note="' + esc(it.id) + '" value="' + esc(it.note || '') + '" style="width:100%;max-width:32rem;font-size:0.8rem;padding:0.3rem 0.5rem"></div>' +
        '</div>';
    }).join('');
    host.innerHTML = head + rows;
    host.querySelectorAll('[data-pdc-done]').forEach(function(cb){
      cb.addEventListener('change', async function(){
        var r2 = await api('PUT', '/reports/pipedrive-cleanup/items/' + cb.dataset.pdcDone + '/done', { done: cb.checked });
        if (!r2.ok){ alert((r2.data && r2.data.error) || 'Could not update.'); }
        await renderPortalCleanup();
      });
    });
    host.querySelectorAll('[data-pdc-note]').forEach(function(inp){
      inp.addEventListener('change', async function(){
        await api('PUT', '/reports/pipedrive-cleanup/items/' + inp.dataset.pdcNote + '/note', { note: inp.value });
      });
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function navigate(page) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');
    const navEl = document.querySelector('.nav-link[data-page="' + page + '"]');
    if (navEl) navEl.classList.add('active');
    if (page === 'resources') loadResources();
    if (page === 'tasks') loadTasksPage();
    if (page === 'reports') loadReportsPage();
  }

  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.dataset.page);
    });
  });

  // ── Chat iframe ────────────────────────────────────────────────────────────
  function mountChatFrame(cfg) {
    const frame = document.getElementById('chat-frame');
    // Pass credentials via hash fragment — the control UI reads #token=, #gatewayUrl=,
    // and #portalToken= on load and strips them from the URL.
    // NOTE: cfg.gatewayToken is this user's own portal session token, NOT the
    // shared gateway secret. The gateway authenticates it as a portal-session
    // and caps the connection's scopes, so it is safe to hand to the browser.
    // Hash params don't appear in server logs. sessionStorage is per-frame and can't be
    // pre-seeded from the parent, so URL fragment is the correct handoff mechanism.
    const hash = [];
    if (cfg.gatewayWsUrl) hash.push('gatewayUrl=' + encodeURIComponent(cfg.gatewayWsUrl));
    const credential = cfg.gatewayToken || cfg.gatewayPassword || '';
    if (credential) hash.push('token=' + encodeURIComponent(credential));
    const portalToken = cfg.portalSessionToken || localStorage.getItem('oc_portal_token') || '';
    if (portalToken) hash.push('portalToken=' + encodeURIComponent(portalToken));
    frame.src = '/chat' + (hash.length ? '#' + hash.join('&') : '');
  }

  // ── Resources ─────────────────────────────────────────────────────────────
  function resourceTypeIcon(type) {
    if (type === 'file') return '📄';
    if (type === 'link') return '🔗';
    if (type === 'text') return '📝';
    return '📦';
  }

  function resourceCardHtml(r) {
    const tags = (r.tags ?? []).map(t => '<span class="resource-tag">' + esc(t) + '</span>').join('');
    let footer = '';
    if (r.type === 'file') {
      footer = '<a href="/api/admin/resources/' + esc(r.id) + '/file" class="btn btn-ghost btn-sm" download>Download</a>';
    } else if (r.type === 'link' && r.url) {
      footer = '<a href="' + esc(r.url) + '" target="_blank" rel="noreferrer noopener" class="btn btn-ghost btn-sm">Open Link</a>';
    }
    return '<div class="resource-card">' +
      '<div class="resource-card-body">' +
        '<div class="resource-title">' + resourceTypeIcon(r.type) + ' ' + esc(r.title) + '</div>' +
        (r.description ? '<div class="resource-desc">' + esc(r.description) + '</div>' : '') +
        (tags ? '<div class="resource-tags">' + tags + '</div>' : '') +
      '</div>' +
      (footer ? '<div class="resource-card-footer">' + footer + '</div>' : '') +
    '</div>';
  }

  async function loadResources() {
    const container = document.getElementById('resources-container');
    container.innerHTML = '<div class="empty-state"><p>Loading…</p></div>';
    const r = await api('GET', '/resources');
    const resources = r.ok ? (r.data.resources ?? []) : [];
    if (!resources.length) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<p>No resources are available to you yet.</p>' +
          '<p style="margin-top:0.35rem;font-size:0.8rem">An admin can make resources available by enabling <strong>User Access</strong> in the Resource Library.</p>' +
        '</div>';
      return;
    }
    container.innerHTML = '<div class="resources-grid">' + resources.map(resourceCardHtml).join('') + '</div>';
  }

  // ── Projects & Tasks ────────────────────────────────────────────────────────
  let ptProjects = [];
  let ptTasks = [];
  let ptUsers = [];
  let ptFilter = 'all';
  let ptEditingTask = null;
  let ptEditingProject = null;

  // Board columns are per-project data served by the API (task-status-ui.ts),
  // so the portal draws exactly the same columns the dashboard does.
  const ptStatuses = createStatusRegistry({ api: api });
  setTaskStatusResolver({
    isDone: function(status, task) {
      return ptStatuses.isDone(task ? task.projectId || '' : ptBoardId(), status);
    },
    label: function(status, task) {
      return ptStatuses.labelOf(task ? task.projectId || '' : ptBoardId(), status);
    },
    color: function(status, task) {
      return ptStatuses.colorOf(task ? task.projectId || '' : ptBoardId(), status);
    },
    rank: function(status, task) {
      return ptStatuses.rankOf(task ? task.projectId || '' : ptBoardId(), status);
    },
    all: function(tasks) {
      return ptStatuses.columnsForView(ptBoardId(), tasks || []);
    },
  });

  /** The board in view: a chosen project, or '' for the global set. */
  function ptBoardId() {
    return ptFilter === 'all' ? '' : ptFilter;
  }

  function ptFullName(u) { return [u && u.firstName, u && u.lastName].filter(Boolean).join(' '); }
  function ptUserLabel(id) {
    const u = ptUsers.find(function(x) { return x.id === id; });
    if (!u) return id;
    return ptFullName(u) || u.username;
  }

  async function ensurePtUsers() {
    if (ptUsers.length) return;
    const r = await api('GET', '/users/directory');
    if (r.ok) ptUsers = r.data.users || [];
  }

  function ptRenderMemberPicker(containerId, selectedIds) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const selected = new Set(selectedIds || []);
    if (!ptUsers.length) { box.innerHTML = '<div class="member-empty">No other users available.</div>'; return; }
    box.innerHTML = ptUsers.map(function(u) {
      const name = ptFullName(u);
      const label = name || u.username;
      const sub = name ? u.username : '';
      return '<label class="member-row"><input type="checkbox" value="' + esc(u.id) + '"' + (selected.has(u.id) ? ' checked' : '') + '>' +
        '<span>' + esc(label) + (sub ? ' <span class="member-sub">' + esc(sub) + '</span>' : '') + '</span></label>';
    }).join('');
  }
  /** One owner per task; see the dashboard's renderAssigneeSelect for why. */
  function ptRenderAssigneeSelect(selectedIds) {
    const sel = document.getElementById('pt-t-assignee');
    if (!sel) return;
    const current = (selectedIds || [])[0] || '';
    sel.innerHTML = '<option value="">Unassigned</option>' + ptUsers.map(function(u) {
      const name = ptFullName(u) || u.username;
      return '<option value="' + esc(u.id) + '"' + (u.id === current ? ' selected' : '') + '>' + esc(name) + '</option>';
    }).join('');
    sel.value = current;
  }

  function ptReadAssigneeSelect() {
    const sel = document.getElementById('pt-t-assignee');
    const v = sel ? sel.value : '';
    return v ? [v] : [];
  }

  function ptReadMemberPicker(containerId) {
    return Array.prototype.slice.call(document.querySelectorAll('#' + containerId + ' input[type=checkbox]:checked')).map(function(cb) { return cb.value; });
  }


  async function loadTasksPage() {
    await ensurePtUsers();
    const [pr, tr] = await Promise.all([api('GET', '/projects'), api('GET', '/tasks')]);
    ptProjects = pr.ok ? (pr.data.projects || []) : [];
    ptTasks = tr.ok ? (tr.data.tasks || []) : [];
    const sel = document.getElementById('pt-project-filter');
    const prev = sel.value;
    sel.innerHTML = '<option value="all">All Projects</option>' +
      ptProjects.map(function(p) { return '<option value="' + esc(p.id) + '">' + esc(p.title) + '</option>'; }).join('');
    sel.value = prev && (prev === 'all' || ptProjects.find(function(p) { return p.id === prev; })) ? prev : 'all';
    ptFilter = sel.value;
    document.getElementById('pt-edit-project').disabled = ptFilter === 'all';
    // Columns before the first paint, or the board draws the seed set and jumps.
    await ptStatuses.ensure(ptProjects.map(function(p) { return p.id; }));
    ptRenderView();
  }

  /** Tasks in scope before the filter bar — project picker only. */
  function ptTasksInScope() {
    return ptTasks.filter(function(t) {
      if (t.parentTaskId) return false;
      if (ptFilter !== 'all') return t.projectId === ptFilter;
      return true;
    });
  }

  // Same filter bar the dashboard uses, over this member's own scoped tasks.
  const ptFilterBar = createTaskFilterBar({
    rootId: 'pt-filter-bar',
    onChange: function() { ptRenderView(); },
    people: function() {
      return ptUsers.map(function(u) { return { id: u.id, name: u.username }; });
    },
    tags: function() {
      const set = {};
      ptTasksInScope().forEach(function(t) { (t.tags || []).forEach(function(g) { set[g] = 1; }); });
      return Object.keys(set).sort();
    },
    currentUserId: function() { return currentUser ? currentUser.id : null; },
  });

  /** Top-level tasks under the project picker and the filter bar. */
  function ptVisibleTasks() {
    return ptFilterBar.apply(ptTasksInScope());
  }

  const ptTaskList = createTaskList({
    rootId: 'pt-tasklist',
    tasks: ptVisibleTasks,
    projectFor: function(t) {
      return t.projectId ? ptProjects.find(function(p) { return p.id === t.projectId; }) || null : null;
    },
    userLabel: function(id) {
      const u = ptUsers.find(function(x) { return x.id === id; });
      return u ? u.username : id;
    },
    onOpen: function(id) {
      const t = ptTasks.find(function(x) { return x.id === id; });
      if (t) ptOpenTask(t);
    },
    onPatch: async function(id, patch) {
      const r = await api('PUT', '/tasks/' + id, patch);
      if (r.ok) await loadTasksPage();
    },
    groupBy: function() { return ''; },
  });

  /** Projects the calendar can place: under the filter and carrying a date. */
  function ptCalendarProjects() {
    return ptProjects.filter(function(p) {
      if (ptFilter !== 'all' && p.id !== ptFilter) return false;
      return p.startDate || p.endDate;
    });
  }

  // The same month grid the dashboard draws (project-calendar-ui.ts), fed this
  // portal's own scoped data — a member only ever sees the projects and tasks
  // the API already scopes to them.
  const ptCalendar = createProjectCalendar({
    rootId: 'pt-calendar',
    tasks: ptVisibleTasks,
    projects: ptCalendarProjects,
    taskColor: function(t) {
      const proj = t.projectId ? ptProjects.find(function(p) { return p.id === t.projectId; }) : null;
      return proj ? proj.color : '#6b7280';
    },
    onTask: function(id) {
      const t = ptTasks.find(function(x) { return x.id === id; });
      if (t) ptOpenTask(t);
    },
    onProject: function(id) {
      const p = ptProjects.find(function(x) { return x.id === id; });
      if (p) ptOpenProject(p);
    },
    onDay: function(ms) { ptOpenTask(null, ms); },
  });

  /**
   * Tasks My Work may show. Unlike the board this keeps subtasks — a subtask
   * assigned to you is still your work.
   */
  function ptMyWorkScope() {
    return ptTasks.filter(function(t) {
      return ptFilter === 'all' || t.projectId === ptFilter;
    });
  }

  // The same personal list the dashboard lands on, over this member's own tasks.
  const ptMyWork = createMyWork({
    rootId: 'pt-mywork',
    tasks: function() { return ptFilterBar.apply(ptMyWorkScope()); },
    currentUserId: function() { return currentUser ? currentUser.id : null; },
    isDone: function(t) { return ptStatuses.isDoneTask(t); },
    projectFor: function(t) {
      return t.projectId ? ptProjects.find(function(p) { return p.id === t.projectId; }) || null : null;
    },
    onOpen: function(id) {
      const t = ptTasks.find(function(x) { return x.id === id; });
      if (t) ptOpenTask(t);
    },
    onToggleDone: async function(id, done) {
      const t = ptTasks.find(function(x) { return x.id === id; });
      const board = t ? t.projectId || '' : '';
      const next = done ? ptStatuses.doneKey(board) : ptStatuses.defaultKey(board);
      const r = await api('PUT', '/tasks/' + id, { status: next });
      if (r.ok) await loadTasksPage();
    },
  });

  // My Work is the landing view here too — a member opening the portal wants
  // their own list, not the whole board.
  let ptView = 'mywork'; // 'mywork' | 'board' | 'calendar' | 'list'

  const PT_VIEW_BUTTONS = [
    ['pt-view-mywork', 'mywork'],
    ['pt-view-board', 'board'],
    ['pt-view-cal', 'calendar'],
    ['pt-view-list', 'list'],
  ];

  function ptSwitchView(view) {
    ptView = view;
    document.getElementById('pt-mywork').classList.toggle('hidden', view !== 'mywork');
    document.getElementById('pt-board').classList.toggle('hidden', view !== 'board');
    document.getElementById('pt-calendar').classList.toggle('hidden', view !== 'calendar');
    document.getElementById('pt-tasklist').classList.toggle('hidden', view !== 'list');
    PT_VIEW_BUTTONS.forEach(function(pair) {
      document.getElementById(pair[0]).classList.toggle('active', view === pair[1]);
    });
    try { localStorage.setItem('oc_portal_view', view); } catch (e) { /* private mode */ }
    ptRenderView();
  }

  PT_VIEW_BUTTONS.forEach(function(pair) {
    document.getElementById(pair[0]).addEventListener('click', function() { ptSwitchView(pair[1]); });
  });

  (function ptRestoreView() {
    let saved = null;
    try { saved = localStorage.getItem('oc_portal_view'); } catch (e) { /* private mode */ }
    if (saved && PT_VIEW_BUTTONS.some(function(pair) { return pair[1] === saved; })) ptView = saved;
    PT_VIEW_BUTTONS.forEach(function(pair) {
      document.getElementById(pair[0]).classList.toggle('active', ptView === pair[1]);
    });
    document.getElementById('pt-mywork').classList.toggle('hidden', ptView !== 'mywork');
    document.getElementById('pt-board').classList.toggle('hidden', ptView !== 'board');
    document.getElementById('pt-calendar').classList.toggle('hidden', ptView !== 'calendar');
    document.getElementById('pt-tasklist').classList.toggle('hidden', ptView !== 'list');
  })();

  document.getElementById('pt-tool-menu-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('pt-tool-menu-pop').classList.toggle('hidden');
  });
  document.addEventListener('click', function(e) {
    const pop = document.getElementById('pt-tool-menu-pop');
    if (!pop || pop.classList.contains('hidden')) return;
    if (e.target.closest('#pt-tool-menu-pop') || e.target.closest('#pt-tool-menu-btn')) return;
    pop.classList.add('hidden');
  });

  /** Draw whichever view is on. Called after every load and mutation. */
  function ptRenderView() {
    ptFilterBar.refreshOptions();
    if (ptView === 'mywork') ptMyWork.render();
    else if (ptView === 'calendar') ptCalendar.render();
    else if (ptView === 'list') ptTaskList.render();
    else ptRenderBoard();
    if (ptView === 'mywork') {
      // Counting every task here would be misleading — this view is only ever
      // the member's own.
      const uid = currentUser ? currentUser.id : null;
      ptFilterBar.setCount(
        myWorkTasks(ptFilterBar.apply(ptMyWorkScope()), uid).length,
        myWorkTasks(ptMyWorkScope(), uid).length,
      );
    } else {
      ptFilterBar.setCount(ptVisibleTasks().length, ptTasksInScope().length);
    }
  }

  function ptRenderBoard() {
    const board = document.getElementById('pt-board');
    const tasks = ptVisibleTasks();
    board.innerHTML = '<div class="board-wrap">' + ptStatuses.columnsForView(ptBoardId(), tasks).map(function(st) {
      const matching = tasks
        .filter(function(t) { return t.status === st.key; })
        .sort(function(a, b) { return a.position - b.position || a.createdAt - b.createdAt; });
      const cards = matching.length
        ? matching.map(ptTaskCard).join('')
        : '<div class="board-empty">No tasks</div>';
      // A WIP limit colours the count; it never blocks a drop.
      const overWip = st.wipLimit != null && matching.length > st.wipLimit;
      return '<div class="board-col" data-status="' + esc(st.key) + '" style="border-top:2px solid ' + esc(st.color) + '">' +
        '<div class="board-col-head">' +
          '<span><span class="board-col-dot" style="background:' + esc(st.color) + '"></span>' + esc(st.label) + '</span>' +
          '<span class="board-col-count' + (overWip ? ' over-wip' : '') + '">' +
            matching.length + (st.wipLimit != null ? ' / ' + st.wipLimit : '') +
          '</span>' +
        '</div>' +
        cards +
      '</div>';
    }).join('') + '</div>';
    board.querySelectorAll('.task-card').forEach(function(card) {
      card.addEventListener('click', function() {
        const t = ptTasks.find(function(x) { return x.id === card.dataset.id; });
        if (t) ptOpenTask(t);
      });
    });
  }

  // ── Board drag & drop ──────────────────────────────────────────────────────
  // Columns are rebuilt on every render, so listeners live on the board root.
  let ptDragId = null;

  function ptClearDropMarkers() {
    document.querySelectorAll('#pt-board .task-drop-slot').forEach(function(el) { el.remove(); });
    document.querySelectorAll('#pt-board .board-col').forEach(function(c) { c.classList.remove('drag-over'); });
  }

  function ptCardAfterPoint(col, y) {
    const cards = Array.prototype.slice.call(col.querySelectorAll('.task-card:not(.dragging)'));
    for (let i = 0; i < cards.length; i++) {
      const box = cards[i].getBoundingClientRect();
      if (y < box.top + box.height / 2) return cards[i];
    }
    return null;
  }

  const ptBoardEl = document.getElementById('pt-board');
  ptBoardEl.addEventListener('dragstart', function(e) {
    const card = e.target.closest('.task-card');
    if (!card) return;
    ptDragId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.id);
  });
  ptBoardEl.addEventListener('dragend', function() {
    document.querySelectorAll('#pt-board .task-card.dragging').forEach(function(el) { el.classList.remove('dragging'); });
    ptClearDropMarkers();
    ptDragId = null;
  });
  ptBoardEl.addEventListener('dragover', function(e) {
    if (!ptDragId) return;
    const col = e.target.closest('.board-col');
    if (!col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('#pt-board .board-col').forEach(function(c) { c.classList.toggle('drag-over', c === col); });
    const empty = col.querySelector('.board-empty');
    if (empty) empty.remove();
    let slot = document.querySelector('#pt-board .task-drop-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'task-drop-slot';
    }
    const before = ptCardAfterPoint(col, e.clientY);
    if (before) col.insertBefore(slot, before);
    else col.appendChild(slot);
  });
  ptBoardEl.addEventListener('drop', async function(e) {
    if (!ptDragId) return;
    const col = e.target.closest('.board-col');
    if (!col) return;
    e.preventDefault();
    const slot = col.querySelector('.task-drop-slot');
    const siblings = Array.prototype.slice.call(col.children).filter(function(el) {
      return el.classList.contains('task-card') && el.dataset.id !== ptDragId;
    });
    let index = siblings.length;
    if (slot) {
      let next = slot.nextElementSibling;
      while (next && !next.classList.contains('task-card')) next = next.nextElementSibling;
      const found = next ? siblings.indexOf(next) : -1;
      if (found >= 0) index = found;
    }
    const movedId = ptDragId;
    const status = col.dataset.status;
    ptDragId = null;
    ptClearDropMarkers();
    await ptMoveTask(movedId, status, index);
  });

  /** Persist a dropped card and renumber its column so positions stay dense. */
  async function ptMoveTask(taskId, status, index) {
    const task = ptTasks.find(function(t) { return t.id === taskId; });
    if (!task) return;
    const column = ptTasks
      .filter(function(t) {
        if (t.parentTaskId || t.id === taskId || t.status !== status) return false;
        return ptFilter === 'all' || t.projectId === ptFilter;
      })
      .sort(function(a, b) { return a.position - b.position || a.createdAt - b.createdAt; });
    const clamped = Math.max(0, Math.min(index, column.length));
    column.splice(clamped, 0, task);
    const positionsBefore = new Map(column.map(function(t) { return [t.id, t.position]; }));

    task.status = status;
    column.forEach(function(t, i) { t.position = i; });
    ptRenderBoard();

    const writes = column.map(function(t, i) {
      if (t.id === taskId) return api('PUT', '/tasks/' + t.id, { status: status, position: i });
      return positionsBefore.get(t.id) === i ? null : api('PUT', '/tasks/' + t.id, { position: i });
    }).filter(Boolean);
    const results = await Promise.all(writes);
    if (results.some(function(r) { return !r.ok; })) {
      alert('Could not move that task.');
      await loadTasksPage();
      return;
    }
    // A recurring task completed on drop spawns its next occurrence server-side.
    if (ptStatuses.isDone(task.projectId || '', status) && task.recurrence) await loadTasksPage();
  }

  // ── Attachments on a task ──────────────────────────────────────────────────
  function ptFormatFilesize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async function ptLoadAttachments(taskId) {
    const box = document.getElementById('pt-attach-list');
    const r = await api('GET', '/tasks/' + taskId + '/attachments');
    const items = (r.ok && r.data.attachments) || [];
    if (!items.length) { box.innerHTML = '<div class="attach-empty">Nothing attached yet.</div>'; return; }
    box.innerHTML = items.map(function(a) {
      const isLink = a.type === 'link';
      return '<div class="attach-row">' +
        '<span>' + (isLink ? '🔗' : '📄') + '</span>' +
        '<a class="attach-name' + (isLink ? '' : ' pt-attach-download') + '" href="' + esc(isLink ? a.url : '#') + '"' +
          (isLink ? ' target="_blank" rel="noopener noreferrer"' : '') +
          ' data-id="' + esc(a.id) + '" data-name="' + esc(a.filename || a.title) + '">' + esc(a.title) + '</a>' +
        (a.filesize ? '<span class="attach-size">' + esc(ptFormatFilesize(a.filesize)) + '</span>' : '') +
        '<button type="button" class="attach-del" data-id="' + esc(a.id) + '" title="Remove">✕</button>' +
      '</div>';
    }).join('');
    box.querySelectorAll('.attach-del').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const r2 = await api('DELETE', '/attachments/' + this.dataset.id);
        if (!r2.ok) { alert('Could not remove that attachment.'); return; }
        await ptLoadAttachments(taskId);
        await loadTasksPage();
      });
    });
    box.querySelectorAll('.pt-attach-download').forEach(function(link) {
      link.addEventListener('click', async function(e) {
        e.preventDefault();
        const res = await fetch('/api/admin/attachments/' + this.dataset.id + '/file', {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) { alert('Could not download that file.'); return; }
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl; a.download = this.dataset.name || 'file';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(objectUrl);
      });
    });
  }

  document.getElementById('pt-attach-link-btn').addEventListener('click', async function() {
    if (!ptEditingTask) return;
    const input = document.getElementById('pt-attach-url');
    const url = input.value.trim();
    if (!url) return;
    if (!/^https?:\\/\\//i.test(url)) { alert('Links must start with http:// or https://'); return; }
    const r = await api('POST', '/tasks/' + ptEditingTask + '/attachments', { type: 'link', url: url, title: url });
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not add that link.'); return; }
    input.value = '';
    await ptLoadAttachments(ptEditingTask);
    await loadTasksPage();
  });
  document.getElementById('pt-attach-file-btn').addEventListener('click', function() {
    document.getElementById('pt-attach-file').click();
  });
  document.getElementById('pt-attach-file').addEventListener('change', async function() {
    const file = this.files && this.files[0];
    this.value = '';
    if (!file || !ptEditingTask) return;
    if (file.size > 15 * 1024 * 1024) { alert('That file is larger than 15 MB.'); return; }
    const dataUrl = await new Promise(function(resolve) {
      const reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function() { resolve(null); };
      reader.readAsDataURL(file);
    });
    if (!dataUrl) { alert('Could not read that file.'); return; }
    const r = await api('POST', '/tasks/' + ptEditingTask + '/attachments', {
      type: 'file', fileData: String(dataUrl).split(',')[1] || '', filename: file.name,
      mimetype: file.type || 'application/octet-stream', title: file.name,
    });
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not upload that file.'); return; }
    await ptLoadAttachments(ptEditingTask);
    await loadTasksPage();
  });

  function ptTaskCard(task) {
    const proj = task.projectId ? ptProjects.find(function(p) { return p.id === task.projectId; }) : null;
    const color = proj ? (proj.color || '#3b82f6') : '#94a3b8';
    let html = '<div class="task-card" draggable="true" data-id="' + esc(task.id) + '" style="border-left:4px solid ' + esc(color) + '">';
    html += '<div class="task-card-head">';
    html += '<div class="task-card-title">' + esc(task.title) + '</div>';
    html += '<span class="task-chip prio-' + esc(task.priority) + '">' + esc(task.priority) + '</span>';
    html += '</div>';
    if (proj) html += '<div class="task-card-proj">' + esc(proj.title) + '</div>';
    if (task.description) html += '<div class="task-card-desc">' + esc(task.description) + '</div>';
    html += '<div class="task-card-meta">';
    if (task.dueDate) {
      // Shared due chip: overdue / today / this week / later, never red on done.
      html += dueChip(task);
    }
    if (task.attachmentCount) html += '<span class="task-chip">📎 ' + task.attachmentCount + '</span>';
    if (task.commentCount) html += '<span class="task-chip">💬 ' + task.commentCount + '</span>';
    html += '</div>';
    // Every assignee named, rather than the old "+N" truncation.
    const names = (task.assigneeIds || []).map(ptUserLabel);
    if (names.length) {
      html += '<div class="task-card-meta">' + names.map(function(n) {
        return '<span class="task-chip">👤 ' + esc(n) + '</span>';
      }).join('') + '</div>';
    }
    html += '</div>';
    return html;
  }

  function ptPopulateProjectSelect(selectedId) {
    document.getElementById('pt-t-project').innerHTML = '<option value="">— No Project —</option>' +
      ptProjects.map(function(p) { return '<option value="' + esc(p.id) + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.title) + '</option>'; }).join('');
  }

  /**
   * Fill the status picker from the chosen project's board, keeping the current
   * value when that board has the column and falling back to its first one.
   */
  function ptSyncStatusOptions(preferred) {
    const sel = document.getElementById('pt-t-status');
    const projectId = document.getElementById('pt-t-project').value || '';
    const want = preferred || sel.value;
    const cols = ptStatuses.columnsFor(projectId);
    sel.innerHTML = cols.map(function(c) {
      return '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>';
    }).join('');
    sel.value = cols.some(function(c) { return c.key === want; }) ? want : ptStatuses.defaultKey(projectId);
  }

  document.getElementById('pt-t-project').addEventListener('change', function() { ptSyncStatusOptions(); });

  // Task modal
  document.getElementById('pt-new-task').addEventListener('click', function() { ptOpenTask(null); });
  // Comment thread + activity history, the same component the dashboard uses.
  const ptFeed = createTaskFeed({
    rootId: 'pt-feed',
    api: api,
    get currentUserId() { return currentUser ? currentUser.id : null; },
    get isAdmin() { return currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin'); },
    people: function() {
      return ptUsers.map(function(u) { return { id: u.id, name: u.username }; });
    },
    labelFor: function(field, value) {
      if (field === 'projectId') {
        const p = ptProjects.find(function(x) { return x.id === value; });
        return p ? p.title : null;
      }
      if (field === 'assignees') {
        return String(value).split(',').filter(Boolean).map(function(id) {
          const u = ptUsers.find(function(x) { return x.id === id; });
          return u ? u.username : id;
        }).join(', ');
      }
      if (field === 'dueDate') {
        const n = Number(value);
        return Number.isFinite(n) ? new Date(n).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
      }
      // History can name a column that has since been renamed or dropped, so
      // this falls through to the raw key rather than inventing a label.
      if (field === 'status') {
        const t = ptTasks.find(function(x) { return x.id === ptEditingTask; });
        return ptStatuses.labelOf(t ? t.projectId || '' : '', value) || TF_STATUS_LABELS[value] || value;
      }
      return null;
    },
  });

  /** presetDueMs prefills the due date when the task is started from a calendar cell. */
  function ptOpenTask(task, presetDueMs) {
    ptEditingTask = task ? task.id : null;
    document.getElementById('pt-task-title').textContent = task ? 'Edit Task' : 'New Task';
    document.getElementById('pt-task-error').classList.add('hidden');
    document.getElementById('pt-t-title').value = task ? task.title : '';
    document.getElementById('pt-t-desc').value = task ? (task.description || '') : '';
    document.getElementById('pt-t-priority').value = task ? task.priority : 'medium';
    ptPopulateProjectSelect(task ? (task.projectId || '') : (ptFilter !== 'all' ? ptFilter : ''));
    ptSyncStatusOptions(task ? task.status : ptStatuses.defaultKey(ptBoardId()));
    document.getElementById('pt-t-due').value = task && task.dueDate
      ? calDateInputValue(task.dueDate)
      : (presetDueMs ? calDateInputValue(presetDueMs) : '');
    ptRenderAssigneeSelect(task ? (task.assigneeIds || []) : []);
    document.getElementById('pt-task-delete').classList.toggle('hidden', !task);
    // Attachments need a task id to hang off, so they appear once it exists.
    document.getElementById('pt-attach-section').classList.toggle('hidden', !task);
    document.getElementById('pt-feed-section').classList.toggle('hidden', !task);
    if (task) ptFeed.load(task.id); else ptFeed.clear();
    document.getElementById('pt-attach-url').value = '';
    if (task) ptLoadAttachments(task.id);
    document.getElementById('pt-task-modal').classList.remove('hidden');
    document.getElementById('pt-t-title').focus();
  }
  document.getElementById('pt-task-cancel').addEventListener('click', function() {
    document.getElementById('pt-task-modal').classList.add('hidden');
  });
  document.getElementById('pt-task-delete').addEventListener('click', async function() {
    if (!ptEditingTask || !confirm('Delete this task?')) return;
    const r = await api('DELETE', '/tasks/' + ptEditingTask);
    if (r.ok) { document.getElementById('pt-task-modal').classList.add('hidden'); await loadTasksPage(); }
  });
  document.getElementById('pt-task-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const errEl = document.getElementById('pt-task-error');
    errEl.classList.add('hidden');
    const dueVal = document.getElementById('pt-t-due').value;
    const body = {
      title: document.getElementById('pt-t-title').value.trim(),
      description: document.getElementById('pt-t-desc').value.trim() || null,
      status: document.getElementById('pt-t-status').value,
      priority: document.getElementById('pt-t-priority').value,
      projectId: document.getElementById('pt-t-project').value || null,
      dueDate: calDateInputMs(dueVal),
      assigneeIds: ptReadAssigneeSelect(),
    };
    const r = ptEditingTask
      ? await api('PUT', '/tasks/' + ptEditingTask, body)
      : await api('POST', '/tasks', body);
    if (!r.ok) { errEl.textContent = (r.data && r.data.error) || 'Failed to save task.'; errEl.classList.remove('hidden'); return; }
    document.getElementById('pt-task-modal').classList.add('hidden');
    await loadTasksPage();
  });

  // Project modal
  document.getElementById('pt-new-project').addEventListener('click', function() { ptOpenProject(null); });
  document.getElementById('pt-edit-project').addEventListener('click', function() {
    const p = ptProjects.find(function(x) { return x.id === ptFilter; });
    if (p) ptOpenProject(p);
  });
  document.getElementById('pt-project-filter').addEventListener('change', function() {
    ptFilter = this.value;
    document.getElementById('pt-edit-project').disabled = ptFilter === 'all';
    ptRenderView();
  });
  function ptOpenProject(project) {
    ptEditingProject = project ? project.id : null;
    document.getElementById('pt-project-title').textContent = project ? 'Edit Project' : 'New Project';
    document.getElementById('pt-project-error').classList.add('hidden');
    document.getElementById('pt-p-name').value = project ? project.title : '';
    document.getElementById('pt-p-desc').value = project ? (project.description || '') : '';
    document.getElementById('pt-p-status').value = project ? project.status : 'active';
    document.getElementById('pt-p-start').value = project && project.startDate ? calDateInputValue(project.startDate) : '';
    document.getElementById('pt-p-end').value = project && project.endDate ? calDateInputValue(project.endDate) : '';
    ptRenderMemberPicker('pt-p-members', project ? (project.memberIds || []) : []);
    document.getElementById('pt-project-delete').classList.toggle('hidden', !project);
    document.getElementById('pt-project-modal').classList.remove('hidden');
    document.getElementById('pt-p-name').focus();
  }
  document.getElementById('pt-project-cancel').addEventListener('click', function() {
    document.getElementById('pt-project-modal').classList.add('hidden');
  });
  document.getElementById('pt-project-delete').addEventListener('click', async function() {
    if (!ptEditingProject || !confirm('Delete this project and all its tasks?')) return;
    const r = await api('DELETE', '/projects/' + ptEditingProject);
    if (r.ok) { ptFilter = 'all'; document.getElementById('pt-project-filter').value = 'all'; document.getElementById('pt-project-modal').classList.add('hidden'); await loadTasksPage(); }
  });
  document.getElementById('pt-project-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const errEl = document.getElementById('pt-project-error');
    errEl.classList.add('hidden');
    const startVal = document.getElementById('pt-p-start').value;
    const endVal = document.getElementById('pt-p-end').value;
    const body = {
      title: document.getElementById('pt-p-name').value.trim(),
      description: document.getElementById('pt-p-desc').value.trim() || null,
      status: document.getElementById('pt-p-status').value,
      startDate: calDateInputMs(startVal),
      endDate: calDateInputMs(endVal),
      memberIds: ptReadMemberPicker('pt-p-members'),
    };
    const r = ptEditingProject
      ? await api('PUT', '/projects/' + ptEditingProject, body)
      : await api('POST', '/projects', body);
    if (!r.ok) { errEl.textContent = (r.data && r.data.error) || 'Failed to save project.'; errEl.classList.remove('hidden'); return; }
    if (!ptEditingProject && r.data && r.data.project) { ptFilter = r.data.project.id; }
    document.getElementById('pt-project-modal').classList.add('hidden');
    document.getElementById('pt-project-filter').value = ptFilter;
    await loadTasksPage();
  });

  // ── Login ──────────────────────────────────────────────────────────────────
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    const loginRes = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(r => r.json()).catch(() => ({}));

    if (!loginRes.token) {
      errEl.textContent = loginRes.error || 'Invalid username or password.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign in';
      return;
    }

    token = loginRes.token;
    localStorage.setItem('oc_portal_token', token);
    localStorage.removeItem('oc_impersonator_token');
    currentUser = loginRes.user;
    impersonatedBy = null;

    // Admins belong in the admin panel — share the token so they don't have to log in twice
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
      localStorage.setItem('oc_admin_token', token);
      window.location.replace('/admin');
      return;
    }

    await showApp();
    btn.disabled = false;
    btn.textContent = 'Sign in';
  });

  // ── Show app after auth ────────────────────────────────────────────────────
  async function showApp() {
    // The login response may not carry permissions; /auth/me always does, and
    // they drive which sections are visible.
    if (!currentUser || !currentUser.permissions) {
      const me = await api('GET', '/auth/me');
      if (me.ok) currentUser = me.data;
    }
    document.getElementById('sidebar-username').textContent = currentUser.username;
    document.getElementById('sidebar-role').textContent = currentUser.role;
    document.getElementById('account-info').innerHTML =
      'Signed in as <strong>' + esc(currentUser.username) + '</strong> (' + esc(currentUser.role) + ')';
    updateImpersonationBanner();
    applyAccess();

    // Mount the chat iframe only when the user has chat access.
    if (hasFeature('chat')) {
      const cfgRes = await api('GET', '/portal/config');
      if (cfgRes.ok) {
        gatewayConfig = cfgRes.data;
        mountChatFrame(gatewayConfig);
      }
    }

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    navigate(firstAllowedPage());
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('POST', '/auth/logout').catch(() => {});
    token = null;
    currentUser = null;
    gatewayConfig = null;
    localStorage.removeItem('oc_portal_token');
    localStorage.removeItem('oc_admin_token');
    localStorage.removeItem('oc_impersonator_token');
    document.getElementById('chat-frame').src = 'about:blank';
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  });

  // ── Change Password ────────────────────────────────────────────────────────
  document.getElementById('pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const alertEl = document.getElementById('pw-alert');
    const btn = document.getElementById('pw-btn');
    const currentPw = document.getElementById('pw-current').value;
    const newPw = document.getElementById('pw-new').value;
    const confirmPw = document.getElementById('pw-confirm').value;
    alertEl.className = 'alert hidden';
    if (newPw !== confirmPw) {
      alertEl.textContent = 'New passwords do not match.';
      alertEl.className = 'alert alert-error';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Updating…';
    const r = await api('PUT', '/me/password', { currentPassword: currentPw, newPassword: newPw });
    if (r.ok) {
      alertEl.textContent = 'Password updated successfully.';
      alertEl.className = 'alert alert-success';
      document.getElementById('pw-form').reset();
    } else {
      alertEl.textContent = r.data?.error || 'Failed to update password.';
      alertEl.className = 'alert alert-error';
    }
    btn.disabled = false;
    btn.textContent = 'Update Password';
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  (async () => {
    if (!token) return;
    const r = await api('GET', '/auth/me');
    if (!r.ok) { token = null; localStorage.removeItem('oc_portal_token'); return; }
    currentUser = r.data;
    impersonatedBy = r.data.impersonatedBy || null;
    if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
      localStorage.setItem('oc_admin_token', token);
      window.location.replace('/admin');
      return;
    }
    await showApp();
  })();
</script>
</body>
</html>`;
