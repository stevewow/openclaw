import crypto from "node:crypto";
import { getAdminDb } from "./user-store.js";

export type ProjectStatus = "planning" | "active" | "completed" | "archived";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type Project = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  tags: string[];
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Task = {
  id: string;
  projectId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: number | null;
  assignedTo: string | null;
  tags: string[];
  position: number;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CreateProjectParams = {
  title: string;
  description?: string | null;
  status?: ProjectStatus;
  color?: string;
  tags?: string[];
  createdBy?: string | null;
};

export type UpdateProjectParams = Partial<Omit<CreateProjectParams, "createdBy">>;

export type CreateTaskParams = {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string | null;
  parentTaskId?: string | null;
  dueDate?: number | null;
  assignedTo?: string | null;
  tags?: string[];
  position?: number;
  createdBy?: string | null;
};

export type UpdateTaskParams = Partial<Omit<CreateTaskParams, "createdBy" | "parentTaskId">>;

function rowToProject(row: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  color: string;
  tags: string;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}): Project {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags) as string[];
  } catch {
    /* empty */
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as ProjectStatus,
    color: row.color,
    tags,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTask(row: {
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
}): Task {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags) as string[];
  } catch {
    /* empty */
  }
  return {
    id: row.id,
    projectId: row.project_id,
    parentTaskId: row.parent_task_id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    dueDate: row.due_date,
    assignedTo: row.assigned_to,
    tags,
    position: row.position,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Projects ──

export async function listProjects(): Promise<Project[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_projects")
    .selectAll()
    .orderBy("created_at", "asc")
    .execute();
  return rows.map(rowToProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_projects")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? rowToProject(row) : null;
}

export async function createProject(params: CreateProjectParams): Promise<Project> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db
    .insertInto("admin_projects")
    .values({
      id,
      title: params.title,
      description: params.description ?? null,
      status: params.status ?? "active",
      color: params.color ?? "#3b82f6",
      tags: JSON.stringify(params.tags ?? []),
      created_by: params.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  return (await getProject(id))!;
}

export async function updateProject(
  id: string,
  params: UpdateProjectParams,
): Promise<Project | null> {
  const db = getAdminDb();
  const now = Date.now();
  const updates: Record<string, unknown> = { updated_at: now };
  if (params.title !== undefined) updates.title = params.title;
  if (params.description !== undefined) updates.description = params.description;
  if (params.status !== undefined) updates.status = params.status;
  if (params.color !== undefined) updates.color = params.color;
  if (params.tags !== undefined) updates.tags = JSON.stringify(params.tags);
  await db.updateTable("admin_projects").set(updates).where("id", "=", id).execute();
  return getProject(id);
}

export async function deleteProject(id: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_projects").where("id", "=", id).execute();
}

// ── Tasks ──

export async function listTasks(opts: { projectId?: string } = {}): Promise<Task[]> {
  const db = getAdminDb();
  let query = db
    .selectFrom("admin_tasks")
    .selectAll()
    .orderBy("position", "asc")
    .orderBy("created_at", "asc");
  if (opts.projectId !== undefined) query = query.where("project_id", "=", opts.projectId);
  const rows = await query.execute();
  return rows.map(rowToTask);
}

export async function getTask(id: string): Promise<Task | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_tasks")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? rowToTask(row) : null;
}

export async function createTask(params: CreateTaskParams): Promise<Task> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db
    .insertInto("admin_tasks")
    .values({
      id,
      project_id: params.projectId ?? null,
      parent_task_id: params.parentTaskId ?? null,
      title: params.title,
      description: params.description ?? null,
      status: params.status ?? "todo",
      priority: params.priority ?? "medium",
      due_date: params.dueDate ?? null,
      assigned_to: params.assignedTo ?? null,
      tags: JSON.stringify(params.tags ?? []),
      position: params.position ?? 0,
      created_by: params.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  return (await getTask(id))!;
}

export async function updateTask(id: string, params: UpdateTaskParams): Promise<Task | null> {
  const db = getAdminDb();
  const now = Date.now();
  const updates: Record<string, unknown> = { updated_at: now };
  if (params.title !== undefined) updates.title = params.title;
  if (params.description !== undefined) updates.description = params.description;
  if (params.status !== undefined) updates.status = params.status;
  if (params.priority !== undefined) updates.priority = params.priority;
  if (params.projectId !== undefined) updates.project_id = params.projectId;
  if (params.dueDate !== undefined) updates.due_date = params.dueDate;
  if (params.assignedTo !== undefined) updates.assigned_to = params.assignedTo;
  if (params.tags !== undefined) updates.tags = JSON.stringify(params.tags);
  if (params.position !== undefined) updates.position = params.position;
  await db.updateTable("admin_tasks").set(updates).where("id", "=", id).execute();
  return getTask(id);
}

export async function deleteTask(id: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_tasks").where("id", "=", id).execute();
}
