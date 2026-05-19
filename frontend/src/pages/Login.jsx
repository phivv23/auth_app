import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../context/useAuth.js";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      /**
       * Gọi POST /api/auth/login.
       */
      await login(form);

      navigate("/dashboard");
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h1>Login</h1>

      <form onSubmit={handleSubmit} className="form">
        <label>
          Email
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="a@example.com"
          />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Password"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="button" disabled={submitting}>
          {submitting ? "Đang login..." : "Login"}
        </button>
      </form>

      <p>
        Chưa có tài khoản? <Link to="/register">Register</Link>
      </p>
    </section>
  );
}
