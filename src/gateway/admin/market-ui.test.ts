import { describe, expect, it } from "vitest";
import { MARKET_COMPONENT_JS } from "./market-ui.js";

/**
 * The Market report's formatting, colouring and mount live in a string of
 * browser JS that no type or lint pass reads, and it is embedded verbatim by
 * both SPAs — so a break here breaks the dashboard and the portal at once.
 *
 * Direction is the part most worth proving: rising days-on-market is bad news
 * while rising homes-sold is good, and getting that backwards would paint a
 * shrinking market green.
 */

type MetricLike = {
  key: string;
  label: string;
  format: string;
  direction: string;
  note: string;
  display: string | null;
  latest: number | null;
  yoy: string | null;
  rolling: { current: number; prior: number; changePct: number | null; mode: string } | null;
};
type AreaLike = {
  key: string;
  label: string;
  error: string | null;
  vsNationalPct: number | null;
  metrics: MetricLike[];
};
type ReportLike = {
  national: AreaLike | null;
  regions: AreaLike[];
  refreshedAt?: number | null;
  stale?: boolean;
  configured?: boolean;
  neverRefreshed?: boolean;
  dataThrough?: string | null;
  lagMonths?: number | null;
  missingRegions?: string[];
};

/** A stand-in for the one DOM property each element is used through. */
type FakeEl = {
  value: string;
  innerHTML: string;
  textContent: string;
  hidden: boolean;
  onchange: (() => void) | null;
  classList: { toggle: (cls: string, on: boolean) => void };
};

function fakeEl(value = ""): FakeEl {
  const el: FakeEl = {
    value,
    innerHTML: "",
    textContent: "",
    hidden: false,
    onchange: null,
    classList: {
      toggle: (_cls: string, on: boolean) => {
        el.hidden = on;
      },
    },
  };
  return el;
}

type TableStub = {
  cfg: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  errored: boolean;
};

/**
 * Evaluate the shipped component with stubs for what the host SPA provides.
 * `els` is the fake document, keyed by element id.
 */
function loadMarketUi(els: Record<string, FakeEl> = {}) {
  const tables: TableStub[] = [];
  const scope = {
    esc: (s: unknown) => String(s),
    money: (n: unknown) => `$${Number(n).toLocaleString()}`,
    document: { getElementById: (id: string) => els[id] ?? null },
    createReportTable: (cfg: Record<string, unknown>) => {
      const t: TableStub = { cfg, rows: [], errored: false };
      tables.push(t);
      return {
        setData: (rows: Array<Record<string, unknown>>) => {
          t.rows = rows;
        },
        setError: () => {
          t.errored = true;
        },
      };
    },
  };
  // Evaluating the shipped component is the point of this suite; the input is
  // our own source file, not user data.
  // oxlint-disable-next-line no-implied-eval
  const factory = new Function(
    "esc",
    "money",
    "document",
    "createReportTable",
    `${MARKET_COMPONENT_JS}\nreturn { marketFmt, marketPct, marketClass, marketRowsFor, marketMetricOptions, marketWarnings, marketCols, createMarketReport };`,
  );
  const api = factory(scope.esc, scope.money, scope.document, scope.createReportTable) as {
    marketFmt: (v: number | null, format: string) => string;
    marketPct: (p: number | null) => string;
    marketClass: (p: number | null, direction: string) => string;
    marketRowsFor: (
      report: ReportLike | null,
      key: string,
    ) => Array<{ key: string; metric: MetricLike | null }>;
    marketMetricOptions: (report: ReportLike | null) => Array<{ key: string; label: string }>;
    marketWarnings: (report: ReportLike | null, adminHints: boolean) => string[];
    marketCols: (getKey: () => string) => Array<{
      key: string;
      value: (r: unknown) => unknown;
      render: (r: unknown) => string;
    }>;
    createMarketReport: (cfg: Record<string, unknown>) => {
      setReport: (r: ReportLike) => void;
      setError: () => void;
      render: () => void;
    };
  };
  return { ...api, tables };
}

const metric = (over: Partial<MetricLike> = {}): MetricLike => ({
  key: "homesSold",
  label: "Homes Sold",
  format: "count",
  direction: "up",
  note: "The addressable market.",
  display: "1,234",
  latest: 1234,
  yoy: "+5.4%",
  rolling: { current: 12000, prior: 10000, changePct: 20, mode: "sum" },
  ...over,
});

