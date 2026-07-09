import crypto from "node:crypto";
import path from "node:path";
import { Kysely } from "kysely";
import { resolveStateDir } from "../../config/paths.js";
import { NodeSqliteKyselyDialect } from "../../infra/kysely-node-sqlite.js";
import { requireNodeSqlite } from "../../infra/node-sqlite.js";
import { configureSqliteWalMaintenance } from "../../infra/sqlite-wal.js";
import type {
  AdminUser,
  AdminUserRole,
  AdminSession,
  SessionUser,
  UserPermission,
} from "./types.js";

type UsersTable = {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
};

type SessionsTable = {
  token: string;
  user_id: string;
  created_at: number;
  expires_at: number;
  impersonator_id: string | null;
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
  start_date: number | null;
  end_date: number | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
};

type ProjectMembersTable = {
  project_id: string;
  user_id: string;
};

type TaskAssigneesTable = {
  task_id: string;
  user_id: string;
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
  recurrence: string | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
};

type SpiroOrdersTable = {
  id: string;
  month: string;
  client: string;
  company: string | null;
  market: string | null;
  status: string;
  cached_at: number;
};

type SpiroRefreshLogTable = {
  month: string;
  refreshed_at: number;
  manual: number;
};

type SpiroInvoicesTable = {
  invoice_id: string;
  reference_number: string | null;
  status: string | null;
  account_key: string;
  account_name: string;
  account_type: string;
  amount_total: number;
  date_created: number | null;
  date_due: number;
  order_count: number;
  cached_at: number;
};

type SpiroInvoiceRefreshLogTable = {
  id: string;
  refreshed_at: number;
  manual: number;
};

type FinancialNotesTable = {
  id: string;
  account_key: string;
  body: string;
  created_by: string | null;
  created_at: number;
};

type ClevelandOrdersTable = {
  order_id: string;
  photographer: string;
  revenue: number;
  delivered_at: number;
  cached_at: number;
};

type ClevelandRefreshLogTable = {
  id: string;
  refreshed_at: number;
  manual: number;
};

