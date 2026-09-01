import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-spiro-hook-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const hook = await import("./spiro-hook-http.js");
const store = await import("./spiro-hook-store.js");
const projects = await import("./project-store.js");
const users = await import("./user-store.js");
const rule = await import("./spiro-stock-media.js");

const ORDER_ID = "b47d6967-b750-46e0-22ab-08def6d513e4";
const OTHER_ORDER = "348b0c6d-95b7-437c-f29f-08df040fb633";

const silent = { info: () => {}, error: () => {} };

/** A stock-media order as Spiro's API would answer for it. */
function spiroOrder(orderId = ORDER_ID, bundleName: string | null = "Wow Stock Media") {
  return {
    orderId,
    orderNumber: "kqq180dyh",
    bundleName,
    address: "107 S Main St, Monroe, NC 28112",
    mediaTitle: "Downtown Monroe",
    agentName: "Joy Kiser",
    companyName: "Air BnB",
    deliveredAt: "2026-08-18T15:02:20Z",
    brandedUrl: `https://view.wowvideotours.com/order/${orderId}?branding=true`,
    unbrandedUrl: null,
  };
}

/** Deps that reach neither Spiro nor the mail provider. */
function offlineDeps(order: ReturnType<typeof spiroOrder> | null = spiroOrder()) {
  const notified: string[] = [];
  return {
    deps: {
      logger: silent,
      env: {} as NodeJS.ProcessEnv,
      loadOrder: async () => order,
      notify: async (input: { recipientIds: readonly string[] }) => {
        notified.push(...input.recipientIds);
        return [];
      },
    } as Parameters<typeof hook.ingestHookBody>[1],
    notified,
  };
}

beforeEach(async () => {
  for (const t of await projects.listTasks()) {
    await projects.deleteTask(t.id);
  }
  for (const p of await projects.listProjects()) {
    await projects.deleteProject(p.id);
  }
  for (const u of await users.listUsers()) {
    if (u.username !== "admin") {
      await users.deleteUser(u.id);
    }
  }
  hook.resetSpiroHookRateLimit();
  hook.resetSpiroHookWarning();
});

describe("authorization", () => {
  it("accepts anything when no token is configured", () => {
    expect(hook.authorizeHook({ urlToken: null, headerToken: undefined, env: {} })).toEqual({
      ok: true,
      mode: "open",
    });
  });

  it("takes the token from the query string", () => {
    const env = { SPIRO_WEBHOOK_TOKEN: "s3cret" } as NodeJS.ProcessEnv;
    expect(hook.authorizeHook({ urlToken: "s3cret", headerToken: undefined, env })).toEqual({
      ok: true,
      mode: "token",
    });
  });

  it("takes the token from a header", () => {
    const env = { SPIRO_WEBHOOK_TOKEN: "s3cret" } as NodeJS.ProcessEnv;
    expect(hook.authorizeHook({ urlToken: null, headerToken: "s3cret", env }).ok).toBe(true);
  });

  it("rejects a wrong or missing token once one is configured", () => {
    const env = { SPIRO_WEBHOOK_TOKEN: "s3cret" } as NodeJS.ProcessEnv;
    expect(hook.authorizeHook({ urlToken: "nope", headerToken: undefined, env }).ok).toBe(false);
    expect(hook.authorizeHook({ urlToken: null, headerToken: undefined, env }).ok).toBe(false);
    expect(hook.authorizeHook({ urlToken: "s3cre", headerToken: undefined, env }).ok).toBe(false);
  });
});

