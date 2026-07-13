// The two tools the intake brain calls: quote_order (catalog estimate) and
// submit_order_draft (completeness check + handoff). Both are pure/local — no
// external calls — matching the sealed-funnel design.

import { Type } from "typebox";
import { quote, type QuoteRequest } from "./estimator.js";
import { handoff, type HandoffSender } from "./handoff.js";
import type { OrderDraft } from "./order-draft.js";

const AddOnSchema = Type.Object({
  id: Type.String({ description: "Service id from the catalog (e.g. silver-aerial, twilight)." }),
  quantity: Type.Optional(
    Type.Number({
      description: "Image count for per-image add-ons (twilight, virtual-staging, green-grass-*).",
    }),
  ),
});

export function createQuoteTool() {
  return {
    name: "quote_order",
    label: "Quote Order",
    description:
      "Compute a standard-catalog price estimate for a selection. Returns line items, subtotal, flags (e.g. missing quantity), and escalations (custom-quote cases). Prices are estimates, not final.",
    parameters: Type.Object({
      squareFeet: Type.Optional(
        Type.Number({ description: "Property square footage — gates all tiered pricing." }),
      ),
      bundleId: Type.Optional(Type.String({ description: "Chosen bundle id, if any." })),
      singleServiceIds: Type.Optional(
        Type.Array(Type.String(), {
          description: "Base services ordered on their own (standalone pricing).",
        }),
      ),
      addOns: Type.Optional(Type.Array(AddOnSchema, { description: "Add-ons (add-on pricing)." })),
    }),
    async execute(_id: string, params: QuoteRequest) {
      const result = quote({
        squareFeet: params.squareFeet,
        bundleId: params.bundleId,
        singleServiceIds: params.singleServiceIds,
        addOns: params.addOns,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  };
}

export function createSubmitTool(sender: HandoffSender) {
  return {
    name: "submit_order_draft",
    label: "Submit Order Draft",
    description:
      "Hand a completed order draft to the WOW team. Runs a completeness check and delivers a formatted team notification. Call this only after the client has agreed to the terms of service.",
    parameters: Type.Object({
      draft: Type.Unknown({
        description: "The full OrderDraft object collected during the conversation.",
      }),
    }),
    async execute(_id: string, params: { draft: OrderDraft }) {
      const { notification, result } = await handoff(params.draft, sender);
      return {
        content: [
          {
            type: "text",
            text: notification.complete
              ? `Handed off to the WOW team via ${sender.channel}.\n\n${notification.text}`
              : `Draft is missing: ${notification.missing.join(", ")}. Notification sent anyway (marked incomplete).\n\n${notification.text}`,
          },
        ],
        details: { ...result, complete: notification.complete, missing: notification.missing },
      };
    },
  };
}
