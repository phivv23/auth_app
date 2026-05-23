import { query } from "../db/pool.js";

const PUBLIC_PRIVACY = "public";
const FOLLOWERS_PRIVACY = "followers";
const ONLY_ME_PRIVACY = "only_me";

export const POST_PRIVACY_VALUES = [
  PUBLIC_PRIVACY,
  FOLLOWERS_PRIVACY,
  ONLY_ME_PRIVACY,
];

function normalizePost(row) {
  return {
    ...row,
    sharedPostId: row.sharedPostId || null,
    likeCount: Number(row.likeCount || 0),
    commentCount: Number(row.commentCount || 0),
    shareCount: Number(row.shareCount || 0),
    likedByMe: Boolean(row.likedByMe),
    myReaction: row.myReaction || null,
    reactionSummary: row.reactionSummary || {},
  };
}

function buildVisibilitySql({ currentUserId = null, postAlias = "p" }) {
  if (!currentUserId) {
    return {
      sql: `${postAlias}.privacy = ?`,
      params: [PUBLIC_PRIVACY],
    };
  }

  return {
    sql: `(
      ${postAlias}.privacy = ?
      OR ${postAlias}.user_id = ?
      OR (
        ${postAlias}.privacy = ?
        AND EXISTS (
          SELECT 1
          FROM follows visibility_follow
          WHERE visibility_follow.follower_id = ?
            AND visibility_follow.following_id = ${postAlias}.user_id
        )
      )
    )`,
    params: [
      PUBLIC_PRIVACY,
      currentUserId,
      FOLLOWERS_PRIVACY,
      currentUserId,
    ],
  };
}

async function insertPostMedia(postId, media = []) {
  for (const [index, item] of media.entries()) {
    await query(
      `
      INSERT INTO post_media (post_id, media_url, media_type, sort_order)
      VALUES (?, ?, ?, ?)
      `,
      [postId, item.url, item.type || "image", index]
    );
  }
}

async function findPostMediaByPostIds(postIds) {
  if (postIds.length === 0) {
    return new Map();
  }

  const placeholders = postIds.map(() => "?").join(", ");
  const rows = await query(
    `
    SELECT
      id,
      post_id AS postId,
      media_url AS url,
      media_type AS type,
      sort_order AS sortOrder
    FROM post_media
    WHERE post_id IN (${placeholders})
    ORDER BY post_id ASC, sort_order ASC, id ASC
    `,
    postIds
  );

  const mediaByPostId = new Map();

  for (const item of rows) {
    const currentMedia = mediaByPostId.get(item.postId) || [];
    currentMedia.push(item);
    mediaByPostId.set(item.postId, currentMedia);
  }

  return mediaByPostId;
}

export async function findPostMediaByPostId(postId) {
  const mediaByPostId = await findPostMediaByPostIds([postId]);
  return mediaByPostId.get(postId) || [];
}

async function findPostReactionSummariesByPostIds(postIds) {
  if (postIds.length === 0) {
    return new Map();
  }

  const placeholders = postIds.map(() => "?").join(", ");
  const rows = await query(
    `
    SELECT
      post_id AS postId,
      reaction_type AS reactionType,
      COUNT(*) AS reactionCount
    FROM post_likes
    WHERE post_id IN (${placeholders})
    GROUP BY post_id, reaction_type
    `,
    postIds
  );

  const summaryByPostId = new Map();

  for (const row of rows) {
    const currentSummary = summaryByPostId.get(row.postId) || {};
    currentSummary[row.reactionType || "like"] = Number(row.reactionCount || 0);
    summaryByPostId.set(row.postId, currentSummary);
  }

  return summaryByPostId;
}

async function findVisiblePostRowsByIds(postIds, currentUserId = null) {
  if (postIds.length === 0) {
    return [];
  }

  const placeholders = postIds.map(() => "?").join(", ");
  const visibility = buildVisibilitySql({
    currentUserId,
    postAlias: "p",
  });

  return query(
    `
    SELECT
      p.id,
      p.user_id AS userId,
      p.shared_post_id AS sharedPostId,
      p.title,
      p.content,
      p.image_url AS imageUrl,
      p.privacy,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt,

      u.id AS authorId,
      u.name AS authorName,
      u.email AS authorEmail,
      u.avatar_url AS authorAvatarUrl,

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

      (
        SELECT COUNT(*)
        FROM posts shared_posts
        WHERE shared_posts.shared_post_id = p.id
      ) AS shareCount,

      EXISTS (
        SELECT 1
        FROM post_likes pl2
        WHERE pl2.post_id = p.id
          AND pl2.user_id = ?
      ) AS likedByMe,

      (
        SELECT pl3.reaction_type
        FROM post_likes pl3
        WHERE pl3.post_id = p.id
          AND pl3.user_id = ?
        LIMIT 1
      ) AS myReaction

    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.id IN (${placeholders})
      AND ${visibility.sql}
    `,
    [currentUserId, currentUserId, ...postIds, ...visibility.params]
  );
}