describe("what an event does", () => {
  it("creates a task for a stock media delivery and tells the assignee", async () => {
    const maricel = await users.createUser({
      username: "mdapac",
      password: "pw-for-test-only",
      role: "user",
      firstName: "Maricel",
      email: "maricel@example.test",
    });
    const { deps, notified } = offlineDeps();

    const event = await hook.ingestHookBody(
      JSON.stringify({ event: "media.delivered", orderId: ORDER_ID }),
      deps,
    );

    expect(event.outcome).toBe("created");
    expect(event.taskId).toBeTruthy();
    expect(event.bundleSource).toBe("spiro");
    const tasks = await projects.listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toContain("107 S Main St");
    expect(tasks[0].assignedTo).toBe(maricel.id);
    expect(notified).toEqual([maricel.id]);
  });

  it("ignores a delivery on any other bundle", async () => {
    const { deps } = offlineDeps(spiroOrder(ORDER_ID, "Essential Photos"));
    const event = await hook.ingestHookBody(JSON.stringify({ orderId: ORDER_ID }), deps);
    expect(event.outcome).toBe("ignored_bundle");
    expect(event.detail).toContain("Essential Photos");
    expect(await projects.listTasks()).toHaveLength(0);
  });

  it("makes one task per order however many times the hook fires", async () => {
    const { deps } = offlineDeps();
    const first = await hook.ingestHookBody(JSON.stringify({ orderId: ORDER_ID }), deps);
    const second = await hook.ingestHookBody(JSON.stringify({ orderId: ORDER_ID }), deps);
    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("duplicate");
    expect(second.taskId).toBe(first.taskId);
    expect(await projects.listTasks()).toHaveLength(1);
  });

  it("raises a fresh task if the first one was deleted by hand", async () => {
    const { deps } = offlineDeps();
    const first = await hook.ingestHookBody(JSON.stringify({ orderId: ORDER_ID }), deps);
    await projects.deleteTask(first.taskId!);
    const second = await hook.ingestHookBody(JSON.stringify({ orderId: ORDER_ID }), deps);
    expect(second.outcome).toBe("created");
    expect(second.taskId).not.toBe(first.taskId);
  });

  it("keeps separate orders separate", async () => {
    const { deps } = offlineDeps();
    await hook.ingestHookBody(JSON.stringify({ orderId: ORDER_ID }), deps);
    const other = await hook.ingestHookBody(JSON.stringify({ orderId: OTHER_ORDER }), {
      ...deps,
      loadOrder: async (id: string) => spiroOrder(id),
    } as Parameters<typeof hook.ingestHookBody>[1]);
    expect(other.outcome).toBe("created");
    expect(await projects.listTasks()).toHaveLength(2);
  });

  it("falls back to the payload's bundle when Spiro cannot be read", async () => {
    const { deps } = offlineDeps(null);
    const event = await hook.ingestHookBody(
      JSON.stringify({ orderId: ORDER_ID, bundle: { name: "Wow Stock Media" } }),
      deps,
    );
    expect(event.outcome).toBe("created");
    expect(event.bundleSource).toBe("payload");
  });

  it("leaves an event unresolved rather than dropping it when the bundle is unknowable", async () => {
    const { deps } = offlineDeps(null);
    const event = await hook.ingestHookBody(JSON.stringify({ orderId: ORDER_ID }), deps);
    expect(event.outcome).toBe("unresolved");
    expect(await projects.listTasks()).toHaveLength(0);
    // The body is kept, which is what makes a replay possible after a fix.
    expect(event.raw).toContain(ORDER_ID);
  });

  it("records a payload naming no order", async () => {
    const { deps } = offlineDeps();
    const event = await hook.ingestHookBody(JSON.stringify({ event: "ping" }), deps);
    expect(event.outcome).toBe("no_order");
    expect(await projects.listTasks()).toHaveLength(0);
  });

  it("keeps a body that is not even JSON", async () => {
    const { deps } = offlineDeps();
    const event = await hook.ingestHookBody("<xml>nope</xml>", deps);
    expect(event.outcome).toBe("no_order");
    expect(event.detail).toBe("body was not JSON");
    expect(event.raw).toBe("<xml>nope</xml>");
  });

  it("trusts Spiro's bundle over a payload that claims otherwise", async () => {
    const { deps } = offlineDeps(spiroOrder(ORDER_ID, "Essential Photos"));
    const event = await hook.ingestHookBody(
      JSON.stringify({ orderId: ORDER_ID, bundle: { name: "Wow Stock Media" } }),
      deps,
    );
    expect(event.outcome).toBe("ignored_bundle");
    expect(event.bundleName).toBe("Essential Photos");
  });

  it("stores every event, acted on or not", async () => {
    const { deps } = offlineDeps(spiroOrder(ORDER_ID, "Essential Photos"));
    const before = (await store.listHookEvents(200)).length;
    const ignored = await hook.ingestHookBody(JSON.stringify({ orderId: ORDER_ID }), deps);
    const noOrder = await hook.ingestHookBody(JSON.stringify({ event: "ping" }), deps);

    // The log is append-only and shared, so this asserts on the two just made
    // rather than on the whole table.
    const events = await store.listHookEvents(200);
    expect(events).toHaveLength(before + 2);
    const stored = new Map(events.map((e) => [e.id, e]));
    expect(stored.get(ignored.id)?.outcome).toBe("ignored_bundle");
    expect(stored.get(noOrder.id)?.outcome).toBe("no_order");
    expect(stored.get(ignored.id)?.raw).toContain(ORDER_ID);
  });
});

