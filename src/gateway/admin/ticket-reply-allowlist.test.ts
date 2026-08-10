import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Replies only moved a ticket when they came from the one address in
// TICKET_STAFF_ALLOWLIST. Every other desk we email — the ones that actually
// work tickets — was treated as an unverified stranger: the reply was logged and
// the ticket parked in needs_review, with its UPDATE/RESOLVED discarded. The
// allowlist is now derived from the departments table, so a desk that can be
// sent a ticket can always reply to it.

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-reply-allow-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const intake = await import("./ticket-intake-http.js");
const dept = await import("./ticket-department-store.js");
const inbound = await import("./ticket-inbound.js");
const store = await import("./ticket-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

// The deployed shape: one human on the env allowlist. It has to be non-empty,
// because an empty allowlist means allow-all and would pass either way — the bug
// only bites once someone configures a single address.
const PROD_ENV = { TICKET_STAFF_ALLOWLIST: "steve@wowvideotours.com" } as NodeJS.ProcessEnv;

/** A Postmark inbound payload for a reply to `ticketNumber` from `from`. */
function reply(ticketNumber: string, from: string, text: string) {
  return {
    FromFull: { Email: from },
    MailboxHash: ticketNumber.toLowerCase(),
    Subject: `Re: [${ticketNumber}] Something broke`,
    TextBody: text,
  };
}

beforeAll(async () => {
  await dept.ensureDepartmentSeed();
  await dept.updateDepartment("editing", { email: "productionwvt@gmail.com" });
  await dept.updateDepartment("operations", { email: "support@wowvideotours.com" });
});

describe("the reply allowlist", () => {
  it("covers every department address, not just the env extras", async () => {
    const list = await intake.replyAllowlist(PROD_ENV);
    expect(list).toContain("steve@wowvideotours.com");
    expect(list).toContain("productionwvt@gmail.com");
    expect(list).toContain("support@wowvideotours.com");
  });

  it("normalizes case so a desk replying from Gmail's display casing still matches", async () => {
    const list = await intake.replyAllowlist({} as NodeJS.ProcessEnv);
    expect(list).toContain("productionwvt@gmail.com");
    expect(list.every((e) => e === e.toLowerCase())).toBe(true);
  });
});

describe("a department replying to its own ticket", () => {
  it("resolves the ticket instead of parking it in needs_review", async () => {
    const ticket = await store.createTicket({
      subject: "Reshoot needed",
      category: "edit_request",
      department: "editing",
      requesterName: "Agent",
      requesterEmail: "agent@example.com",
      body: "Please reshoot.",
    });

    const outcome = await inbound.applyInboundReply(
      reply(ticket.number, "productionwvt@gmail.com", "RESOLVED\nRe-uploaded the gallery."),
      { allowlist: await intake.replyAllowlist(PROD_ENV) },
    );

    expect(outcome.status).toBe("applied");
    const after = await store.getTicket(ticket.id);
    expect(after?.status).toBe("resolved");
  });

  it("still parks a reply from an outsider", async () => {
    const ticket = await store.createTicket({
      subject: "Second request",
      category: "edit_request",
      department: "editing",
      requesterName: "Agent",
      requesterEmail: "agent@example.com",
      body: "Please reshoot.",
    });

    const outcome = await inbound.applyInboundReply(
      reply(ticket.number, "stranger@example.com", "RESOLVED"),
      { allowlist: await intake.replyAllowlist(PROD_ENV) },
    );

    expect(outcome.status).toBe("unverified");
    const after = await store.getTicket(ticket.id);
    expect(after?.status).toBe("needs_review");
  });
});
