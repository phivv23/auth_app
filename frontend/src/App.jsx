import { Link, Navigate, Route, Routes, useNavigate } from "react-router";
import GuestRoute from "./components/GuestRoute.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./context/useAuth.js";
import Dashboard from "./pages/Dashboard.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";
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

function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        <span className="brand-mark">f</span>
        <span>Auth App</span>
      </Link>

      <div className="nav-links">
        {user ? (
          <>
            <Link className="nav-icon-link" to="/posts" title="Blog" aria-label="Blog">
              <span aria-hidden="true">📰</span>
            </Link>
            <Link className="nav-icon-link" to="/feed" title="Feed" aria-label="Feed">
              <span aria-hidden="true">🏠</span>
            </Link>
            <Link className="nav-icon-link" to="/friends" title="Friends" aria-label="Friends">
              <span aria-hidden="true">👥</span>
            </Link>
            <MessageDropdown />
            <NotificationBell />
            <Link className="nav-icon-link" to="/my-posts" title="My Posts" aria-label="My Posts">
              <span aria-hidden="true">🗂️</span>
            </Link>
            <Link className="nav-icon-link" to="/dashboard" title="Dashboard" aria-label="Dashboard">
              <span aria-hidden="true">📊</span>
            </Link>
            <Link className="nav-icon-link" to="/profile" title="Profile" aria-label="Profile">
              <span aria-hidden="true">👤</span>
            </Link>

            <button className="nav-icon-button" title="Logout" aria-label="Logout" onClick={handleLogout}>
              <span aria-hidden="true">↩</span>
            </button>
          </>
        ) : (
          <>
            <Link className="nav-icon-link" to="/posts">Blog</Link>
            <Link className="nav-icon-link" to="/register">Register</Link>
            <Link className="nav-icon-link" to="/login">Login</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <>
      <Navbar />

      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/posts" element={<PostList />} />
          <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
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
          <Route path="/users/:id/followers" element={<FollowList type="followers" />} />
          <Route path="/users/:id/following" element={<FollowList type="following" />} />

          <Route element={<GuestRoute />}>
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/my-posts" element={<MyPosts />} />
            <Route path="/posts/create" element={<CreatePost />} />
            <Route path="/posts/:id/edit" element={<EditPost />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <MessagePopups />
    </>
  );
}
