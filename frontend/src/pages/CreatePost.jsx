import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { createPost } from "../api/post.api.js";
import { getFileUrl } from "../api/client.js";
import { useAuth } from "../context/useAuth.js";

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

export default function CreatePost() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const avatarUrl = getFileUrl(user?.avatarUrl);
  const canSubmit =
    (content.trim().length > 0 || images.length > 0) && !submitting;

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  function resetSelectedImages() {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setImages([]);
    setPreviews([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleImageChange(event) {
    const selectedFiles = Array.from(event.target.files || []);

    setError("");

    if (selectedFiles.length === 0) {
      resetSelectedImages();
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) =>
        !allowedImageTypes.includes(file.type) || file.size > 5 * 1024 * 1024
    );

    if (selectedFiles.length > 10 || invalidFile) {
      setError("Chỉ được chọn tối đa 10 ảnh JPG, PNG hoặc WEBP, mỗi ảnh tối đa 5MB.");
      resetSelectedImages();
      return;
    }

    resetSelectedImages();
    setImages(selectedFiles);
    setPreviews(
      selectedFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      }))
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const formData = new FormData();

      formData.append("title", title);
      formData.append("content", content);
      formData.append("privacy", privacy);

      images.forEach((image) => {
        formData.append("media", image);
      });

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
          placeholder="Tiêu đề bài viết (không bắt buộc)"
        />

        <textarea
          className="composer-textarea"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Bạn đang nghĩ gì?"
          rows={8}
        />

        {previews.length > 0 && (
          <div className="composer-media-grid">
            {previews.map((preview) => (
              <img key={preview.url} src={preview.url} alt={preview.name} />
            ))}
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <footer className="composer-footer">
          <select
            value={privacy}
            onChange={(event) => setPrivacy(event.target.value)}
            aria-label="Quyền xem bài viết"
          >
            <option value="public">Công khai</option>
            <option value="followers">Người theo dõi</option>
            <option value="friends">Bạn bè</option>
            <option value="only_me">Chỉ mình tôi</option>
          </select>

          <label className="composer-file-button">
            Ảnh
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageChange}
            />
          </label>

          {images.length > 0 && (
            <button type="button" className="link-button" onClick={resetSelectedImages}>
              Xóa ảnh
            </button>
          )}

          <button className="button" type="submit" disabled={!canSubmit}>
            {submitting ? "Đang đăng..." : "Đăng bài"}
          </button>
        </footer>
      </form>
    </section>
  );
}
