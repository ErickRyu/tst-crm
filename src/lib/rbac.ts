export type Role = "ADMIN" | "COUNSELOR" | "HOSPITAL_STAFF";

export const ROLES: Role[] = ["ADMIN", "COUNSELOR", "HOSPITAL_STAFF"];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "관리자",
  COUNSELOR: "상담원",
  HOSPITAL_STAFF: "병원 스태프",
};

// Page-level access control
const PAGE_ROLES: Record<string, Role[]> = {
  "/crm/users": ["ADMIN"],
  "/crm/audit-logs": ["ADMIN"],
  "/crm/settings": ["ADMIN"],
  "/crm/calendar": ["ADMIN", "COUNSELOR", "HOSPITAL_STAFF"],
  "/crm": ["ADMIN", "COUNSELOR"],
};

export function canAccessPage(pathname: string, role: Role): boolean {
  // Exact match first
  if (PAGE_ROLES[pathname]) {
    return PAGE_ROLES[pathname].includes(role);
  }
  // Check prefix matches (e.g., /crm/settings/xxx matches /crm/settings)
  for (const [path, roles] of Object.entries(PAGE_ROLES)) {
    if (pathname.startsWith(path + "/")) {
      return roles.includes(role);
    }
  }
  // Default: /crm and sub-paths accessible to ADMIN and COUNSELOR
  if (pathname.startsWith("/crm")) {
    return role !== "HOSPITAL_STAFF";
  }
  return true;
}

export function hasRole(userRole: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(userRole);
}
