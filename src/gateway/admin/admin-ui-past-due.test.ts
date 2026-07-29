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
type AccountLike = { accountKey: string; needsManualReview: boolean; case: CaseLike };

function loadPastDueModel(opts: {
  accounts: AccountLike[];
  viewerId: string;
  filters?: { owner?: string; reviewOnly?: boolean; hideResolved?: boolean };
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
    `${preamble}\n${block}\nreturn { finVisibleAccounts, finReviewOpen, finOwnerLabel, finStatusLabel };`,
  );
  return factory() as {
    finVisibleAccounts: () => AccountLike[];
    finReviewOpen: (a: AccountLike) => boolean;
    finOwnerLabel: (c: CaseLike) => string;
    finStatusLabel: (key: string) => string;
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
