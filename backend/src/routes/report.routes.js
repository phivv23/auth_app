import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { requireModerator } from "../middleware/requireAdmin.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { logAdminAction } from "../models/audit.model.js";
import { deleteComment, findCommentById } from "../models/comment.model.js";
import { findMessageByIdForUser } from "../models/message.model.js";
import {
  deletePost,
  findPostById,
  findPostMediaByPostId,
} from "../models/post.model.js";
import { createNotification } from "../models/notification.model.js";
import {
  createReport,
  findExistingReportForTarget,
  findReportById,
  findReports,
  getReportStatusSummary,
  updateReportStatus,
  validateReportModerationActionInput,
  validateReportInput,
  validateReportStatusInput,
} from "../models/report.model.js";
import {
  findActiveModerationUsers,
  findUserById,
} from "../models/user.model.js";
import { deleteLocalUpload } from "../utils/file.js";
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

async function notifyReporterAboutModeration(report, moderatorId) {
  await createNotification({
    recipientId: report.reporterId,
    actorId: moderatorId,
    type: "report_status_update",
    reportId: report.id,
    metadata: {
      status: report.status,
      targetType: report.targetType,
      reason: report.reason,
      resolutionNote: report.resolutionNote,
    },
  });
}

async function notifyModeratorsAboutNewReport(report) {
  try {
    const recipients = await findActiveModerationUsers({
      excludeUserId: report.reporterId,
    });

    await Promise.all(
      recipients.map((recipient) =>
        createNotification({
          recipientId: recipient.id,
          actorId: report.reporterId,
          type: "admin_report_created",
          reportId: report.id,
          metadata: {
            targetType: report.targetType,
            targetId: report.targetId,
            targetPostId: report.targetPostId,
            reason: report.reason,
            details: report.details,
          },
        })
      )
    );
  } catch {
    // Admin alerts are best-effort; report creation must stay reliable.
  }
}

async function deleteReportedPost(postId, currentUserId) {
  const existingPost = await findPostById(postId, currentUserId, {
    bypassVisibility: true,
  });

  if (!existingPost) {
    return false;
  }

  const media = await findPostMediaByPostId(postId);
  await deletePost(postId);

  for (const item of media || []) {
    await deleteLocalUpload(item.url);
  }

  if (
    existingPost.imageUrl &&
    !(media || []).some((item) => item.url === existingPost.imageUrl)
  ) {
    await deleteLocalUpload(existingPost.imageUrl);
  }

  return true;
}

async function removeReportedTarget(report, currentUserId) {
  if (report.targetType === "post") {
    return deleteReportedPost(report.targetId, currentUserId);
  }

  if (report.targetType === "comment") {
    const comment = await findCommentById(report.targetId);

    if (!comment) {
      return false;
    }

    await deleteComment(report.targetId);
    return true;
  }

  return false;
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

router.post("/", requireAuth, requireActiveAccount, reportRateLimit, async (req, res, next) => {
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

    const existingReport = await findExistingReportForTarget({
      reporterId: req.user.id,
      targetType,
      targetId,
    });

    if (existingReport) {
      return sendError(
        res,
        409,
        "Bạn đã báo cáo nội dung này. Vui lòng theo dõi kết quả xử lý trong trang báo cáo.",
        "REPORT_ALREADY_EXISTS",
        {
          reportId: existingReport.id,
          status: existingReport.status,
        }
      );
    }

    const report = await createReport({
      reporterId: req.user.id,
      targetType,
      targetId,
      reason,
      details,
    });

    await notifyModeratorsAboutNewReport(report);

    return res.status(201).json({
      message: "Đã gửi báo cáo.",
      report,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin", requireAuth, requireModerator, async (req, res, next) => {
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

router.get("/admin/:id", requireAuth, requireModerator, async (req, res, next) => {
  try {
    const reportId = normalizePositiveInt(req.params.id, null);

    if (!reportId) {
      return sendError(res, 400, "Report id không hợp lệ.", "INVALID_REPORT_ID");
    }

    const report = await findReportById(reportId);

    if (!report) {
      return sendError(res, 404, "Không tìm thấy báo cáo.", "REPORT_NOT_FOUND");
    }

    return res.json({
      report,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/admin/:id/status",
  requireAuth,
  requireModerator,
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
        await notifyReporterAboutModeration(report, req.user.id);
      }

      await logAdminAction({
        actorId: req.user.id,
        targetUserId: report.reporterId,
        action: "report.status.update",
        targetType: "report",
        targetId: report.id,
        metadata: {
          previousStatus: existingReport.status,
          nextStatus: report.status,
          targetType: report.targetType,
          reportedTargetId: report.targetId,
          resolutionNote: report.resolutionNote,
        },
      });

      return res.json({
        message: "Đã cập nhật trạng thái báo cáo.",
        report,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/admin/:id/action",
  requireAuth,
  requireModerator,
  async (req, res, next) => {
    try {
      const reportId = normalizePositiveInt(req.params.id, null);

      if (!reportId) {
        return sendError(res, 400, "Report id không hợp lệ.", "INVALID_REPORT_ID");
      }

      const validation = validateReportModerationActionInput(req.body);

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

      const { action, resolutionNote } = validation.value;
      let nextStatus = "dismissed";
      let nextNote =
        resolutionNote || "Đội ngũ đã xem xét và quyết định giữ lại nội dung.";
      let removed = false;

      if (action === "remove") {
        if (!["post", "comment"].includes(existingReport.targetType)) {
          return sendError(
            res,
            400,
            "Chỉ có thể gỡ bài viết hoặc bình luận từ hàng đợi báo cáo.",
            "REPORT_TARGET_NOT_REMOVABLE"
          );
        }

        removed = await removeReportedTarget(existingReport, req.user.id);
        nextStatus = "resolved";
        nextNote =
          resolutionNote ||
          (removed
            ? "Đội ngũ đã xem xét và gỡ bỏ nội dung vi phạm."
            : "Nội dung đã không còn khả dụng khi đội ngũ xử lý.");
      }

      const report = await updateReportStatus(reportId, nextStatus, {
        reviewerId: req.user.id,
        resolutionNote: nextNote,
      });

      await notifyReporterAboutModeration(report, req.user.id);

      await logAdminAction({
        actorId: req.user.id,
        targetUserId: report.reporterId,
        action:
          action === "remove" ? "report.content.remove" : "report.content.keep",
        targetType: "report",
        targetId: report.id,
        metadata: {
          action,
          removed,
          previousStatus: existingReport.status,
          nextStatus: report.status,
          reportTargetType: report.targetType,
          reportedTargetId: report.targetId,
          resolutionNote: report.resolutionNote,
        },
      });

      return res.json({
        message:
          action === "remove"
            ? removed
              ? "Đã gỡ bỏ nội dung và thông báo người báo cáo."
              : "Nội dung không còn khả dụng; đã cập nhật báo cáo."
            : "Đã giữ lại nội dung và thông báo người báo cáo.",
        report,
        action,
        removed,
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
