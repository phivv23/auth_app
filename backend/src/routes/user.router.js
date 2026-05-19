import { Router } from "express";
import bcrypt from "bcryptjs";
import { uploadAvatar } from "../config/upload.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  findPublicUserByEmail,
  findUserWithPasswordById,
  updateUserAvatar,
  updateUserPassword,
  updateUserProfile,
} from "../models/user.model.js";
import { deleteLocalUpload } from "../utils/file.js";

const router = Router();

const SALT_ROUNDS = 12;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function handleAvatarUpload(req, res, next) {
  uploadAvatar.single("avatar")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Avatar toi da 2MB.",
      });
    }

    return res.status(400).json({
      message: error.message || "File avatar khong hop le.",
    });
  });
}

/**
 * PATCH /api/users/me
 *
 * Update profile user hiện tại.
 *
 * Body:
 * {
 *   "name": "New Name",
 *   "email": "new@example.com"
 * }
 */
router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const { name, email } = req.body;

    /**
     * req.user đến từ middleware requireAuth.
     * Nghĩa là route này chỉ chạy nếu user đã login.
     */
    const currentUser = req.user;

    if (!name || !email) {
      return res.status(400).json({
        message: "Name và email là bắt buộc.",
      });
    }

    const normalizedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    if (normalizedName.length < 2) {
      return res.status(400).json({
        message: "Name phải có ít nhất 2 ký tự.",
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        message: "Email không hợp lệ.",
      });
    }

    /**
     * Nếu user đổi email, cần kiểm tra email mới đã bị user khác dùng chưa.
     */
    if (normalizedEmail !== currentUser.email) {
      const existingUser = await findPublicUserByEmail(normalizedEmail);

      if (existingUser && existingUser.id !== currentUser.id) {
        return res.status(409).json({
          message: "Email này đã được sử dụng bởi tài khoản khác.",
        });
      }
    }

    /**
     * Update name/email trong database.
     */
    const updatedUser = await updateUserProfile(currentUser.id, {
      name: normalizedName,
      email: normalizedEmail,
    });

    return res.json({
      message: "Cập nhật profile thành công.",
      user: updatedUser,
    });
  } catch (error) {
    /**
     * Phòng trường hợp race condition:
     * Hai request cùng đổi sang một email, database unique constraint sẽ báo lỗi.
     */
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Email này đã được sử dụng.",
      });
    }

    next(error);
  }
});

/**
 * PATCH /api/users/me/avatar
 *
 * Upload avatar cho user hien tai.
 *
 * FormData:
 * avatar: File
 */
router.patch(
  "/me/avatar",
  requireAuth,
  handleAvatarUpload,
  async (req, res, next) => {
    const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : "";

    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Vui long chon file avatar.",
        });
      }

      const previousAvatarUrl = req.user.avatarUrl;
      const updatedUser = await updateUserAvatar(req.user.id, avatarUrl);

      await deleteLocalUpload(previousAvatarUrl);

      return res.json({
        message: "Upload avatar thanh cong.",
        user: updatedUser,
      });
    } catch (error) {
      await deleteLocalUpload(avatarUrl);
      next(error);
    }
  }
);

/**
 * PATCH /api/users/me/password
 *
 * Đổi password.
 *
 * Body:
 * {
 *   "currentPassword": "123456",
 *   "newPassword": "abcdef"
 * }
 */
router.patch("/me/password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Password hiện tại và password mới là bắt buộc.",
      });
    }

    const rawCurrentPassword = String(currentPassword);
    const rawNewPassword = String(newPassword);

    if (rawNewPassword.length < 6) {
      return res.status(400).json({
        message: "Password mới phải có ít nhất 6 ký tự.",
      });
    }

    if (rawCurrentPassword === rawNewPassword) {
      return res.status(400).json({
        message: "Password mới không được giống password hiện tại.",
      });
    }

    /**
     * Cần lấy user kèm passwordHash để so sánh password hiện tại.
     */
    const user = await findUserWithPasswordById(req.user.id);

    if (!user) {
      return res.status(401).json({
        message: "User không tồn tại.",
      });
    }

    /**
     * Kiểm tra password hiện tại có đúng không.
     */
    const isCurrentPasswordCorrect = await bcrypt.compare(
      rawCurrentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordCorrect) {
      return res.status(401).json({
        message: "Password hiện tại không đúng.",
      });
    }

    /**
     * Hash password mới.
     * Không bao giờ lưu raw password vào database.
     */
    const newPasswordHash = await bcrypt.hash(rawNewPassword, SALT_ROUNDS);

    /**
     * Lưu passwordHash mới.
     */
    await updateUserPassword(user.id, newPasswordHash);

    return res.json({
      message: "Đổi password thành công.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
