import { describe, expect, it } from "vitest";
import { USER_PORTAL_HTML } from "./user-portal-html.js";

/**
 * The portal's collections queue is the same board a collector works from as
 * the admin SPA, minus the parts only an admin can do. Its rules — when a
 * promise counts as broken, what escalating asks before it hands the account
 * over — live in the portal's inline JS, which no type or lint pass reads. This
 * suite lifts that block out of the shipped HTML and exercises it, the same
 * technique admin-ui-past-due.test.ts uses for the SPA.
 */

type CaseLike = {
  status: string;
  assignedToName?: string | null;
  reviewClearedAt?: number | null;
  promisedAmount?: number | null;
  promisedDate?: number | null;
  escalatedAt?: number | null;
  escalatedByName?: string | null;
  escalatedReason?: string | null;
};

type AccountLike = {
  accountKey: string;
  accountName: string;
  balance: number;
  bucket: string;
  oldestDaysPastDue: number;
  invoiceCount: number;
  partiallyPaidCount?: number;
  needsManualReview: boolean;
  needsAttention?: boolean;
  promiseBroken?: boolean;
  action: { step?: number; label: string; detail: string; source?: string };
  nextContact?: { at: number } | null;
  daysUntilContact?: number | null;
  case: CaseLike;
};

type ApiCall = { method: string; path: string; body: unknown };

type Deps = {
  api: (method: string, path: string, body?: unknown) => Promise<unknown>;
  alert: (msg: string) => void;
  prompt: (msg: string) => string | null;
};

function loadPortalPastDue(deps: Partial<Deps> & { apiResult?: unknown } = {}) {
  const script = Array.from(USER_PORTAL_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)).map(
    (m) => m[1],
  )[0];
  if (!script) {
    throw new Error("no inline script found in USER_PORTAL_HTML");
  }
  const start = script.indexOf("var portalPastDueOpen = {}");
  const endIdx = script.indexOf("// ── Pipedrive Cleanup worklist");
  if (start === -1 || endIdx === -1) {
    throw new Error("portal collections block not found — did the portal change?");
  }
  const block = script.slice(start, endIdx);

  const calls: ApiCall[] = [];
  const alerts: string[] = [];
  const prompts: string[] = [];
  const api =
    deps.api ??
    (async (method: string, path: string, body?: unknown) => {
      calls.push({ method, path, body });
      return { ok: true, status: 200, data: deps.apiResult ?? {} };
    });
  const runtime: Deps = {
    api,
    alert: deps.alert ?? ((m: string) => void alerts.push(m)),
    prompt:
      deps.prompt ??
      ((m: string) => {
        prompts.push(m);
        return "";
      }),
  };

  // The block closes over portal helpers it never reaches here: the render
  // functions touch the DOM but nothing below calls them.
  const preamble = `
    const esc = (s) => String(s ?? '');
    const api = deps.api;
    const alert = deps.alert;
    const prompt = deps.prompt;
  `;
  // Evaluating the shipped block is the point of this suite; the input is our
  // own source file, not user data.
  // oxlint-disable-next-line no-implied-eval
  const factory = new Function(
    "deps",
    `${preamble}\n${block}\nreturn {
      portalPastDueCard, portalSetPastDueStage, portalPromiseBroken, portalPromiseNote,
      portalPromiseBlock, portalEscalationBlock, portalTimelineRow,
      seed: (accounts, owner) => { portalPastDueAccounts = accounts; portalEscalationOwner = owner; },
    };`,
  );
  const model = factory(runtime) as {
    portalPastDueCard: (a: AccountLike, statuses: Array<{ key: string; label: string }>) => string;
    portalSetPastDueStage: (accountKey: string, status: string) => Promise<boolean>;
    portalPromiseBroken: (c: CaseLike) => boolean;
    portalPromiseNote: (c: CaseLike) => string;
    portalPromiseBlock: (c: CaseLike) => string;
    portalEscalationBlock: (c: CaseLike) => string;
    portalTimelineRow: (t: {
      kind: string;
      at: number;
      summary: string;
      detail?: string | null;
      actorName?: string | null;
    }) => string;
    seed: (accounts: AccountLike[], owner: { id: string; name: string } | null) => void;
  };
  return { model, calls, alerts, prompts };
}

