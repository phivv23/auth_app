import { query } from "../db/pool.js";
import { isBlockedBetween } from "./block.model.js";
import { findFriendshipBetween } from "./friend.model.js";
import { findUserById } from "./user.model.js";
import { isUserOnline, publishMessage } from "../realtime/messageEvents.js";

const MESSAGE_UPLOAD_PATH_PREFIX = "/uploads/messages/";

export function getProtectedMessageMediaUrl(mediaUrl) {
  if (!mediaUrl) {
    return null;
  }

  if (!String(mediaUrl).startsWith(MESSAGE_UPLOAD_PATH_PREFIX)) {
    return mediaUrl;
  }

  const filename = String(mediaUrl).slice(MESSAGE_UPLOAD_PATH_PREFIX.length);

  if (!filename || filename.includes("/") || filename.includes("\\")) {
    return null;
  }

  return `/api/messages/media/${encodeURIComponent(filename)}`;
}

function getUserPair(userId, otherUserId) {
  return {
    userLowId: Math.min(Number(userId), Number(otherUserId)),
    userHighId: Math.max(Number(userId), Number(otherUserId)),
  };
}

function normalizeConversation(row) {
  return {
    id: row.id,
    userLowId: row.userLowId,
    userHighId: row.userHighId,
    requesterId: row.requesterId,
    status: row.status || "accepted",
    isMessageRequest:
      row.status === "pending" &&
      Number(row.requesterId) !== Number(row.currentUserId),
    otherUser: {
      id: row.otherUserId,
      name: row.otherUserName,
      avatarUrl: row.otherUserAvatarUrl,
      isOnline: isUserOnline(row.otherUserId),
      lastSeenAt: row.otherUserLastSeenAt || null,
    },
    lastMessage: row.lastMessageId
      ? {
          id: row.lastMessageId,
          senderId: row.lastMessageSenderId,
          content: row.lastMessageContent,
          mediaUrl: getProtectedMessageMediaUrl(row.lastMessageMediaUrl),
          mediaType: row.lastMessageMediaType || null,
          mediaName: row.lastMessageMediaName || null,
          createdAt: row.lastMessageCreatedAt,
          editedAt: row.lastMessageEditedAt || null,
          deletedAt: row.lastMessageDeletedAt || null,
        }
      : null,
    unreadCount: Number(row.unreadCount || 0),
    lastReadMessageId: row.currentLastReadMessageId || null,
    peerLastReadMessageId: row.peerLastReadMessageId || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    content: row.content || "",
    mediaUrl: getProtectedMessageMediaUrl(row.mediaUrl),
    mediaType: row.mediaType || null,
    mediaName: row.mediaName || null,
    createdAt: row.createdAt,
    editedAt: row.editedAt || null,
    deletedAt: row.deletedAt || null,
    senderName: row.senderName,
    senderAvatarUrl: row.senderAvatarUrl,
    replyToMessage: row.replyToMessageId
      ? {
          id: row.replyToMessageId,
          senderId: row.replySenderId,
          senderName: row.replySenderName,
          content: row.replyContent || "",
          mediaType: row.replyMediaType || null,
          mediaName: row.replyMediaName || null,
          deletedAt: row.replyDeletedAt || null,
        }
      : null,
  };
}

export async function findMessageAttachmentForUser({ filename, userId }) {
  if (
    !filename ||
    String(filename).includes("/") ||
    String(filename).includes("\\")
  ) {
    return null;
  }

  const rows = await query(
    `
    SELECT
      m.media_url AS mediaUrl,
      m.media_type AS mediaType,
      m.media_name AS mediaName
    FROM messages m
    JOIN conversation_members member
      ON member.conversation_id = m.conversation_id
      AND member.user_id = ?
    WHERE m.media_url = ?
      AND m.deleted_at IS NULL
    LIMIT 1
    `,
    [userId, `${MESSAGE_UPLOAD_PATH_PREFIX}${filename}`]
  );

  if (!rows[0]) {
    return null;
  }

  return {
    mediaUrl: rows[0].mediaUrl,
    mediaType: rows[0].mediaType || "file",
    mediaName: rows[0].mediaName || null,
  };
}

