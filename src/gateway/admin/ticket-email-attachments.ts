// Files a client attached, carried on the department's notification email.
//
// The desk works from the inbox, so a screenshot that only exists behind a
// dashboard login is a screenshot they do not look at. Anything that fits rides
// along; anything that does not is still named in the email, pointing at the
// ticket — the alternative is a message the provider rejects outright, which
// loses the notification as well as the file.

import fs from "node:fs/promises";
import { listAttachments, resolveAttachmentFilePath } from "./attachment-store.js";
import type { TicketEmailAttachment } from "./ticket-email-render.js";

/**
 * Most raw bytes to carry on one notification. Postmark refuses messages over
 * 10 MB *after* base64, which inflates by 4/3 — 6 MB of files encodes to 8 MB
 * and leaves comfortable room for the bodies and headers.
 */
export const MAX_EMAIL_ATTACHMENT_BYTES = 6 * 1024 * 1024;

/** One file, encoded the way Postmark's API wants it. */
export type LoadedEmailAttachment = {
  filename: string;
  contentType: string;
  /** Base64 payload, no data: prefix. */
  content: string;
};

export type TicketEmailAttachmentLoad = {
  /** Ready to hand to the mailer. */
  files: LoadedEmailAttachment[];
  /** Every file on the ticket, including the ones left behind, for the body. */
  summaries: TicketEmailAttachment[];
};

export type LoadTicketEmailAttachmentsOptions = {
  budgetBytes?: number;
  /** Injected in tests; defaults to reading the stored blob off disk. */
  readFile?: (storedFilename: string) => Promise<Buffer>;
};

/**
 * Load a ticket's uploads, attaching what fits inside the budget.
 *
 * Files are considered oldest-first and an oversized one is skipped rather than
 * ending the loop, so a single large photo does not strand the small
 * screenshots behind it. A file whose blob has gone missing is reported as
 * unattached instead of failing the notification: the ticket text is the
 * substance, and an email that never sends helps nobody.
 */
export async function loadTicketEmailAttachments(
  ticketId: string,
  options: LoadTicketEmailAttachmentsOptions = {},
): Promise<TicketEmailAttachmentLoad> {
  const budget = options.budgetBytes ?? MAX_EMAIL_ATTACHMENT_BYTES;
  const readFile =
    options.readFile ?? ((stored: string) => fs.readFile(resolveAttachmentFilePath(stored)));

  const attachments = await listAttachments("ticket", ticketId);
  const files: LoadedEmailAttachment[] = [];
  const summaries: TicketEmailAttachment[] = [];
  let used = 0;

  for (const attachment of attachments) {
    // Links hung off a ticket are not files; nothing to carry.
    if (attachment.type !== "file" || !attachment.storedFilename) {
      continue;
    }
    const filename = attachment.filename ?? attachment.title;
    const size = attachment.filesize;

    if (size !== null && used + size > budget) {
      summaries.push({ filename, filesize: size, attached: false });
      continue;
    }
    try {
      const bytes = await readFile(attachment.storedFilename);
      // Recheck against the real length: the recorded size can be null, and a
      // wrong one must not be what lets us past the provider's ceiling.
      if (used + bytes.byteLength > budget) {
        summaries.push({ filename, filesize: bytes.byteLength, attached: false });
        continue;
      }
      used += bytes.byteLength;
      files.push({
        filename,
        contentType: attachment.mimetype ?? "application/octet-stream",
        content: bytes.toString("base64"),
      });
      summaries.push({ filename, filesize: bytes.byteLength, attached: true });
    } catch (err) {
      console.error(`[tickets] could not read "${filename}" for the notification email:`, err);
      summaries.push({ filename, filesize: size, attached: false });
    }
  }

  return { files, summaries };
}
