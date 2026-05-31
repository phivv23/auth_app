import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  countAdmins,
  deleteUserById,
  findAdminComments,
  findAdminPosts,
  findAdminUserById,
  findAdminUsers,
  findUserDeletionAssets,
  getAdminOverview,
  updateUserRole,
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
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/role", async (req, res, next) => {
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

    if (
      Number(userId) === Number(req.user.id) &&
      validation.value.role !== "admin"
    ) {
      return sendError(
        res,
        400,
        "Admin không thể tự hạ quyền của chính mình.",
        "ADMIN_SELF_DEMOTION_NOT_ALLOWED"
      );
    }

    if (user.role === "admin" && validation.value.role !== "admin") {
      const adminCount = await countAdmins();

      if (adminCount <= 1) {
        return sendError(
          res,
          400,
          "Không thể hạ quyền admin cuối cùng.",
          "LAST_ADMIN_REQUIRED"
        );
      }
    }

    const updatedUser = await updateUserRole(userId, validation.value.role);

    return res.json({
      message: "Đã cập nhật quyền người dùng.",
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

    if (user.role === "admin") {
      const adminCount = await countAdmins();

      if (adminCount <= 1) {
        return sendError(
          res,
          400,
          "Không thể xóa admin cuối cùng.",
          "LAST_ADMIN_REQUIRED"
        );
      }
    }

    const uploadUrls = await findUserDeletionAssets(userId);
    await deleteUserById(userId);
    await deleteLocalUploads(uploadUrls);

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

    const post = await deletePostWithUploads(postId, req.user.id);

    if (!post) {
      return sendError(res, 404, "Không tìm thấy bài viết.", "POST_NOT_FOUND");
    }

    await createNotification({
      recipientId: post.userId,
      actorId: req.user.id,
      type: "admin_content_removed",
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

export default router;
