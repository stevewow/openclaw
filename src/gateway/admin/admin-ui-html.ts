import { BRAND_FAVICON_TAG, BRAND_NAME, BRAND_TAGLINE, brandLogo, brandTitle } from "./brand.js";
import { MARKET_COMPONENT_JS, MARKET_CSS } from "./market-ui.js";
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
import { PORTAL_FEATURES } from "./types.js";

export const ADMIN_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${brandTitle("Admin")}</title>
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

  /* Layout */
  .app { display: flex; min-height: calc(100vh - var(--banner-h)); }
  .sidebar { width: 240px; background: var(--sidebar-bg); display: flex; flex-direction: column; flex-shrink: 0; position: sticky; top: var(--banner-h); height: calc(100vh - var(--banner-h)); }
  .sidebar-logo { padding: 1.25rem 1.25rem 1rem; display: flex; align-items: center; gap: 0.75rem; border-bottom: 1px solid var(--sidebar-border); }
  .sidebar-logo-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
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
  /* Territory filter row. The SPA styles every select 100% wide, so a select in
     a flex row has to opt out or it swallows the line. */
  .churn-bds-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.6rem; font-size: 0.85rem; }
  .churn-bds-row label { font-weight: 600; }
  .churn-bds-row select { width: auto; max-width: 18rem; padding: 0.3rem 0.5rem; }
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
  .bucket-45-59 { background: #d97706; color: #fff; }
  .bucket-60-89 { background: #ea580c; color: #fff; }
  .bucket-90-119 { background: #dc2626; color: #fff; }
  .bucket-120plus { background: #7f1d1d; color: #fff; }
  .fin-inv-link { color: var(--accent); font-weight: 600; text-decoration: none; }
  .fin-inv-link:hover { text-decoration: underline; }
  .fin-note { border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.75rem; margin-bottom: 0.5rem; background: var(--surface2); }
  .fin-note-meta { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem; display: flex; justify-content: space-between; gap: 0.5rem; }
  .fin-row-click { cursor: pointer; }
  .fin-row-click:hover { background: var(--surface2); }
  .fin-flag { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .fin-flag-clear { background: var(--surface2); color: var(--text-muted); border: 1px solid var(--border); }
  /* Pay-at-order is about future orders, not this debt, so it reads in its own
     colour rather than sharing the amber the collections flags use. */
  .fin-flag-pao { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }
  .fin-pao-banner { border-left: 3px solid #7c3aed; background: var(--surface2); border-radius: 8px; padding: 0.6rem 0.75rem; margin-bottom: 1rem; font-size: 0.82rem; }
  .fin-owner { font-size: 0.72rem; color: var(--text-muted); }
  /* Last contact: silence is the signal, so "Never" and a stale date carry it. */
  .fin-contact { font-weight: 600; }
  .fin-contact-stale { color: #b45309; }
  .fin-contact-never { font-weight: 700; color: #991b1b; }
  .fin-next { font-weight: 600; }
  .fin-next-over { color: #991b1b; font-weight: 700; }
  .fin-next-today { color: #b45309; font-weight: 700; }
  .fin-next-none { color: var(--text-muted); }
  /* Inline pickers sit quietly until hovered, so a dense table still reads as
     data rather than as a wall of form controls. */
  .fin-cell-select { max-width: 13rem; padding: 0.25rem 0.4rem; font-size: 0.78rem; font-family: inherit; color: var(--text); background: transparent; border: 1px solid transparent; border-radius: 6px; cursor: pointer; }
  .fin-cell-select:hover { border-color: var(--border); background: var(--surface); }
  .fin-cell-select:focus { outline: none; border-color: var(--accent); background: var(--surface); box-shadow: 0 0 0 3px rgba(192,0,10,0.09); }
  /* A pinned step disagrees with the account's age on purpose — say so. */
  .fin-cell-pinned { color: var(--accent); font-weight: 600; }
  /* Growth is the column the Focus report exists for, so it carries colour. */
  .focus-up { color: #15803d; font-weight: 700; }
  .focus-down { color: #b91c1c; font-weight: 700; }
  /* Client tags. Kept small and outlined so a row of them cannot out-shout the
     revenue figures they sit beside. */
  .focus-tag { display: inline-block; padding: 0.05rem 0.35rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.02em; white-space: nowrap; border: 1px solid transparent; }
  .focus-tag + .focus-tag { margin-left: 0.25rem; }
  .focus-tag-vip { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
  .focus-tag-top { background: #dcfce7; color: #166534; border-color: #86efac; }
  #fin-table-head th[data-sort] { cursor: pointer; user-select: none; white-space: nowrap; }
  #fin-table-head th[data-sort]:hover { color: var(--text); }
  .fin-contact-log { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
  .fin-contact-log select, .fin-contact-log input { padding: 0.35rem 0.5rem; font-size: 0.8rem; font-family: inherit; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); }
  .fin-contact-log input[type=text] { flex: 1 1 12rem; min-width: 8rem; }
  .fin-contact-row { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.4rem 0; border-bottom: 1px solid var(--border); font-size: 0.8rem; }
  .fin-contact-row:last-child { border-bottom: none; }
  .fin-contact-when { font-weight: 600; white-space: nowrap; }
  .fin-contact-del { margin-left: auto; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.75rem; font-family: inherit; }
  .fin-contact-del:hover { color: var(--danger, #c0000a); }

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
  .resources-breadcrumb { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.85rem; font-size: 0.85rem; }
  .resources-breadcrumb a { color: var(--accent); cursor: pointer; text-decoration: none; }
  .resources-breadcrumb a:hover { text-decoration: underline; }
  .resources-breadcrumb .crumb-sep { color: var(--text-muted); }
  .resources-breadcrumb .crumb-current { font-weight: 700; }
  .folder-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 0.9rem 1.1rem; display: flex; align-items: center; gap: 0.65rem; cursor: pointer; }
  .folder-card:hover { border-color: var(--accent); }
  .folder-card-icon { font-size: 1.35rem; flex-shrink: 0; }
  .folder-card-main { flex: 1; min-width: 0; }
  .folder-card-name { font-weight: 700; font-size: 0.92rem; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .folder-card-meta { font-size: 0.75rem; color: var(--text-muted); }
  /* The star sits on both folder and resource cards, so it is styled once. */
  .fav-star { background: none; border: none; cursor: pointer; font-size: 1rem; line-height: 1; padding: 0.1rem 0.25rem; color: var(--text-muted); font-family: inherit; }
  .fav-star.is-fav { color: #f59e0b; }
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
  .projects-toolbar { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.9rem; flex-wrap: wrap; }
  /* A quiet inset track with one raised chip, rather than a solid red slab —
     the view switch should not be the loudest thing on the page. */
  .view-toggle { display: inline-flex; gap: 0.15rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; padding: 0.15rem; flex-shrink: 0; }
  .view-btn { padding: 0.36rem 0.85rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; background: transparent; border: none; border-radius: 7px; color: var(--text-muted); transition: background 0.12s, color 0.12s; font-family: inherit; }
  .view-btn:hover { color: var(--text); }
  .view-btn.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
  /* The Projects grid keeps the older solid-tab look; it is a status filter,
     not a view switch, and the two should not read as the same control. */
  .proj-status-tabs .view-btn { border-radius: 0; }
  .proj-status-tabs .view-btn.active { background: var(--accent); color: #fff; box-shadow: none; }
  .proj-filter-wrap { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
  .project-select { padding: 0.4rem 0.75rem; font-size: 0.875rem; border-radius: 7px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-family: inherit; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .project-select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.1); }
  /* One flat column: a header, a body, and a footer that share a single border
     and radius instead of three stacked boxes with competing edges. */
  .board-wrap { display: flex; gap: 0.85rem; overflow-x: auto; padding-bottom: 1rem; align-items: flex-start; }
  .board-column { flex: 0 0 300px; display: flex; flex-direction: column; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .board-col-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.6rem 0.75rem 0.5rem; }
  .board-col-title { font-weight: 700; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }
  .board-col-count { font-size: 0.68rem; font-weight: 700; color: var(--text-muted); background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 0.08rem 0.45rem; min-width: 22px; text-align: center; }
  .board-col-body { flex: 1; padding: 0 0.5rem; min-height: 120px; }
  .board-add-btn { width: 100%; padding: 0.5rem; margin: 0.15rem 0 0; background: transparent; border: none; color: var(--text-muted); font-size: 0.8rem; cursor: pointer; transition: color 0.12s, background 0.12s; font-family: inherit; }
  .board-add-btn:hover { background: var(--surface); color: var(--accent); }
  .board-empty { font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 1.25rem 0.5rem; }
  .task-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 0.5rem; cursor: grab; overflow: hidden; transition: box-shadow 0.12s, border-color 0.12s; display: flex; }
  .task-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); border-color: var(--text-muted); }
  .task-card:active { cursor: grabbing; }
  .task-card.dragging { opacity: 0.45; cursor: grabbing; }
  .board-col-body.drag-over { background: rgba(192,0,10,0.05); border-color: var(--accent); border-style: dashed; }
  /* Placeholder marking where the dragged card lands. */
  .task-drop-slot { height: 2px; background: var(--accent); border-radius: 2px; margin: 0.25rem 0 0.6rem; }
  .task-card-project-bar { width: 3px; flex-shrink: 0; }
  .task-card-body { padding: 0.65rem 0.75rem; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  /* Title and priority share the top row, like the project card's title/status row. */
  .task-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
  .task-card-title { font-weight: 600; font-size: 0.86rem; line-height: 1.35; color: var(--text); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  /* One muted line under the title carrying project, due, and counts. The card
     used to stack a badge, a 3-line description, a labelled fact per row, a
     named chip per assignee and a tag row — five blocks competing for the eye. */
  .task-card-line { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; font-size: 0.71rem; color: var(--text-muted); min-width: 0; }
  .task-card-line .task-card-sep { opacity: 0.45; }
  .task-card-proj { display: inline-flex; align-items: center; gap: 0.28rem; min-width: 0; max-width: 100%; }
  .task-card-proj-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .task-card-proj-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .task-prio { flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.1rem 0.4rem; border-radius: 5px; font-size: 0.62rem; font-weight: 700; text-transform: capitalize; white-space: nowrap; }
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
  /* Assignees are avatars only on the card — names are one click away in the
     modal, and initials fit however many people are on a task. */
  .task-assignee { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 0.56rem; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1.5px solid var(--surface); }
  .task-assignee-row { display: inline-flex; flex-shrink: 0; }
  .task-assignee-row .task-assignee + .task-assignee { margin-left: -6px; }
  .task-assignee-more { background: var(--surface2); color: var(--text-muted); }
  .task-card-foot { display: flex; align-items: center; gap: 0.4rem; }
  .task-card-foot .task-assignee-row { margin-left: auto; }
  .task-subtask-count { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; }
  .task-subtask-bar { display: flex; align-items: center; gap: 0.4rem; flex: 1; min-width: 0; }
  .task-subtask-track { flex: 1; height: 3px; border-radius: 999px; background: var(--surface2); overflow: hidden; min-width: 2rem; }
  .task-subtask-fill { height: 100%; background: var(--success); }
  .task-attach-count { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; }
  .task-tags { display: flex; gap: 0.25rem; flex-wrap: wrap; }
  .task-tag { padding: 0.12rem 0.4rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; font-size: 0.65rem; font-weight: 500; color: var(--text-muted); }
${PROJECT_CALENDAR_CSS}
${TASK_FEED_CSS}
${TASK_LIST_CSS}
${TASK_STATUS_CSS}
${MY_WORK_CSS}
${MARKET_CSS}
  /* One filter row: project picker, the shared filter bar, and an overflow
     menu holding what used to be loose buttons in the toolbar. */
  .board-tools { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 1rem; }
  .board-tools .tl-bar { margin-bottom: 0; }
  /* The global "input, select, textarea { width: 100% }" rule applies here too,
     so without an explicit width this select claims the whole row — and with
     flex-shrink:0 it never gave the space back, squeezing the filter bar to
     zero and pushing search and Filters off the clipped right edge. Sized to
     its content, allowed to shrink, floored so it stays readable. */
  .board-tools .project-select { flex: 0 1 auto; width: auto; min-width: 8rem; max-width: 15rem; }
  .tool-menu { position: relative; flex-shrink: 0; }
  #tool-menu-btn { font-size: 1rem; line-height: 1; padding: 0.4rem 0.7rem; }
  /* Lit while a view that lives in this menu is the one on screen. */
  #tool-menu-btn.tool-menu-btn-on { color: var(--accent); border-color: var(--accent); background: rgba(192,0,10,0.05); }
  .tool-menu-pop { position: absolute; left: 0; top: calc(100% + 0.3rem); z-index: 30; min-width: 13.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 0.3rem; display: flex; flex-direction: column; gap: 0.05rem; }
  .tool-menu-label { padding: 0.35rem 0.5rem 0.2rem; font-size: 0.63rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }
  .tool-menu-sep { height: 1px; background: var(--border); margin: 0.25rem 0.15rem; }
  .tool-menu-item { display: flex; align-items: center; gap: 0.4rem; width: 100%; text-align: left; padding: 0.4rem 0.5rem; font-size: 0.82rem; font-family: inherit; font-weight: 500; color: var(--text); background: none; border: none; border-radius: 6px; cursor: pointer; white-space: nowrap; }
  .tool-menu-item:hover:not(:disabled) { background: var(--surface2); }
  .tool-menu-item:disabled { opacity: 0.4; cursor: default; }
  /* Fixed-width gutter so labels line up whether or not a ✓ is showing. */
  .tool-menu-tick { display: inline-block; width: 0.85rem; flex-shrink: 0; color: var(--accent); font-weight: 800; }
  .tool-menu-item.active { color: var(--accent); }
  @media (max-width: 720px) { .board-tools { flex-wrap: wrap; } }
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
  /* The card is a link to the project's detail view, so it says so on hover. */
  .proj-card-click { cursor: pointer; transition: box-shadow 0.12s, border-color 0.12s; }
  .proj-card-click:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.09); border-color: var(--text-muted); }
  /* Project detail drawer */
  .pd-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
  .pd-swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
  .pd-desc { font-size: 0.87rem; line-height: 1.5; margin-bottom: 0.9rem; }
  .pd-progress { margin-bottom: 0.9rem; }
  .pd-progress-top { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.3rem; }
  .pd-track { height: 6px; border-radius: 999px; background: var(--surface2); overflow: hidden; }
  .pd-fill { height: 100%; background: var(--success); }
  .pd-overdue { font-size: 0.78rem; color: #b91c1c; font-weight: 600; margin-top: 0.35rem; }
  .pd-cols { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
  .pd-col { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.5rem; border: 1px solid var(--border); border-radius: 999px; font-size: 0.75rem; }
  .pd-col-dot { width: 7px; height: 7px; border-radius: 50%; }
  .pd-col-label { color: var(--text-muted); }
  .pd-col-n { font-weight: 700; }
  .pd-facts { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.82rem; margin-bottom: 0.9rem; }
  .pd-fact-label { display: inline-block; min-width: 6.5rem; color: var(--text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .pd-section-title { font-weight: 700; font-size: 0.85rem; margin: 1rem 0 0.4rem; }
  .pd-tasks { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .pd-task { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--border); font-size: 0.82rem; cursor: pointer; }
  .pd-task:last-child { border-bottom: none; }
  .pd-task:hover { background: var(--surface2); }
  .pd-task-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pd-task-done { text-decoration: line-through; color: var(--text-muted); }
  .pd-task-status { font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; }
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
        <div class="login-brand-icon">${brandLogo(44)}</div>
        <div class="login-brand-name">${BRAND_NAME}</div>
      </div>
      <p class="login-tagline">${BRAND_TAGLINE}</p>
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
      <div class="sidebar-logo-icon">${brandLogo(32)}</div>
      <div class="sidebar-logo-name">${BRAND_NAME}</div>
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
            <button class="btn btn-ghost btn-sm" id="resources-fav-btn" title="Show only my favorites">☆ Favorites</button>
          </div>
          <div style="margin-left:0.75rem;display:flex;gap:0.5rem">
            <button class="btn btn-ghost admin-only" id="add-folder-btn">+ New Folder</button>
            <button class="btn btn-primary" id="add-resource-btn">+ Add Resource</button>
          </div>
        </div>
        <div id="resources-breadcrumb" class="resources-breadcrumb"></div>
        <div id="resources-tag-filters" class="tag-filters"></div>
        <div id="resources-folder-grid" class="resources-grid" style="margin-bottom:1rem"></div>
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
        <!-- Three views in the open — the ones people use daily — and everything
             else behind ⋯. Calendar and the Projects grid are occasional views,
             so they sit in the menu and light the ⋯ button while active rather
             than taking permanent space in the segmented control. -->
        <div class="projects-toolbar">
          <div class="view-toggle">
            <button class="view-btn active" id="view-mywork-btn">My Work</button>
            <button class="view-btn" id="view-board-btn">Board</button>
            <button class="view-btn" id="view-tasklist-btn">List</button>
          </div>
          <div class="tool-menu">
            <button type="button" class="btn btn-ghost btn-sm" id="tool-menu-btn" title="More views and project actions" aria-label="More">⋯</button>
            <div class="tool-menu-pop hidden" id="tool-menu-pop">
              <div class="tool-menu-label">Views</div>
              <button type="button" class="tool-menu-item" id="view-cal-btn"><span class="tool-menu-tick"></span>Calendar</button>
              <button type="button" class="tool-menu-item" id="view-projects-btn"><span class="tool-menu-tick"></span>Projects</button>
              <div class="tool-menu-sep"></div>
              <div class="tool-menu-label">Project</div>
              <button type="button" class="tool-menu-item" id="add-project-btn">New project…</button>
              <button type="button" class="tool-menu-item" id="edit-project-btn" disabled>Edit project…</button>
              <button type="button" class="tool-menu-item" id="dup-project-btn" disabled>Duplicate project</button>
              <button type="button" class="tool-menu-item" id="board-columns-btn">Board columns…</button>
              <label class="tool-menu-item" title="Include completed and archived projects">
                <input type="checkbox" id="show-closed-projects"> Show closed projects
              </label>
            </div>
          </div>
          <div style="margin-left:auto;flex-shrink:0">
            <button class="btn btn-primary btn-sm" id="add-task-btn">+ New Task</button>
          </div>
        </div>

        <!-- One filter row, shared by every view, so a filtered view stays
             filtered when you switch how you look at it. -->
        <div class="board-tools">
          <select class="project-select" id="project-filter-sel">
            <option value="all">All Projects</option>
          </select>
          <div id="task-filter-bar" style="flex:1 1 20rem;min-width:0">${TASK_LIST_MARKUP}</div>
        </div>

        <div id="projects-mywork"></div>

        <div id="projects-tasklist" class="hidden"></div>

        <!-- Columns are per-project data, so the board is drawn from the status
             registry rather than written out here. -->
        <div id="projects-board" class="hidden"><div class="board-wrap" id="board-cols"></div></div>

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

      <!-- Agent Ranking report -->
      <div id="page-rankings-agents" class="page hidden">
        <div style="margin-bottom:0.75rem"><a href="#reports" class="report-back">← All reports</a></div>
        <div class="card" style="margin-bottom:1rem">
          <div class="flex items-center gap-2" style="flex-wrap:wrap">
            <div class="form-group" style="margin:0">
              <label>From</label>
              <select id="ranka-from-sel"></select>
            </div>
            <div class="form-group" style="margin:0">
              <label>To</label>
              <select id="ranka-to-sel"></select>
            </div>
            <div class="form-group" style="margin:0">
              <label>Market</label>
              <select id="ranka-market-sel"><option value="">All markets</option></select>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem">
              <span class="text-muted" id="ranka-refreshed-at" style="font-size:0.8rem"></span>
              <button class="btn btn-primary btn-sm" id="ranka-refresh-btn">↻ Refresh now</button>
            </div>
          </div>
        </div>
        <div class="card" style="padding:0"><div id="ranka-table"></div></div>
      </div>

      <!-- Company Ranking report -->
      <div id="page-rankings-companies" class="page hidden">
        <div style="margin-bottom:0.75rem"><a href="#reports" class="report-back">← All reports</a></div>
        <div class="card" style="margin-bottom:1rem">
          <div class="flex items-center gap-2" style="flex-wrap:wrap">
            <div class="form-group" style="margin:0">
              <label>From</label>
              <select id="rankc-from-sel"></select>
            </div>
            <div class="form-group" style="margin:0">
              <label>To</label>
              <select id="rankc-to-sel"></select>
            </div>
            <div class="form-group" style="margin:0">
              <label>Market</label>
              <select id="rankc-market-sel"><option value="">All markets</option></select>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem">
              <span class="text-muted" id="rankc-refreshed-at" style="font-size:0.8rem"></span>
              <button class="btn btn-primary btn-sm" id="rankc-refresh-btn">↻ Refresh now</button>
            </div>
          </div>
        </div>
        <div class="card" style="padding:0"><div id="rankc-table"></div></div>
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

      <!-- Reports: Sales Focus -->
      <div id="page-focus" class="page hidden">
        <div style="margin-bottom:0.75rem"><a href="#reports" class="report-back">← All reports</a></div>
        <div class="card" style="margin-bottom:1rem">
          <div class="flex items-center gap-2" style="flex-wrap:wrap">
            <div class="form-group" style="margin:0">
              <label>From</label>
              <input type="date" id="focus-from" />
            </div>
            <div class="form-group" style="margin:0">
              <label>To</label>
              <input type="date" id="focus-to" />
            </div>
            <div class="form-group" style="margin:0">
              <label>Compare with</label>
              <select id="focus-compare">
                <option value="yoy">Same period last year</option>
                <option value="previous">The period before</option>
              </select>
            </div>
            <div class="form-group" style="margin:0">
              <label>BDS</label>
              <select id="focus-bds"><option value="">Everyone</option></select>
            </div>
            <div class="form-group" style="margin:0">
              <label>Region</label>
              <select id="focus-region"><option value="">All regions</option></select>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem">
              <span class="text-muted" id="focus-refreshed-at" style="font-size:0.8rem"></span>
              <button class="btn btn-ghost btn-sm admin-only" id="focus-refresh-btn">↻ Refresh now</button>
            </div>
          </div>
          <div class="text-muted" style="font-size:0.8rem;margin-top:0.5rem" id="focus-note"></div>
        </div>
        <div class="card" style="margin-bottom:1rem;padding:0.75rem 1rem"><div id="focus-totals" class="flex items-center gap-2" style="flex-wrap:wrap"></div></div>
        <div class="card" style="padding:0"><div id="focus-table"></div></div>
      </div>

      <!-- Reports: Housing Market -->
      <div id="page-market" class="page hidden">
        <div style="margin-bottom:0.75rem"><a href="#reports" class="report-back">← All reports</a></div>
        <div class="card" style="margin-bottom:1rem">
          <div class="flex items-center gap-2" style="flex-wrap:wrap">
            <div class="form-group" style="margin:0">
              <label>Metric</label>
              <select id="market-metric"></select>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem">
              <span class="text-muted" id="market-refreshed-at" style="font-size:0.8rem"></span>
              <button class="btn btn-ghost btn-sm admin-only" id="market-refresh-btn">↻ Refresh now</button>
            </div>
          </div>
          <div class="text-muted" style="font-size:0.8rem;margin-top:0.5rem" id="market-note"></div>
        </div>
        <!-- The feed trails the calendar by a month or two, so the report says
             how old it is before it says anything else. -->
        <div class="card hidden" id="market-warning" style="margin-bottom:1rem;border-left:3px solid #d97706"></div>
        <div class="card" style="margin-bottom:1rem;padding:0.75rem 1rem"><div id="market-national" class="flex items-center gap-2" style="flex-wrap:wrap"></div></div>
        <div class="card" style="padding:0"><div id="market-table"></div></div>
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

        <!-- Territory filter. Narrows the tables, the tiles and the tier chips;
             the options are built from the ownership the server joined on. -->
        <div id="churn-bds-row" class="card churn-bds-row hidden" style="margin-bottom:1rem"></div>
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
      </div>

      <!-- Request Types: the categories offered on the public intake form -->
      <div id="page-categories" class="page hidden">
        <div class="card" style="margin-bottom:1rem">
          <div style="font-weight:700;margin-bottom:0.35rem">Request Types</div>
          <p class="text-muted" style="font-size:0.85rem;margin:0 0 1rem">
            The options a client picks from on the intake form. Add or edit them here and the form updates immediately — no redeploy.
            Each type can ask its own follow-up question and route to its own department.
            Use ↑ / ↓ to set the order clients see them in.
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
                Unpaid Spiro invoices <strong>45 or more days past due</strong>, grouped by payee and staged against
                the collections policy. Anything newer than 45 days is left out entirely — it sits before the first
                billing email, so no figure on this page counts it.
                Outstanding is what is still owed (invoice total less payments and credits). An account holding a
                partially paid invoice is flagged <strong>Review</strong>: a plan, dispute or short payment sits behind
                the balance, so read it before taking the next collections step. Assign an account to hand it to
                someone — it then shows up in their queue to work.
              </div>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem">
              <span class="text-muted" id="fin-refreshed-at" style="font-size:0.8rem"></span>
              <button class="btn btn-primary btn-sm admin-only" id="fin-refresh-btn">↻ Refresh now</button>
              <button class="btn btn-ghost btn-sm admin-only" id="fin-pd-refresh-btn" title="Re-read last-activity dates from Pipedrive">↻ Pipedrive</button>
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
          <label><input type="checkbox" id="fin-filter-payatorder" /> Pay-at-order only</label>
          <label><input type="checkbox" id="fin-filter-open" checked /> Hide resolved</label>
          <span class="text-muted" style="font-size:0.78rem;margin-left:auto" id="fin-visible-count"></span>
        </div>
        <div id="fin-board" class="fin-board"></div>
        <div class="card" id="fin-table-card" style="padding:0;display:none">
          <div class="table-wrap">
            <table>
              <!-- Sortable: click a header to sort, click again to reverse. -->
              <thead>
                <tr id="fin-table-head">
                  <th data-sort="name">Account</th>
                  <th data-sort="stage">Stage</th>
                  <th data-sort="owner">Owner</th>
                  <th data-sort="balance">Outstanding</th>
                  <th data-sort="invoices">Invoices</th>
                  <th data-sort="oldest">Oldest Past Due</th>
                  <th data-sort="bucket">Aging</th>
                  <th data-sort="contact">Last Contact</th>
                  <th data-sort="next">Next Contact</th>
                  <th data-sort="action">Next Action</th>
                </tr>
              </thead>
              <tbody id="fin-table-body">
                <tr><td colspan="10" class="empty-state">Loading...</td></tr>
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
      <iframe id="admin-chat-frame" title="${BRAND_NAME} Chat" allow="microphone"></iframe>
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
      <div class="form-group">
        <label>Folder</label>
        <select id="resource-folder"><option value="">📚 All resources (no folder)</option></select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="resource-modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="resource-modal-submit">Add Resource</button>
      </div>
    </form>
  </div>
</div>

<!-- Folder Modal: create, rename or move a resource folder. -->
<div id="folder-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:460px">
    <div class="modal-title" id="folder-modal-title">New Folder</div>
    <div id="folder-modal-error" class="alert alert-error hidden"></div>
    <form id="folder-modal-form">
      <input type="hidden" id="folder-modal-id">
      <div class="form-group">
        <label>Name</label>
        <input id="folder-name" required placeholder="e.g. Sales Playbooks">
      </div>
      <div class="form-group">
        <label>Description <span style="font-weight:400;text-transform:none">(optional)</span></label>
        <textarea id="folder-desc" rows="2" style="resize:vertical" placeholder="What lives in here…"></textarea>
      </div>
      <div class="form-group">
        <label>Parent folder</label>
        <select id="folder-parent"><option value="">📚 All resources (top level)</option></select>
      </div>
      <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:1rem">
        <div class="toggle-row" style="padding:0.75rem 1rem">
          <div>
            <div class="toggle-label">👥 User Access</div>
            <div class="toggle-sublabel">Show this folder in the user portal</div>
          </div>
          <label class="toggle"><input type="checkbox" id="folder-user-access"><span class="toggle-slider"></span></label>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="folder-modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="folder-modal-submit">Create Folder</button>
      </div>
    </form>
  </div>
</div>

<!-- Task Modal -->
<!-- Project detail: everything about one project in one place, opened by
     clicking its card. Read-only; the buttons hand off to the existing
     board / edit / duplicate flows rather than duplicating them. -->
<div id="proj-detail-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:680px;overflow-y:auto;max-height:calc(100dvh - 48px)">
    <div class="flex items-center" style="justify-content:space-between;gap:1rem">
      <div class="modal-title" id="proj-detail-title" style="margin:0">Project</div>
      <button type="button" class="btn btn-ghost btn-sm" id="proj-detail-close">✕</button>
    </div>
    <div id="proj-detail-body" style="margin-top:0.75rem"></div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:1.25rem">
      <button type="button" class="btn btn-primary btn-sm" id="proj-detail-board">Open on board</button>
      <button type="button" class="btn btn-ghost btn-sm" id="proj-detail-edit">Edit</button>
      <button type="button" class="btn btn-ghost btn-sm" id="proj-detail-dup">Duplicate</button>
    </div>
  </div>
</div>

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
        <label>Assigned To</label>
        <select id="task-assignee"></select>
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

<!-- Outreach scripts manager. Admin-only: the wording is collections policy. -->
<div id="scripts-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:760px;overflow-y:auto;max-height:calc(100dvh - 48px)">
    <div class="modal-title">Outreach Scripts</div>
    <div class="text-muted" style="font-size:0.8rem;margin-bottom:0.75rem">
      Text a collector can pick on an account. Merge fields are filled in from that account when the script is used.
    </div>
    <div id="scripts-list" style="margin-bottom:1rem"></div>
    <div style="font-weight:700;margin-bottom:0.5rem" id="script-form-title">New script</div>
    <form id="script-form">
      <input type="hidden" id="script-id" />
      <div class="fin-contact-log">
        <input type="text" id="script-title" placeholder="Name, e.g. First reminder call" style="flex:1 1 14rem" />
        <select id="script-kind"></select>
        <label class="tool-menu-item" style="padding:0"><input type="checkbox" id="script-active" checked /> Active</label>
      </div>
      <input type="text" id="script-subject" placeholder="Email subject" class="hidden" style="width:100%;margin-bottom:0.4rem" />
      <textarea id="script-body" rows="7" placeholder="Hi {{account}}, our records show {{balance}} outstanding…" style="width:100%;resize:vertical;font-family:inherit"></textarea>
      <div class="text-muted" style="font-size:0.75rem;margin:0.4rem 0">
        Merge fields — click to insert: <span id="script-fields"></span>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost btn-sm hidden" id="script-cancel-edit">Cancel edit</button>
        <div style="flex:1"></div>
        <button type="button" class="btn btn-ghost" id="scripts-close">Close</button>
        <button type="submit" class="btn btn-primary" id="script-save">Save script</button>
      </div>
    </form>
  </div>
</div>

<!-- Board Columns Modal. Edits the selected project's columns, or the default
     set every uncustomised board shares when no project is selected. -->
<div id="columns-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:640px">
    <div class="modal-title" id="columns-modal-title">Board Columns</div>
    <div class="col-editor-note" id="columns-note"></div>
    <div id="columns-list" class="col-editor"></div>
    <div class="col-editor-actions">
      <button type="button" class="btn btn-ghost btn-sm" id="columns-add">+ Add Column</button>
      <div style="flex:1"></div>
      <button type="button" class="btn btn-ghost btn-sm hidden" id="columns-reset">Reset to Default</button>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="columns-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="columns-save">Save Columns</button>
    </div>
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
    <div id="fin-pao-banner" class="fin-pao-banner hidden"></div>
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
    <div style="font-weight:700;margin-bottom:0.5rem">Outreach script</div>
    <div class="fin-contact-log">
      <select id="fin-script-select" style="flex:1 1 14rem"><option value="">Pick a script…</option></select>
      <button type="button" class="btn btn-ghost btn-sm" id="fin-script-copy" disabled>Copy</button>
      <button type="button" class="btn btn-ghost btn-sm admin-only" id="fin-script-manage">Manage scripts</button>
    </div>
    <div id="fin-script-out" class="hidden" style="margin-bottom:1.25rem">
      <div id="fin-script-warn" class="alert alert-error hidden" style="margin-bottom:0.4rem"></div>
      <div id="fin-script-subject" class="hidden" style="font-weight:600;font-size:0.85rem;margin-bottom:0.3rem"></div>
      <textarea id="fin-script-body" rows="8" style="width:100%;resize:vertical;font-family:inherit;font-size:0.85rem"></textarea>
    </div>

    <div style="font-weight:700;margin-bottom:0.5rem">Contact log</div>
    <div class="text-muted" style="font-size:0.78rem;margin-bottom:0.5rem" id="fin-contact-hint"></div>
    <form id="fin-contact-form" class="fin-contact-log">
      <select id="fin-contact-channel" title="How you reached them"></select>
      <input type="date" id="fin-contact-date" title="When (defaults to today)" />
      <input type="text" id="fin-contact-note" placeholder="What came of it (optional)" autocomplete="off" />
      <button type="submit" class="btn btn-primary btn-sm">Log contact</button>
    </form>
    <div id="fin-contact-list" style="margin-bottom:1.25rem"></div>

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
    <div id="ticket-modal-files" style="margin-bottom:1.25rem"></div>
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
          <label>Routes to department <span style="color:#dc2626">*</span></label>
          <select id="cat-department" required></select>
          <div class="text-muted" style="font-size:0.78rem;margin-top:0.25rem">Where tickets of this type land, and which address they email.</div>
        </div>
      </div>

      <div class="form-group">
        <label>Follow-up question</label>
        <select id="cat-extra-field">
          <option value="none">No follow-up question</option>
          <option value="select">Ask them to pick from a list</option>
          <option value="multiselect">Let them pick several (adds up a total)</option>
          <option value="text">Ask them to type an answer</option>
        </select>
      </div>
      <div class="form-group hidden" id="cat-extra-label-group">
        <label>Question text</label>
        <input type="text" id="cat-extra-label" autocomplete="off" placeholder="e.g. Which media?" />
      </div>
      <div class="form-group hidden" id="cat-extra-options-group">
        <label>Choices</label>
        <div class="text-muted" style="font-size:0.75rem;margin:0 0 0.5rem">
          Each choice can carry a thumbnail and a price (in dollars). The box after the price is how
          that price reads on the form — leave it blank for "each", or type <b>per image</b>,
          <b>per room</b>, <b>per 1,000 sq ft</b> and the client sees "$50 per image". Set "Max qty"
          above 1 to let a client order several — the form shows a quantity picker and multiplies the
          price. Add follow-up questions to ask for specifics only when that choice is picked.
        </div>
        <div id="cat-choices"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="cat-choice-add" style="margin-top:0.5rem">+ Add choice</button>
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
    'rankings-agents': { el: 'page-rankings-agents', title: 'Agent Ranking', adminOnly: false, superAdminOnly: false, report: 'rankings-agents' },
    'rankings-companies': { el: 'page-rankings-companies', title: 'Company Ranking', adminOnly: false, superAdminOnly: false, report: 'rankings-companies' },
    photographers: { el: 'page-photographers', title: 'Photographers', adminOnly: false, superAdminOnly: false, report: 'photographers' },
    focus: { el: 'page-focus', title: 'Sales Focus', adminOnly: false, superAdminOnly: false, report: 'focus' },
    market: { el: 'page-market', title: 'Housing Market', adminOnly: false, superAdminOnly: false, report: 'market' },
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

  /**
   * Split the hash into a page and its query, so a link can name a page *and*
   * something on it — '#projects?task=<id>' is what the mention emails send.
   */
  function parseHash() {
    const raw = location.hash.replace(/^#/, '');
    const q = raw.indexOf('?');
    if (q === -1) return { page: raw, params: {} };
    const params = {};
    new URLSearchParams(raw.slice(q + 1)).forEach(function(v, k) { params[k] = v; });
    return { page: raw.slice(0, q), params: params };
  }

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
    if (page === 'report-cancellations' || page === 'rankings-agents' || page === 'rankings-companies' || page === 'photographers' || page === 'pipedrive-cleanup' || page === 'churn' || page === 'market') navKey = 'reports';
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
    // '#projects?task=<id>' opens that task once the board has loaded — the
    // link mention and assignment emails send.
    if (page === 'projects') {
      const wanted = parseHash().params.task;
      loadProjects().then(function() {
        if (!wanted) return;
        // A task that was deleted, or that this account cannot see, is not in
        // the list — say so rather than opening nothing and looking broken.
        if (allTasks.some(function(t) { return t.id === wanted; })) openEditTask(wanted);
        else alert('That task no longer exists, or you do not have access to it.');
      });
    }
    if (page === 'reports') loadReportsHome();
    if (page === 'report-cancellations') loadReports();
    if (page === 'rankings-agents') loadRankingsAgents();
    if (page === 'rankings-companies') loadRankingsCompanies();
    if (page === 'photographers') loadPhotographers();
    if (page === 'focus') loadFocus();
    if (page === 'market') loadMarket();
    if (page === 'pipedrive-cleanup') loadPipedriveCleanup();
    if (page === 'churn') loadChurn();
    if (page === 'tickets') loadTickets();
    if (page === 'departments') loadDepartments();
    if (page === 'categories') loadCategories();
    if (page === 'form-preview') loadFormPreview();
    if (page === 'financials' || page === 'past-due') loadFinancials();
    if (page === 'cleveland') loadCleveland();
    // Only rewrite the hash when it names a different page — overwriting
    // '#projects?task=<id>' with '#projects' would fire another hashchange and
    // drop the target before the page had a chance to open it.
    if (parseHash().page !== page) location.hash = '#' + page;
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
    const requested = parseHash().page;
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
  // null is the library root. Search and the favorites view ignore this and
  // look across every folder, since narrowing defeats the purpose of both.
  let resourceFolderId = null;
  let resourceFavoritesOnly = false;
  let folderDataMap = {};

  /** True while the view is a cross-folder one, so folders are not listed. */
  function resourcesSearching() {
    return !!document.getElementById('resources-search').value.trim()
      || resourceActiveTags.size > 0
      || resourceFavoritesOnly;
  }

  function favStarHtml(type, id, isFav) {
    return '<button class="fav-star' + (isFav ? ' is-fav' : '') + '"'
      + ' title="' + (isFav ? 'Remove from favorites' : 'Add to favorites') + '"'
      + ' onclick="toggleFavorite(event, \\'' + esc(type) + '\\', \\'' + esc(id) + '\\')">'
      + (isFav ? '★' : '☆') + '</button>';
  }

  window.toggleFavorite = async function(ev, itemType, itemId) {
    // The star sits inside a clickable folder card; starring must not navigate.
    ev.stopPropagation();
    const map = itemType === 'folder' ? folderDataMap : resourceDataMap;
    const item = map[itemId];
    if (!item) return;
    const next = !item.favorite;
    const r = await api('PUT', '/resources/favorites', { itemType, itemId, favorite: next });
    if (!r.ok) { alert(r.data.error || 'Could not update favorites.'); return; }
    item.favorite = next;
    loadResources();
  };

  function renderBreadcrumb(breadcrumb) {
    const el = document.getElementById('resources-breadcrumb');
    if (resourcesSearching()) {
      el.innerHTML = '<span class="text-muted">Searching the whole library</span>';
      return;
    }
    const parts = ['<a onclick="openFolder(null)">📚 All resources</a>'];
    (breadcrumb || []).forEach(function(f, i) {
      const last = i === breadcrumb.length - 1;
      parts.push('<span class="crumb-sep">/</span>');
      parts.push(last
        ? '<span class="crumb-current">' + esc(f.name) + '</span>'
        : '<a onclick="openFolder(\\'' + esc(f.id) + '\\')">' + esc(f.name) + '</a>');
    });
    el.innerHTML = parts.join(' ');
  }

  window.openFolder = function(id) {
    resourceFolderId = id;
    loadResources();
  };

  function renderFolderCards(folders) {
    const grid = document.getElementById('resources-folder-grid');
    folderDataMap = {};
    for (const f of folders) folderDataMap[f.id] = f;
    if (resourcesSearching() || !folders.length) { grid.innerHTML = ''; return; }
    grid.innerHTML = folders.map(function(f) {
      const counts = [];
      if (f.folderCount) counts.push(f.folderCount + (f.folderCount === 1 ? ' folder' : ' folders'));
      if (f.resourceCount) counts.push(f.resourceCount + (f.resourceCount === 1 ? ' item' : ' items'));
      const admin = isAdmin()
        ? '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openEditFolder(\\'' + esc(f.id) + '\\')">Edit</button>'
          + '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteFolder(\\'' + esc(f.id) + '\\',\\'' + esc(f.name) + '\\')">Delete</button>'
        : '';
      return '<div class="folder-card" onclick="openFolder(\\'' + esc(f.id) + '\\')">'
        + '<span class="folder-card-icon">📁</span>'
        + '<div class="folder-card-main">'
          + '<div class="folder-card-name">' + esc(f.name) + '</div>'
          + '<div class="folder-card-meta">' + (counts.join(' · ') || 'Empty') + '</div>'
        + '</div>'
        + favStarHtml('folder', f.id, !!f.favorite)
        + admin
      + '</div>';
    }).join('');
  }

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
      // An empty folder is a different situation from an empty search, and
      // saying "no resources found" in a folder you just made reads as a bug.
      const msg = resourceFavoritesOnly ? 'Nothing favorited yet. Tap a ☆ to add something here.'
        : resourcesSearching() ? 'No resources found.'
        : document.getElementById('resources-folder-grid').innerHTML ? 'No resources directly in this folder.'
        : 'No resources yet.';
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' + msg + '</div>';
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
              \${favStarHtml('resource', r.id, !!r.favorite)}
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
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (tags) params.set('tags', tags);
    if (resourceFavoritesOnly) params.set('favorites', '1');
    if (resourceFolderId) params.set('folder', resourceFolderId);
    const qs = params.toString();
    const r = await api('GET', '/resources' + (qs ? '?' + qs : ''));
    if (!r.ok) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Failed to load resources.</div>'; return; }
    // The server decides which folder was actually served, so a stale id from a
    // deleted folder falls back to the root rather than showing an empty page.
    resourceFolderId = r.data.folderId ?? null;
    renderBreadcrumb(r.data.breadcrumb);
    renderFolderCards(r.data.folders || []);
    renderResourceCards(r.data.resources, r.data.allTags);
    const favBtn = document.getElementById('resources-fav-btn');
    favBtn.textContent = (resourceFavoritesOnly ? '★' : '☆') + ' Favorites';
    favBtn.classList.toggle('btn-primary', resourceFavoritesOnly);
  }

  document.getElementById('resources-fav-btn').addEventListener('click', () => {
    resourceFavoritesOnly = !resourceFavoritesOnly;
    loadResources();
  });

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
    // New resources land in the folder the user is currently looking at.
    loadFolderOptions('resource-folder', resourceFolderId);
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
    loadFolderOptions('resource-folder', r.folderId);
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
    const folderId = document.getElementById('resource-folder').value || null;
    const tags = [...resourceModalTags];
    // Add any unsaved tag still in input
    const pendingTag = document.getElementById('tag-input').value.trim().replace(/,/g, '');
    if (pendingTag && !tags.includes(pendingTag)) tags.push(pendingTag);

    let r;
    if (id) {
      // Edit
      const body = { title, description, tags, aiAccess, userAccess, folderId };
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
        r = await api('POST', '/resources', { type: 'link', title, description, url, tags, aiAccess, userAccess, folderId });
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
          folderId,
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

  // ── Resource folders ──────────────────────────────────────────────────────
  let folderEditId = null;
  let folderTree = [];

  /**
   * Every folder as indented options, so a nested tree is pickable from a plain
   * select. excludeSubtreeOf drops a folder and its descendants — the server
   * refuses to move a folder inside itself, and the picker should not offer it.
   */
  async function loadFolderOptions(selectId, selectedId, excludeSubtreeOf) {
    const r = await api('GET', '/resources/folders');
    folderTree = r.ok ? (r.data.folders || []) : [];
    const childrenOf = {};
    for (const f of folderTree) {
      const key = f.parentId || '';
      (childrenOf[key] = childrenOf[key] || []).push(f);
    }
    const excluded = new Set();
    if (excludeSubtreeOf) {
      const queue = [excludeSubtreeOf];
      while (queue.length) {
        const id = queue.pop();
        if (excluded.has(id)) continue;
        excluded.add(id);
        for (const child of childrenOf[id] || []) queue.push(child.id);
      }
    }
    const options = [];
    (function walk(parentKey, depth) {
      for (const f of childrenOf[parentKey] || []) {
        if (excluded.has(f.id)) continue;
        options.push('<option value="' + esc(f.id) + '">'
          + '&nbsp;'.repeat(depth * 4) + esc(f.name) + '</option>');
        walk(f.id, depth + 1);
      }
    })('', 0);
    const sel = document.getElementById(selectId);
    sel.innerHTML = sel.options[0].outerHTML + options.join('');
    sel.value = selectedId || '';
  }

  function openFolderModal(opts) {
    folderEditId = opts.id || null;
    document.getElementById('folder-modal-title').textContent = folderEditId ? 'Edit Folder' : 'New Folder';
    document.getElementById('folder-modal-id').value = folderEditId || '';
    document.getElementById('folder-name').value = opts.name || '';
    document.getElementById('folder-desc').value = opts.description || '';
    document.getElementById('folder-user-access').checked = !!opts.userAccess;
    document.getElementById('folder-modal-submit').textContent = folderEditId ? 'Save Changes' : 'Create Folder';
    document.getElementById('folder-modal-error').classList.add('hidden');
    loadFolderOptions('folder-parent', opts.parentId, folderEditId);
    document.getElementById('folder-modal').classList.remove('hidden');
  }

  window.openEditFolder = function(id) {
    const f = folderDataMap[id];
    if (!f) return;
    openFolderModal(f);
  };

  window.deleteFolder = async function(id, name) {
    if (!confirm('Delete the folder "' + name + '"?\\n\\nAnything inside it moves up a level — nothing is deleted with it.')) return;
    const r = await api('DELETE', '/resources/folders/' + id);
    if (!r.ok) { alert(r.data.error || 'Could not delete the folder.'); return; }
    loadResources();
  };

  document.getElementById('add-folder-btn').addEventListener('click', () => {
    // A new folder defaults to being made where the user is standing.
    openFolderModal({ parentId: resourceFolderId });
  });
  document.getElementById('folder-modal-cancel').addEventListener('click', () => {
    document.getElementById('folder-modal').classList.add('hidden');
  });

  document.getElementById('folder-modal-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('folder-modal-error');
    errEl.classList.add('hidden');
    const submitBtn = document.getElementById('folder-modal-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
    const body = {
      name: document.getElementById('folder-name').value.trim(),
      description: document.getElementById('folder-desc').value.trim() || null,
      parentId: document.getElementById('folder-parent').value || null,
      userAccess: document.getElementById('folder-user-access').checked,
    };
    const r = folderEditId
      ? await api('PUT', '/resources/folders/' + folderEditId, body)
      : await api('POST', '/resources/folders', body);
    submitBtn.disabled = false;
    submitBtn.textContent = folderEditId ? 'Save Changes' : 'Create Folder';
    if (!r.ok) {
      errEl.textContent = r.data.error || 'An error occurred.';
      errEl.classList.remove('hidden');
      return;
    }
    document.getElementById('folder-modal').classList.add('hidden');
    loadResources();
  });

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
${MY_WORK_COMPONENT_JS}
${MARKET_COMPONENT_JS}
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
    { key: 'rankings-agents', icon: '🧑‍💼', title: 'Agent Ranking', desc: 'Agents ranked by order volume, with cancellation and reschedule rates, VIP and top-20% badges.' },
    { key: 'rankings-companies', icon: '🏢', title: 'Company Ranking', desc: 'Brokerages ranked by order volume, with cancellation and reschedule rates.' },
    { key: 'photographers', icon: '📸', title: 'Photographers', desc: 'Roster with the markets each serves and how many shoots they completed in a selectable range.' },
    { key: 'pipedrive-cleanup', icon: '🧹', title: 'Pipedrive Cleanup', desc: 'Suggested CRM fixes to verify. Approved items become a worklist for whoever you grant access.' },
    { key: 'focus', icon: '🎯', title: 'Sales Focus', desc: 'Each BDS\\'s clients ranked by shoots and revenue over a period, with growth on the same period last year and when they were last contacted.' },
    { key: 'churn', icon: '📊', title: 'Churn & Retention', desc: 'Revenue retention, Pareto/NBD health, and a priority-ranked outreach queue of recoverable agents.' },
    { key: 'market', icon: '🏘️', title: 'Housing Market', desc: 'Sales, listings, prices and days on market for each region we serve, measured against the national market so a soft patch can be told from lost share.' },
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
  // bds: '' for everyone, a BDS name to narrow to one book, or '__none' for the
  // clients no territory rule reached — the ones nobody is calling.
  var churnState = { report: null, dismissed: {}, notes: {}, showHidden: false, refresh: null, bds: '' };
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
  // The BDS filter narrows everything the page derives from the snapshot — the
  // tables, the tiles and the tier chips — because a BDS looking at their own
  // book wants their revenue at risk, not the company's. The headline retention
  // rates are the exception: GRR/NRR come out of the engine whole and cannot be
  // recomputed for a subset here.
  function churnInScope(row){
    if (!churnState.bds) return true;
    if (churnState.bds === '__none') return !row.bds;
    return String(row.bds || '') === churnState.bds;
  }
  function churnScoped(rows){ return (rows || []).filter(churnInScope); }
  function churnKept(rows){ return churnScoped(rows).filter(function(r){ return !churnIsHidden(r); }); }
  // What a table shows: the cleaned list, plus the hidden rows while the viewer
  // has "Show hidden" on so they can restore them in place.
  function churnRowsFor(rows){ return churnState.showHidden ? churnScoped(rows) : churnKept(rows); }
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
  // Territory columns, joined on server-side from the Focus caches. They sort and
  // export as plain text; an empty cell means the Focus sweep has not seen this
  // agent, which is a different thing from "nobody owns them".
  var CHURN_REGION_COL = { key:'region', label:'Region', value:function(r){ return r.region || ''; }, render:function(r){ return r.region ? esc(String(r.region)) : '<span class="text-muted">—</span>'; } };
  var CHURN_BDS_COL = { key:'bds', label:'BDS', value:function(r){ return r.bds || ''; }, render:function(r){ return r.bds ? esc(String(r.bds)) : '<span class="text-muted">—</span>'; } };
  function churnQueueCols(){
    return [
      { key:'agent', label:'Agent', value:function(r){ return r.agent_name; }, render:churnAgentCell },
      { key:'company', label:'Brokerage', value:function(r){ return r.company_name; } },
      CHURN_REGION_COL,
      CHURN_BDS_COL,
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
      CHURN_REGION_COL,
      CHURN_BDS_COL,
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
    var bds = document.getElementById('churn-bds-row');
    if (bds) { bds.innerHTML = ''; bds.className = 'card churn-bds-row hidden'; }
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
  // The BDS picker. Options are whoever actually owns someone in this snapshot,
  // so an empty Focus cache leaves the row hidden rather than offering a filter
  // that would match nobody. Rebuilt on every apply, so the select is written
  // from churnState rather than reading its own DOM value back.
  function churnRenderBdsRow(){
    var el = document.getElementById('churn-bds-row');
    var rep = churnState.report;
    if (!el) return;
    if (!rep) { el.className = 'card churn-bds-row hidden'; el.innerHTML = ''; return; }
    var rows = rep.agent_scores || [];
    var names = {}, unowned = 0;
    rows.forEach(function(r){ if (r.bds) names[r.bds] = (names[r.bds] || 0) + 1; else unowned++; });
    var list = Object.keys(names).sort();
    // A refresh can retire the selected owner (they own nobody in the new
    // snapshot). Fall back to everyone rather than showing an empty table under
    // a select that says "All".
    if (churnState.bds && churnState.bds !== '__none' && list.indexOf(churnState.bds) === -1) churnState.bds = '';
    if (churnState.bds === '__none' && !unowned) churnState.bds = '';
    if (!list.length) {
      // Nothing joined: say why, since two blank columns otherwise read as a bug.
      el.className = 'card churn-bds-row';
      el.innerHTML = '<span class="text-muted">Territory is unknown for every agent — refresh the Sales Focus report to sweep brokerage service areas, then reload.</span>';
      return;
    }
    el.className = 'card churn-bds-row';
    var opts = '<option value="">All BDS (' + churnNum(rows.length) + ' agents)</option>'
      + list.map(function(n){
          return '<option value="' + esc(n) + '"' + (churnState.bds === n ? ' selected' : '') + '>' + esc(n) + ' (' + churnNum(names[n]) + ')</option>';
        }).join('')
      + (unowned ? '<option value="__none"' + (churnState.bds === '__none' ? ' selected' : '') + '>No owner (' + churnNum(unowned) + ')</option>' : '');
    el.innerHTML = '<label for="churn-bds-sel">BDS</label>'
      + '<select id="churn-bds-sel">' + opts + '</select>'
      + '<span class="text-muted">Columbus and Dayton are each split at their own top 20% by revenue over this window — that slice is Chris Voge\\'s, the rest Ryan Bowersock\\'s.</span>';
    var sel = document.getElementById('churn-bds-sel');
    if (sel) sel.addEventListener('change', function(){ churnState.bds = sel.value; churnApply(); });
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
      + ' · seasonal adjust '+(rep.seasonal_adjust ? 'on' : 'off')+(hiddenCount ? ' · '+churnNum(hiddenCount)+' hidden' : '')
      // The counts above describe the whole snapshot; the tiles and tables below
      // follow the filter. Say so, or the two read as contradicting each other.
      + (churnState.bds ? ' · <b>tiles and tables below show '+esc(churnState.bds === '__none' ? 'agents with no owner' : churnState.bds + ' only')+'</b>' : '')+'</div></div>'
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

    churnRenderBdsRow();
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

  // ── Agent badges ───────────────────────────────────────────────────────────
  // VIP comes from Spiro; Top 20% is the stored trailing-12-month cut within the
  // agent's own region. Both live here so every table that shows an agent —
  // Sales Focus, Agent Ranking, anything added later — badges them identically.

  /** The badges an agent row carries, in the order they should read. */
  function agentBadgeList(r) {
    var out = [];
    if (r.vip) out.push('VIP');
    if (r.topPercent) out.push('Top 20%');
    return out;
  }

  /** Sort weight, so a badge column is worth clicking rather than decoration. */
  function agentBadgeRank(r) {
    return (r.vip ? 2 : 0) + (r.topPercent ? 1 : 0);
  }

  function agentBadgesHtml(r) {
    var region = r.region ? ' in ' + r.region : '';
    return agentBadgeList(r).map(function(t){
      var vip = t === 'VIP';
      var title = vip ? 'Marked VIP in Spiro' : 'Top 20% by revenue over the last 12 months' + region;
      return '<span class="focus-tag focus-tag-' + (vip ? 'vip' : 'top') + '" title="' + esc(title) + '">' + esc(t) + '</span>';
    }).join('') || '<span class="text-muted">—</span>';
  }

  function agentBadgeColumn() {
    return { key: 'tags', label: 'Tags', type: 'num',
      value: agentBadgeRank,
      csv: function(r){ return agentBadgeList(r).join(' '); },
      render: agentBadgesHtml };
  }

  // ── Rankings (agent and company order volume, one report each) ─────────────
  // Both pages read the same cached orders and the same date/market controls,
  // so one factory wires each page from its element-id prefix.
  function createRankingsPage(opts) {
    var p = opts.prefix;
    var el = function(suffix){ return document.getElementById(p + '-' + suffix); };
    var table = null;

    function populateMonths() {
      const fromSel = el('from-sel');
      const toSel = el('to-sel');
      if (fromSel.options.length) return;
      const options = reportMonths.map(m => \`<option value="\${m}">\${monthLabel(m)}</option>\`).join('');
      fromSel.innerHTML = options;
      toSel.innerHTML = options;
      fromSel.value = reportMonths[0];
      toSel.value = reportMonths[reportMonths.length - 1];
    }

    async function loadMarkets() {
      const r = await api('GET', '/reports/agent-cancellations/markets?from=' + el('from-sel').value + '&to=' + el('to-sel').value);
      const sel = el('market-sel');
      const current = sel.value;
      const markets = r.ok ? (r.data.markets || []) : [];
      sel.innerHTML = '<option value="">All markets</option>' + markets.map(m => \`<option value="\${esc(m)}">\${esc(m)}</option>\`).join('');
      if (markets.includes(current)) sel.value = current;
    }

    async function loadStatus() {
      const r = await api('GET', '/reports/agent-cancellations/status');
      const target = el('refreshed-at');
      if (!r.ok) { target.textContent = ''; return; }
      const statuses = (r.data.status || []).filter(s => s.refreshedAt);
      if (statuses.length === 0) { target.textContent = 'Never refreshed'; return; }
      const latest = statuses.reduce((a, b) => (b.refreshedAt > a.refreshedAt ? b : a));
      target.textContent = 'Last refreshed: ' + new Date(latest.refreshedAt).toLocaleString();
    }

    async function loadTable() {
      const qs = new URLSearchParams({ from: el('from-sel').value, to: el('to-sel').value });
      const market = el('market-sel').value;
      if (market) qs.set('market', market);
      if (!table) table = createReportTable({ containerId: p + '-table', reportKey: opts.reportKey, emptyMsg: opts.emptyMsg, columns: opts.columns() });
      const r = await api('GET', '/reports/' + opts.reportKey + '?' + qs.toString());
      if (!r.ok) { table.setError(); return; }
      table.setData(r.data.report.rows);
    }

    async function load() {
      if (reportMonths.length === 0) {
        reportMonths = Array.from({ length: 12 }, (_, i) => {
          const d = new Date();
          d.setUTCDate(1);
          d.setUTCMonth(d.getUTCMonth() - (11 - i));
          return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
        });
      }
      populateMonths();
      await loadMarkets();
      await Promise.all([loadTable(), loadStatus()]);
    }

    el('from-sel').addEventListener('change', () => { loadMarkets(); loadTable(); });
    el('to-sel').addEventListener('change', () => { loadMarkets(); loadTable(); });
    el('market-sel').addEventListener('change', loadTable);
    // Both reports share one order cache, so either page's button refreshes it.
    el('refresh-btn').addEventListener('click', async () => {
      const btn = el('refresh-btn');
      btn.disabled = true;
      btn.textContent = 'Refreshing…';
      const r = await api('POST', '/reports/agent-cancellations/refresh', { from: el('from-sel').value, to: el('to-sel').value });
      btn.disabled = false;
      btn.innerHTML = '↻ Refresh now';
      if (!r.ok) { alert(r.data.error || 'Refresh failed.'); return; }
      await loadMarkets();
      await Promise.all([loadTable(), loadStatus()]);
    });

    return { load: load };
  }

  function rankCols(nameLabel, extra) {
    return [
      { key: 'rank', label: '#', type: 'num', value: function(r){ return r.rank; } },
      { key: 'name', label: nameLabel, value: function(r){ return r.name; } }
    ].concat(extra || []).concat([
      { key: 'totalOrders', label: 'Orders', type: 'num', value: function(r){ return r.totalOrders; } },
      { key: 'cancellations', label: 'Cancellations', type: 'num', value: function(r){ return r.cancellations; } },
      { key: 'reschedules', label: 'Reschedules', type: 'num', value: function(r){ return r.reschedules; } },
      { key: 'pct', label: '% Canc./Resch.', type: 'num', value: function(r){ return Number(r.cancelledOrRescheduledPct.toFixed(1)); }, render: function(r){ return r.cancelledOrRescheduledPct.toFixed(1) + '%'; } }
    ]);
  }

  var rankingsAgentsPage = createRankingsPage({
    prefix: 'ranka',
    reportKey: 'rankings-agents',
    emptyMsg: 'No orders cached for this range yet. Try Refresh now.',
    columns: function(){ return rankCols('Agent', [agentBadgeColumn()]); }
  });
  var rankingsCompaniesPage = createRankingsPage({
    prefix: 'rankc',
    reportKey: 'rankings-companies',
    emptyMsg: 'No company data yet — click Refresh now to pull it.',
    columns: function(){ return rankCols('Company'); }
  });
  function loadRankingsAgents() { return rankingsAgentsPage.load(); }
  function loadRankingsCompanies() { return rankingsCompaniesPage.load(); }

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

  // ── Sales Focus report ──────────────────────────────────────────────────────
  // One row per client. Ranked by revenue by default, but every column sorts —
  // a BDS chasing volume and one chasing spend want different orders.
  var focusTable = null;

  function focusPct(v) {
    if (v === null || v === undefined) return '—';
    var sign = v > 0 ? '+' : '';
    return sign + v.toFixed(1) + '%';
  }

  function focusCols() {
    return [
      { key: 'agent', label: 'Client', value: function(r){ return r.agentName; } },
      // Same badge column as the Agent Ranking report, from the same helpers, so
      // the two reports can never disagree about who is a VIP.
      agentBadgeColumn(),
      { key: 'company', label: 'Brokerage', value: function(r){ return r.companyName || '—'; } },
      { key: 'region', label: 'Region', value: function(r){ return r.region; } },
      { key: 'bds', label: 'BDS', value: function(r){ return r.bds || 'Unassigned'; } },
      { key: 'shoots', label: '# Shoots', type: 'num', value: function(r){ return r.shoots; } },
      { key: 'revenue', label: 'Revenue', type: 'num', value: function(r){ return r.revenue; },
        render: function(r){ return money(r.revenue); } },
      { key: 'priorRevenue', label: 'Prior Revenue', type: 'num', value: function(r){ return r.priorRevenue; },
        render: function(r){ return money(r.priorRevenue); } },
      // Growth is the column this report exists for, so it is coloured.
      { key: 'growth', label: 'Growth', type: 'num',
        value: function(r){ return r.growthPct === null ? -Infinity : r.growthPct; },
        // The sort sentinel must not reach a spreadsheet as "-Infinity".
        csv: function(r){ return r.growthPct === null ? 'New' : r.growthPct; },
        render: function(r){
          if (r.growthPct === null) return '<span class="text-muted" title="No revenue in the comparison period">New</span>';
          var cls = r.growthPct > 0 ? 'focus-up' : r.growthPct < 0 ? 'focus-down' : '';
          return '<span class="' + cls + '">' + esc(focusPct(r.growthPct)) + '</span>';
        } },
      { key: 'lastContact', label: 'Days Since Contact', type: 'num',
        // Never-contacted sorts as the most urgent rather than as "0 days ago".
        value: function(r){ return r.daysSinceContact === null ? Number.MAX_SAFE_INTEGER : r.daysSinceContact; },
        csv: function(r){ return r.daysSinceContact === null ? 'Never' : r.daysSinceContact; },
        render: function(r){
          if (r.daysSinceContact === null) return '<span class="fin-contact-never">Never</span>';
          var d = r.daysSinceContact;
          var label = d === 0 ? 'Today' : d === 1 ? 'Yesterday' : d + 'd ago';
          return '<span class="' + (d >= 60 ? 'fin-contact-stale' : '') + '">' + esc(label) + '</span>';
        } }
    ];
  }

  function focusDefaultRange() {
    var to = new Date();
    var from = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate() + 1);
    var fmt = function(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
    return { from: fmt(from), to: fmt(to) };
  }

  async function loadFocusTable() {
    if (!focusTable) {
      focusTable = createReportTable({
        containerId: 'focus-table',
        reportKey: 'focus',
        frozenFirst: true,
        emptyMsg: 'No orders cached for this range yet. An admin can pull them with Refresh now.',
        columns: focusCols(),
      });
    }
    var qs = 'from=' + encodeURIComponent(document.getElementById('focus-from').value) +
      '&to=' + encodeURIComponent(document.getElementById('focus-to').value) +
      '&compare=' + encodeURIComponent(document.getElementById('focus-compare').value) +
      '&bds=' + encodeURIComponent(document.getElementById('focus-bds').value) +
      '&region=' + encodeURIComponent(document.getElementById('focus-region').value);
    var r = await api('GET', '/reports/focus?' + qs);
    if (!r.ok) { focusTable.setError(); return; }
    var rep = r.data;
    focusTable.setData(rep.rows);

    // Keep the BDS and region options in step with who actually has clients in
    // range, without losing the current selection.
    var sel = document.getElementById('focus-bds');
    var keep = sel.value;
    sel.innerHTML = '<option value="">Everyone</option>' +
      (rep.bdsOptions || []).map(function(b){ return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('');
    sel.value = keep;

    var rsel = document.getElementById('focus-region');
    var keepRegion = rsel.value;
    rsel.innerHTML = '<option value="">All regions</option>' +
      (rep.regionOptions || []).map(function(g){ return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join('');
    // A region that vanished from the data would otherwise leave the select
    // blank while the filter stayed applied.
    rsel.value = (rep.regionOptions || []).indexOf(keepRegion) >= 0 ? keepRegion : '';

    var change = rep.totals.priorRevenue > 0
      ? ((rep.totals.revenue - rep.totals.priorRevenue) / rep.totals.priorRevenue) * 100
      : null;
    document.getElementById('focus-totals').innerHTML =
      '<span><strong>' + rep.totals.clients + '</strong> clients</span>' +
      '<span><strong>' + rep.totals.shoots + '</strong> shoots</span>' +
      '<span><strong>' + money(rep.totals.revenue) + '</strong> revenue</span>' +
      '<span class="text-muted">vs ' + money(rep.totals.priorRevenue) + ' in ' + esc(rep.comparisonFrom) + ' → ' + esc(rep.comparisonTo) + '</span>' +
      (change === null ? '' : '<span class="' + (change >= 0 ? 'focus-up' : 'focus-down') + '">' + esc(focusPct(Math.round(change * 10) / 10)) + '</span>');
    document.getElementById('focus-note').textContent =
      [rep.splitNote, rep.topPercentNote].filter(Boolean).join(' ');
    document.getElementById('focus-refreshed-at').textContent = rep.refreshedAt
      ? 'Updated ' + new Date(rep.refreshedAt).toLocaleString()
      : 'Never refreshed';
  }

  async function loadFocus() {
    var fromEl = document.getElementById('focus-from');
    var toEl = document.getElementById('focus-to');
    if (!fromEl.value || !toEl.value) {
      var d = focusDefaultRange();
      fromEl.value = d.from;
      toEl.value = d.to;
    }
    await loadFocusTable();
  }

  ['focus-from', 'focus-to', 'focus-compare', 'focus-bds', 'focus-region'].forEach(function(id) {
    document.getElementById(id).addEventListener('change', loadFocusTable);
  });

  document.getElementById('focus-refresh-btn').addEventListener('click', async () => {
    var btn = document.getElementById('focus-refresh-btn');
    btn.disabled = true;
    // This is dozens of Spiro requests over a year of orders, so say so rather
    // than leave someone staring at a spinner.
    btn.textContent = 'Pulling a year of orders…';
    var r = await api('POST', '/reports/focus/refresh', {
      from: document.getElementById('focus-from').value,
      to: document.getElementById('focus-to').value,
      compare: document.getElementById('focus-compare').value,
    });
    btn.disabled = false;
    btn.innerHTML = '↻ Refresh now';
    if (!r.ok) {
      await updateSpiroBanner();
      alert((r.data && r.data.error) || 'Refresh failed. Reconnect Spiro and try again.');
      return;
    }
    await loadFocusTable();
  });

  // ── Housing Market ─────────────────────────────────────────────────────────
  // Formatting, colouring and rendering live in market-ui.ts, shared verbatim
  // with the portal. This is only the page's own wiring: the load, and the
  // admin-only refresh.
  var marketView = null;

  async function loadMarket() {
    if (!marketView) {
      marketView = createMarketReport({
        metricSelectId: 'market-metric',
        tableId: 'market-table',
        reportKey: 'market',
        nationalId: 'market-national',
        noteId: 'market-note',
        warningId: 'market-warning',
        refreshedAtId: 'market-refreshed-at',
        emptyMsg: 'No market data cached yet. An admin can pull it with Refresh now.',
        // Only an admin can act on a missing key, and only here.
        adminHints: true,
      });
    }
    var r = await api('GET', '/reports/market');
    if (!r.ok) { marketView.setError(); return; }
    marketView.setReport(r.data);
  }

  document.getElementById('market-refresh-btn').addEventListener('click', async () => {
    var btn = document.getElementById('market-refresh-btn');
    btn.disabled = true;
    // One metered upstream call per market, so name the cost rather than spin.
    btn.textContent = 'Pulling market data…';
    var r = await api('POST', '/reports/market/refresh', {});
    btn.disabled = false;
    btn.innerHTML = '↻ Refresh now';
    if (!r.ok) {
      alert((r.data && r.data.error) || 'Refresh failed.');
      return;
    }
    // A partial sweep still succeeds; say which markets did not come back.
    if (r.data && r.data.failed) {
      alert(r.data.failed + ' of ' + (r.data.refreshed + r.data.failed) + ' markets failed:\\n' +
        (r.data.errors || []).map(function(e){ return e.area + ': ' + e.error; }).join('\\n'));
    }
    await loadMarket();
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
  let finActions = [];   // collections steps in policy order, server-owned
  let finAssignees = []; // assignable users (admins only)
  let finCanAssign = false;
  let finView = 'board';
  try { finView = localStorage.getItem('oc_fin_view') === 'table' ? 'table' : 'board'; } catch (e) { /* private mode */ }
  const finFilters = { owner: 'all', reviewOnly: false, payAtOrderOnly: false, hideResolved: true };

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
    finActions = r.data.actions || [];
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
      tile('Needs review', finBreakdown.manualReviewCount || 0) +
      tile('Pay at order', finBreakdown.payAtOrderCount || 0);

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
      if (finFilters.payAtOrderOnly && !(a.payAtOrder && a.payAtOrder.recommended)) return false;
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

  /**
   * The pay-at-order prompt, as a badge. Deliberately worded about future work
   * so it is not mistaken for another collections step on the current debt.
   */
  function finPayAtOrderBadge(a) {
    if (!a.payAtOrder || !a.payAtOrder.recommended) return '';
    return '<span class="badge fin-flag-pao" title="' + esc(a.payAtOrder.detail) +
      '">Pay at order</span>';
  }

  function finCardHtml(a) {
    const c = a.case || {};
    const flag = (finReviewOpen(a)
      ? '<span class="badge fin-flag" title="Partially paid invoice — read before the next collections step">Review</span>'
      : (a.needsManualReview ? '<span class="badge fin-flag-clear" title="Partial payment reviewed">Reviewed</span>' : ''))
      + finPayAtOrderBadge(a);
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

  // ── Last contact ───────────────────────────────────────────────────────────
  const FIN_CHANNEL_LABELS = { call: 'Call', voicemail: 'Voicemail', email: 'Email', text: 'Text', letter: 'Letter', in_person: 'In person' };

  function finChannelLabel(key) { return FIN_CHANNEL_LABELS[key] || key; }

  /**
   * "14d ago · Call" with the source behind a tooltip. Silence is the signal
   * here, so an account nobody has reached says so loudly rather than blankly.
   */
  function finLastContactCell(a) {
    const lc = a.lastContact;
    if (!lc) return '<span class="fin-contact-never">Never</span>';
    const days = a.daysSinceContact;
    const age = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days + 'd ago';
    const stale = days != null && days >= 14 ? ' fin-contact-stale' : '';
    const detail = lc.source === 'logged'
      ? finChannelLabel(lc.channel) + (lc.byName ? ' · ' + lc.byName : '')
      : 'Pipedrive' + (lc.matchedName ? ' · ' + lc.matchedName : '');
    const title = lc.source === 'logged'
      ? 'Logged in the dashboard on ' + new Date(lc.at).toLocaleDateString()
      : 'Last Pipedrive activity on ' + new Date(lc.at).toLocaleDateString() + ' (matched by name)';
    return '<span class="fin-contact' + stale + '" title="' + esc(title) + '">' + esc(age) +
      '</span><span class="fin-owner"> · ' + esc(detail) + '</span>';
  }

  /**
   * When the next scheduled contact is. The date comes from the follow-up task
   * raised for the account, so an empty cell means nothing is actually booked —
   * which is the point of the column, and why it says so rather than showing a
   * dash you could read as "no data".
   */
  function finNextContactCell(a) {
    const nc = a.nextContact;
    if (!nc) return '<span class="fin-next-none" title="No follow-up task scheduled">Not scheduled</span>';
    const days = a.daysUntilContact;
    const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow'
      : days < 0 ? (days === -1 ? 'Yesterday' : (-days) + 'd ago') : 'in ' + days + 'd';
    // A follow-up whose date has passed is the thing that needs attention, so
    // it is coloured like an overdue item rather than sitting quietly.
    const cls = days != null && days < 0 ? ' fin-next-over' : (days === 0 ? ' fin-next-today' : '');
    return '<span class="fin-next' + cls + '" title="' + esc(nc.taskTitle) + '">' + esc(when) +
      '</span><span class="fin-owner"> · ' + esc(finDate(nc.at)) + '</span>';
  }

  /**
   * The two inline pickers. Both are numbered, because neither sequence is
   * guessable from the labels alone — you cannot tell that "Billing call /
   * final email" comes after "Billing call + notify BDS" without the step.
   */
  function finStageSelect(a) {
    const c = a.case || {};
    const opts = finStatuses.map((s, i) =>
      '<option value="' + esc(s.key) + '"' + (s.key === c.status ? ' selected' : '') + '>' +
      (i + 1) + ' · ' + esc(s.label) + '</option>').join('');
    return '<select class="fin-cell-select js-fin-stage" data-account="' + esc(a.accountKey) +
      '" title="Collections stage — in order">' + opts + '</select>';
  }

  function finActionSelect(a) {
    const act = a.action || {};
    const override = (a.case || {}).nextAction || '';
    // The default option names the step the account's age calls for, so
    // choosing "follow the policy" is never a jump into the unknown.
    const policy = finActions.find(x => x.key === act.policyKey);
    const policyLabel = policy ? policy.step + ' · ' + policy.label : 'policy';
    const opts = ['<option value=""' + (override ? '' : ' selected') + '>Follow policy (' + esc(policyLabel) + ')</option>']
      .concat(finActions.map(x =>
        '<option value="' + esc(x.key) + '"' + (x.key === override ? ' selected' : '') + '>' +
        x.step + ' · ' + esc(x.label) + '</option>'));
    return '<select class="fin-cell-select js-fin-action' + (override ? ' fin-cell-pinned' : '') +
      '" data-account="' + esc(a.accountKey) + '" title="' + esc(act.detail || '') + '">' +
      opts.join('') + '</select>';
  }

  // Sort state for the table view. Aging and last contact are the two people
  // actually re-sort by, so both are real sorts rather than a fixed order.
  let finSort = { key: 'oldest', dir: 'desc' };

  function finSortValue(a, key) {
    const c = a.case || {};
    switch (key) {
      case 'name': return (a.accountName || '').toLowerCase();
      case 'stage': return finStatusLabel(c.status).toLowerCase();
      case 'owner': return finOwnerLabel(c).toLowerCase();
      case 'balance': return a.balance || 0;
      case 'invoices': return a.invoiceCount || 0;
      case 'bucket': return a.oldestDaysPastDue || 0;
      // Never-contacted sorts as the most urgent, not as "zero days ago".
      case 'contact': return a.daysSinceContact == null ? Number.MAX_SAFE_INTEGER : a.daysSinceContact;
      // Unscheduled sorts last on either direction: an account with no
      // follow-up booked is not "due soonest", it is simply not on the calendar.
      case 'next': return a.daysUntilContact == null ? Number.MAX_SAFE_INTEGER : a.daysUntilContact;
      // By where the account sits in the sequence, not alphabetically.
      case 'action': return (a.action && a.action.step) || 0;
      default: return a.oldestDaysPastDue || 0;
    }
  }

  function finSortAccounts(accounts) {
    const sign = finSort.dir === 'asc' ? 1 : -1;
    return accounts.slice().sort((x, y) => {
      const xv = finSortValue(x, finSort.key);
      const yv = finSortValue(y, finSort.key);
      if (xv < yv) return -1 * sign;
      if (xv > yv) return 1 * sign;
      return (y.balance || 0) - (x.balance || 0);
    });
  }

  document.getElementById('fin-table-head').addEventListener('click', e => {
    const th = e.target.closest('th[data-sort]');
    if (!th) return;
    const key = th.dataset.sort;
    if (finSort.key === key) finSort.dir = finSort.dir === 'asc' ? 'desc' : 'asc';
    else finSort = { key: key, dir: key === 'name' || key === 'stage' || key === 'owner' ? 'asc' : 'desc' };
    renderFinViews();
  });

  function renderFinTable(accounts) {
    const tbody = document.getElementById('fin-table-body');
    document.querySelectorAll('#fin-table-head th[data-sort]').forEach(th => {
      const on = th.dataset.sort === finSort.key;
      th.textContent = th.textContent.replace(/ [▲▼]$/, '') + (on ? (finSort.dir === 'asc' ? ' ▲' : ' ▼') : '');
    });
    if (accounts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No past-due accounts match this filter. If that looks wrong, click Refresh now to pull the latest invoices from Spiro.</td></tr>';
      return;
    }
    tbody.innerHTML = finSortAccounts(accounts).map(a => {
      const c = a.case || {};
      const flag = (finReviewOpen(a) ? ' <span class="badge fin-flag">Review</span>' : '')
        + (a.payAtOrder && a.payAtOrder.recommended ? ' ' + finPayAtOrderBadge(a) : '');
      return \`
      <tr class="fin-row-click" data-account="\${esc(a.accountKey)}">
        <td>\${esc(a.accountName)}<span class="fin-owner"> · \${esc(a.accountType)}</span>\${flag}</td>
        <td>\${finStageSelect(a)}</td>
        <td class="text-muted">\${esc(finOwnerLabel(c))}</td>
        <td>\${money(a.balance)}</td>
        <td>\${a.invoiceCount}\${a.partiallyPaidCount ? ' (' + a.partiallyPaidCount + ' partial)' : ''}</td>
        <td>\${a.oldestDaysPastDue} days</td>
        <td><span class="\${bucketClass(a.bucket)}">\${esc(a.bucket)}</span></td>
        <td>\${finLastContactCell(a)}</td>
        <td>\${finNextContactCell(a)}</td>
        <td>\${finActionSelect(a)}</td>
      </tr>\`;
    }).join('');
    tbody.querySelectorAll('.fin-row-click').forEach(row => {
      row.addEventListener('click', () => openFinAccount(row.dataset.account));
    });
    // The row opens the drawer, so a click that lands on a picker has to stop
    // there — otherwise changing a stage would also open the account behind it.
    tbody.querySelectorAll('.fin-cell-select').forEach(sel => {
      sel.addEventListener('click', e => e.stopPropagation());
    });
    tbody.querySelectorAll('.js-fin-stage').forEach(sel => {
      sel.addEventListener('change', async e => {
        e.stopPropagation();
        await setFinStatus(sel.dataset.account, sel.value);
      });
    });
    tbody.querySelectorAll('.js-fin-action').forEach(sel => {
      sel.addEventListener('change', async e => {
        e.stopPropagation();
        await setFinNextAction(sel.dataset.account, sel.value || null);
      });
    });
  }

  /**
   * Mirror of the server's action resolution, over the same ordered list the
   * server shipped — so a saved override shows immediately without re-fetching
   * the whole report, and no policy is duplicated in the browser.
   */
  function finResolveAction(a, override) {
    const policy = finActions.find(x => x.bucket === a.bucket) || finActions[0];
    if (!policy) return a.action;
    const chosen = override ? (finActions.find(x => x.key === override) || policy) : policy;
    return Object.assign({}, chosen, {
      source: override ? 'override' : 'policy',
      policyKey: policy.key,
    });
  }

  async function setFinNextAction(accountKey, nextAction) {
    const r = await api('PUT', '/financials/accounts/' + encodeURIComponent(accountKey) + '/next-action', { nextAction });
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not change the next action.'); return false; }
    const acct = (finBreakdown.accounts || []).find(a => a.accountKey === accountKey);
    if (acct) {
      acct.case = r.data.case;
      acct.action = finResolveAction(acct, r.data.case.nextAction);
    }
    renderFinViews();
    return true;
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
  document.getElementById('fin-filter-payatorder').addEventListener('change', e => {
    finFilters.payAtOrderOnly = e.target.checked;
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
    renderFinPayAtOrderBanner();
    renderFinCaseControls();

    const invBody = document.getElementById('fin-modal-invoices');
    // The reference number opens the invoice in Spiro. Server-side null means
    // the id was not linkable, so it falls back to plain text.
    const invRef = i => {
      const label = esc(i.referenceNumber || i.invoiceId);
      return i.spiroUrl
        ? '<a class="fin-inv-link" href="' + esc(i.spiroUrl) + '" target="_blank" rel="noopener" title="Open in Spiro">' + label + '</a>'
        : label;
    };
    invBody.innerHTML = invoices.map(i => \`
      <tr\${i.partiallyPaid ? ' style="background:var(--surface2)"' : ''}>
        <td>\${invRef(i)}\${i.partiallyPaid ? ' <span class="badge fin-flag">Partial</span>' : ''}</td>
        <td class="text-muted">\${esc(i.status || '—')}</td>
        <td>\${money(i.amount)}</td>
        <td>\${i.amountPaid === null ? '—' : money(i.amountPaid)}</td>
        <td>\${money(i.outstanding)}</td>
        <td>\${finDate(i.dateDue)}</td>
        <td>\${i.daysPastDue}</td>
      </tr>\`).join('') || '<tr><td colspan="7" class="empty-state">No past-due invoices.</td></tr>';

    renderFinNotes(r.data.notes || []);
    // Say where the date in the table came from, so nobody reads a Pipedrive
    // touch as "we chased them about this bill".
    const lc = acct && acct.lastContact;
    document.getElementById('fin-contact-hint').textContent = !lc
      ? 'Nobody has contacted this account yet.'
      : lc.source === 'logged'
        ? 'Last logged contact ' + new Date(lc.at).toLocaleDateString() + ' by ' + (lc.byName || 'someone') + '.'
        : 'No contact logged here. Pipedrive last shows activity on ' + new Date(lc.at).toLocaleDateString() +
          (lc.matchedName ? ' for "' + lc.matchedName + '".' : '.');
    document.getElementById('fin-contact-date').value = '';
    document.getElementById('fin-contact-note').value = '';
    const cr = await api('GET', '/financials/accounts/' + encodeURIComponent(accountKey) + '/contacts');
    if (cr.ok) {
      const sel = document.getElementById('fin-contact-channel');
      sel.innerHTML = (cr.data.channels || []).map(c =>
        '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>').join('');
      renderFinContacts(cr.data.contacts || []);
    }
    // Scripts are per-account (the merge fields resolve against this one), so
    // the picker resets rather than carrying the last account's draft over.
    document.getElementById('fin-script-select').value = '';
    document.getElementById('fin-script-out').classList.add('hidden');
    document.getElementById('fin-script-copy').disabled = true;
    await loadFinScripts();
    const followBtn = document.getElementById('fin-followup-btn');
    followBtn.disabled = false;
    followBtn.textContent = '+ Create follow-up task';
    document.getElementById('fin-modal').classList.remove('hidden');
  }

  // Partial payments are the one thing the policy ladder must not be applied to
  // blindly, so the flag gets its own banner with an explicit sign-off rather
  // than a badge someone can scroll past.
  /**
   * Spells out the pay-at-order recommendation in the account drawer. The badge
   * says there is one; this says how many invoices are behind it and what to do,
   * because the change is made by hand in Spiro rather than from here.
   */
  function renderFinPayAtOrderBanner() {
    const el = document.getElementById('fin-pao-banner');
    const pao = finAccount && finAccount.payAtOrder;
    if (!pao || !pao.recommended) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = '<strong>Switch future orders to Pay at order.</strong> ' + esc(pao.detail);
  }

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
    renderFinPayAtOrderBanner();
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

  // ── Outreach scripts ───────────────────────────────────────────────────────
  // Scripts are written once by a manager and picked per account, so the wording
  // and the numbers are the same whoever is working the queue.
  let finScripts = [];
  let finScriptFields = [];
  let finScriptKinds = [];
  let finScriptsCanEdit = false;

  async function loadFinScripts() {
    const r = await api('GET', '/financials/templates');
    if (!r.ok) return;
    finScripts = r.data.templates || [];
    finScriptFields = r.data.mergeFields || [];
    finScriptKinds = r.data.kinds || [];
    finScriptsCanEdit = !!r.data.canEdit;
    const sel = document.getElementById('fin-script-select');
    // Scripts tagged with aging buckets surface for the matching account first.
    const bucket = finAccount && finAccount.bucket;
    const fits = t => !t.buckets || !t.buckets.length || (bucket && t.buckets.indexOf(bucket) !== -1);
    const ordered = finScripts.filter(t => t.active !== false).slice().sort((a, b) => (fits(b) ? 1 : 0) - (fits(a) ? 1 : 0));
    sel.innerHTML = '<option value="">Pick a script…</option>' + ordered.map(t =>
      '<option value="' + esc(t.id) + '">' + esc(t.title) +
        (t.buckets && t.buckets.length ? ' (' + esc(t.buckets.join(', ')) + ')' : '') + '</option>').join('');
    document.getElementById('fin-script-manage').classList.toggle('hidden', !finScriptsCanEdit);
  }

  document.getElementById('fin-script-select').addEventListener('change', async e => {
    const out = document.getElementById('fin-script-out');
    const copyBtn = document.getElementById('fin-script-copy');
    if (!e.target.value || !finAccount) {
      out.classList.add('hidden');
      copyBtn.disabled = true;
      return;
    }
    const r = await api('GET', '/financials/accounts/' + encodeURIComponent(finAccount.accountKey) +
      '/script?templateId=' + encodeURIComponent(e.target.value));
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not build that script.'); return; }
    out.classList.remove('hidden');
    copyBtn.disabled = false;
    const subj = document.getElementById('fin-script-subject');
    subj.classList.toggle('hidden', !r.data.subject);
    subj.textContent = r.data.subject ? 'Subject: ' + r.data.subject : '';
    document.getElementById('fin-script-body').value = r.data.body || '';
    // A field the account cannot fill stays visible in the text; say so rather
    // than let someone send a draft with {{plan_down}} still in it.
    const warn = document.getElementById('fin-script-warn');
    const missing = r.data.unresolved || [];
    warn.classList.toggle('hidden', missing.length === 0);
    warn.textContent = missing.length
      ? 'Unknown merge field' + (missing.length === 1 ? '' : 's') + ' left in the text: ' + missing.map(f => '{{' + f + '}}').join(', ')
      : '';
  });

  document.getElementById('fin-script-copy').addEventListener('click', async () => {
    const subj = document.getElementById('fin-script-subject');
    const body = document.getElementById('fin-script-body').value;
    const text = (subj.classList.contains('hidden') ? '' : subj.textContent + '\\n\\n') + body;
    const btn = document.getElementById('fin-script-copy');
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied';
    } catch (err) {
      // Clipboard access needs a secure context; selecting the text still works.
      document.getElementById('fin-script-body').select();
      btn.textContent = 'Press ⌘/Ctrl+C';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });

  // ── Scripts manager (admin) ────────────────────────────────────────────────
  function renderScriptsList() {
    const el = document.getElementById('scripts-list');
    if (!finScripts.length) {
      el.innerHTML = '<div class="text-muted" style="font-size:0.85rem">No scripts yet. Write the first one below.</div>';
      return;
    }
    el.innerHTML = finScripts.map(t =>
      '<div class="fin-contact-row">' +
        '<span class="fin-contact-when">' + esc(t.title) + '</span>' +
        '<span class="text-muted">' + esc((finScriptKinds.find(k => k.key === t.kind) || {}).label || t.kind) + '</span>' +
        (t.buckets && t.buckets.length ? '<span class="fin-owner">' + esc(t.buckets.join(', ')) + '</span>' : '') +
        (t.active === false ? '<span class="badge fin-flag">Inactive</span>' : '') +
        '<button type="button" class="fin-contact-del" data-edit="' + esc(t.id) + '">Edit</button>' +
        '<button type="button" class="fin-contact-del" data-del="' + esc(t.id) + '">Delete</button>' +
      '</div>').join('');
    el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editScript(b.dataset.edit)));
    el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this script?')) return;
      const r = await api('DELETE', '/financials/templates/' + encodeURIComponent(b.dataset.del));
      if (!r.ok) { alert((r.data && r.data.error) || 'Could not delete that script.'); return; }
      await loadFinScripts();
      renderScriptsList();
    }));
  }

  function scriptFormReset() {
    document.getElementById('script-id').value = '';
    document.getElementById('script-title').value = '';
    document.getElementById('script-subject').value = '';
    document.getElementById('script-body').value = '';
    document.getElementById('script-active').checked = true;
    document.getElementById('script-form-title').textContent = 'New script';
    document.getElementById('script-cancel-edit').classList.add('hidden');
    syncScriptKind();
  }

  function editScript(id) {
    const t = finScripts.find(x => x.id === id);
    if (!t) return;
    document.getElementById('script-id').value = t.id;
    document.getElementById('script-title').value = t.title;
    document.getElementById('script-kind').value = t.kind;
    document.getElementById('script-subject').value = t.subject || '';
    document.getElementById('script-body').value = t.body;
    document.getElementById('script-active').checked = t.active !== false;
    document.getElementById('script-form-title').textContent = 'Editing "' + t.title + '"';
    document.getElementById('script-cancel-edit').classList.remove('hidden');
    syncScriptKind();
  }

  /** A subject line only means anything on an email. */
  function syncScriptKind() {
    const isEmail = document.getElementById('script-kind').value === 'email';
    document.getElementById('script-subject').classList.toggle('hidden', !isEmail);
  }

  document.getElementById('fin-script-manage').addEventListener('click', async () => {
    await loadFinScripts();
    document.getElementById('script-kind').innerHTML = finScriptKinds.map(k =>
      '<option value="' + esc(k.key) + '">' + esc(k.label) + '</option>').join('');
    document.getElementById('script-fields').innerHTML = finScriptFields.map(f =>
      '<button type="button" class="fin-contact-del" data-token="' + esc(f.token) + '" title="' + esc(f.describes) + '" style="margin-left:0">{{' + esc(f.token) + '}}</button>').join(' ');
    document.getElementById('script-fields').querySelectorAll('[data-token]').forEach(b => {
      b.addEventListener('click', () => {
        // Insert at the caret so a field lands where the author is typing.
        const ta = document.getElementById('script-body');
        const token = '{{' + b.dataset.token + '}}';
        const at = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
        ta.value = ta.value.slice(0, at) + token + ta.value.slice(ta.selectionEnd == null ? at : ta.selectionEnd);
        ta.focus();
        ta.selectionStart = ta.selectionEnd = at + token.length;
      });
    });
    scriptFormReset();
    renderScriptsList();
    document.getElementById('scripts-modal').classList.remove('hidden');
  });

  document.getElementById('script-kind').addEventListener('change', syncScriptKind);
  document.getElementById('script-cancel-edit').addEventListener('click', scriptFormReset);
  document.getElementById('scripts-close').addEventListener('click', () => {
    document.getElementById('scripts-modal').classList.add('hidden');
  });

  document.getElementById('script-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('script-id').value;
    const payload = {
      title: document.getElementById('script-title').value,
      kind: document.getElementById('script-kind').value,
      subject: document.getElementById('script-subject').value,
      body: document.getElementById('script-body').value,
      active: document.getElementById('script-active').checked,
    };
    const r = id
      ? await api('PUT', '/financials/templates/' + encodeURIComponent(id), payload)
      : await api('POST', '/financials/templates', payload);
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not save that script.'); return; }
    await loadFinScripts();
    scriptFormReset();
    renderScriptsList();
  });

  // ── Contact log (drawer) ───────────────────────────────────────────────────
  function renderFinContacts(contacts) {
    const el = document.getElementById('fin-contact-list');
    if (!contacts.length) {
      el.innerHTML = '<div class="text-muted" style="font-size:0.85rem">No contact logged yet.</div>';
      return;
    }
    const me = currentUser ? currentUser.id : null;
    el.innerHTML = contacts.map(c => {
      const canDelete = isAdmin() || (c.createdBy && c.createdBy === me);
      return '<div class="fin-contact-row">' +
        '<span class="fin-contact-when">' + esc(new Date(c.contactedAt).toLocaleDateString()) + '</span>' +
        '<span>' + esc(finChannelLabel(c.channel)) + '</span>' +
        (c.note ? '<span class="text-muted">' + esc(c.note) + '</span>' : '') +
        '<span class="fin-owner">' + esc(c.createdByName || 'Unknown') + '</span>' +
        (canDelete ? '<button type="button" class="fin-contact-del" data-id="' + esc(c.id) + '">Remove</button>' : '') +
      '</div>';
    }).join('');
    el.querySelectorAll('.fin-contact-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this contact from the log?')) return;
        const rr = await api('DELETE', '/financials/contacts/' + encodeURIComponent(btn.dataset.id));
        if (rr.ok) await reloadFinContacts();
      });
    });
  }

  async function reloadFinContacts() {
    if (!finAccount) return;
    const r = await api('GET', '/financials/accounts/' + encodeURIComponent(finAccount.accountKey) + '/contacts');
    if (!r.ok) return;
    const sel = document.getElementById('fin-contact-channel');
    if (!sel.options.length) {
      sel.innerHTML = (r.data.channels || []).map(c =>
        '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>').join('');
    }
    renderFinContacts(r.data.contacts || []);
    // The table reads from the breakdown, so refresh it after a log or removal.
    await loadFinancials();
  }

  document.getElementById('fin-contact-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!finAccount) return;
    const channel = document.getElementById('fin-contact-channel').value;
    const dateVal = document.getElementById('fin-contact-date').value;
    const noteEl = document.getElementById('fin-contact-note');
    // A bare YYYY-MM-DD read at local noon lands on the day that was picked in
    // every timezone.
    const contactedAt = dateVal ? new Date(dateVal + 'T12:00:00').getTime() : undefined;
    const r = await api('POST', '/financials/accounts/' + encodeURIComponent(finAccount.accountKey) + '/contacts',
      { channel: channel, contactedAt: contactedAt, note: noteEl.value.trim() || null });
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not log that contact.'); return; }
    noteEl.value = '';
    document.getElementById('fin-contact-date').value = '';
    await reloadFinContacts();
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

  // The CRM directory is ~40 requests, so it is swept on demand and on a slow
  // timer — never on a page load.
  document.getElementById('fin-pd-refresh-btn').addEventListener('click', async () => {
    const btn = document.getElementById('fin-pd-refresh-btn');
    btn.disabled = true;
    btn.textContent = 'Reading Pipedrive…';
    const r = await api('POST', '/financials/pipedrive/refresh');
    btn.disabled = false;
    btn.innerHTML = '↻ Pipedrive';
    if (!r.ok) {
      alert((r.data && r.data.error) || 'Could not read Pipedrive.');
      return;
    }
    await loadFinancials();
  });

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
  // My Work is the landing view: a board answers "where does everything stand?",
  // which is the wrong first question for someone who wants to know what to do.
  let projectsView = 'mywork'; // 'mywork' | 'board' | 'calendar' | 'tasks' | 'list'
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

  /**
   * A task has one owner, so its assignee is a plain select rather than the
   * checkbox picker projects use for membership. Tasks written before this
   * carry more than one; the extra names are left in the data and the first is
   * shown, so opening a task never silently drops someone — saving it does,
   * which is the point at which someone has actually chosen.
   */
  function renderAssigneeSelect(selectedIds) {
    const sel = document.getElementById('task-assignee');
    if (!sel) return;
    const current = (selectedIds || [])[0] || '';
    sel.innerHTML = '<option value="">Unassigned</option>' + adminUsers.map(function(u) {
      const name = fullName(u) || u.username;
      return '<option value="' + esc(u.id) + '"' + (u.id === current ? ' selected' : '') + '>' + esc(name) + '</option>';
    }).join('');
    sel.value = current;
  }

  function readAssigneeSelect() {
    const sel = document.getElementById('task-assignee');
    const v = sel ? sel.value : '';
    return v ? [v] : [];
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

  // Your own open work, grouped by when it is due. The filter bar and project
  // picker still apply, so "my work on this project" is one selection away.
  const myWork = createMyWork({
    rootId: 'projects-mywork',
    tasks: function() { return taskFilterBar.apply(myWorkScope()); },
    currentUserId: function() { return currentUser ? currentUser.id : null; },
    isDone: function(t) { return statusRegistry.isDoneTask(t); },
    projectFor: function(t) {
      return t.projectId ? allProjects.find(function(p) { return p.id === t.projectId; }) || null : null;
    },
    onOpen: openEditTask,
    onToggleDone: async function(id, done) {
      const t = allTasks.find(function(x) { return x.id === id; });
      const board = t ? t.projectId || '' : '';
      const next = done ? statusRegistry.doneKey(board) : statusRegistry.defaultKey(board);
      const r = await api('PUT', '/tasks/' + id, { status: next });
      if (r.ok) await loadProjects();
    },
  });

  /**
   * Tasks My Work may show. Unlike the board this keeps subtasks — a subtask
   * assigned to you is still your work — but it follows the same project
   * visibility rules.
   */
  function myWorkScope() {
    const visible = new Set(selectableProjects().map(function(p) { return p.id; }));
    return allTasks.filter(function(t) {
      if (!t.projectId) return true;
      if (projectsFilter) return t.projectId === projectsFilter;
      return visible.has(t.projectId);
    });
  }

  function renderProjectsPage() {
    document.getElementById('projects-mywork').classList.toggle('hidden', projectsView !== 'mywork');
    document.getElementById('projects-board').classList.toggle('hidden', projectsView !== 'board');
    document.getElementById('projects-calendar').classList.toggle('hidden', projectsView !== 'calendar');
    document.getElementById('projects-tasklist').classList.toggle('hidden', projectsView !== 'tasks');
    document.getElementById('projects-list').classList.toggle('hidden', projectsView !== 'list');
    // The Projects grid is about projects, not tasks, so the task filter bar has
    // nothing to act on there.
    document.getElementById('task-filter-bar').classList.toggle('hidden', projectsView === 'list');
    taskFilterBar.refreshOptions();
    if (projectsView === 'mywork') myWork.render();
    else if (projectsView === 'board') renderBoard();
    else if (projectsView === 'calendar') renderCalendar();
    else if (projectsView === 'tasks') projectsTaskList.render();
    else renderProjectsList();
    if (projectsView === 'mywork') {
      // Counting the whole board here would be misleading — this view is only
      // ever your own tasks.
      const mine = myWorkTasks(myWorkScope(), currentUser ? currentUser.id : null);
      taskFilterBar.setCount(myWorkTasks(taskFilterBar.apply(myWorkScope()), currentUser ? currentUser.id : null).length, mine.length);
    } else if (projectsView !== 'list') {
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

  // View toggle. The chosen view is remembered per browser: someone who lives on
  // the board should not land on My Work every morning. The last two live in the
  // ⋯ menu rather than the segmented control — see the toolbar markup.
  const VIEW_BUTTONS = [
    ['view-mywork-btn', 'mywork'],
    ['view-board-btn', 'board'],
    ['view-tasklist-btn', 'tasks'],
    ['view-cal-btn', 'calendar'],
    ['view-projects-btn', 'list'],
  ];
  const MENU_VIEWS = ['calendar', 'list'];

  /**
   * Mark the current view everywhere it is represented: the segmented control,
   * the ✓ beside a menu view, and the ⋯ button itself — otherwise picking
   * Calendar would leave the toolbar looking as though nothing were selected.
   */
  function paintViewButtons() {
    VIEW_BUTTONS.forEach(function(pair) {
      const el = document.getElementById(pair[0]);
      if (!el) return;
      const on = projectsView === pair[1];
      el.classList.toggle('active', on);
      const tick = el.querySelector('.tool-menu-tick');
      if (tick) tick.textContent = on ? '✓' : '';
    });
    document.getElementById('tool-menu-btn')
      .classList.toggle('tool-menu-btn-on', MENU_VIEWS.indexOf(projectsView) !== -1);
  }

  function switchProjectsView(view) {
    projectsView = view;
    paintViewButtons();
    try { localStorage.setItem('oc_projects_view', view); } catch (e) { /* private mode */ }
    renderProjectsPage();
  }

  VIEW_BUTTONS.forEach(function(pair) {
    document.getElementById(pair[0]).addEventListener('click', function() { switchProjectsView(pair[1]); });
  });

  (function restoreProjectsView() {
    let saved = null;
    try { saved = localStorage.getItem('oc_projects_view'); } catch (e) { /* private mode */ }
    if (saved && VIEW_BUTTONS.some(function(pair) { return pair[1] === saved; })) projectsView = saved;
    paintViewButtons();
  })();

  // ── Toolbar overflow menu ──────────────────────────────────────────────────
  document.getElementById('tool-menu-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('tool-menu-pop').classList.toggle('hidden');
  });
  document.addEventListener('click', function(e) {
    const pop = document.getElementById('tool-menu-pop');
    if (!pop || pop.classList.contains('hidden')) return;
    if (e.target.closest('#tool-menu-btn')) return;
    // Picking a view or an action is a decision — the menu has done its job and
    // should get out of the way. "Show closed projects" is a <label>, so it is
    // deliberately not a button and the menu stays open for a second toggle.
    if (e.target.closest('#tool-menu-pop') && !e.target.closest('button.tool-menu-item')) return;
    pop.classList.add('hidden');
  });
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    const pop = document.getElementById('tool-menu-pop');
    if (pop) pop.classList.add('hidden');
  });

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
      return '<div class="project-list-card proj-card-click" data-id="' + esc(p.id) + '">' +
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
    // The card itself opens the detail view. The footer buttons keep working
    // and stop the click there, so "Edit" still means edit rather than opening
    // the drawer behind it.
    grid.querySelectorAll('.project-list-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('button')) return;
        openProjectDetail(this.dataset.id);
      });
    });
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

  // ── Project detail ─────────────────────────────────────────────────────────
  let projDetailId = null;

  /** One project's whole picture: progress per column, dates, people, its tasks. */
  function openProjectDetail(projectId) {
    const p = allProjects.find(function(x) { return x.id === projectId; });
    if (!p) return;
    projDetailId = projectId;
    document.getElementById('proj-detail-title').textContent = p.title;

    const tasks = allTasks.filter(function(t) { return t.projectId === p.id && !t.parentTaskId; });
    const done = tasks.filter(function(t) { return statusRegistry.isDoneTask(t); });
    const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
    // Compare from the start of today, not the current instant: due dates are
    // anchored at midday, so a raw Date.now() would call a task due today
    // overdue from lunchtime onward.
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const overdue = tasks.filter(function(t) {
      return t.dueDate && t.dueDate < startOfToday.getTime() && !statusRegistry.isDoneTask(t);
    });

    let html = '';
    html += '<div class="pd-head">' +
      '<span class="badge proj-status-badge-' + esc(p.status) + '">' + esc(p.status) + '</span>' +
      '<span class="pd-swatch" style="background:' + esc(p.color) + '"></span>' +
      (p.startDate || p.endDate
        ? '<span class="text-muted" style="font-size:0.8rem">📅 ' + esc(formatDateRange(p.startDate, p.endDate)) + '</span>'
        : '') +
      '</div>';
    if (p.description) {
      html += '<div class="pd-desc">' + esc(p.description) + '</div>';
    }

    // Progress first: the one number someone opens a project to see.
    html += '<div class="pd-progress">' +
      '<div class="pd-progress-top"><span>' + done.length + ' of ' + tasks.length + ' tasks done</span>' +
      '<strong>' + pct + '%</strong></div>' +
      '<div class="pd-track"><div class="pd-fill" style="width:' + pct + '%"></div></div>' +
      (overdue.length
        ? '<div class="pd-overdue">' + overdue.length + (overdue.length === 1 ? ' task is overdue' : ' tasks are overdue') + '</div>'
        : '') +
      '</div>';

    // A count per column, using this project's own board.
    const cols = statusRegistry.columnsFor(p.id);
    if (cols && cols.length) {
      html += '<div class="pd-cols">' + cols.map(function(c) {
        const n = tasks.filter(function(t) { return t.status === c.key; }).length;
        return '<div class="pd-col"><span class="pd-col-dot" style="background:' + esc(c.color) + '"></span>' +
          '<span class="pd-col-label">' + esc(c.label) + '</span><span class="pd-col-n">' + n + '</span></div>';
      }).join('') + '</div>';
    }

    const facts = [];
    if (p.memberIds && p.memberIds.length) {
      facts.push('<div><span class="pd-fact-label">Members</span>' + esc(p.memberIds.map(userLabel).join(', ')) + '</div>');
    }
    if (p.tags && p.tags.length) {
      facts.push('<div><span class="pd-fact-label">Tags</span>' +
        p.tags.map(function(t) { return '<span class="resource-tag">' + esc(t) + '</span>'; }).join(' ') + '</div>');
    }
    if (p.attachmentCount) {
      facts.push('<div><span class="pd-fact-label">Attachments</span>' + p.attachmentCount + '</div>');
    }
    if (facts.length) {
      html += '<div class="pd-facts">' + facts.join('') + '</div>';
    }

    // The tasks themselves, open ones first — a project with nothing left to do
    // should not bury that under a list of finished work.
    if (tasks.length) {
      const ordered = tasks.slice().sort(function(a, b) {
        const ad = statusRegistry.isDoneTask(a) ? 1 : 0;
        const bd = statusRegistry.isDoneTask(b) ? 1 : 0;
        if (ad !== bd) return ad - bd;
        return (a.dueDate || Infinity) - (b.dueDate || Infinity);
      });
      html += '<div class="pd-section-title">Tasks</div><div class="pd-tasks">' + ordered.map(function(t) {
        const isDone = statusRegistry.isDoneTask(t);
        return '<div class="pd-task" data-task="' + esc(t.id) + '">' +
          '<span class="pd-task-title' + (isDone ? ' pd-task-done' : '') + '">' + esc(t.title) + '</span>' +
          (t.dueDate ? '<span class="pd-task-due">' + dueChip(t) + '</span>' : '') +
          '<span class="pd-task-status">' + esc(statusRegistry.labelOf(t.projectId, t.status)) + '</span>' +
          '</div>';
      }).join('') + '</div>';
    } else {
      html += '<div class="text-muted" style="font-size:0.85rem;margin-top:0.75rem">No tasks in this project yet.</div>';
    }

    const body = document.getElementById('proj-detail-body');
    body.innerHTML = html;
    // A task in the list opens that task, so the drawer is a way in rather
    // than a dead end.
    body.querySelectorAll('.pd-task').forEach(function(row) {
      row.addEventListener('click', function() {
        closeProjectDetail();
        openEditTask(this.dataset.task);
      });
    });
    document.getElementById('proj-detail-modal').classList.remove('hidden');
  }

  function closeProjectDetail() {
    document.getElementById('proj-detail-modal').classList.add('hidden');
    projDetailId = null;
  }

  document.getElementById('proj-detail-close').addEventListener('click', closeProjectDetail);
  document.getElementById('proj-detail-modal').addEventListener('click', function(e) {
    if (e.target === this) closeProjectDetail();
  });
  document.getElementById('proj-detail-board').addEventListener('click', function() {
    const id = projDetailId;
    closeProjectDetail();
    projectsFilter = id;
    document.getElementById('project-filter-sel').value = id;
    switchProjectsView('board');
  });
  document.getElementById('proj-detail-edit').addEventListener('click', function() {
    const id = projDetailId;
    closeProjectDetail();
    openEditProject(id);
  });
  document.getElementById('proj-detail-dup').addEventListener('click', function() {
    const id = projDetailId;
    closeProjectDetail();
    duplicateProjectFlow(id);
  });

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
    // Routine priority says nothing; only what is genuinely hot earns a chip.
    if (task.priority === 'high' || task.priority === 'urgent') {
      html += '<span class="task-prio ' + prio.cls + '">' + prio.icon + ' ' + esc(task.priority) + '</span>';
    }
    html += '</div>';

    // One muted line: project, due, then counts. Everything else — description,
    // tags, recurrence, per-assignee names — is in the modal, one click away.
    const bits = [];
    if (proj) {
      bits.push('<span class="task-card-proj">' +
        '<span class="task-card-proj-dot" style="background:' + esc(proj.color) + '"></span>' +
        '<span class="task-card-proj-name">' + esc(proj.title) + '</span></span>');
    }
    // Shared due-date chip: overdue / today / this week / later, and never red
    // once the task is done.
    if (task.dueDate) bits.push(dueChip(task));
    if (task.recurrence) bits.push('<span class="task-recurrence" title="Repeats ' + esc(task.recurrence) + '">🔁</span>');
    const attachCount = attachmentCountFor('task', task.id);
    if (attachCount) bits.push('<span title="' + attachCount + (attachCount === 1 ? ' attachment' : ' attachments') + '">📎 ' + attachCount + '</span>');
    if (task.commentCount) bits.push('<span title="' + task.commentCount + (task.commentCount === 1 ? ' comment' : ' comments') + '">💬 ' + task.commentCount + '</span>');
    if (bits.length) {
      html += '<div class="task-card-line">' + bits.join('<span class="task-card-sep">·</span>') + '</div>';
    }

    // Subtask progress and assignee avatars share the last row so a card with
    // both does not grow two more blocks tall.
    const assigneeNames = (task.assigneeIds || []).map(userLabel);
    if (!assigneeNames.length && task.assignedTo) assigneeNames.push(task.assignedTo);
    if (subtasks.length || assigneeNames.length) {
      html += '<div class="task-card-foot">';
      if (subtasks.length) {
        const pct = Math.round((doneSubs.length / subtasks.length) * 100);
        html += '<span class="task-subtask-bar" title="' + doneSubs.length + ' of ' + subtasks.length + ' subtasks done">' +
          '<span class="task-subtask-count">' + doneSubs.length + '/' + subtasks.length + '</span>' +
          '<span class="task-subtask-track"><span class="task-subtask-fill" style="width:' + pct + '%"></span></span>' +
          '</span>';
      }
      if (assigneeNames.length) {
        // Overlapping initials, capped at three so a busy task stays one row.
        const shown = assigneeNames.slice(0, 3);
        const extra = assigneeNames.length - shown.length;
        html += '<span class="task-assignee-row" title="' + esc(assigneeNames.join(', ')) + '">' +
          shown.map(function(n) {
            return '<span class="task-assignee">' + esc(initials(n)) + '</span>';
          }).join('') +
          (extra > 0 ? '<span class="task-assignee task-assignee-more">+' + extra + '</span>' : '') +
          '</span>';
      }
      html += '</div>';
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
    renderAssigneeSelect([]);
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
    document.getElementById('task-due').value = task.dueDate ? calDateInputValue(task.dueDate) : '';
    document.getElementById('task-recurrence').value = task.recurrence || '';
    populateTaskProjectSelect(task.projectId || '');
    syncTaskStatusOptions(task.status);
    renderTaskModalTags();
    renderAssigneeSelect(task.assigneeIds || []);
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
      dueDate: calDateInputMs(dueVal),
      assigneeIds: readAssigneeSelect(),
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
    document.getElementById('proj-start').value = proj.startDate ? calDateInputValue(proj.startDate) : '';
    document.getElementById('proj-end').value = proj.endDate ? calDateInputValue(proj.endDate) : '';
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

  // ── Board column editor ────────────────────────────────────────────────────
  // One editor for both cases: a project's own columns, and the default set that
  // every uncustomised board shares. A project starts out borrowing the default
  // set; saving a change here gives it its own copy, and Reset drops it back to
  // sharing. Admin-only, because rewriting columns moves other people's cards.
  let colEditTarget = '';   // project id, or '' for the default set
  let colEditRows = [];
  let colEditCustom = false;

  function openColumnsEditor() {
    colEditTarget = projectsFilter || '';
    const proj = colEditTarget ? allProjects.find(function(p) { return p.id === colEditTarget; }) : null;
    document.getElementById('columns-modal-title').textContent = proj
      ? 'Board Columns — ' + proj.title
      : 'Default Board Columns';
    document.getElementById('columns-list').innerHTML = '<div class="text-muted">Loading…</div>';
    document.getElementById('columns-modal').classList.remove('hidden');
    loadColumnsEditor();
  }

  async function loadColumnsEditor() {
    const qs = colEditTarget ? '?projectId=' + encodeURIComponent(colEditTarget) : '';
    const r = await api('GET', '/task-statuses' + qs);
    if (!r.ok) {
      document.getElementById('columns-list').innerHTML = '<div class="text-muted">Could not load these columns.</div>';
      return;
    }
    colEditCustom = !!r.data.custom;
    colEditRows = (r.data.statuses || []).map(function(s) {
      return { key: s.key, label: s.label, color: s.color, isDone: !!s.isDone, wipLimit: s.wipLimit };
    });
    renderColumnsEditor();
  }

  function renderColumnsEditor() {
    document.getElementById('columns-note').textContent = !colEditTarget
      ? 'These columns apply to every board that has not set up its own.'
      : (colEditCustom
        ? 'This project has its own columns.'
        : 'Borrowing the default columns. Saving gives this project its own set.');
    // Only a project can be reset; the default set has nothing to fall back to.
    document.getElementById('columns-reset').classList.toggle('hidden', !colEditTarget || !colEditCustom);
    document.getElementById('columns-list').innerHTML = colEditRows.map(function(c, i) {
      return '<div class="col-row" data-i="' + i + '">' +
        '<input type="color" value="' + esc(c.color || '#6b7280') + '" data-field="color" title="Column colour">' +
        '<input type="text" value="' + esc(c.label) + '" data-field="label" placeholder="Column name" maxlength="60">' +
        '<label title="Tasks in this column count as finished"><input type="checkbox" data-field="isDone"' + (c.isDone ? ' checked' : '') + '> Done</label>' +
        '<input type="number" min="1" step="1" value="' + (c.wipLimit == null ? '' : c.wipLimit) + '" data-field="wipLimit" placeholder="WIP" title="Warn past this many cards. Blank means no limit.">' +
        '<button type="button" class="col-btn" data-act="up"' + (i === 0 ? ' disabled' : '') + ' title="Move earlier">&#8593;</button>' +
        '<button type="button" class="col-btn" data-act="down"' + (i === colEditRows.length - 1 ? ' disabled' : '') + ' title="Move later">&#8595;</button>' +
        '<button type="button" class="col-btn" data-act="del"' + (colEditRows.length < 2 ? ' disabled' : '') + ' title="Remove column">&#10005;</button>' +
      '</div>';
    }).join('');
  }

  /** Read the inputs back into state so edits survive a reorder repaint. */
  function syncColumnsFromDom() {
    document.querySelectorAll('#columns-list .col-row').forEach(function(row) {
      const c = colEditRows[Number(row.dataset.i)];
      if (!c) return;
      c.label = row.querySelector('[data-field=label]').value;
      c.color = row.querySelector('[data-field=color]').value;
      c.isDone = row.querySelector('[data-field=isDone]').checked;
      const wip = row.querySelector('[data-field=wipLimit]').value.trim();
      const n = Math.trunc(Number(wip));
      c.wipLimit = wip === '' || !Number.isFinite(n) || n < 1 ? null : n;
    });
  }

  document.getElementById('board-columns-btn').addEventListener('click', openColumnsEditor);
  document.getElementById('columns-cancel').addEventListener('click', function() {
    document.getElementById('columns-modal').classList.add('hidden');
  });

  document.getElementById('columns-list').addEventListener('click', function(e) {
    const btn = e.target.closest('.col-btn');
    if (!btn) return;
    syncColumnsFromDom();
    const i = Number(btn.closest('.col-row').dataset.i);
    const act = btn.dataset.act;
    if (act === 'del') colEditRows.splice(i, 1);
    else if (act === 'up' && i > 0) colEditRows.splice(i - 1, 0, colEditRows.splice(i, 1)[0]);
    else if (act === 'down' && i < colEditRows.length - 1) colEditRows.splice(i + 1, 0, colEditRows.splice(i, 1)[0]);
    renderColumnsEditor();
  });

  document.getElementById('columns-add').addEventListener('click', function() {
    syncColumnsFromDom();
    // No key: the server derives one from the label, so a new column cannot
    // silently adopt an existing task's status.
    colEditRows.push({ key: '', label: '', color: '#6b7280', isDone: false, wipLimit: null });
    renderColumnsEditor();
    const rows = document.querySelectorAll('#columns-list .col-row');
    const last = rows[rows.length - 1];
    if (last) last.querySelector('[data-field=label]').focus();
  });

  /** Tasks this edit would strand — the ones a save has to move somewhere. */
  function columnsStrandedCount(keptKeys) {
    return allTasks.filter(function(t) {
      const board = t.projectId || '';
      if (colEditTarget) {
        if (board !== colEditTarget) return false;
      } else if (board && statusRegistry.isCustom(board)) {
        // Projects with their own columns are untouched by a default-set edit.
        return false;
      }
      return keptKeys.indexOf(t.status) === -1;
    }).length;
  }

  document.getElementById('columns-save').addEventListener('click', async function() {
    syncColumnsFromDom();
    const cleaned = colEditRows.filter(function(c) { return c.label.trim(); });
    if (!cleaned.length) { alert('A board needs at least one column.'); return; }
    if (!cleaned.some(function(c) { return c.isDone; })) {
      // The server would pick the last column itself; say so rather than let it
      // happen silently, since it decides what "finished" means here.
      if (!confirm('No column is marked Done, so "' + cleaned[cleaned.length - 1].label.trim() + '" will be treated as finished. Continue?')) return;
    }
    const keptKeys = cleaned.map(function(c) { return c.key; }).filter(Boolean);
    const stranded = columnsStrandedCount(keptKeys);
    if (stranded && !confirm(stranded + (stranded === 1 ? ' task sits' : ' tasks sit') + ' on a column you are removing, and will move to "' + cleaned[0].label.trim() + '". Continue?')) return;

    const qs = colEditTarget ? '?projectId=' + encodeURIComponent(colEditTarget) : '';
    const r = await api('PUT', '/task-statuses' + qs, {
      statuses: cleaned.map(function(c) {
        return { key: c.key || c.label, label: c.label.trim(), color: c.color, isDone: c.isDone, wipLimit: c.wipLimit };
      }),
    });
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not save these columns.'); return; }
    // A default-set edit changes every borrowing board, so drop the whole cache.
    statusRegistry.invalidate(colEditTarget || undefined);
    if (r.data.remapped) {
      alert(r.data.remapped + (r.data.remapped === 1 ? ' task was' : ' tasks were') + ' moved to "' + cleaned[0].label.trim() + '".');
    }
    document.getElementById('columns-modal').classList.add('hidden');
    await loadProjects();
  });

  document.getElementById('columns-reset').addEventListener('click', async function() {
    if (!colEditTarget) return;
    if (!confirm('Drop this project\\'s own columns and use the default set again?')) return;
    const r = await api('DELETE', '/task-statuses?projectId=' + encodeURIComponent(colEditTarget));
    if (!r.ok) { alert((r.data && r.data.error) || 'Could not reset these columns.'); return; }
    statusRegistry.invalidate(colEditTarget);
    if (r.data.remapped) {
      alert(r.data.remapped + (r.data.remapped === 1 ? ' task was' : ' tasks were') + ' moved onto the default columns.');
    }
    await loadColumnsEditor();
    await loadProjects();
  });

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
      startDate: calDateInputMs(startVal),
      endDate: calDateInputMs(endVal),
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

  function ticketFileSize(n){
    if (!n && n !== 0) return '';
    if (n >= 1024*1024) return (n/(1024*1024)).toFixed(1)+' MB';
    return Math.max(1, Math.round(n/1024))+' KB';
  }
  // What the client attached on the form. Downloads go through the authenticated
  // fetch helper, so these are links in look only.
  function renderTicketFiles(files){
    var el = document.getElementById('ticket-modal-files');
    if (!files.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div style="font-weight:700;font-size:0.85rem;margin-bottom:0.4rem">Client attachments ('+files.length+')</div>'+
      files.map(function(f){
        return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid var(--border)">'+
          '<span style="font-size:0.9rem;flex:1">'+esc(f.filename||f.title||'file')+
          ' <span class="text-muted" style="font-size:0.78rem">'+esc(ticketFileSize(f.filesize))+'</span></span>'+
          '<button class="btn btn-ghost btn-sm tkt-file" data-id="'+esc(f.id)+'" data-name="'+esc(f.filename||'file')+'">Download</button>'+
          '</div>';
      }).join('');
    el.querySelectorAll('.tkt-file').forEach(function(btn){
      btn.addEventListener('click', function(){ downloadAttachment(btn.dataset.id, btn.dataset.name); });
    });
  }

  async function openTicket(id){
    var r = await api('GET','/tickets/'+id);
    if(!r.ok){ alert((r.data&&r.data.error)||'Failed to open ticket.'); return; }
    var t = r.data.ticket; var events = r.data.events || []; var files = r.data.attachments || [];
    currentTicketId = t.id;
    document.getElementById('ticket-modal-title').textContent = t.number + ' · ' + ticketCategoryLabel(t.category);
    var meta = [];
    if(t.requesterName) meta.push('<strong>'+esc(t.requesterName)+'</strong>');
    if(t.requesterEmail) meta.push(esc(t.requesterEmail));
    if(t.requesterPhone) meta.push(esc(t.requesterPhone));
    if(t.orderAddress) meta.push('📍 '+esc(t.orderAddress));
    if(t.orderId) meta.push('Order '+esc(t.orderId));
    meta.push('via '+esc(t.source));
    // An estimate the client saw while ticking priced choices — not a charge.
    if(t.estimateCents !== null && t.estimateCents !== undefined){
      var est = t.estimateCents/100;
      meta.push('<strong title="Estimate from the choices the client picked">Est. $'+esc(est===Math.floor(est)?String(est):est.toFixed(2))+'</strong>');
    }
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
    renderTicketFiles(files);
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
  // Routing is owned by the request type itself (Request Types page) so there is
  // one place to set it. This page manages the desks; it no longer mirrors the
  // same routes table behind a second, easily-forgotten Save button.

  // ── Request Types (categories) management ───────────────────────────────────
  var editingCategoryKey = null;   // null = creating a new one

  async function loadCategories(){
    await Promise.all([loadCategoryList(), loadDepartmentList()]);
    renderCategoryTable();
  }
  function categoryExtraSummary(c){
    if (c.extraField === 'select' || c.extraField === 'multiselect') {
      var opts = c.extraOptions || [];
      var n = opts.length;
      var extras = [];
      if (opts.some(function(o){ return Number(o.maxQuantity) > 1; })) extras.push('quantities');
      var questions = opts.reduce(function(sum, o){ return sum + ((o.followUps||[]).length); }, 0);
      if (questions) extras.push(questions + ' follow-up' + (questions===1?'':'s'));
      return esc(c.extraLabel||'—') + '<div class="text-muted" style="font-size:0.7rem">' +
        (c.extraField === 'multiselect' ? 'pick several' : 'list') + ' · ' + n + ' choice' + (n===1?'':'s') +
        (extras.length ? ' · ' + esc(extras.join(' · ')) : '') + '</div>';
    }
    if (c.extraField === 'text') {
      return esc(c.extraLabel||'—') + '<div class="text-muted" style="font-size:0.7rem">free text</div>';
    }
    return '<span class="text-muted">None</span>';
  }
  function renderCategoryTable(){
    var body = document.getElementById('cat-body');
    if(!ticketCategories.length){ body.innerHTML='<tr><td colspan="5" class="empty-state">No request types yet.</td></tr>'; return; }
    body.innerHTML = ticketCategories.map(function(c, i){
      var dept = ticketCategoryRoutes[c.key];
      return '<tr data-key="'+esc(c.key)+'">'+
        '<td><strong>'+esc(c.label)+'</strong><div class="text-muted" style="font-size:0.72rem">'+esc(c.shortLabel)+' · '+esc(c.key)+'</div></td>'+
        '<td style="font-size:0.85rem">'+categoryExtraSummary(c)+'</td>'+
        '<td style="font-size:0.85rem">'+(dept?esc(deptLabel(dept)):'<span class="text-muted">Not routed</span>')+'</td>'+
        '<td>'+(c.active
          ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:700;color:#fff;background:#16a34a">Live</span>'
          : '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:700;color:#fff;background:#6b7280">Retired</span>')+'</td>'+
        '<td style="white-space:nowrap">'+
          '<button class="btn btn-ghost btn-sm cat-up" title="Move up"'+(i===0?' disabled':'')+'>↑</button> '+
          '<button class="btn btn-ghost btn-sm cat-down" title="Move down"'+(i===ticketCategories.length-1?' disabled':'')+'>↓</button> '+
          '<button class="btn btn-sm cat-edit">Edit</button> '+
          '<button class="btn btn-ghost btn-sm cat-del" title="Remove">✕</button>'+
        '</td>'+
        '</tr>';
    }).join('');
    body.querySelectorAll('.cat-edit').forEach(function(btn){ btn.addEventListener('click', function(){ openCategoryModal(btn.closest('tr').getAttribute('data-key')); }); });
    body.querySelectorAll('.cat-del').forEach(function(btn){ btn.addEventListener('click', function(){ removeCategoryRow(btn.closest('tr').getAttribute('data-key')); }); });
    body.querySelectorAll('.cat-up').forEach(function(btn){ btn.addEventListener('click', function(){ moveCategory(btn.closest('tr').getAttribute('data-key'), -1); }); });
    body.querySelectorAll('.cat-down').forEach(function(btn){ btn.addEventListener('click', function(){ moveCategory(btn.closest('tr').getAttribute('data-key'), 1); }); });
  }

  // Reorder by sending the whole key order, not "move this one" — the server
  // rewrites every sort_order from it, so the list cannot drift into ties.
  async function moveCategory(key, delta){
    var keys = ticketCategories.map(function(c){ return c.key; });
    var from = keys.indexOf(key);
    var to = from + delta;
    if (from < 0 || to < 0 || to >= keys.length) return;
    keys.splice(to, 0, keys.splice(from, 1)[0]);
    var r = await api('PUT','/tickets/categories/reorder',{keys:keys});
    if(!r.ok){ alert((r.data&&r.data.error)||'Reorder failed.'); return; }
    ticketCategories = (r.data && r.data.categories) || ticketCategories;
    renderCategoryTable();
  }

  // Choices are edited as rows, not as one line of piped text: a choice now
  // carries a price, an orderable quantity and its own follow-up questions, and
  // no one-line syntax stays readable through all of that.
  var catChoices = [];        // working copy, live only while the modal is open

  function blankChoice(){
    return { label:'', imageUrl:'', price:'', unitLabel:'', maxQuantity:'1', followUps:[], open:false };
  }
  function blankFollowUp(){
    return { id:'', label:'', kind:'text', choices:'', placeholder:'', required:false };
  }
  /** API options → editable rows (strings are the pre-object legacy form). */
  function choiceRowsFrom(options){
    return (options || []).map(function(raw){
      var o = typeof raw === 'string' ? { label: raw } : (raw || {});
      var fu = (o.followUps || []).map(function(f){
        return {
          id: f.id || '',
          label: f.label || '',
          kind: f.kind || 'text',
          choices: (f.choices || []).join(', '),
          placeholder: f.placeholder || '',
          required: !!f.required
        };
      });
      return {
        label: o.label || '',
        imageUrl: o.imageUrl || '',
        price: (o.priceCents === null || o.priceCents === undefined) ? '' : String(o.priceCents / 100),
        unitLabel: o.unitLabel || '',
        maxQuantity: String(Number(o.maxQuantity) > 1 ? Number(o.maxQuantity) : 1),
        followUps: fu,
        open: fu.length > 0
      };
    });
  }
  function followUpRowHtml(f, i, j){
    var kinds = [['text','Short answer'],['textarea','Long answer'],['select','Pick from a list']];
    var opts = kinds.map(function(k){
      return '<option value="'+k[0]+'"'+(f.kind===k[0]?' selected':'')+'>'+k[1]+'</option>';
    }).join('');
    var second = f.kind==='select'
      ? '<input type="text" class="fu-choices" data-i="'+i+'" data-j="'+j+'" value="'+esc(f.choices)+'" placeholder="Choices, comma separated — e.g. Modern, Farmhouse, Coastal" style="width:100%;margin-top:0.35rem" />'
      : '<input type="text" class="fu-ph" data-i="'+i+'" data-j="'+j+'" value="'+esc(f.placeholder)+'" placeholder="Placeholder (optional)" style="width:100%;margin-top:0.35rem" />';
    return '<div style="border:1px dashed var(--border,#e5e7eb);border-radius:8px;padding:0.5rem;margin-bottom:0.4rem">'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center">'+
        '<input type="text" class="fu-label" data-i="'+i+'" data-j="'+j+'" value="'+esc(f.label)+'" placeholder="Question — e.g. Preferred staging style" style="flex:2 1 200px" />'+
        '<select class="fu-kind" data-i="'+i+'" data-j="'+j+'" style="flex:1 1 140px">'+opts+'</select>'+
        '<button type="button" class="btn btn-ghost btn-sm fu-del" data-i="'+i+'" data-j="'+j+'" title="Remove question">✕</button>'+
      '</div>'+
      second+
      '<label style="display:flex;align-items:center;gap:0.4rem;font-weight:600;font-size:0.78rem;margin-top:0.35rem">'+
        '<input type="checkbox" class="fu-req" data-i="'+i+'" data-j="'+j+'" style="width:auto"'+(f.required?' checked':'')+' /> Required</label>'+
      '</div>';
  }
  function renderChoiceEditor(){
    var host = document.getElementById('cat-choices');
    if (!catChoices.length) {
      host.innerHTML = '<div class="text-muted" style="font-size:0.8rem">No choices yet — add one below.</div>';
      return;
    }
    host.innerHTML = catChoices.map(function(row, i){
      var body = row.open
        ? '<div style="margin-top:0.45rem;padding-left:0.6rem;border-left:2px solid var(--border,#e5e7eb)">'+
            row.followUps.map(function(f, j){ return followUpRowHtml(f, i, j); }).join('')+
            '<button type="button" class="btn btn-ghost btn-sm ch-fu-add" data-i="'+i+'">+ Add question</button>'+
          '</div>'
        : '';
      return '<div style="border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:0.6rem;margin-bottom:0.5rem">'+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center">'+
          '<input type="text" class="ch-label" data-i="'+i+'" value="'+esc(row.label)+'" placeholder="Choice — e.g. Virtual staging" style="flex:2 1 180px" />'+
          '<input type="text" class="ch-image" data-i="'+i+'" value="'+esc(row.imageUrl)+'" placeholder="Image URL (optional)" style="flex:2 1 150px" />'+
          '<input type="text" class="ch-price" data-i="'+i+'" value="'+esc(row.price)+'" placeholder="Price" title="Price in dollars, per unit" style="flex:0 1 80px" />'+
          '<input type="text" class="ch-unit" data-i="'+i+'" value="'+esc(row.unitLabel)+'" placeholder="each" title="How the price reads on the form — e.g. per image, per room. Leave blank for &quot;each&quot;." style="flex:0 1 120px" />'+
          '<input type="number" min="1" max="99" class="ch-qty" data-i="'+i+'" value="'+esc(row.maxQuantity)+'" title="Most a client can order of this choice — 1 means no quantity picker" style="flex:0 1 72px" />'+
          '<button type="button" class="btn btn-ghost btn-sm ch-del" data-i="'+i+'" title="Remove choice">✕</button>'+
        '</div>'+
        '<button type="button" class="btn btn-ghost btn-sm ch-fu-toggle" data-i="'+i+'" style="margin-top:0.4rem">'+
          (row.open?'▾':'▸')+' Follow-up questions ('+row.followUps.length+')</button>'+
        body+
      '</div>';
    }).join('');
    bindChoiceEditor(host);
  }
  /**
   * Typing writes straight into the row and does not re-render, so the caret
   * stays put; only add/remove/kind changes rebuild the list.
   */
  function bindChoiceEditor(host){
    function rowOf(el){ return catChoices[parseInt(el.getAttribute('data-i'),10)]; }
    function fuOf(el){
      var row = rowOf(el);
      return row && row.followUps[parseInt(el.getAttribute('data-j'),10)];
    }
    [['ch-label','label'],['ch-image','imageUrl'],['ch-price','price'],['ch-unit','unitLabel'],['ch-qty','maxQuantity']].forEach(function(pair){
      host.querySelectorAll('.'+pair[0]).forEach(function(el){
        el.addEventListener('input', function(){ var r = rowOf(el); if (r) r[pair[1]] = el.value; });
      });
    });
    [['fu-label','label'],['fu-choices','choices'],['fu-ph','placeholder']].forEach(function(pair){
      host.querySelectorAll('.'+pair[0]).forEach(function(el){
        el.addEventListener('input', function(){ var f = fuOf(el); if (f) f[pair[1]] = el.value; });
      });
    });
    host.querySelectorAll('.fu-req').forEach(function(el){
      el.addEventListener('change', function(){ var f = fuOf(el); if (f) f.required = el.checked; });
    });
    host.querySelectorAll('.fu-kind').forEach(function(el){
      el.addEventListener('change', function(){ var f = fuOf(el); if (f) { f.kind = el.value; renderChoiceEditor(); } });
    });
    host.querySelectorAll('.ch-del').forEach(function(el){
      el.addEventListener('click', function(){ catChoices.splice(parseInt(el.getAttribute('data-i'),10),1); renderChoiceEditor(); });
    });
    host.querySelectorAll('.ch-fu-toggle').forEach(function(el){
      el.addEventListener('click', function(){ var r = rowOf(el); if (r) { r.open = !r.open; renderChoiceEditor(); } });
    });
    host.querySelectorAll('.ch-fu-add').forEach(function(el){
      el.addEventListener('click', function(){ var r = rowOf(el); if (r) { r.followUps.push(blankFollowUp()); r.open = true; renderChoiceEditor(); } });
    });
    host.querySelectorAll('.fu-del').forEach(function(el){
      el.addEventListener('click', function(){
        var row = rowOf(el);
        if (row) { row.followUps.splice(parseInt(el.getAttribute('data-j'),10),1); renderChoiceEditor(); }
      });
    });
  }
  document.getElementById('cat-choice-add').addEventListener('click', function(){
    catChoices.push(blankChoice());
    renderChoiceEditor();
  });
  /** Rows → what the API stores. "problem" is the first thing an admin must fix. */
  function choicesPayload(){
    var out = [], problem = null;
    catChoices.forEach(function(row){
      var label = String(row.label || '').trim();
      if (!label) return;   // a half-typed row is dropped, not an error
      var priceCents = null;
      var rawPrice = String(row.price || '').trim().replace(/^\\$/, '');
      if (rawPrice) {
        var n = Number(rawPrice);
        // Round to the nearest cent so 149.999 cannot become a fraction of one.
        if (isFinite(n) && n >= 0) priceCents = Math.round(n * 100);
        else if (!problem) problem = '"'+label+'" has a price we could not read. Use a plain number like 150 or 149.50.';
      }
      var qty = parseInt(row.maxQuantity, 10);
      if (!isFinite(qty) || qty < 1) qty = 1;
      if (qty > 99) qty = 99;
      var followUps = [];
      row.followUps.forEach(function(f){
        var question = String(f.label || '').trim();
        if (!question) return;
        var kind = (f.kind === 'select' || f.kind === 'textarea') ? f.kind : 'text';
        var choices = kind === 'select'
          ? String(f.choices || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean)
          : [];
        if (kind === 'select' && !choices.length && !problem) {
          problem = '"'+question+'" is a pick-from-a-list question with no choices. Add some, or switch it to a typed answer.';
        }
        followUps.push({
          id: f.id || '',
          label: question,
          kind: kind,
          choices: choices,
          placeholder: String(f.placeholder || '').trim() || null,
          required: !!f.required
        });
      });
      out.push({
        label: label,
        imageUrl: String(row.imageUrl || '').trim() || null,
        priceCents: priceCents,
        unitLabel: String(row.unitLabel || '').trim().slice(0, 40) || null,
        maxQuantity: qty,
        followUps: followUps
      });
    });
    return { options: out, problem: problem };
  }

  function syncCategoryExtraFields(){
    var kind = document.getElementById('cat-extra-field').value;
    document.getElementById('cat-extra-label-group').classList.toggle('hidden', kind==='none');
    document.getElementById('cat-extra-options-group').classList.toggle('hidden', kind!=='select' && kind!=='multiselect');
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
    catChoices = choiceRowsFrom(c && c.extraOptions);
    renderChoiceEditor();
    document.getElementById('cat-extra-placeholder').value = (c && c.extraPlaceholder) || '';
    document.getElementById('cat-details-label').value = c ? c.detailsLabel : 'Details';
    document.getElementById('cat-details-hint').value = (c && c.detailsHint) || '';
    document.getElementById('cat-active').checked = c ? !!c.active : true;
    var deptSel = document.getElementById('cat-department');
    deptSel.innerHTML='';
    var routed = c ? ticketCategoryRoutes[c.key] : null;
    // An unselected placeholder rather than a silent first-department default:
    // picking the desk is a decision, and a wrong guess mails the wrong team.
    // A route pointing at a deleted department counts as unset, so the admin
    // re-picks instead of the browser falling to whichever desk sorts first.
    var known = !!routed && ticketDepartments.some(function(d){ return d.key===routed; });
    var ph=document.createElement('option'); ph.value=''; ph.textContent='Select a department…';
    ph.disabled=true; ph.selected=!known;
    deptSel.appendChild(ph);
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
    var choices = choicesPayload();
    var isChoiceKind = kind==='select' || kind==='multiselect';
    if(isChoiceKind && !choices.options.length){ er.textContent='Add at least one choice, or switch the follow-up question off.'; er.classList.remove('hidden'); return; }
    if(isChoiceKind && choices.problem){ er.textContent=choices.problem; er.classList.remove('hidden'); return; }
    var extraLabel = document.getElementById('cat-extra-label').value.trim();
    if(kind!=='none' && !extraLabel){ er.textContent='Give the follow-up question some text.'; er.classList.remove('hidden'); return; }
    var department = document.getElementById('cat-department').value;
    if(!department){ er.textContent='Pick the department this request type routes to.'; er.classList.remove('hidden'); return; }
    var payload = {
      label: label,
      shortLabel: document.getElementById('cat-short-label').value.trim() || label,
      extraField: kind,
      extraLabel: kind==='none' ? null : extraLabel,
      // Every choice-shaped question keeps its list. Sending [] for multiselect
      // is what silently emptied a saved list on the next load.
      extraOptions: isChoiceKind ? choices.options : [],
      extraPlaceholder: kind==='text' ? (document.getElementById('cat-extra-placeholder').value.trim() || null) : null,
      detailsLabel: document.getElementById('cat-details-label').value.trim() || 'Details',
      detailsHint: document.getElementById('cat-details-hint').value.trim() || null,
      active: document.getElementById('cat-active').checked,
      department: department,
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
    const page = parseHash().page;
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
