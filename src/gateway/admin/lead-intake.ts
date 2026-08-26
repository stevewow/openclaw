// Turning one website form submission into a lead.
//
// Kept apart from the HTTP handler because this is the part with judgment in it:
// a marketing site's form fields are named by whoever built the page, and they
// are renamed whenever the page is redesigned. So nothing here is a fixed
// contract with the site — every column is filled by the first field whose name
// looks like it, and anything unrecognized is carried through verbatim rather
// than dropped. A question added to the form on Tuesday shows up in the Hub on
// Tuesday, in the lead's own detail panel, without a deploy.

import crypto from "node:crypto";

/** Fold a form field name so "Full Name", "full_name" and "fullName" all meet. */
export function fieldKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Field names that fill each column, best first.
 *
 * Matching is exact on the folded name before it is loose, so a form carrying
 * both "email" and "emailoptin" cannot have the checkbox win the address.
 */
const FIELD_ALIASES = {
  name: ["name", "fullname", "yourname", "contactname", "agentname"],
  firstName: ["firstname", "fname", "givenname"],
  lastName: ["lastname", "lname", "surname", "familyname"],
  email: ["email", "emailaddress", "youremail", "workemail", "contactemail"],
  phone: ["phone", "phonenumber", "yourphone", "mobile", "cell", "telephone", "tel"],
  company: ["company", "brokerage", "brokeragename", "companyname", "agency", "business", "team"],
  market: ["market", "region", "territory", "servicearea", "area", "city", "location", "metro"],
  message: [
    "message",
    "comments",
    "comment",
    "notes",
    "details",
    "inquiry",
    "question",
    "howcanwehelp",
  ],
} as const;

/** Where the form says it was submitted from, if it says at all. */
const PAGE_FIELDS = ["pageurl", "page", "url", "referrer", "sourceurl"] as const;
/** What the form calls itself, if it says at all. */
const FORM_NAME_FIELDS = ["formname", "form", "formtitle"] as const;

/** Names that are plumbing, not answers, and belong in no column and no list. */
const IGNORED_FIELDS = new Set<string>([
  "submit",
  "formid",
  ...FORM_NAME_FIELDS,
  ...PAGE_FIELDS,
  "recaptcha",
  "captcha",
  "honeypot",
  "csrf",
  "token",
]);

export type LeadPayloadFields = Record<string, unknown>;

export type ParsedLead = {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  market: string | null;
  message: string | null;
  /** Everything else the form asked, labelled as the form labelled it. */
  fields: Array<{ label: string; value: string }>;
  /** The page it was submitted from, when the payload names it. */
  pageUrl: string | null;
  /** Which form on the site, when the payload names it. */
  formName: string | null;
};

/** A submitted value as one line of text. Framer sends checkboxes as arrays. */
function asText(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map((v) => asText(v)).filter((v): v is string => Boolean(v));
    return parts.length > 0 ? parts.join(", ") : null;
  }
  return null;
}

/** "brokerageName" / "brokerage_name" → "Brokerage name", for the detail panel. */
export function prettyLabel(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) {
    return name;
  }
  // A camel-cased name splits into capitalized words and an underscored one into
  // lower-case words; the same question asked twice should not read two ways.
  // Ordinary words are lowered, an all-caps one (MLS, ZIP) is left alone —
  // lowering that would be a misspelling rather than a style.
  const words = spaced.split(" ").map((word, i) => {
    if (i === 0 || !/^[A-Z][a-z]+$/.test(word)) {
      return word;
    }
    return word.charAt(0).toLowerCase() + word.slice(1);
  });
  const out = words.join(" ");
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Read a submission into a lead.
 *
 * Order matters: every column claims its field before the leftovers are
 * collected, so a value cannot be both the market and an extra answer.
 */
