import { describe, expect, it, vi } from "vitest";
import type { Task } from "./project-store.js";
import {
  adminBaseUrl,
  formatTaskEmail,
  newlyAdded,
  notifyTaskPeople,
  taskUrl,
} from "./task-notifier.js";
import type { EmailConfig, OutboundEmail, SendResult } from "./ticket-mailer.js";

const CONFIG: EmailConfig = {
  provider: "postmark",
  serverToken: "tok",
  from: "dashboard@wowvideotours.com",
  inboundAddress: "tickets@wowvideotours.com",
  messageStream: "outbound",
  departmentEmails: {},
  fallbackTo: null,
  logoUrl: "https://hub.wowvideotours.com/support/logo.png",
};

const TASK: Pick<Task, "id" | "title" | "dueDate" | "priority" | "projectId"> = {
  id: "task-1",
  title: "Re-cut the Montgomery walkthrough",
  dueDate: Date.UTC(2026, 7, 14),
  priority: "high",
  projectId: "proj-1",
};

function mailerSpy(result: SendResult = { ok: true }) {
  const sent: OutboundEmail[] = [];
  return {
    sent,
    mailer: {
      send: async (msg: OutboundEmail) => {
        sent.push(msg);
        return result;
      },
    },
  };
}

const USERS = [
  { id: "u-anna", username: "anna", email: "anna@wowvideotours.com" },
  { id: "u-mark", username: "mark", email: "mark@wowvideotours.com" },
  { id: "u-noemail", username: "ghost", email: null },
];

function deps(over: Partial<Parameters<typeof notifyTaskPeople>[1]> = {}) {
  return {
    config: CONFIG,
    logger: { info: () => {}, error: () => {} },
    env: {} as NodeJS.ProcessEnv,
    loadUsers: async () => USERS,
    loadProjectName: async () => "Coldwell Banker Heritage",
    ...over,
  };
}

