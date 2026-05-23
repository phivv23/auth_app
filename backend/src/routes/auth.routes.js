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

const router = Router();

const SALT_ROUNDS = 12;

/**
 * Validate email đơn giản.
 * Production có thể dùng thư viện như zod/yup/validator.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    /**
     * Kiểm tra thiếu field.
     */
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email và password là bắt buộc.",
      });
    }

    /**
     * Chuẩn hóa input.
     */
    const normalizedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const rawPassword = String(password);

    /**
     * Validate name.
     */
    if (normalizedName.length < 2) {
      return res.status(400).json({
        message: "Name phải có ít nhất 2 ký tự.",
      });
    }

    /**
     * Validate email.
     */
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        message: "Email không hợp lệ.",
      });
    }

    /**
     * Validate password.
     */
    if (rawPassword.length < 6) {
      return res.status(400).json({
        message: "Password phải có ít nhất 6 ký tự.",
      });
    }

    /**
     * Kiểm tra email đã tồn tại chưa.
     */
    const existingUser = await findPublicUserByEmail(normalizedEmail);

    if (existingUser) {
      return res.status(409).json({
        message: "Email đã được sử dụng.",
      });
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
    const token = signAccessToken(user.id);

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
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email và password là bắt buộc.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const rawPassword = String(password);

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
      return res.status(401).json({
        message: "Email hoặc password không đúng.",
      });
    }

    /**
     * So sánh password user nhập với passwordHash trong DB.
     */
    const isPasswordCorrect = await bcrypt.compare(
      rawPassword,
      user.passwordHash
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Email hoặc password không đúng.",
      });
    }

    /**
     * Password đúng -> tạo JWT mới.
     */
    const token = signAccessToken(user.id);

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
