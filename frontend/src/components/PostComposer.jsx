import { useEffect, useRef, useState } from "react";

import { createPost } from "../api/post.api.js";
import { getFileUrl } from "../api/client.js";
import { useAuth } from "../context/useAuth.js";

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

export default function PostComposer({
  onCreated,
  compact = false,
  placeholder = "Bạn đang nghĩ gì?",
}) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const avatarUrl = getFileUrl(user?.avatarUrl);
  const canSubmit =
    (content.trim().length > 0 || files.length > 0) && !submitting;

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  function clearFiles() {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setFiles([]);
    setPreviews([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleMediaChange(event) {
    const selectedFiles = Array.from(event.target.files || []);

    setError("");

    if (selectedFiles.length === 0) {
      clearFiles();
      return;
    }

    if (selectedFiles.length > 10) {
      setError("Chỉ được chọn tối đa 10 ảnh.");
      clearFiles();
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) =>
        !allowedImageTypes.includes(file.type) || file.size > 5 * 1024 * 1024
    );

    if (invalidFile) {
      setError("Mỗi ảnh phải là JPG, PNG hoặc WEBP và tối đa 5MB.");
      clearFiles();
      return;
    }

    clearFiles();
    setFiles(selectedFiles);
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
      formData.append("content", content);
      formData.append("privacy", privacy);

      files.forEach((file) => {
        formData.append("media", file);
      });

      const data = await createPost(formData);

      setContent("");
      clearFiles();
      setPrivacy("public");
      onCreated?.(data.post);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className={`social-composer ${compact ? "compact" : ""}`.trim()}
      onSubmit={handleSubmit}
    >
      <div className="social-composer-main">
        {avatarUrl ? (
          <img className="composer-avatar" src={avatarUrl} alt={user?.name} />
        ) : (
          <div className="composer-avatar-placeholder">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
        )}

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={placeholder}
          rows={compact ? 3 : 4}
        />
      </div>

      {previews.length > 0 && (
        <div className="composer-media-grid">
          {previews.map((preview) => (
            <img key={preview.url} src={preview.url} alt={preview.name} />
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <footer className="social-composer-footer">
        <select
          value={privacy}
          onChange={(event) => setPrivacy(event.target.value)}
          aria-label="Quyền xem bài viết"
        >
          <option value="public">Công khai</option>
          <option value="followers">Người theo dõi</option>
          <option value="only_me">Chỉ mình tôi</option>
        </select>

        <label className="composer-file-button">
          Ảnh
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleMediaChange}
          />
        </label>

        {files.length > 0 && (
          <button type="button" className="link-button" onClick={clearFiles}>
            Xóa ảnh
          </button>
        )}

        <button className="button" type="submit" disabled={!canSubmit}>
          {submitting ? "Đang đăng..." : "Đăng"}
        </button>
      </footer>
    </form>
  );
}