function normalizeMessageReaction(row) {
  return {
    userId: row.userId,
    reaction: row.reaction,
    userName: row.userName,
    userAvatarUrl: row.userAvatarUrl,
    updatedAt: row.updatedAt,
  };
}

function withMessageReactions(message, reactions = [], currentUserId) {
  const normalizedReactions = reactions.map(normalizeMessageReaction);
  const myReaction =
    normalizedReactions.find(
      (reaction) => Number(reaction.userId) === Number(currentUserId)
    )?.reaction || null;

  return {
    ...message,
    reactions: normalizedReactions,
    myReaction,
  };
}

export function getMessagePaginationMetadata({
  messages,
  page = null,
  limit,
  total = null,
  hasMore = null,
}) {
  const normalizedTotal = total === null ? null : Number(total || 0);
  const totalPages =
    normalizedTotal === null ? null : Math.ceil(normalizedTotal / limit);

  return {
    page,
    total: normalizedTotal,
    totalPages,
    hasMore:
      hasMore === null
        ? Boolean(page && totalPages && Number(page) < Number(totalPages))
        : Boolean(hasMore),
    oldestMessageId: messages[0]?.id || null,
  };
}

async function findReactionsByMessageIds(messageIds) {
  const ids = [...new Set(messageIds.map(Number).filter(Boolean))];

  if (ids.length === 0) {
    return new Map();
  }

  const placeholders = ids.map(() => "?").join(", ");
  const rows = await query(
    `
    SELECT
      reaction.message_id AS messageId,
      reaction.user_id AS userId,
      reaction.reaction,
      reaction.updated_at AS updatedAt,
      reactor.name AS userName,
      reactor.avatar_url AS userAvatarUrl
    FROM message_reactions reaction
    JOIN users reactor ON reactor.id = reaction.user_id
    WHERE reaction.message_id IN (${placeholders})
    ORDER BY reaction.updated_at ASC, reaction.id ASC
    `,
    ids
  );

  return rows.reduce((reactionsByMessageId, row) => {
    const key = Number(row.messageId);
    const reactions = reactionsByMessageId.get(key) || [];

    reactions.push(row);
    reactionsByMessageId.set(key, reactions);

    return reactionsByMessageId;
  }, new Map());
}

async function attachReactionsToMessages(messages, currentUserId) {
  const reactionsByMessageId = await findReactionsByMessageIds(
    messages.map((message) => message.id)
  );

  return messages.map((message) =>
    withMessageReactions(
      message,
      reactionsByMessageId.get(Number(message.id)) || [],
      currentUserId
    )
  );
}

export async function findMessageByIdForUser(messageId, currentUserId) {
  const rows = await query(
    `
    SELECT
      m.id,
      m.conversation_id AS conversationId,
      m.sender_id AS senderId,
      m.content,
      m.media_url AS mediaUrl,
      m.media_type AS mediaType,
      m.media_name AS mediaName,
      m.created_at AS createdAt,
      m.edited_at AS editedAt,
      m.deleted_at AS deletedAt,
      sender.name AS senderName,
      sender.avatar_url AS senderAvatarUrl,
      reply_message.id AS replyToMessageId,
      reply_message.sender_id AS replySenderId,
      reply_sender.name AS replySenderName,
      reply_message.content AS replyContent,
      reply_message.media_type AS replyMediaType,
      reply_message.media_name AS replyMediaName,
      reply_message.deleted_at AS replyDeletedAt
    FROM messages m
    JOIN conversation_members member
      ON member.conversation_id = m.conversation_id
      AND member.user_id = ?
    JOIN users sender ON sender.id = m.sender_id
    LEFT JOIN messages reply_message ON reply_message.id = m.reply_to_message_id
    LEFT JOIN users reply_sender ON reply_sender.id = reply_message.sender_id
    WHERE m.id = ?
    LIMIT 1
    `,
    [currentUserId, messageId]
  );

  if (!rows[0]) {
    return null;
  }

  const [message] = await attachReactionsToMessages(
    [normalizeMessage(rows[0])],
    currentUserId
  );

  return message;
}

