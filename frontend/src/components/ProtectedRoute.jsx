import { Navigate, Outlet } from "react-router";
import { useAuth } from "../context/useAuth.js";

/**
 * ProtectedRoute chỉ bảo vệ UI.
 *
 * Bảo mật thật vẫn là requireAuth ở backend.
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Đang kiểm tra đăng nhập...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
