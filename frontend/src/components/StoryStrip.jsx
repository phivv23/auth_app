import { useEffect, useRef, useState } from "react";

import {
  createStory,
  deleteStory,
  getStories,
  markStoryViewed,
} from "../api/story.api.js";
import { getFileUrl } from "../api/client.js";
import { useAuth } from "../context/useAuth.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

const privacyOptions = [
  { value: "public", label: "Công khai" },
  { value: "followers", label: "Người theo dõi" },
  { value: "friends", label: "Bạn bè" },
  { value: "only_me", label: "Chỉ mình tôi" },
];

function getInitial(name) {
  return name?.charAt(0)?.toUpperCase() || "U";
}

function formatExpiry(secondsUntilExpiry) {
  const seconds = Number(secondsUntilExpiry || 0);

  if (seconds <= 0) {
    return "Sắp hết hạn";
  }

  const hours = Math.floor(seconds / 3600);

  if (hours >= 1) {
    return `Còn ${hours} giờ`;
  }

  const minutes = Math.max(1, Math.floor(seconds / 60));

  return `Còn ${minutes} phút`;
}

function updateStoryInList(stories, updatedStory) {
  return stories.map((story) =>
    story.id === updatedStory.id ? updatedStory : story
  );
}

export default function StoryStrip({ onNotice }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [composerOpen, setComposerOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState("friends");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [composerError, setComposerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [activeStory, setActiveStory] = useState(null);
  const [viewerError, setViewerError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canSubmit = Boolean(file) && !submitting;

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    async function loadStories() {
      try {
        setLoading(true);
        setError("");

        const data = await getStories({
          limit: 50,
          signal: controller.signal,
        });

        if (isActive) {
          setStories(data.stories || []);
        }
      } catch (error) {
        if (isActive && error.name !== "AbortError") {
          setError(error.message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadStories();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const hasOverlay = composerOpen || activeStory;

    if (!hasOverlay) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !submitting && !deleting) {
        setComposerOpen(false);
        setActiveStory(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeStory, composerOpen, deleting, submitting]);

  function clearFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(null);
    setPreviewUrl("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetComposer() {
    setCaption("");
    setPrivacy("friends");
    setComposerError("");
    clearFile();
  }

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] || null;

    setComposerError("");

    if (!selectedFile) {
      clearFile();
      return;
    }

    if (
      !allowedImageTypes.includes(selectedFile.type) ||
      selectedFile.size > 5 * 1024 * 1024
    ) {
      setComposerError("Ảnh story phải là JPG, PNG hoặc WEBP và tối đa 5MB.");
      clearFile();
      return;
    }

    clearFile();
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  }

  async function handleCreateStory(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    try {
      setSubmitting(true);
      setComposerError("");

      const formData = new FormData();
      formData.append("media", file);
      formData.append("caption", caption);
      formData.append("privacy", privacy);

      const data = await createStory(formData);

      setStories((currentStories) => [
        data.story,
        ...currentStories.filter((story) => story.id !== data.story.id),
      ]);
      setComposerOpen(false);
      resetComposer();
      onNotice?.("Đã tạo story. Story sẽ tự hết hạn sau 24 giờ.");
    } catch (error) {
      setComposerError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpenStory(story) {
    setActiveStory(story);
    setViewerError("");

    try {
      const data = await markStoryViewed(story.id);
      const updatedStory = data.story || story;

      setActiveStory(updatedStory);
      setStories((currentStories) => updateStoryInList(currentStories, updatedStory));
    } catch (error) {
      setViewerError(error.message);
    }
  }

  async function handleDeleteStory() {
    if (!activeStory || !activeStory.isMine) {
      return;
    }

    if (!window.confirm("Xóa story này?")) {
      return;
    }

    try {
      setDeleting(true);
      setViewerError("");

      await deleteStory(activeStory.id);

      setStories((currentStories) =>
        currentStories.filter((story) => story.id !== activeStory.id)
      );
      setActiveStory(null);
      onNotice?.("Đã xóa story.");
    } catch (error) {
      setViewerError(error.message);
    } finally {
      setDeleting(false);
    }
  }

  const userAvatarUrl = getFileUrl(user?.avatarUrl);

  return (
    <>
      <section className="story-strip" aria-label="Stories">
        <button
          className="story-create-card"
          type="button"
          onClick={() => {
            setComposerError("");
            setComposerOpen(true);
          }}
        >
          {userAvatarUrl ? (
            <img src={userAvatarUrl} alt="" />
          ) : (
            <span className="story-create-fallback">{getInitial(user?.name)}</span>
          )}
          <span className="story-create-plus">+</span>
          <strong>Tạo tin</strong>
        </button>

        <div className="story-track">
          {loading ? (
            <div className="story-empty">Đang tải story...</div>
          ) : error ? (
            <div className="story-empty error">{error}</div>
          ) : stories.length === 0 ? (
            <div className="story-empty">Tin của bạn bè sẽ hiển thị tại đây.</div>
          ) : (
            stories.map((story) => {
              const storyMediaUrl = getFileUrl(story.mediaUrl);
              const storyAvatarUrl = getFileUrl(story.authorAvatarUrl);

              return (
                <button
                  key={story.id}
                  className={`story-card ${
                    story.viewedByMe ? "viewed" : "unseen"
                  } ${story.isMine ? "mine" : ""}`.trim()}
                  type="button"
                  onClick={() => handleOpenStory(story)}
                >
                  <img className="story-card-media" src={storyMediaUrl} alt="" />
                  {storyAvatarUrl ? (
                    <img
                      className="story-card-avatar"
                      src={storyAvatarUrl}
                      alt=""
                    />
                  ) : (
                    <span className="story-card-avatar fallback">
                      {getInitial(story.authorName)}
                    </span>
                  )}
                  <strong>{story.isMine ? "Tin của bạn" : story.authorName}</strong>
                  <small>{formatExpiry(story.secondsUntilExpiry)}</small>
                </button>
              );
            })
          )}
        </div>
      </section>

      {composerOpen && (
        <div
          className="story-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setComposerOpen(false);
            }
          }}
        >
          <form
            className="story-composer-modal"
            onSubmit={handleCreateStory}
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-composer-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="story-composer-title">Tạo story</h2>
              <button
                type="button"
                aria-label="Đóng"
                disabled={submitting}
                onClick={() => setComposerOpen(false)}
              >
                ×
              </button>
            </header>

            <label className="story-upload-zone">
              {previewUrl ? (
                <img src={previewUrl} alt="Xem trước story" />
              ) : (
                <span>Chọn ảnh story</span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
              />
            </label>

            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Viết caption cho story..."
              maxLength={500}
              rows={3}
            />

            <label>
              Quyền xem
              <select
                value={privacy}
                onChange={(event) => setPrivacy(event.target.value)}
              >
                {privacyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {composerError && <p className="error">{composerError}</p>}

            <div className="story-composer-actions">
              {file && (
                <button type="button" className="button secondary" onClick={clearFile}>
                  Xóa ảnh
                </button>
              )}
              <button className="button" type="submit" disabled={!canSubmit}>
                {submitting ? "Đang đăng..." : "Đăng story"}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeStory && (
        <div
          className="story-viewer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setActiveStory(null);
            }
          }}
        >
          <article
            className="story-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Story"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div className="story-viewer-author">
                {getFileUrl(activeStory.authorAvatarUrl) ? (
                  <img src={getFileUrl(activeStory.authorAvatarUrl)} alt="" />
                ) : (
                  <span>{getInitial(activeStory.authorName)}</span>
                )}
                <div>
                  <strong>{activeStory.authorName}</strong>
                  <small title={formatVietnamDateTime(activeStory.createdAt)}>
                    {formatRelativeTime(activeStory.createdAt)} ·{" "}
                    {formatExpiry(activeStory.secondsUntilExpiry)}
                  </small>
                </div>
              </div>

              <button
                type="button"
                aria-label="Đóng story"
                disabled={deleting}
                onClick={() => setActiveStory(null)}
              >
                ×
              </button>
            </header>

            <div className="story-viewer-media">
              <img src={getFileUrl(activeStory.mediaUrl)} alt="" />
            </div>

            {activeStory.caption && <p>{activeStory.caption}</p>}
            {viewerError && <p className="error">{viewerError}</p>}

            <footer>
              {activeStory.isMine && (
                <>
                  <span>{activeStory.viewCount} lượt xem</span>
                  <button
                    type="button"
                    className="button danger"
                    disabled={deleting}
                    onClick={handleDeleteStory}
                  >
                    {deleting ? "Đang xóa..." : "Xóa story"}
                  </button>
                </>
              )}
            </footer>
          </article>
        </div>
      )}
    </>
  );
}
