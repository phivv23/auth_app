import { useEffect, useRef, useState } from "react";
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
import FollowList from "./pages/FollowList.jsx";
import Notifications from "./pages/Notifications.jsx";
import NotificationBell from "./components/NotificationBell.jsx";
import MessagePopups from "./components/MessagePopups.jsx";
import MessageDropdown from "./components/MessageDropdown.jsx";
import UserSearch from "./pages/UserSearch.jsx";
import Friends from "./pages/Friends.jsx";
import Messages from "./pages/Messages.jsx";
import SavedPosts from "./pages/SavedPosts.jsx";
import AdminReports from "./pages/AdminReports.jsx";
import MyReports from "./pages/MyReports.jsx";

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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

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
            <button
              className="nav-icon-button disabled-feature"
              title="Video"
              aria-label="Video"
              onClick={() => onDeveloping?.("Video")}
            >
              <span aria-hidden="true">▻</span>
            </button>
            <Link className="nav-icon-link" to="/friends" title="Friends" aria-label="Friends">
              <span aria-hidden="true">👥</span>
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
                  {user.role === "admin" && (
                    <Link
                      to="/admin/reports"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      Moderation
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

function SocialRightSidebar({ onDeveloping }) {
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
          <button type="button" onClick={() => onDeveloping("Gọi video")}>
            ◦◦◦
          </button>
        </div>

        <p className="right-panel-empty">Danh bạ realtime đang phát triển.</p>
      </section>
    </aside>
  );
}

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  const [developingNotice, setDevelopingNotice] = useState("");
  const developingTimeoutRef = useRef(null);
  const showSocialShell =
    Boolean(user) && ["/", "/feed", "/saved"].includes(location.pathname);

  function showDevelopingNotice(featureName) {
    setDevelopingNotice(`${featureName} đang phát triển.`);
    window.clearTimeout(developingTimeoutRef.current);
    developingTimeoutRef.current = window.setTimeout(() => {
      setDevelopingNotice("");
    }, 2200);
  }

  return (
    <>
      <Navbar onDeveloping={showDevelopingNotice} />

      <div className={showSocialShell ? "social-shell" : ""}>
        {showSocialShell && (
          <SocialLeftSidebar user={user} onDeveloping={showDevelopingNotice} />
        )}

        <main className={showSocialShell ? "social-main" : "container"}>
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
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
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
              <Route path="/admin/reports" element={<AdminReports />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {showSocialShell && (
          <SocialRightSidebar onDeveloping={showDevelopingNotice} />
        )}
      </div>

      {developingNotice && (
        <div className="developing-toast" role="status">
          {developingNotice}
        </div>
      )}

      <MessagePopups />
    </>
  );
}
