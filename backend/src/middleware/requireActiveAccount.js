import { sendError } from "../utils/http.js";

export function isActiveAccount(user) {
  return !user?.accountStatus || user.accountStatus === "active";
}

export function requireActiveAccount(req, res, next) {
  if (!isActiveAccount(req.user)) {
    return sendError(
      res,
      403,
      "Tài khoản của bạn đang bị giới hạn nên không thể thực hiện thao tác này.",
      "ACCOUNT_RESTRICTED",
      {
        accountStatus: req.user?.accountStatus || "suspended",
      }
    );
  }

  return next();
}
