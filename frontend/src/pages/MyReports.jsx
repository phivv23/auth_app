import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { getMyReports } from "../api/report.api.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const statuses = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "reviewing", label: "Đang xem xét" },
  { value: "resolved", label: "Đã xử lý" },
  { value: "dismissed", label: "Giữ lại" },
];

const statusLabels = Object.fromEntries(
  statuses.filter((item) => item.value).map((item) => [item.value, item.label])
);

const targetTypeLabels = {
  user: "Người dùng",
  post: "Bài viết",
  comment: "Bình luận",
  message: "Tin nhắn",
};

const reasonLabels = {
  spam: "Spam",
  harassment: "Quấy rối",
  hate: "Ngôn từ thù ghét",
  violence: "Bạo lực",
  nudity: "Nội dung nhạy cảm",
  scam: "Lừa đảo",
  self_harm: "Tự gây hại",
  other: "Khác",
};

function getTargetUrl(report) {
  if (report.targetType === "user") {
    return `/users/${report.targetId}`;
  }

  if (report.targetType === "post") {
    return `/posts/${report.targetId}`;
  }

  if (report.targetType === "comment" && report.targetPostId) {
    return `/posts/${report.targetPostId}?commentId=${report.targetId}`;
  }

  return "";
}

export default function MyReports() {
  const [searchParams] = useSearchParams();
  const highlightedReportId = Number(searchParams.get("reportId") || 0);

  const [reports, setReports] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadReports() {
      try {
        setLoading(true);
        setError("");

        const data = await getMyReports({
          page,
          limit,
          status,
        });

        if (!isActive) {
          return;
        }

        setReports(data.reports || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        if (isActive) {
          setError(error.message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      isActive = false;
    };
  }, [page, limit, status]);

  function handleStatusChange(nextStatus) {
    setStatus(nextStatus);
    setPage(1);
  }

  return (
    <div className="my-reports-page">
      <section className="my-reports-header">
        <div>
          <h1>Báo cáo của tôi</h1>
          <p>Theo dõi trạng thái các nội dung bạn đã báo cáo.</p>
        </div>

        <label>
          Trạng thái
          <select
            value={status}
            onChange={(event) => handleStatusChange(event.target.value)}
          >
            {statuses.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <section className="card">
          <p>Đang tải báo cáo...</p>
        </section>
      ) : reports.length === 0 ? (
        <section className="card">
          <p>Bạn chưa gửi báo cáo nào trong bộ lọc hiện tại.</p>
        </section>
      ) : (
        <div className="my-report-list">
          {reports.map((report) => {
            const targetUrl = getTargetUrl(report);
            const isHighlighted = Number(report.id) === highlightedReportId;

            return (
              <article
                key={report.id}
                className={
                  isHighlighted ? "my-report-card highlighted" : "my-report-card"
                }
              >
                <header>
                  <div>
                    <span className={`my-report-status ${report.status}`}>
                      {statusLabels[report.status] || report.status}
                    </span>
                    <h2>
                      {targetTypeLabels[report.targetType] || report.targetType}{" "}
                      #{report.targetId}
                    </h2>
                  </div>

                  <span title={formatVietnamDateTime(report.createdAt)}>
                    {formatRelativeTime(report.createdAt)}
                  </span>
                </header>

                <div className="my-report-meta">
                  <span>
                    Lý do: <strong>{reasonLabels[report.reason] || report.reason}</strong>
                  </span>
                  {report.targetOwnerName && (
                    <span>
                      Chủ nội dung: <strong>{report.targetOwnerName}</strong>
                    </span>
                  )}
                </div>

                {report.targetPreview ? (
                  <blockquote>{report.targetPreview}</blockquote>
                ) : (
                  <p className="muted">Nội dung gốc không còn khả dụng.</p>
                )}

                {report.details && (
                  <p className="my-report-details">{report.details}</p>
                )}

                {report.resolutionNote && (
                  <p className="my-report-resolution">
                    <strong>Phản hồi xử lý:</strong> {report.resolutionNote}
                  </p>
                )}

                <footer>
                  <span>
                    {report.reviewerName
                      ? `Được xử lý bởi ${report.reviewerName}`
                      : "Đang chờ đội ngũ xử lý"}
                  </span>

                  {targetUrl && (
                    <Link to={targetUrl}>
                    {report.targetType === "comment"
                      ? "Mở thẳng bình luận"
                      : "Mở nội dung"}
                  </Link>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((currentPage) => currentPage - 1)}
          >
            Trang trước
          </button>

          <span>
            Trang {page} / {totalPages} · {total} báo cáo
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((currentPage) => currentPage + 1)}
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  );
}
