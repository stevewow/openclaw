import { definePluginEntry, type AnyAgentTool, type OpenClawPluginApi } from "./api.js";
import { ScriptedBrain, type IntakeBrain } from "./src/brain.js";
import { createChatService } from "./src/chat-service.js";
import { StubHandoffSender, type HandoffSender } from "./src/handoff.js";
import { createQuoteTool, createSubmitTool } from "./src/intake-tools.js";
import { InMemorySessionStore } from "./src/session-store.js";

type PluginCfg = {
  basePath?: string;
  brain?: "scripted" | "llm";
  handoffChannel?: "stub" | "slack" | "email";
  provider?: string;
  model?: string;
};

export default definePluginEntry({
  id: "order-intake",
  name: "Order Intake",
  description:
    "Conversational order-intake assistant: embeddable web chat, catalog quoting, and completeness-checked draft handoff (M0).",
  register(api: OpenClawPluginApi) {
    const cfg = (api.pluginConfig ?? {}) as PluginCfg;
    const basePath = (cfg.basePath ?? "/wow-intake").replace(/\/+$/, "") || "/wow-intake";

    // Handoff channel is deferred (Slack vs email). M0 records notifications
    // with a stub sender. Swap in a real HandoffSender when the channel is chosen.
    const sender: HandoffSender = new StubHandoffSender();

    // Tools for an agent-loop brain.
    api.registerTool(createQuoteTool() as unknown as AnyAgentTool, { optional: true });
    api.registerTool(createSubmitTool(sender) as unknown as AnyAgentTool, { optional: true });

    // Web-chat channel. Default brain is the deterministic ScriptedBrain, which
    // works with no LLM configured. Set `brain: "llm"` to use the RuntimeBrain
    // (loaded lazily so this module has no static dependency on the agent runtime).
    const store = new InMemorySessionStore();
    let brain: IntakeBrain = new ScriptedBrain(sender);
    if (cfg.brain === "llm") {
      // Lazy import keeps the SDK-heavy runtime brain out of the load path unless used.
      void import("./src/runtime-brain.js")
        .then(({ RuntimeBrain }) => {
          brain = new RuntimeBrain({ api, sender, provider: cfg.provider, model: cfg.model });
          api.logger.info?.("[order-intake] using LLM RuntimeBrain");
        })
        .catch((err) => {
          api.logger.warn?.(
            `[order-intake] failed to load LLM brain, staying on scripted: ${String(err)}`,
          );
        });
    }

    const service = createChatService({
      store,
      // Indirection so a late-arriving RuntimeBrain (lazy import) is picked up.
      brain: {
        get kind() {
          return brain.kind;
        },
        greeting: () => brain.greeting(),
        respond: (input) => brain.respond(input),
      },
      basePath,
      now: () => Date.now(),
    });

    api.registerHttpRoute({
      path: basePath,
      auth: "plugin",
      match: "prefix",
      replaceExisting: true,
      handler: (req, res) => service.handle(req, res),
    });
    api.logger.info?.(`[order-intake] web chat on ${basePath} (brain: ${brain.kind})`);
  },
});
