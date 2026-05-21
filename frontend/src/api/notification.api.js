import { apiFetch } from "./client.js";

export function getNotifications({ page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  return apiFetch(`/notifications?${params.toString()}`);
}

export function getUnreadNotificationCount() {
  return apiFetch("/notifications/unread-count");
}

export function markNotificationAsRead(notificationId) {
  return apiFetch(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsAsRead() {
  return apiFetch("/notifications/read-all", {
    method: "PATCH",
  });
}
