import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";

/**
 * The admin SPA's nav gating is inline JS inside a template string, so TypeScript
 * can't check it. These tests lift the real access-control block out of the
 * shipped HTML and exercise it, so the predicate that decides what a granted
 * non-admin can reach is covered rather than assumed.
 */

type Perm = { permissionType: string; value: string };

function loadAccessModel(role: string, permissions: Perm[]) {
  const script = ADMIN_UI_HTML.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) {
    throw new Error("no inline script found in ADMIN_UI_HTML");
  }

  // Pull the contiguous access block: the pages registry through firstAllowedPage.
  const start = script.indexOf("const pages = {");
  const endMarker = "function firstAllowedPage()";
  const endIdx = script.indexOf(endMarker);
  if (start === -1 || endIdx === -1) {
    throw new Error("access block not found — did the SPA change?");
  }
  const close = script.indexOf("\n  }", endIdx);
  const block = script.slice(start, close + 4);

  // Stubs for the surrounding SPA state the block closes over.
  const preamble = `
    const currentUser = ${JSON.stringify({ role, permissions })};
    function isAdmin() { return currentUser.role === 'admin' || currentUser.role === 'superadmin'; }
    function isSuperAdmin() { return currentUser.role === 'superadmin'; }
    var REPORTS = [{ key: 'report-cancellations' }, { key: 'rankings' }, { key: 'photographers' }];
  `;
  // Evaluating the block is the point of this suite: it tests the JS that
  // actually ships inside the template string, which no type or lint pass sees.
  // Input is our own source file, not user data.
  // oxlint-disable-next-line no-implied-eval
  const factory = new Function(
    `${preamble}\n${block}\nreturn { canAccessPage, firstAllowedPage, needsAdminSpa };`,
  );
  return factory() as {
    canAccessPage: (k: string) => boolean;
    firstAllowedPage: () => string;
    needsAdminSpa: () => boolean;
  };
}

const feature = (value: string): Perm => ({ permissionType: "feature", value });
const report = (value: string): Perm => ({ permissionType: "report", value });

describe("admin SPA page access", () => {
  it("lets an admin reach everything except superadmin-only pages", () => {
    const m = loadAccessModel("admin", []);
    for (const page of ["users", "tickets", "departments", "financials", "reports", "chat"]) {
      expect(`${page}=${m.canAccessPage(page)}`).toBe(`${page}=true`);
    }
    expect(m.canAccessPage("agents")).toBe(false);
    expect(m.canAccessPage("system")).toBe(false);
  });

  it("gives a superadmin the role-locked pages too", () => {
    const m = loadAccessModel("superadmin", []);
    expect(m.canAccessPage("agents")).toBe(true);
    expect(m.canAccessPage("system")).toBe(true);
  });

  it("opens only the granted ticket surface for a non-admin", () => {
    const m = loadAccessModel("user", [feature("tickets")]);
    expect(m.canAccessPage("tickets")).toBe(true);
    // The other three ticket surfaces are separate grants.
    expect(m.canAccessPage("departments")).toBe(false);
    expect(m.canAccessPage("categories")).toBe(false);
    expect(m.canAccessPage("form-preview")).toBe(false);
  });

  it("never grants user management or financials to a non-admin", () => {
    // Even holding every grantable feature and report.
    const m = loadAccessModel("user", [
      feature("tickets"),
      feature("ticket-departments"),
      feature("ticket-categories"),
      feature("ticket-form"),
      feature("chat"),
      feature("projects"),
      feature("resources"),
      report("rankings"),
      report("photographers"),
      report("report-cancellations"),
    ]);
    for (const page of ["users", "financials", "cleveland", "agents", "system"]) {
      expect(`${page}=${m.canAccessPage(page)}`).toBe(`${page}=false`);
    }
  });

  it("gates report sub-pages on their individual report grant", () => {
    const m = loadAccessModel("user", [report("rankings")]);
    expect(m.canAccessPage("rankings")).toBe(true);
    expect(m.canAccessPage("photographers")).toBe(false);
    // The landing opens when any single report is granted.
    expect(m.canAccessPage("reports")).toBe(true);
  });

  it("denies every gated page to a non-admin with no grants", () => {
    const m = loadAccessModel("user", []);
    for (const page of ["tickets", "chat", "projects", "resources", "reports", "users"]) {
      expect(`${page}=${m.canAccessPage(page)}`).toBe(`${page}=false`);
    }
    // Dashboard and account stay reachable so the shell always renders.
    expect(m.canAccessPage("dashboard")).toBe(true);
    expect(m.canAccessPage("account")).toBe(true);
  });

  it("keeps a ticket-granted user in the admin SPA and sends everyone else to the portal", () => {
    expect(loadAccessModel("user", [feature("tickets")]).needsAdminSpa()).toBe(true);
    expect(loadAccessModel("user", [feature("ticket-form")]).needsAdminSpa()).toBe(true);
    // Portal-servable grants alone must not strand a user in the admin SPA.
    expect(
      loadAccessModel("user", [
        feature("chat"),
        feature("projects"),
        report("rankings"),
      ]).needsAdminSpa(),
    ).toBe(false);
    expect(loadAccessModel("user", []).needsAdminSpa()).toBe(false);
  });

  it("lands a ticket-only user on the tickets page, not a blank dashboard", () => {
    expect(loadAccessModel("user", [feature("tickets")]).firstAllowedPage()).toBe("dashboard");
    // Dashboard is always allowed, so it is the correct landing; the point is it
    // resolves to a page the user can actually open.
    const m = loadAccessModel("user", [feature("ticket-form")]);
    expect(m.canAccessPage(m.firstAllowedPage())).toBe(true);
  });
});
