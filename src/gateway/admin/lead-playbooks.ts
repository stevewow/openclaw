// How to work a lead, by what the lead came in on.
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

/** Which of the site's lead magnets a submission came in on. */
export type LeadPlaybookKey = "getting_ready_guide" | "pricing_list" | "listing_presentation";

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
  key: LeadPlaybookKey;
  label: string;
  /** What the download tells you about where they are. */
  signal: string;
  /** Opening script. `[Name]` is filled in with their first name where we have one. */
  opener: string;
  /** What to say once they engage — never in the opener. */
  softClose: string;
  steps: CadenceStep[];
};

const PLAYBOOKS: LeadPlaybook[] = [
  {
    key: "getting_ready_guide",
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
export const ATTEMPTS_BEFORE_STANDARD = 3;

/**
 * Where a lead goes once its playbook is spent.
 *
 * Three attempts inside a fortnight and no answer means the timing was wrong,
 * not that the lead was. So it backs all the way off to a quarterly check-in
 * that alternates channel, and repeats rather than ending — nobody decides a
 * lead is dead, they either engage or get dispositioned in the CRM.
 */
export const STANDARD_CADENCE = {
  label: "Standard follow-up",
  detail:
    "a quarterly check-in until they engage or you close them out, alternating a call and an email so it never lands the same way twice",
} as const;

export function listPlaybooks(): LeadPlaybook[] {
  return PLAYBOOKS;
}

export function getPlaybook(key: string | null | undefined): LeadPlaybook | null {
  return PLAYBOOKS.find((p) => p.key === key) ?? null;
}

/**
 * Words that identify a playbook when they turn up in what the form sent.
 *
 * The three magnets are three separate forms, so the form's own name is the
 * answer nearly every time. The rest is insurance: a form renamed on the site,
 * or one whose name never reaches us, should still route by its landing page or
 * by an answer naming the thing that was downloaded, rather than silently
 * dropping the playbook out of the email.
 */
const MATCH_TERMS: Array<{ key: LeadPlaybookKey; terms: string[] }> = [
  {
    key: "getting_ready_guide",
    terms: ["getting ready", "get ready", "prep guide", "seller prep", "readyguide"],
  },
  { key: "pricing_list", terms: ["pricing", "price list", "pricelist", "packages", "rate card"] },
  {
    key: "listing_presentation",
    terms: ["listing presentation", "listing template", "presentation template", "pre listing"],
  },
];

function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Work out which playbook a submission belongs to.
 *
 * Sources are searched in order of how much they mean: the form's name is a
 * deliberate label, a page URL is nearly as good, and a free-text answer is a
 * guess. A submission matching two playbooks resolves to none — an opener aimed
 * at the wrong signal is worse than no opener, because the owner reads it as
 * what we know about this person.
 */
export function matchPlaybook(input: {
  formName?: string | null;
  pageUrl?: string | null;
  fields?: Array<{ label: string; value: string }>;
}): LeadPlaybook | null {
  const haystacks = [
    input.formName ?? "",
    input.pageUrl ?? "",
    (input.fields ?? []).map((f) => `${f.label} ${f.value}`).join(" "),
  ].map(fold);

  for (const haystack of haystacks) {
    if (!haystack) {
      continue;
    }
    const hits = MATCH_TERMS.filter((m) => m.terms.some((t) => haystack.includes(fold(t))));
    if (hits.length === 1) {
      return getPlaybook(hits[0].key);
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
