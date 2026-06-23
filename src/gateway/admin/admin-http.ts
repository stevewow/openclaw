import crypto from "node:crypto";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { getRuntimeConfig } from "../../config/io.js";
import type { ResolvedGatewayAuth } from "../auth-resolve.js";
import { readJsonBody } from "../hooks.js";
import { sendJson, setDefaultSecurityHeaders } from "../http-common.js";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

let _getResolvedAuth: (() => ResolvedGatewayAuth) | undefined;

export function setPortalAuthResolver(fn: () => ResolvedGatewayAuth): void {
  _getResolvedAuth = fn;
}
import {
  createResource,
  deleteResource,
  ensureResourcesDir,
  getAllTags,
  getResource,
  listResources,
  resolveResourceFilePath,
  updateResource,
} from "./resource-store.js";
import type { AdminUserRole } from "./types.js";
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

const MAX_BODY_BYTES_RESOURCE = 20 * 1024 * 1024; // 20 MB for file uploads (base64)

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

type RecentSession = {
  id: string;
  timestamp: string;
  firstMessage: string | null;
};

type WorkspaceSkill = {
  name: string;
  description: string | null;
};

async function readRecentSessions(sessionsDir: string, limit: number): Promise<RecentSession[]> {
  let files: { name: string; mtime: number }[] = [];
  try {
    const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
    const jsonlFiles = entries.filter(
      (e) => e.isFile() && e.name.endsWith(".jsonl") && !e.name.includes(".bak-"),
    );
    const stats = await Promise.all(
      jsonlFiles.map(async (e) => {
        const stat = await fs.stat(path.join(sessionsDir, e.name)).catch(() => null);
        return stat ? { name: e.name, mtime: stat.mtimeMs } : null;
      }),
    );
    files = stats.filter(Boolean) as { name: string; mtime: number }[];
    files.sort((a, b) => b.mtime - a.mtime);
    files = files.slice(0, limit);
  } catch {
    return [];
  }

  const results: RecentSession[] = [];
  for (const file of files) {
    const filePath = path.join(sessionsDir, file.name);
    try {
      const content = await fs.readFile(filePath, "utf8");
      const lines = content.split("\n").filter((l) => l.trim());
      let sessionId = file.name.replace(".jsonl", "");
      let sessionTimestamp = new Date(file.mtime).toISOString();
      let firstMessage: string | null = null;

      for (const line of lines.slice(0, 40)) {
        try {
          const evt = JSON.parse(line) as Record<string, unknown>;
          if (evt.type === "session") {
            if (typeof evt.id === "string") sessionId = evt.id;
            if (typeof evt.timestamp === "string") sessionTimestamp = evt.timestamp;
          }
          if (evt.type === "message" && !firstMessage) {
            const msg = evt.message as Record<string, unknown> | undefined;
            if (msg?.role === "user") {
              const content = msg.content as Array<{ type: string; text?: string }> | undefined;
              const textPart = content?.find((c) => c.type === "text");
              if (textPart?.text) {
                // Strip the timestamp prefix [Day YYYY-MM-DD HH:MM TZ]
                firstMessage = textPart.text.replace(/^\[[^\]]+\]\s*/, "").slice(0, 120);
              }
            }
          }
          if (firstMessage) break;
        } catch {
          continue;
        }
      }

      results.push({ id: sessionId, timestamp: sessionTimestamp, firstMessage });
    } catch {
      continue;
    }
  }
  return results;
}

