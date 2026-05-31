import { apiFetch } from "./client.js";

function buildAdminParams(options = {}) {
  const {
    page = 1,
    limit = 20,
    search = "",
    role = "",
    accountStatus = "",
    authorId = "",
    privacy = "",
    reportedOnly = false,
    minReports = "",
    fromDate = "",
    toDate = "",
    actorId = "",
    targetUserId = "",
    action = "",
    targetType = "",
  } = options;
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (search.trim()) {
    params.set("search", search.trim());
  }

  if (role) {
    params.set("role", role);
  }

  if (accountStatus) {
    params.set("accountStatus", accountStatus);
  }

  if (authorId) {
    params.set("authorId", authorId);
  }

  if (privacy) {
    params.set("privacy", privacy);
  }

  if (reportedOnly) {
    params.set("reportedOnly", "1");
  }

  if (minReports) {
    params.set("minReports", minReports);
  }

  if (fromDate) {
    params.set("fromDate", fromDate);
  }

  if (toDate) {
    params.set("toDate", toDate);
  }

  if (actorId) {
    params.set("actorId", actorId);
  }

  if (targetUserId) {
    params.set("targetUserId", targetUserId);
  }

  if (action) {
    params.set("action", action);
  }

  if (targetType) {
    params.set("targetType", targetType);
  }

  return params.toString();
}

export function getAdminOverview() {
  return apiFetch("/admin/overview");
}

export function getAdminUsers(options = {}) {
  return apiFetch(`/admin/users?${buildAdminParams(options)}`);
}

export function getAdminUserDetail(userId) {
  return apiFetch(`/admin/users/${userId}`);
}

export function updateAdminUserRole(userId, role) {
  return apiFetch(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function updateAdminUserStatus(
  userId,
  { accountStatus, reason = "" }
) {
  return apiFetch(`/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      accountStatus,
      reason,
    }),
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

export function deleteAdminPost(
  postId,
  { reason = "", resolutionNote = "" } = {}
) {
  return apiFetch(`/admin/posts/${postId}`, {
    method: "DELETE",
    body: JSON.stringify({
      reason,
      resolutionNote,
    }),
  });
}

export function getAdminComments(options = {}) {
  return apiFetch(`/admin/comments?${buildAdminParams(options)}`);
}

export function deleteAdminComment(
  commentId,
  { reason = "", resolutionNote = "" } = {}
) {
  return apiFetch(`/admin/comments/${commentId}`, {
    method: "DELETE",
    body: JSON.stringify({
      reason,
      resolutionNote,
    }),
  });
}

export function getAdminAuditLogs(options = {}) {
  return apiFetch(`/admin/audit-logs?${buildAdminParams(options)}`);
}
