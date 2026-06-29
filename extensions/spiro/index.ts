import type { IncomingMessage, ServerResponse } from "node:http";
import { Type } from "typebox";
import { CALLBACK_PATH } from "./src/oauth.js";

const GATEWAY_URL =
  process.env.SPIRO_GATEWAY_URL?.trim().replace(/\/$/, "") ?? "https://openclaw.wowvideotours.com";

function text(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

let _oauth: typeof import("./src/oauth.js") | undefined;
let _client: typeof import("./src/client.js") | undefined;
const oauth = async () => (_oauth ??= await import("./src/oauth.js"));
const client = async () => (_client ??= await import("./src/client.js"));

export default {
  id: "spiro",
  name: "Spiro CRM",
  description: "Query Spiro CRM — agent rankings, orders, invoices, and contacts.",

  register(api: {
    registerHttpRoute: (opts: {
      path: string;
      auth: string;
      match: string;
      handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
    }) => void;
    registerTool: (
      def: {
        name: string;
        label: string;
        description: string;
        parameters: unknown;
        execute: (id: string, params: unknown) => Promise<unknown>;
      },
      meta: { name: string },
    ) => void;
    registerCommand: (cmd: {
      name: string;
      description: string;
      acceptsArgs: boolean;
      handler: (args: unknown) => Promise<{ text: string }>;
    }) => void;
    logger: { info?: (msg: string) => void; warn?: (msg: string) => void };
  }) {
    api.registerHttpRoute({
      path: CALLBACK_PATH,
      auth: "plugin",
      match: "exact",
      handler: async (req, res) => {
        const proto =
          (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ??
          "https";
        const host =
          (req.headers["x-forwarded-host"] as string | undefined) ??
          req.headers.host ??
          GATEWAY_URL.replace(/^https?:\/\//, "");
        const url = new URL(`${proto}://${host}${req.url ?? CALLBACK_PATH}`);
        try {
          const html = await (await oauth()).handleCallback(url);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html);
        } catch (err) {
          res
            .writeHead(500, { "Content-Type": "text/plain" })
            .end(`Error: ${(err as Error).message}`);
        }
      },
    });

    api.registerTool(
      {
        name: "spiro_list_tools",
        label: "Spiro: List Tools",
        description:
          "List all available Spiro CRM operations (agent rankings, orders, invoices, contacts). " +
          "Call this first before using spiro_call.",
        parameters: Type.Object({}, { additionalProperties: false }),
        execute: async () => {
          const tools = await (await client()).listTools();
          if (tools.length === 0) {
            return text({ message: "No tools found. Run /spiro-auth to connect Spiro." });
          }
          return text(tools.map((t) => ({ name: t.name, description: t.description ?? "" })));
        },
      },
      { name: "spiro_list_tools" },
    );

    api.registerTool(
      {
        name: "spiro_call",
        label: "Spiro: Call Tool",
        description:
          "Call a Spiro CRM tool by name. Use spiro_list_tools first to see available tools. " +
          "Pass filters like date_from, date_to, agent_id, location, status in args.",
        parameters: Type.Object(
          {
            tool_name: Type.String({ description: "Tool name from spiro_list_tools." }),
            args: Type.Optional(
              Type.Record(Type.String(), Type.Unknown(), {
                description: "Filter parameters for the tool.",
              }),
            ),
          },
          { additionalProperties: false },
        ),
        execute: async (_id, raw) => {
          const p =
            raw && typeof raw === "object" && !Array.isArray(raw)
              ? (raw as Record<string, unknown>)
              : {};
          const toolName = typeof p.tool_name === "string" ? p.tool_name : "";
          if (!toolName) return text({ error: "tool_name is required." });
          const args =
            p.args && typeof p.args === "object" && !Array.isArray(p.args)
              ? (p.args as Record<string, unknown>)
              : {};
          const result = await (await client()).callTool(toolName, args);
          return text(result);
        },
      },
      { name: "spiro_call" },
    );

    api.registerCommand({
      name: "spiro-auth",
      description: "Connect your Spiro CRM account via OAuth.",
      acceptsArgs: true,
      handler: async (args) => {
        const base = (typeof args === "string" && args.trim()) || GATEWAY_URL;
        const result = await (await oauth()).startAuth(base);
        if (!result.ok) return { text: `Spiro auth failed: ${result.error}` };

        void result
          .awaitCallback()
          .then(() => api.logger.info?.("spiro: tokens saved"))
          .catch((err: unknown) =>
            api.logger.warn?.(`spiro: callback error — ${(err as Error)?.message ?? err}`),
          );

        return {
          text: [
            "**Connect Spiro CRM**",
            "",
            "Open this URL in your browser and sign in:",
            `${result.authorizeUrl}`,
            "",
            "After you approve access you'll see a success page. Spiro will be ready immediately.",
          ].join("\n"),
        };
      },
    });
  },
};
