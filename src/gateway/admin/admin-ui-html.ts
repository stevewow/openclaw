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

  /* Layout */
  .app { display: flex; min-height: 100vh; }
  .sidebar { width: 240px; background: var(--sidebar-bg); display: flex; flex-direction: column; flex-shrink: 0; position: sticky; top: 0; height: 100vh; }
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
  .sidebar-footer { padding: 0.875rem 0.75rem; border-top: 1px solid var(--sidebar-border); }
  .main { flex: 1; overflow-x: hidden; min-width: 0; }
  .topbar { padding: 1rem 1.75rem; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
  .topbar h2 { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.01em; }
  .content { padding: 1.75rem; }

  /* Cards */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1rem; box-shadow: var(--shadow); }
  .card-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 0.75rem; letter-spacing: -0.01em; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; box-shadow: var(--shadow); border-top: 3px solid var(--accent); }
  .stat-label { color: var(--text-muted); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
  .stat-value { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.03em; color: var(--text); }

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

  /* Modal */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
  .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.75rem; width: 100%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
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
    <nav id="sidebar-nav">
      <a href="#dashboard" class="nav-link" data-page="dashboard"><span class="icon">⊞</span> Dashboard</a>
      <a href="#users" class="nav-link admin-only" data-page="users"><span class="icon">👥</span> Users</a>
      <a href="#agents" class="nav-link" data-page="agents"><span class="icon">🤖</span> Agents</a>
      <a href="#system" class="nav-link admin-only" data-page="system"><span class="icon">⚙</span> System</a>
      <a href="#account" class="nav-link" data-page="account"><span class="icon">👤</span> My Account</a>
    </nav>
    <div class="sidebar-footer">
      <button class="btn btn-ghost btn-sm" id="logout-btn" style="width:100%">Sign out</button>
    </div>
  </aside>

  <main class="main">
    <div class="topbar">
      <h2 id="page-title">Dashboard</h2>
    </div>
    <div class="content">

      <!-- Dashboard page -->
      <div id="page-dashboard" class="page">
        <div class="stats-grid" id="stats-grid"></div>
        <div class="card">
          <div class="card-title">Welcome to OpenClaw Admin</div>
          <p class="text-muted">Manage your AI assistant, users, agents, and system settings from this dashboard.</p>
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
                  <th>Role</th>
                  <th>Last Login</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="users-table-body">
                <tr><td colspan="5" class="empty-state">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Agents page -->
      <div id="page-agents" class="page hidden">
        <div id="agents-chat-hint" class="info-box hidden">
          <strong>Chatting with Agents</strong>
          As superadmin, you can chat with any agent directly in the OpenClaw interface.
          Visit <a href="/" target="_blank">openclaw.wowvideotours.com</a> and use the agent selector in the top bar to switch between agents.
          Other users will only interact with the main agent.
        </div>
        <div id="agents-grid" class="agents-grid">
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

    </div>
  </main>
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

<!-- User Permissions Modal -->
<div id="perms-modal" class="modal-backdrop hidden">
  <div class="modal" style="max-width:500px">
    <div class="modal-title">Manage Permissions: <span id="perms-modal-username"></span></div>
    <div class="tabs">
      <div class="tab active" data-tab="agents-tab">Agents</div>
      <div class="tab" data-tab="skills-tab">Skills</div>
      <div class="tab" data-tab="channels-tab">Channels</div>
    </div>
    <div id="agents-tab" class="tab-content">
      <div id="perms-agents-list"></div>
    </div>
    <div id="skills-tab" class="tab-content hidden">
      <p class="text-muted">Skill permissions coming soon.</p>
    </div>
    <div id="channels-tab" class="tab-content hidden">
      <p class="text-muted">Channel permissions coming soon.</p>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="perms-modal-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="perms-modal-save">Save Permissions</button>
    </div>
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
  const pages = {
    dashboard: { el: 'page-dashboard', title: 'Dashboard', adminOnly: false },
    users: { el: 'page-users', title: 'Users', adminOnly: true },
    agents: { el: 'page-agents', title: 'Agents', adminOnly: false },
    system: { el: 'page-system', title: 'System', adminOnly: true },
    account: { el: 'page-account', title: 'My Account', adminOnly: false },
  };

  function navigate(page) {
    const def = pages[page];
    if (!def) page = 'dashboard', def = pages.dashboard;
    if (def.adminOnly && !isAdmin()) { page = 'dashboard'; }
    document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
    document.getElementById(def.el).classList.remove('hidden');
    document.getElementById('page-title').textContent = def.title;
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });
    if (page === 'users') loadUsers();
    if (page === 'agents') loadAgents();
    if (page === 'system') loadSystem();
    if (page === 'dashboard') loadDashboard();
    location.hash = '#' + page;
  }

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
    currentUser = r.data.user;
    showApp();
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('POST', '/auth/logout');
    token = null;
    currentUser = null;
    localStorage.removeItem('oc_admin_token');
    location.reload();
  });

  async function tryRestoreSession() {
    if (!token) return false;
    const r = await api('GET', '/auth/me');
    if (!r.ok) { token = null; localStorage.removeItem('oc_admin_token'); return false; }
    currentUser = r.data;
    return true;
  }

  function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('sidebar-username').textContent = currentUser.username;
    document.getElementById('sidebar-role').textContent = currentUser.role;
    // Hide admin-only nav for non-admins
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', !isAdmin());
    });
    // Show superadmin role option only for superadmins
    const page = location.hash.replace('#', '') || 'dashboard';
    navigate(page);
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  async function loadDashboard() {
    const grid = document.getElementById('stats-grid');
    grid.innerHTML = '';
    if (isAdmin()) {
      const [usersR, agentsR] = await Promise.all([api('GET', '/users'), api('GET', '/agents')]);
      const stats = [
        { label: 'Users', value: usersR.ok ? usersR.data.users.length : '—' },
        { label: 'Agents', value: agentsR.ok ? agentsR.data.agents.length : '—' },
        { label: 'Your Role', value: currentUser.role },
      ];
      grid.innerHTML = stats.map(s => \`
        <div class="stat-card">
          <div class="stat-label">\${s.label}</div>
          <div class="stat-value">\${s.value}</div>
        </div>\`).join('');
    } else {
      grid.innerHTML = \`<div class="stat-card"><div class="stat-label">Your Role</div><div class="stat-value">\${currentUser.role}</div></div>\`;
    }
  }

  // ── Users ────────────────────────────────────────────────────────────────
  async function loadUsers() {
    const body = document.getElementById('users-table-body');
    body.innerHTML = '<tr><td colspan="5" class="empty-state"><span class="spin">⟳</span> Loading…</td></tr>';
    const r = await api('GET', '/users');
    if (!r.ok) { body.innerHTML = '<tr><td colspan="5" class="empty-state">Failed to load users.</td></tr>'; return; }
    const users = r.data.users;
    if (!users.length) { body.innerHTML = '<tr><td colspan="5" class="empty-state">No users yet.</td></tr>'; return; }
    body.innerHTML = users.map(u => \`
      <tr>
        <td><strong>\${esc(u.username)}</strong></td>
        <td><span class="badge badge-\${u.role}">\${u.role}</span></td>
        <td class="text-muted">\${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
        <td class="text-muted">\${new Date(u.createdAt).toLocaleDateString()}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" onclick="openEditUser('\${esc(u.id)}','\${esc(u.username)}','\${esc(u.role)}')">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="openPermsModal('\${esc(u.id)}','\${esc(u.username)}')">Permissions</button>
            \${u.id !== currentUser.id ? \`<button class="btn btn-danger btn-sm" onclick="deleteUser('\${esc(u.id)}','\${esc(u.username)}')">Delete</button>\` : ''}
          </div>
        </td>
      </tr>\`).join('');
  }

  window.openEditUser = function(id, username, role) {
    document.getElementById('user-modal-title').textContent = 'Edit User';
    document.getElementById('modal-user-id').value = id;
    document.getElementById('modal-username').value = username;
    document.getElementById('modal-password').value = '';
    document.getElementById('modal-pw-label').textContent = 'New Password (leave blank to keep)';
    document.getElementById('modal-password').required = false;
    document.getElementById('modal-role').value = role;
    document.getElementById('user-modal-submit').textContent = 'Save Changes';
    document.getElementById('modal-role-group').classList.toggle('hidden', !isSuperAdmin());
    document.getElementById('user-modal-error').classList.add('hidden');
    document.getElementById('user-modal').classList.remove('hidden');
  };

  document.getElementById('add-user-btn').addEventListener('click', () => {
    document.getElementById('user-modal-title').textContent = 'Add User';
    document.getElementById('modal-user-id').value = '';
    document.getElementById('modal-username').value = '';
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
    const errEl = document.getElementById('user-modal-error');
    errEl.classList.add('hidden');
    let r;
    if (id) {
      const body = { username, role };
      if (password) body.password = password;
      r = await api('PUT', '/users/' + id, body);
    } else {
      r = await api('POST', '/users', { username, password, role });
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
  window.openPermsModal = async function(userId, username) {
    permsModalUserId = userId;
    document.getElementById('perms-modal-username').textContent = username;
    document.getElementById('perms-modal').classList.remove('hidden');
    // Load agents and current permissions
    const [agentsR, permsR] = await Promise.all([api('GET', '/agents'), api('GET', '/users/' + userId + '/permissions')]);
    allAgents = agentsR.ok ? agentsR.data.agents : [];
    const perms = permsR.ok ? permsR.data.permissions : [];
    const grantedAgents = new Set(perms.filter(p => p.permissionType === 'agent').map(p => p.value));
    const list = document.getElementById('perms-agents-list');
    list.innerHTML = allAgents.length === 0
      ? '<p class="text-muted">No agents found.</p>'
      : allAgents.map(a => \`
        <div class="flex items-center gap-2 mb-4" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
          <input type="checkbox" id="agent-perm-\${esc(a.id)}" value="\${esc(a.id)}" \${grantedAgents.has(a.id) ? 'checked' : ''}>
          <label for="agent-perm-\${esc(a.id)}" style="margin:0;font-weight:normal">\${esc(a.name || a.id)}</label>
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
            \${isSuperAdmin() ? \`<a href="/" target="_blank" class="btn btn-primary btn-sm">Open Chat ↗</a>\` : ''}
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

  // ── Nav ───────────────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.page); });
  });
  window.addEventListener('hashchange', () => {
    const page = location.hash.replace('#', '');
    if (page && pages[page]) navigate(page);
  });

  // ── Utils ─────────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function formatUptime(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? \`\${h}h \${m}m\` : \`\${m}m\`;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  (async () => {
    if (token && await tryRestoreSession()) {
      showApp();
    }
  })();
})();
</script>
</body>
</html>
`;
