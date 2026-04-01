export type ProjectRole = "ADMIN" | "EDITOR" | "VIEWER";

const ROLE_LEVEL: Record<ProjectRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
};

export function hasMinRole(
  userRole: ProjectRole | null,
  minRole: ProjectRole,
): boolean {
  if (!userRole) return false;
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}

export function canEdit(role: ProjectRole | null): boolean {
  return hasMinRole(role, "EDITOR");
}

export function canAdmin(role: ProjectRole | null): boolean {
  return hasMinRole(role, "ADMIN");
}
