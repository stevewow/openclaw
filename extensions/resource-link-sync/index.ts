import fs from "node:fs/promises";
import path from "node:path";
import {
  listResources,
  resolveResourceFilePath,
  type Resource,
} from "openclaw/plugin-sdk/admin-resources";
import { resolveAgentWorkspaceDir } from "openclaw/plugin-sdk/agent-runtime";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-contracts";
import { definePluginEntry, type OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import {
  isPathInside,
  replaceFileAtomic,
  sanitizeUntrustedFileName,
} from "openclaw/plugin-sdk/security-runtime";

const RESOURCES_DIR = path.join("memory", "resources");
const SYNC_CACHE_FILENAME = ".resource-sync-cache.json";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_CONTENT_BYTES = 512_000;

type SyncCache = Record<string, number>;

type FetchedResource = {
  content: string;
  contentType: "markdown" | "csv" | "text";
};

function parseGoogleDocId(url: string): string | null {
  const match = /\/document\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  return match?.[1] ?? null;
}

function parseGoogleSheetId(url: string): string | null {
  const match = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  return match?.[1] ?? null;
}

function parseGoogleSlidesId(url: string): string | null {
  const match = /\/presentation\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  return match?.[1] ?? null;
}

function buildGoogleExportUrl(
  url: string,
): { exportUrl: string; contentType: FetchedResource["contentType"] } | null {
  const sheetId = parseGoogleSheetId(url);
  if (sheetId) {
    return {
      exportUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`,
      contentType: "csv",
    };
  }
  const docId = parseGoogleDocId(url);
  if (docId) {
    return {
      exportUrl: `https://docs.google.com/document/d/${docId}/export?format=txt`,
      contentType: "text",
    };
  }
  const slidesId = parseGoogleSlidesId(url);
  if (slidesId) {
    return {
      exportUrl: `https://docs.google.com/presentation/d/${slidesId}/export?format=txt`,
      contentType: "text",
    };
  }
  return null;
}

function isGoogleDocsUrl(url: string): boolean {
  return /^https:\/\/docs\.google\.com\//.test(url);
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timerId);
  }
}

async function fetchResourceContent(url: string): Promise<FetchedResource | null> {
  if (isGoogleDocsUrl(url)) {
    const exportInfo = buildGoogleExportUrl(url);
    if (!exportInfo) return null;
    const resp = await fetchWithTimeout(exportInfo.exportUrl, FETCH_TIMEOUT_MS);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    if (buffer.byteLength > MAX_CONTENT_BYTES) return null;
    return { content: new TextDecoder().decode(buffer), contentType: exportInfo.contentType };
  }
  // Generic URL fetch
  const resp = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!resp.ok) return null;
  const buffer = await resp.arrayBuffer();
  if (buffer.byteLength > MAX_CONTENT_BYTES) return null;
  return { content: new TextDecoder().decode(buffer), contentType: "text" };
}

