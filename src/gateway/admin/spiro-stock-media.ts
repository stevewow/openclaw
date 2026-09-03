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
import { createAttachment } from "./attachment-store.js";
import {
  createProject,
  createTask,
  listProjects,
  type Project,
  type Task,
} from "./project-store.js";
import type { SpiroHookFacts } from "./spiro-hook-payload.js";
import { spiroOrderUrl } from "./spiro-links.js";
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
  /** The order in the Spiro admin app, when the event named one. */
  orderUrl: string | null;
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
 * MCP answers `{content:[{type:"text",text:"<json>"}]}` with the REST payload as
 * a JSON string inside it. Missing this unwrap is what made every lookup here
 * return an order with every field null: the envelope parsed as an object, so
 * it looked like a record, and it won over the webhook's own facts.
 */
function unwrapMcpJson(result: unknown): unknown {
  const outer = obj(result);
  if (!outer) {
    return result;
  }
  const content = outer.content;
  if (!Array.isArray(content)) {
    return outer;
  }
  const textPart = content
    .map((part) => obj(part))
    .find((part) => part?.type === "text" && typeof part.text === "string");
  const text = typeof textPart?.text === "string" ? textPart.text : null;
  if (!text) {
    return outer;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return outer;
  }
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
  const unwrapped = unwrapMcpJson(raw);
  const top = obj(unwrapped);
  if (!top) {
    return null;
  }
  // The tool answers `{ data, meta }`; tolerate a bare order too, since the
  // envelope is the client's convention rather than a documented guarantee.
  const detail = obj(top.data) ?? top;
  // An envelope that carried no order at all parses to an object with none of
  // the order's fields. Returning it would be worse than returning nothing: the
  // caller prefers Spiro's record over the webhook's, so an empty husk would
  // beat facts the event actually carried.
  return detail.identity || detail.bundle || detail.property || detail.website ? detail : null;
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
    // Spiro's API returns no web-app URL for an order; the webhook's own
    // `DetailsURL` fills this in when the two are merged.
    orderUrl: null,
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
    mediaTitle: facts.mediaTitle,
    agentName: facts.agentName,
    companyName: facts.companyName,
    deliveredAt: facts.deliveredAt,
    orderUrl: facts.orderUrl,
    brandedUrl: facts.deliveryUrl,
    unbrandedUrl: facts.unbrandedUrl,
  };
}

/**
 * Both sources, field by field, Spiro's record winning where it has an answer.
 *
 * Not either/or: Spiro is the authority on the bundle and carries the tracking
 * code the webhook omits, while the webhook is the only source of the admin
 * link — and when Spiro cannot be read, the event still carries the address,
 * the title and the delivery pages. Taking one wholesale threw away whichever
 * facts the other one held.
 */
export function mergeOrders(
  fromSpiro: StockMediaOrder | null,
  fromFacts: StockMediaOrder | null,
): StockMediaOrder | null {
  if (!fromSpiro) {
    return fromFacts;
  }
  if (!fromFacts) {
    return fromSpiro;
  }
  return {
    orderId: fromSpiro.orderId || fromFacts.orderId,
    orderNumber: fromSpiro.orderNumber ?? fromFacts.orderNumber,
    bundleName: fromSpiro.bundleName ?? fromFacts.bundleName,
    address: fromSpiro.address ?? fromFacts.address,
    mediaTitle: fromSpiro.mediaTitle ?? fromFacts.mediaTitle,
    agentName: fromSpiro.agentName ?? fromFacts.agentName,
    companyName: fromSpiro.companyName ?? fromFacts.companyName,
    deliveredAt: fromSpiro.deliveredAt ?? fromFacts.deliveredAt,
    orderUrl: fromSpiro.orderUrl ?? fromFacts.orderUrl,
    brandedUrl: fromSpiro.brandedUrl ?? fromFacts.brandedUrl,
    unbrandedUrl: fromSpiro.unbrandedUrl ?? fromFacts.unbrandedUrl,
  };
}

/**
 * Whether two strings name the same place. Spiro's media title is usually the
 * address with a country on the end ("300 Wayne Ave, Dayton, OH 45410, USA"
 * against "300 Wayne Ave, Dayton, OH 45410"), and printing both as if they were
 * separate facts is noise. A title someone actually typed still differs.
 */
export function samePlace(a: string | null, b: string | null): boolean {
  if (!a || !b) {
    return false;
  }
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/,?\s*(usa|united states|us)\s*$/, "")
      .replace(/[.,]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return norm(a) === norm(b);
}

/** The timezone the business counts days in — same one the lead digest uses. */
const TASK_DAY_TZ = "America/New_York";

