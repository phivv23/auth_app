import { query } from "../db/pool.js";

export const REPORT_TARGET_TYPES = ["user", "post", "comment", "message"];
export const REPORT_STATUSES = ["pending", "reviewing", "resolved", "dismissed"];
export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "violence",
  "nudity",
  "scam",
  "self_harm",
  "other",
];

function normalizeReport(row) {
  return {
    id: row.id,
    reporterId: row.reporterId,
    reporterName: row.reporterName || null,
    targetType: row.targetType,
    targetId: row.targetId,
    targetPostId: row.targetPostId || null,
    targetPreview: row.targetPreview || "",
    targetOwnerName: row.targetOwnerName || null,
    reason: row.reason,
    details: row.details || "",
    status: row.status,
    reviewedBy: row.reviewedBy || null,
    reviewerName: row.reviewerName || null,
    resolutionNote: row.resolutionNote || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reviewedAt: row.reviewedAt || null,
  };
}

function getReportSelectSql() {
  return `
      r.id,
      r.reporter_id AS reporterId,
      reporter.name AS reporterName,
      r.target_type AS targetType,
      r.target_id AS targetId,
      CASE r.target_type
        WHEN 'post' THEN r.target_id
        WHEN 'comment' THEN (
          SELECT target_comment.post_id
          FROM comments target_comment
          WHERE target_comment.id = r.target_id
          LIMIT 1
        )
        ELSE NULL
      END AS targetPostId,
      CASE r.target_type
        WHEN 'user' THEN (
          SELECT target_user.name
          FROM users target_user
          WHERE target_user.id = r.target_id
          LIMIT 1
        )
        WHEN 'post' THEN (
          SELECT COALESCE(NULLIF(target_post.title, ''), LEFT(target_post.content, 160))
          FROM posts target_post
          WHERE target_post.id = r.target_id
          LIMIT 1
        )
        WHEN 'comment' THEN (
          SELECT LEFT(target_comment.content, 160)
          FROM comments target_comment
          WHERE target_comment.id = r.target_id
          LIMIT 1
        )
        WHEN 'message' THEN (
          SELECT LEFT(target_message.content, 160)
          FROM messages target_message
          WHERE target_message.id = r.target_id
          LIMIT 1
        )
        ELSE NULL
      END AS targetPreview,
      CASE r.target_type
        WHEN 'user' THEN (
          SELECT target_user.name
          FROM users target_user
          WHERE target_user.id = r.target_id
          LIMIT 1
        )
        WHEN 'post' THEN (
          SELECT post_author.name
          FROM posts target_post
          JOIN users post_author ON post_author.id = target_post.user_id
          WHERE target_post.id = r.target_id
          LIMIT 1
        )
        WHEN 'comment' THEN (
          SELECT comment_author.name
          FROM comments target_comment
          JOIN users comment_author ON comment_author.id = target_comment.user_id
          WHERE target_comment.id = r.target_id
          LIMIT 1
        )
        WHEN 'message' THEN (
          SELECT message_author.name
          FROM messages target_message
          JOIN users message_author ON message_author.id = target_message.sender_id
          WHERE target_message.id = r.target_id
          LIMIT 1
        )
        ELSE NULL
      END AS targetOwnerName,
      r.reason,
      r.details,
      r.status,
      r.reviewed_by AS reviewedBy,
      reviewer.name AS reviewerName,
      r.resolution_note AS resolutionNote,
      r.created_at AS createdAt,
      r.updated_at AS updatedAt,
      r.reviewed_at AS reviewedAt
  `;
}

export function validateReportInput(input = {}) {
  const targetType = String(input.targetType || "").trim();
  const targetId = Number(input.targetId);
  const reason = String(input.reason || "").trim() || "other";
  const details = String(input.details || "").trim();
  const fields = {};

  if (!REPORT_TARGET_TYPES.includes(targetType)) {
    fields.targetType = "Loại nội dung cần báo cáo không hợp lệ.";
  }

  if (!Number.isInteger(targetId) || targetId <= 0) {
    fields.targetId = "Id nội dung cần báo cáo không hợp lệ.";
  }

  if (!REPORT_REASONS.includes(reason)) {
    fields.reason = "Lý do báo cáo không hợp lệ.";
  }

  if (details.length > 2000) {
    fields.details = "Mô tả báo cáo không được vượt quá 2000 ký tự.";
  }

  if (Object.keys(fields).length > 0) {
    return {
      value: null,
      error: {
        code: "VALIDATION_ERROR",
        message: Object.values(fields)[0],
        fields,
      },
    };
  }

  return {
    value: {
      targetType,
      targetId,
      reason,
      details: details || null,
    },
    error: null,
  };
}

