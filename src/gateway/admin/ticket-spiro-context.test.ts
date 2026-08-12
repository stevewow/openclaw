import { describe, expect, it } from "vitest";
import {
  parseOrderIdFromPweLink,
  SPIRO_PARAM_MAPPINGS,
  readSpiroIntakeContext,
} from "./ticket-spiro-context.js";

describe("parseOrderIdFromPweLink", () => {
  it("reads a real Property Website Editor link", () => {
    // Verbatim from the Spiro delivery page's button — the shape that has to
    // keep working. The id sits mid-path, with a trailing verb after it.
    expect(
      parseOrderIdFromPweLink(
        "https://admins.wowvideotours.com/orders/0dfd55de-f0a7-4931-70ff-08deeef90f42/embed-pwe",
      ),
    ).toBe("0dfd55de-f0a7-4931-70ff-08deeef90f42");
  });

  it("pulls the order UUID out of the editor path", () => {
    // The shape Spiro's delivery/editor links use.
    expect(
      parseOrderIdFromPweLink(
        "https://view.wowvideotours.com/order/52d43a48-d116-4755-2312-08def6d513e4",
      ),
    ).toBe("52d43a48-d116-4755-2312-08def6d513e4");
    // Trailing verb and a query string must not get in the way.
    expect(
      parseOrderIdFromPweLink(
        "https://view.wowvideotours.com/order/52D43A48-D116-4755-2312-08DEF6D513E4/edit?branding=true",
      ),
    ).toBe("52d43a48-d116-4755-2312-08def6d513e4");
  });

  it("prefers an id stated outright in the query string", () => {
    expect(parseOrderIdFromPweLink("https://app.spiro.media/pwe?orderId=abc-123")).toBe("abc-123");
    expect(parseOrderIdFromPweLink("https://app.spiro.media/pwe?order=1hd790gj2&tab=media")).toBe(
      "1hd790gj2",
    );
  });

  it("falls back to a tracking-code style last segment", () => {
    expect(parseOrderIdFromPweLink("https://view.wowvideotours.com/order/1hd790gj2/pwe")).toBe(
      "1hd790gj2",
    );
    expect(parseOrderIdFromPweLink("/order/1hd790gj2")).toBe("1hd790gj2");
  });

  it("returns null rather than guessing at a link with no id in it", () => {
    expect(parseOrderIdFromPweLink("https://view.wowvideotours.com/")).toBeNull();
    expect(parseOrderIdFromPweLink("https://view.wowvideotours.com/order/x")).toBeNull();
    expect(parseOrderIdFromPweLink("")).toBeNull();
    expect(parseOrderIdFromPweLink(null)).toBeNull();
  });
});

describe("readSpiroIntakeContext", () => {
  const body = {
    requesterEmail: "sarah@sarahcopeland.com",
    agentFirstName: "Sarah",
    agentLastName: "Copeland",
    requesterPhone: "+15134050013",
    agentTitle: "Listing Specialist",
    orderAddress: "10555 Montgomery Rd unit # 96, Montgomery, OH 45242",
    submittedBy: "Steve Musser",
    agentCompany: "Keller Williams Advisors Realty Cincinnati",
    orderLink: "https://view.wowvideotours.com/order/52d43a48-d116-4755-2312-08def6d513e4/edit",
    photographerName: "Heather McHenry",
    shootDate: "2026-08-11",
  };

  it("maps the handoff onto ticket fields and derives the order id", () => {
    const ctx = readSpiroIntakeContext(body);
    expect(ctx.requesterName).toBe("Sarah Copeland");
    expect(ctx.requesterEmail).toBe("sarah@sarahcopeland.com");
    expect(ctx.agentCompany).toBe("Keller Williams Advisors Realty Cincinnati");
    expect(ctx.submittedBy).toBe("Steve Musser");
    expect(ctx.photographerName).toBe("Heather McHenry");
    expect(ctx.orderId).toBe("52d43a48-d116-4755-2312-08def6d513e4");
    expect(ctx.orderLink).toBe(body.orderLink);
  });

  it("lets a typed name and an explicit order id win over the link", () => {
    const ctx = readSpiroIntakeContext({
      ...body,
      requesterName: "Dana Assistant",
      orderId: "SAMPLE-1234",
    });
    expect(ctx.requesterName).toBe("Dana Assistant");
    expect(ctx.orderId).toBe("SAMPLE-1234");
  });

  it("reads blanks and absences as no context at all", () => {
    const ctx = readSpiroIntakeContext({ requesterName: "   ", agentCompany: "", orderLink: null });
    expect(ctx.requesterName).toBeNull();
    expect(ctx.agentCompany).toBeNull();
    expect(ctx.orderId).toBeNull();
    expect(ctx.shootDate).toBeNull();
  });

  it("covers every documented Spiro parameter", () => {
    // The contract Spiro builds its button against; dropping one silently would
    // strand that column on every ticket.
    expect(SPIRO_PARAM_MAPPINGS.map((m) => m.param).toSorted()).toEqual(
      [
        "AgentCompany",
        "AgentEmailAddress",
        "AgentFirstName",
        "AgentLastName",
        "AgentPhoneNumber",
        "AgentTitle",
        "DateOfShoot",
        "LinkToPWE",
        "ListingAddress",
        "PhotographerName",
        "SubmittedBy",
      ].toSorted(),
    );
  });
});
