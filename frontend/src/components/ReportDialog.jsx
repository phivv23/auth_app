import { useState } from "react";

import { createReport } from "../api/report.api.js";

const reportReasons = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Quấy rối" },
  { value: "hate", label: "Ngôn từ thù ghét" },
  { value: "violence", label: "Bạo lực" },
  { value: "nudity", label: "Nội dung nhạy cảm" },
  { value: "scam", label: "Lừa đảo" },
  { value: "self_harm", label: "Tự gây hại" },
  { value: "other", label: "Khác" },
];

export default function ReportDialog({
  open,
  targetType,
  targetId,
  title = "Báo cáo nội dung",
  onClose,
  onReported,
}) {
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      const data = await createReport({
        targetType,
        targetId,
        reason,
        details,
      });

      setReason("spam");
      setDetails("");
      onReported?.(data.report);
      onClose?.();
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="report-dialog-backdrop" role="presentation">
      <section
        className="report-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng">
            x
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <label>
            Lý do
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {reportReasons.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Mô tả thêm
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Thêm ngữ cảnh để đội ngũ xử lý nhanh hơn"
            />
          </label>

          {error && <p className="error">{error}</p>}

          <div className="report-dialog-actions">
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button className="button danger" type="submit" disabled={submitting}>
              {submitting ? "Đang gửi..." : "Gửi báo cáo"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