async function attachPostExtras(
  posts,
  currentUserId = null,
  { includeShared = true } = {}
) {
  const normalizedPosts = posts.map(normalizePost);
  const postIds = normalizedPosts.map((post) => post.id);
  const mediaByPostId = await findPostMediaByPostIds(
    postIds
  );
  const reactionSummaryByPostId =
    await findPostReactionSummariesByPostIds(postIds);
  let sharedPostById = new Map();

  if (includeShared) {
    const sharedPostIds = [
      ...new Set(
        normalizedPosts
          .map((post) => post.sharedPostId)
          .filter((sharedPostId) => Boolean(sharedPostId))
      ),
    ];

    const sharedRows = await findVisiblePostRowsByIds(
      sharedPostIds,
      currentUserId
    );
    const sharedPosts = await attachPostExtras(sharedRows, currentUserId, {
      includeShared: false,
    });

    sharedPostById = new Map(
      sharedPosts.map((sharedPost) => [sharedPost.id, sharedPost])
    );
  }

  return normalizedPosts.map((post) => {
    const media = mediaByPostId.get(post.id) || [];

    return {
      ...post,
      reactionSummary: reactionSummaryByPostId.get(post.id) || {},
      media:
        media.length > 0
          ? media
          : post.imageUrl
            ? [
                {
                  id: `legacy-${post.id}`,
                  postId: post.id,
                  url: post.imageUrl,
                  type: "image",
                  sortOrder: 0,
                },
              ]
            : [],
      sharedPost: post.sharedPostId
        ? sharedPostById.get(post.sharedPostId) || null
        : null,
    };
  });
}

