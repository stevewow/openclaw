import { describe, expect, it } from "vitest";
import {
  actionForKey,
  bucketForDays,
  isPastDueActionKey,
  PAST_DUE_ACTIONS,
  PAST_DUE_BUCKETS,
  policyAction,
  resolveAction,
} from "./past-due-policy.js";

describe("the collections sequence", () => {
  it("is ordered, and its step numbers are 1..n with no gaps", () => {
    // The picker prints these numbers to show the order, so a gap or a repeat
    // would be visible to whoever is working the queue.
    expect(PAST_DUE_ACTIONS.map((a) => a.step)).toEqual([1, 2, 3, 4]);
  });

  it("runs oldest-debt-last: each step belongs to a later aging bucket", () => {
    const bucketRank = new Map(PAST_DUE_BUCKETS.map((b, i) => [b, i]));
    const ranks = PAST_DUE_ACTIONS.map((a) => bucketRank.get(a.bucket));
    expect(ranks).toEqual([...ranks].toSorted((x, y) => (x ?? 0) - (y ?? 0)));
  });

  it("covers every bucket exactly once, so no age is left without a step", () => {
    expect(PAST_DUE_ACTIONS.map((a) => a.bucket).toSorted()).toEqual(
      [...PAST_DUE_BUCKETS].toSorted(),
    );
  });

  it("gives every bucket a step, and the step matches the bucket", () => {
    for (const bucket of PAST_DUE_BUCKETS) {
      expect(policyAction(bucket).bucket).toBe(bucket);
    }
  });

  it("recognizes its own keys and nothing else", () => {
    for (const a of PAST_DUE_ACTIONS) {
      expect(isPastDueActionKey(a.key)).toBe(true);
      expect(actionForKey(a.key).label).toBe(a.label);
    }
    for (const bad of ["done", "", null, undefined, 3, "email_46"]) {
      expect(isPastDueActionKey(bad)).toBe(false);
    }
  });
});

describe("resolveAction", () => {
  it("follows the aging policy when nothing is pinned", () => {
    const resolved = resolveAction("60-89", null);
    expect(resolved.key).toBe(policyAction("60-89").key);
    expect(resolved.source).toBe("policy");
    expect(resolved.policyKey).toBe(resolved.key);
  });

  it("uses the pinned step, and still reports what the age called for", () => {
    // An account worked ahead of its age: the email already went out early, so
    // the collector pinned the 60-day call while aging still says 45-59.
    const resolved = resolveAction("45-59", "call_60");
    expect(resolved.key).toBe("call_60");
    expect(resolved.step).toBe(2);
    expect(resolved.source).toBe("override");
    // The disagreement stays visible rather than being overwritten.
    expect(resolved.policyKey).toBe("email_45");
  });

  it("can pin a step behind the account's age", () => {
    const resolved = resolveAction("120+", "email_45");
    expect(resolved.key).toBe("email_45");
    expect(resolved.policyKey).toBe("letter_120");
    expect(resolved.source).toBe("override");
  });

  it("carries the label and detail of whichever step won", () => {
    const pinned = resolveAction("45-59", "letter_120");
    expect(pinned.label).toBe(actionForKey("letter_120").label);
    expect(pinned.detail).toBe(actionForKey("letter_120").detail);
  });
});

describe("bucketForDays", () => {
  it("has no bucket below the collections floor", () => {
    expect(bucketForDays(0)).toBeNull();
    expect(bucketForDays(44)).toBeNull();
  });

  it("starts at 45 and every boundary lands in its own bucket", () => {
    expect(bucketForDays(45)).toBe("45-59");
    expect(bucketForDays(59)).toBe("45-59");
    expect(bucketForDays(60)).toBe("60-89");
    expect(bucketForDays(89)).toBe("60-89");
    expect(bucketForDays(90)).toBe("90-119");
    expect(bucketForDays(119)).toBe("90-119");
    expect(bucketForDays(120)).toBe("120+");
    expect(bucketForDays(4000)).toBe("120+");
  });
});