export function parseLeadPayload(payload: LeadPayloadFields): ParsedLead {
  const entries = Object.entries(payload).map(([name, value]) => ({
    name,
    key: fieldKey(name),
    text: asText(value),
  }));
  const claimed = new Set<string>();

  const takeExact = (aliases: readonly string[]): string | null => {
    for (const alias of aliases) {
      const hit = entries.find((e) => e.key === alias && e.text && !claimed.has(e.name));
      if (hit) {
        claimed.add(hit.name);
        return hit.text;
      }
    }
    return null;
  };

  /**
   * "whichMarketAreYouIn" contains "market". Only reached when no field is
   * named plainly, and the longest alias wins so "email" does not claim a field
   * the more specific "emailaddress" describes.
   */
  const takeLoose = (aliases: readonly string[]): string | null => {
    for (const alias of [...aliases].toSorted((a, b) => b.length - a.length)) {
      const hit = entries.find((e) => e.key.includes(alias) && e.text && !claimed.has(e.name));
      if (hit) {
        claimed.add(hit.name);
        return hit.text;
      }
    }
    return null;
  };

  const take = (aliases: readonly string[]): string | null =>
    takeExact(aliases) ?? takeLoose(aliases);

  // Name is resolved in three steps rather than one, because "firstName"
  // contains "name": a single loose pass would answer "Dana" and never go
  // looking for the other half of it.
  let name = takeExact(FIELD_ALIASES.name);
  if (!name) {
    const first = take(FIELD_ALIASES.firstName);
    const last = take(FIELD_ALIASES.lastName);
    name = [first, last].filter(Boolean).join(" ") || null;
  }
  if (!name) {
    name = takeLoose(FIELD_ALIASES.name);
  }
  const email = take(FIELD_ALIASES.email);
  const phone = take(FIELD_ALIASES.phone);
  const company = take(FIELD_ALIASES.company);
  const market = take(FIELD_ALIASES.market);
  const message = take(FIELD_ALIASES.message);

  const fields = entries
    .filter((e) => e.text && !claimed.has(e.name) && !IGNORED_FIELDS.has(e.key))
    .map((e) => ({ label: prettyLabel(e.name), value: e.text as string }));

  // Plumbing, but the useful kind: kept out of the answers and carried as
  // context instead of dropped, since "which page was this?" is the first
  // question asked of a form that starts sending nonsense.
  const plumbing = (names: readonly string[]): string | null => {
    for (const key of names) {
      const hit = entries.find((e) => e.key === key && e.text);
      if (hit?.text) {
        return hit.text;
      }
    }
    return null;
  };

  return {
    name,
    email,
    phone,
    company,
    market,
    message,
    fields,
    pageUrl: plumbing(PAGE_FIELDS),
    formName: plumbing(FORM_NAME_FIELDS),
  };
}

/**
 * Is this submission worth a row?
 *
 * A form post with no way to reach anybody is a bot or a broken page, and it
 * would sit in the queue forever because nobody can work it. Rejected at the
 * door rather than filed and ignored.
 */
export function hasContact(parsed: ParsedLead): boolean {
  return Boolean(parsed.email || parsed.phone);
}

/**
 * Verify Framer's webhook signature.
 *
 * Framer signs `Framer-Signature` as `sha256=<hex>`, an HMAC-SHA256 over the raw
 * request body followed by the submission id, keyed with the secret set on the
 * webhook destination. The raw bytes are hashed, not a re-serialization of the
 * parsed JSON: any difference in key order or spacing would fail an otherwise
 * good signature.
 */
export function verifyFramerSignature(params: {
  rawBody: Buffer;
  submissionId: string;
  header: string | undefined;
  secret: string;
}): boolean {
  const header = params.header?.trim();
  if (!header) {
    return false;
  }
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  if (!/^[0-9a-f]+$/i.test(provided)) {
    return false;
  }
  const hmac = crypto.createHmac("sha256", params.secret);
  hmac.update(params.rawBody);
  hmac.update(params.submissionId);
  const expected = hmac.digest();
  let providedBytes: Buffer;
  try {
    providedBytes = Buffer.from(provided, "hex");
  } catch {
    return false;
  }
  if (providedBytes.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBytes, expected);
}
