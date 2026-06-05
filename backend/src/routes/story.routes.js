import { Router } from "express";

import { uploadStoryMedia } from "../config/upload.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  createMessage,
  findOrCreateConversation,
} from "../models/message.model.js";
import {
  createStory,
  deleteStory,
  findActiveStories,
  findStoryById,
  markStoryViewed,
  validateStoryInput,
} from "../models/story.model.js";
import { deleteLocalUpload } from "../utils/file.js";
import { sendError } from "../utils/http.js";

const router = Router();

const createStoryRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: "story:create",
  keyGenerator: (req) => req.user?.id || req.ip,
  message: "Bạn tạo story quá nhanh. Vui lòng thử lại sau.",
});
const storyInteractionRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  keyPrefix: "story:interact",
  keyGenerator: (req) => req.user?.id || req.ip,
  message: "Bạn tương tác với story quá nhanh. Vui lòng thử lại sau.",
});

const STORY_REACTIONS = new Set(["👍", "❤️", "🥰", "😆", "😮", "😢", "😡"]);

function parsePositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeStoryLimit(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return 50;
  }

  return Math.min(number, 80);
}

function handleStoryUpload(req, res, next) {
  uploadStoryMedia.single("media")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return sendError(
        res,
        400,
        "Media story tối đa 50MB.",
        "STORY_MEDIA_TOO_LARGE"
      );
    }

    return sendError(
      res,
      400,
      error.message || "Upload media story thất bại.",
      "STORY_MEDIA_UPLOAD_FAILED"
    );
  });
}

function getStoryMediaType(file) {
  return file.mimetype?.startsWith("video/") ? "video" : "image";
}

function getUploadedStoryMedia(req) {
  if (!req.file) {
    return null;
  }

  return {
    url: `/uploads/stories/${req.file.filename}`,
    type: getStoryMediaType(req.file),
  };
}

function validateStoryReplyContent(content) {
  const normalizedContent = String(content || "").trim();

  if (!normalizedContent) {
    return {
      value: "",
      error: "Nội dung trả lời không được để trống.",
    };
  }

  if (normalizedContent.length > 1000) {
    return {
      value: "",
      error: "Nội dung trả lời không được vượt quá 1000 ký tự.",
    };
  }

  return {
    value: normalizedContent,
    error: "",
  };
}

function validateStoryReaction(reaction) {
  const normalizedReaction = String(reaction || "").trim();

  if (!STORY_REACTIONS.has(normalizedReaction)) {
    return {
      value: "",
      error: "Cảm xúc story không hợp lệ.",
    };
  }

  return {
    value: normalizedReaction,
    error: "",
  };
}

async function findVisibleStoryForInteraction(req, res) {
  const storyId = parsePositiveInt(req.params.id);

  if (!storyId) {
    sendError(res, 400, "Story id không hợp lệ.", "INVALID_STORY_ID");
    return null;
  }

  const story = await findStoryById(storyId, req.user.id);

  if (!story) {
    sendError(
      res,
      404,
      "Story không tồn tại, đã hết hạn hoặc bạn không có quyền xem.",
      "STORY_NOT_FOUND"
    );
    return null;
  }

  if (story.isMine) {
    sendError(
      res,
      400,
      "Bạn không thể tương tác với story của chính mình.",
      "STORY_SELF_INTERACTION_NOT_ALLOWED"
    );
    return null;
  }

  return story;
}

