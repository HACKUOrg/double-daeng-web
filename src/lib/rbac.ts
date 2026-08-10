export const roles = ["SA", "MANAGER", "OPERATION", "RESIDENT"] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "admin.access",
  "app.access",
  "iam.view",
  "audit.view",
  "organizations.manage",
  "memberships.manage",
  "users.manage.all",
  "users.manage.organization",
  "assets.manage",
  "rooms.manage",
  "customers.manage",
  "room_status.update",
  "maintenance.manage",
  "own_data.view",
  "maintenance.create"
] as const;

export type Permission = (typeof permissions)[number];

export const roleLabels: Record<Role, string> = {
  SA: "System Admin",
  MANAGER: "Manager",
  OPERATION: "Operation",
  RESIDENT: "Resident"
};

export const permissionLabels: Record<Permission, string> = {
  "admin.access": "Access admin area",
  "app.access": "Access organization app",
  "iam.view": "View fixed IAM map",
  "audit.view": "View audit log",
  "organizations.manage": "Manage organizations and property hierarchy",
  "memberships.manage": "Assign organization memberships",
  "users.manage.all": "Manage all non-SA users",
  "users.manage.organization": "Manage users in assigned organizations",
  "assets.manage": "Manage assets, buildings, floors, and rooms",
  "rooms.manage": "Manage rooms",
  "customers.manage": "Manage customers",
  "room_status.update": "Run room status actions",
  "maintenance.manage": "Manage maintenance work",
  "own_data.view": "View own data",
  "maintenance.create": "Create maintenance request"
};

export const permissionsByRole: Record<Role, Permission[]> = {
  SA: [
    "admin.access",
    "iam.view",
    "audit.view",
    "organizations.manage",
    "memberships.manage",
    "users.manage.all",
    "assets.manage",
    "rooms.manage"
  ],
  MANAGER: [
    "app.access",
    "users.manage.organization",
    "assets.manage",
    "rooms.manage",
    "customers.manage"
  ],
  OPERATION: [
    "app.access",
    "customers.manage",
    "room_status.update",
    "maintenance.manage"
  ],
  RESIDENT: ["app.access", "own_data.view", "maintenance.create"]
};

export const creatableRolesByRole: Record<Role, Role[]> = {
  SA: ["MANAGER", "OPERATION"],
  MANAGER: ["OPERATION"],
  OPERATION: [],
  RESIDENT: []
};

export function canCreateRole(actorRole: Role, targetRole: Role) {
  return creatableRolesByRole[actorRole].includes(targetRole);
}

export function hasPermission(role: Role, permission: Permission) {
  return permissionsByRole[role].includes(permission);
}

export function hasAnyPermission(role: Role, requiredPermissions: Permission[]) {
  return requiredPermissions.some((permission) => hasPermission(role, permission));
}
