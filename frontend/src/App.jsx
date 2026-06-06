import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import GuestRoute from "./components/GuestRoute.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./context/useAuth.js";
import Dashboard from "./pages/Dashboard.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";
import Settings from "./pages/Settings.jsx";
import Register from "./pages/Register.jsx";
import PostList from "./pages/PostList.jsx";
import PostDetail from "./pages/PostDetail.jsx";
import CreatePost from "./pages/CreatePost.jsx";
import EditPost from "./pages/EditPost.jsx";
import MyPosts from "./pages/MyPosts.jsx";
import UserProfile from "./pages/UserProfile";
import Feed from "./pages/Feed.jsx";
import Watch from "./pages/Watch.jsx";
import FollowList from "./pages/FollowList.jsx";
import Notifications from "./pages/Notifications.jsx";
import NotificationBell from "./components/NotificationBell.jsx";
import MessagePopups from "./components/MessagePopups.jsx";
import MessageDropdown from "./components/MessageDropdown.jsx";
import { openMessagePopup } from "./utils/messagePopup.js";
import UserSearch from "./pages/UserSearch.jsx";
import Friends from "./pages/Friends.jsx";
import Messages from "./pages/Messages.jsx";
import SavedPosts from "./pages/SavedPosts.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import AdminUserDetail from "./pages/AdminUserDetail.jsx";
import AdminContent from "./pages/AdminContent.jsx";
import AdminAuditLogs from "./pages/AdminAuditLogs.jsx";
import AdminReports from "./pages/AdminReports.jsx";
import MyReports from "./pages/MyReports.jsx";
import StoryViewer from "./pages/StoryViewer.jsx";
import SharedMoments from "./pages/SharedMoments.jsx";
import { getFileUrl } from "./api/client.js";
import { getConversations } from "./api/message.api.js";
import { canAccessReports, canManageAdminArea } from "./utils/adminPermissions.js";
import { useRealtime } from "./context/useRealtime.js";
import { formatRelativeTime } from "./utils/time.js";

const CONTACT_REFRESH_INTERVAL_MS = 60000;

const developingItems = [
  { icon: "✺", label: "Meta AI" },
  { icon: "◴", label: "Kỷ niệm" },
  { icon: "◎", label: "Nhóm" },
  { icon: "▻", label: "Thước phim" },
  { icon: "⌄", label: "Xem thêm" },
];

