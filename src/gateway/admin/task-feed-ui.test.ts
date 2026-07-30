import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { TASK_FEED_COMPONENT_JS, TASK_FEED_MARKUP } from "./task-feed-ui.js";

type FeedEvent = Record<string, unknown>;
type Feed = { load: (id: string | null) => Promise<void>; clear: () => void };

/**
 * The feed ships as a string of browser JS the SPAs interpolate, so it is
 * exercised the way a browser would run it: real DOM, a stub API, and the
 * handle the factory returns. `esc` comes from the host SPA in production.
 */
function mountFeed(
  opts: {
    events?: FeedEvent[];
    currentUserId?: string | null;
    isAdmin?: boolean;
    people?: Array<{ id: string; name: string }>;
    labelFor?: (field: string, value: string) => string | null;
  } = {},
) {
  const dom = new JSDOM(`<!DOCTYPE html><div id="feed">${TASK_FEED_MARKUP}</div>`, {
    runScripts: "outside-only",
  });
  const { window } = dom;
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  let events = opts.events ?? [];

  const api = vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body });
    if (method === "GET") return { ok: true, data: { events } };
    return { ok: true, data: {} };
  });

  const escape = (v: unknown) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
  window.eval(`var esc = ${escape.toString()};\n${TASK_FEED_COMPONENT_JS}`);
  const create = (window as unknown as { createTaskFeed: (c: unknown) => Feed }).createTaskFeed;
  (window as unknown as { __confirm: boolean }).__confirm = true;
  window.confirm = () => (window as unknown as { __confirm: boolean }).__confirm;

  const feed = create({
    rootId: "feed",
    api,
    currentUserId: opts.currentUserId ?? "u-me",
    isAdmin: opts.isAdmin ?? false,
    people: () =>
      opts.people ?? [
        { id: "u-me", name: "steve" },
        { id: "u2", name: "anna" },
      ],
    labelFor: opts.labelFor,
  });

  return {
    window,
    doc: window.document,
    feed,
    calls,
    api,
    setEvents: (e: FeedEvent[]) => {
      events = e;
    },
    setConfirm: (v: boolean) => {
      (window as unknown as { __confirm: boolean }).__confirm = v;
    },
  };
}

const comment = (over: FeedEvent = {}): FeedEvent => ({
  id: "e1",
  kind: "comment",
  body: "Waiting on the floor plan.",
  authorId: "u-me",
  authorName: "steve",
  createdAt: Date.now() - 60_000,
  editedAt: null,
  mentions: [],
  ...over,
});

const activity = (over: FeedEvent = {}): FeedEvent => ({
  id: "a1",
  kind: "activity",
  body: null,
  field: "status",
  from: "todo",
  to: "review",
  authorId: "u2",
  authorName: "anna",
  createdAt: Date.now() - 30_000,
  editedAt: null,
  mentions: [],
  ...over,
});

