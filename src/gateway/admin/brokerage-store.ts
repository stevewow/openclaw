// Brokerage partnerships: the agreements we have signed, the brokerages we want
// to sign next, and the paperwork behind each.
//
// An agreement is ours, not Spiro's. Spiro knows companies, and one brokerage
// is usually several of them (an office per town, a team inside an office), so
// an agreement links every Spiro company that belongs to it and its totals are
// the sum of those. The totals come from `admin_brokerage_company_months`,
// which `brokerage-orders.ts` rebuilds from Spiro on a schedule.
//
// Spiro has no notion of which order page a company is sent to, so that is a
// short list kept here and picked per agreement — one spelling per page, and a
// link that opens it.

import crypto from "node:crypto";
import { getAdminDb } from "./user-store.js";

export const BROKERAGE_STAGES = ["target", "negotiating", "active", "expired"] as const;
export type BrokerageStage = (typeof BROKERAGE_STAGES)[number];

export function isBrokerageStage(value: unknown): value is BrokerageStage {
  return typeof value === "string" && (BROKERAGE_STAGES as readonly string[]).includes(value);
}

/** Agreements are signed; targets are the ones we are still working toward. */
export function isSignedStage(stage: BrokerageStage): boolean {
  return stage === "active" || stage === "expired";
}

export type OrderPage = {
  id: string;
  name: string;
  url: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
};

export type BrokerageCompany = {
  companyId: string;
  companyName: string;
  serviceArea: string | null;
  ytdOrders: number;
  ytdRevenueCents: number;
};

export type BrokerageDocument = {
  id: string;
  agreementId: string;
  title: string | null;
  filename: string;
  mimeType: string;
  byteSize: number;
  uploadedBy: string | null;
  createdAt: number;
};

export type BrokerageAgreement = {
  id: string;
  name: string;
  stage: BrokerageStage;
  market: string | null;
  ownerName: string | null;
  orderPageId: string | null;
  orderPage: OrderPage | null;
  /** `YYYY-MM-DD`. Dates on a contract have no time of day. */
  signedOn: string | null;
  renewsOn: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  terms: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
  companies: BrokerageCompany[];
  documentCount: number;
  ytdOrders: number;
  ytdRevenueCents: number;
};

export type AgreementInput = {
  name?: unknown;
  stage?: unknown;
  market?: unknown;
  ownerName?: unknown;
  orderPageId?: unknown;
  signedOn?: unknown;
  renewsOn?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  terms?: unknown;
  notes?: unknown;
  companies?: unknown;
};

export class BrokerageInputError extends Error {}

const MAX_TEXT = 4000;
const MAX_SHORT = 200;
const MAX_COMPANIES = 100;

function text(value: unknown, max = MAX_SHORT): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function dateOnly(value: unknown, label: string): string | null {
  const raw = text(value);
  if (!raw) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const parsed = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
  if (!parsed || parsed.toISOString().slice(0, 10) !== raw) {
    throw new BrokerageInputError(`${label} must be a date (YYYY-MM-DD)`);
  }
  return raw;
}

function httpUrl(value: unknown): string | null {
  const raw = text(value, 2000);
  if (!raw) {
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // fall through
  }
  throw new BrokerageInputError("The order page link must start with http:// or https://");
}

type CompanyLink = { companyId: string; companyName: string; serviceArea: string | null };

function companyLinks(value: unknown): CompanyLink[] {
  if (!Array.isArray(value)) {
    throw new BrokerageInputError("companies must be a list");
  }
  const seen = new Map<string, CompanyLink>();
  for (const entry of value) {
    const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
    const companyId = text(record?.companyId, 64);
    const companyName = text(record?.companyName);
    if (!companyId || !companyName) {
      throw new BrokerageInputError("Every linked company needs its Spiro id and name");
    }
    seen.set(companyId, { companyId, companyName, serviceArea: text(record?.serviceArea) });
  }
  if (seen.size > MAX_COMPANIES) {
    throw new BrokerageInputError(`An agreement can link at most ${MAX_COMPANIES} companies`);
  }
  return [...seen.values()];
}

// ── Order pages ─────────────────────────────────────────────────────────────

type OrderPageRow = {
  id: string;
  name: string;
  url: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
};

