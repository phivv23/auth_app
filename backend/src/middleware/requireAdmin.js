import { sendError } from "../utils/http.js";

export function isAdminUser(user) {
  return user?.role === "admin";
}

export function requireAdmin(req, res, next) {
  if (!isAdminUser(req.user)) {
    return sendError(
      res,
      403,
      "Bạn không có quyền quản trị.",
      "ADMIN_REQUIRED"
    );
  }

  return next();
}
