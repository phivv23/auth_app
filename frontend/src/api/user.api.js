import { apiFetch } from "./client";

export function getPublicUserProfile(userId, { signal } = {}) {
  return apiFetch(`/users/${userId}`, { signal });
}

export function getPublicUserPosts(
  userId,
  { page = 1, limit = 10, search = "", signal } = {}
) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (search) {
    params.set("search", search);
  }

  return apiFetch(`/users/${userId}/posts?${params.toString()}`, { signal });
}

export function followUser(userId) {
  return apiFetch(`/users/${userId}/follow`, {
    method: "POST",
  });
}

export function unfollowUser(userId) {
  return apiFetch(`/users/${userId}/follow`, {
    method: "DELETE",
  });
}

export function blockUser(userId) {
  return apiFetch(`/users/${userId}/block`, {
    method: "POST",
  });
}

export function unblockUser(userId) {
  return apiFetch(`/users/${userId}/block`, {
    method: "DELETE",
  });
}

export function getUserFollowers(userId, { page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(`/users/${userId}/followers?${params.toString()}`);
}

export function getUserFollowing(userId, { page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(`/users/${userId}/following?${params.toString()}`);
}

export function searchUsers(
  keyword,
  { page = 1, limit = 10 } = {}
) {
  const params = new URLSearchParams();

  params.set("keyword", keyword);
  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(`/users/search?${params.toString()}`);
}

export function getSuggestedUsers({ limit = 5, signal, timeoutMs } = {}) {
  const params = new URLSearchParams();

  params.set("limit", limit);

  return apiFetch(`/users/suggestions?${params.toString()}`, {
    signal,
    timeoutMs,
  });
}
