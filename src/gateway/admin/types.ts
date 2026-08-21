export type AdminUserRole = "superadmin" | "admin" | "user";

export type AdminUser = {
  id: string;
  username: string;
  role: AdminUserRole;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
};

export type AdminSession = {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  impersonatorId: string | null;
};

export type SessionUser = AdminUser & { impersonatorId: string | null };

export type UserPermission = {
  userId: string;
  // agent/skill/channel gate runtime capabilities; feature/report gate which
  // portal sections and reports a user can see (deny-by-default for those two).
  permissionType: "agent" | "skill" | "channel" | "feature" | "report";
  value: string;
};

/**
 * Canonical catalog of grantable portal sections.
 *
 * One list feeds all three enforcement points: the server-side route gate in
 * `admin-http.ts`, the Access tab checkboxes in the admin SPA, and the portal's
 * nav filtering. Adding an entry here is what makes a section toggleable — keep
 * `value` in sync with the route gate's mapping and the nav's `data-feature`.
 */
export const PORTAL_FEATURES = [
  { value: "chat", label: "Chat" },
  { value: "projects", label: "Projects & Tasks" },
  { value: "resources", label: "Resources" },
  // Contributing to the library is granted apart from reading it: holding this
  // lets someone add resources and tend the ones they added, nothing else.
  { value: "resource-upload", label: "Upload Resources (add & manage own)" },
  { value: "tickets", label: "Tickets" },
  { value: "ticket-departments", label: "Ticket Departments" },
  { value: "ticket-categories", label: "Ticket Request Types" },
  { value: "ticket-form", label: "Ticket Intake Form" },
  // Authoring only. Reading a published article needs no grant at all — the
  // public reader is a separate, unauthenticated surface.
  // The stored value stays `knowledge-base`: it is written into every
  // existing grant row, and renaming a label must not revoke anybody's access.
  { value: "knowledge-base", label: "Help Center" },
] as const;

export type PortalFeature = (typeof PORTAL_FEATURES)[number]["value"];

export type AdminUserWithPermissions = AdminUser & {
  permissions: UserPermission[];
};

export type PortalUser = {
  id: string;
  role: AdminUserRole;
  permissions: UserPermission[];
};
