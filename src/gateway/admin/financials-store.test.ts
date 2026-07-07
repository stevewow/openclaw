import { describe, expect, it } from "vitest";
import {
  bucketForDays,
  PAST_DUE_BUCKETS,
  paymentPlanTerms,
  policyAction,
} from "./financials-store.js";

describe("bucketForDays", () => {
  it("maps day counts to the correct collections-policy bucket at each boundary", () => {
    expect(bucketForDays(1)).toBe("1-44");
    expect(bucketForDays(44)).toBe("1-44");
    expect(bucketForDays(45)).toBe("45-59");
    expect(bucketForDays(59)).toBe("45-59");
    expect(bucketForDays(60)).toBe("60-89");
    expect(bucketForDays(89)).toBe("60-89");
    expect(bucketForDays(90)).toBe("90-119");
    expect(bucketForDays(119)).toBe("90-119");
    expect(bucketForDays(120)).toBe("120+");
    expect(bucketForDays(400)).toBe("120+");
  });

  it("has a policy action for every bucket", () => {
    for (const bucket of PAST_DUE_BUCKETS) {
      const action = policyAction(bucket);
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.detail.length).toBeGreaterThan(0);
    }
  });

  it("surfaces BDS + collections referral only in the escalated buckets", () => {
    expect(policyAction("60-89").detail).toMatch(/BDS/);
    expect(policyAction("120+").detail).toMatch(/collections/i);
    expect(policyAction("1-44").detail).not.toMatch(/BDS/);
  });
});

describe("paymentPlanTerms", () => {
  it("requires 10% down", () => {
    expect(paymentPlanTerms(1000).requiredDown).toBe(100);
    expect(paymentPlanTerms(2500).requiredDown).toBe(250);
  });

  it("caps the plan at 3 months under $1,000 and 6 months at/over $1,000", () => {
    expect(paymentPlanTerms(999.99).maxMonths).toBe(3);
    expect(paymentPlanTerms(1000).maxMonths).toBe(6);
    expect(paymentPlanTerms(5000).maxMonths).toBe(6);
  });

  it("rounds the down payment to cents", () => {
    expect(paymentPlanTerms(333.33).requiredDown).toBe(33.33);
  });
});
