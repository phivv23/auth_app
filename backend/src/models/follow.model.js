import { query } from "../db/pool.js";

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

      EXISTS(
        SELECT 1
        FROM follows my_follow
        WHERE my_follow.follower_id = ? AND my_follow.following_id = u.id
      ) AS isFollowing

    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = ?
    ORDER BY f.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [viewerId, userId]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM follows
    WHERE following_id = ?
    `,
    [userId]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    users: users.map((user) => ({
      ...user,
      followerCount: Number(user.followerCount),
      followingCount: Number(user.followingCount),
      isFollowing: Boolean(user.isFollowing),
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

      EXISTS(
        SELECT 1
        FROM follows my_follow
        WHERE my_follow.follower_id = ? AND my_follow.following_id = u.id
      ) AS isFollowing

    FROM follows f
    JOIN users u ON u.id = f.following_id
    WHERE f.follower_id = ?
    ORDER BY f.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [viewerId, userId]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM follows
    WHERE follower_id = ?
    `,
    [userId]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    users: users.map((user) => ({
      ...user,
      followerCount: Number(user.followerCount),
      followingCount: Number(user.followingCount),
      isFollowing: Boolean(user.isFollowing),
      isMe: currentUserId ? Number(currentUserId) === Number(user.id) : false,
    })),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}
