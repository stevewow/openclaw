import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("feedback store", () => {
  let tmpDir: string;
  let store: typeof import("./feedback-store.js");

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "feedback-store-test-"));
    process.env.OPENCLAW_STATE_DIR = tmpDir;
    store = await import("./feedback-store.js");
  });

  afterAll(() => {
    delete process.env.OPENCLAW_STATE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const base = () => ({
    source: ["Employee Feedback"],
    categories: [store.FEEDBACK_CATEGORIES[0]],
    body: "The drone SD card was full.",
  });

  it("files a submission and hands back a readable reference", async () => {
    const entry = await store.createFeedback(base());
    expect(entry.reference).toMatch(/^FB-\d{4}$/);
    expect(entry.status).toBe("to_review");
    expect(entry.body).toBe("The drone SD card was full.");
    expect(entry.source).toEqual(["Employee Feedback"]);
  });

  it("numbers references from the highest existing one, not the row count", async () => {
    const first = await store.createFeedback(base());
    const second = await store.createFeedback(base());
    const n = (r: string) => Number(/^FB-(\d+)$/.exec(r)?.[1]);
    expect(n(second.reference)).toBe(n(first.reference) + 1);

    // Deleting the newest must not hand its number to the next submission:
    // two entries sharing a reference is exactly what a count-based series does.
    await store.deleteFeedback(second.id);
    const third = await store.createFeedback(base());
    expect(third.reference).not.toBe(second.reference);
    expect(n(third.reference)).toBe(n(second.reference) + 1);
  });

  it("drops labels the form does not offer", async () => {
    // The public page is unauthenticated, so a tampered payload must not be
    // able to invent a category, a source or a service.
    const entry = await store.createFeedback({
      source: ["Employee Feedback", "Executive Feedback"],
      categories: [store.FEEDBACK_CATEGORIES[0], "Made Up Category"],
      body: "hello",
      selectedServices: ["Aerials", "Skywriting"],
    });
    expect(entry.source).toEqual(["Employee Feedback"]);
    expect(entry.categories).toEqual([store.FEEDBACK_CATEGORIES[0]]);
    expect(entry.selectedServices).toEqual(["Aerials"]);
  });

  it("keeps a roster name but refuses one that is not on the roster", async () => {
    const known = await store.createFeedback({ ...base(), submittedBy: "Joy Kiser" });
    expect(known.submittedBy).toBe("Joy Kiser");
    const unknown = await store.createFeedback({ ...base(), submittedBy: "Somebody Else" });
    expect(unknown.submittedBy).toBeNull();
  });

  it("keeps a typed name from the public form", async () => {
    const entry = await store.createFeedback({ ...base(), submittedByName: "  Dana Reed  " });
    expect(entry.submittedByName).toBe("Dana Reed");
  });

  it("updates rather than duplicates when the same ClickUp task is imported twice", async () => {
    const first = await store.createFeedback({ ...base(), clickupId: "cu-1", body: "first" });
    const second = await store.createFeedback({ ...base(), clickupId: "cu-1", body: "corrected" });
    expect(second.id).toBe(first.id);
    expect(second.reference).toBe(first.reference);
    expect(second.body).toBe("corrected");
    const all = await store.listFeedback();
    expect(all.filter((e) => e.clickupId === "cu-1")).toHaveLength(1);
  });

  it("preserves the original submission time on import", async () => {
    const when = Date.UTC(2025, 2, 19, 13, 59);
    const entry = await store.createFeedback({ ...base(), clickupId: "cu-2", createdAt: when });
    expect(entry.createdAt).toBe(when);
  });

  it("maps ClickUp's statuses onto ours and parks anything unknown", () => {
    expect(store.statusFromClickUp("to review")).toBe("to_review");
    expect(store.statusFromClickUp("appointment availability")).toBe("appointment_availability");
    expect(store.statusFromClickUp("Complete")).toBe("complete");
    expect(store.statusFromClickUp("something new")).toBe("to_review");
    expect(store.statusFromClickUp(null)).toBe("to_review");
  });

  it("filters by status, category and free text", async () => {
    const marked = await store.createFeedback({
      ...base(),
      body: "unmistakable-needle here",
      categories: [store.APPOINTMENT_CATEGORY],
    });
    await store.setFeedbackStatus(marked.id, "billing");

    expect((await store.listFeedback({ status: "billing" })).map((e) => e.id)).toContain(marked.id);
    expect(
      (await store.listFeedback({ category: store.APPOINTMENT_CATEGORY })).map((e) => e.id),
    ).toContain(marked.id);
    const hits = await store.listFeedback({ search: "UNMISTAKABLE-NEEDLE" });
    expect(hits.map((e) => e.id)).toEqual([marked.id]);
  });

  it("counts a submission once per status and once per category it carries", async () => {
    const summary = await store.getFeedbackSummary();
    const total = summary.byStatus.reduce((n, s) => n + s.count, 0);
    expect(total).toBe(summary.total);
  });

  it("takes attachments off with the submission they came on", async () => {
    const entry = await store.createFeedback(base());
    await store.addFeedbackAttachment(entry.id, { filename: "shot.png", mimeType: "image/png" });
    const withFile = await store.getFeedback(entry.id);
    expect(withFile?.attachments).toHaveLength(1);
    expect(withFile?.attachments[0]?.filename).toBe("shot.png");

    await store.deleteFeedback(entry.id);
    expect(await store.getFeedback(entry.id)).toBeNull();
  });
});
