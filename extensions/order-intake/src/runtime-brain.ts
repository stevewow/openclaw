// LLM-backed intake brain. Uses the OpenClaw embedded-agent runtime (the same
// seam as the llm-task plugin) for natural-language understanding + phrasing,
// but keeps ALL pricing deterministic: the model never states a dollar amount —
// it maintains the structured draft, and this brain appends the authoritative
// catalog estimate and performs the handoff itself. That preserves the spec
// guardrail "ground every claim in the catalog; estimates, never invented."
//
// NOTE: this file imports the plugin SDK and drives a provider/model, so it can
// only be exercised on a gateway with providers + auth configured. It is NOT
// covered by the local test harness (which uses ScriptedBrain). Verify on the
// deployed gateway before relying on it.

import path from "node:path";
import { resolvePreferredOpenClawTmpDir, withTempWorkspace } from "openclaw/plugin-sdk/temp-path";
import type { OpenClawPluginApi } from "../api.js";
import { runningEstimate, type BrainTurn, type IntakeBrain } from "./brain.js";
import { formatHandoff, type HandoffSender } from "./handoff.js";
import { checkCompleteness, coerceDraft, type OrderDraft } from "./order-draft.js";
import { GREETING, INTAKE_SYSTEM_PROMPT } from "./prompt.js";
import type { IntakeSession } from "./session-store.js";

type LlmTurnResult = { reply: string; draft: OrderDraft; readyToSubmit: boolean };

const TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "draft", "readyToSubmit"],
  properties: {
    reply: {
      type: "string",
      description:
        "Message to show the visitor. Do NOT include any dollar amounts — pricing is appended separately.",
    },
    draft: { type: "object", description: "The full updated OrderDraft object." },
    readyToSubmit: {
      type: "boolean",
      description:
        "True only when the order is complete AND the visitor has agreed to the terms of service.",
    },
  },
} as const;

export type RuntimeBrainOptions = {
  api: OpenClawPluginApi;
  sender: HandoffSender;
  provider?: string;
  model?: string;
  // Named agent to run the embedded LLM turn as. Selects which agent's auth
  // store + identity the model call uses (e.g. "agent-assistant"). When unset,
  // the embedded runtime falls back to the configured default agent ("main").
  agent?: string;
  authProfileId?: string;
  timeoutMs?: number;
};

export class RuntimeBrain implements IntakeBrain {
  readonly kind = "llm";
  constructor(private readonly opts: RuntimeBrainOptions) {}

  greeting(): string {
    return GREETING;
  }

  async respond({
    session,
    message,
  }: {
    session: IntakeSession;
    message: string;
  }): Promise<BrainTurn> {
    const transcript = session.history
      .map((m) => `${m.role === "visitor" ? "VISITOR" : "ASSISTANT"}: ${m.text}`)
      .join("\n");

    const prompt = [
      INTAKE_SYSTEM_PROMPT,
      "",
      "You are mid-conversation. Maintain the structured OrderDraft below and return JSON matching the schema.",
      "Do NOT put any dollar amounts in `reply` — the system appends the authoritative catalog estimate for you.",
      "",
      `CURRENT_DRAFT_JSON:\n${JSON.stringify(session.draft, null, 2)}`,
      "",
      `CONVERSATION_SO_FAR:\n${transcript}`,
      "",
      `LATEST_VISITOR_MESSAGE:\n${message}`,
    ].join("\n");

    const result = await this.runLlm(prompt);
    const parsed = this.coerce(result, session.draft);
    const draft = parsed.draft;

    if (parsed.readyToSubmit && checkCompleteness(draft).complete) {
      const notification = formatHandoff(draft);
      await this.opts.sender.send(notification);
      session.handedOff = true;
      return { reply: parsed.reply + runningEstimate(draft), draft, handoff: notification };
    }
    return { reply: parsed.reply + runningEstimate(draft), draft };
  }

  private async runLlm(prompt: string): Promise<unknown> {
    const api = this.opts.api;
    const defaults = api.config?.agents?.defaults?.model;
    const primary = typeof defaults === "string" ? defaults : defaults?.primary;
    const provider =
      this.opts.provider ?? (typeof primary === "string" ? primary.split("/")[0] : undefined);
    const model =
      this.opts.model ??
      (typeof primary === "string" ? primary.split("/").slice(1).join("/") : undefined);
    if (!provider || !model)
      throw new Error("order-intake RuntimeBrain: provider/model not resolved");

    const runId = `order-intake-${Math.abs(hash(prompt))}`;
    // The embedded runner derives a directory from `sessionFile`, so it must be a
    // real path — omitting it throws `paths[0] ... undefined`. Mirror the llm-task
    // plugin: give the run an isolated temp workspace + session file.
    return await withTempWorkspace(
      { rootDir: resolvePreferredOpenClawTmpDir(), prefix: "openclaw-order-intake-" },
      async ({ dir: tmpDir }) => {
        const runResult = await api.runtime.agent.runEmbeddedPiAgent({
          sessionId: runId,
          sessionFile: path.join(tmpDir, "session.json"),
          runId,
          workspaceDir: api.config?.agents?.defaults?.workspace ?? tmpDir,
          config: api.config,
          agentId: this.opts.agent,
          prompt: `You are a JSON-only function. Return ONLY valid JSON matching this schema: ${JSON.stringify(TURN_SCHEMA)}\n\n${prompt}`,
          provider,
          model,
          authProfileId: this.opts.authProfileId,
          authProfileIdSource: this.opts.authProfileId ? "user" : "auto",
          timeoutMs: this.opts.timeoutMs ?? 45_000,
          disableTools: true,
        });
        const payloads =
          typeof runResult === "object" && runResult !== null && "payloads" in runResult
            ? (runResult as { payloads?: Array<{ text?: string; isError?: boolean }> }).payloads
            : undefined;
        const text = (payloads ?? [])
          .filter((p) => !p.isError && typeof p.text === "string")
          .map((p) => p.text ?? "")
          .join("\n")
          .trim();
        const stripped = text
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        return JSON.parse(stripped);
      },
    );
  }

  private coerce(value: unknown, prev: OrderDraft): LlmTurnResult {
    if (typeof value !== "object" || value === null) {
      return { reply: "Sorry, could you say that another way?", draft: prev, readyToSubmit: false };
    }
    const v = value as Record<string, unknown>;
    const reply = typeof v.reply === "string" ? v.reply : "Could you tell me a bit more?";
    const draft = coerceDraft(v.draft, prev);
    const readyToSubmit = v.readyToSubmit === true;
    return { reply, draft, readyToSubmit };
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