const report: ReportLike = {
  national: {
    key: "national",
    label: "United States",
    error: null,
    vsNationalPct: null,
    metrics: [metric()],
  },
  regions: [
    {
      key: "lima",
      label: "Lima",
      error: null,
      vsNationalPct: -20,
      metrics: [metric({ latest: 90 }), metric({ key: "daysOnMarket", direction: "down" })],
    },
    // A region that failed to load keeps its row: dropping it would read as
    // "no market here", which is the wrong conclusion.
    { key: "toledo", label: "Toledo", error: "HTTP 502", vsNationalPct: null, metrics: [] },
  ],
  refreshedAt: 1000,
  stale: false,
  configured: true,
  neverRefreshed: false,
  dataThrough: "2026-05-31",
  lagMonths: 3,
  missingRegions: [],
};

describe("marketFmt", () => {
  const { marketFmt } = loadMarketUi();

  it("formats each metric the way its unit reads", () => {
    expect(marketFmt(289827, "money")).toBe("$289,827");
    expect(marketFmt(1234.6, "count")).toBe("1,235");
    expect(marketFmt(48.7, "days")).toBe("49 days");
    expect(marketFmt(4.23, "months")).toBe("4.2 mo");
  });

  it("shows a ratio and an already-percent value alike", () => {
    // Sale-to-list arrives as 0.9857; price drops arrive as 12.4.
    expect(marketFmt(0.9857, "percent")).toBe("98.6%");
    expect(marketFmt(12.44, "percent")).toBe("12.4%");
  });

  it("shows a dash rather than a zero when there is no number", () => {
    expect(marketFmt(null, "count")).toBe("—");
    expect(marketFmt(Number.NaN, "money")).toBe("—");
  });
});

describe("marketPct", () => {
  const { marketPct } = loadMarketUi();

  it("signs the change so direction never has to be inferred", () => {
    expect(marketPct(12.34)).toBe("+12.3%");
    expect(marketPct(-8.06)).toBe("-8.1%");
    expect(marketPct(0)).toBe("0%");
    expect(marketPct(null)).toBe("—");
  });
});

describe("marketClass", () => {
  const { marketClass } = loadMarketUi();

  it("colours by what the change means, not by its sign", () => {
    // More homes sold is good; more days on market is not.
    expect(marketClass(10, "up")).toBe("focus-up");
    expect(marketClass(-10, "up")).toBe("focus-down");
    expect(marketClass(10, "down")).toBe("focus-down");
    expect(marketClass(-10, "down")).toBe("focus-up");
  });

  it("leaves months of supply uncoloured — neither end is good for us", () => {
    expect(marketClass(30, "neutral")).toBe("");
    expect(marketClass(-30, "neutral")).toBe("");
  });

  it("does not paint noise", () => {
    expect(marketClass(0, "up")).toBe("");
    expect(marketClass(0.01, "up")).toBe("");
    expect(marketClass(null, "up")).toBe("");
  });
});

describe("marketRowsFor", () => {
  const { marketRowsFor } = loadMarketUi();

  it("leads with the nation, then every region, failures included", () => {
    expect(marketRowsFor(report, "homesSold").map((r) => r.key)).toEqual([
      "national",
      "lima",
      "toledo",
    ]);
  });

  it("pulls only the selected metric out of each area", () => {
    expect(marketRowsFor(report, "daysOnMarket").map((r) => r.metric?.key ?? null)).toEqual([
      null,
      "daysOnMarket",
      null,
    ]);
  });

  it("gives a failed area a null metric rather than dropping the row", () => {
    const toledo = marketRowsFor(report, "homesSold").find((r) => r.key === "toledo");
    expect(toledo).toBeTruthy();
    expect(toledo?.metric).toBeNull();
  });

  it("has no rows before anything is loaded", () => {
    expect(marketRowsFor(null, "homesSold")).toEqual([]);
  });
});

