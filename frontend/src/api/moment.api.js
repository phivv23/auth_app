import { apiFetch } from "./client.js";

export function getSharedMoments({
  page = 1,
  limit = 20,
  status = "all",
  signal,
} = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (status && status !== "all") {
    params.set("status", status);
  }

  return apiFetch(`/moments?${params.toString()}`, { signal });
}

export function getSharedMoment(momentId, { signal } = {}) {
  return apiFetch(`/moments/${momentId}`, { signal });
}

export function createSharedMoment({
  title,
  note = "",
  mood = "",
  participantIds = [],
  initialItem = null,
}) {
  return apiFetch("/moments", {
    method: "POST",
    body: JSON.stringify({
      title,
      note,
      mood,
      participantIds,
      initialItem,
    }),
  });
}

export function respondToSharedMoment(momentId, status) {
  return apiFetch(`/moments/${momentId}/respond`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function addSharedMomentItem(momentId, item) {
  return apiFetch(`/moments/${momentId}/items`, {
    method: "POST",
    body: JSON.stringify(item),
  });
}
