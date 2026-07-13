// Public barrel for the order-intake plugin. Core/tests consume the intake
// surface through here rather than deep-importing src/**.
export {
  definePluginEntry,
  type AnyAgentTool,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/plugin-entry";

export { INTAKE_SYSTEM_PROMPT } from "./src/prompt.js";
export { quote, type QuoteRequest, type QuoteResult } from "./src/estimator.js";
export {
  checkCompleteness,
  toQuoteRequest,
  type OrderDraft,
  type CompletenessResult,
} from "./src/order-draft.js";
export {
  formatHandoff,
  handoff,
  StubHandoffSender,
  type HandoffSender,
  type HandoffNotification,
} from "./src/handoff.js";
export {
  SlackHandoffSender,
  resolveSlackTransport,
  type SlackHandoffOptions,
  type SlackTransport,
} from "./src/slack-handoff.js";
export { BUNDLES, SERVICES, TIER_SETS, TRIP_FEES } from "./src/catalog.js";
export {
  InMemorySessionStore,
  type IntakeSession,
  type SessionStore,
  emptyDraft,
} from "./src/session-store.js";
export { ScriptedBrain, type IntakeBrain, type BrainTurn, runningEstimate } from "./src/brain.js";
export { createChatService, type ChatServiceOptions } from "./src/chat-service.js";
export { chatPageHtml, embedJs } from "./src/widget.js";
