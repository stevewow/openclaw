import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-stock-media-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const rule = await import("./spiro-stock-media.js");
const projects = await import("./project-store.js");
const users = await import("./user-store.js");
const attachments = await import("./attachment-store.js");

const ORDER_ID = "b47d6967-b750-46e0-22ab-08def6d513e4";

/** Trimmed from a live `get_spiro_order` response for a real stock media order. */
const ORDER_DETAIL = {
  identity: { orderId: ORDER_ID, trackingCode: "kqq180dyh", mediaTitle: "Downtown Monroe" },
  bundle: { name: "Wow Stock Media" },
  property: {
    address: { fullAddress: "107 S Main St, Monroe, NC 28112", streetAddress: "107 S Main St" },
  },
  website: {
    deliveredAt: "2026-08-18T15:02:20.3027996Z",
    brandedAssetUrl: `https://view.wowvideotours.com/order/${ORDER_ID}?branding=true`,
    unbrandedAssetUrl: `https://view.wowvideotours.com/order/${ORDER_ID}?branding=false`,
  },
  agent: { firstName: "Joy", lastName: "Kiser", companyName: "Air BnB" },
};

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
  delete process.env.SPIRO_STOCK_MEDIA_ASSIGNEE;
});

describe("bundle matching", () => {
  it("matches the bundle exactly", () => {
    expect(rule.bundleMatches("Wow Stock Media")).toBe(true);
  });

  it("tolerates casing and stray whitespace, which are transport artifacts", () => {
    expect(rule.bundleMatches("  wow stock media ")).toBe(true);
    expect(rule.bundleMatches("Wow  Stock  Media")).toBe(true);
  });

  it("refuses a longer name that merely starts the same", () => {
    expect(rule.bundleMatches("Wow Stock Media Plus")).toBe(false);
    expect(rule.bundleMatches("Stock Media")).toBe(false);
  });

  it("refuses nothing at all", () => {
    expect(rule.bundleMatches(null)).toBe(false);
    expect(rule.bundleMatches("")).toBe(false);
  });
});

describe("reading an order", () => {
  it("folds Spiro's order detail into the facts a task needs", () => {
    expect(rule.orderFromDetail(ORDER_ID, ORDER_DETAIL)).toEqual({
      orderId: ORDER_ID,
      orderNumber: "kqq180dyh",
      bundleName: "Wow Stock Media",
      address: "107 S Main St, Monroe, NC 28112",
      mediaTitle: "Downtown Monroe",
      agentName: "Joy Kiser",
      companyName: "Air BnB",
      deliveredAt: "2026-08-18T15:02:20.3027996Z",
      orderUrl: null,
      brandedUrl: `https://view.wowvideotours.com/order/${ORDER_ID}?branding=true`,
      unbrandedUrl: `https://view.wowvideotours.com/order/${ORDER_ID}?branding=false`,
    });
  });

  it("survives an order detail missing everything optional", () => {
    const order = rule.orderFromDetail(ORDER_ID, {});
    expect(order.orderId).toBe(ORDER_ID);
    expect(order.bundleName).toBeNull();
    expect(order.agentName).toBeNull();
  });

  it("unwraps the tool's data envelope", async () => {
    const detail = await rule.fetchOrderDetail(ORDER_ID, {
      call: async () => ({ data: ORDER_DETAIL, meta: null }),
    });
    expect(detail).toEqual(ORDER_DETAIL);
  });

  it("accepts a bare order with no envelope", async () => {
    const detail = await rule.fetchOrderDetail(ORDER_ID, { call: async () => ORDER_DETAIL });
    expect(detail).toEqual(ORDER_DETAIL);
  });

  it("unwraps the MCP content envelope the client really returns", async () => {
    // What callTool hands back: {content:[{type:"text",text:"<json>"}]}. Missing
    // this is what made every live lookup return an order of nothing but nulls.
    const detail = await rule.fetchOrderDetail(ORDER_ID, {
      call: async () => ({
        content: [{ type: "text", text: JSON.stringify({ data: ORDER_DETAIL, meta: null }) }],
        isError: false,
      }),
    });
    expect(detail).toEqual(ORDER_DETAIL);
  });

  it("reports no order rather than an empty husk", async () => {
    // An envelope carrying no order parses to an object with none of the
    // order's fields. Returned, it would outrank the webhook's own facts.
    expect(
      await rule.fetchOrderDetail(ORDER_ID, { call: async () => ({ content: [], isError: true }) }),
    ).toBeNull();
    expect(await rule.fetchOrderDetail(ORDER_ID, { call: async () => ({}) })).toBeNull();
  });

  it("reads an order that is not valid JSON as no order", async () => {
    const detail = await rule.fetchOrderDetail(ORDER_ID, {
      call: async () => ({ content: [{ type: "text", text: "not json" }] }),
    });
    expect(detail).toBeNull();
  });
});

