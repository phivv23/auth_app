import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../context/useAuth.js";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  /**
   * Controlled form state.
   * Input nào thay đổi thì update state tương ứng.
   */
  const [form, setForm] = useState({
    name: "",
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
       * Gọi POST /api/auth/register.
       */
      await register(form);

      /**
       * Register thành công thì vào dashboard.
       */
      navigate("/dashboard");
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h1>Register</h1>

      <form onSubmit={handleSubmit} className="form">
        <label>
          Name
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Nguyen Van A"
          />
        </label>

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
            placeholder="Ít nhất 6 ký tự"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="button" disabled={submitting}>
          {submitting ? "Đang tạo tài khoản..." : "Register"}
        </button>
      </form>

      <p>
        Đã có tài khoản? <Link to="/login">Login</Link>
      </p>
    </section>
  );
}
