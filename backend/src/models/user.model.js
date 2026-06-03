import { query } from "../db/pool.js";
import {
  getBlockFilterSql,
  getBlockStatusParams,
  getBlockStatusSelectSql,
} from "./block.model.js";

export const PROFILE_PRIVACY_VALUES = [
  "public",
  "followers",
  "friends",
  "only_me",
];

function getFriendshipStatusSelectSql(userAlias = "u") {
  return `
      (
        SELECT COUNT(*)
        FROM friendships accepted_friend_count
        WHERE accepted_friend_count.status = 'accepted'
          AND (
            accepted_friend_count.requester_id = ${userAlias}.id
            OR accepted_friend_count.addressee_id = ${userAlias}.id
          )
      ) AS friendCount,

      CASE
        WHEN ? = ${userAlias}.id THEN 'self'
        WHEN EXISTS(
          SELECT 1
          FROM friendships accepted_friendship
          WHERE accepted_friendship.status = 'accepted'
            AND (
              (accepted_friendship.requester_id = ? AND accepted_friendship.addressee_id = ${userAlias}.id)
              OR (accepted_friendship.addressee_id = ? AND accepted_friendship.requester_id = ${userAlias}.id)
            )
        ) THEN 'friends'
        WHEN EXISTS(
          SELECT 1
          FROM friendships outgoing_friendship
          WHERE outgoing_friendship.status = 'pending'
            AND outgoing_friendship.requester_id = ?
            AND outgoing_friendship.addressee_id = ${userAlias}.id
        ) THEN 'outgoing_pending'
        WHEN EXISTS(
          SELECT 1
          FROM friendships incoming_friendship
          WHERE incoming_friendship.status = 'pending'
            AND incoming_friendship.requester_id = ${userAlias}.id
            AND incoming_friendship.addressee_id = ?
        ) THEN 'incoming_pending'
        ELSE 'none'
      END AS friendshipStatus
  `;
}

function getFriendshipStatusParams(viewerId) {
  return [viewerId, viewerId, viewerId, viewerId, viewerId];
}

function normalizePublicUser(user, currentUserId = null) {
  return {
    ...user,
    postCount: Number(user.postCount || 0),
    followerCount: Number(user.followerCount || 0),
    followingCount: Number(user.followingCount || 0),
    friendCount: Number(user.friendCount || 0),
    friendshipStatus:
      user.friendshipStatus ||
      (currentUserId && Number(currentUserId) === Number(user.id)
        ? "self"
        : "none"),
    isFollowing: Boolean(user.isFollowing),
    blockedByMe: Boolean(user.blockedByMe),
    hasBlockedMe: Boolean(user.hasBlockedMe),
    isBlocked: Boolean(user.blockedByMe || user.hasBlockedMe),
    profilePrivacy: user.profilePrivacy || "public",
    canViewProfile:
      user.canViewProfile === undefined ? true : Boolean(user.canViewProfile),
    isMe: currentUserId ? Number(currentUserId) === Number(user.id) : false,
  };
}

function canViewerAccessProfile(user, currentUserId = null) {
  if (currentUserId && Number(currentUserId) === Number(user.id)) {
    return true;
  }

  if (Boolean(user.blockedByMe || user.hasBlockedMe)) {
    return false;
  }

  if (user.profilePrivacy === "only_me") {
    return false;
  }

  if (user.profilePrivacy === "friends") {
    return user.friendshipStatus === "friends";
  }

  if (user.profilePrivacy === "followers") {
    return Boolean(user.isFollowing) || user.friendshipStatus === "friends";
  }

  return true;
}

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

  return findAuthUserById(insertedId);
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
        cover_url AS coverUrl,
        bio,
        location,
        website,
        profile_privacy AS profilePrivacy,
        last_seen_at AS lastSeenAt,
        account_status AS accountStatus,
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

export async function findActiveModerationUsers({ excludeUserId = null } = {}) {
  const params = [];
  const whereParts = [
    "role IN ('moderator', 'admin', 'super_admin')",
    "account_status = 'active'",
  ];

  if (excludeUserId) {
    whereParts.push("id <> ?");
    params.push(excludeUserId);
  }

  return query(
    `
      SELECT
        id,
        name,
        email,
        role
      FROM users
      WHERE ${whereParts.join(" AND ")}
      ORDER BY
        CASE role
          WHEN 'super_admin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'moderator' THEN 3
          ELSE 4
        END,
        id ASC
    `,
    params
  );
}

