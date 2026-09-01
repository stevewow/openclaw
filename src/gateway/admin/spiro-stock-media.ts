// The rule: a Wow Stock Media delivery becomes a Shopify task for Maricel.
//
// Kept apart from the endpoint that receives the event so the two can be read
// and tested separately — the endpoint's job is "did Spiro really send this",
// this file's job is "does it deserve a task, and what does the task say".
//
// The bundle is the whole filter. Spiro delivers on the order of 12,000
// listings a year and a handful of those are stock media, so a rule that fired
// on delivery alone would bury the person it is meant to help.

import { callTool } from "../../../extensions/spiro/api.js";
import {
  createProject,
  createTask,
  listProjects,
  type Project,
  type Task,
} from "./project-store.js";
import type { SpiroHookFacts } from "./spiro-hook-payload.js";
import { listUsers } from "./user-store.js";

/**
 * The bundle that earns a task. Verified against the live account: it is a real
 * purchased bundle (`kind: bundle`, `source: purchasedBundle`) and the orders
 * carrying it run a handful a month.
 */
export const STOCK_MEDIA_BUNDLE = "Wow Stock Media";

/** The board these land on. Created on first use rather than by hand. */
export const SHOPIFY_PROJECT_TITLE = "Shopify Media";

/**
 * Who the work goes to. An env override rather than a hardcoded name alone:
 * the person doing the Shopify listings will not be the same forever, and
 * changing it should not need a deploy.
 */
const DEFAULT_ASSIGNEE = "mdapac";

/**
 * Bundle names compare on trimmed, case-folded text with runs of whitespace
 * collapsed. "Exactly matches" is about the whole string — a bundle called
 * "Wow Stock Media Plus" must not match — but a stray double space or a
 * lowercased "media" in a webhook field is a transport artifact, not a
 * different product.
 */
export function bundleMatches(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(name) === norm(STOCK_MEDIA_BUNDLE);
}

/** The order facts a task is written from, however they were obtained. */
export type StockMediaOrder = {
  orderId: string;
  orderNumber: string | null;
  bundleName: string | null;
  address: string | null;
  mediaTitle: string | null;
  agentName: string | null;
  companyName: string | null;
  deliveredAt: string | null;
  brandedUrl: string | null;
  unbrandedUrl: string | null;
};

type OrderDetail = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Spiro's own record of the order, read through the plugin's authenticated MCP
 * connection — the same path the churn pull uses. This is what makes the filter
 * trustworthy: the webhook's claim about a bundle is hearsay, `bundle.name` on
 * the order is the account's own answer.
 */
export async function fetchOrderDetail(
  orderId: string,
  deps: { call?: typeof callTool } = {},
): Promise<OrderDetail | null> {
  const call = deps.call ?? callTool;
  const raw = await call("get_spiro_order", { orderId });
  const top = obj(raw);
  if (!top) {
    return null;
  }
  // The tool answers `{ data, meta }`; tolerate a bare order too, since the
  // envelope is the client's convention rather than a documented guarantee.
  return obj(top.data) ?? top;
}

/** Fold Spiro's order detail into the flat facts a task is written from. */
export function orderFromDetail(orderId: string, detail: OrderDetail): StockMediaOrder {
  const identity = obj(detail.identity) ?? {};
  const bundle = obj(detail.bundle) ?? {};
  const property = obj(detail.property) ?? {};
  const address = obj(property.address) ?? {};
  const website = obj(detail.website) ?? {};
  const agent = obj(detail.agent) ?? {};
  const agentName = [str(agent.firstName), str(agent.lastName)].filter(Boolean).join(" ");
  return {
    orderId: str(identity.orderId) ?? orderId,
    orderNumber: str(identity.trackingCode),
    bundleName: str(bundle.name),
    address: str(address.fullAddress) ?? str(address.streetAddress),
    mediaTitle: str(identity.mediaTitle),
    agentName: agentName || null,
    companyName: str(agent.companyName),
    deliveredAt: str(website.deliveredAt),
    brandedUrl: str(website.brandedAssetUrl),
    unbrandedUrl: str(website.unbrandedAssetUrl),
  };
}

/** What a task is written from when Spiro cannot be reached — the payload alone. */
export function orderFromFacts(facts: SpiroHookFacts): StockMediaOrder | null {
  if (!facts.orderId) {
    return null;
  }
  return {
    orderId: facts.orderId,
    orderNumber: facts.orderNumber,
    bundleName: facts.bundleName,
    address: facts.address,
    mediaTitle: null,
    agentName: null,
    companyName: null,
    deliveredAt: null,
    brandedUrl: facts.deliveryUrl,
    unbrandedUrl: facts.unbrandedUrl,
  };
}

