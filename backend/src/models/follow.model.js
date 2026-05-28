import { query } from "../db/pool.js";
import {
  getBlockFilterSql,
  getBlockStatusParams,
  getBlockStatusSelectSql,
} from "./block.model.js";

function getFriendshipStatusSelectSql(userAlias = "u") {
  return `
      (
        SELECT COUNT(*)
        FROM friendships accepted_friend_count
        WHERE accepted_friend_count.status = 'accepted'
          AND (
            accepted_friend_count.requester_id = ${userAlias}.id
            OR accepted_friend_count.addressee_id = ${userAlias}.id
          )
      ) AS friendCount,

      CASE
        WHEN ? = ${userAlias}.id THEN 'self'
        WHEN EXISTS(
          SELECT 1
          FROM friendships accepted_friendship
          WHERE accepted_friendship.status = 'accepted'
            AND (
              (accepted_friendship.requester_id = ? AND accepted_friendship.addressee_id = ${userAlias}.id)
              OR (accepted_friendship.addressee_id = ? AND accepted_friendship.requester_id = ${userAlias}.id)
            )
        ) THEN 'friends'
        WHEN EXISTS(
          SELECT 1
          FROM friendships outgoing_friendship
          WHERE outgoing_friendship.status = 'pending'
            AND outgoing_friendship.requester_id = ?
            AND outgoing_friendship.addressee_id = ${userAlias}.id
        ) THEN 'outgoing_pending'
        WHEN EXISTS(
          SELECT 1
          FROM friendships incoming_friendship
          WHERE incoming_friendship.status = 'pending'
            AND incoming_friendship.requester_id = ${userAlias}.id
            AND incoming_friendship.addressee_id = ?
        ) THEN 'incoming_pending'
        ELSE 'none'
      END AS friendshipStatus
  `;
}

function getFriendshipStatusParams(viewerId) {
  return [viewerId, viewerId, viewerId, viewerId, viewerId];
}

export async function isFollowing(followerId, followingId) {
  const rows = await query(
    `
    SELECT EXISTS(
      SELECT 1
      FROM follows
      WHERE follower_id = ? AND following_id = ?
    ) AS isFollowing
    `,
    [followerId, followingId]
  );

  return Boolean(rows[0]?.isFollowing);
}

export async function followUser(followerId, followingId) {
  await query(
    `
    INSERT IGNORE INTO follows (follower_id, following_id)
    VALUES (?, ?)
    `,
    [followerId, followingId]
  );
}

export async function unfollowUser(followerId, followingId) {
  await query(
    `
    DELETE FROM follows
    WHERE follower_id = ? AND following_id = ?
    `,
    [followerId, followingId]
  );
}

export async function countFollowers(userId) {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM follows
    WHERE following_id = ?
    `,
    [userId]
  );

  return Number(rows[0]?.total || 0);
}

export async function countFollowing(userId) {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM follows
    WHERE follower_id = ?
    `,
    [userId]
  );

  return Number(rows[0]?.total || 0);
}

export async function findFollowers({
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
  const blockFilter = getBlockFilterSql({
    currentUserId: viewerId,
    userAlias: "u",
  });

  const users = await query(
    `
    SELECT
      u.id,
      u.name,
      u.avatar_url AS avatarUrl,
      u.cover_url AS coverUrl,
      u.created_at AS createdAt,
      f.created_at AS followedAt,

      (
        SELECT COUNT(*)
        FROM follows follower_count
        WHERE follower_count.following_id = u.id
      ) AS followerCount,

      (
        SELECT COUNT(*)
        FROM follows following_count
        WHERE following_count.follower_id = u.id
      ) AS followingCount,

      ${getFriendshipStatusSelectSql("u")},

      ${getBlockStatusSelectSql("u")},

      EXISTS(
        SELECT 1
        FROM follows my_follow
        WHERE my_follow.follower_id = ? AND my_follow.following_id = u.id
      ) AS isFollowing

    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = ?
      AND ${blockFilter.sql}
    ORDER BY f.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [
      ...getFriendshipStatusParams(viewerId),
      ...getBlockStatusParams(viewerId),
      viewerId,
      userId,
      ...blockFilter.params,
    ]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = ?
      AND ${blockFilter.sql}
    `,
    [userId, ...blockFilter.params]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    users: users.map((user) => ({
      ...user,
      followerCount: Number(user.followerCount),
      followingCount: Number(user.followingCount),
      friendCount: Number(user.friendCount || 0),
      friendshipStatus: user.friendshipStatus || "none",
      isFollowing: Boolean(user.isFollowing),
      blockedByMe: Boolean(user.blockedByMe),
      hasBlockedMe: Boolean(user.hasBlockedMe),
      isBlocked: Boolean(user.blockedByMe || user.hasBlockedMe),
      isMe: currentUserId ? Number(currentUserId) === Number(user.id) : false,
    })),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}

export async function findFollowing({
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
  const blockFilter = getBlockFilterSql({
    currentUserId: viewerId,
    userAlias: "u",
  });

  const users = await query(
    `
    SELECT
      u.id,
      u.name,
      u.avatar_url AS avatarUrl,
      u.cover_url AS coverUrl,
      u.created_at AS createdAt,
      f.created_at AS followedAt,

      (
        SELECT COUNT(*)
        FROM follows follower_count
        WHERE follower_count.following_id = u.id
      ) AS followerCount,

      (
        SELECT COUNT(*)
        FROM follows following_count
        WHERE following_count.follower_id = u.id
      ) AS followingCount,

      ${getFriendshipStatusSelectSql("u")},

      ${getBlockStatusSelectSql("u")},

      EXISTS(
        SELECT 1
        FROM follows my_follow
        WHERE my_follow.follower_id = ? AND my_follow.following_id = u.id
      ) AS isFollowing

    FROM follows f
    JOIN users u ON u.id = f.following_id
    WHERE f.follower_id = ?
      AND ${blockFilter.sql}
    ORDER BY f.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [
      ...getFriendshipStatusParams(viewerId),
      ...getBlockStatusParams(viewerId),
      viewerId,
      userId,
      ...blockFilter.params,
    ]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM follows f
    JOIN users u ON u.id = f.following_id
    WHERE f.follower_id = ?
      AND ${blockFilter.sql}
    `,
    [userId, ...blockFilter.params]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    users: users.map((user) => ({
      ...user,
      followerCount: Number(user.followerCount),
      followingCount: Number(user.followingCount),
      friendCount: Number(user.friendCount || 0),
      friendshipStatus: user.friendshipStatus || "none",
      isFollowing: Boolean(user.isFollowing),
      blockedByMe: Boolean(user.blockedByMe),
      hasBlockedMe: Boolean(user.hasBlockedMe),
      isBlocked: Boolean(user.blockedByMe || user.hasBlockedMe),
      isMe: currentUserId ? Number(currentUserId) === Number(user.id) : false,
    })),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}
