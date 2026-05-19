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