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
import {
  getNotificationTarget,
  getNotificationText,
} from "../utils/notificationDisplay.js";
import { formatRelativeTime } from "../utils/time.js";

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

    return () => {
      isActive = false;
      requestRef.current.controller?.abort();
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
