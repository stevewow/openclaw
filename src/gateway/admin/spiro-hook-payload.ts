// Reading a Spiro webhook whose shape nobody has written down.
//
// Spiro's public API documents no webhooks at all — no subscription endpoints,
// nothing in the OpenAPI contract — and the Spiro side offers no support for
// this beyond making the hook fire. So this module does not decode a known
// schema. It goes looking: it walks whatever JSON arrives and pulls out the few
// facts a delivery event has to carry, under any of the names those facts are
// plausibly given.
//
// Two rules keep the search honest rather than merely lucky:
//
//   - Keys are ranked, not scanned in document order. `orderId` beats a bare
//     `id`, which beats a UUID recovered from a link. Otherwise a payload
//     shaped like Spiro's own order detail would hand back `finalVTaskId` —
//     a real UUID for the wrong thing.
//   - The last resort is a UUID inside an order URL, never "any UUID
//     anywhere". A wrong id is worse than no id: it would file a task against
//     somebody else's listing, and nothing downstream could tell.
//
// Everything here is pure and total. An unreadable payload returns nulls; the
// caller records the raw body either way, which is what makes the real shape
// knowable the first time one lands.

/** Spiro order ids are UUIDs, and not RFC-versioned ones — see spiro-links.ts. */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const UUID_ANCHORED_RE = new RegExp(`^${UUID_RE.source}$`, "i");

/** An all-zero UUID is Spiro's "no value" (e.g. `parentOrderId`), not an order. */
const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

/** Depth and node caps: a webhook body is small, and a cycle must not hang us. */
const MAX_DEPTH = 8;
const MAX_NODES = 4000;

/** One string found in the payload, with the path that led to it. */
type Found = {
  /** Lowercased key the value sat under. */
  key: string;
  /** Lowercased dotted path, e.g. `order.bundle.name`. */
  path: string;
  value: string;
};

type Scan = {
  strings: Found[];
  /** Objects by lowercased path, so a `bundle` object can be read as a whole. */
  objects: Map<string, Record<string, unknown>>;
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Flatten the payload into (key, path, value) triples plus an index of the
 * objects along the way. Arrays keep their index in the path so two products
 * are distinguishable, but the key stays the array's own name — what matters
 * for matching is that the value sat under `products`, not that it was third.
 */
export function scanPayload(payload: unknown): Scan {
  const strings: Found[] = [];
  const objects = new Map<string, Record<string, unknown>>();
  let nodes = 0;
  const seen = new WeakSet<object>();

  const walk = (node: unknown, key: string, path: string, depth: number): void => {
    if (nodes >= MAX_NODES || depth > MAX_DEPTH) {
      return;
    }
    nodes += 1;
    if (node === null || node === undefined) {
      return;
    }
    if (typeof node === "string") {
      const value = node.trim();
      if (value) {
        strings.push({ key, path, value });
      }
      return;
    }
    if (typeof node === "number" || typeof node === "boolean") {
      strings.push({ key, path, value: String(node) });
      return;
    }
    if (typeof node !== "object") {
      return;
    }
    if (seen.has(node)) {
      return;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, key, `${path}[${i}]`, depth + 1));
      return;
    }
    const record = node as Record<string, unknown>;
    if (path) {
      // Keys are normalized the same way paths are. Spiro posts PascalCase
      // (`Bundle.Name`), so a reader asking for `name` on the raw record found
      // nothing and the bundle — the fact the whole rule turns on — read null.
      const normalized: Record<string, unknown> = {};
      for (const [childKey, child] of Object.entries(record)) {
        normalized[normalizeKey(childKey)] = child;
      }
      objects.set(path, normalized);
    }
    for (const [childKey, child] of Object.entries(record)) {
      const norm = normalizeKey(childKey);
      walk(child, norm, path ? `${path}.${norm}` : norm, depth + 1);
    }
  };

  walk(payload, "", "", 0);
  return { strings, objects };
}

/**
 * First value whose key matches one of `keys`, in the order `keys` gives them.
 * Ranking by the caller's list rather than by where the value happened to sit
 * is what stops a nested stray from beating the field actually named.
 */
function pick(
  scan: Scan,
  keys: readonly string[],
  accept?: (value: string, found: Found) => boolean,
): string | null {
  for (const wanted of keys) {
    for (const found of scan.strings) {
      if (found.key === wanted && (!accept || accept(found.value, found))) {
        return found.value;
      }
    }
  }
  return null;
}

function isOrderUuid(value: string): boolean {
  return UUID_ANCHORED_RE.test(value) && value.toLowerCase() !== EMPTY_UUID;
}

/**
 * A UUID sitting in a link that names an order — `/order/<id>` is how both the
 * delivery page and the Property Website Editor address one.
 */
function orderIdFromLink(scan: Scan): string | null {
  for (const found of scan.strings) {
    if (!/^https?:\/\//i.test(found.value) || !/\/orders?\//i.test(found.value)) {
      continue;
    }
    const match = found.value.match(UUID_RE);
    if (match && match[0].toLowerCase() !== EMPTY_UUID) {
      return match[0];
    }
  }
  return null;
}

