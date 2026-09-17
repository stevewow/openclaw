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
