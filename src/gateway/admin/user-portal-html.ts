import { REPORT_TABLE_COMPONENT_JS } from "./report-ui.js";

export const USER_PORTAL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OpenClaw Portal</title>
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

  /* App layout — full height with sidebar */
  .app { display: flex; height: calc(100vh - var(--banner-h)); overflow: hidden; }
  .sidebar { width: 220px; background: var(--sidebar-bg); display: flex; flex-direction: column; flex-shrink: 0; height: calc(100vh - var(--banner-h)); }
  .sidebar-logo { padding: 1.25rem 1.25rem 1rem; display: flex; align-items: center; gap: 0.75rem; border-bottom: 1px solid var(--sidebar-border); }
  .sidebar-logo-icon { width: 32px; height: 32px; background: var(--accent); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
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
  .board-wrap { display: grid; grid-template-columns: repeat(4, minmax(200px, 1fr)); gap: 0.875rem; align-items: start; }
  @media (max-width: 900px) { .board-wrap { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 560px) { .board-wrap { grid-template-columns: 1fr; } }
  .board-col { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.625rem; }
  .board-col-head { display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 0.8rem; margin-bottom: 0.5rem; padding: 0 0.15rem; }
  .board-col-count { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 0 0.45rem; font-size: 0.7rem; color: var(--text-muted); }
  .task-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.625rem 0.7rem; margin-bottom: 0.5rem; box-shadow: var(--shadow); cursor: pointer; }
  .task-card:hover { border-color: #d1d1d6; }
  .task-card-proj { font-size: 11px; color: var(--text-muted); margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .task-card-title { font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; }
  .task-card-meta { display: flex; flex-wrap: wrap; gap: 0.3rem; font-size: 0.7rem; }
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
        <div class="login-brand-icon">🦞</div>
        <div class="login-brand-name">OpenClaw</div>
      </div>
      <p class="login-tagline">Your personal AI assistant — connecting every channel, every model, from one place.</p>
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
      <div class="sidebar-logo-icon">🦞</div>
      <div class="sidebar-logo-name">OpenClaw</div>
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
      <iframe id="chat-frame" title="OpenClaw Chat" allow="microphone"></iframe>
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
        <div class="tasks-toolbar">
          <select id="pt-project-filter" style="max-width:260px"><option value="all">All Projects</option></select>
          <button class="btn btn-ghost btn-sm" id="pt-edit-project" disabled>Edit Project</button>
        </div>
        <div id="pt-board"></div>
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
          <select id="pt-t-status">
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
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
        <div id="pt-t-assignees" class="member-picker"></div>
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

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
  // ── Access helpers ──────────────────────────────────────────────────────────
  function userPermissions(){ return (currentUser && currentUser.permissions) || []; }
  function hasFeature(f){ return userPermissions().some(function(p){ return p.permissionType === 'feature' && p.value === f; }); }
  function hasReport(k){ return userPermissions().some(function(p){ return p.permissionType === 'report' && p.value === k; }); }

  var PORTAL_REPORTS = [
    { key: 'report-cancellations', title: 'Agent Cancellation Report' },
    { key: 'rankings', title: 'Agent & Company Rankings' },
    { key: 'photographers', title: 'Photographers' }
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
        '<div class="report-view" data-view="photographers" style="display:none"><div class="card" style="padding:0" id="prt-photographers"></div></div>';
      portalReportTables['report-cancellations'] = createReportTable({ containerId:'prt-cancel', reportKey:'p-cancellations', frozenFirst:true, emptyMsg:'No data cached for this range yet.', columns: portalCancelCols() });
      portalReportTables['rankings-agents'] = createReportTable({ containerId:'prt-rank-agents', reportKey:'p-rankings-agents', emptyMsg:'No data cached for this range yet.', columns: portalRankCols('Agent') });
      portalReportTables['rankings-companies'] = createReportTable({ containerId:'prt-rank-companies', reportKey:'p-rankings-companies', emptyMsg:'No data cached for this range yet.', columns: portalRankCols('Company') });
      portalReportTables['photographers'] = createReportTable({ containerId:'prt-photographers', reportKey:'p-photographers', frozenFirst:true, emptyMsg:'No photographers cached yet.', columns: portalPhotographerCols() });
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
    }
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
  const PT_STATUSES = [
    { key: 'todo', label: 'Todo' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: '✓ Done' },
  ];

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
  function ptReadMemberPicker(containerId) {
    return Array.prototype.slice.call(document.querySelectorAll('#' + containerId + ' input[type=checkbox]:checked')).map(function(cb) { return cb.value; });
  }

  function ptFormatDate(ms) { return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

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
    ptRenderBoard();
  }

  function ptRenderBoard() {
    const board = document.getElementById('pt-board');
    const tasks = ptTasks.filter(function(t) {
      if (t.parentTaskId) return false;
      if (ptFilter !== 'all') return t.projectId === ptFilter;
      return true;
    });
    board.innerHTML = '<div class="board-wrap">' + PT_STATUSES.map(function(st) {
      const matching = tasks.filter(function(t) { return t.status === st.key; });
      const cards = matching.length
        ? matching.map(ptTaskCard).join('')
        : '<div class="board-empty">No tasks</div>';
      return '<div class="board-col">' +
        '<div class="board-col-head"><span>' + st.label + '</span><span class="board-col-count">' + matching.length + '</span></div>' +
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

  function ptTaskCard(task) {
    const proj = task.projectId ? ptProjects.find(function(p) { return p.id === task.projectId; }) : null;
    let html = '<div class="task-card" data-id="' + esc(task.id) + '">';
    if (proj) html += '<div class="task-card-proj" style="border-left:3px solid ' + esc(proj.color || '#3b82f6') + ';padding-left:6px">' + esc(proj.title) + '</div>';
    html += '<div class="task-card-title">' + esc(task.title) + '</div>';
    html += '<div class="task-card-meta">';
    html += '<span class="task-chip prio-' + esc(task.priority) + '">' + esc(task.priority) + '</span>';
    if (task.dueDate) {
      const overdue = task.dueDate < Date.now() && task.status !== 'done';
      html += '<span class="task-chip' + (overdue ? ' overdue' : '') + '">📅 ' + esc(ptFormatDate(task.dueDate)) + '</span>';
    }
    const names = (task.assigneeIds || []).map(ptUserLabel);
    if (names.length) html += '<span class="task-chip">👤 ' + esc(names.slice(0, 2).join(', ')) + (names.length > 2 ? ' +' + (names.length - 2) : '') + '</span>';
    html += '</div></div>';
    return html;
  }

  function ptPopulateProjectSelect(selectedId) {
    document.getElementById('pt-t-project').innerHTML = '<option value="">— No Project —</option>' +
      ptProjects.map(function(p) { return '<option value="' + esc(p.id) + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.title) + '</option>'; }).join('');
  }

  // Task modal
  document.getElementById('pt-new-task').addEventListener('click', function() { ptOpenTask(null); });
  function ptOpenTask(task) {
    ptEditingTask = task ? task.id : null;
    document.getElementById('pt-task-title').textContent = task ? 'Edit Task' : 'New Task';
    document.getElementById('pt-task-error').classList.add('hidden');
    document.getElementById('pt-t-title').value = task ? task.title : '';
    document.getElementById('pt-t-desc').value = task ? (task.description || '') : '';
    document.getElementById('pt-t-status').value = task ? task.status : 'todo';
    document.getElementById('pt-t-priority').value = task ? task.priority : 'medium';
    ptPopulateProjectSelect(task ? (task.projectId || '') : (ptFilter !== 'all' ? ptFilter : ''));
    document.getElementById('pt-t-due').value = task && task.dueDate ? new Date(task.dueDate).toISOString().slice(0,10) : '';
    ptRenderMemberPicker('pt-t-assignees', task ? (task.assigneeIds || []) : []);
    document.getElementById('pt-task-delete').classList.toggle('hidden', !task);
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
      dueDate: dueVal ? new Date(dueVal).getTime() : null,
      assigneeIds: ptReadMemberPicker('pt-t-assignees'),
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
    ptRenderBoard();
  });
  function ptOpenProject(project) {
    ptEditingProject = project ? project.id : null;
    document.getElementById('pt-project-title').textContent = project ? 'Edit Project' : 'New Project';
    document.getElementById('pt-project-error').classList.add('hidden');
    document.getElementById('pt-p-name').value = project ? project.title : '';
    document.getElementById('pt-p-desc').value = project ? (project.description || '') : '';
    document.getElementById('pt-p-status').value = project ? project.status : 'active';
    document.getElementById('pt-p-start').value = project && project.startDate ? new Date(project.startDate).toISOString().slice(0,10) : '';
    document.getElementById('pt-p-end').value = project && project.endDate ? new Date(project.endDate).toISOString().slice(0,10) : '';
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
      startDate: startVal ? new Date(startVal).getTime() : null,
      endDate: endVal ? new Date(endVal).getTime() : null,
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