/** Minimal req/res doubles — the endpoint only touches these few members. */
function fakeReq(options: {
  method?: string;
  url?: string;
  body?: string;
  headers?: Record<string, string>;
}): IncomingMessage {
  const listeners = new Map<string, Array<(arg?: unknown) => void>>();
  const req = {
    method: options.method ?? "POST",
    url: options.url ?? "/api/spiro/hook",
    headers: options.headers ?? {},
    socket: { remoteAddress: "127.0.0.1" },
    on(event: string, cb: (arg?: unknown) => void) {
      const list = listeners.get(event) ?? [];
      list.push(cb);
      listeners.set(event, list);
      if (event === "end") {
        // Deliver the body once both handlers are attached.
        queueMicrotask(() => {
          for (const fn of listeners.get("data") ?? []) {
            fn(Buffer.from(options.body ?? ""));
          }
          for (const fn of listeners.get("end") ?? []) {
            fn();
          }
        });
      }
      return req;
    },
    destroy() {},
  };
  return req as unknown as IncomingMessage;
}

function fakeRes(): ServerResponse & { statusCode: number; payload: unknown } {
  const res = {
    statusCode: 0,
    payload: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    getHeader(k: string) {
      return this.headers[k];
    },
    end(body?: string) {
      if (body) {
        try {
          this.payload = JSON.parse(body);
        } catch {
          this.payload = body;
        }
      }
    },
    writeHead(code: number) {
      this.statusCode = code;
      return this;
    },
  };
  return res as unknown as ServerResponse & { statusCode: number; payload: unknown };
}

describe("the endpoint", () => {
  it("passes on a path that is not its own", async () => {
    const handled = await hook.handleSpiroHookRequest(
      fakeReq({ url: "/api/leads/intake" }),
      fakeRes(),
      { logger: silent },
    );
    expect(handled).toBe(false);
  });

  it("refuses a GET", async () => {
    const res = fakeRes();
    await hook.handleSpiroHookRequest(fakeReq({ method: "GET" }), res, { logger: silent });
    expect(res.statusCode).toBe(405);
  });

  it("answers the preflight", async () => {
    const res = fakeRes();
    await hook.handleSpiroHookRequest(fakeReq({ method: "OPTIONS" }), res, { logger: silent });
    expect(res.statusCode).toBe(204);
  });

  it("rejects a bad token without recording anything", async () => {
    const before = (await store.listHookEvents()).length;
    const res = fakeRes();
    await hook.handleSpiroHookRequest(
      fakeReq({ url: "/api/spiro/hook?token=wrong", body: "{}" }),
      res,
      { logger: silent, env: { SPIRO_WEBHOOK_TOKEN: "right" } as NodeJS.ProcessEnv },
    );
    expect(res.statusCode).toBe(401);
    expect((await store.listHookEvents()).length).toBe(before);
  });

  it("takes a delivery end to end and answers 200", async () => {
    await users.createUser({
      username: "mdapac",
      password: "pw-for-test-only",
      role: "user",
      email: "maricel@example.test",
    });
    const { deps } = offlineDeps();
    const res = fakeRes();
    await hook.handleSpiroHookRequest(
      fakeReq({
        url: "/api/spiro/hook?token=right",
        body: JSON.stringify({ event: "media.delivered", orderId: ORDER_ID }),
      }),
      res,
      { ...deps, env: { SPIRO_WEBHOOK_TOKEN: "right" } as NodeJS.ProcessEnv },
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ ok: true, outcome: "created" });
    expect(await projects.listTasks()).toHaveLength(1);
  });

  it("answers 200 for an event it deliberately ignored, so the sender stops", async () => {
    const { deps } = offlineDeps(spiroOrder(ORDER_ID, "Essential Photos"));
    const res = fakeRes();
    await hook.handleSpiroHookRequest(
      fakeReq({ body: JSON.stringify({ orderId: ORDER_ID }) }),
      res,
      deps,
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ outcome: "ignored_bundle" });
  });

  it("answers 503 when the event could not be stored, which is the retryable case", async () => {
    const res = fakeRes();
    await hook.handleSpiroHookRequest(
      fakeReq({ body: JSON.stringify({ orderId: ORDER_ID }) }),
      res,
      {
        logger: silent,
        loadOrder: async () => {
          throw new Error("db down");
        },
        createTask: (async () => {
          throw new Error("db down");
        }) as unknown as typeof rule.createStockMediaTask,
      },
    );
    expect(res.statusCode).toBe(503);
  });
});
