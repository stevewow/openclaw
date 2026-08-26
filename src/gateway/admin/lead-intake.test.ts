import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  fieldKey,
  hasContact,
  parseLeadPayload,
  prettyLabel,
  verifyFramerSignature,
} from "./lead-intake.js";

describe("reading a website form submission", () => {
  it("fills the columns from the names a form is likely to use", () => {
    const parsed = parseLeadPayload({
      "Full Name": "Dana Reyes",
      email_address: "dana@brokerage.com",
      phoneNumber: "(614) 555-0111",
      brokerage: "Keller Williams Capital",
      market: "Columbus",
      "How can we help": "Need photos and a walkthrough for a listing next week.",
    });
    expect(parsed.name).toBe("Dana Reyes");
    expect(parsed.email).toBe("dana@brokerage.com");
    expect(parsed.phone).toBe("(614) 555-0111");
    expect(parsed.company).toBe("Keller Williams Capital");
    expect(parsed.market).toBe("Columbus");
    expect(parsed.message).toContain("walkthrough");
    expect(parsed.fields).toEqual([]);
  });

  it("joins a first and last name when the form splits them", () => {
    const parsed = parseLeadPayload({ firstName: "Dana", lastName: "Reyes", email: "d@x.com" });
    expect(parsed.name).toBe("Dana Reyes");
  });

  it("carries every unrecognized answer through instead of dropping it", () => {
    const parsed = parseLeadPayload({
      email: "d@x.com",
      listingsPerYear: "24",
      "Preferred start": "Next month",
    });
    expect(parsed.fields).toEqual([
      { label: "Listings per year", value: "24" },
      { label: "Preferred start", value: "Next month" },
    ]);
  });

  it("flattens a multi-select into one line", () => {
    const parsed = parseLeadPayload({
      email: "d@x.com",
      services: ["Photos", "Video", "Floor plan"],
    });
    expect(parsed.fields).toEqual([{ label: "Services", value: "Photos, Video, Floor plan" }]);
  });

  it("does not let a lookalike field steal a column from the plainly named one", () => {
    const parsed = parseLeadPayload({
      emailOptIn: "yes",
      email: "dana@brokerage.com",
    });
    expect(parsed.email).toBe("dana@brokerage.com");
    expect(parsed.fields).toEqual([{ label: "Email opt in", value: "yes" }]);
  });

  it("still finds a market asked about in a sentence", () => {
    const parsed = parseLeadPayload({
      email: "d@x.com",
      whichMarketAreYouIn: "Fort Wayne",
    });
    expect(parsed.market).toBe("Fort Wayne");
  });

  it("ignores the form's own plumbing", () => {
    const parsed = parseLeadPayload({ email: "d@x.com", formId: "abc123", recaptcha: "token" });
    expect(parsed.fields).toEqual([]);
  });

  it("keeps the page and the form name as context rather than as answers", () => {
    const parsed = parseLeadPayload({
      email: "d@x.com",
      formName: "Request a quote",
      pageUrl: "https://wowvideotours.com/pricing",
    });
    expect(parsed.formName).toBe("Request a quote");
    expect(parsed.pageUrl).toBe("https://wowvideotours.com/pricing");
    expect(parsed.fields).toEqual([]);
  });

  it("requires a way to reach somebody", () => {
    expect(hasContact(parseLeadPayload({ name: "Dana" }))).toBe(false);
    expect(hasContact(parseLeadPayload({ name: "Dana", phone: "6145550111" }))).toBe(true);
    expect(hasContact(parseLeadPayload({ email: "d@x.com" }))).toBe(true);
  });

  it("folds field names the way two spellings of one field would meet", () => {
    expect(fieldKey("Full Name")).toBe("fullname");
    expect(fieldKey("full_name")).toBe("fullname");
    expect(fieldKey("fullName")).toBe("fullname");
  });

  it("turns a field name into a label a person would write", () => {
    expect(prettyLabel("brokerageName")).toBe("Brokerage name");
    expect(prettyLabel("preferred_start")).toBe("Preferred start");
  });
});

describe("Framer webhook signatures", () => {
  const secret = "a".repeat(32);
  const body = Buffer.from(JSON.stringify({ email: "dana@brokerage.com" }));
  const submissionId = "0f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8";
  const sign = (b: Buffer, id: string): string =>
    `sha256=${crypto.createHmac("sha256", secret).update(b).update(id).digest("hex")}`;

  it("accepts a signature over the raw body and the submission id", () => {
    expect(
      verifyFramerSignature({
        rawBody: body,
        submissionId,
        header: sign(body, submissionId),
        secret,
      }),
    ).toBe(true);
  });

  it("rejects a body that changed in flight", () => {
    expect(
      verifyFramerSignature({
        rawBody: Buffer.from(JSON.stringify({ email: "attacker@example.com" })),
        submissionId,
        header: sign(body, submissionId),
        secret,
      }),
    ).toBe(false);
  });

  it("rejects a signature replayed under another submission id", () => {
    expect(
      verifyFramerSignature({
        rawBody: body,
        submissionId: "99999999-9999-9999-9999-999999999999",
        header: sign(body, submissionId),
        secret,
      }),
    ).toBe(false);
  });

  it("rejects a missing or malformed header rather than throwing", () => {
    expect(verifyFramerSignature({ rawBody: body, submissionId, header: undefined, secret })).toBe(
      false,
    );
    expect(
      verifyFramerSignature({ rawBody: body, submissionId, header: "sha256=zzzz", secret }),
    ).toBe(false);
    expect(
      verifyFramerSignature({ rawBody: body, submissionId, header: "sha256=ab", secret }),
    ).toBe(false);
  });
});
