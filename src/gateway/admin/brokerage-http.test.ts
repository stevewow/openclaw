import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-brokerage-http-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleAdminHttpRequest } = await import("./admin-http.js");
const userStore = await import("./user-store.js");
const { parseDocumentUpload } = await import("./brokerage-documents.js");

/**
 * The brokerage section through the real admin router: who can reach it, and
 * that an agreement, its order page and its documents survive the round trip
 * the page makes — including a document coming back as the bytes that went in.
 */

let server: Server;
let base: string;
let superToken: string;
let grantedToken: string;
let plainToken: string;

async function call(
  method: string,
  route: string,
  opts: { token: string; body?: unknown },
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${base}/api/admin${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${opts.token}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // not JSON
  }
  return { status: res.status, json };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    void handleAdminHttpRequest(req, res).then((handled) => {
      if (!handled) {
        res.statusCode = 404;
        res.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  const superId = (
    await userStore.createUser({ username: "root", password: "pw", role: "superadmin" })
  ).id;
  const grantedId = (await userStore.createUser({ username: "bds", password: "pw", role: "user" }))
    .id;
  const plainId = (await userStore.createUser({ username: "va", password: "pw", role: "user" })).id;
  superToken = (await userStore.createSession(superId)).token;
  grantedToken = (await userStore.createSession(grantedId)).token;
  plainToken = (await userStore.createSession(plainId)).token;
  const grant = await call("PUT", `/users/${grantedId}/permissions`, {
    token: superToken,
    body: { permissions: [{ permissionType: "feature", value: "brokerages" }] },
  });
  expect(grant.status).toBe(200);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.OPENCLAW_STATE_DIR;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

/** Three weeks out, so the agreement always reads as renewing soon. */
const RENEWS_SOON = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);

/** The first bytes of a real PDF, padded out to a plausible file. */
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64, 0x20)]);

describe("access", () => {
  it("is closed to a user without the grant", async () => {
    expect((await call("GET", "/brokerages", { token: plainToken })).status).toBe(403);
    expect(
      (await call("POST", "/brokerages", { token: plainToken, body: { name: "Sneaky" } })).status,
    ).toBe(403);
  });

  it("opens to a user holding it", async () => {
    const res = await call("GET", "/brokerages", { token: grantedToken });
    expect(res.status).toBe(200);
    expect(res.json.agreements).toEqual([]);
  });
});

describe("an agreement end to end", () => {
  let agreementId: string;
  let pageId: string;
  let docId: string;

  it("files an order page and an agreement that uses it", async () => {
    const page = await call("POST", "/brokerages/order-pages", {
      token: grantedToken,
      body: { name: "Heritage pricing", url: "https://order.wowvideotours.com/heritage" },
    });
    expect(page.status).toBe(201);
    pageId = (page.json.orderPage as { id: string }).id;

    const bad = await call("POST", "/brokerages", {
      token: grantedToken,
      body: { name: "Heritage", renewsOn: "2026-02-30" },
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/Renews on/);

    const created = await call("POST", "/brokerages", {
      token: grantedToken,
      body: {
        name: "Coldwell Banker Heritage",
        stage: "active",
        orderPageId: pageId,
        renewsOn: RENEWS_SOON,
        companies: [{ companyId: "ccf8d3b0", companyName: "Coldwell Banker Heritage" }],
      },
    });
    expect(created.status).toBe(201);
    const agreement = created.json.agreement as {
      id: string;
      orderPage: { name: string } | null;
      companies: unknown[];
      createdBy: string;
    };
    agreementId = agreement.id;
    expect(agreement.orderPage?.name).toBe("Heritage pricing");
    expect(agreement.companies).toHaveLength(1);
    expect(agreement.createdBy).toBe("bds");
  });

  it("keeps a document and hands back the same bytes", async () => {
    const refused = await call("POST", `/brokerages/${agreementId}/documents`, {
      token: grantedToken,
      body: {
        filename: "run.exe",
        data: Buffer.from("MZ\x90\x00 not a contract at all").toString("base64"),
      },
    });
    expect(refused.status).toBe(400);

    const up = await call("POST", `/brokerages/${agreementId}/documents`, {
      token: grantedToken,
      body: {
        filename: "signed.pdf",
        title: "Signed agreement",
        data: `data:application/pdf;base64,${PDF.toString("base64")}`,
      },
    });
    expect(up.status).toBe(201);
    const doc = up.json.document as { id: string; mimeType: string; byteSize: number };
    docId = doc.id;
    expect(doc).toMatchObject({ mimeType: "application/pdf", byteSize: PDF.length });

    const res = await fetch(`${base}/api/admin/brokerages/documents/${docId}/file`, {
      headers: { Authorization: `Bearer ${grantedToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="signed.pdf"');
    expect(Buffer.from(await res.arrayBuffer()).equals(PDF)).toBe(true);

    const listed = await call("GET", "/brokerages", { token: grantedToken });
    const row = (listed.json.agreements as Array<{ id: string; documentCount: number }>)[0];
    expect(row).toMatchObject({ id: agreementId, documentCount: 1 });
    expect(listed.json.summary).toMatchObject({ activeCount: 1, renewingSoonCount: 1 });
  });

  it("clears the page from agreements when the page is deleted", async () => {
    expect(
      (await call("DELETE", `/brokerages/order-pages/${pageId}`, { token: grantedToken })).status,
    ).toBe(200);
    const one = await call("GET", `/brokerages/${agreementId}`, { token: grantedToken });
    expect((one.json.agreement as { orderPageId: string | null }).orderPageId).toBeNull();
  });

  it("leaves deleting a whole agreement to an admin, and takes its files with it", async () => {
    expect(
      (await call("DELETE", `/brokerages/${agreementId}`, { token: grantedToken })).status,
    ).toBe(403);

    const stored = fs.readdirSync(path.join(TMP_DIR, "admin-attachments"));
    expect(stored).toHaveLength(1);
    expect((await call("DELETE", `/brokerages/${agreementId}`, { token: superToken })).status).toBe(
      200,
    );
    expect(fs.readdirSync(path.join(TMP_DIR, "admin-attachments"))).toHaveLength(0);
    expect(
      (await call("GET", `/brokerages/documents/${docId}/file`, { token: superToken })).status,
    ).toBe(404);
  });
});

describe("document types", () => {
  const b64 = (buf: Buffer) => buf.toString("base64");
  const zip = Buffer.concat([Buffer.from("PK\x03\x04", "latin1"), Buffer.alloc(40)]);
  const ole = Buffer.concat([Buffer.from("d0cf11e0a1b11ae1", "hex"), Buffer.alloc(40)]);

  it("takes Word and Excel files by their container and extension", () => {
    const docx = parseDocumentUpload({ filename: "Agreement.docx", data: b64(zip) });
    expect(docx.ok && docx.file.mimetype).toMatch(/wordprocessingml/);
    const xls = parseDocumentUpload({ filename: "rates.xls", data: b64(ole) });
    expect(xls.ok && xls.file.mimetype).toBe("application/vnd.ms-excel");
  });

  it("refuses a file whose bytes do not match what its name claims", () => {
    expect(parseDocumentUpload({ filename: "Agreement.docx", data: b64(ole) }).ok).toBe(false);
    expect(parseDocumentUpload({ filename: "archive.zip", data: b64(zip) }).ok).toBe(false);
  });

  it("names a PDF by what it is, whatever it was called", () => {
    const parsed = parseDocumentUpload({ filename: "scan.png", data: b64(PDF) });
    expect(parsed.ok && parsed.file.filename).toBe("scan.png.pdf");
  });
});
