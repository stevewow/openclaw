// Icons for the request-type cards on the public intake form.
//
// A curated set rather than free-text emoji: the cards sit on a branded page, and
// an emoji renders as a different picture on every platform (and as a tofu box on
// some). These are 24×24 stroke paths on `currentColor`, so a card inherits the
// page's ink and the picked card's accent without a second asset.
//
// Kept as path data, not markup, so both the public form and the dashboard's
// picker draw the same icon from one definition, and so nothing here can carry
// attributes into the HTML it is rendered into.

export type TicketIconKey =
  | "pencil"
  | "plus"
  | "image-alert"
  | "question"
  | "camera"
  | "video"
  | "drone"
  | "floorplan"
  | "tour"
  | "twilight"
  | "calendar"
  | "invoice";

export type TicketIconDef = {
  key: TicketIconKey;
  /** How the icon reads in the dashboard's picker. */
  label: string;
  /** `d` attributes drawn as stroked paths, in order. */
  paths: string[];
  /** Drawn as filled dots — stroke-only shapes read as hollow at this size. */
  dots?: Array<{ cx: number; cy: number; r: number }>;
};

/**
 * The set an admin may choose from. Ordered by how likely a desk is to want it,
 * since that is the order the picker shows.
 */
export const TICKET_ICONS: TicketIconDef[] = [
  {
    key: "pencil",
    label: "Edit / retouch",
    paths: ["M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z", "M13.5 6.5 17.5 10.5"],
  },
  {
    key: "plus",
    label: "Add a service",
    paths: ["M12 5v14", "M5 12h14"],
  },
  {
    key: "image-alert",
    label: "Missing / wrong media",
    paths: [
      "M20 13.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8",
      "M3 15.5 8 11l4 3.5",
      "M19 15.5v3",
    ],
    dots: [
      { cx: 14.5, cy: 8.5, r: 1.3 },
      { cx: 19, cy: 21.5, r: 1 },
    ],
  },
  {
    key: "question",
    label: "Something else",
    paths: [
      "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
      "M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.4-2.8 4.2",
    ],
    dots: [{ cx: 12, cy: 17.4, r: 1 }],
  },
  {
    key: "camera",
    label: "Photos",
    paths: [
      "M3 8.5a2 2 0 0 1 2-2h2.2l1.3-2h6l1.3 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z",
      "M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    ],
  },
  {
    key: "video",
    label: "Video / walkthrough",
    paths: [
      "M3 7.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z",
      "M15 10.5 21 7v10l-6-3.5",
    ],
  },
  {
    key: "drone",
    label: "Aerial / drone",
    paths: [
      "M9 9h6v6H9V9Z",
      "M9 9 5.5 5.5M15 9l3.5-3.5M9 15l-3.5 3.5M15 15l3.5 3.5",
      "M3 5.5h5M16 5.5h5M3 18.5h5M16 18.5h5",
    ],
  },
  {
    key: "floorplan",
    label: "Floor plan",
    paths: ["M3.5 3.5h17v17h-17v-17Z", "M3.5 11h7v9.5M10.5 11h10M14.5 3.5V8"],
  },
  {
    key: "tour",
    label: "Virtual tour",
    paths: [
      "M12 16.5c4.7 0 8.5-1.6 8.5-3.5S16.7 9.5 12 9.5 3.5 11.1 3.5 13s3.8 3.5 8.5 3.5Z",
      "M12 20a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
    ],
  },
  {
    key: "twilight",
    label: "Twilight",
    paths: ["M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"],
  },
  {
    key: "calendar",
    label: "Scheduling",
    paths: [
      "M4 6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-12Z",
      "M4 10h16M8.5 3v3.5M15.5 3v3.5",
    ],
  },
  {
    key: "invoice",
    label: "Billing",
    paths: ["M6 3.5h12v17l-3-1.7-3 1.7-3-1.7-3 1.7v-17Z", "M9.5 9h5M9.5 13h5"],
  },
];

const BY_KEY = new Map(TICKET_ICONS.map((i) => [i.key, i]));

/** The generic mark for a request type whose icon is unset or no longer known. */
const FALLBACK_ICON: TicketIconKey = "question";

/** Resolve a stored icon key, falling back rather than rendering nothing. */
export function resolveTicketIcon(key: string | null | undefined): TicketIconDef {
  return (key ? BY_KEY.get(key as TicketIconKey) : undefined) ?? BY_KEY.get(FALLBACK_ICON)!;
}

/** True when the key names an icon we can actually draw. */
export function isTicketIconKey(key: unknown): key is TicketIconKey {
  return typeof key === "string" && BY_KEY.has(key as TicketIconKey);
}

/**
 * The icon as a standalone `<svg>`. Decorative by default: the card's own text
 * already names the request type, so announcing the picture as well would make a
 * screen reader read every card twice.
 */
export function ticketIconSvg(key: string | null | undefined, size = 24): string {
  const icon = resolveTicketIcon(key);
  const paths = icon.paths
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  const dots = (icon.dots ?? [])
    .map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="currentColor"/>`)
    .join("");
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${paths}${dots}</svg>`;
}

/** Default icon for the seeded request types, so the form ships with real marks. */
export const SEED_CATEGORY_ICONS: Record<string, TicketIconKey> = {
  edit_request: "pencil",
  additional_service: "plus",
  missing_media: "image-alert",
  other: "question",
};
