import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { findCommentById } from "../models/comment.model.js";
import { findMessageByIdForUser } from "../models/message.model.js";
import { findPostById } from "../models/post.model.js";
import { createNotification } from "../models/notification.model.js";
import {
  createReport,
  findReportById,
  findReports,
  getReportStatusSummary,
  updateReportStatus,
  validateReportInput,
  validateReportStatusInput,
} from "../models/report.model.js";
import { findUserById } from "../models/user.model.js";
import { sendError } from "../utils/http.js";

const router = Router();
const reportRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: "report:create",
  keyGenerator: (req) => req.user?.id || req.ip,
  message: "Bạn gửi báo cáo quá nhanh. Vui lòng thử lại sau.",
});

function normalizePositiveInt(value, fallback) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return number;
}

async function assertReportTargetExists({ targetType, targetId, currentUserId }) {
  if (targetType === "user") {
    const targetUser = await findUserById(targetId);

    return Boolean(targetUser) && Number(targetId) !== Number(currentUserId);
  }

  if (targetType === "post") {
    return Boolean(await findPostById(targetId, currentUserId));
  }

  if (targetType === "comment") {
    const comment = await findCommentById(targetId);

    if (!comment) {
      return false;
    }

    return Boolean(await findPostById(comment.postId, currentUserId));
  }

  if (targetType === "message") {
    return Boolean(await findMessageByIdForUser(targetId, currentUserId));
  }

  return false;
}

router.post("/", requireAuth, reportRateLimit, async (req, res, next) => {
  try {
    const validation = validateReportInput(req.body);

    if (validation.error) {
      return sendError(
        res,
        400,
        validation.error.message,
        validation.error.code,
        validation.error.fields
      );
    }

    const { targetType, targetId, reason, details } = validation.value;
    const targetExists = await assertReportTargetExists({
      targetType,
      targetId,
      currentUserId: req.user.id,
    });

    if (!targetExists) {
      return sendError(
        res,
        404,
        "Không tìm thấy nội dung cần báo cáo hoặc bạn không có quyền xem.",
        "REPORT_TARGET_NOT_FOUND"
      );
    }

    const report = await createReport({
      reporterId: req.user.id,
      targetType,
      targetId,
      reason,
      details,
    });

    return res.status(201).json({
      message: "Đã gửi báo cáo.",
      report,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 20);
    const limit = Math.min(requestedLimit, 50);
    const status = req.query.status ? String(req.query.status) : null;
    const targetType = req.query.targetType
      ? String(req.query.targetType)
      : null;

    const [result, summary] = await Promise.all([
      findReports({
        status,
        targetType,
        page,
        limit,
      }),
      getReportStatusSummary(),
    ]);

    return res.json({
      ...result,
      summary,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/admin/:id/status",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const reportId = normalizePositiveInt(req.params.id, null);

      if (!reportId) {
        return sendError(res, 400, "Report id không hợp lệ.", "INVALID_REPORT_ID");
      }

      const validation = validateReportStatusInput(req.body);

      if (validation.error) {
        return sendError(
          res,
          400,
          validation.error.message,
          validation.error.code,
          validation.error.fields
        );
      }

      const existingReport = await findReportById(reportId);

      if (!existingReport) {
        return sendError(res, 404, "Không tìm thấy báo cáo.", "REPORT_NOT_FOUND");
      }

      const report = await updateReportStatus(reportId, validation.value.status, {
        reviewerId: req.user.id,
        resolutionNote: validation.value.resolutionNote,
      });

      if (report.status !== existingReport.status) {
        await createNotification({
          recipientId: report.reporterId,
          actorId: req.user.id,
          type: "report_status_update",
          reportId: report.id,
        });
      }

      return res.json({
        message: "Đã cập nhật trạng thái báo cáo.",
        report,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = normalizePositiveInt(req.query.page, 1);
    const requestedLimit = normalizePositiveInt(req.query.limit, 20);
    const limit = Math.min(requestedLimit, 50);
    const status = req.query.status ? String(req.query.status) : null;

    const result = await findReports({
      reporterId: req.user.id,
      status,
      page,
      limit,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
