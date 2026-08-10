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
  /** Owning folder, or null for a resource sitting at the library root. */
  folderId: string | null;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
  /** Starred by the viewer. Only set when a viewer was supplied. */
  favorite?: boolean;
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
  folderId?: string | null;
  createdBy?: string | null;
};

export type UpdateResourceParams = Partial<Omit<CreateResourceParams, "type">>;

export type ListResourcesOptions = {
  search?: string | null;
  tags?: string[];
  aiAccessOnly?: boolean;
  userAccessOnly?: boolean;
  /**
   * Restrict to one folder. `null` means the root (unfiled) resources;
   * `undefined` means every folder, which is what search should do.
   */
  folderId?: string | null;
  /** Whose favorites to mark, and to filter by when `favoritesOnly` is set. */
  viewerId?: string | null;
  favoritesOnly?: boolean;
};

export type ResourceFolder = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  userAccess: boolean;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
  favorite?: boolean;
  /** Direct children counts, so the UI can label a folder without a second call. */
  folderCount: number;
  resourceCount: number;
};

export type CreateFolderParams = {
  name: string;
  description?: string | null;
  parentId?: string | null;
  userAccess?: boolean;
  createdBy?: string | null;
};

export type UpdateFolderParams = Partial<Omit<CreateFolderParams, "createdBy">>;

export type FavoriteItemType = "folder" | "resource";

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
  folder_id: string | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}): Resource {
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
    type: row.type as ResourceType,
    url: row.url,
    filename: row.filename,
    storedFilename: row.stored_filename,
    mimetype: row.mimetype,
    filesize: row.filesize,
    tags,
    aiAccess: row.ai_access === 1,
    userAccess: row.user_access === 1,
    folderId: row.folder_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Favorites ──────────────────────────────────────────────────────────────

/** The ids a viewer has starred, as one set per item type. */
async function loadFavorites(
  viewerId: string,
): Promise<{ folders: Set<string>; resources: Set<string> }> {
  const rows = await getAdminDb()
    .selectFrom("admin_resource_favorites")
    .select(["item_type", "item_id"])
    .where("user_id", "=", viewerId)
    .execute();
  return {
    folders: new Set(rows.filter((r) => r.item_type === "folder").map((r) => r.item_id)),
    resources: new Set(rows.filter((r) => r.item_type === "resource").map((r) => r.item_id)),
  };
}

export async function setFavorite(params: {
  userId: string;
  itemType: FavoriteItemType;
  itemId: string;
  favorite: boolean;
}): Promise<void> {
  const db = getAdminDb();
  if (!params.favorite) {
    await db
      .deleteFrom("admin_resource_favorites")
      .where("user_id", "=", params.userId)
      .where("item_type", "=", params.itemType)
      .where("item_id", "=", params.itemId)
      .execute();
    return;
  }
  await db
    .insertInto("admin_resource_favorites")
    .values({
      user_id: params.userId,
      item_type: params.itemType,
      item_id: params.itemId,
      created_at: Date.now(),
    })
    .onConflict((oc) => oc.columns(["user_id", "item_type", "item_id"]).doNothing())
    .execute();
}

// ── Folders ────────────────────────────────────────────────────────────────

function rowToFolder(
  row: {
    id: string;
    name: string;
    description: string | null;
    parent_id: string | null;
    user_access: number;
    created_by: string | null;
    created_at: number;
    updated_at: number;
  },
  counts: { folders: number; resources: number },
  favorite: boolean | undefined,
): ResourceFolder {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    parentId: row.parent_id,
    userAccess: row.user_access === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    folderCount: counts.folders,
    resourceCount: counts.resources,
    ...(favorite === undefined ? {} : { favorite }),
  };
}

export type ListFoldersOptions = {
  /** `null` lists the root; `undefined` lists every folder (for a tree). */
  parentId?: string | null;
  userAccessOnly?: boolean;
  viewerId?: string | null;
  favoritesOnly?: boolean;
};