describe("marketMetricOptions", () => {
  const { marketMetricOptions } = loadMarketUi();

  it("offers each metric the feed actually returned, once", () => {
    expect(marketMetricOptions(report).map((m) => m.key)).toEqual(["homesSold", "daysOnMarket"]);
  });

  it("never leaves the picker empty", () => {
    expect(marketMetricOptions(null).map((m) => m.key)).toEqual(["homesSold"]);
  });
});

describe("marketWarnings", () => {
  const { marketWarnings } = loadMarketUi();

  it("leads with how stale the series is", () => {
    expect(marketWarnings(report, true).join(" ")).toContain("2026-05");
    expect(marketWarnings(report, true).join(" ")).toContain("3 months behind");
  });

  it("tells an admin to set the key and everyone else to ask one", () => {
    const unset = { ...report, configured: false };
    expect(marketWarnings(unset, true).join(" ")).toContain("REALTYAPI_KEY");
    // A BDS cannot act on an env var, so the portal must not name one.
    expect(marketWarnings(unset, false).join(" ")).not.toContain("REALTYAPI_KEY");
    expect(marketWarnings(unset, false).join(" ")).toContain("Ask an admin");
  });

  it("names regions the business serves that the report cannot cover", () => {
    const missing = { ...report, missingRegions: ["akron"] };
    expect(marketWarnings(missing, true).join(" ")).toContain("akron");
  });

  it("says nothing when the data is current and complete", () => {
    expect(marketWarnings({ ...report, lagMonths: 0 }, true)).toEqual([]);
  });
});

describe("marketCols", () => {
  const { marketCols } = loadMarketUi();
  const cols = (key = "homesSold") => marketCols(() => key);
  const col = (name: string, key = "homesSold") => {
    const c = cols(key).find((x) => x.key === name);
    if (!c) {
      throw new Error(`no ${name} column`);
    }
    return c;
  };

  it("renders every cell of a failed row without throwing", () => {
    const row = {
      key: "toledo",
      label: "Toledo",
      error: "HTTP 502",
      vsNationalPct: null,
      metric: null,
    };
    for (const c of cols()) {
      expect(typeof c.render(row)).toBe("string");
      expect(() => c.value(row)).not.toThrow();
    }
    // The reason belongs on the row, not hidden in a tooltip.
    expect(col("market").render(row)).toContain("HTTP 502");
  });

  it("sorts on the number, not on the formatted string", () => {
    const row = { key: "lima", label: "Lima", error: null, vsNationalPct: -20, metric: metric() };
    expect(col("latest").value(row)).toBe(1234);
    expect(col("rolling").value(row)).toBe(12000);
    expect(col("change").value(row)).toBe(20);
  });

  it("says whether a rolling figure is a total or an average", () => {
    const sum = { key: "a", label: "A", error: null, vsNationalPct: null, metric: metric() };
    const avg = {
      key: "b",
      label: "B",
      error: null,
      vsNationalPct: null,
      metric: metric({
        format: "days",
        rolling: { current: 42, prior: 40, changePct: 5, mode: "average" },
      }),
    };
    expect(col("rolling").render(sum)).toContain("total");
    expect(col("rolling").render(avg)).toContain("avg");
  });

  it("blanks vs-national for anything but homes sold", () => {
    // The comparison is computed on homes sold alone, so beside a median price
    // it would be a number that means nothing.
    const row = {
      key: "lima",
      label: "Lima",
      error: null,
      vsNationalPct: -20,
      metric: metric({ key: "medianSalePrice" }),
    };
    expect(col("vsNational", "medianSalePrice").render(row)).not.toContain("pts");
    expect(col("vsNational").render(row)).toContain("-20 pts");
  });

  it("prefers Redfin's own formatted value when it sent one", () => {
    const row = {
      key: "lima",
      label: "Lima",
      error: null,
      vsNationalPct: null,
      metric: metric({ display: "$289,827", latest: 289827, format: "money" }),
    };
    expect(col("latest").render(row)).toContain("$289,827");
  });
});

