import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { FEEDBACK_INTAKE_HTML } from "./feedback-intake-html.js";
import {
  APPOINTMENT_CATEGORY,
  FEEDBACK_CATEGORIES,
  FEEDBACK_SERVICES,
  FEEDBACK_SOURCES,
  FEEDBACK_SUBMITTERS,
} from "./feedback-store.js";

/**
 * The public form is a template string no type or lint pass reads, so without
 * these a stray brace would ship a page that renders but never submits — the
 * same blind spot the SPA carries.
 */
function mount() {
  const dom = new JSDOM(FEEDBACK_INTAKE_HTML, { runScripts: "dangerously" });
  return { dom, doc: dom.window.document };
}

function values(doc: Document, name: string): string[] {
  return Array.from(doc.querySelectorAll(`input[name="${name}"]`)).map(
    (el) => (el as HTMLInputElement).value,
  );
}

describe("the public feedback form", () => {
  it("offers exactly the options the store defines", () => {
    const { doc } = mount();
    expect(values(doc, "source")).toEqual([...FEEDBACK_SOURCES]);
    expect(values(doc, "category")).toEqual([...FEEDBACK_CATEGORIES]);
    expect(values(doc, "service")).toEqual([...FEEDBACK_SERVICES]);
  });

  it("lists every submitter plus an escape hatch for anyone else", () => {
    const { doc } = mount();
    const opts = Array.from(doc.querySelectorAll("#submitted-by option")).map(
      (o) => (o as HTMLOptionElement).value,
    );
    for (const name of FEEDBACK_SUBMITTERS) {
      expect(opts).toContain(name);
    }
    expect(opts).toContain("__other__");
  });

  it("gives every element a unique id", () => {
    // The knowledge base shipped a duplicate id that blanked a table; the
    // checkbox lists here are generated, so the same clash is one loop away.
    const { doc } = mount();
    const seen = new Map<string, number>();
    for (const el of Array.from(doc.querySelectorAll("[id]"))) {
      const id = el.getAttribute("id") ?? "";
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    expect(Array.from(seen.entries()).filter(([, n]) => n > 1)).toEqual([]);
  });

  it("keeps the appointment questions shut until that category is picked", () => {
    const { dom, doc } = mount();
    const branch = doc.getElementById("appt-branch");
    expect(branch?.classList.contains("hidden")).toBe(true);

    const box = Array.from(doc.querySelectorAll('input[name="category"]')).find(
      (el) => (el as HTMLInputElement).value === APPOINTMENT_CATEGORY,
    ) as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(branch?.classList.contains("hidden")).toBe(false);

    // Un-ticking closes it again, so the answers cannot be sent invisibly.
    box.checked = false;
    box.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(branch?.classList.contains("hidden")).toBe(true);
  });

  it("reveals a name box only when the submitter is not on the roster", () => {
    const { dom, doc } = mount();
    const sel = doc.getElementById("submitted-by") as HTMLSelectElement;
    const field = doc.getElementById("other-name-field");
    expect(field?.classList.contains("hidden")).toBe(true);
    sel.value = "__other__";
    sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(field?.classList.contains("hidden")).toBe(false);
  });

  it("refuses to submit without a category, a source and some words", async () => {
    const { dom, doc } = mount();
    let posted = false;
    dom.window.fetch = () => {
      posted = true;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    };
    const form = doc.getElementById("fb-form") as HTMLFormElement;
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(posted).toBe(false);
    expect(doc.getElementById("err")?.classList.contains("on")).toBe(true);
  });

  it("posts what was filled in and then shows the reference back", async () => {
    const { dom, doc } = mount();
    let sent: Record<string, unknown> | null = null;
    dom.window.fetch = (_url: string, init: { body: string }) => {
      sent = JSON.parse(init.body) as Record<string, unknown>;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, reference: "FB-0223" }),
      });
    };

    const tick = (name: string, value: string) => {
      const el = Array.from(doc.querySelectorAll(`input[name="${name}"]`)).find(
        (x) => (x as HTMLInputElement).value === value,
      ) as HTMLInputElement;
      el.checked = true;
      el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    };
    tick("source", "Employee Feedback");
    tick("category", FEEDBACK_CATEGORIES[0]);
    (doc.getElementById("body") as HTMLTextAreaElement).value = "The card was full.";
    (doc.getElementById("submitted-by") as HTMLSelectElement).value = "Joy Kiser";

    (doc.getElementById("fb-form") as HTMLFormElement).dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 0));

    expect(sent).toMatchObject({
      source: ["Employee Feedback"],
      categories: [FEEDBACK_CATEGORIES[0]],
      body: "The card was full.",
      submittedBy: "Joy Kiser",
    });
    expect(doc.getElementById("done-ref")?.textContent).toBe("FB-0223");
    expect(doc.getElementById("form-view")?.classList.contains("hidden")).toBe(true);
  });
});
