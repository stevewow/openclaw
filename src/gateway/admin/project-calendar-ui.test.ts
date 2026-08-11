import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  PROJECT_CALENDAR_COMPONENT_JS,
  PROJECT_CALENDAR_CSS,
  PROJECT_CALENDAR_MARKUP,
} from "./project-calendar-ui.js";

/**
 * The component ships as a string of browser JS that each SPA interpolates, so
 * the only way to test it is to run it the way a browser would: build the
 * markup, evaluate the source, and drive the returned handle. `esc` is supplied
 * by the host SPA in real use, so the harness supplies it too.
 */
function mountCalendar(cfg: Record<string, unknown>, now = new Date(2026, 6, 15)) {
  const dom = new JSDOM(`<!DOCTYPE html><div id="cal">${PROJECT_CALENDAR_MARKUP}</div>`, {
    runScripts: "outside-only",
  });
  const { window } = dom;
  // Freeze "now" so the today-marker and default month do not drift with the
  // clock the suite happens to run at.
  const RealDate = window.Date;
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      // @ts-expect-error - forwarding a variadic Date construction
      if (args.length === 0) super(now.getTime());
      // @ts-expect-error - forwarding a variadic Date construction
      else super(...args);
    }
    static now() {
      return now.getTime();
    }
  }
  window.Date = FixedDate as unknown as DateConstructor;

  const escape = (v: unknown) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
  window.eval(`var esc = ${escape.toString()};\n${PROJECT_CALENDAR_COMPONENT_JS}`);
  const create = (window as unknown as { createProjectCalendar: (c: unknown) => Calendar })
    .createProjectCalendar;
  const cal = create({ rootId: "cal", ...cfg });
  cal.render();
  return { window, doc: window.document, cal };
}

type Calendar = { render: () => void; goTo: (y: number, m: number) => void; today: () => void };

const JULY = { y: 2026, m: 6 };
const day = (d: number) => new Date(2026, JULY.m, d).getTime();

