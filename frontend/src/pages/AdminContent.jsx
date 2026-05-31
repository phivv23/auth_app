import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";

import {
  deleteAdminComment,
  deleteAdminPost,
  getAdminComments,
  getAdminPosts,
} from "../api/admin.api.js";
import { useAuth } from "../context/useAuth.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const contentTabs = [
  { value: "posts", label: "Bài viết" },
  { value: "comments", label: "Bình luận" },
];

function previewText(value, fallback = "Không có nội dung") {
  const text = String(value || "").trim();

  if (!text) {
    return fallback;
  }

  return text.length > 240 ? `${text.slice(0, 240)}...` : text;
}

export default function AdminContent() {
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState("posts");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [reportedOnly, setReportedOnly] = useState(false);
  const [minReports, setMinReports] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadContent({ silent = false } = {}) {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const loader = tab === "posts" ? getAdminPosts : getAdminComments;
        const data = await loader({
          page,
          limit,
          search,
          authorId,
          privacy: tab === "posts" ? privacy : "",
          reportedOnly,
          minReports,
          fromDate,
          toDate,
        });

        if (!isActive) {
          return;
        }

        setItems(tab === "posts" ? data.posts || [] : data.comments || []);
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
      loadContent({ silent: Boolean(search || page > 1) });
    }

    return () => {
      isActive = false;
    };
  }, [
    user?.role,
    tab,
    page,
    limit,
    search,
    authorId,
    privacy,
    reportedOnly,
    minReports,
    fromDate,
    toDate,
  ]);

  if (authLoading) {
    return <p>Đang kiểm tra quyền quản trị...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/feed" replace />;
  }

  function handleTabChange(nextTab) {
    setTab(nextTab);
    setPage(1);
    setItems([]);
    setNotice("");
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
    setNotice("");
  }

  async function handleDeletePost(post) {
    const reason = window.prompt(
      `Lý do gỡ bài viết #${post.id}:`,
      "Vi phạm quy định cộng đồng."
    );

    if (reason === null) {
      return;
    }

    const confirmed = window.confirm(
      `Gỡ bài viết #${post.id} của ${post.authorName}? Tác giả sẽ nhận thông báo.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(post.id);
      setError("");
      setNotice("");

      await deleteAdminPost(post.id, {
        reason,
      });

      setItems((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== post.id)
      );
      setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      setNotice("Đã gỡ bài viết và thông báo cho người dùng.");
    } catch (error) {
      setError(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteComment(comment) {
    const reason = window.prompt(
      `Lý do gỡ bình luận #${comment.id}:`,
      "Vi phạm quy định cộng đồng."
    );

    if (reason === null) {
      return;
    }

    const confirmed = window.confirm(
      `Gỡ bình luận #${comment.id} của ${comment.authorName}? Tác giả sẽ nhận thông báo.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(comment.id);
      setError("");
      setNotice("");

      await deleteAdminComment(comment.id, {
        reason,
      });

      setItems((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== comment.id)
      );
      setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      setNotice("Đã gỡ bình luận và thông báo cho người dùng.");
    } catch (error) {
      setError(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="admin-page">
      <section className="admin-page-header">
        <div>
          <h1>Quản lý nội dung</h1>
          <p>
            {total} mục phù hợp bộ lọc
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
        <Link to="/admin/reports">Báo cáo</Link>
        <Link to="/admin/audit-logs">Audit Log</Link>
      </nav>

      <section className="admin-toolbar">
        <div className="admin-tabs" role="tablist" aria-label="Loại nội dung">
          {contentTabs.map((item) => (
            <button
              key={item.value}
              type="button"
              className={tab === item.value ? "active" : ""}
              onClick={() => handleTabChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form className="admin-search-form" onSubmit={handleSearchSubmit}>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={
              tab === "posts"
                ? "Tìm bài viết, nội dung hoặc tác giả"
                : "Tìm bình luận, bài viết hoặc tác giả"
            }
          />
          <button className="button" type="submit">
            Tìm
          </button>
        </form>
      </section>

      <section className="admin-toolbar admin-filter-grid">
        <label>
          User ID
          <input
            value={authorId}
            onChange={(event) => {
              setAuthorId(event.target.value);
              setPage(1);
            }}
            placeholder="Lọc theo tác giả"
          />
        </label>

        {tab === "posts" && (
          <label>
            Privacy
            <select
              value={privacy}
              onChange={(event) => {
                setPrivacy(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="friends">Friends</option>
              <option value="only_me">Only me</option>
            </select>
          </label>
        )}

        <label>
          Số report tối thiểu
          <input
            type="number"
            min="1"
            value={minReports}
            onChange={(event) => {
              setMinReports(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <label>
          Từ ngày
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <label>
          Đến ngày
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <label className="admin-checkbox-filter">
          <input
            type="checkbox"
            checked={reportedOnly}
            onChange={(event) => {
              setReportedOnly(event.target.checked);
              setPage(1);
            }}
          />
          Chỉ nội dung bị report
        </label>
      </section>

      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}

      {loading ? (
        <section className="card">
          <p>Đang tải nội dung...</p>
        </section>
      ) : items.length === 0 ? (
        <section className="card">
          <p>Không tìm thấy nội dung nào.</p>
        </section>
      ) : (
        <section className="admin-list" aria-label="Danh sách nội dung">
          {tab === "posts"
            ? items.map((post) => (
                <article key={post.id} className="admin-content-row">
                  <div className="admin-content-main">
                    <div className="admin-content-heading">
                      <Link to={`/posts/${post.id}`}>
                        <strong>Bài viết #{post.id}</strong>
                      </Link>
                      <span>{post.privacy}</span>
                      {post.reportCount > 0 && (
                        <span className="admin-report-count">
                          {post.reportCount} báo cáo
                        </span>
                      )}
                    </div>
                    <p>{previewText(post.title || post.content)}</p>
                    {post.title && post.content && (
                      <blockquote>{previewText(post.content)}</blockquote>
                    )}
                    <div className="admin-row-meta">
                      <span>
                        Tác giả:{" "}
                        <Link to={`/users/${post.userId}`}>
                          <strong>{post.authorName}</strong>
                        </Link>
                      </span>
                      <span>{post.commentCount || 0} bình luận</span>
                      <span>{post.reactionCount || 0} cảm xúc</span>
                      <span>{post.shareCount || 0} chia sẻ</span>
                      <span title={formatVietnamDateTime(post.createdAt)}>
                        {formatRelativeTime(post.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="admin-row-actions">
                    <Link className="button secondary" to={`/posts/${post.id}`}>
                      Mở
                    </Link>
                    <button
                      className="button danger"
                      type="button"
                      disabled={deletingId === post.id}
                      onClick={() => handleDeletePost(post)}
                    >
                      Gỡ
                    </button>
                  </div>
                </article>
              ))
            : items.map((comment) => (
                <article key={comment.id} className="admin-content-row">
                  <div className="admin-content-main">
                    <div className="admin-content-heading">
                      <Link to={`/posts/${comment.postId}?commentId=${comment.id}`}>
                        <strong>Bình luận #{comment.id}</strong>
                      </Link>
                      {comment.reportCount > 0 && (
                        <span className="admin-report-count">
                          {comment.reportCount} báo cáo
                        </span>
                      )}
                    </div>
                    <p>{previewText(comment.content)}</p>
                    <div className="admin-row-meta">
                      <span>
                        Tác giả:{" "}
                        <Link to={`/users/${comment.userId}`}>
                          <strong>{comment.authorName}</strong>
                        </Link>
                      </span>
                      <span>Bài #{comment.postId}</span>
                      <span title={formatVietnamDateTime(comment.createdAt)}>
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="admin-row-actions">
                    <Link
                      className="button secondary"
                      to={`/posts/${comment.postId}?commentId=${comment.id}`}
                    >
                      Mở
                    </Link>
                    <button
                      className="button danger"
                      type="button"
                      disabled={deletingId === comment.id}
                      onClick={() => handleDeleteComment(comment)}
                    >
                      Gỡ
                    </button>
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
