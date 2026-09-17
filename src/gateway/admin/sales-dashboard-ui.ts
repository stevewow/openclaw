// The sales dashboard, as markup and inline JS shared by both signed-in
// surfaces: goals against booked units, revenue and ASP per market for a month
// and the year, with the pace each is on, market share against new listings,
// and last month or last year alongside — the sales tracker sheet, fed from
// Spiro rather than a pasted order report.
//
// The inline JS below lives in a template literal, which eats backslashes: no
// regex escapes and no backslashes in its comments. It also must not contain a
// dollar sign followed by an open brace.

import { infoTip, infoTipSlot } from "./info-tip.js";
import { SALES_EXPORT_COMPONENT_JS, SALES_EXPORT_CSS } from "./sales-export-ui.js";
import {
  SALES_TRENDS_COMPONENT_JS,
  SALES_TRENDS_CSS,
  SALES_TRENDS_MARKUP,
} from "./sales-trends-ui.js";

const SALES_DASHBOARD_CORE_CSS = `
  .sd-head { display: flex; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .sd-head-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
  .sd-head-actions input[type=month], .sd-head-actions select { width: auto; max-width: 11rem; }
  .sd-sync { color: var(--text-muted); font-size: 0.8rem; margin: 0.5rem 0 0; }
  /* Nothing to warn about: no gap under the heading either. */
  .sd-sync:empty { display: none; }
  .sd-warn { color: var(--warning); font-weight: 600; }
  .sd-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr)); gap: 0.75rem; margin-bottom: 1.15rem; }
  .sd-kpi { background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--radius-sm); padding: 0.8rem 0.95rem; box-shadow: var(--shadow); }
  .sd-kpi-label { color: var(--text-muted); font-size: 0.69rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  .sd-kpi-value { font-size: 1.5rem; font-weight: 700; margin-top: 0.15rem; font-variant-numeric: tabular-nums; }
  .sd-kpi-sub { color: var(--text-muted); font-size: 0.78rem; margin-top: 0.2rem; }
  .sd-kpi-cmp { font-size: 0.76rem; margin-top: 0.3rem; padding-top: 0.3rem; border-top: 1px solid var(--hairline); }
  .sd-delta { display: inline-flex; align-items: center; gap: 0.2rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .sd-delta-up { color: var(--success); }
  .sd-delta-down { color: var(--danger); }
  .sd-delta-flat { color: var(--text-muted); }
  .card.sd-card { padding: 0; overflow: hidden; }
  .sd-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem 1rem; flex-wrap: wrap; padding: 0.9rem 1.1rem; border-bottom: 1px solid var(--hairline); }
  .sd-card-sub { border-top: 1px solid var(--hairline); }
  .sd-card-title { font-weight: 700; }
  .sd-card-note { color: var(--text-muted); font-size: 0.78rem; }
  .sd-legend { display: flex; gap: 0.4rem 0.9rem; flex-wrap: wrap; color: var(--text-muted); font-size: 0.76rem; }
  .sd-days { display: flex; gap: 0.4rem 1.4rem; flex-wrap: wrap; padding: 0.6rem 1.1rem; border-bottom: 1px solid var(--hairline); color: var(--text-muted); font-size: 0.8rem; }
  .sd-days b { color: var(--text); font-variant-numeric: tabular-nums; }
  .sd-table-wrap { overflow-x: auto; }
  table.sd-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
  table.sd-table th { text-align: left; color: var(--text-muted); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; background: var(--surface2); padding: 0.45rem 0.7rem; white-space: nowrap; }
  table.sd-table th.num { text-align: right; }
  table.sd-table th.sd-group { text-align: center; color: var(--text); }
  table.sd-table td { padding: 0.5rem 0.7rem; border-bottom: 1px solid var(--hairline); white-space: nowrap; }
  table.sd-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.sd-table .sd-sep { border-left: 1px solid var(--hairline); }
  table.sd-table td.sd-market { font-weight: 600; }
  /* The wide tables scroll sideways; the market stays in view while they do. */
  table.sd-table td.sd-market, table.sd-table th.sd-market-head { position: sticky; left: 0; z-index: 1; background: var(--surface); box-shadow: inset -1px 0 0 var(--hairline); }
  table.sd-table th.sd-market-head { background: var(--surface2); }
  table.sd-table tr.sd-total td { font-weight: 700; background: var(--surface2); border-top: 2px solid var(--border); border-bottom: 0; }
  .sd-pace { display: inline-flex; align-items: center; gap: 0.3rem; }
  .sd-pace-icon { font-size: 0.72rem; line-height: 1; }
  .sd-pace-good .sd-pace-icon { color: #0ca30c; }
  .sd-pace-close .sd-pace-icon { color: #fab219; }
  .sd-pace-behind .sd-pace-icon { color: #d03b3b; }
  .sd-muted { color: var(--text-muted); }
  .sd-empty { color: var(--text-muted); font-size: 0.85rem; padding: 1rem 1.1rem; white-space: normal; }
  .sd-modal-box { max-width: 700px; }
  .sd-modal-wide { max-width: 1040px; }
  .sd-hint { color: var(--text-muted); font-size: 0.8rem; margin: 0 0 0.9rem; }
  .sd-inline { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end; }
  .sd-inline .form-group { margin-bottom: 0.75rem; }
  .sd-inline input[type=month], .sd-inline input[type=date], .sd-inline input[type=number] { width: auto; }
  .sd-inline > input[type=text] { flex: 1; min-width: 10rem; width: auto; }
  table.sd-goal-grid td { padding: 0.3rem 0.5rem; }
  table.sd-goal-grid input { width: 100%; min-width: 6rem; text-align: right; }
  table.sd-goal-grid tr.sd-goal-total td { background: var(--surface2); border-top: 2px solid var(--border); }
  table.sd-listings-grid td { padding: 0.25rem 0.3rem; }
  table.sd-listings-grid input { width: 4.4rem; text-align: right; }
  .sd-list { display: flex; flex-direction: column; gap: 0.4rem; margin: 0.6rem 0; }
  .sd-item { display: flex; align-items: center; flex-wrap: wrap; gap: 0.6rem; border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.65rem; }
  .sd-item-main { flex: 1; min-width: min(12rem, 100%); font-size: 0.85rem; }
  .sd-item-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
  .sd-item-actions input[type=month] { width: auto; }
  .sd-chips { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .sd-error { color: var(--danger); font-size: 0.85rem; margin-top: 0.75rem; }
  .sd-ok { color: var(--success); font-size: 0.85rem; margin-top: 0.75rem; }
  .sd-tabs { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin: 0 0 1rem; }
  .sd-tablist { display: inline-flex; gap: 0.25rem; padding: 0.2rem; background: var(--surface2); border: 1px solid var(--hairline); border-radius: var(--radius-pill); }
  .sd-tab { border: 1px solid transparent; background: transparent; color: var(--text-muted); cursor: pointer; font: inherit; font-size: 0.85rem; font-weight: 600; padding: 0.35rem 1rem; border-radius: var(--radius-pill); }
  .sd-tab:hover { color: var(--text); }
  .sd-tab[aria-selected="true"] { background: var(--surface); border-color: var(--border); color: var(--text); box-shadow: var(--shadow); }
  .sd-tabs-actions { margin-left: auto; display: flex; gap: 0.5rem; flex-wrap: wrap; }
  /* A faint wash on every other column group, so a wide row reads straight across. */
  table.sd-table col.sd-band { background: rgba(44, 44, 44, 0.03); }
  /* ── Scoreboard: the default view, sized to be read without scrolling ── */
  .sd-scope { display: flex; align-items: center; gap: 0.4rem; }
  .sd-star { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; font: inherit; font-size: 0.95rem; line-height: 1; padding: 0.4rem 0.55rem; border-radius: var(--radius-sm); }
  .sd-star:hover { color: var(--text); }
  .sd-star.is-default { color: #e8a317; border-color: #e8a317; }
  .sd-kpis.sd-kpis-tight { grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.6rem; margin-bottom: 0.85rem; }
  .sd-kpis-tight .sd-kpi { padding: 0.6rem 0.75rem; }
  .sd-kpis-tight .sd-kpi-value { font-size: 1.35rem; }
  .sd-kpi-trend { color: var(--text-muted); font-size: 0.75rem; margin-top: 0.2rem; }
  /* The metric and period pickers: one row of pills, same shape as the tabs. */
  .sd-switch { display: flex; align-items: center; gap: 0.5rem 0.75rem; flex-wrap: wrap; padding: 0.55rem 1.1rem; border-bottom: 1px solid var(--hairline); }
  .sd-seg { display: inline-flex; gap: 0.2rem; padding: 0.15rem; background: var(--surface2); border: 1px solid var(--hairline); border-radius: var(--radius-pill); }
  .sd-seg button { border: 1px solid transparent; background: transparent; color: var(--text-muted); cursor: pointer; font: inherit; font-size: 0.8rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: var(--radius-pill); }
  .sd-seg button:hover { color: var(--text); }
  .sd-seg button[aria-pressed="true"] { background: var(--surface); border-color: var(--border); color: var(--text); box-shadow: var(--shadow); }
  .sd-switch-note { color: var(--text-muted); font-size: 0.78rem; margin-left: auto; }
  /* The old wide tables, kept but folded away until someone asks for them. */
  .sd-more { margin: 1.15rem 0 0; }
  .sd-more-btn { width: 100%; border: 1px dashed var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; font: inherit; font-size: 0.85rem; font-weight: 600; padding: 0.6rem 1rem; border-radius: var(--radius-sm); text-align: left; }
  .sd-more-btn:hover { color: var(--text); border-color: var(--text-muted); }
  .sd-more-btn .sd-more-caret { display: inline-block; width: 1rem; }
  #sd-everything { margin-top: 1.15rem; }
  /* The hovered row tints over whatever the cell already shows, sticky cells included. */
  table.sd-table tbody tr:hover td { box-shadow: inset 0 0 0 100vmax rgba(44, 44, 44, 0.045); }
  table.sd-table tbody tr:hover td.sd-market { box-shadow: inset -1px 0 0 var(--hairline), inset 0 0 0 100vmax rgba(44, 44, 44, 0.045); }
`;

