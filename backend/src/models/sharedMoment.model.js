import { pool, query } from "../db/pool.js";
import { findMessageByIdForUser } from "./message.model.js";
import { findPostById } from "./post.model.js";
import { findStoryById } from "./story.model.js";

export const SHARED_MOMENT_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
};

export const SHARED_MOMENT_ITEM_TYPES = new Set([
  "post",
  "story",
  "message",
  "note",
]);

const MAX_PARTICIPANTS = 10;
const MAX_TITLE_LENGTH = 120;
const MAX_NOTE_LENGTH = 1000;
const MAX_MOOD_LENGTH = 40;
const DEFAULT_LIST_LIMIT = 20;

export function parsePositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeText(value, maxLength) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().slice(0, maxLength);
}

export function normalizeParticipantIds(participantIds, currentUserId = null) {
  if (!Array.isArray(participantIds)) {
    return [];
  }

  const ids = [];
  const seenIds = new Set();

  for (const rawId of participantIds) {
    const id = parsePositiveInt(rawId);

    if (!id || Number(id) === Number(currentUserId) || seenIds.has(id)) {
      continue;
    }

    seenIds.add(id);
    ids.push(id);
  }

  return ids.slice(0, MAX_PARTICIPANTS);
}

export function validateSharedMomentInput(input = {}, currentUserId = null) {
  const title = normalizeText(input.title, MAX_TITLE_LENGTH);
  const note = normalizeText(input.note, MAX_NOTE_LENGTH);
  const mood = normalizeText(input.mood, MAX_MOOD_LENGTH);
  const participantIds = normalizeParticipantIds(
    input.participantIds,
    currentUserId
  );

  if (!title) {
    return {
      error: "Bạn cần đặt tên cho khoảnh khắc chung.",
    };
  }

  if (!Array.isArray(input.participantIds) || participantIds.length === 0) {
    return {
      error: "Bạn cần chọn ít nhất một bạn bè.",
    };
  }

  return {
    value: {
      title,
      note,
      mood,
      participantIds,
    },
  };
}

export function validateSharedMomentItemInput(input = {}) {
  const itemType = normalizeText(input.itemType || input.type, 20);
  const content = normalizeText(input.content, MAX_NOTE_LENGTH);
  const postId = parsePositiveInt(input.postId);
  const storyId = parsePositiveInt(input.storyId);
  const messageId = parsePositiveInt(input.messageId);

  if (!SHARED_MOMENT_ITEM_TYPES.has(itemType)) {
    return {
      error: "Loại nội dung khoảnh khắc không hợp lệ.",
    };
  }

  if (itemType === "note" && !content) {
    return {
      error: "Bạn cần nhập nội dung ghi chú.",
    };
  }

  if (itemType === "post" && !postId) {
    return {
      error: "Bài viết không hợp lệ.",
    };
  }

  if (itemType === "story" && !storyId) {
    return {
      error: "Story không hợp lệ.",
    };
  }

  if (itemType === "message" && !messageId) {
    return {
      error: "Tin nhắn không hợp lệ.",
    };
  }

  return {
    value: {
      itemType,
      content,
      postId,
      storyId,
      messageId,
    },
  };
}

function normalizeMoment(row) {
  return {
    id: row.id,
    creatorId: row.creatorId,
    title: row.title,
    note: row.note || "",
    mood: row.mood || "",
    coverMediaUrl: row.coverMediaUrl || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    creator: {
      id: row.creatorId,
      name: row.creatorName,
      avatarUrl: row.creatorAvatarUrl,
    },
    myStatus: row.myStatus,
    participantCount: Number(row.participantCount || 0),
    pendingCount: Number(row.pendingCount || 0),
    itemCount: Number(row.itemCount || 0),
    latestItemAt: row.latestItemAt || null,
  };
}

function normalizeParticipant(row) {
  return {
    id: row.id,
    momentId: row.momentId,
    userId: row.userId,
    invitedById: row.invitedById,
    status: row.status,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
    user: {
      id: row.userId,
      name: row.userName,
      avatarUrl: row.userAvatarUrl,
    },
  };
}

