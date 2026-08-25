import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { KB_COMPONENT_JS, KB_CSS, KB_MARKUP, KB_MODALS } from "./kb-ui.js";
import { navCatalogItems } from "./nav-catalog.js";

/**
 * The authoring page is inline JS inside a template string, so no type or lint
 * pass reads it — the same blind spot that cost an admin their work on the
 * Request Types editor. These run the real KB block against a real DOM.
 *
 * The script is evaluated from `KB_COMPONENT_JS` (the exact string the SPA
 * interpolates) while the DOM comes from the assembled `ADMIN_UI_HTML`, so a
 * page that stopped being wired in fails the first test rather than passing
 * these on a detached fragment.
 */

type Call = { method: string; path: string; payload?: Record<string, unknown> };

const CATEGORIES = [
  { id: "cat-sched", slug: "scheduling", title: "Scheduling", description: null, articleCount: 1 },
  { id: "cat-media", slug: "media", title: "Media", description: null, articleCount: 0 },
];

const ARTICLES = [
  {
    id: "art-1",
    slug: "reschedule-a-shoot",
    title: "Reschedule a shoot",
    summary: "Move an appointment",
    bodyMd: "# Steps",
    categoryId: "cat-sched",
    status: "published",
    videoUrl: null,
    sortOrder: 0,
    updatedAt: Date.UTC(2026, 7, 1),
  },
  {
    id: "art-2",
    slug: "cancel-a-shoot",
    title: "Cancel a shoot",
    summary: null,
    bodyMd: "",
    categoryId: "cat-sched",
    status: "draft",
    videoUrl: null,
    sortOrder: 1,
    updatedAt: Date.UTC(2026, 7, 2),
  },
  {
    id: "art-3",
    slug: "stray-notes",
    title: "Stray notes",
    summary: null,
    bodyMd: "",
    categoryId: null,
    status: "draft",
    videoUrl: null,
    sortOrder: 2,
    updatedAt: Date.UTC(2026, 7, 3),
  },
];

function mountKb(opts: { searchHits?: string[] } = {}) {
  const dom = new JSDOM(ADMIN_UI_HTML, { runScripts: "outside-only" });
  const win = dom.window as unknown as Record<string, unknown> & {
    document: Document;
    eval: (code: string) => unknown;
    Event: typeof Event;
  };
  const calls: Call[] = [];
  const confirms: string[] = [];
  const alerts: string[] = [];
  let confirmAnswer = true;

  win.esc = (v: string | number | null | undefined) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
  win.confirm = (message: string) => {
    confirms.push(message);
    return confirmAnswer;
  };
  win.alert = (message: string) => {
    alerts.push(message);
  };
  win.api = (method: string, path: string, payload?: Record<string, unknown>) => {
    calls.push({ method, path, payload });
    if (method === "GET" && path === "/kb") {
      return Promise.resolve({
        ok: true,
        data: { categories: CATEGORIES, articles: ARTICLES },
      });
    }
    if (method === "GET" && path.startsWith("/kb/search")) {
      const hits = (opts.searchHits ?? []).map((id) => ARTICLES.find((a) => a.id === id));
      return Promise.resolve({ ok: true, data: { articles: hits } });
    }
    if (method === "POST" && path === "/kb/articles") {
      return Promise.resolve({ ok: true, data: { article: { id: "art-new", status: "draft" } } });
    }
    return Promise.resolve({ ok: true, data: {} });
  };

  win.eval(KB_COMPONENT_JS);

  const doc = win.document;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  return {
    doc,
    calls,
    confirms,
    alerts,
    win,
    setConfirm(answer: boolean) {
      confirmAnswer = answer;
    },
    async load() {
      win.eval("loadKb()");
      await settle();
    },
    async run(code: string) {
      win.eval(code);
      await settle();
    },
    rows(): HTMLTableRowElement[] {
      return Array.from(
        doc.querySelectorAll("#kb-article-rows tr"),
      ) as unknown as HTMLTableRowElement[];
    },
    /** Article titles in the order the table shows them, headings included. */
    lines(): string[] {
      return this.rows().map((tr) =>
        tr.classList.contains("kb-group-row")
          ? `— ${tr.textContent?.trim()}`
          : (tr.querySelector(".kb-open")?.textContent ?? ""),
      );
    },
  };
}