const STATUSES = [
  { key: "new", label: "New" },
  { key: "promised", label: "Promised" },
  { key: "escalated", label: "Escalated" },
];

function account(over: Partial<AccountLike> = {}): AccountLike {
  return {
    accountKey: "acct-1",
    accountName: "Blue Door Realty",
    balance: 1250,
    bucket: "60-89",
    oldestDaysPastDue: 72,
    invoiceCount: 3,
    needsManualReview: false,
    action: { step: 3, label: "Second call", detail: "Ask for a payment date." },
    nextContact: null,
    daysUntilContact: null,
    case: { status: "working" },
    ...over,
  };
}

describe("portal collections queue — promises", () => {
  it("counts a promise as broken only once its date has passed at the promised stage", () => {
    const { model } = loadPortalPastDue();
    const past = Date.now() - 4 * 86_400_000;
    const future = Date.now() + 4 * 86_400_000;
    expect(model.portalPromiseBroken({ status: "promised", promisedDate: past })).toBe(true);
    expect(model.portalPromiseBroken({ status: "promised", promisedDate: future })).toBe(false);
    expect(model.portalPromiseBroken({ status: "resolved", promisedDate: past })).toBe(false);
    expect(model.portalPromiseBroken({ status: "promised", promisedDate: null })).toBe(false);
  });

  it("says how late a broken promise is, not just its date", () => {
    const { model } = loadPortalPastDue();
    const note = model.portalPromiseNote({
      status: "promised",
      promisedAmount: 500,
      promisedDate: Date.now() - 4 * 86_400_000,
    });
    expect(note).toContain("Promise broken");
    expect(note).toContain("$500.00");
    expect(note).toContain("4 days ago");
  });

  it("states a promise still in the future without flagging it", () => {
    const { model } = loadPortalPastDue();
    const note = model.portalPromiseNote({
      status: "promised",
      promisedAmount: null,
      promisedDate: Date.now() + 3 * 86_400_000,
    });
    expect(note).toContain("Promised payment by");
    expect(note).not.toContain("Promise broken");
  });

  it("says nothing when no promise was made", () => {
    const { model } = loadPortalPastDue();
    expect(model.portalPromiseNote({ status: "working", promisedDate: null })).toBe("");
  });

  it("fills the promise inputs from the case", () => {
    const { model } = loadPortalPastDue();
    const html = model.portalPromiseBlock({
      status: "promised",
      promisedAmount: 250.5,
      promisedDate: new Date("2026-08-12T12:00:00").getTime(),
    });
    expect(html).toContain('value="2026-08-12"');
    expect(html).toContain('value="250.5"');
  });
});