describe("createMarketReport", () => {
  function mount(cfg: Record<string, unknown> = {}) {
    const els: Record<string, FakeEl> = {
      sel: fakeEl(),
      note: fakeEl(),
      national: fakeEl(),
      warning: fakeEl(),
      refreshed: fakeEl(),
    };
    const ui = loadMarketUi(els);
    const view = ui.createMarketReport({
      metricSelectId: "sel",
      tableId: "market-table",
      reportKey: "market",
      noteId: "note",
      nationalId: "national",
      warningId: "warning",
      refreshedAtId: "refreshed",
      ...cfg,
    });
    return { view, els, ui };
  }

  it("fills the metric picker from the payload and shows the first metric", () => {
    const { view, els, ui } = mount();
    view.setReport(report);
    expect(els.sel.innerHTML).toContain('value="homesSold"');
    expect(els.sel.innerHTML).toContain('value="daysOnMarket"');
    expect(els.sel.value).toBe("homesSold");
    expect(ui.tables[0].rows.map((r) => r.key)).toEqual(["national", "lima", "toledo"]);
  });

  it("keeps the reader's metric across a reload", () => {
    const { view, els, ui } = mount();
    view.setReport(report);
    els.sel.value = "daysOnMarket";
    view.setReport(report);
    expect(els.sel.value).toBe("daysOnMarket");
    // Only Lima carries that metric, so the other two rows go blank.
    expect(ui.tables[0].rows.map((r) => (r.metric ? "yes" : "no"))).toEqual(["no", "yes", "no"]);
  });

  it("falls back when the selected metric vanishes from the feed", () => {
    const { view, els } = mount();
    view.setReport(report);
    els.sel.value = "daysOnMarket";
    view.setReport({ ...report, regions: [report.regions[1]] });
    // Leaving it selected would filter the table on a metric no longer offered.
    expect(els.sel.value).toBe("homesSold");
  });

  it("re-renders when the reader changes metric", () => {
    const { view, els, ui } = mount();
    view.setReport(report);
    els.sel.value = "daysOnMarket";
    expect(typeof els.sel.onchange).toBe("function");
    els.sel.onchange?.();
    expect(ui.tables[0].rows.map((r) => (r.metric ? "yes" : "no"))).toEqual(["no", "yes", "no"]);
  });

  it("writes the metric's note so a figure is never bare", () => {
    const { view, els } = mount();
    view.setReport(report);
    expect(els.note.textContent).toBe("The addressable market.");
  });

  it("shows the national headline, and says so when there is none", () => {
    const { view, els } = mount();
    view.setReport(report);
    expect(els.national.innerHTML).toContain("United States");
    expect(els.national.innerHTML).toContain("+20%");

    view.setReport({ ...report, national: null });
    expect(els.national.innerHTML).toContain("No national figure cached");
  });

  it("hides the warning box when there is nothing to warn about", () => {
    const { view, els } = mount();
    view.setReport({ ...report, lagMonths: 0 });
    expect(els.warning.hidden).toBe(true);
    view.setReport(report);
    expect(els.warning.hidden).toBe(false);
  });

  it("marks a stale pull as stale", () => {
    const { view, els } = mount();
    view.setReport({ ...report, stale: true });
    expect(els.refreshed.textContent).toContain("stale");
    view.setReport({ ...report, refreshedAt: null });
    expect(els.refreshed.textContent).toBe("Never refreshed");
  });

  it("runs on a surface that has only a table and a picker", () => {
    // The portal shows less apparatus than the dashboard; every other target
    // is optional and must not throw when absent.
    const els: Record<string, FakeEl> = { sel: fakeEl() };
    const ui = loadMarketUi(els);
    const view = ui.createMarketReport({
      metricSelectId: "sel",
      tableId: "market-table",
      reportKey: "p-market",
    });
    expect(() => view.setReport(report)).not.toThrow();
    expect(ui.tables[0].rows).toHaveLength(3);
    // Each surface keeps its own saved column layout.
    expect(ui.tables[0].cfg.reportKey).toBe("p-market");
  });

  it("marks the national row so a sort cannot disguise it", () => {
    const { view, ui } = mount();
    view.setReport(report);
    const rowClass = ui.tables[0].cfg.rowClass as (r: { key: string }) => string;
    expect(rowClass({ key: "national" })).toBe("market-national-row");
    expect(rowClass({ key: "lima" })).toBe("");
  });

  it("surfaces a failed load on the table itself", () => {
    const { view, ui } = mount();
    view.setError();
    expect(ui.tables[0].errored).toBe(true);
  });
});
