// Files kept on a brokerage agreement: the signed contract, amendments, the
// rate sheet. Staff upload them, so the formats are the ones contracts arrive
// in, but the same rule as the public intake holds: the type is decided from
// the bytes, never from what the browser claimed, because the stored type is
// what the file is later served back as.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import { ensureAttachmentsDir, resolveAttachmentFilePath } from "./attachment-store.js";
import { sanitizeFilename, sniffFileType } from "./ticket-attachment-intake.js";

export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
/** Base64 inflates by 4/3, plus room for the JSON envelope. */
export const MAX_DOCUMENT_BODY_BYTES = Math.ceil(MAX_DOCUMENT_BYTES * (4 / 3)) + 512 * 1024;
export const ACCEPTED_DOCUMENT_LABEL = "PDF, Word, Excel, PowerPoint, or an image";

// latin1, not ascii: the ascii decoder masks off the high bit.
const head = (bytes: Buffer, end: number) => bytes.subarray(0, end).toString("latin1");

/**
 * Office formats have no signature of their own: the current ones are ZIP
 * archives and the old ones are OLE compound files. The container is checked
 * from the bytes and the extension says which document inside it — a ZIP
 * named .docx that is not one is still only ever served as a download.
 */
const OFFICE: Record<string, { container: "zip" | "ole"; mimetype: string }> = {
  docx: {
    container: "zip",
    mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  xlsx: {
    container: "zip",
    mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  pptx: {
    container: "zip",
    mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  doc: { container: "ole", mimetype: "application/msword" },
  xls: { container: "ole", mimetype: "application/vnd.ms-excel" },
  ppt: { container: "ole", mimetype: "application/vnd.ms-powerpoint" },
};

function containerOf(bytes: Buffer): "zip" | "ole" | null {
  if (head(bytes, 4) === "PK\x03\x04") {
    return "zip";
  }
  if (head(bytes, 8) === "\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1") {
    return "ole";
  }
  return null;
}

export type DocumentFile = {
  filename: string;
  mimetype: string;
  extension: string;
  bytes: Buffer;
};

export type ParseDocumentResult = { ok: true; file: DocumentFile } | { ok: false; error: string };

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function parseDocumentUpload(input: {
  filename: unknown;
  data: unknown;
}): ParseDocumentResult {
  const filename = sanitizeFilename(input.filename);
  if (typeof input.data !== "string" || input.data.trim().length === 0) {
    return { ok: false, error: `"${filename}" came through empty. Please choose it again.` };
  }
  const comma = input.data.indexOf(",");
  const base64 = (
    input.data.startsWith("data:") && comma !== -1 ? input.data.slice(comma + 1) : input.data
  ).replace(/\s+/g, "");
  if (Math.floor((base64.length * 3) / 4) > MAX_DOCUMENT_BYTES + 2) {
    return { ok: false, error: `"${filename}" is larger than 15 MB.` };
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) {
    return { ok: false, error: `"${filename}" came through empty. Please choose it again.` };
  }
  if (bytes.length > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: `"${filename}" is larger than 15 MB.` };
  }

  const sniffed = sniffFileType(bytes);
  if (sniffed) {
    const withExt =
      extensionOf(filename) === sniffed.extension ? filename : `${filename}.${sniffed.extension}`;
    return {
      ok: true,
      file: { filename: withExt, mimetype: sniffed.mimetype, extension: sniffed.extension, bytes },
    };
  }
  const extension = extensionOf(filename);
  const office = OFFICE[extension];
  if (office && containerOf(bytes) === office.container) {
    return { ok: true, file: { filename, mimetype: office.mimetype, extension, bytes } };
  }
  return {
    ok: false,
    error: `"${filename}" is not a file type we keep. Please upload ${ACCEPTED_DOCUMENT_LABEL}.`,
  };
}

/** Write the bytes beside every other admin upload; returns the stored name. */
export async function saveDocumentFile(file: DocumentFile): Promise<string> {
  await ensureAttachmentsDir();
  const stored = `${crypto.randomUUID()}.${file.extension}`;
  await fs.writeFile(resolveAttachmentFilePath(stored), file.bytes, { mode: 0o600 });
  return stored;
}

export async function removeDocumentFile(stored: string): Promise<void> {
  await fs.rm(resolveAttachmentFilePath(stored), { force: true });
}

export async function readDocumentFile(stored: string): Promise<Buffer> {
  return fs.readFile(resolveAttachmentFilePath(stored));
}
