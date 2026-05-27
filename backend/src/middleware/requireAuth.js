import { AUTH_COOKIE_NAME } from "../config/cookie.js";
import { findAuthUserById } from "../models/user.model.js";
import { sendError } from "../utils/http.js";
import { verifyAccessToken } from "../utils/token.js";

function toRequestUser(user) {
  const { tokenVersion, ...requestUser } = user;
  return requestUser;
}

function isTokenVersionValid(payload, user) {
  return Number(payload.tokenVersion ?? 0) === Number(user.tokenVersion || 0);
}

/**
 * Verify cookie JWT, reload the user from DB, and reject revoked sessions.
 */
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      return sendError(res, 401, "Bạn chưa đăng nhập.", "AUTH_REQUIRED");
    }

    const payload = verifyAccessToken(token);
    const userId = payload.userId;

    if (!userId) {
      return sendError(res, 401, "Token không hợp lệ.", "INVALID_TOKEN");
    }

    const user = await findAuthUserById(userId);

    if (!user) {
      return sendError(res, 401, "User không tồn tại.", "USER_NOT_FOUND");
    }

    if (!isTokenVersionValid(payload, user)) {
      return sendError(
        res,
        401,
        "Phiên đăng nhập đã hết hiệu lực.",
        "SESSION_REVOKED"
      );
    }

    req.user = toRequestUser(user);
    return next();
  } catch {
    return sendError(
      res,
      401,
      "Token sai hoặc đã hết hạn.",
      "INVALID_TOKEN"
    );
  }
}

/**
 * Attach req.user when a valid session exists, but keep public routes public.
 */
export async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      return next();
    }

    const payload = verifyAccessToken(token);
    const userId = payload.userId;

    if (!userId) {
      return next();
    }

    const user = await findAuthUserById(userId);

    if (user && isTokenVersionValid(payload, user)) {
      req.user = toRequestUser(user);
    }

    return next();
  } catch {
    return next();
  }
}
