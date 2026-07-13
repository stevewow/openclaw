import { describe, expect, it, vi } from "vitest";
import { formatHandoff } from "./handoff.js";
import type { OrderDraft } from "./order-draft.js";
import { SlackHandoffSender, resolveSlackTransport } from "./slack-handoff.js";

function completeDraft(): OrderDraft {
  return {
    service: { bundleId: "wow-essentials" },
    property: {
      address: "850 E Dorothy Ln, Kettering OH 45419",
      listingPrice: 425000,
      squareFeet: 2400,
      vacancy: "occupied",
    },
    addOns: [],
    agent: {
      firstName: "Wendy",
      lastName: "Klawon",
      phone: "(555) 123-4567",
      email: "wendy@example.com",
      companyName: "Coldwell Banker Heritage",
    },
    customAnswers: { appointmentInfoAndFilmingInstructions: "Highlight the kitchen." },
    entry: { method: "lockbox" },
    scheduling: { kind: "asap" },
    termsAgreed: true,
  };
}

function okResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

describe("resolveSlackTransport", () => {
  it("prefers a config webhook url", () => {
    const t = resolveSlackTransport({ webhookUrl: " https://hooks.slack.com/x " }, {});
    expect(t).toEqual({ kind: "webhook", webhookUrl: "https://hooks.slack.com/x" });
  });

  it("falls back to env webhook url", () => {
    const t = resolveSlackTransport(undefined, {
      ORDER_INTAKE_SLACK_WEBHOOK_URL: "https://hooks.slack.com/e",
    });
    expect(t).toEqual({ kind: "webhook", webhookUrl: "https://hooks.slack.com/e" });
  });

  it("resolves a bot transport when token + channel present, no webhook", () => {
    const t = resolveSlackTransport({ botToken: "xoxb-1", channel: "#orders" }, {});
    expect(t).toEqual({ kind: "bot", botToken: "xoxb-1", channel: "#orders" });
  });

  it("returns null when nothing is configured", () => {
    expect(resolveSlackTransport({}, {})).toBeNull();
    expect(resolveSlackTransport({ botToken: "xoxb-1" }, {})).toBeNull(); // channel missing
  });
});

describe("SlackHandoffSender", () => {
  it("delivers to an incoming webhook and posts blocks + summary text", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return okResponse("ok");
    }) as unknown as typeof fetch;

    const sender = new SlackHandoffSender({
      transport: { kind: "webhook", webhookUrl: "https://hooks.slack.com/xyz" },
      fetchImpl,
    });
    const result = await sender.send(formatHandoff(completeDraft()));

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://hooks.slack.com/xyz");
    const body = calls[0].body as { text: string; blocks: unknown[] };
    expect(body.text).toContain("NEW ORDER DRAFT");
    expect(Array.isArray(body.blocks)).toBe(true);
    // Aligned draft text is preserved in a code block for the team.
    expect(JSON.stringify(body.blocks)).toContain("```");
    expect(JSON.stringify(body.blocks)).toContain("$275");
  });

  it("reports failure AND logs the full draft when the webhook is unhealthy", async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse("invalid_payload", 400),
    ) as unknown as typeof fetch;
    const error = vi.fn();
    const sender = new SlackHandoffSender({
      transport: { kind: "webhook", webhookUrl: "https://hooks.slack.com/bad" },
      fetchImpl,
      logger: { error },
    });
    const result = await sender.send(formatHandoff(completeDraft()));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain("400");
    // Lead is not lost: full draft text logged for recovery.
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toContain("NEW ORDER DRAFT");
  });

  it("recovers (logs) when fetch throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const warn = vi.fn();
    const sender = new SlackHandoffSender({
      transport: { kind: "webhook", webhookUrl: "https://hooks.slack.com/x" },
      fetchImpl,
      logger: { warn },
    });
    const result = await sender.send(formatHandoff(completeDraft()));
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("network down");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("uses chat.postMessage with a Bearer token for the bot transport", async () => {
    let auth: string | undefined;
    let sentChannel: string | undefined;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://slack.com/api/chat.postMessage");
      auth = (init?.headers as Record<string, string>).Authorization;
      sentChannel = JSON.parse(String(init?.body)).channel;
      return okResponse(JSON.stringify({ ok: true }));
    }) as unknown as typeof fetch;

    const sender = new SlackHandoffSender({
      transport: { kind: "bot", botToken: "xoxb-secret", channel: "#new-orders" },
      fetchImpl,
    });
    const result = await sender.send(formatHandoff(completeDraft()));

    expect(result.ok).toBe(true);
    expect(auth).toBe("Bearer xoxb-secret");
    expect(sentChannel).toBe("#new-orders");
  });

  it("surfaces a chat.postMessage API error", async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse(JSON.stringify({ ok: false, error: "channel_not_found" })),
    ) as unknown as typeof fetch;
    const sender = new SlackHandoffSender({
      transport: { kind: "bot", botToken: "xoxb", channel: "#nope" },
      fetchImpl,
      logger: {},
    });
    const result = await sender.send(formatHandoff(completeDraft()));
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("channel_not_found");
  });
});
