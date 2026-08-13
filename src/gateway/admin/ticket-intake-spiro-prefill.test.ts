import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { type IntakeCategoryView, renderTicketIntakeHtml } from "./ticket-intake-html.js";

/**
 * The client's side of the Spiro handoff: a delivery-page button opens the form
 * with the order's context in the query string, and the form has to fill in
 * what it already knows and carry the rest through to the submission. The page
 * is inline JS in a template string, so the only way to prove it works is to
 * run it against a real DOM.
 */

const CATEGORY: IntakeCategoryView = {
  key: "other",
  label: "Something else",
  iconSvg: '<svg viewBox="0 0 24 24"></svg>',
  extraField: "none",
  extraLabel: null,
  extraOptions: [],
  extraPlaceholder: null,
  detailsLabel: "Details",
  detailsHint: null,
};

/** A link exactly as the Spiro delivery page builds it. */
const PWE_LINK =
  "https://admins.wowvideotours.com/orders/0dfd55de-f0a7-4931-70ff-08deeef90f42/embed-pwe";
const SPIRO_QUERY = new URLSearchParams({
  AgentEmailAddress: "sarah@sarahcopeland.com",
  AgentFirstName: "Sarah",
  AgentLastName: "Copeland",
  AgentPhoneNumber: "+1 513 405 0013",
  AgentTitle: "Listing Specialist",
  ListingAddress: "10555 Montgomery Rd unit # 96, Montgomery, OH 45242",
  SubmittedBy: "Steve Musser",
  AgentCompany: "Keller Williams Advisors Realty Cincinnati",
  LinkToPWE: PWE_LINK,
  PhotographerName: "Heather McHenry",
  DateOfShoot: "2026-08-11",
}).toString();

function openForm(query: string) {
  const html = renderTicketIntakeHtml([CATEGORY]);
  const dom = new JSDOM(html, {
    url: `https://example.com/support?${query}`,
    runScripts: "outside-only",
  });
  const win = dom.window as unknown as Record<string, unknown> & {
    document: Document;
    eval: (code: string) => unknown;
    Event: typeof Event;
  };
  const posts: Array<Record<string, unknown>> = [];
  win.fetch = (_url: string, init: { body: string }) => {
    posts.push(JSON.parse(init.body) as Record<string, unknown>);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true, number: "WVT-1042" }),
    });
  };
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!script?.[1]) {
    throw new Error("no inline script on the intake page");
  }
  win.eval(script[1]);

  const doc = win.document;
  const value = (id: string) => (doc.getElementById(id) as HTMLInputElement).value;
  return {
    doc,
    posts,
    value,
    ctx: () => (doc.getElementById("ctx") as HTMLElement).textContent ?? "",
    ctxHidden: () => (doc.getElementById("ctx") as HTMLElement).classList.contains("hidden"),
    setValue(id: string, next: string) {
      const el = doc.getElementById(id) as HTMLInputElement;
      el.value = next;
      el.dispatchEvent(new win.Event("input", { bubbles: true }));
    },
    async submit() {
      this.setValue("f-details", "The twilight shot is missing.");
      doc
        .getElementById("intake-form")!
        .dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

describe("the Spiro delivery-page handoff", () => {
  it("fills in the contact details the link already carried", () => {
    const ui = openForm(SPIRO_QUERY);
    expect(ui.value("f-name")).toBe("Sarah Copeland");
    expect(ui.value("f-email")).toBe("sarah@sarahcopeland.com");
    expect(ui.value("f-phone")).toBe("+1 513 405 0013");
  });

  it("confirms which shoot the request will be linked to", () => {
    const ui = openForm(SPIRO_QUERY);
    expect(ui.ctxHidden()).toBe(false);
    expect(ui.ctx()).toContain("10555 Montgomery Rd");
    expect(ui.ctx()).toContain("Heather McHenry");
  });

  it("carries the order context through to the submission", async () => {
    const ui = openForm(SPIRO_QUERY);
    await ui.submit();
    expect(ui.posts).toHaveLength(1);
    const body = ui.posts[0] ?? {};
    expect(body.orderLink).toBe(PWE_LINK);
    expect(body.agentCompany).toBe("Keller Williams Advisors Realty Cincinnati");
    expect(body.agentTitle).toBe("Listing Specialist");
    expect(body.submittedBy).toBe("Steve Musser");
    expect(body.photographerName).toBe("Heather McHenry");
    expect(body.shootDate).toBe("2026-08-11");
    expect(body.orderAddress).toBe("10555 Montgomery Rd unit # 96, Montgomery, OH 45242");
    // Derived server-side from the link, so the page must not assert one.
    expect(body.orderId).toBeNull();
  });

  it("lets the client correct what the link got wrong", async () => {
    const ui = openForm(SPIRO_QUERY);
    ui.setValue("f-email", "assistant@kw.com");
    await ui.submit();
    expect((ui.posts[0] ?? {}).requesterEmail).toBe("assistant@kw.com");
  });

  it("reads the parameters whatever case they arrive in", () => {
    const ui = openForm(
      "agentfirstname=Sarah&AGENTLASTNAME=Copeland&linktopwe=" + encodeURIComponent(PWE_LINK),
    );
    expect(ui.value("f-name")).toBe("Sarah Copeland");
  });

  it("still works from the older orderId/address link", async () => {
    const ui = openForm("orderId=SAMPLE-1234&address=123+Example+St");
    expect(ui.ctx()).toContain("123 Example St");
    // The old link carries no contact details, so the client types them.
    ui.setValue("f-name", "Dana Agent");
    ui.setValue("f-email", "dana@example.com");
    await ui.submit();
    expect((ui.posts[0] ?? {}).orderId).toBe("SAMPLE-1234");
    expect((ui.posts[0] ?? {}).orderAddress).toBe("123 Example St");
  });

  it("shows no context banner when the form is opened cold", () => {
    const ui = openForm("");
    expect(ui.ctxHidden()).toBe(true);
    expect(ui.value("f-name")).toBe("");
  });
});
