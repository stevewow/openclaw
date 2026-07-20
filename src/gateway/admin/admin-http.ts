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
  beginAuth as beginSpiroAuth,
  getConnection as getSpiroConnection,
} from "../../../extensions/spiro/api.js";
import {
  DEFAULT_TREND_WINDOW,
  ensureClevelandScheduler,
  getClevelandInvestment,
  refreshClevelandOrders,
} from "./cleveland-store.js";
import {
  addNote,
  deleteNote,
  ensureFinancialsScheduler,
  getAccountInvoices,
  getPastDueBreakdown,
  listNotes,
  paymentPlanTerms,
  refreshInvoices,
} from "./financials-store.js";
import {
  canAccessProject,
  canAccessTask,
  computeNextDueDate,
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  getTask,
  listProjects,
  listTasks,
  updateProject,
  updateTask,
  type UpdateProjectParams,
  type UpdateTaskParams,
} from "./project-store.js";
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
import {
  ensurePhotographersScheduler,
  getPhotographersReport,
  refreshPhotographers,
} from "./spiro-photographers-store.js";
import {
  ensureSpiroReportScheduler,
  getAgentCancellationReport,
  getRankingsReport,
  getRefreshStatus,
  last12Months,
  listAvailableMarkets,
  refreshMonth,
} from "./spiro-report-store.js";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  addTicketEvent,
  createTicket,
  deleteTicket,
  getTicket,
  getTicketStats,
  listTicketEvents,
  listTickets,
  updateTicket,
  type ListTicketFilters,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type UpdateTicketParams,
} from "./ticket-store.js";
import type { AdminUserRole, PortalFeature } from "./types.js";
import {
  createSession,
  createUser,
  deleteSession,
  deleteUser,
  ensureSuperadminExists,
  getUserById,
  getUserByUsername,
  getUserPermissions,
  listUsers,
  resolveSessionUser,
  setUserPermissions,
  updateUser,
  verifyPassword,
} from "./user-store.js";

export { handleTicketIntakeRequest } from "./ticket-intake-http.js";
import {
  CATEGORY_EXTRA_FIELDS,
  type CategoryExtraField,
  categoryKeyFromLabel,
  createCategory,
  ensureCategorySeed,
  getCategory,
  listCategories,
  removeCategory,
  type UpdateCategoryParams,
  updateCategory,
} from "./ticket-category-store.js";
import {
  createDepartment,
  deleteDepartment,
  ensureDepartmentSeed,
  getCategoryRoutes,
  listDepartments,
  setCategoryRoute,
  updateDepartment,
} from "./ticket-department-store.js";
import { notifyDepartment } from "./ticket-mailer.js";
import { mintTestToken } from "./ticket-test-token.js";

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

/**
 * Map a `/tickets...` admin subpath to the portal feature that unlocks it.
 *
 * The ticket queue and its three configuration surfaces are granted separately,
 * so someone can work the queue without being able to rewire departments,
 * request types, or the public intake form.
 *
 * Deliberately total: any path under `/tickets` that isn't a known config
 * surface falls back to the `tickets` grant rather than returning null. A new
 * ticket route therefore ships closed for non-admins instead of unguarded.
 */
function ticketFeatureForSubPath(subPath: string): PortalFeature {
  if (subPath === "/tickets/departments" || subPath.startsWith("/tickets/departments/")) {
    return "ticket-departments";
  }
  if (
    subPath === "/tickets/categories" ||
    subPath.startsWith("/tickets/categories/") ||
    subPath === "/tickets/category-routes"
  ) {
    return "ticket-categories";
  }
  if (subPath === "/tickets/test-token") {
    return "ticket-form";
  }
  return "tickets";
}

/** Read the editable fields of a ticket category off a JSON body. */
function readCategoryParams(data: Record<string, unknown>): UpdateCategoryParams {
  const params: UpdateCategoryParams = {};
  const label = normalizeString(data.label);
  if (label) {
    params.label = label;
  }
  const shortLabel = normalizeString(data.shortLabel);
  if (shortLabel) {
    params.shortLabel = shortLabel;
  }
  if (
    typeof data.extraField === "string" &&
    CATEGORY_EXTRA_FIELDS.includes(data.extraField as CategoryExtraField)
  ) {
    params.extraField = data.extraField as CategoryExtraField;
  }
  if (data.extraLabel !== undefined) {
    params.extraLabel = normalizeString(data.extraLabel);
  }
  if (Array.isArray(data.extraOptions)) {
    params.extraOptions = data.extraOptions
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
  }
  if (data.extraPlaceholder !== undefined) {
    params.extraPlaceholder = normalizeString(data.extraPlaceholder);
  }
  const detailsLabel = normalizeString(data.detailsLabel);
  if (detailsLabel) {
    params.detailsLabel = detailsLabel;
  }
  if (data.detailsHint !== undefined) {
    params.detailsHint = normalizeString(data.detailsHint);
  }
  if (typeof data.sortOrder === "number") {
    params.sortOrder = data.sortOrder;
  }
  if (typeof data.active === "boolean") {
    params.active = data.active;
  }
  return params;
}

function normalizeRole(v: unknown): AdminUserRole | null {
  if (v === "superadmin" || v === "admin" || v === "user") return v;
  return null;
}

