import { AUTH_COOKIE_NAME } from "../config/cookie.js";
import { findUserById } from "../models/user.model.js";
import { verifyAccessToken } from "../utils/token.js";

/**
 * Middleware bảo vệ route.
 *
 * Nếu request có JWT hợp lệ:
 * - verify token
 * - lấy user từ database
 * - gắn user vào req.user
 * - cho đi tiếp bằng next()
 *
 * Nếu không hợp lệ:
 * - trả 401
 */
export async function requireAuth(req, res, next) {
  try {
    /**
     * cookie-parser sẽ đọc Cookie header
     * và đưa dữ liệu vào req.cookies.
     */
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        message: "Bạn chưa đăng nhập.",
      });
    }

    /**
     * Decode + verify JWT.
     * Nếu token sai hoặc hết hạn, function này sẽ throw error.
     */
    const payload = verifyAccessToken(token);

    const userId = payload.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Token không hợp lệ.",
      });
    }

    /**
     * Query lại database để chắc user còn tồn tại.
     * Không nên chỉ tin dữ liệu trong JWT.
     */
    const user = await findUserById(userId);

    if (!user) {
      return res.status(401).json({
        message: "User không tồn tại.",
      });
    }

    /**
     * Gắn user vào request.
     * Các route phía sau có thể dùng req.user.
     */
    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token sai hoặc đã hết hạn.",
    });
  }
}


/**
 * optionalAuth:
 *
 * Khác với requireAuth.
 *
 * requireAuth:
 * - Không có token thì trả 401
 *
 * optionalAuth:
 * - Không có token thì vẫn cho đi tiếp
 * - Có token hợp lệ thì gắn req.user
 *
 * Dùng cho các API public nhưng muốn biết user hiện tại đã like post chưa.
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

    const user = await findUserById(userId);

    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    /**
     * Token sai thì bỏ qua.
     * Vì đây là optional auth, không chặn request.
     */
    next();
  }
}