import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The guide is the coach's whole world, so the two things worth pinning are
 * that it arrives intact and that it comes out in the same order every time.
 * The second is not cosmetic: the corpus is sent as a cached prompt block, and
 * a cache entry is keyed on an exact prefix. A guide that assembles in a
 * different order between two calls pays full price for both.
 */
describe("the sales guide", () => {
  let tmpDir: string;
  let store: typeof import("./coach-guide-store.js");
  let editorId: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "coach-guide-store-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    store = await import("./coach-guide-store.js");
    // A real row: updated_by carries a foreign key, so that an edit cannot be
    // attributed to somebody who does not exist.
    const users = await import("./user-store.js");
    editorId = (
      await users.createUser({ username: "dana", password: "pw-for-test-only", role: "admin" })
    ).id;
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("seeds both documents the team worked from", async () => {
    const docs = await store.listGuideDocs();
    expect(docs.map((d) => d.slug)).toEqual(["product-guide", "sales-scripts"]);
    expect(docs[0]?.sectionCount).toBeGreaterThan(30);
    expect(docs[1]?.sectionCount).toBeGreaterThan(30);
  });

  it("keeps the pricing that a salesperson would otherwise have to guess", async () => {
    const docs = await store.listGuideDocs();
    const sections = await store.listGuideSections(docs[0].id);
    const hdr = sections.find((s) => s.heading === "HDR Photography");
    expect(hdr).toBeTruthy();
    // The table, not a flattened list: a price with no square footage beside
    // it is worse than no price at all.
    expect(hdr?.bodyMd).toContain("| SQ. FT. | STANDARD PRICE |");
    expect(hdr?.bodyMd).toContain("| 0 - 2,000 | $160 |");
    expect(hdr?.bodyMd).toContain("| 7,501+ | $325 |");
    // And the objection responses, which are the reason anyone opens this.
    expect(hdr?.bodyMd).toContain("I can get cheaper photos");
  });

  it("keeps the two first-order calls apart", async () => {
    const docs = await store.listGuideDocs();
    const sections = await store.listGuideSections(docs[1].id);
    const headings = sections.map((s) => s.heading);
    // Both calls have a step 1 and step 2. Headings that dropped the call name
    // would collapse two different conversations into one.
    expect(headings).toContain(
      "New Clients — First Order Expectations Call: Introduction & Context",
    );
    expect(headings).toContain("New Clients — First Order Delivery Call: Check the Experience");
    expect(sections.some((s) => s.group === "VIP Clients")).toBe(true);
  });

  it("assembles the corpus identically on every call", async () => {
    const a = await store.guideCorpus();
    const b = await store.guideCorpus();
    expect(a.text).toBe(b.text);
    expect(a.sectionIds).toEqual(b.sectionIds);
    expect(a.text).toContain("# Product Guide");
    expect(a.text).toContain("# Sales Scripts");
    // Every section is addressable, which is what makes a citation checkable.
    expect(a.sectionIds.length).toBe(a.headings.size);
    expect(a.text).toContain(`<section id="${a.sectionIds[0]}">`);
    expect(a.approxTokens).toBeGreaterThan(5_000);
  });

  it("does not seed twice over an edited guide", async () => {
    const before = await store.listGuideDocs();
    const sections = await store.listGuideSections(before[0].id);
    await store.deleteGuideSection(sections[0].id);
    const after = await store.listGuideSections(before[0].id);
    expect(after.length).toBe(sections.length - 1);
    // A later read must not quietly put the deleted section back.
    await store.listGuideDocs();
    expect((await store.listGuideSections(before[0].id)).length).toBe(sections.length - 1);
  });

  it("edits a section, and the corpus follows", async () => {
    const docs = await store.listGuideDocs();
    const sections = await store.listGuideSections(docs[0].id);
    const target = sections.find((s) => s.heading === "WOW Essentials");
    expect(target).toBeTruthy();
    const updated = await store.updateGuideSection(
      target!.id,
      {
        bodyMd: "**PRICING**\n\n| SQ. FT. | STANDARD PRICE |\n| --- | --- |\n| 0 - 2,000 | $275 |",
      },
      editorId,
    );
    expect(updated?.bodyMd).toContain("$275");
    expect(updated?.updatedBy).toBe(editorId);
    const corpus = await store.guideCorpus();
    expect(corpus.text).toContain("$275");
  });

  it("refuses a section with no heading rather than storing a blank one", async () => {
    const docs = await store.listGuideDocs();
    expect(await store.createGuideSection(docs[0].id, { heading: "  ", bodyMd: "x" }, null)).toBe(
      null,
    );
  });

  it("reorders without losing a section the caller did not know about", async () => {
    const docs = await store.listGuideDocs();
    const before = await store.listGuideSections(docs[1].id);
    // A page opened before someone else added a section sends a short list.
    await store.reorderGuideSections(docs[1].id, [before[2].id, before[0].id]);
    const after = await store.listGuideSections(docs[1].id);
    expect(after.length).toBe(before.length);
    expect(after[0].id).toBe(before[2].id);
    expect(after[1].id).toBe(before[0].id);
  });
});
