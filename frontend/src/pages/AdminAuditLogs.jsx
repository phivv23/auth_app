import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";

import { getAdminAuditLogs } from "../api/admin.api.js";
import { useAuth } from "../context/useAuth.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const actionOptions = [
  { value: "", label: "Tất cả hành động" },
  { value: "user.role.update", label: "Đổi quyền" },
  { value: "user.status.update", label: "Khóa/mở tài khoản" },
  { value: "user.delete", label: "Xóa user" },
  { value: "content.post.remove", label: "Gỡ bài viết" },
  { value: "content.comment.remove", label: "Gỡ bình luận" },
  { value: "report.status.update", label: "Đổi trạng thái report" },
  { value: "report.content.remove", label: "Gỡ từ report" },
  { value: "report.content.keep", label: "Giữ từ report" },
];

function getActionLabel(action) {
  return actionOptions.find((item) => item.value === action)?.label || action;
}

function formatMetadata(metadata = {}) {
  const entries = Object.entries(metadata).filter(([, value]) => value);

  if (entries.length === 0) {
    return "Không có metadata.";
  }

  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
}

export default function AdminAuditLogs() {
  const { user, loading: authLoading } = useAuth();

  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadLogs({ silent = false } = {}) {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const data = await getAdminAuditLogs({
          page,
          limit,
          action,
          targetType,
        });

        if (!isActive) {
          return;
        }

        setLogs(data.logs || []);
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

    if (user?.role === "admin") {
      loadLogs({ silent: Boolean(action || targetType || page > 1) });
    }

    return () => {
      isActive = false;
    };
  }, [user?.role, page, limit, action, targetType]);

  if (authLoading) {
    return <p>Đang kiểm tra quyền quản trị...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/feed" replace />;
  }

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <h1>Audit Log</h1>
          <p>
            {total} thao tác quản trị
            {refreshing ? " - đang cập nhật" : ""}
          </p>
        </div>

        <Link className="button secondary" to="/admin">
          Tổng quan
        </Link>
      </section>

      <nav className="admin-nav" aria-label="Admin navigation">
        <Link to="/admin">Tổng quan</Link>
        <Link to="/admin/users">Người dùng</Link>
        <Link to="/admin/content">Nội dung</Link>
        <Link to="/admin/reports">Báo cáo</Link>
      </nav>

      <section className="admin-toolbar">
        <label>
          Hành động
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          >
            {actionOptions.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Target
          <select
            value={targetType}
            onChange={(event) => {
              setTargetType(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả target</option>
            <option value="user">User</option>
            <option value="post">Post</option>
            <option value="comment">Comment</option>
            <option value="report">Report</option>
          </select>
        </label>
      </section>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <section className="card">
          <p>Đang tải audit log...</p>
        </section>
      ) : logs.length === 0 ? (
        <section className="card">
          <p>Chưa có log phù hợp bộ lọc.</p>
        </section>
      ) : (
        <section className="admin-list" aria-label="Audit log">
          {logs.map((log) => (
            <article key={log.id} className="admin-audit-row">
              <div>
                <strong>{getActionLabel(log.action)}</strong>
                <p>{formatMetadata(log.metadata)}</p>
                <div className="admin-row-meta">
                  <span>
                    Admin:{" "}
                    {log.actorId ? (
                      <Link to={`/admin/users/${log.actorId}`}>
                        {log.actorName || `#${log.actorId}`}
                      </Link>
                    ) : (
                      "Không còn tài khoản"
                    )}
                  </span>
                  {log.targetUserId && (
                    <span>
                      User:{" "}
                      <Link to={`/admin/users/${log.targetUserId}`}>
                        {log.targetUserName || `#${log.targetUserId}`}
                      </Link>
                    </span>
                  )}
                  {log.targetType && (
                    <span>
                      {log.targetType} #{log.targetId}
                    </span>
                  )}
                  <span title={formatVietnamDateTime(log.createdAt)}>
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {!loading && totalPages > 1 && (
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