/** Coerce arbitrary JSON into a de-duplicated array of non-empty string ids. */
function normalizeIdArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item === "string" && item.trim().length > 0) seen.add(item.trim());
  }
  return Array.from(seen);
}

/** Optional epoch-ms field: number → itself, null → null, absent → undefined. */
function normalizeEpoch(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
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

const COLLECTIONS_PROJECT_TITLE = "Collections";

// Follow-up tasks from the Past Due page land in a dedicated auto-managed
// project so they surface in the existing board/calendar without manual setup.
async function ensureCollectionsProject(createdBy: string | null): Promise<string> {
  const projects = await listProjects();
  const existing = projects.find((p) => p.title === COLLECTIONS_PROJECT_TITLE);
  if (existing) return existing.id;
  const project = await createProject({
    title: COLLECTIONS_PROJECT_TITLE,
    description: "Past-due account follow-ups generated from the Financials dashboard.",
    status: "active",
    color: "#c0000a",
    tags: ["collections", "financials"],
    createdBy,
  });
  return project.id;
}

let initialized = false;
export async function ensureAdminInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await ensureSuperadminExists();
  await ensureDepartmentSeed();
  await ensureCategorySeed();
  ensureSpiroReportScheduler();
  ensureFinancialsScheduler();
  ensureClevelandScheduler();
  ensurePhotographersScheduler();
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
  const isSuperAdmin = sessionUser.role === "superadmin";

  // Portal access is deny-by-default for non-admins: a section or report is
  // reachable only when explicitly granted. Admins always pass. Permissions are
  // loaded lazily (only non-admins hitting a gated route pay for it) and cached
  // for the life of this request.
  const viewerId = sessionUser.id;
  let cachedViewerPerms: Array<{ permissionType: string; value: string }> | null = null;
  async function viewerPerms(): Promise<Array<{ permissionType: string; value: string }>> {
    if (!cachedViewerPerms) {
      cachedViewerPerms = await getUserPermissions(viewerId);
    }
    return cachedViewerPerms;
  }
  async function hasFeatureAccess(feature: string): Promise<boolean> {
    if (isAdmin) {
      return true;
    }
    return (await viewerPerms()).some((p) => p.permissionType === "feature" && p.value === feature);
  }
  async function hasReportAccess(reportKey: string): Promise<boolean> {
    if (isAdmin) {
      return true;
    }
    return (await viewerPerms()).some(
      (p) => p.permissionType === "report" && p.value === reportKey,
    );
  }

  // POST /api/admin/auth/logout
  if (subPath === "/auth/logout" && req.method === "POST") {
    if (token) await deleteSession(token);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/admin/auth/me
  if (subPath === "/auth/me" && req.method === "GET") {
    const perms = await getUserPermissions(sessionUser.id);
    let impersonatedBy: { id: string; username: string } | null = null;
    if (sessionUser.impersonatorId) {
      const impersonator = await getUserById(sessionUser.impersonatorId);
      if (impersonator) {
        impersonatedBy = { id: impersonator.id, username: impersonator.username };
      }
    }
    sendJson(res, 200, {
      id: sessionUser.id,
      username: sessionUser.username,
      role: sessionUser.role,
      email: sessionUser.email,
      permissions: perms,
      impersonatedBy,
    });
    return true;
  }

  // GET /api/admin/portal/config — gateway connection info for portal users.
  // Hands out the gateway credential, so it is gated on chat access the same way
  // the portal's chat section is. The client-side hasFeature() check is cosmetic.
  if (subPath === "/portal/config" && req.method === "GET") {
    if (!(await hasFeatureAccess("chat"))) {
      sendForbidden(res);
      return true;
    }
    const auth = _getResolvedAuth?.();
    const host = req.headers.host ?? "localhost";
    const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? "http";
    const wsProto = proto === "https" ? "wss" : "ws";
    const gatewayWsUrl = `${wsProto}://${host}`;
    // The browser gets the user's own portal session token as its gateway
    // credential — never the shared gateway secret. The gateway authenticates
    // it as `portal-session`, binds the connection to this user, and caps its
    // scopes. A portal user therefore cannot connect as an unscoped operator.
    sendJson(res, 200, {
      gatewayWsUrl,
      gatewayToken: token ?? null,
      gatewayPassword: null,
      gatewayMode: auth?.mode === "none" ? "none" : "token",
      portalSessionToken: token ?? null,
    });
    return true;
  }

  // GET /api/admin/users/directory — minimal user list for assignee/member pickers.
  // Available to any authenticated user (so non-admins can attach collaborators).
  if (subPath === "/users/directory" && req.method === "GET") {
    const users = await listUsers();
    sendJson(res, 200, {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
      })),
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
      const user = await createUser({
        username,
        password,
        role,
        firstName: normalizeString(data.firstName),
        lastName: normalizeString(data.lastName),
        email: normalizeString(data.email),
      });
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
    // Only a superadmin may mutate a superadmin. Without this an admin could
    // seize the superadmin account by resetting its password.
    const editTarget = await getUserById(targetId);
    if (!editTarget) {
      sendNotFound(res);
      return true;
    }
    if (editTarget.role === "superadmin" && !isSuperAdmin) {
      sendForbidden(res);
      return true;
    }
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const params: {
      username?: string;
      password?: string;
      role?: AdminUserRole;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } = {};
    const newUsername = normalizeString(data.username);
    const newPassword = normalizeString(data.password);
    const newRole = normalizeRole(data.role);
    if (newUsername) params.username = newUsername;
    if (newPassword) params.password = newPassword;
    if (data.firstName !== undefined) params.firstName = normalizeString(data.firstName);
    if (data.lastName !== undefined) params.lastName = normalizeString(data.lastName);
    if (data.email !== undefined) params.email = normalizeString(data.email);
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
    // Only a superadmin may delete a superadmin.
    const deleteTarget = await getUserById(targetId);
    if (deleteTarget?.role === "superadmin" && !isSuperAdmin) {
      sendForbidden(res);
      return true;
    }
    await deleteUser(targetId);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // POST /api/admin/users/:id/impersonate — superadmin only
  const impersonateMatch = subPath.match(/^\/users\/([^/]+)\/impersonate$/);
  if (impersonateMatch && req.method === "POST") {
    if (!isSuperAdmin) {
      sendForbidden(res);
      return true;
    }
    const targetId = impersonateMatch[1]!;
    if (targetId === sessionUser.id) {
      sendBadRequest(res, "cannot impersonate your own account");
      return true;
    }
    const targetUser = await getUserById(targetId);
    if (!targetUser) {
      sendNotFound(res);
      return true;
    }
    const session = await createSession(targetUser.id, { impersonatorId: sessionUser.id });
    sendJson(res, 200, {
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: targetUser.id, username: targetUser.username, role: targetUser.role },
      impersonatedBy: { id: sessionUser.id, username: sessionUser.username },
    });
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

  // GET /api/admin/agents — list agents from config (superadmin only)
  if (subPath === "/agents" && req.method === "GET") {
    if (!isSuperAdmin) {
      sendForbidden(res);
      return true;
    }
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

  // GET /api/admin/agents/:id — agent detail (skills + recent sessions) (superadmin only)
  const agentDetailMatch = subPath.match(/^\/agents\/([^/]+)$/);
  if (agentDetailMatch && req.method === "GET") {
    if (!isSuperAdmin) {
      sendForbidden(res);
      return true;
    }
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

  // GET /api/admin/skills — aggregate skills across all agent workspaces (admin only)
  if (subPath === "/skills" && req.method === "GET") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const cfg = getRuntimeConfig();
    const { listGatewayAgentsBasic } = await import("../agent-list.js");
    const { resolveAgentWorkspaceDir } = await import("../../agents/agent-scope-config.js");
    const result = listGatewayAgentsBasic(cfg);
    const skillMap = new Map<string, string | null>();
    await Promise.all(
      result.agents.map(async (a) => {
        const workspaceDir = resolveAgentWorkspaceDir(cfg, a.id);
        const agentSkills = await readWorkspaceSkills(workspaceDir);
        for (const s of agentSkills) {
          if (!skillMap.has(s.name)) skillMap.set(s.name, s.description);
        }
      }),
    );
    const skills = Array.from(skillMap.entries())
      .map(([name, description]) => ({ name, description }))
      .sort((a, b) => a.name.localeCompare(b.name));
    sendJson(res, 200, { skills });
    return true;
  }

  // GET /api/admin/channels — list configured channel IDs (admin only)
  if (subPath === "/channels" && req.method === "GET") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const cfg = getRuntimeConfig();
    const reserved = new Set(["defaults", "modelByChannel"]);
    const channels = Object.keys(cfg.channels ?? {})
      .filter((k) => !reserved.has(k))
      .sort()
      .map((id) => ({ id }));
    sendJson(res, 200, { channels });
    return true;
  }

  // GET /api/admin/system — system info (superadmin only)
  if (subPath === "/system" && req.method === "GET") {
    if (!isSuperAdmin) {
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

  // Feature gate: a non-admin reaches the Resources / Projects & Tasks sections
  // only when granted. Placed ahead of those route groups so one check covers
  // every verb on them. Admins always pass.
  if (!isAdmin) {
    const gatedFeature =
      subPath === "/resources" || subPath.startsWith("/resources/")
        ? "resources"
        : subPath === "/projects" ||
            subPath.startsWith("/projects/") ||
            subPath === "/tasks" ||
            subPath.startsWith("/tasks/")
          ? "projects"
          : subPath === "/tickets" || subPath.startsWith("/tickets/")
            ? ticketFeatureForSubPath(subPath)
            : null;
    if (gatedFeature && !(await hasFeatureAccess(gatedFeature))) {
      sendForbidden(res);
      return true;
    }
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

  // GET /api/admin/projects — scoped to the viewer (admins see all)
  if (subPath === "/projects" && req.method === "GET") {
    const projects = await listProjects({ userId: sessionUser.id, role: sessionUser.role });
    sendJson(res, 200, { projects });
    return true;
  }

  // POST /api/admin/projects
  if (subPath === "/projects" && req.method === "POST") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
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
    const validStatuses = ["planning", "active", "completed", "archived"] as const;
    const status = validStatuses.includes(data.status as (typeof validStatuses)[number])
      ? (data.status as (typeof validStatuses)[number])
      : "active";
    const project = await createProject({
      title,
      description: normalizeString(data.description),
      status,
      color: typeof data.color === "string" ? data.color : "#3b82f6",
      tags: Array.isArray(data.tags)
        ? (data.tags as string[]).filter((t) => typeof t === "string")
        : [],
      startDate: normalizeEpoch(data.startDate) ?? null,
      endDate: normalizeEpoch(data.endDate) ?? null,
      memberIds: normalizeIdArray(data.memberIds),
      createdBy: sessionUser.id,
    });
    sendJson(res, 201, { project });
    return true;
  }

  // PUT /DELETE /api/admin/projects/:id
  const projectEditMatch = subPath.match(/^\/projects\/([^/]+)$/);
  const projectViewer = { userId: sessionUser.id, role: sessionUser.role };
  if (projectEditMatch && req.method === "PUT") {
    const id = projectEditMatch[1]!;
    if (!(await canAccessProject(projectViewer, id))) {
      sendForbidden(res);
      return true;
    }
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const validStatuses = ["planning", "active", "completed", "archived"] as const;
    const params: UpdateProjectParams = {};
    const newTitle = normalizeString(data.title);
    if (newTitle) params.title = newTitle;
    if (data.description !== undefined) params.description = normalizeString(data.description);
    if (
      typeof data.status === "string" &&
      validStatuses.includes(data.status as (typeof validStatuses)[number])
    ) {
      params.status = data.status as (typeof validStatuses)[number];
    }
    if (typeof data.color === "string") params.color = data.color;
    if (Array.isArray(data.tags))
      params.tags = (data.tags as string[]).filter((t) => typeof t === "string");
    if (data.startDate !== undefined) params.startDate = normalizeEpoch(data.startDate) ?? null;
    if (data.endDate !== undefined) params.endDate = normalizeEpoch(data.endDate) ?? null;
    if (data.memberIds !== undefined) params.memberIds = normalizeIdArray(data.memberIds);
    const updated = await updateProject(id, params);
    if (!updated) {
      sendNotFound(res);
      return true;
    }
    sendJson(res, 200, { project: updated });
    return true;
  }
  if (projectEditMatch && req.method === "DELETE") {
    const id = projectEditMatch[1]!;
    if (!(await canAccessProject(projectViewer, id))) {
      sendForbidden(res);
      return true;
    }
    await deleteProject(id);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/admin/tasks — scoped to the viewer (admins see all)
  if (subPath === "/tasks" && req.method === "GET") {
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const tasks = await listTasks(projectId ? { projectId } : {}, {
      userId: sessionUser.id,
      role: sessionUser.role,
    });
    sendJson(res, 200, { tasks });
    return true;
  }

  // POST /api/admin/tasks
  if (subPath === "/tasks" && req.method === "POST") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
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
    const validStatuses = ["todo", "in_progress", "review", "done"] as const;
    const validPriorities = ["low", "medium", "high", "urgent"] as const;
    const validRecurrences = ["daily", "weekly", "monthly", "yearly"] as const;
    // Non-admins may only place tasks in a project / under a parent they can access.
    const taskViewer = { userId: sessionUser.id, role: sessionUser.role };
    const targetProjectId = normalizeString(data.projectId);
    const targetParentId = normalizeString(data.parentTaskId);
    if (targetProjectId && !(await canAccessProject(taskViewer, targetProjectId))) {
      sendForbidden(res);
      return true;
    }
    if (targetParentId && !(await canAccessTask(taskViewer, targetParentId))) {
      sendForbidden(res);
      return true;
    }
    const task = await createTask({
      title,
      description: normalizeString(data.description),
      status: validStatuses.includes(data.status as (typeof validStatuses)[number])
        ? (data.status as (typeof validStatuses)[number])
        : "todo",
      priority: validPriorities.includes(data.priority as (typeof validPriorities)[number])
        ? (data.priority as (typeof validPriorities)[number])
        : "medium",
      projectId: normalizeString(data.projectId),
      parentTaskId: normalizeString(data.parentTaskId),
      dueDate: typeof data.dueDate === "number" ? data.dueDate : null,
      assignedTo: normalizeString(data.assignedTo),
      tags: Array.isArray(data.tags)
        ? (data.tags as string[]).filter((t) => typeof t === "string")
        : [],
      recurrence: validRecurrences.includes(data.recurrence as (typeof validRecurrences)[number])
        ? (data.recurrence as (typeof validRecurrences)[number])
        : null,
      assigneeIds: normalizeIdArray(data.assigneeIds),
      createdBy: sessionUser.id,
    });
    sendJson(res, 201, { task });
    return true;
  }

  // PUT / DELETE /api/admin/tasks/:id
  const taskEditMatch = subPath.match(/^\/tasks\/([^/]+)$/);
  const taskEditViewer = { userId: sessionUser.id, role: sessionUser.role };
  if (taskEditMatch && req.method === "PUT") {
    const id = taskEditMatch[1]!;
    if (!(await canAccessTask(taskEditViewer, id))) {
      sendForbidden(res);
      return true;
    }
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const validStatuses = ["todo", "in_progress", "review", "done"] as const;
    const validPriorities = ["low", "medium", "high", "urgent"] as const;
    const validRecurrences = ["daily", "weekly", "monthly", "yearly"] as const;
    const params: UpdateTaskParams = {};
    const newTitle = normalizeString(data.title);
    if (newTitle) params.title = newTitle;
    if (data.description !== undefined) params.description = normalizeString(data.description);
    if (
      typeof data.status === "string" &&
      validStatuses.includes(data.status as (typeof validStatuses)[number])
    ) {
      params.status = data.status as (typeof validStatuses)[number];
    }
    if (
      typeof data.priority === "string" &&
      validPriorities.includes(data.priority as (typeof validPriorities)[number])
    ) {
      params.priority = data.priority as (typeof validPriorities)[number];
    }
    if (data.projectId !== undefined) params.projectId = normalizeString(data.projectId);
    if (data.dueDate !== undefined)
      params.dueDate = typeof data.dueDate === "number" ? data.dueDate : null;
    if (data.assignedTo !== undefined) params.assignedTo = normalizeString(data.assignedTo);
    if (Array.isArray(data.tags))
      params.tags = (data.tags as string[]).filter((t) => typeof t === "string");
    if (data.recurrence !== undefined) {
      params.recurrence = validRecurrences.includes(
        data.recurrence as (typeof validRecurrences)[number],
      )
        ? (data.recurrence as (typeof validRecurrences)[number])
        : null;
    }
    if (data.assigneeIds !== undefined) params.assigneeIds = normalizeIdArray(data.assigneeIds);
    const before = await getTask(id);
    const updated = await updateTask(id, params);
    if (!updated) {
      sendNotFound(res);
      return true;
    }
    if (updated.status === "done" && before?.status !== "done" && updated.recurrence) {
      await createTask({
        title: updated.title,
        description: updated.description,
        status: "todo",
        priority: updated.priority,
        projectId: updated.projectId,
        parentTaskId: updated.parentTaskId,
        dueDate: computeNextDueDate(updated.dueDate ?? Date.now(), updated.recurrence),
        assignedTo: updated.assignedTo,
        assigneeIds: updated.assigneeIds,
        tags: updated.tags,
        recurrence: updated.recurrence,
        createdBy: updated.createdBy,
      });
    }
    sendJson(res, 200, { task: updated });
    return true;
  }
  if (taskEditMatch && req.method === "DELETE") {
    const id = taskEditMatch[1]!;
    if (!(await canAccessTask(taskEditViewer, id))) {
      sendForbidden(res);
      return true;
    }
    await deleteTask(id);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // ── Support tickets ────────────────────────────────────────────────────────
  // Admins pass unconditionally; non-admins are gated by the per-surface ticket
  // grants applied in the prefix gate above (see `ticketFeatureForSubPath`), so
  // these handlers carry no inline role checks of their own.
  // GET /api/admin/tickets — queue, with optional status/category/department/q filters
  if (subPath === "/tickets" && req.method === "GET") {
    const filters: ListTicketFilters = {};
    const status = url.searchParams.get("status");
    if (status && TICKET_STATUSES.includes(status as TicketStatus))
      filters.status = status as TicketStatus;
    const category = url.searchParams.get("category");
    if (category && TICKET_CATEGORIES.includes(category as TicketCategory))
      filters.category = category as TicketCategory;
    const department = normalizeString(url.searchParams.get("department"));
    if (department) filters.department = department;
    const assignedTo = normalizeString(url.searchParams.get("assignedTo"));
    if (assignedTo) filters.assignedTo = assignedTo;
    const q = normalizeString(url.searchParams.get("q"));
    if (q) filters.q = q;
    const tickets = await listTickets(filters);
    sendJson(res, 200, { tickets });
    return true;
  }

  // GET /api/admin/tickets/stats — counts by status for the dashboard tiles
  if (subPath === "/tickets/stats" && req.method === "GET") {
    sendJson(res, 200, { stats: await getTicketStats() });
    return true;
  }

  // GET /api/admin/tickets/test-token?email= — mint a short-lived signed grant
  // that lets the (public) intake preview submit a TEST ticket whose department
  // email is diverted to `email`. Admin-gated: only staff can authorize a divert.
  if (subPath === "/tickets/test-token" && req.method === "GET") {
    const email = normalizeString(url.searchParams.get("email"));
    if (!email || !email.includes("@")) {
      sendBadRequest(res, "a valid override email is required");
      return true;
    }
    sendJson(res, 200, { token: mintTestToken(email), email });
    return true;
  }

  // GET /api/admin/tickets/departments — managed departments + category routing
  if (subPath === "/tickets/departments" && req.method === "GET") {
    sendJson(res, 200, { departments: await listDepartments(), routes: await getCategoryRoutes() });
    return true;
  }

  // POST /api/admin/tickets/departments — add a department
  if (subPath === "/tickets/departments" && req.method === "POST") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const label = normalizeString(data.label);
    if (!label) {
      sendBadRequest(res, "label required");
      return true;
    }
    const department = await createDepartment({
      label,
      key: normalizeString(data.key) ?? undefined,
      email: normalizeString(data.email),
    });
    sendJson(res, 201, { department });
    return true;
  }

  // PUT /api/admin/tickets/departments/:key — edit label/email
  const deptEditMatch = subPath.match(/^\/tickets\/departments\/([^/]+)$/);
  if (deptEditMatch && req.method === "PUT") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const params: { label?: string; email?: string | null; sortOrder?: number } = {};
    const label = normalizeString(data.label);
    if (label) params.label = label;
    if (data.email !== undefined) params.email = normalizeString(data.email);
    if (typeof data.sortOrder === "number") params.sortOrder = data.sortOrder;
    const updated = await updateDepartment(deptEditMatch[1]!, params);
    if (!updated) {
      sendNotFound(res);
      return true;
    }
    sendJson(res, 200, { department: updated });
    return true;
  }
  if (deptEditMatch && req.method === "DELETE") {
    await deleteDepartment(deptEditMatch[1]!);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // PUT /api/admin/tickets/category-routes — set which department each category routes to
  if (subPath === "/tickets/category-routes" && req.method === "PUT") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    for (const [category, key] of Object.entries(data)) {
      if (typeof key === "string" && key) await setCategoryRoute(category, key);
    }
    sendJson(res, 200, { routes: await getCategoryRoutes() });
    return true;
  }

  // GET /api/admin/tickets/categories — managed request types for the form
  if (subPath === "/tickets/categories" && req.method === "GET") {
    await ensureCategorySeed();
    sendJson(res, 200, {
      categories: await listCategories(),
      routes: await getCategoryRoutes(),
    });
    return true;
  }

  // POST /api/admin/tickets/categories — add a request type
  if (subPath === "/tickets/categories" && req.method === "POST") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const label = normalizeString(data.label);
    if (!label) {
      sendBadRequest(res, "label required");
      return true;
    }
    const key = (normalizeString(data.key) ?? categoryKeyFromLabel(label)).toLowerCase();
    if (await getCategory(key)) {
      sendBadRequest(res, `category "${key}" already exists`);
      return true;
    }
    const category = await createCategory({ ...readCategoryParams(data), key, label });
    const department = normalizeString(data.department);
    if (department) {
      await setCategoryRoute(category.key, department);
    }
    sendJson(res, 201, { category, routes: await getCategoryRoutes() });
    return true;
  }

  // PUT/DELETE /api/admin/tickets/categories/:key — edit or remove a request type
  const categoryEditMatch = subPath.match(/^\/tickets\/categories\/([^/]+)$/);
  if (categoryEditMatch && req.method === "PUT") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const updated = await updateCategory(categoryEditMatch[1], readCategoryParams(data));
    if (!updated) {
      sendNotFound(res);
      return true;
    }
    const department = normalizeString(data.department);
    if (department) {
      await setCategoryRoute(updated.key, department);
    }
    sendJson(res, 200, { category: updated, routes: await getCategoryRoutes() });
    return true;
  }
  if (categoryEditMatch && req.method === "DELETE") {
    // Deletes only when unused; otherwise deactivates so history keeps its label.
    const result = await removeCategory(categoryEditMatch[1]);
    if (result.outcome === "not_found") {
      sendNotFound(res);
      return true;
    }
    sendJson(res, 200, { ok: true, ...result });
    return true;
  }

  // POST /api/admin/tickets — manual create (the intake form uses the same store)
  if (subPath === "/tickets" && req.method === "POST") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const subject = normalizeString(data.subject);
    if (!subject) {
      sendBadRequest(res, "subject required");
      return true;
    }
    if (!TICKET_CATEGORIES.includes(data.category as TicketCategory)) {
      sendBadRequest(res, "valid category required");
      return true;
    }
    const priority = TICKET_PRIORITIES.includes(data.priority as TicketPriority)
      ? (data.priority as TicketPriority)
      : "medium";
    const ticket = await createTicket({
      category: data.category as TicketCategory,
      subject,
      description: normalizeString(data.description),
      priority,
      source: "manual",
      department: normalizeString(data.department),
      requesterName: normalizeString(data.requesterName),
      requesterEmail: normalizeString(data.requesterEmail),
      requesterPhone: normalizeString(data.requesterPhone),
      orderId: normalizeString(data.orderId),
      orderAddress: normalizeString(data.orderAddress),
      assignedTo: normalizeString(data.assignedTo),
      createdBy: sessionUser.id,
    });
    void notifyDepartment(ticket).catch(() => {});
    sendJson(res, 201, { ticket });
    return true;
  }

  // POST /api/admin/tickets/:id/comment — append a staff note to the thread
  const ticketCommentMatch = subPath.match(/^\/tickets\/([^/]+)\/comment$/);
  if (ticketCommentMatch && req.method === "POST") {
    const id = ticketCommentMatch[1]!;
    if (!(await getTicket(id))) {
      sendNotFound(res);
      return true;
    }
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const text = normalizeString(data.body);
    if (!text) {
      sendBadRequest(res, "body required");
      return true;
    }
    const event = await addTicketEvent(id, {
      kind: "comment",
      authorType: "staff",
      authorName: sessionUser.username,
      body: text,
    });
    sendJson(res, 201, { event });
    return true;
  }

  // GET / PUT / DELETE /api/admin/tickets/:id
  const ticketIdMatch = subPath.match(/^\/tickets\/([^/]+)$/);
  if (ticketIdMatch && req.method === "GET") {
    const ticket = await getTicket(ticketIdMatch[1]!);
    if (!ticket) {
      sendNotFound(res);
      return true;
    }
    const events = await listTicketEvents(ticket.id);
    sendJson(res, 200, { ticket, events });
    return true;
  }
  if (ticketIdMatch && req.method === "PUT") {
    const id = ticketIdMatch[1]!;
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const params: UpdateTicketParams = {};
    if (typeof data.status === "string" && TICKET_STATUSES.includes(data.status as TicketStatus)) {
      params.status = data.status as TicketStatus;
    }
    if (
      typeof data.priority === "string" &&
      TICKET_PRIORITIES.includes(data.priority as TicketPriority)
    ) {
      params.priority = data.priority as TicketPriority;
    }
    const department = normalizeString(data.department);
    if (department) params.department = department;
    const subject = normalizeString(data.subject);
    if (subject) params.subject = subject;
    if (data.description !== undefined) params.description = normalizeString(data.description);
    if (data.assignedTo !== undefined) params.assignedTo = normalizeString(data.assignedTo);
    const updated = await updateTicket(id, params, {
      name: sessionUser.username,
      authorType: "staff",
    });
    if (!updated) {
      sendNotFound(res);
      return true;
    }
    sendJson(res, 200, { ticket: updated });
    return true;
  }
  if (ticketIdMatch && req.method === "DELETE") {
    if (!isSuperAdmin) {
      sendForbidden(res);
      return true;
    }
    if (!(await getTicket(ticketIdMatch[1]!))) {
      sendNotFound(res);
      return true;
    }
    await deleteTicket(ticketIdMatch[1]!);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/admin/reports/agent-cancellations — 12-month order/cancellation report
  if (subPath === "/reports/agent-cancellations" && req.method === "GET") {
    if (!(await hasReportAccess("report-cancellations"))) {
      sendForbidden(res);
      return true;
    }
    const months = last12Months();
    const from = normalizeString(url.searchParams.get("from")) ?? months[0]!;
    const to = normalizeString(url.searchParams.get("to")) ?? months[months.length - 1]!;
    const market = normalizeString(url.searchParams.get("market"));
    const report = await getAgentCancellationReport({ from, to, market });
    sendJson(res, 200, { report });
    return true;
  }

  // GET /api/admin/reports/rankings — agent + company order-volume rankings (admin only).
  // Shares the same cached orders, date range, and market filter as the cancellation report.
  if (subPath === "/reports/rankings" && req.method === "GET") {
    if (!(await hasReportAccess("rankings"))) {
      sendForbidden(res);
      return true;
    }
    const months = last12Months();
    const from = normalizeString(url.searchParams.get("from")) ?? months[0]!;
    const to = normalizeString(url.searchParams.get("to")) ?? months[months.length - 1]!;
    const market = normalizeString(url.searchParams.get("market"));
    const report = await getRankingsReport({ from, to, market });
    sendJson(res, 200, { report });
    return true;
  }

  // GET /api/admin/reports/agent-cancellations/markets — distinct markets in range.
  // Shared by the cancellation + rankings views, so either report grants it.
  if (subPath === "/reports/agent-cancellations/markets" && req.method === "GET") {
    if (!(await hasReportAccess("report-cancellations")) && !(await hasReportAccess("rankings"))) {
      sendForbidden(res);
      return true;
    }
    const months = last12Months();
    const from = normalizeString(url.searchParams.get("from")) ?? months[0]!;
    const to = normalizeString(url.searchParams.get("to")) ?? months[months.length - 1]!;
    const markets = await listAvailableMarkets(from, to);
    sendJson(res, 200, { markets });
    return true;
  }

  // GET /api/admin/reports/agent-cancellations/status — last-refreshed per month.
  if (subPath === "/reports/agent-cancellations/status" && req.method === "GET") {
    if (!(await hasReportAccess("report-cancellations")) && !(await hasReportAccess("rankings"))) {
      sendForbidden(res);
      return true;
    }
    const status = await getRefreshStatus(last12Months());
    sendJson(res, 200, { status });
    return true;
  }

  // POST /api/admin/reports/agent-cancellations/refresh — manual refresh (admin only)
  if (subPath === "/reports/agent-cancellations/refresh" && req.method === "POST") {
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
    const months = last12Months();
    const from = normalizeString(data.from) ?? months[0]!;
    const to = normalizeString(data.to) ?? months[months.length - 1]!;
    const targetMonths = months.filter((m) => m >= from && m <= to);
    if (targetMonths.length === 0) {
      sendBadRequest(res, "no months in range");
      return true;
    }
    try {
      for (const month of targetMonths) {
        await refreshMonth(month, { manual: true });
      }
    } catch (err) {
      sendJson(res, 502, { error: err instanceof Error ? err.message : String(err) });
      return true;
    }
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/admin/reports/photographers — roster + shoot counts over a range
  if (subPath === "/reports/photographers" && req.method === "GET") {
    if (!(await hasReportAccess("photographers"))) {
      sendForbidden(res);
      return true;
    }
    const months = last12Months();
    const from = normalizeString(url.searchParams.get("from")) ?? months[0]!;
    const to = normalizeString(url.searchParams.get("to")) ?? months[months.length - 1]!;
    const report = await getPhotographersReport({ from, to });
    sendJson(res, 200, { report });
    return true;
  }

  // POST /api/admin/reports/photographers/refresh — manual refresh (admin only)
  if (subPath === "/reports/photographers/refresh" && req.method === "POST") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    try {
      const result = await refreshPhotographers({ manual: true });
      sendJson(res, 200, { ok: true, count: result.count });
    } catch (err) {
      sendJson(res, 502, { error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  // GET /api/admin/financials/spiro/status — Spiro connection state (admin only)
  if (subPath === "/financials/spiro/status" && req.method === "GET") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    sendJson(res, 200, getSpiroConnection());
    return true;
  }

  // POST /api/admin/financials/spiro/connect — begin Spiro OAuth, return the
  // authorize URL for the browser to open (admin only)
  if (subPath === "/financials/spiro/connect" && req.method === "POST") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const result = await beginSpiroAuth();
    if (!result.ok) {
      sendJson(res, 502, { error: result.error });
      return true;
    }
    sendJson(res, 200, { authorizeUrl: result.authorizeUrl });
    return true;
  }

  // GET /api/admin/financials/cleveland — Cleveland investment P&L + projection (admin only).
  // ?window=4|6|8|all controls how many recent weeks the revenue trend is fit on.
  if (subPath === "/financials/cleveland" && req.method === "GET") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const w = url.searchParams.get("window");
    let trendWindow: number | null = DEFAULT_TREND_WINDOW;
    let trendWeighted = false;
    if (w === "weighted") {
      trendWeighted = true;
      trendWindow = null;
    } else if (w === "all") trendWindow = null;
    else if (w && Number.isFinite(Number(w)) && Number(w) > 0) trendWindow = Number(w);
    const investment = await getClevelandInvestment(Date.now(), trendWindow, trendWeighted);
    sendJson(res, 200, { investment });
    return true;
  }

  // POST /api/admin/financials/cleveland/refresh — pull Cleveland order revenue (admin only)
  if (subPath === "/financials/cleveland/refresh" && req.method === "POST") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    try {
      const { count } = await refreshClevelandOrders({ manual: true });
      sendJson(res, 200, { ok: true, count });
    } catch (err) {
      sendJson(res, 502, { error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  // GET /api/admin/financials/past-due — grouped past-due breakdown (admin only)
  if (subPath === "/financials/past-due" && req.method === "GET") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const breakdown = await getPastDueBreakdown();
    sendJson(res, 200, { breakdown });
    return true;
  }

  // POST /api/admin/financials/past-due/refresh — manual invoice refresh (admin only)
  if (subPath === "/financials/past-due/refresh" && req.method === "POST") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    try {
      const { count } = await refreshInvoices({ manual: true });
      sendJson(res, 200, { ok: true, count });
    } catch (err) {
      sendJson(res, 502, { error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  // GET /api/admin/financials/accounts/:accountKey — invoices + notes for an account (admin only)
  const acctMatch = subPath.match(/^\/financials\/accounts\/([^/]+)$/);
  if (acctMatch && req.method === "GET") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const accountKey = decodeURIComponent(acctMatch[1]!);
    const { accountName, invoices } = await getAccountInvoices(accountKey);
    const notes = await listNotes(accountKey);
    const balance = invoices.reduce((s, i) => s + i.amount, 0);
    sendJson(res, 200, {
      accountKey,
      accountName,
      invoices,
      notes,
      paymentPlan: paymentPlanTerms(balance),
    });
    return true;
  }

  // GET/POST /api/admin/financials/notes — list (by ?accountKey) or create (admin only)
  if (subPath === "/financials/notes" && req.method === "GET") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    const accountKey = normalizeString(url.searchParams.get("accountKey"));
    if (!accountKey) {
      sendBadRequest(res, "accountKey required");
      return true;
    }
    const notes = await listNotes(accountKey);
    sendJson(res, 200, { notes });
    return true;
  }
  if (subPath === "/financials/notes" && req.method === "POST") {
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
    const accountKey = normalizeString(data.accountKey);
    const noteBody = normalizeString(data.body);
    if (!accountKey || !noteBody) {
      sendBadRequest(res, "accountKey and body required");
      return true;
    }
    const note = await addNote({ accountKey, body: noteBody, createdBy: sessionUser.id });
    sendJson(res, 201, { note });
    return true;
  }

  // DELETE /api/admin/financials/notes/:id (admin only)
  const noteDeleteMatch = subPath.match(/^\/financials\/notes\/([^/]+)$/);
  if (noteDeleteMatch && req.method === "DELETE") {
    if (!isAdmin) {
      sendForbidden(res);
      return true;
    }
    await deleteNote(noteDeleteMatch[1]!);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // POST /api/admin/financials/follow-up-task — create a task in the Collections project (admin only)
  if (subPath === "/financials/follow-up-task" && req.method === "POST") {
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
    const title = normalizeString(data.title);
    if (!title) {
      sendBadRequest(res, "title required");
      return true;
    }
    const validPriorities = ["low", "medium", "high", "urgent"] as const;
    const projectId = await ensureCollectionsProject(sessionUser.id);
    const task = await createTask({
      title,
      description: normalizeString(data.description),
      projectId,
      priority: validPriorities.includes(data.priority as (typeof validPriorities)[number])
        ? (data.priority as (typeof validPriorities)[number])
        : "high",
      dueDate: typeof data.dueDate === "number" ? data.dueDate : null,
      assignedTo: normalizeString(data.assignedTo),
      tags: ["collections"],
      createdBy: sessionUser.id,
    });
    sendJson(res, 201, { task, projectId });
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