export async function assertCanMessage(userId, otherUserId) {
  if (Number(userId) === Number(otherUserId)) {
    return false;
  }

  if (await isBlockedBetween(userId, otherUserId)) {
    return false;
  }

  const friendship = await findFriendshipBetween(userId, otherUserId);
  return friendship?.status === "accepted";
}

async function getConversationStatus(currentUserId, otherUserId) {
  if (await isBlockedBetween(currentUserId, otherUserId)) {
    return null;
  }

  const friendship = await findFriendshipBetween(currentUserId, otherUserId);

  return friendship?.status === "accepted" ? "accepted" : "pending";
}

async function ensureConversationMembers(conversationId, userLowId, userHighId) {
  await query(
    `
    INSERT IGNORE INTO conversation_members (conversation_id, user_id)
    VALUES (?, ?), (?, ?)
    `,
    [conversationId, userLowId, conversationId, userHighId]
  );
}

export async function findConversationById(conversationId, currentUserId) {
  const rows = await query(
    `
    SELECT
      c.id,
      c.user_low_id AS userLowId,
      c.user_high_id AS userHighId,
      c.requester_id AS requesterId,
      c.status,
      ? AS currentUserId,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,

      other_user.id AS otherUserId,
      other_user.name AS otherUserName,
      other_user.avatar_url AS otherUserAvatarUrl,
      other_user.last_seen_at AS otherUserLastSeenAt,
      member.last_read_message_id AS currentLastReadMessageId,
      peer_member.last_read_message_id AS peerLastReadMessageId,

      last_message.id AS lastMessageId,
      last_message.sender_id AS lastMessageSenderId,
      last_message.content AS lastMessageContent,
      last_message.media_url AS lastMessageMediaUrl,
      last_message.media_type AS lastMessageMediaType,
      last_message.media_name AS lastMessageMediaName,
      last_message.created_at AS lastMessageCreatedAt,
      last_message.edited_at AS lastMessageEditedAt,
      last_message.deleted_at AS lastMessageDeletedAt,

      (
        SELECT COUNT(*)
        FROM messages unread_message
        LEFT JOIN conversation_members current_member
          ON current_member.conversation_id = c.id
          AND current_member.user_id = ?
        WHERE unread_message.conversation_id = c.id
          AND unread_message.sender_id <> ?
          AND (
            current_member.last_read_message_id IS NULL
            OR unread_message.id > current_member.last_read_message_id
          )
      ) AS unreadCount
    FROM conversations c
    JOIN conversation_members member
      ON member.conversation_id = c.id
      AND member.user_id = ?
    JOIN users other_user
      ON other_user.id = CASE
        WHEN c.user_low_id = ? THEN c.user_high_id
        ELSE c.user_low_id
      END
    LEFT JOIN conversation_members peer_member
      ON peer_member.conversation_id = c.id
      AND peer_member.user_id = other_user.id
    LEFT JOIN messages last_message
      ON last_message.id = (
        SELECT latest_message.id
        FROM messages latest_message
        WHERE latest_message.conversation_id = c.id
        ORDER BY latest_message.id DESC
        LIMIT 1
      )
    WHERE c.id = ?
    LIMIT 1
    `,
    [
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      conversationId,
    ]
  );

  const conversation = rows[0] ? normalizeConversation(rows[0]) : null;

  if (
    conversation &&
    (await isBlockedBetween(currentUserId, conversation.otherUser.id))
  ) {
    return null;
  }

  return conversation;
}

