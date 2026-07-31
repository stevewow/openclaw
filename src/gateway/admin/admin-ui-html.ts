import {
  PROJECT_CALENDAR_COMPONENT_JS,
  PROJECT_CALENDAR_CSS,
  PROJECT_CALENDAR_MARKUP,
} from "./project-calendar-ui.js";
import { REPORT_TABLE_COMPONENT_JS } from "./report-ui.js";
import { TASK_FEED_COMPONENT_JS, TASK_FEED_CSS, TASK_FEED_MARKUP } from "./task-feed-ui.js";
import { TASK_LIST_COMPONENT_JS, TASK_LIST_CSS, TASK_LIST_MARKUP } from "./task-list-ui.js";
import { TASK_STATUS_COMPONENT_JS, TASK_STATUS_CSS } from "./task-status-ui.js";
import { PORTAL_FEATURES } from "./types.js";

export const ADMIN_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OpenClaw Admin</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f4f4f5;
    --surface: #ffffff;
    --surface2: #f4f4f5;
    --border: #e4e4e7;
    --accent: #c0000a;
    --accent-hover: #950008;
    --danger: #c0000a;
    --success: #166534;
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
  body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; line-height: 1.5; min-height: 100vh; -webkit-font-smoothing: antialiased; }
  a { color: var(--accent); text-decoration: none; }

  /* Login */
  .login-wrap { display: flex; min-height: 100vh; }
  .login-left { flex: 1; background: var(--sidebar-bg); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; }
  .login-left-inner { max-width: 340px; width: 100%; }
  .login-brand { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2.5rem; }
  .login-brand-icon { width: 44px; height: 44px; background: var(--accent); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
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

  /* Layout */
  .app { display: flex; min-height: calc(100vh - var(--banner-h)); }
  .sidebar { width: 240px; background: var(--sidebar-bg); display: flex; flex-direction: column; flex-shrink: 0; position: sticky; top: var(--banner-h); height: calc(100vh - var(--banner-h)); }
  .sidebar-logo { padding: 1.25rem 1.25rem 1rem; display: flex; align-items: center; gap: 0.75rem; border-bottom: 1px solid var(--sidebar-border); }
  .sidebar-logo-icon { width: 32px; height: 32px; background: var(--accent); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
  .sidebar-logo-name { color: #ffffff; font-weight: 700; font-size: 1rem; letter-spacing: -0.01em; }
  .sidebar-user { padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--sidebar-border); }
  .sidebar-user .name { color: var(--sidebar-text-active); font-weight: 600; font-size: 0.875rem; }
  .sidebar-user .role { color: var(--sidebar-text); font-size: 0.75rem; margin-top: 0.1rem; text-transform: capitalize; }
  nav { flex: 1; padding: 0.625rem 0.75rem; overflow-y: auto; }
  nav a { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.625rem; color: var(--sidebar-text); border-radius: 7px; transition: background 0.12s, color 0.12s; margin-bottom: 1px; font-size: 0.875rem; }
  nav a:hover { background: rgba(255,255,255,0.07); color: var(--sidebar-text-active); }
  nav a.active { background: var(--sidebar-active-bg); color: var(--sidebar-text-active); border-left: 2.5px solid var(--accent); }
  nav a .icon { width: 20px; text-align: center; font-size: 0.95rem; }
  .nav-section { padding: 0.625rem 0.625rem 0.25rem; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.3); margin-top: 0.375rem; }
  .sidebar-footer { padding: 0.875rem 0.75rem; border-top: 1px solid var(--sidebar-border); }
  .main { flex: 1; overflow-x: hidden; min-width: 0; display: flex; flex-direction: column; }
  .topbar { padding: 1rem 1.75rem; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; position: sticky; top: var(--banner-h); z-index: 10; }
  .topbar-left { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
  .topbar h2 { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.01em; }
  .content { padding: 1.75rem; flex: 1; }
  #page-chat { flex: 1; display: flex; flex-direction: column; min-height: 0; background: #000; }
  #admin-chat-frame { flex: 1; width: 100%; border: none; display: block; }

  /* Mobile nav */
  .menu-toggle { display: none; background: transparent; border: none; color: var(--text); font-size: 1.25rem; line-height: 1; cursor: pointer; padding: 0.3rem 0.4rem; flex-shrink: 0; }
  .sidebar-backdrop { display: none; }
  @media (max-width: 860px) {
    .menu-toggle { display: inline-flex; align-items: center; justify-content: center; }
    .sidebar { position: fixed; top: var(--banner-h); left: 0; z-index: 60; height: calc(100dvh - var(--banner-h)); transform: translateX(-100%); transition: transform 0.2s ease; }
    .sidebar.open { transform: translateX(0); box-shadow: 8px 0 24px rgba(0,0,0,0.25); }
    .sidebar-backdrop { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 55; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }
    .sidebar-backdrop.open { opacity: 1; pointer-events: auto; }
    .topbar { padding: 0.875rem 1rem; }
    .content { padding: 1rem; }
    .modal { max-width: calc(100vw - 2rem) !important; }
  }

  /* Cards */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1rem; box-shadow: var(--shadow); }
  .card-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 0.75rem; letter-spacing: -0.01em; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .reports-home-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
  .report-card { display: flex; flex-direction: column; align-items: flex-start; gap: 0.4rem; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; box-shadow: var(--shadow); cursor: pointer; font: inherit; color: inherit; transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s; }
  .report-card:hover { border-color: var(--accent); box-shadow: 0 4px 14px rgba(0,0,0,0.08); transform: translateY(-1px); }
  .report-card-icon { font-size: 1.6rem; line-height: 1; }
  .report-card-title { font-size: 1rem; font-weight: 700; letter-spacing: -0.01em; color: var(--text); }
  .report-card-desc { font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; }
  .report-back { font-size: 0.82rem; color: var(--text-muted); text-decoration: none; font-weight: 600; }
  .report-back:hover { color: var(--accent); }
  /* Churn report: plain-English explainer with an expandable technical version */
  .churn-explain { font-size: 0.88rem; line-height: 1.6; }
  .churn-explain p { margin-bottom: 0.6rem; }
  .churn-explain p:last-child { margin-bottom: 0; }
  .churn-explain .churn-q { font-weight: 700; }
  .churn-tech { margin-top: 0.9rem; border-top: 1px solid var(--border); padding-top: 0.6rem; }
  .churn-tech > summary { cursor: pointer; font-size: 0.82rem; font-weight: 700; color: var(--accent); list-style: none; }
  .churn-tech > summary::-webkit-details-marker { display: none; }
  .churn-tech > summary::before { content: '\\25b8  '; }
  .churn-tech[open] > summary::before { content: '\\25be  '; }
  .churn-tech-body { font-size: 0.83rem; line-height: 1.6; margin-top: 0.7rem; color: var(--text-muted); }
  .churn-tech-body h4 { font-size: 0.83rem; color: var(--text); margin: 0.9rem 0 0.3rem; }
  .churn-tech-body h4:first-child { margin-top: 0; }
  .churn-tech-body ul { margin: 0 0 0.2rem 1.1rem; }
  .churn-tech-body code { background: var(--surface2); border-radius: 4px; padding: 0.05rem 0.3rem; font-size: 0.78rem; }
  .churn-howto > summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0; }
  .churn-howto > summary::-webkit-details-marker { display: none; }
  .churn-howto > summary::before { content: '\\25b8'; font-size: 0.8em; color: var(--accent); }
  .churn-howto[open] > summary::before { content: '\\25be'; }
  .churn-refresh-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.6rem; font-size: 0.85rem; }
  .churn-refresh-row label { font-weight: 600; }
  .churn-refresh-row select { padding: 0.3rem 0.5rem; }
  .churn-checkbox { display: flex; align-items: center; gap: 0.35rem; font-weight: 600; cursor: pointer; }
  .churn-refresh-log { margin-top: 0.6rem; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.5rem 0.7rem; font-size: 0.76rem; font-family: ui-monospace, monospace; white-space: pre-wrap; max-height: 9rem; overflow-y: auto; color: var(--text-muted); }
  .churn-note-btn { background: none; border: 0; padding: 0; cursor: pointer; font-size: 0.78rem; color: var(--accent); font-weight: 600; }
  .churn-note-item { border-top: 1px solid var(--border); padding: 0.55rem 0; font-size: 0.85rem; }
  .churn-note-item:first-child { border-top: 0; }
  .churn-note-meta { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem; display: flex; gap: 0.4rem; align-items: center; }
  .churn-hidden-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 0.6rem; font-size: 0.82rem; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.5rem 0.75rem; margin-bottom: 0.6rem; }
  tr.churn-row-hidden td { opacity: 0.55; }
  .rt-toolbar { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.9rem; border-bottom: 1px solid var(--border); }
  .rt-cols-wrap { position: relative; }
  .rt-cols-menu { position: absolute; top: calc(100% + 4px); left: 0; z-index: 20; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 6px 20px rgba(0,0,0,0.12); padding: 0.35rem; min-width: 200px; max-height: 320px; overflow-y: auto; }
  .rt-cols-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; font-size: 0.85rem; border-radius: 6px; cursor: pointer; white-space: nowrap; }
  .rt-cols-item:hover { background: var(--bg, #f6f7f9); }
  .rt-csv-btn { margin-left: auto; }
  table.rt-table th.rt-th { cursor: pointer; user-select: none; white-space: nowrap; }
  table.rt-table th.rt-th[draggable=true] { cursor: grab; }
  .rt-grip { color: var(--text-muted); opacity: 0.5; margin-right: 0.35rem; cursor: grab; font-size: 0.8rem; }
  .rt-th-label { font-weight: 700; }
  table.rt-table td.rt-frozen, table.rt-table th.rt-frozen { position: sticky; left: 0; background: var(--surface); z-index: 1; }
  table.rt-table th.rt-frozen { z-index: 3; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; box-shadow: var(--shadow); border-top: 3px solid var(--accent); }
  .stat-label { color: var(--text-muted); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
  .stat-value { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.03em; color: var(--text); }
  .cle-chart-wrap { position: relative; }
  .cle-chart-wrap svg { display: block; width: 100%; height: auto; }
  .cle-legend { display: flex; gap: 1.25rem; flex-wrap: wrap; align-items: center; margin-bottom: 0.75rem; font-size: 0.8rem; color: var(--text); }
  .cle-legend .item { display: inline-flex; align-items: center; gap: 0.45rem; }
  .cle-legend .swatch { width: 16px; height: 3px; border-radius: 2px; display: inline-block; }
  .cle-tooltip { position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow); padding: 0.5rem 0.65rem; font-size: 0.75rem; line-height: 1.55; white-space: nowrap; transform: translate(-50%, -112%); opacity: 0; transition: opacity 0.08s; z-index: 6; }
  .cle-tt-date { font-weight: 700; margin-bottom: 0.2rem; }
  .cle-tt-row { display: flex; align-items: center; gap: 0.4rem; }
  .cle-tt-swatch { width: 9px; height: 9px; border-radius: 2px; flex-shrink: 0; display: inline-block; }

  /* Forms */
  .form-group { margin-bottom: 1.125rem; }
  label { display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
  input, select, textarea { width: 100%; padding: 0.6rem 0.875rem; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; color: var(--text); font-size: 14px; font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.1); }
  input[type="checkbox"] { width: auto; accent-color: var(--accent); }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.125rem; border-radius: 7px; border: 1px solid transparent; cursor: pointer; font-size: 13px; font-family: inherit; font-weight: 600; transition: background 0.12s, box-shadow 0.12s, opacity 0.12s; letter-spacing: 0.01em; }
  .btn-primary { background: var(--accent); color: #fff; box-shadow: 0 1px 2px rgba(192,0,10,0.25); }
  .btn-primary:hover { background: var(--accent-hover); box-shadow: 0 2px 6px rgba(192,0,10,0.35); }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-danger:hover { background: var(--accent-hover); }
  .btn-ghost { background: transparent; border-color: var(--border); color: var(--text-muted); }
  .btn-ghost:hover { background: var(--surface2); color: var(--text); border-color: #d1d1d6; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-sm { padding: 0.35rem 0.75rem; font-size: 12px; }

  /* Table */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 0.7rem 1rem; text-align: left; border-bottom: 1px solid var(--border); }
  th { color: var(--text-muted); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; background: var(--surface2); }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #fafafa; }

  /* Badge */
  .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
  .badge-superadmin { background: var(--accent); color: #ffffff; }
  .badge-admin { background: #fee2e2; color: var(--accent); }
  .badge-user { background: #f4f4f5; color: #52525b; }
  .bucket-1-44 { background: #64748b; color: #fff; }
  .bucket-45-59 { background: #d97706; color: #fff; }
  .bucket-60-89 { background: #ea580c; color: #fff; }
  .bucket-90-119 { background: #dc2626; color: #fff; }
  .bucket-120plus { background: #7f1d1d; color: #fff; }
  .fin-note { border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.75rem; margin-bottom: 0.5rem; background: var(--surface2); }
  .fin-note-meta { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem; display: flex; justify-content: space-between; gap: 0.5rem; }
  .fin-row-click { cursor: pointer; }
  .fin-row-click:hover { background: var(--surface2); }
  .fin-flag { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .fin-flag-clear { background: var(--surface2); color: var(--text-muted); border: 1px solid var(--border); }
  .fin-owner { font-size: 0.72rem; color: var(--text-muted); }

  /* Past Due board */
  .fin-toolbar { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .fin-toolbar label { font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; }
  .fin-toolbar select { padding: 0.3rem 0.45rem; border: 1px solid var(--border); border-radius: 7px; font: inherit; font-size: 0.8rem; background: var(--surface); color: var(--text); }
  .fin-board { display: flex; gap: 0.75rem; overflow-x: auto; padding-bottom: 0.5rem; align-items: flex-start; }
  .fin-col { flex: 0 0 260px; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 0.6rem; min-height: 120px; }
  .fin-col.drop-target { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent); }
  .fin-col-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
  .fin-col-title { font-weight: 700; font-size: 0.82rem; }
  .fin-col-meta { font-size: 0.72rem; color: var(--text-muted); }
  .fin-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.55rem 0.6rem; margin-bottom: 0.5rem; cursor: pointer; }
  .fin-card:hover { border-color: var(--accent); }
  .fin-card.dragging { opacity: 0.45; }
  .fin-card-name { font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem; }
  .fin-card-row { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; font-size: 0.75rem; color: var(--text-muted); }
  .fin-card-amount { font-weight: 700; color: var(--text); }
  .fin-col-empty { font-size: 0.75rem; color: var(--text-muted); padding: 0.5rem 0.25rem; }
  .fin-due-over { color: #b5473b; font-weight: 600; }

  /* Modal */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; overflow-y: auto; }
  .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.75rem; width: 100%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); max-height: calc(100dvh - 2rem); overflow-y: auto; margin: auto; }
  .modal-title { font-weight: 700; font-size: 1.05rem; margin-bottom: 1.25rem; letter-spacing: -0.01em; }
  .modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border); }

  /* Alert */
  .alert { padding: 0.7rem 1rem; border-radius: 7px; margin-bottom: 1rem; font-size: 0.875rem; font-weight: 500; }
  .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
  .alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: var(--success); }

  /* Tabs */
  .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 1.25rem; }
  .tab { padding: 0.6rem 1rem; cursor: pointer; color: var(--text-muted); border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.12s; font-size: 0.875rem; font-weight: 500; }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }

  .hidden { display: none !important; }
  .text-muted { color: var(--text-muted); }
  .flex { display: flex; }
  .gap-2 { gap: 0.5rem; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .mb-4 { margin-bottom: 1rem; }
  .mt-4 { margin-top: 1rem; }
  .text-right { text-align: right; }
  .spin { animation: spin 1s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty-state { text-align: center; padding: 3rem; color: var(--text-muted); font-size: 0.875rem; }

  /* Resources */
  .resources-toolbar { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .search-input-wrap { flex: 1; min-width: 200px; position: relative; }
  .search-input-wrap input { padding-left: 2.25rem; }
  .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
  .tag-filters { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem; }
  .tag-filter-chip { padding: 0.25rem 0.65rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); transition: all 0.12s; }
  .tag-filter-chip:hover { border-color: var(--accent); color: var(--accent); }
  .tag-filter-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .resources-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
  .resource-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); display: flex; flex-direction: column; overflow: hidden; }
  .resource-card-body { padding: 1.125rem 1.25rem; flex: 1; }
  .resource-card-title { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; }
  .resource-type-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 1px; }
  .resource-title-text { font-weight: 700; font-size: 0.95rem; letter-spacing: -0.01em; line-height: 1.3; }
  .resource-desc { font-size: 0.825rem; color: var(--text-muted); }
  .resource-desc-collapsed { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .resource-desc-toggle { background: none; border: none; padding: 0 0 0.5rem 0; font-size: 0.75rem; color: var(--accent); cursor: pointer; font-family: inherit; display: none; margin-top: 0.15rem; }
  .resource-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.75rem; }
  .resource-tag { padding: 0.15rem 0.5rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 999px; font-size: 0.7rem; font-weight: 600; color: var(--text-muted); }
  .resource-access { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .access-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.7rem; font-weight: 700; }
  .access-badge-ai { background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; }
  .access-badge-users { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
  .access-badge-off { background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted); }
  .resource-card-footer { padding: 0.625rem 1.25rem; background: var(--surface2); border-top: 1px solid var(--border); display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; }
  .resource-date { font-size: 0.7rem; color: var(--text-muted); }
  /* Tag chip input */
  .tag-chip-wrap { border: 1px solid var(--border); border-radius: 7px; padding: 0.4rem 0.6rem; display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; min-height: 42px; cursor: text; transition: border-color 0.15s, box-shadow 0.15s; background: var(--surface); }
  .tag-chip-wrap:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.1); }
  .tag-chip-wrap .chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.1rem 0.5rem; background: var(--accent); color: #fff; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
  .tag-chip-wrap .chip-remove { cursor: pointer; opacity: 0.75; line-height: 1; }
  .tag-chip-wrap .chip-remove:hover { opacity: 1; }
  .tag-chip-input { border: none; outline: none; font-size: 13px; font-family: inherit; background: transparent; min-width: 80px; flex: 1; }
  .member-picker { border: 1px solid var(--border); border-radius: 7px; padding: 0.35rem; max-height: 150px; overflow-y: auto; background: var(--surface); }
  .member-picker .member-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.4rem; border-radius: 5px; cursor: pointer; font-size: 0.85rem; }
  .member-picker .member-row:hover { background: var(--surface2); }
  .member-picker .member-row input { width: auto; margin: 0; }
  .member-picker .member-empty { color: var(--text-muted); font-size: 0.8rem; padding: 0.4rem; }
  .member-picker .member-sub { color: var(--text-muted); font-size: 0.75rem; }
  /* Toggle switch */
  .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 0; border-bottom: 1px solid var(--border); }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-label { font-size: 0.875rem; font-weight: 600; }
  .toggle-sublabel { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.1rem; }
  .toggle { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle-slider { position: absolute; inset: 0; background: #d1d5db; border-radius: 999px; cursor: pointer; transition: background 0.2s; }
  .toggle-slider:before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
  .toggle input:checked + .toggle-slider { background: var(--accent); }
  .toggle input:checked + .toggle-slider:before { transform: translateX(18px); }

  /* Agent cards */
  .agents-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
  .agent-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
  .agent-card-header { display: flex; align-items: center; gap: 0.875rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); }
  .agent-emoji { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; background: var(--surface2); }
  .agent-header-info { flex: 1; min-width: 0; }
  .agent-name { font-weight: 700; font-size: 0.95rem; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .agent-id { color: var(--text-muted); font-size: 0.75rem; font-family: monospace; }
  .agent-card-body { padding: 0.875rem 1.25rem; }
  .agent-meta { display: flex; gap: 1rem; margin-bottom: 0.875rem; flex-wrap: wrap; }
  .agent-meta-item { font-size: 0.75rem; }
  .agent-meta-label { color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.15rem; }
  .agent-meta-value { font-weight: 500; font-family: monospace; font-size: 0.8rem; }
  .agent-card-actions { display: flex; gap: 0.5rem; padding: 0.75rem 1.25rem; border-top: 1px solid var(--border); background: var(--surface2); }
  .agent-detail-panel { padding: 1rem 1.25rem; border-top: 1px solid var(--border); }
  .agent-detail-section { margin-bottom: 1rem; }
  .agent-detail-section:last-child { margin-bottom: 0; }
  .agent-detail-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 0.5rem; }
  .skill-chip { display: inline-block; padding: 0.2rem 0.6rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; font-size: 0.75rem; font-weight: 500; margin: 0.15rem; }
  .session-item { padding: 0.5rem 0; border-bottom: 1px solid var(--border); }
  .session-item:last-child { border-bottom: none; }
  .session-msg { font-size: 0.85rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .session-time { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.1rem; }
  .info-box { background: #fef9ec; border: 1px solid #fde68a; border-radius: var(--radius); padding: 1rem 1.25rem; margin-bottom: 1.25rem; font-size: 0.875rem; }
  .info-box strong { color: #92400e; display: block; margin-bottom: 0.35rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .info-box a { color: var(--accent); font-weight: 600; }

  /* Projects & Tasks */
  .projects-toolbar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .view-toggle { display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; overflow: hidden; flex-shrink: 0; }
  .view-btn { padding: 0.4rem 0.875rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; background: transparent; border: none; color: var(--text-muted); transition: all 0.12s; font-family: inherit; }
  .view-btn.active { background: var(--accent); color: #fff; }
  .proj-filter-wrap { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
  .project-select { padding: 0.4rem 0.75rem; font-size: 0.875rem; border-radius: 7px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-family: inherit; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .project-select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.1); }
  .board-wrap { display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 1rem; }
  .board-column { flex: 0 0 320px; display: flex; flex-direction: column; }
  .board-col-header { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.875rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px 8px 0 0; border-bottom: none; }
  .board-col-title { font-weight: 700; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .board-col-count { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); background: var(--surface2); border: 1px solid var(--border); border-radius: 999px; padding: 0.1rem 0.5rem; min-width: 24px; text-align: center; }
  .board-col-body { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-top: 2px solid var(--border); padding: 0.625rem; min-height: 300px; }
  .board-add-btn { width: 100%; padding: 0.5rem; background: transparent; border: 1px dashed var(--border); border-top: none; border-radius: 0 0 8px 8px; color: var(--text-muted); font-size: 0.8rem; cursor: pointer; transition: all 0.12s; font-family: inherit; }
  .board-add-btn:hover { background: var(--surface); color: var(--accent); border-color: var(--accent); }
  .board-empty { font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1.5rem 0.5rem; }
  .task-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow); margin-bottom: 0.5rem; cursor: grab; overflow: hidden; transition: box-shadow 0.12s, transform 0.1s; display: flex; }
  .task-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-1px); }
  .task-card:active { cursor: grabbing; }
  .task-card.dragging { opacity: 0.45; cursor: grabbing; }
  .board-col-body.drag-over { background: rgba(192,0,10,0.05); border-color: var(--accent); border-style: dashed; }
  /* Placeholder marking where the dragged card lands. */
  .task-drop-slot { height: 2px; background: var(--accent); border-radius: 2px; margin: 0.25rem 0 0.6rem; }
  .task-card-project-bar { width: 5px; flex-shrink: 0; }
  .task-card-body { padding: 0.85rem 0.95rem; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  /* Title and priority share the top row, like the project card's title/status row. */
  .task-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
  .task-card-title { font-weight: 650; font-size: 0.9rem; line-height: 1.35; color: var(--text); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
  .task-card-project-badge { display: inline-block; padding: 0.12rem 0.5rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; align-self: flex-start; }
  .task-prio { flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.12rem 0.45rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700; text-transform: capitalize; white-space: nowrap; }
  .prio-low { background: var(--surface2); color: var(--text-muted); }
  .prio-med { background: #dbeafe; color: #1d4ed8; }
  .prio-high { background: #ffedd5; color: #c2410c; }
  .prio-urgent { background: #fee2e2; color: #b91c1c; }
  .task-card-desc { font-size: 0.78rem; line-height: 1.45; color: var(--text-muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
  /* One fact per line so nothing truncates mid-word the way a wrapped meta row does. */
  .task-card-facts { display: flex; flex-direction: column; gap: 0.3rem; }
  .task-card-fact { display: flex; align-items: center; gap: 0.4rem; font-size: 0.73rem; color: var(--text-muted); min-width: 0; }
  .task-card-fact-label { flex-shrink: 0; opacity: 0.75; }
  .task-card-fact-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .task-card-meta { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
  .task-due { font-size: 0.73rem; color: var(--text-muted); font-weight: 500; }
  .task-recurrence { font-size: 0.73rem; color: var(--text-muted); font-weight: 500; text-transform: capitalize; }
  .task-due-overdue { color: #ef4444 !important; font-weight: 700; }
  .task-assignee-chip { display: inline-flex; align-items: center; gap: 0.3rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 999px; padding: 0.1rem 0.5rem 0.1rem 0.15rem; font-size: 0.7rem; color: var(--text); max-width: 100%; }
  .task-assignee { width: 18px; height: 18px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 0.58rem; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .task-assignee-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .task-assignee-row { display: flex; gap: 0.3rem; flex-wrap: wrap; }
  .task-subtask-count { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; }
  .task-subtask-bar { display: flex; flex-direction: column; gap: 0.25rem; }
  .task-subtask-track { height: 4px; border-radius: 999px; background: var(--surface2); border: 1px solid var(--border); overflow: hidden; }
  .task-subtask-fill { height: 100%; background: var(--success); }
  .task-attach-count { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; }
  .task-tags { display: flex; gap: 0.25rem; flex-wrap: wrap; }
  .task-tag { padding: 0.12rem 0.4rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; font-size: 0.65rem; font-weight: 500; color: var(--text-muted); }
${PROJECT_CALENDAR_CSS}
${TASK_FEED_CSS}
${TASK_LIST_CSS}
${TASK_STATUS_CSS}
  .color-picker { display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 0.25rem 0; }
  .color-swatch { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; transition: transform 0.1s; border: 3px solid transparent; box-sizing: border-box; }
  .color-swatch:hover { transform: scale(1.15); }
  .color-swatch.selected { border-color: var(--text); transform: scale(1.1); }
  .subtask-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0; border-bottom: 1px solid var(--border); }
  .subtask-item:last-child { border-bottom: none; }
  .subtask-title { flex: 1; font-size: 0.875rem; line-height: 1.3; }
  .subtask-done { text-decoration: line-through; color: var(--text-muted); }
  .subtask-delete { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1.1rem; line-height: 1; padding: 0 0.2rem; transition: color 0.1s; }
  .subtask-delete:hover { color: var(--danger); }
  .attach-list { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.5rem; }
  .attach-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.55rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; font-size: 0.8rem; }
  .attach-icon { flex-shrink: 0; }
  .attach-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); text-decoration: none; }
  .attach-name:hover { text-decoration: underline; }
  .attach-size { flex-shrink: 0; font-size: 0.7rem; color: var(--text-muted); }
  .attach-del { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1rem; line-height: 1; padding: 0 0.15rem; }
  .attach-del:hover { color: var(--danger); }
  .attach-empty { font-size: 0.78rem; color: var(--text-muted); padding: 0.25rem 0; }
  .attach-actions { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
  .attach-url-input { flex: 1; min-width: 160px; padding: 0.45rem 0.75rem; font-size: 13px; }
  .show-closed-toggle { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: var(--text-muted); cursor: pointer; user-select: none; white-space: nowrap; }
  .proj-status-tabs { display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; overflow: hidden; flex-shrink: 0; }
  .projects-list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
  .project-list-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); display: flex; flex-direction: column; overflow: hidden; }
  .project-list-card-bar { height: 5px; flex-shrink: 0; }
  .project-list-card-body { padding: 1.125rem 1.25rem; flex: 1; }
  .project-list-card-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
  .project-list-card-tasks { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.6rem; }
  .proj-status-badge-planning { background: #eef2ff; color: #4338ca; }
  .proj-status-badge-active { background: #dbeafe; color: #1d4ed8; }
  .proj-status-badge-completed { background: #dcfce7; color: #166534; }
  .proj-status-badge-archived { background: var(--surface2); color: var(--text-muted); }
  @media (max-width: 640px) {
    .board-column { flex: 0 0 240px; }
  }
</style>
</head>
<body>

<!-- Login screen -->
<div id="login-screen" class="login-wrap">
  <div class="login-left">
    <div class="login-left-inner">
      <div class="login-brand">
        <div class="login-brand-icon">🦞</div>
        <div class="login-brand-name">OpenClaw</div>
      </div>
      <p class="login-tagline">Your personal AI assistant — connecting every channel, every model, from one place.</p>
    </div>
  </div>
  <div class="login-right">
    <div class="login-card">
      <h2>Welcome back</h2>
      <p class="subtitle">Sign in to your admin dashboard</p>
      <div id="login-error" class="alert alert-error hidden"></div>
      <form id="login-form">
        <div class="form-group">
          <label for="login-username">Username</label>
          <input id="login-username" type="text" autocomplete="username" required placeholder="admin">
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
  <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
  <aside class="sidebar" id="app-sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">🦞</div>
      <div class="sidebar-logo-name">OpenClaw</div>
    </div>
    <div class="sidebar-user">
      <div class="name" id="sidebar-username"></div>
      <div class="role" id="sidebar-role"></div>
    </div>
    <nav id="sidebar-nav">
      <div class="nav-section">Main</div>
      <a href="#dashboard" class="nav-link" data-page="dashboard"><span class="icon">⊞</span> Dashboard</a>
      <a href="#users" class="nav-link admin-only" data-page="users"><span class="icon">👥</span> Users</a>
      <a href="#agents" class="nav-link superadmin-only" data-page="agents"><span class="icon">🤖</span> Agents</a>
      <a href="#chat" class="nav-link" data-page="chat"><span class="icon">💬</span> Chat</a>
      <div class="nav-section">Workspace</div>
      <a href="#projects" class="nav-link" data-page="projects"><span class="icon">📋</span> Projects &amp; Tasks</a>
      <a href="#reports" class="nav-link admin-only" data-page="reports"><span class="icon">📊</span> Reports</a>
      <div class="nav-section">Support</div>
      <a href="#tickets" class="nav-link admin-only" data-page="tickets"><span class="icon">🎫</span> Tickets</a>
      <a href="#departments" class="nav-link admin-only" data-page="departments"><span class="icon">🏷️</span> Departments</a>
      <a href="#categories" class="nav-link admin-only" data-page="categories"><span class="icon">🗂️</span> Request Types</a>
      <a href="#form-preview" class="nav-link admin-only" data-page="form-preview"><span class="icon">👁️</span> Intake Form</a>
      <div class="nav-section">Financials</div>
      <a href="#past-due" class="nav-link admin-only" data-page="financials"><span class="icon">💰</span> Past Due Accounts</a>
      <a href="#cleveland" class="nav-link admin-only" data-page="cleveland"><span class="icon">📈</span> Cleveland Investment</a>
      <div class="nav-section">Settings</div>
      <a href="#resources" class="nav-link admin-only" data-page="resources"><span class="icon">📚</span> Resources</a>
      <a href="#system" class="nav-link superadmin-only" data-page="system"><span class="icon">⚙</span> System</a>
      <a href="#account" class="nav-link" data-page="account"><span class="icon">👤</span> My Account</a>
    </nav>
    <div class="sidebar-footer">
      <button class="btn btn-ghost btn-sm" id="logout-btn" style="width:100%">Sign out</button>
    </div>
  </aside>

  <main class="main">
    <div class="topbar" id="main-topbar">
      <div class="topbar-left">
        <button class="menu-toggle" id="menu-toggle-btn" aria-label="Toggle menu">☰</button>
        <h2 id="page-title">Dashboard</h2>
      </div>
    </div>
    <div class="content" id="main-content">

      <!-- Dashboard page -->
      <div id="page-dashboard" class="page">
        <div class="stats-grid" id="stats-grid"></div>
        <div class="card">
          <div class="card-title" id="dashboard-greeting">Welcome back!</div>
          <p class="text-muted" id="dashboard-quote" style="font-style:italic"></p>
        </div>
        <div class="card">
          <div class="card-title">Your Tasks</div>
          <div id="dashboard-task-summary"></div>
        </div>
      </div>

      <!-- Users page -->
      <div id="page-users" class="page hidden">
        <div class="flex justify-between items-center mb-4">
          <div></div>
          <button class="btn btn-primary" id="add-user-btn">+ Add User</button>
        </div>
        <div class="card" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Last Login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="users-table-body">
                <tr><td colspan="6" class="empty-state">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Agents page -->
      <div id="page-agents" class="page hidden">
        <div id="agents-chat-hint" class="info-box hidden">
          <strong>Chatting with Agents</strong>
          As superadmin, you can chat with any agent directly. Use the <a href="#chat" onclick="navigate('chat');return false;">Chat tab</a> in the sidebar, or open chat in a new tab using the button on each agent card.
          Other users will only interact with the main agent.
        </div>
        <div id="agents-grid" class="agents-grid">
          <div class="empty-state" style="grid-column:1/-1"><span class="spin">⟳</span> Loading…</div>
        </div>
      </div>

      <!-- Resources page -->
      <div id="page-resources" class="page hidden">
        <div class="flex justify-between items-center mb-4">
          <div class="resources-toolbar" style="flex:1;margin-bottom:0">
            <div class="search-input-wrap">
              <span class="search-icon">🔍</span>
              <input id="resources-search" type="search" placeholder="Search title, description, tags…">
            </div>
          </div>
          <div style="margin-left:0.75rem">
            <button class="btn btn-primary" id="add-resource-btn">+ Add Resource</button>
          </div>
        </div>
        <div id="resources-tag-filters" class="tag-filters"></div>
        <div id="resources-grid" class="resources-grid">
          <div class="empty-state" style="grid-column:1/-1"><span class="spin">⟳</span> Loading…</div>
        </div>
      </div>

      <!-- System page -->
      <div id="page-system" class="page hidden">
        <div id="system-info-cards"></div>
      </div>

      <!-- Account page -->
      <div id="page-account" class="page hidden">
        <div class="card" style="max-width:400px">
          <div class="card-title">Change Password</div>
          <div id="pw-alert" class="hidden"></div>
          <form id="change-pw-form">
            <div class="form-group">
              <label>Current Password</label>
              <input type="password" id="pw-current" required>
            </div>
            <div class="form-group">
              <label>New Password</label>
              <input type="password" id="pw-new" required minlength="8">
            </div>
            <div class="form-group">
              <label>Confirm New Password</label>
              <input type="password" id="pw-confirm" required>
            </div>
            <button type="submit" class="btn btn-primary">Update Password</button>
          </form>
        </div>
      </div>

      <!-- Projects page -->
      <div id="page-projects" class="page hidden">
        <div class="projects-toolbar">
          <div class="view-toggle">
            <button class="view-btn active" id="view-board-btn">⊞ Board</button>
            <button class="view-btn" id="view-cal-btn">📅 Calendar</button>
            <button class="view-btn" id="view-tasklist-btn">☰ List</button>
            <button class="view-btn" id="view-projects-btn">📁 Projects</button>
          </div>
          <div class="proj-filter-wrap">
            <select class="project-select" id="project-filter-sel">
              <option value="all">All Projects</option>
            </select>
            <button class="btn btn-ghost btn-sm" id="edit-project-btn" style="padding:0.4rem 0.6rem" title="Edit selected project" disabled>✎</button>
            <button class="btn btn-ghost btn-sm" id="dup-project-btn" style="padding:0.4rem 0.6rem" title="Duplicate selected project" disabled>⧉</button>
          </div>
          <label class="show-closed-toggle" title="Include completed and archived projects">
            <input type="checkbox" id="show-closed-projects"> Show closed
          </label>
          <div style="margin-left:auto;display:flex;gap:0.5rem;flex-shrink:0">
            <button class="btn btn-ghost btn-sm" id="add-project-btn">+ New Project</button>
            <button class="btn btn-primary btn-sm" id="add-task-btn">+ New Task</button>
          </div>
        </div>

        <!-- Filter bar. Applies to the board, calendar and list alike, so a
             filtered view stays filtered when you switch how you look at it. -->
        <div id="task-filter-bar">${TASK_LIST_MARKUP}</div>

        <div id="projects-tasklist" class="hidden"></div>

        <!-- Columns are per-project data, so the board is drawn from the status
             registry rather than written out here. -->
        <div id="projects-board"><div class="board-wrap" id="board-cols"></div></div>

        <div id="projects-calendar" class="hidden">${PROJECT_CALENDAR_MARKUP}</div>

        <div id="projects-list" class="hidden">
          <div class="proj-status-tabs mb-4" id="proj-status-tabs">
            <button class="view-btn active" data-status="all">All</button>
            <button class="view-btn" data-status="planning">Planning</button>
            <button class="view-btn" data-status="active">Active</button>
            <button class="view-btn" data-status="completed">Completed</button>
            <button class="view-btn" data-status="archived">Archived</button>
          </div>
          <div id="projects-list-grid" class="projects-list-grid"></div>
        </div>
      </div>

      <!-- Reports page -->
      <!-- Reports landing: choose a report -->
      <div id="page-reports-home" class="page hidden">
        <div id="reports-home-grid" class="reports-home-grid"></div>
      </div>

      <div id="page-reports" class="page hidden">
        <div style="margin-bottom:0.75rem"><a href="#reports" class="report-back">← All reports</a></div>
        <div class="card" style="margin-bottom:1rem">
          <div class="flex items-center gap-2" style="flex-wrap:wrap">
            <div class="form-group" style="margin:0">
              <label>From</label>
              <select id="report-from-sel"></select>
            </div>
            <div class="form-group" style="margin:0">
              <label>To</label>
              <select id="report-to-sel"></select>
            </div>
            <div class="form-group" style="margin:0">
              <label>Market</label>
              <select id="report-market-sel"><option value="">All markets</option></select>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem">
              <span class="text-muted" id="report-refreshed-at" style="font-size:0.8rem"></span>
              <button class="btn btn-primary btn-sm" id="report-refresh-btn">↻ Refresh now</button>
            </div>
          </div>
        </div>
        <div class="stats-grid" id="report-stats-grid"></div>
        <div class="card" style="padding:0"><div id="report-table"></div></div>
      </div>

      <!-- Rankings page -->
      <div id="page-rankings" class="page hidden">
        <div style="margin-bottom:0.75rem"><a href="#reports" class="report-back">← All reports</a></div>
        <div class="card" style="margin-bottom:1rem">
          <div class="flex items-center gap-2" style="flex-wrap:wrap">
            <div class="form-group" style="margin:0">
              <label>From</label>
              <select id="rank-from-sel"></select>
            </div>
            <div class="form-group" style="margin:0">
              <label>To</label>
              <select id="rank-to-sel"></select>
            </div>
            <div class="form-group" style="margin:0">
              <label>Market</label>
              <select id="rank-market-sel"><option value="">All markets</option></select>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem">
              <span class="text-muted" id="rank-refreshed-at" style="font-size:0.8rem"></span>
              <button class="btn btn-primary btn-sm" id="rank-refresh-btn">↻ Refresh now</button>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem;align-items:start">
          <div class="card" style="padding:0">
            <div style="padding:0.875rem 1.25rem;font-weight:700;border-bottom:1px solid var(--border)">🧑‍💼 Agent Ranking</div>
            <div id="rank-agents-table"></div>
          </div>
          <div class="card" style="padding:0">
            <div style="padding:0.875rem 1.25rem;font-weight:700;border-bottom:1px solid var(--border)">🏢 Company Ranking</div>
            <div id="rank-companies-table"></div>
          </div>
        </div>
      </div>

      <!-- Photographers report -->
      <div id="page-photographers" class="page hidden">
        <div style="margin-bottom:0.75rem"><a href="#reports" class="report-back">← All reports</a></div>
        <div class="card" style="margin-bottom:1rem">
          <div class="flex items-center gap-2" style="flex-wrap:wrap">
            <div class="form-group" style="margin:0">
              <label>Shoots from</label>
              <select id="photog-from-sel"></select>
            </div>
            <div class="form-group" style="margin:0">
              <label>To</label>
              <select id="photog-to-sel"></select>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem">
              <span class="text-muted" id="photog-refreshed-at" style="font-size:0.8rem"></span>
              <button class="btn btn-primary btn-sm" id="photog-refresh-btn">↻ Refresh now</button>
            </div>
          </div>
        </div>
        <div class="card" style="padding:0"><div id="photog-table"></div></div>
      </div>

      <!-- Pipedrive Cleanup checklist -->
      <div id="page-pipedrive-cleanup" class="page hidden">
        <div style="margin-bottom:0.75rem"><a href="#reports" class="report-back">← All reports</a></div>
        <div class="card" style="margin-bottom:1rem">
          <div class="flex items-center gap-2" style="flex-wrap:wrap">
            <div>
              <div style="font-weight:700">Pipedrive Cleanup</div>
              <div class="text-muted" style="font-size:0.85rem">Verify each suggested change. Approved items become a worklist for anyone you grant this report to.</div>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:1rem;flex-wrap:wrap" id="pdc-stats"></div>
          </div>
        </div>
        <div style="margin-bottom:0.5rem;font-weight:700">To verify</div>
        <div id="pdc-verify-list" style="margin-bottom:1.5rem"></div>
        <div style="margin-bottom:0.5rem;font-weight:700">Released to worklist</div>
        <div id="pdc-worklist"></div>
      </div>

      <!-- Reports: Churn & Retention -->
      <div id="page-churn" class="page hidden">
        <div style="margin-bottom:0.75rem"><a href="#reports" class="report-back">← All reports</a></div>
        <div id="churn-header" class="card" style="margin-bottom:1rem"></div>

        <!-- Same Spiro banner the Financials reports carry: the refresh below
             pulls order history over the Spiro connection, so an expired token
             is the first thing to check when a refresh fails. -->
        <div class="card hidden js-spiro-banner" style="margin-bottom:1rem;border-left:3px solid #d97706;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
          <span style="font-size:1.15rem">⚠️</span>
          <div style="flex:1;min-width:220px">
            <div style="font-weight:600" class="js-spiro-title">Spiro session expired</div>
            <div class="text-muted js-spiro-msg" style="font-size:0.8rem">Showing the last snapshot. Reconnect before refreshing from Spiro.</div>
          </div>
          <button class="btn btn-primary btn-sm js-spiro-reconnect">Reconnect Spiro</button>
        </div>

        <!-- Refresh controls: window + seasonal adjustment, then re-pull and
             re-run. Progress is polled, so the panel below fills in while the
             engine works. -->
        <div class="card churn-refresh" style="margin-bottom:1rem">
          <div class="churn-refresh-row">
            <label for="churn-years-sel">Window</label>
            <select id="churn-years-sel">
              <option value="1">Last 1 year</option>
              <option value="2">Last 2 years</option>
              <option value="3" selected>Last 3 years</option>
              <option value="5">Last 5 years</option>
            </select>
            <label class="churn-checkbox"><input type="checkbox" id="churn-seasonal-chk" checked /> Seasonal adjustment</label>
            <button type="button" class="btn btn-sm" id="churn-refresh-btn">↻ Refresh from Spiro</button>
            <span class="text-muted" style="font-size:0.8rem">Re-pulls orders and re-runs the engine — a few minutes.</span>
          </div>
          <div id="churn-refresh-status"></div>
        </div>

        <!-- Plain-English explainer. Static content: it must read the same
             whether or not a snapshot exists, so nothing here is data-driven.
             Collapsed by default — it is reference material, read once; the
             numbers are what people come back for. The technical version is a
             second disclosure inside it. -->
        <details class="card churn-howto" style="margin-bottom:1rem">
          <summary class="card-title churn-howto-summary">How to read this report</summary>
          <div class="churn-explain" style="margin-top:0.75rem">
            <p>Agents never tell us they have left — they just stop booking. This report reads every order we have taken over the last three years and answers three questions.</p>
            <p><span class="churn-q">1. Are we keeping the money we had a year ago?</span><br />
              Take what our agents spent with us in the year before last, then look at what those same agents spent in the last twelve months. <b>GRR</b> is how much of that money came back — 83% means we kept 83 cents of every dollar. <b>NRR</b> counts growth as well, so it can go above 100% when the agents who stayed spent more than the ones who left took away. <b>Logo retention</b> is the same idea by headcount instead of dollars.</p>
            <p><span class="churn-q">2. Which agents have quietly stopped ordering?</span><br />
              Everyone's normal is different. An agent who books twice a year going quiet for three months is completely normal; an agent who books every week going quiet for three months has almost certainly gone elsewhere. So instead of one "90 days = churned" rule, the report learns each agent's own rhythm and gives them a score: <b>P(alive)</b>, where 1.00 means still with us and 0.00 means as good as gone.</p>
            <p><span class="churn-q">3. Who should we call first?</span><br />
              That is the <b>Outreach Queue</b>. It ranks agents by how much money a year we stand to lose, how likely they are to be gone, and how recently they went quiet. A big agent who went quiet last month sits at the top; an equally big agent who left two years ago sinks, because one call can still save the first and probably not the second.</p>
            <p><span class="churn-q">Health and Urgency are two different things.</span><br />
              <b>Health</b> is how likely the agent is gone. <b>Urgency</b> is how recently they went quiet. They are kept apart on purpose: an agent silent for five weeks and an agent silent for three years can score the same on health, but only one of them is worth a phone call today.</p>
            <p><span class="churn-q">Where the numbers come from.</span><br />
              Completed, paid orders in Spiro. Cancelled orders, zero-dollar orders, test records and orders with nobody attached are thrown out before anything is calculated, so a cancelled shoot never counts as either revenue or churn. This page is a snapshot, not a live feed — the figures change when the report is re-run.</p>
            <p><span class="churn-q">What "agents" counts.</span><br />
              The agent count in the header is everyone who placed at least two clean orders inside the window, plus anyone whose first order landed in the last 90 days — the customer base the report is scoring, not the at-risk subset. The at-risk numbers are the health chips and the <b>Outreach Queue</b> tile below it. Widen or narrow the window at the top of the page and the count moves with it, because it is counting people who ordered in that period.</p>
            <p><span class="churn-q">Why one-time buyers are left out.</span><br />
              A large share of the people who have ever ordered from us bought exactly once — for-sale-by-owner sellers, one-off projects, an agent listing a single property. They are a big share of the headcount but a very small share of the revenue, and one order tells us nothing about a rhythm, so the model can only park them in the middle of the scale. Left in, they swamped the <b>Watch</b> tier and added risk that was never really there. They are therefore kept out of the tables, the health tiers and the retention figures, and the header says how many were set aside. Someone who ordered for the first time in the last 90 days is <em>not</em> set aside — they have not had a fair chance to come back yet, and they are exactly who is worth a call.</p>
            <p><span class="churn-q">Tidying the list, and keeping notes.</span><br />
              Every row has a <b>Hide</b> button. Use it for agents who have retired, moved out of the area, or who you have already dealt with. Hiding is shared — the list gets cleaner for the whole team, it stays clean the next time the report is re-run, and <b>Show hidden</b> brings anyone back. Every row also has a <b>Notes</b> cell: click it to record what happened ("called, listing again in spring") or why you hid someone. Notes are shared, stamped with who wrote them, and survive every re-run, so next quarter the reason is still there.</p>
            <p><span class="churn-q">Changing the window, and getting today's numbers.</span><br />
              <b>Refresh from Spiro</b> at the top re-pulls the order history and re-runs the whole report over the window you pick — one year through five. It takes a few minutes and everyone sees the result. A shorter window is a sharper read on how agents are behaving now; a longer one gives the model more history to judge each agent's rhythm against.</p>
          </div>
          <details class="churn-tech">
            <summary>Full technical description</summary>
            <div class="churn-tech-body">
              <h4>Layer 1 — rolling 12-month revenue retention</h4>
              <p>For each month end <code>asof</code>: base window is <code>[asof-24m, asof-12m)</code>, current window is <code>[asof-12m, asof)</code>, over agents with revenue in the base window. <code>GRR = sum(min(current, base)) / sum(base)</code>, capped per agent so one agent's growth cannot mask another's loss. <code>NRR = sum(current) / sum(base)</code>, uncapped. Logo retention is the share of base agents with any revenue in the current window. A full 24-month lookback is required, so the earliest months are dropped rather than reported on partial data.</p>
              <h4>Layer 2 — Pareto/NBD P(alive)</h4>
              <p>This is a non-contractual, continuous-time business: nobody cancels, they lapse. Pareto/NBD (Schmittlein, Morrison &amp; Colombo 1987; Fader &amp; Hardie 2005 likelihood) takes three numbers per agent — repeat order count <code>x</code>, recency <code>t_x</code>, and observed lifetime <code>T</code> — and models purchase rates as Gamma(r, alpha) and dropout rates as Gamma(s, beta) across the whole customer base. Parameters are fitted by maximum likelihood over every agent at once (values in the model line under the tiles), then each agent gets their individual posterior P(still active). Ordering volume varies by more than an order of magnitude here; that heterogeneity is a fitted parameter of the model rather than something to segment around by hand. Pareto/NBD is used rather than BG/NBD because BG/NBD only lets a customer drop out immediately after a purchase, whereas agents leave the business or switch vendors between listings.</p>
              <h4>Reporting population — repeat agents</h4>
              <p>The reporting surfaces (Agent Scores, health tiers, revenue at risk, Outreach Queue, and the Layer-1 retention base) cover agents with at least <code>--min-orders</code> clean orders in the window, default 2, plus any agent whose first order falls inside <code>--new-agent-grace-days</code>, default 90 — a one-week-old client is indistinguishable from a one-and-done on order count alone, and hiding them would bury the most callable leads. The Pareto/NBD fit itself deliberately still runs over <em>every</em> agent: the model is specified over all customers who made a first purchase, and dropping the zero-repeat mass biases <code>r</code>/<code>alpha</code> and <code>s</code>/<code>beta</code> and inflates P(alive) for everyone remaining. Second-order conversion also keeps the full base, since it is the measure of whether a first order becomes a second and would read 100% by construction otherwise. Every agent's own numbers are identical either way — the filter changes who is listed, not what they score. Run with <code>--min-orders 1</code> to reproduce the old all-agents report exactly; the header states the split.</p>
              <h4>Seasonality — operational time</h4>
              <p>Order volume swings roughly three times peak to trough, and the model assumes a stationary purchase rate. So calendar time is rescaled by a monthly market-activity index (mean = 1, charted in Seasonality Index): a slow December contributes less elapsed opportunity than a peak May, and silence in a quiet month is penalised less. Without it, a wave of false churn fires every January. The engine can be run with <code>--no-seasonal-adjust</code> to see the difference; the header line states whether the current snapshot used it.</p>
              <h4>Bands and formulas</h4>
              <ul>
                <li><b>health</b> from P(alive): &ge; 0.65 Healthy, &ge; 0.35 Watch, &ge; 0.10 At risk, below that Likely churned.</li>
                <li><b>urgency</b> from calendar days silent: under 90 Act now, 90–365 Re-engage, over 365 Dormant.</li>
                <li><code>annual_value = 12 * revenue / months_observed</code>; <code>cadence_per_year = 12 * orders / months_observed</code>.</li>
                <li><code>revenue_at_risk = annual_value * (1 - P(alive))</code>.</li>
                <li><code>priority_score = revenue_at_risk * exp(-days_silent / 365)</code> — the annualised loss, decayed by how cold the lead is. This is the Outreach Queue ranking.</li>
                <li>Outreach Queue = agents who are not Healthy and have a positive priority score, top 300.</li>
                <li>The <b>Revenue at risk</b> tile sums <code>revenue_at_risk</code> over Watch and At risk agents only — the recoverable band, excluding anyone already written off and anyone hidden.</li>
              </ul>
              <h4>Data cleaning and identity</h4>
              <p>Excluded from both numerator and denominator: unparseable dates, non-completed statuses, zero-value orders, rows with no agent GUID, and test/internal records. The header line reports kept versus total rows. Agents are keyed on the Spiro agent GUID, which survives a move between brokerages — the identity audit under the tiles states how many agents moved on one GUID this run. Company-level rollups can still split when one brokerage name is held under several company IDs; those are listed under Data Quality and do not affect any agent-level figure.</p>
              <h4>Hidden agents</h4>
              <p>Dismissals are stored in the dashboard database keyed by agent GUID, not in the report file, and are re-applied every time the snapshot is read — so hiding survives the engine regenerating the report. They are shared across everyone with access to this report, recorded with who hid the agent and why. A hidden agent drops out of the Outreach Queue, the Agent Scores table, the health-tier counts, and the revenue-at-risk and queue-size tiles. The board metrics — GRR, NRR and logo retention — deliberately ignore dismissals and always cover every agent.</p>
              <h4>Not yet wired — MLS capture rate</h4>
              <p>The definitive measure would be capture rate: our orders divided by the listings that agent actually took, per period. It removes the remaining ambiguity — zero orders against zero listings is dormancy, zero orders against four listings is defection, visible the week it happens — and yields a true per-agent share of wallet. It needs listing counts joined to <code>agent_id</code> from an MLS feed.</p>
              <h4>Notes</h4>
              <p>Notes are stored in the dashboard database against the agent GUID, alongside dismissals and outside the snapshot, so they survive every re-run. They are shared, appended rather than overwritten, and stamped with who wrote them. Hiding an agent with a reason files that reason as a note as well, so the reason survives the agent later being restored.</p>
              <h4>Refreshing</h4>
              <p>Nothing is computed in the dashboard. <b>Refresh from Spiro</b> re-pulls the order history through the gateway's Spiro connection, writes <code>reports/wow_retention/orders_raw.csv</code>, and runs the Python engine at <code>reports/wow_retention/wow_retention.py</code> over the selected window, which rewrites the snapshot this page renders. One refresh runs at a time. The window setting is passed to the engine as <code>--years</code> and bounds both the pull and the analysis; the header line states the window and when it last ran.</p>
            </div>
          </details>
        </details>

        <div id="churn-tiles" class="stats-grid"></div>
        <div id="churn-meta" class="card" style="margin-bottom:1.5rem"></div>
        <div style="margin-bottom:0.25rem;font-weight:700">Outreach Queue — recoverable agents by priority</div>
        <div class="text-muted" style="font-size:0.85rem;margin-bottom:0.5rem">Annualised revenue at risk, decayed by how cold the lead is. The top of the list is the most important call of the day.</div>
        <div id="churn-hidden-bar"></div>
        <div id="churn-queue-table" style="margin-bottom:1.5rem"></div>
        <div style="margin-bottom:0.5rem;font-weight:700">Revenue Retention — rolling 12-month</div>
        <div id="churn-retention" class="card" style="margin-bottom:1.5rem"></div>
        <div style="margin-bottom:0.5rem;font-weight:700">Agent Scores — every agent</div>
        <div id="churn-scores-table" style="margin-bottom:1.5rem"></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem">
          <div><div style="margin-bottom:0.5rem;font-weight:700">2nd Order Conversion</div><div id="churn-conversion" class="card"></div></div>
          <div><div style="margin-bottom:0.5rem;font-weight:700">Seasonality Index</div><div id="churn-seasonality" class="card"></div></div>
        </div>
        <div style="margin:1.25rem 0 0.5rem;font-weight:700">Data Quality</div>
        <div id="churn-dq" class="card"></div>
      </div>

      <!-- Support: Tickets page -->
      <div id="page-tickets" class="page hidden">
        <div class="stats-grid" id="ticket-stats-grid" style="margin-bottom:1rem"></div>
        <div class="card" style="margin-bottom:1rem">
          <div class="flex items-center gap-2" style="flex-wrap:wrap">
            <div class="form-group" style="margin:0">
              <label>Status</label>
              <select id="ticket-status-filter">
                <option value="">All statuses</option>
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_review">Needs Review</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div class="form-group" style="margin:0">
              <label>Category</label>
              <select id="ticket-category-filter"><option value="">All categories</option></select>
            </div>
            <div class="form-group" style="margin:0">
              <label>Department</label>
              <select id="ticket-department-filter"><option value="">All departments</option></select>
            </div>
            <div class="form-group" style="margin:0;flex:1;min-width:180px">
              <label>Search</label>
              <input type="text" id="ticket-search" placeholder="Ticket #, subject, requester, address…" autocomplete="off" />
            </div>
            <div style="margin-left:auto;display:flex;align-items:flex-end;gap:0.5rem">
              <button class="btn btn-primary btn-sm" id="ticket-new-btn">＋ New Ticket</button>
            </div>
          </div>
        </div>
        <div class="card" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Ticket</th><th>Subject</th><th>Category</th><th>Requester</th><th>Order</th><th>Dept</th><th>Status</th><th>Created</th><th>Resolved</th><th>Time</th></tr>
              </thead>
              <tbody id="ticket-body"><tr><td colspan="10" class="empty-state">Loading…</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Support: Departments management page -->
      <div id="page-departments" class="page hidden">
        <div class="card" style="margin-bottom:1rem">
          <div style="font-weight:700;margin-bottom:0.35rem">Departments</div>
          <p class="text-muted" style="font-size:0.85rem;margin:0 0 1rem">Tickets are assigned to a department and (once email is configured) emailed to its address. Edit names and addresses here — no redeploy needed.</p>
          <div class="table-wrap" style="margin-bottom:1rem">
            <table>
              <thead><tr><th>Department</th><th>Key</th><th>Email address</th><th style="width:1%"></th></tr></thead>
              <tbody id="dept-body"><tr><td colspan="4" class="empty-state">Loading…</td></tr></tbody>
            </table>
          </div>
          <form id="dept-add-form" class="flex gap-2" style="flex-wrap:wrap;align-items:flex-end">
            <div class="form-group" style="margin:0;flex:1;min-width:160px"><label>New department name</label><input type="text" id="dept-new-label" placeholder="e.g. Aerial team" autocomplete="off" /></div>
            <div class="form-group" style="margin:0;flex:1;min-width:180px"><label>Email address (optional)</label><input type="email" id="dept-new-email" placeholder="team@wowvideotours.com" autocomplete="off" /></div>
            <button type="submit" class="btn btn-primary btn-sm">＋ Add department</button>
          </form>
        </div>
        <div class="card">
          <div style="font-weight:700;margin-bottom:0.35rem">Default routing</div>
          <p class="text-muted" style="font-size:0.85rem;margin:0 0 1rem">Which department a new request lands in, by request type.</p>
          <div id="route-rows" style="display:grid;gap:0.75rem;max-width:520px"></div>
          <div style="margin-top:1rem"><button class="btn btn-primary btn-sm" id="route-save-btn">Save routing</button> <span id="route-saved" class="text-muted" style="font-size:0.8rem;margin-left:0.5rem"></span></div>
        </div>
      </div>

      <!-- Request Types: the categories offered on the public intake form -->
      <div id="page-categories" class="page hidden">
        <div class="card" style="margin-bottom:1rem">
          <div style="font-weight:700;margin-bottom:0.35rem">Request Types</div>
          <p class="text-muted" style="font-size:0.85rem;margin:0 0 1rem">
            The options a client picks from on the intake form. Add or edit them here and the form updates immediately — no redeploy.
            Each type can ask its own follow-up question and route to its own department.
          </p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Request type</th><th>Follow-up question</th><th>Routes to</th><th>On form</th><th style="width:1%"></th></tr></thead>
              <tbody id="cat-body"><tr><td colspan="5" class="empty-state">Loading…</td></tr></tbody>
            </table>
          </div>
          <div style="margin-top:1rem"><button class="btn btn-primary btn-sm" id="cat-add-btn">＋ Add request type</button></div>
        </div>
      </div>

      <!-- Intake form preview: the live public form, embedded as clients see it -->
      <div id="page-form-preview" class="page hidden">
        <div class="card" style="margin-bottom:1rem">
          <div style="font-weight:700;margin-bottom:0.35rem">Intake Form</div>
          <p class="text-muted" style="font-size:0.85rem;margin:0 0 1rem">
            Exactly what a client sees — this is the live form, not a mockup. Edits on the Request Types page show up here on refresh.
          </p>
          <div class="form-group" style="max-width:640px">
            <label>Link for the Spiro delivery-page button</label>
            <div class="flex gap-2" style="align-items:center">
              <input type="text" id="form-preview-url" readonly style="flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.8rem" />
              <button class="btn btn-sm" id="form-preview-copy">Copy</button>
              <button class="btn btn-sm" id="form-preview-open">Open ↗</button>
            </div>
            <div class="text-muted" style="font-size:0.78rem;margin-top:0.35rem">
              Spiro appends the order id; <code>&amp;address=</code> is optional and just shows the property on the form.
            </div>
          </div>
        </div>
        <div class="card" style="margin-bottom:1rem">
          <div style="font-weight:700;margin-bottom:0.35rem">🧪 Test mode</div>
          <p class="text-muted" style="font-size:0.85rem;margin:0 0 0.75rem">
            Submit the form below as a <strong>test ticket</strong> to show the team the flow. The department email is diverted to the address you choose (no real desk is emailed), the ticket is numbered <code>TEST-####</code>, and it's kept out of the live stats.
          </p>
          <div class="flex gap-2" style="align-items:flex-end;flex-wrap:wrap">
            <div class="form-group" style="flex:1;min-width:220px;margin:0">
              <label>Send test notifications to</label>
              <input type="email" id="form-test-email" placeholder="you@wowvideotours.com" />
            </div>
            <label class="flex items-center gap-2" style="font-size:0.9rem;white-space:nowrap;padding-bottom:0.5rem">
              <input type="checkbox" id="form-test-toggle" /> Enable test mode
            </label>
          </div>
          <div class="text-muted" id="form-test-status" style="font-size:0.78rem;margin-top:0.5rem"></div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <div class="flex items-center gap-2" style="padding:0.6rem 0.9rem;border-bottom:1px solid var(--border, #e5e7eb)">
            <span class="text-muted" style="font-size:0.8rem">Live preview</span>
            <button class="btn btn-sm" id="form-preview-reload" style="margin-left:auto">↻ Reload</button>
          </div>
          <iframe id="form-preview-frame" title="Intake form preview" style="width:100%;height:900px;border:0;display:block;background:#f6f7f9"></iframe>
        </div>
      </div>

      <!-- Financials: Past Due Accounts page -->
      <div id="page-financials" class="page hidden">
        <div class="card" style="margin-bottom:1rem">
          <div class="flex items-center gap-2" style="flex-wrap:wrap">
            <div>
              <div style="font-weight:700;font-size:1rem">Past Due Accounts</div>
              <div class="text-muted" style="font-size:0.8rem;max-width:700px;margin-top:0.15rem">
                Unpaid Spiro invoices past their due date, grouped by payee and staged against the collections policy.
                Outstanding is what is still owed (invoice total less payments and credits). An account holding a
                partially paid invoice is flagged <strong>Review</strong>: a plan, dispute or short payment sits behind
                the balance, so read it before taking the next collections step. Assign an account to hand it to
                someone — it then shows up in their queue to work.
              </div>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem">
              <span class="text-muted" id="fin-refreshed-at" style="font-size:0.8rem"></span>
              <button class="btn btn-primary btn-sm admin-only" id="fin-refresh-btn">↻ Refresh now</button>
            </div>
          </div>
        </div>
        <div class="card hidden js-spiro-banner" style="margin-bottom:1rem;border-left:3px solid #d97706;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
          <span style="font-size:1.15rem">⚠️</span>
          <div style="flex:1;min-width:220px">
            <div style="font-weight:600" class="js-spiro-title">Spiro session expired</div>
            <div class="text-muted js-spiro-msg" style="font-size:0.8rem">Showing the last cached snapshot. Reconnect to pull fresh invoices.</div>
          </div>
          <button class="btn btn-primary btn-sm js-spiro-reconnect">Reconnect Spiro</button>
        </div>
        <div class="stats-grid" id="fin-stats-grid"></div>
        <div class="fin-toolbar">
          <div style="display:flex;gap:0.25rem">
            <button class="btn btn-sm" id="fin-view-board">▦ Board</button>
            <button class="btn btn-sm" id="fin-view-table">☰ Table</button>
          </div>
          <label>Owner
            <select id="fin-filter-owner">
              <option value="all">Everyone</option>
              <option value="mine">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </label>
          <label><input type="checkbox" id="fin-filter-review" /> Needs review only</label>
          <label><input type="checkbox" id="fin-filter-open" checked /> Hide resolved</label>
          <span class="text-muted" style="font-size:0.78rem;margin-left:auto" id="fin-visible-count"></span>
        </div>
        <div id="fin-board" class="fin-board"></div>
        <div class="card" id="fin-table-card" style="padding:0;display:none">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Stage</th>
                  <th>Owner</th>
                  <th>Outstanding</th>
                  <th>Invoices</th>
                  <th>Oldest Past Due</th>
                  <th>Aging</th>
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody id="fin-table-body">
                <tr><td colspan="8" class="empty-state">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Financials: Cleveland Investment page -->
      <div id="page-cleveland" class="page hidden">
        <div class="card" style="margin-bottom:1rem">
          <div class="flex items-center gap-2" style="flex-wrap:wrap">
            <div>
              <div style="font-weight:700;font-size:1rem">Cleveland Investment</div>
              <div class="text-muted" style="font-size:0.8rem;max-width:700px;margin-top:0.15rem">
                Cumulative revenue (Spiro orders delivered by John Kickham &amp; Brandon Kralovic) vs cumulative
                cost (payroll + 10% editing). Dashed segments project forward on the revenue trend to estimate
                when weekly revenue covers weekly cost, and when total revenue repays total investment.
              </div>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
              <span class="text-muted" id="cle-refreshed-at" style="font-size:0.8rem"></span>
              <label class="text-muted" style="font-size:0.8rem;display:flex;align-items:center;gap:0.35rem">Trend
                <select id="cle-window" style="font-size:0.8rem;padding:0.25rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)">
                  <option value="4" selected>Last 4 weeks</option>
                  <option value="6">Last 6 weeks</option>
                  <option value="8">Last 8 weeks</option>
                  <option value="weighted">Recency-weighted</option>
                  <option value="all">All time</option>
                </select>
              </label>
              <button class="btn btn-primary btn-sm" id="cle-refresh-btn">↻ Refresh now</button>
            </div>
          </div>
        </div>
        <div class="card hidden js-spiro-banner" style="margin-bottom:1rem;border-left:3px solid #d97706;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
          <span style="font-size:1.15rem">⚠️</span>
          <div style="flex:1;min-width:220px">
            <div style="font-weight:600" class="js-spiro-title">Spiro session expired</div>
            <div class="text-muted js-spiro-msg" style="font-size:0.8rem">Showing the last cached snapshot. Reconnect to pull fresh data.</div>
          </div>
          <button class="btn btn-primary btn-sm js-spiro-reconnect">Reconnect Spiro</button>
        </div>
        <div class="stats-grid" id="cle-stats-grid"></div>
        <div class="card">
          <div id="cle-chart" class="cle-chart-wrap"><div class="empty-state">Loading…</div></div>
        </div>
      </div>

    </div>

    <!-- Chat page — outside .content so iframe fills remaining height -->
    <div id="page-chat" class="page hidden">
      <iframe id="admin-chat-frame" title="OpenClaw Chat" allow="microphone"></iframe>
    </div>

  </main>
</div>

<!-- Churn: agent notes. One agent at a time; the key of the agent on show is
     held in churnNotesState, not in the DOM. -->
<div id="churn-note-modal" class="modal-backdrop hidden">
  <div class="modal">
    <div class="modal-title" id="churn-note-title">Notes</div>
    <div id="churn-note-error" class="alert alert-error hidden"></div>
    <div class="form-group">
      <label for="churn-note-input">Add a note</label>
      <textarea id="churn-note-input" rows="3" placeholder="Called — left voicemail. Says they are listing again in spring."></textarea>
    </div>
    <div id="churn-note-list"></div>
    <div class="modal-actions">
      <button type="button" class="btn" id="churn-note-close">Close</button>
      <button type="button" class="btn btn-primary" id="churn-note-save">Add note</button>
    </div>
  </div>
</div>

<!-- Add/Edit User Modal -->
<div id="user-modal" class="modal-backdrop hidden">
  <div class="modal">
    <div class="modal-title" id="user-modal-title">Add User</div>
    <div id="user-modal-error" class="alert alert-error hidden"></div>
    <form id="user-modal-form">
      <input type="hidden" id="modal-user-id">
      <div class="form-group">
        <label>Username</label>
        <input id="modal-username" required>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <div class="form-group" style="margin-bottom:1.125rem">
          <label>First Name</label>
          <input id="modal-first-name" placeholder="Jane">
        </div>
        <div class="form-group" style="margin-bottom:1.125rem">
          <label>Last Name</label>
          <input id="modal-last-name" placeholder="Doe">
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input id="modal-email" type="email" placeholder="jane@example.com">
      </div>
      <div class="form-group" id="modal-pw-group">
        <label id="modal-pw-label">Password</label>
        <input id="modal-password" type="password">
      </div>
      <div class="form-group" id="modal-role-group">
        <label>Role</label>
        <select id="modal-role">
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Super Admin</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="user-modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="user-modal-submit">Create User</button>
      </div>
    </form>
  </div>
</div>

<!-- Resource Modal -->
<div id="resource-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:520px">
    <div class="modal-title" id="resource-modal-title">Add Resource</div>
    <div id="resource-modal-error" class="alert alert-error hidden"></div>
    <form id="resource-modal-form">
      <input type="hidden" id="resource-modal-id">
      <div class="form-group">
        <label>Type</label>
        <select id="resource-type" onchange="onResourceTypeChange()">
          <option value="link">🔗 Link (URL)</option>
          <option value="file">📄 File Upload</option>
        </select>
      </div>
      <div class="form-group">
        <label>Title</label>
        <input id="resource-title" required placeholder="e.g. Q4 Sales Playbook">
      </div>
      <div class="form-group">
        <label>Description <span style="font-weight:400;text-transform:none">(optional)</span></label>
        <textarea id="resource-desc" rows="2" style="resize:vertical" placeholder="Brief description of this resource…"></textarea>
      </div>
      <div class="form-group" id="resource-url-group">
        <label>URL</label>
        <input id="resource-url" type="url" placeholder="https://…">
      </div>
      <div class="form-group hidden" id="resource-file-group">
        <label>File <span style="font-weight:400;text-transform:none">(max 15 MB)</span></label>
        <input id="resource-file" type="file" style="padding:0.45rem 0.5rem">
        <div id="resource-file-info" class="text-muted" style="font-size:0.8rem;margin-top:0.35rem"></div>
      </div>
      <div class="form-group">
        <label>Tags</label>
        <div class="tag-chip-wrap" id="tag-chip-wrap" onclick="document.getElementById('tag-input').focus()">
          <input id="tag-input" class="tag-chip-input" placeholder="Type a tag, press Enter…">
        </div>
      </div>
      <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:1rem">
        <div class="toggle-row" style="padding:0.75rem 1rem">
          <div>
            <div class="toggle-label">🤖 AI Access</div>
            <div class="toggle-sublabel">Allow agents to use this resource for business knowledge</div>
          </div>
          <label class="toggle"><input type="checkbox" id="resource-ai-access" checked><span class="toggle-slider"></span></label>
        </div>
        <div class="toggle-row" style="padding:0.75rem 1rem">
          <div>
            <div class="toggle-label">👥 User Access</div>
            <div class="toggle-sublabel">Allow users to view and download this resource</div>
          </div>
          <label class="toggle"><input type="checkbox" id="resource-user-access"><span class="toggle-slider"></span></label>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="resource-modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="resource-modal-submit">Add Resource</button>
      </div>
    </form>
  </div>
</div>

<!-- Task Modal -->
<div id="task-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:540px;overflow-y:auto;max-height:calc(100dvh - 48px)">
    <div class="modal-title" id="task-modal-title">New Task</div>
    <div id="task-modal-error" class="alert alert-error hidden"></div>
    <form id="task-modal-form">
      <div class="form-group">
        <label>Title</label>
        <input id="task-title" required placeholder="What needs to be done?">
      </div>
      <div class="form-group">
        <label>Description <span style="font-weight:400;text-transform:none">(optional)</span></label>
        <textarea id="task-desc" rows="2" style="resize:vertical" placeholder="Add more detail…"></textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <div class="form-group" style="margin-bottom:0">
          <label>Status</label>
          <!-- Options track the chosen project's board; see syncTaskStatusOptions. -->
          <select id="task-status"></select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Priority</label>
          <select id="task-priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top:1.125rem">
        <label>Project</label>
        <select id="task-project">
          <option value="">— No Project —</option>
        </select>
      </div>
      <div class="form-group">
        <label>Due Date</label>
        <input id="task-due" type="date">
      </div>
      <div class="form-group">
        <label>Assigned To <span style="font-weight:400;text-transform:none">(select one or more)</span></label>
        <div id="task-assignees-list" class="member-picker"></div>
      </div>
      <div class="form-group" style="margin-top:1.125rem">
        <label>Repeat</label>
        <select id="task-recurrence">
          <option value="">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      <div class="form-group" style="margin-top:1.125rem">
        <label>Tags</label>
        <div class="tag-chip-wrap" id="task-tag-chip-wrap" onclick="document.getElementById('task-tag-input').focus()">
          <input id="task-tag-input" class="tag-chip-input" placeholder="Type a tag, press Enter…">
        </div>
      </div>
      <div id="task-subtasks-section" class="hidden" style="margin-bottom:1.125rem">
        <label style="display:block;margin-bottom:0.5rem;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted)">Subtasks</label>
        <div id="subtasks-list" style="min-height:1rem;margin-bottom:0.5rem"></div>
        <div id="add-subtask-form" style="display:flex;gap:0.4rem;margin-top:0.4rem">
          <input id="new-subtask-title" placeholder="Add a subtask…" style="flex:1;padding:0.45rem 0.75rem;font-size:13px">
          <button type="button" class="btn btn-ghost btn-sm" id="add-subtask-btn">Add</button>
        </div>
      </div>
      <div id="task-attach-section" class="hidden" style="margin-bottom:1.125rem">
        <label style="display:block;margin-bottom:0.5rem;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted)">Links &amp; Files</label>
        <div id="task-attach-list" class="attach-list"></div>
        <div class="attach-actions">
          <input id="task-attach-url" class="attach-url-input" placeholder="Paste a link (https://…)">
          <button type="button" class="btn btn-ghost btn-sm" id="task-attach-link-btn">Add Link</button>
          <button type="button" class="btn btn-ghost btn-sm" id="task-attach-file-btn">Upload File</button>
          <input type="file" id="task-attach-file" class="hidden">
        </div>
      </div>
      <div id="task-feed-section" class="hidden" style="margin-bottom:1.125rem">
        <label style="display:block;margin-bottom:0.5rem;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted)">Comments &amp; Activity</label>
        <div id="task-feed">${TASK_FEED_MARKUP}</div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start">
        <button type="button" class="btn btn-danger btn-sm hidden" id="task-modal-delete">Delete</button>
        <div style="flex:1"></div>
        <button type="button" class="btn btn-ghost" id="task-modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="task-modal-submit">Save Task</button>
      </div>
    </form>
  </div>
</div>

<!-- Project Modal -->
<div id="proj-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:460px">
    <div class="modal-title" id="proj-modal-title">New Project</div>
    <div id="proj-modal-error" class="alert alert-error hidden"></div>
    <form id="proj-modal-form">
      <div class="form-group">
        <label>Project Name</label>
        <input id="proj-name" required placeholder="e.g. Email Newsletter Campaign">
      </div>
      <div class="form-group">
        <label>Description <span style="font-weight:400;text-transform:none">(optional)</span></label>
        <textarea id="proj-desc" rows="2" style="resize:vertical" placeholder="What is this project about?"></textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <div class="form-group">
          <label>Begin Date</label>
          <input id="proj-start" type="date">
        </div>
        <div class="form-group">
          <label>Goal End Date</label>
          <input id="proj-end" type="date">
        </div>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="proj-status">
          <option value="planning">Planning</option>
          <option value="active" selected>Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div class="form-group">
        <label>Color</label>
        <div class="color-picker" id="color-picker">
          <div class="color-swatch" style="background:#ef4444" data-color="#ef4444" title="Red"></div>
          <div class="color-swatch" style="background:#f97316" data-color="#f97316" title="Orange"></div>
          <div class="color-swatch" style="background:#f59e0b" data-color="#f59e0b" title="Amber"></div>
          <div class="color-swatch" style="background:#22c55e" data-color="#22c55e" title="Green"></div>
          <div class="color-swatch" style="background:#14b8a6" data-color="#14b8a6" title="Teal"></div>
          <div class="color-swatch selected" style="background:#3b82f6" data-color="#3b82f6" title="Blue"></div>
          <div class="color-swatch" style="background:#8b5cf6" data-color="#8b5cf6" title="Violet"></div>
          <div class="color-swatch" style="background:#ec4899" data-color="#ec4899" title="Pink"></div>
          <div class="color-swatch" style="background:#6b7280" data-color="#6b7280" title="Gray"></div>
        </div>
        <input type="hidden" id="proj-color-val" value="#3b82f6">
      </div>
      <div class="form-group">
        <label>Tags</label>
        <div class="tag-chip-wrap" id="proj-tag-chip-wrap" onclick="document.getElementById('proj-tag-input').focus()">
          <input id="proj-tag-input" class="tag-chip-input" placeholder="Type a tag, press Enter…">
        </div>
      </div>
      <div class="form-group">
        <label>Members <span style="font-weight:400;text-transform:none">(can view this project & its tasks)</span></label>
        <div id="proj-members-list" class="member-picker"></div>
      </div>
      <div id="proj-attach-section" class="hidden" style="margin-bottom:1.125rem">
        <label style="display:block;margin-bottom:0.5rem;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted)">Links &amp; Files</label>
        <div id="proj-attach-list" class="attach-list"></div>
        <div class="attach-actions">
          <input id="proj-attach-url" class="attach-url-input" placeholder="Paste a link (https://…)">
          <button type="button" class="btn btn-ghost btn-sm" id="proj-attach-link-btn">Add Link</button>
          <button type="button" class="btn btn-ghost btn-sm" id="proj-attach-file-btn">Upload File</button>
          <input type="file" id="proj-attach-file" class="hidden">
        </div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start">
        <button type="button" class="btn btn-danger btn-sm hidden" id="proj-modal-delete">Delete Project</button>
        <div style="flex:1"></div>
        <button type="button" class="btn btn-ghost" id="proj-modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="proj-modal-submit">Save Project</button>
      </div>
    </form>
  </div>
</div>

<!-- User Permissions Modal -->
<div id="perms-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:500px">
    <div class="modal-title">Manage Permissions: <span id="perms-modal-username"></span></div>
    <div class="tabs">
      <div class="tab active" data-tab="access-tab">Access</div>
      <div class="tab" data-tab="agents-tab">Agents</div>
      <div class="tab" data-tab="skills-tab">Skills</div>
      <div class="tab" data-tab="channels-tab">Channels</div>
    </div>
    <div id="access-tab" class="tab-content">
      <p class="text-muted" style="font-size:0.82rem;margin:0 0 0.75rem">Switch on exactly what this person can see in their portal. Everything is off until you grant it.</p>
      <div style="font-weight:700;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);margin:0.5rem 0 0.25rem">Sections</div>
      <div id="perms-features-list"></div>
      <div style="font-weight:700;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);margin:1rem 0 0.25rem">Reports</div>
      <div id="perms-reports-list"></div>
    </div>
    <div id="agents-tab" class="tab-content hidden">
      <div id="perms-agents-list"></div>
    </div>
    <div id="skills-tab" class="tab-content hidden">
      <div id="perms-skills-list"></div>
    </div>
    <div id="channels-tab" class="tab-content hidden">
      <div id="perms-channels-list"></div>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="perms-modal-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="perms-modal-save">Save Permissions</button>
    </div>
  </div>
</div>

<div id="fin-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:660px;overflow-y:auto;max-height:calc(100dvh - 48px)">
    <div class="flex items-center" style="justify-content:space-between;gap:1rem">
      <div class="modal-title" id="fin-modal-title" style="margin:0">Account</div>
      <button type="button" class="btn btn-ghost btn-sm" id="fin-modal-close">✕</button>
    </div>
    <div id="fin-modal-summary" style="font-size:0.85rem;margin:0.4rem 0 1rem"></div>
    <div id="fin-review-banner" class="hidden" style="border-left:3px solid #d97706;background:var(--surface2);border-radius:8px;padding:0.6rem 0.75rem;margin-bottom:1rem;font-size:0.82rem"></div>
    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end;margin-bottom:1rem">
      <label style="font-size:0.78rem;color:var(--text-muted)">Stage<br />
        <select id="fin-status-select" style="margin-top:0.2rem;padding:0.35rem 0.5rem;border:1px solid var(--border);border-radius:7px;font:inherit;font-size:0.82rem;background:var(--surface);color:var(--text)"></select>
      </label>
      <label id="fin-assign-wrap" style="font-size:0.78rem;color:var(--text-muted)">Assigned to<br />
        <select id="fin-assign-select" style="margin-top:0.2rem;padding:0.35rem 0.5rem;border:1px solid var(--border);border-radius:7px;font:inherit;font-size:0.82rem;background:var(--surface);color:var(--text)"></select>
      </label>
      <label style="font-size:0.78rem;color:var(--text-muted)">Next action due<br />
        <input type="date" id="fin-due-input" style="margin-top:0.2rem;padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:7px;font:inherit;font-size:0.82rem;background:var(--surface);color:var(--text)" />
      </label>
      <span class="text-muted" id="fin-case-meta" style="font-size:0.72rem"></span>
    </div>
    <div style="display:flex;gap:0.5rem;margin-bottom:1.25rem;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" id="fin-followup-btn">+ Create follow-up task</button>
    </div>
    <div style="font-weight:700;margin-bottom:0.5rem">Past-due invoices</div>
    <div class="table-wrap" style="margin-bottom:1.25rem">
      <table>
        <thead><tr><th>Reference</th><th>Status</th><th>Invoiced</th><th>Paid</th><th>Outstanding</th><th>Due</th><th>Days</th></tr></thead>
        <tbody id="fin-modal-invoices"></tbody>
      </table>
    </div>
    <div style="font-weight:700;margin-bottom:0.5rem">Notes &amp; follow-ups</div>
    <form id="fin-note-form" style="display:flex;gap:0.5rem;margin-bottom:0.75rem">
      <input type="text" id="fin-note-input" placeholder="Add a note…" autocomplete="off" style="flex:1" />
      <button type="submit" class="btn btn-primary btn-sm">Add</button>
    </form>
    <div id="fin-notes-list"></div>
  </div>
</div>

<div id="ticket-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:720px;overflow-y:auto;max-height:calc(100dvh - 48px)">
    <div class="flex items-center" style="justify-content:space-between;gap:1rem">
      <div class="modal-title" id="ticket-modal-title" style="margin:0">Ticket</div>
      <button type="button" class="btn btn-ghost btn-sm" id="ticket-modal-close">✕</button>
    </div>
    <div id="ticket-modal-meta" style="font-size:0.85rem;margin:0.4rem 0 0.25rem"></div>
    <div id="ticket-modal-timing" class="text-muted" style="font-size:0.8rem;margin:0 0 1rem"></div>
    <div class="flex items-center gap-2" style="flex-wrap:wrap;margin-bottom:1rem">
      <div class="form-group" style="margin:0">
        <label>Status</label>
        <select id="ticket-modal-status">
          <option value="new">New</option>
          <option value="in_progress">In Progress</option>
          <option value="needs_review">Needs Review</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div class="form-group" style="margin:0">
        <label>Priority</label>
        <select id="ticket-modal-priority">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <div class="form-group" style="margin:0">
        <label>Department</label>
        <select id="ticket-modal-department"></select>
      </div>
      <div class="form-group" style="margin:0">
        <label>Assignee</label>
        <select id="ticket-modal-assignee"><option value="">Unassigned</option></select>
      </div>
      <div style="margin-left:auto;align-self:flex-end">
        <button class="btn btn-primary btn-sm" id="ticket-modal-save">Save changes</button>
      </div>
    </div>
    <div id="ticket-modal-desc" style="font-size:0.9rem;white-space:pre-wrap;background:var(--surface-2,rgba(0,0,0,0.03));padding:0.75rem;border-radius:8px;margin-bottom:1.25rem"></div>
    <div style="font-weight:700;margin-bottom:0.5rem">Activity</div>
    <div id="ticket-modal-thread" style="margin-bottom:0.75rem"></div>
    <form id="ticket-comment-form" style="display:flex;gap:0.5rem">
      <input type="text" id="ticket-comment-input" placeholder="Add an internal comment…" autocomplete="off" style="flex:1" />
      <button type="submit" class="btn btn-primary btn-sm">Comment</button>
    </form>
  </div>
</div>

<div id="ticket-create-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:560px;overflow-y:auto;max-height:calc(100dvh - 48px)">
    <div class="flex items-center" style="justify-content:space-between;gap:1rem">
      <div class="modal-title" style="margin:0">New Ticket</div>
      <button type="button" class="btn btn-ghost btn-sm" id="ticket-create-close">✕</button>
    </div>
    <form id="ticket-create-form" style="margin-top:1rem">
      <div class="form-group">
        <label>Category</label>
        <select id="tc-category"></select>
      </div>
      <div class="form-group">
        <label>Subject</label>
        <input type="text" id="tc-subject" autocomplete="off" required />
      </div>
      <div class="form-group">
        <label>Details</label>
        <textarea id="tc-description" rows="3"></textarea>
      </div>
      <div class="flex gap-2" style="flex-wrap:wrap">
        <div class="form-group" style="flex:1;min-width:160px"><label>Requester name</label><input type="text" id="tc-requester-name" autocomplete="off" /></div>
        <div class="form-group" style="flex:1;min-width:160px"><label>Priority</label><select id="tc-priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
      </div>
      <div class="flex gap-2" style="flex-wrap:wrap">
        <div class="form-group" style="flex:1;min-width:160px"><label>Requester email</label><input type="email" id="tc-requester-email" autocomplete="off" /></div>
        <div class="form-group" style="flex:1;min-width:160px"><label>Requester phone</label><input type="text" id="tc-requester-phone" autocomplete="off" /></div>
      </div>
      <div class="flex gap-2" style="flex-wrap:wrap">
        <div class="form-group" style="flex:1;min-width:160px"><label>Order ID</label><input type="text" id="tc-order-id" autocomplete="off" /></div>
        <div class="form-group" style="flex:1;min-width:160px"><label>Property address</label><input type="text" id="tc-order-address" autocomplete="off" /></div>
      </div>
      <div id="ticket-create-error" class="hidden" style="color:var(--danger,#c0000a);font-size:0.85rem;margin-bottom:0.5rem"></div>
      <div style="display:flex;justify-content:flex-end;gap:0.5rem">
        <button type="button" class="btn btn-ghost btn-sm" id="ticket-create-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Create ticket</button>
      </div>
    </form>
  </div>
</div>

<div id="category-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:620px;overflow-y:auto;max-height:calc(100dvh - 48px)">
    <div class="flex items-center" style="justify-content:space-between;gap:1rem">
      <div class="modal-title" style="margin:0" id="category-modal-title">Request Type</div>
      <button type="button" class="btn btn-ghost btn-sm" id="category-close">✕</button>
    </div>
    <form id="category-form" style="margin-top:1rem">
      <div class="form-group">
        <label>Option shown on the form</label>
        <input type="text" id="cat-label" autocomplete="off" placeholder="e.g. Change the property address" required />
        <div class="text-muted" style="font-size:0.78rem;margin-top:0.25rem">What the client picks from the dropdown.</div>
      </div>
      <div class="flex gap-2" style="flex-wrap:wrap">
        <div class="form-group" style="flex:1;min-width:200px">
          <label>Short label</label>
          <input type="text" id="cat-short-label" autocomplete="off" placeholder="e.g. Address change" />
          <div class="text-muted" style="font-size:0.78rem;margin-top:0.25rem">Used in email subjects: [WVT-1042] Address change — …</div>
        </div>
        <div class="form-group" style="flex:1;min-width:180px">
          <label>Routes to department</label>
          <select id="cat-department"></select>
        </div>
      </div>

      <div class="form-group">
        <label>Follow-up question</label>
        <select id="cat-extra-field">
          <option value="none">No follow-up question</option>
          <option value="select">Ask them to pick from a list</option>
          <option value="text">Ask them to type an answer</option>
        </select>
      </div>
      <div class="form-group hidden" id="cat-extra-label-group">
        <label>Question text</label>
        <input type="text" id="cat-extra-label" autocomplete="off" placeholder="e.g. Which media?" />
      </div>
      <div class="form-group hidden" id="cat-extra-options-group">
        <label>Choices (one per line)</label>
        <textarea id="cat-extra-options" rows="5" placeholder="Photos&#10;Video / Walkthrough&#10;Aerial / Drone"></textarea>
      </div>
      <div class="form-group hidden" id="cat-extra-placeholder-group">
        <label>Placeholder (optional)</label>
        <input type="text" id="cat-extra-placeholder" autocomplete="off" placeholder="e.g. Virtual staging, extra aerials…" />
      </div>

      <div class="flex gap-2" style="flex-wrap:wrap">
        <div class="form-group" style="flex:1;min-width:200px"><label>Details box label</label><input type="text" id="cat-details-label" autocomplete="off" placeholder="e.g. What needs changing?" /></div>
        <div class="form-group" style="flex:1;min-width:200px"><label>Details hint (optional)</label><input type="text" id="cat-details-hint" autocomplete="off" placeholder="Shown under the box" /></div>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:0.5rem;font-weight:600">
          <input type="checkbox" id="cat-active" style="width:auto" checked /> Show on the intake form
        </label>
        <div class="text-muted" style="font-size:0.78rem;margin-top:0.25rem">Turn off to retire a type without touching existing tickets.</div>
      </div>

      <div id="category-error" class="hidden" style="color:var(--danger,#c0000a);font-size:0.85rem;margin-bottom:0.5rem"></div>
      <div style="display:flex;justify-content:flex-end;gap:0.5rem">
        <button type="button" class="btn btn-ghost btn-sm" id="category-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Save</button>
      </div>
    </form>
  </div>
</div>

<script>
(function() {
  'use strict';

  const API = '/api/admin';
  let token = localStorage.getItem('oc_admin_token');
  let currentUser = null;
  let allAgents = [];
  let permsModalUserId = null;
  let gatewayConfig = null;
  let chatFrameMounted = false;
  let impersonatedBy = null;

  // ── Impersonation ────────────────────────────────────────────────────────
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
    if (returnToken) {
      localStorage.setItem('oc_admin_token', returnToken);
    } else {
      localStorage.removeItem('oc_admin_token');
    }
    location.reload();
  });

  window.loginAsUser = async function(id, username) {
    if (!confirm('Log in as "' + username + '"? You can return to your own session at any time.')) return;
    const r = await api('POST', '/users/' + id + '/impersonate');
    if (!r.ok) { alert(r.data.error || 'Failed to log in as user.'); return; }
    localStorage.setItem('oc_impersonator_token', token);
    token = r.data.token;
    localStorage.setItem('oc_admin_token', token);
    location.reload();
  };

  // ── API helpers ──────────────────────────────────────────────────────────
  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  // ── Routing ──────────────────────────────────────────────────────────────
  // Access model. Admins pass everything; superadmin-only pages stay role-locked
  // regardless of grants. For a non-admin, a page opens only if its feature or
  // report grant is held — adminOnly pages (user management, financials) are
  // never grantable. Mirrors the server-side gate in admin-http.ts; the server
  // is the enforcement, this is what keeps the nav honest.
  const pages = {
    dashboard: { el: 'page-dashboard', title: 'Dashboard', adminOnly: false, superAdminOnly: false },
    users: { el: 'page-users', title: 'Users', adminOnly: true, superAdminOnly: false },
    agents: { el: 'page-agents', title: 'Agents', adminOnly: false, superAdminOnly: true },
    chat: { el: 'page-chat', title: 'Chat', adminOnly: false, superAdminOnly: false, feature: 'chat' },
    resources: { el: 'page-resources', title: 'Resource Library', adminOnly: false, superAdminOnly: false, feature: 'resources' },
    system: { el: 'page-system', title: 'System', adminOnly: true, superAdminOnly: true },
    account: { el: 'page-account', title: 'My Account', adminOnly: false, superAdminOnly: false },
    projects: { el: 'page-projects', title: 'Projects', adminOnly: false, superAdminOnly: false, feature: 'projects' },
    reports: { el: 'page-reports-home', title: 'Reports', adminOnly: false, superAdminOnly: false, reportAny: true },
    'report-cancellations': { el: 'page-reports', title: 'Agent Cancellation Report', adminOnly: false, superAdminOnly: false, report: 'report-cancellations' },
    rankings: { el: 'page-rankings', title: 'Agent & Company Rankings', adminOnly: false, superAdminOnly: false, report: 'rankings' },
    photographers: { el: 'page-photographers', title: 'Photographers', adminOnly: false, superAdminOnly: false, report: 'photographers' },
    'pipedrive-cleanup': { el: 'page-pipedrive-cleanup', title: 'Pipedrive Cleanup', adminOnly: false, superAdminOnly: false, report: 'pipedrive-cleanup' },
    churn: { el: 'page-churn', title: 'Churn & Retention', adminOnly: false, superAdminOnly: false, report: 'churn' },
    tickets: { el: 'page-tickets', title: 'Support Tickets', adminOnly: false, superAdminOnly: false, feature: 'tickets' },
    departments: { el: 'page-departments', title: 'Departments', adminOnly: false, superAdminOnly: false, feature: 'ticket-departments' },
    categories: { el: 'page-categories', title: 'Request Types', adminOnly: false, superAdminOnly: false, feature: 'ticket-categories' },
    'form-preview': { el: 'page-form-preview', title: 'Intake Form', adminOnly: false, superAdminOnly: false, feature: 'ticket-form' },
    // Past Due is reachable both from the Financials nav ('financials', the
    // legacy hash) and from the Reports landing ('past-due', matching the
    // report permission key). Same page, same gate.
    financials: { el: 'page-financials', title: 'Past Due Accounts', adminOnly: false, superAdminOnly: false, report: 'past-due' },
    'past-due': { el: 'page-financials', title: 'Past Due Accounts', adminOnly: false, superAdminOnly: false, report: 'past-due' },
    cleveland: { el: 'page-cleveland', title: 'Cleveland Investment', adminOnly: true, superAdminOnly: false },
  };

  // Sections only the admin SPA can serve. A non-admin holding one of these is
  // kept here instead of being bounced to the portal, which has no ticket UI.
  var ADMIN_SPA_ONLY_FEATURES = ['tickets', 'ticket-departments', 'ticket-categories', 'ticket-form'];

  function grants() { return (currentUser && currentUser.permissions) || []; }
  function hasFeature(f) { return grants().some(function(p){ return p.permissionType === 'feature' && p.value === f; }); }
  function hasReport(k) { return grants().some(function(p){ return p.permissionType === 'report' && p.value === k; }); }
  function needsAdminSpa() { return ADMIN_SPA_ONLY_FEATURES.some(hasFeature); }

  function canAccessPage(key) {
    const def = pages[key];
    if (!def) return false;
    if (def.superAdminOnly) return isSuperAdmin();
    if (isAdmin()) return true;
    if (def.adminOnly) return false;
    if (def.feature) return hasFeature(def.feature);
    if (def.report) return hasReport(def.report);
    if (def.reportAny) return REPORTS.some(function(r){ return hasReport(r.key); });
    return true; // dashboard, account
  }

  function firstAllowedPage() {
    const order = ['dashboard', 'tickets', 'chat', 'projects', 'reports', 'resources', 'departments', 'categories', 'form-preview'];
    for (const key of order) { if (canAccessPage(key)) return key; }
    return 'account';
  }

  function mountAdminChatFrame() {
    if (chatFrameMounted) return;
    const frame = document.getElementById('admin-chat-frame');
    const cfg = gatewayConfig;
    if (!cfg) return;
    chatFrameMounted = true;
    const hash = [];
    if (cfg.gatewayWsUrl) hash.push('gatewayUrl=' + encodeURIComponent(cfg.gatewayWsUrl));
    const credential = cfg.gatewayToken || cfg.gatewayPassword || '';
    if (credential) hash.push('token=' + encodeURIComponent(credential));
    frame.src = '/chat' + (hash.length ? '#' + hash.join('&') : '');
  }

  function navigate(page) {
    let def = pages[page];
    if (!def) { page = 'dashboard'; def = pages.dashboard; }
    // Deep links (and stale hashes) go through the same gate as the nav, so a
    // hand-typed #tickets can't open a page the user wasn't granted.
    if (!canAccessPage(page)) {
      page = firstAllowedPage();
      def = pages[page];
    }
    const isChatPage = page === 'chat';
    document.getElementById('main-topbar').classList.toggle('hidden', isChatPage);
    document.getElementById('main-content').classList.toggle('hidden', isChatPage);
    document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
    document.getElementById(def.el).classList.remove('hidden');
    document.getElementById('page-title').textContent = def.title;
    // Report sub-pages are reached from the Reports landing, not their own nav
    // item, so keep the Reports nav entry highlighted while viewing one.
    let navKey = page;
    if (page === 'report-cancellations' || page === 'rankings' || page === 'photographers' || page === 'pipedrive-cleanup' || page === 'churn') navKey = 'reports';
    // Past Due keeps its own Financials nav entry highlighted even when it was
    // opened from the Reports landing under its report key.
    if (page === 'past-due') navKey = 'financials';
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.page === navKey);
    });
    if (page === 'users') loadUsers();
    if (page === 'agents') loadAgents();
    if (page === 'resources') loadResources();
    if (page === 'system') loadSystem();
    if (page === 'dashboard') loadDashboard();
    if (page === 'chat') mountAdminChatFrame();
    if (page === 'projects') loadProjects();
    if (page === 'reports') loadReportsHome();
    if (page === 'report-cancellations') loadReports();
    if (page === 'rankings') loadRankings();
    if (page === 'photographers') loadPhotographers();
    if (page === 'pipedrive-cleanup') loadPipedriveCleanup();
    if (page === 'churn') loadChurn();
    if (page === 'tickets') loadTickets();
    if (page === 'departments') loadDepartments();
    if (page === 'categories') loadCategories();
    if (page === 'form-preview') loadFormPreview();
    if (page === 'financials' || page === 'past-due') loadFinancials();
    if (page === 'cleveland') loadCleveland();
    location.hash = '#' + page;
    closeSidebar();
  }

  // ── Mobile sidebar ───────────────────────────────────────────────────────
  function closeSidebar() {
    document.getElementById('app-sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('open');
  }
  function toggleSidebar() {
    document.getElementById('app-sidebar').classList.toggle('open');
    document.getElementById('sidebar-backdrop').classList.toggle('open');
  }
  document.getElementById('menu-toggle-btn').addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebar);

  function isAdmin() {
    return currentUser && (currentUser.role === 'superadmin' || currentUser.role === 'admin');
  }
  function isSuperAdmin() {
    return currentUser && currentUser.role === 'superadmin';
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    const err = document.getElementById('login-error');
    err.classList.add('hidden');
    const r = await api('POST', '/auth/login', {
      username: document.getElementById('login-username').value,
      password: document.getElementById('login-password').value,
    });
    btn.disabled = false;
    btn.textContent = 'Sign in';
    if (!r.ok) {
      err.textContent = 'Invalid username or password.';
      err.classList.remove('hidden');
      return;
    }
    token = r.data.token;
    localStorage.setItem('oc_admin_token', token);
    localStorage.removeItem('oc_impersonator_token');
    currentUser = r.data.user;
    impersonatedBy = null;
    await showApp();
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('POST', '/auth/logout');
    token = null;
    currentUser = null;
    gatewayConfig = null;
    chatFrameMounted = false;
    localStorage.removeItem('oc_admin_token');
    localStorage.removeItem('oc_portal_token');
    localStorage.removeItem('oc_impersonator_token');
    document.getElementById('admin-chat-frame').src = 'about:blank';
    location.reload();
  });

  async function tryRestoreSession() {
    if (!token) return false;
    const r = await api('GET', '/auth/me');
    if (!r.ok) { token = null; localStorage.removeItem('oc_admin_token'); return false; }
    currentUser = r.data;
    impersonatedBy = r.data.impersonatedBy || null;
    return true;
  }

  async function showApp() {
    // Non-admins belong in the user portal — unless they hold a grant only this
    // SPA can serve (the ticket surfaces), in which case they stay here with the
    // nav filtered down to what they're actually granted.
    if (!isAdmin() && !needsAdminSpa()) {
      localStorage.setItem('oc_portal_token', token);
      localStorage.removeItem('oc_admin_token');
      token = null;
      window.location.replace('/portal');
      return;
    }
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('sidebar-username').textContent = currentUser.username;
    document.getElementById('sidebar-role').textContent = currentUser.role;
    updateImpersonationBanner();
    // Hide admin-only nav for non-admins
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', !isAdmin());
    });
    // Hide superadmin-only nav (Agents, System) for admins and below
    document.querySelectorAll('.superadmin-only').forEach(el => {
      el.classList.toggle('hidden', !isSuperAdmin());
    });
    // For a granted non-admin the role classes above are too blunt: re-derive
    // every nav item from the same predicate navigate() enforces, so what's
    // visible and what's reachable can't drift apart.
    if (!isAdmin()) {
      document.querySelectorAll('.nav-link[data-page]').forEach(el => {
        el.classList.toggle('hidden', !canAccessPage(el.dataset.page));
      });
    }
    // Fetch gateway config for the chat iframe (chat-gated server-side; a user
    // without chat access simply gets no frame).
    const cfgRes = await api('GET', '/portal/config');
    if (cfgRes.ok) gatewayConfig = cfgRes.data;
    // Show superadmin role option only for superadmins
    const requested = location.hash.replace('#', '');
    navigate(requested || firstAllowedPage());
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  const DASHBOARD_QUOTES = [
    "Behind every great tour video is a coffee that went cold three takes ago.",
    "We don't do boring walkthroughs — we do \\"wow, I need to see this in person\\" walkthroughs.",
    "Shaky footage is a warning sign. So is a Monday with no coffee.",
    "A good drone shot fixes a lot of problems. Sadly, not this many emails.",
    "Somewhere right now, a client is watching our video on repeat. No pressure.",
    "Lighting, framing, and one perfect take — the holy trinity of not re-shooting tomorrow.",
    "Our videos travel further than we do. That's the job.",
    "Nobody says \\"take twenty-three's the charm\\" and means it, but here we are.",
    "Every great tour starts with someone yelling \\"one more take!\\"",
    "We make places look incredible on camera. Mondays, we're still working on.",
  ];

  function pickDashboardQuote() {
    return DASHBOARD_QUOTES[Math.floor(Math.random() * DASHBOARD_QUOTES.length)];
  }

  async function loadDashboard() {
    document.getElementById('dashboard-greeting').textContent = 'Welcome back, ' + (currentUser.username || '') + '!';
    document.getElementById('dashboard-quote').textContent = '\\u201c' + pickDashboardQuote() + '\\u201d';
    const grid = document.getElementById('stats-grid');
    const summaryEl = document.getElementById('dashboard-task-summary');
    grid.innerHTML = '';
    if (!isAdmin()) {
      grid.innerHTML = \`<div class="stat-card"><div class="stat-label">Your Role</div><div class="stat-value">\${currentUser.role}</div></div>\`;
      summaryEl.innerHTML = '';
      return;
    }
    const calls = [api('GET', '/users'), api('GET', '/tasks')];
    if (isSuperAdmin()) calls.push(api('GET', '/agents'));
    const [usersR, tasksR, agentsR] = await Promise.all(calls);
    const tasks = tasksR.ok ? (tasksR.data.tasks || []).filter(function(t) { return !t.parentTaskId; }) : [];
    // "Open" is per board: a project whose last column is "Delivered" must not
    // report every delivered task as still open.
    await statusRegistry.ensure(tasks.map(function(t) { return t.projectId; }));
    const openTasks = tasks.filter(function(t) { return !statusRegistry.isDoneTask(t); });
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const overdue = openTasks.filter(function(t) { return t.dueDate && t.dueDate < now.getTime(); });

    const stats = [
      { label: 'Users', value: usersR.ok ? usersR.data.users.length : '—' },
      { label: 'Open Tasks', value: tasksR.ok ? openTasks.length : '—' },
      { label: 'Overdue', value: tasksR.ok ? overdue.length : '—' },
    ];
    if (isSuperAdmin()) stats.push({ label: 'Agents', value: agentsR && agentsR.ok ? agentsR.data.agents.length : '—' });
    stats.push({ label: 'Your Role', value: currentUser.role });
    grid.innerHTML = stats.map(s => \`
        <div class="stat-card">
          <div class="stat-label">\${s.label}</div>
          <div class="stat-value">\${s.value}</div>
        </div>\`).join('');

    if (!tasksR.ok) {
      summaryEl.innerHTML = '<p class="text-muted">Could not load tasks.</p>';
    } else if (!openTasks.length) {
      summaryEl.innerHTML = '<p class="text-muted">Nothing on your plate right now. 🎉</p>';
    } else {
      const upcoming = openTasks.slice().sort(function(a, b) {
        return (a.dueDate || Infinity) - (b.dueDate || Infinity);
      }).slice(0, 5);
      summaryEl.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Task</th><th>Status</th><th>Due</th></tr></thead><tbody>' +
        upcoming.map(function(t) {
          return '<tr><td>' + esc(t.title) + '</td><td>' + esc(t.status) + '</td><td>' + (t.dueDate ? esc(formatDateShort(t.dueDate)) : '—') + '</td></tr>';
        }).join('') +
        '</tbody></table></div>' +
        '<p class="text-muted mt-4" style="font-size:0.8rem">' + openTasks.length + ' open, ' + overdue.length + ' overdue &mdash; ' +
        '<a href="#projects" onclick="navigate(\\'projects\\');return false;">View all →</a></p>';
    }
  }

  // ── Users ────────────────────────────────────────────────────────────────
  let adminUsers = [];
  function fullName(u) {
    return [u && u.firstName, u && u.lastName].filter(Boolean).join(' ');
  }
  // Display label for a user id: "First Last" if known, else username, else the raw id.
  function userLabel(id) {
    const u = adminUsers.find(function(x) { return x.id === id; });
    if (!u) return id;
    return fullName(u) || u.username;
  }

  async function loadUsers() {
    const body = document.getElementById('users-table-body');
    body.innerHTML = '<tr><td colspan="6" class="empty-state"><span class="spin">⟳</span> Loading…</td></tr>';
    const r = await api('GET', '/users');
    if (!r.ok) { body.innerHTML = '<tr><td colspan="6" class="empty-state">Failed to load users.</td></tr>'; return; }
    adminUsers = r.data.users;
    const users = adminUsers;
    if (!users.length) { body.innerHTML = '<tr><td colspan="6" class="empty-state">No users yet.</td></tr>'; return; }
    body.innerHTML = users.map(u => \`
      <tr>
        <td><strong>\${esc(u.username)}</strong></td>
        <td class="text-muted">\${esc(fullName(u)) || '—'}</td>
        <td class="text-muted">\${u.email ? esc(u.email) : '—'}</td>
        <td><span class="badge badge-\${u.role}">\${u.role}</span></td>
        <td class="text-muted">\${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" onclick="openEditUser('\${esc(u.id)}')">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="openPermsModal('\${esc(u.id)}','\${esc(u.username)}')">Permissions</button>
            \${isSuperAdmin() && u.id !== currentUser.id ? \`<button class="btn btn-ghost btn-sm" onclick="loginAsUser('\${esc(u.id)}','\${esc(u.username)}')">Login as</button>\` : ''}
            \${u.id !== currentUser.id ? \`<button class="btn btn-danger btn-sm" onclick="deleteUser('\${esc(u.id)}','\${esc(u.username)}')">Delete</button>\` : ''}
          </div>
        </td>
      </tr>\`).join('');
  }

  // Ensure the directory cache is populated for member/assignee pickers.
  async function ensureUsersLoaded() {
    if (adminUsers.length) return;
    const r = await api('GET', '/users');
    if (r.ok) adminUsers = r.data.users;
  }

  window.openEditUser = function(id) {
    const u = adminUsers.find(function(x) { return x.id === id; }) || { id: id, username: '', role: 'user' };
    document.getElementById('user-modal-title').textContent = 'Edit User';
    document.getElementById('modal-user-id').value = u.id;
    document.getElementById('modal-username').value = u.username;
    document.getElementById('modal-first-name').value = u.firstName || '';
    document.getElementById('modal-last-name').value = u.lastName || '';
    document.getElementById('modal-email').value = u.email || '';
    document.getElementById('modal-password').value = '';
    document.getElementById('modal-pw-label').textContent = 'New Password (leave blank to keep)';
    document.getElementById('modal-password').required = false;
    document.getElementById('modal-role').value = u.role;
    document.getElementById('user-modal-submit').textContent = 'Save Changes';
    document.getElementById('modal-role-group').classList.toggle('hidden', !isSuperAdmin());
    document.getElementById('user-modal-error').classList.add('hidden');
    document.getElementById('user-modal').classList.remove('hidden');
  };

  document.getElementById('add-user-btn').addEventListener('click', () => {
    document.getElementById('user-modal-title').textContent = 'Add User';
    document.getElementById('modal-user-id').value = '';
    document.getElementById('modal-username').value = '';
    document.getElementById('modal-first-name').value = '';
    document.getElementById('modal-last-name').value = '';
    document.getElementById('modal-email').value = '';
    document.getElementById('modal-password').value = '';
    document.getElementById('modal-pw-label').textContent = 'Password';
    document.getElementById('modal-password').required = true;
    document.getElementById('modal-role').value = 'user';
    document.getElementById('user-modal-submit').textContent = 'Create User';
    document.getElementById('modal-role-group').classList.toggle('hidden', !isSuperAdmin());
    document.getElementById('user-modal-error').classList.add('hidden');
    document.getElementById('user-modal').classList.remove('hidden');
  });

  document.getElementById('user-modal-cancel').addEventListener('click', () => {
    document.getElementById('user-modal').classList.add('hidden');
  });

  document.getElementById('user-modal-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('modal-user-id').value;
    const username = document.getElementById('modal-username').value.trim();
    const password = document.getElementById('modal-password').value;
    const role = document.getElementById('modal-role').value;
    const firstName = document.getElementById('modal-first-name').value.trim();
    const lastName = document.getElementById('modal-last-name').value.trim();
    const email = document.getElementById('modal-email').value.trim();
    const errEl = document.getElementById('user-modal-error');
    errEl.classList.add('hidden');
    let r;
    if (id) {
      const body = { username, role, firstName, lastName, email };
      if (password) body.password = password;
      r = await api('PUT', '/users/' + id, body);
    } else {
      r = await api('POST', '/users', { username, password, role, firstName, lastName, email });
    }
    if (!r.ok) {
      errEl.textContent = r.data.error || 'An error occurred.';
      errEl.classList.remove('hidden');
      return;
    }
    document.getElementById('user-modal').classList.add('hidden');
    loadUsers();
  });

  window.deleteUser = async function(id, username) {
    if (!confirm(\`Delete user "\${username}"? This cannot be undone.\`)) return;
    await api('DELETE', '/users/' + id);
    loadUsers();
  };

  // ── Permissions Modal ─────────────────────────────────────────────────────
  // Sections a portal user can be granted. Reports are sourced from the REPORTS
  // catalog so a new report is toggleable the moment it's added.
  // Sourced from PORTAL_FEATURES so a new grantable section shows up here the
  // moment the server learns to gate it.
  var FEATURES = ${JSON.stringify(PORTAL_FEATURES)};
  function renderPermCheckbox(kind, value, label, checked) {
    return '<div class="flex items-center gap-2 mb-4" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">'+
      '<input type="checkbox" id="'+kind+'-perm-'+esc(value)+'" data-perm-kind="'+kind+'" value="'+esc(value)+'"'+(checked?' checked':'')+'>'+
      '<label for="'+kind+'-perm-'+esc(value)+'" style="margin:0;font-weight:normal">'+esc(label)+'</label>'+
      '</div>';
  }
  window.openPermsModal = async function(userId, username) {
    permsModalUserId = userId;
    document.getElementById('perms-modal-username').textContent = username;
    document.getElementById('perms-modal').classList.remove('hidden');
    // Reset to Access tab
    document.querySelectorAll('#perms-modal .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#perms-modal .tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelector('#perms-modal .tab[data-tab="access-tab"]').classList.add('active');
    document.getElementById('access-tab').classList.remove('hidden');
    // Load agents, skills, channels, and current permissions in parallel
    const [agentsR, skillsR, channelsR, permsR] = await Promise.all([
      api('GET', '/agents'),
      api('GET', '/skills'),
      api('GET', '/channels'),
      api('GET', '/users/' + userId + '/permissions'),
    ]);
    allAgents = agentsR.ok ? agentsR.data.agents : [];
    const perms = permsR.ok ? permsR.data.permissions : [];
    const grantedAgents = new Set(perms.filter(p => p.permissionType === 'agent').map(p => p.value));
    const grantedSkills = new Set(perms.filter(p => p.permissionType === 'skill').map(p => p.value));
    const grantedChannels = new Set(perms.filter(p => p.permissionType === 'channel').map(p => p.value));
    const grantedFeatures = new Set(perms.filter(p => p.permissionType === 'feature').map(p => p.value));
    const grantedReports = new Set(perms.filter(p => p.permissionType === 'report').map(p => p.value));

    document.getElementById('perms-features-list').innerHTML =
      FEATURES.map(f => renderPermCheckbox('feature', f.value, f.label, grantedFeatures.has(f.value))).join('');
    document.getElementById('perms-reports-list').innerHTML =
      REPORTS.map(r => renderPermCheckbox('report', r.key, r.title, grantedReports.has(r.key))).join('');

    // Agents list
    const agentsList = document.getElementById('perms-agents-list');
    agentsList.innerHTML = allAgents.length === 0
      ? '<p class="text-muted">No agents found.</p>'
      : allAgents.map(a => \`
        <div class="flex items-center gap-2 mb-4" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
          <input type="checkbox" id="agent-perm-\${esc(a.id)}" value="\${esc(a.id)}" \${grantedAgents.has(a.id) ? 'checked' : ''}>
          <label for="agent-perm-\${esc(a.id)}" style="margin:0;font-weight:normal">\${esc(a.name || a.id)}</label>
        </div>\`).join('');

    // Skills list
    const skills = skillsR.ok ? skillsR.data.skills : [];
    const skillsList = document.getElementById('perms-skills-list');
    skillsList.innerHTML = skills.length === 0
      ? '<p class="text-muted">No skills found in any agent workspace.</p>'
      : skills.map(s => \`
        <div class="flex items-center gap-2 mb-4" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
          <input type="checkbox" id="skill-perm-\${esc(s.name)}" value="\${esc(s.name)}" \${grantedSkills.has(s.name) ? 'checked' : ''}>
          <label for="skill-perm-\${esc(s.name)}" style="margin:0;font-weight:normal">\${esc(s.name)}\${s.description ? \`<span class="text-muted" style="margin-left:0.5rem;font-size:0.8em">\${esc(s.description)}</span>\` : ''}</label>
        </div>\`).join('');

    // Channels list
    const channels = channelsR.ok ? channelsR.data.channels : [];
    const channelsList = document.getElementById('perms-channels-list');
    channelsList.innerHTML = channels.length === 0
      ? '<p class="text-muted">No channels configured.</p>'
      : channels.map(c => \`
        <div class="flex items-center gap-2 mb-4" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
          <input type="checkbox" id="channel-perm-\${esc(c.id)}" value="\${esc(c.id)}" \${grantedChannels.has(c.id) ? 'checked' : ''}>
          <label for="channel-perm-\${esc(c.id)}" style="margin:0;font-weight:normal">\${esc(c.id)}</label>
        </div>\`).join('');
  };

  document.getElementById('perms-modal-cancel').addEventListener('click', () => {
    document.getElementById('perms-modal').classList.add('hidden');
  });

  document.getElementById('perms-modal-save').addEventListener('click', async () => {
    const permissions = [];
    document.querySelectorAll('#perms-agents-list input[type=checkbox]:checked').forEach(cb => {
      permissions.push({ permissionType: 'agent', value: cb.value });
    });
    document.querySelectorAll('#perms-skills-list input[type=checkbox]:checked').forEach(cb => {
      permissions.push({ permissionType: 'skill', value: cb.value });
    });
    document.querySelectorAll('#perms-channels-list input[type=checkbox]:checked').forEach(cb => {
      permissions.push({ permissionType: 'channel', value: cb.value });
    });
    document.querySelectorAll('#perms-features-list input[type=checkbox]:checked').forEach(cb => {
      permissions.push({ permissionType: 'feature', value: cb.value });
    });
    document.querySelectorAll('#perms-reports-list input[type=checkbox]:checked').forEach(cb => {
      permissions.push({ permissionType: 'report', value: cb.value });
    });
    await api('PUT', '/users/' + permsModalUserId + '/permissions', { permissions });
    document.getElementById('perms-modal').classList.add('hidden');
  });

  // Tabs in perms modal
  document.querySelectorAll('.tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(target).classList.remove('hidden');
    });
  });

  // ── Resources ─────────────────────────────────────────────────────────────
  let resourceActiveTags = new Set();
  let resourceSearchTimer = null;
  let resourceModalTags = [];
  let resourceEditId = null;
  let resourceDataMap = {};

  function renderResourceCards(resources, allTags) {
    const grid = document.getElementById('resources-grid');
    // Rebuild lookup map so openEditResource can find resources by ID
    resourceDataMap = {};
    for (const r of resources) resourceDataMap[r.id] = r;
    // Render tag filters
    const filterWrap = document.getElementById('resources-tag-filters');
    filterWrap.innerHTML = allTags.length === 0 ? '' : allTags.map(t => \`
      <span class="tag-filter-chip\${resourceActiveTags.has(t) ? ' active' : ''}" onclick="toggleTagFilter('\${esc(t)}')">\${esc(t)}</span>\`
    ).join('');
    if (!resources.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No resources found.</div>';
      return;
    }
    grid.innerHTML = resources.map(r => {
      const typeIcon = r.type === 'file' ? '📄' : '🔗';
      const aiBadge = r.aiAccess
        ? '<span class="access-badge access-badge-ai">🤖 AI</span>'
        : '<span class="access-badge access-badge-off">🤖 No AI</span>';
      const userBadge = r.userAccess
        ? '<span class="access-badge access-badge-users">👥 Users</span>'
        : '<span class="access-badge access-badge-off">👥 Private</span>';
      const tags = r.tags.map(t => \`<span class="resource-tag">\${esc(t)}</span>\`).join('');
      const adminActions = isAdmin() ? \`
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" onclick="openEditResource('\${esc(r.id)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteResource('\${esc(r.id)}','\${esc(r.title)}')">Delete</button>
        </div>\` : '';
      const fileLink = r.type === 'file'
        ? \`<a class="btn btn-ghost btn-sm" href="\${API}/resources/\${esc(r.id)}/file" target="_blank" style="text-decoration:none">↓ Download</a>\`
        : \`<a class="btn btn-ghost btn-sm" href="\${esc(r.url)}" target="_blank" rel="noopener" style="text-decoration:none">↗ Open</a>\`;
      const descHtml = r.description
        ? \`<div class="resource-desc resource-desc-collapsed" id="rdesc-\${esc(r.id)}">\${esc(r.description)}</div><button class="resource-desc-toggle" id="rdesc-btn-\${esc(r.id)}" onclick="toggleResourceDesc('\${esc(r.id)}')">Show more</button>\`
        : '';
      return \`
        <div class="resource-card">
          <div class="resource-card-body">
            <div class="resource-card-title">
              <span class="resource-type-icon">\${typeIcon}</span>
              <span class="resource-title-text">\${esc(r.title)}</span>
            </div>
            \${descHtml}
            \${tags ? \`<div class="resource-tags">\${tags}</div>\` : ''}
            <div class="resource-access">\${aiBadge}\${userBadge}</div>
          </div>
          <div class="resource-card-footer">
            <span class="resource-date">\${formatTimeAgo(new Date(r.createdAt).toISOString())}</span>
            <div class="flex gap-2">
              \${fileLink}
              \${adminActions}
            </div>
          </div>
        </div>\`;
    }).join('');
    // Show toggle buttons only for descriptions that are actually truncated
    requestAnimationFrame(() => {
      grid.querySelectorAll('.resource-desc').forEach(el => {
        if (el.scrollHeight > el.clientHeight + 1) {
          const btn = document.getElementById('rdesc-btn-' + el.id.replace('rdesc-', ''));
          if (btn) btn.style.display = 'block';
        }
      });
    });
  }

  async function loadResources() {
    const grid = document.getElementById('resources-grid');
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="spin">⟳</span> Loading…</div>';
    const search = document.getElementById('resources-search').value.trim();
    const tags = Array.from(resourceActiveTags).join(',');
    let qs = '';
    if (search) qs += \`search=\${encodeURIComponent(search)}\`;
    if (tags) qs += (qs ? '&' : '') + \`tags=\${encodeURIComponent(tags)}\`;
    const r = await api('GET', '/resources' + (qs ? '?' + qs : ''));
    if (!r.ok) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Failed to load resources.</div>'; return; }
    renderResourceCards(r.data.resources, r.data.allTags);
  }

  window.toggleTagFilter = function(tag) {
    if (resourceActiveTags.has(tag)) resourceActiveTags.delete(tag);
    else resourceActiveTags.add(tag);
    loadResources();
  };

  document.getElementById('resources-search').addEventListener('input', () => {
    clearTimeout(resourceSearchTimer);
    resourceSearchTimer = setTimeout(loadResources, 300);
  });

  // Tag chip input logic
  function renderModalTags() {
    const wrap = document.getElementById('tag-chip-wrap');
    const input = document.getElementById('tag-input');
    // Remove old chips
    wrap.querySelectorAll('.chip').forEach(el => el.remove());
    resourceModalTags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = esc(tag) + \`<span class="chip-remove" data-i="\${i}">×</span>\`;
      chip.querySelector('.chip-remove').addEventListener('click', () => {
        resourceModalTags.splice(i, 1);
        renderModalTags();
      });
      wrap.insertBefore(chip, input);
    });
  }

  document.getElementById('tag-input').addEventListener('keydown', e => {
    const input = e.target;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.value.trim().replace(/,/g, '');
      if (val && !resourceModalTags.includes(val)) {
        resourceModalTags.push(val);
        renderModalTags();
      }
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && resourceModalTags.length) {
      resourceModalTags.pop();
      renderModalTags();
    }
  });

  window.onResourceTypeChange = function() {
    const type = document.getElementById('resource-type').value;
    document.getElementById('resource-url-group').classList.toggle('hidden', type !== 'link');
    document.getElementById('resource-file-group').classList.toggle('hidden', type !== 'file');
  };

  function openAddResource() {
    resourceEditId = null;
    resourceModalTags = [];
    document.getElementById('resource-modal-title').textContent = 'Add Resource';
    document.getElementById('resource-modal-id').value = '';
    document.getElementById('resource-type').value = 'link';
    document.getElementById('resource-type').disabled = false;
    document.getElementById('resource-title').value = '';
    document.getElementById('resource-desc').value = '';
    document.getElementById('resource-url').value = '';
    document.getElementById('resource-file').value = '';
    document.getElementById('resource-file-info').textContent = '';
    document.getElementById('resource-ai-access').checked = true;
    document.getElementById('resource-user-access').checked = false;
    document.getElementById('resource-modal-submit').textContent = 'Add Resource';
    document.getElementById('resource-modal-error').classList.add('hidden');
    renderModalTags();
    onResourceTypeChange();
    document.getElementById('resource-modal').classList.remove('hidden');
  }

  window.openEditResource = function(id) {
    const r = resourceDataMap[id];
    if (!r) return;
    resourceEditId = r.id;
    resourceModalTags = [...(r.tags || [])];
    document.getElementById('resource-modal-title').textContent = 'Edit Resource';
    document.getElementById('resource-modal-id').value = r.id;
    document.getElementById('resource-type').value = r.type;
    document.getElementById('resource-type').disabled = true;
    document.getElementById('resource-title').value = r.title;
    document.getElementById('resource-desc').value = r.description || '';
    document.getElementById('resource-url').value = r.url || '';
    document.getElementById('resource-ai-access').checked = !!r.aiAccess;
    document.getElementById('resource-user-access').checked = !!r.userAccess;
    document.getElementById('resource-modal-submit').textContent = 'Save Changes';
    document.getElementById('resource-modal-error').classList.add('hidden');
    renderModalTags();
    onResourceTypeChange();
    document.getElementById('resource-modal').classList.remove('hidden');
  };

  window.toggleResourceDesc = function(id) {
    const el = document.getElementById('rdesc-' + id);
    const btn = document.getElementById('rdesc-btn-' + id);
    if (!el || !btn) return;
    const isCollapsed = el.classList.contains('resource-desc-collapsed');
    el.classList.toggle('resource-desc-collapsed', !isCollapsed);
    btn.textContent = isCollapsed ? 'Show less' : 'Show more';
  };

  document.getElementById('add-resource-btn').addEventListener('click', openAddResource);
  document.getElementById('resource-modal-cancel').addEventListener('click', () => {
    document.getElementById('resource-modal').classList.add('hidden');
  });

  document.getElementById('resource-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      document.getElementById('resource-file-info').textContent = \`\${file.name} — \${mb} MB\`;
      if (file.size > 15 * 1024 * 1024) {
        document.getElementById('resource-file-info').textContent += ' (too large, max 15 MB)';
      }
    }
  });

  document.getElementById('resource-modal-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('resource-modal-error');
    errEl.classList.add('hidden');
    const submitBtn = document.getElementById('resource-modal-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const id = document.getElementById('resource-modal-id').value;
    const type = document.getElementById('resource-type').value;
    const title = document.getElementById('resource-title').value.trim();
    const description = document.getElementById('resource-desc').value.trim() || null;
    const aiAccess = document.getElementById('resource-ai-access').checked;
    const userAccess = document.getElementById('resource-user-access').checked;
    const tags = [...resourceModalTags];
    // Add any unsaved tag still in input
    const pendingTag = document.getElementById('tag-input').value.trim().replace(/,/g, '');
    if (pendingTag && !tags.includes(pendingTag)) tags.push(pendingTag);

    let r;
    if (id) {
      // Edit
      const body = { title, description, tags, aiAccess, userAccess };
      const url = document.getElementById('resource-url').value.trim();
      if (type === 'link' && url) body.url = url;
      r = await api('PUT', '/resources/' + id, body);
    } else {
      // Create
      if (type === 'link') {
        const url = document.getElementById('resource-url').value.trim();
        if (!url) {
          errEl.textContent = 'URL is required.';
          errEl.classList.remove('hidden');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Add Resource';
          return;
        }
        r = await api('POST', '/resources', { type: 'link', title, description, url, tags, aiAccess, userAccess });
      } else {
        const fileInput = document.getElementById('resource-file');
        const file = fileInput.files[0];
        if (!file) {
          errEl.textContent = 'Please select a file.';
          errEl.classList.remove('hidden');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Add Resource';
          return;
        }
        if (file.size > 15 * 1024 * 1024) {
          errEl.textContent = 'File is too large (max 15 MB).';
          errEl.classList.remove('hidden');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Add Resource';
          return;
        }
        const fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]); // base64 part only
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        r = await api('POST', '/resources', {
          type: 'file',
          title,
          description,
          filename: file.name,
          mimetype: file.type || 'application/octet-stream',
          fileData,
          tags,
          aiAccess,
          userAccess,
        });
      }
    }

    submitBtn.disabled = false;
    submitBtn.textContent = id ? 'Save Changes' : 'Add Resource';

    if (!r.ok) {
      errEl.textContent = r.data.error || 'An error occurred.';
      errEl.classList.remove('hidden');
      return;
    }
    document.getElementById('resource-modal').classList.add('hidden');
    loadResources();
  });

  window.deleteResource = async function(id, title) {
    if (!confirm(\`Delete "\${title}"? This cannot be undone.\`)) return;
    await api('DELETE', '/resources/' + id);
    loadResources();
  };

  // ── Agents ───────────────────────────────────────────────────────────────
  async function loadAgents() {
    const grid = document.getElementById('agents-grid');
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="spin">⟳</span> Loading…</div>';
    if (isSuperAdmin()) {
      document.getElementById('agents-chat-hint').classList.remove('hidden');
    }
    const r = await api('GET', '/agents');
    if (!r.ok) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Failed to load agents.</div>'; return; }
    const agents = r.data.agents;
    const defaultId = r.data.defaultId;
    if (!agents.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No agents configured.</div>'; return; }
    grid.innerHTML = agents.map(a => {
      const isDefault = a.id === defaultId;
      const themeColor = a.theme || 'var(--accent)';
      return \`
        <div class="agent-card" id="agent-card-\${esc(a.id)}">
          <div class="agent-card-header">
            <div class="agent-emoji" style="background:\${esc(themeColor)}22;border:1px solid \${esc(themeColor)}44">\${esc(a.emoji || '🤖')}</div>
            <div class="agent-header-info">
              <div class="agent-name">\${esc(a.name || a.id)}\${isDefault ? ' <span class="badge badge-admin" style="font-size:0.6rem">default</span>' : ''}</div>
              <div class="agent-id">\${esc(a.id)}</div>
            </div>
          </div>
          <div class="agent-card-body">
            <div class="agent-meta">
              <div class="agent-meta-item">
                <div class="agent-meta-label">Model</div>
                <div class="agent-meta-value">\${esc(a.model || 'auto')}</div>
              </div>
            </div>
          </div>
          <div class="agent-card-actions">
            <button class="btn btn-ghost btn-sm" onclick="toggleAgentDetail('\${esc(a.id)}')">View Details</button>
            \${isSuperAdmin() ? \`<a href="/chat" target="_blank" class="btn btn-primary btn-sm">Open Chat ↗</a>\` : ''}
          </div>
          <div id="agent-detail-\${esc(a.id)}" class="agent-detail-panel hidden"></div>
        </div>\`;
    }).join('');
  }

  const agentDetailCache = {};
  window.toggleAgentDetail = async function(agentId) {
    const panel = document.getElementById('agent-detail-' + agentId);
    if (!panel.classList.contains('hidden')) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    if (agentDetailCache[agentId]) {
      renderAgentDetail(panel, agentDetailCache[agentId]);
      return;
    }
    panel.innerHTML = '<div class="text-muted" style="font-size:0.85rem"><span class="spin">⟳</span> Loading…</div>';
    const r = await api('GET', '/agents/' + agentId);
    if (!r.ok) { panel.innerHTML = '<div class="text-muted" style="font-size:0.85rem">Failed to load details.</div>'; return; }
    agentDetailCache[agentId] = r.data;
    renderAgentDetail(panel, r.data);
  };

  function renderAgentDetail(panel, data) {
    const skills = data.workspaceSkills || [];
    const sessions = data.recentSessions || [];
    let html = '';

    if (skills.length > 0) {
      html += \`<div class="agent-detail-section">
        <div class="agent-detail-label">Workspace Skills & Agents</div>
        <div>\${skills.map(s => \`<span class="skill-chip" title="\${esc(s.description || '')}">\${esc(s.name)}</span>\`).join('')}</div>
      </div>\`;
    }

    html += \`<div class="agent-detail-section">
      <div class="agent-detail-label">Recent Sessions \${sessions.length === 0 ? '(none yet)' : ''}</div>\`;
    if (sessions.length > 0) {
      html += sessions.map(s => \`
        <div class="session-item">
          <div class="session-msg">\${esc(s.firstMessage || '(no messages)')}</div>
          <div class="session-time">\${formatTimeAgo(s.timestamp)}</div>
        </div>\`).join('');
    } else {
      html += '<div class="text-muted" style="font-size:0.825rem">No sessions recorded yet.</div>';
    }
    html += '</div>';

    panel.innerHTML = html;
  }

  function formatTimeAgo(isoStr) {
    try {
      const diff = Date.now() - new Date(isoStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 2) return 'just now';
      if (mins < 60) return \`\${mins}m ago\`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return \`\${hrs}h ago\`;
      const days = Math.floor(hrs / 24);
      return \`\${days}d ago\`;
    } catch { return isoStr; }
  }

  // ── System ───────────────────────────────────────────────────────────────
  async function loadSystem() {
    const r = await api('GET', '/system');
    const el = document.getElementById('system-info-cards');
    if (!r.ok) { el.innerHTML = '<div class="card">Failed to load system info.</div>'; return; }
    const s = r.data;
    el.innerHTML = \`
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Version</div><div class="stat-value" style="font-size:1rem">\${esc(s.version || '—')}</div></div>
        <div class="stat-card"><div class="stat-label">Node.js</div><div class="stat-value" style="font-size:1rem">\${esc(s.nodeVersion)}</div></div>
        <div class="stat-card"><div class="stat-label">Platform</div><div class="stat-value" style="font-size:1rem">\${esc(s.platform)}</div></div>
        <div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value" style="font-size:1rem">\${formatUptime(s.uptime)}</div></div>
      </div>
      <div class="card">
        <div class="card-title">Default Model</div>
        <div>\${esc(s.model || 'not configured')}</div>
      </div>\`;
  }

  // ── Account ───────────────────────────────────────────────────────────────
  document.getElementById('change-pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const alertEl = document.getElementById('pw-alert');
    alertEl.className = 'hidden';
    const cur = document.getElementById('pw-current').value;
    const next = document.getElementById('pw-new').value;
    const confirm = document.getElementById('pw-confirm').value;
    if (next !== confirm) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = 'New passwords do not match.';
      return;
    }
    const r = await api('PUT', '/me/password', { currentPassword: cur, newPassword: next });
    if (!r.ok) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = r.data.error === 'invalid_current_password' ? 'Current password is incorrect.' : 'Failed to update password.';
    } else {
      alertEl.className = 'alert alert-success';
      alertEl.textContent = 'Password updated successfully.';
      document.getElementById('change-pw-form').reset();
    }
  });

  // ── Reports ──────────────────────────────────────────────────────────────
  let reportMonths = [];

  function monthLabel(m) {
    const [y, mo] = m.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function populateReportMonthSelects() {
    const fromSel = document.getElementById('report-from-sel');
    const toSel = document.getElementById('report-to-sel');
    if (fromSel.options.length) return;
    const opts = reportMonths.map(m => \`<option value="\${m}">\${monthLabel(m)}</option>\`).join('');
    fromSel.innerHTML = opts;
    toSel.innerHTML = opts;
    fromSel.value = reportMonths[0];
    toSel.value = reportMonths[reportMonths.length - 1];
  }

  async function loadReportMarkets() {
    const from = document.getElementById('report-from-sel').value;
    const to = document.getElementById('report-to-sel').value;
    const r = await api('GET', '/reports/agent-cancellations/markets?from=' + from + '&to=' + to);
    const sel = document.getElementById('report-market-sel');
    const current = sel.value;
    const markets = r.ok ? (r.data.markets || []) : [];
    sel.innerHTML = '<option value="">All markets</option>' + markets.map(m => \`<option value="\${esc(m)}">\${esc(m)}</option>\`).join('');
    if (markets.includes(current)) sel.value = current;
  }

  async function loadReportStatus() {
    const r = await api('GET', '/reports/agent-cancellations/status');
    const el = document.getElementById('report-refreshed-at');
    if (!r.ok) { el.textContent = ''; return; }
    const statuses = (r.data.status || []).filter(s => s.refreshedAt);
    if (statuses.length === 0) { el.textContent = 'Never refreshed'; return; }
    const latest = statuses.reduce((a, b) => (b.refreshedAt > a.refreshedAt ? b : a));
    el.textContent = 'Last refreshed: ' + new Date(latest.refreshedAt).toLocaleString();
  }

${REPORT_TABLE_COMPONENT_JS}
${PROJECT_CALENDAR_COMPONENT_JS}
${TASK_FEED_COMPONENT_JS}
${TASK_LIST_COMPONENT_JS}
${TASK_STATUS_COMPONENT_JS}
  var cancelCols = [
    { key: 'client', label: 'Client', value: function(r){ return r.client; } },
    { key: 'totalOrders', label: 'Total Orders', type: 'num', value: function(r){ return r.totalOrders; } },
    { key: 'cancellations', label: 'Cancellations', type: 'num', value: function(r){ return r.cancellations; } },
    { key: 'reschedules', label: 'Reschedules', type: 'num', value: function(r){ return r.reschedules; } },
    { key: 'pct', label: '% Cancelled/Rescheduled', type: 'num', value: function(r){ return Number(r.cancelledOrRescheduledPct.toFixed(1)); }, render: function(r){ return r.cancelledOrRescheduledPct.toFixed(1) + '%'; } }
  ];
  var cancelTable = null;
  async function loadReportTable() {
    const from = document.getElementById('report-from-sel').value;
    const to = document.getElementById('report-to-sel').value;
    const market = document.getElementById('report-market-sel').value;
    const qs = new URLSearchParams({ from, to });
    if (market) qs.set('market', market);
    if (!cancelTable) cancelTable = createReportTable({ containerId: 'report-table', reportKey: 'report-cancellations', frozenFirst: true, emptyMsg: 'No orders cached for this range yet. Try Refresh now.', columns: cancelCols });
    const r = await api('GET', '/reports/agent-cancellations?' + qs.toString());
    const statsEl = document.getElementById('report-stats-grid');
    if (!r.ok) {
      statsEl.innerHTML = '';
      cancelTable.setError();
      return;
    }
    const report = r.data.report;
    statsEl.innerHTML = \`
      <div class="stat-card"><div class="stat-label">Total Orders</div><div class="stat-value">\${report.totals.totalOrders}</div></div>
      <div class="stat-card"><div class="stat-label">Cancellations</div><div class="stat-value">\${report.totals.cancellations}</div></div>
      <div class="stat-card"><div class="stat-label">Reschedules</div><div class="stat-value">\${report.totals.reschedules}</div></div>
      <div class="stat-card"><div class="stat-label">% Cancelled/Rescheduled</div><div class="stat-value">\${report.totals.cancelledOrRescheduledPct.toFixed(1)}%</div></div>\`;
    cancelTable.setData(report.rows);
  }

  // The report catalog powers the landing page. One entry per report; adding a
  // report here (with its page key) surfaces it on the landing with no other
  // wiring. Later this list is filtered by the viewer's report permissions.
  var REPORTS = [
    { key: 'report-cancellations', icon: '📉', title: 'Agent Cancellation Report', desc: 'Cancellations and reschedules per client over a chosen date range and market.' },
    { key: 'rankings', icon: '🏆', title: 'Agent & Company Rankings', desc: 'Agents and companies ranked by order volume, with cancellation and reschedule rates.' },
    { key: 'photographers', icon: '📸', title: 'Photographers', desc: 'Roster with the markets each serves and how many shoots they completed in a selectable range.' },
    { key: 'pipedrive-cleanup', icon: '🧹', title: 'Pipedrive Cleanup', desc: 'Suggested CRM fixes to verify. Approved items become a worklist for whoever you grant access.' },
    { key: 'churn', icon: '📊', title: 'Churn & Retention', desc: 'Revenue retention, Pareto/NBD health, and a priority-ranked outreach queue of recoverable agents.' },
    { key: 'past-due', icon: '💰', title: 'Past Due Accounts', desc: 'Collections board of past-due payees. Assign an account and it becomes that person\\'s queue; partial payments are flagged for review.' }
  ];
  function loadReportsHome() {
    var grid = document.getElementById('reports-home-grid');
    // Admins see the whole catalog; anyone else sees only what they were
    // granted, so a card can't offer a page navigate() would refuse.
    var visible = isAdmin() ? REPORTS : REPORTS.filter(function(r){ return hasReport(r.key); });
    grid.innerHTML = visible.map(function(r){
      return '<button class="report-card" data-report="'+esc(r.key)+'">'+
        '<span class="report-card-icon">'+r.icon+'</span>'+
        '<span class="report-card-title">'+esc(r.title)+'</span>'+
        '<span class="report-card-desc">'+esc(r.desc)+'</span>'+
        '</button>';
    }).join('');
    grid.querySelectorAll('.report-card').forEach(function(btn){
      btn.addEventListener('click', function(){ navigate(btn.dataset.report); });
    });
    if (!visible.length) grid.innerHTML = '<div class="empty-state">No reports are available to you.</div>';
  }

  // ── Churn & Retention report ────────────────────────────────────────────────
  // Renders the JSON snapshot the Python retention engine writes to the
  // workspace. No compute here; refresh = re-run the engine.
  var churnQueueTable = null, churnScoresTable = null;
  // report: last snapshot; dismissed: agentKey -> dismissal record (shared across
  // the team, stored server-side); showHidden: viewing mode only — the tiles and
  // tier counts always describe the cleaned list.
  // notes: agentKey -> note records, newest first (shared, stored server-side).
  var churnState = { report: null, dismissed: {}, notes: {}, showHidden: false, refresh: null };
  var churnRefreshTimer = null;
  var CHURN_HEALTH_COLOR = { 'Healthy':'#2f855a', 'Watch':'#b7791f', 'At risk':'#c05621', 'Likely churned':'#b5473b' };
  // Mirror of churnAgentKey() in churn-store.ts — change both together.
  function churnKey(row){
    var id = row.agent_id == null ? '' : String(row.agent_id).trim();
    if (id) return id;
    var name = row.agent_name == null ? '' : String(row.agent_name).trim();
    var company = row.company_name == null ? '' : String(row.company_name).trim();
    return name + '|' + company;
  }
  function churnIsHidden(row){ return !!churnState.dismissed[churnKey(row)]; }
  function churnKept(rows){ return (rows || []).filter(function(r){ return !churnIsHidden(r); }); }
  // What a table shows: the cleaned list, plus the hidden rows while the viewer
  // has "Show hidden" on so they can restore them in place.
  function churnRowsFor(rows){ return churnState.showHidden ? (rows || []) : churnKept(rows); }
  function churnPct(v){ return (v == null) ? '—' : (Number(v) * 100).toFixed(1) + '%'; }
  function churnMoney(v){ return (v == null) ? '—' : '$' + Math.round(Number(v)).toLocaleString(); }
  function churnNum(v){ return (v == null) ? '—' : Number(v).toLocaleString(); }
  function churnHealthChip(label, count){
    var c = CHURN_HEALTH_COLOR[label] || '#666666';
    var txt = (count === undefined || count === '') ? esc(label) : esc(label) + ': ' + count;
    return '<span style="font-size:0.75rem;font-weight:700;padding:3px 9px;border-radius:6px;background:'+c+'1a;color:'+c+'">'+txt+'</span>';
  }
  // Agent name, annotated when the row is one of the hidden ones on show.
  function churnAgentCell(r){
    var name = esc(r.agent_name == null ? '' : String(r.agent_name));
    var d = churnState.dismissed[churnKey(r)];
    if (!d) return name;
    var who = d.dismissedByName ? ' by ' + d.dismissedByName : '';
    var when = d.dismissedAt ? ' on ' + new Date(d.dismissedAt).toISOString().slice(0, 10) : '';
    var why = d.reason ? ' — ' + d.reason : '';
    return name + ' <span class="text-muted" style="font-size:0.72rem" title="' + esc('Hidden' + who + when + why) + '">(hidden)</span>';
  }
  function churnActionCell(r){
    var k = esc(churnKey(r));
    return churnIsHidden(r)
      ? '<button type="button" class="btn btn-sm churn-restore-btn" data-key="' + k + '">Restore</button>'
      : '<button type="button" class="btn btn-sm churn-hide-btn" data-key="' + k + '">Hide</button>';
  }
  function churnNotesFor(r){ return churnState.notes[churnKey(r)] || []; }
  // The cell is the affordance as well as the display: the newest note in full
  // on hover, and one click into the whole history.
  function churnNotesCell(r){
    var notes = churnNotesFor(r);
    var k = esc(churnKey(r));
    if (!notes.length) {
      return '<button type="button" class="churn-note-btn churn-note-open" data-key="' + k + '" title="Add a note">+ Note</button>';
    }
    var latest = notes[0];
    var label = notes.length === 1 ? '1 note' : notes.length + ' notes';
    var tip = latest.body + ' — ' + (latest.createdByName || 'unknown')
      + (latest.createdAt ? ' on ' + new Date(latest.createdAt).toISOString().slice(0, 10) : '');
    return '<button type="button" class="churn-note-btn churn-note-open" data-key="' + k + '" title="' + esc(tip) + '">💬 ' + label + '</button>';
  }
  // value() feeds sort and CSV: sorting by note count puts the worked rows
  // together, and the export carries the newest note rather than a button.
  var CHURN_NOTES_COL = {
    key:'notes', label:'Notes', type:'num',
    value:function(r){ var n = churnNotesFor(r); return n.length ? n.length : 0; },
    csv:function(r){ var n = churnNotesFor(r); return n.length ? n[0].body : ''; },
    render:churnNotesCell
  };
  // Buttons live inside a table body that re-renders on every sort/filter, so
  // the handlers are delegated from the document once.
  // value() feeds sort + CSV, so the export says whether a row is hidden rather
  // than carrying an empty column.
  var CHURN_ACTION_COL = { key:'actions', label:'Actions', value:function(r){ return churnIsHidden(r) ? 'hidden' : ''; }, render:churnActionCell };
  function churnQueueCols(){
    return [
      { key:'agent', label:'Agent', value:function(r){ return r.agent_name; }, render:churnAgentCell },
      { key:'company', label:'Brokerage', value:function(r){ return r.company_name; } },
      { key:'health', label:'Health', value:function(r){ return r.health; }, render:function(r){ return churnHealthChip(r.health); } },
      { key:'urgency', label:'Urgency', value:function(r){ return r.urgency; } },
      { key:'days', label:'Days silent', type:'num', value:function(r){ return r.days_silent; } },
      { key:'palive', label:'P(alive)', type:'num', value:function(r){ return r.p_alive; }, render:function(r){ return Number(r.p_alive).toFixed(2); } },
      { key:'cadence', label:'Orders/yr', type:'num', value:function(r){ return r.cadence_per_year; }, render:function(r){ return Number(r.cadence_per_year).toFixed(1); } },
      { key:'annual', label:'Annual value', type:'num', value:function(r){ return r.annual_value; }, render:function(r){ return churnMoney(r.annual_value); } },
      { key:'risk', label:'Rev at risk', type:'num', value:function(r){ return r.revenue_at_risk; }, render:function(r){ return churnMoney(r.revenue_at_risk); } },
      { key:'priority', label:'Priority', type:'num', value:function(r){ return r.priority_score; }, render:function(r){ return churnMoney(r.priority_score); } },
      CHURN_NOTES_COL,
      CHURN_ACTION_COL
    ];
  }
  function churnScoreCols(){
    return [
      { key:'agent', label:'Agent', value:function(r){ return r.agent_name; }, render:churnAgentCell },
      { key:'company', label:'Brokerage', value:function(r){ return r.company_name; } },
      { key:'orders', label:'Orders', type:'num', value:function(r){ return r.orders; } },
      { key:'cadence', label:'Orders/yr', type:'num', value:function(r){ return r.cadence_per_year; }, render:function(r){ return Number(r.cadence_per_year).toFixed(1); } },
      { key:'revenue', label:'Revenue', type:'num', value:function(r){ return r.revenue; }, render:function(r){ return churnMoney(r.revenue); } },
      { key:'palive', label:'P(alive)', type:'num', value:function(r){ return r.p_alive; }, render:function(r){ return Number(r.p_alive).toFixed(2); } },
      { key:'health', label:'Health', value:function(r){ return r.health; }, render:function(r){ return churnHealthChip(r.health); } },
      { key:'urgency', label:'Urgency', value:function(r){ return r.urgency; } },
      { key:'days', label:'Days silent', type:'num', value:function(r){ return r.days_silent; } },
      { key:'risk', label:'Rev at risk', type:'num', value:function(r){ return r.revenue_at_risk; }, render:function(r){ return churnMoney(r.revenue_at_risk); } },
      { key:'priority', label:'Priority', type:'num', value:function(r){ return r.priority_score; }, render:function(r){ return churnMoney(r.priority_score); } },
      CHURN_NOTES_COL,
      CHURN_ACTION_COL
    ];
  }
  function churnSpark(rows, key, color, lo, hi, w, hgt){
    var n = rows.length;
    var pts = rows.map(function(row, i){
      var x = (n === 1) ? w : (i / (n - 1)) * w;
      var y = hgt - ((Number(row[key]) - lo) / ((hi - lo) || 1)) * hgt;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<polyline fill="none" stroke="'+color+'" stroke-width="2" points="'+pts+'"/>';
  }
  function churnRetentionHtml(rows){
    if (!rows.length) return '<div class="empty-state">Not enough history for a 24-month lookback.</div>';
    var w = 520, hgt = 90, vals = [];
    rows.forEach(function(r){ vals.push(Number(r.GRR), Number(r.NRR), Number(r.logo_retention)); });
    var lo = Math.min(0.7, Math.min.apply(null, vals)), hi = Math.max(1.05, Math.max.apply(null, vals));
    var y100 = (hgt - ((1 - lo) / (hi - lo)) * hgt).toFixed(1);
    var svg = '<svg viewBox="0 0 '+w+' '+hgt+'" preserveAspectRatio="none" style="width:100%;height:110px">'
      + '<line x1="0" x2="'+w+'" y1="'+y100+'" y2="'+y100+'" stroke="var(--border)" stroke-dasharray="3 3"/>'
      + churnSpark(rows, 'NRR', '#2563eb', lo, hi, w, hgt)
      + churnSpark(rows, 'GRR', '#b5473b', lo, hi, w, hgt)
      + '</svg>';
    var legend = '<div class="text-muted" style="font-size:0.78rem;margin-bottom:0.35rem"><span style="color:#b5473b;font-weight:700">■</span> GRR &nbsp;<span style="color:#2563eb;font-weight:700">■</span> NRR &nbsp; dashed = 100%</div>';
    var body = rows.slice(-6).map(function(r){
      return '<tr><td>'+esc(String(r.as_of_month))+'</td><td style="text-align:right">'+churnPct(r.GRR)+'</td><td style="text-align:right">'+churnPct(r.NRR)+'</td><td style="text-align:right">'+churnPct(r.logo_retention)+'</td></tr>';
    }).join('');
    return legend + svg + '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;margin-top:0.5rem"><thead><tr><th style="text-align:left">Month</th><th style="text-align:right">GRR</th><th style="text-align:right">NRR</th><th style="text-align:right">Logo</th></tr></thead><tbody>'+body+'</tbody></table>';
  }
  function churnConversionHtml(rows){
    if (!rows.length) return '<div class="empty-state">No cohorts.</div>';
    var body = rows.slice(-8).map(function(r){
      var rate = (r.conversion_rate == null) ? '—' : (Number(r.conversion_rate) * 100).toFixed(0) + '%';
      var open = r.window_complete ? '' : ' <span class="text-muted" style="font-size:0.7rem">(open)</span>';
      return '<tr><td>'+esc(String(r.cohort_month))+'</td><td style="text-align:right">'+churnNum(r.new_agents)+'</td><td style="text-align:right">'+rate+open+'</td></tr>';
    }).join('');
    return '<div class="text-muted" style="font-size:0.8rem;margin-bottom:0.4rem">New agents ordering again within 180 days</div><table style="width:100%;border-collapse:collapse;font-size:0.82rem"><thead><tr><th style="text-align:left">Cohort</th><th style="text-align:right">New</th><th style="text-align:right">2nd &lt;180d</th></tr></thead><tbody>'+body+'</tbody></table>';
  }
  function churnSeasonHtml(rows){
    if (!rows.length) return '<div class="empty-state">No seasonality.</div>';
    var max = Math.max.apply(null, rows.map(function(r){ return Number(r.activity_index); }));
    var bars = rows.map(function(r){
      var hpct = Math.round((Number(r.activity_index) / (max || 1)) * 100);
      return '<div title="'+esc(String(r.month))+': '+Number(r.activity_index).toFixed(2)+'" style="flex:1;min-width:2px;height:'+hpct+'%;background:var(--accent);opacity:0.75;border-radius:2px 2px 0 0"></div>';
    }).join('');
    return '<div class="text-muted" style="font-size:0.8rem;margin-bottom:0.4rem">Monthly market activity (mean = 1); drives the operational-time rescale</div><div style="display:flex;align-items:flex-end;gap:2px;height:90px">'+bars+'</div>';
  }
  function churnDqHtml(rows){
    if (!rows.length) return '<div class="text-muted" style="font-size:0.85rem">No duplicate-brokerage records detected.</div>';
    var body = rows.map(function(r){
      return '<tr><td>'+esc(String(r.brokerage))+'</td><td style="text-align:center">'+churnNum(r.distinct_company_ids)+'</td><td class="text-muted" style="font-size:0.8rem">'+esc(String(r.detail || ''))+'</td></tr>';
    }).join('');
    return '<div class="text-muted" style="font-size:0.8rem;margin-bottom:0.4rem">Brokerage names held under more than one company ID (company rollups split; agent-level analysis is unaffected)</div><table style="width:100%;border-collapse:collapse;font-size:0.82rem"><thead><tr><th style="text-align:left">Brokerage</th><th>IDs</th><th style="text-align:left">Detail</th></tr></thead><tbody>'+body+'</tbody></table>';
  }
  function churnClearBody(){
    ['churn-tiles','churn-meta','churn-hidden-bar','churn-queue-table','churn-retention','churn-scores-table','churn-conversion','churn-seasonality','churn-dq'].forEach(function(id){
      var el = document.getElementById(id); if (el) el.innerHTML = '';
    });
  }

  // Hidden agents whose key is no longer anywhere in the snapshot (the agent
  // stopped appearing in the source data). They can never surface in a table, so
  // the bar carries their restore buttons.
  function churnOrphanDismissals(){
    var rep = churnState.report;
    var present = {};
    if (rep) {
      (rep.agent_scores || []).concat(rep.outreach_queue || []).forEach(function(r){ present[churnKey(r)] = true; });
    }
    return Object.keys(churnState.dismissed)
      .filter(function(k){ return !present[k]; })
      .map(function(k){ return churnState.dismissed[k]; });
  }
  function churnRenderHiddenBar(){
    var el = document.getElementById('churn-hidden-bar');
    if (!el) return;
    var n = Object.keys(churnState.dismissed).length;
    if (!n) { el.innerHTML = ''; return; }
    var label = n === 1 ? '1 agent hidden' : churnNum(n) + ' agents hidden';
    var html = '<div class="churn-hidden-bar"><span>🙈 ' + label + ' — left out of the queue, the scores table and the tiles above.</span>'
      + '<button type="button" class="btn btn-sm" id="churn-toggle-hidden">' + (churnState.showHidden ? 'Hide them again' : 'Show hidden') + '</button>';
    if (churnState.showHidden) {
      var orphans = churnOrphanDismissals();
      if (orphans.length) {
        html += '<div style="flex-basis:100%;margin-top:0.35rem" class="text-muted">No longer in the report data, so only restorable here:</div>';
        html += orphans.map(function(d){
          return '<span style="flex-basis:100%;display:flex;gap:0.5rem;align-items:center">'
            + '<span>' + esc(d.agentName) + (d.companyName ? ' <span class="text-muted">— ' + esc(d.companyName) + '</span>' : '') + '</span>'
            + '<button type="button" class="btn btn-sm churn-restore-btn" data-key="' + esc(d.agentKey) + '">Restore</button></span>';
        }).join('');
      }
    }
    el.innerHTML = html + '</div>';
    var toggle = document.getElementById('churn-toggle-hidden');
    if (toggle) toggle.addEventListener('click', function(){ churnState.showHidden = !churnState.showHidden; churnApply(); });
  }

  // Re-render everything a dismissal can move. Board metrics (GRR/NRR/logo) and
  // the snapshot provenance line stay whole — hiding an agent is a worklist
  // decision, not a restatement of the retention numbers.
  function churnApply(){
    var rep = churnState.report;
    if (!rep) return;
    var hiddenCount = Object.keys(churnState.dismissed).length;
    var keptScores = churnKept(rep.agent_scores || []);
    var keptQueue = churnKept(rep.outreach_queue || []);
    var h = rep.headline || {};
    var atRisk = keptScores.reduce(function(sum, r){
      return (r.health === 'Watch' || r.health === 'At risk') ? sum + Number(r.revenue_at_risk || 0) : sum;
    }, 0);

    // The window line is the answer to "why does this say N agents?" — the count
    // is every agent with at least one clean order inside the window, not the
    // at-risk subset, so it moves when the window does.
    var windowLine = rep.observation_start
      ? esc(String(rep.observation_start)) + ' → ' + esc(String(rep.observation_end))
        + (rep.window_years ? ' (' + esc(String(rep.window_years)) + '-year window)' : '')
      : 'ends ' + esc(String(rep.observation_end));

    // From schema 4 the engine reports on repeat agents only, so the count is the
    // reporting population rather than the whole base. Name the exclusion inline —
    // an unexplained drop from 4,119 to 3,011 reads as lost data.
    var af = rep.agent_filter;
    var agentsLine = (af && af.agents_excluded)
      ? '<span title="Agents with at least '+churnNum(af.min_orders)+' clean orders in this window, plus anyone whose first order was in the last '+churnNum(af.new_agent_grace_days)+' days ('+churnNum(af.new_agents_kept)+' of them).">'
          +churnNum(rep.agents_total)+' repeat agents</span>'
        + ' · <span title="One-and-done buyers — FSBOs, one-off projects. Held out of the tables, health tiers and retention base because a single order carries no repeat signal. They still count in the Pareto/NBD fit and in 2nd-order conversion.">'
          +churnNum(af.agents_excluded)+' one-time buyers excluded ('+churnPct(af.excluded_revenue_share)+' of revenue)</span>'
      : '<span title="Every agent with at least one clean order in this window — not just the at-risk ones.">'
          +churnNum(rep.agents_total)+' agents who ordered in the window</span>';
    document.getElementById('churn-header').innerHTML = '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;align-items:center">'
      + '<div><div style="font-weight:700;font-size:1.05rem">Churn &amp; Retention</div>'
      + '<div class="text-muted" style="font-size:0.85rem">'+windowLine+' · '+churnNum(rep.orders_kept)+' clean orders of '+churnNum(rep.orders_total)+' · '
      + agentsLine
      + ' · seasonal adjust '+(rep.seasonal_adjust ? 'on' : 'off')+(hiddenCount ? ' · '+churnNum(hiddenCount)+' hidden' : '')+'</div></div>'
      + '<div class="text-muted" style="font-size:0.8rem">Generated '+esc(String(rep.generated_at).replace('T', ' ').slice(0, 16))+'</div>'
      + '</div>';

    var tiles = [
      ['GRR (gross)', churnPct(h.grr)],
      ['NRR (net)', churnPct(h.nrr)],
      ['Logo retention', churnPct(h.logo_retention)],
      ['Revenue at risk', churnMoney(atRisk)],
      ['Outreach queue', churnNum(keptQueue.length)]
    ];
    document.getElementById('churn-tiles').innerHTML = tiles.map(function(t){
      return '<div class="stat-card"><div class="stat-label">'+esc(t[0])+'</div><div class="stat-value">'+t[1]+'</div></div>';
    }).join('');

    // Tier counts follow the cleaned list too, so the chips add up to what the
    // tables actually show.
    var tierCounts = {};
    keptScores.forEach(function(r){ tierCounts[r.health] = (tierCounts[r.health] || 0) + 1; });
    var chips = ['Healthy','Watch','At risk','Likely churned'].filter(function(k){ return k in (rep.health_tiers || {}); })
      .map(function(k){ return churnHealthChip(k, tierCounts[k] || 0); }).join(' ');
    var m = rep.model || {}, ia = rep.identity_audit || {};
    var iaLine = ia.guid_stable
      ? 'Agent GUID stable across brokerage moves: YES ('+churnNum(ia.movers)+' of '+churnNum(ia.agents_total)+' agents moved on one GUID'+(ia.example ? ', e.g. '+ia.example.agent_name+' — '+ia.example.companies : '')+')'
      : 'No brokerage moves observed this run.';
    document.getElementById('churn-meta').innerHTML =
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.75rem">'+chips+'</div>'
      + '<div class="text-muted" style="font-size:0.82rem">Pareto/NBD (operational-month unit): r='+Number(m.r).toFixed(3)+' α='+Number(m.alpha).toFixed(3)+' s='+Number(m.s).toFixed(3)+' β='+Number(m.beta).toFixed(3)+' · mean purchase '+Number(m.mean_purchase_rate).toFixed(3)+'/mo · mean dropout '+Number(m.mean_dropout_rate).toFixed(3)+'/mo</div>'
      + '<div class="text-muted" style="font-size:0.82rem;margin-top:0.35rem">'+esc(iaLine)+'</div>';

    churnRenderHiddenBar();
    churnQueueTable.setData(churnRowsFor(rep.outreach_queue || []));
    churnScoresTable.setData(churnRowsFor(rep.agent_scores || []));
    document.getElementById('churn-retention').innerHTML = churnRetentionHtml(rep.revenue_retention || []);
    document.getElementById('churn-conversion').innerHTML = churnConversionHtml(rep.second_order_conversion || []);
    document.getElementById('churn-seasonality').innerHTML = churnSeasonHtml(rep.seasonality || []);
    document.getElementById('churn-dq').innerHTML = churnDqHtml(rep.data_quality || []);
  }

  // ── Agent notes ─────────────────────────────────────────────────────────────
  var churnNotesState = { agentKey: null };
  function churnNoteModal(){ return document.getElementById('churn-note-modal'); }
  function churnRenderNoteList(){
    var el = document.getElementById('churn-note-list');
    if (!el) return;
    var notes = churnState.notes[churnNotesState.agentKey] || [];
    if (!notes.length) { el.innerHTML = '<div class="text-muted" style="font-size:0.85rem">No notes yet.</div>'; return; }
    el.innerHTML = notes.map(function(n){
      var when = n.createdAt ? new Date(n.createdAt).toLocaleString() : '';
      return '<div class="churn-note-item"><div>' + esc(n.body) + '</div>'
        + '<div class="churn-note-meta"><span>' + esc(n.createdByName || 'unknown') + '</span><span>·</span><span>' + esc(when) + '</span>'
        + '<button type="button" class="churn-note-btn churn-note-delete" data-id="' + esc(n.id) + '" style="color:var(--danger,#b5473b)">Delete</button></div></div>';
    }).join('');
  }
  function churnOpenNotes(agentKey){
    var row = churnFindAgent(agentKey);
    churnNotesState.agentKey = agentKey;
    document.getElementById('churn-note-title').textContent =
      'Notes — ' + ((row && row.agent_name) ? row.agent_name : agentKey);
    document.getElementById('churn-note-error').classList.add('hidden');
    document.getElementById('churn-note-input').value = '';
    churnRenderNoteList();
    churnNoteModal().classList.remove('hidden');
    document.getElementById('churn-note-input').focus();
  }
  function churnCloseNotes(){
    churnNoteModal().classList.add('hidden');
    churnNotesState.agentKey = null;
  }
  function churnNoteError(msg){
    var el = document.getElementById('churn-note-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  async function churnAddNote(){
    var key = churnNotesState.agentKey;
    var input = document.getElementById('churn-note-input');
    var body = input.value.trim();
    if (!key || !body) return;
    var r = await api('POST', '/reports/churn/notes/' + encodeURIComponent(key), { body: body });
    if (!r.ok) { churnNoteError((r.data && r.data.error) || 'Could not save that note.'); return; }
    churnState.notes[key] = [r.data.note].concat(churnState.notes[key] || []);
    input.value = '';
    document.getElementById('churn-note-error').classList.add('hidden');
    churnRenderNoteList();
    churnApply();
  }
  async function churnDeleteNote(noteId){
    var key = churnNotesState.agentKey;
    if (!key) return;
    var r = await api('DELETE', '/reports/churn/notes/' + encodeURIComponent(key) + '/' + encodeURIComponent(noteId));
    if (!r.ok) { churnNoteError((r.data && r.data.error) || 'Could not delete that note.'); return; }
    churnState.notes[key] = (churnState.notes[key] || []).filter(function(n){ return n.id !== noteId; });
    churnRenderNoteList();
    churnApply();
  }

  function churnFindAgent(agentKey){
    var rep = churnState.report;
    if (!rep) return null;
    var all = (rep.outreach_queue || []).concat(rep.agent_scores || []);
    for (var i = 0; i < all.length; i++) {
      if (churnKey(all[i]) === agentKey) return all[i];
    }
    return null;
  }
  async function churnHideAgent(agentKey){
    var row = churnFindAgent(agentKey);
    var name = row && row.agent_name ? String(row.agent_name) : 'this agent';
    var reason = prompt('Hide ' + name + ' from this report for everyone?\\n\\nOptional note — why (retired, moved away, already called):', '');
    if (reason === null) return;
    var r = await api('POST', '/reports/churn/dismissals', { agentKey: agentKey, reason: reason });
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not hide that agent.'); return; }
    churnState.dismissed[agentKey] = r.data.dismissal;
    churnApply();
  }
  async function churnRestoreAgent(agentKey){
    var r = await api('DELETE', '/reports/churn/dismissals/' + encodeURIComponent(agentKey));
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not restore that agent.'); return; }
    delete churnState.dismissed[agentKey];
    churnApply();
  }
  // Delegated: both tables rebuild their rows on every sort, filter and reload.
  document.addEventListener('click', function(e){
    if (!e.target || !e.target.closest) return;
    var hide = e.target.closest('.churn-hide-btn');
    if (hide) { churnHideAgent(hide.dataset.key); return; }
    var restore = e.target.closest('.churn-restore-btn');
    if (restore) { churnRestoreAgent(restore.dataset.key); return; }
    var note = e.target.closest('.churn-note-open');
    if (note) { churnOpenNotes(note.dataset.key); return; }
    var del = e.target.closest('.churn-note-delete');
    if (del) churnDeleteNote(del.dataset.id);
  });
  document.getElementById('churn-note-save').addEventListener('click', churnAddNote);
  document.getElementById('churn-note-close').addEventListener('click', churnCloseNotes);
  churnNoteModal().addEventListener('click', function(e){
    if (e.target === churnNoteModal()) churnCloseNotes();
  });
  // Ctrl/Cmd+Enter saves, matching the other note fields in the dashboard.
  document.getElementById('churn-note-input').addEventListener('keydown', function(e){
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') churnAddNote();
  });

  // ── Refresh ─────────────────────────────────────────────────────────────────
  // A refresh is a server-side job (pull + engine), so the button starts it and
  // the panel polls. Polling stops as soon as the job leaves 'running', and the
  // snapshot is reloaded on success so the page shows the new numbers.
  function churnRenderRefresh(){
    var el = document.getElementById('churn-refresh-status');
    var btn = document.getElementById('churn-refresh-btn');
    if (!el || !btn) return;
    var st = churnState.refresh;
    var running = !!st && st.status === 'running';
    btn.disabled = running;
    btn.textContent = running ? 'Refreshing…' : '↻ Refresh from Spiro';
    if (!st || st.status === 'idle') { el.innerHTML = ''; return; }
    var head = '';
    if (running) {
      head = '<span class="text-muted">⏳ ' + esc(st.step || 'Working…') + '</span>';
    } else if (st.status === 'ok') {
      head = '<span style="color:#2f855a;font-weight:600">✓ Refreshed</span> <span class="text-muted">'
        + esc(st.years + ' year window · seasonal adjust ' + (st.seasonal ? 'on' : 'off')
          + (st.startedByName ? ' · started by ' + st.startedByName : '')) + '</span>';
    } else {
      head = '<span style="color:#b5473b;font-weight:600">✗ Refresh failed</span> <span class="text-muted">' + esc(st.error || '') + '</span>';
    }
    // The tail is the useful part while it runs: window-by-window pull counts,
    // then the engine's own layer-by-layer progress.
    var tail = (st.log || []).slice(-12).join('\\n');
    el.innerHTML = '<div style="margin-top:0.6rem;font-size:0.82rem">' + head + '</div>'
      + (tail ? '<div class="churn-refresh-log">' + esc(tail) + '</div>' : '');
  }
  function churnStopPolling(){
    if (churnRefreshTimer) { clearInterval(churnRefreshTimer); churnRefreshTimer = null; }
  }
  function churnPollRefresh(){
    churnStopPolling();
    churnRefreshTimer = setInterval(async function(){
      var r = await api('GET', '/reports/churn/refresh');
      if (!r.ok) { churnStopPolling(); return; }
      churnState.refresh = r.data.refresh;
      churnRenderRefresh();
      if (r.data.refresh.status !== 'running') {
        churnStopPolling();
        if (r.data.refresh.status === 'ok') loadChurn();
        // An expired Spiro token is the usual cause of a failed pull, so surface
        // the reconnect banner instead of leaving the log as the only clue.
        else updateSpiroBanner();
      }
    }, 3000);
  }
  async function churnStartRefresh(){
    var years = Number(document.getElementById('churn-years-sel').value);
    var seasonal = document.getElementById('churn-seasonal-chk').checked;
    var r = await api('POST', '/reports/churn/refresh', { years: years, seasonal: seasonal });
    if (!r.ok) {
      churnState.refresh = { status:'error', step:'Failed', years: years, seasonal: seasonal,
        error: (r.data && r.data.error) || 'Could not start the refresh.', log: [] };
      churnRenderRefresh();
      updateSpiroBanner();
      return;
    }
    churnState.refresh = r.data.refresh;
    churnRenderRefresh();
    churnPollRefresh();
  }
  document.getElementById('churn-refresh-btn').addEventListener('click', churnStartRefresh);

  async function loadChurn(){
    var header = document.getElementById('churn-header');
    header.innerHTML = '<div class="text-muted">Loading…</div>';
    updateSpiroBanner();
    var r = await api('GET', '/reports/churn');
    if (!r.ok) { header.innerHTML = '<div class="empty-state">Could not load the churn report.</div>'; churnClearBody(); return; }
    // Dismissals come back alongside the snapshot and are applied client-side, so
    // the tables, tiles and tier counts all describe the same cleaned list.
    churnState.dismissed = {};
    (r.data.dismissals || []).forEach(function(d){ churnState.dismissed[d.agentKey] = d; });
    // Notes arrive newest-first for every agent at once and are grouped here;
    // per-row fetching would be one request per visible row.
    churnState.notes = {};
    (r.data.notes || []).forEach(function(n){
      (churnState.notes[n.agentKey] = churnState.notes[n.agentKey] || []).push(n);
    });
    // A refresh started in another tab (or before a reload) keeps reporting here.
    churnState.refresh = r.data.refresh || null;
    churnRenderRefresh();
    if (churnState.refresh && churnState.refresh.status === 'running') churnPollRefresh();
    if (churnState.refresh && churnState.refresh.years) {
      document.getElementById('churn-years-sel').value = String(churnState.refresh.years);
      document.getElementById('churn-seasonal-chk').checked = churnState.refresh.seasonal !== false;
    }
    var rep = r.data.report;
    if (!rep) {
      churnState.report = null;
      var msg = (r.data.status === 'not_generated')
        ? 'No churn snapshot yet. Run the retention engine (reports/wow_retention/wow_retention.py) to generate it.'
        : 'The churn snapshot could not be read.';
      header.innerHTML = '<div class="empty-state">'+esc(msg)+'</div>';
      churnClearBody();
      return;
    }
    churnState.report = rep;
    var rowClass = function(row){ return churnIsHidden(row) ? 'churn-row-hidden' : ''; };
    if (!churnQueueTable) churnQueueTable = createReportTable({ containerId:'churn-queue-table', reportKey:'churn-queue', emptyMsg:'No recoverable agents at risk — nothing to call.', columns: churnQueueCols(), rowClass: rowClass });
    if (!churnScoresTable) churnScoresTable = createReportTable({ containerId:'churn-scores-table', reportKey:'churn-scores', emptyMsg:'No agent scores.', columns: churnScoreCols(), rowClass: rowClass });
    churnApply();
  }

  async function loadReports() {
    if (reportMonths.length === 0) {
      reportMonths = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() - (11 - i));
        return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
      });
      populateReportMonthSelects();
    }
    await loadReportMarkets();
    await Promise.all([loadReportTable(), loadReportStatus()]);
  }

  document.getElementById('report-from-sel').addEventListener('change', () => { loadReportMarkets(); loadReportTable(); });
  document.getElementById('report-to-sel').addEventListener('change', () => { loadReportMarkets(); loadReportTable(); });
  document.getElementById('report-market-sel').addEventListener('change', loadReportTable);
  document.getElementById('report-refresh-btn').addEventListener('click', async () => {
    const btn = document.getElementById('report-refresh-btn');
    const from = document.getElementById('report-from-sel').value;
    const to = document.getElementById('report-to-sel').value;
    btn.disabled = true;
    btn.textContent = 'Refreshing…';
    const r = await api('POST', '/reports/agent-cancellations/refresh', { from, to });
    btn.disabled = false;
    btn.innerHTML = '↻ Refresh now';
    if (!r.ok) { alert(r.data.error || 'Refresh failed.'); return; }
    await loadReportMarkets();
    await Promise.all([loadReportTable(), loadReportStatus()]);
  });

  // ── Rankings (agent + company order volume) ────────────────────────────────
  function populateRankMonthSelects() {
    const fromSel = document.getElementById('rank-from-sel');
    const toSel = document.getElementById('rank-to-sel');
    if (fromSel.options.length) return;
    const opts = reportMonths.map(m => \`<option value="\${m}">\${monthLabel(m)}</option>\`).join('');
    fromSel.innerHTML = opts;
    toSel.innerHTML = opts;
    fromSel.value = reportMonths[0];
    toSel.value = reportMonths[reportMonths.length - 1];
  }

  async function loadRankMarkets() {
    const from = document.getElementById('rank-from-sel').value;
    const to = document.getElementById('rank-to-sel').value;
    const r = await api('GET', '/reports/agent-cancellations/markets?from=' + from + '&to=' + to);
    const sel = document.getElementById('rank-market-sel');
    const current = sel.value;
    const markets = r.ok ? (r.data.markets || []) : [];
    sel.innerHTML = '<option value="">All markets</option>' + markets.map(m => \`<option value="\${esc(m)}">\${esc(m)}</option>\`).join('');
    if (markets.includes(current)) sel.value = current;
  }

  async function loadRankStatus() {
    const r = await api('GET', '/reports/agent-cancellations/status');
    const el = document.getElementById('rank-refreshed-at');
    if (!r.ok) { el.textContent = ''; return; }
    const statuses = (r.data.status || []).filter(s => s.refreshedAt);
    if (statuses.length === 0) { el.textContent = 'Never refreshed'; return; }
    const latest = statuses.reduce((a, b) => (b.refreshedAt > a.refreshedAt ? b : a));
    el.textContent = 'Last refreshed: ' + new Date(latest.refreshedAt).toLocaleString();
  }

  function rankCols(nameLabel) {
    return [
      { key: 'rank', label: '#', type: 'num', value: function(r){ return r.rank; } },
      { key: 'name', label: nameLabel, value: function(r){ return r.name; } },
      { key: 'totalOrders', label: 'Orders', type: 'num', value: function(r){ return r.totalOrders; } },
      { key: 'cancellations', label: 'Cancellations', type: 'num', value: function(r){ return r.cancellations; } },
      { key: 'reschedules', label: 'Reschedules', type: 'num', value: function(r){ return r.reschedules; } },
      { key: 'pct', label: '% Canc./Resch.', type: 'num', value: function(r){ return Number(r.cancelledOrRescheduledPct.toFixed(1)); }, render: function(r){ return r.cancelledOrRescheduledPct.toFixed(1) + '%'; } }
    ];
  }
  var rankAgentsTable = null;
  var rankCompaniesTable = null;
  async function loadRankTables() {
    const from = document.getElementById('rank-from-sel').value;
    const to = document.getElementById('rank-to-sel').value;
    const market = document.getElementById('rank-market-sel').value;
    const qs = new URLSearchParams({ from, to });
    if (market) qs.set('market', market);
    if (!rankAgentsTable) rankAgentsTable = createReportTable({ containerId: 'rank-agents-table', reportKey: 'rankings-agents', emptyMsg: 'No orders cached for this range yet. Try Refresh now.', columns: rankCols('Agent') });
    if (!rankCompaniesTable) rankCompaniesTable = createReportTable({ containerId: 'rank-companies-table', reportKey: 'rankings-companies', emptyMsg: 'No company data yet — click Refresh now to pull it.', columns: rankCols('Company') });
    const r = await api('GET', '/reports/rankings?' + qs.toString());
    if (!r.ok) {
      rankAgentsTable.setError();
      rankCompaniesTable.setError();
      return;
    }
    const report = r.data.report;
    rankAgentsTable.setData(report.agents);
    rankCompaniesTable.setData(report.companies);
  }

  async function loadRankings() {
    if (reportMonths.length === 0) {
      reportMonths = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() - (11 - i));
        return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
      });
    }
    populateRankMonthSelects();
    await loadRankMarkets();
    await Promise.all([loadRankTables(), loadRankStatus()]);
  }

  document.getElementById('rank-from-sel').addEventListener('change', () => { loadRankMarkets(); loadRankTables(); });
  document.getElementById('rank-to-sel').addEventListener('change', () => { loadRankMarkets(); loadRankTables(); });
  document.getElementById('rank-market-sel').addEventListener('change', loadRankTables);
  document.getElementById('rank-refresh-btn').addEventListener('click', async () => {
    const btn = document.getElementById('rank-refresh-btn');
    const from = document.getElementById('rank-from-sel').value;
    const to = document.getElementById('rank-to-sel').value;
    btn.disabled = true;
    btn.textContent = 'Refreshing…';
    const r = await api('POST', '/reports/agent-cancellations/refresh', { from, to });
    btn.disabled = false;
    btn.innerHTML = '↻ Refresh now';
    if (!r.ok) { alert(r.data.error || 'Refresh failed.'); return; }
    await loadRankMarkets();
    await Promise.all([loadRankTables(), loadRankStatus()]);
  });

  // ── Photographers report ────────────────────────────────────────────────────
  function photographerCols() {
    return [
      { key: 'name', label: 'Photographer', value: function(r){ return r.name; } },
      { key: 'markets', label: 'Markets', value: function(r){ return (r.markets || []).join(', '); } },
      { key: 'shoots', label: '# Shoots', type: 'num', value: function(r){ return r.shoots; } },
      { key: 'status', label: 'Status', value: function(r){ return r.active ? 'Active' : 'Inactive'; } }
    ];
  }
  var photogTable = null;
  function populatePhotogMonthSelects() {
    var opts = reportMonths.map(function(m){ return '<option value="' + m + '">' + monthLabel(m) + '</option>'; }).join('');
    var fromSel = document.getElementById('photog-from-sel'), toSel = document.getElementById('photog-to-sel');
    fromSel.innerHTML = opts; toSel.innerHTML = opts;
    fromSel.value = reportMonths[0]; toSel.value = reportMonths[reportMonths.length - 1];
  }
  async function loadPhotogTable() {
    var from = document.getElementById('photog-from-sel').value;
    var to = document.getElementById('photog-to-sel').value;
    if (!photogTable) photogTable = createReportTable({ containerId: 'photog-table', reportKey: 'photographers', frozenFirst: true, emptyMsg: 'No photographers cached yet. Try Refresh now.', columns: photographerCols() });
    var r = await api('GET', '/reports/photographers?from=' + from + '&to=' + to);
    if (!r.ok) { photogTable.setError(); return; }
    photogTable.setData(r.data.report.rows);
    var span = document.getElementById('photog-refreshed-at');
    span.textContent = r.data.report.refreshedAt ? 'Updated ' + new Date(r.data.report.refreshedAt).toLocaleString() : 'Never refreshed';
  }
  async function loadPhotographers() {
    if (reportMonths.length === 0) {
      reportMonths = Array.from({ length: 12 }, function(_, i) {
        var d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - (11 - i));
        return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
      });
    }
    populatePhotogMonthSelects();
    await loadPhotogTable();
  }
  document.getElementById('photog-from-sel').addEventListener('change', loadPhotogTable);
  document.getElementById('photog-to-sel').addEventListener('change', loadPhotogTable);
  document.getElementById('photog-refresh-btn').addEventListener('click', async () => {
    var btn = document.getElementById('photog-refresh-btn');
    btn.disabled = true; btn.textContent = 'Refreshing…';
    var r = await api('POST', '/reports/photographers/refresh');
    btn.disabled = false; btn.innerHTML = '↻ Refresh now';
    if (!r.ok) { alert(r.data.error || 'Refresh failed.'); return; }
    await loadPhotogTable();
  });

  // ── Pipedrive Cleanup checklist ────────────────────────────────────────────
  // Badge prefers the finer payload.category, falling back to the DB kind.
  var PDC_CAT = {
    'duplicate-org':['Duplicate org','#7c3aed'], 'duplicate-person':['Duplicate person','#7c3aed'],
    'fields':['Missing fields','#2563eb'], 'dead-record':['Dead record','#b5473b'],
    'no-contacts':['No contacts','#b7791f'], 'no-deals':['No deals','#b7791f'],
    'orphan-deal':['Orphan deal','#b7791f'], 'uncontactable':['No contact info','#b7791f'],
    'not-brokerage':['Not a brokerage','#b5473b'], 'ambiguous':['Review','#b7791f']
  };
  var PDC_KIND = { merge:['Merge','#7c3aed'], fill:['Set office','#2563eb'], exclude:['Not a brokerage','#b5473b'], review:['Review','#b7791f'] };
  function pdcBadge(it) {
    var cat = it.payload && it.payload.category;
    var m = PDC_CAT[cat] || PDC_KIND[it.kind] || [it.kind, '#666666'];
    return '<span style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:2px 7px;border-radius:5px;background:'+m[1]+'1a;color:'+m[1]+'">'+esc(m[0])+'</span>';
  }
  // Render payload.records[] as linked cards with "Open in Pipedrive" deep links.
  function pdcRecords(payload) {
    var recs = payload && payload.records;
    if (!recs || !recs.length) return '';
    var cards = recs.map(function(r) {
      var role = r.role ? '<span style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:'+(r.role==='Keep'?'#16855c':'#b5473b')+'">'+esc(r.role)+'</span> ' : '';
      var href = (r.url && (r.url.indexOf('https://')===0 || r.url.indexOf('http://')===0)) ? r.url : null;
      var name = href
        ? '<a href="'+esc(href)+'" target="_blank" rel="noopener" style="font-weight:600;color:var(--accent,#2563eb);text-decoration:none">'+esc(r.label)+' ↗</a>'
        : '<span style="font-weight:600">'+esc(r.label)+'</span>';
      var meta = r.meta ? '<div class="text-muted" style="font-size:0.72rem">'+esc(r.meta)+'</div>' : '';
      return '<div style="padding:0.35rem 0.5rem;border:1px solid var(--border);border-radius:7px">'+role+name+meta+'</div>';
    }).join('');
    return '<div style="display:grid;gap:0.3rem;margin-top:0.5rem">'+cards+'</div>';
  }
  function pdcItemCard(it, mode) {
    var verify = it.verify ? '<span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:999px;background:#fbf1dd;color:#b7791f">⚠ Verify first</span>' : '';
    var office = it.office ? '<span style="font-family:monospace;font-size:0.8rem;background:var(--border);border-radius:5px;padding:1px 6px">Office: '+esc(it.office)+'</span>' : '';
    var actions = '';
    if (mode === 'verify') {
      actions = '<div style="display:flex;gap:0.5rem;margin-top:0.5rem">'+
        '<button class="btn btn-primary btn-sm" data-pdc-approve="'+esc(it.id)+'">Approve</button>'+
        '<button class="btn btn-sm" data-pdc-reject="'+esc(it.id)+'">Reject</button></div>';
    } else {
      var statusPill = it.status === 'done'
        ? '<span style="color:#16855c;font-weight:700">✓ Done</span>'
        : '<span class="text-muted">Awaiting VA</span>';
      var noteHtml = it.note ? '<div class="text-muted" style="font-size:0.8rem;margin-top:0.35rem">VA note: '+esc(it.note)+'</div>' : '';
      actions = '<div style="margin-top:0.4rem">'+statusPill+noteHtml+'</div>';
    }
    return '<div class="card" style="margin-bottom:0.6rem'+(it.status==='done'?';opacity:0.7':'')+'">'+
      '<div class="flex items-center gap-2" style="flex-wrap:wrap;margin-bottom:0.35rem">'+pdcBadge(it)+'<span style="font-weight:600">'+esc(it.title)+'</span>'+verify+'<span style="margin-left:auto">'+office+'</span></div>'+
      '<div class="text-muted" style="font-size:0.85rem">'+esc(it.detail)+'</div>'+
      pdcRecords(it.payload)+
      actions+'</div>';
  }
  async function loadPipedriveCleanup() {
    var r = await api('GET', '/reports/pipedrive-cleanup');
    var statsEl = document.getElementById('pdc-stats');
    var verifyEl = document.getElementById('pdc-verify-list');
    var workEl = document.getElementById('pdc-worklist');
    if (!r.ok) { verifyEl.innerHTML = '<div class="empty-state">Could not load.</div>'; workEl.innerHTML = ''; statsEl.innerHTML = ''; return; }
    var items = r.data.items || [];
    var s = r.data.summary || {};
    statsEl.innerHTML =
      '<div><span class="text-muted" style="font-size:0.75rem">To verify</span><div style="font-weight:700;font-size:1.1rem">'+(s.suggested||0)+'</div></div>'+
      '<div><span class="text-muted" style="font-size:0.75rem">Approved</span><div style="font-weight:700;font-size:1.1rem">'+(s.approved||0)+'</div></div>'+
      '<div><span class="text-muted" style="font-size:0.75rem">Done</span><div style="font-weight:700;font-size:1.1rem;color:#16855c">'+(s.done||0)+'</div></div>';
    var suggested = items.filter(function(i){ return i.status === 'suggested'; });
    var released = items.filter(function(i){ return i.status === 'approved' || i.status === 'done'; });
    verifyEl.innerHTML = suggested.length ? suggested.map(function(i){ return pdcItemCard(i,'verify'); }).join('') : '<div class="empty-state">Nothing to verify right now.</div>';
    workEl.innerHTML = released.length ? released.map(function(i){ return pdcItemCard(i,'work'); }).join('') : '<div class="empty-state">No approved items yet.</div>';
    verifyEl.querySelectorAll('[data-pdc-approve]').forEach(function(b){ b.addEventListener('click', function(){ pdcDecide(b.dataset.pdcApprove, 'approve'); }); });
    verifyEl.querySelectorAll('[data-pdc-reject]').forEach(function(b){ b.addEventListener('click', function(){ pdcDecide(b.dataset.pdcReject, 'reject'); }); });
  }
  async function pdcDecide(id, decision) {
    var r = await api('PUT', '/reports/pipedrive-cleanup/items/' + id + '/' + decision);
    if (!r.ok) { alert((r.data && r.data.error) || 'Failed.'); return; }
    await loadPipedriveCleanup();
  }

  // ── Financials: Past Due Accounts ──────────────────────────────────────────
  // The report doubles as a collections board: every account carries a case
  // record (stage, owner, next action, review sign-off) that the server keeps
  // keyed by accountKey, so it survives the invoice snapshot being replaced.
  let finBreakdown = null;
  let finAccount = null; // currently open account detail
  let finStatuses = [];  // board columns, server-owned
  let finAssignees = []; // assignable users (admins only)
  let finCanAssign = false;
  let finView = 'board';
  try { finView = localStorage.getItem('oc_fin_view') === 'table' ? 'table' : 'board'; } catch (e) { /* private mode */ }
  const finFilters = { owner: 'all', reviewOnly: false, hideResolved: true };

  function finStatusLabel(key) {
    const s = finStatuses.find(x => x.key === key);
    return s ? s.label : key;
  }
  function finOwnerLabel(c) {
    return c && c.assignedTo ? (c.assignedToName || 'Assigned') : 'Unassigned';
  }
  // The flag itself is derived from invoice data and stays true while a partly
  // paid invoice is past due; the sign-off is what separates "not looked at" from
  // "read and understood", and it holds until someone reopens it.
  function finReviewOpen(a) {
    return a.needsManualReview && !(a.case && a.case.reviewClearedAt);
  }
  function finDueLabel(c) {
    if (!c || !c.dueAt) return '';
    const overdue = c.dueAt < Date.now();
    return '<span class="' + (overdue ? 'fin-due-over' : '') + '">Due ' + esc(finDate(c.dueAt)) + '</span>';
  }

  function money(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function finDate(ms) {
    return ms ? new Date(ms).toLocaleDateString() : '—';
  }
  function bucketClass(bucket) {
    return 'badge bucket-' + String(bucket).replace('+', 'plus');
  }
  function bucketPriority(bucket) {
    if (bucket === '120+') return 'urgent';
    if (bucket === '90-119') return 'high';
    if (bucket === '60-89') return 'high';
    return 'medium';
  }

  // Reflect Spiro connection state in every Spiro banner on the page. Returns connected.
  async function updateSpiroBanner() {
    const banners = document.querySelectorAll('.js-spiro-banner');
    if (!banners.length) return false;
    const s = await api('GET', '/financials/spiro/status');
    // The status probe and the reconnect flow are admin-only, and Churn is a
    // report-granted page. A non-admin gets no banner rather than a misleading
    // "not connected" plus a button that would 403 — reconnecting is an admin
    // job, and the refresh panel still reports the failure in words.
    if (s.status === 403) {
      banners.forEach(banner => banner.classList.add('hidden'));
      return true;
    }
    const connected = !!(s.ok && s.data && s.data.connected);
    const everConnected = !!(s.ok && s.data && s.data.expiresAt);
    banners.forEach(banner => {
      if (connected) { banner.classList.add('hidden'); return; }
      banner.querySelector('.js-spiro-title').textContent =
        everConnected ? 'Spiro session expired' : 'Spiro not connected';
      banner.querySelector('.js-spiro-msg').textContent = everConnected
        ? 'Showing the last cached snapshot. Reconnect to pull fresh data.'
        : 'Connect Spiro to pull data into this report.';
      banner.classList.remove('hidden');
    });
    return connected;
  }

  async function loadFinancials() {
    await updateSpiroBanner();
    const r = await api('GET', '/financials/past-due');
    const tbody = document.getElementById('fin-table-body');
    const statsEl = document.getElementById('fin-stats-grid');
    const refEl = document.getElementById('fin-refreshed-at');
    if (!r.ok) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Failed to load past-due accounts.</td></tr>';
      document.getElementById('fin-board').innerHTML = '<div class="empty-state">Failed to load past-due accounts.</div>';
      statsEl.innerHTML = '';
      return;
    }
    finBreakdown = r.data.breakdown;
    finStatuses = r.data.statuses || [];
    finAssignees = r.data.assignees || [];
    finCanAssign = r.data.canAssign === true;
    refEl.textContent = finBreakdown.refreshedAt
      ? 'Last refreshed: ' + new Date(finBreakdown.refreshedAt).toLocaleString()
      : 'Never refreshed — click Refresh now';

    const bucketAmt = {};
    (finBreakdown.byBucket || []).forEach(b => { bucketAmt[b.bucket] = b; });
    const tile = (label, value) => \`<div class="stat-card"><div class="stat-label">\${label}</div><div class="stat-value">\${value}</div></div>\`;
    statsEl.innerHTML =
      tile('Outstanding', money(finBreakdown.totalPastDue)) +
      tile('Accounts', finBreakdown.accountCount) +
      tile('90+ Days', money((bucketAmt['90-119'] ? bucketAmt['90-119'].amount : 0) + (bucketAmt['120+'] ? bucketAmt['120+'].amount : 0))) +
      tile('Needs review', finBreakdown.manualReviewCount || 0);

    renderFinViews();
  }

  // One filtered list feeds both views, so the board and the table can never
  // disagree about what the viewer is looking at.
  function finVisibleAccounts() {
    const accounts = (finBreakdown && finBreakdown.accounts) || [];
    const me = currentUser ? currentUser.id : null;
    return accounts.filter(a => {
      const c = a.case || {};
      if (finFilters.owner === 'mine' && c.assignedTo !== me) return false;
      if (finFilters.owner === 'unassigned' && c.assignedTo) return false;
      if (finFilters.reviewOnly && !finReviewOpen(a)) return false;
      if (finFilters.hideResolved && c.status === 'resolved') return false;
      return true;
    });
  }

  function renderFinViews() {
    const board = finView === 'board';
    document.getElementById('fin-board').style.display = board ? '' : 'none';
    document.getElementById('fin-table-card').style.display = board ? 'none' : '';
    document.getElementById('fin-view-board').classList.toggle('btn-primary', board);
    document.getElementById('fin-view-table').classList.toggle('btn-primary', !board);
    const visible = finVisibleAccounts();
    const total = (finBreakdown && finBreakdown.accounts) ? finBreakdown.accounts.length : 0;
    document.getElementById('fin-visible-count').textContent =
      visible.length === total ? total + ' accounts' : visible.length + ' of ' + total + ' accounts';
    if (board) renderFinBoard(visible); else renderFinTable(visible);
  }

  function finCardHtml(a) {
    const c = a.case || {};
    const flag = finReviewOpen(a)
      ? '<span class="badge fin-flag" title="Partially paid invoice — read before the next collections step">Review</span>'
      : (a.needsManualReview ? '<span class="badge fin-flag-clear" title="Partial payment reviewed">Reviewed</span>' : '');
    return '<div class="fin-card" draggable="true" data-account="' + esc(a.accountKey) + '">' +
      '<div class="fin-card-name">' + esc(a.accountName) + '</div>' +
      '<div class="fin-card-row">' +
        '<span class="fin-card-amount">' + money(a.balance) + '</span>' +
        '<span class="' + bucketClass(a.bucket) + '">' + esc(a.bucket) + '</span>' +
        flag +
      '</div>' +
      '<div class="fin-card-row" style="margin-top:0.25rem">' +
        '<span>' + esc(finOwnerLabel(c)) + '</span>' +
        (c.dueAt ? '<span>·</span>' + finDueLabel(c) : '') +
      '</div>' +
    '</div>';
  }

  function renderFinBoard(accounts) {
    const host = document.getElementById('fin-board');
    if (!finStatuses.length) { host.innerHTML = '<div class="empty-state">No board stages available.</div>'; return; }
    host.innerHTML = finStatuses.map(s => {
      const inCol = accounts.filter(a => (a.case && a.case.status) === s.key);
      const amount = inCol.reduce((sum, a) => sum + a.balance, 0);
      return '<div class="fin-col" data-status="' + esc(s.key) + '" title="' + esc(s.detail) + '">' +
        '<div class="fin-col-head"><span class="fin-col-title">' + esc(s.label) + '</span>' +
        '<span class="fin-col-meta">' + inCol.length + ' · ' + money(amount) + '</span></div>' +
        (inCol.length ? inCol.map(finCardHtml).join('') : '<div class="fin-col-empty">Drag an account here.</div>') +
      '</div>';
    }).join('');
    bindFinBoard();
  }

  // Drag to move an account between stages. The card is the drag source and the
  // column is the drop target; the drop PUTs the new stage and reloads, so the
  // board never shows a move the server refused.
  let finDragKey = null;
  function bindFinBoard() {
    const host = document.getElementById('fin-board');
    host.querySelectorAll('.fin-card').forEach(card => {
      card.addEventListener('click', () => { if (!finDragKey) openFinAccount(card.dataset.account); });
      card.addEventListener('dragstart', e => {
        finDragKey = card.dataset.account;
        card.classList.add('dragging');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        setTimeout(() => { finDragKey = null; }, 0);
      });
    });
    host.querySelectorAll('.fin-col').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drop-target'); });
      col.addEventListener('dragleave', () => col.classList.remove('drop-target'));
      col.addEventListener('drop', async e => {
        e.preventDefault();
        col.classList.remove('drop-target');
        const key = finDragKey;
        finDragKey = null;
        if (!key) return;
        await setFinStatus(key, col.dataset.status);
      });
    });
  }

  async function setFinStatus(accountKey, status) {
    const r = await api('PUT', '/financials/accounts/' + encodeURIComponent(accountKey) + '/status', { status });
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not move this account.'); return false; }
    const acct = (finBreakdown.accounts || []).find(a => a.accountKey === accountKey);
    if (acct) acct.case = r.data.case;
    renderFinViews();
    return true;
  }

  function renderFinTable(accounts) {
    const tbody = document.getElementById('fin-table-body');
    if (accounts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No past-due accounts match this filter. If that looks wrong, click Refresh now to pull the latest invoices from Spiro.</td></tr>';
      return;
    }
    tbody.innerHTML = accounts.map(a => {
      const c = a.case || {};
      const flag = finReviewOpen(a) ? ' <span class="badge fin-flag">Review</span>' : '';
      return \`
      <tr class="fin-row-click" data-account="\${esc(a.accountKey)}">
        <td>\${esc(a.accountName)}<span class="fin-owner"> · \${esc(a.accountType)}</span>\${flag}</td>
        <td>\${esc(finStatusLabel(c.status))}</td>
        <td class="text-muted">\${esc(finOwnerLabel(c))}</td>
        <td>\${money(a.balance)}</td>
        <td>\${a.invoiceCount}\${a.partiallyPaidCount ? ' (' + a.partiallyPaidCount + ' partial)' : ''}</td>
        <td>\${a.oldestDaysPastDue} days</td>
        <td><span class="\${bucketClass(a.bucket)}">\${esc(a.bucket)}</span></td>
        <td>\${esc(a.action.label)}</td>
      </tr>\`;
    }).join('');
    tbody.querySelectorAll('.fin-row-click').forEach(row => {
      row.addEventListener('click', () => openFinAccount(row.dataset.account));
    });
  }

  document.getElementById('fin-view-board').addEventListener('click', () => {
    finView = 'board';
    try { localStorage.setItem('oc_fin_view', 'board'); } catch (e) { /* private mode */ }
    renderFinViews();
  });
  document.getElementById('fin-view-table').addEventListener('click', () => {
    finView = 'table';
    try { localStorage.setItem('oc_fin_view', 'table'); } catch (e) { /* private mode */ }
    renderFinViews();
  });
  document.getElementById('fin-filter-owner').addEventListener('change', e => {
    finFilters.owner = e.target.value;
    renderFinViews();
  });
  document.getElementById('fin-filter-review').addEventListener('change', e => {
    finFilters.reviewOnly = e.target.checked;
    renderFinViews();
  });
  document.getElementById('fin-filter-open').addEventListener('change', e => {
    finFilters.hideResolved = e.target.checked;
    renderFinViews();
  });

  async function openFinAccount(accountKey) {
    const acct = (finBreakdown.accounts || []).find(a => a.accountKey === accountKey);
    const r = await api('GET', '/financials/accounts/' + encodeURIComponent(accountKey));
    if (!r.ok) { alert((r.data && r.data.error) === 'forbidden' ? 'This account is not assigned to you.' : 'Failed to load account.'); return; }
    finAccount = Object.assign({}, r.data, { bucket: acct && acct.bucket, action: acct && acct.action });
    document.getElementById('fin-modal-title').textContent = r.data.accountName;
    const invoices = r.data.invoices || [];
    const balance = invoices.reduce((s, i) => s + i.outstanding, 0);
    const paid = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
    const plan = r.data.paymentPlan || {};
    const action = acct ? acct.action : null;
    document.getElementById('fin-modal-summary').innerHTML =
      '<div style="display:flex;gap:1.25rem;flex-wrap:wrap;margin-bottom:0.5rem">' +
        '<span><strong>' + money(balance) + '</strong> outstanding</span>' +
        (paid > 0 ? '<span class="text-muted">' + money(paid) + ' paid so far</span>' : '') +
        (acct ? '<span class="' + bucketClass(acct.bucket) + '">' + esc(acct.bucket) + ' days</span>' : '') +
      '</div>' +
      (action ? '<div class="text-muted"><strong>' + esc(action.label) + ':</strong> ' + esc(action.detail) + '</div>' : '') +
      '<div class="text-muted" style="margin-top:0.4rem">Payment plan per policy: ' + money(plan.requiredDown) +
        ' down (10%), up to ' + plan.maxMonths + ' months.</div>';

    renderFinReviewBanner();
    renderFinCaseControls();

    const invBody = document.getElementById('fin-modal-invoices');
    invBody.innerHTML = invoices.map(i => \`
      <tr\${i.partiallyPaid ? ' style="background:var(--surface2)"' : ''}>
        <td>\${esc(i.referenceNumber || i.invoiceId)}\${i.partiallyPaid ? ' <span class="badge fin-flag">Partial</span>' : ''}</td>
        <td class="text-muted">\${esc(i.status || '—')}</td>
        <td>\${money(i.amount)}</td>
        <td>\${i.amountPaid === null ? '—' : money(i.amountPaid)}</td>
        <td>\${money(i.outstanding)}</td>
        <td>\${finDate(i.dateDue)}</td>
        <td>\${i.daysPastDue}</td>
      </tr>\`).join('') || '<tr><td colspan="7" class="empty-state">No past-due invoices.</td></tr>';

    renderFinNotes(r.data.notes || []);
    const followBtn = document.getElementById('fin-followup-btn');
    followBtn.disabled = false;
    followBtn.textContent = '+ Create follow-up task';
    document.getElementById('fin-modal').classList.remove('hidden');
  }

  // Partial payments are the one thing the policy ladder must not be applied to
  // blindly, so the flag gets its own banner with an explicit sign-off rather
  // than a badge someone can scroll past.
  function renderFinReviewBanner() {
    const el = document.getElementById('fin-review-banner');
    if (!finAccount || !finAccount.needsManualReview) { el.classList.add('hidden'); return; }
    const c = finAccount.case || {};
    const n = finAccount.partiallyPaidCount || 0;
    el.classList.remove('hidden');
    el.innerHTML =
      '<div style="font-weight:700;margin-bottom:0.2rem">⚠️ Manual review — partial payment</div>' +
      '<div class="text-muted">' + n + ' past-due invoice' + (n === 1 ? '' : 's') + ' on this account ' +
        (n === 1 ? 'has' : 'have') + ' been partly paid. Confirm what was agreed before sending a billing email, ' +
        'switching the payment plan, or escalating.</div>' +
      '<div style="margin-top:0.5rem">' +
        (c.reviewClearedAt
          ? '<span class="text-muted">Reviewed by ' + esc(c.reviewClearedByName || 'someone') + ' on ' + esc(finDate(c.reviewClearedAt)) + '. </span>' +
            '<button class="btn btn-sm" id="fin-review-btn" data-cleared="1">Reopen review</button>'
          : '<button class="btn btn-primary btn-sm" id="fin-review-btn" data-cleared="0">Mark reviewed</button>') +
      '</div>';
    document.getElementById('fin-review-btn').addEventListener('click', async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const rr = await api('PUT', '/financials/accounts/' + encodeURIComponent(finAccount.accountKey) + '/review',
        { cleared: btn.dataset.cleared !== '1' });
      btn.disabled = false;
      if (!rr.ok) { alert((rr.data && rr.data.error) || 'Could not update the review.'); return; }
      applyFinCase(rr.data.case);
    });
  }

  // Stage / owner / next-action controls. Assigning is admin-only server-side,
  // so a granted assignee sees their owner as read-only text.
  function renderFinCaseControls() {
    const c = (finAccount && finAccount.case) || {};
    const statuses = (finAccount && finAccount.statuses) || finStatuses;
    const sel = document.getElementById('fin-status-select');
    sel.innerHTML = statuses.map(s =>
      '<option value="' + esc(s.key) + '"' + (s.key === c.status ? ' selected' : '') + '>' + esc(s.label) + '</option>').join('');
    const assignWrap = document.getElementById('fin-assign-wrap');
    const canAssign = finCanAssign && (finAccount ? finAccount.canAssign !== false : true);
    if (canAssign) {
      assignWrap.innerHTML = 'Assigned to<br />' +
        '<select id="fin-assign-select" style="margin-top:0.2rem;padding:0.35rem 0.5rem;border:1px solid var(--border);border-radius:7px;font:inherit;font-size:0.82rem;background:var(--surface);color:var(--text)">' +
        '<option value="">Unassigned</option>' +
        finAssignees.map(u => '<option value="' + esc(u.id) + '"' + (u.id === c.assignedTo ? ' selected' : '') + '>' + esc(u.name) + '</option>').join('') +
        '</select>';
      document.getElementById('fin-assign-select').addEventListener('change', async e => {
        const rr = await api('PUT', '/financials/accounts/' + encodeURIComponent(finAccount.accountKey) + '/assign',
          { assignedTo: e.target.value || null });
        if (!rr.ok) { alert((rr.data && rr.data.error) || 'Could not assign this account.'); return; }
        if (rr.data.assigneeCanView === false) {
          alert('Assigned — but this person cannot open the Past Due report yet. Grant them the "Past Due Accounts" report under Users → Permissions so it shows up in their queue.');
        }
        applyFinCase(rr.data.case);
      });
    } else {
      assignWrap.innerHTML = 'Assigned to<br /><span style="font-size:0.85rem;color:var(--text)">' + esc(finOwnerLabel(c)) + '</span>';
    }
    const dueInput = document.getElementById('fin-due-input');
    dueInput.value = c.dueAt ? new Date(c.dueAt).toISOString().slice(0, 10) : '';
    document.getElementById('fin-case-meta').textContent = c.updatedAt && c.updatedByName
      ? 'Last updated by ' + c.updatedByName + ' on ' + finDate(c.updatedAt) : '';
  }

  // Keep the open modal and the board behind it on the same case record.
  function applyFinCase(updated) {
    if (!finAccount) return;
    finAccount.case = updated;
    const acct = (finBreakdown.accounts || []).find(a => a.accountKey === finAccount.accountKey);
    if (acct) acct.case = updated;
    renderFinReviewBanner();
    renderFinCaseControls();
    renderFinViews();
  }

  document.getElementById('fin-status-select').addEventListener('change', async e => {
    if (!finAccount) return;
    const ok = await setFinStatus(finAccount.accountKey, e.target.value);
    if (!ok) { renderFinCaseControls(); return; }
    const acct = (finBreakdown.accounts || []).find(a => a.accountKey === finAccount.accountKey);
    if (acct) applyFinCase(acct.case);
  });

  document.getElementById('fin-due-input').addEventListener('change', async e => {
    if (!finAccount) return;
    // A date input yields a bare YYYY-MM-DD; read it as local noon so the day
    // shown back is the day that was picked in every timezone.
    const dueAt = e.target.value ? new Date(e.target.value + 'T12:00:00').getTime() : null;
    const r = await api('PUT', '/financials/accounts/' + encodeURIComponent(finAccount.accountKey) + '/due', { dueAt });
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not set the next action date.'); return; }
    applyFinCase(r.data.case);
  });

  function renderFinNotes(notes) {
    const el = document.getElementById('fin-notes-list');
    if (!notes.length) { el.innerHTML = '<div class="text-muted" style="font-size:0.85rem">No notes yet.</div>'; return; }
    const me = currentUser ? currentUser.id : null;
    el.innerHTML = notes.map(n => {
      // Shared thread: only an admin, or the person who wrote it, gets a Delete.
      const canDelete = isAdmin() || (n.createdBy && n.createdBy === me);
      return \`
      <div class="fin-note">
        <div>\${esc(n.body)}</div>
        <div class="fin-note-meta">
          <span>\${esc(n.createdByName || 'Unknown')} · \${new Date(n.createdAt).toLocaleString()}</span>
          \${canDelete ? \`<span class="fin-note-del" data-id="\${esc(n.id)}" style="cursor:pointer;color:var(--accent)">Delete</span>\` : ''}
        </div>
      </div>\`;
    }).join('');
    el.querySelectorAll('.fin-note-del').forEach(x => {
      x.addEventListener('click', async () => {
        if (!confirm('Delete this note?')) return;
        const rr = await api('DELETE', '/financials/notes/' + encodeURIComponent(x.dataset.id));
        if (rr.ok && finAccount) {
          const nr = await api('GET', '/financials/notes?accountKey=' + encodeURIComponent(finAccount.accountKey));
          if (nr.ok) renderFinNotes(nr.data.notes || []);
        }
      });
    });
  }

  function closeFinModal() {
    document.getElementById('fin-modal').classList.add('hidden');
    finAccount = null;
  }
  document.getElementById('fin-modal-close').addEventListener('click', closeFinModal);
  document.getElementById('fin-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('fin-modal')) closeFinModal();
  });

  document.getElementById('fin-note-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!finAccount) return;
    const input = document.getElementById('fin-note-input');
    const body = input.value.trim();
    if (!body) return;
    const r = await api('POST', '/financials/notes', { accountKey: finAccount.accountKey, body });
    if (!r.ok) { alert(r.data.error || 'Failed to add note.'); return; }
    input.value = '';
    const nr = await api('GET', '/financials/notes?accountKey=' + encodeURIComponent(finAccount.accountKey));
    if (nr.ok) renderFinNotes(nr.data.notes || []);
  });

  document.getElementById('fin-followup-btn').addEventListener('click', async () => {
    if (!finAccount) return;
    const acct = (finBreakdown.accounts || []).find(a => a.accountKey === finAccount.accountKey);
    const balance = (finAccount.invoices || []).reduce((s, i) => s + i.outstanding, 0);
    const bucket = acct ? acct.bucket : '';
    const action = acct ? acct.action : { label: 'Follow up', detail: '' };
    const c = finAccount.case || {};
    const title = 'Collections: ' + finAccount.accountName + ' — ' + action.label;
    const desc = action.label + '. ' + action.detail + '\\n\\n' +
      'Account: ' + finAccount.accountName + '\\n' +
      'Outstanding: ' + money(balance) + '\\n' +
      'Oldest past due: ' + (acct ? acct.oldestDaysPastDue + ' days (' + bucket + ')' : 'n/a') + '\\n' +
      'Invoices past due: ' + (finAccount.invoices || []).length +
      (finAccount.needsManualReview ? '\\nManual review: partial payment on this account — confirm what was agreed first.' : '');
    const btn = document.getElementById('fin-followup-btn');
    btn.disabled = true;
    btn.textContent = 'Creating…';
    // The task lands on whoever owns the account (server-side default) so an
    // assignment made here shows up in that person's task list too.
    const r = await api('POST', '/financials/follow-up-task', {
      title, description: desc, priority: bucketPriority(bucket), accountKey: finAccount.accountKey,
      dueDate: c.dueAt || Date.now(),
    });
    if (!r.ok) { btn.disabled = false; btn.textContent = '+ Create follow-up task'; alert(r.data.error || 'Failed to create task.'); return; }
    btn.textContent = '✓ Added to Collections';
  });

  async function refreshFinancials() {
    const btn = document.getElementById('fin-refresh-btn');
    btn.disabled = true;
    btn.textContent = 'Refreshing…';
    const r = await api('POST', '/financials/past-due/refresh');
    btn.disabled = false;
    btn.innerHTML = '↻ Refresh now';
    if (!r.ok) {
      await updateSpiroBanner();
      alert((r.data && r.data.error) || 'Refresh failed. Reconnect Spiro and try again.');
      return;
    }
    await loadFinancials();
  }
  document.getElementById('fin-refresh-btn').addEventListener('click', refreshFinancials);

  // Shared handler for any "Reconnect Spiro" button (Past Due + Cleveland pages).
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest && e.target.closest('.js-spiro-reconnect');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Opening…';
    const r = await api('POST', '/financials/spiro/connect');
    if (!r.ok || !r.data || !r.data.authorizeUrl) {
      btn.disabled = false;
      btn.textContent = 'Reconnect Spiro';
      alert((r.data && r.data.error) || 'Could not start Spiro authentication.');
      return;
    }
    window.open(r.data.authorizeUrl, '_blank', 'noopener');
    btn.textContent = 'Waiting for Spiro…';
    // Poll until the OAuth callback lands, then auto-refresh the visible report.
    let waited = 0;
    const poll = setInterval(async () => {
      waited += 3;
      const connected = await updateSpiroBanner();
      if (connected || waited >= 180) {
        clearInterval(poll);
        btn.disabled = false;
        btn.textContent = 'Reconnect Spiro';
        if (connected) {
          const fin = document.getElementById('page-financials');
          const cle = document.getElementById('page-cleveland');
          const chu = document.getElementById('page-churn');
          if (fin && !fin.classList.contains('hidden')) refreshFinancials();
          else if (cle && !cle.classList.contains('hidden')) refreshCleveland();
          // Churn's refresh is a minutes-long server job rather than a re-read,
          // so it is started only if one is not already in flight; the status
          // panel below the button reports its progress from here on.
          else if (chu && !chu.classList.contains('hidden')) {
            if (!churnState.refresh || churnState.refresh.status !== 'running') churnStartRefresh();
          }
        }
      }
    }, 3000);
  });

  // ── Financials: Cleveland Investment ───────────────────────────────────────
  let clevelandData = null;
  const CLE_REVENUE_COLOR = '#1baf7a';
  const CLE_COST_COLOR = '#eb6834';

  function cleShortMoney(v) {
    const a = Math.abs(v);
    if (a >= 1000) return '$' + (v / 1000).toFixed(a % 1000 < 50 ? 0 : 1) + 'k';
    return '$' + Math.round(v);
  }
  function cleNiceCeil(v) {
    if (v <= 0) return 1000;
    const exp = Math.floor(Math.log10(v));
    const f = v / Math.pow(10, exp);
    const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nf * Math.pow(10, exp);
  }
  function cleFmtDate(ms) {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function loadCleveland() {
    await updateSpiroBanner();
    const winSel = document.getElementById('cle-window');
    const win = winSel ? winSel.value : '4';
    const r = await api('GET', '/financials/cleveland?window=' + encodeURIComponent(win));
    const chartEl = document.getElementById('cle-chart');
    const statsEl = document.getElementById('cle-stats-grid');
    const refEl = document.getElementById('cle-refreshed-at');
    if (!r.ok) {
      chartEl.innerHTML = '<div class="empty-state">Failed to load Cleveland investment.</div>';
      statsEl.innerHTML = '';
      return;
    }
    clevelandData = r.data.investment;
    const s = clevelandData.summary;
    refEl.textContent = clevelandData.refreshedAt
      ? 'Last refreshed: ' + new Date(clevelandData.refreshedAt).toLocaleString()
      : 'Never refreshed — click Refresh now';
    const tile = (label, value, sub) =>
      '<div class="stat-card"><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div>' +
      (sub ? '<div class="text-muted" style="font-size:0.72rem;margin-top:0.3rem">' + sub + '</div>' : '') + '</div>';
    statsEl.innerHTML =
      tile('Total Revenue', money(s.totalRevenue), s.orderCount + ' delivered orders') +
      tile('Total Cost', money(s.totalCost), 'payroll + 10% editing') +
      tile('Net Position', (s.net < 0 ? '-' : '') + money(Math.abs(s.net)), s.net >= 0 ? 'in the black' : 'still to recoup') +
      tile('Weekly Breakeven', s.weeklyBreakevenWeek ? cleFmtDate(s.weeklyBreakevenWeek) : 'beyond 3 yrs', 'weekly revenue ≥ weekly cost') +
      tile('Total Breakeven', s.totalBreakevenWeek ? cleFmtDate(s.totalBreakevenWeek) : 'beyond 3 yrs', 'total revenue ≥ total investment');
    renderClevelandChart(clevelandData);
  }

  function renderClevelandChart(inv) {
    const host = document.getElementById('cle-chart');
    const weeks = (inv && inv.weeks) || [];
    if (weeks.length < 2) {
      host.innerHTML = '<div class="empty-state">Not enough data yet. Connect Spiro and click Refresh now to pull order revenue.</div>';
      return;
    }
    const W = 920, H = 380, mL = 62, mR = 96, mT = 18, mB = 44;
    const plotW = W - mL - mR, plotH = H - mT - mB;
    const x0 = weeks[0].weekStart, x1 = weeks[weeks.length - 1].weekStart;
    let rawMax = 0;
    weeks.forEach(w => { rawMax = Math.max(rawMax, w.cumulativeRevenue, w.cumulativeCost); });
    const yMax = cleNiceCeil(rawMax);
    const xOf = ms => mL + (x1 === x0 ? 0 : (ms - x0) / (x1 - x0)) * plotW;
    const yOf = v => mT + plotH - (yMax ? v / yMax : 0) * plotH;

    let bIdx = 0;
    for (let i = 0; i < weeks.length; i++) if (!weeks[i].projected) bIdx = i;
    const pathFor = (arr, key) => arr.map((w, i) => (i ? 'L' : 'M') + xOf(w.weekStart).toFixed(1) + ',' + yOf(w[key]).toFixed(1)).join(' ');
    const actual = weeks.slice(0, bIdx + 1);
    const proj = weeks.slice(bIdx);

    let parts = [];
    for (let i = 0; i <= 4; i++) {
      const val = yMax * i / 4, y = yOf(val).toFixed(1);
      parts.push('<line x1="' + mL + '" y1="' + y + '" x2="' + (mL + plotW) + '" y2="' + y + '" stroke="var(--border)" stroke-width="1"/>');
      parts.push('<text x="' + (mL - 8) + '" y="' + (yOf(val) + 3).toFixed(1) + '" text-anchor="end" font-size="10" fill="var(--text-muted)">' + cleShortMoney(val) + '</text>');
    }
    const d0 = new Date(x0);
    let mk = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1);
    while (mk <= x1) {
      if (mk >= x0) {
        parts.push('<text x="' + xOf(mk).toFixed(1) + '" y="' + (H - mB + 18) + '" text-anchor="middle" font-size="10" fill="var(--text-muted)">' +
          new Date(mk).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) + '</text>');
      }
      const nd = new Date(mk); mk = Date.UTC(nd.getUTCFullYear(), nd.getUTCMonth() + 1, 1);
    }
    const be = inv.summary.totalBreakevenWeek;
    if (be && be >= x0 && be <= x1) {
      const bx = xOf(be).toFixed(1);
      const bw = weeks.find(w => w.weekStart === be);
      const by = (bw ? yOf(bw.cumulativeRevenue) : mT).toFixed(1);
      parts.push('<line x1="' + bx + '" y1="' + mT + '" x2="' + bx + '" y2="' + (mT + plotH) + '" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3 3"/>');
      parts.push('<circle cx="' + bx + '" cy="' + by + '" r="4" fill="var(--surface)" stroke="' + CLE_REVENUE_COLOR + '" stroke-width="2"/>');
      parts.push('<text x="' + bx + '" y="' + (mT - 5) + '" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text)">Breakeven ' + cleFmtDate(be) + '</text>');
    }
    parts.push('<path d="' + pathFor(actual, 'cumulativeCost') + '" fill="none" stroke="' + CLE_COST_COLOR + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');
    parts.push('<path d="' + pathFor(proj, 'cumulativeCost') + '" fill="none" stroke="' + CLE_COST_COLOR + '" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"/>');
    parts.push('<path d="' + pathFor(actual, 'cumulativeRevenue') + '" fill="none" stroke="' + CLE_REVENUE_COLOR + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');
    parts.push('<path d="' + pathFor(proj, 'cumulativeRevenue') + '" fill="none" stroke="' + CLE_REVENUE_COLOR + '" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"/>');
    const lastRev = weeks[weeks.length - 1].cumulativeRevenue, lastCost = weeks[weeks.length - 1].cumulativeCost;
    parts.push('<text x="' + (mL + plotW + 6) + '" y="' + (yOf(lastRev) + 3).toFixed(1) + '" font-size="11" font-weight="700" fill="' + CLE_REVENUE_COLOR + '">Revenue</text>');
    parts.push('<text x="' + (mL + plotW + 6) + '" y="' + (yOf(lastCost) + 3).toFixed(1) + '" font-size="11" font-weight="700" fill="' + CLE_COST_COLOR + '">Cost</text>');
    parts.push('<line id="cle-cross" x1="0" y1="' + mT + '" x2="0" y2="' + (mT + plotH) + '" stroke="var(--text-muted)" stroke-width="1" opacity="0"/>');
    parts.push('<circle id="cle-dot-rev" r="4" fill="' + CLE_REVENUE_COLOR + '" opacity="0"/>');
    parts.push('<circle id="cle-dot-cost" r="4" fill="' + CLE_COST_COLOR + '" opacity="0"/>');
    parts.push('<rect id="cle-overlay" x="' + mL + '" y="' + mT + '" width="' + plotW + '" height="' + plotH + '" fill="transparent"/>');
    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cleveland cumulative revenue versus cost over time">' + parts.join('') + '</svg>';

    const basis = inv.summary.trendWeighted ? 'recency-weighted' : (inv.summary.trendWindowWeeks ? ('last ' + inv.summary.trendWindowWeeks + ' weeks') : 'all weeks');
    const legend =
      '<div class="cle-legend"><span class="item"><span class="swatch" style="background:' + CLE_REVENUE_COLOR + '"></span>Cumulative revenue</span>' +
      '<span class="item"><span class="swatch" style="background:' + CLE_COST_COLOR + '"></span>Cumulative cost</span>' +
      '<span class="item text-muted" style="font-size:0.75rem">Dashed = projected (revenue trend of ' + basis + ')</span></div>';

    host.innerHTML = legend + svg + '<div class="cle-tooltip" id="cle-tooltip"></div>';

    const svgEl = host.querySelector('svg');
    const overlay = host.querySelector('#cle-overlay');
    const cross = host.querySelector('#cle-cross');
    const dotRev = host.querySelector('#cle-dot-rev');
    const dotCost = host.querySelector('#cle-dot-cost');
    const tip = host.querySelector('#cle-tooltip');
    const xs = weeks.map(w => xOf(w.weekStart));
    const showAt = (clientX) => {
      const rect = svgEl.getBoundingClientRect();
      if (!rect.width) return;
      const sx = (clientX - rect.left) / rect.width * W;
      let idx = 0, best = Infinity;
      for (let i = 0; i < xs.length; i++) { const dd = Math.abs(xs[i] - sx); if (dd < best) { best = dd; idx = i; } }
      const w = weeks[idx], cx = xOf(w.weekStart);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('opacity', '1');
      dotRev.setAttribute('cx', cx); dotRev.setAttribute('cy', yOf(w.cumulativeRevenue)); dotRev.setAttribute('opacity', '1');
      dotCost.setAttribute('cx', cx); dotCost.setAttribute('cy', yOf(w.cumulativeCost)); dotCost.setAttribute('opacity', '1');
      const net = w.cumulativeRevenue - w.cumulativeCost;
      tip.innerHTML =
        '<div class="cle-tt-date">' + cleFmtDate(w.weekStart) + (w.projected ? ' (projected)' : '') + '</div>' +
        '<div class="cle-tt-row"><span class="cle-tt-swatch" style="background:' + CLE_REVENUE_COLOR + '"></span>Revenue ' + money(w.cumulativeRevenue) + '</div>' +
        '<div class="cle-tt-row"><span class="cle-tt-swatch" style="background:' + CLE_COST_COLOR + '"></span>Cost ' + money(w.cumulativeCost) + '</div>' +
        '<div class="cle-tt-row" style="margin-top:0.15rem;font-weight:700">Net ' + (net < 0 ? '-' : '') + money(Math.abs(net)) + '</div>';
      tip.style.left = (cx / W * svgEl.clientWidth) + 'px';
      tip.style.top = (yOf(Math.max(w.cumulativeRevenue, w.cumulativeCost)) / H * svgEl.clientHeight) + 'px';
      tip.style.opacity = '1';
    };
    overlay.addEventListener('mousemove', e => showAt(e.clientX));
    svgEl.addEventListener('mouseleave', () => {
      cross.setAttribute('opacity', '0'); dotRev.setAttribute('opacity', '0'); dotCost.setAttribute('opacity', '0'); tip.style.opacity = '0';
    });
  }

  async function refreshCleveland() {
    const btn = document.getElementById('cle-refresh-btn');
    btn.disabled = true; btn.textContent = 'Refreshing…';
    const r = await api('POST', '/financials/cleveland/refresh');
    btn.disabled = false; btn.innerHTML = '↻ Refresh now';
    if (!r.ok) { await updateSpiroBanner(); alert((r.data && r.data.error) || 'Refresh failed. Reconnect Spiro and try again.'); return; }
    await loadCleveland();
  }
  document.getElementById('cle-refresh-btn').addEventListener('click', refreshCleveland);
  document.getElementById('cle-window').addEventListener('change', loadCleveland);

  // ── Projects ──────────────────────────────────────────────────────────────
  let allProjects = [];
  let allTasks = [];
  let projectsView = 'board'; // 'board' | 'calendar' | 'list'
  let projectsFilter = ''; // project id or ''
  let projectsStatusFilter = 'all'; // 'all' | ProjectStatus
  // Completed/archived projects stay out of the board, calendar, and pickers
  // until asked for; the Projects list keeps its own status tabs.
  let showClosedProjects = false;
  let taskModalTags = [];
  let projModalTags = [];
  let editingTaskId = null;
  let editingProjectId = null;

  // Board columns come from the API per project (task-status-ui.ts). The list
  // view and every "is this finished?" test read through it, so a project whose
  // last column is "Delivered" behaves exactly like one that says "Done".
  const statusRegistry = createStatusRegistry({ api: api });
  setTaskStatusResolver({
    isDone: function(status, task) {
      return statusRegistry.isDone(task ? task.projectId || '' : projectsFilter, status);
    },
    label: function(status, task) {
      return statusRegistry.labelOf(task ? task.projectId || '' : projectsFilter, status);
    },
    color: function(status, task) {
      return statusRegistry.colorOf(task ? task.projectId || '' : projectsFilter, status);
    },
    rank: function(status, task) {
      return statusRegistry.rankOf(task ? task.projectId || '' : projectsFilter, status);
    },
    all: function(tasks) {
      return statusRegistry.columnsForView(projectsFilter, tasks || []);
    },
  });

  /** Column sets for every board in view — the filter plus each task's project. */
  function boardProjectIds() {
    const ids = allProjects.map(function(p) { return p.id; });
    allTasks.forEach(function(t) { if (t.projectId) ids.push(t.projectId); });
    return ids;
  }

  // Reusable checkbox picker of users, used for project members & task assignees.
  function renderMemberPicker(containerId, selectedIds) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const selected = new Set(selectedIds || []);
    if (!adminUsers.length) { box.innerHTML = '<div class="member-empty">No users available.</div>'; return; }
    box.innerHTML = adminUsers.map(function(u) {
      const name = fullName(u);
      const label = name || u.username;
      const sub = name ? u.username : (u.email || '');
      return '<label class="member-row"><input type="checkbox" value="' + esc(u.id) + '"' + (selected.has(u.id) ? ' checked' : '') + '>' +
        '<span>' + esc(label) + (sub ? ' <span class="member-sub">' + esc(sub) + '</span>' : '') + '</span></label>';
    }).join('');
  }
  function readMemberPicker(containerId) {
    return Array.prototype.slice.call(document.querySelectorAll('#' + containerId + ' input[type=checkbox]:checked')).map(function(cb) { return cb.value; });
  }

  function isClosedProject(p) {
    return p.status === 'completed' || p.status === 'archived';
  }

  /** Projects offered in pickers and drawn on the board/calendar. */
  function selectableProjects() {
    if (showClosedProjects) return allProjects;
    // A closed project stays listed while it is the active filter, so the
    // selection does not silently reset when someone archives it.
    return allProjects.filter(function(p) { return !isClosedProject(p) || p.id === projectsFilter; });
  }

  async function loadProjects() {
    await ensureUsersLoaded();
    const [pr, tr] = await Promise.all([api('GET', '/projects'), api('GET', '/tasks')]);
    if (pr.ok) allProjects = pr.data.projects || [];
    if (tr.ok) allTasks = tr.data.tasks || [];
    // Columns before the first paint, or the board would draw the seed set and
    // then jump when the real one lands.
    await statusRegistry.ensure(boardProjectIds());
    populateProjectFilter();
    renderProjectsPage();
  }

  function populateProjectFilter() {
    const sel = document.getElementById('project-filter-sel');
    const prev = projectsFilter || sel.value;
    const options = selectableProjects();
    sel.innerHTML = '<option value="">All Projects</option>' +
      options.map(function(p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.title) + (isClosedProject(p) ? ' (' + esc(p.status) + ')' : '') + '</option>';
      }).join('');
    sel.value = prev && options.find(function(p) { return p.id === prev; }) ? prev : '';
    projectsFilter = sel.value;
  }

  /** Tasks in scope before the filter bar — project visibility only. */
  function tasksInScope() {
    // Tasks with no project always show; project-bound ones follow their
    // project's visibility.
    const visible = new Set(selectableProjects().map(function(p) { return p.id; }));
    return allTasks.filter(function(t) {
      if (t.parentTaskId) return false; // subtasks shown in modal only
      if (projectsFilter) return t.projectId === projectsFilter;
      return !t.projectId || visible.has(t.projectId);
    });
  }

  // Search, assignee, priority, due window, tag and "only mine". Shared with the
  // portal; drives the board, the calendar and the list from one place.
  const taskFilterBar = createTaskFilterBar({
    rootId: 'task-filter-bar',
    onChange: function() { renderProjectsPage(); },
    people: function() {
      return adminUsers.map(function(u) { return { id: u.id, name: u.username }; });
    },
    tags: function() {
      const set = {};
      tasksInScope().forEach(function(t) { (t.tags || []).forEach(function(g) { set[g] = 1; }); });
      return Object.keys(set).sort();
    },
    currentUserId: function() { return currentUser ? currentUser.id : null; },
  });

  function getFilteredTasks() {
    return taskFilterBar.apply(tasksInScope());
  }

  const projectsTaskList = createTaskList({
    rootId: 'projects-tasklist',
    tasks: getFilteredTasks,
    projectFor: function(t) {
      return t.projectId ? allProjects.find(function(p) { return p.id === t.projectId; }) || null : null;
    },
    userLabel: userLabel,
    onOpen: openEditTask,
    // Inline edits are the point of the list view: change many tasks without
    // opening each one.
    onPatch: async function(id, patch) {
      const r = await api('PUT', '/tasks/' + id, patch);
      if (r.ok) await loadProjects();
    },
    groupBy: function() { return ''; },
  });

  function renderProjectsPage() {
    document.getElementById('projects-board').classList.toggle('hidden', projectsView !== 'board');
    document.getElementById('projects-calendar').classList.toggle('hidden', projectsView !== 'calendar');
    document.getElementById('projects-tasklist').classList.toggle('hidden', projectsView !== 'tasks');
    document.getElementById('projects-list').classList.toggle('hidden', projectsView !== 'list');
    // The Projects grid is about projects, not tasks, so the task filter bar has
    // nothing to act on there.
    document.getElementById('task-filter-bar').classList.toggle('hidden', projectsView === 'list');
    taskFilterBar.refreshOptions();
    if (projectsView === 'board') renderBoard();
    else if (projectsView === 'calendar') renderCalendar();
    else if (projectsView === 'tasks') projectsTaskList.render();
    else renderProjectsList();
    if (projectsView !== 'list') {
      taskFilterBar.setCount(getFilteredTasks().length, tasksInScope().length);
    }
    document.getElementById('edit-project-btn').disabled = !projectsFilter;
    document.getElementById('dup-project-btn').disabled = !projectsFilter;
  }

  document.getElementById('show-closed-projects').addEventListener('change', function() {
    showClosedProjects = this.checked;
    populateProjectFilter();
    renderProjectsPage();
  });

  // View toggle
  function switchProjectsView(view) {
    projectsView = view;
    document.getElementById('view-board-btn').classList.toggle('active', view === 'board');
    document.getElementById('view-cal-btn').classList.toggle('active', view === 'calendar');
    document.getElementById('view-tasklist-btn').classList.toggle('active', view === 'tasks');
    document.getElementById('view-projects-btn').classList.toggle('active', view === 'list');
    renderProjectsPage();
  }
  document.getElementById('view-board-btn').addEventListener('click', function() { switchProjectsView('board'); });
  document.getElementById('view-cal-btn').addEventListener('click', function() { switchProjectsView('calendar'); });
  document.getElementById('view-tasklist-btn').addEventListener('click', function() { switchProjectsView('tasks'); });
  document.getElementById('view-projects-btn').addEventListener('click', function() { switchProjectsView('list'); });

  function renderProjectsList() {
    const grid = document.getElementById('projects-list-grid');
    const filtered = allProjects.filter(function(p) {
      return projectsStatusFilter === 'all' || p.status === projectsStatusFilter;
    });
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No projects here yet.</div>';
      return;
    }
    grid.innerHTML = filtered.map(function(p) {
      const tasksForProj = allTasks.filter(function(t) { return t.projectId === p.id && !t.parentTaskId; });
      const doneCount = tasksForProj.filter(function(t) { return statusRegistry.isDoneTask(t); }).length;
      return '<div class="project-list-card">' +
        '<div class="project-list-card-bar" style="background:' + esc(p.color) + '"></div>' +
        '<div class="project-list-card-body">' +
          '<div class="project-list-card-title-row">' +
            '<div class="resource-title-text">' + esc(p.title) + '</div>' +
            '<span class="badge proj-status-badge-' + esc(p.status) + '">' + esc(p.status) + '</span>' +
          '</div>' +
          (p.description ? '<div class="resource-desc mb-4">' + esc(p.description) + '</div>' : '') +
          '<div class="project-list-card-tasks">' + doneCount + ' / ' + tasksForProj.length + ' tasks done</div>' +
          (p.startDate || p.endDate ? '<div class="text-muted" style="font-size:0.78rem;margin-bottom:0.5rem">📅 ' + esc(formatDateRange(p.startDate, p.endDate)) + '</div>' : '') +
          (p.memberIds && p.memberIds.length ? '<div class="text-muted" style="font-size:0.78rem;margin-bottom:0.5rem">👥 ' + esc(p.memberIds.map(userLabel).join(', ')) + '</div>' : '') +
          (p.attachmentCount ? '<div class="text-muted" style="font-size:0.78rem;margin-bottom:0.5rem">📎 ' + p.attachmentCount + (p.attachmentCount === 1 ? ' attachment' : ' attachments') + '</div>' : '') +
          (p.tags && p.tags.length ? '<div class="resource-tags">' + p.tags.map(function(t) { return '<span class="resource-tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        '</div>' +
        '<div class="resource-card-footer">' +
          '<button type="button" class="btn btn-ghost btn-sm proj-list-view-btn" data-id="' + esc(p.id) + '">View Tasks</button>' +
          '<button type="button" class="btn btn-ghost btn-sm proj-list-edit-btn" data-id="' + esc(p.id) + '">Edit</button>' +
          '<button type="button" class="btn btn-ghost btn-sm proj-list-dup-btn" data-id="' + esc(p.id) + '">Duplicate</button>' +
        '</div>' +
      '</div>';
    }).join('');
    grid.querySelectorAll('.proj-list-view-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        projectsFilter = this.dataset.id;
        document.getElementById('project-filter-sel').value = this.dataset.id;
        switchProjectsView('board');
      });
    });
    grid.querySelectorAll('.proj-list-edit-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { openEditProject(this.dataset.id); });
    });
    grid.querySelectorAll('.proj-list-dup-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { duplicateProjectFlow(this.dataset.id); });
    });
  }

  document.getElementById('proj-status-tabs').addEventListener('click', function(e) {
    const btn = e.target.closest('button[data-status]');
    if (!btn) return;
    projectsStatusFilter = btn.dataset.status;
    document.querySelectorAll('#proj-status-tabs button').forEach(function(b) { b.classList.toggle('active', b === btn); });
    renderProjectsList();
  });

  // Project filter
  document.getElementById('project-filter-sel').addEventListener('change', function() {
    projectsFilter = this.value;
    renderProjectsPage();
  });

  // Edit current project button
  document.getElementById('edit-project-btn').addEventListener('click', function() {
    if (projectsFilter) openEditProject(projectsFilter);
  });

  // Duplicate current project button
  document.getElementById('dup-project-btn').addEventListener('click', function() {
    if (projectsFilter) duplicateProjectFlow(projectsFilter);
  });

  /**
   * Copy a project and its tasks under a new name. Tasks come back as Todo with
   * no due dates, so a recurring workflow can be restarted without retyping it.
   */
  async function duplicateProjectFlow(id) {
    const source = allProjects.find(function(p) { return p.id === id; });
    if (!source) return;
    const title = prompt('Name for the copy (tasks are copied as Todo, without due dates):', source.title + ' (copy)');
    if (title === null) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    const r = await api('POST', '/projects/' + id + '/duplicate', { title: trimmed });
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not duplicate that project.'); return; }
    await loadProjects();
    // Land on the copy so the new tasks are right there.
    const copyId = r.data && r.data.project && r.data.project.id;
    if (copyId) {
      projectsFilter = copyId;
      populateProjectFilter();
      document.getElementById('project-filter-sel').value = copyId;
      renderProjectsPage();
    }
  }

  // New project / task buttons
  document.getElementById('add-project-btn').addEventListener('click', function() { openAddProject(); });
  document.getElementById('add-task-btn').addEventListener('click', function() { openAddTask(statusRegistry.defaultKey(projectsFilter), null); });

  // Board add-task buttons (event delegation on board container)
  document.getElementById('projects-board').addEventListener('click', function(e) {
    const addBtn = e.target.closest('.board-add-btn');
    if (addBtn) { openAddTask(addBtn.dataset.status, null); return; }
    const card = e.target.closest('.task-card');
    if (card) { openEditTask(card.dataset.id); return; }
  });

  // Calendar month navigation and click targets live in the shared component;
  // see the createProjectCalendar wiring below.

  function renderBoard() {
    const tasks = getFilteredTasks();
    const cols = statusRegistry.columnsForView(projectsFilter, tasks);
    document.getElementById('board-cols').innerHTML = cols.map(function(col) {
      const matching = tasks
        .filter(function(t) { return t.status === col.key; })
        .sort(function(a, b) { return a.position - b.position || a.createdAt - b.createdAt; });
      // A WIP limit is advisory: it colours the count rather than blocking a
      // drop, because the work is already real by the time anyone notices.
      const overWip = col.wipLimit != null && matching.length > col.wipLimit;
      return '<div class="board-column">' +
        '<div class="board-col-header">' +
          '<span class="board-col-title" style="color:' + esc(col.color) + '">' +
            '<span class="board-col-dot" style="background:' + esc(col.color) + '"></span>' +
            esc(col.label) +
          '</span>' +
          '<span class="board-col-count' + (overWip ? ' over-wip' : '') + '">' +
            matching.length + (col.wipLimit != null ? ' / ' + col.wipLimit : '') +
          '</span>' +
        '</div>' +
        '<div class="board-col-body" style="border-top-color:' + esc(col.color) + '" data-status="' + esc(col.key) + '">' +
          (matching.length ? matching.map(renderTaskCard).join('') : '<div class="board-empty">No tasks yet</div>') +
        '</div>' +
        '<button class="board-add-btn" data-status="' + esc(col.key) + '">+ Add Task</button>' +
      '</div>';
    }).join('');
  }

  // ── Board drag & drop ──────────────────────────────────────────────────────
  // Cards carry their status/position; dropping writes both back so a move
  // across columns and a reorder within one column are the same operation.
  // Columns are rebuilt on every render, so the listeners live on the board root
  // rather than on the columns themselves.
  let dragTaskId = null;

  function boardColumns() {
    return Array.prototype.slice.call(document.querySelectorAll('#projects-board .board-col-body'));
  }

  function clearDropMarkers() {
    document.querySelectorAll('.task-drop-slot').forEach(function(el) { el.remove(); });
    boardColumns().forEach(function(col) { col.classList.remove('drag-over'); });
  }

  /** Card the pointer sits above, so the slot lands before it. */
  function cardAfterPoint(col, y) {
    const cards = Array.prototype.slice.call(col.querySelectorAll('.task-card:not(.dragging)'));
    for (let i = 0; i < cards.length; i++) {
      const box = cards[i].getBoundingClientRect();
      if (y < box.top + box.height / 2) return cards[i];
    }
    return null;
  }

  document.getElementById('projects-board').addEventListener('dragstart', function(e) {
    const card = e.target.closest('.task-card');
    if (!card) return;
    dragTaskId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox only starts a drag when data is set.
    e.dataTransfer.setData('text/plain', card.dataset.id);
  });

  document.getElementById('projects-board').addEventListener('dragend', function() {
    document.querySelectorAll('.task-card.dragging').forEach(function(el) { el.classList.remove('dragging'); });
    clearDropMarkers();
    dragTaskId = null;
  });

  document.getElementById('projects-board').addEventListener('dragover', function(e) {
    if (!dragTaskId) return;
    const col = e.target.closest('.board-col-body');
    if (!col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    boardColumns().forEach(function(c) { c.classList.toggle('drag-over', c === col); });
    const empty = col.querySelector('.board-empty');
    if (empty) empty.remove();
    let slot = document.querySelector('#projects-board .task-drop-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'task-drop-slot';
    }
    const before = cardAfterPoint(col, e.clientY);
    if (before) col.insertBefore(slot, before);
    else col.appendChild(slot);
  });

  document.getElementById('projects-board').addEventListener('drop', async function(e) {
    if (!dragTaskId) return;
    const col = e.target.closest('.board-col-body');
    if (!col) return;
    e.preventDefault();
    const status = col.dataset.status;
    const slot = col.querySelector('.task-drop-slot');
    // Index among the cards already in this column, ignoring the dragged one.
    const siblings = Array.prototype.slice.call(col.children).filter(function(el) {
      return el.classList.contains('task-card') && el.dataset.id !== dragTaskId;
    });
    let index = siblings.length;
    if (slot) {
      const nextCard = (function() {
        let n = slot.nextElementSibling;
        while (n && !n.classList.contains('task-card')) n = n.nextElementSibling;
        return n;
      })();
      if (nextCard) {
        const found = siblings.indexOf(nextCard);
        if (found >= 0) index = found;
      }
    }
    const movedId = dragTaskId;
    dragTaskId = null;
    clearDropMarkers();
    await moveTask(movedId, status, index);
  });

  /**
   * Persist a dropped card: it takes the target slot, and every card in that
   * column is renumbered so positions stay dense and stable.
   */
  async function moveTask(taskId, status, index) {
    const task = allTasks.find(function(t) { return t.id === taskId; });
    if (!task) return;
    const prevStatus = task.status;
    const prevPosition = task.position;
    const column = getFilteredTasks()
      .filter(function(t) { return t.status === status && t.id !== taskId; })
      .sort(function(a, b) { return a.position - b.position || a.createdAt - b.createdAt; });
    const clamped = Math.max(0, Math.min(index, column.length));
    column.splice(clamped, 0, task);
    const positionsBefore = new Map(column.map(function(t) { return [t.id, t.position]; }));

    // Optimistic: repaint immediately, roll back if the write fails.
    task.status = status;
    column.forEach(function(t, i) { t.position = i; });
    renderProjectsPage();

    // Only the moved card and any sibling whose slot actually shifted get written.
    const writes = column.map(function(t, i) {
      if (t.id === taskId) return api('PUT', '/tasks/' + t.id, { status: status, position: i });
      return positionsBefore.get(t.id) === i ? null : api('PUT', '/tasks/' + t.id, { position: i });
    }).filter(Boolean);
    const results = await Promise.all(writes);
    if (results.some(function(r) { return !r.ok; })) {
      task.status = prevStatus;
      task.position = prevPosition;
      renderProjectsPage();
      alert('Could not move that task. Reloading the board.');
      await loadProjects();
      return;
    }
    // A recurring task completed on drop spawns its next occurrence server-side.
    const board = task.projectId || '';
    if (statusRegistry.isDone(board, status) && !statusRegistry.isDone(board, prevStatus) && task.recurrence) {
      await loadProjects();
    }
  }

  // ── Attachments (links & files on a task or project) ───────────────────────
  // Counts ride along on the list payloads so a card never queries per-render;
  // the open modal keeps its own live list.
  function attachmentCountFor(ownerType, id) {
    const list = ownerType === 'task' ? allTasks : allProjects;
    const item = list.find(function(x) { return x.id === id; });
    return (item && item.attachmentCount) || 0;
  }

  function formatFilesize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function renderAttachments(prefix, ownerType, ownerId, items) {
    const box = document.getElementById(prefix + '-attach-list');
    if (!box) return;
    if (!items.length) {
      box.innerHTML = '<div class="attach-empty">Nothing attached yet.</div>';
      return;
    }
    box.innerHTML = items.map(function(a) {
      const isLink = a.type === 'link';
      // Links open where they point; uploads go through the authenticated
      // download route, so they are fetched rather than linked directly.
      const href = isLink ? a.url : '#';
      const cls = isLink ? '' : ' attach-download';
      return '<div class="attach-row" data-id="' + esc(a.id) + '">' +
        '<span class="attach-icon">' + (isLink ? '🔗' : '📄') + '</span>' +
        '<a class="attach-name' + cls + '" href="' + esc(href) + '"' +
          (isLink ? ' target="_blank" rel="noopener noreferrer"' : '') +
          ' data-id="' + esc(a.id) + '" data-name="' + esc(a.filename || a.title) + '">' + esc(a.title) + '</a>' +
        (a.filesize ? '<span class="attach-size">' + esc(formatFilesize(a.filesize)) + '</span>' : '') +
        '<button type="button" class="attach-del" data-id="' + esc(a.id) + '" title="Remove">✕</button>' +
      '</div>';
    }).join('');
    box.querySelectorAll('.attach-del').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const r = await api('DELETE', '/attachments/' + this.dataset.id);
        if (!r.ok) { alert('Could not remove that attachment.'); return; }
        await loadAttachments(prefix, ownerType, ownerId);
        await refreshAttachmentCounts();
      });
    });
    box.querySelectorAll('.attach-download').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        downloadAttachment(this.dataset.id, this.dataset.name);
      });
    });
  }

  /** Fetch an upload with the session token, then hand it to the browser. */
  async function downloadAttachment(id, filename) {
    const res = await fetch(API + '/attachments/' + id + '/file', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) { alert('Could not download that file.'); return; }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename || 'file';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function loadAttachments(prefix, ownerType, ownerId) {
    const path = (ownerType === 'task' ? '/tasks/' : '/projects/') + ownerId + '/attachments';
    const r = await api('GET', path);
    renderAttachments(prefix, ownerType, ownerId, (r.ok && r.data.attachments) || []);
  }

  /** Re-pull the lists so card badges match what the modal just changed. */
  async function refreshAttachmentCounts() {
    const [pr, tr] = await Promise.all([api('GET', '/projects'), api('GET', '/tasks')]);
    if (pr.ok) allProjects = pr.data.projects || [];
    if (tr.ok) allTasks = tr.data.tasks || [];
    renderProjectsPage();
  }

  async function addLinkAttachment(prefix, ownerType, ownerId) {
    const input = document.getElementById(prefix + '-attach-url');
    const url = input.value.trim();
    if (!url) return;
    if (!/^https?:\\/\\//i.test(url)) { alert('Links must start with http:// or https://'); return; }
    const path = (ownerType === 'task' ? '/tasks/' : '/projects/') + ownerId + '/attachments';
    const r = await api('POST', path, { type: 'link', url: url, title: url });
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not add that link.'); return; }
    input.value = '';
    await loadAttachments(prefix, ownerType, ownerId);
    await refreshAttachmentCounts();
  }

  const MAX_ATTACH_BYTES = 15 * 1024 * 1024;

  async function uploadAttachment(prefix, ownerType, ownerId, file) {
    if (!file) return;
    // The API caps the base64 body at 20MB; 15MB of raw bytes stays under it.
    if (file.size > MAX_ATTACH_BYTES) { alert('That file is larger than 15 MB.'); return; }
    const dataUrl = await new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function() { reject(reader.error); };
      reader.readAsDataURL(file);
    }).catch(function() { return null; });
    if (!dataUrl) { alert('Could not read that file.'); return; }
    const base64 = String(dataUrl).split(',')[1] || '';
    const path = (ownerType === 'task' ? '/tasks/' : '/projects/') + ownerId + '/attachments';
    const r = await api('POST', path, {
      type: 'file', fileData: base64, filename: file.name, mimetype: file.type || 'application/octet-stream', title: file.name,
    });
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not upload that file.'); return; }
    await loadAttachments(prefix, ownerType, ownerId);
    await refreshAttachmentCounts();
  }

  // Task modal attachment controls
  document.getElementById('task-attach-link-btn').addEventListener('click', function() {
    if (editingTaskId) addLinkAttachment('task', 'task', editingTaskId);
  });
  document.getElementById('task-attach-url').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); if (editingTaskId) addLinkAttachment('task', 'task', editingTaskId); }
  });
  document.getElementById('task-attach-file-btn').addEventListener('click', function() {
    document.getElementById('task-attach-file').click();
  });
  document.getElementById('task-attach-file').addEventListener('change', function() {
    const file = this.files && this.files[0];
    this.value = '';
    if (editingTaskId) uploadAttachment('task', 'task', editingTaskId, file);
  });

  // Project modal attachment controls
  document.getElementById('proj-attach-link-btn').addEventListener('click', function() {
    if (editingProjectId) addLinkAttachment('proj', 'project', editingProjectId);
  });
  document.getElementById('proj-attach-url').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); if (editingProjectId) addLinkAttachment('proj', 'project', editingProjectId); }
  });
  document.getElementById('proj-attach-file-btn').addEventListener('click', function() {
    document.getElementById('proj-attach-file').click();
  });
  document.getElementById('proj-attach-file').addEventListener('change', function() {
    const file = this.files && this.files[0];
    this.value = '';
    if (editingProjectId) uploadAttachment('proj', 'project', editingProjectId, file);
  });

  function initials(name) {
    const parts = String(name || '').trim().split(/\\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function renderTaskCard(task) {
    const prioMap = { low: { icon: '▿', cls: 'prio-low' }, medium: { icon: '●', cls: 'prio-med' }, high: { icon: '▲', cls: 'prio-high' }, urgent: { icon: '⚑', cls: 'prio-urgent' } };
    const prio = prioMap[task.priority] || prioMap.medium;
    const proj = task.projectId ? allProjects.find(function(p) { return p.id === task.projectId; }) : null;
    const subtasks = allTasks.filter(function(t) { return t.parentTaskId === task.id; });
    const doneSubs = subtasks.filter(function(t) { return statusRegistry.isDoneTask(t); });
    const color = proj ? proj.color : '#94a3b8';

    let html = '<div class="task-card" draggable="true" data-id="' + esc(task.id) + '" data-status="' + esc(task.status) + '">';
    html += '<div class="task-card-project-bar" style="background:' + esc(color) + '"></div>';
    html += '<div class="task-card-body">';
    html += '<div class="task-card-head">';
    html += '<div class="task-card-title">' + esc(task.title) + '</div>';
    html += '<span class="task-prio ' + prio.cls + '">' + prio.icon + ' ' + esc(task.priority) + '</span>';
    html += '</div>';
    if (proj) {
      html += '<span class="task-card-project-badge" style="background:' + esc(proj.color) + '1f;color:' + esc(proj.color) + '">' + esc(proj.title) + '</span>';
    }
    if (task.description) {
      html += '<div class="task-card-desc">' + esc(task.description) + '</div>';
    }

    // Dates and recurrence read as labelled facts rather than a cramped chip row.
    let facts = '';
    if (task.dueDate) {
      // Shared due-date chip: overdue / today / this week / later, and never
      // red once the task is done.
      facts += '<div class="task-card-fact"><span class="task-card-fact-label">📅</span>' +
        '<span class="task-card-fact-value">' + dueChip(task) + '</span></div>';
    }
    if (task.recurrence) {
      facts += '<div class="task-card-fact"><span class="task-card-fact-label">🔁</span>' +
        '<span class="task-card-fact-value task-recurrence">' + esc(task.recurrence) + '</span></div>';
    }
    const attachCount = attachmentCountFor('task', task.id);
    if (attachCount) {
      facts += '<div class="task-card-fact"><span class="task-card-fact-label">📎</span>' +
        '<span class="task-card-fact-value task-attach-count">' + attachCount + (attachCount === 1 ? ' attachment' : ' attachments') + '</span></div>';
    }
    if (task.commentCount) {
      facts += '<div class="task-card-fact"><span class="task-card-fact-label">💬</span>' +
        '<span class="task-card-fact-value task-attach-count">' + task.commentCount + (task.commentCount === 1 ? ' comment' : ' comments') + '</span></div>';
    }
    if (facts) html += '<div class="task-card-facts">' + facts + '</div>';

    // Every assignee gets a named chip — the old card truncated to two names.
    const assigneeNames = (task.assigneeIds || []).map(userLabel);
    if (!assigneeNames.length && task.assignedTo) assigneeNames.push(task.assignedTo);
    if (assigneeNames.length) {
      html += '<div class="task-assignee-row">' + assigneeNames.map(function(n) {
        return '<span class="task-assignee-chip"><span class="task-assignee">' + esc(initials(n)) + '</span>' +
          '<span class="task-assignee-name">' + esc(n) + '</span></span>';
      }).join('') + '</div>';
    }
    if (subtasks.length) {
      const pct = Math.round((doneSubs.length / subtasks.length) * 100);
      html += '<div class="task-subtask-bar">' +
        '<span class="task-subtask-count">' + doneSubs.length + '/' + subtasks.length + ' subtasks</span>' +
        '<span class="task-subtask-track"><span class="task-subtask-fill" style="width:' + pct + '%"></span></span>' +
        '</div>';
    }
    if (task.tags && task.tags.length) {
      html += '<div class="task-tags">' + task.tags.map(function(t) { return '<span class="task-tag">' + esc(t) + '</span>'; }).join('') + '</div>';
    }
    html += '</div></div>';
    return html;
  }

  /** Projects drawn on the calendar: visible ones that carry at least one date. */
  function calendarProjects() {
    return selectableProjects().filter(function(p) {
      if (projectsFilter && p.id !== projectsFilter) return false;
      return p.startDate || p.endDate;
    });
  }

  // The month grid itself is the shared component (project-calendar-ui.ts), so
  // the dashboard and the user portal cannot drift apart. This wiring supplies
  // the dashboard's own filtered data and click targets.
  const projectsCalendar = createProjectCalendar({
    rootId: 'projects-calendar',
    tasks: getFilteredTasks,
    projects: calendarProjects,
    taskColor: function(t) {
      const proj = t.projectId ? allProjects.find(function(p) { return p.id === t.projectId; }) : null;
      return proj ? proj.color : '#6b7280';
    },
    onTask: openEditTask,
    onProject: openEditProject,
    onDay: function(ms) { openAddTask(statusRegistry.defaultKey(projectsFilter), ms); },
  });

  function renderCalendar() { projectsCalendar.render(); }

  // ── Task Modal ─────────────────────────────────────────────────────────────
  function openAddTask(status, dateMs) {
    editingTaskId = null;
    taskModalTags = [];
    document.getElementById('task-modal-title').textContent = 'New Task';
    document.getElementById('task-modal-error').classList.add('hidden');
    document.getElementById('task-modal-form').reset();
    document.getElementById('task-modal-delete').classList.add('hidden');
    document.getElementById('task-subtasks-section').classList.add('hidden');
    // Attachments and the comment thread need an id to hang off, so both appear
    // once the task exists.
    document.getElementById('task-attach-section').classList.add('hidden');
    document.getElementById('task-feed-section').classList.add('hidden');
    taskFeed.clear();
    document.getElementById('task-priority').value = 'medium';
    if (dateMs) {
      document.getElementById('task-due').value = calDateInputValue(dateMs);
    }
    populateTaskProjectSelect(projectsFilter || '');
    syncTaskStatusOptions(status || statusRegistry.defaultKey(projectsFilter));
    renderTaskModalTags();
    renderMemberPicker('task-assignees-list', []);
    document.getElementById('task-modal').classList.remove('hidden');
    document.getElementById('task-title').focus();
  }

  function openEditTask(id) {
    const task = allTasks.find(function(t) { return t.id === id; });
    if (!task) return;
    editingTaskId = id;
    taskModalTags = (task.tags || []).slice();
    document.getElementById('task-modal-title').textContent = 'Edit Task';
    document.getElementById('task-modal-error').classList.add('hidden');
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-desc').value = task.description || '';
    document.getElementById('task-priority').value = task.priority;
    document.getElementById('task-due').value = task.dueDate ? new Date(task.dueDate).toISOString().slice(0,10) : '';
    document.getElementById('task-recurrence').value = task.recurrence || '';
    populateTaskProjectSelect(task.projectId || '');
    syncTaskStatusOptions(task.status);
    renderTaskModalTags();
    renderMemberPicker('task-assignees-list', task.assigneeIds || []);
    document.getElementById('task-modal-delete').classList.remove('hidden');
    document.getElementById('task-subtasks-section').classList.remove('hidden');
    document.getElementById('task-attach-section').classList.remove('hidden');
    document.getElementById('task-attach-url').value = '';
    document.getElementById('task-feed-section').classList.remove('hidden');
    renderSubtasks(id);
    loadAttachments('task', 'task', id);
    taskFeed.load(id);
    document.getElementById('task-modal').classList.remove('hidden');
    document.getElementById('task-title').focus();
  }

  /**
   * Fill the modal's status picker from the board the task belongs to, keeping
   * the current value when that board has the column. Moving a task to a project
   * with different columns lands it on that board's first column rather than
   * leaving it on a status the new board cannot show.
   */
  function syncTaskStatusOptions(preferred) {
    const sel = document.getElementById('task-status');
    const projectId = document.getElementById('task-project').value || '';
    const want = preferred || sel.value;
    const cols = statusRegistry.columnsFor(projectId);
    sel.innerHTML = cols.map(function(c) {
      return '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>';
    }).join('');
    sel.value = cols.some(function(c) { return c.key === want; })
      ? want
      : statusRegistry.defaultKey(projectId);
  }

  document.getElementById('task-project').addEventListener('change', function() {
    syncTaskStatusOptions();
  });

  function populateTaskProjectSelect(selectedId) {
    const sel = document.getElementById('task-project');
    // Closed projects stay out of the picker unless the task already sits in one.
    const options = allProjects.filter(function(p) {
      return showClosedProjects || !isClosedProject(p) || p.id === selectedId;
    });
    sel.innerHTML = '<option value="">— No Project —</option>' +
      options.map(function(p) { return '<option value="' + esc(p.id) + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.title) + (isClosedProject(p) ? ' (' + esc(p.status) + ')' : '') + '</option>'; }).join('');
  }

  // Comment thread + activity history, shared with the user portal.
  const taskFeed = createTaskFeed({
    rootId: 'task-feed',
    api: api,
    get currentUserId() { return currentUser ? currentUser.id : null; },
    get isAdmin() { return currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin'); },
    people: function() {
      return adminUsers.map(function(u) { return { id: u.id, name: u.username }; });
    },
    // Activity rows store raw ids and timestamps; turn them into what people
    // actually call these things.
    labelFor: function(field, value) {
      if (field === 'projectId') {
        const p = allProjects.find(function(x) { return x.id === value; });
        return p ? p.title : null;
      }
      if (field === 'assignees') {
        return String(value).split(',').filter(Boolean).map(function(id) {
          const u = adminUsers.find(function(x) { return x.id === id; });
          return u ? u.username : id;
        }).join(', ');
      }
      if (field === 'dueDate') {
        const n = Number(value);
        return Number.isFinite(n) ? new Date(n).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
      }
      // History can name a column a board has since renamed or dropped, so this
      // falls through to the raw key rather than inventing a label.
      if (field === 'status') {
        const task = allTasks.find(function(t) { return t.id === editingTaskId; });
        return statusRegistry.labelOf(task ? task.projectId || '' : '', value) || TF_STATUS_LABELS[value] || value;
      }
      return null;
    },
  });

  function renderSubtasks(parentId) {
    const subs = allTasks.filter(function(t) { return t.parentTaskId === parentId; });
    const list = document.getElementById('subtasks-list');
    list.innerHTML = subs.map(function(s) {
      const isDone = statusRegistry.isDoneTask(s);
      return '<div class="subtask-item" data-id="' + esc(s.id) + '">' +
        '<input type="checkbox" class="subtask-check"' + (isDone ? ' checked' : '') + ' data-id="' + esc(s.id) + '">' +
        '<span class="subtask-label' + (isDone ? ' done' : '') + '">' + esc(s.title) + '</span>' +
        '<button type="button" class="btn btn-ghost btn-xs subtask-del" data-id="' + esc(s.id) + '">✕</button>' +
        '</div>';
    }).join('');
    list.querySelectorAll('.subtask-check').forEach(function(cb) {
      cb.addEventListener('change', function() { toggleSubtaskDone(this.dataset.id, this.checked); });
    });
    list.querySelectorAll('.subtask-del').forEach(function(btn) {
      btn.addEventListener('click', function() { deleteSubtask(this.dataset.id); });
    });
  }

  async function toggleSubtaskDone(id, done) {
    const t = allTasks.find(function(t) { return t.id === id; });
    // A subtask ticks over to its own board's done/first column, not to whatever
    // the four original keys happened to be called.
    const board = t ? t.projectId || '' : '';
    const next = done ? statusRegistry.doneKey(board) : statusRegistry.defaultKey(board);
    await api('PUT', '/tasks/' + id, { status: next });
    if (t) t.status = next;
    if (editingTaskId) renderSubtasks(editingTaskId);
    renderProjectsPage();
  }

  async function deleteSubtask(id) {
    await api('DELETE', '/tasks/' + id);
    allTasks = allTasks.filter(function(t) { return t.id !== id; });
    if (editingTaskId) renderSubtasks(editingTaskId);
    renderProjectsPage();
  }

  async function submitNewSubtask() {
    const inp = document.getElementById('new-subtask-title');
    const title = inp.value.trim();
    if (!title || !editingTaskId) return;
    inp.value = '';
    const parent = allTasks.find(function(t) { return t.id === editingTaskId; });
    const r = await api('POST', '/tasks', {
      title: title,
      parentTaskId: editingTaskId,
      status: statusRegistry.defaultKey(parent ? parent.projectId || '' : ''),
      priority: 'medium',
    });
    if (r.ok) {
      allTasks.push(r.data.task);
      renderSubtasks(editingTaskId);
      renderProjectsPage();
    }
  }
  document.getElementById('add-subtask-btn').addEventListener('click', submitNewSubtask);
  document.getElementById('new-subtask-title').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); submitNewSubtask(); }
  });

  function renderTaskModalTags() {
    const wrap = document.getElementById('task-tag-chip-wrap');
    const inp = document.getElementById('task-tag-input');
    wrap.querySelectorAll('.tag-chip').forEach(function(el) { el.remove(); });
    taskModalTags.forEach(function(tag) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip removable';
      chip.textContent = tag;
      chip.title = 'Click to remove';
      chip.addEventListener('click', function() {
        taskModalTags = taskModalTags.filter(function(t) { return t !== tag; });
        renderTaskModalTags();
      });
      wrap.insertBefore(chip, inp);
    });
  }

  document.getElementById('task-tag-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = this.value.trim().replace(/,/g, '');
      if (val && !taskModalTags.includes(val)) { taskModalTags.push(val); renderTaskModalTags(); }
      this.value = '';
    } else if (e.key === 'Backspace' && !this.value && taskModalTags.length) {
      taskModalTags.pop(); renderTaskModalTags();
    }
  });

  document.getElementById('task-modal-cancel').addEventListener('click', function() {
    document.getElementById('task-modal').classList.add('hidden');
  });
  document.getElementById('task-modal-delete').addEventListener('click', async function() {
    if (!editingTaskId || !confirm('Delete this task and all its subtasks?')) return;
    const r = await api('DELETE', '/tasks/' + editingTaskId);
    if (r.ok) {
      allTasks = allTasks.filter(function(t) { return t.id !== editingTaskId && t.parentTaskId !== editingTaskId; });
      document.getElementById('task-modal').classList.add('hidden');
      renderProjectsPage();
    }
  });
  document.getElementById('task-modal-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const errEl = document.getElementById('task-modal-error');
    errEl.classList.add('hidden');
    const dueVal = document.getElementById('task-due').value;
    const body = {
      title: document.getElementById('task-title').value.trim(),
      description: document.getElementById('task-desc').value.trim() || null,
      status: document.getElementById('task-status').value,
      priority: document.getElementById('task-priority').value,
      projectId: document.getElementById('task-project').value || null,
      dueDate: dueVal ? new Date(dueVal).getTime() : null,
      assigneeIds: readMemberPicker('task-assignees-list'),
      recurrence: document.getElementById('task-recurrence').value || null,
      tags: taskModalTags.slice(),
    };
    const r = editingTaskId
      ? await api('PUT', '/tasks/' + editingTaskId, body)
      : await api('POST', '/tasks', body);
    if (!r.ok) {
      errEl.textContent = r.data.error || 'Failed to save task.';
      errEl.classList.remove('hidden');
      return;
    }
    if (editingTaskId) {
      allTasks = allTasks.map(function(t) { return t.id === editingTaskId ? r.data.task : t; });
    } else {
      allTasks.push(r.data.task);
    }
    document.getElementById('task-modal').classList.add('hidden');
    renderProjectsPage();
  });

  // ── Project Modal ──────────────────────────────────────────────────────────
  function openAddProject() {
    editingProjectId = null;
    projModalTags = [];
    document.getElementById('proj-modal-title').textContent = 'New Project';
    document.getElementById('proj-modal-error').classList.add('hidden');
    document.getElementById('proj-modal-form').reset();
    document.getElementById('proj-modal-delete').classList.add('hidden');
    // Attachments need an id to hang off, so they appear once the project exists.
    document.getElementById('proj-attach-section').classList.add('hidden');
    document.getElementById('proj-status').value = 'active';
    document.getElementById('proj-start').value = '';
    document.getElementById('proj-end').value = '';
    setProjColor('#3b82f6');
    renderProjModalTags();
    renderMemberPicker('proj-members-list', []);
    document.getElementById('proj-modal').classList.remove('hidden');
    document.getElementById('proj-name').focus();
  }

  function openEditProject(id) {
    const proj = allProjects.find(function(p) { return p.id === id; });
    if (!proj) return;
    editingProjectId = id;
    projModalTags = (proj.tags || []).slice();
    document.getElementById('proj-modal-title').textContent = 'Edit Project';
    document.getElementById('proj-modal-error').classList.add('hidden');
    document.getElementById('proj-name').value = proj.title;
    document.getElementById('proj-desc').value = proj.description || '';
    document.getElementById('proj-status').value = proj.status;
    document.getElementById('proj-start').value = proj.startDate ? new Date(proj.startDate).toISOString().slice(0,10) : '';
    document.getElementById('proj-end').value = proj.endDate ? new Date(proj.endDate).toISOString().slice(0,10) : '';
    setProjColor(proj.color || '#3b82f6');
    renderProjModalTags();
    renderMemberPicker('proj-members-list', proj.memberIds || []);
    document.getElementById('proj-modal-delete').classList.remove('hidden');
    document.getElementById('proj-attach-section').classList.remove('hidden');
    document.getElementById('proj-attach-url').value = '';
    loadAttachments('proj', 'project', id);
    document.getElementById('proj-modal').classList.remove('hidden');
    document.getElementById('proj-name').focus();
  }

  function setProjColor(color) {
    document.getElementById('proj-color-val').value = color;
    document.querySelectorAll('#color-picker .color-swatch').forEach(function(sw) {
      sw.classList.toggle('selected', sw.dataset.color === color);
    });
  }

  document.getElementById('color-picker').addEventListener('click', function(e) {
    const sw = e.target.closest('.color-swatch');
    if (sw) setProjColor(sw.dataset.color);
  });

  function renderProjModalTags() {
    const wrap = document.getElementById('proj-tag-chip-wrap');
    const inp = document.getElementById('proj-tag-input');
    wrap.querySelectorAll('.tag-chip').forEach(function(el) { el.remove(); });
    projModalTags.forEach(function(tag) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip removable';
      chip.textContent = tag;
      chip.title = 'Click to remove';
      chip.addEventListener('click', function() {
        projModalTags = projModalTags.filter(function(t) { return t !== tag; });
        renderProjModalTags();
      });
      wrap.insertBefore(chip, inp);
    });
  }

  document.getElementById('proj-tag-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = this.value.trim().replace(/,/g, '');
      if (val && !projModalTags.includes(val)) { projModalTags.push(val); renderProjModalTags(); }
      this.value = '';
    } else if (e.key === 'Backspace' && !this.value && projModalTags.length) {
      projModalTags.pop(); renderProjModalTags();
    }
  });

  document.getElementById('proj-modal-cancel').addEventListener('click', function() {
    document.getElementById('proj-modal').classList.add('hidden');
  });
  document.getElementById('proj-modal-delete').addEventListener('click', async function() {
    if (!editingProjectId || !confirm('Delete this project and all its tasks?')) return;
    const r = await api('DELETE', '/projects/' + editingProjectId);
    if (r.ok) {
      allProjects = allProjects.filter(function(p) { return p.id !== editingProjectId; });
      allTasks = allTasks.filter(function(t) { return t.projectId !== editingProjectId; });
      projectsFilter = '';
      document.getElementById('proj-modal').classList.add('hidden');
      await loadProjects();
    }
  });
  document.getElementById('proj-modal-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const errEl = document.getElementById('proj-modal-error');
    errEl.classList.add('hidden');
    const startVal = document.getElementById('proj-start').value;
    const endVal = document.getElementById('proj-end').value;
    const body = {
      title: document.getElementById('proj-name').value.trim(),
      description: document.getElementById('proj-desc').value.trim() || null,
      status: document.getElementById('proj-status').value,
      color: document.getElementById('proj-color-val').value,
      tags: projModalTags.slice(),
      startDate: startVal ? new Date(startVal).getTime() : null,
      endDate: endVal ? new Date(endVal).getTime() : null,
      memberIds: readMemberPicker('proj-members-list'),
    };
    const r = editingProjectId
      ? await api('PUT', '/projects/' + editingProjectId, body)
      : await api('POST', '/projects', body);
    if (!r.ok) {
      errEl.textContent = r.data.error || 'Failed to save project.';
      errEl.classList.remove('hidden');
      return;
    }
    if (editingProjectId) {
      allProjects = allProjects.map(function(p) { return p.id === editingProjectId ? r.data.project : p; });
    } else {
      allProjects.push(r.data.project);
      projectsFilter = r.data.project.id;
    }
    document.getElementById('proj-modal').classList.add('hidden');
    await loadProjects();
  });

  // ── Project date utils ─────────────────────────────────────────────────────
  function formatDateShort(ms) {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function formatDateMed(ms) {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function formatDateRange(start, end) {
    if (start && end) return formatDateMed(start) + ' → ' + formatDateMed(end);
    if (start) return 'Begins ' + formatDateMed(start);
    if (end) return 'Goal: ' + formatDateMed(end);
    return '';
  }

  // ── Support Tickets ─────────────────────────────────────────────────────────
  var ticketDepartments = [];      // [{key,label,email}] from the managed table
  var ticketCategoryRoutes = {};   // category -> department key
  var ticketCategories = [];       // managed request types from the categories table
  var ticketUserDirectory = [];
  var currentTicketId = null;
  var ticketSearchTimer = null;

  async function loadDepartmentList(){
    var r = await api('GET','/tickets/departments');
    if (r.ok && r.data) { ticketDepartments = r.data.departments || []; ticketCategoryRoutes = r.data.routes || {}; }
  }
  async function loadCategoryList(){
    var r = await api('GET','/tickets/categories');
    if (r.ok && r.data) {
      ticketCategories = r.data.categories || [];
      if (r.data.routes) ticketCategoryRoutes = r.data.routes;
    }
  }
  function deptLabel(key){
    var d = ticketDepartments.find(function(x){ return x.key===key; });
    return d ? d.label : key;
  }

  function ticketStatusLabel(s){ return ({'new':'New','in_progress':'In Progress','needs_review':'Needs Review','resolved':'Resolved','closed':'Closed'})[s] || s; }
  // Categories are managed data now; fall back to the raw key so a ticket whose
  // category was deleted still renders.
  function ticketCategoryLabel(c){
    var m = ticketCategories.find(function(x){ return x.key===c; });
    return m ? m.shortLabel : c;
  }

  // ── Ticket timing ───────────────────────────────────────────────────────────
  function tshortdate(ms){
    if (!ms) return '—';
    var d = new Date(ms);
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) + ', ' + d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  }
  /** Compact elapsed time, e.g. "3d 4h", "2h 15m", "45m". */
  function tduration(ms){
    if (ms === null || ms === undefined || ms < 0) return '—';
    var mins = Math.floor(ms/60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm';
    var hours = Math.floor(mins/60);
    if (hours < 24) { var rm = mins%60; return rm ? hours+'h '+rm+'m' : hours+'h'; }
    var days = Math.floor(hours/24);
    var rh = hours%24;
    return rh ? days+'d '+rh+'h' : days+'d';
  }
  /** Resolved tickets show time-to-resolution; open ones show current age. */
  function ticketAgeCell(t){
    if (t.resolvedAt) {
      return '<span style="color:#16a34a;font-weight:600">'+esc(tduration(t.resolvedAt - t.createdAt))+'</span>'
           + '<div class="text-muted" style="font-size:0.7rem">to resolve</div>';
    }
    return '<span>'+esc(tduration(Date.now() - t.createdAt))+'</span>'
         + '<div class="text-muted" style="font-size:0.7rem">open</div>';
  }
  function ticketStatusBadge(s){
    var colors={'new':'#2563eb','in_progress':'#0E6E63','needs_review':'#d97706','resolved':'#16a34a','closed':'#6b7280'};
    var c=colors[s]||'#6b7280';
    return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:700;color:#fff;background:'+c+'">'+ticketStatusLabel(s)+'</span>';
  }
  function tdate(ms){ return ms ? new Date(ms).toLocaleString() : '—'; }
  function ticketUserName(id){
    if(!id) return 'Unassigned';
    var u = ticketUserDirectory.find(function(x){ return x.id===id; });
    return u ? (u.username || id) : id;
  }

  async function loadTicketDirectory(){
    if (ticketUserDirectory.length) return;
    var r = await api('GET','/users/directory');
    if (r.ok && r.data && Array.isArray(r.data.users)) ticketUserDirectory = r.data.users;
  }

  function populateTicketDeptFilter(){
    var sel = document.getElementById('ticket-department-filter');
    var current = sel.value;
    sel.innerHTML = '<option value="">All departments</option>';
    ticketDepartments.forEach(function(d){ var o=document.createElement('option'); o.value=d.key; o.textContent=d.label; sel.appendChild(o); });
    sel.value = current;
  }
  // Filter lists every category (including retired ones) so old tickets stay
  // findable; the create modal offers only what's still on the form.
  function populateTicketCategoryFilter(){
    var sel = document.getElementById('ticket-category-filter');
    var current = sel.value;
    sel.innerHTML = '<option value="">All categories</option>';
    ticketCategories.forEach(function(c){
      var o=document.createElement('option');
      o.value=c.key;
      o.textContent=c.shortLabel + (c.active ? '' : ' (retired)');
      sel.appendChild(o);
    });
    sel.value = current;
  }
  function populateTicketCategorySelect(sel, value){
    sel.innerHTML='';
    ticketCategories.filter(function(c){ return c.active || c.key===value; }).forEach(function(c){
      var o=document.createElement('option'); o.value=c.key; o.textContent=c.shortLabel;
      if(c.key===value) o.selected=true;
      sel.appendChild(o);
    });
  }
  function populateTicketDeptSelect(sel, value){
    sel.innerHTML='';
    var opts = ticketDepartments.slice();
    if (value && !opts.some(function(d){ return d.key===value; })) opts.push({ key:value, label:value });
    opts.forEach(function(d){ var o=document.createElement('option'); o.value=d.key; o.textContent=d.label; if(d.key===value) o.selected=true; sel.appendChild(o); });
  }
  function populateTicketAssignee(sel, value){
    sel.innerHTML='<option value="">Unassigned</option>';
    ticketUserDirectory.forEach(function(u){ var o=document.createElement('option'); o.value=u.id; o.textContent=u.username||u.id; if(u.id===value) o.selected=true; sel.appendChild(o); });
  }

  async function loadTickets(){
    await Promise.all([loadTicketDirectory(), loadDepartmentList(), loadCategoryList()]);
    populateTicketDeptFilter();
    populateTicketCategoryFilter();
    await Promise.all([loadTicketStats(), loadTicketTable()]);
  }

  async function loadTicketStats(){
    var grid = document.getElementById('ticket-stats-grid');
    var r = await api('GET','/tickets/stats');
    if(!r.ok){ grid.innerHTML=''; return; }
    var b = (r.data.stats && r.data.stats.byStatus) || {};
    var open = (b['new']||0)+(b.in_progress||0)+(b.needs_review||0);
    var tiles = [['Open',open],['New',b['new']||0],['In Progress',b.in_progress||0],['Needs Review',b.needs_review||0],['Resolved',b.resolved||0]];
    grid.innerHTML = tiles.map(function(t){ return '<div class="stat-card"><div class="stat-label">'+t[0]+'</div><div class="stat-value">'+t[1]+'</div></div>'; }).join('');
  }

  function ticketFilterQuery(){
    var p = new URLSearchParams();
    var st = document.getElementById('ticket-status-filter').value;
    var cat = document.getElementById('ticket-category-filter').value;
    var dep = document.getElementById('ticket-department-filter').value;
    var q = document.getElementById('ticket-search').value.trim();
    if(st) p.set('status',st);
    if(cat) p.set('category',cat);
    if(dep) p.set('department',dep);
    if(q) p.set('q',q);
    var qs = p.toString();
    return qs ? '?'+qs : '';
  }

  async function loadTicketTable(){
    var body = document.getElementById('ticket-body');
    var r = await api('GET','/tickets'+ticketFilterQuery());
    if(!r.ok){ body.innerHTML='<tr><td colspan="10" class="empty-state">Failed to load.</td></tr>'; return; }
    var tickets = r.data.tickets || [];
    if(!tickets.length){ body.innerHTML='<tr><td colspan="10" class="empty-state">No tickets.</td></tr>'; return; }
    body.innerHTML = tickets.map(function(t){
      return '<tr data-id="'+esc(t.id)+'" class="ticket-row" style="cursor:pointer">'+
        '<td><strong>'+esc(t.number)+'</strong>'+(t.isTest?' <span style="font-size:0.65rem;font-weight:700;color:#7a5b00;background:#fff8e1;border:1px solid #f4d675;border-radius:5px;padding:1px 5px;vertical-align:middle">TEST</span>':'')+'</td>'+
        '<td>'+esc(t.subject)+'</td>'+
        '<td>'+esc(ticketCategoryLabel(t.category))+'</td>'+
        '<td>'+esc(t.requesterName||'—')+'</td>'+
        '<td>'+esc(t.orderAddress||t.orderId||'—')+'</td>'+
        '<td>'+esc(deptLabel(t.department))+'</td>'+
        '<td>'+ticketStatusBadge(t.status)+'</td>'+
        '<td class="text-muted" style="font-size:0.8rem">'+esc(tshortdate(t.createdAt))+'</td>'+
        '<td class="text-muted" style="font-size:0.8rem">'+esc(tshortdate(t.resolvedAt))+'</td>'+
        '<td style="font-size:0.8rem">'+ticketAgeCell(t)+'</td>'+
        '</tr>';
    }).join('');
    body.querySelectorAll('.ticket-row').forEach(function(tr){ tr.addEventListener('click', function(){ openTicket(tr.dataset.id); }); });
  }

  function ticketEventLine(e){
    var who = e.authorName || (e.authorType==='system'?'system':e.authorType);
    var text='';
    if(e.kind==='created') text='opened the ticket';
    else if(e.kind==='comment') text=esc(e.body||'');
    else if(e.kind==='status_change') text='changed status '+((e.meta&&e.meta.from)?ticketStatusLabel(e.meta.from)+' → ':'')+ticketStatusLabel(e.meta&&e.meta.to);
    else if(e.kind==='assignment') text='reassigned to '+ticketUserName(e.meta&&e.meta.to);
    else if(e.kind==='email_out') text='emailed the department'+(e.body?': '+esc(e.body):'');
    else if(e.kind==='email_in') text='replied by email'+(e.body?': '+esc(e.body):'');
    return '<div style="padding:0.5rem 0;border-bottom:1px solid var(--border)"><div style="font-size:0.8rem;color:var(--text-muted)"><strong>'+esc(who)+'</strong> · '+tdate(e.createdAt)+'</div><div style="font-size:0.9rem;white-space:pre-wrap">'+text+'</div></div>';
  }
  function renderTicketThread(events){
    var el=document.getElementById('ticket-modal-thread');
    el.innerHTML = events.length ? events.map(ticketEventLine).join('') : '<div class="text-muted" style="font-size:0.85rem">No activity yet.</div>';
  }

  async function openTicket(id){
    var r = await api('GET','/tickets/'+id);
    if(!r.ok){ alert((r.data&&r.data.error)||'Failed to open ticket.'); return; }
    var t = r.data.ticket; var events = r.data.events || [];
    currentTicketId = t.id;
    document.getElementById('ticket-modal-title').textContent = t.number + ' · ' + ticketCategoryLabel(t.category);
    var meta = [];
    if(t.requesterName) meta.push('<strong>'+esc(t.requesterName)+'</strong>');
    if(t.requesterEmail) meta.push(esc(t.requesterEmail));
    if(t.requesterPhone) meta.push(esc(t.requesterPhone));
    if(t.orderAddress) meta.push('📍 '+esc(t.orderAddress));
    if(t.orderId) meta.push('Order '+esc(t.orderId));
    meta.push('via '+esc(t.source));
    document.getElementById('ticket-modal-meta').innerHTML = meta.join(' · ');
    // Timing line: opened, and either how long it took or how long it's been open.
    var timing = ['Opened '+esc(tdate(t.createdAt))];
    if (t.resolvedAt) {
      timing.push('Resolved '+esc(tdate(t.resolvedAt)));
      timing.push('<strong style="color:#16a34a">Took '+esc(tduration(t.resolvedAt - t.createdAt))+'</strong>');
    } else {
      timing.push('<strong>Open '+esc(tduration(Date.now() - t.createdAt))+'</strong>');
    }
    document.getElementById('ticket-modal-timing').innerHTML = timing.join(' · ');
    document.getElementById('ticket-modal-desc').textContent = t.description || '(no details provided)';
    document.getElementById('ticket-modal-status').value = t.status;
    document.getElementById('ticket-modal-priority').value = t.priority;
    populateTicketDeptSelect(document.getElementById('ticket-modal-department'), t.department);
    populateTicketAssignee(document.getElementById('ticket-modal-assignee'), t.assignedTo);
    renderTicketThread(events);
    document.getElementById('ticket-modal').classList.remove('hidden');
  }

  function closeTicketModal(){ document.getElementById('ticket-modal').classList.add('hidden'); currentTicketId=null; }
  document.getElementById('ticket-modal-close').addEventListener('click', closeTicketModal);
  document.getElementById('ticket-modal').addEventListener('click', function(e){ if(e.target.id==='ticket-modal') closeTicketModal(); });

  document.getElementById('ticket-modal-save').addEventListener('click', async function(){
    if(!currentTicketId) return;
    var payload = {
      status: document.getElementById('ticket-modal-status').value,
      priority: document.getElementById('ticket-modal-priority').value,
      department: document.getElementById('ticket-modal-department').value,
      assignedTo: document.getElementById('ticket-modal-assignee').value || null,
    };
    var r = await api('PUT','/tickets/'+currentTicketId, payload);
    if(!r.ok){ alert((r.data&&r.data.error)||'Save failed.'); return; }
    await openTicket(currentTicketId);
    loadTicketTable(); loadTicketStats();
  });

  document.getElementById('ticket-comment-form').addEventListener('submit', async function(e){
    e.preventDefault();
    var input=document.getElementById('ticket-comment-input');
    var text=input.value.trim();
    if(!text || !currentTicketId) return;
    var r = await api('POST','/tickets/'+currentTicketId+'/comment', { body: text });
    if(!r.ok){ alert((r.data&&r.data.error)||'Comment failed.'); return; }
    input.value='';
    await openTicket(currentTicketId);
    loadTicketTable();
  });

  ['ticket-status-filter','ticket-category-filter','ticket-department-filter'].forEach(function(id){
    document.getElementById(id).addEventListener('change', loadTicketTable);
  });
  document.getElementById('ticket-search').addEventListener('input', function(){
    clearTimeout(ticketSearchTimer); ticketSearchTimer=setTimeout(loadTicketTable, 250);
  });

  async function openCreateTicket(){
    document.getElementById('ticket-create-error').classList.add('hidden');
    document.getElementById('ticket-create-form').reset();
    if(!ticketCategories.length) await loadCategoryList();
    populateTicketCategorySelect(document.getElementById('tc-category'), null);
    document.getElementById('ticket-create-modal').classList.remove('hidden');
  }
  function closeCreateTicket(){ document.getElementById('ticket-create-modal').classList.add('hidden'); }
  document.getElementById('ticket-new-btn').addEventListener('click', openCreateTicket);
  document.getElementById('ticket-create-close').addEventListener('click', closeCreateTicket);
  document.getElementById('ticket-create-cancel').addEventListener('click', closeCreateTicket);
  document.getElementById('ticket-create-modal').addEventListener('click', function(e){ if(e.target.id==='ticket-create-modal') closeCreateTicket(); });
  document.getElementById('ticket-create-form').addEventListener('submit', async function(e){
    e.preventDefault();
    var payload = {
      category: document.getElementById('tc-category').value,
      subject: document.getElementById('tc-subject').value.trim(),
      description: document.getElementById('tc-description').value.trim() || null,
      priority: document.getElementById('tc-priority').value,
      requesterName: document.getElementById('tc-requester-name').value.trim() || null,
      requesterEmail: document.getElementById('tc-requester-email').value.trim() || null,
      requesterPhone: document.getElementById('tc-requester-phone').value.trim() || null,
      orderId: document.getElementById('tc-order-id').value.trim() || null,
      orderAddress: document.getElementById('tc-order-address').value.trim() || null,
    };
    var er = document.getElementById('ticket-create-error');
    if(!payload.subject){ er.textContent='Subject is required.'; er.classList.remove('hidden'); return; }
    var r = await api('POST','/tickets', payload);
    if(!r.ok){ er.textContent=(r.data&&r.data.error)||'Create failed.'; er.classList.remove('hidden'); return; }
    closeCreateTicket();
    await Promise.all([loadTicketTable(), loadTicketStats()]);
    openTicket(r.data.ticket.id);
  });

  // ── Departments management ──────────────────────────────────────────────────
  async function loadDepartments(){
    await Promise.all([loadDepartmentList(), loadCategoryList()]);
    renderDeptTable();
    renderRoutes();
  }
  function renderDeptTable(){
    var body = document.getElementById('dept-body');
    if(!ticketDepartments.length){ body.innerHTML='<tr><td colspan="4" class="empty-state">No departments yet.</td></tr>'; return; }
    body.innerHTML = ticketDepartments.map(function(d){
      return '<tr data-key="'+esc(d.key)+'">'+
        '<td><input type="text" class="dept-label" value="'+esc(d.label)+'" style="width:100%" /></td>'+
        '<td class="text-muted" style="font-size:0.8rem">'+esc(d.key)+'</td>'+
        '<td><input type="email" class="dept-email" value="'+esc(d.email||'')+'" placeholder="not set" style="width:100%" /></td>'+
        '<td style="white-space:nowrap"><button class="btn btn-primary btn-sm dept-save">Save</button> <button class="btn btn-ghost btn-sm dept-del" title="Delete department">✕</button></td>'+
        '</tr>';
    }).join('');
    body.querySelectorAll('.dept-save').forEach(function(btn){ btn.addEventListener('click', function(){ saveDept(btn.closest('tr')); }); });
    body.querySelectorAll('.dept-del').forEach(function(btn){ btn.addEventListener('click', function(){ delDept(btn.closest('tr').getAttribute('data-key')); }); });
  }
  async function saveDept(tr){
    var key = tr.getAttribute('data-key');
    var label = tr.querySelector('.dept-label').value.trim();
    var email = tr.querySelector('.dept-email').value.trim();
    if(!label){ alert('Department name is required.'); return; }
    var r = await api('PUT','/tickets/departments/'+encodeURIComponent(key), { label: label, email: email || null });
    if(!r.ok){ alert((r.data&&r.data.error)||'Save failed.'); return; }
    await loadDepartments();
  }
  async function delDept(key){
    if(!confirm('Delete this department? Existing tickets keep their history; any routing pointed here falls back to General.')) return;
    var r = await api('DELETE','/tickets/departments/'+encodeURIComponent(key));
    if(!r.ok){ alert((r.data&&r.data.error)||'Delete failed.'); return; }
    await loadDepartments();
  }
  document.getElementById('dept-add-form').addEventListener('submit', async function(e){
    e.preventDefault();
    var label = document.getElementById('dept-new-label').value.trim();
    var email = document.getElementById('dept-new-email').value.trim();
    if(!label) return;
    var r = await api('POST','/tickets/departments', { label: label, email: email || null });
    if(!r.ok){ alert((r.data&&r.data.error)||'Add failed.'); return; }
    document.getElementById('dept-new-label').value=''; document.getElementById('dept-new-email').value='';
    await loadDepartments();
  });
  // Routing rows follow the managed categories, so a request type added on the
  // Request Types page shows up here too (both write the same routes table).
  function renderRoutes(){
    var wrap = document.getElementById('route-rows');
    var cats = ticketCategories.filter(function(c){ return c.active; });
    if(!cats.length){ wrap.innerHTML='<div class="text-muted" style="font-size:0.85rem">No request types on the form yet.</div>'; return; }
    wrap.innerHTML = cats.map(function(c){
      var opts = ticketDepartments.map(function(d){ return '<option value="'+esc(d.key)+'"'+(ticketCategoryRoutes[c.key]===d.key?' selected':'')+'>'+esc(d.label)+'</option>'; }).join('');
      return '<div class="flex items-center gap-2" style="justify-content:space-between"><label style="margin:0">'+esc(c.shortLabel)+'</label><select data-cat="'+esc(c.key)+'" style="min-width:220px">'+opts+'</select></div>';
    }).join('');
  }
  document.getElementById('route-save-btn').addEventListener('click', async function(){
    var payload = {};
    document.querySelectorAll('#route-rows select').forEach(function(sel){ payload[sel.getAttribute('data-cat')] = sel.value; });
    var r = await api('PUT','/tickets/category-routes', payload);
    var note = document.getElementById('route-saved');
    if(!r.ok){ note.textContent = 'Save failed'; return; }
    ticketCategoryRoutes = r.data.routes || ticketCategoryRoutes;
    note.textContent = 'Saved ✓'; setTimeout(function(){ note.textContent=''; }, 2000);
  });

  // ── Request Types (categories) management ───────────────────────────────────
  var editingCategoryKey = null;   // null = creating a new one

  async function loadCategories(){
    await Promise.all([loadCategoryList(), loadDepartmentList()]);
    renderCategoryTable();
  }
  function categoryExtraSummary(c){
    if (c.extraField === 'select') {
      var n = (c.extraOptions||[]).length;
      return esc(c.extraLabel||'—') + '<div class="text-muted" style="font-size:0.7rem">list · ' + n + ' choice' + (n===1?'':'s') + '</div>';
    }
    if (c.extraField === 'text') {
      return esc(c.extraLabel||'—') + '<div class="text-muted" style="font-size:0.7rem">free text</div>';
    }
    return '<span class="text-muted">None</span>';
  }
  function renderCategoryTable(){
    var body = document.getElementById('cat-body');
    if(!ticketCategories.length){ body.innerHTML='<tr><td colspan="5" class="empty-state">No request types yet.</td></tr>'; return; }
    body.innerHTML = ticketCategories.map(function(c){
      var dept = ticketCategoryRoutes[c.key];
      return '<tr data-key="'+esc(c.key)+'">'+
        '<td><strong>'+esc(c.label)+'</strong><div class="text-muted" style="font-size:0.72rem">'+esc(c.shortLabel)+' · '+esc(c.key)+'</div></td>'+
        '<td style="font-size:0.85rem">'+categoryExtraSummary(c)+'</td>'+
        '<td style="font-size:0.85rem">'+esc(dept?deptLabel(dept):'General')+'</td>'+
        '<td>'+(c.active
          ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:700;color:#fff;background:#16a34a">Live</span>'
          : '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:700;color:#fff;background:#6b7280">Retired</span>')+'</td>'+
        '<td style="white-space:nowrap"><button class="btn btn-sm cat-edit">Edit</button> <button class="btn btn-ghost btn-sm cat-del" title="Remove">✕</button></td>'+
        '</tr>';
    }).join('');
    body.querySelectorAll('.cat-edit').forEach(function(btn){ btn.addEventListener('click', function(){ openCategoryModal(btn.closest('tr').getAttribute('data-key')); }); });
    body.querySelectorAll('.cat-del').forEach(function(btn){ btn.addEventListener('click', function(){ removeCategoryRow(btn.closest('tr').getAttribute('data-key')); }); });
  }

  function syncCategoryExtraFields(){
    var kind = document.getElementById('cat-extra-field').value;
    document.getElementById('cat-extra-label-group').classList.toggle('hidden', kind==='none');
    document.getElementById('cat-extra-options-group').classList.toggle('hidden', kind!=='select');
    document.getElementById('cat-extra-placeholder-group').classList.toggle('hidden', kind!=='text');
  }
  document.getElementById('cat-extra-field').addEventListener('change', syncCategoryExtraFields);

  function openCategoryModal(key){
    editingCategoryKey = key || null;
    var c = key ? ticketCategories.find(function(x){ return x.key===key; }) : null;
    document.getElementById('category-modal-title').textContent = c ? 'Edit Request Type' : 'New Request Type';
    document.getElementById('category-error').classList.add('hidden');
    document.getElementById('cat-label').value = c ? c.label : '';
    document.getElementById('cat-short-label').value = c ? c.shortLabel : '';
    document.getElementById('cat-extra-field').value = c ? c.extraField : 'none';
    document.getElementById('cat-extra-label').value = (c && c.extraLabel) || '';
    document.getElementById('cat-extra-options').value = (c && c.extraOptions) ? c.extraOptions.join('\\n') : '';
    document.getElementById('cat-extra-placeholder').value = (c && c.extraPlaceholder) || '';
    document.getElementById('cat-details-label').value = c ? c.detailsLabel : 'Details';
    document.getElementById('cat-details-hint').value = (c && c.detailsHint) || '';
    document.getElementById('cat-active').checked = c ? !!c.active : true;
    var deptSel = document.getElementById('cat-department');
    deptSel.innerHTML='';
    var routed = c ? ticketCategoryRoutes[c.key] : null;
    ticketDepartments.forEach(function(d){
      var o=document.createElement('option'); o.value=d.key; o.textContent=d.label;
      if(d.key===routed) o.selected=true;
      deptSel.appendChild(o);
    });
    syncCategoryExtraFields();
    document.getElementById('category-modal').classList.remove('hidden');
  }
  function closeCategoryModal(){ document.getElementById('category-modal').classList.add('hidden'); editingCategoryKey=null; }
  document.getElementById('cat-add-btn').addEventListener('click', function(){ openCategoryModal(null); });
  document.getElementById('category-close').addEventListener('click', closeCategoryModal);
  document.getElementById('category-cancel').addEventListener('click', closeCategoryModal);
  document.getElementById('category-modal').addEventListener('click', function(e){ if(e.target.id==='category-modal') closeCategoryModal(); });

  document.getElementById('category-form').addEventListener('submit', async function(e){
    e.preventDefault();
    var er = document.getElementById('category-error');
    var label = document.getElementById('cat-label').value.trim();
    if(!label){ er.textContent='The form option is required.'; er.classList.remove('hidden'); return; }
    var kind = document.getElementById('cat-extra-field').value;
    var options = document.getElementById('cat-extra-options').value.split('\\n').map(function(s){ return s.trim(); }).filter(Boolean);
    if(kind==='select' && !options.length){ er.textContent='Add at least one choice, or switch the follow-up question off.'; er.classList.remove('hidden'); return; }
    var extraLabel = document.getElementById('cat-extra-label').value.trim();
    if(kind!=='none' && !extraLabel){ er.textContent='Give the follow-up question some text.'; er.classList.remove('hidden'); return; }
    var payload = {
      label: label,
      shortLabel: document.getElementById('cat-short-label').value.trim() || label,
      extraField: kind,
      extraLabel: kind==='none' ? null : extraLabel,
      extraOptions: kind==='select' ? options : [],
      extraPlaceholder: kind==='text' ? (document.getElementById('cat-extra-placeholder').value.trim() || null) : null,
      detailsLabel: document.getElementById('cat-details-label').value.trim() || 'Details',
      detailsHint: document.getElementById('cat-details-hint').value.trim() || null,
      active: document.getElementById('cat-active').checked,
      department: document.getElementById('cat-department').value || null,
    };
    var r = editingCategoryKey
      ? await api('PUT','/tickets/categories/'+encodeURIComponent(editingCategoryKey), payload)
      : await api('POST','/tickets/categories', payload);
    if(!r.ok){ er.textContent=(r.data&&r.data.error)||'Save failed.'; er.classList.remove('hidden'); return; }
    closeCategoryModal();
    await loadCategories();
  });

  async function removeCategoryRow(key){
    if(!confirm('Remove this request type? If tickets already use it, it stays on those tickets and is just retired from the form.')) return;
    var r = await api('DELETE','/tickets/categories/'+encodeURIComponent(key));
    if(!r.ok){ alert((r.data&&r.data.error)||'Remove failed.'); return; }
    if(r.data && r.data.outcome==='deactivated'){
      alert('Retired from the form. '+r.data.ticketCount+' existing ticket'+(r.data.ticketCount===1?'':'s')+' kept this type, so it was not deleted.');
    }
    await loadCategories();
  }

  // ── Intake form preview ─────────────────────────────────────────────────────
  var testPreview = { token: '', email: '' };
  function intakeFormUrl(){ return location.origin + '/support'; }
  function loadFormPreview(){
    document.getElementById('form-preview-url').value = intakeFormUrl() + '?orderId=<ORDER_ID>';
    var emailEl = document.getElementById('form-test-email');
    if (!emailEl.value && currentUser && currentUser.email) emailEl.value = currentUser.email;
    reloadFormPreview();
  }
  function reloadFormPreview(){
    // Cache-bust so an edit on the Request Types page shows immediately.
    var src = intakeFormUrl() + '?orderId=SAMPLE-1234&address=' + encodeURIComponent('123 Example St, Cleveland OH');
    if (testPreview.token) src += '&test=' + encodeURIComponent(testPreview.token) + '&testEmail=' + encodeURIComponent(testPreview.email);
    document.getElementById('form-preview-frame').src = src + '&_=' + Date.now();
  }
  async function enableTestMode(){
    var email = (document.getElementById('form-test-email').value || '').trim();
    var status = document.getElementById('form-test-status');
    if (email.indexOf('@') === -1) {
      status.textContent = 'Enter a valid email to receive the test notifications.';
      document.getElementById('form-test-toggle').checked = false;
      return;
    }
    status.textContent = 'Enabling…';
    var r = await api('GET', '/tickets/test-token?email=' + encodeURIComponent(email));
    if (!r.ok) {
      status.textContent = (r.data && r.data.error) || 'Could not enable test mode.';
      document.getElementById('form-test-toggle').checked = false;
      return;
    }
    testPreview = { token: r.data.token, email: r.data.email };
    status.textContent = '✓ Test mode on — submissions below email ' + r.data.email + ' and are tagged TEST. Expires in ~1 hour.';
    reloadFormPreview();
  }
  function disableTestMode(){
    testPreview = { token: '', email: '' };
    document.getElementById('form-test-status').textContent = '';
    reloadFormPreview();
  }
  document.getElementById('form-test-toggle').addEventListener('change', function(){
    if (this.checked) enableTestMode(); else disableTestMode();
  });
  document.getElementById('form-test-email').addEventListener('change', function(){
    if (document.getElementById('form-test-toggle').checked) enableTestMode();
  });
  document.getElementById('form-preview-reload').addEventListener('click', reloadFormPreview);
  document.getElementById('form-preview-open').addEventListener('click', function(){
    window.open(intakeFormUrl() + '?orderId=SAMPLE-1234', '_blank', 'noopener');
  });
  document.getElementById('form-preview-copy').addEventListener('click', async function(){
    var btn = document.getElementById('form-preview-copy');
    try { await navigator.clipboard.writeText(document.getElementById('form-preview-url').value); btn.textContent='Copied ✓'; }
    catch (e) { document.getElementById('form-preview-url').select(); btn.textContent='Press ⌘C'; }
    setTimeout(function(){ btn.textContent='Copy'; }, 1800);
  });

  // ── Nav ───────────────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.page); });
  });
  window.addEventListener('hashchange', () => {
    const page = location.hash.replace('#', '');
    if (page && pages[page]) navigate(page);
  });

  // ── Utils ─────────────────────────────────────────────────────────────────
  // Escapes both quote styles: esc() output lands inside single-quoted JS string
  // literals in inline handlers (onclick="fn('...')"), so missing ' is a breakout.
  function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function formatUptime(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? \`\${h}h \${m}m\` : \`\${m}m\`;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  (async () => {
    if (token && await tryRestoreSession()) {
      await showApp();
    }
  })();
})();
</script>
</body>
</html>
`;
