import { Router } from "express";

import { requireAuth, optionalAuth } from "../middleware/requireAuth.js";
import { createNotification } from "../models/notification.model.js";
import { isBlockedBetween } from "../models/block.model.js";
import { acceptMessageConversationBetween } from "../models/message.model.js";
import { findPublicUserProfileById } from "../models/user.model.js";
import {
  acceptFriendRequest,
  createFriendRequest,
  deleteAcceptedFriendship,
  deletePendingFriendRequest,
  findFriendRequests,
  findFriends,
  findFriendshipBetween,
  findFriendSuggestions,
  FRIENDSHIP_STATUS,
} from "../models/friend.model.js";

const router = Router();

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

router.get("/requests", requireAuth, async (req, res, next) => {
  try {
    const type = req.query.type === "outgoing" ? "outgoing" : "incoming";
    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);

    const result = await findFriendRequests({
      currentUserId: req.user.id,
      type,
      page,
      limit,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/suggestions", requireAuth, async (req, res, next) => {
  try {
    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 20);
    const users = await findFriendSuggestions({
      currentUserId: req.user.id,
      limit,
    });

    return res.json({
      users,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const userId = parsePositiveInt(req.query.userId || req.user?.id);

    if (!userId) {
      return res.status(401).json({
        message: "Bạn cần đăng nhập để xem danh sách bạn bè.",
      });
    }

    const profile = await findPublicUserProfileById(
      userId,
      req.user?.id || null
    );

    if (!profile) {
      return res.status(404).json({
        message: "Không tìm thấy user.",
      });
    }

    if (!profile.canViewProfile) {
      return res.status(403).json({
        message: "Bạn không có quyền xem danh sách bạn bè này.",
        code: "PROFILE_PRIVATE",
      });
    }

    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit, 50);
    const result = await findFriends({
      userId,
      currentUserId: req.user?.id || null,
      page,
      limit,
    });

    return res.json({
      profile,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/requests/:userId", requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parsePositiveInt(req.params.userId);

    if (!targetUserId) {
      return res.status(400).json({
        message: "User id không hợp lệ.",
      });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({
        message: "Bạn không thể gửi lời mời kết bạn cho chính mình.",
      });
    }

    if (await isBlockedBetween(req.user.id, targetUserId)) {
      return res.status(403).json({
        message: "Không thể gửi lời mời kết bạn khi một trong hai đã block.",
        code: "USER_BLOCKED",
      });
    }

    const targetProfile = await findPublicUserProfileById(
      targetUserId,
      req.user.id
    );

    if (!targetProfile) {
      return res.status(404).json({
        message: "Không tìm thấy user.",
      });
    }

    const existingFriendship = await findFriendshipBetween(
      req.user.id,
      targetUserId
    );

    if (existingFriendship?.status === "accepted") {
      return res.status(409).json({
        message: "Hai bạn đã là bạn bè.",
      });
    }

    if (existingFriendship?.status === "pending") {
      const isOutgoing =
        Number(existingFriendship.requesterId) === Number(req.user.id);

      return res.status(409).json({
        message: isOutgoing
          ? "Bạn đã gửi lời mời kết bạn cho user này."
          : "User này đã gửi lời mời kết bạn cho bạn.",
      });
    }

    const friendship = await createFriendRequest(req.user.id, targetUserId);

    await createNotification({
      recipientId: targetUserId,
      actorId: req.user.id,
      type: "friend_request",
    });

    const profile = await findPublicUserProfileById(targetUserId, req.user.id);

    return res.status(201).json({
      message: "Đã gửi lời mời kết bạn.",
      friendship,
      profile,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/requests/:userId/accept", requireAuth, async (req, res, next) => {
  try {
    const requesterId = parsePositiveInt(req.params.userId);

    if (!requesterId) {
      return res.status(400).json({
        message: "User id không hợp lệ.",
      });
    }

    if (await isBlockedBetween(req.user.id, requesterId)) {
      return res.status(403).json({
        message: "Không thể chấp nhận lời mời khi một trong hai đã block.",
        code: "USER_BLOCKED",
      });
    }

    const accepted = await acceptFriendRequest(req.user.id, requesterId);

    if (!accepted) {
      return res.status(404).json({
        message: "Không tìm thấy lời mời kết bạn cần chấp nhận.",
      });
    }

    await createNotification({
      recipientId: requesterId,
      actorId: req.user.id,
      type: "friend_accept",
    });

    await acceptMessageConversationBetween(req.user.id, requesterId);

    const profile = await findPublicUserProfileById(requesterId, req.user.id);

    return res.json({
      message: "Đã chấp nhận lời mời kết bạn.",
      profile,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/requests/:userId", requireAuth, async (req, res, next) => {
  try {
    const otherUserId = parsePositiveInt(req.params.userId);

    if (!otherUserId) {
      return res.status(400).json({
        message: "User id không hợp lệ.",
      });
    }

    const deleted = await deletePendingFriendRequest(req.user.id, otherUserId);

    if (!deleted) {
      return res.status(404).json({
        message: "Không tìm thấy lời mời kết bạn cần hủy.",
      });
    }

    const profile = await findPublicUserProfileById(otherUserId, req.user.id);

    return res.json({
      message: "Đã hủy lời mời kết bạn.",
      profile: profile || {
        id: otherUserId,
        friendshipStatus: FRIENDSHIP_STATUS.NONE,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:userId", requireAuth, async (req, res, next) => {
  try {
    const otherUserId = parsePositiveInt(req.params.userId);

    if (!otherUserId) {
      return res.status(400).json({
        message: "User id không hợp lệ.",
      });
    }

    const deleted = await deleteAcceptedFriendship(req.user.id, otherUserId);

    if (!deleted) {
      return res.status(404).json({
        message: "Hai bạn chưa là bạn bè.",
      });
    }

    const profile = await findPublicUserProfileById(otherUserId, req.user.id);

    return res.json({
      message: "Đã hủy kết bạn.",
      profile: profile || {
        id: otherUserId,
        friendshipStatus: FRIENDSHIP_STATUS.NONE,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