export const SALES_DASHBOARD_CSS = SALES_DASHBOARD_CORE_CSS + SALES_TRENDS_CSS + SALES_EXPORT_CSS;

const PACE_LEGEND = `<div class="sd-legend">
              <span class="sd-pace sd-pace-good"><span class="sd-pace-icon" aria-hidden="true">▲</span>On pace, 100% or more</span>
              <span class="sd-pace sd-pace-close"><span class="sd-pace-icon" aria-hidden="true">●</span>Within 10%</span>
              <span class="sd-pace sd-pace-behind"><span class="sd-pace-icon" aria-hidden="true">▼</span>Behind</span>
            </div>`;

/**
 * What the page is, what counts, and how fresh it is — behind the "i" beside
 * the heading rather than as a banner over the numbers.
 *
 * The last paragraph is filled in by `sdRenderSync` as each read lands. Only
 * routine status goes there; a warning (orders still being read, a failed
 * read, no markets set up) stays on the page, where it cannot be missed.
 */
const SALES_DASHBOARD_ABOUT = infoTip(
  `<p>Each market's goals against what it has booked — units, revenue and average order value (ASP) for the
     month and the year so far — where the month and the year are trending, and market share of new listings.</p>
   <p>An order counts once its shoot is done (editing or delivered in Spiro), on the day of the shoot, in the
     market of the client's company. Orders still waiting on their appointment, and cancelled or $0 orders,
     do not count — new clients included.</p>
   <p id="sd-sync-detail"></p>`,
  { label: "About the sales dashboard" },
);

function salesPageMarkup(): string {
  return `
        <div class="sd-print-head" id="sd-print-head"></div>
        <div class="card sd-head-card">
          <div class="sd-head">
            <div style="flex:1;min-width:min(16rem,100%)">
              <div style="font-weight:700">Sales Dashboard${SALES_DASHBOARD_ABOUT}</div>
              <p class="sd-sync" id="sd-sync"></p>
            </div>
            <div class="sd-head-actions">
              <input id="sd-month" type="month" aria-label="Month" />
              <span class="sd-scope">
                <select id="sd-market" aria-label="Market"></select>
                <button type="button" class="sd-star" id="sd-market-default" title="Open this page on this market from now on">★</button>
              </span>
              <select id="sd-compare" aria-label="Compare with">
                <option value="off">No comparison</option>
                <option value="mom">vs last month</option>
                <option value="yoy">vs last year</option>
              </select>
              <button type="button" class="btn btn-ghost" id="sd-refresh" title="Read Spiro orders again now. They also refresh on their own every 2 hours.">Refresh</button>
              <button type="button" class="btn btn-ghost hidden" id="sd-markets-open">Markets</button>
              <button type="button" class="btn btn-ghost hidden" id="sd-listings-open">New listings</button>
              <button type="button" class="btn btn-ghost hidden" id="sd-holidays-open">Holidays</button>
              <button type="button" class="btn btn-primary hidden" id="sd-goals-open">Goals</button>
            </div>
          </div>
        </div>

        <div class="sd-tabs">
          <div class="sd-tablist" role="tablist" aria-label="Sales dashboard view">
            <button type="button" role="tab" class="sd-tab" id="sd-tab-report" aria-selected="true" aria-controls="sd-view-report">Report</button>
            <button type="button" role="tab" class="sd-tab" id="sd-tab-trends" aria-selected="false" aria-controls="sd-view-trends">Charts</button>
          </div>
          <div class="sd-tabs-actions">
            <button type="button" class="btn btn-sm btn-ghost" id="sd-export" title="Download what this tab shows as a CSV file for Excel or Google Sheets">Export CSV</button>
            <button type="button" class="btn btn-sm btn-ghost" id="sd-print" title="Print this tab, or save it as a PDF">Print</button>
          </div>
        </div>

        <div id="sd-view-report">
        <div class="sd-kpis sd-kpis-tight" id="sd-kpis"></div>

        <div class="card sd-card" id="sd-score-card">
          <div class="sd-card-head">
            <div class="sd-card-title"><span id="sd-score-title">Units</span>${infoTipSlot("sd-score-about", { label: "How this metric is counted" })}</div>
            <div class="sd-card-note" id="sd-score-note"></div>
          </div>
          <div class="sd-switch">
            <div class="sd-seg" id="sd-metric" role="group" aria-label="Metric"></div>
            <div class="sd-seg" id="sd-period" role="group" aria-label="Period"></div>
            <div class="sd-switch-note" id="sd-score-days"></div>
          </div>
          <div class="sd-table-wrap"><table class="sd-table" id="sd-score"></table></div>
        </div>

        <div class="sd-more">
          <button type="button" class="sd-more-btn" id="sd-more-btn" aria-expanded="false" aria-controls="sd-everything">
            <span class="sd-more-caret" aria-hidden="true">▸</span><span id="sd-more-label">Show everything — every metric side by side, month and year</span>
          </button>
        </div>

        <div id="sd-everything" class="hidden">
        <div class="card sd-card hidden" id="sd-cmp-card">
          <div class="sd-card-head">
            <div class="sd-card-title"><span id="sd-cmp-title">Compared</span>${infoTip("<p>The earlier period is counted as far into its month as this one is, so the 1st through the 14th is compared with the 1st through the 14th. Market share changes are in percentage points.</p>", { label: "How the comparison is counted" })}</div>
            <div class="sd-card-note" id="sd-cmp-note"></div>
          </div>
          <div class="sd-table-wrap"><table class="sd-table" id="sd-cmp-mtd"></table></div>
          <div id="sd-cmp-year" class="hidden">
            <div class="sd-card-head sd-card-sub"><div class="sd-card-title" id="sd-cmp-ytd-title">Year to date</div></div>
            <div class="sd-table-wrap"><table class="sd-table" id="sd-cmp-ytd"></table></div>
          </div>
        </div>

        <div class="card sd-card">
          <div class="sd-card-head">
            <div class="sd-card-title"><span id="sd-mtd-title">Month to date</span>${infoTip("<p>Per-day goal is the unit goal ÷ business days in the month, rounded up. Market share is units ÷ the month's new listings.</p>", { label: "How month to date is counted" })}</div>
          </div>
          <div class="sd-days" id="sd-days"></div>
          <div class="sd-table-wrap"><table class="sd-table" id="sd-mtd"></table></div>
        </div>

        <div class="card sd-card">
          <div class="sd-card-head">
            <div class="sd-card-title">End-of-month trend${infoTip("<p>Month to date ÷ business days completed × business days in the month, against the month's goal.</p>", { label: "How the trend is worked out" })}</div>
            ${PACE_LEGEND}
          </div>
          <div class="sd-table-wrap"><table class="sd-table" id="sd-eom"></table></div>
        </div>

        <div class="card sd-card">
          <div class="sd-card-head">
            <div class="sd-card-title"><span id="sd-ytd-title">Year to date</span>${infoTip("<p>Goal to date is every earlier month's goal plus this month's, prorated by business days completed. Year-end trend carries the pace so far to the last business day of the year, against the year's goal. Market share counts only the months with new listings entered.</p>", { label: "How year to date is counted" })}</div>
            ${PACE_LEGEND}
          </div>
          <div class="sd-table-wrap"><table class="sd-table" id="sd-ytd"></table></div>
        </div>
        </div>
        </div>
${SALES_TRENDS_MARKUP}`;
}

export const SALES_DASHBOARD_MARKUP = `
      <!-- Sales dashboard: goals against booked units, revenue and ASP per market -->
      <div id="page-sales-dashboard" class="page hidden">
${salesPageMarkup()}
      </div>`;

export const SALES_DASHBOARD_PORTAL_MARKUP = `
    <div id="page-sales-dashboard" class="page">
      <div class="topbar"><h2>Sales Dashboard</h2></div>
      <div class="page-scroll">
${salesPageMarkup()}
      </div>
    </div>`;

