import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import {
  isSuperAdminUser,
  requireAdmin,
  requireSuperAdmin,
} from "../middleware/requireAdmin.js";
import { findAdminAuditLogs, logAdminAction } from "../models/audit.model.js";
import {
  countAdmins,
  countSuperAdmins,
  deleteUserById,
  findAdminComments,
  findAdminPosts,
  findAdminUserById,
  findAdminUserRecentComments,
  findAdminUserRecentPosts,
  findAdminUserRecentReports,
  findAdminUsers,
  findUserDeletionAssets,
  getAdminOverview,
  PRIVILEGED_ADMIN_ROLE_VALUES,
  updateUserAccountStatus,
  updateUserRole,
  validateAdminAccountStatusInput,
  validateAdminContentActionInput,
  validateAdminRoleInput,
} from "../models/admin.model.js";
import { deleteComment, findCommentById } from "../models/comment.model.js";
import { createNotification } from "../models/notification.model.js";
import {
  deletePost,
  findPostById,
  findPostMediaByPostId,
} from "../models/post.model.js";
import { deleteLocalUpload } from "../utils/file.js";
import { sendError } from "../utils/http.js";

const router = Router();

function normalizePositiveInt(value, fallback = null) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : fallback;
}

async function deleteLocalUploads(urls = []) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  for (const url of uniqueUrls) {
    await deleteLocalUpload(url);
  }
}

async function deletePostWithUploads(postId, currentUserId) {
  const post = await findPostById(postId, currentUserId, {
    bypassVisibility: true,
  });

  if (!post) {
    return null;
  }

  const media = await findPostMediaByPostId(postId);
  const uploadUrls = [
    post.imageUrl,
    ...(media || []).map((item) => item.url),
  ];

  await deletePost(postId);
  await deleteLocalUploads(uploadUrls);

  return post;
}

function isPrivilegedAdminRole(role) {
  return PRIVILEGED_ADMIN_ROLE_VALUES.includes(role);
}

function requireSuperAdminForPrivilegedTarget(req, res, targetUser) {
  if (!isPrivilegedAdminRole(targetUser.role) || isSuperAdminUser(req.user)) {
    return false;
  }

  sendError(
    res,
    403,
    "Chỉ super admin mới được thao tác với admin khác.",
    "SUPER_ADMIN_REQUIRED_FOR_ADMIN_TARGET"
  );

  return true;
}

router.use(requireAuth, requireAdmin);