function rowToOrderPage(row: OrderPageRow): OrderPage {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listOrderPages(): Promise<OrderPage[]> {
  const rows = await getAdminDb()
    .selectFrom("admin_brokerage_order_pages")
    .selectAll()
    .orderBy("name")
    .execute();
  return rows.map(rowToOrderPage);
}

export async function getOrderPage(id: string): Promise<OrderPage | null> {
  const row = await getAdminDb()
    .selectFrom("admin_brokerage_order_pages")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? rowToOrderPage(row) : null;
}

export async function createOrderPage(input: {
  name?: unknown;
  url?: unknown;
  notes?: unknown;
}): Promise<OrderPage> {
  const name = text(input.name);
  if (!name) {
    throw new BrokerageInputError("An order page needs a name");
  }
  const now = Date.now();
  const row: OrderPageRow = {
    id: crypto.randomUUID(),
    name,
    url: httpUrl(input.url),
    notes: text(input.notes, MAX_TEXT),
    created_at: now,
    updated_at: now,
  };
  await getAdminDb().insertInto("admin_brokerage_order_pages").values(row).execute();
  return rowToOrderPage(row);
}

export async function updateOrderPage(
  id: string,
  input: { name?: unknown; url?: unknown; notes?: unknown },
): Promise<OrderPage | null> {
  const existing = await getOrderPage(id);
  if (!existing) {
    return null;
  }
  const name = "name" in input ? text(input.name) : existing.name;
  if (!name) {
    throw new BrokerageInputError("An order page needs a name");
  }
  await getAdminDb()
    .updateTable("admin_brokerage_order_pages")
    .set({
      name,
      url: "url" in input ? httpUrl(input.url) : existing.url,
      notes: "notes" in input ? text(input.notes, MAX_TEXT) : existing.notes,
      updated_at: Date.now(),
    })
    .where("id", "=", id)
    .execute();
  return getOrderPage(id);
}

/** Agreements that pointed at it keep their record and simply lose the page. */
export async function deleteOrderPage(id: string): Promise<boolean> {
  const db = getAdminDb();
  return db.transaction().execute(async (trx) => {
    await trx
      .updateTable("admin_brokerage_agreements")
      .set({ order_page_id: null })
      .where("order_page_id", "=", id)
      .execute();
    const result = await trx
      .deleteFrom("admin_brokerage_order_pages")
      .where("id", "=", id)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  });
}

// ── Year-to-date totals ─────────────────────────────────────────────────────

export type CompanyTotals = { orders: number; revenueCents: number };

/** Orders and revenue per Spiro company for one calendar year, from the rollup. */
export async function companyTotalsForYear(year: number): Promise<Map<string, CompanyTotals>> {
  const rows = await getAdminDb()
    .selectFrom("admin_brokerage_company_months")
    .select(["company_id", "orders", "revenue_cents"])
    .where("year", "=", year)
    .execute();
  const totals = new Map<string, CompanyTotals>();
  for (const row of rows) {
    const current = totals.get(row.company_id) ?? { orders: 0, revenueCents: 0 };
    current.orders += row.orders;
    current.revenueCents += row.revenue_cents;
    totals.set(row.company_id, current);
  }
  return totals;
}

// ── Agreements ──────────────────────────────────────────────────────────────

type AgreementRow = {
  id: string;
  name: string;
  stage: string;
  market: string | null;
  owner_name: string | null;
  order_page_id: string | null;
  signed_on: string | null;
  renews_on: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  terms: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
};

async function hydrate(rows: AgreementRow[], year: number): Promise<BrokerageAgreement[]> {
  if (rows.length === 0) {
    return [];
  }
  const db = getAdminDb();
  const ids = rows.map((r) => r.id);
  const [links, docCounts, pages, totals] = await Promise.all([
    db
      .selectFrom("admin_brokerage_companies")
      .selectAll()
      .where("agreement_id", "in", ids)
      .orderBy("company_name")
      .execute(),
    db
      .selectFrom("admin_brokerage_documents")
      .select(["agreement_id", (eb) => eb.fn.countAll<number>().as("count")])
      .where("agreement_id", "in", ids)
      .groupBy("agreement_id")
      .execute(),
    listOrderPages(),
    companyTotalsForYear(year),
  ]);
  const pageById = new Map(pages.map((p) => [p.id, p]));
  const docsById = new Map(docCounts.map((d) => [d.agreement_id, d.count]));
  return rows.map((row) => {
    const companies = links
      .filter((link) => link.agreement_id === row.id)
      .map((link) => {
        const t = totals.get(link.company_id);
        return {
          companyId: link.company_id,
          companyName: link.company_name,
          serviceArea: link.service_area,
          ytdOrders: t?.orders ?? 0,
          ytdRevenueCents: t?.revenueCents ?? 0,
        };
      });
    return {
      id: row.id,
      name: row.name,
      stage: isBrokerageStage(row.stage) ? row.stage : "target",
      market: row.market,
      ownerName: row.owner_name,
      orderPageId: row.order_page_id,
      orderPage: row.order_page_id ? (pageById.get(row.order_page_id) ?? null) : null,
      signedOn: row.signed_on,
      renewsOn: row.renews_on,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      terms: row.terms,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      companies,
      documentCount: docsById.get(row.id) ?? 0,
      ytdOrders: companies.reduce((sum, c) => sum + c.ytdOrders, 0),
      ytdRevenueCents: companies.reduce((sum, c) => sum + c.ytdRevenueCents, 0),
    };
  });
}

export async function listAgreements(year: number): Promise<BrokerageAgreement[]> {
  const rows = await getAdminDb()
    .selectFrom("admin_brokerage_agreements")
    .selectAll()
    .orderBy("name")
    .execute();
  return hydrate(rows, year);
}

export async function getAgreement(id: string, year: number): Promise<BrokerageAgreement | null> {
  const row = await getAdminDb()
    .selectFrom("admin_brokerage_agreements")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? ((await hydrate([row], year))[0] ?? null) : null;
}

async function resolveOrderPageId(value: unknown): Promise<string | null> {
  const id = text(value, 64);
  if (!id) {
    return null;
  }
  if (!(await getOrderPage(id))) {
    throw new BrokerageInputError("That order page no longer exists");
  }
  return id;
}

type AgreementColumns = Omit<AgreementRow, "id" | "created_by" | "created_at" | "updated_at">;

/** Apply an input over what is stored, field by field: absent keys keep their value. */
async function columnsFrom(
  input: AgreementInput,
  existing: AgreementColumns | null,
): Promise<AgreementColumns> {
  const has = (key: keyof AgreementInput) => key in input;
  const name = has("name") ? text(input.name) : (existing?.name ?? null);
  if (!name) {
    throw new BrokerageInputError("A brokerage name is required");
  }
  let stage: BrokerageStage = isBrokerageStage(existing?.stage) ? existing.stage : "target";
  if (has("stage")) {
    if (!isBrokerageStage(input.stage)) {
      throw new BrokerageInputError(`stage must be one of ${BROKERAGE_STAGES.join(", ")}`);
    }
    stage = input.stage;
  }
  const pick = (key: keyof AgreementInput, column: keyof AgreementColumns, max?: number) =>
    has(key) ? text(input[key], max) : (existing?.[column] ?? null);
  return {
    name,
    stage,
    market: pick("market", "market"),
    owner_name: pick("ownerName", "owner_name"),
    order_page_id: has("orderPageId")
      ? await resolveOrderPageId(input.orderPageId)
      : (existing?.order_page_id ?? null),
    signed_on: has("signedOn")
      ? dateOnly(input.signedOn, "Signed on")
      : (existing?.signed_on ?? null),
    renews_on: has("renewsOn")
      ? dateOnly(input.renewsOn, "Renews on")
      : (existing?.renews_on ?? null),
    contact_name: pick("contactName", "contact_name"),
    contact_email: pick("contactEmail", "contact_email"),
    contact_phone: pick("contactPhone", "contact_phone"),
    terms: pick("terms", "terms", MAX_TEXT),
    notes: pick("notes", "notes", MAX_TEXT),
  };
}

export async function createAgreement(
  input: AgreementInput,
  opts: { actorName: string | null; year: number },
): Promise<BrokerageAgreement> {
  const columns = await columnsFrom(input, null);
  const links = "companies" in input ? companyLinks(input.companies) : [];
  const now = Date.now();
  const id = crypto.randomUUID();
  await getAdminDb()
    .transaction()
    .execute(async (trx) => {
      await trx
        .insertInto("admin_brokerage_agreements")
        .values({ id, ...columns, created_by: opts.actorName, created_at: now, updated_at: now })
        .execute();
      if (links.length > 0) {
        await trx
          .insertInto("admin_brokerage_companies")
          .values(links.map((link) => linkRow(id, link, now)))
          .execute();
      }
    });
  const created = await getAgreement(id, opts.year);
  if (!created) {
    throw new Error("agreement vanished after insert");
  }
  return created;
}

function linkRow(agreementId: string, link: CompanyLink, now: number) {
  return {
    agreement_id: agreementId,
    company_id: link.companyId,
    company_name: link.companyName,
    service_area: link.serviceArea,
    added_at: now,
  };
}

export async function updateAgreement(
  id: string,
  input: AgreementInput,
  opts: { year: number },
): Promise<BrokerageAgreement | null> {
  const db = getAdminDb();
  const existing = await db
    .selectFrom("admin_brokerage_agreements")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (!existing) {
    return null;
  }
  const columns = await columnsFrom(input, existing);
  const links = "companies" in input ? companyLinks(input.companies) : null;
  const now = Date.now();
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("admin_brokerage_agreements")
      .set({ ...columns, updated_at: now })
      .where("id", "=", id)
      .execute();
    if (links) {
      await trx.deleteFrom("admin_brokerage_companies").where("agreement_id", "=", id).execute();
      if (links.length > 0) {
        await trx
          .insertInto("admin_brokerage_companies")
          .values(links.map((link) => linkRow(id, link, now)))
          .execute();
      }
    }
  });
  return getAgreement(id, opts.year);
}

