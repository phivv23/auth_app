export const roleOptions = [
  { value: "user", label: "User" },
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super admin" },
];

export const roleFilterOptions = [
  { value: "", label: "Tất cả quyền" },
  ...roleOptions,
];

export function isModeratorRole(role) {
  return ["moderator", "admin", "super_admin"].includes(role);
}

export function isAdminRole(role) {
  return ["admin", "super_admin"].includes(role);
}

export function isSuperAdminRole(role) {
  return role === "super_admin";
}

export function isPrivilegedAdminRole(role) {
  return ["admin", "super_admin"].includes(role);
}

export function canAccessReports(user) {
  return isModeratorRole(user?.role);
}

export function canManageAdminArea(user) {
  return isAdminRole(user?.role);
}

export function canManageRoles(user) {
  return isSuperAdminRole(user?.role);
}

export function canMutateTargetUser(actor, targetUser) {
  if (!actor || !targetUser || Number(actor.id) === Number(targetUser.id)) {
    return false;
  }

  if (isPrivilegedAdminRole(targetUser.role)) {
    return isSuperAdminRole(actor.role);
  }

  return isAdminRole(actor.role);
}

export function getRoleLabel(role) {
  return roleOptions.find((option) => option.value === role)?.label || role || "User";
}
