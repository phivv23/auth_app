import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  createComment,
  deletePost,
  getPostComments,
  getPostReactions,
  sharePost,
  togglePostLike,
} from "../api/post.api.js";
import { getFileUrl } from "../api/client.js";
import { useAuth } from "../context/useAuth.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const reactions = [
  { type: "like", label: "Thích", icon: "👍" },
  { type: "love", label: "Yêu thích", icon: "❤️" },
  { type: "haha", label: "Haha", icon: "😂" },
  { type: "wow", label: "Wow", icon: "😮" },
  { type: "sad", label: "Buồn", icon: "😢" },
  { type: "angry", label: "Phẫn nộ", icon: "😡" },
];

const privacyLabels = {
  public: "Công khai",
  followers: "Người theo dõi",
  friends: "Bạn bè",
  only_me: "Chỉ mình tôi",
};

const reactionByType = Object.fromEntries(
  reactions.map((reaction) => [reaction.type, reaction])
);

function getReactionMeta(type) {
  return reactionByType[type] || reactionByType.like;
}

function getReactionTotal(summary, fallbackCount) {
  const summaryTotal = Object.values(summary || {}).reduce(
    (total, count) => total + Number(count || 0),
    0
  );

  return summaryTotal || Number(fallbackCount || 0);
}

