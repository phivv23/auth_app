import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { getFileUrl } from "../api/client.js";
import { createPost } from "../api/post.api.js";
import { useAuth } from "../context/useAuth.js";

export default function CreatePost() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const avatarUrl = getFileUrl(user?.avatarUrl);
  const canSubmit =
    title.trim().length >= 3 && content.trim().length >= 10 && !submitting;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function resetSelectedImage() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setImage(null);
    setPreviewUrl("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleImageChange(event) {
    const selectedFile = event.target.files?.[0];

    setError("");

    if (!selectedFile) {
      resetSelectedImage();
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Chỉ được chọn ảnh JPG, PNG hoặc WEBP");
      resetSelectedImage();
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Ảnh bài viết tối đa 5MB");
      resetSelectedImage();
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setImage(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      const formData = new FormData();

      formData.append("title", title);
      formData.append("content", content);

      if (image) {
        formData.append("image", image);
      }

      const data = await createPost(formData);

      navigate(`/posts/${data.post.id}`);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="create-post-shell">
      <form className="composer-card" onSubmit={handleSubmit}>
        <header className="composer-header">
          {avatarUrl ? (
            <img className="composer-avatar" src={avatarUrl} alt={user?.name} />
          ) : (
            <div className="composer-avatar-placeholder">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}

          <div>
            <h1>Tạo bài viết</h1>
            <p>{user?.name || "Tài khoản của bạn"}</p>
          </div>
        </header>

        <input
          className="composer-title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Tiêu đề bài viết"
        />

        <textarea
          className="composer-textarea"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Bạn đang nghĩ gì?"
          rows={8}
        />

        {previewUrl && (
          <div className="composer-preview">
            <img src={previewUrl} alt="Preview" />
            <button type="button" onClick={resetSelectedImage}>
              Xóa ảnh
            </button>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <footer className="composer-footer">
          <label className="composer-file-button">
            Ảnh
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
            />
          </label>

          <button className="button" type="submit" disabled={!canSubmit}>
            {submitting ? "Đang đăng..." : "Đăng bài"}
          </button>
        </footer>
      </form>
    </section>
  );
}
