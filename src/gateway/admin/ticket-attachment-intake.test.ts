import { describe, expect, it } from "vitest";
import {
  MAX_INTAKE_FILE_BYTES,
  MAX_INTAKE_FILES,
  MAX_INTAKE_TOTAL_BYTES,
  parseIntakeFiles,
  sanitizeFilename,
  sniffFileType,
} from "./ticket-attachment-intake.js";

// The intake endpoint is unauthenticated, so the rule is that nothing the client
// says about its own file is believed: the type is sniffed from the bytes, the
// name is sanitized, and the size is checked before anything is decoded.

/** A buffer that starts with `head` and is padded to `size` bytes. */
function fileOf(head: number[] | string, size = 64): Buffer {
  const prefix = typeof head === "string" ? Buffer.from(head, "latin1") : Buffer.from(head);
  return Buffer.concat([prefix, Buffer.alloc(Math.max(0, size - prefix.length))]);
}

const PNG = fileOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = fileOf([0xff, 0xd8, 0xff, 0xe0]);
const GIF = fileOf("GIF89a");
const PDF = fileOf("%PDF-1.7");
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "latin1"),
  Buffer.alloc(4),
  Buffer.from("WEBP", "latin1"),
  Buffer.alloc(48),
]);
const HEIC = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypheic", "latin1"), Buffer.alloc(48)]);

/** One entry in the submitted `files` array. */
function entry(bytes: Buffer, filename = "shot.png") {
  return { filename, dataBase64: bytes.toString("base64") };
}

describe("sniffing the file type from its bytes", () => {
  it("identifies each format we accept", () => {
    expect(sniffFileType(PNG)?.mimetype).toBe("image/png");
    expect(sniffFileType(JPEG)?.mimetype).toBe("image/jpeg");
    expect(sniffFileType(GIF)?.mimetype).toBe("image/gif");
    expect(sniffFileType(WEBP)?.mimetype).toBe("image/webp");
    expect(sniffFileType(HEIC)?.mimetype).toBe("image/heic");
    expect(sniffFileType(PDF)?.mimetype).toBe("application/pdf");
  });

  it("does not mistake a 0x89 lead byte for a 7-bit one", () => {
    // Node's ascii decoder masks the high bit, which would make 0x89 read as
    // 0x09 and quietly break PNG detection.
    expect(sniffFileType(PNG)?.mimetype).toBe("image/png");
    expect(sniffFileType(fileOf([0x09, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
  });

  it("rejects what it cannot positively identify, rather than guessing", () => {
    expect(sniffFileType(fileOf('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffFileType(fileOf("<!DOCTYPE html><script>alert(1)</script>"))).toBeNull();
    expect(sniffFileType(fileOf("#!/bin/sh\nrm -rf /"))).toBeNull();
    expect(sniffFileType(fileOf([0x4d, 0x5a]))).toBeNull(); // Windows executable
    expect(sniffFileType(Buffer.alloc(4))).toBeNull(); // too short to judge
  });
});

describe("the declared type is never trusted", () => {
  it("stores what the bytes are, not what the name or mimetype claimed", () => {
    const result = parseIntakeFiles([
      {
        filename: "totally-a-photo.png",
        mimetype: "image/png",
        dataBase64: PDF.toString("base64"),
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.files[0].mimetype).toBe("application/pdf");
    // ...and the extension is corrected so it is served as the PDF it is.
    expect(result.files[0].filename).toBe("totally-a-photo.png.pdf");
  });

  it("refuses a disguised SVG outright", () => {
    const result = parseIntakeFiles([entry(fileOf('<svg onload="alert(1)">'), "logo.png")]);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("not a file type we accept");
  });
});

describe("filenames", () => {
  it("strips path traversal and keeps the base name", () => {
    expect(sanitizeFilename("../../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Windows\\System32\\evil.png")).toBe("evil.png");
  });

  it("removes quotes and newlines that would break a Content-Disposition header", () => {
    const name = sanitizeFilename('bad"name\r\n.png');
    expect(name).not.toContain('"');
    expect(name).not.toContain("\n");
    expect(name).not.toContain("\r");
  });

  it("never yields an empty or dot-leading name", () => {
    expect(sanitizeFilename("")).toBe("attachment");
    expect(sanitizeFilename("...")).toBe("attachment");
    expect(sanitizeFilename(undefined)).toBe("attachment");
    expect(sanitizeFilename(12345)).toBe("attachment");
  });
});

describe("limits", () => {
  it("treats no attachments as fine — they are optional", () => {
    expect(parseIntakeFiles(undefined)).toEqual({ ok: true, files: [] });
    expect(parseIntakeFiles(null)).toEqual({ ok: true, files: [] });
    expect(parseIntakeFiles([])).toEqual({ ok: true, files: [] });
  });

  it("accepts a full complement of files", () => {
    const result = parseIntakeFiles(Array.from({ length: MAX_INTAKE_FILES }, () => entry(PNG)));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.files).toHaveLength(MAX_INTAKE_FILES);
  });

  it("refuses one file too many", () => {
    const result = parseIntakeFiles(Array.from({ length: MAX_INTAKE_FILES + 1 }, () => entry(PNG)));
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain(`at most ${MAX_INTAKE_FILES}`);
  });

  it("refuses a single file over the per-file ceiling", () => {
    const tooBig = Buffer.concat([PNG, Buffer.alloc(MAX_INTAKE_FILE_BYTES)]);
    const result = parseIntakeFiles([entry(tooBig, "huge.png")]);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("larger than");
  });

  it("refuses a set that busts the total even when each file is legal", () => {
    // Each file is under the per-file cap; together they are over the total.
    const each = Buffer.concat([PNG, Buffer.alloc(MAX_INTAKE_FILE_BYTES - PNG.length - 1)]);
    const count = Math.ceil(MAX_INTAKE_TOTAL_BYTES / each.length) + 1;
    const result = parseIntakeFiles(
      Array.from({ length: Math.min(count, MAX_INTAKE_FILES) }, () => entry(each)),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("in total");
  });

  it("rejects malformed entries instead of skipping them", () => {
    expect(parseIntakeFiles("nope").ok).toBe(false);
    expect(parseIntakeFiles([null]).ok).toBe(false);
    expect(parseIntakeFiles([{ filename: "a.png" }]).ok).toBe(false);
    expect(parseIntakeFiles([{ filename: "a.png", dataBase64: "" }]).ok).toBe(false);
  });
});

describe("browser payload shapes", () => {
  it("accepts the data: URL that FileReader produces", () => {
    const result = parseIntakeFiles([
      { filename: "shot.png", dataBase64: `data:image/png;base64,${PNG.toString("base64")}` },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.files[0].mimetype).toBe("image/png");
  });

  it("tolerates whitespace inside the base64 payload", () => {
    const wrapped = PNG.toString("base64").replace(/(.{8})/g, "$1\n");
    const result = parseIntakeFiles([{ filename: "shot.png", dataBase64: wrapped }]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.files[0].bytes.equals(PNG)).toBe(true);
  });
});
