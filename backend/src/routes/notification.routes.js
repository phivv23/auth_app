import express from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import {
  countUnreadNotifications,
  findNotificationsByUserId,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../models/notification.model.js";

const router = express.Router();

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

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 20);
    const limit = Math.min(requestedLimit, 50);

    const result = await findNotificationsByUserId({
      userId: req.user.id,
      page,
      limit,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/unread-count", requireAuth, async (req, res, next) => {
  try {
    const unreadCount = await countUnreadNotifications(req.user.id);

    res.json({
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/read-all", requireAuth, async (req, res, next) => {
  try {
    await markAllNotificationsAsRead(req.user.id);

    res.json({
      message: "Đã đánh dấu tất cả thông báo là đã đọc",
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const notificationId = parsePositiveInt(req.params.id);

    if (!notificationId) {
      return res.status(400).json({
        message: "Notification id không hợp lệ",
      });
    }

    await markNotificationAsRead(notificationId, req.user.id);

    res.json({
      message: "Đã đánh dấu thông báo là đã đọc",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
