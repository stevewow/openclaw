// Admin routes for brokerage partnerships, under /api/admin/brokerages.
//
// Auth and the `brokerages` feature gate run in admin-http.ts before anything
// here, and whoever holds the grant may keep the whole section: agreements,
// targets, order pages, documents, and a fresh read of the Spiro totals (it
// spends no metered credits). Deleting an agreement outright is an admin's,
// because it takes every document filed on it along with it.

import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "../hooks.js";
import { sendJson } from "../http-common.js";
import {
  MAX_DOCUMENT_BODY_BYTES,
  parseDocumentUpload,
  readDocumentFile,
  removeDocumentFile,
  saveDocumentFile,
} from "./brokerage-documents.js";
import {
  accountToday,
  accountYear,
  getBrokerageOrderSync,
  type OrderSweepDeps,
  refreshBrokerageOrders,
  type SpiroCall,
  searchSpiroCompanies,
} from "./brokerage-orders.js";
import {
  addDocument,
  type AgreementInput,
  BROKERAGE_STAGES,
  BrokerageInputError,
  companyTotalsForYear,
  createAgreement,
  createOrderPage,
  deleteAgreement,
  deleteDocument,
  deleteOrderPage,
  getAgreement,
  getDocumentWithPath,
  listAgreements,
  listDocuments,
  listOrderPages,
  summarizeAgreements,
  updateAgreement,
  updateOrderPage,
} from "./brokerage-store.js";

const MAX_BODY_BYTES = 256 * 1024;

export type BrokerageRequestContext = {
  actorName: string;
  /** Only an admin may delete a whole agreement. */
  isAdmin: boolean;
};

export type BrokerageDeps = {
  now?: () => number;
  spiroCall?: SpiroCall;
  sweep?: OrderSweepDeps;
};

async function readObject(
  req: IncomingMessage,
  res: ServerResponse,
  maxBytes = MAX_BODY_BYTES,
): Promise<Record<string, unknown> | null> {
  const body = await readJsonBody(req, maxBytes);
  if (!body.ok) {
    sendJson(res, body.error === "payload too large" ? 413 : 400, { error: body.error });
    return null;
  }
  const value = body.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    sendJson(res, 400, { error: "expected a JSON object" });
    return null;
  }
  return value as Record<string, unknown>;
}

/** Store validation errors are the caller's to fix; anything else is ours. */
async function guarded(res: ServerResponse, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (err) {
    if (err instanceof BrokerageInputError) {
      sendJson(res, 400, { error: err.message });
      return;
    }
    throw err;
  }
}

