// The Sales & Service Product Guide, as it read on the day it moved into the Hub.
//
// Imported once from the Google Doc the sales team wrote
// ("Sales & Service Product Guide", synced 2026-06-24) and not edited since:
// this file is the starting state, not the live copy. Once the Hub has seeded
// it, `admin_guide_sections` is what the Guide page renders and what the coach
// answers from, and an edit there is the one that counts. Nothing reads this
// file again unless the table is empty.
//
// One section per product, grouped the way the guide groups them — base
// services, add-ons, bundles — because that is the order a conversation goes
// in: pick the base, then the extras, and lead with a bundle.
//
// Prices are the standard rates. Brokerage partner discounts are deliberately
// absent: the guide says to check with leadership, and so does the coach.

import type { GuideSectionSeed } from "./coach-guide-seed.js";

export const PRODUCT_GUIDE_SECTIONS: GuideSectionSeed[] = [
  {
    heading: "HDR Photography",
    group: "Base / Standalone Services",
    bodyMd: `**DESCRIPTION**

Professional, high-quality HDR photography designed to fully capture the home—without limits on the number of images. We shoot what the property needs, not to a cap, ensuring every space is properly represented and the listing feels complete.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| 0 - 2,000 | $160 |
| 2,001 - 3,500 | $175 |
| 3,501 - 5,000 | $225 |
| 5,001 - 7,500 | $275 |
| 7,501+ | $325 |

**POSITIONING**

- Your first impression online—this is what determines whether buyers click or scroll
- A complete representation of the home, not a limited or rushed shoot
- Built for consistency across every listing, so your brand always looks professional

**WHEN TO RECOMMEND**

- Every listing (baseline service)
- Agents who want reliable, repeatable quality
- Listings where presentation matters (which is all of them)

**OBJECTIONS**

- “I already use someone else”
  - → “That’s great—how has that been going for you?”
  - → “Do they offer everything you need as far as video, aerial, and everything else?”
  - → “If anything ever changes, or you just need a backup, we’d love to be a resource for you.”
- “I can get cheaper photos”
  - → “You definitely can—what most agents find is consistency and quality matter more than saving $20–30.”
  - → “At the end of the day, this is your first impression online—it’s not where you want to cut corners.”`,
  },
  {
    heading: "Cinematic Walkthrough Video",
    group: "Base / Standalone Services",
    bodyMd: `**DESCRIPTION**

A smooth, professionally edited walkthrough video that highlights the flow, layout, and key features of the home. Designed to keep buyers engaged longer and give them a true sense of how the home feels—not just how it looks.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| 0 - 2,000 | $200 |
| 2,001 - 3,500 | $250 |
| 3,501 - 5,000 | $300 |
| 5,001 - 7,500 | $350 |
| 7,501+ | $450 |

**POSITIONING**

- The engagement driver—this is what keeps buyers interested after they click
- Helps buyers understand the flow of the home, not just individual rooms
- Positions the agent as more modern, professional, and competitive

**WHEN TO RECOMMEND**

- Every listing (especially when paired with photos)
- Competitive price ranges or markets
- Agents looking to stand out or win more listings

**OBJECTIONS**

- “I’ve sold homes fine without video”
  - → “Totally—this isn’t about what worked before, it’s about staying ahead of what buyers expect now.”
  - → “The agents growing the fastest are the ones leveling up their marketing.”
- “It’s too expensive to add”
  - → “That’s fair—most agents who include video see it as an investment in their brand, not just this one listing.”
  - → “It helps you win the next listing just as much as it helps sell this one.”`,
  },
  {
    heading: "Matterport 3D Tour + Floorplan",
    group: "Base / Standalone Services",
    bodyMd: `**DESCRIPTION**

An immersive, interactive 3D tour that allows buyers to virtually walk through the home at their own pace—combined with a floor plan for clear layout understanding. It gives buyers a true sense of space, flow, and scale before ever stepping inside.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| 0 - 2,000 | $199 |
| 2,001 - 3,500 | $299 |
| 3,501 - 5,000 | $399 |
| 5,001 - 7,500 | $549 |
| 7,501+ | Custom Quote |

**POSITIONING**

- The closest thing to an in-person showing
- A buyer qualification tool—filters out less serious showings
- Saves agents time by letting buyers explore before booking
- Adds a premium, high-tech feel to the listing

**WHEN TO RECOMMEND**

- Listings with out-of-town or relocating buyers
- Unique or hard-to-understand floor plans
- Agents who want to reduce unnecessary showings
- Higher-end listings where experience matters

**OBJECTIONS**

- “I already have photos and video”
  - → “It complements what you already have rather than replacing it.”
- “That feels like overkill”
  - → “It’s less about adding more, and more about making the process more efficient.”`,
  },
  {
    heading: "Exterior HDR Photography",
    group: "Base / Standalone Services",
    bodyMd: `**DESCRIPTION**

Targeted HDR photography of the front and rear exterior of the home, designed to refresh curb appeal without reshooting the full property. Perfect for updating listing visuals after changes, improvements, or seasonal shifts.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $50 |

**POSITIONING**

- The fastest, easiest way to refresh a listing
- Improves curb appeal and first impression online
- Keeps listings looking current and market-ready

**WHEN TO RECOMMEND**

- Landscaping, exterior upgrades, or repairs were completed
- Seasonal changes improved the look (snow → green grass, etc.)
- Listings that have been sitting and need a refresh

**OBJECTIONS**

- “It’s not worth updating just the outside”
  - → “The exterior is the first thing buyers see online—small improvements there can make a big difference in clicks.”
  - → “Even a refreshed front photo can change how the listing is perceived.”
- “I don’t need a full appointment again”
  - → “Exactly—that’s why this is helpful. It’s a quick update without the time or cost of a full shoot.”
  - → “We’re just improving the part buyers see first.”`,
  },
  {
    heading: "Bronze Aerial",
    group: "Base / Standalone Services",
    bodyMd: `**DESCRIPTION**

Entry-level aerial coverage that provides a clean, elevated view of the property from above. Designed to give buyers additional perspective on the home’s layout, lot, and surroundings without adding video.

**INCLUDES**

- (4) Aerial Photos

**PRICING**

**STANDARD PRICE:** $149

**POSITIONING**

- The simplest way to add aerial perspective to a listing
- A low-cost upgrade that adds immediate visual value

**WHEN TO RECOMMEND**

- Agents who don’t typically use drone
- Listings that need a little extra visual boost
- Homes where layout or positioning benefits from an overhead view
- Budget-conscious clients who still want some aerial coverage

**OBJECTIONS**

- “Not needed”
  - → “Totally fair—this is just a simple way to give buyers a better understanding of the property from above.”
  - → “Even a few aerial shots can add context that ground photos can’t show.”
- “I don’t usually do drone”
  - → “That’s exactly why this is a great starting point—it’s a small upgrade that makes a noticeable difference.”
  - → “A lot of agents start here and then expand as they see the impact.”`,
  },
  {
    heading: "Silver Aerial",
    group: "Base / Standalone Services",
    bodyMd: `**DESCRIPTION**

A balanced aerial package combining high-quality drone photos with short video clips to showcase the property from above. Designed to give buyers a complete understanding of the home’s exterior, layout, and surroundings—while enhancing overall listing presentation.

**INCLUDES**

- (5) Aerial Photos
- (3) Aerial Video Clips (will be integrated into walkthrough video if ordered)

**PRICING**

**STANDARD PRICE:** $199

**POSITIONING**

- The most popular and well-rounded aerial option
- Combines photo + video for a more complete story
- The best balance of value and impact
- Makes listings feel more polished and high-end

**WHEN TO RECOMMEND**

- Most listings (default aerial recommendation)
- Homes where the exterior, lot, or surroundings matter
- When a walkthrough video is included (to enhance it)
- Agents who want to elevate their listing without overdoing it

**OBJECTIONS**

- “I don’t need the video clips”
  - → “The clips really help the listing feel more polished—especially when they’re added to the beginning of your walkthrough video.”
  - → “It’s a small addition that makes a big difference in how the final product feels.”
- “I usually don’t do drone”
  - → “That’s exactly why this is a great place to start—it’s the most common option and adds a noticeable upgrade to your listings.”
  - → “A lot of agents start here once they see how much it elevates the presentation.”`,
  },
  {
    heading: "Gold Aerial",
    group: "Base / Standalone Services",
    bodyMd: `**DESCRIPTION**

Comprehensive aerial coverage designed to fully showcase the property, land, and surroundings. Includes extended photo coverage and a longer-form aerial video to highlight scale, layout, and key outdoor features in a more cinematic way.

**INCLUDES**

- (10) Aerial Photos
- (1–2 minute) Aerial Video

**PRICING**

**STANDARD PRICE:** $299

**POSITIONING**

- Premium aerial storytelling
- Best way to showcase property scale, land, and features
- Creates a high-end, cinematic feel
- Ideal for listings where the outside is a major selling point

**WHEN TO RECOMMEND**

- Large properties with acreage
- Listings with multiple outdoor features (pools, land, outbuildings, views)

**OBJECTIONS**

- “Silver is probably enough”
  - → “Silver is great for most listings—this is just the next step when you want to fully showcase everything the property has.”
  - → “If the land or outdoor features matter, this is where it really makes a difference.”
- “I don’t need that much aerial coverage”
  - → “That makes sense—this is really best when the property itself is part of what you’re selling, not just the home.”
  - → “If it’s a simpler property, Silver may be the better fit.”`,
  },
  {
    heading: "Vertical Video",
    group: "Base / Standalone Services",
    bodyMd: `**DESCRIPTION**

A short-form, mobile-optimized video designed specifically for social media platforms like Instagram Reels, TikTok, and Facebook. Built to capture attention quickly, showcase the property in a fast-paced format, and give agents the option to be in their video to increase branding, without the need to prepare talking points.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $149 |

**POSITIONING**

- A personal branding tool, not just listing media
- Designed for attention and reach, not just information
- Helps agents stay consistent and visible online

**WHEN TO RECOMMEND**

- Agents active on social media
- Agents trying to grow their brand or audience
- Listings where exposure and visibility matter
- Any agent who says they “want to post more” but doesn’t

**OBJECTIONS**

- “I don’t really use social media”
  - → “Totally fair—this gives you ready-to-use content for when you do want to start or stay consistent.”
  - → “Most agents aren’t lacking effort—they’re lacking content. This solves that.”
- “I don’t think my clients care about social”
  - → “This is less about your current clients and more about attracting your next clients.”
  - → “It’s one of the easiest ways to stay top of mind in your market.”`,
  },
  {
    heading: "Agent On Camera (Horizontal or Vertical)",
    group: "Base / Standalone Services",
    bodyMd: `**DESCRIPTION**

A professionally guided on-camera segment where the agent appears in the video with a clear introduction and call to action. Available in both horizontal (listing-focused) and vertical (social-focused) formats, designed to showcase both the home and the agent behind it.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $199 |

**POSITIONING**

- Builds trust before the first conversation
- Turns listing media into personal branding content
- Positions the agent as the face of the listing
- Helps agents stand out as more professional and memorable

**WHEN TO RECOMMEND**

- Agents focused on building their brand
- Social media + marketing-focused agents
- Agents wanting to differentiate themselves from competitors

**OBJECTIONS**

- “I’m not comfortable on video”
  - → “You don’t have to be—we’re not looking for perfect, just authentic.”
  - → “After one or two times, most agents get very comfortable with it.”
- “I don’t think it’s necessary”
  - → “You’re right—it’s not required. But this is what helps people connect with you, not just the listing.”
  - → “People choose agents they feel familiar with—this builds that quickly.”`,
  },
  {
    heading: "Agent On Camera Deluxe (Horizontal or Vertical)",
    group: "Base / Standalone Services",
    bodyMd: `**DESCRIPTION**

A guided on-camera experience where the agent is featured throughout the video—including an introduction, three narrated highlights within the home, and a closing call to action. Designed to showcase both the property and the agent in a more in-depth, engaging way (available in horizontal or vertical format).

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $349 |

**POSITIONING**

- A premium personal branding tool
- Positions the agent as the expert and guide through the home
- Builds stronger connection and trust with buyers and future clients
- Turns listing media into a high-impact marketing asset

**WHEN TO RECOMMEND**

- Agents serious about building their brand
- Higher-end or important listings
- Agents already comfortable on camera (or willing to try)
- When the agent wants to be more involved in showcasing the home

**OBJECTIONS**

- “That feels like a lot”
  - → “It’s definitely a step up—but that’s what makes it so effective for building your brand.”
  - → “This is less about the listing and more about positioning you as the expert.”
- “The standard version is enough”
  - → “The standard is great—this just gives you more opportunities to showcase your knowledge and personality throughout the home.”
  - → “If you want to stand out more, this is where it really happens.”`,
  },
  {
    heading: "Bronze Aerial",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

Entry-level aerial coverage that provides a clean, elevated view of the property from above. Designed to give buyers additional perspective on the home’s layout, lot, and surroundings without adding video.

**INCLUDES**

- (4) Aerial Photos

**PRICING**

**STANDARD PRICE:** $79

**POSITIONING**

- The simplest way to add aerial perspective to a listing
- A low-cost upgrade that adds immediate visual value

**WHEN TO RECOMMEND**

- Agents who don’t typically use drone
- Listings that need a little extra visual boost
- Homes where layout or positioning benefits from an overhead view
- Budget-conscious clients who still want some aerial coverage

**OBJECTIONS**

- “Not needed”
  - → “Totally fair—this is just a simple way to give buyers a better understanding of the property from above.”
  - → “Even a few aerial shots can add context that ground photos can’t show.”
- “I don’t usually do drone”
  - → “That’s exactly why this is a great starting point—it’s a small upgrade that makes a noticeable difference.”
  - → “A lot of agents start here and then expand as they see the impact.”`,
  },
  {
    heading: "Silver Aerial",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

A balanced aerial package combining high-quality drone photos with short video clips to showcase the property from above. Designed to give buyers a complete understanding of the home’s exterior, layout, and surroundings—while enhancing overall listing presentation.

**INCLUDES**

- (5) Aerial Photos
- (3) Aerial Video Clips (will be integrated into walkthrough video if ordered)

**PRICING**

**STANDARD PRICE:** $129

**POSITIONING**

- The most popular and well-rounded aerial option
- Combines photo + video for a more complete story
- The best balance of value and impact
- Makes listings feel more polished and high-end

**WHEN TO RECOMMEND**

- Most listings (default aerial recommendation)
- Homes where the exterior, lot, or surroundings matter
- When a walkthrough video is included (to enhance it)
- Agents who want to elevate their listing without overdoing it

**OBJECTIONS**

- “I don’t need the video clips”
  - → “The clips really help the listing feel more polished—especially when they’re added to the beginning of your walkthrough video.”
  - → “It’s a small addition that makes a big difference in how the final product feels.”
- “I usually don’t do drone”
  - → “That’s exactly why this is a great place to start—it’s the most common option and adds a noticeable upgrade to your listings.”
  - → “A lot of agents start here once they see how much it elevates the presentation.”`,
  },
  {
    heading: "Gold Aerial",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

Comprehensive aerial coverage designed to fully showcase the property, land, and surroundings. Includes extended photo coverage and a longer-form aerial video to highlight scale, layout, and key outdoor features in a more cinematic way.

**INCLUDES**

- (10) Aerial Photos
- (1–2 minute) Aerial Video

**PRICING**

**STANDARD PRICE:** $229

**POSITIONING**

- Premium aerial storytelling
- Best way to showcase property scale, land, and features
- Creates a high-end, cinematic feel
- Ideal for listings where the outside is a major selling point

**WHEN TO RECOMMEND**

- Large properties with acreage
- Listings with multiple outdoor features (pools, land, outbuildings, views)

**OBJECTIONS**

- “Silver is probably enough”
  - → “Silver is great for most listings—this is just the next step when you want to fully showcase everything the property has.”
  - → “If the land or outdoor features matter, this is where it really makes a difference.”
- “I don’t need that much aerial coverage”
  - → “That makes sense—this is really best when the property itself is part of what you’re selling, not just the home.”
  - → “If it’s a simpler property, Silver may be the better fit.”`,
  },
  {
    heading: "Vertical Video",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

A short-form, mobile-optimized video designed specifically for social media platforms like Instagram Reels, TikTok, and Facebook. Built to capture attention quickly, showcase the property in a fast-paced format, and give agents the option to be in their video to increase branding, without the need to prepare talking points.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $99 |

**POSITIONING**

- A personal branding tool, not just listing media
- Designed for attention and reach, not just information
- Helps agents stay consistent and visible online

**WHEN TO RECOMMEND**

- Agents active on social media
- Agents trying to grow their brand or audience
- Listings where exposure and visibility matter
- Any agent who says they “want to post more” but doesn’t

**OBJECTIONS**

- “I don’t really use social media”
  - → “Totally fair—this gives you ready-to-use content for when you do want to start or stay consistent.”
  - → “Most agents aren’t lacking effort—they’re lacking content. This solves that.”
- “I don’t think my clients care about social”
  - → “This is less about your current clients and more about attracting your next clients.”
  - → “It’s one of the easiest ways to stay top of mind in your market.”`,
  },
  {
    heading: "Agent On Camera (Horizontal or Vertical)",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

A professionally guided on-camera segment where the agent appears in the video with a clear introduction and call to action. Available in both horizontal (listing-focused) and vertical (social-focused) formats, designed to showcase both the home and the agent behind it.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $149 |

**POSITIONING**

- Builds trust before the first conversation
- Turns listing media into personal branding content
- Positions the agent as the face of the listing
- Helps agents stand out as more professional and memorable

**WHEN TO RECOMMEND**

- Agents focused on building their brand
- Social media + marketing-focused agents
- Agents wanting to differentiate themselves from competitors

**OBJECTIONS**

- “I’m not comfortable on video”
  - → “You don’t have to be—we’re not looking for perfect, just authentic.”
  - → “After one or two times, most agents get very comfortable with it.”
- “I don’t think it’s necessary”
  - → “You’re right—it’s not required. But this is what helps people connect with you, not just the listing.”
  - → “People choose agents they feel familiar with—this builds that quickly.”`,
  },
  {
    heading: "Agent On Camera Deluxe (Horizontal or Vertical)",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

A guided on-camera experience where the agent is featured throughout the video—including an introduction, three narrated highlights within the home, and a closing call to action. Designed to showcase both the property and the agent in a more in-depth, engaging way (available in horizontal or vertical format).

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $299 |

**POSITIONING**

- A premium personal branding tool
- Positions the agent as the expert and guide through the home
- Builds stronger connection and trust with buyers and future clients
- Turns listing media into a high-impact marketing asset

**WHEN TO RECOMMEND**

- Agents serious about building their brand
- Higher-end or important listings
- Agents already comfortable on camera (or willing to try)
- When the agent wants to be more involved in showcasing the home

**OBJECTIONS**

- “That feels like a lot”
  - → “It’s definitely a step up—but that’s what makes it so effective for building your brand.”
  - → “This is less about the listing and more about positioning you as the expert.”
- “The standard version is enough”
  - → “The standard is great—this just gives you more opportunities to showcase your knowledge and personality throughout the home.”
  - → “If you want to stand out more, this is where it really happens.”
  -`,
  },
  {
    heading: "Keepsake USB",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

A branded keepsake USB containing all listing media, designed to be presented to the seller as a thoughtful, tangible gift. It gives clients something they can keep, revisit, and remember the experience by long after the sale.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $25 |

**POSITIONING**

- A small touch that creates a premium client experience
- Helps agents stand out as more thoughtful and detail-oriented
- Reinforces a high-end, full-service brand

**WHEN TO RECOMMEND**

- High-service or relationship-focused agents
- Closing or thank-you gifts
- Agents focused on referrals and client experience
- Anytime an agent wants to leave a lasting impression

**OBJECTIONS**

- “I already give gifts”
  - → “That’s great—this pairs really well with other closing gifts and adds a personalized touch tied directly to the home.”
  - → “It’s a unique way to package the experience they just went through.”
- “I don’t think my clients would care”
  - → “Most clients don’t expect it—that’s what makes it stand out.”
  - → “It’s about creating a moment, not just giving something useful.”`,
  },
  {
    heading: "Zillow 3D + Floor Plan",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

An interactive Zillow 3D Home tour paired with a floor plan, allowing buyers to move through the property at their own pace while clearly understanding the layout. Designed to enhance how the listing is experienced directly on Zillow.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $99 |

**POSITIONING**

- Adds an interactive layer to your listing on Zillow
- Helps buyers explore the home, not just view it
- Increases time spent and engagement on the listing

**WHEN TO RECOMMEND**

- Zillow-focused listings
- Agents who rely heavily on portal traffic
- Listings where layout clarity is important
- Agents looking to increase engagement without a large investment

**OBJECTIONS**

- “I already have photos”
  - → “Photos are great for showcasing the home—this lets buyers actually move through it.”
  - → “It adds an interactive experience that photos alone can’t provide.”
- “I don’t want to overcomplicate the listing”
  - → “This actually simplifies things—it gives buyers a clear way to understand the layout in one place.”
  - → “It’s an easy add-on that adds functionality without adding complexity.”`,
  },
  {
    heading: "Rush Order",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

An expedited delivery option for HDR Photography, providing next-business-day delivery by 10 a.m. (or 12 p.m. Saturday) instead of end-of-day. Designed to help agents get listings live faster when timing matters.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $50 |

**POSITIONING**

- A speed-to-market advantage
- Helps agents get listings live faster and ahead of competition
- Ideal for situations where timing directly impacts results
- A simple way to prioritize urgency without changing the shoot

**WHEN TO RECOMMEND**

- Last-minute or urgent listings
- Listings going live the next morning
- Competitive situations where timing matters

**OBJECTIONS**

- “It’s not a big deal if it’s later”
  - → “Totally depends on the situation—this is really just for when timing is important or you want to create momentum quickly.”
  - → “It’s a small upgrade when speed could impact results.”`,
  },
  {
    heading: "Exterior HDR Photography",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

Targeted HDR photography of the front and rear exterior of the home, designed to refresh curb appeal without reshooting the full property. Perfect for updating listing visuals after changes, improvements, or seasonal shifts.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $50 |

**POSITIONING**

- The fastest, easiest way to refresh a listing
- Improves curb appeal and first impression online
- Keeps listings looking current and market-ready

**WHEN TO RECOMMEND**

- Landscaping, exterior upgrades, or repairs were completed
- Seasonal changes improved the look (snow → green grass, etc.)
- Listings that have been sitting and need a refresh

**OBJECTIONS**

- “It’s not worth updating just the outside”
  - → “The exterior is the first thing buyers see online—small improvements there can make a big difference in clicks.”
  - → “Even a refreshed front photo can change how the listing is perceived.”
- “I don’t need a full appointment again”
  - → “Exactly—that’s why this is helpful. It’s a quick update without the time or cost of a full shoot.”
  - → “We’re just improving the part buyers see first.”`,
  },
  {
    heading: "Subdivision Add-On",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

(5) ground-level exterior images of nearby subdivision amenities (within a half mile of the home) such as the clubhouse, pool, playground, entrance sign, pond, tennis courts, or other key community features. Designed to help showcase not just the home, but the lifestyle that comes with it.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $40 |

**POSITIONING**

- Helps sell the lifestyle, not just the property
- Adds context around why the location is desirable
- Shows buyers the value of the community and amenities
- A simple way to make the listing feel more complete

**WHEN TO RECOMMEND**

- Amenity-rich subdivisions
- Communities where neighborhood features are a strong selling point
- Listings where the subdivision helps justify value
- Homes near standout amenities buyers would care about

**OBJECTIONS**

- “I’m selling the house, not the neighborhood”
  - → “Totally get that—but buyers are often buying both.”
  - → “If the amenities help make the location more desirable, it’s worth showing them.”
- “That’s not necessary”
  - → “It may not be for every listing, but when the community is part of the appeal, it helps tell the full story.”
  - → “It gives buyers more context about what makes the property special.”`,
  },
  {
    heading: "Subdivision Aerial Add-On",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

(5) aerial photos showcasing the subdivision’s layout, amenities, and overall positioning in relation to the home. Provides a top-down perspective that helps buyers understand how the property fits within the community.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $99 |

**POSITIONING**

- The best way to show the full layout of a neighborhood
- Combines location, amenities, and context in one view
- Adds a more premium, high-end feel to community-focused listings
- Helps buyers quickly understand what surrounds the home

**WHEN TO RECOMMEND**

- Larger subdivisions or neighborhoods
- Communities with multiple amenities or unique layouts
- Listings where location within the neighborhood matters
- Homes where proximity to amenities is a selling point

**OBJECTIONS**

- “I don’t think buyers care about that”
  - → “Buyers care a lot about what surrounds the home—this just makes it easier for them to understand it quickly.”
  - → “It helps them visualize the bigger picture right away.”
- “Ground photos are enough”
  - → “Ground photos are great for details—this shows the full layout and how everything connects.”
  - → “Aerials give buyers a perspective they just can’t get from the ground.”`,
  },
  {
    heading: "Twilight Image Editing",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

Transforms a daytime front exterior photo into a twilight-style image, creating a warmer, more polished, and more eye-catching look for the listing. Designed to give the home a stronger first impression online without needing a separate twilight appointment.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $25 |

**POSITIONING**

- A scroll-stopping hero image for the listing
- One of the easiest ways to make a property stand out online
- Adds a more elevated, polished feel to the presentation
- A small upgrade with high visual impact

**WHEN TO RECOMMEND**

- Any listing that needs stronger visual impact
- Listings where the front exterior is a major selling point

**OBJECTIONS**

- “I already have a good exterior photo”
  - → “That’s great—this just gives you a stronger ‘hero image’ that grabs attention even more.”
  - → “It’s less about replacing it and more about making your main photo pop.”
- “I don’t think it matters that much”
  - → “The main photo is what gets people to click—this helps make sure your listing stands out in a crowded feed.”
  - → “Even a small visual difference can impact how many people stop and look.”`,
  },
  {
    heading: "Virtual Staging",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

Digitally furnished images that transform vacant spaces into fully staged rooms, helping buyers visualize how the home can look and feel when lived in. Designed to bring warmth, scale, and purpose to empty areas.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $25 Per Image |

**POSITIONING**

- Helps buyers emotionally connect to empty spaces
- Turns vacant rooms into inviting, livable environments
- Makes spaces feel larger, more functional, and easier to understand
- A cost-effective alternative to physical staging

**WHEN TO RECOMMEND**

- Vacant homes
- Empty rooms that feel small, cold, or confusing
- Listings where layout or function isn’t immediately clear

**OBJECTIONS**

- “Buyers can use their imagination”
  - → “Some can—but most don’t. Staging removes that guesswork.”
  - → “It helps buyers understand the purpose and potential of each space right away.”
- “I don’t think it makes a big difference”
  - → “Empty rooms often feel smaller and less inviting in photos.”
  - → “Staging helps them feel more functional and appealing immediately.”`,
  },
  {
    heading: "Green Grass Enhancement",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

Digitally restores natural green color to existing lawns that appear brown, dormant, or faded in exterior photos. Designed to improve curb appeal while keeping the lawn looking realistic and seasonally refreshed.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $5 Per Image |

**POSITIONING**

- A quick curb appeal improvement
- An affordable visual fix for seasonal lawn issues
- Helps exterior photos feel more fresh, polished, and market-ready
- One of the easiest low-cost ways to improve first impression online

**WHEN TO RECOMMEND**

- Brown or dormant but established lawns
- Seasonal exterior presentation issues
- Listings where the home looks great, but the yard feels dull in photos

**OBJECTIONS**

- “Not worth it”
  - → “At $5 per image, it’s one of the most affordable ways to improve curb appeal.”
  - → “It’s a small upgrade that can make exterior photos feel much more inviting.”
- “The grass is what it is”
  - → “Totally fair—this just helps the property show at its best online.”
  - → “It’s about presenting the home as cleanly and attractively as possible in photos.”`,
  },
  {
    heading: "Green Grass Replacement",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

Digitally adds realistic grass to exterior photos of homes that do not yet have established landscaping, helping the yard appear more finished, polished, and visually complete. This is especially helpful when bare dirt or incomplete exterior presentation takes away from the home’s first impression.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $15 Per Image |

**POSITIONING**

- A stronger curb appeal transformation
- Helps unfinished exteriors look more complete and market-ready
- Especially valuable for homes where the yard distracts from the property itself
- Improves first impression by making the exterior feel more polished

**WHEN TO RECOMMEND**

- New builds
- Homes without established grass or landscaping
- Listings where the home looks strong, but the yard hurts presentation

**OBJECTIONS**

- “Buyers know it’s a new build”
  - → “They do—but the photos still shape that first impression.”
  - → “This helps the home look finished and easier to connect with right away.”
- “I’m trying to keep costs down”
  - → “Totally understand—this is still a relatively low-cost way to make unfinished exterior photos feel much stronger.”
  - → “If the yard is taking away from the home, this can be worth it.”`,
  },
  {
    heading: "Lot Lines on Aerial Photos",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

Adds clear property boundary lines to two aerial photos, helping buyers quickly understand exactly what land is included with the listing. This is especially useful when lot lines are not obvious from the air or when the land itself is a major part of the value.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $25 |

**POSITIONING**

- Removes buyer confusion around property boundaries
- Makes the value of the land easier to understand
- Helps aerial photos become more informative, not just visually appealing
- A simple upgrade that adds clarity to land-focused listings

**WHEN TO RECOMMEND**

- Acreage
- Irregular lots
- Land listings
- Properties where boundaries are difficult to distinguish visually

**OBJECTIONS**

- “The listing already has acreage listed”
  - → “That helps, but showing the boundaries visually makes the information much easier to understand.”
  - → “It connects the number on paper to what buyers are actually seeing.”
- “People can figure it out”
  - → “Some can, but boundary visuals make it much clearer instantly.”
  - → “It helps buyers understand the property faster without having to guess.”`,
  },
  {
    heading: "Lot Lines on Aerial Videos",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

Digitally adds property boundary outlines to aerial video, making it easy for viewers to see exactly where the property begins and ends as the footage moves. This helps turn aerial video into a clearer, more informative tool for showcasing land.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $100 |

**POSITIONING**

- A premium land clarification tool
- Helps buyers understand acreage, boundaries, and layout in motion
- Makes aerial video more useful and informative, not just visually impressive
- Best for properties where the land itself is a major selling point

**WHEN TO RECOMMEND**

- Acreage
- Farmland
- Large parcels
- Irregular or hard-to-define boundaries
- Listings where buyers need help understanding exactly what is included

**OBJECTIONS**

- “I already have aerial video”
  - → “That’s great—this adds clarity, not just visuals.”
  - → “It helps the video explain the property, not just showcase it.”`,
  },
  {
    heading: "Floor Plan",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

A clean, easy-to-read floor plan that helps buyers understand the layout, flow, and overall structure of the home. It adds clarity that photos alone often cannot provide, especially when buyers are trying to picture how the spaces connect.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| 0 - 5,000 | $65 |
| 5,001 - 7,500 | $110 |
| 7,501 - 10,000 | $150 |
| 10,001 - 12,500 | $200 |

**POSITIONING**

- A practical clarity tool for buyers
- Helps the listing feel more complete and professional
- Makes it easier for buyers to understand flow and room relationships
- A simple add-on that adds real usability to the listing

**WHEN TO RECOMMEND**

- Most listings
- Homes with unusual or hard-to-follow layouts
- Larger homes where flow matters
- Buyers who need layout clarity before scheduling a showing
- Agents who want a more complete presentation

**OBJECTIONS**

- “The photos already show the rooms”
  - → “They do—but a floor plan helps buyers understand how those rooms connect and flow together.”
  - → “It answers layout questions that photos can leave open.”`,
  },
  {
    heading: "Premium Floor Plan",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

An upgraded floor plan that includes fixed furniture, counters, built-ins, and door swing indicators to create a more polished, detailed presentation of the home’s layout. It helps buyers better understand how the space functions while giving the listing a more refined, high-end feel.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| 0 - 5,000 | $89 |
| 5,001 - 7,500 | $135 |
| 7,501 - 10,000 | $175 |
| 10,001 - 12,500 | $225 |

**POSITIONING**

- A more refined and detailed version of the standard floor plan
- Helps the listing feel more premium and polished
- Adds more context around how the home is laid out and used
- Best when presentation quality and detail matter

**WHEN TO RECOMMEND**

- Higher-end homes
- Listings where layout details help sell the space
- Agents who want a more polished marketing package
- Homes with built-ins, unique features, or layout elements worth highlighting

**OBJECTIONS**

- “I don’t think I need that level of detail”
  - → “Totally fair — this is especially useful when the layout details help sell the space.”
  - → “It gives buyers a clearer picture of how the home actually functions.”`,
  },
  {
    heading: "Premium Floor Plan + CAD Files",
    group: "Add-Ons",
    bodyMd: `**DESCRIPTION**

A premium floor plan package that includes a polished, detailed floor plan plus CAD files for clients who need more advanced assets beyond standard listing marketing. Ideal for projects where the floor plan may also be used for design, planning, development, or broader marketing purposes.

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| 0 - 5,000 | $175 |
| 5,001 - 7,500 | $225 |
| 7,501 - 10,000 | $275 |
| 10,001 - 12,500 | $325 |

**POSITIONING**

- A professional-grade deliverable
- Best for clients who need more than marketing visuals alone
- Adds flexibility for builder, developer, or design-related use
- The right fit when the floor plan may be used beyond just listing presentation

**WHEN TO RECOMMEND**

- Builders
- Developers
- Advanced design or planning needs
- Clients who need assets that go beyond standard marketing materials

**OBJECTIONS**

- “I won’t use CAD files”
  - → “Totally fair—if you only need the marketing presentation, the Premium Floor Plan is probably the better fit.”
  - → “This option really makes the most sense when you need flexibility beyond just listing use.”`,
  },
  {
    heading: "WOW Essentials",
    group: "Bundles",
    bodyMd: `**DESCRIPTION**

A complete listing marketing package combining professional HDR photography and cinematic video to fully showcase the home. Designed to capture attention, increase engagement, and present the property in the most effective way possible.

**INCLUDES**

- HDR Photography
- Cinematic Walkthrough Video

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| 0 - 2,000 | $260 |
| 2,001 - 3,500 | $275 |
| 3,501 - 5,000 | $325 |
| 5,001 - 7,500 | $375 |
| 7,501+ | $425 |

**POSITIONING**

- The standard for modern listing marketing
- Combines attention (photos) + engagement (video)
- The best balance of cost and performance
- What most agents use to stay competitive and consistent

**WHEN TO RECOMMEND**

- Every listing (default starting point)
- Agents looking for a simple, effective solution
- Anytime someone asks, “What do most people do?”

**OBJECTIONS**

- “I only need photos”
  - → “Totally fair—most agents start there. What we’re seeing now is video is what helps your listings stand out and keeps buyers engaged.”
- “I don’t think I need both”
  - → “You might not need both—but together they cover everything: photos get people in, video keeps them interested.”`,
  },
  {
    heading: "WOW Essentials + Aerial Silver",
    group: "Bundles",
    bodyMd: `**DESCRIPTION**

A complete marketing package that combines photography, video, and aerial coverage to showcase not just the home—but the full property and its surroundings. Designed to give buyers a complete understanding of the listing from every angle.

**INCLUDES**

- HDR Photography
- Cinematic Walkthrough Video
- Silver Aerial

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| 0 - 2,000 | $389 |
| 2,001 - 3,500 | $404 |
| 3,501 - 5,000 | $454 |
| 5,001 - 7,500 | $504 |
| 7,501+ | $554 |

**POSITIONING**

- Tells the full story — home + land + location
- Combines interior + exterior + aerial perspective
- Makes listings feel more complete, polished, and high-end

**WHEN TO RECOMMEND**

- Homes with land, views, privacy, or larger lots
- Properties where location or surroundings add value

**OBJECTIONS**

- “I don’t need drone”
  - → “Totally fair—this is just what helps buyers understand the full property, not just the inside.”
- “The lot isn’t that big”
  - → “Even smaller properties benefit—it helps show positioning, spacing, and surroundings.”`,
  },
  {
    heading: "Luxury Listing Package",
    group: "Bundles",
    bodyMd: `**DESCRIPTION**

A complete, high-impact marketing suite designed to maximize exposure, elevate presentation, and position the agent at a higher level. Combines professional media, aerial coverage, social content, and visual enhancements to fully showcase the property and build the agent’s brand at the same time.

**INCLUDES**

- HDR Photography
- Cinematic Walkthrough Video
- Silver Aerial
- Twilight
- Vertical Video

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| 0 - 2,000 | $499 |
| 2,001 - 3,500 | $524 |
| 3,501 - 5,000 | $574 |
| 5,001 - 7,500 | $624 |
| 7,501+ | $674 |

**POSITIONING**

- Maximum exposure across all platforms (MLS + social)
- Builds both the listing AND the agent’s personal brand
- Positions the agent as high-level, modern, and competitive
- Designed to turn one listing into multiple future opportunities

**WHEN TO RECOMMEND**

- Higher-end or luxury listings
- Agents focused on growth, branding, and differentiation
- Situations where the agent says, “I want to go all-in on this one”

**OBJECTIONS**

- “That’s too expensive”
  - → “Most agents doing this are thinking about the next 2–3 listings it helps them win, not just this one.”`,
  },
  {
    heading: "Zillow Showcase Bundle",
    group: "Bundles",
    bodyMd: `**DESCRIPTION**

A bundled package built specifically for Zillow Showcase listings, combining professional HDR photography with a Zillow 3D Tour + Floor Plan. It gives the listing the media needed for Showcase while also helping buyers engage more deeply with the home on Zillow.

**INCLUDES**

- HDR Photography
- Zillow 3D Tour + Floor Plan

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| 0 - 2,000 | $259 |
| 2,001 - 3,500 | $274 |
| 3,501 - 5,000 | $324 |
| 5,001 - 7,500 | $374 |
| 7,501+ | $424 |

**POSITIONING**

- Built to maximize Zillow Showcase performance
- Gives buyers a more interactive experience on Zillow
- The right fit for agents already investing in Zillow visibility

**WHEN TO RECOMMEND**

- Agents using Zillow Showcase
- Listings where Zillow is a key marketing channel
- Agents wanting stronger buyer engagement directly on Zillow
- Situations where an agent asks what is needed for Showcase

**OBJECTIONS**

- “That’s not needed”
  - → “If you’re using Zillow Showcase, this is the media package that supports it.”`,
  },
  {
    heading: "Commercial Listing Package (1 Hour On-Site)",
    group: "Bundles",
    bodyMd: `**DESCRIPTION**

A streamlined commercial media package designed to capture the most important photo and video content from a commercial property in a focused, efficient one-hour appointment. Ideal for showcasing the space clearly and professionally without overcomplicating the process.

**INCLUDES**

- HDR Photography
- Cinematic Walkthrough Video

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $250 |

**POSITIONING**

- A fast, efficient solution for commercial listings
- A strong fit for agents or owners who want to get the property to market quickly
- Keeps commercial media simple, clean, and effective

**WHEN TO RECOMMEND**

- Smaller commercial properties
- Simpler spaces with straightforward layouts

**OBJECTIONS**

- “I’m not sure this is enough to market the space well”
  - → “For the right property, this is a very effective way to get clean, professional media without overdoing it.”
  - → “If we know the space needs more coverage, we’d simply recommend stepping up to the next package.”`,
  },
  {
    heading: "Commercial Listing Package (2 Hours On-Site)",
    group: "Bundles",
    bodyMd: `**DESCRIPTION**

A more comprehensive commercial media package designed for larger, more detailed, or more complex spaces that need additional time on-site. This option allows for deeper photo and video coverage, helping showcase the property more thoroughly and tell a more complete story.

**INCLUDES**

- HDR Photography
- Cinematic Walkthrough Video

**PRICING**

| SQ. FT. | STANDARD PRICE |
| --- | --- |
| Flat Rate | $500 |

**POSITIONING**

- A more complete commercial coverage option
- Best for properties where layout, scale, or multiple spaces matter

**WHEN TO RECOMMEND**

- Larger commercial properties
- Properties with multiple rooms, suites, or featured areas
- Listings with more detail, complexity, or unique selling points

**OBJECTIONS**

- “Can we do less time?”
  - → “If it’s a smaller or more straightforward space, the 1-hour option may absolutely be the better fit.”
  - → “This package is really meant for properties that need more depth and coverage.”`,
  },
];
