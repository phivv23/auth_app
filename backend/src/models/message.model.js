import { query } from "../db/pool.js";
import { isBlockedBetween } from "./block.model.js";
import { findFriendshipBetween } from "./friend.model.js";
import { findUserById } from "./user.model.js";
import { publishMessage } from "../realtime/messageEvents.js";

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
    },
    lastMessage: row.lastMessageId
      ? {
          id: row.lastMessageId,
          senderId: row.lastMessageSenderId,
          content: row.lastMessageContent,
          createdAt: row.lastMessageCreatedAt,
        }
      : null,
    unreadCount: Number(row.unreadCount || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    content: row.content,
    createdAt: row.createdAt,
    senderName: row.senderName,
    senderAvatarUrl: row.senderAvatarUrl,
  };
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

      last_message.id AS lastMessageId,
      last_message.sender_id AS lastMessageSenderId,
      last_message.content AS lastMessageContent,
      last_message.created_at AS lastMessageCreatedAt,

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

      last_message.id AS lastMessageId,
      last_message.sender_id AS lastMessageSenderId,
      last_message.content AS lastMessageContent,
      last_message.created_at AS lastMessageCreatedAt,

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

      last_message.id AS lastMessageId,
      last_message.sender_id AS lastMessageSenderId,
      last_message.content AS lastMessageContent,
      last_message.created_at AS lastMessageCreatedAt,

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
  const offset = (safePage - 1) * safeLimit;

  const messages = await query(
    `
    SELECT
      m.id,
      m.conversation_id AS conversationId,
      m.sender_id AS senderId,
      m.content,
      m.created_at AS createdAt,
      sender.name AS senderName,
      sender.avatar_url AS senderAvatarUrl
    FROM messages m
    JOIN users sender ON sender.id = m.sender_id
    WHERE m.conversation_id = ?
    ORDER BY m.id DESC
    LIMIT ${safeLimit} OFFSET ${offset}
    `,
    [conversationId]
  );

  const countRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM messages
    WHERE conversation_id = ?
    `,
    [conversationId]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    conversation,
    messages: messages.map(normalizeMessage).reverse(),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}

export async function createMessage({
  conversationId,
  senderId,
  content,
}) {
  const conversation = await findConversationById(conversationId, senderId);

  if (!conversation) {
    return null;
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
    INSERT INTO messages (conversation_id, sender_id, content)
    VALUES (?, ?, ?)
    `,
    [conversationId, senderId, content]
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
      m.created_at AS createdAt,
      sender.name AS senderName,
      sender.avatar_url AS senderAvatarUrl
    FROM messages m
    JOIN users sender ON sender.id = m.sender_id
    WHERE m.id = ?
    LIMIT 1
    `,
    [result.insertId]
  );

  const message = normalizeMessage(messages[0]);
  publishMessage(recipientId, message);
  publishMessage(senderId, message);

  return {
    ...message,
    acceptedRequest: isReplyingToRequest,
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

  return findConversationById(conversationId, currentUserId);
}