/**
 * Spiro writes timestamps two ways: its API returns `...Z`, its webhook returns
 * the same instant with no zone at all (`DateListingDelivered`). Verified on one
 * order, whose `DateSubmitted` matched the API's `dateSubmitted` character for
 * character but for the `Z` — so a naive value is UTC, not local.
 */
export function parseSpiroTimestamp(value: string | null | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const zoned = /(z|[+-]\d{2}:?\d{2})$/i.test(trimmed) ? trimmed : `${trimmed}Z`;
  const ms = Date.parse(zoned);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Due the day it was delivered.
 *
 * The day is the business's, not the server's: the gateway runs in UTC, so a
 * delivery at 9pm Eastern is already tomorrow by the container's clock and the
 * card would come up due a day late. Anchored at noon UTC rather than at either
 * midnight — that reads as the same calendar day for the Ohio team (8am) and for
 * anyone working the board from Manila (8pm), which midnight-anchoring does not.
 */
export function dueDateForDelivery(
  deliveredAt: string | null,
  now: number = Date.now(),
  timeZone: string = TASK_DAY_TZ,
): number {
  const ms = parseSpiroTimestamp(deliveredAt) ?? now;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date, 12, 0, 0, 0);
}

/**
 * The links worth pinning to the card, in the order someone works them: the
 * order itself first, then the pages the media comes off. The Spiro link is the
 * event's own `DetailsURL` when it sent one, and a composed admin URL otherwise.
 */
export function taskLinks(
  order: StockMediaOrder,
  env: NodeJS.ProcessEnv = process.env,
): Array<{ title: string; url: string }> {
  const links: Array<{ title: string; url: string }> = [];
  const orderUrl = order.orderUrl ?? spiroOrderUrl(order.orderId, env);
  if (orderUrl) {
    links.push({ title: "Spiro order", url: orderUrl });
  }
  if (order.brandedUrl) {
    links.push({ title: "Delivery page (branded)", url: order.brandedUrl });
  }
  if (order.unbrandedUrl) {
    links.push({ title: "Delivery page (unbranded)", url: order.unbrandedUrl });
  }
  return links;
}

/** Title: the place first, because that is how the work is recognised. */
export function buildTaskTitle(order: StockMediaOrder): string {
  const place = order.address ?? order.mediaTitle ?? "Stock media order";
  const ref = order.orderNumber ? ` (${order.orderNumber})` : "";
  return `Add to Shopify — ${place}${ref}`;
}

/**
 * The delivery time as a person reads it, in the timezone the business works
 * in. Spiro's own value carries seven fractional digits and no zone, which on a
 * card is worse than useless. An unparseable value is printed as it arrived
 * rather than dropped — better an odd line than a missing fact.
 */
export function formatDelivered(
  deliveredAt: string | null,
  timeZone: string = TASK_DAY_TZ,
): string | null {
  if (!deliveredAt) {
    return null;
  }
  const ms = parseSpiroTimestamp(deliveredAt);
  if (ms === null) {
    return deliveredAt;
  }
  // Components rather than dateStyle/timeStyle: the two cannot be combined with
  // timeZoneName, and naming the zone is the point of showing a time at all.
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));
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
  if (order.mediaTitle && !samePlace(order.mediaTitle, order.address)) {
    lines.push(`Title: ${order.mediaTitle}`);
  }
  if (order.orderNumber) {
    lines.push(`Order: ${order.orderNumber}`);
  }
  const who = [order.agentName, order.companyName].filter(Boolean).join(" · ");
  if (who) {
    lines.push(`Client: ${who}`);
  }
  const delivered = formatDelivered(order.deliveredAt);
  if (delivered) {
    lines.push(`Delivered: ${delivered}`);
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
  deps: { env?: NodeJS.ProcessEnv; now?: number } = {},
): Promise<StockMediaTaskResult> {
  const env = deps.env ?? process.env;
  const assignee = await resolveAssignee(env);
  const project = await ensureShopifyProject(assignee?.id ?? null);
  const task = await createTask({
    title: buildTaskTitle(order),
    description: buildTaskDescription(order),
    status: "todo",
    priority: "medium",
    projectId: project.id,
    dueDate: dueDateForDelivery(order.deliveredAt, deps.now ?? Date.now()),
    assignedTo: assignee?.id ?? null,
    assigneeIds: assignee ? [assignee.id] : [],
    tags: ["shopify", "stock-media"],
  });
  // Links go on the card's own link list, not only into the description, so
  // they are one click from the board rather than something to select and copy.
  for (const link of taskLinks(order, env)) {
    await createAttachment({
      ownerType: "task",
      ownerId: task.id,
      type: "link",
      title: link.title,
      url: link.url,
    });
  }
  return { task, assigneeId: assignee?.id ?? null, projectId: project.id };
}