export async function findOrCreateConversation(currentUserId, otherUserId) {
  if (Number(currentUserId) === Number(otherUserId)) {
    return null;
  }

  const otherUser = await findUserById(otherUserId);

  if (!otherUser) {
    return null;
  }

  if (await isBlockedBetween(currentUserId, otherUserId)) {
    return null;
  }

  const { userLowId, userHighId } = getUserPair(currentUserId, otherUserId);
  const status = await getConversationStatus(currentUserId, otherUserId);

  if (!status) {
    return null;
  }

  await query(
    `
    INSERT IGNORE INTO conversations (
      user_low_id,
      user_high_id,
      requester_id,
      status
    )
    VALUES (?, ?, ?, ?)
    `,
    [userLowId, userHighId, currentUserId, status]
  );

  if (status === "accepted") {
    await query(
      `
      UPDATE conversations
      SET status = 'accepted'
      WHERE user_low_id = ? AND user_high_id = ?
      `,
      [userLowId, userHighId]
    );
  }

  const conversations = await query(
    `
    SELECT id
    FROM conversations
    WHERE user_low_id = ? AND user_high_id = ?
    LIMIT 1
    `,
    [userLowId, userHighId]
  );

  const conversationId = conversations[0]?.id;

  if (!conversationId) {
    return null;
  }

  await ensureConversationMembers(conversationId, userLowId, userHighId);

  return findConversationById(conversationId, currentUserId);
}

export async function findConversationsByUserId({
  currentUserId,
  page = 1,
  limit = 20,
}) {
  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const safePage =
    Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1;
  const safeLimit =
    Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 50)
      : 20;
  const offset = (safePage - 1) * safeLimit;

  const conversations = await query(
    `
    SELECT
      c.id,
      c.user_low_id AS userLowId,
      c.user_high_id AS userHighId,
      c.requester_id AS requesterId,
      c.status,
      ? AS currentUserId,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,

      other_user.id AS otherUserId,
      other_user.name AS otherUserName,
      other_user.avatar_url AS otherUserAvatarUrl,
      other_user.last_seen_at AS otherUserLastSeenAt,
      member.last_read_message_id AS currentLastReadMessageId,
      peer_member.last_read_message_id AS peerLastReadMessageId,

      last_message.id AS lastMessageId,
      last_message.sender_id AS lastMessageSenderId,
      last_message.content AS lastMessageContent,
      last_message.media_url AS lastMessageMediaUrl,
      last_message.media_type AS lastMessageMediaType,
      last_message.media_name AS lastMessageMediaName,
      last_message.created_at AS lastMessageCreatedAt,
      last_message.edited_at AS lastMessageEditedAt,
      last_message.deleted_at AS lastMessageDeletedAt,

      (
        SELECT COUNT(*)
        FROM messages unread_message
        WHERE unread_message.conversation_id = c.id
          AND unread_message.sender_id <> ?
          AND (
            member.last_read_message_id IS NULL
            OR unread_message.id > member.last_read_message_id
          )
      ) AS unreadCount
    FROM conversations c
    JOIN conversation_members member
      ON member.conversation_id = c.id
      AND member.user_id = ?
    JOIN users other_user
      ON other_user.id = CASE
        WHEN c.user_low_id = ? THEN c.user_high_id
        ELSE c.user_low_id
      END
    LEFT JOIN conversation_members peer_member
      ON peer_member.conversation_id = c.id
      AND peer_member.user_id = other_user.id
    LEFT JOIN messages last_message
      ON last_message.id = (
        SELECT latest_message.id
        FROM messages latest_message
        WHERE latest_message.conversation_id = c.id
        ORDER BY latest_message.id DESC
        LIMIT 1
      )
    WHERE (c.status = 'accepted' OR c.requester_id = ?)
      AND NOT EXISTS (
        SELECT 1
        FROM user_blocks conversation_block
        WHERE (
          conversation_block.blocker_id = ?
          AND conversation_block.blocked_id = other_user.id
        )
        OR (
          conversation_block.blocked_id = ?
          AND conversation_block.blocker_id = other_user.id
        )
      )
    ORDER BY COALESCE(last_message.created_at, c.updated_at) DESC, c.id DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
    ]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM conversation_members cm
    JOIN conversations c ON c.id = cm.conversation_id
    WHERE cm.user_id = ?
      AND (c.status = 'accepted' OR c.requester_id = ?)
      AND NOT EXISTS (
        SELECT 1
        FROM user_blocks conversation_block
        WHERE (
          conversation_block.blocker_id = ?
          AND conversation_block.blocked_id = CASE
            WHEN c.user_low_id = ? THEN c.user_high_id
            ELSE c.user_low_id
          END
        )
        OR (
          conversation_block.blocked_id = ?
          AND conversation_block.blocker_id = CASE
            WHEN c.user_low_id = ? THEN c.user_high_id
            ELSE c.user_low_id
          END
        )
      )
    `,
    [
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
    ]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    conversations: conversations.map(normalizeConversation),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}

