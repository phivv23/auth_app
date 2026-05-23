import { query } from "../db/pool.js";

export const FRIENDSHIP_STATUS = {
  NONE: "none",
  SELF: "self",
  OUTGOING_PENDING: "outgoing_pending",
  INCOMING_PENDING: "incoming_pending",
  FRIENDS: "friends",
};

function getFriendPair(userId, otherUserId) {
  return {
    userLowId: Math.min(Number(userId), Number(otherUserId)),
    userHighId: Math.max(Number(userId), Number(otherUserId)),
  };
}

function normalizeFriendship(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    requesterId: row.requesterId,
    addresseeId: row.addresseeId,
    status: row.status,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
    updatedAt: row.updatedAt,
  };
}

export function getViewerFriendshipStatus(row, currentUserId) {
  if (!currentUserId) {
    return FRIENDSHIP_STATUS.NONE;
  }

  if (Number(row.id) === Number(currentUserId)) {
    return FRIENDSHIP_STATUS.SELF;
  }

  if (!row.friendshipStatus) {
    return FRIENDSHIP_STATUS.NONE;
  }

  return row.friendshipStatus;
}

export async function findFriendshipBetween(userId, otherUserId) {
  const { userLowId, userHighId } = getFriendPair(userId, otherUserId);
  const rows = await query(
    `
    SELECT
      id,
      requester_id AS requesterId,
      addressee_id AS addresseeId,
      status,
      created_at AS createdAt,
      responded_at AS respondedAt,
      updated_at AS updatedAt
    FROM friendships
    WHERE user_low_id = ?
      AND user_high_id = ?
    LIMIT 1
    `,
    [userLowId, userHighId]
  );

  return normalizeFriendship(rows[0]);
}

export async function createFriendRequest(requesterId, addresseeId) {
  const { userLowId, userHighId } = getFriendPair(requesterId, addresseeId);
  const result = await query(
    `
    INSERT INTO friendships (
      requester_id,
      addressee_id,
      user_low_id,
      user_high_id,
      status
    )
    VALUES (?, ?, ?, ?, 'pending')
    `,
    [requesterId, addresseeId, userLowId, userHighId]
  );

  return {
    id: result.insertId,
    requesterId,
    addresseeId,
    status: "pending",
  };
}

export async function acceptFriendRequest(currentUserId, requesterId) {
  const result = await query(
    `
    UPDATE friendships
    SET status = 'accepted',
        responded_at = CURRENT_TIMESTAMP
    WHERE requester_id = ?
      AND addressee_id = ?
      AND status = 'pending'
    `,
    [requesterId, currentUserId]
  );

  return result.affectedRows > 0;
}

export async function deletePendingFriendRequest(currentUserId, otherUserId) {
  const { userLowId, userHighId } = getFriendPair(currentUserId, otherUserId);
  const result = await query(
    `
    DELETE FROM friendships
    WHERE user_low_id = ?
      AND user_high_id = ?
      AND status = 'pending'
      AND (requester_id = ? OR addressee_id = ?)
    `,
    [userLowId, userHighId, currentUserId, currentUserId]
  );

  return result.affectedRows > 0;
}

export async function deleteAcceptedFriendship(currentUserId, otherUserId) {
  const { userLowId, userHighId } = getFriendPair(currentUserId, otherUserId);
  const result = await query(
    `
    DELETE FROM friendships
    WHERE user_low_id = ?
      AND user_high_id = ?
      AND status = 'accepted'
    `,
    [userLowId, userHighId]
  );

  return result.affectedRows > 0;
}

