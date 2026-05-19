import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { getPostById, updatePost } from "../api/post.api.js";
import { useAuth } from "../context/useAuth.js";

export default function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const postId = Number(id);

  const [form, setForm] = useState({
    title: "",
    content: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadPost() {
      try {
        setLoading(true);
        setError("");

        const data = await getPostById(postId);

        const post = data.post;

        /**
         * Frontend cũng kiểm tra quyền để UX tốt hơn.
         * Backend vẫn là nơi kiểm tra quyền thật.
         */
        if (!user || user.id !== post.userId) {
          setError("Bạn không có quyền sửa bài viết này.");
          return;
        }

        setForm({
          title: post.title,
          content: post.content,
        });
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [postId, user]);

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
      const data = await updatePost(postId, form);

      navigate(`/posts/${data.post.id}`);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p>Đang tải bài viết...</p>;
  }

  return (
    <section className="card">
      <h1>Sửa bài viết</h1>

      {error && <p className="error">{error}</p>}

      {!error && (
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

          <button className="button" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </form>
      )}
    </section>
  );
}
