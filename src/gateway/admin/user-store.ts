import crypto from "node:crypto";
import path from "node:path";
import { Kysely } from "kysely";
import { resolveStateDir } from "../../config/paths.js";
import { NodeSqliteKyselyDialect } from "../../infra/kysely-node-sqlite.js";
import { requireNodeSqlite } from "../../infra/node-sqlite.js";
import { configureSqliteWalMaintenance } from "../../infra/sqlite-wal.js";
import type { AdminUser, AdminUserRole, AdminSession, UserPermission } from "./types.js";

type UsersTable = {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
};

type SessionsTable = {
  token: string;
  user_id: string;
  created_at: number;
  expires_at: number;
};

type PermissionsTable = {
  user_id: string;
  permission_type: string;
  value: string;
};

type ResourcesTable = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  url: string | null;
  filename: string | null;
  stored_filename: string | null;
  mimetype: string | null;
  filesize: number | null;
  tags: string;
  ai_access: number;
  user_access: number;
  created_by: string | null;
  created_at: number;
  updated_at: number;
};

type ProjectsTable = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  color: string;
  tags: string;
  created_by: string | null;
  created_at: number;
  updated_at: number;
};

type TasksTable = {
  id: string;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: number | null;
  assigned_to: string | null;
  tags: string;
  position: number;
  created_by: string | null;
  created_at: number;
  updated_at: number;
};

type AdminDb = {
  admin_users: UsersTable;
  admin_sessions: SessionsTable;
  admin_user_permissions: PermissionsTable;
  admin_resources: ResourcesTable;
  admin_projects: ProjectsTable;
  admin_tasks: TasksTable;
};

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";

function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString("hex"));
    });
  });
}

export async function createPasswordHash(password: string): Promise<string> {
  const salt = crypto.randomBytes(32).toString("hex");
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = await hashPassword(password, salt);
  const candidateBuf = Buffer.from(candidate, "hex");
  const hashBuf = Buffer.from(hash, "hex");
  if (candidateBuf.length !== hashBuf.length) return false;
  return crypto.timingSafeEqual(candidateBuf, hashBuf);
}

let dbInstance: Kysely<AdminDb> | undefined;
let walMaintenance: { close: () => boolean } | undefined;

function resolveAdminDbPath(): string {
  return path.join(resolveStateDir(), "admin.db");
}

export function getAdminDb(): Kysely<AdminDb> {
  if (dbInstance) return dbInstance;

  const { DatabaseSync } = requireNodeSqlite();
  const dbPath = resolveAdminDbPath();
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");

  dbInstance = new Kysely<AdminDb>({
    dialect: new NodeSqliteKyselyDialect({ database: db }),
  });

  walMaintenance = configureSqliteWalMaintenance(db);

  initSchema(db);
  return dbInstance;
}

