import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Point the admin DB at an isolated temp dir before the store singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-pd-cleanup-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./pipedrive-cleanup-store.js");
const userStore = await import("./user-store.js");

let admin: string;
let va: string;

function sampleItems(): store.CleanupImportItem[] {
  return [
    {
      itemKey: "lima:merge:4267",
      kind: "merge",
      title: "Berkshire Hathaway Home Services Lima",
      detail: "Merge #3968 into #4267; set Office = Lima.",
      office: "Lima",
      verify: false,
      payload: { survivorId: 4267, loserIds: [3968] },
    },
    {
      itemKey: "lima:fill:4109",
      kind: "fill",
      title: "Alexander Realty Services",
      detail: "Set Office = Lima.",
      office: "Lima",
    },
  ];
}

beforeAll(async () => {
  admin = (await userStore.createUser({ username: "admin", password: "x", role: "admin" })).id;
  va = (await userStore.createUser({ username: "va", password: "x", role: "user" })).id;
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("pipedrive cleanup store", () => {
  it("imports suggestions idempotently and never disturbs decided items", async () => {
    const first = await store.importCleanupItems("Lima", sampleItems());
    expect(first).toEqual({ added: 2, updated: 0, skipped: 0 });

    // Re-import while still suggested updates descriptive fields in place.
    const changed = sampleItems();
    changed[0]!.detail = "Merge #3968 into #4267; set Office = Lima — verified.";
    const second = await store.importCleanupItems("Lima", changed);
    expect(second).toEqual({ added: 0, updated: 2, skipped: 0 });
    let items = await store.listCleanupItems({ includeSuggested: true });
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.itemKey === "lima:merge:4267")!.detail).toContain("verified");

    // Approve one, then a re-import must skip it (not reset to suggested).
    const merge = items.find((i) => i.itemKey === "lima:merge:4267")!;
    await store.decideCleanupItem(merge.id, "approved", admin);
    const third = await store.importCleanupItems("Lima", sampleItems());
    expect(third.skipped).toBe(1);
    items = await store.listCleanupItems({ includeSuggested: true });
    expect(items.find((i) => i.itemKey === "lima:merge:4267")!.status).toBe("approved");
  });

  it("hides un-verified suggestions from the VA", async () => {
    const adminView = await store.listCleanupItems({ includeSuggested: true });
    const vaView = await store.listCleanupItems({ includeSuggested: false });
    // The fill is still suggested → admin sees it, VA does not.
    expect(adminView.some((i) => i.itemKey === "lima:fill:4109")).toBe(true);
    expect(vaView.some((i) => i.itemKey === "lima:fill:4109")).toBe(false);
    // The approved merge is visible to the VA.
    expect(vaView.some((i) => i.itemKey === "lima:merge:4267")).toBe(true);
  });

  it("only lets a suggested item be approved or rejected", async () => {
    const items = await store.listCleanupItems({ includeSuggested: true });
    const merge = items.find((i) => i.itemKey === "lima:merge:4267")!; // already approved
    // Deciding an already-approved item is refused.
    expect(await store.decideCleanupItem(merge.id, "rejected", admin)).toBeNull();
  });

  it("enforces the approved↔done transition and reopen", async () => {
    const items = await store.listCleanupItems({ includeSuggested: true });
    const merge = items.find((i) => i.itemKey === "lima:merge:4267")!; // approved
    const fill = items.find((i) => i.itemKey === "lima:fill:4109")!; // suggested

    // A suggested item cannot jump to done.
    expect(await store.setCleanupItemDone(fill.id, true, va)).toBeNull();

    // An approved item can be completed, and reopened.
    const done = await store.setCleanupItemDone(merge.id, true, va);
    expect(done?.status).toBe("done");
    expect(done?.doneBy).toBe(va);
    const reopened = await store.setCleanupItemDone(merge.id, false, va);
    expect(reopened?.status).toBe("approved");
    expect(reopened?.doneBy).toBeNull();
  });

  it("accepts a VA note only on a workable item", async () => {
    const items = await store.listCleanupItems({ includeSuggested: true });
    const merge = items.find((i) => i.itemKey === "lima:merge:4267")!; // approved
    const fill = items.find((i) => i.itemKey === "lima:fill:4109")!; // suggested

    expect(await store.setCleanupItemNote(fill.id, "should be hidden")).toBeNull();
    const noted = await store.setCleanupItemNote(merge.id, "  merged, 1 deal looked off  ");
    expect(noted?.note).toBe("merged, 1 deal looked off");
    // Clearing works too.
    const cleared = await store.setCleanupItemNote(merge.id, "   ");
    expect(cleared?.note).toBeNull();
  });

  it("summarizes counts by status", async () => {
    const summary = await store.getCleanupSummary();
    expect(summary.total).toBe(2);
    expect(summary.approved + summary.suggested + summary.done + summary.rejected).toBe(2);
  });

  it("round-trips the structured payload the report UI renders (category + record deep links)", async () => {
    const payload = {
      category: "duplicate-person",
      records: [
        {
          role: "Keep",
          label: "Amy Balo",
          entity: "person",
          id: 31216,
          url: "https://wowvideotours.pipedrive.com/person/31216",
          meta: "amybalosells@gmail.com · at BHHS Lima",
        },
        {
          role: "Merge in",
          label: "Amy Place",
          entity: "person",
          id: 47074,
          url: "https://wowvideotours.pipedrive.com/person/47074",
          meta: "amybalosells@gmail.com",
        },
      ],
    };
    await store.importCleanupItems("Lima", [
      {
        itemKey: "lima:pmerge:31216-47074",
        kind: "merge",
        title: "Amy Balo",
        detail: "2 people share amybalosells@gmail.com. Merge into one contact.",
        verify: true,
        payload,
      },
    ]);
    const item = (await store.listCleanupItems({ includeSuggested: true })).find(
      (i) => i.itemKey === "lima:pmerge:31216-47074",
    )!;
    // The opaque payload survives the JSON round-trip intact — this is the exact
    // shape both the admin and portal renderers read for badges + deep links.
    expect(item.payload).toEqual(payload);
  });
});
