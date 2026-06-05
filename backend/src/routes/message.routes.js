import { Router } from "express";

import {
  sanitizeUploadDisplayName,
  uploadMessageMedia,
} from "../config/upload.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  addMessageClient,
  publishMessageEvent,
} from "../realtime/messageEvents.js";
import { deleteLocalUpload } from "../utils/file.js";
import {
  createMessage,
  findConversationById,
  findConversationsByUserId,
  findMessageRequestsByUserId,
  findMessagesByConversationId,
  findOrCreateConversation,
  markConversationAsRead,
  deleteMessageForEveryone,
  setMessageReaction,
  updateMessageContent,
} from "../models/message.model.js";

const router = Router();
const allowedMessageReactions = new Set([
  "👍",
  "❤️",
  "😂",
  "😍",
  "😮",
  "😢",
  "🙏",
  "🔥",
  "🎉",
  "💜",
]);
const startConversationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: "message:start",
});
const sendMessageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: "message:send",
  keyGenerator: (req) => req.user?.id || req.ip,
  message: "Bạn gửi tin nhắn quá nhanh. Vui lòng thử lại sau.",
});

function parsePositiveInt(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

function normalizePositiveInt(value, fallback) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return number;
}

function handleMessageMediaUpload(req, res, next) {
  uploadMessageMedia.single("media")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File tin nhắn tối đa 50MB.",
      });
    }

    return res.status(400).json({
      message: error.message || "Upload file tin nhắn thất bại.",
    });
  });
}

function getMessageMediaType(file) {
  if (file.mimetype?.startsWith("video/")) {
    return "video";
  }

  if (file.mimetype?.startsWith("image/")) {
    return "image";
  }

  return "file";
}

function normalizeGifUrl(value) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getMessageMedia(req) {
  if (req.file) {
    return {
      mediaUrl: `/uploads/messages/${req.file.filename}`,
      mediaType: getMessageMediaType(req.file),
      mediaName: sanitizeUploadDisplayName(req.file.originalname) || null,
    };
  }

  const gifUrl = normalizeGifUrl(req.body?.gifUrl || req.body?.mediaUrl);

  if (!gifUrl) {
    return null;
  }

  return {
    mediaUrl: gifUrl,
    mediaType: "gif",
    mediaName: "GIF",
  };
}

function validateMessageInput(content, media = null) {
  const normalizedContent = String(content || "").trim();

  if (!normalizedContent && !media?.mediaUrl) {
    return {
      error: "Tin nhắn không được để trống.",
    };
  }

  if (normalizedContent.length > 2000) {
    return {
      error: "Tin nhắn không được vượt quá 2000 ký tự.",
    };
  }

  return {
    content: normalizedContent,
    media,
  };
}

function validateMessageEditInput(content) {
  const normalizedContent = String(content || "").trim();

  if (!normalizedContent) {
    return {
      error: "Nội dung chỉnh sửa không được để trống.",
    };
  }

  if (normalizedContent.length > 2000) {
    return {
      error: "Tin nhắn không được vượt quá 2000 ký tự.",
    };
  }

  return {
    content: normalizedContent,
  };
}

function normalizeMessageReactionInput(value) {
  const normalizedReaction = String(value || "").trim();

  if (!normalizedReaction) {
    return {
      reaction: null,
    };
  }

  if (!allowedMessageReactions.has(normalizedReaction)) {
    return {
      error: "Biểu tượng cảm xúc không hợp lệ.",
    };
  }

  return {
    reaction: normalizedReaction,
  };
}

router.get("/stream", requireAuth, (req, res) => {
  res.set({
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
  });
  res.flushHeaders?.();

  res.write("event: connected\ndata: {}\n\n");

  const removeClient = addMessageClient(req.user.id, res);
  const heartbeatId = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeatId);
    removeClient();
  });
});

