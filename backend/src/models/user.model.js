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
export async function updateUserProfile(userId, { name, email }) {
  await query(
    `
      UPDATE users
      SET name = ?, email = ?
      WHERE id = ?
    `,
    [name, email, userId]
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

function normalizeUserListOptions({ page = 1, limit = 10 } = {}) {
  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const safePage =
    Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1;
  const safeLimit =
    Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 50)
      : 10;

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
}

function mapPublicUserListRow(
  user,
  currentUserId = null,
  { includeSuggestionReason = false } = {}
) {
  const mappedUser = {
    ...user,
    followerCount: Number(user.followerCount),
    followingCount: Number(user.followingCount),
    mutualFollowCount: Number(user.mutualFollowCount || 0),
    recentPostCount: Number(user.recentPostCount || 0),
    postCount: Number(user.postCount || 0),
    suggestionScore: Number(user.suggestionScore || 0),
    followsMe: Boolean(user.followsMe),
    isFollowing: Boolean(user.isFollowing),
    isMe: currentUserId ? Number(currentUserId) === Number(user.id) : false,
  };

  if (includeSuggestionReason) {
    if (mappedUser.mutualFollowCount > 0) {
      mappedUser.suggestionReason = `${mappedUser.mutualFollowCount} người bạn đang follow cũng follow`;
    } else if (mappedUser.followsMe) {
      mappedUser.suggestionReason = "Đang follow bạn";
    } else if (mappedUser.recentPostCount > 0) {
      mappedUser.suggestionReason = "Hoạt động gần đây";
    } else if (mappedUser.followerCount > 0) {
      mappedUser.suggestionReason = "Được nhiều người follow";
    } else {
      mappedUser.suggestionReason = "Người dùng mới";
    }
  }

  return mappedUser;
}

export async function searchPublicUsers({
  keyword,
  currentUserId = null,
  page = 1,
  limit = 10,
}) {
  const normalizedKeyword = String(keyword || "").trim();
  const options = normalizeUserListOptions({ page, limit });

  if (!normalizedKeyword) {
    return {
      users: [],
      page: options.page,
      limit: options.limit,
      total: 0,
      totalPages: 0,
    };
  }

  const viewerId = currentUserId || 0;
  const searchPattern = `%${normalizedKeyword}%`;

  const users = await query(
    `
    SELECT
      u.id,
      u.name,
      u.avatar_url AS avatarUrl,
      u.created_at AS createdAt,

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

    FROM users u
    WHERE u.name LIKE ?
    ORDER BY u.name ASC, u.id ASC
    LIMIT ${options.limit} OFFSET ${options.offset}
    `,
    [viewerId, searchPattern]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM users u
    WHERE u.name LIKE ?
    `,
    [searchPattern]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    users: users.map((user) => mapPublicUserListRow(user, currentUserId)),
    page: options.page,
    limit: options.limit,
    total,
    totalPages: Math.ceil(total / options.limit),
  };
}

export async function findSuggestedUsers({ currentUserId, limit = 5 }) {
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
          FROM follows follower_count
          WHERE follower_count.following_id = u.id
        ) AS followerCount,

        (
          SELECT COUNT(*)
          FROM follows following_count
          WHERE following_count.follower_id = u.id
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
        ) AS postCount,

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

        EXISTS(
          SELECT 1
          FROM follows my_follow
          WHERE my_follow.follower_id = ? AND my_follow.following_id = u.id
        ) AS isFollowing

      FROM users u
      WHERE u.id <> ?
        AND NOT EXISTS(
          SELECT 1
          FROM follows existing_follow
          WHERE existing_follow.follower_id = ? AND existing_follow.following_id = u.id
        )
    ) AS candidates
    ORDER BY
      suggestionScore DESC,
      mutualFollowCount DESC,
      followsMe DESC,
      recentPostCount DESC,
      latestPostAt DESC,
      followerCount DESC,
      createdAt DESC,
      id DESC
    LIMIT ${safeLimit}
    `,
    [
      normalizedCurrentUserId,
      normalizedCurrentUserId,
      normalizedCurrentUserId,
      normalizedCurrentUserId,
      normalizedCurrentUserId,
    ]
  );

  return users.map((user) =>
    mapPublicUserListRow(user, normalizedCurrentUserId, {
      includeSuggestionReason: true,
    })
  );
}
