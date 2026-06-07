import { apiFetch } from "./client.js";

export function getSharedMoments({
  page = 1,
  limit = 20,
  status = "all",
  signal,
  timeoutMs,
} = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (status && status !== "all") {
    params.set("status", status);
  }

  return apiFetch(`/moments?${params.toString()}`, { signal, timeoutMs });
}

export function getSharedMoment(momentId, { signal, timeoutMs } = {}) {
  return apiFetch(`/moments/${momentId}`, { signal, timeoutMs });
}

export function createSharedMoment({
  title,
  note = "",
  mood = "",
  participantIds = [],
  initialItem = null,
}, { signal, timeoutMs } = {}) {
  return apiFetch("/moments", {
    method: "POST",
    body: JSON.stringify({
      title,
      note,
      mood,
      participantIds,
      initialItem,
    }),
    signal,
    timeoutMs,
  });
}

export function respondToSharedMoment(
  momentId,
  status,
  { signal, timeoutMs } = {}
) {
  return apiFetch(`/moments/${momentId}/respond`, {
    method: "POST",
    body: JSON.stringify({ status }),
    signal,
    timeoutMs,
  });
}

export function addSharedMomentItem(
  momentId,
  item,
  { signal, timeoutMs } = {}
) {
  return apiFetch(`/moments/${momentId}/items`, {
    method: "POST",
    body: JSON.stringify(item),
    signal,
    timeoutMs,
  });
}
