import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../../config/paths.js";
import { getAdminDb } from "./user-store.js";

/**
 * Links and files hung off a task or a project. Kept separate from the curated
 * Resources library: these travel with the item they were attached to and
 * inherit its visibility, rather than joining a searchable shared catalog.
 */
export type AttachmentOwnerType = "task" | "project";
export type AttachmentType = "link" | "file";

export type Attachment = {
  id: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  type: AttachmentType;
  title: string;
  url: string | null;
  filename: string | null;
  storedFilename: string | null;
  mimetype: string | null;
  filesize: number | null;
  createdBy: string | null;
  createdAt: number;
};

export type CreateAttachmentParams = {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  type: AttachmentType;
  title: string;
  url?: string | null;
  filename?: string | null;
  storedFilename?: string | null;
  mimetype?: string | null;
  filesize?: number | null;
  createdBy?: string | null;
};

function resolveAttachmentsDir(): string {
  return path.join(resolveStateDir(), "admin-attachments");
}

export function resolveAttachmentFilePath(storedFilename: string): string {
  return path.join(resolveAttachmentsDir(), storedFilename);
}

export async function ensureAttachmentsDir(): Promise<void> {
  await fs.mkdir(resolveAttachmentsDir(), { recursive: true });
}

function rowToAttachment(row: {
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
}): Attachment {
  return {
    id: row.id,
    ownerType: row.owner_type as AttachmentOwnerType,
    ownerId: row.owner_id,
    type: row.type as AttachmentType,
    title: row.title,
    url: row.url,
    filename: row.filename,
    storedFilename: row.stored_filename,
    mimetype: row.mimetype,
    filesize: row.filesize,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function listAttachments(
  ownerType: AttachmentOwnerType,
  ownerId: string,
): Promise<Attachment[]> {
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_attachments")
    .selectAll()
    .where("owner_type", "=", ownerType)
    .where("owner_id", "=", ownerId)
    .orderBy("created_at", "asc")
    .execute();
  return rows.map(rowToAttachment);
}

/**
 * Attachments for many owners at once, keyed by owner id — the board needs a
 * count per card without a query per card.
 */
export async function listAttachmentsForOwners(
  ownerType: AttachmentOwnerType,
  ownerIds: string[],
): Promise<Map<string, Attachment[]>> {
  const map = new Map<string, Attachment[]>();
  if (ownerIds.length === 0) {
    return map;
  }
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_attachments")
    .selectAll()
    .where("owner_type", "=", ownerType)
    .where("owner_id", "in", ownerIds)
    .orderBy("created_at", "asc")
    .execute();
  for (const row of rows) {
    const list = map.get(row.owner_id) ?? [];
    list.push(rowToAttachment(row));
    map.set(row.owner_id, list);
  }
  return map;
}

export async function getAttachment(id: string): Promise<Attachment | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_attachments")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? rowToAttachment(row) : null;
}

export async function createAttachment(params: CreateAttachmentParams): Promise<Attachment> {
  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db
    .insertInto("admin_attachments")
    .values({
      id,
      owner_type: params.ownerType,
      owner_id: params.ownerId,
      type: params.type,
      title: params.title,
      url: params.url ?? null,
      filename: params.filename ?? null,
      stored_filename: params.storedFilename ?? null,
      mimetype: params.mimetype ?? null,
      filesize: params.filesize ?? null,
      created_by: params.createdBy ?? null,
      created_at: now,
    })
    .execute();
  return (await getAttachment(id))!;
}

/**
 * Delete the row and, for uploads, the file behind it. A missing file is not an
 * error — the row is what the UI lists, so it must always come off.
 */
export async function deleteAttachment(id: string): Promise<void> {
  const attachment = await getAttachment(id);
  const db = getAdminDb();
  await db.deleteFrom("admin_attachments").where("id", "=", id).execute();
  if (attachment?.type === "file" && attachment.storedFilename) {
    await fs.rm(resolveAttachmentFilePath(attachment.storedFilename), { force: true }).catch(() => {
      /* the row is gone; a leftover blob is not worth failing the request */
    });
  }
}

/** Drop every attachment belonging to an owner, used when the owner is deleted. */
export async function deleteAttachmentsForOwner(
  ownerType: AttachmentOwnerType,
  ownerId: string,
): Promise<void> {
  const existing = await listAttachments(ownerType, ownerId);
  for (const attachment of existing) {
    await deleteAttachment(attachment.id);
  }
}