function getTopReactions(summary, myReaction, fallbackCount) {
  const reactionItems = reactions
    .map((reaction) => ({
      ...reaction,
      count: Number(summary?.[reaction.type] || 0),
    }))
    .filter((reaction) => reaction.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  if (reactionItems.length > 0) {
    return reactionItems;
  }

  if (Number(fallbackCount || 0) > 0) {
    return [getReactionMeta(myReaction || "like")];
  }

  return [];
}

function getPostMedia(post) {
  return post?.media?.length
    ? post.media
    : post?.imageUrl
      ? [{ url: post.imageUrl, type: "image" }]
      : [];
}

export default function SocialPostCard({
  post,
  onPostUpdated,
  onPostDeleted,
  onPostShared,
  defaultCommentsOpen = false,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [commentsOpen, setCommentsOpen] = useState(defaultCommentsOpen);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [reactionPanelOpen, setReactionPanelOpen] = useState(false);
  const [reactionUsers, setReactionUsers] = useState([]);
  const [reactionSummary, setReactionSummary] = useState(
    post.reactionSummary || {}
  );
  const [reactionFilter, setReactionFilter] = useState("");
  const [reactionsLoading, setReactionsLoading] = useState(false);
  const [reactionsError, setReactionsError] = useState("");
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [shareContent, setShareContent] = useState("");
  const [sharePrivacy, setSharePrivacy] = useState("public");
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isAuthor = user && user.id === post.userId;
  const authorAvatarUrl = getFileUrl(post.authorAvatarUrl);
  const media = getPostMedia(post);
  const displayReactionSummary =
    Object.keys(reactionSummary).length > 0
      ? reactionSummary
      : post.reactionSummary || {};
  const reactionTotal = getReactionTotal(displayReactionSummary, post.likeCount);
  const topReactions = getTopReactions(
    displayReactionSummary,
    post.myReaction,
    post.likeCount
  );
  const currentReaction = getReactionMeta(post.myReaction || "like");
  const sharedPost = post.sharedPost;
  const sharedMedia = getPostMedia(sharedPost);

  useEffect(() => {
    if (defaultCommentsOpen) {
      loadComments();
    }
    // loadComments reads local loading flags; post id is the important reset key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCommentsOpen, post.id]);

  async function loadComments() {
    if (commentsLoaded || commentsLoading) {
      return;
    }

    try {
      setCommentsLoading(true);
      setError("");

      const data = await getPostComments(post.id);
      setComments(data.comments || []);
      setCommentsLoaded(true);
    } catch (error) {
      setError(error.message);
    } finally {
      setCommentsLoading(false);
    }
  }

  async function loadReactions(nextFilter = reactionFilter) {
    try {
      setReactionsLoading(true);
      setReactionsError("");

      const data = await getPostReactions(post.id, {
        limit: 50,
        reactionType: nextFilter,
      });

      setReactionUsers(data.users || []);
      setReactionSummary(data.summary || {});
    } catch (error) {
      setReactionsError(error.message);
    } finally {
      setReactionsLoading(false);
    }
  }

  async function handleToggleComments() {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);

    if (nextOpen) {
      await loadComments();
    }
  }

  async function handleToggleReactionPanel() {
    const nextOpen = !reactionPanelOpen;
    setReactionPanelOpen(nextOpen);

    if (nextOpen) {
      await loadReactions(reactionFilter);
    }
  }

  async function handleReactionFilter(nextFilter) {
    setReactionFilter(nextFilter);
    await loadReactions(nextFilter);
  }

  async function handleReaction(reactionType) {
    if (!user) {
      navigate("/login");
      return;
    }

    try {
      setReacting(true);
      setError("");
      setNotice("");

      const data = await togglePostLike(post.id, reactionType);

      onPostUpdated?.({
        ...post,
        likedByMe: data.liked,
        myReaction: data.reactionType,
        likeCount: data.likeCount,
        reactionSummary: data.reactionSummary || {},
      });
      setReactionSummary(data.reactionSummary || {});

      if (reactionPanelOpen) {
        await loadReactions(reactionFilter);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setReacting(false);
    }
  }

  async function handleCreateComment(event) {
    event.preventDefault();

    if (!user) {
      navigate("/login");
      return;
    }

    const content = commentInput.trim();

    if (!content) {
      return;
    }

    try {
      setCommentSubmitting(true);
      setError("");
      setNotice("");

      const data = await createComment(post.id, content);

      setComments((currentComments) => [...currentComments, data.comment]);
      setCommentsLoaded(true);
      setCommentsOpen(true);
      setCommentInput("");

      onPostUpdated?.({
        ...post,
        commentCount: Number(post.commentCount || 0) + 1,
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function handleDeletePost() {
    const confirmed = window.confirm("Bạn chắc chắn muốn xóa bài viết này?");

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      await deletePost(post.id);
      onPostDeleted?.(post.id);
    } catch (error) {
      setError(error.message);
    }
  }

  function handleToggleSharePanel() {
    if (!user) {
      navigate("/login");
      return;
    }

    setSharePanelOpen((currentOpen) => !currentOpen);
    setError("");
    setNotice("");
  }

  async function handleShareSubmit(event) {
    event.preventDefault();

    if (!user) {
      navigate("/login");
      return;
    }

    try {
      setShareSubmitting(true);
      setError("");
      setNotice("");

      const data = await sharePost(post.id, {
        content: shareContent.trim(),
        privacy: sharePrivacy,
      });

      setShareContent("");
      setSharePanelOpen(false);
      setNotice("Đã chia sẻ bài viết về trang cá nhân.");
      onPostUpdated?.({
        ...post,
        shareCount: Number(post.shareCount || 0) + 1,
      });
      onPostShared?.(data.post);
    } catch (error) {
      setError(error.message);
    } finally {
      setShareSubmitting(false);
    }
  }

  return (
    <article className="social-post-card">
      <header className="social-post-header">
        <Link to={`/users/${post.userId}`}>
          {authorAvatarUrl ? (
            <img
              className="feed-author-avatar"
              src={authorAvatarUrl}
              alt={post.authorName}
            />
          ) : (
            <div className="feed-author-placeholder">
              {post.authorName?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
        </Link>

        <div className="social-post-author">
          <Link to={`/users/${post.userId}`}>
            <strong>{post.authorName}</strong>
          </Link>
          <span title={formatVietnamDateTime(post.createdAt)}>
            {formatRelativeTime(post.createdAt)} ·{" "}
            {privacyLabels[post.privacy] || "Công khai"}
          </span>
        </div>

        {isAuthor && (
          <div className="social-post-menu">
            <Link to={`/posts/${post.id}/edit`}>Sửa</Link>
            <button type="button" onClick={handleDeletePost}>
              Xóa
            </button>
          </div>
        )}
      </header>

      {post.title && (
        <h2 className="social-post-title">
          <Link to={`/posts/${post.id}`}>{post.title}</Link>
        </h2>
      )}

      {post.content && <p className="feed-post-content">{post.content}</p>}

      {media.length > 0 && (
        <div className={`social-media-grid count-${Math.min(media.length, 4)}`}>
          {media.slice(0, 4).map((item, index) => {
            const mediaUrl = getFileUrl(item.url);
            const extraCount = media.length - 4;

            return (
              <Link key={`${item.url}-${index}`} to={`/posts/${post.id}`}>
                <img src={mediaUrl} alt={post.title || "Ảnh bài viết"} />
                {index === 3 && extraCount > 0 && (
                  <span className="media-extra-count">+{extraCount}</span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {post.sharedPostId && (
        sharedPost ? (
          <Link className="shared-post-preview" to={`/posts/${sharedPost.id}`}>
            <div className="shared-post-author">
              {getFileUrl(sharedPost.authorAvatarUrl) ? (
                <img
                  src={getFileUrl(sharedPost.authorAvatarUrl)}
                  alt={sharedPost.authorName}
                />
              ) : (
                <span>
                  {sharedPost.authorName?.charAt(0)?.toUpperCase() || "U"}
                </span>
              )}

              <div>
                <strong>{sharedPost.authorName}</strong>
                <small title={formatVietnamDateTime(sharedPost.createdAt)}>
                  {formatRelativeTime(sharedPost.createdAt)}
                </small>
              </div>
            </div>

            {sharedPost.title && <h3>{sharedPost.title}</h3>}
            {sharedPost.content && <p>{sharedPost.content}</p>}

            {sharedMedia[0] && (
              <img
                className="shared-post-image"
                src={getFileUrl(sharedMedia[0].url)}
                alt={sharedPost.title || "Ảnh bài viết được chia sẻ"}
              />
            )}
          </Link>
        ) : (
          <div className="shared-post-preview shared-post-unavailable">
            Bài viết được chia sẻ hiện không khả dụng.
          </div>
        )
      )}

      <div className="post-meta feed-post-stats">
        <button
          className="reaction-summary-button"
          type="button"
          aria-expanded={reactionPanelOpen}
          onClick={handleToggleReactionPanel}
        >
          {topReactions.length > 0 && (
            <span className="reaction-summary-icons" aria-hidden="true">
              {topReactions.map((reaction) => (
                <span key={reaction.type}>{reaction.icon}</span>
              ))}
            </span>
          )}
          <span>{reactionTotal} cảm xúc</span>
        </button>
        <button
          className="feed-stat-button"
          type="button"
          onClick={handleToggleComments}
        >
          {post.commentCount || 0} bình luận
        </button>
        <span>{post.shareCount || 0} chia sẻ</span>
      </div>

      {reactionPanelOpen && (
        <section className="reaction-panel">
          <div className="reaction-filter-row">
            <button
              className={reactionFilter === "" ? "active" : ""}
              type="button"
              onClick={() => handleReactionFilter("")}
            >
              Tất cả {reactionTotal}
            </button>

            {reactions.map((reaction) => {
              const count = Number(displayReactionSummary[reaction.type] || 0);

              if (count === 0 && reactionFilter !== reaction.type) {
                return null;
              }

              return (
                <button
                  key={reaction.type}
                  className={reactionFilter === reaction.type ? "active" : ""}
                  type="button"
                  onClick={() => handleReactionFilter(reaction.type)}
                >
                  <span aria-hidden="true">{reaction.icon}</span>
                  {count}
                </button>
              );
            })}
          </div>

          {reactionsError && <p className="error">{reactionsError}</p>}

          {reactionsLoading ? (
            <p className="muted">Đang tải cảm xúc...</p>
          ) : reactionUsers.length === 0 ? (
            <p className="muted">Chưa có ai thả cảm xúc.</p>
          ) : (
            <div className="reaction-user-list">
              {reactionUsers.map((reactionUser) => {
                const reactionMeta = getReactionMeta(reactionUser.reactionType);
                const reactionAvatarUrl = getFileUrl(reactionUser.avatarUrl);

                return (
                  <div key={reactionUser.id} className="reaction-user">
                    <Link to={`/users/${reactionUser.id}`}>
                      {reactionAvatarUrl ? (
                        <img
                          className="reaction-user-avatar"
                          src={reactionAvatarUrl}
                          alt={reactionUser.name}
                        />
                      ) : (
                        <div className="reaction-user-placeholder">
                          {reactionUser.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                      )}
                    </Link>

                    <div className="reaction-user-info">
                      <Link to={`/users/${reactionUser.id}`}>
                        {reactionUser.name}
                      </Link>
                      <span title={formatVietnamDateTime(reactionUser.reactedAt)}>
                        {formatRelativeTime(reactionUser.reactedAt)}
                      </span>
                    </div>

                    <span
                      className="reaction-user-badge"
                      title={reactionMeta.label}
                      aria-label={reactionMeta.label}
                    >
                      {reactionMeta.icon}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="feed-action-bar">
        <div className="reaction-action-wrap">
          <button
            className={`feed-action-button reaction-action-button ${
              post.myReaction ? "active" : ""
            }`}
            type="button"
            disabled={reacting}
            onClick={() => handleReaction(post.myReaction || "like")}
          >
            <span className="reaction-icon" aria-hidden="true">
              {currentReaction.icon}
            </span>
            {post.myReaction ? currentReaction.label : "Thích"}
          </button>

          <div className="reaction-picker" role="menu" aria-label="Chọn cảm xúc">
            {reactions.map((reaction) => (
              <button
                key={reaction.type}
                className={post.myReaction === reaction.type ? "active" : ""}
                type="button"
                disabled={reacting}
                title={reaction.label}
                onClick={() => handleReaction(reaction.type)}
              >
                <span aria-hidden="true">{reaction.icon}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          className="feed-action-button"
          type="button"
          onClick={handleToggleComments}
        >
          Bình luận
        </button>

        <button
          className="feed-action-button"
          type="button"
          onClick={handleToggleSharePanel}
        >
          Chia sẻ
        </button>

        <Link className="feed-action-button" to={`/posts/${post.id}`}>
          Chi tiết
        </Link>
      </div>

      {sharePanelOpen && (
        <form className="share-panel" onSubmit={handleShareSubmit}>
          <textarea
            value={shareContent}
            onChange={(event) => setShareContent(event.target.value)}
            placeholder="Viết gì đó khi chia sẻ..."
            maxLength={5000}
          />

          <div className="share-panel-footer">
            <select
              value={sharePrivacy}
              onChange={(event) => setSharePrivacy(event.target.value)}
            >
              <option value="public">Công khai</option>
              <option value="followers">Người theo dõi</option>
              <option value="friends">Bạn bè</option>
              <option value="only_me">Chỉ mình tôi</option>
            </select>

            <button
              className="button secondary"
              type="button"
              onClick={() => setSharePanelOpen(false)}
              disabled={shareSubmitting}
            >
              Hủy
            </button>

            <button className="button" type="submit" disabled={shareSubmitting}>
              {shareSubmitting ? "Đang chia sẻ..." : "Chia sẻ ngay"}
            </button>
          </div>
        </form>
      )}

      {user && (
        <form className="feed-comment-composer" onSubmit={handleCreateComment}>
          {user.avatarUrl ? (
            <img
              className="feed-comment-avatar"
              src={getFileUrl(user.avatarUrl)}
              alt={user.name}
            />
          ) : (
            <div className="feed-comment-avatar-placeholder">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}

          <input
            value={commentInput}
            onChange={(event) => setCommentInput(event.target.value)}
            placeholder="Viết bình luận..."
          />

          <button
            type="submit"
            disabled={!commentInput.trim() || commentSubmitting}
          >
            Gửi
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
      {notice && <p className="feed-notice">{notice}</p>}

      {commentsOpen && (
        <div className="feed-comments">
          {commentsLoading ? (
            <p className="muted">Đang tải bình luận...</p>
          ) : comments.length === 0 ? (
            <p className="muted">Chưa có bình luận nào.</p>
          ) : (
            comments.map((comment) => {
              const commentAvatarUrl = getFileUrl(comment.authorAvatarUrl);

              return (
                <div key={comment.id} className="feed-comment">
                  {commentAvatarUrl ? (
                    <img
                      className="feed-comment-avatar"
                      src={commentAvatarUrl}
                      alt={comment.authorName}
                    />
                  ) : (
                    <div className="feed-comment-avatar-placeholder">
                      {comment.authorName?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                  )}

                  <div className="feed-comment-body">
                    <strong>{comment.authorName}</strong>
                    <p>{comment.content}</p>
                    <span title={formatVietnamDateTime(comment.createdAt)}>
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </article>
  );
}
