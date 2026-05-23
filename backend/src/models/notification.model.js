import { query } from "../db/pool.js";
import { publishNotification } from "../realtime/notificationEvents.js";

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
      n.is_read AS isRead,
      n.created_at AS createdAt,

      actor.name AS actorName,
      actor.avatar_url AS actorAvatarUrl,

      p.title AS postTitle

    FROM notifications n
    LEFT JOIN users actor ON actor.id = n.actor_id
    LEFT JOIN posts p ON p.id = n.post_id
    WHERE n.id = ?
    LIMIT 1
    `,
    [notificationId]
  );

  const notification = notifications[0];

  if (!notification) {
    return null;
  }

  return {
    ...notification,
    isRead: Boolean(notification.isRead),
  };
}

export async function createNotification({
  recipientId,
  actorId,
  type,
  postId = null,
  commentId = null,
}) {
  // Không tự gửi thông báo cho chính mình
  if (!recipientId || !actorId || Number(recipientId) === Number(actorId)) {
    return null;
  }

  const result = await query(
    `
    INSERT INTO notifications (
      recipient_id,
      actor_id,
      type,
      post_id,
      comment_id
    )
    VALUES (?, ?, ?, ?, ?)
    `,
    [recipientId, actorId, type, postId, commentId]
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
      n.is_read AS isRead,
      n.created_at AS createdAt,

      actor.name AS actorName,
      actor.avatar_url AS actorAvatarUrl,

      p.title AS postTitle

    FROM notifications n
    LEFT JOIN users actor ON actor.id = n.actor_id
    LEFT JOIN posts p ON p.id = n.post_id
    WHERE n.recipient_id = ?
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
    `,
    [userId]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    notifications: notifications.map((notification) => ({
      ...notification,
      isRead: Boolean(notification.isRead),
    })),
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
    WHERE recipient_id = ? AND is_read = 0
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
    WHERE recipient_id = ? AND is_read = 0
    `,
    [userId]
  );
}
