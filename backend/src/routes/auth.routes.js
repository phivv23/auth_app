import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearCookieOptions,
} from "../config/cookie.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  createUser,
  findPublicUserByEmail,
  findUserByEmail,
} from "../models/user.model.js";
import { signAccessToken } from "../utils/token.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { sendError } from "../utils/http.js";
import {
  validateLoginInput,
  validateRegisterInput,
} from "../validation/auth.validation.js";

const router = Router();

const SALT_ROUNDS = 12;
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: "auth",
  message: "Bạn thử đăng nhập/đăng ký quá nhiều lần. Vui lòng thử lại sau.",
});

/**
 * Chuẩn hóa user trước khi trả về frontend.
 *
 * Không bao giờ trả passwordHash.
 */
function toPublicUser(user) {
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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

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
    const passwordHash = await bcrypt.hash(rawPassword, SALT_ROUNDS);

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
    const isPasswordCorrect = await bcrypt.compare(
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
 * Với JWT lưu cookie, logout cơ bản là clear cookie.
 *
 * Lưu ý:
 * - JWT là stateless.
 * - Nếu token bị copy ra ngoài trước khi logout, token đó vẫn hợp lệ đến khi hết hạn.
 * - Production thường dùng thêm refresh token hoặc token blacklist.
 */
router.post("/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());

  return res.json({
    message: "Logout thành công.",
  });
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
router.get("/me", requireAuth, (req, res) => {
  return res.json({
    user: req.user,
  });
});

export default router;
