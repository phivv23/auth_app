import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";

import { getAdminOverview } from "../api/admin.api.js";
import { useAuth } from "../context/useAuth.js";

const overviewItems = [
  { key: "userCount", label: "Người dùng" },
  { key: "adminCount", label: "Admin" },
  { key: "postCount", label: "Bài viết" },
  { key: "commentCount", label: "Bình luận" },
  { key: "reportCount", label: "Báo cáo" },
  { key: "pendingReportCount", label: "Chờ xử lý" },
  { key: "reviewingReportCount", label: "Đang xem xét" },
  { key: "resolvedReportCount", label: "Đã gỡ" },
  { key: "dismissedReportCount", label: "Giữ lại" },
  { key: "messageCount", label: "Tin nhắn" },
];

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadOverview() {
      try {
        setLoading(true);
        setError("");

        const data = await getAdminOverview();

        if (isActive) {
          setOverview(data.overview || {});
        }
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

    if (user?.role === "admin") {
      loadOverview();
    }

    return () => {
      isActive = false;
    };
  }, [user?.role]);

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
          <h1>Admin Center</h1>
          <p>Quản lý người dùng, nội dung và báo cáo trong một khu vực.</p>
        </div>
      </section>

      <nav className="admin-nav" aria-label="Admin navigation">
        <Link to="/admin/users">Người dùng</Link>
        <Link to="/admin/content">Nội dung</Link>
        <Link to="/admin/reports">Báo cáo</Link>
      </nav>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <section className="card">
          <p>Đang tải tổng quan quản trị...</p>
        </section>
      ) : (
        <section className="admin-stat-grid" aria-label="Tổng quan hệ thống">
          {overviewItems.map((item) => (
            <article key={item.key} className="admin-stat-card">
              <strong>{Number(overview[item.key] || 0).toLocaleString()}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </section>
      )}

      <section className="admin-action-grid" aria-label="Tác vụ quản trị">
        <Link to="/admin/users">
          <strong>Quản lý tài khoản</strong>
          <span>Tìm user, đổi quyền admin/user hoặc xóa tài khoản vi phạm.</span>
        </Link>
        <Link to="/admin/content">
          <strong>Quản lý nội dung</strong>
          <span>Mở bài viết/bình luận bị nghi vấn và gỡ nội dung trực tiếp.</span>
        </Link>
        <Link to="/admin/reports">
          <strong>Duyệt báo cáo</strong>
          <span>Giữ lại hoặc gỡ nội dung từ hàng đợi báo cáo.</span>
        </Link>
      </section>
    </div>
  );
}