export async function countFriends(userId) {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM friendships
    WHERE status = 'accepted'
      AND (requester_id = ? OR addressee_id = ?)
    `,
    [userId, userId]
  );

  return Number(rows[0]?.total || 0);
}

function getUserSelect(viewerId) {
  return {
    sql: `
      u.id,
      u.name,
      u.avatar_url AS avatarUrl,
      u.cover_url AS coverUrl,
      u.created_at AS createdAt,

      (
        SELECT COUNT(*)
        FROM posts p
        WHERE p.user_id = u.id
      ) AS postCount,

      (
        SELECT COUNT(*)
        FROM follows f
        WHERE f.following_id = u.id
      ) AS followerCount,

      (
        SELECT COUNT(*)
        FROM follows f
        WHERE f.follower_id = u.id
      ) AS followingCount,

      (
        SELECT COUNT(*)
        FROM friendships accepted_friend_count
        WHERE accepted_friend_count.status = 'accepted'
          AND (
            accepted_friend_count.requester_id = u.id
            OR accepted_friend_count.addressee_id = u.id
          )
      ) AS friendCount,

      CASE
        WHEN ? = u.id THEN 'self'
        WHEN EXISTS(
          SELECT 1
          FROM friendships status_friendship
          WHERE status_friendship.status = 'accepted'
            AND (
              (status_friendship.requester_id = ? AND status_friendship.addressee_id = u.id)
              OR (status_friendship.addressee_id = ? AND status_friendship.requester_id = u.id)
            )
        ) THEN 'friends'
        WHEN EXISTS(
          SELECT 1
          FROM friendships outgoing_friendship
          WHERE outgoing_friendship.status = 'pending'
            AND outgoing_friendship.requester_id = ?
            AND outgoing_friendship.addressee_id = u.id
        ) THEN 'outgoing_pending'
        WHEN EXISTS(
          SELECT 1
          FROM friendships incoming_friendship
          WHERE incoming_friendship.status = 'pending'
            AND incoming_friendship.requester_id = u.id
            AND incoming_friendship.addressee_id = ?
        ) THEN 'incoming_pending'
        ELSE 'none'
      END AS friendshipStatus,

      EXISTS(
        SELECT 1
        FROM follows my_follow
        WHERE my_follow.follower_id = ? AND my_follow.following_id = u.id
      ) AS isFollowing
    `,
    params: [viewerId, viewerId, viewerId, viewerId, viewerId, viewerId],
  };
}

function normalizeFriendUser(user, currentUserId = null) {
  return {
    ...user,
    postCount: Number(user.postCount || 0),
    followerCount: Number(user.followerCount || 0),
    followingCount: Number(user.followingCount || 0),
    friendCount: Number(user.friendCount || 0),
    isFollowing: Boolean(user.isFollowing),
    friendshipStatus: getViewerFriendshipStatus(user, currentUserId),
    isMe: currentUserId ? Number(currentUserId) === Number(user.id) : false,
  };
}

export async function findFriendRequests({
  currentUserId,
  type = "incoming",
  page = 1,
  limit = 10,
}) {
  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const safePage =
    Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1;
  const safeLimit =
    Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 50)
      : 10;
  const offset = (safePage - 1) * safeLimit;
  const isOutgoing = type === "outgoing";
  const userColumn = isOutgoing ? "f.addressee_id" : "f.requester_id";
  const whereColumn = isOutgoing ? "f.requester_id" : "f.addressee_id";
  const userSelect = getUserSelect(currentUserId);

  const users = await query(
    `
    SELECT
      ${userSelect.sql},
      f.created_at AS requestedAt
    FROM friendships f
    JOIN users u ON u.id = ${userColumn}
    WHERE ${whereColumn} = ?
      AND f.status = 'pending'
    ORDER BY f.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [...userSelect.params, currentUserId]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM friendships f
    WHERE ${whereColumn} = ?
      AND f.status = 'pending'
    `,
    [currentUserId]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    users: users.map((user) => normalizeFriendUser(user, currentUserId)),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}

export async function findFriends({
  userId,
  currentUserId = null,
  page = 1,
  limit = 10,
}) {
  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const safePage =
    Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1;
  const safeLimit =
    Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 50)
      : 10;
  const offset = (safePage - 1) * safeLimit;
  const viewerId = currentUserId || 0;
  const userSelect = getUserSelect(viewerId);

  const users = await query(
    `
    SELECT
      ${userSelect.sql},
      f.responded_at AS friendedAt
    FROM friendships f
    JOIN users u ON u.id = CASE
      WHEN f.requester_id = ? THEN f.addressee_id
      ELSE f.requester_id
    END
    WHERE (f.requester_id = ? OR f.addressee_id = ?)
      AND f.status = 'accepted'
    ORDER BY f.responded_at DESC, f.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [...userSelect.params, userId, userId, userId]
  );

  const total = await countFriends(userId);

  return {
    users: users.map((user) => normalizeFriendUser(user, viewerId)),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}

export async function findFriendSuggestions({
  currentUserId,
  limit = 10,
}) {
  const normalizedLimit = Number(limit);
  const safeLimit =
    Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 20)
      : 10;
  const userSelect = getUserSelect(currentUserId);

  const users = await query(
    `
    SELECT
      ${userSelect.sql},
      (
        SELECT COUNT(*)
        FROM friendships my_friend
        JOIN friendships mutual_friend
          ON (
            (mutual_friend.requester_id = CASE
              WHEN my_friend.requester_id = ? THEN my_friend.addressee_id
              ELSE my_friend.requester_id
            END AND mutual_friend.addressee_id = u.id)
            OR
            (mutual_friend.addressee_id = CASE
              WHEN my_friend.requester_id = ? THEN my_friend.addressee_id
              ELSE my_friend.requester_id
            END AND mutual_friend.requester_id = u.id)
          )
        WHERE my_friend.status = 'accepted'
          AND mutual_friend.status = 'accepted'
          AND (my_friend.requester_id = ? OR my_friend.addressee_id = ?)
      ) AS mutualFriendCount
    FROM users u
    WHERE u.id <> ?
      AND NOT EXISTS (
        SELECT 1
        FROM friendships existing_friendship
        WHERE existing_friendship.user_low_id = LEAST(?, u.id)
          AND existing_friendship.user_high_id = GREATEST(?, u.id)
      )
    ORDER BY mutualFriendCount DESC, friendCount DESC, u.created_at DESC
    LIMIT ${safeLimit}
    `,
    [
      ...userSelect.params,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
    ]
  );

  return users.map((user) => ({
    ...normalizeFriendUser(user, currentUserId),
    mutualFriendCount: Number(user.mutualFriendCount || 0),
    suggestionReason:
      Number(user.mutualFriendCount || 0) > 0
        ? `${user.mutualFriendCount} bạn chung`
        : "Có thể bạn biết",
  }));
}
