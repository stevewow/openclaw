import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { renderTicketIntakeHtml } from "./ticket-intake-html.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/** One request type of each shape, so every branch of the form's JS is emitted. */
const INTAKE_CATEGORIES = [
  {
    key: "edit_request",
    label: "Edit request",
    extraField: "select" as const,
    extraLabel: "Which media?",
    extraOptions: [
      {
        label: "Photos",
        imageUrl: null,
        priceCents: null,
        priceMaxCents: null,
        quoteRequired: false,
        unitLabel: null,
        maxQuantity: 1,
        followUps: [],
      },
      {
        label: "Aerial / Drone",
        imageUrl: null,
        priceCents: null,
        priceMaxCents: null,
        quoteRequired: false,
        unitLabel: null,
        maxQuantity: 1,
        followUps: [],
      },
    ],
    extraPlaceholder: null,
    detailsLabel: "What change would you like?",
    detailsHint: "Be specific.",
  },
  {
    key: "additional_service",
    label: "Additional service",
    extraField: "text" as const,
    extraLabel: "Which service?",
    extraOptions: [],
    extraPlaceholder: "Virtual staging",
    detailsLabel: "Tell us more",
    detailsHint: null,
  },
  {
    key: "extras",
    label: "Order an additional service",
    extraField: "multiselect" as const,
    extraLabel: "Which services?",
    extraOptions: [
      {
        label: "Virtual staging",
        imageUrl: "https://example.com/staging.jpg",
        priceCents: 5000,
        priceMaxCents: null,
        quoteRequired: false,
        unitLabel: "per image",
        maxQuantity: 10,
        followUps: [
          {
            id: "style",
            label: "Preferred style",
            kind: "select" as const,
            choices: ["Modern", "Farmhouse"],
            placeholder: null,
            required: true,
          },
          {
            id: "rooms",
            label: "Which image numbers / rooms?",
            kind: "textarea" as const,
            choices: [],
            placeholder: "e.g. images 3, 7 and 12",
            required: true,
          },
        ],
      },
      {
        label: "Twilight edit",
        imageUrl: null,
        priceCents: 7500,
        priceMaxCents: 15000,
        quoteRequired: true,
        unitLabel: null,
        maxQuantity: 1,
        followUps: [],
      },
    ],
    extraPlaceholder: null,
    detailsLabel: "Anything else?",
    detailsHint: null,
  },
  {
    key: "other",
    label: "Something else",
    extraField: "none" as const,
    extraLabel: null,
    extraOptions: [],
    extraPlaceholder: null,
    detailsLabel: "How can we help?",
    detailsHint: null,
  },
];

/**
 * Both SPAs ship as one giant template literal, which no type or lint pass
 * reads as code. Without this, a stray brace or a backtick in a CSS comment
 * ships a blank page with every other test still green.
 *
 * `admin-ui-tracker-shell.test.ts` already parses the admin script as a side
 * effect of driving it; the portal had no such cover at all.
 */
describe("SPA scripts parse", () => {
  for (const [name, html] of [
    ["admin dashboard", ADMIN_UI_HTML],
    ["user portal", USER_PORTAL_HTML],
    // The public intake form is the one page a client sees; a syntax error here
    // is a dead Submit button on an unauthenticated page nobody on staff loads.
    ["support intake form", renderTicketIntakeHtml(INTAKE_CATEGORIES)],
  ] as const) {
    it(`the ${name} script is syntactically valid`, () => {
      const script = /<script>([\s\S]*)<\/script>/.exec(html);
      expect(script).not.toBeNull();
      // oxlint-disable-next-line no-implied-eval
      expect(() => new Function((script as RegExpExecArray)[1])).not.toThrow();
    });
  }
});
