import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  createPost,
  deletePost,
  findBookmarkedPosts,
  findFeedPosts,
  findPostById,
  findPostMediaByPostId,
  findPosts,
  POST_PRIVACY_VALUES,
  togglePostBookmark,
  updatePost,
} from "../models/post.model.js";
import {
  countPostReactionsByType,
  findPostReactions,
  togglePostLike,
} from "../models/like.model.js";
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

const ALLOWED_REACTION_TYPES = ["like", "love", "haha", "wow", "sad", "angry"];
const createPostRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  keyPrefix: "post:create",
  keyGenerator: (req) => req.user?.id || req.ip,
  message: "Bạn tạo bài viết quá nhanh. Vui lòng thử lại sau.",
});
const commentRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: "post:comment",
  keyGenerator: (req) => req.user?.id || req.ip,
  message: "Bạn bình luận quá nhanh. Vui lòng thử lại sau.",
});
const reactionRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: "post:reaction",
  keyGenerator: (req) => req.user?.id || req.ip,
  message: "Bạn react quá nhanh. Vui lòng thử lại sau.",
});
const bookmarkRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: "post:bookmark",
  keyGenerator: (req) => req.user?.id || req.ip,
  message: "Bạn lưu bài viết quá nhanh. Vui lòng thử lại sau.",
});

function normalizePositiveInt(value, fallback) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return number;
}

function parsePositiveInt(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

function validatePostInput({ title, content }) {
  const normalizedTitle = String(title || "").trim();
  const normalizedContent = String(content || "").trim();

  if (normalizedTitle.length > 255) {
    return {
      error: "Title không được vượt quá 255 ký tự.",
    };
  }

  if (normalizedContent.length > 5000) {
    return {
      error: "Content không được vượt quá 5000 ký tự.",
    };
  }

  return {
    title: normalizedTitle || null,
    content: normalizedContent,
  };
}

function normalizePostPrivacy(value) {
  const normalizedValue = String(value || "public").trim();

  if (!POST_PRIVACY_VALUES.includes(normalizedValue)) {
    return {
      error: "Quyền xem bài viết không hợp lệ.",
    };
  }

  return {
    privacy: normalizedValue,
  };
}

function handlePostImageUpload(req, res, next) {
  uploadPostImage.fields([
    {
      name: "image",
      maxCount: 1,
    },
    {
      name: "media",
      maxCount: 10,
    },
  ])(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Ảnh bài viết tối đa 5MB mỗi file",
      });
    }

    return res.status(400).json({
      message: error.message || "Upload ảnh bài viết thất bại",
    });
  });
}

function getUploadedPostMedia(req) {
  const mediaFiles = [
    ...(req.files?.media || []),
    ...(req.files?.image || []),
  ];

  return mediaFiles.map((file) => ({
    url: `/uploads/posts/${file.filename}`,
    type: "image",
  }));
}

