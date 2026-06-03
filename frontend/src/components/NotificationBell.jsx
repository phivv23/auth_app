import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  getNotificationStreamUrl,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
} from "../api/notification.api.js";
import { useAuth } from "../context/useAuth.js";
import {
  getNotificationTarget,
  getNotificationText,
} from "../utils/notificationDisplay.js";
import { formatRelativeTime } from "../utils/time.js";

const POLL_INTERVAL_MS = 30000;

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const wrapperRef = useRef(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    async function loadNotificationPreview({ showLoading = false } = {}) {
      try {
        if (showLoading) {
          setLoading(true);
        }

        const [countData, listData] = await Promise.all([
          getUnreadNotificationCount(),
          getNotifications({ page: 1, limit: 5 }),
        ]);

        if (!cancelled) {
          setUnreadCount(countData.unreadCount || 0);
          setNotifications(listData.notifications || []);
        }
      } catch {
        if (!cancelled) {
          setUnreadCount(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadNotificationPreview({ showLoading: true });

    const intervalId = setInterval(loadNotificationPreview, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    if (!user || location.pathname === "/notifications") {
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

        return [notification, ...withoutDuplicate].slice(0, 5);
      });

      if (!notification.isRead) {
        setUnreadCount((currentCount) => currentCount + 1);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [location.pathname, user]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  async function handleOpenNotification(notification) {
    try {
      if (!notification.isRead) {
        await markNotificationAsRead(notification.id);

        setUnreadCount((currentCount) => Math.max(0, currentCount - 1));
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
    } finally {
      setOpen(false);
      navigate(getNotificationTarget(notification));
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="notification-bell-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="notification-bell nav-icon-button"
        aria-label="Thông báo"
        title="Thông báo"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <span aria-hidden="true">🔔</span>

        {unreadCount > 0 && (
          <span className="notification-badge nav-icon-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h2>Thông báo</h2>
            <Link to="/notifications" onClick={() => setOpen(false)}>
              Xem tất cả
            </Link>
          </div>

          {loading ? (
            <p className="notification-dropdown-empty">Đang tải...</p>
          ) : notifications.length === 0 ? (
            <p className="notification-dropdown-empty">
              Chưa có thông báo nào.
            </p>
          ) : (
            <div className="notification-dropdown-list">
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
                        ? "notification-preview"
                        : "notification-preview unread"
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

                    <span className="notification-preview-content">
                      <strong>{getNotificationText(notification)}</strong>
                      <span>{formatRelativeTime(notification.createdAt)}</span>
                    </span>

                    {!notification.isRead && (
                      <span className="notification-dot" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
