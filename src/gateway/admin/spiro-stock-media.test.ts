import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-stock-media-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const rule = await import("./spiro-stock-media.js");
const projects = await import("./project-store.js");
const users = await import("./user-store.js");

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
      deliveryUrl: null,
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
