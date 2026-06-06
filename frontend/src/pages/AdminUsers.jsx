import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";

import {
  deleteAdminUser,
  getAdminUsers,
  updateAdminUserStatus,
  updateAdminUserRole,
} from "../api/admin.api.js";
import { getFileUrl } from "../api/client.js";
import { useAuth } from "../context/useAuth.js";
import { useActionDialog } from "../hooks/useActionDialog.jsx";
import {
  canManageAdminArea,
  canManageRoles,
  canMutateTargetUser,
  getRoleLabel,
  roleFilterOptions,
  roleOptions,
} from "../utils/adminPermissions.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "active", label: "Đang hoạt động" },
  { value: "suspended", label: "Tạm khóa" },
  { value: "banned", label: "Cấm đăng nhập" },
];

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth();
  const { actionDialog, confirmAction, promptAction } = useActionDialog();

  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
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
          accountStatus,
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

    if (canManageAdminArea(user)) {
      loadUsers({ silent: Boolean(search || role || page > 1) });
    }

    return () => {
      isActive = false;
    };
  }, [user, page, limit, search, role, accountStatus]);

  if (authLoading) {
    return <p>Đang kiểm tra quyền quản trị...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canManageAdminArea(user)) {
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

  function handleStatusFilterChange(nextStatus) {
    setAccountStatus(nextStatus);
    setPage(1);
    setNotice("");
  }

  async function handleRoleChange(targetUser, nextRole) {
    if (!canManageRoles(user)) {
      return;
    }

    if (!nextRole || nextRole === targetUser.role) {
      return;
    }

    if (
      targetUser.role === "admin" &&
      nextRole === "user"
    ) {
      const confirmed = await confirmAction({
        title: "Hạ quyền admin?",
        message: `${targetUser.name} sẽ mất quyền quản trị sau thao tác này.`,
        confirmLabel: "Hạ quyền",
        danger: true,
      });

      if (!confirmed) {
        return;
      }
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
    await confirmAction({
      title: "Xóa tài khoản?",
      message: `Toàn bộ bài viết, bình luận và dữ liệu liên quan của ${targetUser.name} sẽ bị xóa.`,
      confirmLabel: "Xóa tài khoản",
      loadingLabel: "Đang xóa...",
      danger: true,
      onConfirm: async () => {
        try {
          setMutatingUserId(targetUser.id);
          setError("");
          setNotice("");

          await deleteAdminUser(targetUser.id);

          setUsers((currentUsers) =>
            currentUsers.filter(
              (currentUser) => currentUser.id !== targetUser.id
            )
          );
          setTotal((currentTotal) => Math.max(0, currentTotal - 1));
          setNotice(`Đã xóa tài khoản ${targetUser.name}.`);
        } catch (error) {
          setError(error.message);
          throw error;
        } finally {
          setMutatingUserId(null);
        }
      },
    });
  }

  async function handleStatusChange(targetUser, nextStatus) {
    if (!nextStatus || nextStatus === targetUser.accountStatus) {
      return;
    }

    await promptAction({
      title: "Đổi trạng thái tài khoản",
      message: `Nhập lý do đổi trạng thái ${targetUser.name} sang ${nextStatus}.`,
      inputLabel: "Lý do",
      placeholder: "Ví dụ: Vi phạm tiêu chuẩn cộng đồng.",
      confirmLabel: "Cập nhật",
      loadingLabel: "Đang cập nhật...",
      onConfirm: async (reason) => {
        try {
          setMutatingUserId(targetUser.id);
          setError("");
          setNotice("");

          const data = await updateAdminUserStatus(targetUser.id, {
            accountStatus: nextStatus,
            reason,
          });

          setUsers((currentUsers) =>
            currentUsers.map((currentUser) =>
              currentUser.id === targetUser.id ? data.user : currentUser
            )
          );
          setNotice(`Đã cập nhật trạng thái cho ${data.user.name}.`);
        } catch (error) {
          setError(error.message);
          throw error;
        } finally {
          setMutatingUserId(null);
        }
      },
    });
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
        <Link to="/admin/audit-logs">Audit Log</Link>
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
            {roleFilterOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Trạng thái
          <select
            value={accountStatus}
            onChange={(event) =>
              handleStatusFilterChange(event.target.value)
            }
          >
            {statusOptions.map((option) => (
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
            const canMutateUser = canMutateTargetUser(user, targetUser);
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
                      {getRoleLabel(targetUser.role)}
                    </span>
                    <span
                      className={`admin-status-badge ${
                        targetUser.accountStatus || "active"
                      }`}
                    >
                      {
                        statusOptions.find(
                          (item) => item.value === targetUser.accountStatus
                        )?.label || "Đang hoạt động"
                      }
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
                      disabled={isMutating || !canManageRoles(user) || isSelf}
                      onChange={(event) =>
                        handleRoleChange(targetUser, event.target.value)
                      }
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Trạng thái
                    <select
                      value={targetUser.accountStatus || "active"}
                      disabled={isMutating || !canMutateUser}
                      onChange={(event) =>
                        handleStatusChange(targetUser, event.target.value)
                      }
                    >
                      <option value="active">Đang hoạt động</option>
                      <option value="suspended">Tạm khóa</option>
                      <option value="banned">Cấm đăng nhập</option>
                    </select>
                  </label>

                  <Link
                    className="button secondary"
                    to={`/admin/users/${targetUser.id}`}
                  >
                    Chi tiết
                  </Link>
                  <button
                    className="button danger"
                    type="button"
                    disabled={isMutating || !canMutateUser}
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
      {actionDialog}
    </div>
  );
}