export async function listFolders(opts: ListFoldersOptions = {}): Promise<ResourceFolder[]> {
  const db = getAdminDb();
  const all = await db
    .selectFrom("admin_resource_folders")
    .selectAll()
    .orderBy("name", "asc")
    .execute();
  const resources = await db
    .selectFrom("admin_resources")
    .select(["folder_id", "user_access"])
    .execute();

  const childFolders = new Map<string, number>();
  for (const f of all) {
    if (f.parent_id && (!opts.userAccessOnly || f.user_access === 1)) {
      childFolders.set(f.parent_id, (childFolders.get(f.parent_id) ?? 0) + 1);
    }
  }
  const childResources = new Map<string, number>();
  for (const r of resources) {
    if (r.folder_id && (!opts.userAccessOnly || r.user_access === 1)) {
      childResources.set(r.folder_id, (childResources.get(r.folder_id) ?? 0) + 1);
    }
  }

  const favorites = opts.viewerId ? await loadFavorites(opts.viewerId) : null;
  let rows = all;
  if (opts.userAccessOnly) {
    rows = rows.filter((f) => f.user_access === 1);
  }
  if (opts.parentId !== undefined) {
    rows = rows.filter((f) => (f.parent_id ?? null) === opts.parentId);
  }
  if (opts.favoritesOnly) {
    rows = rows.filter((f) => favorites?.folders.has(f.id));
  }
  return rows.map((f) =>
    rowToFolder(
      f,
      { folders: childFolders.get(f.id) ?? 0, resources: childResources.get(f.id) ?? 0 },
      favorites ? favorites.folders.has(f.id) : undefined,
    ),
  );
}

export async function getFolder(id: string): Promise<ResourceFolder | null> {
  const folders = await listFolders();
  return folders.find((f) => f.id === id) ?? null;
}

/**
 * The chain from the root down to `id`, for a breadcrumb. Defensively bounded:
 * a cycle would otherwise hang the request, and the checks in `moveFolder`
 * cannot vouch for rows written before them.
 */
export async function getFolderPath(id: string): Promise<ResourceFolder[]> {
  const all = await listFolders();
  const byId = new Map(all.map((f) => [f.id, f]));
  const path: ResourceFolder[] = [];
  const seen = new Set<string>();
  let cursor: string | null = id;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const folder: ResourceFolder | undefined = byId.get(cursor);
    if (!folder) {
      break;
    }
    path.unshift(folder);
    cursor = folder.parentId;
  }
  return path;
}

/** Every folder at or beneath `id`, itself included. */
async function collectSubtree(id: string): Promise<Set<string>> {
  const all = await getAdminDb()
    .selectFrom("admin_resource_folders")
    .select(["id", "parent_id"])
    .execute();
  const childrenOf = new Map<string, string[]>();
  for (const f of all) {
    if (f.parent_id) {
      childrenOf.set(f.parent_id, [...(childrenOf.get(f.parent_id) ?? []), f.id]);
    }
  }
  const out = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const next = queue.pop()!;
    if (out.has(next)) {
      continue;
    }
    out.add(next);
    queue.push(...(childrenOf.get(next) ?? []));
  }
  return out;
}

