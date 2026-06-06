import { useCallback, useEffect, useRef, useState } from "react";

import { createPost } from "../api/post.api.js";
import { getFileUrl } from "../api/client.js";
import { useAuth } from "../context/useAuth.js";
import {
  createPostMediaPreviews,
  getPostMediaFileErrors,
  postMediaAccept,
  postMediaMaxFiles,
} from "../utils/postMedia.js";

const draftStoragePrefix = "phivv:post-composer-draft:";

function getDraftStorageKey(userId) {
  return userId ? `${draftStoragePrefix}${userId}` : "";
}

function readPostDraft(storageKey) {
  if (!storageKey || typeof window === "undefined") {
    return null;
  }

  try {
    const rawDraft = window.localStorage.getItem(storageKey);
    return rawDraft ? JSON.parse(rawDraft) : null;
  } catch {
    return null;
  }
}

function writePostDraft(storageKey, draft) {
  if (!storageKey || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // localStorage can be full or unavailable in private mode.
  }
}

function removePostDraft(storageKey) {
  if (!storageKey || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // localStorage can be unavailable in private mode.
  }
}

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
  const [fileErrors, setFileErrors] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draggingMedia, setDraggingMedia] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  const avatarUrl = getFileUrl(user?.avatarUrl);
  const draftStorageKey = getDraftStorageKey(user?.id);
  const hasMedia = previews.length > 0;
  const selectedMediaSize = files.reduce((total, file) => total + file.size, 0);
  const canSubmit =
    (content.trim().length > 0 || files.length > 0) && !submitting;

  const persistCurrentDraft = useCallback(() => {
    if (!draftStorageKey) {
      return;
    }

    const hasDraftContent = content.trim().length > 0 || privacy !== "public";

    if (!hasDraftContent) {
      removePostDraft(draftStorageKey);
      setDraftSavedAt(null);
      return;
    }

    const updatedAt = new Date().toISOString();
    writePostDraft(draftStorageKey, {
      content,
      privacy,
      updatedAt,
    });
    setDraftSavedAt(updatedAt);
  }, [content, draftStorageKey, privacy]);

  const closeComposer = useCallback(() => {
    if (!submitting) {
      persistCurrentDraft();
      setOpen(false);
    }
  }, [persistCurrentDraft, submitting]);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  useEffect(() => {
    if (!open || !draftStorageKey || submitting) {
      return undefined;
    }

    const hasDraftContent = content.trim().length > 0 || privacy !== "public";

    if (!hasDraftContent) {
      removePostDraft(draftStorageKey);
      return undefined;
    }

    const saveDraftTimeout = window.setTimeout(() => {
      const updatedAt = new Date().toISOString();
      writePostDraft(draftStorageKey, {
        content,
        privacy,
        updatedAt,
      });
      setDraftSavedAt(updatedAt);
    }, 350);

    return () => {
      window.clearTimeout(saveDraftTimeout);
    };
  }, [open, draftStorageKey, content, privacy, submitting]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !submitting) {
        closeComposer();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeComposer, open, submitting]);

  function clearFiles() {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setFiles([]);
    setPreviews([]);
    setFileErrors([]);
    setDraggingMedia(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeFileAtIndex(indexToRemove) {
    const removedPreview = previews[indexToRemove];
    const nextFiles = files.filter((_, index) => index !== indexToRemove);
    const nextPreviews = previews.filter((_, index) => index !== indexToRemove);

    if (removedPreview?.url) {
      URL.revokeObjectURL(removedPreview.url);
    }

    setFiles(nextFiles);
    setPreviews(nextPreviews);

    if (nextFiles.length === 0) {
      setDraggingMedia(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function applyMediaFiles(selectedFiles, { append = false } = {}) {
    const nextFiles = append ? [...files, ...selectedFiles] : selectedFiles;

    setError("");
    setFileErrors([]);

    if (nextFiles.length === 0) {
      clearFiles();
      return false;
    }

    const validationErrors = getPostMediaFileErrors(nextFiles);

    if (validationErrors.length > 0) {
      setFileErrors(validationErrors);
      setError("Một số file chưa hợp lệ.");
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
      removePostDraft(draftStorageKey);
      setDraftSavedAt(null);
      setOpen(false);
      onCreated?.(data.post);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openComposer() {
    setError("");
    setFileErrors([]);

    if (!content && files.length === 0) {
      const draft = readPostDraft(draftStorageKey);

      if (draft?.content || draft?.privacy) {
        setContent(String(draft.content || ""));
        setPrivacy(draft.privacy || "public");
        setDraftSavedAt(draft.updatedAt || null);
      } else {
        setDraftSavedAt(null);
      }
    }

    setOpen(true);
  }

  function handleContentChange(event) {
    const nextContent = event.target.value;
    setContent(nextContent);

    if (!nextContent.trim() && privacy === "public") {
      setDraftSavedAt(null);
    }
  }

  function handlePrivacyChange(event) {
    const nextPrivacy = event.target.value;
    setPrivacy(nextPrivacy);

    if (!content.trim() && nextPrivacy === "public") {
      setDraftSavedAt(null);
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
          onClick={openComposer}
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
              closeComposer();
            }
          }}
        >
          <form
            className={`post-composer-modal ${
              hasMedia ? "has-media" : ""
            } ${draggingMedia ? "is-dragging-media" : ""} ${
              submitting ? "is-submitting" : ""
            }`.trim()}
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
                onClick={closeComposer}
                disabled={submitting}
              >
                ×
              </button>
            </header>

            <div className="post-composer-modal-body">
              <div className="post-composer-author">
                {avatarUrl ? (
                  <img
                    className="composer-avatar"
                    src={avatarUrl}
                    alt={user?.name}
                  />
                ) : (
                  <div className="composer-avatar-placeholder">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}

                <div>
                  <strong>{user?.name || "Tài khoản của bạn"}</strong>
                  <select
                    value={privacy}
                    onChange={handlePrivacyChange}
                    aria-label="Quyền xem bài viết"
                    disabled={submitting}
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
                onChange={handleContentChange}
                placeholder={placeholder}
                rows={hasMedia ? 3 : 5}
                disabled={submitting}
                autoFocus
              />

              {draftSavedAt && !submitting && (
                <p className="post-composer-draft-status">
                  Đã lưu nháp tự động
                </p>
              )}

              {hasMedia ? (
                <section
                  className="post-composer-media-panel"
                  aria-label="Media đã chọn"
                >
                  <div
                    className={`post-composer-preview-grid count-${Math.min(
                      previews.length,
                      4
                    )}`}
                  >
                    {previews.slice(0, 4).map((preview, index) => {
                      const extraCount = previews.length - 4;

                      return (
                        <div
                          key={preview.url}
                          className="post-composer-preview-item"
                        >
                          {preview.type === "video" ? (
                            <video
                              src={preview.url}
                              controls
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img src={preview.url} alt={preview.name} />
                          )}

                          <button
                            className="post-composer-preview-remove"
                            type="button"
                            aria-label={`Xóa ${preview.name || "media"}`}
                            onClick={() => removeFileAtIndex(index)}
                            disabled={submitting}
                          >
                            ×
                          </button>

                          {index === 3 && extraCount > 0 && (
                            <span className="post-composer-extra-count">
                              +{extraCount}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="post-composer-media-meta">
                    <strong>
                      {files.length}/{postMediaMaxFiles} media
                    </strong>
                    <span>{formatFileSize(selectedMediaSize)}</span>
                    <span>{files[0]?.name}</span>
                    <button
                      type="button"
                      onClick={clearFiles}
                      disabled={submitting}
                    >
                      Xóa tất cả
                    </button>
                  </div>
                </section>
              ) : (
                <p className="post-composer-drag-hint">
                  Kéo ảnh/video vào khung này hoặc dán từ clipboard.
                </p>
              )}

              {fileErrors.length > 0 && (
                <ul className="post-composer-file-errors">
                  {fileErrors.map((fileError, index) => (
                    <li key={`${fileError.name}-${index}`}>
                      <strong>{fileError.name}</strong>
                      <span>{fileError.message}</span>
                    </li>
                  ))}
                </ul>
              )}

              {submitting && (
                <p className="post-composer-upload-status" role="status">
                  {files.length > 0
                    ? "Đang tải media và đăng bài viết..."
                    : "Đang đăng bài viết..."}
                </p>
              )}

              {error && <p className="error">{error}</p>}
            </div>

            <footer className="post-composer-modal-footer">
              <div className="post-composer-addons">
                <strong>Thêm vào bài viết của bạn</strong>

                <label className="post-composer-icon-button image">
                  Ảnh/Video
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={postMediaAccept}
                    multiple
                    disabled={submitting}
                    onChange={handleMediaChange}
                  />
                </label>

                <button
                  type="button"
                  className="post-composer-icon-button"
                  disabled
                >
                  Cảm xúc
                </button>

                <button
                  type="button"
                  className="post-composer-icon-button"
                  disabled
                >
                  Vị trí
                </button>
              </div>

              <button
                className="button post-composer-submit"
                type="submit"
                disabled={!canSubmit}
              >
                {submitting
                  ? files.length > 0
                    ? "Đang tải media..."
                    : "Đang đăng..."
                  : "Đăng"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
