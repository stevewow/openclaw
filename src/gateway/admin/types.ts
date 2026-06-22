export type AdminUserRole = "superadmin" | "admin" | "user";

export type AdminUser = {
  id: string;
  username: string;
  role: AdminUserRole;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
};

export type AdminSession = {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
};

export type UserPermission = {
  userId: string;
  permissionType: "agent" | "skill" | "channel";
  value: string;
};

export type AdminUserWithPermissions = AdminUser & {
  permissions: UserPermission[];
};
