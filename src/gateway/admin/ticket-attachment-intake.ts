// Files a client attaches on the public intake form — a screenshot of the frame
// they want changed, the photo that came back wrong. This is an unauthenticated
// endpoint, so everything here is deliberately strict and self-contained:
//
//  - The client's declared MIME type is never trusted or stored. We sniff the
//    leading bytes and keep what WE decided it is, because the stored type is
//    what the dashboard later serves the file back as.
//  - Anything we cannot positively identify is rejected, rather than stored as
//    application/octet-stream. An allowlist of known signatures fails closed.
//  - Sizes are checked against the base64 length BEFORE decoding, so an
//    oversized payload is refused without first materializing it in memory.
//
// Files ride along in the intake POST rather than getting their own upload
// endpoint: one request means one ticket with its files, so there is no second
// public surface to abuse and no orphaned-blob cleanup to get wrong.

/** Most a client may attach to one ticket. */
export const MAX_INTAKE_FILES = 5;
/** Per-file ceiling, decoded. Comfortably fits a phone photo or a screenshot. */
export const MAX_INTAKE_FILE_BYTES = 6 * 1024 * 1024;
/** Ceiling across all files on one submission, decoded. */
export const MAX_INTAKE_TOTAL_BYTES = 15 * 1024 * 1024;

/**
 * Body cap for the intake route. Base64 inflates by 4/3, plus room for the JSON
 * envelope and the form's own fields. The per-IP submission throttle is what
 * bounds how often anyone can push a body this size.
 */
export const MAX_INTAKE_BODY_BYTES = Math.ceil(MAX_INTAKE_TOTAL_BYTES * (4 / 3)) + 512 * 1024;

export type IntakeFile = {
  /** Client-supplied name, sanitized. Display only. */
  filename: string;
  /** The type WE detected, not the one the client claimed. */
  mimetype: string;
  bytes: Buffer;
};

type Signature = {
  mimetype: string;
  extension: string;
  matches: (head: Buffer) => boolean;
};

// latin1, not ascii: Node's ascii decoder masks off the high bit, so a 0x89
// lead byte (PNG) would silently compare equal to 0x09.
const ascii = (head: Buffer, start: number, end: number): string =>
  head.subarray(start, end).toString("latin1");

// Formats a client plausibly has on hand for "here is what's wrong". Anything
// executable or scriptable (SVG, HTML) is deliberately absent: those are served
// back to staff from our own origin.
const SIGNATURES: Signature[] = [
  {
    mimetype: "image/jpeg",
    extension: "jpg",
    matches: (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff,
  },
  {
    mimetype: "image/png",
    extension: "png",
    matches: (h) => ascii(h, 0, 8) === "\x89PNG\r\n\x1a\n",
  },
  {
    mimetype: "image/gif",
    extension: "gif",
    matches: (h) => ascii(h, 0, 4) === "GIF8",
  },
  {
    mimetype: "image/webp",
    extension: "webp",
    matches: (h) => ascii(h, 0, 4) === "RIFF" && ascii(h, 8, 12) === "WEBP",
  },
  {
    mimetype: "image/heic",
    extension: "heic",
    matches: (h) =>
      ascii(h, 4, 8) === "ftyp" && ["heic", "heix", "hevc", "mif1"].includes(ascii(h, 8, 12)),
  },
  {
    mimetype: "application/pdf",
    extension: "pdf",
    matches: (h) => ascii(h, 0, 5) === "%PDF-",
  },
];

/** The type we detect from the leading bytes, or null when nothing matches. */
export function sniffFileType(bytes: Buffer): { mimetype: string; extension: string } | null {
  if (bytes.length < 12) {
    return null;
  }
  const head = bytes.subarray(0, 16);
  const hit = SIGNATURES.find((s) => s.matches(head));
  return hit ? { mimetype: hit.mimetype, extension: hit.extension } : null;
}

/** Human label for the formats we take, used in the form copy and errors. */
export const ACCEPTED_FILE_LABEL = "JPG, PNG, GIF, WEBP, HEIC or PDF";

/**
 * Strip a `data:` URL wrapper. Browsers hand back
 * `data:image/png;base64,iVBOR…` from FileReader, and the prefix is not part of
 * the payload. The declared type in it is discarded — we sniff instead.
 */
function stripDataUrl(raw: string): string {
  const comma = raw.indexOf(",");
  return raw.startsWith("data:") && comma !== -1 ? raw.slice(comma + 1) : raw;
}

/** Upper bound on decoded size from the base64 length, without decoding. */
function decodedSizeOf(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Keep a recognizable name without letting it steer a path or a header. */
export function sanitizeFilename(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  const base = name.split(/[/\\]/).pop() ?? "";
  const safe = base.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
  return safe.replace(/^\.+/, "") || "attachment";
}

export type ParseIntakeFilesResult =
  | { ok: true; files: IntakeFile[] }
  | { ok: false; error: string };

/**
 * Validate the `files` field of an intake submission. Absent or empty is fine —
 * attachments are optional — but anything present must pass every check, so a
 * client is told their file was rejected rather than silently losing it.
 */
export function parseIntakeFiles(raw: unknown): ParseIntakeFilesResult {
  if (raw === undefined || raw === null) {
    return { ok: true, files: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Attachments were not sent correctly. Please re-add them." };
  }
  if (raw.length > MAX_INTAKE_FILES) {
    return {
      ok: false,
      error: `Please attach at most ${MAX_INTAKE_FILES} files.`,
    };
  }

  const files: IntakeFile[] = [];
  let total = 0;
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "Attachments were not sent correctly. Please re-add them." };
    }
    const record = entry as Record<string, unknown>;
    const rawData = record.dataBase64 ?? record.data;
    if (typeof rawData !== "string" || rawData.trim().length === 0) {
      return { ok: false, error: "One of your files came through empty. Please re-add it." };
    }
    const filename = sanitizeFilename(record.filename ?? record.name);
    const base64 = stripDataUrl(rawData).replace(/\s+/g, "");

    // Refuse on the encoded length first so an oversized file is never decoded.
    if (decodedSizeOf(base64) > MAX_INTAKE_FILE_BYTES) {
      return {
        ok: false,
        error: `"${filename}" is larger than ${Math.floor(MAX_INTAKE_FILE_BYTES / (1024 * 1024))} MB.`,
      };
    }

    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0) {
      return { ok: false, error: `"${filename}" came through empty. Please re-add it.` };
    }
    if (bytes.length > MAX_INTAKE_FILE_BYTES) {
      return {
        ok: false,
        error: `"${filename}" is larger than ${Math.floor(MAX_INTAKE_FILE_BYTES / (1024 * 1024))} MB.`,
      };
    }

    const sniffed = sniffFileType(bytes);
    if (!sniffed) {
      return {
        ok: false,
        error: `"${filename}" is not a file type we accept. Please attach ${ACCEPTED_FILE_LABEL}.`,
      };
    }

    total += bytes.length;
    if (total > MAX_INTAKE_TOTAL_BYTES) {
      return {
        ok: false,
        error: `Your attachments add up to more than ${Math.floor(MAX_INTAKE_TOTAL_BYTES / (1024 * 1024))} MB in total.`,
      };
    }

    // Trust our own detection for the extension too, so a ".png" that is really
    // a PDF is stored and served as the PDF it is.
    const withExt = filename.toLowerCase().endsWith(`.${sniffed.extension}`)
      ? filename
      : `${filename}.${sniffed.extension}`;
    files.push({ filename: withExt, mimetype: sniffed.mimetype, bytes });
  }
  return { ok: true, files };
}
