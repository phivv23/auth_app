import { apiFetch } from "./client.js";

function storyPath(storyId, suffix = "") {
  const normalizedStoryId = String(storyId ?? "").trim();

  if (!normalizedStoryId) {
    throw new Error("Story id is required.");
  }

  return `/stories/${encodeURIComponent(normalizedStoryId)}${suffix}`;
}

export function getStories({ limit = 50, signal, timeoutMs } = {}) {
  const params = new URLSearchParams();

  params.set("limit", limit);

  return apiFetch(`/stories?${params.toString()}`, {
    signal,
    timeoutMs,
  });
}

export function createStory(formData) {
  return apiFetch("/stories", {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
}

export function getStory(storyId, { signal } = {}) {
  return apiFetch(storyPath(storyId), { signal });
}

export function markStoryViewed(storyId) {
  return apiFetch(storyPath(storyId, "/view"), {
    method: "POST",
  });
}

export function replyStory(storyId, content) {
  return apiFetch(storyPath(storyId, "/reply"), {
    method: "POST",
    body: JSON.stringify({
      content,
    }),
  });
}

export function reactToStory(storyId, reaction) {
  return apiFetch(storyPath(storyId, "/reaction"), {
    method: "POST",
    body: JSON.stringify({
      reaction,
    }),
  });
}

export function deleteStory(storyId) {
  return apiFetch(storyPath(storyId), {
    method: "DELETE",
  });
}
