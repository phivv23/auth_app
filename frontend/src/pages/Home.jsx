import { Link } from "react-router";
import { useAuth } from "../context/useAuth.js";

export default function Home() {
  const { user } = useAuth();

  return (
    <section className="card">
      <h1>Auth App</h1>

      <p>App luyện Register, Login, Logout, Current User và Protected Route.</p>

      {user ? (
        <>
          <p>
            Bạn đang đăng nhập với email: <strong>{user.email}</strong>
          </p>

          <Link className="button" to="/dashboard">
            Vào Dashboard
          </Link>
        </>
      ) : (
        <div className="actions">
          <Link className="button" to="/register">
            Register
          </Link>

          <Link className="button secondary" to="/login">
            Login
          </Link>
        </div>
      )}
    </section>
  );
}
