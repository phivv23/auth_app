import { useEffect, useState } from "react";
import { Link } from "react-router";

import { getFileUrl } from "../api/client.js";
import { getPostById } from "../api/post.api.js";
import { isVideoMedia } from "../utils/postMedia.js";
import { extractSharedPostId } from "../utils/sharedPostMessage.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const postPreviewCache = new Map();

function getPostMedia(post) {
  return post?.media?.length
    ? post.media
    : post?.imageUrl
      ? [{ url: post.imageUrl, type: "image" }]
      : [];
}

function getPreviewText(post) {
  return post?.content || (post?.title ? "" : "Mở bài viết");
}

export default function SharedPostMessagePreview({ content = "", compact = false }) {
  const postId = extractSharedPostId(content);
  const cachedPost = postId ? postPreviewCache.get(postId) : null;
  const [previewState, setPreviewState] = useState({
    postId,
    post: cachedPost || null,
    error: "",
  });
  const post =
    cachedPost ||
    (previewState.postId === postId ? previewState.post : null);
  const error = previewState.postId === postId ? previewState.error : "";
  const loading = Boolean(postId && !post && !error);

  useEffect(() => {
    if (!postId) {
      return;
    }

    if (postPreviewCache.has(postId)) {
      return;
    }

    let isActive = true;
    const controller = new AbortController();

    async function loadPostPreview() {
      try {
        const data = await getPostById(postId, {
          signal: controller.signal,
        });

        if (!isActive) {
          return;
        }

        postPreviewCache.set(postId, data.post);
        setPreviewState({
          postId,
          post: data.post,
          error: "",
        });
      } catch (error) {
        if (isActive && error.name !== "AbortError") {
          setPreviewState({
            postId,
            post: null,
            error: error.message,
          });
        }
      }
    }

    loadPostPreview();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [postId]);

  if (!postId) {
    return null;
  }

  if (loading) {
    return (
      <div className="message-shared-post-preview loading">
        <span />
        <div>
          <strong>Đang tải bài viết...</strong>
          <small>Phivv</small>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <Link className="message-shared-post-preview unavailable" to={`/posts/${postId}`}>
        <strong>Không thể tải bản xem trước</strong>
        <small>Mở bài viết</small>
      </Link>
    );
  }

  const media = getPostMedia(post);
  const previewMedia = media[0] || null;
  const authorAvatarUrl = getFileUrl(post.authorAvatarUrl);
  const className = compact
    ? "message-shared-post-preview compact"
    : "message-shared-post-preview";
  const previewText = getPreviewText(post);

  return (
    <Link className={className} to={`/posts/${post.id}`}>
      <div className="message-shared-post-author">
        {authorAvatarUrl ? (
          <img src={authorAvatarUrl} alt={post.authorName} />
        ) : (
          <span>{post.authorName?.charAt(0)?.toUpperCase() || "U"}</span>
        )}
        <div>
          <strong>{post.authorName}</strong>
          <small title={formatVietnamDateTime(post.createdAt)}>
            {formatRelativeTime(post.createdAt)}
          </small>
        </div>
      </div>

      <div className="message-shared-post-copy">
        {post.title && <strong>{post.title}</strong>}
        {previewText && <span>{previewText}</span>}
      </div>

      {previewMedia &&
        (isVideoMedia(previewMedia) ? (
          <video
            src={getFileUrl(previewMedia.url)}
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img src={getFileUrl(previewMedia.url)} alt={post.title || "Bài viết"} />
        ))}
    </Link>
  );
}
