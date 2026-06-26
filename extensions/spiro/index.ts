import type { IncomingMessage, ServerResponse } from "node:http";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/provider-web-search";
import { Type } from "typebox";
import { SPIRO_CALLBACK_PATH } from "./src/oauth.js";

let spiroClientModule: typeof import("./src/spiro-client.js") | undefined;
let oauthModule: typeof import("./src/oauth.js") | undefined;

async function loadClient() {
  spiroClientModule ??= await import("./src/spiro-client.js");
  return spiroClientModule;
}

async function loadOAuth() {
  oauthModule ??= await import("./src/oauth.js");
  return oauthModule;
}

// Default public gateway URL — users can override via SPIRO_GATEWAY_URL env var
const DEFAULT_GATEWAY_URL = "https://openclaw.wowvideotours.com";

function resolveCallbackBase(): string {
  return process.env.SPIRO_GATEWAY_URL?.trim().replace(/\/$/, "") ?? DEFAULT_GATEWAY_URL;
}

export default definePluginEntry({
  id: "spiro",
  name: "Spiro CRM",
  description: "Query Spiro CRM data — agent rankings, orders, invoices, and contacts.",

  register(api) {
    // OAuth callback route — auth: "plugin" so the browser redirect reaches it without a token
    api.registerHttpRoute({
      path: SPIRO_CALLBACK_PATH,
      auth: "plugin",
      match: "exact",
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const { handleSpiroOAuthCallback } = await loadOAuth();
        const proto =
          (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ??
          "https";
        const host =
          (req.headers["x-forwarded-host"] as string | undefined) ??
          req.headers.host ??
          resolveCallbackBase().replace(/^https?:\/\//, "");
        const callbackUrl = new URL(`${proto}://${host}${req.url ?? SPIRO_CALLBACK_PATH}`);
        try {
          const html = await handleSpiroOAuthCallback(callbackUrl);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html);
        } catch (err) {
          res
            .writeHead(500, { "Content-Type": "text/plain" })
            .end(`OAuth error: ${(err as Error).message}`);
        }
      },
    });

    api.registerTool(
      {
        name: "spiro_list_tools",
        label: "Spiro: List Available Tools",
        description:
          "List all data operations available from Spiro CRM. Call this first to discover " +
          "what reports and queries are available (agent rankings, orders, invoices, contacts, etc.) " +
          "before calling spiro_call.",
        parameters: Type.Object({}, { additionalProperties: false }),
        execute: async (_toolCallId: string, _params: unknown) => {
          const { listSpiroTools } = await loadClient();
          const tools = await listSpiroTools();
          if (tools.length === 0) {
            return jsonResult({
              message: "No tools found. Make sure Spiro is authenticated — run /spiro-auth.",
            });
          }
          return jsonResult(tools.map((t) => ({ name: t.name, description: t.description ?? "" })));
        },
      },
      { name: "spiro_list_tools" },
    );

    api.registerTool(
      {
        name: "spiro_call",
        label: "Spiro: Call Tool",
        description:
          "Call a Spiro CRM tool by name to retrieve business data. Use spiro_list_tools first " +
          "to discover valid tool names. Examples: agent rankings, order pipeline, invoice status, " +
          "contact lookup. Pass any filters (date range, location, agent, status) in the args object.",
        parameters: Type.Object(
          {
            tool_name: Type.String({
              description: "The Spiro tool name to call, as returned by spiro_list_tools.",
            }),
            args: Type.Optional(
              Type.Record(Type.String(), Type.Unknown(), {
                description:
                  "Parameters for the tool — filters like date_from, date_to, location, agent_id, status, limit, etc.",
              }),
            ),
          },
          { additionalProperties: false },
        ),
        execute: async (_toolCallId: string, rawParams: unknown) => {
          const params =
            rawParams !== null && typeof rawParams === "object" && !Array.isArray(rawParams)
              ? (rawParams as Record<string, unknown>)
              : {};
          const toolName = typeof params.tool_name === "string" ? params.tool_name : "";
          const args =
            params.args !== null && typeof params.args === "object" && !Array.isArray(params.args)
              ? (params.args as Record<string, unknown>)
              : {};

          if (!toolName) {
            return jsonResult({ error: "tool_name is required." });
          }

          const { callSpiroTool } = await loadClient();
          const result = await callSpiroTool(toolName, args);
          return jsonResult(result);
        },
      },
      { name: "spiro_call" },
    );

    api.registerCommand({
      name: "spiro-auth",
      description: "Connect your Spiro CRM account via OAuth browser sign-in.",
      acceptsArgs: true,
      requiredScopes: ["operator.admin"],
      handler: async (args) => {
        const { startSpiroOAuth } = await loadOAuth();
        // Optional first arg overrides the callback base URL
        const callbackBaseUrl = (typeof args === "string" && args.trim()) || resolveCallbackBase();

        const result = await startSpiroOAuth({ callbackBaseUrl });

        if (!result.ok) {
          return { text: `Spiro auth setup failed: ${result.error}` };
        }

        void result
          .awaitCallback()
          .then(() => {
            api.logger.info?.("spiro: OAuth tokens saved successfully");
          })
          .catch((err: unknown) => {
            api.logger.warn?.(
              `spiro: OAuth callback error — ${(err as Error)?.message ?? String(err)}`,
            );
          });

        return {
          text: [
            "**Spiro OAuth — Action required**",
            "",
            "1. Open this URL in your browser:",
            `   ${result.authorizeUrl}`,
            "",
            "2. Sign in to Spiro and approve access.",
            "3. You'll be redirected back automatically — the gateway completes the connection.",
            "",
            "_Waiting up to 5 minutes for the callback…_",
          ].join("\n"),
        };
      },
    });
  },
});