function Navbar({ onDeveloping }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { connectionStatus } = useRealtime();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const realtimeStatusText = {
    closed: "Mất kết nối realtime",
    connecting: "Đang kết nối...",
    reconnecting: "Đang nối lại...",
  }[connectionStatus];

  async function handleLogout() {
    await logout();
    setProfileMenuOpen(false);
    navigate("/login");
  }

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    function handlePointerDown(event) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [profileMenuOpen]);

  return (
    <nav className="navbar">
      <div className="nav-left">
        <Link to="/" className="brand" aria-label="Home">
          <span className="brand-mark">f</span>
          <span>Phivv</span>
        </Link>

        <Link className="nav-search" to="/users/search">
          Tìm kiếm trên Phivv
        </Link>
      </div>

      <div className="nav-links">
        {user ? (
          <>
            <Link className="nav-icon-link" to="/feed" title="Feed" aria-label="Feed">
              <span aria-hidden="true">⌂</span>
            </Link>
            <Link className="nav-icon-link" to="/watch" title="Watch" aria-label="Watch">
              <span aria-hidden="true">▻</span>
            </Link>
            <Link className="nav-icon-link" to="/friends" title="Friends" aria-label="Friends">
              <span aria-hidden="true">👥</span>
            </Link>
            <Link className="nav-icon-link" to="/moments" title="Khoảnh khắc" aria-label="Khoảnh khắc">
              <span aria-hidden="true">✦</span>
            </Link>
            <button
              className="nav-icon-button disabled-feature"
              title="Groups"
              aria-label="Groups"
              onClick={() => onDeveloping?.("Groups")}
            >
              <span aria-hidden="true">◎</span>
            </button>
            <MessageDropdown />
            <NotificationBell />
            {realtimeStatusText && (
              <span
                className={`realtime-status-badge ${connectionStatus}`}
                role="status"
                aria-live="polite"
              >
                {realtimeStatusText}
              </span>
            )}

            <div className="profile-menu-wrapper" ref={profileMenuRef}>
              <button
                className="nav-icon-button"
                title="Account"
                aria-label="Account"
                onClick={() =>
                  setProfileMenuOpen((currentOpen) => !currentOpen)
                }
              >
                <span aria-hidden="true">●</span>
              </button>

              {profileMenuOpen && (
                <section className="profile-menu">
                  <div className="profile-menu-header">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>

                  <Link to="/profile" onClick={() => setProfileMenuOpen(false)}>
                    Profile
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <Link
                    to="/saved"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Saved
                  </Link>
                  <Link
                    to="/my-posts"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    My Posts
                  </Link>
                  <Link
                    to="/reports"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Reports
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  {canAccessReports(user) && (
                    <Link
                      to={canManageAdminArea(user) ? "/admin" : "/admin/reports"}
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      Admin Center
                    </Link>
                  )}
                  <button type="button" onClick={handleLogout}>
                    Logout
                  </button>
                </section>
              )}
            </div>
          </>
        ) : (
          <>
            <Link className="nav-text-link" to="/register">
              Register
            </Link>
            <Link className="nav-text-link" to="/login">
              Login
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

function SocialLeftSidebar({ user, onDeveloping }) {
  return (
    <aside className="social-sidebar left">
      <Link className="social-sidebar-item" to="/profile">
        <span className="sidebar-avatar">
          {user?.name?.charAt(0)?.toUpperCase() || "U"}
        </span>
        <strong>{user?.name || "Profile"}</strong>
      </Link>

      <Link className="social-sidebar-item" to="/friends">
        <span>👥</span>
        <strong>Bạn bè</strong>
      </Link>

      <Link className="social-sidebar-item" to="/saved">
        <span>▰</span>
        <strong>Đã lưu</strong>
      </Link>

      <Link className="social-sidebar-item" to="/watch">
        <span>W</span>
        <strong>Watch</strong>
      </Link>

      <Link className="social-sidebar-item" to="/moments">
        <span>✦</span>
        <strong>Khoảnh khắc</strong>
      </Link>

      {developingItems.map((item) => (
        <button
          key={item.label}
          type="button"
          className="social-sidebar-item"
          onClick={() => onDeveloping(item.label)}
        >
          <span>{item.icon}</span>
          <strong>{item.label}</strong>
        </button>
      ))}
    </aside>
  );
}

function getSidebarContactStatus(conversation) {
  if (conversation.otherUser?.isOnline) {
    return "Đang hoạt động";
  }

  if (conversation.lastMessage?.deletedAt) {
    return "Tin nhắn đã được thu hồi";
  }

  if (conversation.lastMessage?.content?.trim()) {
    return conversation.lastMessage.content;
  }

  const mediaLabels = {
    gif: "Đã gửi GIF",
    image: "Đã gửi ảnh",
    video: "Đã gửi video",
    file: "Đã gửi tệp tin",
  };

  if (conversation.lastMessage?.mediaType) {
    return mediaLabels[conversation.lastMessage.mediaType] || "Đã gửi file";
  }

  if (conversation.otherUser?.lastSeenAt) {
    return `Hoạt động ${formatRelativeTime(conversation.otherUser.lastSeenAt)}`;
  }

  return "Mở Messenger";
}

function SocialRightSidebar({ user, onDeveloping }) {
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactError, setContactError] = useState("");
  const contactsRequestRef = useRef(null);
  const userId = user?.id || null;

  const loadContacts = useCallback(
    async function loadContacts({ quiet = false } = {}) {
      if (!userId) {
        contactsRequestRef.current?.abort();
        setContacts([]);
        setLoadingContacts(false);
        return;
      }

      contactsRequestRef.current?.abort();
      const controller = new AbortController();
      contactsRequestRef.current = controller;

      try {
        if (!quiet) {
          setLoadingContacts(true);
        }

        setContactError("");
        const data = await getConversations({
          page: 1,
          limit: 12,
          signal: controller.signal,
          timeoutMs: 8000,
        });

        if (contactsRequestRef.current === controller) {
          setContacts(data.conversations || []);
        }
      } catch (error) {
        if (
          contactsRequestRef.current === controller &&
          error.name !== "AbortError"
        ) {
          setContactError(error.message);
        }
      } finally {
        const isLatestRequest = contactsRequestRef.current === controller;

        if (isLatestRequest) {
          contactsRequestRef.current = null;
        }

        if (isLatestRequest) {
          setLoadingContacts(false);
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadContacts();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      contactsRequestRef.current?.abort();
    };
  }, [loadContacts]);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadContacts({ quiet: true }).catch(() => {});
    }, CONTACT_REFRESH_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadContacts({ quiet: true }).catch(() => {});
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadContacts, userId]);

  return (
    <aside className="social-sidebar right">
      <section className="right-panel">
        <h2>Sinh nhật</h2>
        <button type="button" onClick={() => onDeveloping("Sinh nhật")}>
          <span>🎁</span>
          <strong>Chưa có sinh nhật nào hôm nay.</strong>
        </button>
      </section>

      <section className="right-panel">
        <div className="right-panel-header">
          <h2>Người liên hệ</h2>
          <button
            type="button"
            onClick={() => loadContacts()}
            aria-label="Làm mới người liên hệ"
          >
            ↻
          </button>
        </div>

        {loadingContacts ? (
          <p className="right-panel-empty">Đang tải người liên hệ...</p>
        ) : contactError ? (
          <button type="button" onClick={() => loadContacts()}>
            Không tải được danh bạ. Thử lại
          </button>
        ) : contacts.length === 0 ? (
          <p className="right-panel-empty">Chưa có cuộc trò chuyện gần đây.</p>
        ) : (
          contacts.map((conversation) => {
            const otherUser = conversation.otherUser || {};
            const avatarUrl = getFileUrl(otherUser.avatarUrl);

            return (
              <button
                key={conversation.id}
                type="button"
                className="contact-row"
                onClick={() => openMessagePopup(otherUser.id)}
              >
                <span className="contact-avatar-wrap">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={otherUser.name || ""} />
                  ) : (
                    <span className="contact-avatar-placeholder">
                      {otherUser.name?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  )}
                  <span
                    className={
                      otherUser.isOnline
                        ? "contact-presence online"
                        : "contact-presence"
                    }
                    aria-hidden="true"
                  />
                </span>
                <div className="contact-row-content">
                  <strong>{otherUser.name || "Người dùng"}</strong>
                  <small>{getSidebarContactStatus(conversation)}</small>
                </div>
              </button>
            );
          })
        )}
      </section>
    </aside>
  );
}

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  const [developingNotice, setDevelopingNotice] = useState("");
  const developingTimeoutRef = useRef(null);
  const isStoryRoute = location.pathname.startsWith("/stories");
  const isMessagesRoute = location.pathname.startsWith("/messages");
  const showSocialShell =
    Boolean(user) &&
    !isStoryRoute &&
    !isMessagesRoute &&
    ["/", "/feed", "/saved", "/watch", "/moments"].includes(location.pathname);
  const mainClassName = isStoryRoute
    ? "story-main"
    : isMessagesRoute
      ? "messages-main"
    : showSocialShell
      ? "social-main"
      : "container";

  function showDevelopingNotice(featureName) {
    setDevelopingNotice(`${featureName} đang phát triển.`);
    window.clearTimeout(developingTimeoutRef.current);
    developingTimeoutRef.current = window.setTimeout(() => {
      setDevelopingNotice("");
    }, 2200);
  }

  return (
    <>
      {!isStoryRoute && <Navbar onDeveloping={showDevelopingNotice} />}

      <div className={showSocialShell ? "social-shell" : ""}>
        {showSocialShell && (
          <SocialLeftSidebar user={user} onDeveloping={showDevelopingNotice} />
        )}

        <main className={mainClassName}>
          <Routes>
            <Route path="/" element={user ? <Navigate to="/feed" replace /> : <Home />} />

            <Route path="/posts" element={<PostList />} />
            <Route
              path="/feed"
              element={
                <ProtectedRoute>
                  <Feed onDeveloping={showDevelopingNotice} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/watch"
              element={
                <ProtectedRoute>
                  <Watch />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/moments"
              element={
                <ProtectedRoute>
                  <SharedMoments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/friends"
              element={
                <ProtectedRoute>
                  <Friends />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route path="/posts/:id" element={<PostDetail />} />

            <Route path="/users/search" element={<UserSearch />} />
            <Route path="/users/:id" element={<UserProfile />} />
            <Route
              path="/users/:id/followers"
              element={<FollowList type="followers" />}
            />
            <Route
              path="/users/:id/following"
              element={<FollowList type="following" />}
            />

            <Route element={<GuestRoute />}>
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/saved" element={<SavedPosts />} />
              <Route path="/my-posts" element={<MyPosts />} />
              <Route path="/reports" element={<MyReports />} />
              <Route path="/posts/create" element={<CreatePost />} />
              <Route path="/posts/:id/edit" element={<EditPost />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:id" element={<AdminUserDetail />} />
              <Route path="/admin/content" element={<AdminContent />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/stories" element={<StoryViewer />} />
              <Route path="/stories/:storyId" element={<StoryViewer />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {showSocialShell && (
          <SocialRightSidebar user={user} onDeveloping={showDevelopingNotice} />
        )}
      </div>

      {developingNotice && (
        <div className="developing-toast" role="status">
          {developingNotice}
        </div>
      )}

      {!isStoryRoute && !isMessagesRoute && <MessagePopups />}
    </>
  );
}
