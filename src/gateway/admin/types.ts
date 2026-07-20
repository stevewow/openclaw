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
  { value: "tickets", label: "Tickets" },
  { value: "ticket-departments", label: "Ticket Departments" },
  { value: "ticket-categories", label: "Ticket Request Types" },
  { value: "ticket-form", label: "Ticket Intake Form" },
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
