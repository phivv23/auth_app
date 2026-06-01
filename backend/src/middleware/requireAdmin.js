import { sendError } from "../utils/http.js";

export const MODERATION_ROLES = ["moderator", "admin", "super_admin"];
export const ADMIN_ROLES = ["admin", "super_admin"];
export const SUPER_ADMIN_ROLE = "super_admin";

export function isModeratorUser(user) {
  return MODERATION_ROLES.includes(user?.role);
}

export function isAdminUser(user) {
  return ADMIN_ROLES.includes(user?.role);
}

export function isSuperAdminUser(user) {
  return user?.role === SUPER_ADMIN_ROLE;
}

export function requireModerator(req, res, next) {
  if (!isModeratorUser(req.user)) {
    return sendError(
      res,
      403,
      "Bạn không có quyền xử lý báo cáo.",
      "MODERATOR_REQUIRED"
    );
  }

  return next();
}

export function requireAdmin(req, res, next) {
  if (!isAdminUser(req.user)) {
    return sendError(
      res,
      403,
      "Bạn không có quyền quản lý admin.",
      "ADMIN_REQUIRED"
    );
  }

  return next();
}

export function requireSuperAdmin(req, res, next) {
  if (!isSuperAdminUser(req.user)) {
    return sendError(
      res,
      403,
      "Chỉ super admin mới được thực hiện thao tác này.",
      "SUPER_ADMIN_REQUIRED"
    );
  }

  return next();
}
