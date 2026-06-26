import {
  loadSpiroTokens,
  saveSpiroTokens,
  tokenIsExpired,
  SPIRO_MCP_URL,
  type SpiroTokens,
} from "./config.js";
import { refreshSpiroTokens } from "./oauth.js";

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

type JsonRpcResponse = {
  result?: unknown;
  error?: { code: number; message: string };
};

let cachedTokens: SpiroTokens | undefined;
let toolListCache: McpTool[] | undefined;
let toolListCachedAt = 0;
const TOOL_CACHE_TTL_MS = 5 * 60 * 1000;

async function getValidTokens(): Promise<SpiroTokens> {
  const tokens = cachedTokens ?? loadSpiroTokens();
  if (!tokens) {
    throw new Error(
      "Spiro is not authenticated. Run /spiro-auth in chat to connect your Spiro account.",
    );
  }
  if (tokenIsExpired(tokens)) {
    const refreshed = await refreshSpiroTokens(tokens);
    cachedTokens = refreshed;
    return refreshed;
  }
  cachedTokens = tokens;
  return tokens;
}

let mcpRequestId = 1;

async function mcpPost(
  method: string,
  params: Record<string, unknown>,
  tokens: SpiroTokens,
): Promise<unknown> {
  const id = mcpRequestId++;
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
    const refreshed = await refreshSpiroTokens(tokens);
    cachedTokens = refreshed;
    await saveSpiroTokens(refreshed);
    return mcpPost(method, params, refreshed);
  }

  if (!res.ok) {
    throw new Error(`Spiro MCP error: ${res.status} ${await res.text()}`);
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (line.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(line.slice(6)) as JsonRpcResponse;
          if (parsed.error) {
            throw new Error(`Spiro MCP error: ${parsed.error.message}`);
          }
          return parsed.result;
        } catch {
          // skip non-JSON SSE lines
        }
      }
    }
    throw new Error("Spiro MCP returned an empty SSE stream.");
  }

  const json = (await res.json()) as JsonRpcResponse;
  if (json.error) {
    throw new Error(`Spiro MCP error: ${json.error.message}`);
  }
  return json.result;
}

export async function listSpiroTools(): Promise<McpTool[]> {
  const now = Date.now();
  if (toolListCache && now - toolListCachedAt < TOOL_CACHE_TTL_MS) {
    return toolListCache;
  }
  const tokens = await getValidTokens();
  const result = (await mcpPost("tools/list", {}, tokens)) as { tools?: McpTool[] };
  const tools = result?.tools ?? [];
  toolListCache = tools;
  toolListCachedAt = now;
  return tools;
}

export async function callSpiroTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tokens = await getValidTokens();
  const result = await mcpPost("tools/call", { name: toolName, arguments: args }, tokens);
  return result;
}