describe("createProjectCalendar", () => {
  it("lays July 2026 out with the 1st on its weekday", () => {
    const { doc } = mountCalendar({ tasks: () => [], projects: () => [] });
    expect(doc.querySelector(".cal-title")?.textContent).toBe("July 2026");
    // July 1 2026 is a Wednesday, so three blanks precede it.
    const cells = doc.querySelectorAll(".cal-days > div");
    const blanks = doc.querySelectorAll(".cal-day.other-month");
    expect(blanks.length).toBe(3);
    expect(cells.length).toBe(3 + 31);
    expect(
      doc.querySelector(".cal-day[data-date]")?.querySelector(".cal-day-num")?.textContent,
    ).toBe("1");
  });

  it("marks today and only today", () => {
    const { doc } = mountCalendar({ tasks: () => [], projects: () => [] });
    const todays = doc.querySelectorAll(".cal-day.today");
    expect(todays.length).toBe(1);
    expect(todays[0]?.querySelector(".cal-day-num")?.textContent).toBe("15");
  });

  it("draws a task chip on its due day, coloured by its project", () => {
    const { doc } = mountCalendar({
      tasks: () => [{ id: "t1", title: "Edit walkthrough", dueDate: day(9) }],
      projects: () => [],
      taskColor: () => "#c0000a",
    });
    const chip = doc.querySelector(".cal-task-chip");
    expect(chip?.textContent).toBe("Edit walkthrough");
    expect(chip?.getAttribute("style")).toContain("#c0000a");
    expect(chip?.closest(".cal-day")?.getAttribute("data-date")).toBe(String(day(9)));
  });

  it("skips tasks with no due date rather than dropping them on day one", () => {
    const { doc } = mountCalendar({
      tasks: () => [
        { id: "t1", title: "Undated", dueDate: null },
        { id: "t2", title: "Dated", dueDate: day(4) },
      ],
      projects: () => [],
    });
    const chips = doc.querySelectorAll(".cal-task-chip");
    expect(chips.length).toBe(1);
    expect(chips[0]?.textContent).toBe("Dated");
  });

  it("spans a project bar across its range and shapes the ends", () => {
    const { doc } = mountCalendar({
      tasks: () => [],
      projects: () => [
        { id: "p1", title: "Spring launch", color: "#c0000a", startDate: day(6), endDate: day(8) },
      ],
    });
    const bars = doc.querySelectorAll(".cal-proj-bar");
    expect(bars.length).toBe(3);
    expect(bars[0]?.classList.contains("cal-proj-start")).toBe(true);
    expect(bars[2]?.classList.contains("cal-proj-end")).toBe(true);
    // Only the first cell repeats the name; mid-run cells stay blank.
    expect(bars[0]?.textContent).toBe("Spring launch");
    expect(bars[1]?.textContent?.trim()).toBe("");
  });

  it("places a one-sided project range on the single date it has", () => {
    const { doc } = mountCalendar({
      tasks: () => [],
      projects: () => [
        { id: "p1", title: "Deadline only", color: "#333333", startDate: null, endDate: day(20) },
      ],
    });
    const bars = doc.querySelectorAll(".cal-proj-bar");
    expect(bars.length).toBe(1);
    expect(bars[0]?.classList.contains("cal-proj-solo")).toBe(true);
    expect(bars[0]?.closest(".cal-day")?.getAttribute("data-date")).toBe(String(day(20)));
  });

  it("caps the chips per day and says how many are hidden", () => {
    const { doc } = mountCalendar({
      tasks: () =>
        [1, 2, 3, 4, 5].map((n) => ({ id: `t${n}`, title: `Task ${n}`, dueDate: day(10) })),
      projects: () => [],
    });
    expect(doc.querySelectorAll(".cal-task-chip").length).toBe(3);
    expect(doc.querySelector(".cal-more")?.textContent).toBe("+2 more");
  });

  it("moves month to month and wraps across the year", () => {
    const { doc, cal } = mountCalendar({ tasks: () => [], projects: () => [] });
    const next = doc.querySelector(".cal-next") as HTMLElement;
    const prev = doc.querySelector(".cal-prev") as HTMLElement;
    next.click();
    expect(doc.querySelector(".cal-title")?.textContent).toBe("August 2026");
    for (let i = 0; i < 5; i++) next.click();
    expect(doc.querySelector(".cal-title")?.textContent).toBe("January 2027");
    prev.click();
    expect(doc.querySelector(".cal-title")?.textContent).toBe("December 2026");
    cal.today();
    expect(doc.querySelector(".cal-title")?.textContent).toBe("July 2026");
  });

  it("routes clicks to the task, project and day handlers", () => {
    const seen: string[] = [];
    const { doc } = mountCalendar({
      tasks: () => [{ id: "t1", title: "Task", dueDate: day(9) }],
      projects: () => [
        { id: "p1", title: "Proj", color: "#111111", startDate: day(3), endDate: day(3) },
      ],
      onTask: (id: string) => seen.push(`task:${id}`),
      onProject: (id: string) => seen.push(`project:${id}`),
      onDay: (ms: number) => seen.push(`day:${ms}`),
    });
    (doc.querySelector(".cal-task-chip") as HTMLElement).click();
    (doc.querySelector(".cal-proj-bar") as HTMLElement).click();
    // Empty space in a day cell means "add here", and must not also fire the
    // chip handler for a day that happens to hold one.
    (doc.querySelector('.cal-day[data-date="' + day(25) + '"]') as HTMLElement).click();
    expect(seen).toEqual(["task:t1", "project:p1", `day:${day(25)}`]);
  });

  /**
   * A tablet used to get seven squeezed columns and clipped chips. The fix is
   * structural rather than a breakpoint: both grids sit in one scroll box and
   * declare the same minimum width, so a narrow viewport scrolls the week
   * sideways with the weekday header still sitting over its own column.
   */
  it("keeps the weekday header and the day grid in one scroller", () => {
    const { doc } = mountCalendar({ tasks: () => [], projects: () => [] });
    const scroller = doc.querySelector(".cal-scroll");
    expect(scroller).not.toBeNull();
    expect(doc.querySelector(".cal-weekdays")?.closest(".cal-scroll")).toBe(scroller);
    expect(doc.querySelector(".cal-days")?.closest(".cal-scroll")).toBe(scroller);
    // Seven headers over seven columns — a day cell is still addressable.
    expect(doc.querySelectorAll(".cal-weekday").length).toBe(7);
    expect(doc.querySelector(".cal-day[data-date]")).not.toBeNull();
    // JSDOM does no layout, so the rules that do the actual work are asserted
    // directly: without all three the columns would collapse again.
    expect(PROJECT_CALENDAR_CSS).toContain(".cal-scroll { overflow-x: auto;");
    expect(PROJECT_CALENDAR_CSS).toMatch(/\.cal-weekdays, \.cal-days \{ min-width: \d+px; \}/);
    // The one that actually held the week together: a 1fr track is
    // minmax(auto, 1fr), so without a zero minimum a day holding a long chip
    // grew its own column and slid out from under its weekday header. Measured
    // at 768px this was a 52px drift before the rule and 0 after.
    expect(PROJECT_CALENDAR_CSS).toMatch(/\.cal-day \{ min-width: 0; overflow: hidden;/);
    // The small-screen block may compact rows, but must never restate a column
    // width — that is the collapse this fix removed.
    const narrow = PROJECT_CALENDAR_CSS.slice(PROJECT_CALENDAR_CSS.indexOf("@media"));
    expect(narrow).not.toContain("grid-template-columns");
  });

  it("offers no add affordance when the host passes no onDay", () => {
    const { doc } = mountCalendar({ tasks: () => [], projects: () => [] });
    expect(doc.querySelector(".cal-days")?.classList.contains("cal-readonly")).toBe(true);
    // Clicking a day with no handler must not throw.
    expect(() => (doc.querySelector(".cal-day[data-date]") as HTMLElement).click()).not.toThrow();
  });

  /**
   * The reported bug: a task due 8/6 drew on 8/5. The date input hands back
   * "2026-08-06"; the old save path ran that through `new Date(v)`, which JS
   * parses as UTC midnight — the evening of the 5th in every US timezone — and
   * the calendar bins by local day. These pin the round trip rather than the
   * arithmetic, so the pair can never drift apart again.
   */
  describe("date input round trip", () => {
    it("keeps the picked day when a date goes to storage and comes back", () => {
      const { window } = mountCalendar({ tasks: () => [], projects: () => [] });
      const w = window as unknown as {
        calDateInputMs: (v: string) => number | null;
        calDateInputValue: (ms: number) => string;
      };
      for (const picked of ["2026-08-06", "2026-01-01", "2026-12-31", "2026-03-08"]) {
        const stored = w.calDateInputMs(picked);
        expect(stored).not.toBeNull();
        expect(w.calDateInputValue(stored as number)).toBe(picked);
      }
    });

    it("bins a task due 8/6 on 8/6, not the day before", () => {
      const AUGUST = 7;
      const dueDate = ((): number => {
        const { window } = mountCalendar({ tasks: () => [], projects: () => [] });
        return (window as unknown as { calDateInputMs: (v: string) => number }).calDateInputMs(
          "2026-08-06",
        );
      })();
      const { doc, cal } = mountCalendar({
        tasks: () => [{ id: "t1", title: "Due the sixth", dueDate }],
        projects: () => [],
      });
      cal.goTo(2026, AUGUST);
      const on6 = doc.querySelector(
        '.cal-day[data-date="' + new Date(2026, AUGUST, 6).getTime() + '"] .cal-task-chip',
      );
      const on5 = doc.querySelector(
        '.cal-day[data-date="' + new Date(2026, AUGUST, 5).getTime() + '"] .cal-task-chip',
      );
      expect(on6?.textContent).toBe("Due the sixth");
      expect(on5).toBeNull();
    });

    it("rejects anything that is not a yyyy-mm-dd date", () => {
      const { window } = mountCalendar({ tasks: () => [], projects: () => [] });
      const parse = (window as unknown as { calDateInputMs: (v: unknown) => number | null })
        .calDateInputMs;
      for (const bad of ["", "not a date", "2026-8-6", "08/06/2026", null, undefined]) {
        expect(parse(bad)).toBeNull();
      }
    });
  });

  it("escapes titles rather than letting them inject markup", () => {
    const { doc } = mountCalendar({
      tasks: () => [{ id: "t1", title: "<img src=x onerror=alert(1)>", dueDate: day(9) }],
      projects: () => [],
    });
    const chip = doc.querySelector(".cal-task-chip");
    expect(chip?.querySelector("img")).toBeNull();
    expect(chip?.textContent).toBe("<img src=x onerror=alert(1)>");
  });
});
