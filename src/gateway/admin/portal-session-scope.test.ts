import { describe, expect, it } from "vitest";
import { portalUserSessionPrefix, sessionKeyBelongsToPortalUser } from "./portal-session-scope.js";

const UID = "ca436ffe-4d07-4062-a44d-ae46541404ba";
const OTHER = "ca436ffe-4d07-4062-a44d-ae46541404bb";

describe("portal session scope", () => {
  it("derives a stable, lowercase per-user prefix", () => {
    expect(portalUserSessionPrefix(UID)).toBe(`u-${UID}`);
    expect(portalUserSessionPrefix(UID.toUpperCase())).toBe(`u-${UID}`);
  });

  it("matches the user's own default and namespaced sub-sessions", () => {
    expect(sessionKeyBelongsToPortalUser(`agent:main:u-${UID}`, UID)).toBe(true);
    expect(sessionKeyBelongsToPortalUser(`agent:sales:u-${UID}`, UID)).toBe(true);
    expect(sessionKeyBelongsToPortalUser(`agent:main:u-${UID}-project-x`, UID)).toBe(true);
    expect(sessionKeyBelongsToPortalUser(`agent:main:u-${UID}:project-x`, UID)).toBe(true);
  });

  it("does not match the shared main session or another user's sessions", () => {
    expect(sessionKeyBelongsToPortalUser("agent:main:main", UID)).toBe(false);
    expect(sessionKeyBelongsToPortalUser(`agent:main:u-${OTHER}`, UID)).toBe(false);
  });

  it("does not let a prefix bleed into a longer id (u-abc vs u-abcd)", () => {
    expect(sessionKeyBelongsToPortalUser("agent:main:u-abcd", "abc")).toBe(false);
    expect(sessionKeyBelongsToPortalUser("agent:main:u-abc", "abc")).toBe(true);
  });

  it("rejects malformed / non-agent keys", () => {
    expect(sessionKeyBelongsToPortalUser("", UID)).toBe(false);
    expect(sessionKeyBelongsToPortalUser("subagent:foo", UID)).toBe(false);
    expect(sessionKeyBelongsToPortalUser("agent:main", UID)).toBe(false);
  });
});
