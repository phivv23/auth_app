import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/requireAuth.js";
import {
  createPost,
  deletePost,
  findFeedPosts,
  findPostById,
  findPosts,
  postExists,
  updatePost,
} from "../models/post.model.js";
import { togglePostLike } from "../models/like.model.js";
import {
  createComment,
  deleteComment,
  findCommentById,
  findCommentsByPostId,
  updateComment,
} from "../models/comment.model.js";
import { uploadPostImage } from "../config/upload.js";
import { deleteLocalUpload } from "../utils/file.js";
import { createNotification } from "../models/notification.model.js";

const router = Router();

function normalizePositiveInt(value, fallback) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return number;
}

function validatePostInput({ title, content }) {
  const normalizedTitle = String(title || "").trim();
  const normalizedContent = String(content || "").trim();

  if (normalizedTitle.length < 3) {
    return {
      error: "Title phải có ít nhất 3 ký tự.",
    };
  }

  if (normalizedContent.length < 10) {
    return {
      error: "Content phải có ít nhất 10 ký tự.",
    };
  }

  return {
    title: normalizedTitle,
    content: normalizedContent,
  };
}

function handlePostImageUpload(req, res, next) {
  uploadPostImage.single("image")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Ảnh bài viết tối đa 5MB",
      });
    }

    return res.status(400).json({
      message: error.message || "Upload ảnh bài viết thất bại",
    });
  });
}

function validateCommentInput(content) {
  const normalizedContent = String(content || "").trim();

  if (normalizedContent.length < 1) {
    return {
      error: "Comment không được để trống.",
    };
  }

  if (normalizedContent.length > 1000) {
    return {
      error: "Comment không được vượt quá 1000 ký tự.",
    };
  }

  return {
    content: normalizedContent,
  };
}

/**
 * GET /api/posts
 *
 * Public API.
 *
 * Query:
 * ?page=1&limit=10&search=react
 */
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);

    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);

    const search = String(req.query.search || "").trim();

    const currentUserId = req.user?.id || null;

    const result = await findPosts({
      page,
      limit,
      search,
      currentUserId,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/posts/me
 *
 * Lấy danh sách bài viết của user hiện tại.
 *
 * Cần đặt route này TRƯỚC /:id.
 * Nếu đặt sau /:id, Express có thể hiểu "me" là id.
 */
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);

    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);

    const search = String(req.query.search || "").trim();

    const result = await findPosts({
      page,
      limit,
      search,
      currentUserId: req.user.id,
      authorId: req.user.id,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/feed", requireAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);

    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);

    const result = await findFeedPosts({
      page,
      limit,
      currentUserId: req.user.id,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/posts/:id
 *
 * Public API.
 */
router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);

    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({
        message: "Post id không hợp lệ.",
      });
    }

    const currentUserId = req.user?.id || null;

    const post = await findPostById(postId, currentUserId);

    if (!post) {
      return res.status(404).json({
        message: "Post không tồn tại.",
      });
    }

    return res.json({
      post,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/posts
 *
 * Cần login.
 *
 * Body:
 * {
 *   "title": "Tiêu đề",
 *   "content": "Nội dung bài viết"
 * }
 */
router.post("/", requireAuth, handlePostImageUpload, async (req, res, next) => {
  const imageUrl = req.file ? `/uploads/posts/${req.file.filename}` : null;

  try {
    const { title, content } = req.body;
    const result = validatePostInput({ title, content });

    if (result.error) {
      await deleteLocalUpload(imageUrl);
      return res.status(400).json({
        message: result.error,
      });
    }

    const post = await createPost(req.user.id, {
      title: result.title,
      content: result.content,
      imageUrl,
    });

    res.status(201).json({
      message: "Tạo bài viết thành công",
      post,
    });
  } catch (error) {
    await deleteLocalUpload(imageUrl);
    next(error);
  }
});

/**
 * PATCH /api/posts/:id
 *
 * Chỉ tác giả bài viết mới được sửa.
 */
router.patch(
  "/:id",
  requireAuth,
  handlePostImageUpload,
  async (req, res, next) => {
    const imageUrl = req.file
      ? `/uploads/posts/${req.file.filename}`
      : null;

    try {
      const postId = Number(req.params.id);

      if (!Number.isInteger(postId) || postId <= 0) {
        await deleteLocalUpload(imageUrl);

        return res.status(400).json({
          message: "Post id không hợp lệ",
        });
      }

      const existingPost = await findPostById(postId, req.user.id);

      if (!existingPost) {
        await deleteLocalUpload(imageUrl);

        return res.status(404).json({
          message: "Không tìm thấy bài viết",
        });
      }

      if (existingPost.userId !== req.user.id) {
        await deleteLocalUpload(imageUrl);

        return res.status(403).json({
          message: "Bạn không có quyền sửa bài viết này",
        });
      }

      const { title, content } = req.body;
      const result = validatePostInput({ title, content });

      if (result.error) {
        await deleteLocalUpload(imageUrl);

        return res.status(400).json({
          message: result.error,
        });
      }

      const updatedPost = await updatePost(postId, {
        title: result.title,
        content: result.content,
        imageUrl,
      });

      if (imageUrl) {
        await deleteLocalUpload(existingPost.imageUrl);
      }

      res.json({
        message: "Cập nhật bài viết thành công",
        post: updatedPost,
      });
    } catch (error) {
      await deleteLocalUpload(imageUrl);
      next(error);
    }
  }
);

/**
 * DELETE /api/posts/:id
 *
 * Chỉ tác giả bài viết mới được xóa.
 */
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);

    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({
        message: "Post id không hợp lệ",
      });
    }

    const existingPost = await findPostById(postId, req.user.id);

    if (!existingPost) {
      return res.status(404).json({
        message: "Không tìm thấy bài viết",
      });
    }

    if (existingPost.userId !== req.user.id) {
      return res.status(403).json({
        message: "Bạn không có quyền xóa bài viết này",
      });
    }

    await deletePost(postId);

    await deleteLocalUpload(existingPost.imageUrl);

    res.json({
      message: "Xóa bài viết thành công",
    });
  } catch (error) {
    next(error);
  }
});
/**
 * GET /api/posts/:postId/comments
 *
 * Public API.
 */
