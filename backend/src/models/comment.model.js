import { query } from "../db/pool.js";

/**
 * Tạo comment mới cho post.
 */
export async function createComment(postId, userId, content) {
  const result = await query(
    `
      INSERT INTO comments (post_id, user_id, content)
      VALUES (?, ?, ?)
    `,
    [postId, userId, content]
  );

  return findCommentById(result.insertId);
}

/**
 * Lấy danh sách comment của một post.
 */
export async function findCommentsByPostId(postId) {
  return query(
    `
      SELECT
        c.id,
        c.post_id AS postId,
        c.user_id AS userId,
        c.content,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,

        u.id AS authorId,
        u.name AS authorName,
        u.email AS authorEmail,
        u.avatar_url AS authorAvatarUrl

      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `,
    [postId]
  );
}

/**
 * Tìm một comment theo id.
 */
export async function findCommentById(commentId) {
  const rows = await query(
    `
      SELECT
        c.id,
        c.post_id AS postId,
        c.user_id AS userId,
        c.content,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,

        u.id AS authorId,
        u.name AS authorName,
        u.email AS authorEmail,
        u.avatar_url AS authorAvatarUrl

      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
      LIMIT 1
    `,
    [commentId]
  );

  return rows[0] || null;
}

/**
 * Update comment.
 *
 * Quyền update sẽ kiểm tra ở route.
 */
export async function updateComment(commentId, content) {
  await query(
    `
      UPDATE comments
      SET content = ?
      WHERE id = ?
    `,
    [content, commentId]
  );

  return findCommentById(commentId);
}

/**
 * Xóa comment.
 *
 * Quyền delete sẽ kiểm tra ở route.
 */
export async function deleteComment(commentId) {
  await query(
    `
      DELETE FROM comments
      WHERE id = ?
    `,
    [commentId]
  );
}
