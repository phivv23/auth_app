import { apiFetch } from "./client.js";

export function createReport({
  targetType,
  targetId,
  reason = "other",
  details = "",
}) {
  return apiFetch("/reports", {
    method: "POST",
    body: JSON.stringify({
      targetType,
      targetId,
      reason,
      details,
    }),
  });
}

export function getMyReports({ page = 1, limit = 20, status = "" } = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (status) {
    params.set("status", status);
  }

  return apiFetch(`/reports?${params.toString()}`);
}

export function getAdminReports({
  page = 1,
  limit = 20,
  status = "",
  targetType = "",
} = {}) {
  const params = new URLSearchParams();

  params.set("page", page);
  params.set("limit", limit);

  if (status) {
    params.set("status", status);
  }

  if (targetType) {
    params.set("targetType", targetType);
  }

  return apiFetch(`/reports/admin?${params.toString()}`);
}

export function getAdminReport(reportId) {
  return apiFetch(`/reports/admin/${reportId}`);
}

export function updateAdminReportStatus(
  reportId,
  { status, resolutionNote = "" }
) {
  return apiFetch(`/reports/admin/${reportId}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      resolutionNote,
    }),
  });
}

export function applyAdminReportAction(
  reportId,
  { action, resolutionNote = "" }
) {
  return apiFetch(`/reports/admin/${reportId}/action`, {
    method: "POST",
    body: JSON.stringify({
      action,
      resolutionNote,
    }),
  });
}
