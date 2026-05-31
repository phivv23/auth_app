import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";

import {
  getAdminUserDetail,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "../api/admin.api.js";
import { getFileUrl } from "../api/client.js";
import { useAuth } from "../context/useAuth.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const statusLabels = {
  active: "Đang hoạt động",
  suspended: "Tạm khóa",
  banned: "Cấm đăng nhập",
};

export default function AdminUserDetail() {
  const { id } = useParams();
  const { user: currentUser, loading: authLoading } = useAuth();

  const [detail, setDetail] = useState(null);
  const [role, setRole] = useState("user");
  const [accountStatus, setAccountStatus] = useState("active");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadUserDetail() {
      try {
        setLoading(true);
        setError("");

        const data = await getAdminUserDetail(id);

        if (!isActive) {
          return;
        }

        setDetail(data);
        setRole(data.user?.role || "user");
        setAccountStatus(data.user?.accountStatus || "active");
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

    if (currentUser?.role === "admin") {
      loadUserDetail();
    }

    return () => {
      isActive = false;
    };
  }, [currentUser?.role, id]);

  if (authLoading) {
    return <p>Đang kiểm tra quyền quản trị...</p>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser.role !== "admin") {
    return <Navigate to="/feed" replace />;
  }

  async function handleSaveRole() {
    if (!detail?.user || role === detail.user.role) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const data = await updateAdminUserRole(detail.user.id, role);

      setDetail((currentDetail) => ({
        ...currentDetail,
        user: data.user,
      }));
      setNotice("Đã cập nhật quyền người dùng.");
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStatus() {
    if (!detail?.user || accountStatus === detail.user.accountStatus) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const data = await updateAdminUserStatus(detail.user.id, {
        accountStatus,
        reason,
      });

      setDetail((currentDetail) => ({
        ...currentDetail,
        user: data.user,
      }));
      setReason("");
      setNotice("Đã cập nhật trạng thái tài khoản và gửi thông báo.");
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <section className="card">
          <p>Đang tải chi tiết người dùng...</p>
        </section>
      </div>
    );
  }

  if (!detail?.user) {
    return (
      <div className="admin-page">
        {error ? <p className="error">{error}</p> : <p>Không tìm thấy user.</p>}
      </div>
    );
  }

  const targetUser = detail.user;
  const avatarUrl = getFileUrl(targetUser.avatarUrl);
  const isSelf = Number(targetUser.id) === Number(currentUser.id);

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <h1>{targetUser.name}</h1>
          <p>{targetUser.email}</p>
        </div>

        <Link className="button secondary" to="/admin/users">
          Danh sách user
        </Link>
      </section>

      <nav className="admin-nav" aria-label="Admin navigation">
        <Link to="/admin">Tổng quan</Link>
        <Link to="/admin/users">Người dùng</Link>
        <Link to="/admin/content">Nội dung</Link>
        <Link to="/admin/audit-logs">Audit Log</Link>
      </nav>

      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}

      <section className="admin-user-detail-grid">
        <article className="admin-user-profile-card">
          {avatarUrl ? (
            <img src={avatarUrl} alt={targetUser.name} />
          ) : (
            <div>{targetUser.name?.charAt(0)?.toUpperCase() || "U"}</div>
          )}

          <strong>{targetUser.name}</strong>
          <span>{statusLabels[targetUser.accountStatus] || "Đang hoạt động"}</span>
          <p>
            {targetUser.postCount || 0} bài viết · {targetUser.commentCount || 0}{" "}
            bình luận · {targetUser.reportCount || 0} báo cáo
          </p>
          <p title={formatVietnamDateTime(targetUser.createdAt)}>
            Tham gia {formatRelativeTime(targetUser.createdAt)}
          </p>
        </article>

        <article className="admin-user-control-card">
          <h2>Quyền và trạng thái</h2>

          <label>
            Quyền
            <select
              value={role}
              disabled={saving || isSelf}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            className="button"
            type="button"
            disabled={saving || isSelf || role === targetUser.role}
            onClick={handleSaveRole}
          >
            Lưu quyền
          </button>

          <label>
            Trạng thái
            <select
              value={accountStatus}
              disabled={saving || isSelf}
              onChange={(event) => setAccountStatus(event.target.value)}
            >
              <option value="active">Đang hoạt động</option>
              <option value="suspended">Tạm khóa</option>
              <option value="banned">Cấm đăng nhập</option>
            </select>
          </label>
          <label>
            Lý do
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={1000}
              disabled={saving || isSelf}
            />
          </label>
          <button
            className="button danger"
            type="button"
            disabled={
              saving || isSelf || accountStatus === targetUser.accountStatus
            }
            onClick={handleSaveStatus}
          >
            Lưu trạng thái
          </button>
        </article>
      </section>

      <section className="admin-user-sections">
        <article>
          <h2>Bài viết gần đây</h2>
          {detail.posts?.length ? (
            detail.posts.map((post) => (
              <Link key={post.id} to={`/posts/${post.id}`}>
                #{post.id} {post.title || post.content || "Không có nội dung"}
              </Link>
            ))
          ) : (
            <p>Chưa có bài viết.</p>
          )}
        </article>

        <article>
          <h2>Bình luận gần đây</h2>
          {detail.comments?.length ? (
            detail.comments.map((comment) => (
              <Link
                key={comment.id}
                to={`/posts/${comment.postId}?commentId=${comment.id}`}
              >
                #{comment.id} {comment.content}
              </Link>
            ))
          ) : (
            <p>Chưa có bình luận.</p>
          )}
        </article>

        <article>
          <h2>Báo cáo đã gửi</h2>
          {detail.reports?.length ? (
            detail.reports.map((report) => (
              <span key={report.id}>
                #{report.id} {report.targetType} #{report.targetId} ·{" "}
                {report.status}
              </span>
            ))
          ) : (
            <p>Chưa gửi báo cáo.</p>
          )}
        </article>

        <article>
          <h2>Audit liên quan</h2>
          {detail.auditLogs?.length ? (
            detail.auditLogs.map((log) => (
              <span key={log.id}>
                {log.action} · {formatRelativeTime(log.createdAt)}
              </span>
            ))
          ) : (
            <p>Chưa có thao tác admin.</p>
          )}
        </article>
      </section>
    </div>
  );
}