export function validateReportStatusInput(input = {}) {
  const status = String(input.status || "").trim();
  const resolutionNote = String(input.resolutionNote || "").trim();
  const fields = {};

  if (!REPORT_STATUSES.includes(status)) {
    fields.status = "Trạng thái báo cáo không hợp lệ.";
  }

  if (resolutionNote.length > 2000) {
    fields.resolutionNote = "Ghi chú xử lý không được vượt quá 2000 ký tự.";
  }

  if (Object.keys(fields).length > 0) {
    return {
      value: null,
      error: {
        code: "VALIDATION_ERROR",
        message: Object.values(fields)[0],
        fields,
      },
    };
  }

  return {
    value: {
      status,
      resolutionNote: resolutionNote || null,
    },
    error: null,
  };
}

export function validateReportModerationActionInput(input = {}) {
  const action = String(input.action || "").trim();
  const resolutionNote = String(input.resolutionNote || "").trim();
  const fields = {};

  if (!["keep", "remove"].includes(action)) {
    fields.action = "Thao tác xử lý báo cáo không hợp lệ.";
  }

  if (resolutionNote.length > 2000) {
    fields.resolutionNote = "Ghi chú xử lý không được vượt quá 2000 ký tự.";
  }

  if (Object.keys(fields).length > 0) {
    return {
      value: null,
      error: {
        code: "VALIDATION_ERROR",
        message: Object.values(fields)[0],
        fields,
      },
    };
  }

  return {
    value: {
      action,
      resolutionNote: resolutionNote || null,
    },
    error: null,
  };
}

export async function createReport({
  reporterId,
  targetType,
  targetId,
  reason,
  details = null,
}) {
  const result = await query(
    `
    INSERT INTO reports (
      reporter_id,
      target_type,
      target_id,
      reason,
      details
    )
    VALUES (?, ?, ?, ?, ?)
    `,
    [reporterId, targetType, targetId, reason, details]
  );

  return findReportById(result.insertId);
}

export async function findReportById(reportId) {
  const rows = await query(
    `
    SELECT
      ${getReportSelectSql()}
    FROM reports r
    JOIN users reporter ON reporter.id = r.reporter_id
    LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
    WHERE r.id = ?
    LIMIT 1
    `,
    [reportId]
  );

  return rows[0] ? normalizeReport(rows[0]) : null;
}

export async function findReports({
  reporterId = null,
  status = null,
  targetType = null,
  page = 1,
  limit = 20,
} = {}) {
  const safePage = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const safeLimit =
    Number.isInteger(Number(limit)) && Number(limit) > 0
      ? Math.min(Number(limit), 50)
      : 20;
  const offset = (safePage - 1) * safeLimit;
  const whereParts = [];
  const params = [];

  if (reporterId) {
    whereParts.push("r.reporter_id = ?");
    params.push(reporterId);
  }

  if (status && REPORT_STATUSES.includes(status)) {
    whereParts.push("r.status = ?");
    params.push(status);
  }

  if (targetType && REPORT_TARGET_TYPES.includes(targetType)) {
    whereParts.push("r.target_type = ?");
    params.push(targetType);
  }

  const whereSql =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const rows = await query(
    `
    SELECT
      ${getReportSelectSql()}
    FROM reports r
    JOIN users reporter ON reporter.id = r.reporter_id
    LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
    ${whereSql}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    params
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM reports r
    ${whereSql}
    `,
    params
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    reports: rows.map(normalizeReport),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}

export async function getReportStatusSummary() {
  const rows = await query(
    `
    SELECT status, COUNT(*) AS total
    FROM reports
    GROUP BY status
    `
  );

  const summary = Object.fromEntries(
    REPORT_STATUSES.map((status) => [status, 0])
  );

  for (const row of rows) {
    if (REPORT_STATUSES.includes(row.status)) {
      summary[row.status] = Number(row.total || 0);
    }
  }

  return summary;
}

export async function updateReportStatus(
  reportId,
  status,
  { reviewerId = null, resolutionNote = null } = {}
) {
  if (!REPORT_STATUSES.includes(status)) {
    return null;
  }

  await query(
    `
    UPDATE reports
    SET status = ?,
        reviewed_by = CASE
          WHEN ? = 'pending' THEN NULL
          ELSE ?
        END,
        resolution_note = CASE
          WHEN ? = 'pending' THEN NULL
          ELSE ?
        END,
        reviewed_at = CASE
          WHEN ? IN ('resolved', 'dismissed') THEN CURRENT_TIMESTAMP
          ELSE NULL
        END
    WHERE id = ?
    `,
    [
      status,
      status,
      reviewerId,
      status,
      resolutionNote,
      status,
      reportId,
    ]
  );

  return findReportById(reportId);
}
