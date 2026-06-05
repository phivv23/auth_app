import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";

import {
  applyAdminReportAction,
  getAdminReport,
  getAdminReports,
  updateAdminReportStatus,
} from "../api/report.api.js";
import { useAuth } from "../context/useAuth.js";
import { useRealtimeSubscription } from "../context/useRealtime.js";
import {
  canAccessReports,
  canManageAdminArea,
} from "../utils/adminPermissions.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const statuses = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "reviewing", label: "Đang xử lý" },
  { value: "resolved", label: "Đã xử lý" },
  { value: "dismissed", label: "Giữ lại" },
];

const targetTypes = [
  { value: "", label: "Mọi loại" },
  { value: "user", label: "User" },
  { value: "post", label: "Bài viết" },
  { value: "comment", label: "Bình luận" },
  { value: "message", label: "Tin nhắn" },
  { value: "story", label: "Story" },
];

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

const statusLabels = Object.fromEntries(
  statuses.filter((status) => status.value).map((status) => [
    status.value,
    status.label,
  ])
);

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

  if (report.targetType === "story") {
    return `/stories/${report.targetId}`;
  }

  return "";
}

function isRemovableReport(report) {
  return ["post", "comment", "story"].includes(report.targetType);
}

function updateSummary(summary, fromStatus, toStatus) {
  if (!fromStatus || fromStatus === toStatus) {
    return summary;
  }

  return {
    ...summary,
    [fromStatus]: Math.max(0, Number(summary[fromStatus] || 0) - 1),
    [toStatus]: Number(summary[toStatus] || 0) + 1,
  };
}

function reportMatchesFilters(report, { status, targetType }) {
  return (
    (!status || report.status === status) &&
    (!targetType || report.targetType === targetType)
  );
}

function mergePinnedReport(reports, pinnedReport) {
  if (!pinnedReport) {
    return reports;
  }

  return [
    pinnedReport,
    ...reports.filter((report) => Number(report.id) !== Number(pinnedReport.id)),
  ];
}

function prependUniqueReport(reports, report, limit) {
  return [
    report,
    ...reports.filter((item) => Number(item.id) !== Number(report.id)),
  ].slice(0, limit);
}