router.get("/overview", async (req, res, next) => {
  try {
    const overview = await getAdminOverview();

    return res.json({
      overview,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const result = await findAdminUsers({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      role: req.query.role,
      accountStatus: req.query.accountStatus,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/users/:id", async (req, res, next) => {
  try {
    const userId = normalizePositiveInt(req.params.id);

    if (!userId) {
      return sendError(res, 400, "User id không hợp lệ.", "INVALID_USER_ID");
    }

    const user = await findAdminUserById(userId);

    if (!user) {
      return sendError(res, 404, "Không tìm thấy người dùng.", "USER_NOT_FOUND");
    }

    const [posts, comments, reports, auditLogs] = await Promise.all([
      findAdminUserRecentPosts(userId),
      findAdminUserRecentComments(userId),
      findAdminUserRecentReports(userId),
      findAdminAuditLogs({ targetUserId: userId, limit: 10 }),
    ]);

    return res.json({
      user,
      posts,
      comments,
      reports,
      auditLogs: auditLogs.logs,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/role", requireSuperAdmin, async (req, res, next) => {
  try {
    const userId = normalizePositiveInt(req.params.id);

    if (!userId) {
      return sendError(res, 400, "User id không hợp lệ.", "INVALID_USER_ID");
    }

    const validation = validateAdminRoleInput(req.body);

    if (validation.error) {
      return sendError(
        res,
        400,
        validation.error.message,
        validation.error.code,
        validation.error.fields
      );
    }

    const user = await findAdminUserById(userId);

    if (!user) {
      return sendError(res, 404, "Không tìm thấy người dùng.", "USER_NOT_FOUND");
    }

    if (Number(userId) === Number(req.user.id)) {
      return sendError(
        res,
        400,
        "Super admin không thể tự đổi quyền của chính mình.",
        "SUPER_ADMIN_SELF_ROLE_CHANGE_NOT_ALLOWED"
      );
    }

    if (
      isPrivilegedAdminRole(user.role) &&
      !isPrivilegedAdminRole(validation.value.role)
    ) {
      const adminCount = await countAdmins();

      if (adminCount <= 1) {
        return sendError(
          res,
          400,
          "Không thể hạ quyền admin/super admin cuối cùng.",
          "LAST_PRIVILEGED_ADMIN_REQUIRED"
        );
      }
    }

    if (user.role === "super_admin" && validation.value.role !== "super_admin") {
      const superAdminCount = await countSuperAdmins();

      if (superAdminCount <= 1) {
        return sendError(
          res,
          400,
          "Không thể hạ quyền super admin cuối cùng.",
          "LAST_SUPER_ADMIN_REQUIRED"
        );
      }
    }

    const updatedUser = await updateUserRole(userId, validation.value.role);

    await logAdminAction({
      actorId: req.user.id,
      targetUserId: userId,
      action: "user.role.update",
      targetType: "user",
      targetId: userId,
      metadata: {
        previousRole: user.role,
        nextRole: validation.value.role,
      },
    });

    return res.json({
      message: "Đã cập nhật quyền người dùng.",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/status", async (req, res, next) => {
  try {
    const userId = normalizePositiveInt(req.params.id);

    if (!userId) {
      return sendError(res, 400, "User id không hợp lệ.", "INVALID_USER_ID");
    }

    if (Number(userId) === Number(req.user.id)) {
      return sendError(
        res,
        400,
        "Admin không thể tự đổi trạng thái tài khoản của chính mình.",
        "ADMIN_SELF_STATUS_NOT_ALLOWED"
      );
    }

    const validation = validateAdminAccountStatusInput(req.body);

    if (validation.error) {
      return sendError(
        res,
        400,
        validation.error.message,
        validation.error.code,
        validation.error.fields
      );
    }

    const user = await findAdminUserById(userId);

    if (!user) {
      return sendError(res, 404, "Không tìm thấy người dùng.", "USER_NOT_FOUND");
    }

    if (requireSuperAdminForPrivilegedTarget(req, res, user)) {
      return null;
    }

    if (
      isPrivilegedAdminRole(user.role) &&
      validation.value.accountStatus !== "active"
    ) {
      const adminCount = await countAdmins();

      if (adminCount <= 1) {
        return sendError(
          res,
          400,
          "Không thể giới hạn admin cuối cùng.",
          "LAST_PRIVILEGED_ADMIN_REQUIRED"
        );
      }
    }

    if (
      user.role === "super_admin" &&
      validation.value.accountStatus !== "active"
    ) {
      const superAdminCount = await countSuperAdmins();

      if (superAdminCount <= 1) {
        return sendError(
          res,
          400,
          "Không thể giới hạn super admin cuối cùng.",
          "LAST_SUPER_ADMIN_REQUIRED"
        );
      }
    }

    const updatedUser = await updateUserAccountStatus(
      userId,
      validation.value.accountStatus
    );

    await logAdminAction({
      actorId: req.user.id,
      targetUserId: userId,
      action: "user.status.update",
      targetType: "user",
      targetId: userId,
      metadata: {
        previousAccountStatus: user.accountStatus || "active",
        nextAccountStatus: validation.value.accountStatus,
        reason: validation.value.reason,
      },
    });

    await createNotification({
      recipientId: userId,
      actorId: req.user.id,
      type: "admin_account_status_update",
      metadata: {
        accountStatus: validation.value.accountStatus,
        reason: validation.value.reason,
      },
    });

    return res.json({
      message: "Đã cập nhật trạng thái tài khoản.",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    const userId = normalizePositiveInt(req.params.id);

    if (!userId) {
      return sendError(res, 400, "User id không hợp lệ.", "INVALID_USER_ID");
    }

    if (Number(userId) === Number(req.user.id)) {
      return sendError(
        res,
        400,
        "Admin không thể xóa chính mình.",
        "ADMIN_SELF_DELETE_NOT_ALLOWED"
      );
    }

    const user = await findAdminUserById(userId);

    if (!user) {
      return sendError(res, 404, "Không tìm thấy người dùng.", "USER_NOT_FOUND");
    }

    if (requireSuperAdminForPrivilegedTarget(req, res, user)) {
      return null;
    }

    if (isPrivilegedAdminRole(user.role)) {
      const adminCount = await countAdmins();

      if (adminCount <= 1) {
        return sendError(
          res,
          400,
          "Không thể xóa admin cuối cùng.",
          "LAST_PRIVILEGED_ADMIN_REQUIRED"
        );
      }
    }

    if (user.role === "super_admin") {
      const superAdminCount = await countSuperAdmins();

      if (superAdminCount <= 1) {
        return sendError(
          res,
          400,
          "Không thể xóa super admin cuối cùng.",
          "LAST_SUPER_ADMIN_REQUIRED"
        );
      }
    }

    const uploadUrls = await findUserDeletionAssets(userId);
    await deleteUserById(userId);
    await deleteLocalUploads(uploadUrls);

    await logAdminAction({
      actorId: req.user.id,
      targetUserId: null,
      action: "user.delete",
      targetType: "user",
      targetId: userId,
      metadata: {
        deletedUserName: user.name,
        deletedUserEmail: user.email,
        deletedUserRole: user.role,
        deletedAccountStatus: user.accountStatus || "active",
      },
    });

    return res.json({
      message: "Đã xóa người dùng và dữ liệu liên quan.",
      deleted: true,
      userId,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/posts", async (req, res, next) => {
  try {
    const result = await findAdminPosts({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      authorId: req.query.authorId,
      privacy: req.query.privacy,
      reportedOnly: req.query.reportedOnly === "1",
      minReports: req.query.minReports,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete("/posts/:id", async (req, res, next) => {
  try {
    const postId = normalizePositiveInt(req.params.id);

    if (!postId) {
      return sendError(res, 400, "Post id không hợp lệ.", "INVALID_POST_ID");
    }

    const validation = validateAdminContentActionInput(req.body);

    if (validation.error) {
      return sendError(
        res,
        400,
        validation.error.message,
        validation.error.code,
        validation.error.fields
      );
    }

    const post = await deletePostWithUploads(postId, req.user.id);

    if (!post) {
      return sendError(res, 404, "Không tìm thấy bài viết.", "POST_NOT_FOUND");
    }

    await createNotification({
      recipientId: post.userId,
      actorId: req.user.id,
      type: "admin_content_removed",
      metadata: {
        contentType: "post",
        reason: validation.value.reason,
        resolutionNote: validation.value.resolutionNote,
      },
    });

    await logAdminAction({
      actorId: req.user.id,
      targetUserId: post.userId,
      action: "content.post.remove",
      targetType: "post",
      targetId: postId,
      metadata: {
        reason: validation.value.reason,
        resolutionNote: validation.value.resolutionNote,
        title: post.title,
      },
    });

    return res.json({
      message: "Đã gỡ bài viết.",
      deleted: true,
      postId,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/comments", async (req, res, next) => {
  try {
    const result = await findAdminComments({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      authorId: req.query.authorId,
      reportedOnly: req.query.reportedOnly === "1",
      minReports: req.query.minReports,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete("/comments/:id", async (req, res, next) => {
  try {
    const commentId = normalizePositiveInt(req.params.id);

    if (!commentId) {
      return sendError(
        res,
        400,
        "Comment id không hợp lệ.",
        "INVALID_COMMENT_ID"
      );
    }

    const validation = validateAdminContentActionInput(req.body);

    if (validation.error) {
      return sendError(
        res,
        400,
        validation.error.message,
        validation.error.code,
        validation.error.fields
      );
    }

    const comment = await findCommentById(commentId);

    if (!comment) {
      return sendError(
        res,
        404,
        "Không tìm thấy bình luận.",
        "COMMENT_NOT_FOUND"
      );
    }

    await deleteComment(commentId);
    await createNotification({
      recipientId: comment.userId,
      actorId: req.user.id,
      type: "admin_content_removed",
      metadata: {
        contentType: "comment",
        reason: validation.value.reason,
        resolutionNote: validation.value.resolutionNote,
      },
    });

    await logAdminAction({
      actorId: req.user.id,
      targetUserId: comment.userId,
      action: "content.comment.remove",
      targetType: "comment",
      targetId: commentId,
      metadata: {
        reason: validation.value.reason,
        resolutionNote: validation.value.resolutionNote,
        postId: comment.postId,
      },
    });

    return res.json({
      message: "Đã gỡ bình luận.",
      deleted: true,
      commentId,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/audit-logs", async (req, res, next) => {
  try {
    const result = await findAdminAuditLogs({
      page: req.query.page,
      limit: req.query.limit,
      actorId: req.query.actorId,
      targetUserId: req.query.targetUserId,
      action: req.query.action,
      targetType: req.query.targetType,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
