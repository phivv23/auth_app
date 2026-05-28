import { query } from "../db/pool.js";

function getUserPair(userId, otherUserId) {
  return {
    userLowId: Math.min(Number(userId), Number(otherUserId)),
    userHighId: Math.max(Number(userId), Number(otherUserId)),
  };
}

export function getBlockFilterSql({
  currentUserId,
  userAlias = "u",
} = {}) {
  if (!currentUserId) {
    return {
      sql: "1 = 1",
      params: [],
    };
  }

  return {
    sql: `NOT EXISTS (
      SELECT 1
      FROM user_blocks visibility_block
      WHERE (
        visibility_block.blocker_id = ?
        AND visibility_block.blocked_id = ${userAlias}.id
      )
      OR (
        visibility_block.blocked_id = ?
        AND visibility_block.blocker_id = ${userAlias}.id
      )
    )`,
    params: [currentUserId, currentUserId],
  };
}

export function getBlockStatusSelectSql(userAlias = "u") {
  return `
      EXISTS(
        SELECT 1
        FROM user_blocks block_by_me
        WHERE block_by_me.blocker_id = ? AND block_by_me.blocked_id = ${userAlias}.id
      ) AS blockedByMe,

      EXISTS(
        SELECT 1
        FROM user_blocks block_me
        WHERE block_me.blocker_id = ${userAlias}.id AND block_me.blocked_id = ?
      ) AS hasBlockedMe
  `;
}

export function getBlockStatusParams(viewerId) {
  return [viewerId, viewerId];
}

export async function findBlockBetween(userId, otherUserId) {
  const rows = await query(
    `
    SELECT
      id,
      blocker_id AS blockerId,
      blocked_id AS blockedId,
      created_at AS createdAt
    FROM user_blocks
    WHERE (blocker_id = ? AND blocked_id = ?)
      OR (blocker_id = ? AND blocked_id = ?)
    LIMIT 1
    `,
    [userId, otherUserId, otherUserId, userId]
  );

  return rows[0] || null;
}

export async function isBlockedBetween(userId, otherUserId) {
  if (!userId || !otherUserId) {
    return false;
  }

  if (Number(userId) === Number(otherUserId)) {
    return false;
  }

  return Boolean(await findBlockBetween(userId, otherUserId));
}

export async function blockUser(blockerId, blockedId) {
  const { userLowId, userHighId } = getUserPair(blockerId, blockedId);

  await query(
    `
    INSERT IGNORE INTO user_blocks (blocker_id, blocked_id)
    VALUES (?, ?)
    `,
    [blockerId, blockedId]
  );

  await query(
    `
    DELETE FROM follows
    WHERE (follower_id = ? AND following_id = ?)
      OR (follower_id = ? AND following_id = ?)
    `,
    [blockerId, blockedId, blockedId, blockerId]
  );

  await query(
    `
    DELETE FROM friendships
    WHERE user_low_id = ? AND user_high_id = ?
    `,
    [userLowId, userHighId]
  );
}

export async function unblockUser(blockerId, blockedId) {
  const result = await query(
    `
    DELETE FROM user_blocks
    WHERE blocker_id = ? AND blocked_id = ?
    `,
    [blockerId, blockedId]
  );

  return result.affectedRows > 0;
}
