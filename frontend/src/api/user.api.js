import { apiFetch } from "./client";

export function getPublicUserProfile(userId) {
  return apiFetch(`/users/${userId}`);
}

export function getPublicUserPosts(
  userId,
  { page = 1, limit = 10, search = "" } = {}
) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (search) {
    params.set("search", search);
  }

  return apiFetch(`/users/${userId}/posts?${params.toString()}`);
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