describe("createTaskFeed", () => {
  it("says so when a task has no thread yet", async () => {
    const { doc, feed } = mountFeed({ events: [] });
    await feed.load("t1");
    expect(doc.querySelector(".tf-empty")?.textContent).toBe("No comments or history yet.");
  });

  it("renders comments and activity in one stream", async () => {
    const { doc, feed } = mountFeed({ events: [comment(), activity()] });
    await feed.load("t1");
    expect(doc.querySelectorAll(".tf-item").length).toBe(1);
    expect(doc.querySelectorAll(".tf-activity").length).toBe(1);
    expect(doc.querySelector(".tf-text")?.textContent).toBe("Waiting on the floor plan.");
  });

  it("phrases activity as a sentence", async () => {
    const { doc, feed } = mountFeed({
      events: [activity()],
      labelFor: (field, v) =>
        field === "status" ? ({ todo: "Todo", review: "Review" }[v] ?? v) : null,
    });
    await feed.load("t1");
    const text = doc.querySelector(".tf-activity")?.textContent ?? "";
    expect(text).toContain("anna");
    expect(text).toContain("moved this to");
    expect(text).toContain("Review");
  });

  it("narrates a due date being cleared rather than showing null", async () => {
    const { doc, feed } = mountFeed({
      events: [activity({ field: "dueDate", from: "1800000000000", to: null })],
    });
    await feed.load("t1");
    expect(doc.querySelector(".tf-activity")?.textContent).toContain("cleared the due date");
  });

  it("highlights @mentions without trusting the text", async () => {
    const { doc, feed } = mountFeed({
      events: [comment({ body: "@anna please look <script>alert(1)</script>" })],
    });
    await feed.load("t1");
    const textEl = doc.querySelector(".tf-text");
    expect(textEl?.querySelector("script")).toBeNull();
    expect(textEl?.querySelector(".tf-mention")?.textContent).toBe("@anna");
    expect(textEl?.textContent).toContain("<script>alert(1)</script>");
  });

  it("offers edit and delete on your own comment only", async () => {
    const { doc, feed } = mountFeed({
      events: [
        comment({ id: "mine", authorId: "u-me" }),
        comment({ id: "theirs", authorId: "u2" }),
      ],
    });
    await feed.load("t1");
    expect(doc.querySelector('[data-edit="mine"]')).not.toBeNull();
    expect(doc.querySelector('[data-delete="mine"]')).not.toBeNull();
    expect(doc.querySelector('[data-edit="theirs"]')).toBeNull();
    expect(doc.querySelector('[data-delete="theirs"]')).toBeNull();
  });

  it("lets an admin delete someone else's comment but not reword it", async () => {
    const { doc, feed } = mountFeed({
      events: [comment({ id: "theirs", authorId: "u2" })],
      isAdmin: true,
    });
    await feed.load("t1");
    expect(doc.querySelector('[data-delete="theirs"]')).not.toBeNull();
    expect(doc.querySelector('[data-edit="theirs"]')).toBeNull();
  });

  it("marks an edited comment", async () => {
    const { doc, feed } = mountFeed({ events: [comment({ editedAt: Date.now() })] });
    await feed.load("t1");
    expect(doc.querySelector(".tf-edited")?.textContent).toBe("edited");
  });

  it("posts a comment and reloads the thread", async () => {
    const { doc, feed, calls } = mountFeed({ events: [] });
    await feed.load("t1");
    const input = doc.querySelector(".tf-input") as HTMLTextAreaElement;
    input.value = "  On it.  ";
    (doc.querySelector(".tf-send") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    const post = calls.find((c) => c.method === "POST");
    expect(post?.path).toBe("/tasks/t1/events");
    expect(post?.body).toEqual({ body: "On it." });
    expect(input.value).toBe("");
  });

  it("does not post an empty comment", async () => {
    const { doc, feed, calls } = mountFeed({ events: [] });
    await feed.load("t1");
    (doc.querySelector(".tf-input") as HTMLTextAreaElement).value = "   ";
    (doc.querySelector(".tf-send") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("switches to an update when editing", async () => {
    const { doc, feed, calls } = mountFeed({ events: [comment({ id: "mine" })] });
    await feed.load("t1");
    (doc.querySelector('[data-edit="mine"]') as HTMLElement).click();
    const input = doc.querySelector(".tf-input") as HTMLTextAreaElement;
    expect(input.value).toBe("Waiting on the floor plan.");
    expect((doc.querySelector(".tf-send") as HTMLElement).textContent).toBe("Save");
    input.value = "Floor plan arrived.";
    (doc.querySelector(".tf-send") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.path).toBe("/tasks/t1/events/mine");
    expect(put?.body).toEqual({ body: "Floor plan arrived." });
  });

  it("asks before deleting and honours a cancel", async () => {
    const { doc, feed, calls, setConfirm } = mountFeed({ events: [comment({ id: "mine" })] });
    await feed.load("t1");
    setConfirm(false);
    (doc.querySelector('[data-delete="mine"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    setConfirm(true);
    (doc.querySelector('[data-delete="mine"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.find((c) => c.method === "DELETE")?.path).toBe("/tasks/t1/events/mine");
  });

  it("opens mention autocomplete on @ and completes the name", async () => {
    const { doc, feed, window } = mountFeed({ events: [] });
    await feed.load("t1");
    const input = doc.querySelector(".tf-input") as HTMLTextAreaElement;
    input.value = "ping @an";
    input.setSelectionRange(8, 8);
    input.dispatchEvent(new window.KeyboardEvent("keyup", { key: "n", bubbles: true }));
    const opts = doc.querySelectorAll(".tf-mention-opt");
    expect(opts.length).toBe(1);
    expect(opts[0]?.textContent).toBe("anna");
    (opts[0] as HTMLElement).dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
    expect(input.value).toBe("ping @anna ");
  });

  it("does not open autocomplete mid-word", async () => {
    const { doc, feed, window } = mountFeed({ events: [] });
    await feed.load("t1");
    const input = doc.querySelector(".tf-input") as HTMLTextAreaElement;
    // An email-looking token must not trigger the picker.
    input.value = "mail steve@an";
    input.setSelectionRange(13, 13);
    input.dispatchEvent(new window.KeyboardEvent("keyup", { key: "n", bubbles: true }));
    expect(doc.querySelector(".tf-mention-menu")).toBeNull();
  });

  it("clears back to empty when the modal opens on a new task", async () => {
    const { doc, feed } = mountFeed({ events: [comment()] });
    await feed.load("t1");
    expect(doc.querySelectorAll(".tf-item").length).toBe(1);
    feed.clear();
    expect(doc.querySelector(".tf-empty")).not.toBeNull();
  });

  it("reports a thread it could not load instead of showing it empty", async () => {
    const dom = new JSDOM(`<!DOCTYPE html><div id="feed">${TASK_FEED_MARKUP}</div>`, {
      runScripts: "outside-only",
    });
    const { window } = dom;
    window.eval(`var esc = String;\n${TASK_FEED_COMPONENT_JS}`);
    const create = (window as unknown as { createTaskFeed: (c: unknown) => Feed }).createTaskFeed;
    const feed = create({ rootId: "feed", api: async () => ({ ok: false, data: {} }) });
    await feed.load("t1");
    expect(window.document.querySelector(".tf-empty")?.textContent).toBe(
      "Could not load the thread.",
    );
  });
});
