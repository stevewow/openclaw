/**
 * What can appear in a Hub sidebar, and where it sits before anyone rearranges
 * it.
 *
 * The sidebar used to be hand-written markup in each SPA, so reordering it, or
 * moving a section into a submenu, meant editing HTML. This module is the
 * canonical list both surfaces render from and the Navigation settings page
 * edits; a stored arrangement is layered on top of it (`nav-config-store.ts`)
 * rather than replacing it, so a section added in code still shows up for
 * everyone who already saved a layout.
 *
 * An item's `id` is the SPA's own page key — the thing `navigate()` takes and
 * `data-page` carries. Keeping them the same is what lets the stored layout
 * name pages without inventing a second vocabulary, and it is why ids must not
 * be renamed once shipped: a saved layout refers to them.
 */

/** The two signed-in surfaces that draw a sidebar. */
export const NAV_SURFACES = ["admin", "portal"] as const;
export type NavSurface = (typeof NAV_SURFACES)[number];

export type NavCatalogItem = {
  /** Page key. Stable forever — saved layouts refer to it. */
  id: string;
  /** Default label. A saved layout may override it. */
  label: string;
  /** Default icon (emoji). A saved layout may override it. */
  icon: string;
  /** Group this lands in when nobody has arranged it. */
  group: string;
};

export type NavCatalogGroup = {
  id: string;
  /** Heading text. Empty means the group renders with no heading at all. */
  label: string;
};

type NavCatalog = { groups: NavCatalogGroup[]; items: NavCatalogItem[] };

/**
 * The admin dashboard's sections, in the order they shipped.
 *
 * Access is *not* modelled here. Which of these a given account may open is
 * decided by the SPA's `pages` registry and the server-side gate; the sidebar
 * only decides arrangement, and an item the viewer cannot reach is dropped at
 * render time. Keeping the two apart is what stops a layout edit from becoming
 * a permission change.
 */
const ADMIN_CATALOG: NavCatalog = {
  groups: [
    { id: "main", label: "Main" },
    { id: "workspace", label: "Workspace" },
    { id: "sales", label: "Sales" },
    { id: "support", label: "Support" },
    { id: "financials", label: "Financials" },
    { id: "settings", label: "Settings" },
  ],
  items: [
    { id: "dashboard", label: "Dashboard", icon: "⊞", group: "main" },
    { id: "users", label: "Users", icon: "👥", group: "main" },
    { id: "agents", label: "Agents", icon: "🤖", group: "main" },
    { id: "chat", label: "Chat", icon: "💬", group: "main" },
    { id: "projects", label: "Projects & Tasks", icon: "📋", group: "workspace" },
    { id: "reports", label: "Reports", icon: "📊", group: "workspace" },
    { id: "leads", label: "Leads", icon: "🎯", group: "sales" },
    { id: "lead-routing", label: "Lead Routing", icon: "🗺️", group: "sales" },
    { id: "lead-playbooks", label: "Outreach Notes", icon: "📣", group: "sales" },
    { id: "tickets", label: "Tickets", icon: "🎫", group: "support" },
    { id: "departments", label: "Departments", icon: "🏷️", group: "support" },
    { id: "categories", label: "Request Types", icon: "🗂️", group: "support" },
    { id: "form-preview", label: "Intake Form", icon: "👁️", group: "support" },
    { id: "kb", label: "Help Center", icon: "📖", group: "support" },
    { id: "kb-searches", label: "Help Insights", icon: "🔍", group: "support" },
    { id: "feedback", label: "Feedback", icon: "💬", group: "support" },
    { id: "financials", label: "Past Due Accounts", icon: "💰", group: "financials" },
    { id: "cleveland", label: "Cleveland Investment", icon: "📈", group: "financials" },
    { id: "resources", label: "Resources", icon: "📚", group: "settings" },
    { id: "navigation", label: "Navigation", icon: "🧭", group: "settings" },
    { id: "system", label: "System", icon: "⚙", group: "settings" },
    { id: "account", label: "My Account", icon: "👤", group: "settings" },
  ],
};

/**
 * The user portal's sections.
 *
 * One unlabelled group by default, which is how the portal has always looked:
 * a short flat list with no headings. Splitting it is a layout choice an admin
 * can now make rather than something the markup decides.
 */
const PORTAL_CATALOG: NavCatalog = {
  groups: [{ id: "main", label: "" }],
  items: [
    { id: "chat", label: "Chat", icon: "💬", group: "main" },
    { id: "tasks", label: "Projects & Tasks", icon: "📋", group: "main" },
    { id: "reports", label: "Reports", icon: "📊", group: "main" },
    { id: "leads", label: "Leads", icon: "🎯", group: "main" },
    { id: "resources", label: "Resources", icon: "📚", group: "main" },
    { id: "account", label: "My Account", icon: "👤", group: "main" },
  ],
};

const CATALOGS: Record<NavSurface, NavCatalog> = {
  admin: ADMIN_CATALOG,
  portal: PORTAL_CATALOG,
};

export function isNavSurface(value: unknown): value is NavSurface {
  return typeof value === "string" && (NAV_SURFACES as readonly string[]).includes(value);
}

/** Every section a surface can show, in shipped order. Copies, so callers may sort. */
export function navCatalogItems(surface: NavSurface): NavCatalogItem[] {
  return CATALOGS[surface].items.map((i) => ({
    id: i.id,
    label: i.label,
    icon: i.icon,
    group: i.group,
  }));
}

/** The surface's default groups, in shipped order. */
export function navCatalogGroups(surface: NavSurface): NavCatalogGroup[] {
  return CATALOGS[surface].groups.map((g) => ({ id: g.id, label: g.label }));
}