/**
 * The order the event is about.
 *
 * `id` is accepted only under an order-ish path, because a bare `id` at the top
 * of an envelope is usually the event's own id, not the order's.
 */
export function extractOrderId(payload: unknown, scan = scanPayload(payload)): string | null {
  const direct = pick(scan, ["orderid", "orderguid", "orderuuid"], isOrderUuid);
  if (direct) {
    return direct;
  }
  for (const found of scan.strings) {
    if (found.key !== "id" || !isOrderUuid(found.value)) {
      continue;
    }
    if (/(^|\.)orders?(\[\d+\])?\.id$/.test(found.path)) {
      return found.value;
    }
  }
  return orderIdFromLink(scan);
}

/** Spiro's human-facing order reference (`kqq180dyh`), for the task title. */
export function extractOrderNumber(payload: unknown, scan = scanPayload(payload)): string | null {
  return pick(scan, ["trackingcode", "ordernumber", "orderno", "ordercode"], (v) => v.length <= 64);
}

/**
 * The bundle the order was placed on — the fact the whole rule turns on.
 *
 * A `bundle`/`package` object is read as a whole first so `bundle.name` beats a
 * loose `name` elsewhere in the payload. Products are then searched for one
 * that says it is the purchased bundle, which is the shape Spiro's reporting
 * rows use; a product list with no such marker is left alone rather than having
 * its first entry guessed at.
 */
