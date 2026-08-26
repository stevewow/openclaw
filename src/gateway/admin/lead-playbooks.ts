// How to work a lead, by what the lead came in on — the copy the Hub starts with.
//
// These three are the seed. Once an install has run, the editable table in
// `lead-playbooks-store.ts` is what the email is built from, and this file is
// only read again if that table is empty. Keeping the originals here means a
// fresh install behaves like the one that shipped, and the matching rules stay
// beside the wording they were written for.
//
// Written by the person who makes these calls, kept as data here — the same
// arrangement `past-due-policy.ts` uses for the collections process, and for the
// same reason: the wording and the timing are the business's, not the code's, so
// they live in one readable place rather than being spelled out again in every
// surface that shows them.
//
// The three playbooks are three different reads of urgency. Someone downloading
// the getting-ready guide has a shoot in days and is called within the hour;
// someone building a listing presentation is weeks out and a phone call would be
// disproportionate to the signal, so that one opens with an email. Nothing here
// tracks anything: attempts and disposition live in the CRM. This is the note
// the territory owner gets when the lead lands, and no more.

export type CadenceChannel = "call" | "email" | "call_or_email";

export type CadenceStep = {
  /** 1-based position. Shown, so the order reads. */
  step: number;
  /** How the sequence names this moment: "Within 1 hour", "Day 4", "Week 2". */
  when: string;
  channel: CadenceChannel;
  action: string;
};

export type LeadPlaybook = {
  /** Stable forever: leads are filed under it, and a rename must not re-file them. */
  key: string;
  label: string;
  /** What the download tells you about where they are. */
  signal: string;
  /** Opening script. `[Name]` is filled in with their first name where we have one. */
  opener: string;
  /** What to say once they engage — never in the opener. */
  softClose: string;
  /** Words that identify this source in a submission. Editable, so a form can be renamed. */
  matchTerms: string[];
  steps: CadenceStep[];
  active: boolean;
  sortOrder: number;
};

export function isCadenceChannel(value: unknown): value is CadenceChannel {
  return value === "call" || value === "email" || value === "call_or_email";
}

const SEED: LeadPlaybook[] = [
  {
    key: "getting_ready_guide",
    active: true,
    sortOrder: 0,
    matchTerms: ["getting ready", "get ready", "prep guide", "seller prep"],
    label: "Getting Ready Guide",
    signal: "Listing imminent — days, not weeks.",
    opener:
      "Hey [Name], Taylor with WOW Video Tours. Looks like you've got a listing coming up — I just wanted to check in and see if you had any questions about prepping the seller before shoot day. That's usually the part that decides whether the photos come out great or just okay, so happy to be a resource if anything comes up.",
    softClose:
      "When are you looking to shoot it? If you're still figuring that out, I can tell you what our availability looks like — no pressure either way, but I'd rather you know than find out you're stuck.",
    steps: [
      {
        step: 1,
        when: "Within 1 hour",
        channel: "call",
        action: "Call. Voicemail + short text if no answer.",
      },
      {
        step: 2,
        when: "Day 2",
        channel: "call",
        action: "Call, different time of day.",
      },
      {
        step: 3,
        when: "Day 4",
        channel: "email",
        action: `Email — the opener in writing, plus "I'm here for the next one either way."`,
      },
    ],
  },
  {
    key: "pricing_list",
    active: true,
    sortOrder: 1,
    matchTerms: ["pricing", "price list", "packages", "rate card"],
    label: "Pricing List",
    signal: "Comparing vendors right now — possibly booking this week.",
    opener:
      "Hey [Name], Taylor with WOW Video Tours. Looks like you're pricing out media for something — I wanted to reach out in case you had questions, because the thing that trips people up when they're comparing is that what's included varies a lot between companies. Happy to walk through what's what, even if it's not us you end up going with.",
    softClose:
      "What's the property? If you tell me a bit about it, I can tell you which package actually makes sense — sometimes the bigger one is the better deal and sometimes it's overkill for what you've got.",
    steps: [
      {
        step: 1,
        when: "Within 24 hours",
        channel: "call",
        action: "Call. Voicemail + text if no answer.",
      },
      {
        step: 2,
        when: "Day 3",
        channel: "email",
        action: `Email — the "what's included" angle: property website, hosting, licensing.`,
      },
      {
        step: 3,
        when: "Day 7",
        channel: "call",
        action: `Call. "Did you get that shoot handled?"`,
      },
    ],
  },
  {
    key: "listing_presentation",
    active: true,
    sortOrder: 2,
    matchTerms: [
      "listing presentation",
      "listing template",
      "presentation template",
      "pre listing",
    ],
    label: "Listing Presentation Template",
    signal: "Working on winning listings. Weeks out, no order attached.",
    opener:
      "Hey [Name], Taylor with WOW Video Tours. Looks like you're building out your listing presentation — I just wanted to see if you had any questions I could help with ahead of it. We sit in on a lot of these indirectly, so I've got a decent sense of what lands with sellers and what doesn't.",
    softClose:
      "One thing worth knowing — every listing we shoot comes with its own property website. It makes for a strong page, because you can pull it up live at the table and the seller immediately gets that their house has a website. Want me to send you a live one you can drop into the document as an example?",
    steps: [
      {
        step: 1,
        when: "Within 48 hours",
        channel: "email",
        action: "Email. A call is disproportionate to this signal.",
      },
      {
        step: 2,
        when: "Day 5",
        channel: "call",
        action: "Call, referencing the email.",
      },
      {
        step: 3,
        when: "Week 2",
        channel: "call_or_email",
        action: `Call or email: "How'd the presentation go?" — the best question in this sequence.`,
      },
    ],
  },
];

