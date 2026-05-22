import { query } from "../db/pool.js";

/**
 * Tạo user mới.
 *
 * Function này chỉ quan tâm database.
 * Nó không validate, không hash password.
 * Validate/hash sẽ nằm ở route/controller.
 */
export async function createUser({ name, email, passwordHash }) {
  const result = await query(
    `
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `,
    [name, email, passwordHash]
  );

  /**
   * Với INSERT, mysql2 trả về object có insertId.
   * insertId chính là id vừa được AUTO_INCREMENT tạo ra.
   */
  const insertedId = result.insertId;

  return findUserById(insertedId);
}

/**
 * Tìm user theo id.
 * Function này dùng cho /auth/me và sau khi register.
 *
 * Không select password_hash vì public user không cần password hash.
 */
export async function findUserById(id) {
  const rows = await query(
    `
      SELECT
        id,
        name,
        email,
        avatar_url AS avatarUrl,
        bio,
        location,
        website,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

/**
 * Tìm user theo email.
 *
 * Function này dùng cho login.
 * Cần lấy password_hash để bcrypt.compare.
 */
export async function findUserByEmail(email) {
  const rows = await query(
    `
      SELECT
        id,
        name,
        email,
        avatar_url AS avatarUrl,
        bio,
        location,
        website,
        password_hash AS passwordHash,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
}

/**
 * Tìm public user theo email.
 *
 * Function này dùng cho register để kiểm tra email đã tồn tại chưa.
 * Không cần lấy password_hash.
 */
export async function findPublicUserByEmail(email) {
  const rows = await query(
    `
      SELECT
        id,
        name,
        email,
        avatar_url AS avatarUrl,
        bio,
        location,
        website,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
}
/**
 * Tìm user theo id nhưng có lấy passwordHash.
 *
 * Function này dùng cho change password.
 * Bình thường ta không lấy passwordHash khi trả user về frontend.
 * Nhưng khi đổi password, backend cần passwordHash cũ để bcrypt.compare().
 */
export async function findUserWithPasswordById(id) {
  const rows = await query(
    `
      SELECT
        id,
        name,
        email,
        avatar_url AS avatarUrl,
        bio,
        location,
        website,
        password_hash AS passwordHash,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

/**
 * Update profile user.
 *
 * Chỉ cho đổi name và email.
 * Không update password trong function này.
 */
export async function updateUserProfile(
  userId,
  { name, email, bio = null, location = null, website = null }
) {
  await query(
    `
      UPDATE users
      SET name = ?, email = ?, bio = ?, location = ?, website = ?
      WHERE id = ?
    `,
    [name, email, bio, location, website, userId]
  );

  /**
   * Sau khi update, query lại user mới nhất.
   * Function findUserById không trả passwordHash.
   */
  return findUserById(userId);
}

/**
 * Update avatar URL for current user.
 *
 * The route handles file upload and passes the saved public URL here.
 */
export async function updateUserAvatar(userId, avatarUrl) {
  await query(
    `
      UPDATE users
      SET avatar_url = ?
      WHERE id = ?
    `,
    [avatarUrl, userId]
  );

  return findUserById(userId);
}

/**
 * Update passwordHash.
 *
 * Password gốc không bao giờ được lưu vào database.
 * Route sẽ hash password mới trước, sau đó truyền passwordHash vào đây.
 */
export async function updateUserPassword(userId, passwordHash) {
  await query(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `,
    [passwordHash, userId]
  );
}

export async function findPublicUserProfileById(userId, currentUserId = null) {
  const viewerId = currentUserId || 0;

  const rows = await query(
    `
    SELECT
      u.id,
      u.name,
      u.avatar_url AS avatarUrl,
      u.bio,
      u.location,
      u.website,
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

      EXISTS(
        SELECT 1
        FROM follows f
        WHERE f.follower_id = ? AND f.following_id = u.id
      ) AS isFollowing

    FROM users u
    WHERE u.id = ?
    `,
    [viewerId, userId]
  );

  const profile = rows[0] || null;

  if (!profile) {
    return null;
  }

  return {
    ...profile,
    postCount: Number(profile.postCount),
    followerCount: Number(profile.followerCount),
    followingCount: Number(profile.followingCount),
    isFollowing: Boolean(profile.isFollowing),
    isMe: currentUserId ? Number(currentUserId) === Number(profile.id) : false,
  };
}

export async function searchPublicUsers({
  keyword = "",
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
  const searchKeyword = `%${keyword.trim()}%`;

  const users = await query(
    `
    SELECT
      u.id,
      u.name,
      u.avatar_url AS avatarUrl,
      u.bio,
      u.location,
      u.website,
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

      EXISTS(
        SELECT 1
        FROM follows f
        WHERE f.follower_id = ? AND f.following_id = u.id
      ) AS isFollowing

    FROM users u
    WHERE
      u.name LIKE ?
      AND u.id <> ?
    ORDER BY followerCount DESC, u.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [viewerId, searchKeyword, viewerId]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM users u
    WHERE
      u.name LIKE ?
      AND u.id <> ?
    `,
    [searchKeyword, viewerId]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    users: users.map((user) => ({
      ...user,
      postCount: Number(user.postCount),
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

export async function findSuggestedUsers({
  currentUserId,
  limit = 5,
}) {
  const normalizedCurrentUserId = Number(currentUserId);

  if (!Number.isInteger(normalizedCurrentUserId) || normalizedCurrentUserId <= 0) {
    return [];
  }

  const normalizedLimit = Number(limit);
  const safeLimit =
    Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 20)
      : 5;

  const users = await query(
    `
    SELECT
      candidates.*,
      (
        candidates.mutualFollowCount * 100
        + candidates.followsMe * 80
        + candidates.recentPostCount * 8
        + LEAST(candidates.followerCount, 50)
        + CASE
            WHEN candidates.latestPostAt >= NOW() - INTERVAL 7 DAY THEN 20
            WHEN candidates.latestPostAt >= NOW() - INTERVAL 30 DAY THEN 10
            ELSE 0
          END
      ) AS suggestionScore
    FROM (
      SELECT
        u.id,
        u.name,
        u.avatar_url AS avatarUrl,
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
          FROM follows my_network
          JOIN follows network_follow
            ON network_follow.follower_id = my_network.following_id
          WHERE my_network.follower_id = ?
            AND network_follow.following_id = u.id
        ) AS mutualFollowCount,

        EXISTS(
          SELECT 1
          FROM follows follow_back
          WHERE follow_back.follower_id = u.id
            AND follow_back.following_id = ?
        ) AS followsMe,

        (
          SELECT COUNT(*)
          FROM posts p
          WHERE p.user_id = u.id
            AND p.created_at >= NOW() - INTERVAL 30 DAY
        ) AS recentPostCount,

        (
          SELECT MAX(p.created_at)
          FROM posts p
          WHERE p.user_id = u.id
        ) AS latestPostAt,

        0 AS isFollowing

      FROM users u
      WHERE
        u.id <> ?
        AND NOT EXISTS (
          SELECT 1
          FROM follows f
          WHERE f.follower_id = ? AND f.following_id = u.id
        )
    ) AS candidates
    ORDER BY
      suggestionScore DESC,
      mutualFollowCount DESC,
      followsMe DESC,
      recentPostCount DESC,
      latestPostAt DESC,
      followerCount DESC,
      createdAt DESC
    LIMIT ${safeLimit}
    `,
    [
      normalizedCurrentUserId,
      normalizedCurrentUserId,
      normalizedCurrentUserId,
      normalizedCurrentUserId,
    ]
  );

  return users.map((user) => ({
    ...user,
    postCount: Number(user.postCount),
    followerCount: Number(user.followerCount),
    followingCount: Number(user.followingCount),
    mutualFollowCount: Number(user.mutualFollowCount),
    recentPostCount: Number(user.recentPostCount),
    suggestionScore: Number(user.suggestionScore),
    followsMe: Boolean(user.followsMe),
    suggestionReason: getSuggestionReason(user),
    isFollowing: Boolean(user.isFollowing),
    isMe: false,
  }));
}

function getSuggestionReason(user) {
  const mutualFollowCount = Number(user.mutualFollowCount || 0);
  const recentPostCount = Number(user.recentPostCount || 0);
  const followerCount = Number(user.followerCount || 0);

  if (mutualFollowCount > 0) {
    return `${mutualFollowCount} người bạn đang follow cũng follow`;
  }

  if (Boolean(user.followsMe)) {
    return "Đang follow bạn";
  }

  if (recentPostCount > 0) {
    return "Hoạt động gần đây";
  }

  if (followerCount > 0) {
    return "Được nhiều người follow";
  }

  return "Người dùng mới";
}
