import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";

/**
 * The Request Types choice editor is inline JS inside a template string, so no
 * type or lint pass reads it. It shipped a bug that cost an admin their work:
 * saving a "pick several" question posted `extraOptions: []`, so every choice
 * typed in came back empty on the next load and never reached the form.
 *
 * These run the real editor block out of the SPA against a real DOM.
 */

function inlineScript(): string {
  const m = ADMIN_UI_HTML.match(/<script>([\s\S]*?)<\/script>/);
  if (!m?.[1]) {
    throw new Error("no inline script found in ADMIN_UI_HTML");
  }
  return m[1];
}

/** Lift a named block out of the SPA script so it can run on its own. */
function sliceBlock(start: string, end: string): string {
  const script = inlineScript();
  const from = script.indexOf(start);
  const to = script.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`block ${start} … ${end} not found — did the SPA change?`);
  }
  return script.slice(from, to);
}

type Saved = { method: string; path: string; payload: Record<string, unknown> };

/**
 * A live category modal: the real choice-editor and form-submit code, wired to
 * a capturing `api` so a save can be inspected instead of sent.
 */
function mountEditor() {
  const dom = new JSDOM(ADMIN_UI_HTML, { runScripts: "outside-only" });
  const win = dom.window as unknown as Record<string, unknown> & {
    document: Document;
    eval: (code: string) => unknown;
    Event: typeof Event;
  };
  const saves: Saved[] = [];
  win.esc = (v: string | number | null | undefined) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
  win.api = (method: string, path: string, payload: Record<string, unknown>) => {
    saves.push({ method, path, payload });
    return Promise.resolve({ ok: true, data: {} });
  };
  win.editingCategoryKey = null;
  win.closeCategoryModal = () => {};
  win.loadCategories = () => Promise.resolve();

  win.eval(
    sliceBlock("var catChoices = []", "function syncCategoryExtraFields") +
      sliceBlock(
        "document.getElementById('category-form').addEventListener",
        "async function removeCategoryRow",
      ),
  );

  const doc = win.document;
  // A department is a hard requirement of the form; give it one to pick.
  const dept = doc.getElementById("cat-department") as HTMLSelectElement;
  const option = doc.createElement("option");
  option.value = "creative";
  dept.appendChild(option);
  dept.value = "creative";

  const setValue = (id: string, value: string) => {
    (doc.getElementById(id) as HTMLInputElement | HTMLSelectElement).value = value;
  };

  return {
    doc,
    saves,
    setValue,
    /** Load choices as the modal does when an admin clicks Edit. */
    load(options: unknown) {
      win.eval(
        "catChoices = choiceRowsFrom(" + JSON.stringify(options) + "); renderChoiceEditor();",
      );
    },
    rows(): unknown[] {
      return win.eval("JSON.parse(JSON.stringify(catChoices))") as unknown[];
    },
    payload(): { options: unknown[]; problem: string | null } {
      return win.eval("JSON.parse(JSON.stringify(choicesPayload()))") as {
        options: unknown[];
        problem: string | null;
      };
    },
    async save() {
      const form = doc.getElementById("category-form") as HTMLFormElement;
      form.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    error(): string {
      const el = doc.getElementById("category-error") as HTMLElement;
      return el.classList.contains("hidden") ? "" : (el.textContent ?? "");
    },
  };
}

const STAGING = [
  {
    label: "Virtual staging",
    imageUrl: "https://example.com/vs.jpg",
    priceCents: 5000,
    unitLabel: "per image",
    maxQuantity: 10,
    followUps: [
      {
        id: "style",
        label: "Preferred style",
        kind: "select",
        choices: ["Modern", "Farmhouse"],
        placeholder: null,
        required: true,
      },
    ],
  },
  {
    label: "Twilight edit",
    imageUrl: null,
    priceCents: 7500,
    unitLabel: null,
    maxQuantity: 1,
    followUps: [],
  },
];

describe("the choice editor", () => {
  it("shows a row per choice, with its price, quantity and questions", () => {
    const ui = mountEditor();
    ui.load(STAGING);

    const host = ui.doc.getElementById("cat-choices") as HTMLElement;
    const labels = Array.from(host.querySelectorAll<HTMLInputElement>(".ch-label")).map(
      (i) => i.value,
    );
    expect(labels).toEqual(["Virtual staging", "Twilight edit"]);
    expect(Array.from(host.querySelectorAll<HTMLInputElement>(".ch-price")).map((i) => i.value)) //
      .toEqual(["50", "75"]);
    expect(Array.from(host.querySelectorAll<HTMLInputElement>(".ch-qty")).map((i) => i.value)) //
      .toEqual(["10", "1"]);
    // The question the first choice asks is open, because it exists.
    expect((host.querySelector(".fu-label") as HTMLInputElement).value).toBe("Preferred style");
    expect((host.querySelector(".fu-choices") as HTMLInputElement).value).toBe("Modern, Farmhouse");
    expect((host.querySelector(".fu-req") as HTMLInputElement).checked).toBe(true);
  });

  it("round-trips what it was given", () => {
    const ui = mountEditor();
    ui.load(STAGING);
    expect(ui.payload().options).toEqual(STAGING);
  });

  it("edits the unit wording beside the price", () => {
    const ui = mountEditor();
    ui.load(STAGING);
    const host = ui.doc.getElementById("cat-choices") as HTMLElement;
    const units = Array.from(host.querySelectorAll<HTMLInputElement>(".ch-unit"));
    // Loaded as stored, and the blank one shows "each" as its placeholder so an
    // admin can see what the client reads without setting anything.
    expect(units.map((i) => i.value)).toEqual(["per image", ""]);
    expect(units[1].placeholder).toBe("each");

    units[1].value = "  per property  ";
    units[1].dispatchEvent(new (ui.doc.defaultView as Window & typeof globalThis).Event("input"));
    const options = ui.payload().options as Array<{ unitLabel: string | null }>;
    expect(options[1].unitLabel).toBe("per property");
  });

  it("stores no unit at all when the box is cleared", () => {
    const ui = mountEditor();
    ui.load(STAGING);
    const unit = ui.doc.querySelector(".ch-unit") as HTMLInputElement;
    unit.value = "   ";
    unit.dispatchEvent(new (ui.doc.defaultView as Window & typeof globalThis).Event("input"));
    const options = ui.payload().options as Array<{ unitLabel: string | null }>;
    expect(options[0].unitLabel).toBeNull();
  });

  it("reads the legacy bare-label form", () => {
    const ui = mountEditor();
    ui.load(["Photos", "Aerial / Drone"]);
    expect(ui.payload().options).toEqual([
      {
        label: "Photos",
        imageUrl: null,
        priceCents: null,
        unitLabel: null,
        maxQuantity: 1,
        followUps: [],
      },
      {
        label: "Aerial / Drone",
        imageUrl: null,
        priceCents: null,
        unitLabel: null,
        maxQuantity: 1,
        followUps: [],
      },
    ]);
  });

  it("keeps typing in one row out of the others", () => {
    const ui = mountEditor();
    ui.load(STAGING);
    const host = ui.doc.getElementById("cat-choices") as HTMLElement;
    const price = host.querySelectorAll<HTMLInputElement>(".ch-price")[1];
    price.value = "99.50";
    price.dispatchEvent(new (ui.doc.defaultView as Window & typeof globalThis).Event("input"));

    const options = ui.payload().options as Array<{ label: string; priceCents: number | null }>;
    expect(options[1].priceCents).toBe(9950);
    expect(options[0].priceCents).toBe(5000);
  });

  it("adds and removes questions without losing the rest of the row", () => {
    const ui = mountEditor();
    ui.load(STAGING);
    const host = ui.doc.getElementById("cat-choices") as HTMLElement;
    (host.querySelector(".ch-fu-add") as HTMLButtonElement).click();

    const asked = host.querySelectorAll<HTMLInputElement>(".fu-label");
    expect(asked).toHaveLength(2);
    asked[1].value = "Which image numbers / rooms?";
    asked[1].dispatchEvent(new (ui.doc.defaultView as Window & typeof globalThis).Event("input"));

    let options = ui.payload().options as Array<{ followUps: Array<{ label: string }> }>;
    expect(options[0].followUps.map((f) => f.label)).toEqual([
      "Preferred style",
      "Which image numbers / rooms?",
    ]);

    ui.doc.getElementById("cat-choices")!.querySelectorAll<HTMLButtonElement>(".fu-del")[0].click();
    options = ui.payload().options as Array<{ followUps: Array<{ label: string }> }>;
    expect(options[0].followUps.map((f) => f.label)).toEqual(["Which image numbers / rooms?"]);
  });

  it("names a price it could not read instead of saving a wrong one", () => {
    const ui = mountEditor();
    ui.load([{ label: "Retouch", priceCents: null, maxQuantity: 1, followUps: [] }]);
    const price = ui.doc.querySelector(".ch-price") as HTMLInputElement;
    price.value = "about a hundred";
    price.dispatchEvent(new (ui.doc.defaultView as Window & typeof globalThis).Event("input"));

    expect(ui.payload().problem).toContain("Retouch");
  });

  it("refuses a pick-from-a-list question with nothing to pick", () => {
    const ui = mountEditor();
    ui.load([
      {
        label: "Virtual staging",
        priceCents: null,
        maxQuantity: 1,
        followUps: [
          { id: "", label: "Preferred style", kind: "select", choices: [], required: false },
        ],
      },
    ]);
    expect(ui.payload().problem).toContain("Preferred style");
  });
});

describe("saving a request type", () => {
  async function saveWith(kind: string) {
    const ui = mountEditor();
    ui.load(STAGING);
    ui.setValue("cat-label", "Order an additional service");
    ui.setValue("cat-extra-field", kind);
    ui.setValue("cat-extra-label", "Which services?");
    await ui.save();
    return ui;
  }

  // The reported bug: choices typed into a "pick several" question came back
  // empty on the next load, because the save posted an empty list for anything
  // that was not a single-select.
  it("posts the choices for a pick-several question", async () => {
    const ui = await saveWith("multiselect");
    expect(ui.error()).toBe("");
    expect(ui.saves).toHaveLength(1);
    expect(ui.saves[0].payload.extraOptions).toEqual(STAGING);
  });

  it("posts the choices for a single-select question", async () => {
    const ui = await saveWith("select");
    expect(ui.saves[0].payload.extraOptions).toEqual(STAGING);
  });

  it("drops the choices when the question stops being a list", async () => {
    const ui = await saveWith("text");
    expect(ui.saves[0].payload.extraOptions).toEqual([]);
  });

  it("will not save a list question with no choices at all", async () => {
    const ui = mountEditor();
    ui.load([]);
    ui.setValue("cat-label", "Order an additional service");
    ui.setValue("cat-extra-field", "multiselect");
    ui.setValue("cat-extra-label", "Which services?");
    await ui.save();

    expect(ui.saves).toHaveLength(0);
    expect(ui.error()).toContain("at least one choice");
  });
});
