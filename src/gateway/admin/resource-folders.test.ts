import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-resource-folders-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./resource-store.js");
const userStore = await import("./user-store.js");

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

async function reset(): Promise<void> {
  const db = userStore.getAdminDb();
  await db.deleteFrom("admin_resource_favorites").execute();
  await db.deleteFrom("admin_resources").execute();
  await db.deleteFrom("admin_resource_folders").execute();
}

async function link(title: string, folderId: string | null) {
  return await store.createResource({
    title,
    type: "link",
    url: "https://example.com/" + title,
    userAccess: true,
    folderId,
  });
}

// Favorites are keyed to real users — the table cascades on user deletion, so
// the ids have to exist rather than being invented strings.
let u1 = "";
let u2 = "";

beforeAll(async () => {
  u1 = (await userStore.createUser({ username: "fav-one", password: "pw-one-123", role: "user" }))
    .id;
  u2 = (await userStore.createUser({ username: "fav-two", password: "pw-two-123", role: "user" }))
    .id;
});

beforeEach(reset);

describe("resource folders", () => {
  it("nests folders and reports each one's direct child counts", async () => {
    const sales = await store.createFolder({ name: "Sales" });
    const playbooks = await store.createFolder({ name: "Playbooks", parentId: sales.id });
    await link("Q4 playbook", playbooks.id);
    await link("Loose doc", null);

    const root = await store.listFolders({ parentId: null });
    expect(root.map((f) => f.name)).toEqual(["Sales"]);
    expect(root[0]).toMatchObject({ folderCount: 1, resourceCount: 0 });

    const children = await store.listFolders({ parentId: sales.id });
    expect(children[0]).toMatchObject({ name: "Playbooks", resourceCount: 1 });
  });

  it("lists a folder's own resources, and the root's unfiled ones", async () => {
    const sales = await store.createFolder({ name: "Sales" });
    await link("Filed", sales.id);
    await link("Unfiled", null);

    expect((await store.listResources({ folderId: sales.id })).map((r) => r.title)).toEqual([
      "Filed",
    ]);
    expect((await store.listResources({ folderId: null })).map((r) => r.title)).toEqual([
      "Unfiled",
    ]);
    // undefined means the whole library, which is what search needs.
    expect((await store.listResources({})).length).toBe(2);
  });

  it("builds a breadcrumb from the root down", async () => {
    const a = await store.createFolder({ name: "A" });
    const b = await store.createFolder({ name: "B", parentId: a.id });
    const c = await store.createFolder({ name: "C", parentId: b.id });
    expect((await store.getFolderPath(c.id)).map((f) => f.name)).toEqual(["A", "B", "C"]);
  });

  it("refuses to move a folder inside its own subtree", async () => {
    const a = await store.createFolder({ name: "A" });
    const b = await store.createFolder({ name: "B", parentId: a.id });
    await expect(store.updateFolder(a.id, { parentId: b.id })).rejects.toThrow(/inside itself/);
    // And refuses the degenerate case of parenting a folder to itself.
    await expect(store.updateFolder(a.id, { parentId: a.id })).rejects.toThrow(/inside itself/);
  });

  it("moves a resource between folders, and back to the root", async () => {
    const a = await store.createFolder({ name: "A" });
    const r = await link("Doc", null);
    expect((await store.updateResource(r.id, { folderId: a.id }))?.folderId).toBe(a.id);
    expect((await store.updateResource(r.id, { folderId: null }))?.folderId).toBeNull();
  });

  it("rejects a move into a folder that does not exist", async () => {
    const r = await link("Doc", null);
    await expect(store.updateResource(r.id, { folderId: "nope" })).rejects.toThrow(/not found/i);
  });

  it("deleting a folder lifts its contents up rather than destroying them", async () => {
    const parent = await store.createFolder({ name: "Parent" });
    const child = await store.createFolder({ name: "Child", parentId: parent.id });
    const grandchild = await store.createFolder({ name: "Grandchild", parentId: child.id });
    const doc = await link("Doc", child.id);

    expect(await store.deleteFolder(child.id)).toBe(true);
    // The document and the sub-folder survive, re-parented to Parent.
    expect((await store.getResource(doc.id))?.folderId).toBe(parent.id);
    expect((await store.getFolder(grandchild.id))?.parentId).toBe(parent.id);
  });

  it("deleting a root folder returns its contents to the root", async () => {
    const root = await store.createFolder({ name: "Root" });
    const doc = await link("Doc", root.id);
    await store.deleteFolder(root.id);
    expect((await store.getResource(doc.id))?.folderId).toBeNull();
  });

  it("hides admin-only folders and resources from a portal viewer", async () => {
    await store.createFolder({ name: "Internal", userAccess: false });
    const shared = await store.createFolder({ name: "Shared", userAccess: true });
    await link("Visible", shared.id);

    const visible = await store.listFolders({ userAccessOnly: true, parentId: null });
    expect(visible.map((f) => f.name)).toEqual(["Shared"]);
  });
});

describe("resource favorites", () => {
  it("keeps one list per user, over both folders and resources", async () => {
    const folder = await store.createFolder({ name: "Sales" });
    const doc = await link("Doc", folder.id);

    await store.setFavorite({
      userId: u1,
      itemType: "folder",
      itemId: folder.id,
      favorite: true,
    });
    await store.setFavorite({ userId: u1, itemType: "resource", itemId: doc.id, favorite: true });

    const mine = await store.listFolders({ viewerId: u1, parentId: null });
    expect(mine[0]?.favorite).toBe(true);
    // Another user's view is untouched by u1's stars.
    const theirs = await store.listFolders({ viewerId: u2, parentId: null });
    expect(theirs[0]?.favorite).toBe(false);

    const docs = await store.listResources({ viewerId: u1, folderId: folder.id });
    expect(docs[0]?.favorite).toBe(true);
  });

  it("filters to favorites across every folder, not just the current one", async () => {
    const a = await store.createFolder({ name: "A" });
    const b = await store.createFolder({ name: "B" });
    const starred = await link("Starred", a.id);
    await link("Plain", b.id);
    await store.setFavorite({
      userId: u1,
      itemType: "resource",
      itemId: starred.id,
      favorite: true,
    });

    const favorites = await store.listResources({ viewerId: u1, favoritesOnly: true });
    expect(favorites.map((r) => r.title)).toEqual(["Starred"]);
  });

  it("unstars, and starring twice does not double up", async () => {
    const doc = await link("Doc", null);
    const star = (favorite: boolean) =>
      store.setFavorite({ userId: u1, itemType: "resource", itemId: doc.id, favorite });
    await star(true);
    await star(true);
    expect((await store.listResources({ viewerId: u1, favoritesOnly: true })).length).toBe(1);
    await star(false);
    expect((await store.listResources({ viewerId: u1, favoritesOnly: true })).length).toBe(0);
  });

  it("drops a deleted item's stars rather than leaving them dangling", async () => {
    const folder = await store.createFolder({ name: "Sales" });
    const doc = await link("Doc", null);
    await store.setFavorite({
      userId: u1,
      itemType: "folder",
      itemId: folder.id,
      favorite: true,
    });
    await store.setFavorite({ userId: u1, itemType: "resource", itemId: doc.id, favorite: true });

    await store.deleteFolder(folder.id);
    await store.deleteResource(doc.id);

    const rows = await userStore
      .getAdminDb()
      .selectFrom("admin_resource_favorites")
      .selectAll()
      .execute();
    expect(rows).toEqual([]);
  });
});
