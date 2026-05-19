import { Navigate, Outlet } from "react-router";
import { useAuth } from "../context/useAuth.js";

/**
 * GuestRoute dùng cho các trang chỉ dành cho người chưa login.
 *
 * Ví dụ:
 * - /login
 * - /register
 *
 * Nếu user đã login rồi mà vẫn vào /login,
 * ta redirect họ về /dashboard.
 */
export default function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Đang kiểm tra đăng nhập...</p>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