export async function findMessageRequestsByUserId({
  currentUserId,
  page = 1,
  limit = 20,
}) {
  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const safePage =
    Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1;
  const safeLimit =
    Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 50)
      : 20;
  const offset = (safePage - 1) * safeLimit;

  const conversations = await query(
    `
    SELECT
      c.id,
      c.user_low_id AS userLowId,
      c.user_high_id AS userHighId,
      c.requester_id AS requesterId,
      c.status,
      ? AS currentUserId,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,

      other_user.id AS otherUserId,
      other_user.name AS otherUserName,
      other_user.avatar_url AS otherUserAvatarUrl,
      other_user.last_seen_at AS otherUserLastSeenAt,
      member.last_read_message_id AS currentLastReadMessageId,
      peer_member.last_read_message_id AS peerLastReadMessageId,

      last_message.id AS lastMessageId,
      last_message.sender_id AS lastMessageSenderId,
      last_message.content AS lastMessageContent,
      last_message.media_url AS lastMessageMediaUrl,
      last_message.media_type AS lastMessageMediaType,
      last_message.media_name AS lastMessageMediaName,
      last_message.created_at AS lastMessageCreatedAt,
      last_message.edited_at AS lastMessageEditedAt,
      last_message.deleted_at AS lastMessageDeletedAt,

      (
        SELECT COUNT(*)
        FROM messages unread_message
        WHERE unread_message.conversation_id = c.id
          AND unread_message.sender_id <> ?
          AND (
            member.last_read_message_id IS NULL
            OR unread_message.id > member.last_read_message_id
          )
      ) AS unreadCount
    FROM conversations c
    JOIN conversation_members member
      ON member.conversation_id = c.id
      AND member.user_id = ?
    JOIN users other_user
      ON other_user.id = CASE
        WHEN c.user_low_id = ? THEN c.user_high_id
        ELSE c.user_low_id
      END
    LEFT JOIN conversation_members peer_member
      ON peer_member.conversation_id = c.id
      AND peer_member.user_id = other_user.id
    LEFT JOIN messages last_message
      ON last_message.id = (
        SELECT latest_message.id
        FROM messages latest_message
        WHERE latest_message.conversation_id = c.id
        ORDER BY latest_message.id DESC
        LIMIT 1
      )
    WHERE c.status = 'pending'
      AND c.requester_id <> ?
      AND NOT EXISTS (
        SELECT 1
        FROM user_blocks conversation_block
        WHERE (
          conversation_block.blocker_id = ?
          AND conversation_block.blocked_id = other_user.id
        )
        OR (
          conversation_block.blocked_id = ?
          AND conversation_block.blocker_id = other_user.id
        )
      )
    ORDER BY COALESCE(last_message.created_at, c.updated_at) DESC, c.id DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
    ]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM conversation_members cm
    JOIN conversations c ON c.id = cm.conversation_id
    WHERE cm.user_id = ?
      AND c.status = 'pending'
      AND c.requester_id <> ?
      AND NOT EXISTS (
        SELECT 1
        FROM user_blocks conversation_block
        WHERE (
          conversation_block.blocker_id = ?
          AND conversation_block.blocked_id = CASE
            WHEN c.user_low_id = ? THEN c.user_high_id
            ELSE c.user_low_id
          END
        )
        OR (
          conversation_block.blocked_id = ?
          AND conversation_block.blocker_id = CASE
            WHEN c.user_low_id = ? THEN c.user_high_id
            ELSE c.user_low_id
          END
        )
      )
    `,
    [
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
    ]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    conversations: conversations.map(normalizeConversation),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}