type AdminDb = {
  admin_users: UsersTable;
  admin_sessions: SessionsTable;
  admin_user_permissions: PermissionsTable;
  admin_resources: ResourcesTable;
  admin_projects: ProjectsTable;
  admin_project_members: ProjectMembersTable;
  admin_tasks: TasksTable;
  admin_task_assignees: TaskAssigneesTable;
  admin_spiro_orders: SpiroOrdersTable;
  admin_spiro_refresh_log: SpiroRefreshLogTable;
  admin_spiro_invoices: SpiroInvoicesTable;
  admin_spiro_invoice_refresh_log: SpiroInvoiceRefreshLogTable;
  admin_financial_notes: FinancialNotesTable;
  admin_cleveland_orders: ClevelandOrdersTable;
  admin_cleveland_refresh_log: ClevelandRefreshLogTable;
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
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      impersonator_id TEXT REFERENCES admin_users(id) ON DELETE CASCADE
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
      start_date INTEGER,
      end_date INTEGER,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_projects_created_at ON admin_projects(created_at);
    CREATE TABLE IF NOT EXISTS admin_project_members (
      project_id TEXT NOT NULL REFERENCES admin_projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      PRIMARY KEY (project_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS admin_project_members_user ON admin_project_members(user_id);
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
      recurrence TEXT CHECK(recurrence IN ('daily','weekly','monthly','yearly')),
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_tasks_project_id ON admin_tasks(project_id);
    CREATE INDEX IF NOT EXISTS admin_tasks_due_date ON admin_tasks(due_date);
    CREATE TABLE IF NOT EXISTS admin_task_assignees (
      task_id TEXT NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS admin_task_assignees_user ON admin_task_assignees(user_id);
    CREATE TABLE IF NOT EXISTS admin_spiro_orders (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      client TEXT NOT NULL,
      company TEXT,
      market TEXT,
      status TEXT NOT NULL DEFAULT '',
      cached_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_spiro_orders_month ON admin_spiro_orders(month);
    CREATE INDEX IF NOT EXISTS admin_spiro_orders_market ON admin_spiro_orders(market);
    CREATE TABLE IF NOT EXISTS admin_spiro_refresh_log (
      month TEXT PRIMARY KEY,
      refreshed_at INTEGER NOT NULL,
      manual INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS admin_spiro_invoices (
      invoice_id TEXT PRIMARY KEY,
      reference_number TEXT,
      status TEXT,
      account_key TEXT NOT NULL,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'unknown',
      amount_total REAL NOT NULL DEFAULT 0,
      date_created INTEGER,
      date_due INTEGER NOT NULL,
      order_count INTEGER NOT NULL DEFAULT 0,
      cached_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_spiro_invoices_account ON admin_spiro_invoices(account_key);
    CREATE INDEX IF NOT EXISTS admin_spiro_invoices_date_due ON admin_spiro_invoices(date_due);
    CREATE TABLE IF NOT EXISTS admin_spiro_invoice_refresh_log (
      id TEXT PRIMARY KEY,
      refreshed_at INTEGER NOT NULL,
      manual INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS admin_financial_notes (
      id TEXT PRIMARY KEY,
      account_key TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_financial_notes_account ON admin_financial_notes(account_key);
    CREATE TABLE IF NOT EXISTS admin_cleveland_orders (
      order_id TEXT PRIMARY KEY,
      photographer TEXT NOT NULL,
      revenue REAL NOT NULL DEFAULT 0,
      delivered_at INTEGER NOT NULL,
      cached_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_cleveland_orders_delivered ON admin_cleveland_orders(delivered_at);
    CREATE TABLE IF NOT EXISTS admin_cleveland_refresh_log (
      id TEXT PRIMARY KEY,
      refreshed_at INTEGER NOT NULL,
      manual INTEGER NOT NULL DEFAULT 0
    );
  `);
  const taskColumns = db.prepare("PRAGMA table_info(admin_tasks)").all() as Array<{ name: string }>;
  if (!taskColumns.some((c) => c.name === "recurrence")) {
    db.exec(
      "ALTER TABLE admin_tasks ADD COLUMN recurrence TEXT CHECK(recurrence IN ('daily','weekly','monthly','yearly'))",
    );
  }
  const sessionColumns = db.prepare("PRAGMA table_info(admin_sessions)").all() as Array<{
    name: string;
  }>;
  if (!sessionColumns.some((c) => c.name === "impersonator_id")) {
    db.exec(
      "ALTER TABLE admin_sessions ADD COLUMN impersonator_id TEXT REFERENCES admin_users(id) ON DELETE CASCADE",
    );
  }
  const userColumns = db.prepare("PRAGMA table_info(admin_users)").all() as Array<{
    name: string;
  }>;
  for (const col of ["first_name", "last_name", "email"] as const) {
    if (!userColumns.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE admin_users ADD COLUMN ${col} TEXT`);
    }
  }
  const projectColumns = db.prepare("PRAGMA table_info(admin_projects)").all() as Array<{
    name: string;
  }>;
  for (const col of ["start_date", "end_date"] as const) {
    if (!projectColumns.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE admin_projects ADD COLUMN ${col} INTEGER`);
    }
  }
  const spiroOrderColumns = db.prepare("PRAGMA table_info(admin_spiro_orders)").all() as Array<{
    name: string;
  }>;
  if (!spiroOrderColumns.some((c) => c.name === "company")) {
    db.exec("ALTER TABLE admin_spiro_orders ADD COLUMN company TEXT");
  }
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
      first_name: null,
      last_name: null,
      email: null,
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
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    email: row.email ?? null,
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
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): Promise<AdminUser> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const passwordHash = await createPasswordHash(params.password);
  const now = Date.now();
  const firstName = params.firstName ?? null;
  const lastName = params.lastName ?? null;
  const email = params.email ?? null;
  await db
    .insertInto("admin_users")
    .values({
      id,
      username: params.username,
      password_hash: passwordHash,
      role: params.role,
      first_name: firstName,
      last_name: lastName,
      email,
      created_at: now,
      updated_at: now,
      last_login_at: null,
    })
    .execute();
  return {
    id,
    username: params.username,
    role: params.role,
    firstName,
    lastName,
    email,
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
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  },
): Promise<AdminUser | null> {
  const db = getAdminDb();
  const updates: Partial<UsersTable> = { updated_at: Date.now() };
  if (params.username) updates.username = params.username;
  if (params.role) updates.role = params.role;
  if (params.password) updates.password_hash = await createPasswordHash(params.password);
  if (params.firstName !== undefined) updates.first_name = params.firstName;
  if (params.lastName !== undefined) updates.last_name = params.lastName;
  if (params.email !== undefined) updates.email = params.email;
  await db.updateTable("admin_users").set(updates).where("id", "=", id).execute();
  return getUserById(id);
}

export async function deleteUser(id: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_users").where("id", "=", id).execute();
}

export async function createSession(
  userId: string,
  options?: { impersonatorId?: string },
): Promise<AdminSession> {
  const db = getAdminDb();
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const impersonatorId = options?.impersonatorId ?? null;
  await db
    .insertInto("admin_sessions")
    .values({
      token,
      user_id: userId,
      created_at: now,
      expires_at: expiresAt,
      impersonator_id: impersonatorId,
    })
    .execute();
  // Impersonated sessions shouldn't overwrite the target user's own login history.
  if (!impersonatorId) {
    await db
      .updateTable("admin_users")
      .set({ last_login_at: now, updated_at: now })
      .where("id", "=", userId)
      .execute();
  }
  // Purge expired sessions periodically
  await db.deleteFrom("admin_sessions").where("expires_at", "<", now).execute();
  return { token, userId, createdAt: now, expiresAt, impersonatorId };
}

export async function resolveSessionUser(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_sessions")
    .innerJoin("admin_users", "admin_users.id", "admin_sessions.user_id")
    .selectAll("admin_users")
    .select("admin_sessions.impersonator_id")
    .where("admin_sessions.token", "=", token)
    .where("admin_sessions.expires_at", ">", Date.now())
    .executeTakeFirst();
  if (!row) return null;
  return { ...rowToUser(row as UsersTable), impersonatorId: row.impersonator_id ?? null };
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
