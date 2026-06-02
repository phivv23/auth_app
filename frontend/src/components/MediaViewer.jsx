import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { getFileUrl } from "../api/client.js";
import { isVideoMedia } from "../utils/postMedia.js";

export default function MediaViewer({
  media = [],
  initialIndex = 0,
  title = "Media bài viết",
  authorName = "",
  postUrl = "",
  initialVideoTime = 0,
  initialVideoAutoPlay = true,
  onClose,
}) {
  const activeVideoRef = useRef(null);
  const safeMedia = useMemo(
    () => media.filter((item) => item?.url),
    [media]
  );
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(safeMedia.length - 1, 0))
  );

  const activeIndex = Math.min(
    Math.max(selectedIndex, 0),
    Math.max(safeMedia.length - 1, 0)
  );
  const activeMedia = safeMedia[activeIndex];
  const hasMultiple = safeMedia.length > 1;
  const activeUrl = getFileUrl(activeMedia?.url);
  const shouldUseInitialVideoTime = activeIndex === initialIndex;

  const closeViewer = useCallback(() => {
    onClose?.({
      index: activeIndex,
      currentTime: activeVideoRef.current?.currentTime || 0,
    });
  }, [activeIndex, onClose]);

  useEffect(() => {
    if (!activeMedia) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeViewer();
      }

      if (event.key === "ArrowLeft") {
        setSelectedIndex((currentIndex) =>
          currentIndex === 0 ? safeMedia.length - 1 : currentIndex - 1
        );
      }

      if (event.key === "ArrowRight") {
        setSelectedIndex((currentIndex) =>
          currentIndex === safeMedia.length - 1 ? 0 : currentIndex + 1
        );
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMedia, closeViewer, safeMedia.length]);

  useEffect(() => {
    const video = activeVideoRef.current;

    if (!video || !isVideoMedia(activeMedia)) {
      return;
    }

    if (shouldUseInitialVideoTime && Number.isFinite(initialVideoTime)) {
      video.currentTime = Math.max(0, initialVideoTime);
    }
  }, [activeMedia, activeUrl, initialVideoTime, shouldUseInitialVideoTime]);

  if (!activeMedia) {
    return null;
  }

  function moveToPrevious() {
    setSelectedIndex((currentIndex) =>
      currentIndex === 0 ? safeMedia.length - 1 : currentIndex - 1
    );
  }

  function moveToNext() {
    setSelectedIndex((currentIndex) =>
      currentIndex === safeMedia.length - 1 ? 0 : currentIndex + 1
    );
  }

  return (
    <div
      className="media-viewer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeViewer();
        }
      }}
    >
      <section
        className="media-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="media-viewer-header">
          <div>
            <strong>{title}</strong>
            <span>
              {authorName ? `${authorName} · ` : ""}
              {activeIndex + 1}/{safeMedia.length}
            </span>
          </div>

          <div className="media-viewer-actions">
            {postUrl && (
              <Link to={postUrl} onClick={closeViewer}>
                Mở bài viết
              </Link>
            )}
            <button type="button" aria-label="Đóng" onClick={closeViewer}>
              ×
            </button>
          </div>
        </header>

        <div className="media-viewer-stage">
          {hasMultiple && (
            <button
              className="media-viewer-nav previous"
              type="button"
              aria-label="Media trước"
              onClick={moveToPrevious}
            >
              ‹
            </button>
          )}

          {isVideoMedia(activeMedia) ? (
            <video
              key={activeUrl}
              ref={activeVideoRef}
              src={activeUrl}
              controls
              autoPlay={shouldUseInitialVideoTime ? initialVideoAutoPlay : true}
              playsInline
              preload="metadata"
            />
          ) : (
            <img src={activeUrl} alt={title} />
          )}

          {hasMultiple && (
            <button
              className="media-viewer-nav next"
              type="button"
              aria-label="Media tiếp theo"
              onClick={moveToNext}
            >
              ›
            </button>
          )}
        </div>

        {hasMultiple && (
          <div className="media-viewer-thumbnails" aria-label="Danh sách media">
            {safeMedia.map((item, index) => (
              <button
                key={`${item.url}-${index}`}
                className={index === activeIndex ? "active" : ""}
                type="button"
                aria-label={`Mở media ${index + 1}`}
                onClick={() => setSelectedIndex(index)}
              >
                {isVideoMedia(item) ? (
                  <video src={getFileUrl(item.url)} muted preload="metadata" />
                ) : (
                  <img src={getFileUrl(item.url)} alt="" />
                )}
                {isVideoMedia(item) && <span aria-hidden="true">▶</span>}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
