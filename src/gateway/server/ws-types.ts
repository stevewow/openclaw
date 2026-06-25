import type { WebSocket } from "ws";
import type { PortalUser } from "../admin/types.js";
import type { PluginNodeCapabilityClient } from "../plugin-node-capability.js";
import type { ConnectParams } from "../protocol/index.js";

export type GatewayWsClient = PluginNodeCapabilityClient & {
  socket: WebSocket;
  connect: ConnectParams;
  connId: string;
  isDeviceTokenAuth?: boolean;
  usesSharedGatewayAuth: boolean;
  sharedGatewaySessionGeneration?: string;
  presenceKey?: string;
  clientIp?: string;
  portalUser?: PortalUser;
};