describe("merging the two sources", () => {
  const fromSpiro = rule.orderFromDetail(ORDER_ID, ORDER_DETAIL);
  const fromFacts = rule.orderFromFacts({
    orderId: ORDER_ID,
    orderNumber: null,
    bundleName: "Wow Stock Media",
    eventName: "Delivery Email Sent",
    address: "300 Wayne Ave, Dayton, OH 45410",
    mediaTitle: "300 Wayne Ave, Dayton, OH 45410, USA",
    agentName: "Chris Voge",
    companyName: "WOW Video Tours",
    deliveredAt: "2026-09-03T16:24:30.8043146",
    orderUrl: `https://admins.wowvideotours.com/orders/${ORDER_ID}`,
    deliveryUrl: "https://view.wowvideotours.com/order/x?branding=true",
    unbrandedUrl: null,
  })!;

  it("lets Spiro's record win where it has an answer", () => {
    const merged = rule.mergeOrders(fromSpiro, fromFacts)!;
    expect(merged.address).toBe("107 S Main St, Monroe, NC 28112");
    expect(merged.orderNumber).toBe("kqq180dyh");
    expect(merged.mediaTitle).toBe("Downtown Monroe");
  });

  it("keeps the webhook's fields Spiro does not carry", () => {
    const merged = rule.mergeOrders(fromSpiro, fromFacts)!;
    // The admin link exists only in the event; Spiro's API returns none.
    expect(merged.orderUrl).toBe(`https://admins.wowvideotours.com/orders/${ORDER_ID}`);
  });

  it("falls back to the event entirely when Spiro cannot be read", () => {
    const merged = rule.mergeOrders(null, fromFacts)!;
    expect(merged.address).toBe("300 Wayne Ave, Dayton, OH 45410");
    expect(merged.agentName).toBe("Chris Voge");
    expect(merged.deliveredAt).toBe("2026-09-03T16:24:30.8043146");
  });

  it("fills Spiro's gaps from the event rather than leaving them null", () => {
    const sparse = { ...fromSpiro, address: null, agentName: null, deliveredAt: null };
    const merged = rule.mergeOrders(sparse, fromFacts)!;
    expect(merged.address).toBe("300 Wayne Ave, Dayton, OH 45410");
    expect(merged.agentName).toBe("Chris Voge");
    expect(merged.deliveredAt).toBe("2026-09-03T16:24:30.8043146");
  });
});