function buildMemoryFileContent(resource: Resource, fetched: FetchedResource): string {
  const syncedAt = new Date().toISOString();
  const typeLabel = fetched.contentType === "csv" ? "CSV" : "Text";
  const header = [
    `# ${resource.title}`,
    "",
    `> Source: ${resource.url}`,
    `> Resource ID: ${resource.id}`,
    `> Format: ${typeLabel}`,
    `> Synced: ${syncedAt}`,
    resource.description ? `> Description: ${resource.description}` : "",
    "",
    "---",
    "",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
  return header + fetched.content.trim() + "\n";
}

function resolveResourceMemoryFilename(resource: Resource): string {
  const safeName = sanitizeUntrustedFileName(resource.title.toLowerCase().replace(/\s+/g, "-"), {
    maxLength: 48,
    fallback: "resource",
  });
  return `${safeName}-${resource.id.slice(0, 8)}.md`;
}

async function readSyncCache(cacheFile: string): Promise<SyncCache> {
  try {
    const raw = await fs.readFile(cacheFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SyncCache;
    }
  } catch {
    // Cache missing or corrupt — treat as empty
  }
  return {};
}

async function writeSyncCache(cacheFile: string, cache: SyncCache): Promise<void> {
  await replaceFileAtomic({
    filePath: cacheFile,
    content: JSON.stringify(cache, null, 2) + "\n",
    tempPrefix: ".resource-sync-cache",
  });
}

async function syncResources(
  config: OpenClawConfig,
  agentId: string,
  logger: OpenClawPluginApi["logger"],
  force = false,
): Promise<{ synced: number; skipped: number; failed: number }> {
  const workspaceDir = resolveAgentWorkspaceDir(config, agentId);
  const resourcesDir = path.join(workspaceDir, RESOURCES_DIR);
  const cacheFile = path.join(resourcesDir, SYNC_CACHE_FILENAME);

  await fs.mkdir(resourcesDir, { recursive: true });

  const cache = force ? {} : await readSyncCache(cacheFile);

  let resources: Resource[];
  try {
    resources = await listResources({ aiAccessOnly: true });
  } catch (err) {
    logger.debug?.(`resource-link-sync: could not list resources: ${String(err)}`);
    return { synced: 0, skipped: 0, failed: 0 };
  }

  const TEXT_MIMETYPES = new Set([
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/html",
    "application/json",
  ]);

  const linkResources = resources.filter((r) => r.type === "link" && r.url);
  const fileResources = resources.filter(
    (r) => r.type === "file" && r.storedFilename && r.mimetype && TEXT_MIMETYPES.has(r.mimetype),
  );

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const resource of linkResources) {
    const cachedUpdatedAt = cache[resource.id];
    if (!force && cachedUpdatedAt !== undefined && cachedUpdatedAt >= resource.updatedAt) {
      skipped++;
      continue;
    }

    const filename = resolveResourceMemoryFilename(resource);
    const filePath = path.join(resourcesDir, filename);

    if (!isPathInside(resourcesDir, filePath)) {
      logger.warn?.(`resource-link-sync: unsafe path for resource ${resource.id}, skipping`);
      failed++;
      continue;
    }

    try {
      const fetched = await fetchResourceContent(resource.url!);
      if (!fetched) {
        logger.debug?.(`resource-link-sync: could not fetch ${resource.url}`);
        failed++;
        continue;
      }
      const fileContent = buildMemoryFileContent(resource, fetched);
      await replaceFileAtomic({ filePath, content: fileContent, tempPrefix: ".resource-sync" });
      cache[resource.id] = resource.updatedAt;
      synced++;
    } catch (err) {
      logger.debug?.(`resource-link-sync: failed to sync ${resource.id}: ${String(err)}`);
      failed++;
    }
  }

  for (const resource of fileResources) {
    const cachedUpdatedAt = cache[resource.id];
    if (!force && cachedUpdatedAt !== undefined && cachedUpdatedAt >= resource.updatedAt) {
      skipped++;
      continue;
    }

    const filename = resolveResourceMemoryFilename(resource);
    const filePath = path.join(resourcesDir, filename);

    if (!isPathInside(resourcesDir, filePath)) {
      logger.warn?.(`resource-link-sync: unsafe path for file resource ${resource.id}, skipping`);
      failed++;
      continue;
    }

    try {
      const storedPath = resolveResourceFilePath(resource.storedFilename!);
      const raw = await fs.readFile(storedPath, "utf8");
      const header = [
        `# ${resource.title}`,
        "",
        `> Resource ID: ${resource.id}`,
        `> Filename: ${resource.filename ?? resource.storedFilename}`,
        `> Format: ${resource.mimetype}`,
        resource.description ? `> Description: ${resource.description}` : null,
        "",
        "---",
        "",
      ]
        .filter((l): l is string => l !== null)
        .join("\n");
      await replaceFileAtomic({
        filePath,
        content: header + raw.trim() + "\n",
        tempPrefix: ".resource-sync",
      });
      cache[resource.id] = resource.updatedAt;
      synced++;
    } catch (err) {
      logger.debug?.(
        `resource-link-sync: failed to sync file resource ${resource.id}: ${String(err)}`,
      );
      failed++;
    }
  }

  if (synced > 0) {
    await writeSyncCache(cacheFile, cache);
  }

  return { synced, skipped, failed };
}

export default definePluginEntry({
  id: "resource-link-sync",
  name: "Resource Link Sync",
  description:
    "Fetches AI-accessible resources (Google Docs, Sheets, web links, and text/CSV files) into agent memory for business knowledge recall",
  register(api) {
    api.on("session_start", async (_event, ctx) => {
      const agentId = ctx.agentId ?? "main";
      try {
        const result = await syncResources(api.config, agentId, api.logger);
        if (result.synced > 0) {
          api.logger.debug?.(
            `resource-link-sync: synced ${result.synced} resource(s) for agent ${agentId}`,
          );
        }
      } catch (err) {
        api.logger.warn?.(`resource-link-sync: session_start sync error: ${String(err)}`);
      }
    });

    api.registerTool(
      (ctx) => ({
        name: "sync_resources",
        label: "Sync Resources",
        description:
          "Fetch all AI-accessible resources (Google Docs, Sheets, URLs, and uploaded text/CSV files) and write their content to agent memory. Call this to refresh resource content or after adding new resources.",
        parameters: {
          type: "object",
          properties: {
            force: {
              type: "boolean",
              description:
                "Re-fetch all resources even if already up to date. Default: only fetch changed resources.",
            },
          },
          additionalProperties: false,
        },
        execute: async (_toolCallId, params) => {
          const force = (params as { force?: boolean }).force === true;
          const result = await syncResources(ctx.config, ctx.agentId ?? "main", api.logger, force);
          const parts = [`Synced ${result.synced} resource(s)`];
          if (result.skipped > 0) parts.push(`${result.skipped} unchanged`);
          if (result.failed > 0) parts.push(`${result.failed} failed`);
          return { ok: true, message: parts.join(", ") + "." };
        },
      }),
      { names: ["sync_resources"] },
    );
  },
});
