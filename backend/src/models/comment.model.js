import { query } from "../db/pool.js";

function toPositiveNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeReactionSummary(rows) {
  return rows.reduce((summaryByCommentId, row) => {
    const commentId = Number(row.commentId);
    const reactionType = row.reactionType || "like";

    if (!summaryByCommentId.has(commentId)) {
      summaryByCommentId.set(commentId, {});
    }

    summaryByCommentId.get(commentId)[reactionType] = Number(
      row.reactionCount || 0
    );

    return summaryByCommentId;
  }, new Map());
}

function getReactionTotal(summary = {}) {
  return Object.values(summary).reduce(
    (total, count) => total + Number(count || 0),
    0
  );
}

function normalizeComment(row, reactionSummary = {}) {
  return {
    id: Number(row.id),
    postId: Number(row.postId),
    parentCommentId: toPositiveNumber(row.parentCommentId),
    userId: Number(row.userId),
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,

    authorId: Number(row.authorId),
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    authorAvatarUrl: row.authorAvatarUrl,

    likeCount: getReactionTotal(reactionSummary) || Number(row.likeCount || 0),
    myReaction: row.myReaction || null,
    reactionSummary,
    replyCount: Number(row.replyCount || 0),
    replies: [],
  };
}

export function buildCommentTree(comments) {
  const commentsById = new Map(
    comments.map((comment) => [
      Number(comment.id),
      {
        ...comment,
        parentCommentId: toPositiveNumber(comment.parentCommentId),
        replies: [],
      },
    ])
  );
  const rootComments = [];

  for (const comment of commentsById.values()) {
    const directParent = commentsById.get(Number(comment.parentCommentId));
    const rootParent = directParent?.parentCommentId
      ? commentsById.get(Number(directParent.parentCommentId))
      : directParent;

    if (rootParent && !rootParent.parentCommentId) {
      rootParent.replies.push(comment);
      continue;
    }

    rootComments.push(comment);
  }

  return rootComments.map((comment) => ({
    ...comment,
    replyCount: Math.max(Number(comment.replyCount || 0), comment.replies.length),
  }));
}

async function attachReactionSummaries(comments) {
  if (comments.length === 0) {
    return comments;
  }

  const commentIds = comments.map((comment) => comment.id);
  const placeholders = commentIds.map(() => "?").join(", ");
  const rows = await query(
    `
      SELECT
        comment_id AS commentId,
        reaction_type AS reactionType,
        COUNT(*) AS reactionCount
      FROM comment_likes
      WHERE comment_id IN (${placeholders})
      GROUP BY comment_id, reaction_type
    `,
    commentIds
  );
  const summaryByCommentId = normalizeReactionSummary(rows);

  return comments.map((comment) =>
    normalizeComment(comment, summaryByCommentId.get(Number(comment.id)) || {})
  );
}

export async function createComment(
  postId,
  userId,
  content,
  { parentCommentId = null, currentUserId = userId } = {}
) {
  const result = await query(
    `
      INSERT INTO comments (post_id, parent_comment_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `,
    [postId, parentCommentId, userId, content]
  );

  return findCommentById(result.insertId, currentUserId);
}

export async function findCommentsByPostId(postId, currentUserId = null) {
  const params = currentUserId ? [currentUserId, postId] : [postId];
  const myReactionSql = currentUserId
    ? `
        (
          SELECT cl2.reaction_type
          FROM comment_likes cl2
          WHERE cl2.comment_id = c.id
            AND cl2.user_id = ?
          LIMIT 1
        ) AS myReaction,
      `
    : "NULL AS myReaction,";
  const comments = await query(
    `
      SELECT
        c.id,
        c.post_id AS postId,
        c.parent_comment_id AS parentCommentId,
        c.user_id AS userId,
        c.content,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,

        u.id AS authorId,
        u.name AS authorName,
        u.email AS authorEmail,
        u.avatar_url AS authorAvatarUrl,

        ${myReactionSql}

        (
          SELECT COUNT(*)
          FROM comment_likes cl
          WHERE cl.comment_id = c.id
        ) AS likeCount,

        (
          SELECT COUNT(*)
          FROM comments replies
          WHERE replies.parent_comment_id = c.id
        ) AS replyCount

      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `,
    params
  );
  const commentsWithReactions = await attachReactionSummaries(comments);

  return buildCommentTree(commentsWithReactions);
}

