import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { createNotification } from "../models/notification.model.js";
import {
  addSharedMomentItem,
  createSharedMoment,
  findSharedMomentByIdForUser,
  findSharedMomentsForUser,
  parsePositiveInt,
  resolveSharedMomentItem,
  respondToSharedMoment,
  validateSharedMomentInput,
} from "../models/sharedMoment.model.js";

const router = Router();

function normalizePositiveInt(value, fallback) {
  return parsePositiveInt(value) || fallback;
}

function badRequest(res, message) {
  return res.status(400).json({
    message,
  });
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);
    const limit = Math.min(normalizePositiveInt(req.query.limit, 20), 50);
    const status = ["accepted", "pending"].includes(req.query.status)
      ? req.query.status
      : "all";

    const result = await findSharedMomentsForUser({
      userId: req.user.id,
      page,
      limit,
      status,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, requireActiveAccount, async (req, res, next) => {
  try {
    const validation = validateSharedMomentInput(req.body, req.user.id);

    if (validation.error) {
      return badRequest(res, validation.error);
    }

    let initialItem = null;

    if (req.body?.initialItem?.itemType || req.body?.initialItem?.type) {
      const itemResult = await resolveSharedMomentItem(
        req.body.initialItem,
        req.user.id
      );

      if (itemResult.error) {
        return badRequest(res, itemResult.error);
      }

      initialItem = itemResult.value;
    }

    const result = await createSharedMoment({
      creatorId: req.user.id,
      ...validation.value,
      initialItem,
    });

    if (result.error) {
      return badRequest(res, result.error);
    }

    await Promise.all(
      result.invitedUserIds.map((recipientId) =>
        createNotification({
          recipientId,
          actorId: req.user.id,
          type: "shared_moment_invite",
          metadata: {
            momentId: result.moment.id,
            title: result.moment.title,
          },
        })
      )
    );

    return res.status(201).json({
      moment: result.moment,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:momentId", requireAuth, async (req, res, next) => {
  try {
    const momentId = parsePositiveInt(req.params.momentId);

    if (!momentId) {
      return badRequest(res, "Khoảnh khắc không hợp lệ.");
    }

    const moment = await findSharedMomentByIdForUser(momentId, req.user.id);

    if (!moment) {
      return res.status(404).json({
        message: "Không tìm thấy khoảnh khắc chung.",
      });
    }

    return res.json({
      moment,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:momentId/respond",
  requireAuth,
  requireActiveAccount,
  async (req, res, next) => {
    try {
      const momentId = parsePositiveInt(req.params.momentId);
      const status = req.body?.status;

      if (!momentId) {
        return badRequest(res, "Khoảnh khắc không hợp lệ.");
      }

      const currentMoment = await findSharedMomentByIdForUser(
        momentId,
        req.user.id
      );

      if (!currentMoment) {
        return res.status(404).json({
          message: "Không tìm thấy khoảnh khắc chung.",
        });
      }

      const result = await respondToSharedMoment({
        momentId,
        userId: req.user.id,
        status,
      });

      if (result?.error) {
        return badRequest(res, result.error);
      }

      if (!result) {
        return res.status(409).json({
          message: "Lời mời này không còn ở trạng thái chờ.",
          code: "MOMENT_INVITE_NOT_PENDING",
        });
      }

      if (status === "accepted") {
        await createNotification({
          recipientId: currentMoment.creatorId,
          actorId: req.user.id,
          type: "shared_moment_accept",
          metadata: {
            momentId,
            title: currentMoment.title,
          },
        });
      }

      return res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:momentId/items",
  requireAuth,
  requireActiveAccount,
  async (req, res, next) => {
    try {
      const momentId = parsePositiveInt(req.params.momentId);

      if (!momentId) {
        return badRequest(res, "Khoảnh khắc không hợp lệ.");
      }

      const itemResult = await resolveSharedMomentItem(req.body, req.user.id);

      if (itemResult.error) {
        return badRequest(res, itemResult.error);
      }

      const result = await addSharedMomentItem({
        momentId,
        userId: req.user.id,
        item: itemResult.value,
      });

      if (!result) {
        return res.status(404).json({
          message: "Bạn cần tham gia khoảnh khắc này trước khi thêm nội dung.",
        });
      }

      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
