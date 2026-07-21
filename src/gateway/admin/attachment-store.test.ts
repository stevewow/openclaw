import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Point the admin DB + state dir at an isolated temp dir before the store
// singleton initializes.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oc-attachment-store-"));
process.env.OPENCLAW_STATE_DIR = TMP_DIR;

const store = await import("./attachment-store.js");
const projectStore = await import("./project-store.js");
const userStore = await import("./user-store.js");

let alice: string;
let projectId: string;

beforeAll(async () => {
  alice = (await userStore.createUser({ username: "alice", password: "x", role: "user" })).id;
  projectId = (await projectStore.createProject({ title: "Newsletter", createdBy: alice })).id;
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("attachments", () => {
  it("round-trips a link on a project", async () => {
    const created = await store.createAttachment({
      ownerType: "project",
      ownerId: projectId,
      type: "link",
      title: "Brand guide",
      url: "https://example.com/guide",
      createdBy: alice,
    });
    expect(created.type).toBe("link");
    expect(created.url).toBe("https://example.com/guide");

    const listed = await store.listAttachments("project", projectId);
    expect(listed.map((a) => a.title)).toContain("Brand guide");
  });

  it("scopes listings to the owner that was asked for", async () => {
    const task = await projectStore.createTask({ title: "Draft", createdBy: alice });
    await store.createAttachment({
      ownerType: "task",
      ownerId: task.id,
      type: "link",
      title: "Task link",
      url: "https://example.com/task",
      createdBy: alice,
    });
    // A task attachment must not surface under the project, and vice versa.
    expect((await store.listAttachments("task", task.id)).map((a) => a.title)).toEqual([
      "Task link",
    ]);
    expect((await store.listAttachments("project", projectId)).map((a) => a.title)).not.toContain(
      "Task link",
    );
  });

  it("deletes the stored file along with the row", async () => {
    await store.ensureAttachmentsDir();
    const storedFilename = "probe.txt";
    const filePath = store.resolveAttachmentFilePath(storedFilename);
    fs.writeFileSync(filePath, "hello");
    const created = await store.createAttachment({
      ownerType: "project",
      ownerId: projectId,
      type: "file",
      title: "probe.txt",
      filename: "probe.txt",
      storedFilename,
      mimetype: "text/plain",
      filesize: 5,
      createdBy: alice,
    });

    await store.deleteAttachment(created.id);
    expect(await store.getAttachment(created.id)).toBeNull();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("still removes the row when the file is already gone", async () => {
    const created = await store.createAttachment({
      ownerType: "project",
      ownerId: projectId,
      type: "file",
      title: "ghost.txt",
      filename: "ghost.txt",
      storedFilename: "definitely-not-here.txt",
      createdBy: alice,
    });
    await store.deleteAttachment(created.id);
    expect(await store.getAttachment(created.id)).toBeNull();
  });

  it("counts attachments per owner in one pass", async () => {
    const a = await projectStore.createTask({ title: "A", createdBy: alice });
    const b = await projectStore.createTask({ title: "B", createdBy: alice });
    await store.createAttachment({
      ownerType: "task",
      ownerId: a.id,
      type: "link",
      title: "one",
      url: "https://example.com/1",
    });
    await store.createAttachment({
      ownerType: "task",
      ownerId: a.id,
      type: "link",
      title: "two",
      url: "https://example.com/2",
    });

    const counts = await store.listAttachmentsForOwners("task", [a.id, b.id]);
    expect(counts.get(a.id)?.length).toBe(2);
    // An owner with nothing attached is simply absent, not an empty array.
    expect(counts.get(b.id)).toBeUndefined();
    expect(await store.listAttachmentsForOwners("task", [])).toEqual(new Map());
  });

  it("clears every attachment for an owner", async () => {
    const task = await projectStore.createTask({ title: "Doomed", createdBy: alice });
    await store.createAttachment({
      ownerType: "task",
      ownerId: task.id,
      type: "link",
      title: "gone soon",
      url: "https://example.com/x",
    });
    await store.deleteAttachmentsForOwner("task", task.id);
    expect(await store.listAttachments("task", task.id)).toEqual([]);
  });
});
