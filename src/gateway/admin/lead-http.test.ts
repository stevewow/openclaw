import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-lead-http-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleLeadAdminRequest } = await import("./lead-http.js");
const store = await import("./lead-store.js");
const territories = await import("./lead-territories.js");

/**
 * The routes as admin-http.ts reaches them: session, auth and the `leads`
 * feature gate have already run, so what is under test here is the queue's own
 * behavior and the one decision this module makes on its own — that editing the
 * routing table is an admin's, not every holder of the grant's.
 */
let server: Server;
let base: string;
let asAdmin = true;

beforeAll(async () => {
  server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const handled = await handleLeadAdminRequest(url.pathname, req, res, {
        actorName: "Steve",
        isAdmin: asAdmin,
      });
      if (!handled) {
        res.statusCode = 404;
        res.end("not found");
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  await territories.ensureTerritorySeed();
  await territories.updateTerritory("columbus", { ownerEmail: "chris@example.com" });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.OPENCLAW_STATE_DIR;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

async function call(
  method: string,
  route: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${base}${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: res.status,
    data: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

describe("the lead queue API", () => {
  it("hands the page everything it needs in one call", async () => {
    await store.createLead({
      name: "Dana Reyes",
      email: "dana@brokerage.com",
      marketRaw: "Columbus",
      territoryKey: "columbus",
      ownerName: "Chris Voge",
      ownerEmail: "chris@example.com",
    });
    const res = await call("GET", "/leads?status=open");
    expect(res.status).toBe(200);
    expect((res.data.leads as unknown[]).length).toBeGreaterThan(0);
    expect(res.data.summary).toMatchObject({ total: expect.any(Number) });
    expect((res.data.statuses as Array<{ key: string }>).map((s) => s.key)).toContain("qualified");
    expect((res.data.territories as unknown[]).length).toBe(8);
  });

  it("takes a lead by hand and does not email anyone about it", async () => {
    const res = await call("POST", "/leads", {
      name: "Phoned In",
      phone: "6145550111",
      territoryKey: "columbus",
    });
    expect(res.status).toBe(201);
    const lead = res.data.lead as {
      id: string;
      source: string;
      ownerEmail: string;
      notifiedAt: null;
    };
    expect(lead.source).toBe("manual");
    expect(lead.ownerEmail).toBe("chris@example.com");
    expect(lead.notifiedAt).toBeNull();
    const events = await store.listLeadEvents(lead.id);
    expect(events.at(-1)?.body).toContain("by hand");
  });

  it("insists on a way to reach the person", async () => {
    const res = await call("POST", "/leads", { name: "No Contact" });
    expect(res.status).toBe(400);
  });

  it("moves a lead along, names who did it, and refuses a status it does not know", async () => {
    const lead = await store.createLead({ name: "Move Me", email: "move@x.com" });
    const ok = await call("PUT", `/leads/${lead.id}/status`, { status: "qualified" });
    expect(ok.status).toBe(200);
    expect((ok.data.lead as { status: string }).status).toBe("qualified");
    const events = ok.data.events as Array<{ authorName: string | null; body: string }>;
    expect(events.at(-1)).toMatchObject({ authorName: "Steve" });
    const bad = await call("PUT", `/leads/${lead.id}/status`, { status: "sold" });
    expect(bad.status).toBe(400);
  });

  it("re-routes a lead onto another market's owner", async () => {
    const lead = await store.createLead({ name: "Route Me", email: "route@x.com" });
    const res = await call("PUT", `/leads/${lead.id}/assign`, { territoryKey: "columbus" });
    expect((res.data.lead as { ownerName: string }).ownerName).toBe("Chris Voge");
    const unknown = await call("PUT", `/leads/${lead.id}/assign`, { territoryKey: "atlantis" });
    expect(unknown.status).toBe(400);
  });

  it("keeps notes on the trail", async () => {
    const lead = await store.createLead({ name: "Note Me", email: "note@x.com" });
    const res = await call("POST", `/leads/${lead.id}/notes`, { body: "Left a voicemail." });
    expect(res.status).toBe(201);
    expect((res.data.events as Array<{ body: string }>).at(-1)?.body).toBe("Left a voicemail.");
    expect((await call("POST", `/leads/${lead.id}/notes`, { body: "  " })).status).toBe(400);
  });

  it("answers 404 for a lead that is not there", async () => {
    expect((await call("GET", "/leads/nope")).status).toBe(404);
  });

  it("lets an admin edit the routing table", async () => {
    const created = await call("POST", "/lead-territories", {
      label: "Indianapolis",
      ownerName: "Joy Kiser",
      ownerEmail: "joy@example.com",
      aliases: "Indy, Central Indiana",
    });
    expect(created.status).toBe(201);
    expect((created.data.territory as { aliases: string[] }).aliases).toEqual([
      "Indy",
      "Central Indiana",
    ]);
    expect((await call("POST", "/lead-territories", { label: "Indianapolis" })).status).toBe(409);
    const updated = await call("PUT", "/lead-territories/indianapolis", { ownerEmail: "j@x.com" });
    expect((updated.data.territory as { ownerEmail: string }).ownerEmail).toBe("j@x.com");
    expect((await call("DELETE", "/lead-territories/indianapolis")).status).toBe(200);
  });

  it("refuses the routing table to a granted teammate who is not an admin", async () => {
    asAdmin = false;
    try {
      expect((await call("GET", "/lead-territories")).status).toBe(403);
      expect(
        (await call("PUT", "/lead-territories/columbus", { ownerEmail: "x@x.com" })).status,
      ).toBe(403);
      // The queue itself stays theirs to work.
      expect((await call("GET", "/leads")).status).toBe(200);
      const lead = await store.createLead({ name: "Theirs", email: "theirs@x.com" });
      expect((await call("PUT", `/leads/${lead.id}/status`, { status: "contacted" })).status).toBe(
        200,
      );
      // Deleting one is not.
      expect((await call("DELETE", `/leads/${lead.id}`)).status).toBe(403);
    } finally {
      asAdmin = true;
    }
  });

  it("leaves other admin routes alone", async () => {
    const res = await fetch(`${base}/resources`);
    expect(res.status).toBe(404);
  });
});
