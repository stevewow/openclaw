import { describe, expect, it } from "vitest";
import {
  formatShootDate,
  renderTicketEmailHtml,
  renderTicketEmailText,
  type TicketEmailView,
  ticketDetailRows,
} from "./ticket-email-render.js";
import type { Ticket } from "./ticket-store.js";

const BASE: Ticket = {
  id: "t1",
  number: "WVT-1042",
  replyToken: "wvt-1042",
  category: "edit_request",
  status: "new",
  priority: "medium",
  source: "widget",
  subject: "Brighten the kitchen photos",
  description: "The kitchen came back dark on three shots.",
  department: "editing",
  requesterName: "Sarah Copeland",
  requesterEmail: "sarah@sarahcopeland.com",
  requesterPhone: "+15134050013",
  orderId: "52d43a48-d116-4755-2312-08def6d513e4",
  orderAddress: "10555 Montgomery Rd, Montgomery, OH 45242",
  orderLink: "https://view.wowvideotours.com/order/52d43a48-d116-4755-2312-08def6d513e4/edit",
  agentTitle: "Listing Specialist",
  agentCompany: "Keller Williams Advisors Realty Cincinnati",
  submittedBy: "Steve Musser",
  photographerName: "Heather McHenry",
  shootDate: "2026-08-11",
  assignedTo: null,
  isTest: false,
  notifyClient: true,
  feedbackToken: null,
  feedbackRating: null,
  feedbackComment: null,
  feedbackAt: null,
  estimateCents: 7500,
  estimateMaxCents: null,
  quoteRequired: false,
  createdAt: 1_786_500_000_000,
  updatedAt: 1_786_500_000_000,
  resolvedAt: null,
};

const view = (
  over: Partial<Ticket> = {},
  rest: Partial<TicketEmailView> = {},
): TicketEmailView => ({
  ticket: { ...BASE, ...over },
  categoryLabel: "Edit request",
  attachments: [],
  ...rest,
});

describe("ticketDetailRows", () => {
  it("carries the Spiro handoff onto the summary, Order Link included", () => {
    const labels = ticketDetailRows(view()).map((r) => r.label);
    expect(labels).toEqual([
      "Request",
      "From",
      "Company",
      "Email",
      "Phone",
      "Submitted by",
      "Property",
      "Order",
      "Order Link",
      "Photographer",
      "Shoot date",
      "Estimate",
    ]);
    const link = ticketDetailRows(view()).find((r) => r.label === "Order Link")!;
    expect(link.href).toBe(BASE.orderLink);
  });

  it("drops rows with nothing to say rather than showing them empty", () => {
    const rows = ticketDetailRows(
      view({
        agentTitle: null,
        agentCompany: null,
        orderLink: null,
        photographerName: null,
        shootDate: null,
        requesterPhone: null,
        estimateCents: null,
      }),
    );
    expect(rows.map((r) => r.label)).toEqual([
      "Request",
      "From",
      "Email",
      "Submitted by",
      "Property",
      "Order",
    ]);
  });

  it("omits the submitter when it is just the requester again", () => {
    const rows = ticketDetailRows(view({ submittedBy: "Sarah Copeland" }));
    expect(rows.some((r) => r.label === "Submitted by")).toBe(false);
  });

  it("shows a ranged estimate as the band the client saw, flagged for quoting", () => {
    const rows = ticketDetailRows(
      view({ estimateCents: 5000, estimateMaxCents: 15000, quoteRequired: true }),
    );
    expect(rows.find((r) => r.label === "Estimate")!.value).toBe(
      "$50–$150 — quote before starting",
    );
  });
});

describe("formatShootDate", () => {
  it("reads a date-only string on the day it was written", () => {
    expect(formatShootDate("2026-08-11")).toBe("Tue, Aug 11, 2026");
  });

  it("passes an unparseable date through untouched", () => {
    expect(formatShootDate("sometime next week")).toBe("sometime next week");
    expect(formatShootDate(null)).toBeNull();
  });
});

