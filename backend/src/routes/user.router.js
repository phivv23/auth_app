import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
} from "../config/cookie.js";
import { requireAuth, optionalAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import {
  findUserById,
  findPublicUserByEmail,
  findUserWithPasswordById,
  updateUserPassword,
  updateUserProfile,
  updateUserAvatar,
  updateUserCover,
  findPublicUserProfileById,
  searchPublicUsers,
  findSuggestedUsers,
} from "../models/user.model.js";
import { uploadAvatar, uploadCover } from "../config/upload.js";
import { deleteLocalUpload } from "../utils/file.js";
import { findPosts } from "../models/post.model.js";
import {
  followUser,
  unfollowUser,
  findFollowers,
  findFollowing,
} from "../models/follow.model.js";
import { createNotification } from "../models/notification.model.js";
import {
  blockUser,
  isBlockedBetween,
  unblockUser,
} from "../models/block.model.js";
import { sendError } from "../utils/http.js";
import { signAccessToken } from "../utils/token.js";
import {
  validatePasswordChangeInput,
  validateProfileInput,
} from "../validation/auth.validation.js";

const router = Router();

const SALT_ROUNDS = 12;

export function createChangePasswordHandler({
  findUserWithPasswordById: findUserWithPassword = findUserWithPasswordById,
  passwordHasher = bcrypt,
  signAccessToken: signToken = signAccessToken,
  updateUserPassword: updatePassword = updateUserPassword,
} = {}) {
  return async (req, res, next) => {
    try {
      const validation = validatePasswordChangeInput(req.body);

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
        currentPassword: rawCurrentPassword,
        newPassword: rawNewPassword,
      } = validation.value;

      /**
       * Cần lấy user kèm passwordHash để so sánh password hiện tại.
       */
      const user = await findUserWithPassword(req.user.id);

      if (!user) {
        return sendError(res, 401, "User không tồn tại.", "USER_NOT_FOUND");
      }

      /**
       * Kiểm tra password hiện tại có đúng không.
       */
      const isCurrentPasswordCorrect = await passwordHasher.compare(
        rawCurrentPassword,
        user.passwordHash
      );

      if (!isCurrentPasswordCorrect) {
        return sendError(
          res,
          401,
          "Password hiện tại không đúng.",
          "INVALID_CURRENT_PASSWORD"
        );
      }

      /**
       * Hash password mới.
       * Không bao giờ lưu raw password vào database.
       */
      const newPasswordHash = await passwordHasher.hash(
        rawNewPassword,
        SALT_ROUNDS
      );

      /**
       * Lưu passwordHash mới.
       */
      const updatedUser = await updatePassword(user.id, newPasswordHash);
      const token = signToken(updatedUser.id, updatedUser.tokenVersion || 0);

      res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

      return res.json({
        message: "Đổi password thành công.",
      });
    } catch (error) {
      return next(error);
    }
  };
}

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