export const SALES_DASHBOARD_MODALS = `
<div id="sd-goals-modal" class="modal-backdrop hidden">
  <div class="modal sd-modal-box">
    <div class="modal-title">Sales goals</div>
    <p class="sd-hint">Set one month at a time; the year's goal is its twelve months added up. Every market tracked that month is listed — the list itself is under Markets. Leave ASP blank to use revenue ÷ units. Clear a row to remove that market's goal.</p>
    <div class="sd-inline">
      <div class="form-group"><label for="sd-goal-month">Month</label><input id="sd-goal-month" type="month" /></div>
      <div class="form-group"><label for="sd-goal-copy">Start from another month</label><input id="sd-goal-copy" type="month" /></div>
      <div class="form-group"><button type="button" class="btn btn-ghost" id="sd-goal-copy-btn">Copy in</button></div>
    </div>
    <div class="sd-table-wrap">
      <table class="sd-table sd-goal-grid">
        <thead><tr><th>Market</th><th class="num">Units</th><th class="num">Revenue ($)</th><th class="num">ASP ($)</th></tr></thead>
        <tbody id="sd-goal-body"></tbody>
      </table>
    </div>
    <p class="sd-hint" style="margin-top:0.5rem">Company total is optional. Fill it in when the company goal is not simply the markets added up; the greyed numbers are what the markets add up to.</p>
    <div id="sd-goals-msg" class="hidden"></div>
    <div class="modal-actions">
      <span style="flex:1"></span>
      <button type="button" class="btn btn-ghost" id="sd-goals-close">Close</button>
      <button type="button" class="btn btn-primary" id="sd-goals-save">Save month</button>
    </div>
  </div>
</div>

<div id="sd-markets-modal" class="modal-backdrop hidden">
  <div class="modal sd-modal-box">
    <div class="modal-title">Markets</div>
    <p class="sd-hint">One list for every month. Adding a market puts it in every month, earlier ones too, so its past orders and comparisons are there. Stopping one takes it out from the month you pick onward; the months before keep it, goals and all. Orders from a market that is not tracked count under Other markets.</p>
    <div class="sd-inline">
      <input id="sd-market-new" type="text" placeholder="Add a market, e.g. Cleveland" aria-label="New market" />
      <button type="button" class="btn btn-primary" id="sd-market-add">Add market</button>
    </div>
    <p class="sd-hint" style="margin-top:0.5rem">Name a market the way its Spiro service area starts — Fort Wayne for Fort Wayne, Indiana — so its orders find it.</p>
    <div id="sd-market-suggest"></div>
    <div class="sd-list" id="sd-market-list"></div>
    <div id="sd-markets-msg" class="hidden"></div>
    <div class="modal-actions">
      <span style="flex:1"></span>
      <button type="button" class="btn btn-ghost" id="sd-markets-close">Close</button>
    </div>
  </div>
</div>

<div id="sd-listings-modal" class="modal-backdrop hidden">
  <div class="modal sd-modal-wide">
    <div class="modal-title">New listings</div>
    <p class="sd-hint">New listings in each market each month, entered once they are published. Market share is the shoots in a market that month ÷ its new listings. Leave a month blank until its number is in.</p>
    <div class="sd-inline">
      <div class="form-group"><label for="sd-listings-year">Year</label><input id="sd-listings-year" type="number" min="2000" max="2100" step="1" /></div>
    </div>
    <div class="sd-table-wrap">
      <table class="sd-table sd-listings-grid" id="sd-listings-grid"></table>
    </div>
    <div id="sd-listings-msg" class="hidden"></div>
    <div class="modal-actions">
      <span style="flex:1"></span>
      <button type="button" class="btn btn-ghost" id="sd-listings-close">Close</button>
      <button type="button" class="btn btn-primary" id="sd-listings-save">Save year</button>
    </div>
  </div>
</div>

<div id="sd-holidays-modal" class="modal-backdrop hidden">
  <div class="modal sd-modal-box">
    <div class="modal-title">Holidays</div>
    <p class="sd-hint">Weekdays that do not count as business days, for per-day goals and every trend. Weekends never count.</p>
    <div class="sd-inline">
      <div class="form-group"><label for="sd-holiday-day">Date</label><input id="sd-holiday-day" type="date" /></div>
      <div class="form-group" style="flex:1;min-width:10rem"><label for="sd-holiday-label">Holiday</label><input id="sd-holiday-label" type="text" placeholder="Thanksgiving" /></div>
      <div class="form-group"><button type="button" class="btn btn-primary" id="sd-holiday-add">Add</button></div>
    </div>
    <div class="sd-list" id="sd-holiday-list"></div>
    <div id="sd-holidays-msg" class="hidden"></div>
    <div class="modal-actions">
      <span style="flex:1"></span>
      <button type="button" class="btn btn-ghost" id="sd-holidays-close">Close</button>
    </div>
  </div>
</div>`;

