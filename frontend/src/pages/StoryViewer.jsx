import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  deleteStory,
  getStories,
  getStory,
  markStoryViewed,
  reactToStory,
  replyStory,
} from "../api/story.api.js";
import ReportDialog from "../components/ReportDialog.jsx";
import { useAuth } from "../context/useAuth.js";
import { useActionDialog } from "../hooks/useActionDialog.jsx";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const reactionOptions = ["👍", "❤️", "🥰", "😆", "😮", "😢", "😡"];
const IMAGE_STORY_DURATION_MS = 7000;
const MIN_VIDEO_STORY_DURATION_MS = 4000;
const MAX_VIDEO_STORY_DURATION_MS = 30000;
const TOAST_DURATION_MS = 2400;

function getInitial(name) {
  return name?.charAt(0)?.toUpperCase() || "U";
}

function isStoryVideo(story) {
  return story?.mediaType === "video";
}

function formatExpiry(secondsUntilExpiry) {
  const seconds = Number(secondsUntilExpiry || 0);

  if (seconds <= 0) {
    return "Sắp hết hạn";
  }

  const hours = Math.floor(seconds / 3600);

  if (hours >= 1) {
    return `${hours} giờ`;
  }

  const minutes = Math.max(1, Math.floor(seconds / 60));

  return `${minutes} phút`;
}

function updateStoryInList(stories, updatedStory) {
  const hasStory = stories.some((story) => story.id === updatedStory.id);

  if (!hasStory) {
    return [updatedStory, ...stories];
  }

  return stories.map((story) =>
    story.id === updatedStory.id ? updatedStory : story
  );
}

function groupStoriesByAuthor(stories) {
  const groupMap = new Map();

  for (const story of stories) {
    const authorKey = String(story.authorId || story.userId || story.id);
    const currentGroup = groupMap.get(authorKey) || {
      key: authorKey,
      authorName: story.isMine ? "Tin của bạn" : story.authorName,
      authorAvatarUrl: story.authorAvatarUrl,
      isMine: story.isMine,
      stories: [],
      unreadCount: 0,
      latestStory: story,
    };

    currentGroup.stories.push(story);

    if (!story.viewedByMe && !story.isMine) {
      currentGroup.unreadCount += 1;
    }

    if (
      new Date(story.createdAt).getTime() >
      new Date(currentGroup.latestStory.createdAt).getTime()
    ) {
      currentGroup.latestStory = story;
    }

    groupMap.set(authorKey, currentGroup);
  }

  return [...groupMap.values()].map((group) => ({
    ...group,
    selectedStory:
      group.stories.find((story) => !story.viewedByMe) || group.stories[0],
  }));
}

function clampStoryDuration(durationMs) {
  return Math.min(
    Math.max(durationMs, MIN_VIDEO_STORY_DURATION_MS),
    MAX_VIDEO_STORY_DURATION_MS
  );
}

