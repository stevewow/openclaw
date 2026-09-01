import { describe, expect, it } from "vitest";
import {
  extractBundleName,
  extractOrderId,
  extractOrderNumber,
  readHookFacts,
} from "./spiro-hook-payload.js";

const ORDER_ID = "b47d6967-b750-46e0-22ab-08def6d513e4";

/**
 * Spiro's own order-detail shape, trimmed from a live response. The important
 * trap is `lifecycle.finalVTaskId`: a real UUID for something that is not the
 * order, sitting in a payload that also names the order properly.
 */
const ORDER_DETAIL = {
  identity: { orderId: ORDER_ID, trackingCode: "kqq180dyh", mediaTitle: "Downtown Monroe" },
  lifecycle: {
    parentOrderId: "00000000-0000-0000-0000-000000000000",
    finalVTaskId: "4c83670e-7929-4df9-9561-6921a12f1dc3",
  },
  bundle: { name: "Wow Stock Media", description: "35-40 Photos" },
  property: { address: { fullAddress: "107 S Main St, Monroe, NC 28112" } },
  website: { brandedAssetUrl: `https://view.wowvideotours.com/order/${ORDER_ID}?branding=true` },
};

describe("order id", () => {
  it("prefers an explicit orderId over any other UUID in the payload", () => {
    expect(extractOrderId(ORDER_DETAIL)).toBe(ORDER_ID);
  });

  it("reads a thin envelope", () => {
    expect(extractOrderId({ event: "media.delivered", orderId: ORDER_ID })).toBe(ORDER_ID);
  });

  it("accepts order_id and orderID spellings", () => {
    expect(extractOrderId({ order_id: ORDER_ID })).toBe(ORDER_ID);
    expect(extractOrderId({ OrderID: ORDER_ID })).toBe(ORDER_ID);
  });

  it("takes a nested order.id but not a bare envelope id", () => {
    expect(extractOrderId({ order: { id: ORDER_ID } })).toBe(ORDER_ID);
    expect(extractOrderId({ id: ORDER_ID, order: { trackingCode: "abc" } })).toBeNull();
  });

  it("recovers the id from an order link when nothing names it", () => {
    expect(
      extractOrderId({ url: `https://view.wowvideotours.com/order/${ORDER_ID}?branding=true` }),
    ).toBe(ORDER_ID);
  });

  it("ignores a UUID that is not in an order link", () => {
    expect(extractOrderId({ taskId: "4c83670e-7929-4df9-9561-6921a12f1dc3" })).toBeNull();
  });

  it("treats the all-zero UUID as no value", () => {
    expect(extractOrderId({ orderId: "00000000-0000-0000-0000-000000000000" })).toBeNull();
  });

  it("returns null for a payload with nothing in it", () => {
    expect(extractOrderId({})).toBeNull();
    expect(extractOrderId(null)).toBeNull();
    expect(extractOrderId("not an object")).toBeNull();
  });
});

describe("bundle name", () => {
  it("reads bundle.name from the order shape", () => {
    expect(extractBundleName(ORDER_DETAIL)).toBe("Wow Stock Media");
  });

  it("reads a flat bundleName field", () => {
    expect(extractBundleName({ bundleName: "Wow Stock Media" })).toBe("Wow Stock Media");
  });

  it("reads a bundle given as a plain string", () => {
    // A `bundle` string has no `.name`, so the flat-key pass is what catches it.
    expect(extractBundleName({ bundle: "Wow Stock Media", bundleName: "Wow Stock Media" })).toBe(
      "Wow Stock Media",
    );
  });

  it("picks the purchased bundle out of a product list", () => {
    const payload = {
      products: [
        { name: "Wow Stock Media", kind: "addOn", source: "includedBundleService" },
        { name: "Wow Stock Media", kind: "bundle", source: "purchasedBundle" },
      ],
    };
    expect(extractBundleName(payload)).toBe("Wow Stock Media");
  });

  it("does not guess at a product list with no bundle marker", () => {
    expect(
      extractBundleName({ products: [{ name: "Twilight Photos", kind: "addOn" }] }),
    ).toBeNull();
  });

  it("prefers bundle.name over an unrelated name elsewhere", () => {
    const payload = { agent: { name: "Joy Kiser" }, bundle: { name: "Wow Stock Media" } };
    expect(extractBundleName(payload)).toBe("Wow Stock Media");
  });
});

describe("supporting facts", () => {
  it("reads the tracking code as the order number", () => {
    expect(extractOrderNumber(ORDER_DETAIL)).toBe("kqq180dyh");
    expect(extractOrderNumber({ orderNumber: "0wq90441h" })).toBe("0wq90441h");
  });

  it("reads every fact from one order-shaped payload", () => {
    const facts = readHookFacts(ORDER_DETAIL);
    expect(facts).toMatchObject({
      orderId: ORDER_ID,
      orderNumber: "kqq180dyh",
      bundleName: "Wow Stock Media",
      address: "107 S Main St, Monroe, NC 28112",
    });
    expect(facts.deliveryUrl).toContain("view.wowvideotours.com");
  });

  it("survives a payload of an unexpected shape", () => {
    const facts = readHookFacts({ nested: [[{ deep: { deeper: "value" } }]] });
    expect(facts.orderId).toBeNull();
    expect(facts.bundleName).toBeNull();
  });

  it("does not hang on a cyclic payload", () => {
    const cyclic: Record<string, unknown> = { orderId: ORDER_ID };
    cyclic.self = cyclic;
    expect(readHookFacts(cyclic).orderId).toBe(ORDER_ID);
  });
});