export default function AdminReports() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightedReportRef = useRef(null);
  const focusedReportId = searchParams.get("reportId");

  const [reports, setReports] = useState([]);
  const [focusedReport, setFocusedReport] = useState(null);
  const [summary, setSummary] = useState({});
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("pending");
  const [targetType, setTargetType] = useState("");
  const [notes, setNotes] = useState({});
  const [updatingReportId, setUpdatingReportId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeFocusedReport =
    focusedReportId && Number(focusedReport?.id) === Number(focusedReportId)
      ? focusedReport
      : null;
  const visibleReports = mergePinnedReport(reports, activeFocusedReport);

  useEffect(() => {
    let isActive = true;

    async function loadReports({ silent = false } = {}) {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const data = await getAdminReports({
          page,
          limit,
          status,
          targetType,
        });

        if (!isActive) {
          return;
        }

        setReports(data.reports || []);
        setSummary(data.summary || {});
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        if (isActive) {
          setError(error.message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    if (canAccessReports(user)) {
      loadReports({ silent: refreshKey > 0 });
    }

    return () => {
      isActive = false;
    };
  }, [user, page, limit, status, targetType, refreshKey]);

  useEffect(() => {
    if (!focusedReportId || !canAccessReports(user)) {
      return undefined;
    }

    let isActive = true;

    async function loadFocusedReport() {
      try {
        const data = await getAdminReport(focusedReportId);

        if (isActive) {
          setFocusedReport(data.report || null);
        }
      } catch (error) {
        if (isActive) {
          setFocusedReport(null);
          setError(error.message);
        }
      }
    }

    loadFocusedReport();

    return () => {
      isActive = false;
    };
  }, [focusedReportId, user]);

  useEffect(() => {
    if (!focusedReportId || loading || visibleReports.length === 0) {
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      highlightedReportRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [focusedReportId, loading, visibleReports.length]);

  useRealtimeSubscription(
    "notifications",
    "notification",
    async (event) => {
      const notification = JSON.parse(event.data);

      if (notification.type !== "admin_report_created") {
        return;
      }

      setNotice("Có báo cáo mới trong hàng đợi moderation.");

      if (!notification.reportId || page !== 1) {
        return;
      }

      try {
        const data = await getAdminReport(notification.reportId);
        const report = data.report;

        if (!report || !reportMatchesFilters(report, { status, targetType })) {
          return;
        }

        setReports((currentReports) => {
          const alreadyExists = currentReports.some(
            (item) => Number(item.id) === Number(report.id)
          );

          if (!alreadyExists) {
            setTotal((currentTotal) => currentTotal + 1);
            setSummary((currentSummary) => ({
              ...currentSummary,
              [report.status]: Number(currentSummary[report.status] || 0) + 1,
            }));
          }

          return prependUniqueReport(currentReports, report, limit);
        });
      } catch {
        setRefreshKey((currentKey) => currentKey + 1);
      }
    },
    {
      enabled: canAccessReports(user),
    }
  );

  if (authLoading) {
    return <p>Đang kiểm tra quyền quản trị...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessReports(user)) {
    return <Navigate to="/feed" replace />;
  }

  function handleFilterStatus(nextStatus) {
    setStatus(nextStatus);
    setPage(1);
    setNotice("");
  }

  function handleFilterTargetType(nextTargetType) {
    setTargetType(nextTargetType);
    setPage(1);
    setNotice("");
  }

  function handleNoteChange(reportId, value) {
    setNotes((currentNotes) => ({
      ...currentNotes,
      [reportId]: value,
    }));
  }

  async function handleUpdateStatus(report, nextStatus) {
    try {
      setUpdatingReportId(report.id);
      setError("");
      setNotice("");

      const data = await updateAdminReportStatus(report.id, {
        status: nextStatus,
        resolutionNote: notes[report.id] || report.resolutionNote || "",
      });

      setReports((currentReports) =>
        currentReports.map((currentReport) =>
          currentReport.id === report.id ? data.report : currentReport
        )
      );
      setFocusedReport((currentReport) =>
        Number(currentReport?.id) === Number(report.id) ? data.report : currentReport
      );
      setSummary((currentSummary) =>
        updateSummary(currentSummary, report.status, data.report.status)
      );
      setNotes((currentNotes) => ({
        ...currentNotes,
        [report.id]: data.report.resolutionNote || "",
      }));
      setNotice("Đã cập nhật báo cáo.");
    } catch (error) {
      setError(error.message);
    } finally {
      setUpdatingReportId(null);
    }
  }

  async function handleModerationAction(report, action) {
    if (action === "remove") {
      const confirmed = window.confirm(
        "Bạn chắc chắn muốn gỡ bỏ nội dung bị báo cáo? Thao tác này không thể hoàn tác."
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      setUpdatingReportId(report.id);
      setError("");
      setNotice("");

      const data = await applyAdminReportAction(report.id, {
        action,
        resolutionNote: notes[report.id] || report.resolutionNote || "",
      });

      setReports((currentReports) =>
        currentReports.map((currentReport) =>
          currentReport.id === report.id ? data.report : currentReport
        )
      );
      setFocusedReport((currentReport) =>
        Number(currentReport?.id) === Number(report.id) ? data.report : currentReport
      );
      setSummary((currentSummary) =>
        updateSummary(currentSummary, report.status, data.report.status)
      );
      setNotes((currentNotes) => ({
        ...currentNotes,
        [report.id]: data.report.resolutionNote || "",
      }));
      setNotice(data.message || "Đã xử lý báo cáo và thông báo người dùng.");
    } catch (error) {
      setError(error.message);
    } finally {
      setUpdatingReportId(null);
    }
  }

  return (
    <div className="admin-reports-page">
      <section className="admin-reports-header">
        <div>
          <h1>Moderation Reports</h1>
          <p>
            {total} báo cáo phù hợp bộ lọc
            {refreshing ? " - đang cập nhật" : ""}
          </p>
        </div>

        <button
          className="button secondary"
          type="button"
          disabled={loading || refreshing}
          onClick={() => setRefreshKey((currentKey) => currentKey + 1)}
        >
          Làm mới
        </button>
      </section>

      <nav className="admin-nav" aria-label="Admin navigation">
        {canManageAdminArea(user) && (
          <>
            <Link to="/admin">Tổng quan</Link>
            <Link to="/admin/users">Người dùng</Link>
            <Link to="/admin/content">Nội dung</Link>
            <Link to="/admin/audit-logs">Audit Log</Link>
          </>
        )}
        <Link to="/admin/reports">Báo cáo</Link>
      </nav>

      <section className="admin-report-summary" aria-label="Tổng quan báo cáo">
        {statuses
          .filter((item) => item.value)
          .map((item) => (
            <button
              key={item.value}
              type="button"
              className={status === item.value ? "active" : ""}
              onClick={() => handleFilterStatus(item.value)}
            >
              <strong>{Number(summary[item.value] || 0)}</strong>
              <span>{item.label}</span>
            </button>
          ))}
      </section>

      <section className="admin-report-filters">
        <label>
          Trạng thái
          <select
            value={status}
            onChange={(event) => handleFilterStatus(event.target.value)}
          >
            {statuses.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Loại nội dung
          <select
            value={targetType}
            onChange={(event) => handleFilterTargetType(event.target.value)}
          >
            {targetTypes.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}

      {loading ? (
        <section className="card">
          <p>Đang tải hàng đợi moderation...</p>
        </section>
      ) : visibleReports.length === 0 ? (
        <section className="card">
          <p>Không có báo cáo nào trong bộ lọc hiện tại.</p>
        </section>
      ) : (
        <div className="admin-report-list">
          {visibleReports.map((report) => {
            const targetUrl = getTargetUrl(report);
            const isUpdating = updatingReportId === report.id;
            const canRemove = isRemovableReport(report);
            const isHighlighted =
              Number(report.id) === Number(focusedReportId);

            return (
              <article
                key={report.id}
                ref={isHighlighted ? highlightedReportRef : null}
                className={`admin-report-card ${
                  isHighlighted ? "highlighted" : ""
                }`.trim()}
              >
                <header>
                  <div>
                    <span className={`admin-report-status ${report.status}`}>
                      {statusLabels[report.status] || report.status}
                    </span>
                    <h2>
                      {targetTypes.find((item) => item.value === report.targetType)
                        ?.label || report.targetType}{" "}
                      #{report.targetId}
                    </h2>
                  </div>

                  <span title={formatVietnamDateTime(report.createdAt)}>
                    {formatRelativeTime(report.createdAt)}
                  </span>
                </header>

                <div className="admin-report-meta">
                  <span>
                    Người báo cáo: <strong>{report.reporterName}</strong>
                  </span>
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
                  <p className="admin-report-details">{report.details}</p>
                )}

                {targetUrl && (
                  <Link className="admin-report-target-link" to={targetUrl}>
                    {report.targetType === "comment"
                      ? "Mở thẳng bình luận"
                      : "Mở nội dung"}
                  </Link>
                )}

                <label className="admin-report-note">
                  Ghi chú xử lý
                  <textarea
                    value={notes[report.id] ?? report.resolutionNote ?? ""}
                    onChange={(event) =>
                      handleNoteChange(report.id, event.target.value)
                    }
                    maxLength={2000}
                    rows={3}
                    disabled={isUpdating}
                  />
                </label>

                <footer>
                  <div className="admin-report-reviewer">
                    {report.reviewerName ? (
                      <>
                        Xử lý bởi <strong>{report.reviewerName}</strong>
                        {report.reviewedAt && (
                          <span title={formatVietnamDateTime(report.reviewedAt)}>
                            {" "}
                            - {formatRelativeTime(report.reviewedAt)}
                          </span>
                        )}
                      </>
                    ) : (
                      "Chưa có moderator xử lý"
                    )}
                  </div>

                  <div className="admin-report-actions">
                    <button
                      type="button"
                      disabled={isUpdating || report.status === "reviewing"}
                      onClick={() => handleUpdateStatus(report, "reviewing")}
                    >
                      Đang xem xét
                    </button>
                    <button
                      type="button"
                      className="keep"
                      disabled={isUpdating || report.status === "dismissed"}
                      onClick={() => handleModerationAction(report, "keep")}
                    >
                      Giữ lại
                    </button>
                    <button
                      type="button"
                      className="remove"
                      disabled={isUpdating || !canRemove || report.status === "resolved"}
                      title={
                        canRemove
                          ? "Gỡ bỏ nội dung vi phạm"
                          : "Chỉ hỗ trợ gỡ bài viết hoặc bình luận"
                      }
                      onClick={() => handleModerationAction(report, "remove")}
                    >
                      Gỡ bỏ
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating || report.status === "pending"}
                      onClick={() => handleUpdateStatus(report, "pending")}
                    >
                      Mở lại
                    </button>
                  </div>
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
            Trang {page} / {totalPages}
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
