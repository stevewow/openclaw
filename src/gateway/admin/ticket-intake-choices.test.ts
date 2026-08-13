import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { type IntakeCategoryView, renderTicketIntakeHtml } from "./ticket-intake-html.js";

/**
 * The client's side of quantities and per-choice questions: ticking "Virtual
 * staging", ordering three of them, and answering the two questions that only
 * appear once it is picked. The page is inline JS in a template string, so the
 * only way to prove it works is to run it against a real DOM.
 */

const STAGING: IntakeCategoryView = {
  key: "additional_service",
  label: "Order an additional service",
  iconSvg: '<svg viewBox="0 0 24 24"></svg>',
  extraField: "multiselect",
  extraLabel: "Which services?",
  extraOptions: [
    {
      label: "Virtual staging",
      imageUrl: null,
      priceCents: 5000,
      priceMaxCents: null,
      quoteRequired: false,
      unitLabel: null,
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
        {
          id: "rooms",
          label: "Which image numbers / rooms?",
          kind: "textarea",
          choices: [],
          placeholder: "e.g. images 3, 7 and 12",
          required: true,
        },
      ],
    },
    {
      label: "Twilight edit",
      imageUrl: null,
      priceCents: 7500,
      priceMaxCents: null,
      quoteRequired: false,
      unitLabel: null,
      maxQuantity: 1,
      followUps: [],
    },
  ],
  extraPlaceholder: null,
  detailsLabel: "Details",
  detailsHint: null,
};

type Posted = { url: string; body: Record<string, unknown> };

