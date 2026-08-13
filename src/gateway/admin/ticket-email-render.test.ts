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
