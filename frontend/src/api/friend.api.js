import { apiFetch } from "./client.js";

export function sendFriendRequest(userId) {
  return apiFetch(`/friends/requests/${userId}`, {
    method: "POST",
  });
}

export function acceptFriendRequest(userId) {
  return apiFetch(`/friends/requests/${userId}/accept`, {
    method: "PATCH",
  });
}

export function cancelFriendRequest(userId) {
  return apiFetch(`/friends/requests/${userId}`, {
    method: "DELETE",
  });
}

export function unfriendUser(userId) {
  return apiFetch(`/friends/${userId}`, {
    method: "DELETE",
  });
}

export function getFriendRequests({
  type = "incoming",
  page = 1,
  limit = 10,
} = {}) {
  const params = new URLSearchParams();

  params.set("type", type);
  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(`/friends/requests?${params.toString()}`);
}

export function getFriends({ userId = "", page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();

  if (userId) {
    params.set("userId", userId);
  }

  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(`/friends?${params.toString()}`);
}

export function getFriendSuggestions({ limit = 10 } = {}) {
  const params = new URLSearchParams();

  params.set("limit", limit);

  return apiFetch(`/friends/suggestions?${params.toString()}`);
}
