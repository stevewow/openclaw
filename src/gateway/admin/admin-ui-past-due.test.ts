import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";

/**
 * The Past Due board decides what a viewer sees — their own queue, the accounts
 * still needing a partial-payment review, whether a resolved account is hidden —
 * entirely in the SPA's inline JS, which no type or lint pass reads. This suite
 * lifts that block out of the shipped HTML and exercises it, the same technique
 * admin-ui-projects.test.ts uses for the project board.
 */

type CaseLike = {
  status: string;
  assignedTo: string | null;
  assignedToName?: string | null;
  reviewClearedAt?: number | null;
};
type AccountLike = {
  accountKey: string;
  needsManualReview: boolean;
  needsAttention?: boolean;
  promiseBroken?: boolean;
  case: CaseLike;
};

function loadPastDueModel(opts: {
  accounts: AccountLike[];
  viewerId: string;
  filters?: {
    owner?: string;
    attentionOnly?: boolean;
    reviewOnly?: boolean;
    hideResolved?: boolean;
  };
}) {
  const script = Array.from(ADMIN_UI_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)).map(
    (m) => m[1],
  )[0];
  if (!script) {
    throw new Error("no inline script found in ADMIN_UI_HTML");
  }
  const start = script.indexOf("function finStatusLabel(");
  const endIdx = script.indexOf("function renderFinViews()");
  if (start === -1 || endIdx === -1) {
    throw new Error("past-due block not found — did the SPA change?");
  }
  const block = script.slice(start, endIdx);

  const filters = {
    owner: opts.filters?.owner ?? "all",
    attentionOnly: opts.filters?.attentionOnly ?? false,
    reviewOnly: opts.filters?.reviewOnly ?? false,
    hideResolved: opts.filters?.hideResolved ?? true,
  };
  // The block closes over SPA state plus helpers it never reaches here
  // (loadFinancials touches the DOM but is not called).
  const preamble = `
    const currentUser = { id: ${JSON.stringify(opts.viewerId)} };
    const finFilters = ${JSON.stringify(filters)};
    let finBreakdown = { accounts: ${JSON.stringify(opts.accounts)} };
    let finStatuses = [{ key: 'new', label: 'New' }, { key: 'working', label: 'Working' }, { key: 'resolved', label: 'Resolved' }];
    const esc = (s) => String(s);
  `;
  // Evaluating the shipped block is the point of this suite; the input is our
  // own source file, not user data.
  // oxlint-disable-next-line no-implied-eval
  const factory = new Function(
    `${preamble}\n${block}\nreturn { finVisibleAccounts, finReviewOpen, finOwnerLabel, finStatusLabel, finNeedsAttention, finPromiseBroken };`,
  );
  return factory() as {
    finVisibleAccounts: () => AccountLike[];
    finReviewOpen: (a: AccountLike) => boolean;
    finOwnerLabel: (c: CaseLike) => string;
    finStatusLabel: (key: string) => string;
    finNeedsAttention: (a: AccountLike) => boolean;
    finPromiseBroken: (a: AccountLike) => boolean;
  };
}

function account(
  key: string,
  caseFields: Partial<CaseLike> & { assignedTo?: string | null },
  needsManualReview = false,
): AccountLike {
  return {
    accountKey: key,
    needsManualReview,
    case: {
      status: caseFields.status ?? "new",
      assignedTo: caseFields.assignedTo ?? null,
      assignedToName: caseFields.assignedToName ?? null,
      reviewClearedAt: caseFields.reviewClearedAt ?? null,
    },
  };
}

const ACCOUNTS: AccountLike[] = [
  account("mine", { assignedTo: "me", assignedToName: "Casey Ruiz", status: "working" }, true),
  account("mine-reviewed", { assignedTo: "me", reviewClearedAt: 1_700_000_000_000 }, true),
  account("mine-resolved", { assignedTo: "me", status: "resolved" }),
  account("theirs", { assignedTo: "someone-else", status: "working" }, true),
  account("nobodys", { assignedTo: null }),
];