function normalizeItem(row) {
  return {
    id: row.id,
    momentId: row.momentId,
    itemType: row.itemType,
    postId: row.postId,
    storyId: row.storyId,
    messageId: row.messageId,
    conversationId: row.conversationId,
    content: row.content || "",
    mediaUrl: row.mediaUrl || "",
    mediaType: row.mediaType || "",
    createdById: row.createdById,
    createdAt: row.createdAt,
    createdBy: {
      id: row.createdById,
      name: row.createdByName,
      avatarUrl: row.createdByAvatarUrl,
    },
  };
}

function getMomentSelectSql() {
  return `
    SELECT
      sm.id,
      sm.creator_id AS creatorId,
      sm.title,
      sm.note,
      sm.mood,
      sm.cover_media_url AS coverMediaUrl,
      sm.created_at AS createdAt,
      sm.updated_at AS updatedAt,
      creator.name AS creatorName,
      creator.avatar_url AS creatorAvatarUrl,
      me.status AS myStatus,
      (
        SELECT COUNT(*)
        FROM shared_moment_participants smp_count
        WHERE smp_count.moment_id = sm.id
          AND smp_count.status = 'accepted'
      ) AS participantCount,
      (
        SELECT COUNT(*)
        FROM shared_moment_participants smp_pending
        WHERE smp_pending.moment_id = sm.id
          AND smp_pending.status = 'pending'
      ) AS pendingCount,
      (
        SELECT COUNT(*)
        FROM shared_moment_items smi_count
        WHERE smi_count.moment_id = sm.id
      ) AS itemCount,
      (
        SELECT MAX(smi_latest.created_at)
        FROM shared_moment_items smi_latest
        WHERE smi_latest.moment_id = sm.id
      ) AS latestItemAt
    FROM shared_moments sm
    JOIN shared_moment_participants me
      ON me.moment_id = sm.id
      AND me.user_id = ?
      AND me.status <> 'declined'
    JOIN users creator ON creator.id = sm.creator_id
  `;
}

async function execute(connection, sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}

async function findAcceptedFriendIds(userId, candidateIds) {
  const ids = normalizeParticipantIds(candidateIds, userId);

  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => "?").join(", ");
  const rows = await query(
    `
    SELECT
      CASE
        WHEN requester_id = ? THEN addressee_id
        ELSE requester_id
      END AS friendId
    FROM friendships
    WHERE status = 'accepted'
      AND (requester_id = ? OR addressee_id = ?)
      AND (
        CASE
          WHEN requester_id = ? THEN addressee_id
          ELSE requester_id
        END
      ) IN (${placeholders})
    `,
    [userId, userId, userId, userId, ...ids]
  );

  return rows.map((row) => Number(row.friendId));
}

function getFirstPostMedia(post) {
  if (Array.isArray(post.media) && post.media[0]) {
    return post.media[0];
  }

  if (post.imageUrl) {
    return {
      url: post.imageUrl,
      type: "image",
    };
  }

  return null;
}

export async function resolveSharedMomentItem(input, currentUserId) {
  const validation = validateSharedMomentItemInput(input);

  if (validation.error) {
    return validation;
  }

  const item = validation.value;

  if (item.itemType === "note") {
    return {
      value: {
        itemType: "note",
        content: item.content,
        postId: null,
        storyId: null,
        messageId: null,
        conversationId: null,
        mediaUrl: null,
        mediaType: null,
      },
    };
  }

  if (item.itemType === "post") {
    const post = await findPostById(item.postId, currentUserId);

    if (!post) {
      return {
        error: "Không tìm thấy bài viết hoặc bạn không có quyền xem.",
      };
    }

    const media = getFirstPostMedia(post);

    return {
      value: {
        itemType: "post",
        content: post.title || post.content || "Bài viết",
        postId: post.id,
        storyId: null,
        messageId: null,
        conversationId: null,
        mediaUrl: media?.url || null,
        mediaType: media?.type || null,
      },
    };
  }

  if (item.itemType === "story") {
    const story = await findStoryById(item.storyId, currentUserId);

    if (!story) {
      return {
        error: "Không tìm thấy story hoặc bạn không có quyền xem.",
      };
    }

    return {
      value: {
        itemType: "story",
        content: story.caption || "Story",
        postId: null,
        storyId: story.id,
        messageId: null,
        conversationId: null,
        mediaUrl: story.mediaUrl || null,
        mediaType: story.mediaType || null,
      },
    };
  }

  const message = await findMessageByIdForUser(item.messageId, currentUserId);

  if (!message || message.deletedAt) {
    return {
      error: "Không tìm thấy tin nhắn hoặc tin nhắn đã bị thu hồi.",
    };
  }

  return {
    value: {
      itemType: "message",
      content: message.content || message.mediaName || "Tin nhắn",
      postId: null,
      storyId: null,
      messageId: message.id,
      conversationId: message.conversationId,
      mediaUrl: message.mediaUrl || null,
      mediaType: message.mediaType || null,
    },
  };
}

