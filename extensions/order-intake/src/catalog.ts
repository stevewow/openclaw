// Encoded WOW Video Tours "Sales & Service Product Guide" (Google Doc
// 1Qwm-C7QRCPYhiA_MeD2buMOxuwCXMcJlLXgXyA6Cixc, retrieved 2026-07-13).
// Standard catalog rates only — company/VIP negotiated rates are applied by the
// team after handoff, never in the public chat.

export type PriceSpec =
  | { kind: "flat"; price: number }
  | { kind: "perImage"; price: number }
  | { kind: "tiered"; tierSet: TierSetId; prices: Array<number | "custom"> };

export type TierSetId = "standard5" | "floorplan4";

export type Tier = { maxSqft: number | null; label: string };

export type TierSet = {
  field: "squareFeet";
  tiers: Tier[];
  escalateAboveSqft?: number;
};

export type Bundle = {
  id: string;
  name: string;
  includes: string[];
  pricing: PriceSpec;
  escalate?: { reason: string; note: string };
};

export type Service = {
  id: string;
  name: string;
  category:
    | "photo"
    | "video"
    | "aerial"
    | "tour"
    | "floorplan"
    | "enhancement"
    | "branding"
    | "other";
  includes?: string;
  standalone: PriceSpec | null;
  addOn: PriceSpec | null;
  escalate?: { reason: string; aboveSqft: number; note: string };
  requires?: string[];
  requiresNote?: string;
  requiresAgentPresent?: boolean;
  integratesWith?: string;
  quantityQuestion?: string;
  upsellWhen?: { vacancy?: "vacant" | "occupied" };
  needsConfirmation?: string;
};

export type TripFeeTier = {
  maxMiles: number | null;
  fee: number | null;
  handling: "standard" | "phone-only" | "out-of-area";
  office?: string;
};

export const TIER_SETS: Record<TierSetId, TierSet> = {
  standard5: {
    field: "squareFeet",
    tiers: [
      { maxSqft: 2000, label: "0 - 2,000" },
      { maxSqft: 3500, label: "2,001 - 3,500" },
      { maxSqft: 5000, label: "3,501 - 5,000" },
      { maxSqft: 7500, label: "5,001 - 7,500" },
      { maxSqft: null, label: "7,501+" },
    ],
  },
  floorplan4: {
    field: "squareFeet",
    tiers: [
      { maxSqft: 5000, label: "0 - 5,000" },
      { maxSqft: 7500, label: "5,001 - 7,500" },
      { maxSqft: 10000, label: "7,501 - 10,000" },
      { maxSqft: 12500, label: "10,001 - 12,500" },
    ],
    escalateAboveSqft: 12500,
  },
};

export const BUNDLES: Bundle[] = [
  {
    id: "wow-essentials",
    name: "WOW Essentials",
    includes: ["hdr-photography", "cinematic-walkthrough"],
    pricing: { kind: "tiered", tierSet: "standard5", prices: [260, 275, 325, 375, 425] },
  },
  {
    id: "wow-essentials-silver-aerial",
    name: "WOW Essentials + Aerial Silver",
    includes: ["hdr-photography", "cinematic-walkthrough", "silver-aerial"],
    pricing: { kind: "tiered", tierSet: "standard5", prices: [389, 404, 454, 504, 554] },
  },
  {
    id: "luxury-listing",
    name: "Luxury Listing Package",
    includes: [
      "hdr-photography",
      "cinematic-walkthrough",
      "silver-aerial",
      "twilight",
      "vertical-video",
    ],
    pricing: { kind: "tiered", tierSet: "standard5", prices: [499, 524, 574, 624, 674] },
  },
  {
    id: "zillow-showcase",
    name: "Zillow Showcase Bundle",
    includes: ["hdr-photography", "zillow-3d-floorplan"],
    pricing: { kind: "tiered", tierSet: "standard5", prices: [259, 274, 324, 374, 424] },
  },
  {
    id: "commercial-1hr",
    name: "Commercial Listing Package (1 Hour On-Site)",
    includes: ["hdr-photography", "cinematic-walkthrough"],
    pricing: { kind: "flat", price: 250 },
    escalate: {
      reason: "commercial",
      note: "Commercial/multi-unit may need a personalized quote per T&C.",
    },
  },
  {
    id: "commercial-2hr",
    name: "Commercial Listing Package (2 Hours On-Site)",
    includes: ["hdr-photography", "cinematic-walkthrough"],
    pricing: { kind: "flat", price: 500 },
    escalate: {
      reason: "commercial",
      note: "Commercial/multi-unit may need a personalized quote per T&C.",
    },
  },
];