async function sendStoryMessage({ senderId, story, content }) {
  const conversation = await findOrCreateConversation(senderId, story.userId);

  if (!conversation) {
    return null;
  }

  const message = await createMessage({
    conversationId: conversation.id,
    senderId,
    content,
  });

  if (!message) {
    return null;
  }

  return {
    conversation,
    message,
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const stories = await findActiveStories({
      currentUserId: req.user.id,
      limit: normalizeStoryLimit(req.query.limit),
    });

    return res.json({
      stories,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  requireAuth,
  requireActiveAccount,
  createStoryRateLimit,
  handleStoryUpload,
  async (req, res, next) => {
    const uploadedMedia = getUploadedStoryMedia(req);

    try {
      if (!uploadedMedia) {
        return sendError(
          res,
          400,
          "Story cần có ảnh hoặc video.",
          "STORY_MEDIA_REQUIRED"
        );
      }

      const validation = validateStoryInput(req.body);

      if (validation.error) {
        await deleteLocalUpload(uploadedMedia.url);

        return sendError(
          res,
          400,
          validation.error.message,
          validation.error.code,
          validation.error.fields
        );
      }

      const story = await createStory(req.user.id, {
        mediaUrl: uploadedMedia.url,
        mediaType: uploadedMedia.type,
        caption: validation.value.caption,
        privacy: validation.value.privacy,
      });

      return res.status(201).json({
        message: "Đã tạo story. Story sẽ tự hết hạn sau 24 giờ.",
        story,
      });
    } catch (error) {
      if (uploadedMedia) {
        await deleteLocalUpload(uploadedMedia.url);
      }

      next(error);
    }
  }
);

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const storyId = parsePositiveInt(req.params.id);

    if (!storyId) {
      return sendError(res, 400, "Story id không hợp lệ.", "INVALID_STORY_ID");
    }

    const story = await findStoryById(storyId, req.user.id);

    if (!story) {
      return sendError(
        res,
        404,
        "Story không tồn tại, đã hết hạn hoặc bạn không có quyền xem.",
        "STORY_NOT_FOUND"
      );
    }

    return res.json({
      story,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/view", requireAuth, async (req, res, next) => {
  try {
    const storyId = parsePositiveInt(req.params.id);

    if (!storyId) {
      return sendError(res, 400, "Story id không hợp lệ.", "INVALID_STORY_ID");
    }

    const story = await findStoryById(storyId, req.user.id);

    if (!story) {
      return sendError(
        res,
        404,
        "Story không tồn tại, đã hết hạn hoặc bạn không có quyền xem.",
        "STORY_NOT_FOUND"
      );
    }

    if (!story.isMine) {
      await markStoryViewed(storyId, req.user.id);
    }

    const updatedStory = await findStoryById(storyId, req.user.id);

    return res.json({
      story: updatedStory,
      viewed: true,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:id/reply",
  requireAuth,
  requireActiveAccount,
  storyInteractionRateLimit,
  async (req, res, next) => {
    try {
      const story = await findVisibleStoryForInteraction(req, res);

      if (!story) {
        return null;
      }

      const validation = validateStoryReplyContent(req.body?.content);

      if (validation.error) {
        return sendError(res, 400, validation.error, "INVALID_STORY_REPLY");
      }

      const result = await sendStoryMessage({
        senderId: req.user.id,
        story,
        content: `Đã trả lời story của bạn: ${validation.value}`,
      });

      if (!result) {
        return sendError(
          res,
          403,
          "Không thể gửi trả lời story cho người dùng này.",
          "STORY_REPLY_NOT_ALLOWED"
        );
      }

      return res.status(201).json({
        message: "Đã gửi trả lời vào tin nhắn.",
        storyId: story.id,
        conversation: result.conversation,
        replyMessage: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/reaction",
  requireAuth,
  requireActiveAccount,
  storyInteractionRateLimit,
  async (req, res, next) => {
    try {
      const story = await findVisibleStoryForInteraction(req, res);

      if (!story) {
        return null;
      }

      const validation = validateStoryReaction(req.body?.reaction);

      if (validation.error) {
        return sendError(res, 400, validation.error, "INVALID_STORY_REACTION");
      }

      const result = await sendStoryMessage({
        senderId: req.user.id,
        story,
        content: `${validation.value} story của bạn`,
      });

      if (!result) {
        return sendError(
          res,
          403,
          "Không thể thả cảm xúc story cho người dùng này.",
          "STORY_REACTION_NOT_ALLOWED"
        );
      }

      return res.status(201).json({
        message: "Đã gửi cảm xúc vào tin nhắn.",
        storyId: story.id,
        reaction: validation.value,
        conversation: result.conversation,
        replyMessage: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  requireActiveAccount,
  async (req, res, next) => {
    try {
      const storyId = parsePositiveInt(req.params.id);

      if (!storyId) {
        return sendError(res, 400, "Story id không hợp lệ.", "INVALID_STORY_ID");
      }

      const deletedStory = await deleteStory(storyId, req.user.id);

      if (!deletedStory) {
        return sendError(
          res,
          404,
          "Không tìm thấy story của bạn.",
          "STORY_NOT_FOUND"
        );
      }

      await deleteLocalUpload(deletedStory.mediaUrl);

      return res.json({
        message: "Đã xóa story.",
        deleted: true,
        storyId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
