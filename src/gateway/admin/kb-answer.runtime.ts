// The one place in the Hub that calls a model.
//
// Its own `.runtime.ts` so the Anthropic SDK is imported only when a question
// is actually asked — every other admin route, and the help center's own
// reading and searching, load nothing from it. kb-answer.ts owns the decisions
// (what may be asked, what the model is shown, what is done with the reply);
// this file owns the call and nothing else.
//
// The model here has no tools, no browsing, no memory of previous questions and
// no access to any store. It sees a fixed instruction, a few article excerpts
// and one question. That is the whole of its world, and it is why a hostile
// question cannot reach anything.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Room for a short answer plus the thinking Claude does before it. Not a cost
 * control — the answer is kept short by the instruction and the schema; this is
 * only here so a reply cannot be truncated mid-sentence.
 */
const MAX_TOKENS = 2048;

const AnswerSchema = z.object({
  /** False when the excerpts do not answer the question. */
  answered: z.boolean(),
  /** The answer in plain language, empty when `answered` is false. */
  answer: z.string(),
  /** Slugs of the articles the answer came from. */
  articleSlugs: z.array(z.string()),
});

export type AnswerModelRequest = {
  apiKey: string;
  model: string;
  system: string;
  userContent: string;
};

export type AnswerModelResult = {
  answered: boolean;
  answer: string;
  articleSlugs: string[];
  inputTokens: number;
  outputTokens: number;
};

/**
 * Ask the model, and return what it said in a shape this codebase controls.
 *
 * A refusal is reported as an ordinary "could not answer" rather than raised.
 * The caller's decline path already says the useful thing — here is the support
 * form — and a client is owed that, not a stack trace.
 */
export async function callAnswerModel(req: AnswerModelRequest): Promise<AnswerModelResult> {
  const client = new Anthropic({ apiKey: req.apiKey });
  const message = await client.messages.parse({
    model: req.model,
    max_tokens: MAX_TOKENS,
    system: req.system,
    messages: [{ role: "user", content: req.userContent }],
    output_config: {
      // The task is extraction from three short excerpts. Low effort keeps the
      // answer prompt rather than thorough, which is the right trade for
      // someone waiting on a help page.
      effort: "low",
      format: zodOutputFormat(AnswerSchema),
    },
  });

  const usage = {
    inputTokens: message.usage?.input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
  };

  const parsed = message.parsed_output;
  if (message.stop_reason === "refusal" || !parsed) {
    return { answered: false, answer: "", articleSlugs: [], ...usage };
  }
  return {
    answered: parsed.answered,
    answer: parsed.answer,
    articleSlugs: parsed.articleSlugs,
    ...usage,
  };
}
