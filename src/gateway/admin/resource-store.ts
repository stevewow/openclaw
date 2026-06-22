import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../../config/paths.js";
import { getAdminDb } from "./user-store.js";

export type ResourceType = "link" | "file";

export type Resource = {
  id: string;
  title: string;
  description: string | null;
  type: ResourceType;
  url: string | null;
  filename: string | null;
  storedFilename: string | null;
  mimetype: string | null;
  filesize: number | null;
  tags: string[];
  aiAccess: boolean;
  userAccess: boolean;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CreateResourceParams = {
  title: string;
  description?: string | null;
  type: ResourceType;
  url?: string | null;
  filename?: string | null;
  storedFilename?: string | null;
  mimetype?: string | null;
  filesize?: number | null;
  tags?: string[];
  aiAccess?: boolean;
  userAccess?: boolean;
  createdBy?: string | null;
};

export type UpdateResourceParams = Partial<Omit<CreateResourceParams, "type">>;

export type ListResourcesOptions = {
  search?: string | null;
  tags?: string[];
  aiAccessOnly?: boolean;
  userAccessOnly?: boolean;
};

function resolveResourcesDir(): string {
  return path.join(resolveStateDir(), "admin-resources");
}

export function resolveResourceFilePath(storedFilename: string): string {
  return path.join(resolveResourcesDir(), storedFilename);
}

export async function ensureResourcesDir(): Promise<void> {
  await fs.mkdir(resolveResourcesDir(), { recursive: true });
}

function rowToResource(row: {
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
}): Resource {
  let tags: string[] = [];
  try { tags = JSON.parse(row.tags) as string[]; } catch { /* empty */ }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type as ResourceType,
    url: row.url,
    filename: row.filename,
    storedFilename: row.stored_filename,
    mimetype: row.mimetype,
    filesize: row.filesize,
    tags,
    aiAccess: row.ai_access === 1,
    userAccess: row.user_access === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listResources(opts: ListResourcesOptions = {}): Promise<Resource[]> {
  const db = getAdminDb();
  let query = db.selectFrom("admin_resources").selectAll().orderBy("created_at", "desc");

  if (opts.aiAccessOnly) {
    query = query.where("ai_access", "=", 1);
  }
  if (opts.userAccessOnly) {
    query = query.where("user_access", "=", 1);
  }

  const rows = await query.execute();
  let results = rows.map(rowToResource);

  if (opts.search?.trim()) {
    const needle = opts.search.trim().toLowerCase();
    results = results.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.description?.toLowerCase().includes(needle) ||
        r.tags.some((t) => t.toLowerCase().includes(needle)),
    );
  }

  if (opts.tags && opts.tags.length > 0) {
    const filterTags = opts.tags.map((t) => t.toLowerCase());
    results = results.filter((r) =>
      filterTags.every((ft) => r.tags.some((rt) => rt.toLowerCase() === ft)),
    );
  }

  return results;
}

export async function getResource(id: string): Promise<Resource | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_resources")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? rowToResource(row) : null;
}

export async function createResource(params: CreateResourceParams): Promise<Resource> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insertInto("admin_resources").values({
    id,
    title: params.title,
    description: params.description ?? null,
    type: params.type,
    url: params.url ?? null,
    filename: params.filename ?? null,
    stored_filename: params.storedFilename ?? null,
    mimetype: params.mimetype ?? null,
    filesize: params.filesize ?? null,
    tags: JSON.stringify(params.tags ?? []),
    ai_access: params.aiAccess !== false ? 1 : 0,
    user_access: params.userAccess ? 1 : 0,
    created_by: params.createdBy ?? null,
    created_at: now,
    updated_at: now,
  }).execute();
  return (await getResource(id))!;
}

export async function updateResource(id: string, params: UpdateResourceParams): Promise<Resource | null> {
  const db = getAdminDb();
  const now = Date.now();
  const updates: Record<string, unknown> = { updated_at: now };
  if (params.title !== undefined) updates.title = params.title;
  if (params.description !== undefined) updates.description = params.description;
  if (params.url !== undefined) updates.url = params.url;
  if (params.tags !== undefined) updates.tags = JSON.stringify(params.tags);
  if (params.aiAccess !== undefined) updates.ai_access = params.aiAccess ? 1 : 0;
  if (params.userAccess !== undefined) updates.user_access = params.userAccess ? 1 : 0;

  await db
    .updateTable("admin_resources")
    .set(updates)
    .where("id", "=", id)
    .execute();
  return getResource(id);
}

export async function deleteResource(id: string): Promise<void> {
  const db = getAdminDb();
  const resource = await getResource(id);
  if (resource?.storedFilename) {
    await fs
      .unlink(resolveResourceFilePath(resource.storedFilename))
      .catch(() => undefined);
  }
  await db.deleteFrom("admin_resources").where("id", "=", id).execute();
}

export async function getAllTags(): Promise<string[]> {
  const db = getAdminDb();
  const rows = await db.selectFrom("admin_resources").select("tags").execute();
  const tagSet = new Set<string>();
  for (const row of rows) {
    try {
      const tags = JSON.parse(row.tags) as string[];
      for (const t of tags) tagSet.add(t);
    } catch { /* empty */ }
  }
  return Array.from(tagSet).sort();
}
