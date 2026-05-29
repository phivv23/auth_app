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
    reason: row.reason,
    details: row.details || "",
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reviewedAt: row.reviewedAt || null,
  };
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
      r.id,
      r.reporter_id AS reporterId,
      reporter.name AS reporterName,
      r.target_type AS targetType,
      r.target_id AS targetId,
      r.reason,
      r.details,
      r.status,
      r.created_at AS createdAt,
      r.updated_at AS updatedAt,
      r.reviewed_at AS reviewedAt
    FROM reports r
    JOIN users reporter ON reporter.id = r.reporter_id
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

  const whereSql =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const rows = await query(
    `
    SELECT
      r.id,
      r.reporter_id AS reporterId,
      reporter.name AS reporterName,
      r.target_type AS targetType,
      r.target_id AS targetId,
      r.reason,
      r.details,
      r.status,
      r.created_at AS createdAt,
      r.updated_at AS updatedAt,
      r.reviewed_at AS reviewedAt
    FROM reports r
    JOIN users reporter ON reporter.id = r.reporter_id
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

export async function updateReportStatus(reportId, status) {
  if (!REPORT_STATUSES.includes(status)) {
    return null;
  }

  await query(
    `
    UPDATE reports
    SET status = ?,
        reviewed_at = CASE
          WHEN ? IN ('resolved', 'dismissed') THEN CURRENT_TIMESTAMP
          ELSE reviewed_at
        END
    WHERE id = ?
    `,
    [status, status, reportId]
  );

  return findReportById(reportId);
}
