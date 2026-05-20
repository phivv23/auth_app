import { query } from "../db/pool.js";

/**
 * Tạo bài viết mới.
 *
 * userId lấy từ req.user.id sau khi requireAuth verify JWT.
 */
export async function createPost(userId, { title, content, imageUrl = null }) {
  const result = await query(
    `
    INSERT INTO posts (user_id, title, content, image_url)
    VALUES (?, ?, ?, ?)
    `,
    [userId, title, content, imageUrl]
  );

  return findPostById(result.insertId, userId);
}

/**
 * Lấy danh sách bài viết có phân trang, search và filter theo author.
 *
 * currentUserId:
 * - dùng để tính likedByMe
 *
 * search:
 * - tìm theo title hoặc content
 *
 * authorId:
 * - nếu có thì chỉ lấy post của user đó
 */
export async function findPosts({
    page,
    limit,
    currentUserId = null,
    search = "",
    authorId = null,
}) {
    const offset = (page - 1) * limit;
    const safeLimit = Number(limit);
    const safeOffset = Number(offset);

    /**
     * Ta build WHERE động nhưng vẫn dùng placeholder ?
     * để tránh SQL injection.
     */
    const whereParts = [];
    const params = [];

    const normalizedSearch = String(search || "").trim();

    if (normalizedSearch) {
        whereParts.push("(p.title LIKE ? OR p.content LIKE ?)");

        const searchPattern = `%${normalizedSearch}%`;

        params.push(searchPattern, searchPattern);
    }

    if (authorId) {
        whereParts.push("p.user_id = ?");
        params.push(authorId);
    }

    const whereSql =
        whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const posts = await query(
        `
      SELECT
        p.id,
        p.user_id AS userId,
        p.title,
        p.content,
        p.image_url AS imageUrl,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,

        u.id AS authorId,
        u.name AS authorName,
        u.email AS authorEmail,

        (
          SELECT COUNT(*)
          FROM comments c
          WHERE c.post_id = p.id
        ) AS commentCount,

        (
          SELECT COUNT(*)
          FROM post_likes pl
          WHERE pl.post_id = p.id
        ) AS likeCount,

        EXISTS (
          SELECT 1
          FROM post_likes pl2
          WHERE pl2.post_id = p.id
          AND pl2.user_id = ?
        ) AS likedByMe

      FROM posts p
      JOIN users u ON u.id = p.user_id
      ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `,
        [currentUserId, ...params]
    );

    const totalRows = await query(
        `
      SELECT COUNT(*) AS total
      FROM posts p
      ${whereSql}
    `,
        params
    );

    const total = totalRows[0].total;

    return {
        posts,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
/**
 * Lấy chi tiết một bài viết.
 */
export async function findPostById(postId, currentUserId = null) {
    const rows = await query(
        `
      SELECT
        p.id,
        p.user_id AS userId,
        p.title,
        p.content,
        p.image_url AS imageUrl,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,

        u.id AS authorId,
        u.name AS authorName,
        u.email AS authorEmail,

        (
          SELECT COUNT(*)
          FROM comments c
          WHERE c.post_id = p.id
        ) AS commentCount,

        (
          SELECT COUNT(*)
          FROM post_likes pl
          WHERE pl.post_id = p.id
        ) AS likeCount,

        EXISTS (
          SELECT 1
          FROM post_likes pl2
          WHERE pl2.post_id = p.id
          AND pl2.user_id = ?
        ) AS likedByMe

      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = ?
      LIMIT 1
    `,
        [currentUserId, postId]
    );

    return rows[0] || null;
}

/**
 * Update bài viết.
 *
 * Chỉ update title/content.
 * Quyền update sẽ được kiểm tra ở route.
 */
export async function updatePost(postId, { title, content, imageUrl }) {
  if (imageUrl) {
    await query(
      `
      UPDATE posts
      SET title = ?, content = ?, image_url = ?
      WHERE id = ?
      `,
      [title, content, imageUrl, postId]
    );
  } else {
    await query(
      `
      UPDATE posts
      SET title = ?, content = ?
      WHERE id = ?
      `,
      [title, content, postId]
    );
  }

  return findPostById(postId);
}

/**
 * Xóa bài viết.
 *
 * Do comments và likes có ON DELETE CASCADE,
 * khi xóa post thì comments/likes liên quan cũng bị xóa.
 */
export async function deletePost(postId) {
    await query(
        `
      DELETE FROM posts
      WHERE id = ?
    `,
        [postId]
    );
}

/**
 * Kiểm tra post có tồn tại không.
 *
 * Dùng cho comment/like.
 */
export async function postExists(postId) {
    const rows = await query(
        `
      SELECT id
      FROM posts
      WHERE id = ?
      LIMIT 1
    `,
        [postId]
    );

    return Boolean(rows[0]);
}


export async function findFeedPosts({ page = 1, limit = 10, currentUserId }) {
  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const safePage =
    Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1;
  const safeLimit =
    Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 50)
      : 10;
  const offset = (safePage - 1) * safeLimit;

  const posts = await query(
    `
    SELECT
      p.id,
      p.user_id AS userId,
      p.title,
      p.content,
      p.image_url AS imageUrl,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt,

      u.name AS authorName,
      u.avatar_url AS authorAvatarUrl,

      COUNT(DISTINCT pl.id) AS likeCount,
      COUNT(DISTINCT c.id) AS commentCount,

      EXISTS(
        SELECT 1
        FROM post_likes my_like
        WHERE my_like.post_id = p.id AND my_like.user_id = ?
      ) AS likedByMe

    FROM posts p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN post_likes pl ON pl.post_id = p.id
    LEFT JOIN comments c ON c.post_id = p.id

    WHERE
      p.user_id = ?
      OR p.user_id IN (
        SELECT f.following_id
        FROM follows f
        WHERE f.follower_id = ?
      )

    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [currentUserId, currentUserId, currentUserId]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM posts p
    WHERE
      p.user_id = ?
      OR p.user_id IN (
        SELECT f.following_id
        FROM follows f
        WHERE f.follower_id = ?
      )
    `,
    [currentUserId, currentUserId]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    posts: posts.map((post) => ({
      ...post,
      likeCount: Number(post.likeCount),
      commentCount: Number(post.commentCount),
      likedByMe: Boolean(post.likedByMe),
    })),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}
