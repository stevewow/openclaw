import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// End-to-end through the real public endpoint: a client attaches a screenshot on
// /support, the bytes land on disk, and the ticket carries them. The endpoint is
// unauthenticated, so the rejection cases matter as much as the happy path.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-intake-upload-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const intake = await import("./ticket-intake-http.js");
const cats = await import("./ticket-category-store.js");
const attachments = await import("./attachment-store.js");
const ticketStore = await import("./ticket-store.js");

let server: Server;
let base: string;

function fileOf(head: number[] | string, size = 64): Buffer {
  const prefix = typeof head === "string" ? Buffer.from(head, "latin1") : Buffer.from(head);
  return Buffer.concat([prefix, Buffer.alloc(Math.max(0, size - prefix.length))]);
}
const PNG = fileOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = fileOf("%PDF-1.7");

// The endpoint throttles to 6 submissions per IP per 10 minutes, so each case
// submits as its own client rather than tripping the limiter mid-suite.
let clientCounter = 0;
async function submit(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  clientCounter += 1;
  const res = await fetch(`${base}/api/support/intake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": `203.0.113.${clientCounter}`,
    },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    json: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

/** A valid submission, plus whatever the case overrides. */
function submission(extra: Record<string, unknown> = {}) {
  return {
    category: "edit_request",
    details: "The twilight shot is too dark.",
    requesterName: "Dana Agent",
    requesterEmail: "dana@example.com",
    ...extra,
  };
}

beforeAll(async () => {
  await cats.ensureCategorySeed();
  server = createServer((req, res) => {
    void (async () => {
      const handled = await intake.handleTicketIntakeRequest(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end("not found");
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

/** The ticket behind a submitted number, with its stored attachments. */
async function ticketFor(number: string) {
  const found = await ticketStore.listTickets({});
  const ticket = found.find((t) => t.number === number)!;
  return { ticket, files: await attachments.listAttachments("ticket", ticket.id) };
}

describe("attaching files on the public form", () => {
  it("stores the upload and writes the real bytes to disk", async () => {
    const res = await submit(
      submission({ files: [{ filename: "dark.png", dataBase64: PNG.toString("base64") }] }),
    );
    expect(res.status).toBe(201);
    expect(res.json.attachments).toBe(1);

    const { files } = await ticketFor(res.json.number as string);
    expect(files).toHaveLength(1);
    expect(files[0].mimetype).toBe("image/png");
    expect(files[0].filename).toBe("dark.png");
    expect(files[0].filesize).toBe(PNG.length);

    const onDisk = fs.readFileSync(attachments.resolveAttachmentFilePath(files[0].storedFilename!));
    expect(onDisk.equals(PNG)).toBe(true);
  });

  it("keeps the stored name off the client's filename so it cannot steer the path", async () => {
    const res = await submit(
      submission({
        files: [{ filename: "../../escape.png", dataBase64: PNG.toString("base64") }],
      }),
    );
    expect(res.status).toBe(201);

    const { files } = await ticketFor(res.json.number as string);
    expect(files[0].filename).toBe("escape.png");
    expect(files[0].storedFilename).not.toContain("..");
    expect(files[0].storedFilename).not.toContain("/");
  });

  it("accepts several files at once", async () => {
    const res = await submit(
      submission({
        files: [
          { filename: "one.png", dataBase64: PNG.toString("base64") },
          { filename: "brief.pdf", dataBase64: PDF.toString("base64") },
        ],
      }),
    );
    expect(res.json.attachments).toBe(2);

    const { files } = await ticketFor(res.json.number as string);
    expect(files.map((f) => f.mimetype ?? "").toSorted((a, b) => a.localeCompare(b))).toEqual([
      "application/pdf",
      "image/png",
    ]);
  });

  it("opens the ticket normally when nothing is attached", async () => {
    const res = await submit(submission());
    expect(res.status).toBe(201);
    expect(res.json.attachments).toBe(0);
    const { files } = await ticketFor(res.json.number as string);
    expect(files).toHaveLength(0);
  });
});

describe("rejected uploads", () => {
  it("refuses a file whose bytes are not a type we accept, and opens no ticket", async () => {
    const before = (await ticketStore.listTickets({})).length;
    const res = await submit(
      submission({
        files: [
          {
            filename: "payload.png",
            dataBase64: fileOf('<svg onload="alert(1)">').toString("base64"),
          },
        ],
      }),
    );

    expect(res.status).toBe(400);
    expect(String(res.json.error)).toContain("not a file type we accept");
    // The whole submission is refused rather than saved without its evidence.
    expect((await ticketStore.listTickets({})).length).toBe(before);
  });

  it("refuses more files than the limit", async () => {
    const res = await submit(
      submission({
        files: Array.from({ length: 6 }, (_, i) => ({
          filename: `s${i}.png`,
          dataBase64: PNG.toString("base64"),
        })),
      }),
    );
    expect(res.status).toBe(400);
    expect(String(res.json.error)).toContain("at most 5");
  });

  it("refuses an oversized file", async () => {
    const huge = Buffer.concat([PNG, Buffer.alloc(7 * 1024 * 1024)]);
    const res = await submit(
      submission({ files: [{ filename: "huge.png", dataBase64: huge.toString("base64") }] }),
    );
    expect(res.status).toBe(400);
    expect(String(res.json.error)).toContain("larger than");
  });

  it("still validates the form itself before looking at files", async () => {
    const res = await submit({
      category: "edit_request",
      details: "",
      requesterName: "Dana",
      requesterEmail: "dana@example.com",
      files: [{ filename: "a.png", dataBase64: PNG.toString("base64") }],
    });
    expect(res.status).toBe(400);
    expect(String(res.json.error)).toContain("details");
  });
});
