import { apiFetch } from "./client.js";

function buildAdminParams({ page = 1, limit = 20, search = "", role = "" } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (search.trim()) {
    params.set("search", search.trim());
  }

  if (role) {
    params.set("role", role);
  }

  return params.toString();
}

export function getAdminOverview() {
  return apiFetch("/admin/overview");
}

export function getAdminUsers(options = {}) {
  return apiFetch(`/admin/users?${buildAdminParams(options)}`);
}

export function updateAdminUserRole(userId, role) {
  return apiFetch(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function deleteAdminUser(userId) {
  return apiFetch(`/admin/users/${userId}`, {
    method: "DELETE",
  });
}

export function getAdminPosts(options = {}) {
  return apiFetch(`/admin/posts?${buildAdminParams(options)}`);
}

export function deleteAdminPost(postId) {
  return apiFetch(`/admin/posts/${postId}`, {
    method: "DELETE",
  });
}

export function getAdminComments(options = {}) {
  return apiFetch(`/admin/comments?${buildAdminParams(options)}`);
}

export function deleteAdminComment(commentId) {
  return apiFetch(`/admin/comments/${commentId}`, {
    method: "DELETE",
  });
}
