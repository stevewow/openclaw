import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-outreach-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./outreach-templates-store.js");

const ACCOUNT = {
  accountName: "Cowan Realtors",
  balance: 1250.5,
  invoiced: 2000,
  paid: 749.5,
  invoiceCount: 3,
  oldestDaysPastDue: 67,
  bucket: "60-89",
  action: { label: "Final notice" },
  paymentPlan: { requiredDown: 125.05, maxMonths: 6 },
  lastContact: { at: new Date(2026, 5, 10).getTime() },
  case: { assignedToName: "Casey Ruiz" },
};

describe("renderTemplate", () => {
  const ctx = store.mergeContextFor({
    account: ACCOUNT,
    senderName: "Steve",
    now: new Date(2026, 6, 31).getTime(),
  });

  it("fills the fields a collector actually needs", () => {
    const out = store.renderTemplate(
      "Hi {{account}}, {{balance}} is {{days_past_due}} days past due. — {{me}}",
      ctx,
    );
    expect(out).toBe("Hi Cowan Realtors, $1,250.50 is 67 days past due. — Steve");
  });

  it("formats money rather than dumping a raw float", () => {
    // A collector pasting "1250.5" into an email is exactly what this prevents.
    expect(store.renderTemplate("{{balance}} / {{plan_down}}", ctx)).toBe("$1,250.50 / $125.05");
  });

  it("tolerates spacing and case inside the braces", () => {
    expect(store.renderTemplate("{{ ACCOUNT }} {{Bucket}}", ctx)).toBe("Cowan Realtors 60-89");
  });

  it("leaves an unknown field visible instead of blanking it", () => {
    // A gap you can see beats a silent empty string in something being sent out.
    const out = store.renderTemplate("Call {{account}} about {{nonsense}}", ctx);
    expect(out).toBe("Call Cowan Realtors about {{nonsense}}");
    expect(store.unresolvedFields("Call {{account}} about {{nonsense}}", ctx)).toEqual([
      "nonsense",
    ]);
  });

  it("says when an account has never been contacted", () => {
    const fresh = store.mergeContextFor({
      account: { ...ACCOUNT, lastContact: null },
      senderName: "Steve",
    });
    expect(store.renderTemplate("{{last_contact}}", fresh)).toBe("no previous contact");
  });

  it("names an unassigned account rather than leaving a hole", () => {
    const un = store.mergeContextFor({
      account: { ...ACCOUNT, case: { assignedToName: null } },
      senderName: "Steve",
    });
    expect(store.renderTemplate("{{owner}}", un)).toBe("unassigned");
  });
});

describe("templates CRUD", () => {
  it("stores and lists a script", async () => {
    const t = await store.createTemplate({
      title: "First reminder",
      kind: "call",
      body: "Hi {{account}}",
      buckets: ["1-44"],
      userId: null,
      userName: "Steve",
    });
    expect(t.buckets).toEqual(["1-44"]);
    const list = await store.listTemplates();
    expect(list.map((x) => x.id)).toContain(t.id);
  });

  it("drops a subject on anything that is not an email", async () => {
    const t = await store.createTemplate({
      title: "Call one",
      kind: "call",
      subject: "should not stick",
      body: "text",
      userId: null,
      userName: null,
    });
    expect(t.subject).toBeNull();
    const email = await store.createTemplate({
      title: "Email one",
      kind: "email",
      subject: "Your account",
      body: "text",
      userId: null,
      userName: null,
    });
    expect(email.subject).toBe("Your account");
  });

  it("refuses a script with no title or no text", async () => {
    await expect(
      store.createTemplate({ title: "  ", kind: "call", body: "x", userId: null, userName: null }),
    ).rejects.toThrow(/title/i);
    await expect(
      store.createTemplate({ title: "T", kind: "call", body: "   ", userId: null, userName: null }),
    ).rejects.toThrow(/text/i);
  });

  it("hides an inactive script from collectors but keeps it for admins", async () => {
    const t = await store.createTemplate({
      title: "Retired",
      kind: "call",
      body: "old wording",
      active: false,
      userId: null,
      userName: null,
    });
    const forCollectors = await store.listTemplates();
    expect(forCollectors.map((x) => x.id)).not.toContain(t.id);
    const forAdmins = await store.listTemplates({ includeInactive: true });
    expect(forAdmins.map((x) => x.id)).toContain(t.id);
  });

  it("edits and deletes", async () => {
    const t = await store.createTemplate({
      title: "Temp",
      kind: "call",
      body: "a",
      userId: null,
      userName: null,
    });
    const updated = await store.updateTemplate(t.id, {
      title: "Renamed",
      kind: "email",
      subject: "Subj",
      body: "b",
    });
    expect(updated?.title).toBe("Renamed");
    expect(updated?.subject).toBe("Subj");
    await store.deleteTemplate(t.id);
    expect(await store.getTemplate(t.id)).toBeNull();
  });

  it("reports a missing template rather than inventing one", async () => {
    expect(await store.updateTemplate("nope", { title: "x", kind: "call", body: "y" })).toBeNull();
  });

  it("rejects a kind it does not know", () => {
    expect(store.isOutreachKind("email")).toBe(true);
    expect(store.isOutreachKind("smoke_signal")).toBe(false);
  });
});
