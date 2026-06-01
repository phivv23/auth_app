import { query } from "../db/pool.js";

const PUBLIC_PRIVACY = "public";
const FOLLOWERS_PRIVACY = "followers";
const FRIENDS_PRIVACY = "friends";
const ONLY_ME_PRIVACY = "only_me";

export const STORY_PRIVACY_VALUES = [
  PUBLIC_PRIVACY,
  FOLLOWERS_PRIVACY,
  FRIENDS_PRIVACY,
  ONLY_ME_PRIVACY,
];

function normalizePositiveInt(value, fallback = 20, max = 50) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return Math.min(number, max);
}

function normalizeStory(row, currentUserId = null) {
  return {
    ...row,
    caption: row.caption || "",
    viewedByMe: Boolean(row.viewedByMe),
    isMine: currentUserId
      ? Number(row.userId) === Number(currentUserId)
      : Boolean(row.isMine),
    viewCount: Number(row.viewCount || 0),
    secondsUntilExpiry: Math.max(0, Number(row.secondsUntilExpiry || 0)),
  };
}

function buildStoryVisibilitySql({ currentUserId, storyAlias = "s" }) {
  return {
    sql: `(
      ${storyAlias}.user_id = ?
      OR ${storyAlias}.privacy = ?
      OR (
        ${storyAlias}.privacy = ?
        AND EXISTS (
          SELECT 1
          FROM follows story_follow
          WHERE story_follow.follower_id = ?
            AND story_follow.following_id = ${storyAlias}.user_id
        )
      )
      OR (
        ${storyAlias}.privacy = ?
        AND EXISTS (
          SELECT 1
          FROM friendships story_friendship
          WHERE story_friendship.status = 'accepted'
            AND (
              (story_friendship.requester_id = ? AND story_friendship.addressee_id = ${storyAlias}.user_id)
              OR (story_friendship.addressee_id = ? AND story_friendship.requester_id = ${storyAlias}.user_id)
            )
        )
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM user_blocks story_block
      WHERE (
        story_block.blocker_id = ?
        AND story_block.blocked_id = ${storyAlias}.user_id
      )
      OR (
        story_block.blocked_id = ?
        AND story_block.blocker_id = ${storyAlias}.user_id
      )
    )`,
    params: [
      currentUserId,
      PUBLIC_PRIVACY,
      FOLLOWERS_PRIVACY,
      currentUserId,
      FRIENDS_PRIVACY,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
    ],
  };
}

function getStorySelectSql() {
  return `
    SELECT
      s.id,
      s.user_id AS userId,
      s.media_url AS mediaUrl,
      s.media_type AS mediaType,
      s.caption,
      s.privacy,
      s.expires_at AS expiresAt,
      s.created_at AS createdAt,
      s.updated_at AS updatedAt,

      u.id AS authorId,
      u.name AS authorName,
      u.avatar_url AS authorAvatarUrl,

      EXISTS (
        SELECT 1
        FROM story_views my_story_view
        WHERE my_story_view.story_id = s.id
          AND my_story_view.viewer_id = ?
      ) AS viewedByMe,

      (
        SELECT COUNT(*)
        FROM story_views story_view_count
        WHERE story_view_count.story_id = s.id
      ) AS viewCount,

      TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), s.expires_at) AS secondsUntilExpiry
  `;
}

export function validateStoryInput(input = {}) {
  const caption = String(input.caption || "").trim();
  const privacy = String(input.privacy || FRIENDS_PRIVACY).trim();

  if (caption.length > 500) {
    return {
      value: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Caption story không được vượt quá 500 ký tự.",
        fields: {
          caption: "Caption story không được vượt quá 500 ký tự.",
        },
      },
    };
  }

  if (!STORY_PRIVACY_VALUES.includes(privacy)) {
    return {
      value: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Quyền xem story không hợp lệ.",
        fields: {
          privacy: "Privacy phải là public, followers, friends hoặc only_me.",
        },
      },
    };
  }

  return {
    value: {
      caption,
      privacy,
    },
    error: null,
  };
}

export async function createStory(
  userId,
  { mediaUrl, mediaType = "image", caption = "", privacy = FRIENDS_PRIVACY }
) {
  const result = await query(
    `
    INSERT INTO stories (
      user_id,
      media_url,
      media_type,
      caption,
      privacy,
      expires_at
    )
    VALUES (?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))
    `,
    [userId, mediaUrl, mediaType, caption || null, privacy]
  );

  return findStoryById(result.insertId, userId, {
    includeExpired: true,
  });
}

export async function findActiveStories({
  currentUserId,
  limit = 50,
} = {}) {
  const safeLimit = normalizePositiveInt(limit, 50, 80);
  const visibility = buildStoryVisibilitySql({
    currentUserId,
    storyAlias: "s",
  });

  const rows = await query(
    `
    ${getStorySelectSql()}
    FROM stories s
    JOIN users u ON u.id = s.user_id
    WHERE s.expires_at > UTC_TIMESTAMP()
      AND ${visibility.sql}
    ORDER BY
      (s.user_id = ?) DESC,
      viewedByMe ASC,
      s.created_at DESC,
      s.id DESC
    LIMIT ${safeLimit}
    `,
    [currentUserId, ...visibility.params, currentUserId]
  );

  return rows.map((row) => normalizeStory(row, currentUserId));
}

export async function findStoryById(
  storyId,
  currentUserId,
  { includeExpired = false } = {}
) {
  const visibility = buildStoryVisibilitySql({
    currentUserId,
    storyAlias: "s",
  });
  const activeSql = includeExpired ? "1 = 1" : "s.expires_at > UTC_TIMESTAMP()";
  const rows = await query(
    `
    ${getStorySelectSql()}
    FROM stories s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
      AND ${activeSql}
      AND ${visibility.sql}
    LIMIT 1
    `,
    [currentUserId, storyId, ...visibility.params]
  );

  return rows[0] ? normalizeStory(rows[0], currentUserId) : null;
}

export async function findOwnStoryById(storyId, userId) {
  const rows = await query(
    `
    ${getStorySelectSql()}
    FROM stories s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
      AND s.user_id = ?
    LIMIT 1
    `,
    [userId, storyId, userId]
  );

  return rows[0] ? normalizeStory(rows[0], userId) : null;
}

export async function markStoryViewed(storyId, viewerId) {
  await query(
    `
    INSERT IGNORE INTO story_views (story_id, viewer_id)
    VALUES (?, ?)
    `,
    [storyId, viewerId]
  );
}

export async function deleteStory(storyId, userId) {
  const story = await findOwnStoryById(storyId, userId);

  if (!story) {
    return null;
  }

  await query(
    `
    DELETE FROM stories
    WHERE id = ?
      AND user_id = ?
    `,
    [storyId, userId]
  );

  return story;
}
