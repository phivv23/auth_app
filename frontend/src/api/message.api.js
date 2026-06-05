import { API_URL, apiFetch } from "./client.js";

export function getMessageStreamUrl() {
  return `${API_URL}/messages/stream`;
}

export function getConversations({ page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(`/messages/conversations?${params.toString()}`);
}

export function getMessageRequests({ page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(`/messages/requests?${params.toString()}`);
}

export function startConversation(userId) {
  return apiFetch(`/messages/conversations/${userId}`, {
    method: "POST",
  });
}

export function getConversationMessages({
  conversationId,
  page = 1,
  limit = 30,
}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(
    `/messages/conversations/${conversationId}/messages?${params.toString()}`
  );
}

export function sendMessage(
  conversationId,
  { content = "", media = null, gifUrl = "", replyToMessageId = null } = {}
) {
  if (media) {
    const formData = new FormData();

    formData.append("content", content);
    formData.append("media", media);

    if (replyToMessageId) {
      formData.append("replyToMessageId", replyToMessageId);
    }

    return apiFetch(`/messages/conversations/${conversationId}/messages`, {
      method: "POST",
      body: formData,
      timeoutMs: 120000,
    });
  }

  return apiFetch(`/messages/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content,
      gifUrl,
      replyToMessageId,
    }),
  });
}

export function reactToMessage(conversationId, messageId, reaction) {
  return apiFetch(
    `/messages/conversations/${conversationId}/messages/${messageId}/reaction`,
    {
      method: "PATCH",
      body: JSON.stringify({
        reaction,
      }),
    }
  );
}

export function editMessage(conversationId, messageId, content) {
  return apiFetch(`/messages/conversations/${conversationId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      content,
    }),
  });
}

export function deleteMessage(conversationId, messageId) {
  return apiFetch(`/messages/conversations/${conversationId}/messages/${messageId}`, {
    method: "DELETE",
  });
}

export function markConversationRead(conversationId) {
  return apiFetch(`/messages/conversations/${conversationId}/read`, {
    method: "PATCH",
  });
}

export function sendTypingStatus(conversationId, isTyping) {
  return apiFetch(`/messages/conversations/${conversationId}/typing`, {
    method: "POST",
    body: JSON.stringify({
      isTyping,
    }),
  });
}
