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
  .sidebar { width: 220px; background: var(--sidebar-bg); display: flex; flex-direction: column; flex-shrink: 0; position: sticky; top: 0; height: 100vh; }
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
  .main { flex: 1; overflow-x: hidden; min-width: 0; }
  .topbar { padding: 1rem 1.75rem; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
  .topbar h2 { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.01em; }
  .content { padding: 1.75rem; }

  /* Cards */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1rem; box-shadow: var(--shadow); }
  .card-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 0.75rem; letter-spacing: -0.01em; }

  /* Forms */
  .form-group { margin-bottom: 1.125rem; }
  label { display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
  input, select, textarea { width: 100%; padding: 0.6rem 0.875rem; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; color: var(--text); font-size: 14px; font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(192,0,10,0.1); }

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

  .hidden { display: none !important; }
  .text-muted { color: var(--text-muted); }
  .empty-state { text-align: center; padding: 3rem; color: var(--text-muted); font-size: 0.875rem; }
  .spin { animation: spin 1s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Page sections */
  .page { display: none; }
  .page.active { display: block; }

  /* Welcome banner */
  .welcome-banner { background: linear-gradient(135deg, #111111 0%, #1f1f1f 100%); border-radius: var(--radius); padding: 1.75rem; margin-bottom: 1.5rem; color: #fff; }
  .welcome-banner h1 { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.35rem; }
  .welcome-banner p { color: rgba(255,255,255,0.6); font-size: 0.9rem; }

  /* Agent grid */
  .agents-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
  .agent-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
  .agent-card-header { display: flex; align-items: center; gap: 0.875rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); }
  .agent-emoji { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; background: var(--surface2); }
  .agent-name { font-weight: 700; font-size: 0.95rem; letter-spacing: -0.01em; }
  .agent-id { color: var(--text-muted); font-size: 0.72rem; font-family: monospace; margin-top: 0.1rem; }
  .agent-card-body { padding: 0.875rem 1.25rem; }
  .agent-model { font-size: 0.8rem; color: var(--text-muted); font-family: monospace; margin-bottom: 0.75rem; }
  .agent-card-footer { padding: 0.75rem 1.25rem; border-top: 1px solid var(--border); background: var(--surface2); display: flex; gap: 0.5rem; }

  /* Resources grid */
  .resources-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
  .resource-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
  .resource-card-body { padding: 1rem 1.25rem; }
  .resource-title { font-weight: 700; font-size: 0.9rem; letter-spacing: -0.01em; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.5rem; }
  .resource-desc { font-size: 0.825rem; color: var(--text-muted); margin-bottom: 0.75rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .resource-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .resource-tag { padding: 0.15rem 0.5rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 999px; font-size: 0.7rem; font-weight: 600; color: var(--text-muted); }
  .resource-card-footer { padding: 0.625rem 1.25rem; background: var(--surface2); border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: flex-end; }

  /* Account form */
  .account-section { max-width: 480px; }
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
      <a href="#home" class="nav-link active" data-page="home"><span class="icon">⊞</span> Home</a>
      <a href="#agents" class="nav-link" data-page="agents"><span class="icon">🤖</span> Agents</a>
      <a href="#resources" class="nav-link" data-page="resources"><span class="icon">📚</span> Resources</a>
      <a href="#account" class="nav-link" data-page="account"><span class="icon">👤</span> My Account</a>
    </nav>
    <div class="sidebar-footer">
      <button class="btn btn-ghost btn-sm" id="logout-btn" style="width:100%">Sign out</button>
    </div>
  </aside>

  <main class="main">
    <!-- Home -->
    <div id="page-home" class="page active">
      <div class="topbar"><h2>Home</h2></div>
      <div class="content">
        <div class="welcome-banner">
          <h1 id="welcome-name">Welcome back!</h1>
          <p>Select an agent below to start chatting, or browse your resources.</p>
        </div>
        <div class="card">
          <div class="card-title">Your Agents</div>
          <div id="home-agents-grid" class="agents-grid"></div>
        </div>
      </div>
    </div>

    <!-- Agents -->
    <div id="page-agents" class="page">
      <div class="topbar"><h2>Agents</h2></div>
      <div class="content">
        <div id="agents-grid" class="agents-grid"></div>
      </div>
    </div>

    <!-- Resources -->
    <div id="page-resources" class="page">
      <div class="topbar"><h2>Resources</h2></div>
      <div class="content">
        <div id="resources-grid" class="resources-grid"></div>
      </div>
    </div>

    <!-- Account -->
    <div id="page-account" class="page">
      <div class="topbar"><h2>My Account</h2></div>
      <div class="content">
        <div class="card account-section">
          <div class="card-title">Account Info</div>
          <div id="account-info" style="margin-bottom:1.25rem;font-size:0.875rem;color:var(--text-muted)"></div>
          <div class="card-title" style="margin-top:1.25rem">Change Password</div>
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
  </main>
</div>

<script>
  let token = localStorage.getItem('oc_portal_token');
  let currentUser = null;

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch('/api/admin' + path, opts);
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  async function login(username, password) {
    const r = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, data };
  }

  async function loadMe() {
    if (!token) return false;
    const r = await api('GET', '/me');
    if (!r.ok) { token = null; localStorage.removeItem('oc_portal_token'); return false; }
    currentUser = r.data;
    return true;
  }

  function showApp() {
    // Admins belong in the admin panel
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
      window.location.replace('/admin');
      return;
    }
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('sidebar-username').textContent = currentUser.username;
    document.getElementById('sidebar-role').textContent = currentUser.role;
    document.getElementById('welcome-name').textContent = 'Welcome back, ' + currentUser.username + '!';
    document.getElementById('account-info').innerHTML =
      '<strong>' + esc(currentUser.username) + '</strong> &mdash; ' + esc(currentUser.role);
    const page = location.hash.replace('#', '') || 'home';
    navigate(page);
    loadAgents();
    loadResources();
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  function navigate(page) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');
    const navEl = document.querySelector('.nav-link[data-page="' + page + '"]');
    if (navEl) navEl.classList.add('active');
    location.hash = page;
  }

  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.dataset.page);
    });
  });

  window.addEventListener('hashchange', () => {
    const page = location.hash.replace('#', '') || 'home';
    navigate(page);
  });

  // ── Agents ───────────────────────────────────────────────────────────────
  function agentCardHtml(a) {
    const emoji = a.emoji || '🤖';
    const chatUrl = '/?agent=' + encodeURIComponent(a.id);
    return \`<div class="agent-card">
      <div class="agent-card-header">
        <div class="agent-emoji">\${esc(emoji)}</div>
        <div>
          <div class="agent-name">\${esc(a.name || a.id)}</div>
          <div class="agent-id">\${esc(a.id)}</div>
        </div>
      </div>
      <div class="agent-card-body">
        <div class="agent-model">\${esc(a.model || 'default model')}</div>
      </div>
      <div class="agent-card-footer">
        <a href="\${esc(chatUrl)}" class="btn btn-primary btn-sm">Open Chat</a>
      </div>
    </div>\`;
  }

  async function loadAgents() {
    const r = await api('GET', '/agents');
    const agents = r.ok ? (r.data.agents ?? []) : [];
    const homeGrid = document.getElementById('home-agents-grid');
    const agentsGrid = document.getElementById('agents-grid');
    if (!agents.length) {
      homeGrid.innerHTML = '<div class="empty-state">No agents configured.</div>';
      agentsGrid.innerHTML = '<div class="empty-state">No agents configured.</div>';
      return;
    }
    const html = agents.map(agentCardHtml).join('');
    homeGrid.innerHTML = html;
    agentsGrid.innerHTML = html;
  }

  // ── Resources ────────────────────────────────────────────────────────────
  function resourceTypeIcon(type) {
    if (type === 'file') return '📄';
    if (type === 'link') return '🔗';
    if (type === 'text') return '📝';
    return '📦';
  }

  function resourceCardHtml(r) {
    const tags = (r.tags ?? []).map(t => \`<span class="resource-tag">\${esc(t)}</span>\`).join('');
    const footer = r.type === 'file'
      ? \`<a href="/api/admin/resources/\${esc(r.id)}/file" class="btn btn-ghost btn-sm" download>Download</a>\`
      : r.type === 'link' && r.url
      ? \`<a href="\${esc(r.url)}" target="_blank" rel="noreferrer noopener" class="btn btn-ghost btn-sm">Open Link</a>\`
      : '';
    return \`<div class="resource-card">
      <div class="resource-card-body">
        <div class="resource-title">\${resourceTypeIcon(r.type)} \${esc(r.title)}</div>
        \${r.description ? \`<div class="resource-desc">\${esc(r.description)}</div>\` : ''}
        \${tags ? \`<div class="resource-tags">\${tags}</div>\` : ''}
      </div>
      \${footer ? \`<div class="resource-card-footer">\${footer}</div>\` : ''}
    </div>\`;
  }

  async function loadResources() {
    const r = await api('GET', '/resources');
    const resources = r.ok ? (r.data.resources ?? []) : [];
    const grid = document.getElementById('resources-grid');
    if (!resources.length) {
      grid.innerHTML = '<div class="empty-state">No resources available.</div>';
      return;
    }
    grid.innerHTML = resources.map(resourceCardHtml).join('');
  }

  // ── Login ────────────────────────────────────────────────────────────────
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const result = await login(username, password).catch(() => ({ ok: false, data: {} }));
    if (!result.ok) {
      errEl.textContent = result.data?.error || 'Invalid username or password.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign in';
      return;
    }
    token = result.data.token;
    localStorage.setItem('oc_portal_token', token);
    currentUser = result.data.user;
    showApp();
    btn.disabled = false;
    btn.textContent = 'Sign in';
  });

  // ── Logout ───────────────────────────────────────────────────────────────
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('POST', '/auth/logout').catch(() => {});
    token = null;
    currentUser = null;
    localStorage.removeItem('oc_portal_token');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  });

  // ── Change Password ──────────────────────────────────────────────────────
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

  // ── Init ─────────────────────────────────────────────────────────────────
  (async () => {
    if (token && await loadMe()) {
      showApp();
    }
  })();
</script>
</body>
</html>`;
