# Hub UI

The WOW Hub's two signed-in surfaces: the admin SPA (`admin-ui-html.ts`) and
the user portal (`user-portal-html.ts`). Both are standalone template literals —
markup, CSS and inline JS — assembled from the `*-ui.ts` components beside them.
A change is not done until both surfaces have it.

## Describers

A page or a card that has to explain itself does it behind an "i", not in a
paragraph over the numbers.

- Use `infoTip(body, { label })` from `info-tip.ts` beside the heading, or
  `infoTipSlot(id, { label })` when the view writes the text at runtime.
- Do not add a new block of prose above a table, a chart or a form. Screen space
  is the scarce thing; the describer is read once and then costs a band of it on
  every visit after.
- What stays on the page: warnings, errors, "still loading" notes — anything a
  reader has to act on, or that makes a number on screen wrong. A describer is
  for questions, never for alerts.
- One-line hints under a form field stay put. They are read while typing, and
  hiding them would cost a click mid-task.
- The body is trusted markup written here, not user input. Split it into `<p>`
  elements rather than one wall of text.

## Business wording

What the team says to clients — product pricing, positioning, objection
responses, call scripts, collections wording, outreach notes — is data, not
code. It changes far more often than the code around it, and the people who own
it do not deploy.

- New wording goes in a store with a seed module beside it: `coach-guide-seed.ts`
  → `admin_guide_sections`, the way `lead-playbooks.ts` and `past-due-policy.ts`
  already work. The seed is read once, on an install whose table is empty.
- The Hub copy is authoritative the moment it exists. Do not add a second place
  the same sentence lives, and do not re-sync over an edit.
- The sales coach (`coach-answer.ts`) answers out of the guide store and nothing
  else. It must never be given a price, a discount or a policy that is not in
  the guide — a wrong answer here is repeated to a client out loud.
