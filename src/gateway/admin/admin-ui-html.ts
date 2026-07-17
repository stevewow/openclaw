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
  .board-column { flex: 0 0 280px; display: flex; flex-direction: column; }
  .board-col-header { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.875rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px 8px 0 0; border-bottom: none; }
  .board-col-title { font-weight: 700; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .board-col-count { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); background: var(--surface2); border: 1px solid var(--border); border-radius: 999px; padding: 0.1rem 0.5rem; min-width: 24px; text-align: center; }
  .board-col-body { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-top: 2px solid var(--border); padding: 0.625rem; min-height: 300px; }
  .board-add-btn { width: 100%; padding: 0.5rem; background: transparent; border: 1px dashed var(--border); border-top: none; border-radius: 0 0 8px 8px; color: var(--text-muted); font-size: 0.8rem; cursor: pointer; transition: all 0.12s; font-family: inherit; }
  .board-add-btn:hover { background: var(--surface); color: var(--accent); border-color: var(--accent); }
  .board-empty { font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1.5rem 0.5rem; }
  .task-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow); margin-bottom: 0.5rem; cursor: pointer; overflow: hidden; transition: box-shadow 0.12s, transform 0.1s; display: flex; }
  .task-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-1px); }
  .task-card-project-bar { width: 4px; flex-shrink: 0; }
  .task-card-body { padding: 0.7rem 0.75rem; flex: 1; min-width: 0; }
  .task-card-title { font-weight: 600; font-size: 0.875rem; line-height: 1.35; margin-bottom: 0.3rem; color: var(--text); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .task-card-project-badge { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700; margin-bottom: 0.35rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .task-card-meta { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-top: 0.2rem; }
  .task-due { font-size: 0.7rem; color: var(--text-muted); font-weight: 500; }
  .task-recurrence { font-size: 0.7rem; color: var(--text-muted); font-weight: 500; text-transform: capitalize; }
  .task-due-overdue { color: #ef4444 !important; font-weight: 700; }
  .task-assignee { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 0.6rem; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .task-subtask-count { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 0 0.3rem; }
  .task-tags { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-top: 0.35rem; }
  .task-tag { padding: 0.1rem 0.35rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; font-size: 0.65rem; font-weight: 500; color: var(--text-muted); }
  .cal-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
  .cal-header { display: flex; align-items: center; justify-content: space-between; padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border); }
  .cal-title { font-weight: 700; font-size: 1.05rem; letter-spacing: -0.01em; }
  .cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--border); background: var(--surface2); }
  .cal-weekday { padding: 0.5rem 0.4rem; text-align: center; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-right: 1px solid var(--border); }
  .cal-weekday:last-child { border-right: none; }
  .cal-days { display: grid; grid-template-columns: repeat(7, 1fr); }
  .cal-day { min-height: 90px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 0.35rem 0.4rem; cursor: pointer; transition: background 0.1s; }
  .cal-day:hover { background: var(--surface2); }
  .cal-day:nth-child(7n) { border-right: none; }
  .cal-day-num { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.2rem; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
  .cal-day.today .cal-day-num { background: var(--accent); color: #fff; }
  .cal-day.other-month { background: #fafafa; cursor: default; }
  .cal-day.other-month .cal-day-num { color: #d1d5db; }
  .cal-task-chip { display: block; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.65rem; font-weight: 600; color: #fff; margin-bottom: 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
  .cal-task-chip:hover { opacity: 0.85; }
  .cal-more { font-size: 0.65rem; color: var(--text-muted); font-weight: 600; padding: 0 0.3rem; }
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
    .cal-day { min-height: 64px; padding: 0.25rem; }
    .cal-day-num { font-size: 0.7rem; width: 18px; height: 18px; }
    .cal-task-chip { font-size: 0.6rem; }
    .cal-weekday { font-size: 0.6rem; padding: 0.4rem 0.2rem; }
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
            <button class="view-btn" id="view-projects-btn">📁 Projects</button>
          </div>
          <div class="proj-filter-wrap">
            <select class="project-select" id="project-filter-sel">
              <option value="all">All Projects</option>
            </select>
            <button class="btn btn-ghost btn-sm" id="edit-project-btn" style="padding:0.4rem 0.6rem" title="Edit selected project" disabled>✎</button>
          </div>
          <div style="margin-left:auto;display:flex;gap:0.5rem;flex-shrink:0">
            <button class="btn btn-ghost btn-sm" id="add-project-btn">+ New Project</button>
            <button class="btn btn-primary btn-sm" id="add-task-btn">+ New Task</button>
          </div>
        </div>

        <div id="projects-board">
          <div class="board-wrap">
            <div class="board-column">
              <div class="board-col-header">
                <span class="board-col-title">Todo</span>
                <span class="board-col-count" id="col-count-todo">0</span>
              </div>
              <div class="board-col-body" id="col-todo"><div class="board-empty">No tasks yet</div></div>
              <button class="board-add-btn" data-status="todo">+ Add Task</button>
            </div>
            <div class="board-column">
              <div class="board-col-header">
                <span class="board-col-title" style="color:#3b82f6">In Progress</span>
                <span class="board-col-count" id="col-count-in_progress">0</span>
              </div>
              <div class="board-col-body" style="border-top-color:#3b82f6" id="col-in_progress"><div class="board-empty">No tasks yet</div></div>
              <button class="board-add-btn" data-status="in_progress">+ Add Task</button>
            </div>
            <div class="board-column">
              <div class="board-col-header">
                <span class="board-col-title" style="color:#f59e0b">Review</span>
                <span class="board-col-count" id="col-count-review">0</span>
              </div>
              <div class="board-col-body" style="border-top-color:#f59e0b" id="col-review"><div class="board-empty">No tasks yet</div></div>
              <button class="board-add-btn" data-status="review">+ Add Task</button>
            </div>
            <div class="board-column">
              <div class="board-col-header">
                <span class="board-col-title" style="color:var(--success)">✓ Done</span>
                <span class="board-col-count" id="col-count-done">0</span>
              </div>
              <div class="board-col-body" style="border-top-color:var(--success)" id="col-done"><div class="board-empty">No tasks yet</div></div>
              <button class="board-add-btn" data-status="done">+ Add Task</button>
            </div>
          </div>
        </div>

        <div id="projects-calendar" class="hidden">
          <div class="cal-wrap">
            <div class="cal-header">
              <button class="btn btn-ghost btn-sm" id="cal-prev-btn">← Prev</button>
              <span class="cal-title" id="cal-title"></span>
              <button class="btn btn-ghost btn-sm" id="cal-next-btn">Next →</button>
            </div>
            <div class="cal-weekdays">
              <div class="cal-weekday">Sun</div><div class="cal-weekday">Mon</div><div class="cal-weekday">Tue</div>
              <div class="cal-weekday">Wed</div><div class="cal-weekday">Thu</div><div class="cal-weekday">Fri</div>
              <div class="cal-weekday">Sat</div>
            </div>
            <div class="cal-days" id="cal-days"></div>
          </div>
        </div>

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
        <div class="card" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Total Orders</th>
                  <th>Cancellations</th>
                  <th>Reschedules</th>
                  <th>% Cancelled/Rescheduled</th>
                </tr>
              </thead>
              <tbody id="report-table-body">
                <tr><td colspan="5" class="empty-state">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
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
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Agent</th><th>Orders</th><th>Cancellations</th><th>Reschedules</th><th>% Canc./Resch.</th></tr>
                </thead>
                <tbody id="rank-agents-body"><tr><td colspan="6" class="empty-state">Loading...</td></tr></tbody>
              </table>
            </div>
          </div>
          <div class="card" style="padding:0">
            <div style="padding:0.875rem 1.25rem;font-weight:700;border-bottom:1px solid var(--border)">🏢 Company Ranking</div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Company</th><th>Orders</th><th>Cancellations</th><th>Reschedules</th><th>% Canc./Resch.</th></tr>
                </thead>
                <tbody id="rank-companies-body"><tr><td colspan="6" class="empty-state">Loading...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
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
              <div class="text-muted" style="font-size:0.8rem;max-width:640px;margin-top:0.15rem">
                Unpaid Spiro invoices past their due date, grouped by payee and staged against the collections policy.
                Outstanding equals the invoice total; partial payments are not exposed by the Spiro API.
              </div>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:0.75rem">
              <span class="text-muted" id="fin-refreshed-at" style="font-size:0.8rem"></span>
              <button class="btn btn-primary btn-sm" id="fin-refresh-btn">↻ Refresh now</button>
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
        <div class="card" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Balance</th>
                  <th>Invoices</th>
                  <th>Oldest Past Due</th>
                  <th>Stage</th>
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody id="fin-table-body">
                <tr><td colspan="7" class="empty-state">Loading...</td></tr>
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
          <select id="task-status">
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
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
      <div class="tab active" data-tab="agents-tab">Agents</div>
      <div class="tab" data-tab="skills-tab">Skills</div>
      <div class="tab" data-tab="channels-tab">Channels</div>
    </div>
    <div id="agents-tab" class="tab-content">
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
    <div style="display:flex;gap:0.5rem;margin-bottom:1.25rem;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" id="fin-followup-btn">+ Create follow-up task</button>
    </div>
    <div style="font-weight:700;margin-bottom:0.5rem">Past-due invoices</div>
    <div class="table-wrap" style="margin-bottom:1.25rem">
      <table>
        <thead><tr><th>Reference</th><th>Status</th><th>Amount</th><th>Due</th><th>Days</th></tr></thead>
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
  const pages = {
    dashboard: { el: 'page-dashboard', title: 'Dashboard', adminOnly: false, superAdminOnly: false },
    users: { el: 'page-users', title: 'Users', adminOnly: true, superAdminOnly: false },
    agents: { el: 'page-agents', title: 'Agents', adminOnly: false, superAdminOnly: true },
    chat: { el: 'page-chat', title: 'Chat', adminOnly: false, superAdminOnly: false },
    resources: { el: 'page-resources', title: 'Resource Library', adminOnly: true, superAdminOnly: false },
    system: { el: 'page-system', title: 'System', adminOnly: true, superAdminOnly: true },
    account: { el: 'page-account', title: 'My Account', adminOnly: false, superAdminOnly: false },
    projects: { el: 'page-projects', title: 'Projects', adminOnly: false, superAdminOnly: false },
    reports: { el: 'page-reports-home', title: 'Reports', adminOnly: true, superAdminOnly: false },
    'report-cancellations': { el: 'page-reports', title: 'Agent Cancellation Report', adminOnly: true, superAdminOnly: false },
    rankings: { el: 'page-rankings', title: 'Agent & Company Rankings', adminOnly: true, superAdminOnly: false },
    tickets: { el: 'page-tickets', title: 'Support Tickets', adminOnly: true, superAdminOnly: false },
    departments: { el: 'page-departments', title: 'Departments', adminOnly: true, superAdminOnly: false },
    categories: { el: 'page-categories', title: 'Request Types', adminOnly: true, superAdminOnly: false },
    'form-preview': { el: 'page-form-preview', title: 'Intake Form', adminOnly: true, superAdminOnly: false },
    financials: { el: 'page-financials', title: 'Past Due Accounts', adminOnly: true, superAdminOnly: false },
    cleveland: { el: 'page-cleveland', title: 'Cleveland Investment', adminOnly: true, superAdminOnly: false },
  };

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
    if ((def.adminOnly && !isAdmin()) || (def.superAdminOnly && !isSuperAdmin())) {
      page = 'dashboard';
      def = pages.dashboard;
    }
    const isChatPage = page === 'chat';
    document.getElementById('main-topbar').classList.toggle('hidden', isChatPage);
    document.getElementById('main-content').classList.toggle('hidden', isChatPage);
    document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
    document.getElementById(def.el).classList.remove('hidden');
    document.getElementById('page-title').textContent = def.title;
    // Report sub-pages are reached from the Reports landing, not their own nav
    // item, so keep the Reports nav entry highlighted while viewing one.
    const navKey = (page === 'report-cancellations' || page === 'rankings' || page === 'photographers') ? 'reports' : page;
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
    if (page === 'tickets') loadTickets();
    if (page === 'departments') loadDepartments();
    if (page === 'categories') loadCategories();
    if (page === 'form-preview') loadFormPreview();
    if (page === 'financials') loadFinancials();
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
    // Non-admin users belong in the user portal, not the admin panel.
    if (!isAdmin()) {
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
    // Fetch gateway config for the chat iframe
    const cfgRes = await api('GET', '/portal/config');
    if (cfgRes.ok) gatewayConfig = cfgRes.data;
    // Show superadmin role option only for superadmins
    const page = location.hash.replace('#', '') || 'dashboard';
    navigate(page);
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
    const openTasks = tasks.filter(function(t) { return t.status !== 'done'; });
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
  window.openPermsModal = async function(userId, username) {
    permsModalUserId = userId;
    document.getElementById('perms-modal-username').textContent = username;
    document.getElementById('perms-modal').classList.remove('hidden');
    // Reset to Agents tab
    document.querySelectorAll('#perms-modal .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#perms-modal .tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelector('#perms-modal .tab[data-tab="agents-tab"]').classList.add('active');
    document.getElementById('agents-tab').classList.remove('hidden');
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

  async function loadReportTable() {
    const from = document.getElementById('report-from-sel').value;
    const to = document.getElementById('report-to-sel').value;
    const market = document.getElementById('report-market-sel').value;
    const qs = new URLSearchParams({ from, to });
    if (market) qs.set('market', market);
    const r = await api('GET', '/reports/agent-cancellations?' + qs.toString());
    const tbody = document.getElementById('report-table-body');
    const statsEl = document.getElementById('report-stats-grid');
    if (!r.ok) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Failed to load report.</td></tr>';
      statsEl.innerHTML = '';
      return;
    }
    const report = r.data.report;
    statsEl.innerHTML = \`
      <div class="stat-card"><div class="stat-label">Total Orders</div><div class="stat-value">\${report.totals.totalOrders}</div></div>
      <div class="stat-card"><div class="stat-label">Cancellations</div><div class="stat-value">\${report.totals.cancellations}</div></div>
      <div class="stat-card"><div class="stat-label">Reschedules</div><div class="stat-value">\${report.totals.reschedules}</div></div>
      <div class="stat-card"><div class="stat-label">% Cancelled/Rescheduled</div><div class="stat-value">\${report.totals.cancelledOrRescheduledPct.toFixed(1)}%</div></div>\`;
    if (report.rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No orders cached for this range yet. Try Refresh now.</td></tr>';
      return;
    }
    tbody.innerHTML = report.rows.map(row => \`
      <tr>
        <td>\${esc(row.client)}</td>
        <td>\${row.totalOrders}</td>
        <td>\${row.cancellations}</td>
        <td>\${row.reschedules}</td>
        <td>\${row.cancelledOrRescheduledPct.toFixed(1)}%</td>
      </tr>\`).join('');
  }

  // The report catalog powers the landing page. One entry per report; adding a
  // report here (with its page key) surfaces it on the landing with no other
  // wiring. Later this list is filtered by the viewer's report permissions.
  var REPORTS = [
    { key: 'report-cancellations', icon: '📉', title: 'Agent Cancellation Report', desc: 'Cancellations and reschedules per client over a chosen date range and market.' },
    { key: 'rankings', icon: '🏆', title: 'Agent & Company Rankings', desc: 'Agents and companies ranked by order volume, with cancellation and reschedule rates.' }
  ];
  function loadReportsHome() {
    var grid = document.getElementById('reports-home-grid');
    grid.innerHTML = REPORTS.map(function(r){
      return '<button class="report-card" data-report="'+esc(r.key)+'">'+
        '<span class="report-card-icon">'+r.icon+'</span>'+
        '<span class="report-card-title">'+esc(r.title)+'</span>'+
        '<span class="report-card-desc">'+esc(r.desc)+'</span>'+
        '</button>';
    }).join('');
    grid.querySelectorAll('.report-card').forEach(function(btn){
      btn.addEventListener('click', function(){ navigate(btn.dataset.report); });
    });
    if (!REPORTS.length) grid.innerHTML = '<div class="empty-state">No reports are available to you.</div>';
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

  function renderRankRows(rows, emptyMsg) {
    if (!rows || rows.length === 0) return '<tr><td colspan="6" class="empty-state">' + emptyMsg + '</td></tr>';
    return rows.map(row => \`
      <tr>
        <td style="font-weight:700;color:var(--text-muted)">\${row.rank}</td>
        <td>\${esc(row.name)}</td>
        <td>\${row.totalOrders}</td>
        <td>\${row.cancellations}</td>
        <td>\${row.reschedules}</td>
        <td>\${row.cancelledOrRescheduledPct.toFixed(1)}%</td>
      </tr>\`).join('');
  }

  async function loadRankTables() {
    const from = document.getElementById('rank-from-sel').value;
    const to = document.getElementById('rank-to-sel').value;
    const market = document.getElementById('rank-market-sel').value;
    const qs = new URLSearchParams({ from, to });
    if (market) qs.set('market', market);
    const agentsBody = document.getElementById('rank-agents-body');
    const companiesBody = document.getElementById('rank-companies-body');
    const r = await api('GET', '/reports/rankings?' + qs.toString());
    if (!r.ok) {
      agentsBody.innerHTML = '<tr><td colspan="6" class="empty-state">Failed to load rankings.</td></tr>';
      companiesBody.innerHTML = '<tr><td colspan="6" class="empty-state">Failed to load rankings.</td></tr>';
      return;
    }
    const report = r.data.report;
    agentsBody.innerHTML = renderRankRows(report.agents, 'No orders cached for this range yet. Try Refresh now.');
    companiesBody.innerHTML = renderRankRows(report.companies, 'No company data yet — click Refresh now to pull it.');
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

  // ── Financials: Past Due Accounts ──────────────────────────────────────────
  let finBreakdown = null;
  let finAccount = null; // currently open account detail

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
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Failed to load past-due accounts.</td></tr>';
      statsEl.innerHTML = '';
      return;
    }
    finBreakdown = r.data.breakdown;
    refEl.textContent = finBreakdown.refreshedAt
      ? 'Last refreshed: ' + new Date(finBreakdown.refreshedAt).toLocaleString()
      : 'Never refreshed — click Refresh now';

    const bucketAmt = {};
    (finBreakdown.byBucket || []).forEach(b => { bucketAmt[b.bucket] = b; });
    const tile = (label, value) => \`<div class="stat-card"><div class="stat-label">\${label}</div><div class="stat-value">\${value}</div></div>\`;
    statsEl.innerHTML =
      tile('Total Past Due', money(finBreakdown.totalPastDue)) +
      tile('Accounts', finBreakdown.accountCount) +
      tile('Invoices', finBreakdown.invoiceCount) +
      tile('90+ Days', money((bucketAmt['90-119'] ? bucketAmt['90-119'].amount : 0) + (bucketAmt['120+'] ? bucketAmt['120+'].amount : 0)));

    renderFinTable();
  }

  function renderFinTable() {
    const tbody = document.getElementById('fin-table-body');
    const accounts = (finBreakdown && finBreakdown.accounts) || [];
    if (accounts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No past-due accounts. If this looks wrong, click Refresh now to pull the latest invoices from Spiro.</td></tr>';
      return;
    }
    tbody.innerHTML = accounts.map(a => \`
      <tr class="fin-row-click" data-account="\${esc(a.accountKey)}">
        <td>\${esc(a.accountName)}</td>
        <td class="text-muted" style="text-transform:capitalize">\${esc(a.accountType)}</td>
        <td>\${money(a.balance)}</td>
        <td>\${a.invoiceCount}</td>
        <td>\${a.oldestDaysPastDue} days</td>
        <td><span class="\${bucketClass(a.bucket)}">\${esc(a.bucket)}</span></td>
        <td>\${esc(a.action.label)}</td>
      </tr>\`).join('');
    tbody.querySelectorAll('.fin-row-click').forEach(row => {
      row.addEventListener('click', () => openFinAccount(row.dataset.account));
    });
  }

  async function openFinAccount(accountKey) {
    const acct = (finBreakdown.accounts || []).find(a => a.accountKey === accountKey);
    const r = await api('GET', '/financials/accounts/' + encodeURIComponent(accountKey));
    if (!r.ok) { alert('Failed to load account.'); return; }
    finAccount = Object.assign({}, r.data, { bucket: acct && acct.bucket, action: acct && acct.action });
    document.getElementById('fin-modal-title').textContent = r.data.accountName;
    const balance = (r.data.invoices || []).reduce((s, i) => s + i.amount, 0);
    const plan = r.data.paymentPlan || {};
    const action = acct ? acct.action : null;
    document.getElementById('fin-modal-summary').innerHTML =
      '<div style="display:flex;gap:1.25rem;flex-wrap:wrap;margin-bottom:0.5rem">' +
        '<span><strong>' + money(balance) + '</strong> outstanding</span>' +
        (acct ? '<span class="' + bucketClass(acct.bucket) + '">' + esc(acct.bucket) + ' days</span>' : '') +
      '</div>' +
      (action ? '<div class="text-muted"><strong>' + esc(action.label) + ':</strong> ' + esc(action.detail) + '</div>' : '') +
      '<div class="text-muted" style="margin-top:0.4rem">Payment plan per policy: ' + money(plan.requiredDown) +
        ' down (10%), up to ' + plan.maxMonths + ' months.</div>';

    const invBody = document.getElementById('fin-modal-invoices');
    invBody.innerHTML = (r.data.invoices || []).map(i => \`
      <tr>
        <td>\${esc(i.referenceNumber || i.invoiceId)}</td>
        <td class="text-muted">\${esc(i.status || '—')}</td>
        <td>\${money(i.amount)}</td>
        <td>\${finDate(i.dateDue)}</td>
        <td>\${i.daysPastDue}</td>
      </tr>\`).join('') || '<tr><td colspan="5" class="empty-state">No past-due invoices.</td></tr>';

    renderFinNotes(r.data.notes || []);
    const followBtn = document.getElementById('fin-followup-btn');
    followBtn.disabled = false;
    followBtn.textContent = '+ Create follow-up task';
    document.getElementById('fin-modal').classList.remove('hidden');
  }

  function renderFinNotes(notes) {
    const el = document.getElementById('fin-notes-list');
    if (!notes.length) { el.innerHTML = '<div class="text-muted" style="font-size:0.85rem">No notes yet.</div>'; return; }
    el.innerHTML = notes.map(n => \`
      <div class="fin-note">
        <div>\${esc(n.body)}</div>
        <div class="fin-note-meta">
          <span>\${new Date(n.createdAt).toLocaleString()}</span>
          <span class="fin-note-del" data-id="\${esc(n.id)}" style="cursor:pointer;color:var(--accent)">Delete</span>
        </div>
      </div>\`).join('');
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
    const balance = (finAccount.invoices || []).reduce((s, i) => s + i.amount, 0);
    const bucket = acct ? acct.bucket : '';
    const action = acct ? acct.action : { label: 'Follow up', detail: '' };
    const title = 'Collections: ' + finAccount.accountName + ' — ' + action.label;
    const desc = action.label + '. ' + action.detail + '\\n\\n' +
      'Account: ' + finAccount.accountName + '\\n' +
      'Outstanding: ' + money(balance) + '\\n' +
      'Oldest past due: ' + (acct ? acct.oldestDaysPastDue + ' days (' + bucket + ')' : 'n/a') + '\\n' +
      'Invoices past due: ' + (finAccount.invoices || []).length;
    const btn = document.getElementById('fin-followup-btn');
    btn.disabled = true;
    btn.textContent = 'Creating…';
    const r = await api('POST', '/financials/follow-up-task', {
      title, description: desc, priority: bucketPriority(bucket), dueDate: Date.now(),
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
          if (fin && !fin.classList.contains('hidden')) refreshFinancials();
          else if (cle && !cle.classList.contains('hidden')) refreshCleveland();
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
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth(); // 0-11
  let taskModalTags = [];
  let projModalTags = [];
  let editingTaskId = null;
  let editingProjectId = null;

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

  async function loadProjects() {
    await ensureUsersLoaded();
    const [pr, tr] = await Promise.all([api('GET', '/projects'), api('GET', '/tasks')]);
    if (pr.ok) allProjects = pr.data.projects || [];
    if (tr.ok) allTasks = tr.data.tasks || [];
    const sel = document.getElementById('project-filter-sel');
    const prev = sel.value;
    sel.innerHTML = '<option value="">All Projects</option>' +
      allProjects.map(function(p) { return '<option value="' + esc(p.id) + '">' + esc(p.title) + '</option>'; }).join('');
    sel.value = prev && allProjects.find(function(p) { return p.id === prev; }) ? prev : '';
    projectsFilter = sel.value;
    renderProjectsPage();
  }

  function getFilteredTasks() {
    return allTasks.filter(function(t) {
      if (t.parentTaskId) return false; // subtasks shown in modal only
      if (projectsFilter) return t.projectId === projectsFilter;
      return true;
    });
  }

  function renderProjectsPage() {
    document.getElementById('projects-board').classList.toggle('hidden', projectsView !== 'board');
    document.getElementById('projects-calendar').classList.toggle('hidden', projectsView !== 'calendar');
    document.getElementById('projects-list').classList.toggle('hidden', projectsView !== 'list');
    if (projectsView === 'board') renderBoard();
    else if (projectsView === 'calendar') renderCalendar();
    else renderProjectsList();
    const editBtn = document.getElementById('edit-project-btn');
    editBtn.disabled = !projectsFilter;
  }

  // View toggle
  function switchProjectsView(view) {
    projectsView = view;
    document.getElementById('view-board-btn').classList.toggle('active', view === 'board');
    document.getElementById('view-cal-btn').classList.toggle('active', view === 'calendar');
    document.getElementById('view-projects-btn').classList.toggle('active', view === 'list');
    renderProjectsPage();
  }
  document.getElementById('view-board-btn').addEventListener('click', function() { switchProjectsView('board'); });
  document.getElementById('view-cal-btn').addEventListener('click', function() { switchProjectsView('calendar'); });
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
      const doneCount = tasksForProj.filter(function(t) { return t.status === 'done'; }).length;
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
          (p.tags && p.tags.length ? '<div class="resource-tags">' + p.tags.map(function(t) { return '<span class="resource-tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        '</div>' +
        '<div class="resource-card-footer">' +
          '<button type="button" class="btn btn-ghost btn-sm proj-list-view-btn" data-id="' + esc(p.id) + '">View Tasks</button>' +
          '<button type="button" class="btn btn-ghost btn-sm proj-list-edit-btn" data-id="' + esc(p.id) + '">Edit</button>' +
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

  // New project / task buttons
  document.getElementById('add-project-btn').addEventListener('click', function() { openAddProject(); });
  document.getElementById('add-task-btn').addEventListener('click', function() { openAddTask('todo', null); });

  // Board add-task buttons (event delegation on board container)
  document.getElementById('projects-board').addEventListener('click', function(e) {
    const addBtn = e.target.closest('.board-add-btn');
    if (addBtn) { openAddTask(addBtn.dataset.status, null); return; }
    const card = e.target.closest('.task-card');
    if (card) { openEditTask(card.dataset.id); return; }
  });

  // Calendar event delegation
  document.getElementById('projects-calendar').addEventListener('click', function(e) {
    const chip = e.target.closest('.cal-chip');
    if (chip) { openEditTask(chip.dataset.id); return; }
    const day = e.target.closest('.cal-day[data-date]');
    if (day && !e.target.closest('.cal-chip')) { openAddTask('todo', parseInt(day.dataset.date, 10)); }
  });

  // Calendar prev/next
  document.getElementById('cal-prev-btn').addEventListener('click', function() {
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById('cal-next-btn').addEventListener('click', function() {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  function renderBoard() {
    const statuses = ['todo', 'in_progress', 'review', 'done'];
    const tasks = getFilteredTasks();
    statuses.forEach(function(status) {
      const col = document.getElementById('col-' + status);
      const countEl = document.getElementById('col-count-' + status);
      const matching = tasks.filter(function(t) { return t.status === status; });
      if (countEl) countEl.textContent = matching.length;
      if (col) col.innerHTML = matching.length ? matching.map(renderTaskCard).join('') : '<div class="board-empty">No tasks yet</div>';
    });
  }

  function renderTaskCard(task) {
    const prioMap = { low: { icon: '▿', cls: 'prio-low' }, medium: { icon: '●', cls: 'prio-med' }, high: { icon: '▲', cls: 'prio-high' }, urgent: { icon: '⚑', cls: 'prio-urgent' } };
    const prio = prioMap[task.priority] || prioMap.medium;
    const proj = task.projectId ? allProjects.find(function(p) { return p.id === task.projectId; }) : null;
    const subtasks = allTasks.filter(function(t) { return t.parentTaskId === task.id; });
    const doneSubs = subtasks.filter(function(t) { return t.status === 'done'; });

    let html = '<div class="task-card" data-id="' + esc(task.id) + '">';
    if (proj) {
      html += '<div class="task-card-proj" style="border-left:3px solid ' + esc(proj.color) + ';padding-left:6px;margin-bottom:4px;font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(proj.title) + '</div>';
    }
    html += '<div class="task-card-title">' + esc(task.title) + '</div>';
    html += '<div class="task-card-meta">';
    html += '<span class="task-prio ' + prio.cls + '">' + prio.icon + ' ' + esc(task.priority) + '</span>';
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      const now = new Date(); now.setHours(0,0,0,0);
      const overdue = d < now && task.status !== 'done';
      html += '<span class="task-due' + (overdue ? ' overdue' : '') + '">📅 ' + esc(formatDateShort(task.dueDate)) + '</span>';
    }
    const assigneeNames = (task.assigneeIds || []).map(userLabel);
    if (!assigneeNames.length && task.assignedTo) assigneeNames.push(task.assignedTo);
    if (assigneeNames.length) {
      const shown = assigneeNames.slice(0, 2).map(esc).join(', ');
      const extra = assigneeNames.length > 2 ? ' +' + (assigneeNames.length - 2) : '';
      html += '<span class="task-assignee" style="width:auto;border-radius:999px;padding:0 0.4rem">👤 ' + shown + extra + '</span>';
    }
    if (task.recurrence) html += '<span class="task-recurrence">🔁 ' + esc(task.recurrence) + '</span>';
    html += '</div>';
    if (task.tags && task.tags.length) {
      html += '<div class="task-tags">' + task.tags.map(function(t) { return '<span class="tag-chip">' + esc(t) + '</span>'; }).join('') + '</div>';
    }
    if (subtasks.length) {
      html += '<div class="task-subtask-bar"><span class="subtask-count">' + doneSubs.length + '/' + subtasks.length + ' subtasks</span></div>';
    }
    html += '</div>';
    return html;
  }

  function renderCalendar() {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('cal-title').textContent = monthNames[calMonth] + ' ' + calYear;
    const tasks = getFilteredTasks().filter(function(t) { return t.dueDate; });
    const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    let html = '';
    // Leading empty cells
    for (let i = 0; i < firstDay; i++) html += '<div class="cal-day cal-day-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStart = new Date(calYear, calMonth, d).getTime();
      const dayEnd = dayStart + 86400000;
      const dayTasks = tasks.filter(function(t) { return t.dueDate >= dayStart && t.dueDate < dayEnd; });
      const isToday = isSameDay(dayStart, today.getTime());
      html += '<div class="cal-day' + (isToday ? ' cal-today' : '') + '" data-date="' + dayStart + '">';
      html += '<div class="cal-day-num">' + d + '</div>';
      dayTasks.slice(0, 3).forEach(function(t) {
        const proj = t.projectId ? allProjects.find(function(p) { return p.id === t.projectId; }) : null;
        const color = proj ? proj.color : '#6b7280';
        html += '<div class="cal-chip" data-id="' + esc(t.id) + '" style="background:' + esc(color) + '20;border-left:2px solid ' + esc(color) + '" title="' + esc(t.title) + '">' + esc(t.title) + '</div>';
      });
      if (dayTasks.length > 3) html += '<div class="cal-chip-more">+' + (dayTasks.length - 3) + ' more</div>';
      html += '</div>';
    }
    document.getElementById('cal-days').innerHTML = html;
  }

  // ── Task Modal ─────────────────────────────────────────────────────────────
  function openAddTask(status, dateMs) {
    editingTaskId = null;
    taskModalTags = [];
    document.getElementById('task-modal-title').textContent = 'New Task';
    document.getElementById('task-modal-error').classList.add('hidden');
    document.getElementById('task-modal-form').reset();
    document.getElementById('task-modal-delete').classList.add('hidden');
    document.getElementById('task-subtasks-section').classList.add('hidden');
    document.getElementById('task-status').value = status || 'todo';
    document.getElementById('task-priority').value = 'medium';
    if (dateMs) {
      const d = new Date(dateMs);
      document.getElementById('task-due').value = d.toISOString().slice(0,10);
    }
    populateTaskProjectSelect(projectsFilter || '');
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
    document.getElementById('task-status').value = task.status;
    document.getElementById('task-priority').value = task.priority;
    document.getElementById('task-due').value = task.dueDate ? new Date(task.dueDate).toISOString().slice(0,10) : '';
    document.getElementById('task-recurrence').value = task.recurrence || '';
    populateTaskProjectSelect(task.projectId || '');
    renderTaskModalTags();
    renderMemberPicker('task-assignees-list', task.assigneeIds || []);
    document.getElementById('task-modal-delete').classList.remove('hidden');
    document.getElementById('task-subtasks-section').classList.remove('hidden');
    renderSubtasks(id);
    document.getElementById('task-modal').classList.remove('hidden');
    document.getElementById('task-title').focus();
  }

  function populateTaskProjectSelect(selectedId) {
    const sel = document.getElementById('task-project');
    sel.innerHTML = '<option value="">— No Project —</option>' +
      allProjects.map(function(p) { return '<option value="' + esc(p.id) + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.title) + '</option>'; }).join('');
  }

  function renderSubtasks(parentId) {
    const subs = allTasks.filter(function(t) { return t.parentTaskId === parentId; });
    const list = document.getElementById('subtasks-list');
    list.innerHTML = subs.map(function(s) {
      return '<div class="subtask-item" data-id="' + esc(s.id) + '">' +
        '<input type="checkbox" class="subtask-check"' + (s.status === 'done' ? ' checked' : '') + ' data-id="' + esc(s.id) + '">' +
        '<span class="subtask-label' + (s.status === 'done' ? ' done' : '') + '">' + esc(s.title) + '</span>' +
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
    await api('PUT', '/tasks/' + id, { status: done ? 'done' : 'todo' });
    const t = allTasks.find(function(t) { return t.id === id; });
    if (t) t.status = done ? 'done' : 'todo';
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
    const r = await api('POST', '/tasks', { title: title, parentTaskId: editingTaskId, status: 'todo', priority: 'medium' });
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
  function isSameDay(a, b) {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
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
