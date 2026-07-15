import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-ticket-dept-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const dept = await import("./ticket-department-store.js");
const store = await import("./ticket-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("department seeding", () => {
  it("seeds the four defaults and category routes, idempotently", async () => {
    await dept.ensureDepartmentSeed();
    await dept.ensureDepartmentSeed(); // second call must not duplicate
    const departments = await dept.listDepartments();
    expect(departments.map((d) => d.key)).toEqual(["editing", "operations", "billing", "general"]);
    const routes = await dept.getCategoryRoutes();
    expect(routes.edit_request).toBe("editing");
    expect(routes.missing_media).toBe("operations");
    expect(routes.other).toBe("general");
  });
});

describe("routing drives new tickets", () => {
  it("uses the routes table, and reroutes when an admin changes it", async () => {
    // Seeded route: additional_service -> operations.
    const t1 = await store.createTicket({ category: "additional_service", subject: "add aerials" });
    expect(t1.department).toBe("operations");

    // Add a department and reroute the category to it.
    const aerial = await dept.createDepartment({ label: "Aerial Team", email: "aerial@wow.co" });
    expect(aerial.key).toBe("aerial-team");
    await dept.setCategoryRoute("additional_service", aerial.key);

    const t2 = await store.createTicket({
      category: "additional_service",
      subject: "more aerials",
    });
    expect(t2.department).toBe("aerial-team");
    expect(await dept.getDepartmentEmail("aerial-team")).toBe("aerial@wow.co");
  });
});

describe("department CRUD", () => {
  it("edits an address and deletes a department, repointing its routes", async () => {
    await dept.updateDepartment("billing", { email: "billing@wow.co" });
    expect(await dept.getDepartmentEmail("billing")).toBe("billing@wow.co");

    const tmp = await dept.createDepartment({ label: "Temp Desk" });
    await dept.setCategoryRoute("other", tmp.key);
    expect((await dept.getCategoryRoutes()).other).toBe(tmp.key);

    await dept.deleteDepartment(tmp.key);
    expect(await dept.getDepartment(tmp.key)).toBeNull();
    // Its route falls back to general so routing stays valid.
    expect((await dept.getCategoryRoutes()).other).toBe("general");
  });

  it("slugs labels into stable keys", () => {
    expect(dept.departmentKeyFromLabel("Aerial & Drone Team!")).toBe("aerial-drone-team");
  });
});