describe("past due board filters", () => {
  it("shows everyone's open accounts by default", () => {
    const m = loadPastDueModel({ accounts: ACCOUNTS, viewerId: "me" });
    expect(m.finVisibleAccounts().map((a) => a.accountKey)).toEqual([
      "mine",
      "mine-reviewed",
      "theirs",
      "nobodys",
    ]);
  });

  it("narrows to the viewer's own queue", () => {
    const m = loadPastDueModel({
      accounts: ACCOUNTS,
      viewerId: "me",
      filters: { owner: "mine" },
    });
    expect(m.finVisibleAccounts().map((a) => a.accountKey)).toEqual(["mine", "mine-reviewed"]);
  });

  it("finds the accounts nobody has picked up", () => {
    const m = loadPastDueModel({
      accounts: ACCOUNTS,
      viewerId: "me",
      filters: { owner: "unassigned" },
    });
    expect(m.finVisibleAccounts().map((a) => a.accountKey)).toEqual(["nobodys"]);
  });

  it("keeps a resolved account out unless the viewer asks for it", () => {
    const shown = loadPastDueModel({
      accounts: ACCOUNTS,
      viewerId: "me",
      filters: { owner: "mine", hideResolved: false },
    });
    expect(shown.finVisibleAccounts().map((a) => a.accountKey)).toContain("mine-resolved");
  });

  it("counts a signed-off account as reviewed, not as outstanding review work", () => {
    const m = loadPastDueModel({
      accounts: ACCOUNTS,
      viewerId: "me",
      filters: { reviewOnly: true },
    });
    // mine-reviewed and theirs both carry a partial payment; only the unsigned
    // ones are still review work.
    expect(m.finVisibleAccounts().map((a) => a.accountKey)).toEqual(["mine", "theirs"]);
    expect(m.finReviewOpen(ACCOUNTS[0])).toBe(true);
    expect(m.finReviewOpen(ACCOUNTS[1])).toBe(false);
    // An account with no partial payment is never review work.
    expect(m.finReviewOpen(ACCOUNTS[4])).toBe(false);
  });

  it("names the owner and the stage for a card", () => {
    const m = loadPastDueModel({ accounts: ACCOUNTS, viewerId: "me" });
    expect(m.finOwnerLabel(ACCOUNTS[0].case)).toBe("Casey Ruiz");
    expect(m.finOwnerLabel(ACCOUNTS[4].case)).toBe("Unassigned");
    expect(m.finStatusLabel("working")).toBe("Working");
  });
});

/**
 * The table cells are a second block, further down the same script: the two
 * inline pickers and the Next Contact cell. They render HTML strings, so the
 * assertions read them as text rather than mounting a DOM.
 */