function initSchema(db: import("node:sqlite").DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_sessions_user_id ON admin_sessions(user_id);
    CREATE INDEX IF NOT EXISTS admin_sessions_expires_at ON admin_sessions(expires_at);
    CREATE TABLE IF NOT EXISTS admin_user_permissions (
      user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      permission_type TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, permission_type, value)
    );
    CREATE TABLE IF NOT EXISTS admin_resources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('link','file')),
      url TEXT,
      filename TEXT,
      stored_filename TEXT,
      mimetype TEXT,
      filesize INTEGER,
      tags TEXT NOT NULL DEFAULT '[]',
      ai_access INTEGER NOT NULL DEFAULT 1,
      user_access INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_resources_created_at ON admin_resources(created_at);
    CREATE TABLE IF NOT EXISTS admin_projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('planning','active','completed','archived')),
      color TEXT NOT NULL DEFAULT '#3b82f6',
      tags TEXT NOT NULL DEFAULT '[]',
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_projects_created_at ON admin_projects(created_at);
    CREATE TABLE IF NOT EXISTS admin_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES admin_projects(id) ON DELETE CASCADE,
      parent_task_id TEXT REFERENCES admin_tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','review','done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      due_date INTEGER,
      assigned_to TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      position INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_tasks_project_id ON admin_tasks(project_id);
    CREATE INDEX IF NOT EXISTS admin_tasks_due_date ON admin_tasks(due_date);
  `);
}

export async function ensureSuperadminExists(): Promise<{ created: boolean; username: string }> {
  const db = getAdminDb();
  const existing = await db
    .selectFrom("admin_users")
    .where("role", "=", "superadmin")
    .select(["id", "username"])
    .executeTakeFirst();

  if (existing) {
    return { created: false, username: existing.username };
  }

  const id = crypto.randomUUID();
  const username = "admin";
  const password = crypto.randomBytes(16).toString("hex");
  const passwordHash = await createPasswordHash(password);
  const now = Date.now();

  await db
    .insertInto("admin_users")
    .values({
      id,
      username,
      password_hash: passwordHash,
      role: "superadmin",
      created_at: now,
      updated_at: now,
      last_login_at: null,
    })
    .execute();

  // Print credentials to stderr once on first run
  process.stderr.write(
    `\n[admin] First-run superadmin created. Username: ${username}  Password: ${password}\n` +
      `[admin] Change this password immediately at /admin/\n\n`,
  );

  return { created: true, username };
}

function rowToUser(row: UsersTable): AdminUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role as AdminUserRole,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at ?? null,
  };
}

export async function getUserById(id: string): Promise<AdminUser | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_users")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? rowToUser(row) : null;
}

export async function getUserByUsername(
  username: string,
): Promise<(AdminUser & { passwordHash: string }) | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_users")
    .selectAll()
    .where("username", "=", username)
    .executeTakeFirst();
  if (!row) return null;
  return { ...rowToUser(row), passwordHash: row.password_hash };
}

export async function listUsers(): Promise<AdminUser[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_users")
    .selectAll()
    .orderBy("created_at", "asc")
    .execute();
  return rows.map(rowToUser);
}

export async function createUser(params: {
  username: string;
  password: string;
  role: AdminUserRole;
}): Promise<AdminUser> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const passwordHash = await createPasswordHash(params.password);
  const now = Date.now();
  await db
    .insertInto("admin_users")
    .values({
      id,
      username: params.username,
      password_hash: passwordHash,
      role: params.role,
      created_at: now,
      updated_at: now,
      last_login_at: null,
    })
    .execute();
  return {
    id,
    username: params.username,
    role: params.role,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
}

export async function updateUser(
  id: string,
  params: {
    username?: string;
    password?: string;
    role?: AdminUserRole;
  },
): Promise<AdminUser | null> {
  const db = getAdminDb();
  const updates: Partial<UsersTable> = { updated_at: Date.now() };
  if (params.username) updates.username = params.username;
  if (params.role) updates.role = params.role;
  if (params.password) updates.password_hash = await createPasswordHash(params.password);
  await db.updateTable("admin_users").set(updates).where("id", "=", id).execute();
  return getUserById(id);
}

export async function deleteUser(id: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_users").where("id", "=", id).execute();
}

export async function createSession(userId: string): Promise<AdminSession> {
  const db = getAdminDb();
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await db
    .insertInto("admin_sessions")
    .values({
      token,
      user_id: userId,
      created_at: now,
      expires_at: expiresAt,
    })
    .execute();
  await db
    .updateTable("admin_users")
    .set({ last_login_at: now, updated_at: now })
    .where("id", "=", userId)
    .execute();
  // Purge expired sessions periodically
  await db.deleteFrom("admin_sessions").where("expires_at", "<", now).execute();
  return { token, userId, createdAt: now, expiresAt };
}

export async function resolveSessionUser(token: string): Promise<AdminUser | null> {
  if (!token) return null;
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_sessions")
    .innerJoin("admin_users", "admin_users.id", "admin_sessions.user_id")
    .selectAll("admin_users")
    .where("admin_sessions.token", "=", token)
    .where("admin_sessions.expires_at", ">", Date.now())
    .executeTakeFirst();
  return row ? rowToUser(row as UsersTable) : null;
}

export async function deleteSession(token: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_sessions").where("token", "=", token).execute();
}

export async function getUserPermissions(userId: string): Promise<UserPermission[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_user_permissions")
    .selectAll()
    .where("user_id", "=", userId)
    .execute();
  return rows.map((r) => ({
    userId: r.user_id,
    permissionType: r.permission_type as UserPermission["permissionType"],
    value: r.value,
  }));
}

export async function setUserPermissions(
  userId: string,
  permissions: Array<{ permissionType: string; value: string }>,
): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_user_permissions").where("user_id", "=", userId).execute();
  if (permissions.length > 0) {
    await db
      .insertInto("admin_user_permissions")
      .values(
        permissions.map((p) => ({
          user_id: userId,
          permission_type: p.permissionType,
          value: p.value,
        })),
      )
      .execute();
  }
}
