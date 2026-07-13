// Slack handoff sender: delivers a completed order-draft notification to a
// private team Slack channel. Two transports, in priority order:
//   1. Incoming webhook  — POST the message to a Slack webhook URL (simplest;
//      no bot user, no OAuth scopes, one secret).
//   2. Bot token + channel — POST to chat.postMessage with a Bearer token.
//
// This file has NO platform/SDK imports and no third-party deps (uses global
// fetch), so it stays inside the plugin boundary and is unit-testable with an
// injected fetch. It NEVER silently drops a lead: if delivery fails it logs the
// full notification text at error level so the order is still recoverable.

import type { HandoffNotification, HandoffSender } from "./handoff.js";

export type SlackTransport =
  | { kind: "webhook"; webhookUrl: string }
  | { kind: "bot"; botToken: string; channel: string };

type Logger = {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
};

export type SlackHandoffOptions = {
  transport: SlackTransport;
  // Injected for tests; defaults to global fetch.
  fetchImpl?: typeof fetch;
  logger?: Logger;
  timeoutMs?: number;
};

// Resolve a transport from plugin config + env, or null if nothing configured.
// Precedence: explicit webhook (config > env), then bot token + channel.
export function resolveSlackTransport(
  cfg: { webhookUrl?: string; botToken?: string; channel?: string } | undefined,
  env: Record<string, string | undefined> = process.env,
): SlackTransport | null {
  const webhookUrl = cfg?.webhookUrl ?? env.ORDER_INTAKE_SLACK_WEBHOOK_URL;
  if (webhookUrl && webhookUrl.trim()) return { kind: "webhook", webhookUrl: webhookUrl.trim() };
  const botToken = cfg?.botToken ?? env.ORDER_INTAKE_SLACK_BOT_TOKEN;
  const channel = cfg?.channel ?? env.ORDER_INTAKE_SLACK_CHANNEL;
  if (botToken && botToken.trim() && channel && channel.trim()) {
    return { kind: "bot", botToken: botToken.trim(), channel: channel.trim() };
  }
  return null;
}

// A short one-line summary for the notification/fallback text (shown in Slack
// push notifications and clients that don't render blocks).
function summaryLine(n: HandoffNotification): string {
  const head = n.text.split("\n", 1)[0] ?? "New order draft";
  const status = n.complete ? "complete" : "missing info";
  return `${head} — ${status}`;
}

// Build a Slack Block Kit payload. The aligned notification text goes in a code
// block so its columns survive; flags/escalations are surfaced as context.
function buildBlocks(n: HandoffNotification): unknown[] {
  const chips: string[] = [];
  chips.push(n.complete ? ":white_check_mark: complete" : ":warning: missing info");
  if (n.escalations.length) chips.push(":triangular_flag_on_post: quote pending");

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: ":movie_camera: New order draft", emoji: true },
    },
    { type: "section", text: { type: "mrkdwn", text: "```" + n.text + "```" } },
    { type: "context", elements: [{ type: "mrkdwn", text: chips.join("  ·  ") }] },
  ];
  return blocks;
}

export class SlackHandoffSender implements HandoffSender {
  readonly channel = "slack";
  private readonly fetchImpl: typeof fetch;
  private readonly log: Logger;

  constructor(private readonly opts: SlackHandoffOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.log = opts.logger ?? {};
  }

  async send(notification: HandoffNotification): Promise<{ ok: boolean; detail?: string }> {
    try {
      const result =
        this.opts.transport.kind === "webhook"
          ? await this.sendWebhook(this.opts.transport.webhookUrl, notification)
          : await this.sendBot(this.opts.transport, notification);
      if (!result.ok) this.recover(notification, result.detail);
      return result;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.recover(notification, detail);
      return { ok: false, detail };
    }
  }

  // Ensure a failed handoff is never lost: log the full draft at error level.
  private recover(notification: HandoffNotification, detail?: string): void {
    (this.log.error ?? this.log.warn ?? (() => {}))(
      `[order-intake] Slack handoff FAILED (${detail ?? "unknown"}). Unsent order draft below so it is not lost:\n${notification.text}`,
    );
  }

  private async withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const ms = this.opts.timeoutMs ?? 10_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  private async sendWebhook(
    url: string,
    notification: HandoffNotification,
  ): Promise<{ ok: boolean; detail?: string }> {
    const res = await this.withTimeout((signal) =>
      this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: summaryLine(notification),
          blocks: buildBlocks(notification),
        }),
        signal,
      }),
    );
    // Slack incoming webhooks return HTTP 200 with body "ok" on success.
    const body = await res.text().catch(() => "");
    if (res.ok && body.trim().toLowerCase() === "ok")
      return { ok: true, detail: "webhook delivered" };
    return {
      ok: false,
      detail: `webhook responded ${res.status}: ${body.slice(0, 200) || "(no body)"}`,
    };
  }

  private async sendBot(
    transport: { botToken: string; channel: string },
    notification: HandoffNotification,
  ): Promise<{ ok: boolean; detail?: string }> {
    const res = await this.withTimeout((signal) =>
      this.fetchImpl("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${transport.botToken}`,
        },
        body: JSON.stringify({
          channel: transport.channel,
          text: summaryLine(notification),
          blocks: buildBlocks(notification),
        }),
        signal,
      }),
    );
    // chat.postMessage always returns HTTP 200 with a JSON { ok, error? } body.
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (json?.ok) return { ok: true, detail: "chat.postMessage delivered" };
    return { ok: false, detail: `chat.postMessage error: ${json?.error ?? `http ${res.status}`}` };
  }
}