async function deleteUploadedPostMedia(media = []) {
  for (const item of media) {
    await deleteLocalUpload(item.url);
  }
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

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);
    const search = String(req.query.search || "").trim();

    const result = await findPosts({
      page,
      limit,
      search,
      currentUserId: req.user?.id || null,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

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

router.get("/bookmarks", requireAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);

    const result = await findBookmarkedPosts({
      page,
      limit,
      currentUserId: req.user.id,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/:postId/reactions", optionalAuth, async (req, res, next) => {
  try {
    const postId = parsePositiveInt(req.params.postId);

    if (!postId) {
      return res.status(400).json({
        message: "Post id khong hop le.",
      });
    }

    const reactionType = String(req.query.reactionType || "").trim();

    if (reactionType && !ALLOWED_REACTION_TYPES.includes(reactionType)) {
      return res.status(400).json({
        message: "Reaction khong hop le.",
      });
    }

    const post = await findPostById(postId, req.user?.id || null, {
      bypassVisibility: req.user?.role === "admin",
    });

    if (!post) {
      return res.status(404).json({
        message: "Post khong ton tai hoac ban khong co quyen xem.",
      });
    }

    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 50);
    const limit = Math.min(requestedLimit, 100);

    const result = await findPostReactions({
      postId,
      page,
      limit,
      reactionType,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:postId/bookmark",
  requireAuth,
  requireActiveAccount,
  bookmarkRateLimit,
  async (req, res, next) => {
    try {
      const postId = parsePositiveInt(req.params.postId);

      if (!postId) {
        return res.status(400).json({
          message: "Post id không hợp lệ.",
        });
      }

      const post = await findPostById(postId, req.user.id);

      if (!post) {
        return res.status(404).json({
          message: "Post không tồn tại hoặc bạn không có quyền xem.",
        });
      }

      const result = await togglePostBookmark(postId, req.user.id);

      return res.json({
        message: result.bookmarked
          ? "Đã lưu bài viết."
          : "Đã bỏ lưu bài viết.",
        bookmarked: result.bookmarked,
        bookmarkCount: result.bookmarkCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const postId = parsePositiveInt(req.params.id);

    if (!postId) {
      return res.status(400).json({
        message: "Post id không hợp lệ.",
      });
    }

    const post = await findPostById(postId, req.user?.id || null);

    if (!post) {
      return res.status(404).json({
        message: "Post không tồn tại hoặc bạn không có quyền xem.",
      });
    }

    return res.json({
      post,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, requireActiveAccount, createPostRateLimit, handlePostImageUpload, async (req, res, next) => {
  const uploadedMedia = getUploadedPostMedia(req);

  try {
    const { title, content, privacy } = req.body;
    const result = validatePostInput({ title, content });
    const privacyResult = normalizePostPrivacy(privacy);

    if (result.error || privacyResult.error) {
      await deleteUploadedPostMedia(uploadedMedia);
      return res.status(400).json({
        message: result.error || privacyResult.error,
      });
    }

    if (!result.content && uploadedMedia.length === 0) {
      return res.status(400).json({
        message: "Bài viết cần có nội dung hoặc ảnh.",
      });
    }

    const post = await createPost(req.user.id, {
      title: result.title,
      content: result.content,
      privacy: privacyResult.privacy,
      media: uploadedMedia,
    });

    res.status(201).json({
      message: "Tạo bài viết thành công",
      post,
    });
  } catch (error) {
    await deleteUploadedPostMedia(uploadedMedia);
    next(error);
  }
});

router.post("/:postId/share", requireAuth, requireActiveAccount, createPostRateLimit, async (req, res, next) => {
  try {
    const postId = parsePositiveInt(req.params.postId);

    if (!postId) {
      return res.status(400).json({
        message: "Post id không hợp lệ.",
      });
    }

    const originalPost = await findPostById(postId, req.user.id);

    if (!originalPost) {
      return res.status(404).json({
        message: "Post không tồn tại hoặc bạn không có quyền xem.",
      });
    }

    const result = validatePostInput({
      title: "",
      content: req.body?.content || "",
    });
    const privacyResult = normalizePostPrivacy(req.body?.privacy);

    if (result.error || privacyResult.error) {
      return res.status(400).json({
        message: result.error || privacyResult.error,
      });
    }

    const post = await createPost(req.user.id, {
      title: null,
      content: result.content,
      privacy: privacyResult.privacy,
      sharedPostId: postId,
    });

    return res.status(201).json({
      message: "Đã chia sẻ bài viết về trang cá nhân.",
      post,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id",
  requireAuth,
  requireActiveAccount,
  handlePostImageUpload,
  async (req, res, next) => {
    const uploadedMedia = getUploadedPostMedia(req);

    try {
      const postId = parsePositiveInt(req.params.id);

      if (!postId) {
        await deleteUploadedPostMedia(uploadedMedia);

        return res.status(400).json({
          message: "Post id không hợp lệ",
        });
      }

      const existingPost = await findPostById(postId, req.user.id);

      if (!existingPost) {
        await deleteUploadedPostMedia(uploadedMedia);

        return res.status(404).json({
          message: "Không tìm thấy bài viết",
        });
      }

      if (existingPost.userId !== req.user.id) {
        await deleteUploadedPostMedia(uploadedMedia);

        return res.status(403).json({
          message: "Bạn không có quyền sửa bài viết này",
        });
      }

      const { title, content, privacy } = req.body;
      const result = validatePostInput({ title, content });
      const privacyResult = normalizePostPrivacy(privacy || existingPost.privacy);

      if (result.error || privacyResult.error) {
        await deleteUploadedPostMedia(uploadedMedia);

        return res.status(400).json({
          message: result.error || privacyResult.error,
        });
      }

      const hasExistingMedia = Boolean(existingPost.media?.length);

      if (!result.content && uploadedMedia.length === 0 && !hasExistingMedia) {
        return res.status(400).json({
          message: "Bài viết cần có nội dung hoặc ảnh.",
        });
      }

      const oldMedia =
        uploadedMedia.length > 0 ? await findPostMediaByPostId(postId) : [];

      const updatedPost = await updatePost(
        postId,
        {
          title: result.title,
          content: result.content,
          privacy: privacyResult.privacy,
          media: uploadedMedia.length > 0 ? uploadedMedia : null,
        },
        req.user.id
      );

      if (uploadedMedia.length > 0) {
        await deleteUploadedPostMedia(oldMedia);

        if (
          existingPost.imageUrl &&
          !oldMedia.some((item) => item.url === existingPost.imageUrl)
        ) {
          await deleteLocalUpload(existingPost.imageUrl);
        }
      }

      res.json({
        message: "Cập nhật bài viết thành công",
        post: updatedPost,
      });
    } catch (error) {
      await deleteUploadedPostMedia(uploadedMedia);
      next(error);
    }
  }
);

router.delete("/:id", requireAuth, requireActiveAccount, async (req, res, next) => {
  try {
    const postId = parsePositiveInt(req.params.id);

    if (!postId) {
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
    await deleteUploadedPostMedia(existingPost.media || []);

    if (
      existingPost.imageUrl &&
      !(existingPost.media || []).some((item) => item.url === existingPost.imageUrl)
    ) {
      await deleteLocalUpload(existingPost.imageUrl);
    }

    res.json({
      message: "Xóa bài viết thành công",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:postId/comments", optionalAuth, async (req, res, next) => {
  try {
    const postId = parsePositiveInt(req.params.postId);

    if (!postId) {
      return res.status(400).json({
        message: "Post id không hợp lệ.",
      });
    }

    const post = await findPostById(postId, req.user?.id || null);

    if (!post) {
      return res.status(404).json({
        message: "Post không tồn tại hoặc bạn không có quyền xem.",
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

router.post("/:postId/comments", requireAuth, requireActiveAccount, commentRateLimit, async (req, res, next) => {
  try {
    const postId = parsePositiveInt(req.params.postId);

    if (!postId) {
      return res.status(400).json({
        message: "Post id không hợp lệ.",
      });
    }

    const post = await findPostById(postId, req.user.id);

    if (!post) {
      return res.status(404).json({
        message: "Post không tồn tại hoặc bạn không có quyền xem.",
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

router.patch("/comments/:commentId", requireAuth, requireActiveAccount, commentRateLimit, async (req, res, next) => {
  try {
    const commentId = parsePositiveInt(req.params.commentId);

    if (!commentId) {
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

router.delete("/comments/:commentId", requireAuth, requireActiveAccount, async (req, res, next) => {
  try {
    const commentId = parsePositiveInt(req.params.commentId);

    if (!commentId) {
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

router.post("/:postId/like", requireAuth, requireActiveAccount, reactionRateLimit, async (req, res, next) => {
  try {
    const postId = parsePositiveInt(req.params.postId);

    if (!postId) {
      return res.status(400).json({
        message: "Post id không hợp lệ.",
      });
    }

    const post = await findPostById(postId, req.user.id);

    if (!post) {
      return res.status(404).json({
        message: "Post không tồn tại hoặc bạn không có quyền xem.",
      });
    }

    const reactionType = String(req.body?.reactionType || "like");

    if (!ALLOWED_REACTION_TYPES.includes(reactionType)) {
      return res.status(400).json({
        message: "Reaction không hợp lệ.",
      });
    }

    const wasAlreadyReacted = Boolean(post.likedByMe);
    const result = await togglePostLike(postId, req.user.id, reactionType);

    if (result.liked && !wasAlreadyReacted) {
      await createNotification({
        recipientId: post.userId,
        actorId: req.user.id,
        type: "post_like",
        postId,
      });
    }

    return res.json({
      message: result.liked ? "Đã react post." : "Đã bỏ reaction post.",
      liked: result.liked,
      reactionType: result.reactionType,
      likeCount: result.likeCount,
      reactionSummary: await countPostReactionsByType(postId),
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Bạn đã react post này rồi.",
      });
    }

    next(error);
  }
});

export default router;