export async function handleBrokerageAdminRequest(
  subPath: string,
  req: IncomingMessage,
  res: ServerResponse,
  ctx: BrokerageRequestContext,
  deps: BrokerageDeps = {},
): Promise<boolean> {
  if (subPath !== "/brokerages" && !subPath.startsWith("/brokerages/")) {
    return false;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";
  const now = (deps.now ?? Date.now)();
  const year = accountYear(now);

  // Everything the page draws itself from, in one round trip.
  if (subPath === "/brokerages" && method === "GET") {
    const agreements = await listAgreements(year);
    sendJson(res, 200, {
      year,
      agreements,
      summary: summarizeAgreements(agreements, accountToday(now)),
      orderPages: await listOrderPages(),
      stages: BROKERAGE_STAGES,
      sync: await getBrokerageOrderSync(),
    });
    return true;
  }

  if (subPath === "/brokerages" && method === "POST") {
    const data = await readObject(req, res);
    if (data) {
      await guarded(res, async () => {
        const agreement = await createAgreement(data as AgreementInput, {
          actorName: ctx.actorName,
          year,
        });
        sendJson(res, 201, { agreement, documents: [] });
      });
    }
    return true;
  }

  // Re-read this year's Spiro orders now rather than at the next scheduled read.
  if (subPath === "/brokerages/refresh" && method === "POST") {
    try {
      const result = await refreshBrokerageOrders(deps.sweep);
      sendJson(res, 200, { ok: true, result, sync: await getBrokerageOrderSync() });
    } catch (err) {
      sendJson(res, 502, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        sync: await getBrokerageOrderSync(),
      });
    }
    return true;
  }

  // Type-to-search over Spiro's companies, with what each already sends us.
  if (subPath === "/brokerages/spiro-companies" && method === "GET") {
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      sendJson(res, 200, { companies: [] });
      return true;
    }
    try {
      const [hits, totals] = await Promise.all([
        searchSpiroCompanies(q.slice(0, 100), { call: deps.spiroCall }),
        companyTotalsForYear(year),
      ]);
      sendJson(res, 200, {
        companies: hits.map((hit) => {
          const t = totals.get(hit.companyId);
          return Object.assign(hit, {
            ytdOrders: t?.orders ?? 0,
            ytdRevenueCents: t?.revenueCents ?? 0,
          });
        }),
      });
    } catch (err) {
      sendJson(res, 502, { error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  // ── Order pages ───────────────────────────────────────────────────────────
  if (subPath === "/brokerages/order-pages") {
    if (method === "GET") {
      sendJson(res, 200, { orderPages: await listOrderPages() });
      return true;
    }
    if (method === "POST") {
      const data = await readObject(req, res);
      if (data) {
        await guarded(res, async () => {
          sendJson(res, 201, { orderPage: await createOrderPage(data) });
        });
      }
      return true;
    }
  }
  const pageMatch = /^\/brokerages\/order-pages\/([^/]+)$/.exec(subPath);
  if (pageMatch) {
    const id = decodeURIComponent(pageMatch[1] ?? "");
    if (method === "PUT") {
      const data = await readObject(req, res);
      if (data) {
        await guarded(res, async () => {
          const orderPage = await updateOrderPage(id, data);
          sendJson(res, orderPage ? 200 : 404, orderPage ? { orderPage } : { error: "not_found" });
        });
      }
      return true;
    }
    if (method === "DELETE") {
      const removed = await deleteOrderPage(id);
      sendJson(res, removed ? 200 : 404, removed ? { ok: true } : { error: "not_found" });
      return true;
    }
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  const docMatch = /^\/brokerages\/documents\/([^/]+)(\/file)?$/.exec(subPath);
  if (docMatch) {
    const id = decodeURIComponent(docMatch[1] ?? "");
    if (docMatch[2] && method === "GET") {
      const doc = await getDocumentWithPath(id);
      if (!doc) {
        sendJson(res, 404, { error: "not_found" });
        return true;
      }
      let bytes: Buffer;
      try {
        bytes = await readDocumentFile(doc.storedPath);
      } catch {
        sendJson(res, 404, { error: "file_missing" });
        return true;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", doc.mimeType);
      // Always a download, never rendered from our origin.
      const safeName = doc.filename.replace(/[^\w.\-() ]+/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Length", bytes.byteLength);
      res.end(bytes);
      return true;
    }
    if (!docMatch[2] && method === "DELETE") {
      const stored = await deleteDocument(id);
      if (!stored) {
        sendJson(res, 404, { error: "not_found" });
        return true;
      }
      await removeDocumentFile(stored);
      sendJson(res, 200, { ok: true });
      return true;
    }
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }

  // ── One agreement ─────────────────────────────────────────────────────────
  const itemMatch = /^\/brokerages\/([^/]+)(\/documents)?$/.exec(subPath);
  if (!itemMatch) {
    sendJson(res, 404, { error: "not_found" });
    return true;
  }
  const id = decodeURIComponent(itemMatch[1] ?? "");

  if (itemMatch[2]) {
    if (method !== "POST") {
      sendJson(res, 405, { error: "method_not_allowed" });
      return true;
    }
    if (!(await getAgreement(id, year))) {
      sendJson(res, 404, { error: "not_found" });
      return true;
    }
    const data = await readObject(req, res, MAX_DOCUMENT_BODY_BYTES);
    if (!data) {
      return true;
    }
    const parsed = parseDocumentUpload({ filename: data.filename, data: data.data });
    if (!parsed.ok) {
      sendJson(res, 400, { error: parsed.error });
      return true;
    }
    const stored = await saveDocumentFile(parsed.file);
    try {
      const document = await addDocument({
        agreementId: id,
        title: data.title,
        filename: parsed.file.filename,
        storedPath: stored,
        mimeType: parsed.file.mimetype,
        byteSize: parsed.file.bytes.length,
        uploadedBy: ctx.actorName,
      });
      sendJson(res, 201, { document, documents: await listDocuments(id) });
    } catch (err) {
      // The row never landed, so the bytes would be an orphan nobody can reach.
      await removeDocumentFile(stored);
      throw err;
    }
    return true;
  }

  if (method === "GET") {
    const agreement = await getAgreement(id, year);
    sendJson(
      res,
      agreement ? 200 : 404,
      agreement ? { agreement, documents: await listDocuments(id) } : { error: "not_found" },
    );
    return true;
  }

  if (method === "PUT") {
    const data = await readObject(req, res);
    if (data) {
      await guarded(res, async () => {
        const agreement = await updateAgreement(id, data as AgreementInput, { year });
        sendJson(
          res,
          agreement ? 200 : 404,
          agreement ? { agreement, documents: await listDocuments(id) } : { error: "not_found" },
        );
      });
    }
    return true;
  }

  if (method === "DELETE") {
    if (!ctx.isAdmin) {
      sendJson(res, 403, { error: "forbidden" });
      return true;
    }
    const stored = await deleteAgreement(id);
    if (!stored) {
      sendJson(res, 404, { error: "not_found" });
      return true;
    }
    await Promise.all(stored.map((name) => removeDocumentFile(name)));
    sendJson(res, 200, { ok: true });
    return true;
  }

  sendJson(res, 405, { error: "method_not_allowed" });
  return true;
}
