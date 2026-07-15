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
import { catalogReference, priceSnapshot } from "./catalog-prompt.js";
import { formatHandoff, type HandoffSender } from "./handoff.js";
import { checkCompleteness, coerceDraft, type OrderDraft } from "./order-draft.js";
import { GREETING, INTAKE_SYSTEM_PROMPT } from "./prompt.js";
import type { IntakeSession } from "./session-store.js";

type LlmTurnResult = { reply: string; draft: OrderDraft; readyToSubmit: boolean };

// A structured draft schema (not a bare object) so the model reliably writes
// the extracted facts into the fields the estimator and completeness check read
// — especially service ids and squareFeet, which gate all pricing. A bare
// `{type:"object"}` leaves the model free to narrate a selection in `reply`
// without ever committing it to the draft, so no price is computed. Unions are
// flattened to enums (some providers reject `anyOf`).
const CONTACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    firstName: { type: "string" },
    lastName: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    companyName: { type: "string" },
  },
} as const;

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  description:
    "The full updated OrderDraft. Echo every fact already captured and add the new ones from this turn.",
  properties: {
    service: {
      type: "object",
      additionalProperties: false,
      description: "The visitor's selection, as catalog ids. Set as soon as they choose.",
      properties: {
        bundleId: {
          type: "string",
          description: "One bundle id from the catalog, if they chose a bundle.",
        },
        singleServiceIds: {
          type: "array",
          items: { type: "string" },
          description: "Individual service ids, if they chose services instead of a bundle.",
        },
      },
    },
    property: {
      type: "object",
      additionalProperties: false,
      properties: {
        address: { type: "string" },
        unitNumber: { type: "string" },
        listingPrice: { type: "number" },
        squareFeet: {
          type: "number",
          description: "Gates all pricing — record it the moment they say it.",
        },
        vacancy: { type: "string", enum: ["vacant", "occupied"] },
        basement: { type: "string", enum: ["shoot", "skip", "none"] },
        garageInterior: { type: "string", enum: ["shoot", "skip", "none"] },
      },
    },
    addOns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          quantity: {
            type: "number",
            description: "For per-image add-ons (Twilight, Virtual Staging, Green Grass).",
          },
        },
        required: ["id"],
      },
    },
    agent: CONTACT_SCHEMA,
    homeowner: CONTACT_SCHEMA,
    coAgent: CONTACT_SCHEMA,
    customAnswers: {
      type: "object",
      additionalProperties: { type: "string" },
      properties: { appointmentInfoAndFilmingInstructions: { type: "string" } },
    },
    entry: {
      type: "object",
      additionalProperties: false,
      properties: { method: { type: "string" }, notes: { type: "string" } },
    },
    scheduling: {
      type: "object",
      additionalProperties: false,
      description: "Preference only — never a committed time.",
      properties: {
        kind: { type: "string", enum: ["asap", "datetime", "window"] },
        when: { type: "string" },
        window: { type: "string" },
      },
    },
    termsAgreed: { type: "boolean" },
  },
} as const;

const TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "draft", "readyToSubmit"],
  properties: {
    reply: {
      type: "string",
      description:
        "Message to show the visitor. You MAY state exact figures that appear in the LIVE PRICE SNAPSHOT in the prompt, always as estimates; never invent a number that is not there. Do not restate the final total for the current selection — the system appends the authoritative estimate line for you.",
    },
    draft: DRAFT_SCHEMA,
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

    const sqft = session.draft.property.squareFeet;
    const prompt = [
      INTAKE_SYSTEM_PROMPT,
      "",
      catalogReference(),
      "",
      sqft != null
        ? priceSnapshot(sqft)
        : "# PRICE SNAPSHOT: not available yet — you don't know the square footage. Ask for it before quoting any price; nearly every price is square-footage-tiered.",
      "",
      "You are mid-conversation. Maintain the structured OrderDraft below and return JSON matching the schema.",
      "- Write EVERY fact the visitor gives into the draft the moment they say it — do not wait until you have everything. If they name a bundle/service, set draft.service THIS turn; if they state square footage, set draft.property.squareFeet THIS turn. Narrating a selection in `reply` without putting it in the draft means no price gets computed.",
      "Pricing rules:",
      "- Fill draft.service.bundleId / draft.service.singleServiceIds / draft.addOns using ONLY the catalog ids above, so the system can price the order.",
      "- You MAY quote exact figures from the LIVE PRICE SNAPSHOT above; NEVER state a dollar amount that is not in it. If there is no snapshot yet, do not quote — ask for square footage first.",
      "- After your message the system automatically appends the authoritative estimate line for the current selection, so don't restate the final total — just help them choose.",
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
