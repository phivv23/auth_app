import { apiFetch } from "./client.js";

export function getStories({ limit = 50, signal } = {}) {
  const params = new URLSearchParams();

  params.set("limit", limit);

  return apiFetch(`/stories?${params.toString()}`, { signal });
}

export function createStory(formData) {
  return apiFetch("/stories", {
    method: "POST",
    body: formData,
  });
}

export function getStory(storyId, { signal } = {}) {
  return apiFetch(`/stories/${storyId}`, { signal });
}

export function markStoryViewed(storyId) {
  return apiFetch(`/stories/${storyId}/view`, {
    method: "POST",
  });
}

export function deleteStory(storyId) {
  return apiFetch(`/stories/${storyId}`, {
    method: "DELETE",
  });
}