export async function findCommentById(commentId, currentUserId = null) {
  const params = currentUserId ? [currentUserId, commentId] : [commentId];
  const myReactionSql = currentUserId
    ? `
        (
          SELECT cl2.reaction_type
          FROM comment_likes cl2
          WHERE cl2.comment_id = c.id
            AND cl2.user_id = ?
          LIMIT 1
        ) AS myReaction,
      `
    : "NULL AS myReaction,";
  const rows = await query(
    `
      SELECT
        c.id,
        c.post_id AS postId,
        c.parent_comment_id AS parentCommentId,
        c.user_id AS userId,
        c.content,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,

        u.id AS authorId,
        u.name AS authorName,
        u.email AS authorEmail,
        u.avatar_url AS authorAvatarUrl,

        ${myReactionSql}

        (
          SELECT COUNT(*)
          FROM comment_likes cl
          WHERE cl.comment_id = c.id
        ) AS likeCount,

        (
          SELECT COUNT(*)
          FROM comments replies
          WHERE replies.parent_comment_id = c.id
        ) AS replyCount

      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
      LIMIT 1
    `,
    params
  );

  if (!rows[0]) {
    return null;
  }

  const [comment] = await attachReactionSummaries(rows);

  return comment;
}

export async function updateComment(commentId, content, currentUserId = null) {
  await query(
    `
      UPDATE comments
      SET content = ?
      WHERE id = ?
    `,
    [content, commentId]
  );

  return findCommentById(commentId, currentUserId);
}

export async function countCommentAndReplies(commentId) {
  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM comments
      WHERE id = ? OR parent_comment_id = ?
    `,
    [commentId, commentId]
  );

  return Number(rows[0]?.total || 0);
}

export async function deleteComment(commentId) {
  await query(
    `
      DELETE FROM comments
      WHERE id = ?
    `,
    [commentId]
  );
}

export async function findUserCommentReaction(commentId, userId) {
  const rows = await query(
    `
      SELECT id, reaction_type AS reactionType
      FROM comment_likes
      WHERE comment_id = ?
        AND user_id = ?
      LIMIT 1
    `,
    [commentId, userId]
  );

  return rows[0] || null;
}

export async function countCommentReactions(commentId) {
  const rows = await query(
    `
      SELECT COUNT(*) AS likeCount
      FROM comment_likes
      WHERE comment_id = ?
    `,
    [commentId]
  );

  return Number(rows[0]?.likeCount || 0);
}

export async function countCommentReactionsByType(commentId) {
  const rows = await query(
    `
      SELECT reaction_type AS reactionType, COUNT(*) AS reactionCount
      FROM comment_likes
      WHERE comment_id = ?
      GROUP BY reaction_type
    `,
    [commentId]
  );

  return rows.reduce((summary, row) => {
    summary[row.reactionType || "like"] = Number(row.reactionCount || 0);
    return summary;
  }, {});
}

export async function toggleCommentReaction(
  commentId,
  userId,
  reactionType = "like"
) {
  const existingReaction = await findUserCommentReaction(commentId, userId);

  if (existingReaction?.reactionType === reactionType) {
    await query(
      `
        DELETE FROM comment_likes
        WHERE comment_id = ?
          AND user_id = ?
      `,
      [commentId, userId]
    );

    return {
      reacted: false,
      reactionType: null,
      likeCount: await countCommentReactions(commentId),
      reactionSummary: await countCommentReactionsByType(commentId),
    };
  }

  if (existingReaction) {
    await query(
      `
        UPDATE comment_likes
        SET reaction_type = ?
        WHERE comment_id = ?
          AND user_id = ?
      `,
      [reactionType, commentId, userId]
    );
  } else {
    await query(
      `
        INSERT INTO comment_likes (comment_id, user_id, reaction_type)
        VALUES (?, ?, ?)
      `,
      [commentId, userId, reactionType]
    );
  }

  return {
    reacted: true,
    reactionType,
    likeCount: await countCommentReactions(commentId),
    reactionSummary: await countCommentReactionsByType(commentId),
  };
}