export const SERVICES: Service[] = [
  {
    id: "hdr-photography",
    name: "HDR Photography",
    category: "photo",
    standalone: { kind: "tiered", tierSet: "standard5", prices: [160, 175, 225, 275, 325] },
    addOn: null,
  },
  {
    id: "cinematic-walkthrough",
    name: "Cinematic Walkthrough Video",
    category: "video",
    standalone: { kind: "tiered", tierSet: "standard5", prices: [200, 250, 300, 350, 450] },
    addOn: null,
  },
  {
    id: "matterport-3d",
    name: "Matterport 3D Tour + Floorplan",
    category: "tour",
    standalone: { kind: "tiered", tierSet: "standard5", prices: [199, 299, 399, 549, "custom"] },
    addOn: null,
    escalate: {
      reason: "matterport-large",
      aboveSqft: 7500,
      note: "Matterport 7,501+ sqft is a custom quote.",
    },
  },
  {
    id: "exterior-hdr",
    name: "Exterior HDR Photography",
    category: "photo",
    standalone: { kind: "flat", price: 50 },
    addOn: { kind: "flat", price: 50 },
  },
  {
    id: "bronze-aerial",
    name: "Bronze Aerial",
    category: "aerial",
    includes: "(4) Aerial Photos",
    standalone: { kind: "flat", price: 149 },
    addOn: { kind: "flat", price: 79 },
  },
  {
    id: "silver-aerial",
    name: "Silver Aerial",
    category: "aerial",
    includes: "(5) Aerial Photos, (3) Aerial Video Clips",
    standalone: { kind: "flat", price: 199 },
    addOn: { kind: "flat", price: 129 },
    integratesWith: "cinematic-walkthrough",
  },
  {
    id: "gold-aerial",
    name: "Gold Aerial",
    category: "aerial",
    includes: "(10) Aerial Photos, (1-2 min) Aerial Video",
    standalone: { kind: "flat", price: 299 },
    addOn: { kind: "flat", price: 229 },
  },
  {
    id: "vertical-video",
    name: "Vertical Video",
    category: "video",
    standalone: { kind: "flat", price: 149 },
    addOn: { kind: "flat", price: 99 },
  },
  {
    id: "agent-on-camera",
    name: "Agent On Camera (Horizontal or Vertical)",
    category: "branding",
    standalone: { kind: "flat", price: 199 },
    addOn: { kind: "flat", price: 149 },
    requiresAgentPresent: true,
  },
  {
    id: "agent-on-camera-deluxe",
    name: "Agent On Camera Deluxe (Horizontal or Vertical)",
    category: "branding",
    standalone: { kind: "flat", price: 349 },
    addOn: { kind: "flat", price: 299 },
    requiresAgentPresent: true,
  },
  {
    id: "keepsake-usb",
    name: "Keepsake USB",
    category: "other",
    standalone: null,
    addOn: { kind: "flat", price: 25 },
  },
  {
    id: "zillow-3d-floorplan",
    name: "Zillow 3D + Floor Plan",
    category: "tour",
    standalone: null,
    addOn: { kind: "flat", price: 99 },
  },
  {
    id: "rush-order",
    name: "Rush Order",
    category: "other",
    standalone: null,
    addOn: { kind: "flat", price: 50 },
    requires: ["hdr-photography"],
    requiresNote:
      "Rush Order (next-business-day 10am / Sat 12pm) is only valid with HDR Photography.",
  },
  {
    id: "subdivision",
    name: "Subdivision Add-On",
    category: "photo",
    includes: "(5) ground-level exterior images of nearby amenities",
    standalone: null,
    addOn: { kind: "flat", price: 40 },
  },
  {
    id: "subdivision-aerial",
    name: "Subdivision Aerial Add-On",
    category: "aerial",
    includes: "(5) aerial photos of the subdivision",
    standalone: null,
    addOn: { kind: "flat", price: 99 },
  },
  {
    id: "twilight",
    name: "Twilight Image Editing",
    category: "enhancement",
    standalone: null,
    addOn: { kind: "perImage", price: 25 },
    quantityQuestion: "How many images should we convert to twilight?",
    needsConfirmation:
      "Product guide labels Twilight 'Flat Rate $25', but the spec sample and prior research treat it as $25 PER IMAGE (Twilight x3 = $75). Encoded as per-image; confirm with WOW.",
  },
  {
    id: "virtual-staging",
    name: "Virtual Staging",
    category: "enhancement",
    standalone: null,
    addOn: { kind: "perImage", price: 25 },
    quantityQuestion: "How many images should we virtually stage?",
    upsellWhen: { vacancy: "vacant" },
  },
  {
    id: "green-grass-enhancement",
    name: "Green Grass Enhancement",
    category: "enhancement",
    standalone: null,
    addOn: { kind: "perImage", price: 5 },
    quantityQuestion: "How many images need green-grass enhancement?",
  },
  {
    id: "green-grass-replacement",
    name: "Green Grass Replacement",
    category: "enhancement",
    standalone: null,
    addOn: { kind: "perImage", price: 15 },
    quantityQuestion: "How many images need green-grass replacement (bare/new-build lawns)?",
  },
  {
    id: "lot-lines-photos",
    name: "Lot Lines on Aerial Photos",
    category: "aerial",
    includes: "Boundary lines on (2) aerial photos",
    standalone: null,
    addOn: { kind: "flat", price: 25 },
  },
  {
    id: "lot-lines-video",
    name: "Lot Lines on Aerial Videos",
    category: "aerial",
    standalone: null,
    addOn: { kind: "flat", price: 100 },
  },
  {
    id: "floor-plan",
    name: "Floor Plan",
    category: "floorplan",
    standalone: null,
    addOn: { kind: "tiered", tierSet: "floorplan4", prices: [65, 110, 150, 200] },
    escalate: {
      reason: "floorplan-large",
      aboveSqft: 12500,
      note: "Floor Plan above 12,500 sqft is a custom quote.",
    },
  },
  {
    id: "premium-floor-plan",
    name: "Premium Floor Plan",
    category: "floorplan",
    standalone: null,
    addOn: { kind: "tiered", tierSet: "floorplan4", prices: [89, 135, 175, 225] },
    escalate: {
      reason: "floorplan-large",
      aboveSqft: 12500,
      note: "Premium Floor Plan above 12,500 sqft is a custom quote.",
    },
  },
  {
    id: "premium-floor-plan-cad",
    name: "Premium Floor Plan + CAD Files",
    category: "floorplan",
    standalone: null,
    addOn: { kind: "tiered", tierSet: "floorplan4", prices: [175, 225, 275, 325] },
    escalate: {
      reason: "floorplan-large",
      aboveSqft: 12500,
      note: "Premium Floor Plan + CAD above 12,500 sqft is a custom quote.",
    },
  },
];

