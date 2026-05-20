import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { getPostById, updatePost } from "../api/post.api.js";
import { useAuth } from "../context/useAuth.js";
import { getFileUrl } from "../api/client.js";

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
  const [post, setPost] = useState(null);
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

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
        setPost(post);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [postId, user]);

  function handleImageChange(event) {
    const selectedFile = event.target.files?.[0];

    setError("");

    if (!selectedFile) {
      setImage(null);
      setPreviewUrl("");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Chỉ được chọn ảnh JPG, PNG hoặc WEBP");
      setImage(null);
      setPreviewUrl("");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Ảnh bài viết tối đa 5MB");
      setImage(null);
      setPreviewUrl("");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setImage(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  }

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
      const formData = new FormData();

      formData.append("title", form.title);
      formData.append("content", form.content);

      if (image) {
        formData.append("image", image);
      }

      const data = await updatePost(postId, formData);

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
          <div className="form-group">
            <label>Ảnh bài viết</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
            />
          </div>

          {previewUrl ? (
            <img className="post-image-preview" src={previewUrl} alt="Preview" />
          ) : post?.imageUrl ? (
            <img
              className="post-image-preview"
              src={getFileUrl(post.imageUrl)}
              alt={post.title}
            />
          ) : null}

          <button className="button" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </form>
      )}
    </section>
  );
}
