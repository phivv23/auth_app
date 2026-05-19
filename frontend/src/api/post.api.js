import { apiFetch } from "./client.js";

export function getPosts({ page = 1, limit = 10, search = "" } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (search.trim()) {
    params.set("search", search.trim());
  }

  return apiFetch(`/posts?${params.toString()}`);
}

export function getPostById(postId) {
  return apiFetch(`/posts/${postId}`);
}

export function getMyPosts({ page = 1, limit = 10, search = "" } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (search.trim()) {
    params.set("search", search.trim());
  }

  return apiFetch(`/posts/me?${params.toString()}`);
}

export function createPost(formData) {
  return apiFetch("/posts", {
    method: "POST",
    body: JSON.stringify(formData),
  });
}

export function updatePost(postId, formData) {
  return apiFetch(`/posts/${postId}`, {
    method: "PATCH",
    body: JSON.stringify(formData),
  });
}

export function deletePost(postId) {
  return apiFetch(`/posts/${postId}`, {
    method: "DELETE",
  });
}

export function getPostComments(postId) {
  return apiFetch(`/posts/${postId}/comments`);
}

export function createComment(postId, content) {
  return apiFetch(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function updateComment(commentId, content) {
  return apiFetch(`/posts/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}

export function deleteComment(commentId) {
  return apiFetch(`/posts/comments/${commentId}`, {
    method: "DELETE",
  });
}

export function togglePostLike(postId) {
  return apiFetch(`/posts/${postId}/like`, {
    method: "POST",
  });
}