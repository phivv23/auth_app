import { useEffect, useState } from "react";
import { Link } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  createComment,
  getFeedPosts,
  getPostComments,
  togglePostLike,
} from "../api/post.api.js";
import { useAuth } from "../context/useAuth.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const emptyCommentPanel = {
  comments: [],
  input: "",
  loading: false,
  loaded: false,
  submitting: false,
  error: "",
};

export default function Feed() {
  const { user } = useAuth();

  const [posts, setPosts] = useState([]);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [expandedComments, setExpandedComments] = useState({});
  const [commentPanels, setCommentPanels] = useState({});
  const [likingPostIds, setLikingPostIds] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const userAvatarUrl = getFileUrl(user?.avatarUrl);

  useEffect(() => {
    async function loadFeed() {
      try {
        setLoading(true);
        setError("");
        setActionError("");

        const data = await getFeedPosts({
          page,
          limit,
        });

        setPosts(data.posts || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadFeed();
  }, [page, limit]);

  function getCommentPanel(postId) {
    return commentPanels[postId] || emptyCommentPanel;
  }

  function updateCommentPanel(postId, patch) {
    setCommentPanels((currentPanels) => ({
      ...currentPanels,
      [postId]: {
        ...emptyCommentPanel,
        ...currentPanels[postId],
        ...patch,
      },
    }));
  }

  function updatePostInFeed(postId, updater) {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId ? updater(post) : post
      )
    );
  }

  async function loadComments(postId) {
    updateCommentPanel(postId, {
      loading: true,
      error: "",
    });

    try {
      const data = await getPostComments(postId);

      updateCommentPanel(postId, {
        comments: data.comments || [],
        loaded: true,
        loading: false,
      });
    } catch (error) {
      updateCommentPanel(postId, {
        error: error.message,
        loading: false,
      });
    }
  }

  function handleToggleComments(postId) {
    const shouldOpen = !expandedComments[postId];
    const panel = getCommentPanel(postId);

    setExpandedComments((currentExpanded) => ({
      ...currentExpanded,
      [postId]: shouldOpen,
    }));

    if (shouldOpen && !panel.loaded && !panel.loading) {
      loadComments(postId);
    }
  }

  async function handleToggleLike(postId) {
    setActionError("");
    setLikingPostIds((currentIds) => ({
      ...currentIds,
      [postId]: true,
    }));

    try {
      const data = await togglePostLike(postId);

      updatePostInFeed(postId, (post) => ({
        ...post,
        likedByMe: data.liked,
        likeCount: data.likeCount,
      }));
    } catch (error) {
      setActionError(error.message);
    } finally {
      setLikingPostIds((currentIds) => ({
        ...currentIds,
        [postId]: false,
      }));
    }
  }

  function handleCommentInput(postId, value) {
    updateCommentPanel(postId, {
      input: value,
      error: "",
    });
  }

  async function handleCreateComment(event, postId) {
    event.preventDefault();

    const panel = getCommentPanel(postId);
    const content = panel.input.trim();

    if (!content) {
      updateCommentPanel(postId, {
        error: "Comment không được để trống.",
      });
      return;
    }

    updateCommentPanel(postId, {
      submitting: true,
      error: "",
    });

    try {
      const data = await createComment(postId, content);
      let nextComments = [...panel.comments, data.comment];

      if (!panel.loaded) {
        const commentData = await getPostComments(postId);
        nextComments = commentData.comments || nextComments;
      }

      updateCommentPanel(postId, {
        comments: nextComments,
        input: "",
        loaded: true,
      });

      updatePostInFeed(postId, (post) => ({
        ...post,
        commentCount: Number(post.commentCount || 0) + 1,
      }));

      setExpandedComments((currentExpanded) => ({
        ...currentExpanded,
        [postId]: true,
      }));
    } catch (error) {
      updateCommentPanel(postId, {
        error: error.message,
      });
    } finally {
      updateCommentPanel(postId, {
        submitting: false,
      });
    }
  }

  return (
    <div className="feed-container">
      <section className="card">
        <div className="feed-header">
          <div>
            <h1>Feed</h1>
            <p>Bài viết của bạn và những người bạn đang follow.</p>
          </div>

          <Link className="button-link" to="/posts/create">
            Tạo bài viết
          </Link>
        </div>
      </section>

      {error ? (
        <p className="error">{error}</p>
      ) : loading ? (
        <p>Đang tải feed...</p>
      ) : posts.length === 0 ? (
        <section className="card">
          <p>Feed đang trống.</p>
          <p>Hãy follow người khác hoặc tạo bài viết đầu tiên của bạn.</p>
        </section>
      ) : (
        <div className="feed-list">
          {actionError && <p className="error">{actionError}</p>}

          {posts.map((post) => {
            const postImageUrl = getFileUrl(post.imageUrl);
            const authorAvatarUrl = getFileUrl(post.authorAvatarUrl);
            const panel = getCommentPanel(post.id);
            const commentsOpen = Boolean(expandedComments[post.id]);

            return (
              <article key={post.id} className="feed-card">
                <div className="feed-author">
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

                  <div>
                    <Link to={`/users/${post.userId}`}>
                      <strong>{post.authorName}</strong>
                    </Link>

                    <p
                      className="post-time"
                      title={formatVietnamDateTime(post.createdAt)}
                    >
                      {formatRelativeTime(post.createdAt)}
                    </p>
                  </div>
                </div>

                <h2>
                  <Link to={`/posts/${post.id}`}>{post.title}</Link>
                </h2>

                <p className="feed-post-content">{post.content}</p>

                {postImageUrl && (
                  <Link to={`/posts/${post.id}`}>
                    <img
                      className="feed-post-image"
                      src={postImageUrl}
                      alt={post.title}
                    />
                  </Link>
                )}

                <div className="post-meta feed-post-stats">
                  <span>{post.likeCount || 0} lượt thích</span>
                  <button
                    className="feed-stat-button"
                    type="button"
                    onClick={() => handleToggleComments(post.id)}
                  >
                    {post.commentCount || 0} bình luận
                  </button>
                </div>

                <div className="feed-action-bar">
                  <button
                    className={`feed-action-button ${
                      post.likedByMe ? "active" : ""
                    }`}
                    type="button"
                    disabled={Boolean(likingPostIds[post.id])}
                    onClick={() => handleToggleLike(post.id)}
                  >
                    {post.likedByMe ? "Đã thích" : "Thích"}
                  </button>

                  <button
                    className="feed-action-button"
                    type="button"
                    onClick={() => handleToggleComments(post.id)}
                  >
                    Bình luận
                  </button>

                  <Link className="feed-action-button" to={`/posts/${post.id}`}>
                    Chi tiết
                  </Link>
                </div>

                <form
                  className="feed-comment-composer"
                  onSubmit={(event) => handleCreateComment(event, post.id)}
                >
                  {userAvatarUrl ? (
                    <img
                      className="feed-comment-avatar"
                      src={userAvatarUrl}
                      alt={user?.name}
                    />
                  ) : (
                    <div className="feed-comment-avatar-placeholder">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                  )}

                  <input
                    value={panel.input}
                    onChange={(event) =>
                      handleCommentInput(post.id, event.target.value)
                    }
                    placeholder="Viết bình luận..."
                  />

                  <button
                    type="submit"
                    disabled={!panel.input.trim() || panel.submitting}
                  >
                    Gửi
                  </button>
                </form>

                {panel.error && <p className="error">{panel.error}</p>}

                {commentsOpen && (
                  <div className="feed-comments">
                    {panel.loading ? (
                      <p className="muted">Đang tải bình luận...</p>
                    ) : panel.comments.length === 0 ? (
                      <p className="muted">Chưa có bình luận nào.</p>
                    ) : (
                      panel.comments.map((comment) => {
                        const commentAvatarUrl = getFileUrl(
                          comment.authorAvatarUrl
                        );

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
                                {comment.authorName?.charAt(0)?.toUpperCase() ||
                                  "U"}
                              </div>
                            )}

                            <div className="feed-comment-body">
                              <strong>{comment.authorName}</strong>
                              <p>{comment.content}</p>
                              <span
                                title={formatVietnamDateTime(comment.createdAt)}
                              >
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
          })}
        </div>
      )}

      {!error && !loading && (
        <div className="pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((currentPage) => currentPage - 1)}
          >
            Trang trước
          </button>

          <span>
            Trang {page} / {totalPages} - Tổng {total} bài viết
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((currentPage) => currentPage + 1)}
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  );
}
