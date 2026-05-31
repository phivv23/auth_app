import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  addMessageClient,
  publishMessageEvent,
} from "../realtime/messageEvents.js";
import {
  createMessage,
  findConversationById,
  findConversationsByUserId,
  findMessageRequestsByUserId,
  findMessagesByConversationId,
  findOrCreateConversation,
  markConversationAsRead,
} from "../models/message.model.js";

const router = Router();
const startConversationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: "message:start",
});
const sendMessageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
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

function validateMessageContent(content) {
  const normalizedContent = String(content || "").trim();

  if (!normalizedContent) {
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
          message: "Bạn chỉ có thể nhắn tin với bạn bè.",
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
  async (req, res, next) => {
    try {
      const conversationId = parsePositiveInt(req.params.conversationId);

      if (!conversationId) {
        return res.status(400).json({
          message: "Conversation id không hợp lệ.",
        });
      }

      const validatedInput = validateMessageContent(req.body?.content);

      if (validatedInput.error) {
        return res.status(400).json({
          message: validatedInput.error,
        });
      }

      const message = await createMessage({
        conversationId,
        senderId: req.user.id,
        content: validatedInput.content,
      });

      if (!message) {
        return res.status(404).json({
          message: "Không tìm thấy cuộc trò chuyện.",
        });
      }

      return res.status(201).json({
        message,
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
