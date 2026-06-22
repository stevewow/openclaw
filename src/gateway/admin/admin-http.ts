import type { IncomingMessage, ServerResponse } from "node:http";
import { getRuntimeConfig } from "../../config/io.js";
import { readJsonBody } from "../hooks.js";
import { sendJson, setDefaultSecurityHeaders } from "../http-common.js";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import {
  createSession,
  createUser,
  deleteSession,
  deleteUser,
  ensureSuperadminExists,
  getUserByUsername,
  getUserPermissions,
  listUsers,
  resolveSessionUser,
  setUserPermissions,
  updateUser,
  verifyPassword,
} from "./user-store.js";
import type { AdminUserRole } from "./types.js";

const ADMIN_PATH_PREFIX = "/api/admin";
const MAX_BODY_BYTES = 64 * 1024;

function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PATH_PREFIX || pathname.startsWith(`${ADMIN_PATH_PREFIX}/`);
}

function parseAdminPath(pathname: string): string {
  return pathname.slice(ADMIN_PATH_PREFIX.length) || "/";
}

function getBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

function sendForbidden(res: ServerResponse) {
  sendJson(res, 403, { error: "forbidden" });
}

function sendNotFound(res: ServerResponse) {
  sendJson(res, 404, { error: "not_found" });
}

function sendBadRequest(res: ServerResponse, message: string) {
  sendJson(res, 400, { error: message });
}

function sendMethodNotAllowed(res: ServerResponse) {
  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  sendJson(res, 405, { error: "method_not_allowed" });
}

function normalizeString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function normalizeRole(v: unknown): AdminUserRole | null {
  if (v === "superadmin" || v === "admin" || v === "user") return v;
  return null;
}

let initialized = false;
export async function ensureAdminInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await ensureSuperadminExists();
}