function handleCoverUpload(req, res, next) {
  uploadCover.single("cover")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Ảnh bìa tối đa 5MB",
      });
    }

    return res.status(400).json({
      message: error.message || "Upload ảnh bìa thất bại",
    });
  });
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
    const validation = validateProfileInput(req.body);

    if (validation.error) {
      return sendError(
        res,
        400,
        validation.error.message,
        validation.error.code,
        validation.error.fields
      );
    }

    /**
     * req.user đến từ middleware requireAuth.
     * Nghĩa là route này chỉ chạy nếu user đã login.
     */
    const currentUser = req.user;
    const {
      name: normalizedName,
      email: normalizedEmail,
      bio,
      location,
      website,
      profilePrivacy,
    } = validation.value;

    /**
     * Nếu user đổi email, cần kiểm tra email mới đã bị user khác dùng chưa.
     */
    if (normalizedEmail !== currentUser.email) {
      const existingUser = await findPublicUserByEmail(normalizedEmail);

      if (existingUser && existingUser.id !== currentUser.id) {
        return sendError(
          res,
          409,
          "Email này đã được sử dụng bởi tài khoản khác.",
          "EMAIL_TAKEN"
        );
      }
    }

    /**
     * Update name/email trong database.
     */
    const updatedUser = await updateUserProfile(currentUser.id, {
      name: normalizedName,
      email: normalizedEmail,
      bio,
      location,
      website,
      profilePrivacy,
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
      return sendError(
        res,
        409,
        "Email này đã được sử dụng.",
        "EMAIL_TAKEN"
      );
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
router.patch("/me/password", requireAuth, createChangePasswordHandler());

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

router.patch(
  "/me/cover",
  requireAuth,
  handleCoverUpload,
  async (req, res, next) => {
    const coverUrl = req.file ? `/uploads/covers/${req.file.filename}` : "";

    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Vui lòng chọn file ảnh bìa",
        });
      }

      const oldCoverUrl = req.user.coverUrl;

      const updatedUser = await updateUserCover(req.user.id, coverUrl);

      await deleteLocalUpload(oldCoverUrl);

      res.json({
        message: "Upload ảnh bìa thành công",
        user: updatedUser,
      });
    } catch (error) {
      await deleteLocalUpload(coverUrl);
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

router.post("/:id/block", requireAuth, requireActiveAccount, async (req, res, next) => {
  try {
    const targetUserId = parsePositiveInt(req.params.id);

    if (!targetUserId) {
      return sendError(res, 400, "User id không hợp lệ.", "VALIDATION_ERROR");
    }

    if (targetUserId === req.user.id) {
      return sendError(
        res,
        400,
        "Bạn không thể block chính mình.",
        "VALIDATION_ERROR"
      );
    }

    const targetUser = await findUserById(targetUserId);

    if (!targetUser) {
      return sendError(res, 404, "Không tìm thấy user.", "USER_NOT_FOUND");
    }

    await blockUser(req.user.id, targetUserId);

    const profile = await findPublicUserProfileById(targetUserId, req.user.id);

    return res.json({
      message: "Đã block user.",
      profile: profile || {
        id: targetUserId,
        name: targetUser.name,
        avatarUrl: targetUser.avatarUrl,
        coverUrl: targetUser.coverUrl,
        blockedByMe: true,
        hasBlockedMe: true,
        isBlocked: true,
        isFollowing: false,
        friendshipStatus: "none",
      },
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/block", requireAuth, requireActiveAccount, async (req, res, next) => {
  try {
    const targetUserId = parsePositiveInt(req.params.id);

    if (!targetUserId) {
      return sendError(res, 400, "User id không hợp lệ.", "VALIDATION_ERROR");
    }

    if (targetUserId === req.user.id) {
      return sendError(
        res,
        400,
        "Bạn không thể unblock chính mình.",
        "VALIDATION_ERROR"
      );
    }

    const targetUser = await findUserById(targetUserId);

    if (!targetUser) {
      return sendError(res, 404, "Không tìm thấy user.", "USER_NOT_FOUND");
    }

    await unblockUser(req.user.id, targetUserId);

    const profile = await findPublicUserProfileById(targetUserId, req.user.id);

    return res.json({
      message: "Đã bỏ block user.",
      profile: profile || {
        id: targetUserId,
        name: targetUser.name,
        avatarUrl: targetUser.avatarUrl,
        coverUrl: targetUser.coverUrl,
        blockedByMe: false,
        hasBlockedMe: true,
        isBlocked: true,
        isFollowing: false,
        friendshipStatus: "none",
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/follow", requireAuth, requireActiveAccount, async (req, res, next) => {
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

    if (await isBlockedBetween(req.user.id, targetUserId)) {
      return sendError(
        res,
        403,
        "Không thể follow user đã block hoặc đã block bạn.",
        "USER_BLOCKED"
      );
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

router.delete("/:id/follow", requireAuth, requireActiveAccount, async (req, res, next) => {
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

    if (!profile.canViewProfile) {
      return sendError(
        res,
        403,
        "Bạn không có quyền xem bài viết trên profile này.",
        "PROFILE_PRIVATE"
      );
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

    if (!profile.canViewProfile) {
      return sendError(
        res,
        403,
        "Bạn không có quyền xem danh sách followers này.",
        "PROFILE_PRIVATE"
      );
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

    if (!profile.canViewProfile) {
      return sendError(
        res,
        403,
        "Bạn không có quyền xem danh sách following này.",
        "PROFILE_PRIVATE"
      );
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