router.get("/:postId/comments", async (req, res, next) => {
  try {
    const postId = Number(req.params.postId);

    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({
        message: "Post id không hợp lệ.",
      });
    }

    const exists = await postExists(postId);

    if (!exists) {
      return res.status(404).json({
        message: "Post không tồn tại.",
      });
    }

    const comments = await findCommentsByPostId(postId);

    return res.json({
      comments,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/posts/:postId/comments
 *
 * Cần login.
 */
router.post("/:postId/comments", requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.postId);

    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({
        message: "Post id không hợp lệ.",
      });
    }

    const post = await findPostById(postId, req.user.id);

    if (!post) {
      return res.status(404).json({
        message: "Post không tồn tại.",
      });
    }

    const result = validateCommentInput(req.body.content);

    if (result.error) {
      return res.status(400).json({
        message: result.error,
      });
    }

    const comment = await createComment(postId, req.user.id, result.content);

    await createNotification({
      recipientId: post.userId,
      actorId: req.user.id,
      type: "post_comment",
      postId,
      commentId: comment.id,
    });

    return res.status(201).json({
      message: "Tạo comment thành công.",
      comment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/posts/comments/:commentId
 *
 * Chỉ tác giả comment mới được sửa.
 *
 * Ta dùng path này để tránh đụng với /api/posts/:id.
 */
router.patch("/comments/:commentId", requireAuth, async (req, res, next) => {
  try {
    const commentId = Number(req.params.commentId);

    if (!Number.isInteger(commentId) || commentId <= 0) {
      return res.status(400).json({
        message: "Comment id không hợp lệ.",
      });
    }

    const comment = await findCommentById(commentId);

    if (!comment) {
      return res.status(404).json({
        message: "Comment không tồn tại.",
      });
    }

    if (comment.userId !== req.user.id) {
      return res.status(403).json({
        message: "Bạn không có quyền sửa comment này.",
      });
    }

    const result = validateCommentInput(req.body.content);

    if (result.error) {
      return res.status(400).json({
        message: result.error,
      });
    }

    const updatedComment = await updateComment(commentId, result.content);

    return res.json({
      message: "Cập nhật comment thành công.",
      comment: updatedComment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/posts/comments/:commentId
 *
 * Chỉ tác giả comment mới được xóa.
 */
router.delete("/comments/:commentId", requireAuth, async (req, res, next) => {
  try {
    const commentId = Number(req.params.commentId);

    if (!Number.isInteger(commentId) || commentId <= 0) {
      return res.status(400).json({
        message: "Comment id không hợp lệ.",
      });
    }

    const comment = await findCommentById(commentId);

    if (!comment) {
      return res.status(404).json({
        message: "Comment không tồn tại.",
      });
    }

    if (comment.userId !== req.user.id) {
      return res.status(403).json({
        message: "Bạn không có quyền xóa comment này.",
      });
    }

    await deleteComment(commentId);

    return res.json({
      message: "Xóa comment thành công.",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/posts/:postId/like
 *
 * Toggle like.
 *
 * Nếu chưa like thì like.
 * Nếu đã like thì unlike.
 */
router.post("/:postId/like", requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.postId);

    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({
        message: "Post id không hợp lệ.",
      });
    }

    const post = await findPostById(postId, req.user.id);

    if (!post) {
      return res.status(404).json({
        message: "Post không tồn tại.",
      });
    }

    const result = await togglePostLike(postId, req.user.id);

    // Chỉ tạo notification khi like, không tạo khi unlike.
    if (result.liked) {
      await createNotification({
        recipientId: post.userId,
        actorId: req.user.id,
        type: "post_like",
        postId,
      });
    }

    return res.json({
      message: result.liked ? "Đã like post." : "Đã bỏ like post.",
      liked: result.liked,
      likeCount: result.likeCount,
    });
  } catch (error) {
    /**
     * Phòng trường hợp race condition.
     * Ví dụ user click like rất nhanh tạo trùng unique key.
     */
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Bạn đã like post này rồi.",
      });
    }

    next(error);
  }
});

export default router;
