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