describe("wiring", () => {
  it("gives every element in the assembled page a unique id", () => {
    // The editor surface and the article table both used `kb-article-body`,
    // so opening an article blanked the list. Duplicate ids are silent in
    // HTML and getElementById just picks the first, so assert over the whole
    // assembled page rather than trusting each fragment on its own.
    const doc = new JSDOM(ADMIN_UI_HTML).window.document;
    const seen = new Map<string, number>();
    for (const el of Array.from(doc.querySelectorAll("[id]"))) {
      const id = el.getAttribute("id") ?? "";
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    const dupes = Array.from(seen.entries())
      .filter(([, n]) => n > 1)
      .map(([id, n]) => `${id} x${n}`);
    expect(dupes).toEqual([]);
  });

  it("is actually interpolated into the SPA", () => {
    expect(ADMIN_UI_HTML).toContain(KB_MARKUP.trim());
    expect(ADMIN_UI_HTML).toContain(KB_MODALS.trim());
    expect(ADMIN_UI_HTML).toContain(KB_CSS.trim());
    expect(ADMIN_UI_HTML).toContain(KB_COMPONENT_JS.trim());
  });

  it("has a nav entry, a routed page and a loader", () => {
    // The sidebar is generated from the catalog now, so that is where the nav
    // entry has to exist for the section to be reachable at all.
    expect(navCatalogItems("admin").map((i) => i.id)).toContain("kb");
    expect(ADMIN_UI_HTML).toContain("el: 'page-kb'");
    expect(ADMIN_UI_HTML).toContain("feature: 'knowledge-base'");
    expect(ADMIN_UI_HTML).toContain("if (page === 'kb') loadKb();");
  });
});

describe("the article list", () => {
  it("groups by category, unfiled last, and marks what is live", async () => {
    const kb = mountKb();
    await kb.load();
    expect(kb.lines()).toEqual([
      "— Scheduling",
      "Reschedule a shoot",
      "Cancel a shoot",
      "— Unfiled",
      "Stray notes",
    ]);
    const chips = Array.from(kb.doc.querySelectorAll(".kb-chip")).map((c) => c.textContent);
    expect(chips).toEqual(["Published", "Draft", "Draft"]);
    expect(kb.doc.getElementById("kb-count")?.textContent).toBe("3 articles · 1 published");
  });

  it("only offers a move where there is a shelf-mate to swap with", async () => {
    const kb = mountKb();
    await kb.load();
    const rows = kb.rows().filter((r) => !r.classList.contains("kb-group-row"));
    const up = rows.map((r) => (r.querySelector(".kb-up") as HTMLButtonElement).disabled);
    const down = rows.map((r) => (r.querySelector(".kb-down") as HTMLButtonElement).disabled);
    // Two in Scheduling: first can go down, second up. The unfiled one is alone.
    expect(up).toEqual([true, false, true]);
    expect(down).toEqual([false, true, true]);
  });

  it("links a published article to its public page, and a draft to nothing", async () => {
    const kb = mountKb();
    await kb.load();
    const links = Array.from(kb.doc.querySelectorAll(".kb-view")).map((a) =>
      a.getAttribute("href"),
    );
    // Only the one published article; a draft has no page to open.
    expect(links).toEqual(["/help/reschedule-a-shoot"]);
  });

  it("filters to one category when it is selected", async () => {
    const kb = mountKb();
    await kb.load();
    await kb.run("kbCategoryFilter = 'cat-sched'; renderKbArticles();");
    expect(kb.lines()).toEqual(["Reschedule a shoot", "Cancel a shoot"]);
  });

  it("shows the unfiled shelf only while something sits on it", async () => {
    const kb = mountKb();
    await kb.load();
    expect(kb.doc.getElementById("kb-cat-list")?.textContent).toContain("Unfiled");
    await kb.run(
      "kbArticles = kbArticles.filter(function(a){ return a.categoryId; }); renderKbCategories();",
    );
    expect(kb.doc.getElementById("kb-cat-list")?.textContent).not.toContain("Unfiled");
  });
});

describe("reordering", () => {
  it("sends the whole order for that one category", async () => {
    const kb = mountKb();
    await kb.load();
    await kb.run("moveKbArticle('art-2', -1)");
    const call = kb.calls.find((c) => c.path === "/kb/articles/reorder");
    // Only the shelf-mates take part, and the unfiled article is not among them.
    expect(call?.payload).toEqual({ categoryId: "cat-sched", ids: ["art-2", "art-1"] });
  });

  it("sends every category id when a category moves", async () => {
    const kb = mountKb();
    await kb.load();
    await kb.run("moveKbCategory('cat-media', -1)");
    const call = kb.calls.find((c) => c.path === "/kb/categories/reorder");
    expect(call?.payload).toEqual({ ids: ["cat-media", "cat-sched"] });
  });

  it("does nothing at the end of the list", async () => {
    const kb = mountKb();
    await kb.load();
    await kb.run("moveKbArticle('art-3', 1)");
    expect(kb.calls.some((c) => c.path === "/kb/articles/reorder")).toBe(false);
  });
});

describe("deleting a category", () => {
  it("says how many articles will be unfiled before asking", async () => {
    const kb = mountKb();
    await kb.load();
    kb.setConfirm(false);
    await kb.run("removeKbCategory('cat-sched')");
    expect(kb.confirms[0]).toContain("2 articles filed here will become Unfiled");
    expect(kb.confirms[0]).toContain("Nothing is deleted with it");
    // Answering no must not send the delete.
    expect(kb.calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("does not warn about articles when the category is empty", async () => {
    const kb = mountKb();
    await kb.load();
    kb.setConfirm(false);
    await kb.run("removeKbCategory('cat-media')");
    expect(kb.confirms[0]).not.toContain("Unfiled");
  });
});

describe("the article editor", () => {
  it("opens an existing article with its text loaded", async () => {
    const kb = mountKb();
    await kb.load();
    await kb.run("openKbArticleModal('art-1')");
    expect((kb.doc.getElementById("kb-article-title") as HTMLInputElement).value).toBe(
      "Reschedule a shoot",
    );
    // The body is now rendered into the contenteditable surface, not a textarea:
    // "# Steps" is markdown in the store and a heading in front of the writer.
    expect((kb.doc.getElementById("kb-article-body") as HTMLElement).innerHTML).toBe(
      "<h2>Steps</h2>",
    );
    expect((kb.doc.getElementById("kb-article-category") as HTMLSelectElement).value).toBe(
      "cat-sched",
    );
    // The article list must survive opening the editor. The editor surface and
    // the results table both answered to `kb-article-body`, so loading an
    // article wrote its rendered HTML over the table and the list vanished
    // until a reload. getElementById returns the first match in document
    // order, so this passed in isolation and failed on the real page.
    expect(kb.rows().length).toBeGreaterThan(0);
    expect(kb.lines()).toContain("Reschedule a shoot");
    // The address is only editable once it exists, and it exists now.
    expect(kb.doc.getElementById("kb-article-slug-group")?.classList.contains("hidden")).toBe(
      false,
    );
    expect(kb.doc.getElementById("kb-article-publish")?.textContent).toBe("Save & Unpublish");
  });

  it("files a new article where the author is standing", async () => {
    const kb = mountKb();
    await kb.load();
    await kb.run("kbCategoryFilter = 'cat-media'; renderKbCategories(); openKbArticleModal(null)");
    expect((kb.doc.getElementById("kb-article-category") as HTMLSelectElement).value).toBe(
      "cat-media",
    );
    expect(kb.doc.getElementById("kb-article-slug-group")?.classList.contains("hidden")).toBe(true);
  });

  it("saves before publishing, so publish can never lose the text", async () => {
    const kb = mountKb();
    await kb.load();
    await kb.run("openKbArticleModal(null)");
    (kb.doc.getElementById("kb-article-title") as HTMLInputElement).value = "Brand new";
    (kb.doc.getElementById("kb-article-body-md") as HTMLTextAreaElement).value = "body";
    await kb.run("saveKbArticle(true)");
    const paths = kb.calls.map((c) => c.method + " " + c.path);
    expect(paths).toContain("POST /kb/articles");
    expect(paths.indexOf("POST /kb/articles")).toBeLessThan(
      paths.indexOf("POST /kb/articles/art-new/publish"),
    );
  });

  it("refuses to save without a title, and says so in the modal", async () => {
    const kb = mountKb();
    await kb.load();
    await kb.run("openKbArticleModal(null)");
    await kb.run("saveKbArticle(false)");
    const error = kb.doc.getElementById("kb-article-modal-error");
    expect(error?.classList.contains("hidden")).toBe(false);
    expect(error?.textContent).toMatch(/title/i);
    expect(kb.calls.some((c) => c.method === "POST")).toBe(false);
  });
});

describe("search", () => {
  it("keeps the server's ranking rather than regrouping by category", async () => {
    const kb = mountKb({ searchHits: ["art-3", "art-1"] });
    await kb.load();
    (kb.doc.getElementById("kb-search") as HTMLInputElement).value = "shoot";
    await kb.run("runKbSearch()");
    expect(kb.lines()).toEqual(["Stray notes", "Reschedule a shoot"]);
  });

  it("goes back to the full list when the box is cleared", async () => {
    const kb = mountKb({ searchHits: ["art-1"] });
    await kb.load();
    (kb.doc.getElementById("kb-search") as HTMLInputElement).value = "shoot";
    await kb.run("runKbSearch()");
    expect(kb.lines()).toEqual(["Reschedule a shoot"]);
    (kb.doc.getElementById("kb-search") as HTMLInputElement).value = "";
    await kb.run("runKbSearch()");
    expect(kb.lines()).toContain("Stray notes");
  });
});
