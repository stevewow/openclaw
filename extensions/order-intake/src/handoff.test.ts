import { describe, expect, it } from "vitest";
import { StubHandoffSender, formatHandoff, handoff } from "./handoff.js";
import { checkCompleteness, type OrderDraft } from "./order-draft.js";

function completeDraft(): OrderDraft {
  return {
    service: { bundleId: "wow-essentials" },
    property: {
      address: "850 E Dorothy Ln, Kettering OH 45419",
      listingPrice: 425000,
      squareFeet: 2400,
      vacancy: "occupied",
    },
    addOns: [{ id: "silver-aerial" }, { id: "twilight", quantity: 3 }],
    agent: {
      firstName: "Wendy",
      lastName: "Klawon",
      phone: "(555) 123-4567",
      email: "wendy@example.com",
      companyName: "Coldwell Banker Heritage",
    },
    customAnswers: {
      appointmentInfoAndFilmingInstructions: "Highlight the renovated kitchen; avoid the garage.",
    },
    entry: { method: "lockbox" },
    scheduling: { kind: "asap" },
    termsAgreed: true,
  };
}

describe("order-intake handoff (M0 loop)", () => {
  it("marks a fully-filled draft complete", () => {
    expect(checkCompleteness(completeDraft()).complete).toBe(true);
  });

  it("lists missing fields on a partial draft and keeps going", () => {
    const d = completeDraft();
    d.termsAgreed = false;
    delete (d.agent as { email?: string }).email;
    const r = checkCompleteness(d);
    expect(r.complete).toBe(false);
    expect(r.missing).toContain("termsAgreed");
    expect(r.missing).toContain("agent.email");
  });

  it("formats the notification with the $479 estimate and no blocking flags", () => {
    const n = formatHandoff(completeDraft());
    expect(n.complete).toBe(true);
    expect(n.text).toContain("$479");
    expect(n.text).toContain("NEW ORDER DRAFT · 850 E Dorothy Ln");
    expect(n.text).toContain("Flags     none blocking");
  });

  it("drives the full loop through the stub sender", async () => {
    const sender = new StubHandoffSender();
    const { notification, result } = await handoff(completeDraft(), sender);
    expect(result.ok).toBe(true);
    expect(sender.last).toBe(notification);
    expect(sender.log).toHaveLength(1);
  });

  it("surfaces escalations in the notification (Matterport 9,000 sqft)", () => {
    const d = completeDraft();
    d.service = { singleServiceIds: ["matterport-3d"] };
    d.property.squareFeet = 9000;
    d.addOns = [];
    const n = formatHandoff(d);
    expect(n.escalations.length).toBeGreaterThan(0);
    expect(n.text).toContain("quote pending");
  });
});
