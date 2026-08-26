import { describe, expect, it } from "vitest";
import {
  ATTEMPTS_BEFORE_STANDARD,
  getPlaybook,
  listPlaybooks,
  matchPlaybook,
  personalizeOpener,
  STANDARD_CADENCE,
} from "./lead-playbooks.js";

describe("matching a submission to its playbook", () => {
  it("matches each of the three forms by the name Framer sends", () => {
    expect(matchPlaybook({ formName: "Getting Ready Guide" })?.key).toBe("getting_ready_guide");
    expect(matchPlaybook({ formName: "Pricing List" })?.key).toBe("pricing_list");
    expect(matchPlaybook({ formName: "Listing Presentation Template" })?.key).toBe(
      "listing_presentation",
    );
  });

  it("is not thrown by how the form name is punctuated or cased", () => {
    expect(matchPlaybook({ formName: "getting-ready-guide-2026" })?.key).toBe(
      "getting_ready_guide",
    );
    expect(matchPlaybook({ formName: "  PRICING  LIST  " })?.key).toBe("pricing_list");
  });

  it("falls back to the landing page when the form has no name", () => {
    expect(
      matchPlaybook({ formName: null, pageUrl: "https://wowvideotours.com/pricing-list" })?.key,
    ).toBe("pricing_list");
  });

  it("falls back to an answer naming what they downloaded", () => {
    expect(
      matchPlaybook({ fields: [{ label: "Resource", value: "Listing presentation template" }] })
        ?.key,
    ).toBe("listing_presentation");
  });

  it("prefers the form's own name over a page that says otherwise", () => {
    // The form name is a deliberate label; a URL can be a campaign landing page
    // that happens to mention another magnet.
    expect(
      matchPlaybook({
        formName: "Getting Ready Guide",
        pageUrl: "https://wowvideotours.com/pricing",
      })?.key,
    ).toBe("getting_ready_guide");
  });

  it("answers nothing when a submission names two magnets", () => {
    // An opener aimed at the wrong signal is worse than no opener: the owner
    // reads it as what we know about this person.
    expect(matchPlaybook({ formName: "Pricing List and Getting Ready Guide" })).toBeNull();
  });

  it("answers nothing for a form that is none of the three", () => {
    expect(matchPlaybook({ formName: "Contact us" })).toBeNull();
    expect(matchPlaybook({})).toBeNull();
  });
});

describe("the playbooks themselves", () => {
  it("carries three sources, each with an opener, a soft close and three steps", () => {
    const all = listPlaybooks();
    expect(all).toHaveLength(3);
    for (const p of all) {
      expect(p.signal.length).toBeGreaterThan(0);
      expect(p.opener).toContain("Taylor with WOW Video Tours");
      expect(p.softClose.length).toBeGreaterThan(0);
      expect(p.steps).toHaveLength(ATTEMPTS_BEFORE_STANDARD);
      expect(p.steps.map((s) => s.step)).toEqual([1, 2, 3]);
    }
  });

  it("opens the weeks-out signal with an email and the imminent one with a call", () => {
    // The whole point of three playbooks: a call on a listing-presentation lead
    // is disproportionate to the signal.
    expect(getPlaybook("listing_presentation")?.steps[0].channel).toBe("email");
    expect(getPlaybook("getting_ready_guide")?.steps[0].channel).toBe("call");
    expect(getPlaybook("getting_ready_guide")?.steps[0].when).toBe("Within 1 hour");
  });

  it("describes the standard follow-up in a sentence that reads inside another one", () => {
    expect(`move to the standard follow-up — ${STANDARD_CADENCE.detail}.`).toContain("quarterly");
  });
});

describe("the opener", () => {
  it("uses their first name", () => {
    expect(personalizeOpener("Hey [Name], Taylor here.", "Dana Reyes")).toBe(
      "Hey Dana, Taylor here.",
    );
  });

  it("is left as written when we have no name to use", () => {
    // Better a bracket the owner fills in than "Hey , Taylor here."
    expect(personalizeOpener("Hey [Name], Taylor here.", null)).toBe("Hey [Name], Taylor here.");
    expect(personalizeOpener("Hey [Name], Taylor here.", "   ")).toBe("Hey [Name], Taylor here.");
  });
});