/**
 * Removes the agreement, its company links and its document rows. Returns the
 * stored filenames so the caller can take the files off disk — the rows cascade,
 * the bytes do not.
 */
export async function deleteAgreement(id: string): Promise<string[] | null> {
  const db = getAdminDb();
  return db.transaction().execute(async (trx) => {
    const docs = await trx
      .selectFrom("admin_brokerage_documents")
      .select("stored_path")
      .where("agreement_id", "=", id)
      .execute();
    const result = await trx
      .deleteFrom("admin_brokerage_agreements")
      .where("id", "=", id)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0 ? docs.map((d) => d.stored_path) : null;
  });
}

// ── Documents ───────────────────────────────────────────────────────────────

type DocumentRow = {
  id: string;
  agreement_id: string;
  title: string | null;
  filename: string;
  stored_path: string;
  mime_type: string;
  byte_size: number;
  uploaded_by: string | null;
  created_at: number;
};

function rowToDocument(row: DocumentRow): BrokerageDocument {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    title: row.title,
    filename: row.filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export async function listDocuments(agreementId: string): Promise<BrokerageDocument[]> {
  const rows = await getAdminDb()
    .selectFrom("admin_brokerage_documents")
    .selectAll()
    .where("agreement_id", "=", agreementId)
    .orderBy("created_at", "desc")
    .execute();
  return rows.map(rowToDocument);
}

/** The row with where its bytes live, for serving the file back. */
export async function getDocumentWithPath(
  id: string,
): Promise<(BrokerageDocument & { storedPath: string }) | null> {
  const row = await getAdminDb()
    .selectFrom("admin_brokerage_documents")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? { ...rowToDocument(row), storedPath: row.stored_path } : null;
}

export async function addDocument(params: {
  agreementId: string;
  title: unknown;
  filename: string;
  storedPath: string;
  mimeType: string;
  byteSize: number;
  uploadedBy: string | null;
}): Promise<BrokerageDocument> {
  const row: DocumentRow = {
    id: crypto.randomUUID(),
    agreement_id: params.agreementId,
    title: text(params.title),
    filename: params.filename,
    stored_path: params.storedPath,
    mime_type: params.mimeType,
    byte_size: params.byteSize,
    uploaded_by: params.uploadedBy,
    created_at: Date.now(),
  };
  await getAdminDb().insertInto("admin_brokerage_documents").values(row).execute();
  return rowToDocument(row);
}

/** Returns the stored filename of what was removed, or null if nothing was. */
export async function deleteDocument(id: string): Promise<string | null> {
  const doc = await getDocumentWithPath(id);
  if (!doc) {
    return null;
  }
  await getAdminDb().deleteFrom("admin_brokerage_documents").where("id", "=", id).execute();
  return doc.storedPath;
}

// ── Summary ─────────────────────────────────────────────────────────────────

export type BrokerageSummary = {
  activeCount: number;
  targetCount: number;
  /** Across active agreements, each Spiro company counted once. */
  activeYtdOrders: number;
  activeYtdRevenueCents: number;
  renewingSoonCount: number;
};

const RENEWAL_WINDOW_DAYS = 60;

export function summarizeAgreements(
  agreements: BrokerageAgreement[],
  today: string,
): BrokerageSummary {
  const counted = new Map<string, BrokerageCompany>();
  let renewingSoon = 0;
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + RENEWAL_WINDOW_DAYS);
  const horizonYmd = horizon.toISOString().slice(0, 10);
  for (const agreement of agreements) {
    if (agreement.stage !== "active") {
      continue;
    }
    for (const company of agreement.companies) {
      counted.set(company.companyId, company);
    }
    if (agreement.renewsOn && agreement.renewsOn <= horizonYmd) {
      renewingSoon++;
    }
  }
  return {
    activeCount: agreements.filter((a) => a.stage === "active").length,
    targetCount: agreements.filter((a) => !isSignedStage(a.stage)).length,
    activeYtdOrders: [...counted.values()].reduce((sum, c) => sum + c.ytdOrders, 0),
    activeYtdRevenueCents: [...counted.values()].reduce((sum, c) => sum + c.ytdRevenueCents, 0),
    renewingSoonCount: renewingSoon,
  };
}
