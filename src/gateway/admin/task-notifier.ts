import { adminBaseUrl, BRAND_NAME } from "./brand.js";
import { getProject, type Task } from "./project-store.js";
import {
  type EmailConfig,
  type FetchLike,
  type OutboundEmail,
  PostmarkMailer,
  readEmailConfig,
  type SendResult,
  type TicketMailer,
} from "./ticket-mailer.js";
import { listUsers } from "./user-store.js";

/**
 * Email for the two things that pull someone into a task they weren't watching:
 * being @mentioned in a comment, and being put on it.
 *
 * Reuses the ticket mailer's Postmark transport and config — same token, same
 * from-address, same never-throws contract. What differs is the reply path: a
 * ticket reply routes back through a +token address, while these are one-way,
 * so replies land on the from-address and the body points at the dashboard.
 */

// Lives in brand.js so the ticket mailers can resolve it without importing this
// module, which imports them. Re-exported because this is where the links that
// use it are built.
export { adminBaseUrl };

/** Deep link that opens the task's modal on the Projects page. */
export function taskUrl(taskId: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${adminBaseUrl(env)}/admin#projects?task=${encodeURIComponent(taskId)}`;
}

/**
 * Who is newly on the list. An edited comment re-parses every mention it still
 * contains, and a task update re-sends the whole assignee array, so without this
 * the same person would be emailed again for a typo fix or an unrelated field
 * change. Order is preserved so the email reads the way the comment does.
 */
export function newlyAdded(before: readonly string[], after: readonly string[]): string[] {
  const had = new Set(before);
  const seen = new Set<string>();
  return after.filter((id) => {
    if (had.has(id) || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

export type TaskNotifyKind = "mention" | "assignment";

export type TaskEmailParams = {
  kind: TaskNotifyKind;
  task: Pick<Task, "id" | "title" | "dueDate" | "priority">;
  projectName: string | null;
  /** Who did it — never the recipient; self-actions are filtered before here. */
  actorName: string;
  recipientName: string;
  /** The comment that carried the mention. Absent for assignments. */
  commentBody?: string | null;
  config: EmailConfig;
  to: string;
  env?: NodeJS.ProcessEnv;
};

function dueLine(dueDate: number | null): string | null {
  if (dueDate === null) {
    return null;
  }
  return `Due: ${new Date(dueDate).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

/** Pure: render the notification. Kept separate from sending so it is testable. */
export function formatTaskEmail(params: TaskEmailParams): OutboundEmail {
  const { kind, task, actorName, recipientName, projectName } = params;
  const where = projectName ? ` in ${projectName}` : "";
  const lines: string[] = [];

  lines.push(`Hi ${recipientName},`);
  lines.push("");
  lines.push(
    kind === "mention"
      ? `${actorName} mentioned you in a comment on "${task.title}"${where}.`
      : `${actorName} assigned you to "${task.title}"${where}.`,
  );
  lines.push("");

  if (kind === "mention" && params.commentBody) {
    // Quoted so a long comment still reads as someone else's words.
    for (const line of params.commentBody.split("\n")) {
      lines.push(`> ${line}`);
    }
    lines.push("");
  }

  const facts: string[] = [];
  if (projectName) {
    facts.push(`Project: ${projectName}`);
  }
  if (task.priority === "high" || task.priority === "urgent") {
    facts.push(`Priority: ${task.priority}`);
  }
  const due = dueLine(task.dueDate);
  if (due) {
    facts.push(due);
  }
  if (facts.length) {
    lines.push(...facts);
    lines.push("");
  }

  lines.push(`Open this task: ${taskUrl(task.id, params.env)}`);
  lines.push("");
  lines.push("—");
  lines.push(`You're getting this because you were named on a task in ${BRAND_NAME}.`);

  return {
    to: params.to,
    from: params.config.from,
    // One-way: there is no inbound parser for task mail, so a reply should reach
    // a human on the from-address rather than bouncing off a +token nobody reads.
    replyTo: params.config.from,
    subject:
      kind === "mention"
        ? `${actorName} mentioned you on "${task.title}"`
        : `${actorName} assigned you "${task.title}"`,
    textBody: lines.join("\n"),
  };
}

export type TaskNotifyDeps = {
  config?: EmailConfig | null;
  mailer?: TicketMailer | null;
  logger?: { info: (m: string) => void; error: (m: string) => void };
  env?: NodeJS.ProcessEnv;
  /** Injected for tests; production reads the admin user table. */
  loadUsers?: () => Promise<Array<{ id: string; username: string; email: string | null }>>;
  loadProjectName?: (projectId: string) => Promise<string | null>;
  fetchImpl?: FetchLike;
};

export type TaskNotifyInput = {
  kind: TaskNotifyKind;
  task: Pick<Task, "id" | "title" | "dueDate" | "priority" | "projectId">;
  /** User ids to reach. Already narrowed to the newly-added ones. */
  recipientIds: readonly string[];
  actor: { id: string; name: string };
  commentBody?: string | null;
};

/**
 * Email everyone newly named on a task. Never throws and never blocks the write
 * that triggered it — a dead mail provider must not fail someone's comment.
 * Returns one result per attempted recipient, which is what the tests assert on.
 */
export async function notifyTaskPeople(
  input: TaskNotifyInput,
  deps: TaskNotifyDeps = {},
): Promise<Array<{ userId: string; result: SendResult }>> {
  const log = deps.logger ?? {
    info: (m: string) => console.log(`[tasks] ${m}`),
    error: (m: string) => console.error(`[tasks] ${m}`),
  };
  // Someone naming themselves in their own comment, or picking themselves off
  // the assignee list, does not need to be told about it.
  const targets = Array.from(new Set(input.recipientIds)).filter((id) => id !== input.actor.id);
  if (!targets.length) {
    return [];
  }

  const config = deps.config !== undefined ? deps.config : readEmailConfig(deps.env);
  const mailer =
    deps.mailer !== undefined
      ? deps.mailer
      : config
        ? new PostmarkMailer(config, deps.fetchImpl ?? fetch)
        : null;
  if (!config || !mailer) {
    log.info(`email not configured — ${input.kind} on task ${input.task.id} not sent`);
    return [];
  }

  const users = await (deps.loadUsers ?? listUsers)();
  const byId = new Map(users.map((u) => [u.id, u]));
  const projectName = input.task.projectId
    ? await (deps.loadProjectName ?? defaultProjectName)(input.task.projectId)
    : null;

  const out: Array<{ userId: string; result: SendResult }> = [];
  for (const userId of targets) {
    const user = byId.get(userId);
    // An account with no address on file is a silent skip: the mention still
    // shows in the feed, there is simply nowhere to send it.
    if (!user?.email) {
      log.info(`no email on file for ${userId} — ${input.kind} on task ${input.task.id} skipped`);
      continue;
    }
    const msg = formatTaskEmail({
      kind: input.kind,
      task: input.task,
      projectName,
      actorName: input.actor.name,
      recipientName: user.username,
      commentBody: input.commentBody,
      config,
      to: user.email,
      env: deps.env,
    });
    const result = await mailer.send(msg);
    if (!result.ok) {
      log.error(`${input.kind} email to ${user.email} failed: ${result.detail ?? "unknown"}`);
    }
    out.push({ userId, result });
  }
  return out;
}

async function defaultProjectName(projectId: string): Promise<string | null> {
  const project = await getProject(projectId);
  return project?.title ?? null;
}