/** How many attempts a playbook is worth before the standard follow-up takes over. */
export const DEFAULT_ATTEMPTS_BEFORE_STANDARD = 3;

/**
 * Where a lead goes once its playbook is spent.
 *
 * Three attempts inside a fortnight and no answer means the timing was wrong,
 * not that the lead was. So it backs all the way off to a quarterly check-in
 * that alternates channel, and repeats rather than ending — nobody decides a
 * lead is dead, they either engage or get dispositioned in the CRM.
 */
export const DEFAULT_STANDARD_FOLLOW_UP =
  "a quarterly check-in until they engage or you close them out, alternating a call and an email so it never lands the same way twice";

/** The copy a fresh install starts with. Copied into the table once, then owned by it. */
export function seedPlaybooks(): LeadPlaybook[] {
  return SEED;
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Work out which playbook a submission belongs to.
 *
 * The candidates are passed in rather than looked up here, so this stays pure
 * and the caller decides whether it is matching against the live table or a
 * fixture. Sources are searched in order of how much they mean: the form's own
 * name is a deliberate label, a page URL is nearly as good, and a free-text
 * answer — the "Source" field the site's forms carry — is where most of them
 * actually land. A submission matching two playbooks resolves to none: an
 * opener aimed at the wrong signal is worse than no opener, because the owner
 * reads it as what we know about this person.
 *
 * A playbook's label counts as one of its own terms, so a source added in the
 * Hub matches the wording it was named with before anybody adds a single term.
 */
export function matchPlaybook(
  playbooks: readonly LeadPlaybook[],
  input: {
    formName?: string | null;
    pageUrl?: string | null;
    fields?: Array<{ label: string; value: string }>;
  },
): LeadPlaybook | null {
  const candidates = playbooks.filter((p) => p.active);
  const haystacks = [
    input.formName ?? "",
    input.pageUrl ?? "",
    (input.fields ?? []).map((f) => `${f.label} ${f.value}`).join(" "),
  ].map(fold);

  for (const haystack of haystacks) {
    if (!haystack) {
      continue;
    }
    const hits = candidates.filter((p) =>
      [p.label, ...p.matchTerms].some((term) => {
        const folded = fold(term);
        return folded.length > 0 && haystack.includes(folded);
      }),
    );
    if (hits.length === 1) {
      return hits[0];
    }
    if (hits.length > 1) {
      return null;
    }
  }
  return null;
}

/** Their first name, for the opener. Empty when we only have a company or an address. */
export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** The opener with `[Name]` filled in, or left as written when we have no name. */
export function personalizeOpener(opener: string, name: string | null | undefined): string {
  const first = firstName(name);
  return first ? opener.replace("[Name]", first) : opener;
}
