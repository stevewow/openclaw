import { describe, expect, it } from "vitest";
import { spiroAdminBaseUrl, spiroInvoiceUrl } from "./spiro-links.js";

const ID = "52dfa04c-682e-4dfb-a165-848875809d07";

describe("spiroAdminBaseUrl", () => {
  it("falls back to the tenant admin host when unset", () => {
    expect(spiroAdminBaseUrl({})).toBe("https://admins.wowvideotours.com");
    expect(spiroAdminBaseUrl({ SPIRO_ADMIN_BASE_URL: "  " })).toBe(
      "https://admins.wowvideotours.com",
    );
  });

  it("honors an override and strips trailing slashes", () => {
    expect(spiroAdminBaseUrl({ SPIRO_ADMIN_BASE_URL: "https://other.example.com/" })).toBe(
      "https://other.example.com",
    );
    expect(spiroAdminBaseUrl({ SPIRO_ADMIN_BASE_URL: "https://other.example.com///" })).toBe(
      "https://other.example.com",
    );
  });
});

describe("spiroInvoiceUrl", () => {
  it("builds a pending-invoice link with the id upper-cased, as Spiro writes it", () => {
    expect(spiroInvoiceUrl(ID, {})).toBe(
      "https://admins.wowvideotours.com/invoices/clients/pending-invoices/52DFA04C-682E-4DFB-A165-848875809D07",
    );
  });

  it("does not double the slash when the base URL carries one", () => {
    expect(spiroInvoiceUrl(ID, { SPIRO_ADMIN_BASE_URL: "https://x.example.com/" })).toBe(
      "https://x.example.com/invoices/clients/pending-invoices/52DFA04C-682E-4DFB-A165-848875809D07",
    );
  });

  it("returns null for anything that is not a UUID, so it renders as plain text", () => {
    expect(spiroInvoiceUrl("", {})).toBeNull();
    expect(spiroInvoiceUrl("WVT076170", {})).toBeNull();
    expect(spiroInvoiceUrl("../../etc/passwd", {})).toBeNull();
    expect(spiroInvoiceUrl(`${ID}/extra`, {})).toBeNull();
  });
});