/** Title: the place first, because that is how the work is recognised. */
export function buildTaskTitle(order: StockMediaOrder): string {
  const place = order.address ?? order.mediaTitle ?? "Stock media order";
  const ref = order.orderNumber ? ` (${order.orderNumber})` : "";
  return `Add to Shopify — ${place}${ref}`;
}

/**
 * Body: the links that let the work start without a hunt through Spiro, and
 * nothing that would go stale. Plain text with bare URLs, which is what the
 * task view renders.
 */
export function buildTaskDescription(order: StockMediaOrder): string {
  const lines: string[] = [
    `${STOCK_MEDIA_BUNDLE} delivered — add this media to the Shopify store.`,
    "",
  ];
  if (order.address) {
    lines.push(`Property: ${order.address}`);
  }
  if (order.mediaTitle && order.mediaTitle !== order.address) {
    lines.push(`Title: ${order.mediaTitle}`);
  }
  if (order.orderNumber) {
    lines.push(`Order: ${order.orderNumber}`);
  }
  const who = [order.agentName, order.companyName].filter(Boolean).join(" · ");
  if (who) {
    lines.push(`Client: ${who}`);
  }
  if (order.deliveredAt) {
    lines.push(`Delivered: ${order.deliveredAt}`);
  }
  lines.push("");
  // Only links Spiro actually handed back. Spiro's public API returns no
  // web-app URL for an order (see spiro-links.ts), so a composed one would be
  // a guess; the delivery page comes off the order record itself.
  if (order.brandedUrl) {
    lines.push(`Branded: ${order.brandedUrl}`);
  }
  if (order.unbrandedUrl) {
    lines.push(`Unbranded: ${order.unbrandedUrl}`);
  }
  lines.push(`Spiro order id: ${order.orderId}`);
  return lines.join("\n");
}

/** The Shopify board, made once and found by title thereafter. */
export async function ensureShopifyProject(assigneeId: string | null): Promise<Project> {
  const existing = (await listProjects(null)).find(
    (p) => p.title.trim().toLowerCase() === SHOPIFY_PROJECT_TITLE.toLowerCase(),
  );
  if (existing) {
    return existing;
  }
  return createProject({
    title: SHOPIFY_PROJECT_TITLE,
    description:
      "Stock media deliveries from Spiro, waiting to be listed on the Shopify store. Cards are raised automatically when a Wow Stock Media order is delivered.",
    status: "active",
    color: "#ff0000",
    memberIds: assigneeId ? [assigneeId] : [],
  });
}

/**
 * The person the cards go to, by username or email, with the env override
 * winning. Returns null rather than guessing at somebody: an unassigned card on
 * a visible board is recoverable, a card silently given to the wrong person is
 * not.
 */
export async function resolveAssignee(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ id: string; name: string } | null> {
  const wanted = (env.SPIRO_STOCK_MEDIA_ASSIGNEE?.trim() || DEFAULT_ASSIGNEE).toLowerCase();
  const users = await listUsers();
  const match = users.find(
    (u) => u.username.toLowerCase() === wanted || (u.email ?? "").toLowerCase() === wanted,
  );
  if (!match) {
    return null;
  }
  const name = [match.firstName, match.lastName].filter(Boolean).join(" ").trim();
  return { id: match.id, name: name || match.username };
}

export type StockMediaTaskResult = {
  task: Task;
  assigneeId: string | null;
  projectId: string;
};

/**
 * Raise the card. Assignment is set both ways — the legacy single `assigned_to`
 * and the assignee list — because the board reads one and My Work reads the
 * other.
 */
export async function createStockMediaTask(
  order: StockMediaOrder,
  deps: { env?: NodeJS.ProcessEnv } = {},
): Promise<StockMediaTaskResult> {
  const assignee = await resolveAssignee(deps.env ?? process.env);
  const project = await ensureShopifyProject(assignee?.id ?? null);
  const task = await createTask({
    title: buildTaskTitle(order),
    description: buildTaskDescription(order),
    status: "todo",
    priority: "medium",
    projectId: project.id,
    assignedTo: assignee?.id ?? null,
    assigneeIds: assignee ? [assignee.id] : [],
    tags: ["shopify", "stock-media"],
  });
  return { task, assigneeId: assignee?.id ?? null, projectId: project.id };
}