function openForm(categories: IntakeCategoryView[] = [STAGING]) {
  const html = renderTicketIntakeHtml(categories);
  const dom = new JSDOM(html, {
    url: "https://example.com/support?orderId=A-1",
    runScripts: "outside-only",
  });
  const win = dom.window as unknown as Record<string, unknown> & {
    document: Document;
    eval: (code: string) => unknown;
    Event: typeof Event;
  };
  const posts: Posted[] = [];
  win.fetch = (url: string, init: { body: string }) => {
    posts.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true, number: "WVT-1042" }),
    });
  };
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!script?.[1]) {
    throw new Error("no inline script on the intake page");
  }
  win.eval(script[1]);

  const doc = win.document;
  const fire = (el: Element, type: string) => {
    el.dispatchEvent(new win.Event(type, { bubbles: true, cancelable: true }));
  };
  const setValue = (el: Element, value: string, type = "input") => {
    (el as HTMLInputElement).value = value;
    fire(el, type);
  };
  return {
    doc,
    posts,
    fire,
    setValue,
    choices: () => Array.from(doc.querySelectorAll(".choice")),
    ticks: () => Array.from(doc.querySelectorAll<HTMLInputElement>(".choice-input")),
    /** Tick or untick a choice the way a client does — by clicking it. */
    tick: (i: number) => doc.querySelectorAll<HTMLInputElement>(".choice-input")[i].click(),
    groups: () => Array.from(doc.querySelectorAll(".followup-group")),
    total: () => (doc.getElementById("choice-total") as HTMLElement).textContent ?? "",
    totalHidden: () =>
      (doc.getElementById("choice-total") as HTMLElement).classList.contains("hidden"),
    error: () => {
      const el = doc.getElementById("err") as HTMLElement;
      return el.style.display === "block" ? (el.textContent ?? "") : "";
    },
    /** Fill everything the form demands of every submission. */
    fillRequester() {
      setValue(doc.getElementById("f-name")!, "Dana Agent");
      setValue(doc.getElementById("f-email")!, "dana@example.com");
      setValue(doc.getElementById("f-details")!, "Listing goes live Monday.");
    },
    async submit() {
      fire(doc.getElementById("intake-form")!, "submit");
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

describe("picking a choice that carries a quantity", () => {
  it("hides the quantity picker until the choice is ticked", () => {
    const ui = openForm();
    const [staging] = ui.choices();
    expect(staging.querySelector(".qty")?.classList.contains("hidden")).toBe(true);

    ui.tick(0);
    expect(staging.querySelector(".qty")?.classList.contains("hidden")).toBe(false);
    // The tick-once choice never grows one.
    expect(ui.choices()[1].querySelector(".qty")).toBeNull();
  });

  it("offers exactly the quantities the admin allowed", () => {
    const ui = openForm();
    const options = Array.from(
      ui.doc.querySelectorAll<HTMLOptionElement>(".qty-select option"),
    ).map((o) => o.value);
    expect(options).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });

  it("multiplies the running total by the quantity", () => {
    const ui = openForm();
    ui.tick(0);
    expect(ui.total()).toContain("$50");

    ui.setValue(ui.doc.querySelector(".qty-select")!, "3", "change");
    expect(ui.total()).toContain("$150");

    ui.tick(1);
    expect(ui.total()).toContain("$225");
  });

  it("drops the total again when everything is unticked", () => {
    const ui = openForm();
    ui.tick(0);
    ui.tick(0);
    expect(ui.totalHidden()).toBe(true);
  });
});

describe("the questions a choice brings with it", () => {
  it("asks nothing until its choice is picked", () => {
    const ui = openForm();
    expect(ui.groups()).toHaveLength(0);

    ui.tick(0);
    const [group] = ui.groups();
    expect(group.querySelector(".fg-title")?.textContent).toBe("Virtual staging");
    const asked = Array.from(group.querySelectorAll("label")).map((l) =>
      l.textContent?.replace(" *", ""),
    );
    expect(asked).toEqual(["Preferred style", "Which image numbers / rooms?"]);
    // The list question is a dropdown of the admin's choices; the long one a box.
    expect(group.querySelector("select")?.textContent).toContain("Farmhouse");
    expect(group.querySelector("textarea")).not.toBeNull();
  });

  it("takes its questions away when the choice is unticked", () => {
    const ui = openForm();
    ui.tick(0);
    ui.tick(0);
    expect(ui.groups()).toHaveLength(0);
  });

  it("gives an answer back if the choice is re-ticked", () => {
    const ui = openForm();
    ui.tick(0);
    ui.setValue(ui.doc.getElementById("fu-0-rooms")!, "Images 3, 7 and 12");

    ui.tick(0);
    ui.tick(0);

    expect((ui.doc.getElementById("fu-0-rooms") as HTMLTextAreaElement).value).toBe(
      "Images 3, 7 and 12",
    );
  });

  it("names the quantity in the panel heading", () => {
    const ui = openForm();
    ui.tick(0);
    ui.setValue(ui.doc.querySelector(".qty-select")!, "3", "change");
    expect(ui.groups()[0].querySelector(".fg-title")?.textContent).toBe("Virtual staging × 3");
  });
});

describe("submitting", () => {
  it("sends the choice, its quantity and its answers", async () => {
    const ui = openForm();
    ui.tick(0);
    ui.setValue(ui.doc.querySelector(".qty-select")!, "3", "change");
    ui.setValue(ui.doc.getElementById("fu-0-style")!, "Modern", "change");
    ui.setValue(ui.doc.getElementById("fu-0-rooms")!, "Images 3, 7 and 12");
    ui.fillRequester();
    await ui.submit();

    expect(ui.posts).toHaveLength(1);
    expect(ui.posts[0].body.extraSelections).toEqual([
      {
        label: "Virtual staging",
        quantity: 3,
        answers: [
          { id: "style", value: "Modern" },
          { id: "rooms", value: "Images 3, 7 and 12" },
        ],
      },
    ]);
    // The labels-only shape older server builds read still travels with it.
    expect(ui.posts[0].body.extraValues).toEqual(["Virtual staging"]);
  });

  it("stops on a required question the client skipped", async () => {
    const ui = openForm();
    ui.tick(0);
    ui.setValue(ui.doc.getElementById("fu-0-style")!, "Modern", "change");
    ui.fillRequester();
    await ui.submit();

    expect(ui.posts).toHaveLength(0);
    expect(ui.error()).toContain("Which image numbers / rooms?");
  });

  it("asks nothing of a choice with no questions", async () => {
    const ui = openForm();
    ui.tick(1);
    ui.fillRequester();
    await ui.submit();

    expect(ui.posts[0].body.extraSelections).toEqual([
      { label: "Twilight edit", quantity: 1, answers: [] },
    ]);
  });
});

// "each" reads wrong for most of what we sell — virtual staging is priced per
// image, an aerial add-on per property. The wording is per choice and admin-set.
describe("how a price is worded", () => {
  function priceOf(ui: ReturnType<typeof openForm>, i: number) {
    return ui.choices()[i].querySelector(".cp")?.textContent ?? "";
  }
  function withUnits(...units: Array<string | null>): IntakeCategoryView {
    const extraOptions = STAGING.extraOptions.map((o, i) => {
      const copy = structuredClone(o);
      copy.unitLabel = units[i] ?? null;
      return copy;
    });
    return { ...STAGING, extraOptions };
  }

  it("uses the admin's wording instead of each", () => {
    const ui = openForm([withUnits("per image")]);
    expect(priceOf(ui, 0)).toBe("$50 per image");
  });

  it("falls back to each only where there is something to multiply", () => {
    const ui = openForm([withUnits(null, null)]);
    // maxQuantity 10 — the client picks a number, so "each" is meaningful.
    expect(priceOf(ui, 0)).toBe("$50 each");
    // maxQuantity 1 — nothing to multiply, so the bare price is the whole story.
    expect(priceOf(ui, 1)).toBe("$75");
  });

  it("honours the wording on a one-off choice too", () => {
    const ui = openForm([withUnits(null, "per property")]);
    expect(priceOf(ui, 1)).toBe("$75 per property");
  });

  it("still multiplies the running total by the quantity, not the wording", () => {
    const ui = openForm([withUnits("per image")]);
    ui.tick(0);
    ui.setValue(ui.doc.querySelector(".qty-select")!, "3", "change");
    expect(ui.total()).toContain("$150");
  });
});

// A firm add-on can be scheduled the moment it arrives; a ranged one waits on a
// quote the client accepts. The form has to say which is which BEFORE they
// submit, and must never present the two as one confident number.
describe("choices that have to be quoted", () => {
  const RANGED: IntakeCategoryView = {
    ...STAGING,
    extraOptions: [
      {
        label: "Twilight edit",
        imageUrl: null,
        priceCents: 7500,
        priceMaxCents: null,
        quoteRequired: false,
        unitLabel: null,
        maxQuantity: 1,
        followUps: [],
      },
      {
        label: "Item removal",
        imageUrl: null,
        priceCents: 2500,
        priceMaxCents: 7500,
        quoteRequired: true,
        unitLabel: "per photo",
        maxQuantity: 10,
        followUps: [],
      },
      {
        label: "Custom retouching",
        imageUrl: null,
        priceCents: null,
        priceMaxCents: null,
        quoteRequired: true,
        unitLabel: null,
        maxQuantity: 1,
        followUps: [],
      },
    ],
  };
  const open = () => openForm([RANGED]);
  const priceOf = (ui: ReturnType<typeof openForm>, i: number) =>
    ui.choices()[i].querySelector(".cp")?.textContent ?? "";
  const flagOf = (ui: ReturnType<typeof openForm>, i: number) =>
    ui.choices()[i].querySelector(".cq")?.textContent ?? "";
  const rows = (ui: ReturnType<typeof openForm>) =>
    Array.from(ui.doc.querySelectorAll(".tot-row")).map((r) => r.textContent ?? "");
  const grand = (ui: ReturnType<typeof openForm>) =>
    ui.doc.querySelector(".tot-grand")?.textContent ?? "";

  it("shows a range and marks it as needing a quote", () => {
    const ui = open();
    expect(priceOf(ui, 1)).toBe("$25–$75 per photo");
    expect(flagOf(ui, 1)).toBe("Quoted first");
    // A firm choice carries no marker at all.
    expect(flagOf(ui, 0)).toBe("");
  });

  it("offers a figure-less choice as priced on request", () => {
    const ui = open();
    expect(priceOf(ui, 2)).toBe("");
    expect(flagOf(ui, 2)).toBe("Priced on request");
  });

  it("splits the total into what starts now and what waits", () => {
    const ui = open();
    ui.tick(0);
    ui.tick(1);
    ui.setValue(ui.doc.querySelector(".qty-select")!, "2", "change");

    expect(rows(ui)).toEqual(["Starts right away$75", "Quoted before we start$50–$150"]);
    expect(grand(ui)).toBe("Estimated total$125–$225");
    expect(ui.total()).toContain("Nothing is charged until you approve it.");
  });

  it("keeps a firm-only pick as one plain number", () => {
    const ui = open();
    ui.tick(0);
    // No split lines to read when there is nothing waiting on a quote.
    expect(rows(ui)).toEqual([]);
    expect(grand(ui)).toBe("Estimated total$75");
    // The firm-only total stands on its own — no reassurance note under it.
    expect(ui.total()).not.toContain("tot-note");
  });

  it("drops the split again when the quoted choice is unticked", () => {
    const ui = open();
    ui.tick(0);
    ui.tick(1);
    expect(rows(ui)).toHaveLength(2);
    ui.tick(1);
    expect(rows(ui)).toEqual([]);
    expect(grand(ui)).toBe("Estimated total$75");
  });

  it("says a figure-less pick is still to be priced instead of inventing a number", () => {
    const ui = open();
    ui.tick(0);
    ui.tick(2);
    expect(rows(ui)).toEqual(["Starts right away$75", "Quoted before we startTo be quoted"]);
    // The "+" is what stops $75 reading as the whole job.
    expect(grand(ui)).toBe("Estimated total$75 +");
  });

  it("shows a quoted-only pick without a phantom firm line", () => {
    const ui = open();
    ui.tick(1);
    expect(rows(ui)).toEqual(["Quoted before we start$25–$75"]);
    expect(grand(ui)).toBe("Estimated total$25–$75");
  });

  it("submits a quoted choice like any other — the server prices it", async () => {
    const ui = open();
    ui.tick(1);
    ui.fillRequester();
    await ui.submit();
    expect(ui.posts[0].body.extraSelections).toEqual([
      { label: "Item removal", quantity: 1, answers: [] },
    ]);
  });
});
