import { resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { getHealthSnapshot, type HealthSummary } from "../../commands/health.js";
import { createConfigIO, getRuntimeConfig } from "../../config/io.js";
import { STATE_DIR } from "../../config/paths.js";
import { resolveMainSessionKey } from "../../config/sessions.js";
import { listSystemPresence } from "../../infra/system-presence.js";
import { getUpdateAvailable } from "../../infra/update-startup.js";
import { buildAgentMainSessionKey, normalizeMainKey } from "../../routing/session-key.js";
import { portalUserSessionPrefix } from "../admin/portal-session-scope.js";
import { resolveGatewayAuth } from "../auth.js";
import type { Snapshot } from "../protocol/index.js";
import type { ChannelRuntimeSnapshot } from "../server-channel-runtime.types.js";
import type { GatewayEventLoopHealth } from "./event-loop-health.js";

let presenceVersion = 1;
let healthVersion = 1;
let healthCache: HealthSummary | null = null;
let healthRefresh: Promise<HealthSummary> | null = null;
let sensitiveHealthRefresh: Promise<HealthSummary> | null = null;
let broadcastHealthUpdate: ((snap: HealthSummary) => void) | null = null;

export function buildGatewaySnapshot(opts?: {
  includeSensitive?: boolean;
  portalUserId?: string;
}): Snapshot {
  const cfg = getRuntimeConfig();
  const defaultAgentId = resolveDefaultAgentId(cfg);
  // Portal users share one gateway credential, so give each a distinct default
  // session key (`agent:<id>:u-<userId>`) to isolate their web chat. The gateway
  // also filters sessions.list to this namespace (see portal-session-scope.ts).
  const mainKey = opts?.portalUserId
    ? portalUserSessionPrefix(opts.portalUserId)
    : normalizeMainKey(cfg.session?.mainKey);
  const mainSessionKey = opts?.portalUserId
    ? buildAgentMainSessionKey({ agentId: defaultAgentId, mainKey })
    : resolveMainSessionKey(cfg);
  const scope = cfg.session?.scope ?? "per-sender";
  const presence = listSystemPresence();
  const uptimeMs = Math.round(process.uptime() * 1000);
  const updateAvailable = getUpdateAvailable() ?? undefined;
  // Health is async; caller should await getHealthSnapshot and replace later if needed.
  const emptyHealth: unknown = {};
  const snapshot: Snapshot = {
    presence,
    health: emptyHealth,
    stateVersion: { presence: presenceVersion, health: healthVersion },
    uptimeMs,
    sessionDefaults: {
      defaultAgentId,
      mainKey,
      mainSessionKey,
      scope,
    },
    updateAvailable,
  };
  if (opts?.includeSensitive === true) {
    const auth = resolveGatewayAuth({ authConfig: cfg.gateway?.auth, env: process.env });
    // Surface resolved paths only to admin callers that already have broader gateway access.
    snapshot.configPath = createConfigIO().configPath;
    snapshot.stateDir = STATE_DIR;
    snapshot.authMode = auth.mode;
  }
  return snapshot;
}

export function getHealthCache(): HealthSummary | null {
  return healthCache;
}

export function getHealthVersion(): number {
  return healthVersion;
}

export function incrementPresenceVersion(): number {
  presenceVersion += 1;
  return presenceVersion;
}

export function getPresenceVersion(): number {
  return presenceVersion;
}

export function setBroadcastHealthUpdate(fn: ((snap: HealthSummary) => void) | null) {
  broadcastHealthUpdate = fn;
}

export async function refreshGatewayHealthSnapshot(opts?: {
  probe?: boolean;
  includeSensitive?: boolean;
  getRuntimeSnapshot?: () => ChannelRuntimeSnapshot;
  getEventLoopHealth?: () => GatewayEventLoopHealth | undefined;
}) {
  const includeSensitive = opts?.includeSensitive === true;
  let refresh = includeSensitive ? sensitiveHealthRefresh : healthRefresh;
  if (!refresh) {
    refresh = (async () => {
      let runtimeSnapshot: ChannelRuntimeSnapshot | undefined;
      try {
        runtimeSnapshot = opts?.getRuntimeSnapshot?.();
      } catch {
        runtimeSnapshot = undefined;
      }
      const eventLoop = opts?.getEventLoopHealth?.();
      const snap = await getHealthSnapshot({
        probe: opts?.probe,
        includeSensitive,
        runtimeSnapshot,
        ...(eventLoop ? { eventLoop } : {}),
      });
      if (!includeSensitive) {
        healthCache = snap;
        healthVersion += 1;
        if (broadcastHealthUpdate) {
          broadcastHealthUpdate(snap);
        }
      }
      return snap;
    })().finally(() => {
      if (includeSensitive) {
        sensitiveHealthRefresh = null;
      } else {
        healthRefresh = null;
      }
    });
    if (includeSensitive) {
      sensitiveHealthRefresh = refresh;
    } else {
      healthRefresh = refresh;
    }
  }
  return refresh;
}