export async function createFolder(params: CreateFolderParams): Promise<ResourceFolder> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  if (params.parentId && !(await getFolder(params.parentId))) {
    throw new Error("Parent folder not found");
  }
  await db
    .insertInto("admin_resource_folders")
    .values({
      id,
      name: params.name,
      description: params.description ?? null,
      parent_id: params.parentId ?? null,
      user_access: params.userAccess ? 1 : 0,
      created_by: params.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  return (await getFolder(id))!;
}

/**
 * Rename, re-describe, re-parent or re-scope a folder.
 *
 * Re-parenting is the one that can corrupt the tree: dropping a folder into its
 * own subtree would orphan that whole branch from the root, so it is refused.
 */
export async function updateFolder(
  id: string,
  params: UpdateFolderParams,
): Promise<ResourceFolder | null> {
  const db = getAdminDb();
  const existing = await getFolder(id);
  if (!existing) {
    return null;
  }
  const updates: Record<string, unknown> = { updated_at: Date.now() };
  if (params.name !== undefined) {
    updates.name = params.name;
  }
  if (params.description !== undefined) {
    updates.description = params.description;
  }
  if (params.userAccess !== undefined) {
    updates.user_access = params.userAccess ? 1 : 0;
  }
  if (params.parentId !== undefined) {
    const parentId = params.parentId ?? null;
    if (parentId !== null) {
      if (!(await getFolder(parentId))) {
        throw new Error("Parent folder not found");
      }
      if ((await collectSubtree(id)).has(parentId)) {
        throw new Error("A folder cannot be moved inside itself");
      }
    }
    updates.parent_id = parentId;
  }
  await db.updateTable("admin_resource_folders").set(updates).where("id", "=", id).execute();
  return getFolder(id);
}

/**
 * Delete a folder, lifting everything it held up to its own parent.
 *
 * Deliberately not a cascade: a folder is an organizing device, and losing a
 * shelf should not lose the documents on it.
 */
export async function deleteFolder(id: string): Promise<boolean> {
  const db = getAdminDb();
  const existing = await getFolder(id);
  if (!existing) {
    return false;
  }
  const parentId = existing.parentId;
  await db
    .updateTable("admin_resource_folders")
    .set({ parent_id: parentId, updated_at: Date.now() })
    .where("parent_id", "=", id)
    .execute();
  await db
    .updateTable("admin_resources")
    .set({ folder_id: parentId, updated_at: Date.now() })
    .where("folder_id", "=", id)
    .execute();
  await db.deleteFrom("admin_resource_favorites").where("item_id", "=", id).execute();
  await db.deleteFrom("admin_resource_folders").where("id", "=", id).execute();
  return true;
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

  // undefined means "every folder" — which is what a search across the whole
  // library needs; null means the unfiled resources at the root.
  if (opts.folderId !== undefined) {
    results = results.filter((r) => r.folderId === opts.folderId);
  }

  if (opts.viewerId) {
    const favorites = await loadFavorites(opts.viewerId);
    results = results.map((r) => ({ ...r, favorite: favorites.resources.has(r.id) }));
    if (opts.favoritesOnly) {
      results = results.filter((r) => r.favorite);
    }
  }

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
  await db
    .insertInto("admin_resources")
    .values({
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
      folder_id: params.folderId ?? null,
      created_by: params.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  return (await getResource(id))!;
}

export async function updateResource(
  id: string,
  params: UpdateResourceParams,
): Promise<Resource | null> {
  const db = getAdminDb();
  const now = Date.now();
  const updates: Record<string, unknown> = { updated_at: now };
  if (params.title !== undefined) updates.title = params.title;
  if (params.description !== undefined) updates.description = params.description;
  if (params.url !== undefined) updates.url = params.url;
  if (params.tags !== undefined) updates.tags = JSON.stringify(params.tags);
  if (params.aiAccess !== undefined) updates.ai_access = params.aiAccess ? 1 : 0;
  if (params.userAccess !== undefined) updates.user_access = params.userAccess ? 1 : 0;
  // Moving a resource is just an update; null puts it back at the root.
  if (params.folderId !== undefined) {
    if (params.folderId !== null && !(await getFolder(params.folderId))) {
      throw new Error("Folder not found");
    }
    updates.folder_id = params.folderId;
  }

  await db.updateTable("admin_resources").set(updates).where("id", "=", id).execute();
  return getResource(id);
}

export async function deleteResource(id: string): Promise<void> {
  const db = getAdminDb();
  const resource = await getResource(id);
  if (resource?.storedFilename) {
    await fs.unlink(resolveResourceFilePath(resource.storedFilename)).catch(() => undefined);
  }
  await db.deleteFrom("admin_resource_favorites").where("item_id", "=", id).execute();
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
    } catch {
      /* empty */
    }
  }
  return Array.from(tagSet).sort();
}
