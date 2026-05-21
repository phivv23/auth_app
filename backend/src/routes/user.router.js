import { Router } from "express";
import bcrypt from "bcryptjs";
import { requireAuth, optionalAuth } from "../middleware/requireAuth.js";
import {
  findPublicUserByEmail,
  findUserWithPasswordById,
  updateUserPassword,
  updateUserProfile,
  updateUserAvatar,
  findPublicUserProfileById,
  searchPublicUsers,
  findSuggestedUsers,
} from "../models/user.model.js";
import { uploadAvatar } from "../config/upload.js";
import { deleteLocalUpload } from "../utils/file.js";
import { findPosts } from "../models/post.model.js";
import {
  followUser,
  unfollowUser,
  findFollowers,
  findFollowing,
} from "../models/follow.model.js";
import { createNotification } from "../models/notification.model.js";

const router = Router();

const SALT_ROUNDS = 12;

function parsePositiveInt(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

function handleAvatarUpload(req, res, next) {
  uploadAvatar.single("avatar")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Avatar tối đa 2MB",
      });
    }

    return res.status(400).json({
      message: error.message || "Upload avatar thất bại",
    });
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePositiveInt(value, fallback) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return number;
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

router.patch(
  "/me/avatar",
  requireAuth,
  handleAvatarUpload,
  async (req, res, next) => {
    const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : "";

    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Vui lòng chọn file avatar",
        });
      }

      const oldAvatarUrl = req.user.avatarUrl;

      const updatedUser = await updateUserAvatar(req.user.id, avatarUrl);

      // Xóa avatar cũ sau khi DB đã update thành công
      await deleteLocalUpload(oldAvatarUrl);

      res.json({
        message: "Upload avatar thành công",
        user: updatedUser,
      });
    } catch (error) {
      await deleteLocalUpload(avatarUrl);
      next(error);
    }
  }
);

router.get("/search", optionalAuth, async (req, res, next) => {
  try {
    const keyword = String(req.query.keyword || "").trim();
    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);

    if (!keyword) {
      return res.json({
        users: [],
        page,
        limit,
        total: 0,
        totalPages: 0,
      });
    }

    const result = await searchPublicUsers({
      keyword,
      currentUserId: req.user?.id || null,
      page,
      limit,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/suggestions", requireAuth, async (req, res, next) => {
  try {
    const requestedLimit = normalizePositiveInt(req.query.limit, 5);
    const limit = Math.min(requestedLimit, 20);

    const users = await findSuggestedUsers({
      currentUserId: req.user.id,
      limit,
    });

    res.json({
      users,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/follow", requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parsePositiveInt(req.params.id);

    if (!targetUserId) {
      return res.status(400).json({
        message: "User id không hợp lệ",
      });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({
        message: "Bạn không thể follow chính mình",
      });
    }

    const targetProfile = await findPublicUserProfileById(
      targetUserId,
      req.user.id
    );

    if (!targetProfile) {
      return res.status(404).json({
        message: "Không tìm thấy user",
      });
    }

    await followUser(req.user.id, targetUserId);

    await createNotification({
      recipientId: targetUserId,
      actorId: req.user.id,
      type: "follow",
    });

    const updatedProfile = await findPublicUserProfileById(
      targetUserId,
      req.user.id
    );

    res.json({
      message: "Follow thành công",
      profile: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/follow", requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parsePositiveInt(req.params.id);

    if (!targetUserId) {
      return res.status(400).json({
        message: "User id không hợp lệ",
      });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({
        message: "Bạn không thể unfollow chính mình",
      });
    }

    const targetProfile = await findPublicUserProfileById(
      targetUserId,
      req.user.id
    );

    if (!targetProfile) {
      return res.status(404).json({
        message: "Không tìm thấy user",
      });
    }

    await unfollowUser(req.user.id, targetUserId);

    const updatedProfile = await findPublicUserProfileById(
      targetUserId,
      req.user.id
    );

    res.json({
      message: "Unfollow thành công",
      profile: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/posts", optionalAuth, async (req, res, next) => {
  try {
    const userId = parsePositiveInt(req.params.id);

    if (!userId) {
      return res.status(400).json({
        message: "User id không hợp lệ",
      });
    }

    const profile = await findPublicUserProfileById(
      userId,
      req.user?.id || null
    );

    if (!profile) {
      return res.status(404).json({
        message: "Không tìm thấy user",
      });
    }

    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);
    const search = req.query.search || "";

    const result = await findPosts({
      page,
      limit,
      search,
      authorId: userId,
      currentUserId: req.user?.id || null,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/followers", optionalAuth, async (req, res, next) => {
  try {
    const userId = parsePositiveInt(req.params.id);

    if (!userId) {
      return res.status(400).json({
        message: "User id không hợp lệ",
      });
    }

    const profile = await findPublicUserProfileById(
      userId,
      req.user?.id || null
    );

    if (!profile) {
      return res.status(404).json({
        message: "Không tìm thấy user",
      });
    }

    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);

    const result = await findFollowers({
      userId,
      currentUserId: req.user?.id || null,
      page,
      limit,
    });

    res.json({
      profile,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/following", optionalAuth, async (req, res, next) => {
  try {
    const userId = parsePositiveInt(req.params.id);

    if (!userId) {
      return res.status(400).json({
        message: "User id không hợp lệ",
      });
    }

    const profile = await findPublicUserProfileById(
      userId,
      req.user?.id || null
    );

    if (!profile) {
      return res.status(404).json({
        message: "Không tìm thấy user",
      });
    }

    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);

    const result = await findFollowing({
      userId,
      currentUserId: req.user?.id || null,
      page,
      limit,
    });

    res.json({
      profile,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const userId = parsePositiveInt(req.params.id);

    if (!userId) {
      return res.status(400).json({
        message: "User id không hợp lệ",
      });
    }

    const profile = await findPublicUserProfileById(
      userId,
      req.user?.id || null
    );

    if (!profile) {
      return res.status(404).json({
        message: "Không tìm thấy user",
      });
    }

    res.json({
      profile,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
