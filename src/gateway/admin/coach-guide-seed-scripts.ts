// The Sales Scripts & Client Management Guide, as it read on the day it moved
// into the Hub.
//
// Imported once from the Google Doc the sales team wrote ("Sales Scripts &
// Client Management Guide", synced 2026-06-24). Same arrangement as
// coach-guide-seed-products.ts: a starting state, replaced by whatever the Hub
// holds the moment anyone edits it.
//
// One section per step of a call, headed with the segment it belongs to and,
// where the guide names one, the call flow — a first-order expectations call
// and a first-order delivery call are different conversations that happen to
// share step numbers, and a heading that dropped the flow would collapse them.

import type { GuideSectionSeed } from "./coach-guide-seed.js";

export const SALES_SCRIPT_SECTIONS: GuideSectionSeed[] = [
  {
    heading: "Leads — Introduction & Permission",
    group: "Leads",
    bodyMd: `- Purpose: Respect their time and lower resistance.
- Script:
  - “Hey, this is Chris with Wow Video Tours — I just wanted to reach out and introduce myself. Did I catch you at a good time?”
    - If NO:
      - “No worries at all — when would be a better time to reach out?”
    - If YES:
      - “Perfect, I’ll be quick.”
- Talking Point:
  - You’re setting a collaborative tone. Even though it risks a “no,” it builds trust and keeps the call human.`,
  },
  {
    heading: "Leads — Discovery: Who They Currently Use",
    group: "Leads",
    bodyMd: `- Purpose: Understand loyalty, flexibility, or dissatisfaction.
- Script:
  - “Do you mind me asking who you typically use for your real estate media?”`,
  },
  {
    heading: "Leads — Branch Based on Their Answer",
    group: "Leads",
    bodyMd: `**If They Use Multiple Photographers**

- Signal: No strong loyalty — opportunity.
- Script:
  - “Got it — do you mind me asking if there’s a reason you use multiple photographers?”
- Listen for:
  - Availability issues
  - Inconsistent quality
  - Turnaround time
  - Pricing
  - Service gaps (video, drone, floor plans, etc.)
- Talking Point:
  - This tells you what problem to solve, not just how to sell.

**If They Use One Specific Photographer**

- Follow-up Question:
  - “How’s that experience been for you?”`,
  },
  {
    heading: "Leads — Handle Their Satisfaction Level",
    group: "Leads",
    bodyMd: `**If They’re Happy**

- Goal: Don’t compete head-on — position as backup.
- Script:
  - “That’s great to hear — relationships matter a lot to us too, so I definitely don’t want to step on any toes.
What I’d love to do is send you some info so we can be a backup option — for things like vacations, last-minute needs, or services they might not offer.
I can follow up in a few days to see if you have any questions.”
- Talking Points:
  - You respect existing relationships
  - You remove risk by being a safety net
  - You stay top-of-mind without pressure

**If They’re Unhappy or Hesitant**

  - Goal: Diagnose and position yourself as the solution.
  - Script:
  - “I appreciate you sharing that — do you mind if I ask what hasn’t been working as well as you’d like?”
  - After they answer:
  - “That actually makes a lot of sense — that’s something we focus heavily on.”
  - Transition to Close:
  - “Do you have anything coming up that we could help with and show you how we’re different?”
  - Talking Points:
  - Listen more than you talk
  - Mirror their pain points
  - Offer proof through action, not promises`,
  },
  {
    heading: "Leads — Soft Close Options",
    group: "Leads",
    bodyMd: `- Use one depending on momentum:
  - Trial Close:
  - “Would it make sense to try us on one upcoming listing?”
  - Info + Follow-Up:
  - “I’ll send over some info and examples — does it make sense to reconnect later this week?”`,
  },
  {
    heading: "New Clients — First Order Expectations Call: Introduction & Context",
    group: "New Clients",
    bodyMd: `- Purpose: Reinforce trust and confirm you’re personally involved.
  - Script:
  - “Hey [Name], this is Chris with Wow Video Tours. I saw your first order come through and I just wanted to personally reach out to welcome you and make sure everything is set up perfectly.”
  - Talking Point:
  - This immediately signals white-glove service and differentiates you from automated media companies.`,
  },
  {
    heading: "New Clients — First Order Expectations Call: Confirm the Order",
    group: "New Clients",
    bodyMd: `- Purpose: Set clear expectations and avoid mistakes.
  - Script:
  - “I just want to quickly confirm what we have scheduled so there are no surprises.”
  - Talking Point:
  - Brief overview of property, date/time, services ordered, etc.`,
  },
  {
    heading: "New Clients — First Order Expectations Call: Value Check + Light Upsell",
    group: "New Clients",
    bodyMd: `- Purpose: Ensure the order has everything it needs — no more, no less.
  - Script:
  - “Based on how you plan to market this listing, does this cover everything you need — or are you planning to do anything like agent-on-camera or drone?”
  - If Opportunity Exists:
  - “A lot of our clients find that adding [X] helps them get more traction early — totally optional, just wanted to make sure you were aware.”
  - Talking Points:
  - Position upsells as helpful guidance, not pressure
  - Protect them from under-marketing
  - Build credibility as an advisor`,
  },
  {
    heading:
      "New Clients — First Order Expectations Call: Set Expectations for Appointment Day & Delivery",
    group: "New Clients",
    bodyMd: `- Purpose: Reduce anxiety and create professionalism.
    - Script:
    - “Here’s what to expect on shoot day — our photographer will arrive on time, walk the property with you if needed, and handle everything from there.”
    - “After the shoot, your media will be delivered by [timeframe], you’ll receive an email with access to everything, including the single-property website and download options.”
    - “Invoicing will be handled [explain process briefly], and if anything looks off, just let me know — we stand behind our work.”`,
  },
  {
    heading: "New Clients — First Order Expectations Call: Close the Loop Before the Shoot",
    group: "New Clients",
    bodyMd: `- Purpose: Reinforce partnership and next touchpoint.
    - Script:
    - “Once everything is delivered, I’ll personally check back in to make sure it all looks great and answer any questions.”`,
  },
  {
    heading: "New Clients — First Order Delivery Call: Check the Experience",
    group: "New Clients",
    bodyMd: `- Purpose: Validate quality and catch issues early.
    - Script:
    - “Hey [Name], I just wanted to check in and see how everything went with your first appointment.”`,
  },
  {
    heading: "New Clients — First Order Delivery Call: Review the Media",
    group: "New Clients",
    bodyMd: `- Purpose: Invite feedback and reinforce value.
    - Script:
    - “I saw the media was delivered — how does everything look?”
    - Talking Point:
    - Pause here. Let them talk. Positive feedback strengthens loyalty; concerns create trust when handled well.`,
  },
  {
    heading: "New Clients — First Order Delivery Call: System & Usage Support",
    group: "New Clients",
    bodyMd: `- Purpose: Add value beyond media.
    - Script:
    - “Do you have any questions on how to use the system — accessing your media, the single-property website, sharing links, or anything like that?”
    - Talking Point:
    - Most companies skip this. This is where you win repeat business.`,
  },
  {
    heading: "New Clients — First Order Delivery Call: Support Their Listing",
    group: "New Clients",
    bodyMd: `- Purpose: Show you care about outcomes, not just delivery.
    - Script:
    - “Best of luck with the listing — and if there’s anything we can do to support you further, just let me know.”`,
  },
  {
    heading: "New Clients — First Order Delivery Call: Identify Next Opportunity",
    group: "New Clients",
    bodyMd: `- Purpose: Naturally open the door to future work.
    - Script Options (choose one):
    - Soft:
    - “Do you have anything else coming up soon that we might be able to help with?”
    - Assumptive:
    - “What’s the next listing you’ve got coming up?”
    - Supportive:
    - “When your next listing comes up, I’d love to help make that one just as smooth.”
    - Talking Point:
    - You’re planting the expectation that this was the first of many.`,
  },
  {
    heading: "Current Clients — Opening the Check-In (Making It Not Awkward)",
    group: "Current Clients",
    bodyMd: `**Option A: You Have Something to Share**

    - Purpose: Add relevance and a reason for the touchpoint.
    - Script:
    - “Hey [Name], this is Chris with Wow Video Tours. I saw [article / local event / market update] and it made me think of you — I wanted to quickly share it and see what you thought.”
    - Talking Point:
    - This reframes the call as value-first, not “just checking in.”

**Option B: Genuine Business Check-In**

    - Purpose: Relationship reinforcement.
    - Script:
    - “Hey [Name], I just wanted to check in and see how things are going on your end business-wise.”
    - Talking Point:
This works best when said calmly and confidently — no apology, no pitch.`,
  },
  {
    heading: "Current Clients — Shift the Focus to Their Business",
    group: "Current Clients",
    bodyMd: `- Purpose: Show appreciation and partnership.
      - Script:
      - “How’s the market been feeling for you lately?”
      - “What’s been keeping you busy right now?”
      - Talking Point:
      - Let them talk. Your role here is listener, not seller.`,
  },
  {
    heading: "Current Clients — Identify Opportunities to Help",
    group: "Current Clients",
    bodyMd: `- Purpose: Increase frequency without forcing it.
      - Script:
      - “Is there anything coming up that we could help support — or anything you wish you had more help with right now?”
      - Talking Point:
      - This invites opportunities without pushing specific services.`,
  },
  {
    heading: "Current Clients — Handling the “I’m Quiet Right Now” Objection",
    group: "Current Clients",
    bodyMd: `- Client Says:
      - “I’m a little quiet right now — how are things going for you guys?”
      - Balanced, Empathetic Response
      - Script:
      - “Totally understand — a lot of people seem to be in that same spot right now. We’ve been a little slower too, but it sounds like most folks are gearing up for the next few weeks.”
      - Why This Works:
      - You relate, not brag
      - You don’t minimize their situation
      - You introduce gentle optimism`,
  },
  {
    heading: "Current Clients — Staying Relevant During Slow Periods",
    group: "Current Clients",
    bodyMd: `- Purpose: Remain visible without pressure.
      - Script:
      - “If anything pops up — even last minute — feel free to reach out. We’re always happy to help when things start moving again.”
      - Talking Point:
      - You’re positioning yourself as available and supportive, not desperate.`,
  },
  {
    heading: "Current Clients — Appreciation & Relationship Reinforcement",
    group: "Current Clients",
    bodyMd: `- Purpose: Make them feel valued, not taken for granted.
      - Script:
      - “By the way, I really appreciate you continuing to work with us — it means a lot.”
      - Talking Point:
      - Simple appreciation goes a long way with current clients.`,
  },
  {
    heading: "Current Clients — Soft Close / Future Anchor",
    group: "Current Clients",
    bodyMd: `- Purpose: Keep the door open for increased frequency.
      - Script Options:
      - Soft:
      - “Let’s definitely stay in touch — I’ll check back in soon.”
      - Forward-Looking:
      - “When things pick up again, we’ll be ready to help however you need.”
      - Assumptive:
      - “What do you think your next listing might look like?”`,
  },
  {
    heading: "VIP Clients — Proactive Outreach (Not Service-Triggered)",
    group: "VIP Clients",
    bodyMd: `**Opening (General VIP Check-In)**

      - Purpose: Make it clear this is intentional, not transactional.
      - Script:
      - “Hey [Name], this is Chris with Wow Video Tours. Nothing urgent — I just wanted to reach out and check in with you.”
      - Talking Point:
      - The phrase “nothing urgent” lowers guard and signals confidence.`,
  },
  {
    heading: "VIP Clients — Tailor Based on Order History",
    group: "VIP Clients",
    bodyMd: `**If Order History Is Consistent**

      - Purpose: Reinforce appreciation and partnership.
      - Script:
      - “I was looking through your recent orders and it looks like you’re still killing it. I just wanted to touch base, see how everything’s going on your end, and check if there’s anything I can do to support you better.”
      - Talking Points:
      - You notice their success
      - You value their business
      - You’re offering help, not pitching

**If Order History Is Sporadic or Scarce**

      - Purpose: Open dialogue without accusation.
      - Script:
      - “I noticed it’s been a little while since we last worked together, so I just wanted to check in and make sure everything’s OK.”
      - How They’ll Interpret It (Both Are Wins):
      - If business is slow → they’ll talk about pain points
      - If business is good → they’ll reassure the relationship
      - Either way, you get insight.`,
  },
  {
    heading: "VIP Clients — Listening for What’s Not Being Said",
    group: "VIP Clients",
    bodyMd: `- Purpose: Identify retention risks or opportunities.
      - Follow-Ups (Use Sparingly):
      - “What’s been the biggest challenge lately?”
      - “What’s been working really well for you right now?”
      - “Anything you wish vendors did better?”
      - Talking Point:
      - VIPs don’t want scripts — they want presence.`,
  },
  {
    heading: "VIP Clients — Making Them Feel Special (Without Always Discounting)",
    group: "VIP Clients",
    bodyMd: `**Option A: Priority Positioning**

      - Script:
      - “Just so you know, you’re always a priority for us — if something comes up last minute or you need flexibility, we’ll do everything we can to make it work.”

**Option B: Quiet Value Add**

      - Script:
      - “We’ve been doing [new service / workflow improvement], and you were one of the first people I wanted to make sure knew about it.”

**Option C: Occasional Perk (Use Strategically)**

      - Script:
      - “On your next one, let me take care of [small add-on]. Consider it a thank-you.”
      - Talking Point:
      - Surprise > advertised discounts.`,
  },
  {
    heading: "VIP Clients — Referral Conversations (Natural, Not Cringey)",
    group: "VIP Clients",
    bodyMd: `**Soft Referral Seed**

      - Purpose: Plant the idea without pressure.
      - Script:
      - “A lot of our growth comes from people like you, and I really appreciate the trust you put in us.”
      - (Stop talking. Let that land.)

**Natural Follow-Up (If the Moment Feels Right)**

      - Script:
      - “If you ever hear someone mention they’re unhappy with their media — feel free to send them our way. We’ll take great care of them.”
      - Talking Point:
      - You’re not asking for favors — you’re protecting your reputation.`,
  },
  {
    heading: "VIP Clients — Monitoring & Ongoing Touchpoints (Not Always Calls)",
    group: "VIP Clients",
    bodyMd: `- Purpose: Stay visible without being intrusive.
      - Examples:
      - Quick text after a big listing
      - Congratulating a sale or milestone
      - Sharing a relevant market or local item
      - Handwritten note once or twice a year
      - Talking Point:
      - VIP relationships are maintained, not “worked.”`,
  },
  {
    heading: "VIP Clients — Closing the Touchpoint",
    group: "VIP Clients",
    bodyMd: `- Purpose: Confidence + continuity.
      - Script:
      - “I just wanted to check in and make sure you know how much we appreciate you. Let’s definitely stay in touch — and if there’s ever anything you need, just reach out.”`,
  },
  {
    heading: "Past Clients — Simple, Honest Opening",
    group: "Past Clients",
    bodyMd: `- Purpose: Disarm defensiveness immediately.
      - Script:
      - “Hey [Name], this is Chris with Wow Video Tours. I know it’s been a little while since we last worked together, so I just wanted to reach out and check in — is everything OK?”
      - Why This Works:
      - No accusation
      - No pitch
      - Lets them frame the story`,
  },
  {
    heading: "Past Clients — Let Them Interpret It Their Way (Both Outcomes Win)",
    group: "Past Clients",
    bodyMd: `- If Business Is Slow…
      - They’ll start talking about:
      - Market conditions
      - Fewer listings
      - Personal stress or burnout
      - Your Response:
      - “That makes total sense — a lot of people are feeling that right now.”
      - Talking Point:
      - You’re validating, not fixing.
      - If Business Is Good…
      - They may hear it as:
      - “Is everything OK with us?”
      - Your Response:
      - “I just wanted to make sure we’re still in a good spot and see how things have been going for you.”
      - Talking Point:
      - This reassures the relationship without forcing change.`,
  },
  {
    heading: "Past Clients — Gentle Re-Engagement (Low Pressure)",
    group: "Past Clients",
    bodyMd: `- Purpose: Open the door without asking them to walk through it.
      - Script:
      - “If anything comes up — even last minute — we’d be happy to help. I just wanted you to know we’re still here.”
      - Talking Point:
      - You’re positioning availability, not urgency.`,
  },
  {
    heading: "Past Clients — Handling the Objection: “We’re Using Someone Else Now”",
    group: "Past Clients",
    bodyMd: `- Client Says:
      - “We’re using someone else right now.”
      - Calm, Non-Defensive Response
      - Script:
      - “Totally understand — I really appreciate you letting me know.”

**(Pause)**

“Out of curiosity, was there anything we could have done better when we worked together?”
      - Why This Works:
      - You’re not challenging their decision
      - You’re asking for feedback, not business
      - Most people will open up
      - If They Give Feedback
      - Your Response:
      - “I appreciate you sharing that — that’s really helpful.”

**(No defending. No justifying.)**

      - Soft Re-Entry Line (Optional)
      - Script:
      - “If you ever need a backup or something changes, we’d love the opportunity to work with you again.”`,
  },
  {
    heading: "Past Clients — If the Door Cracks Open",
    group: "Past Clients",
    bodyMd: `- Purpose: Offer a risk-free next step.
      - Script Options:
      - “Do you have anything coming up that might need media?”
      - “Would it make sense to try us again on one and see how it goes?”
      - Talking Point:
      - One listing is a low-risk test, not a commitment.`,
  },
  {
    heading: "Past Clients — Closing the Call (Regardless of Outcome)",
    group: "Past Clients",
    bodyMd: `- Purpose: Leave goodwill behind.
      - Script:
      - “I really appreciate you taking a minute to chat — I just wanted to check in and wish you the best. Don’t hesitate to reach out if we can ever help.”`,
  },
];
