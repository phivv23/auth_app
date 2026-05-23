import { query } from "../db/pool.js";

/**
 * Kiểm tra user đã like post chưa.
 */
export async function hasUserLikedPost(postId, userId) {
  const rows = await query(
    `
      SELECT id, reaction_type AS reactionType
      FROM post_likes
      WHERE post_id = ?
      AND user_id = ?
      LIMIT 1
    `,
    [postId, userId]
  );

  return Boolean(rows[0]);
}

export async function findUserPostReaction(postId, userId) {
  const rows = await query(
    `
      SELECT id, reaction_type AS reactionType
      FROM post_likes
      WHERE post_id = ?
      AND user_id = ?
      LIMIT 1
    `,
    [postId, userId]
  );

  return rows[0] || null;
}

/**
 * React to post.
 */
export async function likePost(postId, userId, reactionType = "like") {
  await query(
    `
      INSERT INTO post_likes (post_id, user_id, reaction_type)
      VALUES (?, ?, ?)
    `,
    [postId, userId, reactionType]
  );
}

export async function updatePostReaction(postId, userId, reactionType) {
  await query(
    `
      UPDATE post_likes
      SET reaction_type = ?
      WHERE post_id = ?
      AND user_id = ?
    `,
    [reactionType, postId, userId]
  );
}

/**
 * Unlike post.
 */
export async function unlikePost(postId, userId) {
  await query(
    `
      DELETE FROM post_likes
      WHERE post_id = ?
      AND user_id = ?
    `,
    [postId, userId]
  );
}

/**
 * Đếm số like của post.
 */
export async function countPostLikes(postId) {
  const rows = await query(
    `
      SELECT COUNT(*) AS likeCount
      FROM post_likes
      WHERE post_id = ?
    `,
    [postId]
  );

  return rows[0].likeCount;
}

export async function countPostReactionsByType(postId) {
  const rows = await query(
    `
      SELECT reaction_type AS reactionType, COUNT(*) AS reactionCount
      FROM post_likes
      WHERE post_id = ?
      GROUP BY reaction_type
    `,
    [postId]
  );

  return rows.reduce((summary, row) => {
    summary[row.reactionType || "like"] = Number(row.reactionCount || 0);
    return summary;
  }, {});
}

export async function findPostReactions({
  postId,
  page = 1,
  limit = 50,
  reactionType = "",
}) {
  const safePage = Number.isInteger(Number(page)) && Number(page) > 0
    ? Number(page)
    : 1;
  const safeLimit = Number.isInteger(Number(limit)) && Number(limit) > 0
    ? Math.min(Number(limit), 100)
    : 50;
  const offset = (safePage - 1) * safeLimit;
  const params = [postId];
  let reactionFilterSql = "";

  if (reactionType) {
    reactionFilterSql = "AND pl.reaction_type = ?";
    params.push(reactionType);
  }

  const rows = await query(
    `
      SELECT
        u.id AS userId,
        u.name,
        u.avatar_url AS avatarUrl,
        pl.reaction_type AS reactionType,
        pl.created_at AS reactedAt
      FROM post_likes pl
      JOIN users u ON u.id = pl.user_id
      WHERE pl.post_id = ?
      ${reactionFilterSql}
      ORDER BY pl.created_at DESC
      LIMIT ${safeLimit} OFFSET ${offset}
    `,
    params
  );

  const totalRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM post_likes pl
      WHERE pl.post_id = ?
      ${reactionFilterSql}
    `,
    params
  );

  const total = Number(totalRows[0]?.total || 0);

  return {
    users: rows.map((row) => ({
      id: row.userId,
      name: row.name,
      avatarUrl: row.avatarUrl,
      reactionType: row.reactionType || "like",
      reactedAt: row.reactedAt,
    })),
    summary: await countPostReactionsByType(postId),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * Toggle like.
 *
 * Nếu đã like thì unlike.
 * Nếu chưa like thì like.
 */
export async function togglePostLike(postId, userId, reactionType = "like") {
  const existingReaction = await findUserPostReaction(postId, userId);

  if (existingReaction?.reactionType === reactionType) {
    await unlikePost(postId, userId);

    return {
      liked: false,
      reactionType: null,
      likeCount: await countPostLikes(postId),
    };
  }

  if (existingReaction) {
    await updatePostReaction(postId, userId, reactionType);
  } else {
    await likePost(postId, userId, reactionType);
  }

  return {
    liked: true,
    reactionType,
    likeCount: await countPostLikes(postId),
  };
}
