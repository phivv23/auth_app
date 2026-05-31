import { query } from "../db/pool.js";

function normalizePositiveInt(value, fallback) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeLimit(value, fallback = 20, max = 50) {
  return Math.min(normalizePositiveInt(value, fallback), max);
}

function parseMetadata(value) {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function stringifyMetadata(metadata = {}) {
  const safeMetadata = metadata && typeof metadata === "object" ? metadata : {};
  return JSON.stringify(safeMetadata);
}

function normalizeAuditLog(row) {
  return {
    id: row.id,
    actorId: row.actorId || null,
    actorName: row.actorName || null,
    actorEmail: row.actorEmail || null,
    targetUserId: row.targetUserId || null,
    targetUserName: row.targetUserName || null,
    targetUserEmail: row.targetUserEmail || null,
    action: row.action,
    targetType: row.targetType || null,
    targetId: row.targetId || null,
    metadata: parseMetadata(row.metadataJson),
    createdAt: row.createdAt,
  };
}

export async function logAdminAction({
  actorId,
  targetUserId = null,
  action,
  targetType = null,
  targetId = null,
  metadata = {},
}) {
  if (!actorId || !action) {
    return null;
  }

  const result = await query(
    `
    INSERT INTO admin_audit_logs (
      actor_id,
      target_user_id,
      action,
      target_type,
      target_id,
      metadata_json
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      actorId,
      targetUserId || null,
      action,
      targetType || null,
      targetId || null,
      stringifyMetadata(metadata),
    ]
  );

  return findAdminAuditLogById(result.insertId);
}

export async function findAdminAuditLogById(logId) {
  const rows = await query(
    `
    SELECT
      l.id,
      l.actor_id AS actorId,
      actor.name AS actorName,
      actor.email AS actorEmail,
      l.target_user_id AS targetUserId,
      target_user.name AS targetUserName,
      target_user.email AS targetUserEmail,
      l.action,
      l.target_type AS targetType,
      l.target_id AS targetId,
      l.metadata_json AS metadataJson,
      l.created_at AS createdAt
    FROM admin_audit_logs l
    LEFT JOIN users actor ON actor.id = l.actor_id
    LEFT JOIN users target_user ON target_user.id = l.target_user_id
    WHERE l.id = ?
    LIMIT 1
    `,
    [logId]
  );

  return rows[0] ? normalizeAuditLog(rows[0]) : null;
}

export async function findAdminAuditLogs({
  page = 1,
  limit = 20,
  actorId = null,
  targetUserId = null,
  action = "",
  targetType = "",
} = {}) {
  const safePage = normalizePositiveInt(page, 1);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const whereParts = [];
  const params = [];

  if (normalizePositiveInt(actorId, null)) {
    whereParts.push("l.actor_id = ?");
    params.push(Number(actorId));
  }

  if (normalizePositiveInt(targetUserId, null)) {
    whereParts.push("l.target_user_id = ?");
    params.push(Number(targetUserId));
  }

  if (String(action || "").trim()) {
    whereParts.push("l.action = ?");
    params.push(String(action).trim());
  }

  if (String(targetType || "").trim()) {
    whereParts.push("l.target_type = ?");
    params.push(String(targetType).trim());
  }

  const whereSql =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const rows = await query(
    `
    SELECT
      l.id,
      l.actor_id AS actorId,
      actor.name AS actorName,
      actor.email AS actorEmail,
      l.target_user_id AS targetUserId,
      target_user.name AS targetUserName,
      target_user.email AS targetUserEmail,
      l.action,
      l.target_type AS targetType,
      l.target_id AS targetId,
      l.metadata_json AS metadataJson,
      l.created_at AS createdAt
    FROM admin_audit_logs l
    LEFT JOIN users actor ON actor.id = l.actor_id
    LEFT JOIN users target_user ON target_user.id = l.target_user_id
    ${whereSql}
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    params
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM admin_audit_logs l
    ${whereSql}
    `,
    params
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    logs: rows.map(normalizeAuditLog),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}
