import crypto from "node:crypto";
import type { AdminUserRole } from "./types.js";
import { getAdminDb } from "./user-store.js";

export type ProjectStatus = "planning" | "active" | "completed" | "archived";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskRecurrence = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Who is asking. When set to a non-admin user, project/task listings are scoped
 * to what that user created, is a member of, or is assigned to. Pass `null` for
 * unrestricted internal callers (e.g. the Collections auto-task engine).
 */
export type Viewer = { userId: string; role: AdminUserRole } | null;

function isAdminViewer(viewer: Viewer): boolean {
  return !viewer || viewer.role === "superadmin" || viewer.role === "admin";
}

export type Project = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  tags: string[];
  startDate: number | null;
  endDate: number | null;
  memberIds: string[];
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
  assigneeIds: string[];
  tags: string[];
  position: number;
  recurrence: TaskRecurrence | null;
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
  startDate?: number | null;
  endDate?: number | null;
  memberIds?: string[];
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
  assigneeIds?: string[];
  tags?: string[];
  position?: number;
  recurrence?: TaskRecurrence | null;
  createdBy?: string | null;
};

export type UpdateTaskParams = Partial<Omit<CreateTaskParams, "createdBy" | "parentTaskId">>;

function rowToProject(
  row: {
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
  },
  memberIds: string[] = [],
): Project {
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
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    memberIds,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTask(
  row: {
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
  },
  assigneeIds: string[] = [],
): Task {
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
    assigneeIds,
    tags,
    position: row.position,
    recurrence: (row.recurrence as TaskRecurrence | null) ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Membership / assignment helpers ──

async function fetchProjectMembers(projectIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (projectIds.length === 0) return map;
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_project_members")
    .select(["project_id", "user_id"])
    .where("project_id", "in", projectIds)
    .execute();
  for (const r of rows) {
    const list = map.get(r.project_id) ?? [];
    list.push(r.user_id);
    map.set(r.project_id, list);
  }
  return map;
}

async function fetchTaskAssignees(taskIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (taskIds.length === 0) return map;
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_task_assignees")
    .select(["task_id", "user_id"])
    .where("task_id", "in", taskIds)
    .execute();
  for (const r of rows) {
    const list = map.get(r.task_id) ?? [];
    list.push(r.user_id);
    map.set(r.task_id, list);
  }
  return map;
}

export async function setProjectMembers(projectId: string, userIds: string[]): Promise<void> {
  const db = getAdminDb();
  const unique = Array.from(new Set(userIds.filter((id) => typeof id === "string" && id)));
  await db.deleteFrom("admin_project_members").where("project_id", "=", projectId).execute();
  if (unique.length > 0) {
    await db
      .insertInto("admin_project_members")
      .values(unique.map((userId) => ({ project_id: projectId, user_id: userId })))
      .execute();
  }
}

export async function setTaskAssignees(taskId: string, userIds: string[]): Promise<void> {
  const db = getAdminDb();
  const unique = Array.from(new Set(userIds.filter((id) => typeof id === "string" && id)));
  await db.deleteFrom("admin_task_assignees").where("task_id", "=", taskId).execute();
  if (unique.length > 0) {
    await db
      .insertInto("admin_task_assignees")
      .values(unique.map((userId) => ({ task_id: taskId, user_id: userId })))
      .execute();
  }
}

/**
 * Whether a viewer may see/edit a project. Admins (and unrestricted internal
 * callers) always may; otherwise the user must have created it or be a member.
 * Returns false when the project does not exist.
 */
export async function canAccessProject(viewer: Viewer, projectId: string): Promise<boolean> {
  if (isAdminViewer(viewer)) return true;
  const project = await getProject(projectId);
  if (!project) return false;
  return project.createdBy === viewer!.userId || project.memberIds.includes(viewer!.userId);
}

/**
 * Whether a viewer may see/edit a task. Admins always may; otherwise the user
 * must have created it, be an assignee, or be able to access its project.
 * Returns false when the task does not exist.
 */
export async function canAccessTask(viewer: Viewer, taskId: string): Promise<boolean> {
  if (isAdminViewer(viewer)) return true;
  const task = await getTask(taskId);
  if (!task) return false;
  if (task.createdBy === viewer!.userId || task.assigneeIds.includes(viewer!.userId)) return true;
  if (task.projectId) return canAccessProject(viewer, task.projectId);
  return false;
}

/** Project ids a non-admin viewer can see: ones they created or are a member of. */
async function visibleProjectIdsFor(userId: string): Promise<Set<string>> {
  const db = getAdminDb();
  const [created, member] = await Promise.all([
    db.selectFrom("admin_projects").select("id").where("created_by", "=", userId).execute(),
    db
      .selectFrom("admin_project_members")
      .select("project_id")
      .where("user_id", "=", userId)
      .execute(),
  ]);
  const set = new Set<string>();
  for (const r of created) set.add(r.id);
  for (const r of member) set.add(r.project_id);
  return set;
}

export function computeNextDueDate(fromMs: number, recurrence: TaskRecurrence): number {
  const d = new Date(fromMs);
  switch (recurrence) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.getTime();
}

// ── Projects ──

export async function listProjects(viewer: Viewer = null): Promise<Project[]> {
  const db = getAdminDb();
  let query = db.selectFrom("admin_projects").selectAll().orderBy("created_at", "asc");
  if (!isAdminViewer(viewer)) {
    const userId = viewer!.userId;
    query = query.where((eb) =>
      eb.or([
        eb("created_by", "=", userId),
        eb(
          "id",
          "in",
          eb.selectFrom("admin_project_members").select("project_id").where("user_id", "=", userId),
        ),
      ]),
    );
  }
  const rows = await query.execute();
  const members = await fetchProjectMembers(rows.map((r) => r.id));
  return rows.map((r) => rowToProject(r, members.get(r.id) ?? []));
}

export async function getProject(id: string): Promise<Project | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_projects")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) return null;
  const members = await fetchProjectMembers([id]);
  return rowToProject(row, members.get(id) ?? []);
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
      start_date: params.startDate ?? null,
      end_date: params.endDate ?? null,
      created_by: params.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  if (params.memberIds !== undefined) await setProjectMembers(id, params.memberIds);
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
  if (params.startDate !== undefined) updates.start_date = params.startDate;
  if (params.endDate !== undefined) updates.end_date = params.endDate;
  await db.updateTable("admin_projects").set(updates).where("id", "=", id).execute();
  if (params.memberIds !== undefined) await setProjectMembers(id, params.memberIds);
  return getProject(id);
}

export async function deleteProject(id: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_projects").where("id", "=", id).execute();
}

// ── Tasks ──

export async function listTasks(
  opts: { projectId?: string } = {},
  viewer: Viewer = null,
): Promise<Task[]> {
  const db = getAdminDb();
  let query = db
    .selectFrom("admin_tasks")
    .selectAll()
    .orderBy("position", "asc")
    .orderBy("created_at", "asc");
  if (opts.projectId !== undefined) query = query.where("project_id", "=", opts.projectId);
  if (!isAdminViewer(viewer)) {
    const userId = viewer!.userId;
    const visibleProjects = Array.from(await visibleProjectIdsFor(userId));
    query = query.where((eb) => {
      const clauses = [
        eb("created_by", "=", userId),
        eb(
          "id",
          "in",
          eb.selectFrom("admin_task_assignees").select("task_id").where("user_id", "=", userId),
        ),
      ];
      // Members see every task inside a project they belong to (or created).
      if (visibleProjects.length > 0) {
        clauses.push(eb("project_id", "in", visibleProjects));
      }
      return eb.or(clauses);
    });
  }
  const rows = await query.execute();
  const assignees = await fetchTaskAssignees(rows.map((r) => r.id));
  return rows.map((r) => rowToTask(r, assignees.get(r.id) ?? []));
}

export async function getTask(id: string): Promise<Task | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_tasks")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) return null;
  const assignees = await fetchTaskAssignees([id]);
  return rowToTask(row, assignees.get(id) ?? []);
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
      recurrence: params.recurrence ?? null,
      created_by: params.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  if (params.assigneeIds !== undefined) await setTaskAssignees(id, params.assigneeIds);
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
  if (params.recurrence !== undefined) updates.recurrence = params.recurrence;
  await db.updateTable("admin_tasks").set(updates).where("id", "=", id).execute();
  if (params.assigneeIds !== undefined) await setTaskAssignees(id, params.assigneeIds);
  return getTask(id);
}

export async function deleteTask(id: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_tasks").where("id", "=", id).execute();
}
