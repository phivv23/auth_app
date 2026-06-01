import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  getNotificationStreamUrl,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../api/notification.api.js";
import { NotificationListSkeleton } from "../components/Skeleton.jsx";
import { formatRelativeTime } from "../utils/time.js";

const POLL_INTERVAL_MS = 5000;

const reportStatusLabels = {
  pending: "đang chờ xử lý",
  reviewing: "đang được xem xét",
  resolved: "đã được xử lý",
  dismissed: "đã được giữ lại",
};

const accountStatusLabels = {
  active: "đã được mở lại",
  suspended: "đã bị tạm khóa",
  banned: "đã bị cấm đăng nhập",
};

function getNotificationText(notification) {
  const actorName = notification.actorName || "Một người dùng";

  if (notification.type === "follow") {
    return `${actorName} đã follow bạn`;
  }

  if (notification.type === "friend_request") {
    return `${actorName} đã gửi lời mời kết bạn`;
  }

  if (notification.type === "friend_accept") {
    return `${actorName} đã chấp nhận lời mời kết bạn`;
  }

  if (notification.type === "post_like") {
    return `${actorName} đã thích bài viết "${notification.postTitle || ""}"`;
  }

  if (notification.type === "post_comment") {
    return notification.metadata?.isReply
      ? `${actorName} đã trả lời bình luận của bạn`
      : `${actorName} đã bình luận bài viết "${notification.postTitle || ""}"`;
  }

  if (notification.type === "comment_reaction") {
    return `${actorName} đã bày tỏ cảm xúc với bình luận của bạn`;
  }

  if (notification.type === "message") {
    return `${actorName} đã nhắn tin cho bạn`;
  }

  if (notification.type === "report_status_update") {
    return `Báo cáo của bạn ${
      reportStatusLabels[notification.reportStatus] || "đã được cập nhật"
    }`;
  }

  if (notification.type === "admin_content_removed") {
    const contentType =
      notification.metadata?.contentType === "comment" ? "bình luận" : "bài viết";
    const reason = notification.metadata?.reason || "vi phạm quy định";

    return `${actorName} đã gỡ ${contentType} của bạn: ${reason}`;
  }

  if (notification.type === "admin_account_status_update") {
    const statusText =
      accountStatusLabels[notification.metadata?.accountStatus] ||
      "đã được cập nhật";
    const reason = notification.metadata?.reason;

    return reason
      ? `Tài khoản của bạn ${statusText}: ${reason}`
      : `Tài khoản của bạn ${statusText}`;
  }

  return "Bạn có thông báo mới";
}

function getNotificationTarget(notification) {
  if (notification.type === "follow") {
    return `/users/${notification.actorId}`;
  }

  if (notification.type === "friend_request") {
    return "/friends?tab=incoming";
  }

  if (notification.type === "friend_accept") {
    return `/users/${notification.actorId}`;
  }

  if (notification.type === "message" && notification.conversationId) {
    return `/messages?conversationId=${notification.conversationId}`;
  }

  if (notification.type === "report_status_update") {
    return notification.reportId
      ? `/reports?reportId=${notification.reportId}`
      : "/reports";
  }

  if (notification.postId) {
    return notification.commentId
      ? `/posts/${notification.postId}?commentId=${notification.commentId}`
      : `/posts/${notification.postId}`;
  }

  return "/notifications";
}

export default function Notifications() {
  const navigate = useNavigate();
  const requestRef = useRef({
    controller: null,
    id: 0,
  });

  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadNotifications({ silent = false } = {}) {
      requestRef.current.controller?.abort();
      const controller = new AbortController();
      const requestId = requestRef.current.id + 1;
      requestRef.current = {
        controller,
        id: requestId,
      };

      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const data = await getNotifications({
          page,
          limit,
          signal: controller.signal,
        });

        if (!isActive || requestRef.current.id !== requestId) {
          return;
        }

        setNotifications(data.notifications || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        if (isActive && error.name !== "AbortError" && !silent) {
          setError(error.message);
        }
      } finally {
        if (isActive && requestRef.current.id === requestId) {
          setLoading(false);
          setRefreshing(false);
          requestRef.current.controller = null;
        }
      }
    }

    loadNotifications();

    let intervalId = null;

    if (page === 1) {
      intervalId = setInterval(() => {
        loadNotifications({ silent: true });
      }, POLL_INTERVAL_MS);
    }

    return () => {
      isActive = false;
      requestRef.current.controller?.abort();

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [page, limit]);

  useEffect(() => {
    if (page !== 1) {
      return;
    }

    const eventSource = new EventSource(getNotificationStreamUrl(), {
      withCredentials: true,
    });

    eventSource.addEventListener("notification", (event) => {
      const notification = JSON.parse(event.data);

      setNotifications((currentNotifications) => {
        const withoutDuplicate = currentNotifications.filter(
          (item) => item.id !== notification.id
        );

        return [notification, ...withoutDuplicate].slice(0, limit);
      });
      setTotal((currentTotal) => currentTotal + 1);
    });

    return () => {
      eventSource.close();
    };
  }, [page, limit]);

  async function handleOpenNotification(notification) {
    try {
      if (!notification.isRead) {
        await markNotificationAsRead(notification.id);

        setNotifications((currentNotifications) =>
          currentNotifications.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  isRead: true,
                }
              : item
          )
        );
      }

      navigate(getNotificationTarget(notification));
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsAsRead();

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          isRead: true,
        }))
      );
    } catch (error) {
      setError(error.message);
    }
  }

  return (
    <div className="notifications-page">
      <section className="notifications-panel">
        <div className="notifications-header">
          <div>
            <h1>Thông báo</h1>
            <p>
              Tổng cộng {total} thông báo
              {refreshing ? " - đang cập nhật" : ""}
            </p>
          </div>

          <button
            className="notification-mark-all-button"
            type="button"
            onClick={handleMarkAllRead}
            disabled={notifications.length === 0}
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <NotificationListSkeleton count={6} />
        ) : notifications.length === 0 ? (
          <p className="notification-empty-state">
            Chưa có thông báo nào.
          </p>
        ) : (
          <>
            <div className="notification-list">
              {notifications.map((notification) => {
                const actorAvatarUrl = getFileUrl(
                  notification.actorAvatarUrl
                );

                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={
                      notification.isRead
                        ? "notification-item"
                        : "notification-item unread"
                    }
                    onClick={() => handleOpenNotification(notification)}
                  >
                    {actorAvatarUrl ? (
                      <img
                        className="notification-avatar"
                        src={actorAvatarUrl}
                        alt={notification.actorName || "User"}
                      />
                    ) : (
                      <div className="notification-avatar-placeholder">
                        {notification.actorName?.charAt(0)?.toUpperCase() ||
                          "U"}
                      </div>
                    )}

                    <div className="notification-content">
                      <p>{getNotificationText(notification)}</p>
                      <span>{formatRelativeTime(notification.createdAt)}</span>
                    </div>

                    {!notification.isRead && (
                      <span className="notification-dot" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((currentPage) => currentPage - 1)}
              >
                Trang trước
              </button>

              <span>
                Trang {page} / {totalPages || 1}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                Trang sau
              </button>
            </div>
          </>
        )}
      </section>

      <Link className="notifications-back-link" to="/feed">
        Quay lại Feed
      </Link>
    </div>
  );
}
