import crypto from "node:crypto";
import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-lead-intake-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const { handleLeadIntakeRequest, resetLeadIntakeRateLimit } = await import("./lead-intake-http.js");
const store = await import("./lead-store.js");
const territories = await import("./lead-territories.js");

let server: Server;
let base: string;
/** Leads dispatched during a test, instead of mail actually going out. */
let dispatched: string[] = [];
let env: NodeJS.ProcessEnv = {};

beforeAll(async () => {
  server = createServer((req, res) => {
    void (async () => {
      const handled = await handleLeadIntakeRequest(req, res, {
        env,
        logger: { info: () => {}, error: () => {} },
        dispatch: async (lead) => {
          dispatched.push(lead.number);
        },
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

afterEach(() => {
  dispatched = [];
  env = {};
  resetLeadIntakeRateLimit();
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.OPENCLAW_STATE_DIR;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

async function post(
  body: unknown,
  opts: { headers?: Record<string, string>; query?: string } = {},
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${base}/api/leads/intake${opts.query ?? ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return {
    status: res.status,
    data: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

const submission = {
  name: "Dana Reyes",
  email: "dana@brokerage.com",
  phone: "(614) 555-0111",
  brokerage: "Keller Williams Capital",
  market: "Columbus",
  message: "Two listings next week.",
  listingsPerYear: "24",
};

describe("website form submissions", () => {
  it("records a lead, routes it, and dispatches it", async () => {
    const res = await post(submission);
    expect(res.status).toBe(200);
    expect(res.data.lead).toMatch(/^LEAD-\d+$/);
    const lead = (await store.listLeads({ q: "dana@brokerage.com" }))[0];
    expect(lead.name).toBe("Dana Reyes");
    expect(lead.company).toBe("Keller Williams Capital");
    expect(lead.territoryKey).toBe("columbus");
    expect(lead.ownerEmail).toBe("chris@example.com");
    expect(lead.fields).toEqual([{ label: "Listings per year", value: "24" }]);
    expect(dispatched).toEqual([lead.number]);
  });

  it("answers a retried submission with the lead it already made", async () => {
    const headers = { "framer-webhook-submission-id": "sub-retry-1" };
    const first = await post({ ...submission, email: "retry@x.com" }, { headers });
    const second = await post({ ...submission, email: "retry@x.com" }, { headers });
    expect(second.status).toBe(200);
    expect(second.data.duplicate).toBe(true);
    expect(second.data.lead).toBe(first.data.lead);
    expect(await store.listLeads({ q: "retry@x.com" })).toHaveLength(1);
    // And nobody is emailed twice about it.
    expect(dispatched).toEqual([first.data.lead]);
  });

  it("files the lead under the magnet its form names, so the owner gets the right script", async () => {
    await post({
      ...submission,
      email: "guide@x.com",
      formName: "Getting Ready Guide",
      pageUrl: "https://wowvideotours.com/getting-ready",
    });
    const lead = (await store.listLeads({ q: "guide@x.com" }))[0];
    expect(lead.playbookKey).toBe("getting_ready_guide");
    expect(lead.formName).toBe("Getting Ready Guide");
    expect(lead.pageUrl).toBe("https://wowvideotours.com/getting-ready");
  });

  it("leaves the playbook unset for a form that is none of the three", async () => {
    await post({ ...submission, email: "generic@x.com", formName: "Contact us" });
    const lead = (await store.listLeads({ q: "generic@x.com" }))[0];
    expect(lead.playbookKey).toBeNull();
  });

  it("leaves a lead unrouted rather than guessing at an unknown market", async () => {
    await post({ ...submission, email: "nashville@x.com", market: "Nashville" });
    const lead = (await store.listLeads({ q: "nashville@x.com" }))[0];
    expect(lead.territoryKey).toBeNull();
    expect(lead.ownerEmail).toBeNull();
    expect(lead.marketRaw).toBe("Nashville");
  });

  it("drops a submission with no way to reach anybody, without asking for a retry", async () => {
    const res = await post({ name: "Bot", message: "hello" });
    expect(res.status).toBe(200);
    expect(res.data.dropped).toBe("no_contact");
    expect(dispatched).toEqual([]);
  });

  it("rejects a bad signature when a signing secret is configured", async () => {
    env = { LEADS_WEBHOOK_SECRET: "s".repeat(32) };
    const res = await post(
      { ...submission, email: "signed@x.com" },
      {
        headers: {
          "framer-signature": "sha256=" + "0".repeat(64),
          "framer-webhook-submission-id": "sub-sig-bad",
        },
      },
    );
    expect(res.status).toBe(401);
    expect(await store.listLeads({ q: "signed@x.com" })).toHaveLength(0);
  });

  it("accepts a submission Framer signed with the configured secret", async () => {
    const secret = "s".repeat(32);
    env = { LEADS_WEBHOOK_SECRET: secret };
    const submissionId = "sub-sig-good";
    const body = JSON.stringify({ ...submission, email: "goodsig@x.com" });
    const signature = crypto
      .createHmac("sha256", secret)
      .update(Buffer.from(body))
      .update(submissionId)
      .digest("hex");
    const res = await post(body, {
      headers: {
        "framer-signature": `sha256=${signature}`,
        "framer-webhook-submission-id": submissionId,
      },
    });
    expect(res.status).toBe(200);
    expect(await store.listLeads({ q: "goodsig@x.com" })).toHaveLength(1);
  });

  it("accepts a shared token in the URL for a platform that cannot sign", async () => {
    env = { LEADS_WEBHOOK_TOKEN: "hunter2" };
    const bad = await post({ ...submission, email: "tok-bad@x.com" }, { query: "?token=wrong" });
    expect(bad.status).toBe(401);
    const good = await post(
      { ...submission, email: "tok-good@x.com" },
      { query: "?token=hunter2" },
    );
    expect(good.status).toBe(200);
  });

  it("refuses anything that is not a JSON object", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post([1, 2, 3])).status).toBe(400);
  });

  it("asks for a retry when it is being flooded", async () => {
    let last = 200;
    for (let i = 0; i < 130; i += 1) {
      last = (await post({ email: `flood${i}@x.com` })).status;
      if (last === 429) {
        break;
      }
    }
    expect(last).toBe(429);
  });

  it("answers preflight, and refuses other methods", async () => {
    const preflight = await fetch(`${base}/api/leads/intake`, { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    const get = await fetch(`${base}/api/leads/intake`);
    expect(get.status).toBe(405);
  });
});
