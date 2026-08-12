import crypto from "node:crypto";
import fs from "node:fs";
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
  /** Owning folder, or null for a resource that sits at the library root. */
  folder_id: string | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
};

type ResourceFoldersTable = {
  id: string;
  name: string;
  description: string | null;
  /** Parent folder, or null for a top-level folder. */
  parent_id: string | null;
  /** Mirrors admin_resources.user_access: whether the portal may see it. */
  user_access: number;
  created_by: string | null;
  created_at: number;
  updated_at: number;
};

/**
 * A user's starred folders and resources. Keyed by item type as well as id so
 * one table serves both without the ids having to be unique across them.
 */
type ResourceFavoritesTable = {
  user_id: string;
  item_type: string;
  item_id: string;
  created_at: number;
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

type AttachmentsTable = {
  id: string;
  owner_type: string;
  owner_id: string;
  type: string;
  title: string;
  url: string | null;
  filename: string | null;
  stored_filename: string | null;
  mimetype: string | null;
  filesize: number | null;
  created_by: string | null;
  created_at: number;
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
  /** Spiro's `client.agentId`, so rankings can key on the agent, not their name. */
  agent_id: string | null;
  /** Spiro's `client.companyId`, the same idea for the company ranking. */
  company_id: string | null;
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
  amount_paid: number | null;
  amount_due: number | null;
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

type SpiroPhotographersTable = {
  photographer_id: string;
  name: string;
  markets: string; // JSON array of service-area names
  active: number;
  cached_at: number;
};

type SpiroPhotographerShootsTable = {
  photographer_id: string;
  month: string; // YYYY-MM
  shoots: number;
};

type SpiroPhotographerRefreshLogTable = {
  id: string;
  refreshed_at: number;
  manual: number;
};

// Cached Pipedrive directory, swept wholesale. `name_key` is the normalized
// form both reports join on; the raw name is kept so a bad match is visible.
type PipedrivePersonsTable = {
  person_id: number;
  name: string;
  name_key: string;
  email: string | null;
  org_name: string | null;
  last_activity_at: number | null;
  cached_at: number;
};

type PipedriveOrgsTable = {
  org_id: number;
  name: string;
  name_key: string;
  last_activity_at: number | null;
  cached_at: number;
};

type PipedriveContactEventsTable = {
  party_type: string;
  party_id: number;
  last_contact_at: number;
  cached_at: number;
};

type PipedriveRefreshLogTable = {
  id: string;
  refreshed_at: number;
  manual: number;
};

// Focus report caches: companies carry the service area that decides a client's
// region, agents carry the email that joins them to the CRM, orders carry both
// the shoot count and the revenue.
type FocusCompaniesTable = {
  company_id: string;
  name: string;
  region: string | null;
  cached_at: number;
};

type FocusAgentsTable = {
  agent_id: string;
  name: string;
  email: string | null;
  company_id: string | null;
  /** Spiro's `settings.vip`, as 0/1. Null on rows cached before it was swept. */
  vip: number | null;
  /**
   * Spiro's CRM relationship status (current/former/prospective/unclassified).
   * The roster deliberately holds every status: a VIP who is not "current"
   * still bills, and still has to read as a VIP wherever they appear.
   */
  status: string | null;
  /** Region key the top-slice cut below was made within. */
  region: string | null;
  /**
   * In the top slice of their own region by trailing-12-month revenue, as 0/1.
   * Stored rather than recomputed so the badge means the same thing on every
   * screen instead of shifting with whatever window a report happens to show.
   */
  top_percent: number | null;
  cached_at: number;
};

type FocusOrdersTable = {
  order_id: string;
  agent_id: string;
  agent_name: string;
  company_id: string | null;
  company_name: string | null;
  order_date: number;
  total: number;
  status: string;
  cached_at: number;
};

type FocusRefreshLogTable = {
  id: string;
  refreshed_at: number;
  manual: number;
};

// One cached Redfin trends payload per area ("national" plus a region key).
// The body is stored raw so a parser change can be redeployed and take effect
// without spending credits re-fetching a monthly series that has not moved.
type MarketSnapshotsTable = {
  area_key: string;
  label: string;
  query: string;
  payload: string;
  error: string | null;
  fetched_at: number;
};

// Reusable outreach scripts with merge fields, picked on an account.
type OutreachTemplatesTable = {
  id: string;
  title: string;
  kind: string;
  subject: string | null;
  body: string;
  buckets: string;
  active: number;
  sort_order: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: number;
  updated_at: number;
};

// A contact somebody actually made, logged from the Past Due drawer. Distinct
// from Pipedrive activity: this is the collections record, and it wins.
type PastDueContactsTable = {
  id: string;
  account_key: string;
  contacted_at: number;
  channel: string;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: number;
};

type PipedriveCleanupItemsTable = {
  id: string;
  item_key: string;
  market: string;
  kind: string;
  title: string;
  detail: string;
  office: string | null;
  verify: number;
  payload: string;
  status: string;
  note: string | null;
  created_at: number;
  updated_at: number;
  approved_by: string | null;
  approved_at: number | null;
  done_by: string | null;
  done_at: number | null;
};

// Agents hidden from the Churn & Retention report. Shared across the team: one
// person cleans the outreach queue and everyone sees the cleaned list.
type ChurnDismissalsTable = {
  agent_key: string;
  agent_name: string;
  company_name: string | null;
  reason: string | null;
  dismissed_by: string | null;
  dismissed_by_name: string | null;
  dismissed_at: number;
};

// Free-text notes against an agent on the Churn & Retention report. Shared, and
// kept out of the snapshot so they survive the engine regenerating it. Appended
// rather than overwritten: the note history is the record of who chased whom.
type ChurnNotesTable = {
  id: string;
  agent_key: string;
  agent_name: string;
  company_name: string | null;
  body: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: number;
};

type FinancialNotesTable = {
  id: string;
  account_key: string;
  body: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: number;
};

type PastDueCasesTable = {
  account_key: string;
  account_name: string;
  status: string;
  /** Pinned collections step, or null to follow the aging policy. */
  next_action: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: number | null;
  due_at: number | null;
  review_cleared_by: string | null;
  review_cleared_by_name: string | null;
  review_cleared_at: number | null;
  created_at: number;
  updated_at: number;
  updated_by_name: string | null;
};

type PastDueFollowupsTable = {
  task_id: string;
  account_key: string;
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

type TicketsTable = {
  id: string;
  number: string;
  reply_token: string;
  category: string;
  status: string;
  priority: string;
  source: string;
  subject: string;
  description: string | null;
  department: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  order_id: string | null;
  order_address: string | null;
  /**
   * The Spiro handoff: a ticket opened from an order's delivery page arrives
   * carrying who the agent is and what was shot. Stored as given rather than
   * resolved against Spiro — this is what the requester's page knew at the
   * moment they asked, and the desk needs it even if the order later changes.
   */
  order_link: string | null;
  agent_title: string | null;
  agent_company: string | null;
  /** Who pressed the button — the agent, or an admin acting for them. */
  submitted_by: string | null;
  photographer_name: string | null;
  /** Confirmed shoot date, kept as the string Spiro sent (no zone guessing). */
  shoot_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  is_test: number;
  /** Low end of the estimate in whole cents; the firm total when nothing needs quoting. */
  estimate_cents: number | null;
  /** High end, or null when every priced choice on the ticket is firm. */
  estimate_max_cents: number | null;
  quote_required: number;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
};

type TaskStatusesTable = {
  id: string;
  project_id: string | null;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_done: number;
  wip_limit: number | null;
  created_at: number;
  updated_at: number;
};

type TaskEventsTable = {
  id: string;
  task_id: string;
  kind: string;
  body: string | null;
  meta: string | null;
  mentions: string;
  author_id: string | null;
  author_name: string | null;
  created_at: number;
  edited_at: number | null;
};

type TicketEventsTable = {
  id: string;
  ticket_id: string;
  kind: string;
  author_type: string;
  author_name: string | null;
  body: string | null;
  meta: string | null;
  created_at: number;
};

type TicketSeqTable = {
  id: number;
  next_number: number;
};

type TicketDepartmentsTable = {
  key: string;
  label: string;
  email: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

type TicketCategoryRoutesTable = {
  category: string;
  department_key: string;
};

type TicketCategoriesTable = {
  key: string;
  label: string;
  short_label: string;
  extra_field: string;
  extra_label: string | null;
  extra_options: string | null;
  extra_placeholder: string | null;
  details_label: string;
  details_hint: string | null;
  sort_order: number;
  active: number;
  created_at: number;
  updated_at: number;
};

export type AdminDb = {
  admin_users: UsersTable;
  admin_sessions: SessionsTable;
  admin_user_permissions: PermissionsTable;
  admin_resources: ResourcesTable;
  admin_resource_folders: ResourceFoldersTable;
  admin_resource_favorites: ResourceFavoritesTable;
  admin_projects: ProjectsTable;
  admin_project_members: ProjectMembersTable;
  admin_tasks: TasksTable;
  admin_task_assignees: TaskAssigneesTable;
  admin_task_events: TaskEventsTable;
  admin_task_statuses: TaskStatusesTable;
  admin_attachments: AttachmentsTable;
  admin_spiro_orders: SpiroOrdersTable;
  admin_spiro_refresh_log: SpiroRefreshLogTable;
  admin_spiro_invoices: SpiroInvoicesTable;
  admin_spiro_invoice_refresh_log: SpiroInvoiceRefreshLogTable;
  admin_spiro_photographers: SpiroPhotographersTable;
  admin_spiro_photographer_shoots: SpiroPhotographerShootsTable;
  admin_spiro_photographer_refresh_log: SpiroPhotographerRefreshLogTable;
  admin_pipedrive_cleanup_items: PipedriveCleanupItemsTable;
  admin_pipedrive_persons: PipedrivePersonsTable;
  admin_pipedrive_orgs: PipedriveOrgsTable;
  admin_pipedrive_refresh_log: PipedriveRefreshLogTable;
  admin_pipedrive_contact_events: PipedriveContactEventsTable;
  admin_past_due_contacts: PastDueContactsTable;
  admin_outreach_templates: OutreachTemplatesTable;
  admin_focus_companies: FocusCompaniesTable;
  admin_focus_agents: FocusAgentsTable;
  admin_focus_orders: FocusOrdersTable;
  admin_focus_refresh_log: FocusRefreshLogTable;
  admin_market_snapshots: MarketSnapshotsTable;
  admin_churn_dismissals: ChurnDismissalsTable;
  admin_churn_notes: ChurnNotesTable;
  admin_financial_notes: FinancialNotesTable;
  admin_past_due_cases: PastDueCasesTable;
  admin_past_due_followups: PastDueFollowupsTable;
  admin_cleveland_orders: ClevelandOrdersTable;
  admin_cleveland_refresh_log: ClevelandRefreshLogTable;
  admin_tickets: TicketsTable;
  admin_ticket_events: TicketEventsTable;
  admin_ticket_seq: TicketSeqTable;
  admin_ticket_test_seq: TicketSeqTable;
  admin_ticket_departments: TicketDepartmentsTable;
  admin_ticket_category_routes: TicketCategoryRoutesTable;
  admin_ticket_categories: TicketCategoriesTable;
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

function resolveAdminDbPath(): string {
  return path.join(resolveStateDir(), "admin.db");
}

export function getAdminDb(): Kysely<AdminDb> {
  if (dbInstance) return dbInstance;

  const { DatabaseSync } = requireNodeSqlite();
  const dbPath = resolveAdminDbPath();
  const db = new DatabaseSync(dbPath);
  // node:sqlite creates the file with the process umask (0644 by default), and
  // it holds customer PII, password hashes and live session tokens. Tighten it
  // before WAL mode runs, since SQLite copies the main file's mode onto the
  // -wal and -shm sidecars it creates.
  try {
    fs.chmodSync(dbPath, 0o600);
  } catch (err) {
    // Non-fatal: a read-only or foreign-owned file should not block startup.
    console.warn(`admin: could not tighten permissions on ${dbPath}:`, err);
  }
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");

  dbInstance = new Kysely<AdminDb>({
    dialect: new NodeSqliteKyselyDialect({ database: db }),
  });

  // Called for the side effect (WAL pragmas + an unref'd checkpoint timer). The
  // returned handle only exists to stop that timer, and this database is a
  // process-lifetime singleton with no close path, so there is nothing to hold.
  configureSqliteWalMaintenance(db);

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
    CREATE TABLE IF NOT EXISTS admin_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
    -- Deleting a folder re-parents its children to that folder's own parent
    -- rather than cascading, so a mis-click can never take a subtree of
    -- resources with it. resource-store.ts owns that re-parenting.
    CREATE TABLE IF NOT EXISTS admin_resource_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      parent_id TEXT REFERENCES admin_resource_folders(id) ON DELETE SET NULL,
      user_access INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_resource_folders_parent ON admin_resource_folders(parent_id);
    CREATE TABLE IF NOT EXISTS admin_resource_favorites (
      user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK(item_type IN ('folder','resource')),
      item_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, item_type, item_id)
    );
    CREATE INDEX IF NOT EXISTS admin_resource_favorites_user ON admin_resource_favorites(user_id);
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
      folder_id TEXT REFERENCES admin_resource_folders(id) ON DELETE SET NULL,
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
      -- No CHECK: board columns are data (admin_task_statuses), not a fixed
      -- enum. Existing databases are freed by migrateTaskStatusCheck.
      status TEXT NOT NULL DEFAULT 'todo',
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
    -- One chronological feed per task: what people said and what the task did.
    -- Comments and activity share a table so the drawer can render them in a
    -- single stream, the way every board tool does. author_name is denormalised
    -- so history stays readable after the account that wrote it is deleted.
    -- meta holds the field/from/to payload for activity rows as JSON.
    CREATE TABLE IF NOT EXISTS admin_task_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('comment','activity')),
      body TEXT,
      meta TEXT,
      mentions TEXT NOT NULL DEFAULT '[]',
      author_id TEXT,
      author_name TEXT,
      created_at INTEGER NOT NULL,
      edited_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS admin_task_events_task ON admin_task_events(task_id, created_at);
    -- Board columns. A row with project_id NULL belongs to the global default
    -- set, used by projects that have not customised and by tasks with no
    -- project. is_done marks the column that means finished -- recurrence,
    -- due-date colouring and progress all ask that rather than hardcoding a key.
    CREATE TABLE IF NOT EXISTS admin_task_statuses (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES admin_projects(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6b7280',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_done INTEGER NOT NULL DEFAULT 0,
      wip_limit INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS admin_task_statuses_scope_key
      ON admin_task_statuses(IFNULL(project_id, ''), key);
    -- Links and files hung off a task or project. No FK: owner_type decides which
    -- table owner_id points at, so cascade is handled in the delete paths.
    CREATE TABLE IF NOT EXISTS admin_attachments (
      id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('task','project','ticket')),
      owner_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('link','file')),
      title TEXT NOT NULL,
      url TEXT,
      filename TEXT,
      stored_filename TEXT,
      mimetype TEXT,
      filesize INTEGER,
      created_by TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_attachments_owner ON admin_attachments(owner_type, owner_id);
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
      -- Nullable on purpose: NULL means Spiro did not report the figure, which
      -- is not the same as a reported 0. Outstanding falls back to the total.
      amount_paid REAL,
      amount_due REAL,
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
    CREATE TABLE IF NOT EXISTS admin_spiro_photographers (
      photographer_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      markets TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      cached_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_spiro_photographer_shoots (
      photographer_id TEXT NOT NULL,
      month TEXT NOT NULL,
      shoots INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (photographer_id, month)
    );
    CREATE TABLE IF NOT EXISTS admin_spiro_photographer_refresh_log (
      id TEXT PRIMARY KEY,
      refreshed_at INTEGER NOT NULL,
      manual INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS admin_pipedrive_persons (
      person_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL,
      email TEXT,
      org_name TEXT,
      last_activity_at INTEGER,
      cached_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_pipedrive_persons_key ON admin_pipedrive_persons(name_key);
    CREATE INDEX IF NOT EXISTS admin_pipedrive_persons_email ON admin_pipedrive_persons(email);
    CREATE TABLE IF NOT EXISTS admin_pipedrive_orgs (
      org_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL,
      last_activity_at INTEGER,
      cached_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_pipedrive_orgs_key ON admin_pipedrive_orgs(name_key);
    CREATE TABLE IF NOT EXISTS admin_pipedrive_refresh_log (
      id TEXT PRIMARY KEY,
      refreshed_at INTEGER NOT NULL,
      manual INTEGER NOT NULL DEFAULT 0
    );
    -- When each party was last GENUINELY contacted: a human-run activity or a
    -- mail thread a real salesperson sent, as opposed to the newsletter opens
    -- and shared-inbox order traffic that last_activity_at counts.
    -- Accumulates: the mail sweep is incremental, so rows outlive its window.
    CREATE TABLE IF NOT EXISTS admin_pipedrive_contact_events (
      party_type TEXT NOT NULL CHECK(party_type IN ('person','organization')),
      party_id INTEGER NOT NULL,
      last_contact_at INTEGER NOT NULL,
      cached_at INTEGER NOT NULL,
      PRIMARY KEY (party_type, party_id)
    );
    CREATE TABLE IF NOT EXISTS admin_past_due_contacts (
      id TEXT PRIMARY KEY,
      account_key TEXT NOT NULL,
      contacted_at INTEGER NOT NULL,
      channel TEXT NOT NULL,
      note TEXT,
      created_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
      created_by_name TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_past_due_contacts_account ON admin_past_due_contacts(account_key, contacted_at DESC);
    CREATE TABLE IF NOT EXISTS admin_focus_companies (
      company_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT,
      cached_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_focus_agents (
      agent_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      company_id TEXT,
      vip INTEGER,
      status TEXT,
      region TEXT,
      top_percent INTEGER,
      cached_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_focus_agents_name ON admin_focus_agents(name);
    CREATE TABLE IF NOT EXISTS admin_focus_orders (
      order_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      company_id TEXT,
      company_name TEXT,
      order_date INTEGER NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unknown',
      cached_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_focus_orders_date ON admin_focus_orders(order_date);
    CREATE INDEX IF NOT EXISTS admin_focus_orders_agent ON admin_focus_orders(agent_id);
    CREATE TABLE IF NOT EXISTS admin_focus_refresh_log (
      id TEXT PRIMARY KEY,
      refreshed_at INTEGER NOT NULL,
      manual INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS admin_market_snapshots (
      area_key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      query TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      fetched_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_outreach_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'call',
      subject TEXT,
      body TEXT NOT NULL,
      buckets TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
      created_by_name TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_pipedrive_cleanup_items (
      id TEXT PRIMARY KEY,
      item_key TEXT NOT NULL UNIQUE,
      market TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('merge','fill','exclude','review')),
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      office TEXT,
      verify INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested','approved','rejected','done')),
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      approved_by TEXT,
      approved_at INTEGER,
      done_by TEXT,
      done_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS admin_pipedrive_cleanup_status ON admin_pipedrive_cleanup_items(status);
    CREATE TABLE IF NOT EXISTS admin_churn_dismissals (
      agent_key TEXT PRIMARY KEY,
      agent_name TEXT NOT NULL,
      company_name TEXT,
      reason TEXT,
      dismissed_by TEXT,
      dismissed_by_name TEXT,
      dismissed_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_churn_notes (
      id TEXT PRIMARY KEY,
      agent_key TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      company_name TEXT,
      body TEXT NOT NULL,
      created_by TEXT,
      created_by_name TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_churn_notes_agent ON admin_churn_notes(agent_key);
    CREATE TABLE IF NOT EXISTS admin_financial_notes (
      id TEXT PRIMARY KEY,
      account_key TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by TEXT,
      created_by_name TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_financial_notes_account ON admin_financial_notes(account_key);
    -- Collections worklist state for a past-due account. The invoice snapshot is
    -- replaced wholesale on every Spiro refresh, so anything a human decides —
    -- stage, owner, next action, manual-review sign-off — lives here and is
    -- re-attached by account_key when the report is read.
    CREATE TABLE IF NOT EXISTS admin_past_due_cases (
      account_key TEXT PRIMARY KEY,
      account_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK(status IN ('new','working','promised','plan','escalated','resolved')),
      -- Pinned collections step. NULL means "follow the aging policy", which is
      -- what every account does until someone deliberately says otherwise.
      next_action TEXT,
      assigned_to TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
      assigned_by TEXT,
      assigned_at INTEGER,
      due_at INTEGER,
      review_cleared_by TEXT,
      review_cleared_by_name TEXT,
      review_cleared_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      updated_by_name TEXT
    );
    CREATE INDEX IF NOT EXISTS admin_past_due_cases_assigned ON admin_past_due_cases(assigned_to);
    -- Ties a collections follow-up task back to the account it was raised for.
    -- The link lives here rather than as a column on admin_tasks because it is
    -- a collections concern; a task carries no account of its own. Deleting the
    -- task drops the link, which is what makes "Next Contact" clear itself.
    CREATE TABLE IF NOT EXISTS admin_past_due_followups (
      task_id TEXT PRIMARY KEY REFERENCES admin_tasks(id) ON DELETE CASCADE,
      account_key TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_past_due_followups_account
      ON admin_past_due_followups(account_key);
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
    CREATE TABLE IF NOT EXISTS admin_tickets (
      id TEXT PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      reply_token TEXT UNIQUE NOT NULL,
      -- Category keys are managed data (admin_ticket_categories), not a closed
      -- set: admins add their own from the dashboard. Validated at the intake
      -- boundary instead of by a CHECK that would need a table rebuild to edit.
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','needs_review','resolved','closed')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('widget','email','manual')),
      subject TEXT NOT NULL,
      description TEXT,
      department TEXT NOT NULL DEFAULT 'general',
      requester_name TEXT,
      requester_email TEXT,
      requester_phone TEXT,
      order_id TEXT,
      order_address TEXT,
      -- Spiro delivery-page handoff, as sent at submit time.
      order_link TEXT,
      agent_title TEXT,
      agent_company TEXT,
      submitted_by TEXT,
      photographer_name TEXT,
      shoot_date TEXT,
      assigned_to TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
      created_by TEXT,
      is_test INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS admin_tickets_status ON admin_tickets(status);
    CREATE INDEX IF NOT EXISTS admin_tickets_department ON admin_tickets(department);
    CREATE INDEX IF NOT EXISTS admin_tickets_created_at ON admin_tickets(created_at);
    CREATE INDEX IF NOT EXISTS admin_tickets_order ON admin_tickets(order_id);
    CREATE TABLE IF NOT EXISTS admin_ticket_events (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES admin_tickets(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('created','comment','status_change','assignment','email_out','email_in')),
      author_type TEXT NOT NULL CHECK(author_type IN ('client','staff','system')),
      author_name TEXT,
      body TEXT,
      meta TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_ticket_events_ticket ON admin_ticket_events(ticket_id);
    CREATE TABLE IF NOT EXISTS admin_ticket_seq (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      next_number INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_ticket_test_seq (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      next_number INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_ticket_departments (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      email TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_ticket_category_routes (
      category TEXT PRIMARY KEY,
      department_key TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_ticket_categories (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      short_label TEXT NOT NULL,
      extra_field TEXT NOT NULL DEFAULT 'none' CHECK(extra_field IN ('none','select','text','multiselect')),
      extra_label TEXT,
      extra_options TEXT,
      extra_placeholder TEXT,
      details_label TEXT NOT NULL,
      details_hint TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  migrateTicketCategoryCheck(db);
  migrateAttachmentOwnerCheck(db);
  migrateCategoryExtraFieldCheck(db);
  const taskColumns = db.prepare("PRAGMA table_info(admin_tasks)").all() as Array<{ name: string }>;
  if (!taskColumns.some((c) => c.name === "recurrence")) {
    db.exec(
      "ALTER TABLE admin_tasks ADD COLUMN recurrence TEXT CHECK(recurrence IN ('daily','weekly','monthly','yearly'))",
    );
  }
  // Must follow the recurrence backfill: the rebuild copies that column across.
  migrateTaskStatusCheck(db);
  seedDefaultTaskStatuses(db);
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
  const ticketColumns = db.prepare("PRAGMA table_info(admin_tickets)").all() as Array<{
    name: string;
  }>;
  if (!ticketColumns.some((c) => c.name === "is_test")) {
    db.exec("ALTER TABLE admin_tickets ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0");
  }
  // Total of the priced choices a client ticked. Nullable: most tickets carry no
  // estimate, and 0 would read as "quoted at nothing" rather than "not quoted".
  if (!ticketColumns.some((c) => c.name === "estimate_cents")) {
    db.exec("ALTER TABLE admin_tickets ADD COLUMN estimate_cents INTEGER");
  }
  // A choice priced as a range makes the estimate a band rather than a number,
  // and a banded or figure-less choice cannot be started until the client
  // accepts a quote. Existing rows are firm by construction: they were taken
  // when every choice carried one price, so a null high end and a 0 flag are
  // the correct reading of them, not a default standing in for unknown.
  if (!ticketColumns.some((c) => c.name === "estimate_max_cents")) {
    db.exec("ALTER TABLE admin_tickets ADD COLUMN estimate_max_cents INTEGER");
  }
  if (!ticketColumns.some((c) => c.name === "quote_required")) {
    db.exec("ALTER TABLE admin_tickets ADD COLUMN quote_required INTEGER NOT NULL DEFAULT 0");
  }
  // The Spiro delivery-page handoff. All nullable: tickets predating the linked
  // button, and any opened straight from the dashboard, legitimately have none
  // of this — an empty string would read as "asked and answered blank".
  for (const col of [
    "order_link",
    "agent_title",
    "agent_company",
    "submitted_by",
    "photographer_name",
    "shoot_date",
  ]) {
    if (!ticketColumns.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE admin_tickets ADD COLUMN ${col} TEXT`);
    }
  }
  // Spiro reports amountPaid/amountDue per invoice; the snapshot predates both.
  // Nullable, so rows cached before the next refresh read as "not reported"
  // rather than as a paid-in-full zero.
  const invoiceColumns = db.prepare("PRAGMA table_info(admin_spiro_invoices)").all() as Array<{
    name: string;
  }>;
  for (const col of ["amount_paid", "amount_due"] as const) {
    if (!invoiceColumns.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE admin_spiro_invoices ADD COLUMN ${col} REAL`);
    }
  }
  // Collections steps used to be derived from aging alone. Nullable, so every
  // existing case keeps following the policy until someone pins a step.
  const pastDueCaseColumns = db.prepare("PRAGMA table_info(admin_past_due_cases)").all() as Array<{
    name: string;
  }>;
  if (!pastDueCaseColumns.some((c) => c.name === "next_action")) {
    db.exec("ALTER TABLE admin_past_due_cases ADD COLUMN next_action TEXT");
  }
  const financialNoteColumns = db
    .prepare("PRAGMA table_info(admin_financial_notes)")
    .all() as Array<{ name: string }>;
  if (!financialNoteColumns.some((c) => c.name === "created_by_name")) {
    db.exec("ALTER TABLE admin_financial_notes ADD COLUMN created_by_name TEXT");
  }
  backfillPortalFeaturePermissions(db);
  migrateDueDatesOffMidnight(db);
  // The Focus report tags VIP clients; databases cached before that have no
  // column to read. It stays null until the next Spiro sweep fills it in.
  const focusAgentColumns = db.prepare("PRAGMA table_info(admin_focus_agents)").all() as Array<{
    name: string;
  }>;
  if (!focusAgentColumns.some((c) => c.name === "vip")) {
    db.exec("ALTER TABLE admin_focus_agents ADD COLUMN vip INTEGER");
  }
  // The roster used to hold only "current" agents and only for the Focus
  // report. It now backs the VIP / top-20% badges everywhere an agent is
  // shown, which needs their status and the region the top slice was cut in.
  for (const col of ["status TEXT", "region TEXT", "top_percent INTEGER"]) {
    const name = col.split(" ")[0];
    if (!focusAgentColumns.some((c) => c.name === name)) {
      db.exec(`ALTER TABLE admin_focus_agents ADD COLUMN ${col}`);
    }
  }
  db.exec("CREATE INDEX IF NOT EXISTS admin_focus_agents_name ON admin_focus_agents(name)");
  // Rankings grouped by name string before the split into two reports; the ids
  // let each row carry the agent's badges. Null until the next order refresh.
  for (const col of ["agent_id TEXT", "company_id TEXT"]) {
    const name = col.split(" ")[0];
    if (!spiroOrderColumns.some((c) => c.name === name)) {
      db.exec(`ALTER TABLE admin_spiro_orders ADD COLUMN ${col}`);
    }
  }
  // Folders and per-user favorites postdate the resource library.
  const resourceColumns = db.prepare("PRAGMA table_info(admin_resources)").all() as Array<{
    name: string;
  }>;
  if (!resourceColumns.some((c) => c.name === "folder_id")) {
    db.exec("ALTER TABLE admin_resources ADD COLUMN folder_id TEXT");
  }
  // Indexing a column added by migration has to wait until the column exists.
  // Creating it alongside the table would throw on every pre-folder database
  // and abort the rest of initSchema.
  db.exec("CREATE INDEX IF NOT EXISTS admin_resources_folder ON admin_resources(folder_id)");
  expandRankingsReportGrants(db);
}

/**
 * The rankings report split into a separate agent report and company report.
 * Anyone who could see the combined report keeps both halves — a split is not
 * a reason to quietly take access away.
 */
function expandRankingsReportGrants(db: import("node:sqlite").DatabaseSync): void {
  const existing = db
    .prepare(
      "SELECT user_id FROM admin_user_permissions WHERE permission_type = 'report' AND value = 'rankings'",
    )
    .all() as Array<{ user_id: string }>;
  if (existing.length === 0) {
    return;
  }
  const insert = db.prepare(
    "INSERT OR IGNORE INTO admin_user_permissions (user_id, permission_type, value) VALUES (?, 'report', ?)",
  );
  for (const row of existing) {
    insert.run(row.user_id, "rankings-agents");
    insert.run(row.user_id, "rankings-companies");
  }
  db.prepare(
    "DELETE FROM admin_user_permissions WHERE permission_type = 'report' AND value = 'rankings'",
  ).run();
}

/**
 * Task and project dates used to be saved as `new Date('2026-08-06').getTime()`,
 * which JS defines as UTC midnight. Every surface that bins by calendar day does
 * so in the *browser's* timezone, so west of Greenwich that timestamp is the
 * evening before — a task due the 6th drew on the 5th in the calendar.
 *
 * The save path now anchors at noon instead. Rows written before that still hold
 * midnight, so move them once. Exactly-midnight-UTC is the signature of the old
 * writer (noon can never land on it), which makes this both precise and safe to
 * re-run: a row it has already moved no longer matches.
 *
 * Noon UTC, not noon local: the server is UTC but the readers are in US
 * timezones, and midday is far enough from either midnight that no offset in
 * that range — DST included — can push the value onto a neighbouring day.
 */
export function migrateDueDatesOffMidnight(db: import("node:sqlite").DatabaseSync): void {
  const MARKER = "date_local_noon_v1";
  if (db.prepare("SELECT id FROM admin_migrations WHERE id = ?").get(MARKER)) {
    return;
  }
  const NOON_MS = 12 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const shift = (table: string, column: string) => {
    db.prepare(
      `UPDATE ${table} SET ${column} = ${column} + ?
        WHERE ${column} IS NOT NULL AND ${column} % ? = 0`,
    ).run(NOON_MS, DAY_MS);
  };
  shift("admin_tasks", "due_date");
  shift("admin_projects", "start_date");
  shift("admin_projects", "end_date");
  db.prepare("INSERT OR IGNORE INTO admin_migrations (id, applied_at) VALUES (?, ?)").run(
    MARKER,
    Date.now(),
  );
}

/**
 * Portal access became deny-by-default: a non-admin user sees a section only
 * when granted `feature:<section>`. To preserve behavior for people who
 * predate the toggles, grant existing `user`-role accounts the base sections
 * (chat, projects, resources) exactly once. Guarded by a migration marker so an
 * admin who later revokes a section doesn't have it silently restored.
 */
function backfillPortalFeaturePermissions(db: import("node:sqlite").DatabaseSync): void {
  const MARKER = "feature_perms_backfill_v1";
  const done = db.prepare("SELECT id FROM admin_migrations WHERE id = ?").get(MARKER);
  if (done) {
    return;
  }
  // Defensive: skip (without marking done, so it retries) if the users table
  // hasn't been shaped yet — some partial-schema test fixtures reach here first.
  const cols = db.prepare("PRAGMA table_info(admin_users)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "role")) {
    return;
  }
  const users = db.prepare("SELECT id FROM admin_users WHERE role = 'user'").all() as Array<{
    id: string;
  }>;
  const insert = db.prepare(
    "INSERT OR IGNORE INTO admin_user_permissions (user_id, permission_type, value) VALUES (?, 'feature', ?)",
  );
  for (const u of users) {
    for (const section of ["chat", "projects", "resources"]) {
      insert.run(u.id, section);
    }
  }
  db.prepare("INSERT OR IGNORE INTO admin_migrations (id, applied_at) VALUES (?, ?)").run(
    MARKER,
    Date.now(),
  );
}

/**
 * The four columns every board started with, as the global default set. Seeded
 * once; an admin editing them afterwards is not undone on the next boot, and a
 * deliberately emptied global set is left empty.
 */
function seedDefaultTaskStatuses(db: import("node:sqlite").DatabaseSync): void {
  const MARKER = "default_task_statuses_v1";
  const done = db.prepare("SELECT id FROM admin_migrations WHERE id = ?").get(MARKER);
  if (done) {
    return;
  }
  const now = Date.now();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO admin_task_statuses
       (id, project_id, key, label, color, sort_order, is_done, wip_limit, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  );
  const defaults: Array<[string, string, string, number]> = [
    ["todo", "Todo", "#6b7280", 0],
    ["in_progress", "In Progress", "#3b82f6", 0],
    ["review", "Review", "#f59e0b", 0],
    ["done", "Done", "#16a34a", 1],
  ];
  defaults.forEach(([key, label, color, isDone], i) => {
    insert.run(`status-default-${key}`, key, label, color, i, isDone, now, now);
  });
  db.prepare("INSERT OR IGNORE INTO admin_migrations (id, applied_at) VALUES (?, ?)").run(
    MARKER,
    now,
  );
}

/**
 * Task status became per-project and admin-managed, but existing databases pin
 * it with `CHECK(status IN ('todo','in_progress','review','done'))`, which
 * rejects any column an admin adds. SQLite cannot drop a CHECK in place, so
 * rebuild the table once, following the documented procedure
 * (https://sqlite.org/lang_altertable.html#otheralter).
 *
 * Foreign keys MUST be off for the swap, and the stakes here are higher than
 * for tickets: admin_task_assignees and admin_task_events both reference
 * admin_tasks ON DELETE CASCADE, and admin_tasks references itself for
 * subtasks. Dropping the old table with them enabled would take every
 * assignment, every comment thread and every subtask with it.
 */
function migrateTaskStatusCheck(db: import("node:sqlite").DatabaseSync): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_tasks'")
    .get() as { sql?: string } | undefined;
  if (!row?.sql?.includes("CHECK(status IN")) {
    return;
  }

  db.exec("PRAGMA foreign_keys=OFF");
  try {
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE admin_tasks_rebuild (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES admin_projects(id) ON DELETE CASCADE,
        parent_task_id TEXT REFERENCES admin_tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
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
      INSERT INTO admin_tasks_rebuild SELECT
        id, project_id, parent_task_id, title, description, status, priority, due_date,
        assigned_to, tags, position, recurrence, created_by, created_at, updated_at
      FROM admin_tasks;
      DROP TABLE admin_tasks;
      ALTER TABLE admin_tasks_rebuild RENAME TO admin_tasks;
      CREATE INDEX IF NOT EXISTS admin_tasks_project_id ON admin_tasks(project_id);
      CREATE INDEX IF NOT EXISTS admin_tasks_due_date ON admin_tasks(due_date);
    `);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.exec("PRAGMA foreign_keys=ON");
  }
}

/**
 * Databases created before categories were admin-managed pinned them with
 * `CHECK(category IN ('edit_request',...))`, which rejects any category an admin
 * adds from the dashboard. SQLite cannot drop a CHECK in place, so rebuild the
 * table once, following SQLite's documented table-rebuild procedure
 * (https://sqlite.org/lang_altertable.html#otheralter).
 *
 * Foreign keys MUST be off for the swap: admin_ticket_events references
 * admin_tickets ON DELETE CASCADE, so dropping the old table with them enabled
 * would silently delete every ticket's activity thread.
 */
function migrateTicketCategoryCheck(db: import("node:sqlite").DatabaseSync): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_tickets'")
    .get() as { sql?: string } | undefined;
  if (!row?.sql?.includes("CHECK(category IN")) {
    return;
  }

  db.exec("PRAGMA foreign_keys=OFF");
  try {
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE admin_tickets_rebuild (
        id TEXT PRIMARY KEY,
        number TEXT UNIQUE NOT NULL,
        reply_token TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','needs_review','resolved','closed')),
        priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
        source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('widget','email','manual')),
        subject TEXT NOT NULL,
        description TEXT,
        department TEXT NOT NULL DEFAULT 'general',
        requester_name TEXT,
        requester_email TEXT,
        requester_phone TEXT,
        order_id TEXT,
        order_address TEXT,
        assigned_to TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        resolved_at INTEGER
      );
      INSERT INTO admin_tickets_rebuild SELECT
        id, number, reply_token, category, status, priority, source, subject, description,
        department, requester_name, requester_email, requester_phone, order_id, order_address,
        assigned_to, created_by, created_at, updated_at, resolved_at
      FROM admin_tickets;
      DROP TABLE admin_tickets;
      ALTER TABLE admin_tickets_rebuild RENAME TO admin_tickets;
      CREATE INDEX IF NOT EXISTS admin_tickets_status ON admin_tickets(status);
      CREATE INDEX IF NOT EXISTS admin_tickets_department ON admin_tickets(department);
      CREATE INDEX IF NOT EXISTS admin_tickets_created_at ON admin_tickets(created_at);
      CREATE INDEX IF NOT EXISTS admin_tickets_order ON admin_tickets(order_id);
    `);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.exec("PRAGMA foreign_keys=ON");
  }
}

/**
 * Widen `admin_attachments.owner_type` to allow 'ticket'. SQLite cannot drop a
 * CHECK in place, so the table is rebuilt. Same shape as the category migration
 * above, including the foreign_keys=OFF outside the transaction — a PRAGMA is a
 * no-op inside one, and this table's rows must survive the drop.
 */
function migrateAttachmentOwnerCheck(db: import("node:sqlite").DatabaseSync): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_attachments'")
    .get() as { sql?: string } | undefined;
  // Already widened (or a fresh DB built from the current DDL) — nothing to do.
  if (!row?.sql?.includes("CHECK(owner_type IN") || row.sql.includes("'ticket'")) {
    return;
  }

  db.exec("PRAGMA foreign_keys=OFF");
  try {
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE admin_attachments_rebuild (
        id TEXT PRIMARY KEY,
        owner_type TEXT NOT NULL CHECK(owner_type IN ('task','project','ticket')),
        owner_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('link','file')),
        title TEXT NOT NULL,
        url TEXT,
        filename TEXT,
        stored_filename TEXT,
        mimetype TEXT,
        filesize INTEGER,
        created_by TEXT,
        created_at INTEGER NOT NULL
      );
      INSERT INTO admin_attachments_rebuild SELECT
        id, owner_type, owner_id, type, title, url, filename, stored_filename,
        mimetype, filesize, created_by, created_at
      FROM admin_attachments;
      DROP TABLE admin_attachments;
      ALTER TABLE admin_attachments_rebuild RENAME TO admin_attachments;
      CREATE INDEX IF NOT EXISTS admin_attachments_owner ON admin_attachments(owner_type, owner_id);
    `);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.exec("PRAGMA foreign_keys=ON");
  }
}

/**
 * Widen `admin_ticket_categories.extra_field` to allow 'multiselect'. Rebuild
 * rather than ALTER, for the same reason as the other two: SQLite cannot drop a
 * CHECK in place. Nothing references this table by foreign key, so the rebuild
 * only has to carry its own rows.
 */
function migrateCategoryExtraFieldCheck(db: import("node:sqlite").DatabaseSync): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_ticket_categories'")
    .get() as { sql?: string } | undefined;
  if (!row?.sql?.includes("CHECK(extra_field IN") || row.sql.includes("'multiselect'")) {
    return;
  }

  db.exec("PRAGMA foreign_keys=OFF");
  try {
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE admin_ticket_categories_rebuild (
        key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        short_label TEXT NOT NULL,
        extra_field TEXT NOT NULL DEFAULT 'none' CHECK(extra_field IN ('none','select','text','multiselect')),
        extra_label TEXT,
        extra_options TEXT,
        extra_placeholder TEXT,
        details_label TEXT NOT NULL,
        details_hint TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO admin_ticket_categories_rebuild SELECT
        key, label, short_label, extra_field, extra_label, extra_options,
        extra_placeholder, details_label, details_hint, sort_order, active,
        created_at, updated_at
      FROM admin_ticket_categories;
      DROP TABLE admin_ticket_categories;
      ALTER TABLE admin_ticket_categories_rebuild RENAME TO admin_ticket_categories;
    `);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.exec("PRAGMA foreign_keys=ON");
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
