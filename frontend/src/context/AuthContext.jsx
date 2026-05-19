import { useEffect, useState } from "react";
import { apiFetch } from "../api/client.js";
import { AuthContext } from "./authContext.js";

/**
 * Context giúp toàn app biết:
 * - user hiện tại là ai
 * - đang loading auth không
 * - login/register/logout thế nào
 */
export function AuthProvider({ children }) {
  /**
   * user = null nghĩa là chưa login.
   */
  const [user, setUser] = useState(null);

  /**
   * loading = true khi app đang gọi /auth/me lúc mới mở.
   */
  const [loading, setLoading] = useState(true);
  async function uploadAvatar(file) {
  const formData = new FormData();

  formData.append("avatar", file);

  const data = await apiFetch("/users/me/avatar", {
    method: "PATCH",
    body: formData,
  });

  setUser(data.user);

  return data.user;
}
  async function loadCurrentUser() {
    try {
      /**
       * Backend sẽ đọc cookie auth_token.
       * Frontend không cần gửi token thủ công.
       */
      const data = await apiFetch("/auth/me");

      setUser(data.user);
    } catch {
      /**
       * Nếu chưa login hoặc token hết hạn, backend trả 401.
       */
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    apiFetch("/auth/me")
      .then((data) => {
        if (isActive) {
          setUser(data.user);
        }
      })
      .catch(() => {
        if (isActive) {
          setUser(null);
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function register(formData) {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(formData),
    });

    /**
     * Backend đã set cookie.
     * Frontend chỉ lưu user để render UI.
     */
    setUser(data.user);

    return data.user;
  }

  async function login(formData) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify(formData),
    });

    setUser(data.user);

    return data.user;
  }

  async function logout() {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
      });
    } finally {
      /**
       * Dù API logout lỗi, frontend vẫn xóa user state.
       */
      setUser(null);
    }
  }
  async function updateProfile(formData) {
  const data = await apiFetch("/users/me", {
    method: "PATCH",
    body: JSON.stringify(formData),
  });

  /**
   * Backend trả user mới sau khi update.
   * Frontend cần cập nhật lại user state để Navbar/Dashboard/Profile hiển thị đúng.
   */
  setUser(data.user);

  return data.user;
}

async function changePassword(formData) {
  const data = await apiFetch("/users/me/password", {
    method: "PATCH",
    body: JSON.stringify(formData),
  });

  /**
   * Đổi password không làm thay đổi user object.
   * Vì vậy không cần setUser().
   */
  return data;
}

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        register,
        login,
        logout,
        updateProfile,
        changePassword,
        reloadUser: loadCurrentUser,
        uploadAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
