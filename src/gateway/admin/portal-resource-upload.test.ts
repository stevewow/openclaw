import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * The portal decides what a contributor sees from inline JS inside a template
 * string, which no type or lint pass reads. These lift the real predicates out
 * of the shipped page and run them, so the rules that put an upload button in
 * front of someone are covered rather than assumed.
 *
 * The server enforces the same grant independently (see admin-http-authz);
 * these cover only what the page offers.
 */

type Perm = { permissionType: string; value: string };

const NAV = `
  <a class="nav-link" data-feature="chat"></a>
  <a class="nav-link" data-feature="projects"></a>
  <a class="nav-link" data-feature="reports"></a>
  <a class="nav-link" data-feature="resources"></a>
`;

function loadPortalAccess(permissions: Perm[], userId = "u-me") {
  const script = USER_PORTAL_HTML.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) {
    throw new Error("no inline script found in USER_PORTAL_HTML");
  }

  const start = script.indexOf("function canSeeResources()");
  const endIdx = script.indexOf("function firstAllowedPage()");
  if (start === -1 || endIdx === -1) {
    throw new Error("portal access block not found — did the portal change?");
  }
  const access = script.slice(start, script.indexOf("\n  }", endIdx) + 4);

  // Ownership lives down in the resources section, away from the access block.
  const ownStart = script.indexOf("function ownResource(r)");
  if (ownStart === -1) {
    throw new Error("ownResource not found — did the portal change?");
  }
  const own = script.slice(ownStart, script.indexOf("\n  }", ownStart) + 4);

  const dom = new JSDOM(`<!DOCTYPE html><nav>${NAV}</nav>`);
  const preamble = `
    var currentUser = ${JSON.stringify({ id: userId, permissions })};
    function hasFeature(f) { return currentUser.permissions.some(function(p) {
      return p.permissionType === 'feature' && p.value === f; }); }
    function anyReportGranted() { return false; }
  `;
  // Evaluating the shipped block is the point of this suite; the input is our
  // own source file, not user data.
  // oxlint-disable-next-line no-implied-eval
  const factory = new Function(
    "document",
    `${preamble}\n${access}\n${own}\nreturn { canSeeResources, canUploadResources, applyAccess, firstAllowedPage, ownResource };`,
  );
  const model = factory(dom.window.document) as {
    canSeeResources: () => boolean;
    canUploadResources: () => boolean;
    applyAccess: () => void;
    firstAllowedPage: () => string;
    ownResource: (r: { createdBy: string | null }) => boolean;
  };
  const navVisible = () => {
    model.applyAccess();
    return Array.from(dom.window.document.querySelectorAll(".nav-link"))
      .filter((a) => (a as HTMLElement).style.display !== "none")
      .map((a) => (a as HTMLElement).dataset.feature);
  };
  return { ...model, navVisible };
}

const feature = (value: string): Perm => ({ permissionType: "feature", value });

describe("the portal's resource upload grant", () => {
  it("opens the library for a holder granted nothing else", () => {
    // Uploading into a section its holder cannot open would be a dead end, so
    // the upload grant carries its own way in.
    const m = loadPortalAccess([feature("resource-upload")]);
    expect(m.canSeeResources()).toBe(true);
    expect(m.navVisible()).toEqual(["resources"]);
    expect(m.firstAllowedPage()).toBe("resources");
  });

  it("leaves a reader reading", () => {
    const m = loadPortalAccess([feature("resources")]);
    expect(m.canSeeResources()).toBe(true);
    expect(m.canUploadResources()).toBe(false);
  });

  it("keeps the library shut for someone holding neither grant", () => {
    const m = loadPortalAccess([feature("chat")]);
    expect(m.canSeeResources()).toBe(false);
    expect(m.navVisible()).toEqual(["chat"]);
  });

  it("offers edit controls on one's own uploads only", () => {
    const m = loadPortalAccess([feature("resource-upload")], "u-me");
    expect(m.ownResource({ createdBy: "u-me" })).toBe(true);
    expect(m.ownResource({ createdBy: "u-them" })).toBe(false);
    // Seeded and admin-uploaded resources carry no author at all.
    expect(m.ownResource({ createdBy: null })).toBe(false);
  });

  it("drops those controls the moment the grant is revoked", () => {
    // Otherwise a revoked contributor keeps buttons that the server refuses.
    const m = loadPortalAccess([feature("resources")], "u-me");
    expect(m.ownResource({ createdBy: "u-me" })).toBe(false);
  });

  it("wires the upload modal to elements that exist", () => {
    // The modal's listeners are attached at page load, unconditionally. One
    // id that no longer matches its markup throws there and takes the whole
    // portal script down with it — not just the upload button.
    const script = USER_PORTAL_HTML.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
    const referenced = new Set(
      [...script.matchAll(/getElementById\('(pr-[a-z-]+)'\)/g)].map((m) => m[1]),
    );
    const declared = new Set([...USER_PORTAL_HTML.matchAll(/id="(pr-[a-z-]+)"/g)].map((m) => m[1]));
    expect(referenced.size).toBeGreaterThan(0);
    expect([...referenced].filter((id) => !declared.has(id))).toEqual([]);
  });

  it("puts the Add Resource button behind the same predicate", () => {
    // The toolbar is built inside an async loader that reaches for the network,
    // so the guard is asserted where it is written.
    expect(USER_PORTAL_HTML).toContain("canUploadResources() && !portalFavoritesOnly");
    expect(USER_PORTAL_HTML).toContain("portalAddResource()");
  });
});
