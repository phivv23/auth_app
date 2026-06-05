import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearCookieOptions,
} from "../config/cookie.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  createUser as createUserModel,
  findPublicUserByEmail as findPublicUserByEmailModel,
  findUserByEmail as findUserByEmailModel,
  incrementUserTokenVersion as incrementUserTokenVersionModel,
} from "../models/user.model.js";
import {
  signAccessToken as signAccessTokenJwt,
  verifyAccessToken as verifyAccessTokenJwt,
} from "../utils/token.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { sendError } from "../utils/http.js";
import {
  validateLoginInput,
  validateRegisterInput,
} from "../validation/auth.validation.js";

const SALT_ROUNDS = 12;

function createAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyPrefix: "auth",
    message: "Bạn thử đăng nhập/đăng ký quá nhiều lần. Vui lòng thử lại sau.",
  });
}

/**
 * Chuẩn hóa user trước khi trả về frontend.
 *
 * Không bao giờ trả passwordHash.
 */
export function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio: user.bio,
    location: user.location,
    website: user.website,
    role: user.role || "user",
    accountStatus: user.accountStatus || "active",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function revokeValidSessionToken({
  token,
  verifyAccessToken,
  incrementUserTokenVersion,
}) {
  if (!token) {
    return;
  }

  let payload = null;

  try {
    payload = verifyAccessToken(token);
  } catch {
    return;
  }

  if (payload?.userId) {
    await incrementUserTokenVersion(payload.userId);
  }
}

export function createAuthRouter({
  authRateLimit = createAuthRateLimit(),
  createUser = createUserModel,
  findPublicUserByEmail = findPublicUserByEmailModel,
  findUserByEmail = findUserByEmailModel,
  incrementUserTokenVersion = incrementUserTokenVersionModel,
  passwordHasher = bcrypt,
  requireAuthMiddleware = requireAuth,
  signAccessToken = signAccessTokenJwt,
  verifyAccessToken = verifyAccessTokenJwt,
} = {}) {
  const router = Router();

/**
 * POST /api/auth/register
 *
 * Body:
 * {
 *   "name": "Nguyen Van A",
 *   "email": "a@example.com",
 *   "password": "123456"
 * }
 */
router.post("/register", authRateLimit, async (req, res, next) => {
  try {
    const validation = validateRegisterInput(req.body);

    if (validation.error) {
      return sendError(
        res,
        400,
        validation.error.message,
        validation.error.code,
        validation.error.fields
      );
    }

    const {
      name: normalizedName,
      email: normalizedEmail,
      password: rawPassword,
    } = validation.value;

    /**
     * Kiểm tra email đã tồn tại chưa.
     */
    const existingUser = await findPublicUserByEmail(normalizedEmail);

    if (existingUser) {
      return sendError(res, 409, "Email đã được sử dụng.", "EMAIL_TAKEN");
    }

    /**
     * Hash password trước khi lưu database.
     *
     * Tuyệt đối không lưu raw password.
     */
    const passwordHash = await passwordHasher.hash(rawPassword, SALT_ROUNDS);

    /**
     * INSERT user vào MySQL.
     */
    const user = await createUser({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
    });

    /**
     * Tạo JWT chứa user id.
     */
    const token = signAccessToken(user.id, user.tokenVersion || 0);

    /**
     * Set JWT vào HttpOnly cookie.
     */
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    return res.status(201).json({
      message: "Register thành công.",
      user: toPublicUser(user),
    });
  } catch (error) {
    /**
     * Nếu có lỗi bất ngờ, chuyển cho error handler cuối server.
     */
    next(error);
  }
});

/**
 * POST /api/auth/login
 *
 * Body:
 * {
 *   "email": "a@example.com",
 *   "password": "123456"
 * }
 */
router.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const validation = validateLoginInput(req.body);

    if (validation.error) {
      return sendError(
        res,
        400,
        validation.error.message,
        validation.error.code,
        validation.error.fields
      );
    }

    const { email: normalizedEmail, password: rawPassword } = validation.value;

    /**
     * SELECT user theo email.
     * Ở đây cần passwordHash để compare password.
     */
    const user = await findUserByEmail(normalizedEmail);

    /**
     * Không nói rõ email sai hay password sai.
     * Làm vậy để tránh lộ email nào đã đăng ký.
     */
    if (!user) {
      return sendError(
        res,
        401,
        "Email hoặc password không đúng.",
        "INVALID_CREDENTIALS"
      );
    }

    /**
     * So sánh password user nhập với passwordHash trong DB.
     */
    const isPasswordCorrect = await passwordHasher.compare(
      rawPassword,
      user.passwordHash
    );

    if (!isPasswordCorrect) {
      return sendError(
        res,
        401,
        "Email hoặc password không đúng.",
        "INVALID_CREDENTIALS"
      );
    }

    if (user.accountStatus === "banned") {
      return sendError(
        res,
        403,
        "Tài khoản này đã bị cấm đăng nhập.",
        "ACCOUNT_BANNED"
      );
    }

    /**
     * Password đúng -> tạo JWT mới.
     */
    const token = signAccessToken(user.id, user.tokenVersion || 0);

    /**
     * Set JWT vào cookie.
     */
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    return res.json({
      message: "Login thành công.",
      user: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 *
 * Với JWT lưu cookie, logout cần clear cookie và revoke token version.
 *
 * Lưu ý:
 * - Nếu cookie không có hoặc token không hợp lệ, logout vẫn thành công.
 * - Nếu token hợp lệ, tăng token_version để token cũ hết hiệu lực.
 */
router.post("/logout", async (req, res, next) => {
  try {
    await revokeValidSessionToken({
      token: req.cookies?.[AUTH_COOKIE_NAME],
      verifyAccessToken,
      incrementUserTokenVersion,
    });

    res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());

    return res.json({
      message: "Logout thành công.",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/auth/me
 *
 * Lấy current user.
 * requireAuth sẽ:
 * - đọc cookie
 * - verify JWT
 * - SELECT user từ database
 * - gắn user vào req.user
 */
router.get("/me", requireAuthMiddleware, (req, res) => {
  return res.json({
    user: req.user,
  });
});

  return router;
}

export default createAuthRouter();
