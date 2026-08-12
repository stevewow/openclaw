import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-email-files-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const attachments = await import("./attachment-store.js");
const emailFiles = await import("./ticket-email-attachments.js");
const mailer = await import("./ticket-mailer.js");
const store = await import("./ticket-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

const ENV = {
  POSTMARK_SERVER_TOKEN: "tok-123",
  TICKET_EMAIL_FROM: "support@wowvideotours.com",
  TICKET_EMAIL_INBOUND_ADDRESS: "ticket@tickets.wowvideotours.com",
  TICKET_DEPARTMENT_EMAILS: JSON.stringify({ editing: "edits@wow.co" }),
} as unknown as NodeJS.ProcessEnv;

async function ticketWithFiles(sizes: number[]) {
  const ticket = await store.createTicket({
    category: "edit_request",
    subject: "Brighten kitchen",
    source: "widget",
  });
  for (const [i, size] of sizes.entries()) {
    await attachments.saveUploadedAttachment({
      ownerType: "ticket",
      ownerId: ticket.id,
      filename: `shot-${i}.jpg`,
      mimetype: "image/jpeg",
      bytes: Buffer.alloc(size, 7),
    });
  }
  return ticket;
}

describe("loadTicketEmailAttachments", () => {
  it("encodes the ticket's uploads for the mailer", async () => {
    const ticket = await ticketWithFiles([64, 128]);
    const loaded = await emailFiles.loadTicketEmailAttachments(ticket.id);
    expect(loaded.files.map((f) => f.filename)).toEqual(["shot-0.jpg", "shot-1.jpg"]);
    expect(loaded.files[0]?.contentType).toBe("image/jpeg");
    expect(Buffer.from(loaded.files[0]?.content ?? "", "base64").byteLength).toBe(64);
    expect(loaded.summaries.every((s) => s.attached)).toBe(true);
  });

  it("skips past an oversized file instead of stranding the ones behind it", async () => {
    const ticket = await ticketWithFiles([900, 100, 200]);
    const loaded = await emailFiles.loadTicketEmailAttachments(ticket.id, { budgetBytes: 500 });
    // The 900-byte file cannot ride along; the two small ones still do.
    expect(loaded.files.map((f) => f.filename)).toEqual(["shot-1.jpg", "shot-2.jpg"]);
    expect(loaded.summaries.find((s) => s.filename === "shot-0.jpg")!.attached).toBe(false);
    expect(loaded.summaries.filter((s) => s.attached)).toHaveLength(2);
  });

  it("reports a blob that has gone missing rather than failing the send", async () => {
    const ticket = await ticketWithFiles([32]);
    const loaded = await emailFiles.loadTicketEmailAttachments(ticket.id, {
      readFile: async () => {
        throw new Error("ENOENT");
      },
    });
    expect(loaded.files).toHaveLength(0);
    expect(loaded.summaries).toEqual([{ filename: "shot-0.jpg", filesize: 32, attached: false }]);
  });
});

describe("notifyDepartment with attachments", () => {
  it("posts the files to Postmark and records how many rode along", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const ticket = await ticketWithFiles([48]);

    let sent: Record<string, unknown> | null = null;
    const fetchImpl = async (_url: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string) as Record<string, unknown>;
      return new Response(JSON.stringify({ ErrorCode: 0 }), { status: 200 });
    };
    const result = await mailer.notifyDepartment(ticket, {
      config: cfg,
      mailer: new mailer.PostmarkMailer(cfg, fetchImpl),
      logger: { info: () => {}, error: () => {} },
    });
    expect(result.ok).toBe(true);

    const body = sent as unknown as {
      Attachments?: Array<{ Name: string; Content: string; ContentType: string }>;
      HtmlBody?: string;
      TextBody?: string;
    };
    expect(body.Attachments).toHaveLength(1);
    const file = body.Attachments?.[0];
    expect(file?.Name).toBe("shot-0.jpg");
    expect(file?.ContentType).toBe("image/jpeg");
    expect(Buffer.from(file?.Content ?? "", "base64").byteLength).toBe(48);
    // Both bodies go out, and the file is named in them.
    expect(body.HtmlBody).toContain("shot-0.jpg");
    expect(body.TextBody).toContain("shot-0.jpg");

    const events = await store.listTicketEvents(ticket.id);
    const out = events.find((e) => e.kind === "email_out");
    expect(out?.body).toContain("with 1 file");
    expect(out?.meta).toMatchObject({ ok: true, attached: 1 });
  });

  it("still sends when the ticket has no files at all", async () => {
    const cfg = mailer.readEmailConfig(ENV)!;
    const ticket = await store.createTicket({ category: "edit_request", subject: "no files" });
    let sent: Record<string, unknown> | null = null;
    const result = await mailer.notifyDepartment(ticket, {
      config: cfg,
      mailer: new mailer.PostmarkMailer(cfg, async (_u, init) => {
        sent = JSON.parse(init.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify({ ErrorCode: 0 }), { status: 200 });
      }),
      logger: { info: () => {}, error: () => {} },
    });
    expect(result.ok).toBe(true);
    expect((sent as unknown as { Attachments?: unknown }).Attachments).toBeUndefined();
  });
});