describe("newlyAdded", () => {
  it("returns only ids the second list introduces", () => {
    expect(newlyAdded(["a"], ["a", "b"])).toEqual(["b"]);
    expect(newlyAdded(["a", "b"], ["a", "b"])).toEqual([]);
    expect(newlyAdded([], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("ignores removals and dedupes repeats", () => {
    expect(newlyAdded(["a", "b"], ["a"])).toEqual([]);
    expect(newlyAdded([], ["a", "a", "b"])).toEqual(["a", "b"]);
  });
});

describe("adminBaseUrl / taskUrl", () => {
  it("defaults to the gateway host and strips trailing slashes from an override", () => {
    expect(adminBaseUrl({})).toBe("https://hub.wowvideotours.com");
    expect(adminBaseUrl({ ADMIN_BASE_URL: "https://dash.example.com/" })).toBe(
      "https://dash.example.com",
    );
  });

  it("builds a deep link that opens the task", () => {
    expect(taskUrl("abc", {})).toBe("https://hub.wowvideotours.com/admin#projects?task=abc");
  });

  it("escapes an id that would otherwise break the query", () => {
    expect(taskUrl("a b&c", {})).toContain("task=a%20b%26c");
  });
});

describe("formatTaskEmail", () => {
  it("quotes the comment and names the mentioner", () => {
    const msg = formatTaskEmail({
      kind: "mention",
      task: TASK,
      projectName: "Coldwell Banker Heritage",
      actorName: "steve",
      recipientName: "anna",
      commentBody: "can you take this?\nclient is waiting",
      config: CONFIG,
      to: "anna@wowvideotours.com",
      env: {},
    });
    expect(msg.subject).toBe('steve mentioned you on "Re-cut the Montgomery walkthrough"');
    expect(msg.to).toBe("anna@wowvideotours.com");
    expect(msg.from).toBe(CONFIG.from);
    // No inbound parser for task mail, so replies go to a human, not a +token.
    expect(msg.replyTo).toBe(CONFIG.from);
    expect(msg.textBody).toContain("Hi anna,");
    expect(msg.textBody).toContain("> can you take this?");
    expect(msg.textBody).toContain("> client is waiting");
    expect(msg.textBody).toContain("Project: Coldwell Banker Heritage");
    expect(msg.textBody).toContain("Priority: high");
    expect(msg.textBody).toContain("Aug 14, 2026");
    expect(msg.textBody).toContain("https://hub.wowvideotours.com/admin#projects?task=task-1");
  });

  it("renders an assignment without a quoted body", () => {
    const msg = formatTaskEmail({
      kind: "assignment",
      task: { ...TASK, priority: "medium", dueDate: null },
      projectName: null,
      actorName: "steve",
      recipientName: "mark",
      config: CONFIG,
      to: "mark@wowvideotours.com",
      env: {},
    });
    expect(msg.subject).toBe('steve assigned you "Re-cut the Montgomery walkthrough"');
    expect(msg.textBody).toContain("steve assigned you");
    expect(msg.textBody).not.toContain(">");
    expect(msg.textBody).not.toContain("Project:");
    // Routine priority is noise; only high/urgent earns a line.
    expect(msg.textBody).not.toContain("Priority:");
    expect(msg.textBody).not.toContain("Due:");
  });
});

describe("notifyTaskPeople", () => {
  it("emails each mentioned person once", async () => {
    const { sent, mailer } = mailerSpy();
    const out = await notifyTaskPeople(
      {
        kind: "mention",
        task: TASK,
        recipientIds: ["u-anna", "u-mark"],
        actor: { id: "u-steve", name: "steve" },
        commentBody: "eyes on this please",
      },
      deps({ mailer }),
    );
    expect(sent.map((m) => m.to)).toEqual(["anna@wowvideotours.com", "mark@wowvideotours.com"]);
    expect(out.every((r) => r.result.ok)).toBe(true);
  });

  it("never emails the person who did it", async () => {
    const { sent, mailer } = mailerSpy();
    await notifyTaskPeople(
      {
        kind: "mention",
        task: TASK,
        recipientIds: ["u-anna"],
        actor: { id: "u-anna", name: "anna" },
        commentBody: "note to self",
      },
      deps({ mailer }),
    );
    expect(sent).toEqual([]);
  });

  it("skips an account with no address instead of failing the batch", async () => {
    const { sent, mailer } = mailerSpy();
    const out = await notifyTaskPeople(
      {
        kind: "assignment",
        task: TASK,
        recipientIds: ["u-noemail", "u-mark"],
        actor: { id: "u-steve", name: "steve" },
      },
      deps({ mailer }),
    );
    expect(sent.map((m) => m.to)).toEqual(["mark@wowvideotours.com"]);
    expect(out.map((r) => r.userId)).toEqual(["u-mark"]);
  });

  it("no-ops when email is unconfigured, without touching the user table", async () => {
    const loadUsers = vi.fn(async () => USERS);
    const out = await notifyTaskPeople(
      {
        kind: "mention",
        task: TASK,
        recipientIds: ["u-anna"],
        actor: { id: "u-steve", name: "steve" },
      },
      deps({ config: null, mailer: null, loadUsers }),
    );
    expect(out).toEqual([]);
    expect(loadUsers).not.toHaveBeenCalled();
  });

  it("reports a send failure without throwing", async () => {
    const { mailer } = mailerSpy({ ok: false, detail: "postmark 422: inactive recipient" });
    const out = await notifyTaskPeople(
      {
        kind: "assignment",
        task: TASK,
        recipientIds: ["u-anna"],
        actor: { id: "u-steve", name: "steve" },
      },
      deps({ mailer }),
    );
    expect(out).toEqual([
      { userId: "u-anna", result: { ok: false, detail: "postmark 422: inactive recipient" } },
    ]);
  });

  it("does not look up a project name for a task with no project", async () => {
    const loadProjectName = vi.fn(async () => "never");
    const { sent, mailer } = mailerSpy();
    await notifyTaskPeople(
      {
        kind: "assignment",
        task: { ...TASK, projectId: null },
        recipientIds: ["u-anna"],
        actor: { id: "u-steve", name: "steve" },
      },
      deps({ mailer, loadProjectName }),
    );
    expect(loadProjectName).not.toHaveBeenCalled();
    expect(sent[0]?.textBody).not.toContain("Project:");
  });
});
