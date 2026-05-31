import { query } from "../db/pool.js";

export const ADMIN_ROLE_VALUES = ["user", "admin"];

function normalizePositiveInt(value, fallback) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeLimit(value, fallback = 20, max = 50) {
  return Math.min(normalizePositiveInt(value, fallback), max);
}

function normalizePagedResult(items, page, limit, total, key) {
  return {
    [key]: items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export function validateAdminRoleInput(input = {}) {
  const role = String(input.role || "").trim();

  if (!ADMIN_ROLE_VALUES.includes(role)) {
    return {
      value: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Quyền người dùng không hợp lệ.",
        fields: {
          role: "Role phải là user hoặc admin.",
        },
      },
    };
  }

  return {
    value: {
      role,
    },
    error: null,
  };
}

export async function getAdminOverview() {
  const rows = await query(
    `
    SELECT
      (SELECT COUNT(*) FROM users) AS userCount,
      (SELECT COUNT(*) FROM users WHERE role = 'admin') AS adminCount,
      (SELECT COUNT(*) FROM posts) AS postCount,
      (SELECT COUNT(*) FROM comments) AS commentCount,
      (SELECT COUNT(*) FROM reports) AS reportCount,
      (SELECT COUNT(*) FROM reports WHERE status = 'pending') AS pendingReportCount,
      (SELECT COUNT(*) FROM reports WHERE status = 'reviewing') AS reviewingReportCount,
      (SELECT COUNT(*) FROM reports WHERE status = 'resolved') AS resolvedReportCount,
      (SELECT COUNT(*) FROM reports WHERE status = 'dismissed') AS dismissedReportCount,
      (SELECT COUNT(*) FROM messages) AS messageCount,
      (SELECT COUNT(*) FROM notifications WHERE is_read = 0) AS unreadNotificationCount
    `
  );

  const overview = rows[0] || {};

  return {
    userCount: Number(overview.userCount || 0),
    adminCount: Number(overview.adminCount || 0),
    postCount: Number(overview.postCount || 0),
    commentCount: Number(overview.commentCount || 0),
    reportCount: Number(overview.reportCount || 0),
    pendingReportCount: Number(overview.pendingReportCount || 0),
    reviewingReportCount: Number(overview.reviewingReportCount || 0),
    resolvedReportCount: Number(overview.resolvedReportCount || 0),
    dismissedReportCount: Number(overview.dismissedReportCount || 0),
    messageCount: Number(overview.messageCount || 0),
    unreadNotificationCount: Number(overview.unreadNotificationCount || 0),
  };
}

export async function countAdmins() {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM users
    WHERE role = 'admin'
    `
  );

  return Number(rows[0]?.total || 0);
}

export async function findAdminUserById(userId) {
  const users = await query(
    `
    SELECT
      id,
      name,
      email,
      avatar_url AS avatarUrl,
      cover_url AS coverUrl,
      role,
      profile_privacy AS profilePrivacy,
      last_seen_at AS lastSeenAt,
      created_at AS createdAt,
      updated_at AS updatedAt,
      (
        SELECT COUNT(*)
        FROM posts p
        WHERE p.user_id = users.id
      ) AS postCount,
      (
        SELECT COUNT(*)
        FROM comments c
        WHERE c.user_id = users.id
      ) AS commentCount,
      (
        SELECT COUNT(*)
        FROM reports r
        WHERE r.reporter_id = users.id
      ) AS reportCount
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  const user = users[0];

  if (!user) {
    return null;
  }

  return {
    ...user,
    postCount: Number(user.postCount || 0),
    commentCount: Number(user.commentCount || 0),
    reportCount: Number(user.reportCount || 0),
  };
}

export async function findAdminUsers({
  page = 1,
  limit = 20,
  search = "",
  role = "",
} = {}) {
  const safePage = normalizePositiveInt(page, 1);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const whereParts = [];
  const params = [];
  const keyword = String(search || "").trim();

  if (keyword) {
    whereParts.push("(name LIKE ? OR email LIKE ?)");
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  if (ADMIN_ROLE_VALUES.includes(role)) {
    whereParts.push("role = ?");
    params.push(role);
  }

  const whereSql =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const users = await query(
    `
    SELECT
      id,
      name,
      email,
      avatar_url AS avatarUrl,
      cover_url AS coverUrl,
      role,
      profile_privacy AS profilePrivacy,
      last_seen_at AS lastSeenAt,
      created_at AS createdAt,
      updated_at AS updatedAt,
      (
        SELECT COUNT(*)
        FROM posts p
        WHERE p.user_id = users.id
      ) AS postCount,
      (
        SELECT COUNT(*)
        FROM comments c
        WHERE c.user_id = users.id
      ) AS commentCount,
      (
        SELECT COUNT(*)
        FROM reports r
        WHERE r.reporter_id = users.id
      ) AS reportCount
    FROM users
    ${whereSql}
    ORDER BY created_at DESC, id DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    params
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM users
    ${whereSql}
    `,
    params
  );

  const total = Number(countRows[0]?.total || 0);
  const normalizedUsers = users.map((user) => ({
    ...user,
    postCount: Number(user.postCount || 0),
    commentCount: Number(user.commentCount || 0),
    reportCount: Number(user.reportCount || 0),
  }));

  return normalizePagedResult(
    normalizedUsers,
    safePage,
    safeLimit,
    total,
    "users"
  );
}

export async function updateUserRole(userId, role) {
  await query(
    `
    UPDATE users
    SET role = ?
    WHERE id = ?
    `,
    [role, userId]
  );

  return findAdminUserById(userId);
}

export async function findUserDeletionAssets(userId) {
  const users = await query(
    `
    SELECT
      avatar_url AS avatarUrl,
      cover_url AS coverUrl
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  const legacyPostImages = await query(
    `
    SELECT image_url AS url
    FROM posts
    WHERE user_id = ? AND image_url IS NOT NULL
    `,
    [userId]
  );

  const postMedia = await query(
    `
    SELECT pm.media_url AS url
    FROM post_media pm
    JOIN posts p ON p.id = pm.post_id
    WHERE p.user_id = ?
    `,
    [userId]
  );

  return [
    users[0]?.avatarUrl,
    users[0]?.coverUrl,
    ...legacyPostImages.map((item) => item.url),
    ...postMedia.map((item) => item.url),
  ].filter(Boolean);
}

export async function deleteUserById(userId) {
  await query(
    `
    DELETE FROM users
    WHERE id = ?
    `,
    [userId]
  );
}

export async function findAdminPosts({
  page = 1,
  limit = 20,
  search = "",
} = {}) {
  const safePage = normalizePositiveInt(page, 1);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const whereParts = [];
  const params = [];
  const keyword = String(search || "").trim();

  if (keyword) {
    whereParts.push("(p.title LIKE ? OR p.content LIKE ? OR author.name LIKE ?)");
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
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
      p.privacy,
      p.image_url AS imageUrl,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt,
      author.name AS authorName,
      author.email AS authorEmail,
      (
        SELECT COUNT(*)
        FROM comments c
        WHERE c.post_id = p.id
      ) AS commentCount,
      (
        SELECT COUNT(*)
        FROM post_likes pl
        WHERE pl.post_id = p.id
      ) AS reactionCount,
      (
        SELECT COUNT(*)
        FROM posts shared_posts
        WHERE shared_posts.shared_post_id = p.id
      ) AS shareCount,
      (
        SELECT COUNT(*)
        FROM reports r
        WHERE r.target_type = 'post' AND r.target_id = p.id
      ) AS reportCount
    FROM posts p
    JOIN users author ON author.id = p.user_id
    ${whereSql}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    params
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM posts p
    JOIN users author ON author.id = p.user_id
    ${whereSql}
    `,
    params
  );

  const total = Number(countRows[0]?.total || 0);
  const normalizedPosts = posts.map((post) => ({
    ...post,
    commentCount: Number(post.commentCount || 0),
    reactionCount: Number(post.reactionCount || 0),
    shareCount: Number(post.shareCount || 0),
    reportCount: Number(post.reportCount || 0),
  }));

  return normalizePagedResult(
    normalizedPosts,
    safePage,
    safeLimit,
    total,
    "posts"
  );
}

export async function findAdminComments({
  page = 1,
  limit = 20,
  search = "",
} = {}) {
  const safePage = normalizePositiveInt(page, 1);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const whereParts = [];
  const params = [];
  const keyword = String(search || "").trim();

  if (keyword) {
    whereParts.push("(c.content LIKE ? OR author.name LIKE ? OR p.title LIKE ?)");
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const whereSql =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const comments = await query(
    `
    SELECT
      c.id,
      c.post_id AS postId,
      c.user_id AS userId,
      c.content,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,
      author.name AS authorName,
      author.email AS authorEmail,
      p.title AS postTitle,
      p.content AS postContent,
      (
        SELECT COUNT(*)
        FROM reports r
        WHERE r.target_type = 'comment' AND r.target_id = c.id
      ) AS reportCount
    FROM comments c
    JOIN users author ON author.id = c.user_id
    JOIN posts p ON p.id = c.post_id
    ${whereSql}
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    params
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM comments c
    JOIN users author ON author.id = c.user_id
    JOIN posts p ON p.id = c.post_id
    ${whereSql}
    `,
    params
  );

  const total = Number(countRows[0]?.total || 0);
  const normalizedComments = comments.map((comment) => ({
    ...comment,
    reportCount: Number(comment.reportCount || 0),
  }));

  return normalizePagedResult(
    normalizedComments,
    safePage,
    safeLimit,
    total,
    "comments"
  );
}