describe("when it is due", () => {
  it("is due the day it was delivered", () => {
    const due = rule.dueDateForDelivery("2026-09-03T16:24:30.8043146Z");
    expect(new Date(due).toISOString()).toBe("2026-09-03T12:00:00.000Z");
  });

  it("treats a zoneless Spiro timestamp as UTC, which is what it is", () => {
    expect(rule.dueDateForDelivery("2026-09-03T16:24:30.8043146")).toBe(
      rule.dueDateForDelivery("2026-09-03T16:24:30.8043146Z"),
    );
  });

  it("counts the day in the business's timezone, not the server's UTC", () => {
    // 01:30 UTC on the 4th is 9:30pm Eastern on the 3rd: the delivery day is
    // the 3rd, and a card due the 4th would read as a day late.
    const due = rule.dueDateForDelivery("2026-09-04T01:30:00Z");
    expect(new Date(due).toISOString()).toBe("2026-09-03T12:00:00.000Z");
  });

  it("lands on the same calendar day either side of the board", () => {
    const due = rule.dueDateForDelivery("2026-09-03T16:24:30Z");
    const day = (tz: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: tz, dateStyle: "short" }).format(new Date(due));
    expect(day("America/New_York")).toBe("2026-09-03");
    expect(day("Asia/Manila")).toBe("2026-09-03");
  });

  it("falls back to now when the event named no delivery time", () => {
    const now = Date.parse("2026-09-03T16:24:30Z");
    expect(rule.dueDateForDelivery(null, now)).toBe(Date.parse("2026-09-03T12:00:00Z"));
    expect(rule.dueDateForDelivery("not a date", now)).toBe(Date.parse("2026-09-03T12:00:00Z"));
  });
});

describe("the links on the card", () => {
  const order = rule.orderFromDetail(ORDER_ID, ORDER_DETAIL);

  it("prefers the link the event sent over a composed one", () => {
    const links = rule.taskLinks({ ...order, orderUrl: "https://admins.example.test/orders/1" });
    expect(links[0]).toEqual({ title: "Spiro order", url: "https://admins.example.test/orders/1" });
  });

  it("composes the admin link when the event carried none", () => {
    const links = rule.taskLinks(order, {} as NodeJS.ProcessEnv);
    expect(links[0]?.url).toBe(`https://admins.wowvideotours.com/orders/${ORDER_ID}`);
  });

  it("pins both delivery pages after the order", () => {
    expect(rule.taskLinks(order).map((l) => l.title)).toEqual([
      "Spiro order",
      "Delivery page (branded)",
      "Delivery page (unbranded)",
    ]);
  });

  it("offers no link it does not have", () => {
    const links = rule.taskLinks({
      ...order,
      orderId: "not-a-uuid",
      orderUrl: null,
      brandedUrl: null,
      unbrandedUrl: null,
    });
    expect(links).toEqual([]);
  });
});

describe("what the task says", () => {
  const order = rule.orderFromDetail(ORDER_ID, ORDER_DETAIL);

  it("titles by place, with the order reference", () => {
    expect(rule.buildTaskTitle(order)).toBe(
      "Add to Shopify — 107 S Main St, Monroe, NC 28112 (kqq180dyh)",
    );
  });

  it("falls back to the media title when there is no address", () => {
    expect(rule.buildTaskTitle({ ...order, address: null })).toBe(
      "Add to Shopify — Downtown Monroe (kqq180dyh)",
    );
  });

  it("carries the delivery links and the client", () => {
    const body = rule.buildTaskDescription(order);
    expect(body).toContain("107 S Main St, Monroe, NC 28112");
    expect(body).toContain("Joy Kiser · Air BnB");
    expect(body).toContain("branding=true");
    expect(body).toContain("branding=false");
    expect(body).toContain(ORDER_ID);
  });

  it("does not print the title as a separate fact when it is the address again", () => {
    const body = rule.buildTaskDescription({
      ...order,
      address: "300 Wayne Ave, Dayton, OH 45410",
      mediaTitle: "300 Wayne Ave, Dayton, OH 45410, USA",
    });
    expect(body).toContain("Property: 300 Wayne Ave, Dayton, OH 45410");
    expect(body).not.toContain("Title:");
  });

  it("still prints a title someone actually typed", () => {
    expect(rule.buildTaskDescription(order)).toContain("Title: Downtown Monroe");
  });

  it("prints the delivery time as a person reads it, in the business timezone", () => {
    expect(rule.formatDelivered("2026-09-03T16:24:30.8043146")).toBe("Sep 3, 2026, 12:24 PM EDT");
    expect(rule.buildTaskDescription(order)).toContain("Delivered: Aug 18, 2026,");
  });

  it("prints a delivery time it cannot parse rather than dropping the fact", () => {
    expect(rule.formatDelivered("sometime tuesday")).toBe("sometime tuesday");
  });

  it("never invents a Spiro web-app link", () => {
    expect(rule.buildTaskDescription(order)).not.toContain("app.spiro.media");
  });

  it("omits the lines it has no facts for", () => {
    const thin = rule.orderFromFacts({
      orderId: ORDER_ID,
      orderNumber: null,
      bundleName: "Wow Stock Media",
      eventName: null,
      address: null,
      mediaTitle: null,
      agentName: null,
      companyName: null,
      deliveredAt: null,
      orderUrl: null,
      deliveryUrl: null,
      unbrandedUrl: null,
    })!;
    const body = rule.buildTaskDescription(thin);
    expect(body).not.toContain("Client:");
    expect(body).not.toContain("Delivered:");
    expect(rule.buildTaskTitle(thin)).toBe("Add to Shopify — Stock media order");
  });
});

