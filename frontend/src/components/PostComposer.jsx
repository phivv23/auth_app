import { useEffect, useRef, useState } from "react";

import { createPost } from "../api/post.api.js";
import { getFileUrl } from "../api/client.js";
import { useAuth } from "../context/useAuth.js";
import {
  createPostMediaPreviews,
  postMediaAccept,
  postMediaMaxFiles,
  validatePostMediaFiles,
} from "../utils/postMedia.js";

function formatFileSize(size) {
  if (!Number.isFinite(size)) {
    return "";
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function getMediaFilesFromItems(items) {
  return Array.from(items || []).reduce((mediaFiles, item) => {
    const file = item.kind === "file" ? item.getAsFile() : item;

    if (file?.type?.startsWith("image/") || file?.type?.startsWith("video/")) {
      mediaFiles.push(file);
    }

    return mediaFiles;
  }, []);
}

export default function PostComposer({
  onCreated,
  compact = false,
  placeholder = "Bạn đang nghĩ gì?",
}) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draggingMedia, setDraggingMedia] = useState(false);

  const avatarUrl = getFileUrl(user?.avatarUrl);
  const canSubmit =
    (content.trim().length > 0 || files.length > 0) && !submitting;
  const selectedMediaSize = files.reduce((total, file) => total + file.size, 0);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !submitting) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, submitting]);

  function clearFiles() {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setFiles([]);
    setPreviews([]);
    setDraggingMedia(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function applyMediaFiles(selectedFiles, { append = false } = {}) {
    const nextFiles = append ? [...files, ...selectedFiles] : selectedFiles;

    setError("");

    if (nextFiles.length === 0) {
      clearFiles();
      return false;
    }

    const validationError = validatePostMediaFiles(nextFiles);

    if (validationError) {
      setError(validationError);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return false;
    }

    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setFiles(nextFiles);
    setPreviews(createPostMediaPreviews(nextFiles));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    return true;
  }

  function handleMediaChange(event) {
    const selectedFiles = Array.from(event.target.files || []);

    applyMediaFiles(selectedFiles, {
      append: files.length > 0,
    });
  }

  function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();
    setDraggingMedia(true);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    setDraggingMedia(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setDraggingMedia(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setDraggingMedia(false);

    const droppedFiles = getMediaFilesFromItems(event.dataTransfer.files);

    if (droppedFiles.length === 0) {
      return;
    }

    applyMediaFiles(droppedFiles, {
      append: files.length > 0,
    });
  }

  function handlePaste(event) {
    const pastedFiles = getMediaFilesFromItems(event.clipboardData?.items);

    if (pastedFiles.length === 0) {
      return;
    }

    event.preventDefault();
    applyMediaFiles(pastedFiles, {
      append: files.length > 0,
    });
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
      setOpen(false);
      onCreated?.(data.post);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section
        className={`social-composer-trigger ${compact ? "compact" : ""}`.trim()}
      >
        {avatarUrl ? (
          <img className="composer-avatar" src={avatarUrl} alt={user?.name} />
        ) : (
          <div className="composer-avatar-placeholder">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
        )}

        <button
          className="social-composer-prompt"
          type="button"
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          {placeholder}
        </button>

        <div className="social-composer-quick-actions" aria-hidden="true">
          <span>Ảnh/Video</span>
          <span>Cảm xúc</span>
        </div>
      </section>

      {open && (
        <div
          className="post-composer-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setOpen(false);
            }
          }}
        >
          <form
            className={`post-composer-modal ${
              previews.length > 0 ? "has-media" : ""
            } ${draggingMedia ? "is-dragging-media" : ""}`.trim()}
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-composer-title"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onPaste={handlePaste}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="post-composer-modal-header">
              <h2 id="post-composer-title">Tạo bài viết</h2>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                ×
              </button>
            </header>

            <div className="post-composer-author">
              {avatarUrl ? (
                <img className="composer-avatar" src={avatarUrl} alt={user?.name} />
              ) : (
                <div className="composer-avatar-placeholder">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
              )}

              <div>
                <strong>{user?.name || "Tài khoản của bạn"}</strong>
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
              </div>
            </div>

            <textarea
              className="post-composer-modal-textarea"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={placeholder}
              rows={7}
              autoFocus
            />

            {previews.length === 0 && (
              <div className="post-composer-dropzone">
                <strong>Kéo ảnh/video vào đây</strong>
                <span>
                  Hoặc dán từ clipboard, tối đa {postMediaMaxFiles} file.
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                >
                  Chọn từ máy
                </button>
              </div>
            )}

            {previews.length > 0 && (
              <div className="composer-media-grid post-composer-modal-media">
                {previews.map((preview) =>
                  preview.type === "video" ? (
                    <video
                      key={preview.url}
                      src={preview.url}
                      controls
                      playsInline
                    />
                  ) : (
                    <img key={preview.url} src={preview.url} alt={preview.name} />
                  )
                )}
              </div>
            )}

            {files.length > 0 && (
              <div className="post-composer-media-summary">
                <div>
                  <strong>
                    {files.length}/{postMediaMaxFiles} media đã chọn
                  </strong>
                  <span>{formatFileSize(selectedMediaSize)}</span>
                </div>

                <ul>
                  {files.slice(0, 3).map((file) => (
                    <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                      {file.name}
                    </li>
                  ))}
                  {files.length > 3 && <li>+{files.length - 3} file khác</li>}
                </ul>

                <button type="button" onClick={clearFiles} disabled={submitting}>
                  Xóa media
                </button>
              </div>
            )}

            {error && <p className="error">{error}</p>}

            <div className="post-composer-addons">
              <strong>Thêm vào bài viết của bạn</strong>

              <label className="post-composer-icon-button image">
                Ảnh/Video
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={postMediaAccept}
                  multiple
                  onChange={handleMediaChange}
                />
              </label>

              <button type="button" className="post-composer-icon-button" disabled>
                Cảm xúc
              </button>

              <button type="button" className="post-composer-icon-button" disabled>
                Vị trí
              </button>
            </div>

            <button
              className="button post-composer-submit"
              type="submit"
              disabled={!canSubmit}
            >
              {submitting ? "Đang đăng..." : "Đăng"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