export async function createPost(
  userId,
  {
    title = null,
    content = "",
    imageUrl = null,
    privacy = PUBLIC_PRIVACY,
    media = [],
    sharedPostId = null,
  }
) {
  const firstMediaUrl = media[0]?.url || imageUrl;
  const result = await query(
    `
    INSERT INTO posts (user_id, shared_post_id, title, content, image_url, privacy)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      sharedPostId || null,
      title || null,
      content || "",
      firstMediaUrl || null,
      privacy,
    ]
  );

  if (media.length > 0) {
    await insertPostMedia(result.insertId, media);
  } else if (imageUrl) {
    await insertPostMedia(result.insertId, [
      {
        url: imageUrl,
        type: "image",
      },
    ]);
  }

  return findPostById(result.insertId, userId);
}

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

  const visibility = buildVisibilitySql({
    currentUserId,
    postAlias: "p",
  });
  whereParts.push(visibility.sql);
  params.push(...visibility.params);

  const whereSql =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const posts = await query(
    `
    SELECT
      p.id,
      p.user_id AS userId,
      p.shared_post_id AS sharedPostId,
      p.title,
      p.content,
      p.image_url AS imageUrl,
      p.privacy,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt,

      u.id AS authorId,
      u.name AS authorName,
      u.email AS authorEmail,
      u.avatar_url AS authorAvatarUrl,

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

      (
        SELECT COUNT(*)
        FROM posts shared_posts
        WHERE shared_posts.shared_post_id = p.id
      ) AS shareCount,

      EXISTS (
        SELECT 1
        FROM post_likes pl2
        WHERE pl2.post_id = p.id
          AND pl2.user_id = ?
      ) AS likedByMe,

      (
        SELECT pl3.reaction_type
        FROM post_likes pl3
        WHERE pl3.post_id = p.id
          AND pl3.user_id = ?
        LIMIT 1
      ) AS myReaction

    FROM posts p
    JOIN users u ON u.id = p.user_id
    ${whereSql}
    ORDER BY p.created_at DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
    `,
    [currentUserId, currentUserId, ...params]
  );

  const totalRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM posts p
    ${whereSql}
    `,
    params
  );

  const total = Number(totalRows[0]?.total || 0);

  return {
    posts: await attachPostExtras(posts, currentUserId),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function findPostById(postId, currentUserId = null) {
  const visibility = buildVisibilitySql({
    currentUserId,
    postAlias: "p",
  });

  const rows = await query(
    `
    SELECT
      p.id,
      p.user_id AS userId,
      p.shared_post_id AS sharedPostId,
      p.title,
      p.content,
      p.image_url AS imageUrl,
      p.privacy,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt,

      u.id AS authorId,
      u.name AS authorName,
      u.email AS authorEmail,
      u.avatar_url AS authorAvatarUrl,

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

      (
        SELECT COUNT(*)
        FROM posts shared_posts
        WHERE shared_posts.shared_post_id = p.id
      ) AS shareCount,

      EXISTS (
        SELECT 1
        FROM post_likes pl2
        WHERE pl2.post_id = p.id
          AND pl2.user_id = ?
      ) AS likedByMe,

      (
        SELECT pl3.reaction_type
        FROM post_likes pl3
        WHERE pl3.post_id = p.id
          AND pl3.user_id = ?
        LIMIT 1
      ) AS myReaction

    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
      AND ${visibility.sql}
    LIMIT 1
    `,
    [currentUserId, currentUserId, postId, ...visibility.params]
  );

  const posts = await attachPostExtras(rows, currentUserId);

  return posts[0] || null;
}

export async function updatePost(
  postId,
  { title = null, content, privacy = PUBLIC_PRIVACY, media = null },
  currentUserId = null
) {
  const shouldReplaceMedia = Array.isArray(media);

  if (shouldReplaceMedia) {
    const firstMediaUrl = media[0]?.url || null;

    await query(
      `
      UPDATE posts
      SET title = ?, content = ?, image_url = ?, privacy = ?
      WHERE id = ?
      `,
      [title || null, content, firstMediaUrl, privacy, postId]
    );

    await query(
      `
      DELETE FROM post_media
      WHERE post_id = ?
      `,
      [postId]
    );

    await insertPostMedia(postId, media);
  } else {
    await query(
      `
      UPDATE posts
      SET title = ?, content = ?, privacy = ?
      WHERE id = ?
      `,
      [title || null, content, privacy, postId]
    );
  }

  return findPostById(postId, currentUserId);
}

export async function deletePost(postId) {
  await query(
    `
    DELETE FROM posts
    WHERE id = ?
    `,
    [postId]
  );
}

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
      p.shared_post_id AS sharedPostId,
      p.title,
      p.content,
      p.image_url AS imageUrl,
      p.privacy,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt,

      u.id AS authorId,
      u.name AS authorName,
      u.avatar_url AS authorAvatarUrl,

      COUNT(DISTINCT pl.id) AS likeCount,
      COUNT(DISTINCT c.id) AS commentCount,

      (
        SELECT COUNT(*)
        FROM posts shared_posts
        WHERE shared_posts.shared_post_id = p.id
      ) AS shareCount,

      EXISTS(
        SELECT 1
        FROM post_likes my_like
        WHERE my_like.post_id = p.id AND my_like.user_id = ?
      ) AS likedByMe,

      (
        SELECT my_reaction.reaction_type
        FROM post_likes my_reaction
        WHERE my_reaction.post_id = p.id AND my_reaction.user_id = ?
        LIMIT 1
      ) AS myReaction

    FROM posts p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN post_likes pl ON pl.post_id = p.id
    LEFT JOIN comments c ON c.post_id = p.id

    WHERE
      p.user_id = ?
      OR (
        p.user_id IN (
          SELECT f.following_id
          FROM follows f
          WHERE f.follower_id = ?
        )
        AND p.privacy IN (?, ?)
      )

    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      PUBLIC_PRIVACY,
      FOLLOWERS_PRIVACY,
    ]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM posts p
    WHERE
      p.user_id = ?
      OR (
        p.user_id IN (
          SELECT f.following_id
          FROM follows f
          WHERE f.follower_id = ?
        )
        AND p.privacy IN (?, ?)
      )
    `,
    [currentUserId, currentUserId, PUBLIC_PRIVACY, FOLLOWERS_PRIVACY]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    posts: await attachPostExtras(posts, currentUserId),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}
