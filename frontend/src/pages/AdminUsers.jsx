import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";

import {
  deleteAdminUser,
  getAdminUsers,
  updateAdminUserRole,
} from "../api/admin.api.js";
import { getFileUrl } from "../api/client.js";
import { useAuth } from "../context/useAuth.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const roleOptions = [
  { value: "", label: "Tất cả quyền" },
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
];

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutatingUserId, setMutatingUserId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadUsers({ silent = false } = {}) {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const data = await getAdminUsers({
          page,
          limit,
          search,
          role,
        });

        if (!isActive) {
          return;
        }

        setUsers(data.users || []);
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
      loadUsers({ silent: Boolean(search || role || page > 1) });
    }

    return () => {
      isActive = false;
    };
  }, [user?.role, page, limit, search, role]);

  if (authLoading) {
    return <p>Đang kiểm tra quyền quản trị...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/feed" replace />;
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
    setNotice("");
  }

  function handleRoleFilterChange(nextRole) {
    setRole(nextRole);
    setPage(1);
    setNotice("");
  }

  async function handleRoleChange(targetUser, nextRole) {
    if (!nextRole || nextRole === targetUser.role) {
      return;
    }

    if (
      targetUser.role === "admin" &&
      nextRole === "user" &&
      !window.confirm(`Hạ quyền admin của ${targetUser.name}?`)
    ) {
      return;
    }

    try {
      setMutatingUserId(targetUser.id);
      setError("");
      setNotice("");

      const data = await updateAdminUserRole(targetUser.id, nextRole);

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === targetUser.id ? data.user : currentUser
        )
      );
      setNotice(`Đã cập nhật quyền cho ${data.user.name}.`);
    } catch (error) {
      setError(error.message);
    } finally {
      setMutatingUserId(null);
    }
  }

  async function handleDeleteUser(targetUser) {
    const confirmed = window.confirm(
      `Xóa tài khoản ${targetUser.name}? Toàn bộ bài viết, bình luận và dữ liệu liên quan sẽ bị xóa.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setMutatingUserId(targetUser.id);
      setError("");
      setNotice("");

      await deleteAdminUser(targetUser.id);

      setUsers((currentUsers) =>
        currentUsers.filter((currentUser) => currentUser.id !== targetUser.id)
      );
      setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      setNotice(`Đã xóa tài khoản ${targetUser.name}.`);
    } catch (error) {
      setError(error.message);
    } finally {
      setMutatingUserId(null);
    }
  }

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <h1>Quản lý người dùng</h1>
          <p>
            {total} tài khoản phù hợp bộ lọc
            {refreshing ? " - đang cập nhật" : ""}
          </p>
        </div>

        <Link className="button secondary" to="/admin">
          Tổng quan
        </Link>
      </section>

      <nav className="admin-nav" aria-label="Admin navigation">
        <Link to="/admin">Tổng quan</Link>
        <Link to="/admin/content">Nội dung</Link>
        <Link to="/admin/reports">Báo cáo</Link>
      </nav>

      <section className="admin-toolbar">
        <form className="admin-search-form" onSubmit={handleSearchSubmit}>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm theo tên hoặc email"
          />
          <button className="button" type="submit">
            Tìm
          </button>
        </form>

        <label>
          Quyền
          <select
            value={role}
            onChange={(event) => handleRoleFilterChange(event.target.value)}
          >
            {roleOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}

      {loading ? (
        <section className="card">
          <p>Đang tải danh sách người dùng...</p>
        </section>
      ) : users.length === 0 ? (
        <section className="card">
          <p>Không tìm thấy người dùng nào.</p>
        </section>
      ) : (
        <section className="admin-list" aria-label="Danh sách người dùng">
          {users.map((targetUser) => {
            const isSelf = Number(targetUser.id) === Number(user.id);
            const isMutating = mutatingUserId === targetUser.id;
            const avatarUrl = getFileUrl(targetUser.avatarUrl);

            return (
              <article key={targetUser.id} className="admin-user-row">
                {avatarUrl ? (
                  <img
                    className="admin-user-avatar"
                    src={avatarUrl}
                    alt={targetUser.name}
                  />
                ) : (
                  <div className="admin-user-avatar placeholder">
                    {targetUser.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}

                <div className="admin-user-main">
                  <div className="admin-user-heading">
                    <Link to={`/users/${targetUser.id}`}>
                      <strong>{targetUser.name}</strong>
                    </Link>
                    {isSelf && <span>Bạn</span>}
                    <span className={`admin-role-badge ${targetUser.role}`}>
                      {targetUser.role}
                    </span>
                  </div>
                  <p>{targetUser.email}</p>
                  <div className="admin-row-meta">
                    <span>{targetUser.postCount || 0} bài viết</span>
                    <span>{targetUser.commentCount || 0} bình luận</span>
                    <span>{targetUser.reportCount || 0} báo cáo</span>
                    <span title={formatVietnamDateTime(targetUser.createdAt)}>
                      Tham gia {formatRelativeTime(targetUser.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="admin-row-actions">
                  <label>
                    Quyền
                    <select
                      value={targetUser.role || "user"}
                      disabled={isMutating || isSelf}
                      onChange={(event) =>
                        handleRoleChange(targetUser, event.target.value)
                      }
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>

                  <button
                    className="button danger"
                    type="button"
                    disabled={isMutating || isSelf}
                    onClick={() => handleDeleteUser(targetUser)}
                  >
                    Xóa
                  </button>
                </div>
              </article>
            );
          })}
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
