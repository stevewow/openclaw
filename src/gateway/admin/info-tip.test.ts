import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { infoTip, INFO_TIP_COMPONENT_JS, INFO_TIP_CSS, infoTipSlot } from "./info-tip.js";
import { SALES_DASHBOARD_MARKUP } from "./sales-dashboard-ui.js";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * The describer ships as inline script inside a template string, so nothing in
 * the build ever runs it. These boot it in a DOM and drive it the way a person
 * would — hover, tab, click, Escape — because that behavior is the whole
 * feature: the prose is only allowed off the page if it is genuinely one
 * gesture away.
 */
function mount(markup: string) {
  const dom = new JSDOM(
    `<!DOCTYPE html><body><h1>Heading${markup}</h1><p id="elsewhere">elsewhere</p></body>`,
    {
      runScripts: "outside-only",
    },
  );
  dom.window.eval(INFO_TIP_COMPONENT_JS);
  const doc = dom.window.document;
  const btn = doc.querySelector(".info-btn") as HTMLElement;
  const pop = doc.querySelector(".info-pop") as HTMLElement;
  const fire = (target: Element, type: string) => {
    target.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true }));
  };
  return { dom, doc, btn, pop, fire };
}

const shown = (pop: HTMLElement) => !pop.hasAttribute("hidden");

describe("info tip markup", () => {
  it("starts closed, and says so to a screen reader", () => {
    const html = infoTip("<p>How a shoot is counted.</p>", { label: "About counting" });
    const { btn, pop } = mount(html);
    expect(btn.getAttribute("aria-label")).toBe("About counting");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(pop.getAttribute("role")).toBe("tooltip");
    expect(shown(pop)).toBe(false);
    // The words are in the page even while folded away, so find-in-page and a
    // screen reader still reach them.
    expect(pop.textContent).toContain("How a shoot is counted.");
  });

  it("gives a slot tip an id the view can write into", () => {
    const { doc } = mount(infoTipSlot("sd-score-about"));
    const pop = doc.getElementById("sd-score-about");
    expect(pop?.classList.contains("info-pop")).toBe(true);
    expect(pop?.textContent).toBe("");
  });
});

describe("info tip behavior", () => {
  it("opens on hover and closes when the pointer leaves", async () => {
    const { doc, btn, pop, fire } = mount(infoTip("<p>Counted on the day of the shoot.</p>"));
    fire(btn, "mouseover");
    expect(shown(pop)).toBe(true);
    expect(btn.getAttribute("aria-expanded")).toBe("true");

    fire(doc.getElementById("elsewhere") as HTMLElement, "mouseover");
    await new Promise((r) => setTimeout(r, 250));
    expect(shown(pop)).toBe(false);
  });

  it("stays open while the pointer is inside the popover, so its text can be read", async () => {
    const { pop, btn, fire } = mount(infoTip('<p>See <a href="#kb">the article</a>.</p>'));
    fire(btn, "mouseover");
    fire(pop.querySelector("a")!, "mouseover");
    await new Promise((r) => setTimeout(r, 250));
    expect(shown(pop)).toBe(true);
  });

  it("pins open on a click — the only way in on a touch screen — and a second click closes it", () => {
    const { doc, btn, pop, fire } = mount(infoTip("<p>Cancelled orders do not count.</p>"));
    fire(btn, "click");
    expect(shown(pop)).toBe(true);
    // Reading the popover is not a request to dismiss it.
    fire(pop, "click");
    expect(shown(pop)).toBe(true);
    // Moving the pointer away no longer closes a pinned tip.
    fire(doc.getElementById("elsewhere") as HTMLElement, "mouseover");
    expect(shown(pop)).toBe(true);

    fire(btn, "click");
    expect(shown(pop)).toBe(false);
  });

  it("closes a pinned tip on a click anywhere else", () => {
    const { doc, btn, pop, fire } = mount(infoTip("<p>Revenue divided by completed shoots.</p>"));
    fire(btn, "click");
    fire(doc.getElementById("elsewhere") as HTMLElement, "click");
    expect(shown(pop)).toBe(false);
  });

  it("opens on keyboard focus and describes the button once open", () => {
    const { btn, pop } = mount(infoTip("<p>Market of the client's company.</p>"));
    btn.dispatchEvent(
      new (btn.ownerDocument.defaultView as Window & typeof globalThis).FocusEvent("focusin", {
        bubbles: true,
      }),
    );
    expect(shown(pop)).toBe(true);
    expect(pop.id).toBeTruthy();
    expect(btn.getAttribute("aria-describedby")).toBe(pop.id);
  });

  it("closes on Escape and hands focus back to the button", () => {
    const { dom, doc, btn, pop, fire } = mount(infoTip("<p>Back to Jan 1.</p>"));
    fire(btn, "click");
    doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(shown(pop)).toBe(false);
    expect(doc.activeElement).toBe(btn);
  });

  it("stays quiet until a slot tip has something to say", () => {
    const { btn, pop, fire } = mount(infoTipSlot("prt-market-note"));
    fire(btn, "click");
    expect(shown(pop)).toBe(false);

    pop.textContent = "Median days a house sits before it goes under contract.";
    fire(btn, "click");
    expect(shown(pop)).toBe(true);
  });

  it("shows one describer at a time", () => {
    const { doc, fire } = mount(infoTip("<p>First.</p>") + infoTip("<p>Second.</p>"));
    const btns = Array.from(doc.querySelectorAll(".info-btn"));
    const pops = Array.from(doc.querySelectorAll(".info-pop")) as HTMLElement[];
    fire(btns[0]!, "click");
    fire(btns[1]!, "click");
    expect(shown(pops[0])).toBe(false);
    expect(shown(pops[1])).toBe(true);
  });
});

describe("the Hub's describers", () => {
  it("keeps the sales dashboard's explanation off the page and behind its button", () => {
    const doc = new JSDOM(`<!DOCTYPE html><body>${SALES_DASHBOARD_MARKUP}</body>`).window.document;
    const about = Array.from(doc.querySelectorAll(".info-pop")).find((el) =>
      (el.textContent ?? "").includes("An order counts once its shoot is done"),
    );
    expect(about).toBeTruthy();
    // Nothing outside a popover repeats it.
    const loose = doc.body.cloneNode(true) as HTMLElement;
    loose.querySelectorAll(".info-pop").forEach((el) => el.remove());
    expect(loose.textContent).not.toContain("An order counts once its shoot is done");
  });

  it("ships the describer to both signed-in surfaces", () => {
    for (const page of [ADMIN_UI_HTML, USER_PORTAL_HTML]) {
      expect(page).toContain(INFO_TIP_CSS);
      expect(page).toContain(INFO_TIP_COMPONENT_JS);
    }
  });
});
