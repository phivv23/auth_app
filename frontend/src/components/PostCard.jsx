import { Link } from "react-router";

import { getFileUrl } from "../api/client.js";
import { formatRelativeTime } from "../utils/time.js";

function getPostExcerpt(content, maxLength) {
  const text = String(content || "");

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function getEditedState(post) {
  const createdAt = new Date(post.createdAt).getTime();
  const updatedAt = new Date(post.updatedAt).getTime();
  const isEdited =
    Number.isFinite(createdAt) &&
    Number.isFinite(updatedAt) &&
    updatedAt - createdAt > 1000;

  return {
    isEdited,
    displayTime: isEdited ? post.updatedAt : post.createdAt,
  };
}

export default function PostCard({
  post,
  actions = null,
  className = "",
  excerpt = true,
  excerptLength = 180,
  showAuthor = Boolean(post.authorName),
  showImage = false,
  showReadMore = false,
  showStats = true,
  showTime = false,
  titleTag: TitleTag = "h2",
}) {
  const postUrl = `/posts/${post.id}`;
  const authorUrl = post.userId ? `/users/${post.userId}` : "";
  const firstMedia = post.media?.[0];
  const imageUrl = showImage ? getFileUrl(firstMedia?.url || post.imageUrl) : "";
  const renderedActions =
    typeof actions === "function" ? actions(post) : actions;
  const content = excerpt
    ? getPostExcerpt(post.content, excerptLength)
    : post.content;
  const title = post.title || "Bài viết";

  const { isEdited, displayTime } = getEditedState(post);

  return (
    <article className={`post-card ${className}`.trim()}>
      <TitleTag>
        <Link to={postUrl}>{title}</Link>
      </TitleTag>

      {(showAuthor || showStats) && (
        <p className="muted post-card-meta">
          {showAuthor && post.authorName && (
            <>
              <span>
                Tác giả:{" "}
                {authorUrl ? (
                  <Link to={authorUrl}>{post.authorName}</Link>
                ) : (
                  post.authorName
                )}
              </span>
              {showStats && <span aria-hidden="true">·</span>}
            </>
          )}

          {showStats && (
            <>
              <span>Likes: {post.likeCount || 0}</span>
              <span aria-hidden="true">·</span>
              <span>Comments: {post.commentCount || 0}</span>
            </>
          )}
        </p>
      )}

      {showTime && displayTime && (
        <p className="post-time">
          {formatRelativeTime(displayTime)}
          {isEdited && " · Đã chỉnh sửa"}
        </p>
      )}

      {imageUrl && (
        <Link to={postUrl}>
          <img className="feed-post-image" src={imageUrl} alt={title} />
        </Link>
      )}

      <p className={excerpt ? "post-card-excerpt" : "post-card-content"}>
        {content}
      </p>

      {(showReadMore || renderedActions) && (
        <div className="post-card-actions">
          {showReadMore && <Link to={postUrl}>Đọc tiếp</Link>}
          {renderedActions}
        </div>
      )}
    </article>
  );
}