async function readWorkspaceSkills(workspaceDir: string): Promise<WorkspaceSkill[]> {
  const skills: WorkspaceSkill[] = [];
  try {
    const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(workspaceDir, entry.name);
      // Check for SKILL.md or AGENT.md
      for (const marker of ["SKILL.md", "AGENT.md"]) {
        const markerPath = path.join(skillDir, marker);
        try {
          const content = await fs.readFile(markerPath, "utf8");
          const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
          const description = firstLine.replace(/^#+\s*/, "").trim() || null;
          skills.push({ name: entry.name, description });
          break;
        } catch {
          continue;
        }
      }
    }
  } catch {
    // workspace dir doesn't exist
  }
  return skills;
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

  // GET /api/admin/portal/config — gateway connection info for portal users
  if (subPath === "/portal/config" && req.method === "GET") {
    const auth = _getResolvedAuth?.();
    const host = req.headers.host ?? "localhost";
    const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? "http";
    const wsProto = proto === "https" ? "wss" : "ws";
    const gatewayWsUrl = `${wsProto}://${host}`;
    sendJson(res, 200, {
      gatewayWsUrl,
      gatewayToken: auth?.mode === "token" ? (auth.token ?? null) : null,
      gatewayPassword: auth?.mode === "password" ? (auth.password ?? null) : null,
      gatewayMode: auth?.mode ?? "none",
    });
    return true;
  }

  // GET /api/admin/users — admin only
  if (subPath === "/users" && req.method === "GET") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const users = await listUsers();
    sendJson(res, 200, { users });
    return true;
  }

  // POST /api/admin/users — admin only
  if (subPath === "/users" && req.method === "POST") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const username = normalizeString(data.username);
    const password = normalizeString(data.password);
    const role = normalizeRole(data.role) ?? "user";
    if (!username || !password) {
      sendBadRequest(res, "username and password required");
      return true;
    }
    // Only superadmin can create admins
    if (role !== "user" && sessionUser.role !== "superadmin") {
      sendForbidden(res);
      return true;
    }
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
    if (!isAdmin && !isSelf) {
      sendForbidden(res);
      return true;
    }
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const params: { username?: string; password?: string; role?: AdminUserRole } = {};
    const newUsername = normalizeString(data.username);
    const newPassword = normalizeString(data.password);
    const newRole = normalizeRole(data.role);
    if (newUsername) params.username = newUsername;
    if (newPassword) params.password = newPassword;
    if (newRole) {
      if (sessionUser.role !== "superadmin") {
        sendForbidden(res);
        return true;
      }
      params.role = newRole;
    }
    const updated = await updateUser(targetId, params);
    if (!updated) {
      sendNotFound(res);
      return true;
    }
    sendJson(res, 200, { user: updated });
    return true;
  }

  // DELETE /api/admin/users/:id — admin only, cannot self-delete
  const userDeleteMatch = subPath.match(/^\/users\/([^/]+)$/);
  if (userDeleteMatch && req.method === "DELETE") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const targetId = userDeleteMatch[1]!;
    if (targetId === sessionUser.id) {
      sendBadRequest(res, "cannot delete own account");
      return true;
    }
    await deleteUser(targetId);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/admin/users/:id/permissions — admin only
  const userPermsMatch = subPath.match(/^\/users\/([^/]+)\/permissions$/);
  if (userPermsMatch && req.method === "GET") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const targetId = userPermsMatch[1]!;
    const perms = await getUserPermissions(targetId);
    sendJson(res, 200, { permissions: perms });
    return true;
  }

  // PUT /api/admin/users/:id/permissions — admin only
  if (userPermsMatch && req.method === "PUT") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const targetId = userPermsMatch[1]!;
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
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
    // Augment with identity info from config
    const { resolveAgentConfig } = await import("../../agents/agent-scope-config.js");
    const agents = result.agents.map((a) => {
      const agentCfg = resolveAgentConfig(cfg, a.id);
      return {
        ...a,
        emoji: agentCfg?.identity?.emoji ?? null,
        theme: agentCfg?.identity?.theme ?? null,
        model: agentCfg?.model ?? cfg.agents?.model ?? cfg.model ?? null,
      };
    });
    sendJson(res, 200, { agents, defaultId: result.defaultId });
    return true;
  }

  // GET /api/admin/agents/:id — agent detail (skills + recent sessions)
  const agentDetailMatch = subPath.match(/^\/agents\/([^/]+)$/);
  if (agentDetailMatch && req.method === "GET") {
    const agentId = agentDetailMatch[1]!;
    const cfg = getRuntimeConfig();
    const { resolveAgentWorkspaceDir } = await import("../../agents/agent-scope-config.js");
    const { resolveStateDir } = await import("../../config/paths.js");
    const stateDir = resolveStateDir();
    const sessionsDir = path.join(stateDir, "agents", agentId, "sessions");
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const [recentSessions, workspaceSkills] = await Promise.all([
      readRecentSessions(sessionsDir, 5),
      readWorkspaceSkills(workspaceDir),
    ]);
    sendJson(res, 200, { agentId, recentSessions, workspaceSkills });
    return true;
  }

  // GET /api/admin/system — system info (admin only)
  if (subPath === "/system" && req.method === "GET") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
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
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const currentPassword = normalizeString(data.currentPassword);
    const newPassword = normalizeString(data.newPassword);
    if (!currentPassword || !newPassword) {
      sendBadRequest(res, "currentPassword and newPassword required");
      return true;
    }
    const userWithHash = await getUserByUsername(sessionUser.username);
    if (!userWithHash) {
      sendNotFound(res);
      return true;
    }
    const valid = await verifyPassword(currentPassword, userWithHash.passwordHash);
    if (!valid) {
      sendJson(res, 401, { error: "invalid_current_password" });
      return true;
    }
    await updateUser(sessionUser.id, { password: newPassword });
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/admin/resources — list resources
  if (subPath === "/resources" && req.method === "GET") {
    const search = url.searchParams.get("search") ?? undefined;
    const tagsParam = url.searchParams.get("tags");
    const tags = tagsParam
      ? tagsParam
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const isUser = !isAdmin;
    const resources = await listResources({
      search,
      tags: tags.length > 0 ? tags : undefined,
      userAccessOnly: isUser ? true : undefined,
    });
    const allTags = await getAllTags();
    sendJson(res, 200, { resources, allTags });
    return true;
  }

  // GET /api/admin/resources/tags — all tags
  if (subPath === "/resources/tags" && req.method === "GET") {
    sendJson(res, 200, { tags: await getAllTags() });
    return true;
  }

  // POST /api/admin/resources — create (admin only)
  if (subPath === "/resources" && req.method === "POST") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const body = await readJsonBody(req, MAX_BODY_BYTES_RESOURCE);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const title = normalizeString(data.title);
    if (!title) {
      sendBadRequest(res, "title required");
      return true;
    }
    const type = data.type === "file" ? "file" : "link";
    if (type === "link") {
      const urlVal = normalizeString(data.url);
      if (!urlVal) {
        sendBadRequest(res, "url required for link type");
        return true;
      }
      const resource = await createResource({
        title,
        description: normalizeString(data.description),
        type: "link",
        url: urlVal,
        tags: Array.isArray(data.tags)
          ? (data.tags as string[]).filter((t) => typeof t === "string")
          : [],
        aiAccess: data.aiAccess !== false,
        userAccess: !!data.userAccess,
        createdBy: sessionUser.id,
      });
      sendJson(res, 201, { resource });
    } else {
      const fileData = normalizeString(data.fileData);
      const filename = normalizeString(data.filename);
      if (!fileData || !filename) {
        sendBadRequest(res, "fileData and filename required for file type");
        return true;
      }
      await ensureResourcesDir();
      const ext = path.extname(filename).toLowerCase();
      const storedFilename = `${crypto.randomUUID()}${ext}`;
      const buf = Buffer.from(fileData, "base64");
      await import("node:fs/promises").then((fsp) =>
        fsp.writeFile(resolveResourceFilePath(storedFilename), buf),
      );
      const mimetype = normalizeString(data.mimetype) ?? "application/octet-stream";
      const resource = await createResource({
        title,
        description: normalizeString(data.description),
        type: "file",
        filename,
        storedFilename,
        mimetype,
        filesize: buf.byteLength,
        tags: Array.isArray(data.tags)
          ? (data.tags as string[]).filter((t) => typeof t === "string")
          : [],
        aiAccess: data.aiAccess !== false,
        userAccess: !!data.userAccess,
        createdBy: sessionUser.id,
      });
      sendJson(res, 201, { resource });
    }
    return true;
  }

  // GET /api/admin/resources/:id/file — download file
  const resourceFileMatch = subPath.match(/^\/resources\/([^/]+)\/file$/);
  if (resourceFileMatch && req.method === "GET") {
    const resourceId = resourceFileMatch[1]!;
    const resource = await getResource(resourceId);
    if (!resource || resource.type !== "file" || !resource.storedFilename) {
      sendNotFound(res);
      return true;
    }
    if (!isAdmin && !resource.userAccess) {
      sendForbidden(res);
      return true;
    }
    const filePath = resolveResourceFilePath(resource.storedFilename);
    try {
      const fileContent = await import("node:fs/promises").then((fsp) => fsp.readFile(filePath));
      res.statusCode = 200;
      res.setHeader("Content-Type", resource.mimetype ?? "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${resource.filename ?? "file"}"`);
      res.setHeader("Content-Length", fileContent.byteLength);
      res.end(fileContent);
    } catch {
      sendNotFound(res);
    }
    return true;
  }

  // PUT /api/admin/resources/:id — update (admin only)
  const resourceEditMatch = subPath.match(/^\/resources\/([^/]+)$/);
  if (resourceEditMatch && req.method === "PUT") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const resourceId = resourceEditMatch[1]!;
    const body = await readJsonBody(req, MAX_BODY_BYTES_RESOURCE);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const updates: Parameters<typeof updateResource>[1] = {};
    const newTitle = normalizeString(data.title);
    if (newTitle) updates.title = newTitle;
    const newDesc = data.description !== undefined ? normalizeString(data.description) : undefined;
    if (newDesc !== undefined) updates.description = newDesc;
    const newUrl = normalizeString(data.url);
    if (newUrl) updates.url = newUrl;
    if (Array.isArray(data.tags)) {
      updates.tags = (data.tags as string[]).filter((t) => typeof t === "string");
    }
    if (data.aiAccess !== undefined) updates.aiAccess = !!data.aiAccess;
    if (data.userAccess !== undefined) updates.userAccess = !!data.userAccess;
    const updated = await updateResource(resourceId, updates);
    if (!updated) {
      sendNotFound(res);
      return true;
    }
    sendJson(res, 200, { resource: updated });
    return true;
  }

  // DELETE /api/admin/resources/:id — delete (admin only)
  if (resourceEditMatch && req.method === "DELETE") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const resourceId = resourceEditMatch[1]!;
    const resource = await getResource(resourceId);
    if (!resource) {
      sendNotFound(res);
      return true;
    }
    await deleteResource(resourceId);
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

export async function handleUserPortalUiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  // Redirect root to the portal so team members land on the user login.
  if (url.pathname === "/") {
    setDefaultSecurityHeaders(res);
    res.statusCode = 302;
    res.setHeader("Location", "/portal");
    res.end();
    return true;
  }

  if (url.pathname !== "/portal" && !url.pathname.startsWith("/portal/")) return false;

  setDefaultSecurityHeaders(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.end(USER_PORTAL_HTML);
  return true;
}