export default function StoryViewer() {
  const { user } = useAuth();
  const { actionDialog, confirmAction } = useActionDialog();
  const { storyId } = useParams();
  const navigate = useNavigate();
  const viewedStoryIdsRef = useRef(new Set());
  const requestedMissingStoryIdsRef = useRef(new Set());
  const videoRef = useRef(null);
  const animationFrameRef = useRef(null);
  const autoAdvanceRef = useRef(false);
  const currentProgressRef = useRef(0);
  const toastTimeoutRef = useRef(null);
  const reactionTimeoutRef = useRef(null);

  const routeStoryId = storyId ? String(storyId) : "";

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mediaDurationMs, setMediaDurationMs] = useState(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const [toast, setToast] = useState(null);
  const [pendingReaction, setPendingReaction] = useState("");
  const [recentReaction, setRecentReaction] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const activeStoryId =
    routeStoryId || (stories[0]?.id ? String(stories[0].id) : "");
  const activeStory = stories.find(
    (story) => String(story.id) === String(activeStoryId)
  );
  const activeIndex = stories.findIndex(
    (story) => String(story.id) === String(activeStoryId)
  );
  const storyGroups = useMemo(() => groupStoriesByAuthor(stories), [stories]);
  const activeGroup = storyGroups.find((group) =>
    group.stories.some((story) => String(story.id) === String(activeStoryId))
  );
  const activeGroupStoryIndex =
    activeGroup?.stories.findIndex(
      (story) => String(story.id) === String(activeStoryId)
    ) ?? -1;
  const hasPreviousStory = activeIndex > 0;
  const hasNextStory = activeIndex >= 0 && activeIndex < stories.length - 1;
  const activeAvatarUrl = getFileUrl(activeStory?.authorAvatarUrl);
  const activeMediaUrl = getFileUrl(activeStory?.mediaUrl);
  const userAvatarUrl = getFileUrl(user?.avatarUrl);
  const activeDurationMs =
    isStoryVideo(activeStory) && mediaDurationMs
      ? mediaDurationMs
      : IMAGE_STORY_DURATION_MS;
  const timerPaused = isPaused || replyFocused || sending || deleting;
  const canReply = Boolean(replyText.trim()) && !sending;
  const selectStory = useCallback(
    (nextStoryId, options = {}) => {
      if (!nextStoryId) {
        return;
      }

      setNotice("");
      setReplyText("");
      setMenuOpen(false);
      navigate(`/stories/${encodeURIComponent(nextStoryId)}`, options);
    },
    [navigate]
  );

  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
      window.clearTimeout(toastTimeoutRef.current);
      window.clearTimeout(reactionTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    async function loadStories() {
      try {
        setLoading(true);
        setError("");

        const data = await getStories({
          limit: 80,
          signal: controller.signal,
        });

        if (!isActive) {
          return;
        }

        setStories(data.stories || []);
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
    if (loading) {
      return undefined;
    }

    if (!routeStoryId) {
      const firstStoryId = stories[0]?.id;

      if (firstStoryId) {
        navigate(`/stories/${encodeURIComponent(firstStoryId)}`, {
          replace: true,
        });
      }

      return undefined;
    }

    const storyExists = stories.some(
      (story) => String(story.id) === routeStoryId
    );

    if (storyExists) {
      return undefined;
    }

    if (requestedMissingStoryIdsRef.current.has(routeStoryId)) {
      return undefined;
    }

    let isActive = true;
    requestedMissingStoryIdsRef.current.add(routeStoryId);

    async function loadMissingStory() {
      try {
        setError("");

        const data = await getStory(routeStoryId);

        if (!isActive || !data.story) {
          return;
        }

        setStories((currentStories) => updateStoryInList(currentStories, data.story));
        navigate(`/stories/${encodeURIComponent(data.story.id)}`, {
          replace: true,
        });
      } catch (error) {
        if (isActive) {
          setError(error.message);
        }
      }
    }

    loadMissingStory();

    return () => {
      isActive = false;
    };
  }, [loading, navigate, routeStoryId, stories]);

  useEffect(() => {
    if (!activeStory?.id) {
      return undefined;
    }

    const nextStoryId = String(activeStory.id);

    if (viewedStoryIdsRef.current.has(nextStoryId)) {
      return undefined;
    }

    let isActive = true;
    viewedStoryIdsRef.current.add(nextStoryId);

    async function markViewed() {
      try {
        const data = await markStoryViewed(activeStory.id);

        if (isActive && data.story) {
          setStories((currentStories) =>
            updateStoryInList(currentStories, data.story)
          );
        }
      } catch (error) {
        if (isActive) {
          setError(error.message);
        }
      }
    }

    markViewed();

    return () => {
      isActive = false;
    };
  }, [activeStory?.id]);

  useEffect(() => {
    if (!activeStory?.id) {
      return undefined;
    }

    autoAdvanceRef.current = false;
    currentProgressRef.current = 0;
    window.cancelAnimationFrame(animationFrameRef.current);

    const resetFrame = window.requestAnimationFrame(() => {
      setProgressPercent(0);
      setMediaDurationMs(null);
      setIsPaused(false);
      setReplyFocused(false);
      setPendingReaction("");
      setRecentReaction("");
      setMenuOpen(false);
    });

    return () => {
      window.cancelAnimationFrame(resetFrame);
    };
  }, [activeStory?.id]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !isStoryVideo(activeStory)) {
      return;
    }

    if (isPaused) {
      video.pause();
      return;
    }

    video.play().catch(() => {
      setIsPaused(true);
      showToast("Bấm phát để xem video story.", "info");
    });
  }, [activeStory, isPaused]);

  useEffect(() => {
    if (!activeStory || loading || timerPaused) {
      return undefined;
    }

    const startingProgress = currentProgressRef.current;

    if (startingProgress >= 100) {
      return undefined;
    }

    const startedAt = window.performance.now();

    function tick(now) {
      const elapsedMs = now - startedAt;
      const nextProgress = Math.min(
        100,
        startingProgress + (elapsedMs / activeDurationMs) * 100
      );

      currentProgressRef.current = nextProgress;
      setProgressPercent(nextProgress);

      if (nextProgress >= 100) {
        if (autoAdvanceRef.current) {
          return;
        }

        autoAdvanceRef.current = true;

        const nextStory = stories[activeIndex + 1];

        if (nextStory) {
          selectStory(nextStory.id);
        } else {
          showToast("Đã xem hết tất cả tin.", "info");
        }

        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    }

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [
    activeDurationMs,
    activeIndex,
    activeStory,
    loading,
    selectStory,
    stories,
    timerPaused,
  ]);

  useEffect(() => {
    function handleKeyDown(event) {
      const targetTagName = event.target?.tagName;
      const isEditingText = ["INPUT", "TEXTAREA", "SELECT"].includes(
        targetTagName
      );

      if (event.key === "Escape") {
        navigate("/feed");
        return;
      }

      if (isEditingText) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToAdjacentStory(-1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToAdjacentStory(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  function showToast(message, type = "success") {
    window.clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });

    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, TOAST_DURATION_MS);
  }

  function goToAdjacentStory(direction) {
    if (activeIndex < 0) {
      return;
    }

    const nextIndex = activeIndex + direction;
    const nextStory = stories[nextIndex];

    if (nextStory) {
      selectStory(nextStory.id);
    } else if (direction > 0) {
      currentProgressRef.current = 100;
      setProgressPercent(100);
      showToast("Đã xem hết tất cả tin.", "info");
    }
  }

  async function sendReply(content, { reaction = "" } = {}) {
    const messageContent = content.trim();

    if (!messageContent || !activeStory?.id || activeStory?.isMine) {
      return;
    }

    try {
      setSending(true);
      setPendingReaction(reaction);
      setError("");
      setNotice("");

      const data = reaction
        ? await reactToStory(activeStory.id, reaction)
        : await replyStory(activeStory.id, messageContent);

      setReplyText("");
      setNotice("");

      if (reaction) {
        setRecentReaction(reaction);
        window.clearTimeout(reactionTimeoutRef.current);
        reactionTimeoutRef.current = window.setTimeout(() => {
          setRecentReaction("");
        }, 900);
        showToast(data.message || `Đã gửi ${reaction} vào tin nhắn.`, "success");
      } else {
        showToast(data.message || "Đã gửi trả lời vào tin nhắn.", "success");
      }
    } catch (error) {
      setError(error.message);
      showToast(error.message, "error");
    } finally {
      setSending(false);
      setPendingReaction("");
    }
  }

  function handleReplySubmit(event) {
    event.preventDefault();
    sendReply(replyText);
  }

  async function handleReaction(reaction) {
    await sendReply(reaction, { reaction });
  }

  function handleOpenAuthor() {
    const authorId = activeStory?.authorId || activeStory?.userId;

    if (authorId) {
      navigate(`/users/${authorId}`);
    }
  }

  async function handleCopyStoryLink() {
    try {
      const storyUrl = `${window.location.origin}/stories/${activeStory.id}`;

      await window.navigator.clipboard.writeText(storyUrl);
      setMenuOpen(false);
      showToast("Đã sao chép liên kết story.", "success");
    } catch {
      showToast("Không thể sao chép liên kết.", "error");
    }
  }

  function handleSaveStoryToMoment() {
    if (!activeStory?.id) {
      return;
    }

    setMenuOpen(false);
    navigate(`/moments?storyId=${activeStory.id}`);
  }

  function handleReportStory() {
    setMenuOpen(false);
    setIsPaused(true);
    setReportDialogOpen(true);
  }

  async function handleDeleteStory() {
    if (!activeStory?.isMine) {
      return;
    }

    const nextStory = stories[activeIndex + 1] || stories[activeIndex - 1];

    await confirmAction({
      title: "Xóa tin?",
      message: "Tin này sẽ bị xóa khỏi kho story của bạn.",
      confirmLabel: "Xóa tin",
      loadingLabel: "Đang xóa...",
      danger: true,
      onConfirm: async () => {
        try {
          setDeleting(true);
          setError("");
          setNotice("");

          await deleteStory(activeStory.id);

          setStories((currentStories) =>
            currentStories.filter((story) => story.id !== activeStory.id)
          );

          if (nextStory) {
            selectStory(nextStory.id, { replace: true });
          } else {
            navigate("/feed");
          }
        } catch (error) {
          setError(error.message);
          throw error;
        } finally {
          setDeleting(false);
        }
      },
    });
  }

  return (
    <div className="story-view-page">
      <aside className="story-view-sidebar" aria-label="Danh sách story">
        <div className="story-view-sidebar-top">
          <button
            className="story-icon-button close"
            type="button"
            aria-label="Đóng story"
            onClick={() => navigate("/feed")}
          >
            ×
          </button>
          <Link className="story-view-brand" to="/feed" aria-label="Phivv">
            f
          </Link>
        </div>

        <div className="story-view-sidebar-scroll">
          <header className="story-view-sidebar-header">
            <h1>Tin</h1>
            <p>
              <button type="button">Kho lưu trữ</button>
              <span>·</span>
              <button type="button">Cài đặt</button>
            </p>
          </header>

          <section className="story-view-sidebar-section">
            <h2>Tin của bạn</h2>
            <Link className="story-create-row" to="/feed">
              <span>+</span>
              <div>
                <strong>Tạo tin</strong>
                <small>Chia sẻ ảnh, video hoặc viết gì đó</small>
              </div>
            </Link>
          </section>

          <section className="story-view-sidebar-section">
            <h2>Tất cả tin</h2>

            {loading ? (
              <div className="story-sidebar-empty">Đang tải tin...</div>
            ) : storyGroups.length === 0 ? (
              <div className="story-sidebar-empty">
                Tin của bạn bè sẽ hiển thị tại đây.
              </div>
            ) : (
              <div className="story-sidebar-list">
                {storyGroups.map((group) => {
                  const isActiveGroup = group.stories.some(
                    (story) => String(story.id) === String(activeStoryId)
                  );
                  const groupAvatarUrl = getFileUrl(group.authorAvatarUrl);
                  const unreadLabel =
                    group.unreadCount > 0
                      ? `${group.unreadCount} tin mới · `
                      : "";

                  return (
                    <button
                      key={group.key}
                      className={`story-sidebar-item ${
                        isActiveGroup ? "active" : ""
                      } ${group.unreadCount > 0 ? "unseen" : "viewed"}`.trim()}
                      type="button"
                      onClick={() => selectStory(group.selectedStory.id)}
                    >
                      {groupAvatarUrl ? (
                        <img src={groupAvatarUrl} alt="" />
                      ) : (
                        <span>{getInitial(group.authorName)}</span>
                      )}
                      <div>
                        <strong>{group.authorName}</strong>
                        <small>
                          {unreadLabel}
                          {formatRelativeTime(group.latestStory.createdAt)}
                        </small>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </aside>

      <div className="story-view-top-actions" aria-label="Lối tắt">
        <button
          type="button"
          aria-label="Menu"
          onClick={() => showToast("Menu đang được phát triển.", "info")}
        >
          ▦
        </button>
        <button type="button" aria-label="Messenger" onClick={() => navigate("/messages")}>
          ●
        </button>
        <button
          type="button"
          aria-label="Thông báo"
          onClick={() => navigate("/notifications")}
        >
          ●
        </button>
        <Link to="/profile" aria-label="Trang cá nhân">
          {userAvatarUrl ? <img src={userAvatarUrl} alt="" /> : getInitial(user?.name)}
        </Link>
      </div>

      <section className="story-view-stage" aria-label="Story đang xem">
        <button
          className="story-nav-arrow previous"
          type="button"
          aria-label="Tin trước"
          disabled={!hasPreviousStory}
          onClick={() => goToAdjacentStory(-1)}
        >
          ‹
        </button>

        {loading ? (
          <div className="story-view-state">Đang tải tin...</div>
        ) : activeStory ? (
          <div className="story-view-content">
            <article className="story-view-card">
              <div className="story-view-progress" aria-hidden="true">
                {(activeGroup?.stories || [activeStory]).map((story, index) => {
                  const segmentProgress =
                    index < activeGroupStoryIndex
                      ? 100
                      : index === activeGroupStoryIndex
                        ? progressPercent
                        : 0;

                  return (
                    <span
                      key={story.id}
                      className={
                        index < activeGroupStoryIndex
                          ? "complete"
                          : index === activeGroupStoryIndex
                            ? "active"
                            : ""
                      }
                    >
                      <i style={{ width: `${segmentProgress}%` }} />
                    </span>
                  );
                })}
              </div>

              <header className="story-view-card-header">
                <div className="story-view-author">
                  {activeAvatarUrl ? (
                    <img src={activeAvatarUrl} alt="" />
                  ) : (
                    <span>{getInitial(activeStory.authorName)}</span>
                  )}
                  <div>
                    <strong>{activeStory.authorName}</strong>
                    <small title={formatVietnamDateTime(activeStory.createdAt)}>
                      {formatRelativeTime(activeStory.createdAt)} · còn{" "}
                      {formatExpiry(activeStory.secondsUntilExpiry)}
                    </small>
                  </div>
                </div>

                <div className="story-view-card-actions">
                  <button
                    type="button"
                    aria-label={isPaused ? "Tiếp tục story" : "Tạm dừng story"}
                    onClick={() => setIsPaused((currentValue) => !currentValue)}
                  >
                    {isPaused ? "▶" : "Ⅱ"}
                  </button>
                  <button
                    type="button"
                    aria-expanded={menuOpen}
                    aria-label="Tùy chọn story"
                    onClick={() => {
                      setIsPaused(true);
                      setMenuOpen((currentValue) => !currentValue);
                    }}
                  >
                    ···
                  </button>
                </div>

                {menuOpen && (
                  <div className="story-action-menu" role="menu">
                    <button type="button" role="menuitem" onClick={handleOpenAuthor}>
                      Xem hồ sơ
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSaveStoryToMoment}
                    >
                      Lưu vào khoảnh khắc
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleCopyStoryLink}
                    >
                      Sao chép liên kết
                    </button>
                    {activeStory.isMine ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="danger"
                        disabled={deleting}
                        onClick={handleDeleteStory}
                      >
                        Xóa tin
                      </button>
                    ) : (
                      <button type="button" role="menuitem" onClick={handleReportStory}>
                        Báo cáo tin
                      </button>
                    )}
                  </div>
                )}
              </header>

              <div className="story-view-media">
                {isStoryVideo(activeStory) ? (
                  <video
                    key={activeStory.id}
                    ref={videoRef}
                    src={activeMediaUrl}
                    autoPlay
                    disablePictureInPicture
                    playsInline
                    preload="auto"
                    onContextMenu={(event) => event.preventDefault()}
                    onEnded={() => goToAdjacentStory(1)}
                    onLoadedMetadata={(event) => {
                      const durationMs = Number(event.currentTarget.duration) * 1000;

                      if (Number.isFinite(durationMs) && durationMs > 0) {
                        currentProgressRef.current = 0;
                        setProgressPercent(0);
                        setMediaDurationMs(clampStoryDuration(durationMs));
                      }
                    }}
                  />
                ) : (
                  <img src={activeMediaUrl} alt="" />
                )}
              </div>

              {recentReaction && (
                <div className="story-reaction-burst" aria-hidden="true">
                  {recentReaction}
                </div>
              )}

              {activeStory.caption && (
                <p className="story-view-caption">{activeStory.caption}</p>
              )}
            </article>

            <div className="story-reply-bar">
              {activeStory.isMine ? (
                <div className="story-owner-actions">
                  <span>{activeStory.viewCount || 0} lượt xem</span>
                  <button
                    className="story-delete-button"
                    type="button"
                    disabled={deleting}
                    onClick={handleDeleteStory}
                  >
                    {deleting ? "Đang xóa..." : "Xóa tin"}
                  </button>
                </div>
              ) : (
                <>
                  <form className="story-reply-form" onSubmit={handleReplySubmit}>
                    <input
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      onFocus={() => setReplyFocused(true)}
                      onBlur={() => setReplyFocused(false)}
                      placeholder="Gửi tin nhắn..."
                      disabled={sending}
                    />
                    <button type="submit" disabled={!canReply}>
                      Gửi
                    </button>
                  </form>
                  <div className="story-reactions" aria-label="Cảm xúc">
                    {reactionOptions.map((reaction) => (
                      <button
                        key={reaction}
                        className={pendingReaction === reaction ? "sending" : ""}
                        type="button"
                        aria-label={`Gửi ${reaction}`}
                        disabled={sending}
                        onClick={() => handleReaction(reaction)}
                      >
                        {reaction}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {notice && <p className="story-view-message">{notice}</p>}
          </div>
        ) : (
          <div className="story-view-state">
            <strong>Không có tin để hiển thị.</strong>
            <Link to="/feed">Quay lại Feed</Link>
            {error && <p className="error">{error}</p>}
          </div>
        )}

        <button
          className="story-nav-arrow next"
          type="button"
          aria-label="Tin tiếp theo"
          disabled={!hasNextStory}
          onClick={() => goToAdjacentStory(1)}
        >
          ›
        </button>
      </section>

      {toast && (
        <div className={`story-toast ${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <ReportDialog
        open={reportDialogOpen}
        targetType="story"
        targetId={activeStory?.id}
        title="Báo cáo story"
        onClose={() => setReportDialogOpen(false)}
        onReported={() => {
          setReportDialogOpen(false);
          showToast("Đã gửi báo cáo story.", "success");
        }}
      />
      {actionDialog}
    </div>
  );
}
