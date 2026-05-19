import { query } from "../db/pool.js";

/**
 * Kiểm tra user đã like post chưa.
 */
export async function hasUserLikedPost(postId, userId) {
  const rows = await query(
    `
      SELECT id
      FROM post_likes
      WHERE post_id = ?
      AND user_id = ?
      LIMIT 1
    `,
    [postId, userId]
  );

  return Boolean(rows[0]);
}

/**
 * Like post.
 */
export async function likePost(postId, userId) {
  await query(
    `
      INSERT INTO post_likes (post_id, user_id)
      VALUES (?, ?)
    `,
    [postId, userId]
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

/**
 * Toggle like.
 *
 * Nếu đã like thì unlike.
 * Nếu chưa like thì like.
 */
export async function togglePostLike(postId, userId) {
  const alreadyLiked = await hasUserLikedPost(postId, userId);

  if (alreadyLiked) {
    await unlikePost(postId, userId);

    return {
      liked: false,
      likeCount: await countPostLikes(postId),
    };
  }

  await likePost(postId, userId);

  return {
    liked: true,
    likeCount: await countPostLikes(postId),
  };
}