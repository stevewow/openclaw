import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";

/**
 * The Market report's formatting and its good/bad colouring live in the SPA's
 * inline JS, which no type or lint pass reads. Direction is the part worth
 * proving: rising days-on-market is bad news while rising homes-sold is good,
 * and getting that backwards would paint a shrinking market green.
 *
 * Same lift-and-evaluate technique as admin-ui-past-due.test.ts.
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

function loadMarketModel(
  report: { national: AreaLike | null; regions: AreaLike[] } | null,
  selected = "homesSold",
) {
  const script = Array.from(ADMIN_UI_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)).map(
    (m) => m[1],
  )[0];
  if (!script) {
    throw new Error("no inline script found in ADMIN_UI_HTML");
  }
  const start = script.indexOf("function marketFmt(");
  const endIdx = script.indexOf("function renderMarket()");
  if (start === -1 || endIdx === -1) {
    throw new Error("market block not found — did the SPA change?");
  }
  const block = script.slice(start, endIdx);

  // The block closes over SPA state and DOM helpers. marketSelectedKey reads a
  // <select>, so it gets a stub element rather than a whole document.
  const preamble = `
    const marketReport = ${JSON.stringify(report)};
    const document = { getElementById: () => ({ value: ${JSON.stringify(selected)} }) };
    const money = (n) => '$' + Number(n).toLocaleString();
    const esc = (s) => String(s);
  `;
  // Evaluating the shipped block is the point of this suite; the input is our
  // own source file, not user data.
  // oxlint-disable-next-line no-implied-eval
  const factory = new Function(
    `${preamble}\n${block}\nreturn { marketFmt, marketPct, marketClass, marketRows, marketCols };`,
  );
  return factory() as {
    marketFmt: (v: number | null, format: string) => string;
    marketPct: (p: number | null) => string;
    marketClass: (p: number | null, direction: string) => string;
    marketRows: (key: string) => Array<{ key: string; metric: MetricLike | null }>;
    marketCols: () => Array<{
      key: string;
      value: (r: unknown) => unknown;
      render: (r: unknown) => string;
    }>;
  };
}

const metric = (over: Partial<MetricLike> = {}): MetricLike => ({
  key: "homesSold",
  label: "Homes Sold",
  format: "count",
  direction: "up",
  note: "note",
  display: "1,234",
  latest: 1234,
  yoy: "+5.4%",
  rolling: { current: 12000, prior: 10000, changePct: 20, mode: "sum" },
  ...over,
});

describe("marketFmt", () => {
  const { marketFmt } = loadMarketModel(null);

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
  const { marketPct } = loadMarketModel(null);

  it("signs the change so direction never has to be inferred", () => {
    expect(marketPct(12.34)).toBe("+12.3%");
    expect(marketPct(-8.06)).toBe("-8.1%");
    expect(marketPct(0)).toBe("0%");
    expect(marketPct(null)).toBe("—");
  });
});

describe("marketClass", () => {
  const { marketClass } = loadMarketModel(null);

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

describe("marketRows", () => {
  const report = {
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
  };

  it("leads with the nation, then every region, failures included", () => {
    const { marketRows } = loadMarketModel(report);
    const rows = marketRows("homesSold");
    expect(rows.map((r) => r.key)).toEqual(["national", "lima", "toledo"]);
  });

  it("pulls only the selected metric out of each area", () => {
    const { marketRows } = loadMarketModel(report);
    expect(marketRows("daysOnMarket").map((r) => r.metric?.key ?? null)).toEqual([
      null,
      "daysOnMarket",
      null,
    ]);
  });

  it("gives a failed area a null metric rather than dropping the row", () => {
    const { marketRows } = loadMarketModel(report);
    const toledo = marketRows("homesSold").find((r) => r.key === "toledo");
    expect(toledo).toBeTruthy();
    expect(toledo?.metric).toBeNull();
  });

  it("has no rows before anything is loaded", () => {
    expect(loadMarketModel(null).marketRows("homesSold")).toEqual([]);
  });
});

describe("marketCols", () => {
  const { marketCols } = loadMarketModel(null);
  const col = (key: string) => {
    const c = marketCols().find((x) => x.key === key);
    if (!c) {
      throw new Error(`no ${key} column`);
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
    for (const c of marketCols()) {
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
    // The comparison is computed on homes sold alone, so showing it beside a
    // median price would be a number that means nothing.
    const row = {
      key: "lima",
      label: "Lima",
      error: null,
      vsNationalPct: -20,
      metric: metric({ key: "medianSalePrice" }),
    };
    const priceView = loadMarketModel(null, "medianSalePrice");
    const priceCol = priceView.marketCols().find((c) => c.key === "vsNational");
    expect(priceCol?.render(row)).not.toContain("pts");
    // ...and shows it on the metric it was computed from.
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
