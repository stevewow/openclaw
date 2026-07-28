import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-churn-notes-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./churn-notes-store.js");
const userStore = await import("./user-store.js");

let deskId: string;

beforeAll(async () => {
  deskId = (await userStore.createUser({ username: "desk", password: "x", role: "admin" })).id;
});

afterEach(async () => {
  for (const n of await store.listChurnNotes()) {
    await store.deleteChurnNote(n.id);
  }
});

describe("churn notes store", () => {
  it("records the note with who wrote it", async () => {
    const note = await store.addChurnNote({
      agentKey: "guid-1",
      agentName: "Dana Reyes",
      companyName: "Coldwell Banker Heritage",
      body: "Called — listing again in spring.",
      byUserId: deskId,
      byUserName: "desk",
      now: 1_700_000_000_000,
    });
    expect(note).toMatchObject({
      agentKey: "guid-1",
      agentName: "Dana Reyes",
      companyName: "Coldwell Banker Heritage",
      body: "Called — listing again in spring.",
      createdBy: deskId,
      createdByName: "desk",
      createdAt: 1_700_000_000_000,
    });
    expect(await store.listChurnNotes()).toEqual([note]);
  });

  it("appends rather than replacing, newest first", async () => {
    await store.addChurnNote({ agentKey: "a", agentName: "A", body: "first", now: 10 });
    await store.addChurnNote({ agentKey: "a", agentName: "A", body: "third", now: 30 });
    await store.addChurnNote({ agentKey: "a", agentName: "A", body: "second", now: 20 });
    expect((await store.listChurnNotes()).map((n) => n.body)).toEqual(["third", "second", "first"]);
  });

  it("filters to one agent", async () => {
    await store.addChurnNote({ agentKey: "a", agentName: "A", body: "for A", now: 1 });
    await store.addChurnNote({ agentKey: "b", agentName: "B", body: "for B", now: 2 });
    const forA = await store.listChurnNotesForAgent("a");
    expect(forA).toHaveLength(1);
    expect(forA[0]?.body).toBe("for A");
  });

  it("trims the body and caps its length", async () => {
    const note = await store.addChurnNote({
      agentKey: "a",
      agentName: "A",
      body: `  ${"x".repeat(2500)}  `,
    });
    expect(note.body).toHaveLength(2000);
  });

  it("deletes one note, and reports when the id was unknown", async () => {
    const note = await store.addChurnNote({ agentKey: "a", agentName: "A", body: "typo" });
    expect(await store.deleteChurnNote(note.id)).toBe(true);
    expect(await store.listChurnNotes()).toEqual([]);
    expect(await store.deleteChurnNote(note.id)).toBe(false);
  });
});
