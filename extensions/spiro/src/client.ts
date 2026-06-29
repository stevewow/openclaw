import { isExpired, loadTokens, saveTokens, SPIRO_MCP_URL, type SpiroTokens } from "./config.js";
import { refreshTokens } from "./oauth.js";

export type McpTool = { name: string; description?: string };

let cached: SpiroTokens | undefined;
let toolCache: McpTool[] | undefined;
let toolCacheAt = 0;
const TOOL_TTL = 5 * 60 * 1000;

async function validTokens(): Promise<SpiroTokens> {
  const tokens = cached ?? loadTokens();
  if (!tokens) throw new Error("Spiro not connected — run /spiro-auth first.");
  if (isExpired(tokens)) {
    const refreshed = await refreshTokens(tokens);
    cached = refreshed;
    return refreshed;
  }
  cached = tokens;
  return tokens;
}

type JsonRpcReply = { result?: unknown; error?: { code: number; message: string } };

let reqId = 1;

async function mcpCall(method: string, params: Record<string, unknown>): Promise<unknown> {
  const tokens = await validTokens();
  const id = reqId++;
  const res = await fetch(SPIRO_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${tokens.access_token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });

  if (res.status === 401) {
    const refreshed = await refreshTokens(tokens);
    cached = refreshed;
    await saveTokens(refreshed);
    return mcpCall(method, params);
  }

  if (!res.ok) throw new Error(`Spiro MCP error ${res.status}: ${await res.text()}`);

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    for (const line of (await res.text()).split("\n")) {
      if (line.startsWith("data: ")) {
        try {
          const msg = JSON.parse(line.slice(6)) as JsonRpcReply;
          if (msg.error) throw new Error(msg.error.message);
          return msg.result;
        } catch {
          // skip non-JSON SSE lines
        }
      }
    }
    throw new Error("Empty SSE response from Spiro MCP.");
  }

  const msg = (await res.json()) as JsonRpcReply;
  if (msg.error) throw new Error(msg.error.message);
  return msg.result;
}

export async function listTools(): Promise<McpTool[]> {
  if (toolCache && Date.now() - toolCacheAt < TOOL_TTL) return toolCache;
  const result = (await mcpCall("tools/list", {})) as { tools?: McpTool[] };
  toolCache = result?.tools ?? [];
  toolCacheAt = Date.now();
  return toolCache;
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  return mcpCall("tools/call", { name, arguments: args });
}
