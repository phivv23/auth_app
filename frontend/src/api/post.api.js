import { apiFetch } from "./client.js";

export function getPosts({ page = 1, limit = 10, search = "", signal } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (search.trim()) {
    params.set("search", search.trim());
  }

  return apiFetch(`/posts?${params.toString()}`, { signal });
}

export function getPostById(postId, { signal } = {}) {
  return apiFetch(`/posts/${postId}`, { signal });
}

export function getMyPosts({ page = 1, limit = 10, search = "", signal } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (search.trim()) {
    params.set("search", search.trim());
  }

  return apiFetch(`/posts/me?${params.toString()}`, { signal });
}

export function createPost(formData) {
  return apiFetch("/posts", {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
}

export function updatePost(postId, formData) {
  return apiFetch(`/posts/${postId}`, {
    method: "PATCH",
    body: formData,
    timeoutMs: 120000,
  });
}

export function deletePost(postId) {
  return apiFetch(`/posts/${postId}`, {
    method: "DELETE",
  });
}

export function getPostComments(postId, { signal } = {}) {
  return apiFetch(`/posts/${postId}/comments`, { signal });
}

export function getPostReactions(
  postId,
  { page = 1, limit = 50, reactionType = "", signal } = {}
) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (reactionType) {
    params.set("reactionType", reactionType);
  }

  return apiFetch(`/posts/${postId}/reactions?${params.toString()}`, { signal });
}

export function createComment(postId, content, { parentCommentId = null } = {}) {
  const body = parentCommentId ? { content, parentCommentId } : { content };

  return apiFetch(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
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

export function toggleCommentReaction(commentId, reactionType = "like") {
  return apiFetch(`/posts/comments/${commentId}/reaction`, {
    method: "POST",
    body: JSON.stringify({ reactionType }),
  });
}

export function togglePostLike(postId, reactionType = "like") {
  return apiFetch(`/posts/${postId}/like`, {
    method: "POST",
    body: JSON.stringify({ reactionType }),
  });
}

export function sharePost(postId, { content = "", privacy = "public" } = {}) {
  return apiFetch(`/posts/${postId}/share`, {
    method: "POST",
    body: JSON.stringify({ content, privacy }),
  });
}

export function togglePostBookmark(postId) {
  return apiFetch(`/posts/${postId}/bookmark`, {
    method: "POST",
  });
}

export function getFeedPosts({ page = 1, limit = 10, signal } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(`/posts/feed?${params.toString()}`, { signal });
}

export function getVideoPosts({ page = 1, limit = 10, signal } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(`/posts/videos?${params.toString()}`, { signal });
}

export function getBookmarkedPosts({ page = 1, limit = 10, signal } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(`/posts/bookmarks?${params.toString()}`, { signal });
}
