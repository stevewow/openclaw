// The Spiro handoff. Each order's delivery page carries a "Submit Ticket or
// Request" button that links to /support with the order's context in the query
// string. This module owns that contract in one place: the parameter names
// Spiro sends, how they map onto ticket fields, and how the order id is
// recovered from the Property Website Editor link.
//
// The names are Spiro's, in Spiro's casing. They are matched case-insensitively
// so a link built with different casing still lands, and the older ?orderId=
// / ?address= form the button used before this handoff keeps working.

/** One Spiro query parameter and the intake payload field it feeds. */
export type SpiroParamMapping = {
  /** Parameter name as Spiro writes it. */
  param: string;
  /** Field name in the intake POST body. */
  field: string;
};

/**
 * The mapping, shared by both sides: the form page reads the URL with it, and
 * the intake endpoint reads the posted body with it. Exported as data (rather
 * than hardcoded twice) because the public page is inline JS that cannot
 * import — the renderer embeds this list into the page instead.
 */
export const SPIRO_PARAM_MAPPINGS: readonly SpiroParamMapping[] = [
  { param: "AgentEmailAddress", field: "requesterEmail" },
  { param: "AgentFirstName", field: "agentFirstName" },
  { param: "AgentLastName", field: "agentLastName" },
  { param: "AgentPhoneNumber", field: "requesterPhone" },
  { param: "AgentTitle", field: "agentTitle" },
  { param: "ListingAddress", field: "orderAddress" },
  { param: "SubmittedBy", field: "submittedBy" },
  { param: "AgentCompany", field: "agentCompany" },
  { param: "LinkToPWE", field: "orderLink" },
  { param: "PhotographerName", field: "photographerName" },
  { param: "DateOfShoot", field: "shootDate" },
] as const;

/** Query keys that name an order id outright, checked before falling back. */
const ORDER_ID_QUERY_KEYS = new Set(["orderid", "order", "id"]);

/**
 * Spiro order ids are UUIDs. Deliberately not version-pinned: the ids the API
 * returns (`52d43a48-d116-4755-2312-08def6d513e4`) do not carry a standard
 * version nibble, so a strict RFC pattern would reject real orders.
 */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** A trailing path segment only reads as an id if it looks like one. */
const ID_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{3,}$/;

/**
 * Recover the order id from a Property Website Editor link.
 *
 * Tried in order of how directly the link states the id: an explicit query
 * parameter, then a UUID anywhere in the URL (which is how `/order/<id>` and
 * `/order/<id>/edit` both read), then the last path segment. Returns null
 * rather than a guess when nothing in the link looks like an id — the raw link
 * still reaches the desk either way, so a miss costs context, not the ticket.
 */
export function parseOrderIdFromPweLink(link: string | null | undefined): string | null {
  const raw = (link ?? "").trim();
  if (!raw) {
    return null;
  }

  let path = raw;
  try {
    // Tolerate a protocol-relative or path-only link by giving it a base.
    const url = new URL(raw, "https://placeholder.invalid");
    for (const [key, value] of url.searchParams) {
      if (ORDER_ID_QUERY_KEYS.has(key.toLowerCase())) {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
    path = url.pathname;
  } catch {
    // Not URL-shaped; fall through and read the string as given.
  }

  const uuid = raw.match(UUID_RE);
  if (uuid) {
    return uuid[0].toLowerCase();
  }

  const segments = path.split("/").filter((s) => s.length > 0);
  // Skip a trailing verb like /edit so /order/<code>/edit still yields <code>.
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = decodeURIComponent(segments[i] ?? "");
    if (segment.toLowerCase() === "edit" || segment.toLowerCase() === "pwe") {
      continue;
    }
    return ID_SEGMENT_RE.test(segment) ? segment : null;
  }
  return null;
}

/** The Spiro context of one submission, normalized onto ticket fields. */
export type SpiroIntakeContext = {
  requesterName: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  agentTitle: string | null;
  agentCompany: string | null;
  submittedBy: string | null;
  orderAddress: string | null;
  orderLink: string | null;
  /** Parsed from the PWE link, or taken from an explicit orderId field. */
  orderId: string | null;
  photographerName: string | null;
  shootDate: string | null;
};

function cleaned(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Read the Spiro context out of a posted intake body.
 *
 * The order id is only ever derived here, never taken from a client-parsed
 * field, so the link and the id it implies cannot disagree on the ticket. An
 * explicit `orderId` still wins — that is the pre-handoff button's contract,
 * and a caller that states the id outright is not guessing.
 */
export function readSpiroIntakeContext(body: Record<string, unknown>): SpiroIntakeContext {
  const orderLink = cleaned(body.orderLink);
  const first = cleaned(body.agentFirstName);
  const last = cleaned(body.agentLastName);
  const composedName = [first, last].filter(Boolean).join(" ") || null;

  return {
    // A name typed into the form outranks the one the link carried: the person
    // filling it in may not be the agent the order is filed under.
    requesterName: cleaned(body.requesterName) ?? composedName,
    requesterEmail: cleaned(body.requesterEmail),
    requesterPhone: cleaned(body.requesterPhone),
    agentTitle: cleaned(body.agentTitle),
    agentCompany: cleaned(body.agentCompany),
    submittedBy: cleaned(body.submittedBy),
    orderAddress: cleaned(body.orderAddress),
    orderLink,
    orderId: cleaned(body.orderId) ?? parseOrderIdFromPweLink(orderLink),
    photographerName: cleaned(body.photographerName),
    shootDate: cleaned(body.shootDate),
  };
}