export async function handleAdminHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!isAdminPath(url.pathname)) return false;

  setDefaultSecurityHeaders(res);
  res.setHeader("Access-Control-Allow-Origin", req.headers["origin"] ?? "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  const subPath = parseAdminPath(url.pathname);

  // POST /api/admin/auth/login — no auth required
  if (subPath === "/auth/login" && req.method === "POST") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const username = normalizeString(data.username);
    const password = normalizeString(data.password);
    if (!username || !password) {
      sendBadRequest(res, "username and password required");
      return true;
    }
    const user = await getUserByUsername(username);
    if (!user) {
      // Constant-time-ish response to avoid username enumeration
      await new Promise((r) => setTimeout(r, 200));
      sendJson(res, 401, { error: "invalid_credentials" });
      return true;
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return true;
    }
    const session = await createSession(user.id);
    sendJson(res, 200, {
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: user.id, username: user.username, role: user.role },
    });
    return true;
  }

  // All other routes require a valid session
  const token = getBearerToken(req);
  const sessionUser = token ? await resolveSessionUser(token) : null;

  if (!sessionUser) {
    sendJson(res, 401, { error: "unauthorized" });
    return true;
  }

  const isAdmin = sessionUser.role === "superadmin" || sessionUser.role === "admin";

  // POST /api/admin/auth/logout
  if (subPath === "/auth/logout" && req.method === "POST") {
    if (token) await deleteSession(token);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/admin/auth/me
  if (subPath === "/auth/me" && req.method === "GET") {
    const perms = await getUserPermissions(sessionUser.id);
    sendJson(res, 200, {
      id: sessionUser.id,
      username: sessionUser.username,
      role: sessionUser.role,
      permissions: perms,
    });
    return true;
  }

  // GET /api/admin/users — admin only
  if (subPath === "/users" && req.method === "GET") {
    if (!isAdmin) { sendForbidden(res); return true; }
    const users = await listUsers();
    sendJson(res, 200, { users });
    return true;
  }

  // POST /api/admin/users — admin only
  if (subPath === "/users" && req.method === "POST") {
    if (!isAdmin) { sendForbidden(res); return true; }
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) { sendBadRequest(res, body.error); return true; }
    const data = body.value as Record<string, unknown>;
    const username = normalizeString(data.username);
    const password = normalizeString(data.password);
    const role = normalizeRole(data.role) ?? "user";
    if (!username || !password) { sendBadRequest(res, "username and password required"); return true; }
    // Only superadmin can create admins
    if (role !== "user" && sessionUser.role !== "superadmin") { sendForbidden(res); return true; }
    try {
      const user = await createUser({ username, password, role });
      sendJson(res, 201, { user });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE constraint")) {
        sendBadRequest(res, "username already exists");
      } else {
        throw err;
      }
    }
    return true;
  }

  // PUT /api/admin/users/:id — admin only (or self for password change)
  const userEditMatch = subPath.match(/^\/users\/([^/]+)$/);
  if (userEditMatch && req.method === "PUT") {
    const targetId = userEditMatch[1]!;
    const isSelf = targetId === sessionUser.id;
    if (!isAdmin && !isSelf) { sendForbidden(res); return true; }
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) { sendBadRequest(res, body.error); return true; }
    const data = body.value as Record<string, unknown>;
    const params: { username?: string; password?: string; role?: AdminUserRole } = {};
    const newUsername = normalizeString(data.username);
    const newPassword = normalizeString(data.password);
    const newRole = normalizeRole(data.role);
    if (newUsername) params.username = newUsername;
    if (newPassword) params.password = newPassword;
    if (newRole) {
      if (sessionUser.role !== "superadmin") { sendForbidden(res); return true; }
      params.role = newRole;
    }
    const updated = await updateUser(targetId, params);
    if (!updated) { sendNotFound(res); return true; }
    sendJson(res, 200, { user: updated });
    return true;
  }

  // DELETE /api/admin/users/:id — admin only, cannot self-delete
  const userDeleteMatch = subPath.match(/^\/users\/([^/]+)$/);
  if (userDeleteMatch && req.method === "DELETE") {
    if (!isAdmin) { sendForbidden(res); return true; }
    const targetId = userDeleteMatch[1]!;
    if (targetId === sessionUser.id) { sendBadRequest(res, "cannot delete own account"); return true; }
    await deleteUser(targetId);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/admin/users/:id/permissions — admin only
  const userPermsMatch = subPath.match(/^\/users\/([^/]+)\/permissions$/);
  if (userPermsMatch && req.method === "GET") {
    if (!isAdmin) { sendForbidden(res); return true; }
    const targetId = userPermsMatch[1]!;
    const perms = await getUserPermissions(targetId);
    sendJson(res, 200, { permissions: perms });
    return true;
  }

  // PUT /api/admin/users/:id/permissions — admin only
  if (userPermsMatch && req.method === "PUT") {
    if (!isAdmin) { sendForbidden(res); return true; }
    const targetId = userPermsMatch[1]!;
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) { sendBadRequest(res, body.error); return true; }
    const data = body.value as Record<string, unknown>;
    const perms = Array.isArray(data.permissions)
      ? (data.permissions as Array<{ permissionType: string; value: string }>).filter(
          (p) => p && typeof p.permissionType === "string" && typeof p.value === "string",
        )
      : [];
    await setUserPermissions(targetId, perms);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/admin/agents — list agents from config
  if (subPath === "/agents" && req.method === "GET") {
    const cfg = getRuntimeConfig();
    const { listGatewayAgentsBasic } = await import("../agent-list.js");
    const result = listGatewayAgentsBasic(cfg);
    sendJson(res, 200, { agents: result.agents, defaultId: result.defaultId });
    return true;
  }

  // GET /api/admin/system — system info (admin only)
  if (subPath === "/system" && req.method === "GET") {
    if (!isAdmin) { sendForbidden(res); return true; }
    const { resolveRuntimeServiceVersion } = await import("../../version.js");
    const cfg = getRuntimeConfig();
    sendJson(res, 200, {
      version: resolveRuntimeServiceVersion(),
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()),
      model: cfg.agents?.model ?? cfg.model ?? null,
    });
    return true;
  }

  // GET /api/admin/me/password — change own password
  if (subPath === "/me/password" && req.method === "PUT") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) { sendBadRequest(res, body.error); return true; }
    const data = body.value as Record<string, unknown>;
    const currentPassword = normalizeString(data.currentPassword);
    const newPassword = normalizeString(data.newPassword);
    if (!currentPassword || !newPassword) { sendBadRequest(res, "currentPassword and newPassword required"); return true; }
    const userWithHash = await getUserByUsername(sessionUser.username);
    if (!userWithHash) { sendNotFound(res); return true; }
    const valid = await verifyPassword(currentPassword, userWithHash.passwordHash);
    if (!valid) { sendJson(res, 401, { error: "invalid_current_password" }); return true; }
    await updateUser(sessionUser.id, { password: newPassword });
    sendJson(res, 200, { ok: true });
    return true;
  }

  sendNotFound(res);
  return true;
}

export async function handleAdminUiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/")) return false;
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  setDefaultSecurityHeaders(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.end(ADMIN_UI_HTML);
  return true;
}