describe("raising the card", () => {
  it("creates the board once and files the task on it, assigned", async () => {
    const maricel = await users.createUser({
      username: "mdapac",
      password: "pw-for-test-only",
      role: "user",
      firstName: "Maricel",
      lastName: "Dapac",
      email: "maricel@example.test",
    });
    const order = rule.orderFromDetail(ORDER_ID, ORDER_DETAIL);

    const first = await rule.createStockMediaTask(order);
    expect(first.assigneeId).toBe(maricel.id);
    expect(first.task.assignedTo).toBe(maricel.id);
    expect(first.task.assigneeIds).toEqual([maricel.id]);
    expect(first.task.status).toBe("todo");
    expect(first.task.tags).toContain("shopify");

    const board = (await projects.listProjects()).find((p) => p.id === first.projectId);
    expect(board?.title).toBe(rule.SHOPIFY_PROJECT_TITLE);

    // A second delivery reuses the board rather than making a second one.
    const second = await rule.createStockMediaTask({ ...order, orderId: "other" });
    expect(second.projectId).toBe(first.projectId);
    expect(await projects.listProjects()).toHaveLength(1);
  });

  it("still files the task when nobody matches the configured assignee", async () => {
    const result = await rule.createStockMediaTask(rule.orderFromDetail(ORDER_ID, ORDER_DETAIL));
    expect(result.assigneeId).toBeNull();
    expect(result.task.id).toBeTruthy();
  });

  it("dates the card to the delivery day and pins the links", async () => {
    const order = {
      ...rule.orderFromDetail(ORDER_ID, ORDER_DETAIL),
      orderUrl: `https://admins.wowvideotours.com/orders/${ORDER_ID}`,
    };
    const result = await rule.createStockMediaTask(order);

    expect(new Date(result.task.dueDate!).toISOString()).toBe("2026-08-18T12:00:00.000Z");

    const pinned = await attachments.listAttachments("task", result.task.id);
    expect(pinned.map((a) => a.title)).toEqual([
      "Spiro order",
      "Delivery page (branded)",
      "Delivery page (unbranded)",
    ]);
    expect(pinned.every((a) => a.type === "link")).toBe(true);
    expect(pinned[0]?.url).toBe(`https://admins.wowvideotours.com/orders/${ORDER_ID}`);
  });

  it("honours an assignee override by email", async () => {
    const other = await users.createUser({
      username: "someone",
      password: "pw-for-test-only",
      role: "user",
      email: "listings@example.test",
    });
    process.env.SPIRO_STOCK_MEDIA_ASSIGNEE = "listings@example.test";
    const resolved = await rule.resolveAssignee(process.env);
    expect(resolved?.id).toBe(other.id);
  });
});