export const TRIP_FEES = {
  primaryCenters: [
    "Fort Wayne IN",
    "Toledo OH",
    "Lima OH",
    "Dayton OH",
    "Cincinnati OH",
    "Columbus OH",
    "Charlotte NC",
  ],
  secondaryMarkets: [
    "Hamilton OH",
    "Mason OH",
    "West Chester OH",
    "Morrow OH",
    "Springfield OH",
    "Marysville OH",
    "Newark OH",
    "Celina OH",
    "Van Wert OH",
    "Findlay OH",
  ],
  primaryTiers: [
    { maxMiles: 29.9, fee: 0, handling: "standard" },
    { maxMiles: 34.9, fee: 25, handling: "standard" },
    { maxMiles: 39.9, fee: 50, handling: "standard" },
    { maxMiles: 44.9, fee: 75, handling: "phone-only", office: "(937) 505-0444" },
    { maxMiles: 49.9, fee: 100, handling: "phone-only", office: "(937) 505-0444" },
    { maxMiles: null, fee: null, handling: "out-of-area" },
  ] as TripFeeTier[],
  secondaryNote: "Secondary markets: 10-mile radius free; beyond, case-by-case review.",
};

export const OFFICE_PHONE = "(937) 505-0444";

export function bundleById(id: string): Bundle | undefined {
  return BUNDLES.find((b) => b.id === id);
}

export function serviceById(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}