function loadPastDueCells(opts: {
  statuses?: Array<{ key: string; label: string }>;
  actions?: Array<{ key: string; step: number; label: string; bucket: string }>;
}) {
  const script = Array.from(ADMIN_UI_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)).map(
    (m) => m[1],
  )[0];
  if (!script) {
    throw new Error("no inline script found in ADMIN_UI_HTML");
  }
  const start = script.indexOf("function finNextContactCell(");
  const endIdx = script.indexOf("function finSortAccounts(");
  if (start === -1 || endIdx === -1) {
    throw new Error("past-due cell block not found — did the SPA change?");
  }
  const block = script.slice(start, endIdx);
  const statuses = opts.statuses ?? [
    { key: "new", label: "New" },
    { key: "working", label: "Working" },
    { key: "resolved", label: "Resolved" },
  ];
  const actions = opts.actions ?? [
    { key: "email_45", step: 1, label: "Send billing email", bucket: "45-59" },
    { key: "call_60", step: 2, label: "Billing call + notify BDS", bucket: "60-89" },
    { key: "call_90", step: 3, label: "Billing call / final email", bucket: "90-119" },
    { key: "letter_120", step: 4, label: "Letter → refer to collections", bucket: "120+" },
  ];
  const preamble = `
    const esc = (s) => String(s == null ? '' : s);
    const finStatuses = ${JSON.stringify(statuses)};
    const finActions = ${JSON.stringify(actions)};
    const finDate = (ms) => ms ? 'DATE(' + ms + ')' : '—';
    const finStatusLabel = (k) => (finStatuses.find(s => s.key === k) || { label: k }).label;
    const finOwnerLabel = (c) => c && c.assignedTo ? 'Owner' : 'Unassigned';
  `;
  // Evaluating the shipped block is the point of this suite; the input is our
  // own source file, not user data.
  // oxlint-disable-next-line no-implied-eval
  const factory = new Function(
    `${preamble}\n${block}\nreturn { finNextContactCell, finStageSelect, finActionSelect, finSortValue };`,
  );
  return factory() as {
    finNextContactCell: (a: Record<string, unknown>) => string;
    finStageSelect: (a: Record<string, unknown>) => string;
    finActionSelect: (a: Record<string, unknown>) => string;
    finSortValue: (a: Record<string, unknown>, key: string) => number | string;
  };
}

const ACTION_60 = {
  key: "call_60",
  step: 2,
  label: "Billing call + notify BDS",
  detail: "60-day billing call.",
  bucket: "60-89",
  source: "policy",
  policyKey: "call_60",
};

describe("next contact cell", () => {
  it("says nothing is booked rather than showing an empty date", () => {
    const m = loadPastDueCells({});
    const html = m.finNextContactCell({ nextContact: null, daysUntilContact: null });
    expect(html).toContain("Not scheduled");
  });

  it("reads in human terms either side of today", () => {
    const m = loadPastDueCells({});
    const cell = (days: number) =>
      m.finNextContactCell({
        nextContact: { at: 1_700_000_000_000, taskTitle: "Call them", taskId: "t1" },
        daysUntilContact: days,
      });
    expect(cell(0)).toContain("Today");
    expect(cell(1)).toContain("Tomorrow");
    expect(cell(5)).toContain("in 5d");
    expect(cell(-1)).toContain("Yesterday");
    expect(cell(-9)).toContain("9d ago");
  });

  it("marks a follow-up that has already slipped", () => {
    const m = loadPastDueCells({});
    const late = m.finNextContactCell({
      nextContact: { at: 1, taskTitle: "t", taskId: "t1" },
      daysUntilContact: -3,
    });
    expect(late).toContain("fin-next-over");
    const soon = m.finNextContactCell({
      nextContact: { at: 1, taskTitle: "t", taskId: "t1" },
      daysUntilContact: 4,
    });
    expect(soon).not.toContain("fin-next-over");
  });

  it("sorts an unscheduled account last instead of as due-soonest", () => {
    const m = loadPastDueCells({});
    const none = m.finSortValue({ daysUntilContact: null }, "next");
    const soon = m.finSortValue({ daysUntilContact: 2 }, "next");
    expect(Number(none)).toBeGreaterThan(Number(soon));
  });
});

