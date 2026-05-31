import { query } from "../db/pool.js";
import { publishNotification } from "../realtime/notificationEvents.js";

const NOTIFICATION_DEDUPE_WINDOWS_IN_MINUTES = {
  follow: 60,
  friend_request: 60,
  friend_accept: 60,
  post_like: 60,
  post_comment: 10,
};
const NOTIFICATION_TYPES_WITHOUT_DEDUPE = new Set([
  "admin_content_removed",
  "report_status_update",
]);

function getDedupeWindowInMinutes(type) {
  return NOTIFICATION_DEDUPE_WINDOWS_IN_MINUTES[type] || 15;
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

function normalizeNotification(notification) {
  return {
    ...notification,
    metadata: parseMetadata(notification.metadataJson),
    isRead: Boolean(notification.isRead),
  };
}

export async function findNotificationById(notificationId) {
  const notifications = await query(
    `
    SELECT
      n.id,
      n.recipient_id AS recipientId,
      n.actor_id AS actorId,
      n.type,
      n.post_id AS postId,
      n.comment_id AS commentId,
      n.conversation_id AS conversationId,
      n.report_id AS reportId,
      n.metadata_json AS metadataJson,
      n.is_read AS isRead,
      n.created_at AS createdAt,

      actor.name AS actorName,
      actor.avatar_url AS actorAvatarUrl,

      p.title AS postTitle,
      r.status AS reportStatus,
      r.target_type AS reportTargetType,
      r.reason AS reportReason

    FROM notifications n
    LEFT JOIN users actor ON actor.id = n.actor_id
    LEFT JOIN posts p ON p.id = n.post_id
    LEFT JOIN reports r ON r.id = n.report_id
    WHERE n.id = ?
    LIMIT 1
    `,
    [notificationId]
  );

  const notification = notifications[0];

  if (!notification) {
    return null;
  }

  return normalizeNotification(notification);
}

export async function createNotification({
  recipientId,
  actorId,
  type,
  postId = null,
  commentId = null,
  conversationId = null,
  reportId = null,
  metadata = {},
}) {
  if (type === "message") {
    return null;
  }

  if (!recipientId || !actorId || Number(recipientId) === Number(actorId)) {
    return null;
  }

  if (!NOTIFICATION_TYPES_WITHOUT_DEDUPE.has(type)) {
    const existingNotifications = await query(
      `
      SELECT id
      FROM notifications
      WHERE recipient_id = ?
        AND actor_id = ?
        AND type = ?
        AND post_id <=> ?
        AND conversation_id <=> ?
        AND report_id <=> ?
        AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? MINUTE)
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [
        recipientId,
        actorId,
        type,
        postId,
        conversationId,
        reportId,
        getDedupeWindowInMinutes(type),
      ]
    );

    if (existingNotifications[0]) {
      return findNotificationById(existingNotifications[0].id);
    }
  }

  const result = await query(
    `
    INSERT INTO notifications (
      recipient_id,
      actor_id,
      type,
      post_id,
      comment_id,
      conversation_id,
      report_id,
      metadata_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      recipientId,
      actorId,
      type,
      postId,
      commentId,
      conversationId,
      reportId,
      JSON.stringify(metadata && typeof metadata === "object" ? metadata : {}),
    ]
  );

  const notification = await findNotificationById(result.insertId);

  if (notification) {
    publishNotification(recipientId, notification);
  }

  return notification;
}

export async function findNotificationsByUserId({
  userId,
  page = 1,
  limit = 20,
}) {
  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const safePage =
    Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1;
  const safeLimit =
    Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 50)
      : 20;
  const offset = (safePage - 1) * safeLimit;

  const notifications = await query(
    `
    SELECT
      n.id,
      n.recipient_id AS recipientId,
      n.actor_id AS actorId,
      n.type,
      n.post_id AS postId,
      n.comment_id AS commentId,
      n.conversation_id AS conversationId,
      n.report_id AS reportId,
      n.metadata_json AS metadataJson,
      n.is_read AS isRead,
      n.created_at AS createdAt,

      actor.name AS actorName,
      actor.avatar_url AS actorAvatarUrl,

      p.title AS postTitle,
      r.status AS reportStatus,
      r.target_type AS reportTargetType,
      r.reason AS reportReason

    FROM notifications n
    LEFT JOIN users actor ON actor.id = n.actor_id
    LEFT JOIN posts p ON p.id = n.post_id
    LEFT JOIN reports r ON r.id = n.report_id
    WHERE n.recipient_id = ?
      AND n.type <> 'message'
    ORDER BY n.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [userId]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM notifications
    WHERE recipient_id = ?
      AND type <> 'message'
    `,
    [userId]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    notifications: notifications.map(normalizeNotification),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}

export async function countUnreadNotifications(userId) {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM notifications
    WHERE recipient_id = ?
      AND is_read = 0
      AND type <> 'message'
    `,
    [userId]
  );

  return Number(rows[0]?.total || 0);
}

export async function markNotificationAsRead(notificationId, userId) {
  await query(
    `
    UPDATE notifications
    SET is_read = 1
    WHERE id = ? AND recipient_id = ?
    `,
    [notificationId, userId]
  );
}

export async function markAllNotificationsAsRead(userId) {
  await query(
    `
    UPDATE notifications
    SET is_read = 1
    WHERE recipient_id = ? AND is_read = 0 AND type <> 'message'
    `,
    [userId]
  );
}
