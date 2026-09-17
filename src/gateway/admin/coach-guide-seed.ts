// What the Hub's guide holds before anyone has edited it.
//
// The two documents the client-facing team worked from — the Sales & Service
// Product Guide and the Sales Scripts & Client Management Guide — lived in
// Google Docs. They still read well; the problem was that nobody has a Doc open
// during a call. So the wording moves here, the Hub becomes the copy that
// counts, and the coach answers out of it.
//
// Same arrangement as `lead-playbooks.ts` and `past-due-policy.ts`, for the
// same reason: the words are the business's, not the code's, so they live in
// one readable place and are editable in the Hub afterwards. This file is read
// exactly once — on an install whose guide table is empty. After that an edit
// in the Hub is the truth and this is only history.

import { PRODUCT_GUIDE_SECTIONS } from "./coach-guide-seed-products.js";
import { SALES_SCRIPT_SECTIONS } from "./coach-guide-seed-scripts.js";

export type GuideSectionSeed = {
  /** What the section is called, and what the coach cites. */
  heading: string;
  /**
   * The band it sits in — "Bundles", "VIP Clients". Free text rather than an
   * enum: the guide's own grouping is editorial and will be re-cut by whoever
   * owns the wording, which is not a schema change.
   */
  group: string;
  /** Markdown. Tables carry the pricing, so the editor must keep them. */
  bodyMd: string;
};

export type GuideDocSeed = {
  /** Stable forever — sections are filed under it and the coach cites it. */
  slug: string;
  title: string;
  summary: string;
  sections: GuideSectionSeed[];
};

export const GUIDE_SEED: GuideDocSeed[] = [
  {
    slug: "product-guide",
    title: "Product Guide",
    summary:
      "Every service and bundle we sell: what it is, what it costs, how to position it, when to recommend it, and what to say to the objections it draws. Prices are standard rates — brokerage partner discounts come from leadership.",
    sections: PRODUCT_GUIDE_SECTIONS,
  },
  {
    slug: "sales-scripts",
    title: "Sales Scripts",
    summary:
      "How we talk to clients at each stage — a lead we have never spoken to, a client's first order, a quiet current client, a VIP, someone who left. Purpose, script and talking points for every step of the call.",
    sections: SALES_SCRIPT_SECTIONS,
  },
];
