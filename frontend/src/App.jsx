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
        Auth App
      </Link>

      <div className="nav-links">
        {user ? (
          <>
            <Link to="/posts">Blog</Link>
            <Link to="/feed">Feed</Link>
            <Link to="/my-posts">My Posts</Link>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/profile">Profile</Link>

            <button className="link-button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/posts">Blog</Link>
            <Link to="/register">Register</Link>
            <Link to="/login">Login</Link>
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
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <Feed />
              </ProtectedRoute>
            }
          />
          <Route path="/posts/:id" element={<PostDetail />} />

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
    </>
  );
}