describe("portal collections queue — escalation", () => {
  it("asks why, names who it goes to, and sends the reason", async () => {
    const { model, calls } = loadPortalPastDue({ prompt: () => "  Ignored two calls  " });
    model.seed([account({ case: { status: "working" } })], { id: "u2", name: "Dana Whitfield" });
    await expect(model.portalSetPastDueStage("acct-1", "escalated")).resolves.toBe(true);
    expect(calls).toEqual([
      {
        method: "PUT",
        path: "/financials/accounts/acct-1/status",
        body: { status: "escalated", reason: "Ignored two calls" },
      },
    ]);
  });

  it("names the escalation owner in the confirmation", async () => {
    const { model, prompts } = loadPortalPastDue();
    model.seed([account()], { id: "u2", name: "Dana Whitfield" });
    await model.portalSetPastDueStage("acct-1", "escalated");
    expect(prompts[0]).toContain("Dana Whitfield");
  });

  it("treats a dismissed prompt as cancel and sends nothing", async () => {
    const { model, calls } = loadPortalPastDue({ prompt: () => null });
    model.seed([account()], { id: "u2", name: "Dana Whitfield" });
    await expect(model.portalSetPastDueStage("acct-1", "escalated")).resolves.toBe(false);
    expect(calls).toEqual([]);
  });

  it("sends no reason when the collector writes none", async () => {
    const { model, calls } = loadPortalPastDue({ prompt: () => "   " });
    model.seed([account()], null);
    await model.portalSetPastDueStage("acct-1", "escalated");
    expect(calls[0]?.body).toEqual({ status: "escalated", reason: null });
  });

  it("does not re-ask on an account already escalated", async () => {
    const { model, calls, prompts } = loadPortalPastDue();
    model.seed([account({ case: { status: "escalated" } })], { id: "u2", name: "Dana Whitfield" });
    await model.portalSetPastDueStage("acct-1", "escalated");
    expect(prompts).toEqual([]);
    expect(calls[0]?.body).toEqual({ status: "escalated" });
  });

  it("moves an ordinary stage without asking anything", async () => {
    const { model, calls, prompts, alerts } = loadPortalPastDue();
    model.seed([account()], null);
    await expect(model.portalSetPastDueStage("acct-1", "promised")).resolves.toBe(true);
    expect(prompts).toEqual([]);
    expect(alerts).toEqual([]);
    expect(calls[0]?.body).toEqual({ status: "promised" });
  });

  it("says where the account landed, and warns when nobody was emailed", async () => {
    const { model, alerts } = loadPortalPastDue({
      apiResult: {
        case: { status: "escalated" },
        escalation: {
          owner: { id: "u2", name: "Dana Whitfield" },
          notified: false,
          action: { label: "Final Letter" },
        },
      },
    });
    model.seed([account()], { id: "u2", name: "Dana Whitfield" });
    await model.portalSetPastDueStage("acct-1", "escalated");
    expect(alerts[0]).toContain("Escalated to Dana Whitfield");
    expect(alerts[0]).toContain("final letter");
    expect(alerts[0]).toContain("not emailed");
  });

  it("reports a failed move and keeps the queue's answer honest", async () => {
    const { model, alerts } = loadPortalPastDue({
      api: async () => ({ ok: false, status: 403, data: { error: "Not your account." } }),
    });
    model.seed([account()], null);
    await expect(model.portalSetPastDueStage("acct-1", "escalated")).resolves.toBe(false);
    expect(alerts[0]).toBe("Not your account.");
  });

  it("shows who escalated an account instead of the escalate button", () => {
    const { model } = loadPortalPastDue();
    model.seed([], { id: "u2", name: "Dana Whitfield" });
    const gone = model.portalEscalationBlock({
      status: "escalated",
      escalatedByName: "Casey Ruiz",
      escalatedAt: new Date("2026-08-20T12:00:00").getTime(),
      escalatedReason: "Ignored two calls",
      assignedToName: "Dana Whitfield",
      promisedDate: null,
    });
    expect(gone).toContain("Casey Ruiz escalated this");
    expect(gone).toContain("Ignored two calls");
    expect(gone).not.toContain("data-pd-escalate");

    const open = model.portalEscalationBlock({ status: "working" });
    expect(open).toContain("data-pd-escalate");
    expect(open).toContain("Dana Whitfield");
  });
});

describe("portal collections queue — card and history", () => {
  it("flags a broken promise and a handoff on the card itself", () => {
    const { model } = loadPortalPastDue();
    const card = model.portalPastDueCard(
      account({ promiseBroken: true, case: { status: "promised", promisedDate: 1 } }),
      STATUSES,
    );
    expect(card).toContain("Promise broken");

    const escalated = model.portalPastDueCard(account({ case: { status: "escalated" } }), STATUSES);
    expect(escalated).toContain("Escalated");
  });

  it("leaves a quiet account unflagged", () => {
    const { model } = loadPortalPastDue();
    const card = model.portalPastDueCard(account(), STATUSES);
    expect(card).not.toContain("Promise broken");
    expect(card).not.toContain("⚑ Escalated");
  });

  it("labels a history line by what kind of thing happened", () => {
    const { model } = loadPortalPastDue();
    const row = model.portalTimelineRow({
      kind: "escalation",
      at: new Date("2026-08-20T12:00:00").getTime(),
      summary: "Escalated to Dana Whitfield",
      detail: "Ignored two calls",
      actorName: "Casey Ruiz",
    });
    expect(row).toContain("is-escalation");
    expect(row).toContain("Escalation ·");
    expect(row).toContain("Casey Ruiz");
    expect(row).toContain("Ignored two calls");
  });
});
