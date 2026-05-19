import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/requireAuth.js";
import {createPost, deletePost, findPostById, findPosts, postExists, updatePost} from "../models/post.model.js";
import { togglePostLike } from "../models/like.model.js";
import {
  createComment,
  deleteComment,
  findCommentById,
  findCommentsByPostId,
  updateComment,
} from "../models/comment.model.js";

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
 * ?page=1&limit=10
 */
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);

    /**
     * Giới hạn limit tối đa để tránh query quá nặng.
     */
    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);

    const currentUserId = req.user?.id || null;

    const result = await findPosts({
      page,
      limit,
      currentUserId,
      search: req.query.search,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/posts/me
 *
 * Lấy danh sách bài viết của user đang đăng nhập.
 */
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);

    const result = await findPosts({
      page,
      limit,
      currentUserId: req.user.id,
      search: req.query.search,
      authorId: req.user.id,
    });

    return res.json(result);
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
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const result = validatePostInput(req.body);

    if (result.error) {
      return res.status(400).json({
        message: result.error,
      });
    }

    const post = await createPost(req.user.id, {
      title: result.title,
      content: result.content,
    });

    return res.status(201).json({
      message: "Tạo post thành công.",
      post,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/posts/:id
 *
 * Chỉ tác giả bài viết mới được sửa.
 */
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);

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

    /**
     * Chỉ author mới được sửa post.
     */
    if (post.userId !== req.user.id) {
      return res.status(403).json({
        message: "Bạn không có quyền sửa post này.",
      });
    }

    const result = validatePostInput(req.body);

    if (result.error) {
      return res.status(400).json({
        message: result.error,
      });
    }

    await updatePost(postId, {
      title: result.title,
      content: result.content,
    });

    const updatedPost = await findPostById(postId, req.user.id);

    return res.json({
      message: "Cập nhật post thành công.",
      post: updatedPost,
    });
  } catch (error) {
    next(error);
  }
});

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
        message: "Post id không hợp lệ.",
      });
    }

    const post = await findPostById(postId, req.user.id);

    if (!post) {
      return res.status(404).json({
        message: "Post không tồn tại.",
      });
    }

    if (post.userId !== req.user.id) {
      return res.status(403).json({
        message: "Bạn không có quyền xóa post này.",
      });
    }

    await deletePost(postId);

    return res.json({
      message: "Xóa post thành công.",
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

    const exists = await postExists(postId);

    if (!exists) {
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

    const exists = await postExists(postId);

    if (!exists) {
      return res.status(404).json({
        message: "Post không tồn tại.",
      });
    }

    const result = await togglePostLike(postId, req.user.id);

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