const SALES_DASHBOARD_CORE_JS = `
  var sdData = null;
  var sdGoalRows = [];
  var sdGoalTotal = { units: '', revenue: '', asp: '' };
  var sdListingMarkets = [];
  var sdPollTimer = null;
  var SD_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SD_PACE_BANDS = [
    { min: 100, cls: 'good', icon: '▲', label: 'On pace' },
    { min: 90, cls: 'close', icon: '●', label: 'Within 10% of pace' },
    { min: -Infinity, cls: 'behind', icon: '▼', label: 'Behind pace' }
  ];
  var sdCompare = (function(){
    try {
      var saved = localStorage.getItem('sd-compare');
      return saved === 'mom' || saved === 'yoy' ? saved : 'off';
    } catch (e) {
      return 'off';
    }
  })();

  function sdEl(id){ return document.getElementById(id); }
  function sdNum(n){ return (n === null || n === undefined) ? '—' : Math.round(n).toLocaleString('en-US'); }
  function sdMoney(cents){
    if(cents === null || cents === undefined) return '—';
    return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function sdPct(p){ return (p === null || p === undefined) ? '—' : p.toFixed(2) + '%'; }
  function sdPace(p){
    if(p === null || p === undefined) return '<span class="sd-muted">—</span>';
    var band = SD_PACE_BANDS.filter(function(b){ return p >= b.min; })[0];
    return '<span class="sd-pace sd-pace-' + band.cls + '" title="' + esc(band.label) + '"><span class="sd-pace-icon" aria-hidden="true">' +
      band.icon + '</span>' + esc(sdPct(p)) + '</span>';
  }
  function sdHasGoal(m){ return !!m && (m.units > 0 || m.revenueCents > 0); }
  function sdCell(html, cls){ return '<td class="num' + (cls ? ' ' + cls : '') + '">' + html + '</td>'; }
  function sdDateOf(ymd){ var p = ymd.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function sdDate(ymd){
    if(!ymd) return '—';
    return sdDateOf(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function sdShortDate(ymd){ return sdDateOf(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); }
  function sdWeekday(ymd){ return sdDateOf(ymd).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }); }
  function sdMonthName(key){
    var p = key.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  function sdThisMonth(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  // A market counts in a month (YYYY-MM) until the month it was stopped from.
  function sdActiveIn(market, key){ return !market.removedFrom || key < market.removedFrom; }
  function sdAgo(ts){
    if(!ts) return 'never';
    var mins = Math.round((Date.now() - ts) / 60000);
    if(mins < 1) return 'just now';
    if(mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    var hrs = Math.round(mins / 60);
    if(hrs < 36) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    return Math.round(hrs / 24) + ' days ago';
  }
  function sdMsg(id, text, ok){
    var el = sdEl(id);
    el.className = text ? (ok ? 'sd-ok' : 'sd-error') : 'hidden';
    el.textContent = text || '';
  }
  function sdError(r, fallback){ return (r.data && r.data.error) || fallback || 'unknown error'; }

  async function loadSalesDashboard(){
    var input = sdEl('sd-month');
    var q = input && input.value ? '?month=' + encodeURIComponent(input.value) : '';
    var r = await api('GET', '/sales-dashboard' + q);
    if(!r.ok){
      sdEl('sd-kpis').innerHTML = '<div class="sd-empty">' + esc('Could not load the sales dashboard: ' + sdError(r)) + '</div>';
      return;
    }
    sdData = r.data;
    if(input){
      input.min = sdData.months.min;
      input.max = sdData.months.max;
      input.value = sdData.monthKey;
    }
    sdEl('sd-compare').value = sdCompare;
    ['sd-goals-open', 'sd-holidays-open', 'sd-markets-open', 'sd-listings-open'].forEach(function(id){
      sdEl(id).classList.toggle('hidden', !sdData.canEdit);
    });
    sdApplyPrefs();
    sdRenderMarketPicker();
    sdRenderSync();
    sdRenderKpis();
    sdRenderCompare();
    sdRenderScore();
    sdRenderTables();
    sdSetExpandedUi();
    sdSchedulePoll();
    sdApplyView();
  }

  // While a read runs, look again now and then so the page fills in without a reload.
  function sdSchedulePoll(){
    clearTimeout(sdPollTimer);
    if(!sdData || !sdData.sync || !sdData.sync.running) return;
    sdPollTimer = setTimeout(function(){
      var page = sdEl('page-sales-dashboard');
      if(page && page.offsetParent !== null) loadSalesDashboard();
    }, 20000);
  }

  // Two audiences, two places. Routine status — how fresh the read is, which
  // checks are still running — goes in the describer behind the heading's "i",
  // because it answers a question rather than asking for anything. Anything a
  // reader has to act on, or that makes a number on screen wrong, stays on the
  // page in plain sight.
  function sdRenderSync(){
    var s = sdData.sync || {};
    var r = sdData.report;
    var alerts = [];
    var notes = [];
    if(!s.coveredTo){
      alerts.push(esc('Spiro orders have not been read yet. Press Refresh: the first read goes back to January ' +
        (s.historyFloor ? s.historyFloor.slice(0, 4) : 'of last year') + ', this month first, and takes a while.'));
    } else {
      notes.push(esc('Orders read from Spiro ' + sdAgo(s.refreshedAt) + ', back to ' + sdDate(s.coveredFrom) + '. They refresh every 2 hours.'));
      if(s.coveredFrom > r.year + '-01-01'){
        alerts.push('<span class="sd-warn">' + esc('Older orders are still being read, so totals before ' + sdDate(s.coveredFrom) + ' are incomplete.') + '</span>');
      }
      if(!s.shootsCoveredFrom || s.shootsCoveredFrom > r.year + '-01-01'){
        alerts.push('<span class="sd-warn">' + esc(s.shootsCoveredFrom
          ? 'Shoot dates are still being read back from ' + sdDate(s.shootsCoveredFrom) + '. Until they are, earlier completed orders count on the day they were placed.'
          : 'Shoot dates have not been read yet, so for now completed orders count on the day they were placed.') + '</span>');
      }
    }
    if(!(sdData.markets || []).length){
      alerts.push('<span class="sd-warn">' + esc(sdData.canEdit
        ? 'No markets are set up yet, so every order counts under Other markets. Add them under Markets.'
        : 'No markets are set up yet, so every order counts under Other markets.') + '</span>');
    }
    if(r.clientsPending > 0){
      notes.push(esc('New clients are still being checked against older order history for ' + r.clientsPending +
        (r.clientsPending === 1 ? ' agent.' : ' agents.')));
    }
    if(s.error && (!s.refreshedAt || (s.attemptedAt || 0) > s.refreshedAt)){
      alerts.push('<span class="sd-warn">' + esc('The last read failed ' + sdAgo(s.attemptedAt) + ': ' + s.error) + '</span>');
    }
    if(s.running) alerts.push('<span class="sd-warn">Reading now…</span>');
    sdEl('sd-sync').innerHTML = alerts.join(' ');
    var detail = sdEl('sd-sync-detail');
    if(detail) detail.innerHTML = notes.join(' ');
  }

  // ── Comparisons ──
  function sdComparison(){ return sdData && sdCompare !== 'off' ? sdData.compare[sdCompare] : null; }
  function sdClients(nc){ return nc ? nc.first + nc.returning : null; }
  function sdMissing(v){ return v === null || v === undefined; }

  // "August 2026" for a whole month, "Aug 1 – Aug 14, 2026" for part of one.
  function sdPeriod(c){
    var name = sdMonthName(c.monthStart.slice(0, 7));
    if(c.throughDay < c.monthStart) return name + ' (no days yet)';
    var next = sdDateOf(c.throughDay);
    next.setUTCDate(next.getUTCDate() + 1);
    if(next.getUTCDate() === 1) return name;
    return sdShortDate(c.monthStart) + ' – ' + sdShortDate(c.throughDay) + ', ' + c.monthStart.slice(0, 4);
  }
  function sdYearPeriod(c){
    var start = c.year + '-01-01';
    if(c.throughDay < start) return c.year + ' (no days yet)';
    return sdShortDate(start) + ' – ' + sdShortDate(c.throughDay) + ', ' + c.year;
  }

  function sdDelta(d, text){
    var cls = d > 0 ? 'up' : (d < 0 ? 'down' : 'flat');
    var icon = d > 0 ? '▲' : (d < 0 ? '▼' : '●');
    return '<span class="sd-delta sd-delta-' + cls + '"><span aria-hidden="true">' + icon + '</span>' + esc(text) + '</span>';
  }
  function sdChange(now, then){
    if(sdMissing(now) || sdMissing(then) || !(then > 0)) return '<span class="sd-muted">—</span>';
    var p = (now - then) / then * 100;
    return sdDelta(Math.round(p * 10), (p > 0 ? '+' : '') + p.toFixed(1) + '%');
  }
  function sdPoints(now, then){
    if(sdMissing(now) || sdMissing(then)) return '<span class="sd-muted">—</span>';
    var d = now - then;
    return sdDelta(Math.round(d * 100), (d > 0 ? '+' : '') + d.toFixed(2) + ' pts');
  }

  function sdRenderKpis(){
    // Scoped to the market filter: with one picked, the tiles are that market's
    // month, not the company's.
    var t = sdScopeRow('mtd');
    var nc = t.newClients;
    var goal = sdHasGoal(t.goal);
    var c = sdComparison();
    var ct = sdComparisonRow('mtd');
    var cmp = function(html){
      if(sdCompare === 'off') return '';
      if(!c) return '<div class="sd-kpi-cmp sd-muted">No history that far back</div>';
      return '<div class="sd-kpi-cmp">' + html + ' <span class="sd-muted">' + esc('vs ' + sdPeriod(c)) + '</span></div>';
    };
    var tiles = [
      { label: 'Units', value: sdNum(t.actual.units), sub: goal ? esc('of ' + sdNum(t.goal.units) + ' · ' + sdPct(t.pct.units)) : 'No goal set',
        cmp: cmp(sdChange(t.actual.units, ct && ct.actual.units)) },
      { label: 'Revenue', value: sdMoney(t.actual.revenueCents), sub: goal ? esc('of ' + sdMoney(t.goal.revenueCents) + ' · ' + sdPct(t.pct.revenue)) : 'No goal set',
        cmp: cmp(sdChange(t.actual.revenueCents, ct && ct.actual.revenueCents)) },
      { label: 'ASP', value: sdMoney(t.actual.aspCents), sub: goal ? esc('goal ' + sdMoney(t.goal.aspCents) + ' · ' + sdPct(t.pct.asp)) : 'No goal set',
        cmp: cmp(sdChange(t.actual.aspCents, ct && ct.actual.aspCents)) },
      { label: 'New clients', value: nc ? sdNum(sdClients(nc)) : '—', sub: nc ? esc(nc.first + ' first-ever · ' + nc.returning + ' returning') : 'Needs a year of order history first',
        cmp: cmp(sdChange(sdClients(nc), ct && sdClients(ct.newClients))) },
      { label: 'Market share', value: sdPct(t.share.pct), sub: t.share.listings !== null ? esc('of ' + sdNum(t.share.listings) + ' new listings') : 'No new listings entered for this month',
        cmp: cmp(sdPoints(t.share.pct, ct && ct.share.pct)) },
    ];
    // The two trend tiles became a line under the metric they belong to, which
    // is where people were looking for them anyway. Five tiles fit one row.
    tiles[0].trend = 'Month end ' + sdNum(t.trend.units) + (goal ? ' · ' + sdPace(t.trend.unitsPct) : '');
    tiles[1].trend = 'Month end ' + sdMoney(t.trend.revenueCents) + (goal ? ' · ' + sdPace(t.trend.revenuePct) : '');
    sdEl('sd-kpis').innerHTML = tiles.map(function(x){
      return '<div class="sd-kpi"><div class="sd-kpi-label">' + esc(x.label) + '</div><div class="sd-kpi-value">' + esc(x.value) +
        '</div><div class="sd-kpi-sub">' + x.sub + '</div>' +
        (x.trend ? '<div class="sd-kpi-trend">' + x.trend + '</div>' : '') + x.cmp + '</div>';
    }).join('');
  }

  function sdCompareTable(rows, total, priorRows, priorTotal){
    var prior = {};
    var seen = {};
    priorRows.forEach(function(p){ prior[p.key] = p; });
    rows.forEach(function(row){ seen[row.key] = true; });
    var list = rows.slice();
    // A market in the earlier period only, such as one stopped since, still shows what it had.
    priorRows.forEach(function(p){
      if(!seen[p.key]) list.push({ key: p.key, label: p.label, actual: { units: 0, revenueCents: 0, aspCents: null }, newClients: null, share: { listings: null, pct: null } });
    });
    var all = list.concat([total]);
    var groups = ['Units', 'Revenue', 'ASP', 'New clients', 'Market share'];
    var head = sdCols([1, 3, 3, 3, 3, 3]) + '<thead><tr><th rowspan="2" class="sd-market-head">Market</th>' +
      groups.map(function(g){ return '<th colspan="3" class="sd-group sd-sep">' + esc(g) + '</th>'; }).join('') + '</tr><tr>' +
      groups.map(function(){ return '<th class="num sd-sep">Now</th><th class="num">Then</th><th class="num">Change</th>'; }).join('') + '</tr></thead>';
    return head + '<tbody>' + all.map(function(row, i){
      var p = i === all.length - 1 ? priorTotal : (prior[row.key] || null);
      var pa = p ? p.actual : null;
      return '<tr' + sdTotalClass(i, all) + '><td class="sd-market">' + esc(row.label) + '</td>' +
        sdCell(sdNum(row.actual.units), 'sd-sep') + sdCell(pa ? sdNum(pa.units) : '—') + sdCell(sdChange(row.actual.units, pa && pa.units)) +
        sdCell(sdMoney(row.actual.revenueCents), 'sd-sep') + sdCell(pa ? sdMoney(pa.revenueCents) : '—') + sdCell(sdChange(row.actual.revenueCents, pa && pa.revenueCents)) +
        sdCell(sdMoney(row.actual.aspCents), 'sd-sep') + sdCell(pa ? sdMoney(pa.aspCents) : '—') + sdCell(sdChange(row.actual.aspCents, pa && pa.aspCents)) +
        sdCell(sdNum(sdClients(row.newClients)), 'sd-sep') + sdCell(sdNum(p && sdClients(p.newClients))) + sdCell(sdChange(sdClients(row.newClients), p && sdClients(p.newClients))) +
        sdCell(sdPct(row.share.pct), 'sd-sep') + sdCell(sdPct(p && p.share.pct)) + sdCell(sdPoints(row.share.pct, p && p.share.pct)) + '</tr>';
    }).join('') + '</tbody>';
  }

  function sdRenderCompare(){
    var off = sdCompare === 'off';
    sdEl('sd-cmp-card').classList.toggle('hidden', off);
    if(off) return;
    var r = sdData.report;
    var c = sdComparison();
    var yoy = sdCompare === 'yoy';
    if(!c){
      sdEl('sd-cmp-title').textContent = sdMonthName(sdData.monthKey) + (yoy ? ' vs last year' : ' vs last month');
      sdEl('sd-cmp-note').textContent = '';
      sdEl('sd-cmp-mtd').innerHTML = '<tbody><tr><td class="sd-empty">' +
        esc('Spiro orders are not kept back that far, so there is nothing to compare with.') + '</td></tr></tbody>';
      sdEl('sd-cmp-year').classList.add('hidden');
      return;
    }
    sdEl('sd-cmp-title').textContent = sdMonthName(sdData.monthKey) + ' to date vs ' + sdPeriod(c);
    sdEl('sd-cmp-note').innerHTML = c.complete ? '' :
      '<span class="sd-warn">' + esc('Spiro orders for that period are still being read, so its numbers are incomplete.') + '</span>';
    sdEl('sd-cmp-mtd').innerHTML = sdCompareTable(sdFilterRows(r.mtd.rows), r.mtd.total, sdFilterRows(c.mtd.rows), c.mtd.total);
    sdEl('sd-cmp-year').classList.toggle('hidden', !yoy);
    if(yoy){
      sdEl('sd-cmp-ytd-title').textContent = r.year + ' to date vs ' + sdYearPeriod(c);
      sdEl('sd-cmp-ytd').innerHTML = sdCompareTable(sdFilterRows(r.ytd.rows), r.ytd.total, sdFilterRows(c.ytd.rows), c.ytd.total);
    }
  }

  function sdSetCompare(value){
    sdCompare = value === 'mom' || value === 'yoy' ? value : 'off';
    try { localStorage.setItem('sd-compare', sdCompare); } catch (e) { /* this viewer's browser keeps no settings */ }
    if(!sdData) return;
    sdRenderKpis();
    sdRenderCompare();
    sdRenderScore();
  }

  function sdTotalClass(i, all){ return i === all.length - 1 ? ' class="sd-total"' : ''; }

  // Column groups for a table, the Market column first: every other group gets the faint band.
  function sdCols(spans){
    return '<colgroup>' + spans.map(function(n, i){
      return '<col span="' + n + '"' + (i % 2 === 1 ? ' class="sd-band"' : '') + '>';
    }).join('') + '</colgroup>';
  }

  function sdRenderTables(){
    var r = sdData.report;
    sdEl('sd-mtd-title').textContent = sdMonthName(sdData.monthKey) + ' · month to date';
    sdEl('sd-ytd-title').textContent = r.year + ' · year to date';
    var bd = r.businessDays;
    sdEl('sd-days').innerHTML = [
      ['Month', sdDate(r.monthStart) + ' – ' + sdDate(r.monthEnd)],
      ['Business days', String(bd.month)],
      ['Completed', String(bd.monthCompleted)],
      ['Orders through', sdDate(r.throughDay)],
      ['Year', bd.yearCompleted + ' of ' + bd.year + ' business days']
    ].map(function(x){ return '<span>' + esc(x[0]) + ' <b>' + esc(x[1]) + '</b></span>'; }).join('');

    if(!r.mtd.rows.length && !r.ytd.rows.length){
      var empty = '<tbody><tr><td class="sd-empty">' + esc(sdData.sync && sdData.sync.coveredTo
        ? 'No markets or orders for ' + r.year + ' yet.'
        : 'No Spiro orders have been read yet.') + '</td></tr></tbody>';
      sdEl('sd-mtd').innerHTML = empty;
      sdEl('sd-eom').innerHTML = empty;
      sdEl('sd-ytd').innerHTML = empty;
      return;
    }

    var month = sdScopeRows('mtd');
    sdEl('sd-mtd').innerHTML = sdCols([1, 4, 3, 3, 2, 2]) +
      '<thead><tr><th rowspan="2" class="sd-market-head">Market</th><th colspan="4" class="sd-group sd-sep">Units</th><th colspan="3" class="sd-group sd-sep">Revenue</th>' +
      '<th colspan="3" class="sd-group sd-sep">ASP</th><th colspan="2" class="sd-group sd-sep">New clients</th><th colspan="2" class="sd-group sd-sep">Market share</th></tr>' +
      '<tr><th class="num sd-sep">Actual</th><th class="num">Goal</th><th class="num">% to goal</th><th class="num">Per-day goal</th>' +
      '<th class="num sd-sep">Actual</th><th class="num">Goal</th><th class="num">% to goal</th>' +
      '<th class="num sd-sep">Actual</th><th class="num">Goal</th><th class="num">% to goal</th>' +
      '<th class="num sd-sep">First-ever</th><th class="num">Returning</th>' +
      '<th class="num sd-sep">New listings</th><th class="num">Share</th></tr></thead><tbody>' +
      month.map(function(row, i){
        var g = sdHasGoal(row.goal);
        var nc = row.newClients;
        return '<tr' + sdTotalClass(i, month) + '><td class="sd-market">' + esc(row.label) + '</td>' +
          sdCell(sdNum(row.actual.units), 'sd-sep') + sdCell(g ? sdNum(row.goal.units) : '—') + sdCell(sdPct(row.pct.units)) + sdCell(sdNum(row.goal.unitsPerDay)) +
          sdCell(sdMoney(row.actual.revenueCents), 'sd-sep') + sdCell(g ? sdMoney(row.goal.revenueCents) : '—') + sdCell(sdPct(row.pct.revenue)) +
          sdCell(sdMoney(row.actual.aspCents), 'sd-sep') + sdCell(g ? sdMoney(row.goal.aspCents) : '—') + sdCell(sdPct(row.pct.asp)) +
          sdCell(nc ? sdNum(nc.first) : '—', 'sd-sep') + sdCell(nc ? sdNum(nc.returning) : '—') +
          sdCell(sdNum(row.share.listings), 'sd-sep') + sdCell(sdPct(row.share.pct)) + '</tr>';
      }).join('') + '</tbody>';

    sdEl('sd-eom').innerHTML = sdCols([1, 2, 2, 1]) +
      '<thead><tr><th class="sd-market-head">Market</th><th class="num sd-sep">Units</th><th class="num">Units %</th><th class="num sd-sep">Revenue</th>' +
      '<th class="num">Revenue %</th><th class="num sd-sep">ASP</th></tr></thead><tbody>' +
      month.map(function(row, i){
        return '<tr' + sdTotalClass(i, month) + '><td class="sd-market">' + esc(row.label) + '</td>' +
          sdCell(sdNum(row.trend.units), 'sd-sep') + sdCell(sdPace(row.trend.unitsPct)) +
          sdCell(sdMoney(row.trend.revenueCents), 'sd-sep') + sdCell(sdPace(row.trend.revenuePct)) +
          sdCell(sdMoney(row.actual.aspCents), 'sd-sep') + '</tr>';
      }).join('') + '</tbody>';

    var year = sdScopeRows('ytd');
    sdEl('sd-ytd').innerHTML = sdCols([1, 5, 5, 2, 2, 2]) +
      '<thead><tr><th rowspan="2" class="sd-market-head">Market</th><th colspan="5" class="sd-group sd-sep">Units</th><th colspan="5" class="sd-group sd-sep">Revenue</th>' +
      '<th colspan="2" class="sd-group sd-sep">ASP</th><th colspan="2" class="sd-group sd-sep">New clients</th><th colspan="2" class="sd-group sd-sep">Market share</th></tr>' +
      '<tr><th class="num sd-sep">Actual</th><th class="num">Goal to date</th><th class="num">% to goal</th><th class="num">Year-end trend</th><th class="num">% of year goal</th>' +
      '<th class="num sd-sep">Actual</th><th class="num">Goal to date</th><th class="num">% to goal</th><th class="num">Year-end trend</th><th class="num">% of year goal</th>' +
      '<th class="num sd-sep">Actual</th><th class="num">% to goal</th>' +
      '<th class="num sd-sep">First-ever</th><th class="num">Returning</th>' +
      '<th class="num sd-sep" title="In the months with new listings entered">New listings</th><th class="num">Share</th></tr></thead><tbody>' +
      year.map(function(row, i){
        var g = sdHasGoal(row.annualGoal);
        var nc = row.newClients;
        return '<tr' + sdTotalClass(i, year) + '><td class="sd-market">' + esc(row.label) + '</td>' +
          sdCell(sdNum(row.actual.units), 'sd-sep') + sdCell(g ? sdNum(row.goalToDate.units) : '—') + sdCell(sdPace(row.pct.units)) +
          sdCell(sdNum(row.trend.units)) + sdCell(sdPace(row.trend.unitsPct)) +
          sdCell(sdMoney(row.actual.revenueCents), 'sd-sep') + sdCell(g ? sdMoney(row.goalToDate.revenueCents) : '—') + sdCell(sdPace(row.pct.revenue)) +
          sdCell(sdMoney(row.trend.revenueCents)) + sdCell(sdPace(row.trend.revenuePct)) +
          sdCell(sdMoney(row.actual.aspCents), 'sd-sep') + sdCell(sdPct(row.pct.asp)) +
          sdCell(nc ? sdNum(nc.first) : '—', 'sd-sep') + sdCell(nc ? sdNum(nc.returning) : '—') +
          sdCell(sdNum(row.share.listings), 'sd-sep') + sdCell(sdPct(row.share.pct)) + '</tr>';
      }).join('') + '</tbody>';
  }

  // ── Which market, and the scoreboard built on it ──
  //
  // One filter drives the whole page: the tiles, the scoreboard, the wide
  // tables underneath and the Charts tab all show whatever is picked here.
  // "All markets" is every tracked market plus Other; anything else is that one
  // market, with the company total kept beside it so a market is always read
  // against the whole rather than on its own.

  var SD_METRICS = [
    { key: 'units', label: 'Units' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'asp', label: 'ASP' },
    { key: 'clients', label: 'New clients' },
    { key: 'share', label: 'Market share' }
  ];
  var SD_PERIODS = [{ key: 'month', label: 'Month to date' }, { key: 'year', label: 'Year to date' }];

  var sdMarket = '';
  var sdMetric = 'units';
  var sdPeriod = 'month';
  var sdExpanded = false;
  var sdDefaultMarket = '';
  // Preferences seed the page once. Re-applying them on every poll would yank a
  // viewer back to their default market mid-read.
  var sdPrefsApplied = false;

  /** The report's own name for the chosen period. */
  function sdPeriodKey(){ return sdPeriod === 'year' ? 'ytd' : 'mtd'; }

  function sdMetricDef(){
    for(var i = 0; i < SD_METRICS.length; i++){ if(SD_METRICS[i].key === sdMetric) return SD_METRICS[i]; }
    return SD_METRICS[0];
  }

  function sdApplyPrefs(){
    if(sdPrefsApplied) return;
    sdPrefsApplied = true;
    var p = (sdData && sdData.prefs) || {};
    sdDefaultMarket = p['sales.defaultMarket'] || '';
    sdMarket = sdDefaultMarket;
    if(p['sales.metric']) sdMetric = p['sales.metric'];
    sdExpanded = p['sales.expanded'] === '1';
  }

  async function sdSavePref(key, value){
    var patch = {};
    patch[key] = value;
    var r = await api('PUT', '/sales-dashboard/preferences', patch);
    if(r.ok && sdData) sdData.prefs = r.data.prefs;
    return r.ok;
  }

  /** Markets that can be picked this month, plus Other when it carries orders. */
  function sdMarketChoices(){
    var out = [];
    var key = (sdData && sdData.monthKey) || '';
    ((sdData && sdData.markets) || []).forEach(function(m){
      if(sdActiveIn(m, key)) out.push({ v: m.key, t: m.label });
    });
    var rows = (sdData && sdData.report && sdData.report.ytd.rows) || [];
    if(rows.some(function(row){ return row.key === 'other'; })) out.push({ v: 'other', t: 'Other markets' });
    return out;
  }

  function sdRenderMarketPicker(){
    var sel = sdEl('sd-market');
    var choices = sdMarketChoices();
    if(sdMarket && !choices.some(function(c){ return c.v === sdMarket; })) sdMarket = '';
    sel.textContent = '';
    [{ v: '', t: 'All markets' }].concat(choices).forEach(function(c){
      var el = document.createElement('option');
      el.value = c.v;
      el.textContent = (c.v && c.v === sdDefaultMarket ? '★ ' : '') + c.t;
      sel.appendChild(el);
    });
    sel.value = sdMarket;
    var star = sdEl('sd-market-default');
    var isDefault = sdMarket === sdDefaultMarket;
    star.classList.toggle('is-default', isDefault && !!sdMarket);
    star.title = !sdMarket
      ? 'Open this page on all markets from now on'
      : (isDefault ? 'This is already what the page opens on' : 'Open this page on this market from now on');
  }

  function sdMarketLabel(){
    if(!sdMarket) return 'All markets';
    var choices = sdMarketChoices();
    for(var i = 0; i < choices.length; i++){ if(choices[i].v === sdMarket) return choices[i].t; }
    return sdMarket;
  }

  /** The one row the tiles describe: a chosen market, else the company total. */
  function sdScopeRow(period){
    var p = sdData.report[period];
    if(!sdMarket) return p.total;
    for(var i = 0; i < p.rows.length; i++){ if(p.rows[i].key === sdMarket) return p.rows[i]; }
    // A market with no orders in the period still has a goal to miss, so an
    // empty scope reads as zero rather than as the whole company.
    return { key: sdMarket, label: sdMarketLabel(), actual: { units: 0, revenueCents: 0, aspCents: null },
      goal: p.total.goal && { units: 0, revenueCents: 0, aspCents: null, unitsPerDay: null },
      goalToDate: { units: 0, revenueCents: 0, aspCents: null }, annualGoal: null,
      pct: { units: null, revenue: null, asp: null }, trend: { units: 0, revenueCents: 0, unitsPct: null, revenuePct: null },
      newClients: null, share: { listings: null, pct: null } };
  }

  /** Just the picked market's row, or all of them. */
  function sdFilterRows(rows){
    if(!sdMarket) return rows;
    return (rows || []).filter(function(row){ return row.key === sdMarket; });
  }

  /** The rows the scoreboard lists, the company total always last. */
  function sdScopeRows(period){
    var p = sdData.report[period];
    if(!sdMarket) return p.rows.concat([p.total]);
    return [sdScopeRow(period), p.total];
  }

  function sdComparisonRow(period){
    var c = sdComparison();
    if(!c) return null;
    if(!sdMarket) return c[period].total;
    var rows = c[period].rows;
    for(var i = 0; i < rows.length; i++){ if(rows[i].key === sdMarket) return rows[i]; }
    return null;
  }

  // ── The scoreboard table ──
  //
  // One metric at a time is the whole point: the wide tables put sixteen
  // columns on screen and people told us they could not tell what they were
  // looking at. Each of these is five or six.

  function sdScoreSpec(){
    var year = sdPeriod === 'year';
    if(sdMetric === 'revenue'){
      return {
        title: 'Revenue',
        cols: year
          ? ['Actual', 'Goal to date', '% to goal', 'Year-end trend', '% of year goal']
          : ['Actual', 'Goal', '% to goal', 'Month-end trend', '% of goal'],
        foot: year
          ? 'Goal to date is every earlier month plus this one, prorated by business days completed.'
          : 'Month-end trend carries the pace so far to the end of the month.',
        cells: function(row){
          var g = sdHasGoal(year ? row.annualGoal : row.goal);
          var goal = year ? (row.goalToDate || {}).revenueCents : (row.goal || {}).revenueCents;
          return [sdMoney(row.actual.revenueCents), g ? sdMoney(goal) : '—', sdPace(row.pct.revenue),
            sdMoney(row.trend.revenueCents), sdPace(row.trend.revenuePct)];
        }
      };
    }
    if(sdMetric === 'asp'){
      return {
        title: 'Average order value',
        cols: ['Actual', 'Goal', '% to goal'],
        foot: 'ASP is revenue divided by completed shoots. The sheet calls it ASP; it is the average order value.',
        cells: function(row){
          var goalBlock = year ? row.annualGoal : row.goal;
          return [sdMoney(row.actual.aspCents), sdHasGoal(goalBlock) ? sdMoney((goalBlock || {}).aspCents) : '—',
            sdPace(row.pct.asp)];
        }
      };
    }
    if(sdMetric === 'clients'){
      return {
        title: 'New clients',
        cols: ['First-ever', 'Returning after a year', 'Total'],
        foot: 'A first-ever paid order, or an agent ordering again after twelve months or more without one.',
        cells: function(row){
          var nc = row.newClients;
          return [nc ? sdNum(nc.first) : '—', nc ? sdNum(nc.returning) : '—', sdNum(sdClients(nc))];
        }
      };
    }
    if(sdMetric === 'share'){
      return {
        title: 'Market share',
        cols: ['Shoots', 'New listings', 'Share'],
        foot: year
          ? 'Counted only over the months with new listings entered.'
          : 'Completed shoots divided by the new listings entered for the month.',
        cells: function(row){
          return [sdNum(row.actual.units), sdNum(row.share.listings), sdPct(row.share.pct)];
        }
      };
    }
    return {
      title: 'Units',
      cols: year
        ? ['Actual', 'Goal to date', '% to goal', 'Year-end trend', '% of year goal']
        : ['Actual', 'Goal', '% to goal', 'Per-day goal', 'Month-end trend'],
      foot: year
        ? 'Goal to date is every earlier month plus this one, prorated by business days completed.'
        : 'Per-day goal is the month goal divided by its business days, rounded up.',
      cells: function(row){
        var g = sdHasGoal(year ? row.annualGoal : row.goal);
        if(year){
          return [sdNum(row.actual.units), g ? sdNum((row.goalToDate || {}).units) : '—', sdPace(row.pct.units),
            sdNum(row.trend.units), sdPace(row.trend.unitsPct)];
        }
        return [sdNum(row.actual.units), g ? sdNum((row.goal || {}).units) : '—', sdPct(row.pct.units),
          sdNum((row.goal || {}).unitsPerDay), sdPace(row.trend.unitsPct) + ' ' + sdNum(row.trend.units)];
      }
    };
  }

  /** What the Change column compares, per metric. */
  function sdScoreChange(row, prior){
    if(!prior) return '<span class="sd-muted">—</span>';
    if(sdMetric === 'revenue') return sdChange(row.actual.revenueCents, prior.actual.revenueCents);
    if(sdMetric === 'asp') return sdChange(row.actual.aspCents, prior.actual.aspCents);
    if(sdMetric === 'clients') return sdChange(sdClients(row.newClients), sdClients(prior.newClients));
    if(sdMetric === 'share') return sdPoints(row.share.pct, prior.share.pct);
    return sdChange(row.actual.units, prior.actual.units);
  }

  function sdRenderSeg(id, items, current, onPick){
    var box = sdEl(id);
    box.innerHTML = items.map(function(it){
      return '<button type="button" data-k="' + esc(it.key) + '" aria-pressed="' +
        (it.key === current ? 'true' : 'false') + '">' + esc(it.label) + '</button>';
    }).join('');
    box.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click', function(){ onPick(b.getAttribute('data-k')); });
    });
  }

  function sdRenderScore(){
    sdRenderSeg('sd-metric', SD_METRICS, sdMetric, sdSetMetric);
    sdRenderSeg('sd-period', SD_PERIODS, sdPeriod, sdSetPeriod);
    var r = sdData.report;
    var spec = sdScoreSpec();
    var comparing = sdCompare !== 'off';
    var c = sdComparison();
    sdEl('sd-score-title').textContent = spec.title + ' · ' + sdMarketLabel();
    sdEl('sd-score-note').textContent = sdPeriod === 'year'
      ? r.year + ' through ' + sdDate(r.throughDay)
      : sdMonthName(sdData.monthKey) + ' through ' + sdDate(r.throughDay);
    var bd = r.businessDays;
    sdEl('sd-score-days').textContent = sdPeriod === 'year'
      ? bd.yearCompleted + ' of ' + bd.year + ' business days'
      : bd.monthCompleted + ' of ' + bd.month + ' business days';
    sdEl('sd-score-about').textContent = spec.foot;

    var periodKey = sdPeriodKey();
    var rows = sdScopeRows(periodKey);
    if(!r.mtd.rows.length && !r.ytd.rows.length){
      sdEl('sd-score').innerHTML = '<tbody><tr><td class="sd-empty">' + esc(sdData.sync && sdData.sync.coveredTo
        ? 'No markets or orders for ' + r.year + ' yet.'
        : 'No Spiro orders have been read yet. Press Refresh.') + '</td></tr></tbody>';
      return;
    }
    var headCols = spec.cols.concat(comparing ? ['vs ' + (sdCompare === 'yoy' ? 'last year' : 'last month')] : []);
    var prior = {};
    if(c){
      c[periodKey].rows.forEach(function(row){ prior[row.key] = row; });
      prior.__total = c[periodKey].total;
    }
    sdEl('sd-score').innerHTML = sdCols([1].concat(headCols.map(function(){ return 1; }))) +
      '<thead><tr><th class="sd-market-head">Market</th>' +
      headCols.map(function(label){ return '<th class="num">' + esc(label) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function(row, i){
        var isTotal = i === rows.length - 1;
        var cells = spec.cells(row).map(function(html){ return sdCell(html); }).join('');
        if(comparing){
          cells += sdCell(sdScoreChange(row, c ? (isTotal ? prior.__total : prior[row.key]) : null));
        }
        return '<tr' + (isTotal ? ' class="sd-total"' : '') + '><td class="sd-market">' +
          esc(isTotal ? (sdMarket ? 'Company total' : row.label) : row.label) + '</td>' + cells + '</tr>';
      }).join('') + '</tbody>';
  }

  function sdSetMetric(key){
    sdMetric = key;
    sdRenderScore();
    void sdSavePref('sales.metric', key);
  }

  function sdSetPeriod(key){
    sdPeriod = key;
    sdRenderScore();
  }

  function sdSetMarket(key){
    sdMarket = key || '';
    sdRenderMarketPicker();
    sdRenderKpis();
    sdRenderCompare();
    sdRenderScore();
    sdRenderTables();
    // The Charts tab follows the same filter, so switching views does not
    // quietly change which market is on screen.
    if(typeof sdtSetShow === 'function') sdtSetShow(sdMarket);
  }

  async function sdMakeDefaultMarket(){
    var btn = sdEl('sd-market-default');
    btn.disabled = true;
    var ok = await sdSavePref('sales.defaultMarket', sdMarket || null);
    btn.disabled = false;
    if(!ok){ alert('Could not save that as your default.'); return; }
    sdDefaultMarket = sdMarket;
    sdRenderMarketPicker();
  }

  function sdSetExpanded(next){
    sdExpanded = next;
    sdSetExpandedUi();
    void sdSavePref('sales.expanded', sdExpanded ? '1' : null);
  }

  function sdSetExpandedUi(){
    sdEl('sd-everything').classList.toggle('hidden', !sdExpanded);
    sdEl('sd-more-btn').setAttribute('aria-expanded', sdExpanded ? 'true' : 'false');
    sdEl('sd-more-btn').querySelector('.sd-more-caret').textContent = sdExpanded ? '▾' : '▸';
    sdEl('sd-more-label').textContent = sdExpanded
      ? 'Hide the full tables'
      : 'Show everything — every metric side by side, month and year';
  }

  async function sdRefresh(){
    var btn = sdEl('sd-refresh');
    btn.disabled = true;
    var r = await api('POST', '/sales-dashboard/refresh', {});
    btn.disabled = false;
    if(!r.ok){ alert('Could not start a read: ' + sdError(r)); return; }
    await loadSalesDashboard();
  }

  // ── Goals ──
  function sdGoalMsg(text, ok){ sdMsg('sd-goals-msg', text, ok); }

  function sdDollars(cents){ return (cents === null || cents === undefined) ? '' : String(Math.round(cents) / 100); }

  function sdParse(v){
    var n = Number(String(v || '').split(',').join('').split('$').join('').trim());
    return isFinite(n) ? n : 0;
  }

  async function sdFetchGoalYear(year){
    var r = await api('GET', '/sales-dashboard/goals?year=' + encodeURIComponent(year));
    if(!r.ok) throw new Error(sdError(r, 'Could not load goals.'));
    return r.data;
  }

  // One month's goals as editor rows: every market tracked that month, filled in where it has a goal.
  function sdGoalsFor(data, key){
    var month = Number(key.slice(5, 7));
    var byKey = {};
    var total = { units: '', revenue: '', asp: '' };
    (data.markets || []).forEach(function(m){
      if(sdActiveIn(m, key)) byKey[m.key] = { key: m.key, label: m.label, units: '', revenue: '', asp: '' };
    });
    (data.goals || []).filter(function(g){ return g.month === month; }).forEach(function(g){
      var row = { key: g.marketKey, label: g.marketLabel, units: String(g.units || ''), revenue: g.revenueCents ? sdDollars(g.revenueCents) : '', asp: sdDollars(g.aspCents) };
      if(g.marketKey === 'total') total = row;
      else if(byKey[g.marketKey]){ row.label = byKey[g.marketKey].label; byKey[g.marketKey] = row; }
    });
    var rows = Object.keys(byKey).map(function(k){ return byKey[k]; });
    rows.sort(function(a, b){ return a.label.localeCompare(b.label); });
    return { rows: rows, total: total };
  }

  async function sdOpenGoals(){
    sdGoalMsg('');
    sdEl('sd-goal-month').value = (sdData && sdData.monthKey) || '';
    sdEl('sd-goal-copy').value = '';
    sdEl('sd-goals-modal').classList.remove('hidden');
    await sdLoadGoalMonth();
  }

  async function sdLoadGoalMonth(){
    var key = sdEl('sd-goal-month').value;
    sdGoalMsg('');
    if(!key){ sdGoalRows = []; sdGoalTotal = { units: '', revenue: '', asp: '' }; sdRenderGoalRows(); return; }
    try {
      var picked = sdGoalsFor(await sdFetchGoalYear(key.slice(0, 4)), key);
      sdGoalRows = picked.rows;
      sdGoalTotal = picked.total;
      sdRenderGoalRows();
    } catch (err) {
      sdGoalMsg(err.message);
    }
  }

  function sdGoalInput(i, field, value, label, placeholder){
    return '<td><input type="text" inputmode="decimal" data-i="' + i + '" data-f="' + field + '" value="' + esc(value) + '"' +
      (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + ' aria-label="' + esc(label) + '" /></td>';
  }

  function sdMarketSums(){
    var units = 0;
    var revenue = 0;
    sdGoalRows.forEach(function(row){ units += sdParse(row.units); revenue += sdParse(row.revenue); });
    return { units: units, revenue: revenue };
  }

  function sdAspHint(units, revenue){ return units > 0 ? (revenue / units).toFixed(2) : ''; }

  function sdRenderGoalRows(){
    var body = sdEl('sd-goal-body');
    var sums = sdMarketSums();
    var html = sdGoalRows.map(function(row, i){
      return '<tr><td>' + esc(row.label) + '</td>' +
        sdGoalInput(i, 'units', row.units, row.label + ' units', '') +
        sdGoalInput(i, 'revenue', row.revenue, row.label + ' revenue', '') +
        sdGoalInput(i, 'asp', row.asp, row.label + ' ASP', sdAspHint(sdParse(row.units), sdParse(row.revenue))) + '</tr>';
    }).join('');
    if(!sdGoalRows.length) html = '<tr><td colspan="4" class="sd-empty">No markets are tracked in this month. Add them under Markets.</td></tr>';
    var totalUnits = sdParse(sdGoalTotal.units) || sums.units;
    var totalRevenue = sdParse(sdGoalTotal.revenue) || sums.revenue;
    html += '<tr class="sd-goal-total"><td><b>Company total</b></td>' +
      sdGoalInput('total', 'units', sdGoalTotal.units, 'Company total units', sums.units ? String(sums.units) : '') +
      sdGoalInput('total', 'revenue', sdGoalTotal.revenue, 'Company total revenue', sums.revenue ? sums.revenue.toFixed(2) : '') +
      sdGoalInput('total', 'asp', sdGoalTotal.asp, 'Company total ASP', sdAspHint(totalUnits, totalRevenue)) + '</tr>';
    body.innerHTML = html;
    body.querySelectorAll('input').forEach(function(inp){
      inp.addEventListener('change', function(){
        var i = inp.getAttribute('data-i');
        var row = i === 'total' ? sdGoalTotal : sdGoalRows[Number(i)];
        if(row) row[inp.getAttribute('data-f')] = inp.value;
        sdRenderGoalRows();
      });
    });
  }

  async function sdCopyGoals(){
    var from = sdEl('sd-goal-copy').value;
    if(!from){ sdGoalMsg('Pick the month to copy from.'); return; }
    try {
      var source = sdGoalsFor(await sdFetchGoalYear(from.slice(0, 4)), from);
      var filled = source.rows.filter(function(s){ return s.units || s.revenue || s.asp; });
      var hasTotal = !!(source.total.units || source.total.revenue || source.total.asp);
      if(!filled.length && !hasTotal){ sdGoalMsg(sdMonthName(from) + ' has no goals to copy.'); return; }
      var byKey = {};
      sdGoalRows.forEach(function(row){ byKey[row.key] = row; });
      filled.forEach(function(s){
        var target = byKey[s.key];
        if(target){ target.units = s.units; target.revenue = s.revenue; target.asp = s.asp; }
      });
      if(hasTotal) sdGoalTotal = source.total;
      sdRenderGoalRows();
      sdGoalMsg('Copied from ' + sdMonthName(from) + '. Nothing is saved until you press Save month.', true);
    } catch (err) {
      sdGoalMsg(err.message);
    }
  }

  async function sdSaveGoals(){
    var key = sdEl('sd-goal-month').value;
    if(!key){ sdGoalMsg('Pick the month these goals are for.'); return; }
    // A value typed but not yet committed by leaving its box still counts.
    sdEl('sd-goal-body').querySelectorAll('input').forEach(function(inp){
      var i = inp.getAttribute('data-i');
      var row = i === 'total' ? sdGoalTotal : sdGoalRows[Number(i)];
      if(row) row[inp.getAttribute('data-f')] = inp.value;
    });
    var goals = sdGoalRows.map(function(row){
      return { marketKey: row.key, units: row.units, revenue: row.revenue, asp: row.asp };
    });
    goals.push({ marketKey: 'total', units: sdGoalTotal.units, revenue: sdGoalTotal.revenue, asp: sdGoalTotal.asp });
    var btn = sdEl('sd-goals-save');
    btn.disabled = true;
    var r = await api('PUT', '/sales-dashboard/goals', { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)), goals: goals });
    btn.disabled = false;
    if(!r.ok){ sdGoalMsg('Could not save: ' + sdError(r)); return; }
    sdGoalMsg('Saved goals for ' + sdMonthName(key) + '.', true);
    loadSalesDashboard();
  }

  // ── Markets ──
  function sdMarketMsg(text, ok){ sdMsg('sd-markets-msg', text, ok); }

  async function sdOpenMarkets(){
    sdMarketMsg('');
    sdEl('sd-markets-modal').classList.remove('hidden');
    await sdLoadMarkets();
  }

  async function sdLoadMarkets(){
    var r = await api('GET', '/sales-dashboard/markets');
    if(!r.ok){ sdMarketMsg('Could not load markets: ' + sdError(r)); return; }
    var markets = r.data.markets || [];
    var suggestions = r.data.suggestions || [];
    var month = sdThisMonth();
    var box = sdEl('sd-market-list');
    box.innerHTML = markets.length ? markets.map(function(m){
      var status = m.removedFrom
        ? (m.removedFrom <= month ? 'Stopped from ' : 'Stops from ') + sdMonthName(m.removedFrom)
        : 'Tracked in every month';
      var actions = m.removedFrom
        ? '<button type="button" class="btn btn-sm btn-ghost" data-restore="' + esc(m.key) + '">Track again</button>'
        : '<button type="button" class="btn btn-sm btn-ghost" data-stop="' + esc(m.key) + '">Stop from</button>' +
          '<input type="month" value="' + esc(month) + '" aria-label="' + esc('Month ' + m.label + ' stops counting from') + '" />';
      return '<div class="sd-item"><div class="sd-item-main"><b>' + esc(m.label) + '</b> <span class="sd-muted">· ' + esc(status) + '</span></div>' +
        '<div class="sd-item-actions">' + actions + '</div></div>';
    }).join('') : '<div class="sd-muted" style="font-size:0.85rem">No markets yet. Until there are, every order counts under Other markets.</div>';
    box.querySelectorAll('[data-stop]').forEach(function(b){
      b.addEventListener('click', function(){
        var picker = b.nextElementSibling;
        if(!picker || !picker.value){ sdMarketMsg('Pick the month it stops counting from.'); return; }
        sdSetRemoval(b.getAttribute('data-stop'), picker.value);
      });
    });
    box.querySelectorAll('[data-restore]').forEach(function(b){
      b.addEventListener('click', function(){ sdSetRemoval(b.getAttribute('data-restore'), null); });
    });

    var suggest = sdEl('sd-market-suggest');
    suggest.innerHTML = suggestions.length
      ? '<p class="sd-hint" style="margin-bottom:0.4rem">Spiro service areas with orders since last January that are not on the list:</p><div class="sd-chips">' +
        suggestions.map(function(s){
          return '<button type="button" class="btn btn-sm btn-ghost" data-suggest="' + esc(s.label) + '">+ ' + esc(s.label) +
            ' <span class="sd-muted">' + esc(sdNum(s.orders) + (s.orders === 1 ? ' order' : ' orders')) + '</span></button>';
        }).join('') + '</div>'
      : '';
    suggest.querySelectorAll('[data-suggest]').forEach(function(b){
      b.addEventListener('click', function(){ sdAddMarket(b.getAttribute('data-suggest')); });
    });
  }

  async function sdAddMarket(label){
    label = String(label || '').trim();
    if(!label){ sdMarketMsg('Name the market to add.'); return; }
    var r = await api('POST', '/sales-dashboard/markets', { label: label });
    if(!r.ok){ sdMarketMsg('Could not add it: ' + sdError(r)); return; }
    sdEl('sd-market-new').value = '';
    sdMarketMsg(r.data.market.label + ' is now in every month.', true);
    await sdLoadMarkets();
    loadSalesDashboard();
  }

  async function sdSetRemoval(key, from){
    var r = await api('PATCH', '/sales-dashboard/markets/' + encodeURIComponent(key), { removedFrom: from });
    if(!r.ok){ sdMarketMsg('Could not save: ' + sdError(r)); return; }
    sdMarketMsg(from
      ? r.data.market.label + ' stops counting from ' + sdMonthName(from) + '. The months before keep it.'
      : r.data.market.label + ' is tracked in every month again.', true);
    await sdLoadMarkets();
    loadSalesDashboard();
  }

  // ── New listings ──
  function sdListingMsg(text, ok){ sdMsg('sd-listings-msg', text, ok); }

  async function sdOpenListings(){
    sdListingMsg('');
    sdEl('sd-listings-year').value = String((sdData && sdData.report.year) || new Date().getFullYear());
    sdEl('sd-listings-modal').classList.remove('hidden');
    await sdLoadListings();
  }

  async function sdLoadListings(){
    var year = Number(sdEl('sd-listings-year').value);
    var grid = sdEl('sd-listings-grid');
    sdListingMsg('');
    grid.removeAttribute('data-year');
    if(!(year >= 2000 && year <= 2100)){ grid.innerHTML = ''; sdListingMsg('Pick a year.'); return; }
    var r = await api('GET', '/sales-dashboard/listings?year=' + year);
    if(!r.ok){ grid.innerHTML = ''; sdListingMsg('Could not load new listings: ' + sdError(r)); return; }
    var values = {};
    (r.data.listings || []).forEach(function(l){ values[l.marketKey + '|' + l.month] = String(l.listings); });
    sdListingMarkets = (r.data.markets || []).filter(function(m){ return sdActiveIn(m, year + '-01'); });
    var head = '<thead><tr><th class="sd-market-head">Market</th>' +
      SD_MONTHS.map(function(n){ return '<th class="num">' + n + '</th>'; }).join('') + '</tr></thead>';
    var body = sdListingMarkets.map(function(m, i){
      return '<tr><td class="sd-market">' + esc(m.label) + '</td>' + SD_MONTHS.map(function(n, j){
        var tracked = sdActiveIn(m, year + '-' + String(j + 1).padStart(2, '0'));
        return '<td><input type="text" inputmode="numeric" data-i="' + i + '" data-m="' + j + '" value="' + esc(values[m.key + '|' + (j + 1)] || '') + '"' +
          (tracked ? '' : ' disabled title="Not tracked this month"') + ' aria-label="' + esc(m.label + ' new listings, ' + n + ' ' + year) + '" /></td>';
      }).join('') + '</tr>';
    }).join('');
    if(!sdListingMarkets.length) body = '<tr><td colspan="13" class="sd-empty">' + esc('No markets are tracked in ' + year + '. Add them under Markets.') + '</td></tr>';
    grid.innerHTML = head + '<tbody>' + body + '</tbody>';
    grid.setAttribute('data-year', String(year));
  }

  async function sdSaveListings(){
    var grid = sdEl('sd-listings-grid');
    var year = Number(grid.getAttribute('data-year'));
    if(!year || !sdListingMarkets.length){ sdListingMsg('There is nothing to save for this year.'); return; }
    var rows = sdListingMarkets.map(function(m){
      var months = [];
      for(var j = 0; j < 12; j++) months.push('');
      return { marketKey: m.key, months: months };
    });
    grid.querySelectorAll('input').forEach(function(inp){
      rows[Number(inp.getAttribute('data-i'))].months[Number(inp.getAttribute('data-m'))] = inp.value.trim();
    });
    var btn = sdEl('sd-listings-save');
    btn.disabled = true;
    var r = await api('PUT', '/sales-dashboard/listings', { year: year, rows: rows });
    btn.disabled = false;
    if(!r.ok){ sdListingMsg('Could not save: ' + sdError(r)); return; }
    sdListingMsg('Saved new listings for ' + year + '.', true);
    loadSalesDashboard();
  }

  // ── Holidays ──
  function sdHolidayMsg(text){ sdMsg('sd-holidays-msg', text, false); }

  async function sdOpenHolidays(){
    sdHolidayMsg('');
    sdEl('sd-holidays-modal').classList.remove('hidden');
    await sdLoadHolidays();
  }

  async function sdLoadHolidays(){
    var box = sdEl('sd-holiday-list');
    var r = await api('GET', '/sales-dashboard/holidays');
    if(!r.ok){ box.innerHTML = '<div class="sd-error">Could not load holidays.</div>'; return; }
    var list = r.data.holidays || [];
    if(!list.length){ box.innerHTML = '<div class="sd-muted" style="font-size:0.85rem">No holidays yet, so every weekday counts.</div>'; return; }
    box.innerHTML = list.map(function(h){
      return '<div class="sd-item"><div class="sd-item-main"><b>' + esc(sdDate(h.day)) + '</b> <span class="sd-muted">' + esc(sdWeekday(h.day)) +
        '</span> · ' + esc(h.label) + '</div><button type="button" class="btn btn-sm btn-ghost sd-holiday-del" data-day="' + esc(h.day) + '">Remove</button></div>';
    }).join('');
    box.querySelectorAll('.sd-holiday-del').forEach(function(b){
      b.addEventListener('click', async function(){
        var res = await api('DELETE', '/sales-dashboard/holidays/' + encodeURIComponent(b.getAttribute('data-day')));
        if(!res.ok){ sdHolidayMsg('Could not remove that holiday.'); return; }
        await sdLoadHolidays();
        loadSalesDashboard();
      });
    });
  }

  async function sdAddHoliday(){
    var day = sdEl('sd-holiday-day').value;
    var label = sdEl('sd-holiday-label').value.trim();
    if(!day || !label){ sdHolidayMsg('Give the date and the holiday' + "'" + 's name.'); return; }
    var r = await api('POST', '/sales-dashboard/holidays', { day: day, label: label });
    if(!r.ok){ sdHolidayMsg('Could not add it: ' + sdError(r)); return; }
    sdEl('sd-holiday-day').value = '';
    sdEl('sd-holiday-label').value = '';
    sdHolidayMsg('');
    await sdLoadHolidays();
    loadSalesDashboard();
  }

  function sdOn(id, ev, fn){
    var el = sdEl(id);
    if(el) el.addEventListener(ev, fn);
  }
  function sdCloser(button, modal){ sdOn(button, 'click', function(){ sdEl(modal).classList.add('hidden'); }); }

  sdOn('sd-month', 'change', function(){ loadSalesDashboard(); });
  sdOn('sd-market', 'change', function(){ sdSetMarket(sdEl('sd-market').value); });
  sdOn('sd-market-default', 'click', sdMakeDefaultMarket);
  sdOn('sd-more-btn', 'click', function(){ sdSetExpanded(!sdExpanded); });
  sdOn('sd-compare', 'change', function(){ sdSetCompare(sdEl('sd-compare').value); });
  sdOn('sd-refresh', 'click', sdRefresh);
  sdOn('sd-goals-open', 'click', sdOpenGoals);
  sdOn('sd-goal-month', 'change', sdLoadGoalMonth);
  sdOn('sd-goal-copy-btn', 'click', sdCopyGoals);
  sdOn('sd-goals-save', 'click', sdSaveGoals);
  sdCloser('sd-goals-close', 'sd-goals-modal');
  sdOn('sd-markets-open', 'click', sdOpenMarkets);
  sdOn('sd-market-add', 'click', function(){ sdAddMarket(sdEl('sd-market-new').value); });
  sdOn('sd-market-new', 'keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); sdAddMarket(sdEl('sd-market-new').value); } });
  sdCloser('sd-markets-close', 'sd-markets-modal');
  sdOn('sd-listings-open', 'click', sdOpenListings);
  sdOn('sd-listings-year', 'change', sdLoadListings);
  sdOn('sd-listings-save', 'click', sdSaveListings);
  sdCloser('sd-listings-close', 'sd-listings-modal');
  sdOn('sd-holidays-open', 'click', sdOpenHolidays);
  sdOn('sd-holiday-add', 'click', sdAddHoliday);
  sdCloser('sd-holidays-close', 'sd-holidays-modal');
`;

export const SALES_DASHBOARD_COMPONENT_JS =
  SALES_DASHBOARD_CORE_JS + SALES_TRENDS_COMPONENT_JS + SALES_EXPORT_COMPONENT_JS;
