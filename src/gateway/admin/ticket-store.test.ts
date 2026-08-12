import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-store-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./ticket-store.js");
const userStore = await import("./user-store.js");

let staff: string;

beforeAll(async () => {
  staff = (await userStore.createUser({ username: "desk", password: "x", role: "admin" })).id;
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("ticket numbering", () => {
  it("assigns sequential WVT numbers starting above 1000 with a matching reply token", async () => {
    const a = await store.createTicket({ category: "edit_request", subject: "Fix twilight" });
    const b = await store.createTicket({ category: "missing_media", subject: "No aerials" });
    expect(a.number).toBe("WVT-1001");
    expect(b.number).toBe("WVT-1002");
    expect(a.replyToken).toBe("wvt-1001");
    expect(b.replyToken).toBe("wvt-1002");
    // Reply-token lookup is the hook the inbound-email track relies on.
    const found = await store.getTicketByReplyToken("WVT-1001");
    expect(found?.id).toBe(a.id);
  });
});

describe("category routing + defaults", () => {
  it("routes categories to their default department when none is given", async () => {
    const edit = await store.createTicket({ category: "edit_request", subject: "edit" });
    const missing = await store.createTicket({ category: "missing_media", subject: "missing" });
    const other = await store.createTicket({ category: "other", subject: "misc" });
    expect(edit.department).toBe("editing");
    expect(missing.department).toBe("operations");
    expect(other.department).toBe("general");
    expect(store.defaultDepartmentForCategory("additional_service")).toBe("operations");
  });

  it("honors an explicit department override", async () => {
    const t = await store.createTicket({
      category: "edit_request",
      subject: "special",
      department: "billing",
    });
    expect(t.department).toBe("billing");
  });

  it("logs a created event on the thread", async () => {
    const t = await store.createTicket({ category: "other", subject: "threaded" });
    const events = await store.listTicketEvents(t.id);
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("created");
  });
});

describe("status transitions + activity thread", () => {
  it("stamps resolvedAt on first resolve and logs a status_change event", async () => {
    const t = await store.createTicket({ category: "edit_request", subject: "resolve me" });
    expect(t.status).toBe("new");
    expect(t.resolvedAt).toBeNull();

    const resolved = await store.updateTicket(t.id, { status: "resolved" }, { name: "desk" });
    expect(resolved!.status).toBe("resolved");
    expect(resolved!.resolvedAt).toBeGreaterThan(0);

    const events = await store.listTicketEvents(t.id);
    const change = events.find((e) => e.kind === "status_change");
    expect(change?.meta).toMatchObject({ from: "new", to: "resolved" });

    // Reopening clears the resolved stamp.
    const reopened = await store.updateTicket(t.id, { status: "in_progress" });
    expect(reopened!.resolvedAt).toBeNull();
  });

  it("appends staff comments in chronological order", async () => {
    const t = await store.createTicket({ category: "other", subject: "commentable" });
    await store.addTicketEvent(t.id, {
      kind: "comment",
      authorType: "staff",
      authorName: "desk",
      body: "first",
    });
    await store.addTicketEvent(t.id, {
      kind: "comment",
      authorType: "staff",
      authorName: "desk",
      body: "second",
    });
    const events = await store.listTicketEvents(t.id);
    const comments = events.filter((e) => e.kind === "comment").map((e) => e.body);
    expect(comments).toEqual(["first", "second"]);
  });

  it("logs an assignment event when the assignee changes", async () => {
    const t = await store.createTicket({ category: "other", subject: "assignable" });
    await store.updateTicket(t.id, { assignedTo: staff });
    const events = await store.listTicketEvents(t.id);
    const assign = events.find((e) => e.kind === "assignment");
    expect(assign?.meta).toMatchObject({ from: null, to: staff });
  });
});

describe("filters + stats", () => {
  it("filters by status and searches subject/number/address", async () => {
    await store.createTicket({
      category: "missing_media",
      subject: "Missing drone shots",
      orderAddress: "123 Birch Ln",
    });
    const bySubject = await store.listTickets({ q: "drone" });
    expect(bySubject.some((t) => t.subject === "Missing drone shots")).toBe(true);
    const byAddress = await store.listTickets({ q: "birch" });
    expect(byAddress.some((t) => t.orderAddress === "123 Birch Ln")).toBe(true);

    const newOnly = await store.listTickets({ status: "new" });
    expect(newOnly.every((t) => t.status === "new")).toBe(true);
  });

  it("reports counts by status", async () => {
    const stats = await store.getTicketStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.byStatus.new).toBeGreaterThanOrEqual(0);
    const summed = Object.values(stats.byStatus).reduce((a, b) => a + b, 0);
    expect(summed).toBe(stats.total);
  });
});

describe("reply-command grammar", () => {
  it("parses RESOLVED / UPDATE prefixes case-insensitively and strips the command line", () => {
    expect(store.parseReplyCommand("RESOLVED\nDone, delivered new edit.")).toEqual({
      command: "resolved",
      body: "Done, delivered new edit.",
    });
    expect(store.parseReplyCommand("update: still working on it")).toEqual({
      command: "update",
      body: "still working on it",
    });
    expect(store.parseReplyCommand("Resolved - fixed")).toEqual({
      command: "resolved",
      body: "fixed",
    });
  });

  it("takes the whole activity thread with a deleted ticket", async () => {
    const ticket = await store.createTicket({
      category: "other",
      subject: "delete me",
      source: "widget",
      requesterName: "Dana",
    });
    await store.addTicketEvent(ticket.id, {
      kind: "comment",
      authorType: "staff",
      authorName: "desk",
      body: "looking into it",
    });
    expect(await store.listTicketEvents(ticket.id)).not.toHaveLength(0);

    await store.deleteTicket(ticket.id);
    expect(await store.getTicket(ticket.id)).toBeNull();
    // The events reference the ticket ON DELETE CASCADE; a thread outliving its
    // ticket would be unreachable rows nothing can ever show or clean up.
    expect(await store.listTicketEvents(ticket.id)).toHaveLength(0);
  });

  it("does not renumber the queue when a ticket is deleted", async () => {
    // Numbers are the client's reference in email; reusing one would point two
    // conversations at the same ticket.
    const first = await store.createTicket({ category: "other", subject: "one" });
    await store.deleteTicket(first.id);
    const next = await store.createTicket({ category: "other", subject: "two" });
    expect(next.number).not.toBe(first.number);
  });

  it("treats an unrecognized reply as a no-op command (needs review)", () => {
    const parsed = store.parseReplyCommand("Hey, can you clarify which photo?");
    expect(parsed.command).toBe("none");
    expect(parsed.body).toBe("Hey, can you clarify which photo?");
    expect(store.statusForReplyCommand("none")).toBe("needs_review");
    expect(store.statusForReplyCommand("resolved")).toBe("resolved");
    expect(store.statusForReplyCommand("update")).toBe("in_progress");
  });
});
