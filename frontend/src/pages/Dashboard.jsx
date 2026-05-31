import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { apiFetch } from "../api/client.js";
import { useAuth } from "../context/useAuth.js";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [secretMessage, setSecretMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProtectedData() {
      try {
        /**
         * Gọi protected API.
         * Nếu cookie hợp lệ, backend trả data.
         * Nếu không, backend trả 401.
         */
        const data = await apiFetch("/protected/secret");

        setSecretMessage(data.message);
      } catch (error) {
        setError(error.message);
      }
    }

    loadProtectedData();
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <section className="card">
      <h1>Dashboard</h1>

      <p>Đây là trang protected. Chỉ user đã login mới vào được.</p>

      <div className="user-box">
        <p>
          <strong>ID:</strong> {user.id}
        </p>

        <p>
          <strong>Name:</strong> {user.name}
        </p>

        <p>
          <strong>Email:</strong> {user.email}
        </p>

        <p>
          <strong>Role:</strong> {user.role || "user"}
        </p>
      </div>

      {secretMessage && <p className="success">{secretMessage}</p>}
      {error && <p className="error">{error}</p>}

      <button className="button danger" onClick={handleLogout}>
        Logout
      </button>
    </section>
  );
}
