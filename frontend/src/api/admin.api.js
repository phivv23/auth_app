import { apiFetch } from "./client.js";

const ADMIN_QUERY_DEFAULTS = {
  page: 1,
  limit: 20,
  search: "",
  role: "",
  accountStatus: "",
  authorId: "",
  privacy: "",
  reportedOnly: false,
  minReports: "",
  fromDate: "",
  toDate: "",
  actorId: "",
  targetUserId: "",
  action: "",
  targetType: "",
};

const ADMIN_QUERY_KEYS = Object.keys(ADMIN_QUERY_DEFAULTS);

function normalizeQueryValue(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "boolean") {
    return value ? "1" : "";
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function buildAdminQuery(options = {}) {
  const params = new URLSearchParams();

  for (const key of ADMIN_QUERY_KEYS) {
    const value = Object.hasOwn(options, key)
      ? options[key]
      : ADMIN_QUERY_DEFAULTS[key];
    const normalizedValue = normalizeQueryValue(value);
    const defaultValue = normalizeQueryValue(ADMIN_QUERY_DEFAULTS[key]);

    if (!normalizedValue || normalizedValue === defaultValue) {
      continue;
    }

    params.set(key, normalizedValue);
  }

  return params.toString();
}

function withAdminQuery(path, options) {
  const query = buildAdminQuery(options);

  return query ? `${path}?${query}` : path;
}

function pathId(value, label) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    throw new Error(`${label} is required.`);
  }

  return encodeURIComponent(normalizedValue);
}

function adminUserPath(userId, suffix = "") {
  return `/admin/users/${pathId(userId, "User id")}${suffix}`;
}

function adminPostPath(postId) {
  return `/admin/posts/${pathId(postId, "Post id")}`;
}

function adminCommentPath(commentId) {
  return `/admin/comments/${pathId(commentId, "Comment id")}`;
}

export function getAdminOverview() {
  return apiFetch("/admin/overview");
}

export function getAdminUsers(options = {}) {
  return apiFetch(withAdminQuery("/admin/users", options));
}

export function getAdminUserDetail(userId) {
  return apiFetch(adminUserPath(userId));
}

export function updateAdminUserRole(userId, role) {
  return apiFetch(adminUserPath(userId, "/role"), {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function updateAdminUserStatus(
  userId,
  { accountStatus, reason = "" }
) {
  return apiFetch(adminUserPath(userId, "/status"), {
    method: "PATCH",
    body: JSON.stringify({
      accountStatus,
      reason,
    }),
  });
}

export function deleteAdminUser(userId) {
  return apiFetch(adminUserPath(userId), {
    method: "DELETE",
  });
}

export function getAdminPosts(options = {}) {
  return apiFetch(withAdminQuery("/admin/posts", options));
}

export function deleteAdminPost(
  postId,
  { reason = "", resolutionNote = "" } = {}
) {
  return apiFetch(adminPostPath(postId), {
    method: "DELETE",
    body: JSON.stringify({
      reason,
      resolutionNote,
    }),
  });
}

export function getAdminComments(options = {}) {
  return apiFetch(withAdminQuery("/admin/comments", options));
}

export function deleteAdminComment(
  commentId,
  { reason = "", resolutionNote = "" } = {}
) {
  return apiFetch(adminCommentPath(commentId), {
    method: "DELETE",
    body: JSON.stringify({
      reason,
      resolutionNote,
    }),
  });
}

export function getAdminAuditLogs(options = {}) {
  return apiFetch(withAdminQuery("/admin/audit-logs", options));
}
