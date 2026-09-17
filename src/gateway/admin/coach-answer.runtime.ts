// The coach's call to the model, and nothing else.
//
// Its own `.runtime.ts` so the Anthropic SDK loads only when someone actually
// asks something — the Guide page, the ask log and every other admin route pull
// in nothing from here. `coach-answer.ts` owns the decisions; this file owns the
// request.
//
// Two things differ from `kb-answer.runtime.ts`, and both are why this is a
// separate file rather than a widened one:
//
//   * the guide is sent as its own cached system block. It is ~16k tokens that
//     change only when someone edits the guide, and every question pays for it
//     otherwise. `cache_control` is what makes a second question cheap.
//   * the conversation is multi-turn. The help center is deliberately
//     single-turn because it answers anonymous strangers; this answers signed-in
//     staff, where "now make that shorter" is most of the value.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/** Room for an email draft plus the thinking before it. */
const MAX_TOKENS = 4096;

/**
 * An hour, not the five-minute default.
 *
 * A salesperson works a call list in bursts: a question, three minutes of
 * talking, another question. Five minutes would miss most of those and re-bill
 * the whole guide each time.
 */
const CACHE_TTL = "1h" as const;

const CoachReplySchema = z.object({
  /** False when the guide does not cover what was asked. */
  answered: z.boolean(),
  /** Markdown. Empty when `answered` is false. */
  answer: z.string(),
  /** Ids of the guide sections the answer came from. */
  sectionIds: z.array(z.string()),
});

export type CoachTurn = { question: string; answer: string | null };

export type CoachModelRequest = {
  apiKey: string;
  model: string;
  /** The fixed instruction. Sent first so the cached block below it is stable. */
  instruction: string;
  /** The whole guide. Cached. */
  corpus: string;
  history: CoachTurn[];
  question: string;
};

export type CoachModelResult = {
  answered: boolean;
  answer: string;
  sectionIds: string[];
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
};

export async function callCoachModel(req: CoachModelRequest): Promise<CoachModelResult> {
  const client = new Anthropic({ apiKey: req.apiKey });
  const messages: Anthropic.MessageParam[] = [];
  for (const turn of req.history) {
    messages.push({ role: "user", content: turn.question });
    if (turn.answer) {
      messages.push({ role: "assistant", content: turn.answer });
    }
  }
  messages.push({ role: "user", content: req.question });

  const message = await client.messages.parse({
    model: req.model,
    max_tokens: MAX_TOKENS,
    system: [
      { type: "text", text: req.instruction },
      {
        type: "text",
        text: req.corpus,
        cache_control: { type: "ephemeral", ttl: CACHE_TTL },
      },
    ],
    messages,
    output_config: {
      // Higher than the help center's "low": that one extracts a sentence from
      // three excerpts, this one picks the right product out of thirty-seven
      // and writes the email.
      effort: "medium",
      format: zodOutputFormat(CoachReplySchema),
    },
  });

  const usage = {
    inputTokens: message.usage?.input_tokens ?? 0,
    cachedTokens: message.usage?.cache_read_input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
  };

  const parsed = message.parsed_output;
  if (message.stop_reason === "refusal" || !parsed) {
    return { answered: false, answer: "", sectionIds: [], ...usage };
  }
  return {
    answered: parsed.answered,
    answer: parsed.answer,
    sectionIds: parsed.sectionIds,
    ...usage,
  };
}