export async function findAuthUserById(id) {
  const rows = await query(
    `
      SELECT
        id,
        name,
        email,
        avatar_url AS avatarUrl,
        cover_url AS coverUrl,
        bio,
        location,
        website,
        profile_privacy AS profilePrivacy,
        last_seen_at AS lastSeenAt,
        token_version AS tokenVersion,
        role,
        account_status AS accountStatus,
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
        cover_url AS coverUrl,
        bio,
        location,
        website,
        profile_privacy AS profilePrivacy,
        last_seen_at AS lastSeenAt,
        token_version AS tokenVersion,
        role,
        account_status AS accountStatus,
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
        cover_url AS coverUrl,
        bio,
        location,
        website,
        profile_privacy AS profilePrivacy,
        last_seen_at AS lastSeenAt,
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
        cover_url AS coverUrl,
        bio,
        location,
        website,
        profile_privacy AS profilePrivacy,
        last_seen_at AS lastSeenAt,
        token_version AS tokenVersion,
        role,
        account_status AS accountStatus,
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
  {
    name,
    email,
    bio = null,
    location = null,
    website = null,
    profilePrivacy = "public",
  }
) {
  await query(
    `
      UPDATE users
      SET name = ?,
          email = ?,
          bio = ?,
          location = ?,
          website = ?,
          profile_privacy = ?
      WHERE id = ?
    `,
    [name, email, bio, location, website, profilePrivacy, userId]
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
 * Update cover URL for current user.
 *
 * The route handles file upload and passes the saved public URL here.
 */
export async function updateUserCover(userId, coverUrl) {
  await query(
    `
      UPDATE users
      SET cover_url = ?
      WHERE id = ?
    `,
    [coverUrl, userId]
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
      SET password_hash = ?,
          token_version = token_version + 1
      WHERE id = ?
    `,
    [passwordHash, userId]
  );

  return findAuthUserById(userId);
}

export async function findPublicUserProfileById(userId, currentUserId = null) {
  const viewerId = currentUserId || 0;
  const isSelf = Number(viewerId) === Number(userId);

  const rows = await query(
    `
    SELECT
      u.id,
      u.name,
      u.avatar_url AS avatarUrl,
      u.cover_url AS coverUrl,
      u.bio,
      u.location,
      u.website,
      u.profile_privacy AS profilePrivacy,
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

      ${getFriendshipStatusSelectSql("u")},

      ${getBlockStatusSelectSql("u")},

      EXISTS(
        SELECT 1
        FROM follows f
        WHERE f.follower_id = ? AND f.following_id = u.id
      ) AS isFollowing

    FROM users u
    WHERE u.id = ?
    `,
    [
      ...getFriendshipStatusParams(viewerId),
      ...getBlockStatusParams(viewerId),
      viewerId,
      userId,
    ]
  );

  const profile = rows[0] || null;

  if (!profile || (!isSelf && Boolean(profile.hasBlockedMe))) {
    return null;
  }

  const canViewProfile = canViewerAccessProfile(profile, currentUserId);
  const normalizedProfile = normalizePublicUser(
    {
      ...profile,
      canViewProfile,
    },
    currentUserId
  );

  if (canViewProfile) {
    return normalizedProfile;
  }

  return {
    ...normalizedProfile,
    bio: null,
    location: null,
    website: null,
    postCount: 0,
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
  const blockFilter = getBlockFilterSql({
    currentUserId: viewerId,
    userAlias: "u",
  });

  const users = await query(
    `
    SELECT
      u.id,
      u.name,
      u.avatar_url AS avatarUrl,
      u.cover_url AS coverUrl,
      u.bio,
      u.location,
      u.website,
      u.profile_privacy AS profilePrivacy,
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

      ${getFriendshipStatusSelectSql("u")},

      ${getBlockStatusSelectSql("u")},

      EXISTS(
        SELECT 1
        FROM follows f
        WHERE f.follower_id = ? AND f.following_id = u.id
      ) AS isFollowing

    FROM users u
    WHERE
      u.name LIKE ?
      AND u.id <> ?
      AND ${blockFilter.sql}
    ORDER BY followerCount DESC, u.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [
      ...getFriendshipStatusParams(viewerId),
      ...getBlockStatusParams(viewerId),
      viewerId,
      searchKeyword,
      viewerId,
      ...blockFilter.params,
    ]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM users u
    WHERE
      u.name LIKE ?
      AND u.id <> ?
      AND ${blockFilter.sql}
    `,
    [searchKeyword, viewerId, ...blockFilter.params]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    users: users.map((user) => normalizePublicUser(user, currentUserId)),
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
  const blockFilter = getBlockFilterSql({
    currentUserId: normalizedCurrentUserId,
    userAlias: "u",
  });

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
        u.cover_url AS coverUrl,
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

        ${getFriendshipStatusSelectSql("u")},

        ${getBlockStatusSelectSql("u")},

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
        AND ${blockFilter.sql}
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
      ...getFriendshipStatusParams(normalizedCurrentUserId),
      ...getBlockStatusParams(normalizedCurrentUserId),
      normalizedCurrentUserId,
      normalizedCurrentUserId,
      normalizedCurrentUserId,
      normalizedCurrentUserId,
      ...blockFilter.params,
    ]
  );

  return users.map((user) => ({
    ...normalizePublicUser(user, normalizedCurrentUserId),
    mutualFollowCount: Number(user.mutualFollowCount),
    recentPostCount: Number(user.recentPostCount),
    suggestionScore: Number(user.suggestionScore),
    followsMe: Boolean(user.followsMe),
    suggestionReason: getSuggestionReason(user),
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