export async function findMessagesByConversationId({
  conversationId,
  currentUserId,
  page = 1,
  limit = 30,
  beforeMessageId = null,
}) {
  const conversation = await findConversationById(conversationId, currentUserId);

  if (!conversation) {
    return null;
  }

  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const safePage =
    Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1;
  const safeLimit =
    Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 100)
      : 30;
  const normalizedBeforeMessageId = Number(beforeMessageId);
  const safeBeforeMessageId =
    Number.isInteger(normalizedBeforeMessageId) && normalizedBeforeMessageId > 0
      ? normalizedBeforeMessageId
      : null;
  const offset = (safePage - 1) * safeLimit;
  const queryLimit = safeBeforeMessageId ? safeLimit + 1 : safeLimit;
  const cursorFilter = safeBeforeMessageId ? "AND m.id < ?" : "";
  const queryParams = safeBeforeMessageId
    ? [conversationId, safeBeforeMessageId]
    : [conversationId];
  const offsetClause = safeBeforeMessageId ? "" : ` OFFSET ${offset}`;

  const messages = await query(
    `
    SELECT
      m.id,
      m.conversation_id AS conversationId,
      m.sender_id AS senderId,
      m.content,
      m.media_url AS mediaUrl,
      m.media_type AS mediaType,
      m.media_name AS mediaName,
      m.created_at AS createdAt,
      m.edited_at AS editedAt,
      m.deleted_at AS deletedAt,
      sender.name AS senderName,
      sender.avatar_url AS senderAvatarUrl,
      reply_message.id AS replyToMessageId,
      reply_message.sender_id AS replySenderId,
      reply_sender.name AS replySenderName,
      reply_message.content AS replyContent,
      reply_message.media_type AS replyMediaType,
      reply_message.media_name AS replyMediaName,
      reply_message.deleted_at AS replyDeletedAt
    FROM messages m
    JOIN users sender ON sender.id = m.sender_id
    LEFT JOIN messages reply_message ON reply_message.id = m.reply_to_message_id
    LEFT JOIN users reply_sender ON reply_sender.id = reply_message.sender_id
    WHERE m.conversation_id = ?
      ${cursorFilter}
    ORDER BY m.id DESC
    LIMIT ${queryLimit}${offsetClause}
    `,
    queryParams
  );

  const selectedMessages = safeBeforeMessageId
    ? messages.slice(0, safeLimit)
    : messages;
  const normalizedMessages = selectedMessages.map(normalizeMessage).reverse();
  const messagesWithReactions = await attachReactionsToMessages(
    normalizedMessages,
    currentUserId
  );

  if (safeBeforeMessageId) {
    const pagination = getMessagePaginationMetadata({
      messages: messagesWithReactions,
      limit: safeLimit,
      hasMore: messages.length > safeLimit,
    });

    return {
      conversation,
      messages: messagesWithReactions,
      limit: safeLimit,
      ...pagination,
    };
  }

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM messages
    WHERE conversation_id = ?
    `,
    [conversationId]
  );

  const total = Number(countRows[0]?.total || 0);
  const pagination = getMessagePaginationMetadata({
    messages: messagesWithReactions,
    page: safePage,
    limit: safeLimit,
    total,
  });

  return {
    conversation,
    messages: messagesWithReactions,
    limit: safeLimit,
    ...pagination,
  };
}

export async function createMessage({
  conversationId,
  senderId,
  content = "",
  mediaUrl = null,
  mediaType = null,
  mediaName = null,
  replyToMessageId = null,
}) {
  const conversation = await findConversationById(conversationId, senderId);

  if (!conversation) {
    return null;
  }

  const normalizedReplyToMessageId = replyToMessageId
    ? Number(replyToMessageId)
    : null;

  if (normalizedReplyToMessageId) {
    const replyRows = await query(
      `
      SELECT id
      FROM messages
      WHERE id = ? AND conversation_id = ?
      LIMIT 1
      `,
      [normalizedReplyToMessageId, conversationId]
    );

    if (!replyRows[0]) {
      return {
        invalidReply: true,
      };
    }
  }

  const recipientId =
    Number(conversation.userLowId) === Number(senderId)
      ? conversation.userHighId
      : conversation.userLowId;
  const isReplyingToRequest =
    conversation.status === "pending" &&
    Number(conversation.requesterId) !== Number(senderId);

  const result = await query(
    `
    INSERT INTO messages (
      conversation_id,
      sender_id,
      content,
      media_url,
      media_type,
      media_name,
      reply_to_message_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      conversationId,
      senderId,
      content || "",
      mediaUrl,
      mediaType,
      mediaName,
      normalizedReplyToMessageId,
    ]
  );

  await query(
    `
    UPDATE conversations
    SET updated_at = CURRENT_TIMESTAMP,
        status = CASE
          WHEN status = 'pending' AND requester_id <> ? THEN 'accepted'
          ELSE status
        END
    WHERE id = ?
    `,
    [senderId, conversationId]
  );

  const messages = await query(
    `
    SELECT
      m.id,
      m.conversation_id AS conversationId,
      m.sender_id AS senderId,
      m.content,
      m.media_url AS mediaUrl,
      m.media_type AS mediaType,
      m.media_name AS mediaName,
      m.created_at AS createdAt,
      m.edited_at AS editedAt,
      m.deleted_at AS deletedAt,
      sender.name AS senderName,
      sender.avatar_url AS senderAvatarUrl,
      reply_message.id AS replyToMessageId,
      reply_message.sender_id AS replySenderId,
      reply_sender.name AS replySenderName,
      reply_message.content AS replyContent,
      reply_message.media_type AS replyMediaType,
      reply_message.media_name AS replyMediaName,
      reply_message.deleted_at AS replyDeletedAt
    FROM messages m
    JOIN users sender ON sender.id = m.sender_id
    LEFT JOIN messages reply_message ON reply_message.id = m.reply_to_message_id
    LEFT JOIN users reply_sender ON reply_sender.id = reply_message.sender_id
    WHERE m.id = ?
    LIMIT 1
    `,
    [result.insertId]
  );

  const message = withMessageReactions(normalizeMessage(messages[0]), [], senderId);
  publishMessage(recipientId, message);
  publishMessage(senderId, message);

  return {
    ...message,
    acceptedRequest: isReplyingToRequest,
  };
}

