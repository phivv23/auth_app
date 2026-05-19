import { useState } from "react";
import { useNavigate } from "react-router";
import { createPost } from "../api/post.api.js";

export default function CreatePost() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    content: "",
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
      const data = await createPost(form);

      navigate(`/posts/${data.post.id}`);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h1>Tạo bài viết</h1>

      <form onSubmit={handleSubmit} className="form">
        <label>
          Title
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Nhập tiêu đề"
          />
        </label>

        <label>
          Content
          <textarea
            name="content"
            value={form.content}
            onChange={handleChange}
            placeholder="Nhập nội dung"
            rows={10}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="button" disabled={submitting}>
          {submitting ? "Đang tạo..." : "Tạo bài viết"}
        </button>
      </form>
    </section>
  );
}