async function insertMomentItem(connection, momentId, userId, item) {
  const result = await execute(
    connection,
    `
    INSERT INTO shared_moment_items (
      moment_id,
      item_type,
      post_id,
      story_id,
      message_id,
      conversation_id,
      content,
      media_url,
      media_type,
      created_by_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      momentId,
      item.itemType,
      item.postId,
      item.storyId,
      item.messageId,
      item.conversationId,
      item.content || null,
      item.mediaUrl || null,
      item.mediaType || null,
      userId,
    ]
  );

  if (item.mediaUrl) {
    await execute(
      connection,
      `
      UPDATE shared_moments
      SET cover_media_url = COALESCE(cover_media_url, ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [item.mediaUrl, momentId]
    );
  } else {
    await execute(
      connection,
      `
      UPDATE shared_moments
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [momentId]
    );
  }

  return result.insertId;
}

async function findDuplicateMomentItem(connection, momentId, item) {
  const duplicateFieldByType = {
    post: "post_id",
    story: "story_id",
    message: "message_id",
  };
  const duplicateValueByType = {
    post: item.postId,
    story: item.storyId,
    message: item.messageId,
  };
  const duplicateField = duplicateFieldByType[item.itemType];
  const duplicateValue = duplicateValueByType[item.itemType];

  if (!duplicateField || !duplicateValue) {
    return null;
  }

  const rows = await execute(
    connection,
    `
    SELECT id
    FROM shared_moment_items
    WHERE moment_id = ?
      AND item_type = ?
      AND ${duplicateField} = ?
    LIMIT 1
    `,
    [momentId, item.itemType, duplicateValue]
  );

  return rows[0] || null;
}

export async function createSharedMoment({
  creatorId,
  title,
  note = "",
  mood = "",
  participantIds,
  initialItem = null,
}) {
  const normalizedParticipantIds = normalizeParticipantIds(
    participantIds,
    creatorId
  );
  const friendIds = await findAcceptedFriendIds(
    creatorId,
    normalizedParticipantIds
  );
  const friendIdSet = new Set(friendIds);

  if (normalizedParticipantIds.length === 0) {
    return {
      error: "Bạn cần chọn ít nhất một bạn bè.",
    };
  }

  if (!normalizedParticipantIds.every((id) => friendIdSet.has(id))) {
    return {
      error: "Bạn chỉ có thể mời bạn bè vào khoảnh khắc chung.",
    };
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const momentResult = await execute(
      connection,
      `
      INSERT INTO shared_moments (
        creator_id,
        title,
        note,
        mood,
        cover_media_url
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        creatorId,
        title,
        note || null,
        mood || null,
        initialItem?.mediaUrl || null,
      ]
    );
    const momentId = momentResult.insertId;

    await execute(
      connection,
      `
      INSERT INTO shared_moment_participants (
        moment_id,
        user_id,
        invited_by_id,
        status,
        responded_at
      )
      VALUES (?, ?, ?, 'accepted', CURRENT_TIMESTAMP)
      `,
      [momentId, creatorId, creatorId]
    );

    for (const participantId of normalizedParticipantIds) {
      await execute(
        connection,
        `
        INSERT INTO shared_moment_participants (
          moment_id,
          user_id,
          invited_by_id,
          status
        )
        VALUES (?, ?, ?, 'pending')
        `,
        [momentId, participantId, creatorId]
      );
    }

    if (initialItem) {
      await insertMomentItem(connection, momentId, creatorId, initialItem);
    }

    await connection.commit();

    return {
      moment: await findSharedMomentByIdForUser(momentId, creatorId),
      invitedUserIds: normalizedParticipantIds,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findSharedMomentsForUser({
  userId,
  page = 1,
  limit = DEFAULT_LIST_LIMIT,
  status = "all",
}) {
  const safePage = parsePositiveInt(page) || 1;
  const safeLimit = Math.min(parsePositiveInt(limit) || DEFAULT_LIST_LIMIT, 50);
  const offset = (safePage - 1) * safeLimit;
  const statusFilter = ["accepted", "pending"].includes(status)
    ? "AND me.status = ?"
    : "";
  const statusParams = statusFilter ? [status] : [];

  const moments = await query(
    `
    ${getMomentSelectSql()}
    WHERE 1 = 1
      ${statusFilter}
    ORDER BY sm.updated_at DESC, sm.id DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [userId, ...statusParams]
  );

  const totalRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM shared_moments sm
    JOIN shared_moment_participants me
      ON me.moment_id = sm.id
      AND me.user_id = ?
      AND me.status <> 'declined'
    WHERE 1 = 1
      ${statusFilter}
    `,
    [userId, ...statusParams]
  );
  const total = Number(totalRows[0]?.total || 0);

  return {
    moments: moments.map(normalizeMoment),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}

export async function findSharedMomentByIdForUser(momentId, userId) {
  const rows = await query(
    `
    ${getMomentSelectSql()}
    WHERE sm.id = ?
    LIMIT 1
    `,
    [userId, momentId]
  );

  if (!rows[0]) {
    return null;
  }

  const participants = await query(
    `
    SELECT
      smp.id,
      smp.moment_id AS momentId,
      smp.user_id AS userId,
      smp.invited_by_id AS invitedById,
      smp.status,
      smp.created_at AS createdAt,
      smp.responded_at AS respondedAt,
      u.name AS userName,
      u.avatar_url AS userAvatarUrl
    FROM shared_moment_participants smp
    JOIN users u ON u.id = smp.user_id
    WHERE smp.moment_id = ?
      AND smp.status <> 'declined'
    ORDER BY
      smp.status = 'accepted' DESC,
      smp.created_at ASC
    `,
    [momentId]
  );

  const items = await query(
    `
    SELECT
      smi.id,
      smi.moment_id AS momentId,
      smi.item_type AS itemType,
      smi.post_id AS postId,
      smi.story_id AS storyId,
      smi.message_id AS messageId,
      smi.conversation_id AS conversationId,
      smi.content,
      smi.media_url AS mediaUrl,
      smi.media_type AS mediaType,
      smi.created_by_id AS createdById,
      smi.created_at AS createdAt,
      u.name AS createdByName,
      u.avatar_url AS createdByAvatarUrl
    FROM shared_moment_items smi
    JOIN users u ON u.id = smi.created_by_id
    WHERE smi.moment_id = ?
    ORDER BY smi.created_at ASC, smi.id ASC
    `,
    [momentId]
  );

  return {
    ...normalizeMoment(rows[0]),
    participants: participants.map(normalizeParticipant),
    items: items.map(normalizeItem),
  };
}

export async function respondToSharedMoment({ momentId, userId, status }) {
  if (
    ![
      SHARED_MOMENT_STATUS.ACCEPTED,
      SHARED_MOMENT_STATUS.DECLINED,
    ].includes(status)
  ) {
    return {
      error: "Trạng thái phản hồi không hợp lệ.",
    };
  }

  const result = await query(
    `
    UPDATE shared_moment_participants
    SET status = ?,
        responded_at = CURRENT_TIMESTAMP
    WHERE moment_id = ?
      AND user_id = ?
      AND status = 'pending'
    `,
    [status, momentId, userId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  await query(
    `
    UPDATE shared_moments
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [momentId]
  );

  if (status === SHARED_MOMENT_STATUS.DECLINED) {
    return {
      declined: true,
    };
  }

  return {
    moment: await findSharedMomentByIdForUser(momentId, userId),
  };
}

export async function addSharedMomentItem({ momentId, userId, item }) {
  const participantRows = await query(
    `
    SELECT id
    FROM shared_moment_participants
    WHERE moment_id = ?
      AND user_id = ?
      AND status = 'accepted'
    LIMIT 1
    `,
    [momentId, userId]
  );

  if (!participantRows[0]) {
    return null;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const duplicateItem = await findDuplicateMomentItem(
      connection,
      momentId,
      item
    );

    if (duplicateItem) {
      await connection.rollback();

      return {
        error: "Nội dung này đã có trong khoảnh khắc.",
        code: "MOMENT_ITEM_ALREADY_EXISTS",
      };
    }

    await insertMomentItem(connection, momentId, userId, item);
    await connection.commit();

    return {
      moment: await findSharedMomentByIdForUser(momentId, userId),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