export async function updateMessageContent({
  conversationId,
  messageId,
  senderId,
  content,
}) {
  const conversation = await findConversationById(conversationId, senderId);

  if (!conversation) {
    return null;
  }

  const messageRows = await query(
    `
    SELECT
      sender_id AS senderId,
      deleted_at AS deletedAt
    FROM messages
    WHERE id = ? AND conversation_id = ?
    LIMIT 1
    `,
    [messageId, conversationId]
  );
  const existingMessage = messageRows[0];

  if (!existingMessage) {
    return null;
  }

  if (Number(existingMessage.senderId) !== Number(senderId)) {
    return {
      forbidden: true,
    };
  }

  if (existingMessage.deletedAt) {
    return {
      deleted: true,
    };
  }

  await query(
    `
    UPDATE messages
    SET content = ?,
        edited_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [content, messageId]
  );

  const recipientId =
    Number(conversation.userLowId) === Number(senderId)
      ? conversation.userHighId
      : conversation.userLowId;
  const message = await findMessageByIdForUser(messageId, senderId);

  return {
    conversation,
    recipientId,
    message,
  };
}

export async function deleteMessageForEveryone({
  conversationId,
  messageId,
  senderId,
}) {
  const conversation = await findConversationById(conversationId, senderId);

  if (!conversation) {
    return null;
  }

  const messageRows = await query(
    `
    SELECT
      sender_id AS senderId,
      media_url AS mediaUrl
    FROM messages
    WHERE id = ? AND conversation_id = ?
    LIMIT 1
    `,
    [messageId, conversationId]
  );
  const existingMessage = messageRows[0];

  if (!existingMessage) {
    return null;
  }

  if (Number(existingMessage.senderId) !== Number(senderId)) {
    return {
      forbidden: true,
    };
  }

  await query(
    `
    UPDATE messages
    SET content = '',
        media_url = NULL,
        media_type = NULL,
        media_name = NULL,
        edited_at = NULL,
        deleted_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [messageId]
  );

  await query(
    `
    DELETE FROM message_reactions
    WHERE message_id = ?
    `,
    [messageId]
  );

  const recipientId =
    Number(conversation.userLowId) === Number(senderId)
      ? conversation.userHighId
      : conversation.userLowId;
  const message = await findMessageByIdForUser(messageId, senderId);

  return {
    conversation,
    recipientId,
    message,
    removedMediaUrl: existingMessage.mediaUrl || null,
  };
}

