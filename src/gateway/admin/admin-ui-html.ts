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
  .main { flex: 1; overflow-x: hidden; min-width: 0; display: flex; flex-direction: column; }
  .topbar { padding: 1rem 1.75rem; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
  .topbar h2 { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.01em; }
  .content { padding: 1.75rem; flex: 1; }
  #page-chat { flex: 1; display: flex; flex-direction: column; min-height: 0; background: #000; }
  #admin-chat-frame { flex: 1; width: 100%; border: none; display: block; }

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
  .resource-desc { font-size: 0.825rem; color: var(--text-muted); margin-bottom: 0.75rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
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
      <a href="#chat" class="nav-link" data-page="chat"><span class="icon">💬</span> Chat</a>
      <a href="#resources" class="nav-link admin-only" data-page="resources"><span class="icon">📚</span> Resources</a>
      <a href="#system" class="nav-link admin-only" data-page="system"><span class="icon">⚙</span> System</a>
      <a href="#account" class="nav-link" data-page="account"><span class="icon">👤</span> My Account</a>
    </nav>
    <div class="sidebar-footer">
      <button class="btn btn-ghost btn-sm" id="logout-btn" style="width:100%">Sign out</button>
    </div>
  </aside>

  <main class="main">
    <div class="topbar" id="main-topbar">
      <h2 id="page-title">Dashboard</h2>
    </div>
    <div class="content" id="main-content">

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

    </div>

    <!-- Chat page — outside .content so iframe fills remaining height -->
    <div id="page-chat" class="page hidden">
      <iframe id="admin-chat-frame" title="OpenClaw Chat" allow="microphone"></iframe>
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
  let gatewayConfig = null;
  let chatFrameMounted = false;

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
    chat: { el: 'page-chat', title: 'Chat', adminOnly: false },
    resources: { el: 'page-resources', title: 'Resource Library', adminOnly: true },
    system: { el: 'page-system', title: 'System', adminOnly: true },
    account: { el: 'page-account', title: 'My Account', adminOnly: false },
  };

  function mountAdminChatFrame() {
    if (chatFrameMounted) return;
    chatFrameMounted = true;
    const frame = document.getElementById('admin-chat-frame');
    const cfg = gatewayConfig;
    if (!cfg) return;
    const hash = [];
    if (cfg.gatewayWsUrl) hash.push('gatewayUrl=' + encodeURIComponent(cfg.gatewayWsUrl));
    const credential = cfg.gatewayToken || cfg.gatewayPassword || '';
    if (credential) hash.push('token=' + encodeURIComponent(credential));
    frame.src = '/chat' + (hash.length ? '#' + hash.join('&') : '');
  }

  function navigate(page) {
    const def = pages[page];
    if (!def) page = 'dashboard', def = pages.dashboard;
    if (def.adminOnly && !isAdmin()) { page = 'dashboard'; }
    const isChatPage = page === 'chat';
    document.getElementById('main-topbar').classList.toggle('hidden', isChatPage);
    document.getElementById('main-content').classList.toggle('hidden', isChatPage);
    document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
    document.getElementById(def.el).classList.remove('hidden');
    document.getElementById('page-title').textContent = def.title;
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });
    if (page === 'users') loadUsers();
    if (page === 'agents') loadAgents();
    if (page === 'resources') loadResources();
    if (page === 'system') loadSystem();
    if (page === 'dashboard') loadDashboard();
    if (page === 'chat') mountAdminChatFrame();
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
    await showApp();
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('POST', '/auth/logout');
    token = null;
    currentUser = null;
    gatewayConfig = null;
    chatFrameMounted = false;
    localStorage.removeItem('oc_admin_token');
    document.getElementById('admin-chat-frame').src = 'about:blank';
    location.reload();
  });

  async function tryRestoreSession() {
    if (!token) return false;
    const r = await api('GET', '/auth/me');
    if (!r.ok) { token = null; localStorage.removeItem('oc_admin_token'); return false; }
    currentUser = r.data;
    return true;
  }

  async function showApp() {
    // Non-admin users belong in the user portal, not the admin panel.
    if (!isAdmin()) {
      localStorage.removeItem('oc_admin_token');
      token = null;
      window.location.replace('/portal');
      return;
    }
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('sidebar-username').textContent = currentUser.username;
    document.getElementById('sidebar-role').textContent = currentUser.role;
    // Hide admin-only nav for non-admins
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', !isAdmin());
    });
    // Fetch gateway config for the chat iframe
    const cfgRes = await api('GET', '/portal/config');
    if (cfgRes.ok) gatewayConfig = cfgRes.data;
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

  // ── Resources ─────────────────────────────────────────────────────────────
  let resourceActiveTags = new Set();
  let resourceSearchTimer = null;
  let resourceModalTags = [];
  let resourceEditId = null;

  function renderResourceCards(resources, allTags) {
    const grid = document.getElementById('resources-grid');
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
          <button class="btn btn-ghost btn-sm" onclick="openEditResource(\${JSON.stringify(JSON.stringify(r))})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteResource('\${esc(r.id)}','\${esc(r.title)}')">Delete</button>
        </div>\` : '';
      const fileLink = r.type === 'file'
        ? \`<a class="btn btn-ghost btn-sm" href="\${API}/resources/\${esc(r.id)}/file" target="_blank" style="text-decoration:none">↓ Download</a>\`
        : \`<a class="btn btn-ghost btn-sm" href="\${esc(r.url)}" target="_blank" rel="noopener" style="text-decoration:none">↗ Open</a>\`;
      return \`
        <div class="resource-card">
          <div class="resource-card-body">
            <div class="resource-card-title">
              <span class="resource-type-icon">\${typeIcon}</span>
              <span class="resource-title-text">\${esc(r.title)}</span>
            </div>
            \${r.description ? \`<div class="resource-desc">\${esc(r.description)}</div>\` : ''}
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

  window.openEditResource = function(jsonStr) {
    const r = JSON.parse(jsonStr);
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
      await showApp();
    }
  })();
})();
</script>
</body>
</html>
`;