describe("renderTicketEmailText", () => {
  it("leads with the ticket and keeps the reply grammar", () => {
    const body = renderTicketEmailText(view());
    expect(body).toContain("WVT-1042 — Edit request");
    expect(body).toContain("Brighten the kitchen photos");
    expect(body).toContain("10555 Montgomery Rd");
    expect(body).toContain("UPDATE");
    expect(body).toContain("RESOLVED");
    expect(body).not.toContain("TEST TICKET");
  });

  it("names attached files and says where the oversized ones live", () => {
    const body = renderTicketEmailText(
      view(
        {},
        {
          attachments: [
            { filename: "kitchen.jpg", filesize: 240_000, attached: true },
            { filename: "walkthrough.pdf", filesize: 9_000_000, attached: false },
          ],
        },
      ),
    );
    expect(body).toContain("kitchen.jpg (234 KB) — attached to this email");
    expect(body).toContain("walkthrough.pdf (8.6 MB) — too large to attach");
    expect(body).toContain("dashboard");
  });

  it("marks a test ticket unmistakably", () => {
    expect(renderTicketEmailText(view({ isTest: true }))).toContain("TEST TICKET");
  });
});

describe("renderTicketEmailHtml", () => {
  it("renders a self-contained table-based body with the details in it", () => {
    const html = renderTicketEmailHtml(view());
    expect(html).toContain("WVT-1042");
    expect(html).toContain("Keller Williams Advisors Realty Cincinnati");
    expect(html).toContain("Order Link");
    expect(html).toContain(`href="${BASE.orderLink}"`);
    expect(html).toContain("Heather McHenry");
    // Outlook renders neither of these, so neither may be load-bearing.
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("<style");
  });

  it("escapes what a client typed instead of letting it become markup", () => {
    const html = renderTicketEmailHtml(
      view({ description: '<script>alert("x")</script>', requesterName: "A & B <b>" }),
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B &lt;b&gt;");
  });
});

describe("the masthead", () => {
  const LOGO = "https://hub.wowvideotours.com/support/logo.png";

  it("shows the logo when one is available", () => {
    const html = renderTicketEmailHtml(view({}, { logoUrl: LOGO }));
    expect(html).toContain(`src="${LOGO}"`);
    // Blocked images are the norm in Outlook until a sender is trusted, so the
    // alt text has to carry the brand rather than render as broken-image text.
    expect(html).toContain('alt="WOW Video Tours"');
  });

  it("falls back to the typeset wordmark when there is no logo URL", () => {
    const html = renderTicketEmailHtml(view({}, { logoUrl: null }));
    expect(html).not.toContain("<img");
    expect(html).toContain(">WOW<");
    expect(html).toContain(">Video Tours<");
  });
});

describe("what they need", () => {
  /** Real composeDescription output for a priced multi-select. */
  const ITEMIZED = [
    "Which services?",
    "  • Virtual staging ×3 — $150 ($50 per image)",
    "      Preferred style: Modern",
    "  • Item removal ×2 — $50–$150 ($25–$75 per photo)  [QUOTE FIRST]",
    "  Starts right away: $150",
    "  Estimated total: $200–$300",
    "  ** Send a quote and get it accepted before starting the quoted items. **",
    "",
    "Before Friday please.",
  ].join("\n");

  function html(description: string | null): string {
    return renderTicketEmailHtml(view({ description }));
  }

  // The complaint this answers: everything arrived as one pre-wrapped blob, so
  // choices, prices, answers and the client's message ran together.
  it("lays the choices out as rows instead of one wrapped block", () => {
    const out = html(ITEMIZED);
    expect(out).not.toContain("white-space:pre-wrap");
    expect(out).toContain("Virtual staging ×3");
    expect(out).toContain("$150 ($50 per image)");
    expect(out).toContain("Preferred style:");
    expect(out).toContain("Modern");
  });

  it("marks the line that cannot start before a quote is accepted", () => {
    const out = html(ITEMIZED);
    expect(out).toContain("Quote first");
    expect(out).toContain("Send a quote and get it accepted");
  });

  it("keeps the client's own words in their own block", () => {
    const out = html(ITEMIZED);
    expect(out).toContain("Before Friday please.");
    // The prose is quoted, not folded into the itemized rows.
    expect(out).toContain("border-left:3px solid");
  });

  it("renders a hand-written ticket as prose, losing nothing", () => {
    const out = html("Client called about the drone shots.\n\nReshoot Tuesday.");
    expect(out).toContain("Client called about the drone shots.");
    expect(out).toContain("Reshoot Tuesday.");
  });

  it("says so plainly when there are no details at all", () => {
    expect(html(null)).toContain("(no details provided)");
  });

  it("escapes a description that contains markup", () => {
    const out = html("<script>alert(1)</script>");
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&lt;script&gt;");
  });

  // The plain-text body carries the description verbatim: if the parser ever
  // fails to recognize a shape, the desk still receives everything.
  it("leaves the plain-text body carrying the description as written", () => {
    const text = renderTicketEmailText(view({ description: ITEMIZED }));
    expect(text).toContain(ITEMIZED);
  });
});