describe("inline stage and next-action pickers", () => {
  it("numbers the stages so the funnel order is visible", () => {
    const m = loadPastDueCells({});
    const html = m.finStageSelect({ accountKey: "a1", case: { status: "working" } });
    expect(html).toContain("1 · New");
    expect(html).toContain("2 · Working");
    expect(html).toContain("3 · Resolved");
    // The account's own stage is the one showing.
    expect(html).toMatch(/<option value="working" selected>/);
  });

  it("numbers the collection steps in policy order", () => {
    const m = loadPastDueCells({});
    const html = m.finActionSelect({
      accountKey: "a1",
      bucket: "60-89",
      action: ACTION_60,
      case: {},
    });
    expect(html).toContain("1 · Send billing email");
    expect(html).toContain("2 · Billing call + notify BDS");
    expect(html).toContain("3 · Billing call / final email");
    expect(html).toContain("4 · Letter");
  });

  it("defaults to following policy, and names the step the age calls for", () => {
    const m = loadPastDueCells({});
    const html = m.finActionSelect({
      accountKey: "a1",
      bucket: "60-89",
      action: ACTION_60,
      case: {},
    });
    expect(html).toContain("Follow policy (2 · Billing call + notify BDS)");
    expect(html).toMatch(/<option value="" selected>/);
    // Nothing is pinned, so the cell is not flagged as an override.
    expect(html).not.toContain("fin-cell-pinned");
  });

  it("shows a pinned step as selected and flags that it overrides the age", () => {
    const m = loadPastDueCells({});
    const html = m.finActionSelect({
      accountKey: "a1",
      bucket: "45-59",
      action: { ...ACTION_60, source: "override", policyKey: "email_45" },
      case: { nextAction: "call_60" },
    });
    expect(html).toMatch(/<option value="call_60" selected>/);
    expect(html).toContain("fin-cell-pinned");
    // The policy default still names what the age would call for.
    expect(html).toContain("Follow policy (1 · Send billing email)");
  });

  it("carries the account key so a change knows what it is editing", () => {
    const m = loadPastDueCells({});
    expect(m.finStageSelect({ accountKey: "acct-7", case: {} })).toContain('data-account="acct-7"');
    expect(
      m.finActionSelect({ accountKey: "acct-7", bucket: "60-89", action: ACTION_60, case: {} }),
    ).toContain('data-account="acct-7"');
  });

  it("sorts by where the account sits in the sequence, not by label", () => {
    const m = loadPastDueCells({});
    expect(m.finSortValue({ action: { step: 4 } }, "action")).toBe(4);
    expect(m.finSortValue({ action: { step: 1 } }, "action")).toBe(1);
  });
});

describe("what needs someone today", () => {
  const ATTENTION: AccountLike[] = [
    {
      ...account("broken", { assignedTo: "me", status: "promised" }),
      needsAttention: true,
      promiseBroken: true,
    },
    { ...account("due", { assignedTo: "me", status: "working" }), needsAttention: true },
    { ...account("quiet", { assignedTo: "me", status: "working" }) },
  ];

  it("narrows the board to the accounts waiting on someone", () => {
    const m = loadPastDueModel({
      accounts: ATTENTION,
      viewerId: "me",
      filters: { attentionOnly: true },
    });
    expect(m.finVisibleAccounts().map((a) => a.accountKey)).toEqual(["broken", "due"]);
  });

  it("leaves the board alone until the filter is asked for", () => {
    const m = loadPastDueModel({ accounts: ATTENTION, viewerId: "me" });
    expect(m.finVisibleAccounts()).toHaveLength(3);
  });

  it("reads both flags off the server's answer rather than recomputing them", () => {
    const m = loadPastDueModel({ accounts: ATTENTION, viewerId: "me" });
    expect(m.finNeedsAttention(ATTENTION[0])).toBe(true);
    expect(m.finPromiseBroken(ATTENTION[0])).toBe(true);
    // A due follow-up needs attention without any promise being involved.
    expect(m.finNeedsAttention(ATTENTION[1])).toBe(true);
    expect(m.finPromiseBroken(ATTENTION[1])).toBe(false);
    expect(m.finNeedsAttention(ATTENTION[2])).toBe(false);
  });

  it("stacks with the owner filter rather than replacing it", () => {
    const mixed = [
      ...ATTENTION,
      { ...account("theirs", { assignedTo: "someone-else" }), needsAttention: true },
    ];
    const m = loadPastDueModel({
      accounts: mixed,
      viewerId: "me",
      filters: { owner: "mine", attentionOnly: true },
    });
    expect(m.finVisibleAccounts().map((a) => a.accountKey)).toEqual(["broken", "due"]);
  });
});