export function extractBundleName(payload: unknown, scan = scanPayload(payload)): string | null {
  for (const key of ["bundle", "package", "productbundle"]) {
    for (const [path, obj] of scan.objects) {
      const leaf = path.split(".").pop() ?? "";
      if (leaf.replace(/\[\d+\]$/, "") !== key) {
        continue;
      }
      const name = obj.name ?? obj.bundlename ?? obj.title;
      if (typeof name === "string" && name.trim()) {
        return name.trim();
      }
    }
  }
  const direct = pick(scan, ["bundlename", "packagename", "bundletitle"]);
  if (direct) {
    return direct;
  }
  for (const [, obj] of scan.objects) {
    const source = typeof obj.source === "string" ? obj.source.toLowerCase() : "";
    const kind = typeof obj.kind === "string" ? obj.kind.toLowerCase() : "";
    const name = obj.name;
    if ((source === "purchasedbundle" || kind === "bundle") && typeof name === "string") {
      const trimmed = name.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}

/**
 * What the sender called this event, kept for the log rather than matched on.
 *
 * `status` outranks `type` because Spiro's own name for the event is
 * `Status: "Delivery Email Sent"`, and nothing in the payload is called a type
 * except line items. Values inside arrays are refused for the same reason: the
 * first real event read as `Upcharges[0].Type` — "Above Ground Square Footage".
 */
export function extractEventName(payload: unknown, scan = scanPayload(payload)): string | null {
  return pick(
    scan,
    ["event", "eventtype", "eventname", "topic", "status", "action", "trigger", "type"],
    (v, found) => v.length <= 120 && !found.path.includes("["),
  );
}

/** A string field off an already-normalized object, or null. */
function strOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Spiro's webhook gives no whole address — it gives a `Listing` block of parts
 * (`AddressL1`, `City`, `State`, `ZipCode`) — so the address has to be composed
 * or the task reads as an id. Composed rather than falling through to
 * `MediaTitle` because the two are different facts: the title is the listing's
 * name and happens to look like an address, the address is the address.
 */
function addressFromParts(scan: Scan): string | null {
  for (const [path, obj] of scan.objects) {
    const leaf = (path.split(".").pop() ?? "").replace(/\[\d+\]$/, "");
    if (leaf !== "listing" && leaf !== "property" && leaf !== "address") {
      continue;
    }
    const line1 = strOf(obj.addressl1) ?? strOf(obj.streetaddress) ?? strOf(obj.address1);
    if (!line1) {
      continue;
    }
    const unit = strOf(obj.unit) ?? strOf(obj.unitnumber);
    const city = strOf(obj.city);
    const region = strOf(obj.state) ?? strOf(obj.stateorprovince);
    const postal = strOf(obj.zipcode) ?? strOf(obj.postalcode);
    const street = unit ? `${line1} ${unit}` : line1;
    const tail = [city, [region, postal].filter(Boolean).join(" ").trim()]
      .filter(Boolean)
      .join(", ");
    return tail ? `${street}, ${tail}` : street;
  }
  return null;
}

/** Street address, so a task reads as a place rather than as an id. */
export function extractAddress(payload: unknown, scan = scanPayload(payload)): string | null {
  const direct = pick(scan, ["fulladdress", "listingaddress", "propertyaddress"]);
  if (direct) {
    return direct;
  }
  const composed = addressFromParts(scan);
  if (composed) {
    return composed;
  }
  const street = pick(scan, ["streetaddress"]);
  if (street) {
    return street;
  }
  const address = pick(scan, ["address"], (v) => v.length > 4 && /\d/.test(v));
  return address ?? pick(scan, ["mediatitle"]);
}

/**
 * What Spiro calls the listing — `MediaTitle`, the name the order is recognised
 * by in the Spiro UI. Usually the address with a country on the end, sometimes
 * a name a human typed, and either way the thing the person doing the work
 * searches for.
 */
export function extractMediaTitle(payload: unknown, scan = scanPayload(payload)): string | null {
  return pick(scan, ["mediatitle", "propertytitle", "listingtitle"], (v) => v.length <= 200);
}

/** The listing agent, so the card says whose listing it is. */
export function extractAgentName(payload: unknown, scan = scanPayload(payload)): string | null {
  for (const [path, obj] of scan.objects) {
    const leaf = (path.split(".").pop() ?? "").replace(/\[\d+\]$/, "");
    if (leaf !== "agent" && leaf !== "client" && leaf !== "customer") {
      continue;
    }
    const full = strOf(obj.name) ?? strOf(obj.fullname);
    if (full) {
      return full;
    }
    const name = [strOf(obj.firstname), strOf(obj.lastname)].filter(Boolean).join(" ");
    if (name) {
      return name;
    }
  }
  return pick(scan, ["agentname"], (v) => v.length <= 120);
}

/**
 * The brokerage. Read off the agent block rather than by key alone: the payload
 * also carries `TenantName`, which is our own company, not the client's.
 */
export function extractCompanyName(payload: unknown, scan = scanPayload(payload)): string | null {
  for (const [path, obj] of scan.objects) {
    const leaf = (path.split(".").pop() ?? "").replace(/\[\d+\]$/, "");
    if (leaf !== "agent" && leaf !== "client" && leaf !== "customer") {
      continue;
    }
    const company = strOf(obj.companyname) ?? strOf(obj.company) ?? strOf(obj.brokerage);
    if (company) {
      return company;
    }
  }
  return null;
}

/**
 * When the media was delivered — the event this whole rule hangs off, and what
 * the task is due on. Spiro's webhook writes these without a zone designator
 * (`DateListingDelivered`), its API returns the same instant with a `Z`.
 */
export function extractDeliveredAt(payload: unknown, scan = scanPayload(payload)): string | null {
  return pick(scan, ["datelistingdelivered", "deliveredat", "datedelivered", "deliverydate"], (v) =>
    /^\d{4}-\d{2}-\d{2}/.test(v),
  );
}

/**
 * The order in the Spiro admin app. Spiro's public API never returns a web-app
 * URL (see spiro-links.ts), but the webhook does — `DetailsURL` — so when an
 * event carries one it is the real link rather than a composed guess.
 */
export function extractOrderUrl(payload: unknown, scan = scanPayload(payload)): string | null {
  return pick(scan, ["detailsurl", "orderurl", "adminurl", "orderlink"], isHttpUrl);
}

const isHttpUrl = (v: string): boolean => /^https?:\/\//i.test(v);

/**
 * The client-facing delivery page, when the event names one. Spiro's own name
 * for it is `DisplayPage_BrandedURL`; the generic fallbacks stay behind it so a
 * differently-shaped sender still lands somewhere sensible.
 */
export function extractDeliveryUrl(payload: unknown, scan = scanPayload(payload)): string | null {
  return pick(
    scan,
    [
      "brandedasseturl",
      "displaypagebrandedurl",
      "asseturl",
      "displaypageurl",
      "deliveryurl",
      "pageurl",
      "url",
      "link",
    ],
    isHttpUrl,
  );
}

/** The unbranded twin, which the listing agent is usually the one who needs. */
export function extractUnbrandedUrl(payload: unknown, scan = scanPayload(payload)): string | null {
  return pick(scan, ["unbrandedasseturl", "displaypageunbrandedurl", "unbrandedurl"], isHttpUrl);
}

export type SpiroHookFacts = {
  orderId: string | null;
  orderNumber: string | null;
  bundleName: string | null;
  eventName: string | null;
  address: string | null;
  mediaTitle: string | null;
  agentName: string | null;
  companyName: string | null;
  deliveredAt: string | null;
  orderUrl: string | null;
  deliveryUrl: string | null;
  unbrandedUrl: string | null;
};

/** Everything worth having from one delivery event, read in a single scan. */
export function readHookFacts(payload: unknown): SpiroHookFacts {
  const scan = scanPayload(payload);
  return {
    orderId: extractOrderId(payload, scan),
    orderNumber: extractOrderNumber(payload, scan),
    bundleName: extractBundleName(payload, scan),
    eventName: extractEventName(payload, scan),
    address: extractAddress(payload, scan),
    mediaTitle: extractMediaTitle(payload, scan),
    agentName: extractAgentName(payload, scan),
    companyName: extractCompanyName(payload, scan),
    deliveredAt: extractDeliveredAt(payload, scan),
    orderUrl: extractOrderUrl(payload, scan),
    deliveryUrl: extractDeliveryUrl(payload, scan),
    unbrandedUrl: extractUnbrandedUrl(payload, scan),
  };
}