export async function setMessageReaction({
  conversationId,
  messageId,
  userId,
  reaction,
}) {
  const conversation = await findConversationById(conversationId, userId);

  if (!conversation) {
    return null;
  }

  const messageRows = await query(
    `
    SELECT id
    FROM messages
    WHERE id = ? AND conversation_id = ?
    LIMIT 1
    `,
    [messageId, conversationId]
  );

  if (!messageRows[0]) {
    return null;
  }

  if (reaction) {
    await query(
      `
      INSERT INTO message_reactions (message_id, user_id, reaction)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        reaction = VALUES(reaction),
        updated_at = CURRENT_TIMESTAMP
      `,
      [messageId, userId, reaction]
    );
  } else {
    await query(
      `
      DELETE FROM message_reactions
      WHERE message_id = ? AND user_id = ?
      `,
      [messageId, userId]
    );
  }

  const reactionsByMessageId = await findReactionsByMessageIds([messageId]);
  const reactions = (reactionsByMessageId.get(Number(messageId)) || []).map(
    normalizeMessageReaction
  );
  const recipientId =
    Number(conversation.userLowId) === Number(userId)
      ? conversation.userHighId
      : conversation.userLowId;

  return {
    conversation,
    recipientId,
    reaction: {
      conversationId,
      messageId,
      userId,
      reaction: reaction || null,
      reactions,
    },
  };
}

export async function acceptMessageConversationBetween(userId, otherUserId) {
  const { userLowId, userHighId } = getUserPair(userId, otherUserId);

  await query(
    `
    UPDATE conversations
    SET status = 'accepted'
    WHERE user_low_id = ?
      AND user_high_id = ?
      AND status = 'pending'
    `,
    [userLowId, userHighId]
  );
}

export async function markConversationAsRead(conversationId, currentUserId) {
  const conversation = await findConversationById(conversationId, currentUserId);

  if (!conversation) {
    return null;
  }

  const rows = await query(
    `
    SELECT MAX(id) AS lastMessageId
    FROM messages
    WHERE conversation_id = ?
    `,
    [conversationId]
  );

  const lastMessageId = rows[0]?.lastMessageId || null;

  await query(
    `
    UPDATE conversation_members
    SET last_read_message_id = ?
    WHERE conversation_id = ? AND user_id = ?
    `,
    [lastMessageId, conversationId, currentUserId]
  );

  const updatedConversation = await findConversationById(
    conversationId,
    currentUserId
  );

  return updatedConversation
    ? {
        ...updatedConversation,
        lastReadMessageId: lastMessageId,
      }
    : null;
}