router.get("/conversations", requireAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 20);
    const limit = Math.min(requestedLimit, 50);

    const result = await findConversationsByUserId({
      currentUserId: req.user.id,
      page,
      limit,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/requests", requireAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 20);
    const limit = Math.min(requestedLimit, 50);

    const result = await findMessageRequestsByUserId({
      currentUserId: req.user.id,
      page,
      limit,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/conversations/:userId",
  requireAuth,
  requireActiveAccount,
  startConversationRateLimit,
  async (req, res, next) => {
    try {
      const otherUserId = parsePositiveInt(req.params.userId);

      if (!otherUserId) {
        return res.status(400).json({
          message: "User id không hợp lệ.",
        });
      }

      const conversation = await findOrCreateConversation(req.user.id, otherUserId);

      if (!conversation) {
        return res.status(403).json({
          message: "Bạn không thể nhắn tin với tài khoản này.",
        });
      }

      return res.status(201).json({
        conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/conversations/:conversationId/messages",
  requireAuth,
  async (req, res, next) => {
    try {
      const conversationId = parsePositiveInt(req.params.conversationId);

      if (!conversationId) {
        return res.status(400).json({
          message: "Conversation id không hợp lệ.",
        });
      }

      const page = normalizePositiveInt(req.query.page, 1);
      const requestedLimit = normalizePositiveInt(req.query.limit, 30);
      const limit = Math.min(requestedLimit, 100);
      const result = await findMessagesByConversationId({
        conversationId,
        currentUserId: req.user.id,
        page,
        limit,
      });

      if (!result) {
        return res.status(404).json({
          message: "Không tìm thấy cuộc trò chuyện.",
        });
      }

      return res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/conversations/:conversationId/messages",
  requireAuth,
  requireActiveAccount,
  sendMessageRateLimit,
  handleMessageMediaUpload,
  async (req, res, next) => {
    const uploadedMediaUrl = req.file
      ? `/uploads/messages/${req.file.filename}`
      : null;

    try {
      const conversationId = parsePositiveInt(req.params.conversationId);

      if (!conversationId) {
        await deleteLocalUpload(uploadedMediaUrl);
        return res.status(400).json({
          message: "Conversation id không hợp lệ.",
        });
      }

      const media = getMessageMedia(req);
      const validatedInput = validateMessageInput(req.body?.content, media);
      const replyToMessageId = req.body?.replyToMessageId
        ? parsePositiveInt(req.body.replyToMessageId)
        : null;

      if (req.body?.replyToMessageId && !replyToMessageId) {
        await deleteLocalUpload(uploadedMediaUrl);
        return res.status(400).json({
          message: "Tin nhắn được trả lời không hợp lệ.",
        });
      }

      if (validatedInput.error) {
        await deleteLocalUpload(uploadedMediaUrl);
        return res.status(400).json({
          message: validatedInput.error,
        });
      }

      const message = await createMessage({
        conversationId,
        senderId: req.user.id,
        content: validatedInput.content,
        mediaUrl: validatedInput.media?.mediaUrl || null,
        mediaType: validatedInput.media?.mediaType || null,
        mediaName: validatedInput.media?.mediaName || null,
        replyToMessageId,
      });

      if (message?.invalidReply) {
        await deleteLocalUpload(uploadedMediaUrl);
        return res.status(400).json({
          message: "Không tìm thấy tin nhắn được trả lời.",
        });
      }

      if (!message) {
        await deleteLocalUpload(uploadedMediaUrl);
        return res.status(404).json({
          message: "Không tìm thấy cuộc trò chuyện.",
        });
      }

      return res.status(201).json({
        message,
      });
    } catch (error) {
      await deleteLocalUpload(uploadedMediaUrl);
      next(error);
    }
  }
);

router.patch(
  "/conversations/:conversationId/messages/:messageId",
  requireAuth,
  requireActiveAccount,
  async (req, res, next) => {
    try {
      const conversationId = parsePositiveInt(req.params.conversationId);
      const messageId = parsePositiveInt(req.params.messageId);

      if (!conversationId || !messageId) {
        return res.status(400).json({
          message: "Message id hoặc conversation id không hợp lệ.",
        });
      }

      const validatedInput = validateMessageEditInput(req.body?.content);

      if (validatedInput.error) {
        return res.status(400).json({
          message: validatedInput.error,
        });
      }

      const result = await updateMessageContent({
        conversationId,
        messageId,
        senderId: req.user.id,
        content: validatedInput.content,
      });

      if (!result) {
        return res.status(404).json({
          message: "Không tìm thấy tin nhắn.",
        });
      }

      if (result.forbidden) {
        return res.status(403).json({
          message: "Bạn chỉ có thể chỉnh sửa tin nhắn của mình.",
        });
      }

      if (result.deleted) {
        return res.status(400).json({
          message: "Không thể chỉnh sửa tin nhắn đã thu hồi.",
        });
      }

      publishMessageEvent(req.user.id, "messageUpdate", result.message);

      if (Number(result.recipientId) !== Number(req.user.id)) {
        publishMessageEvent(result.recipientId, "messageUpdate", result.message);
      }

      return res.json({
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/conversations/:conversationId/messages/:messageId",
  requireAuth,
  requireActiveAccount,
  async (req, res, next) => {
    try {
      const conversationId = parsePositiveInt(req.params.conversationId);
      const messageId = parsePositiveInt(req.params.messageId);

      if (!conversationId || !messageId) {
        return res.status(400).json({
          message: "Message id hoặc conversation id không hợp lệ.",
        });
      }

      const result = await deleteMessageForEveryone({
        conversationId,
        messageId,
        senderId: req.user.id,
      });

      if (!result) {
        return res.status(404).json({
          message: "Không tìm thấy tin nhắn.",
        });
      }

      if (result.forbidden) {
        return res.status(403).json({
          message: "Bạn chỉ có thể xóa tin nhắn của mình.",
        });
      }

      await deleteLocalUpload(result.removedMediaUrl);
      publishMessageEvent(req.user.id, "messageUpdate", result.message);

      if (Number(result.recipientId) !== Number(req.user.id)) {
        publishMessageEvent(result.recipientId, "messageUpdate", result.message);
      }

      return res.json({
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/conversations/:conversationId/messages/:messageId/reaction",
  requireAuth,
  requireActiveAccount,
  async (req, res, next) => {
    try {
      const conversationId = parsePositiveInt(req.params.conversationId);
      const messageId = parsePositiveInt(req.params.messageId);

      if (!conversationId || !messageId) {
        return res.status(400).json({
          message: "Message id hoặc conversation id không hợp lệ.",
        });
      }

      const reactionInput = normalizeMessageReactionInput(req.body?.reaction);

      if (reactionInput.error) {
        return res.status(400).json({
          message: reactionInput.error,
        });
      }

      const result = await setMessageReaction({
        conversationId,
        messageId,
        userId: req.user.id,
        reaction: reactionInput.reaction,
      });

      if (!result) {
        return res.status(404).json({
          message: "Không tìm thấy tin nhắn.",
        });
      }

      publishMessageEvent(req.user.id, "reaction", result.reaction);

      if (Number(result.recipientId) !== Number(req.user.id)) {
        publishMessageEvent(result.recipientId, "reaction", result.reaction);
      }

      return res.json({
        reaction: result.reaction,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/conversations/:conversationId/typing",
  requireAuth,
  requireActiveAccount,
  async (req, res, next) => {
    try {
      const conversationId = parsePositiveInt(req.params.conversationId);

      if (!conversationId) {
        return res.status(400).json({
          message: "Conversation id không hợp lệ.",
        });
      }

      const conversation = await findConversationById(
        conversationId,
        req.user.id
      );

      if (!conversation) {
        return res.status(404).json({
          message: "Không tìm thấy cuộc trò chuyện.",
        });
      }

      const isTyping = Boolean(req.body?.isTyping);

      publishMessageEvent(conversation.otherUser.id, "typing", {
        conversationId,
        userId: req.user.id,
        isTyping,
      });

      return res.json({
        ok: true,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/conversations/:conversationId/read",
  requireAuth,
  async (req, res, next) => {
    try {
      const conversationId = parsePositiveInt(req.params.conversationId);

      if (!conversationId) {
        return res.status(400).json({
          message: "Conversation id không hợp lệ.",
        });
      }

      const conversation = await markConversationAsRead(
        conversationId,
        req.user.id
      );

      if (!conversation) {
        return res.status(404).json({
          message: "Không tìm thấy cuộc trò chuyện.",
        });
      }

      publishMessageEvent(conversation.otherUser.id, "read", {
        conversationId,
        readerId: req.user.id,
        lastReadMessageId: conversation.lastReadMessageId,
      });

      return res.json({
        conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
