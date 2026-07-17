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

export type AdminUserWithPermissions = AdminUser & {
  permissions: UserPermission[];
};

export type PortalUser = {
  id: string;
  role: AdminUserRole;
  permissions: UserPermission[];
};
