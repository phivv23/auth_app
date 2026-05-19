import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  createComment,
  deleteComment,
  deletePost,
  getPostById,
  getPostComments,
  togglePostLike,
  updateComment,
} from "../api/post.api.js";
import { useAuth } from "../context/useAuth.js";

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const postId = Number(id);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);

  const [commentContent, setCommentContent] = useState("");

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");

  useEffect(() => {
    let isActive = true;

    Promise.all([getPostById(postId), getPostComments(postId)])
      .then(([postData, commentData]) => {
        if (isActive) {
          setPost(postData.post);
          setComments(commentData.comments);
        }
      })
      .catch((error) => {
        if (isActive) {
          setError(error.message);
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [postId]);

  async function handleDeletePost() {
    const confirmed = window.confirm("Bạn chắc chắn muốn xóa bài viết này?");

    if (!confirmed) {
      return;
    }

    try {
      await deletePost(post.id);
      navigate("/posts");
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleToggleLike() {
    if (!user) {
      navigate("/login");
      return;
    }

    try {
      const data = await togglePostLike(post.id);

      setPost((currentPost) => ({
        ...currentPost,
        likedByMe: data.liked,
        likeCount: data.likeCount,
      }));
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleCreateComment(event) {
    event.preventDefault();

    if (!user) {
      navigate("/login");
      return;
    }

    setCommentError("");

    try {
      const data = await createComment(post.id, commentContent);

      setComments((currentComments) => [...currentComments, data.comment]);

      setCommentContent("");

      setPost((currentPost) => ({
        ...currentPost,
        commentCount: Number(currentPost.commentCount) + 1,
      }));
    } catch (error) {
      setCommentError(error.message);
    }
  }

  async function handleDeleteComment(commentId) {
    const confirmed = window.confirm("Bạn chắc chắn muốn xóa comment này?");

    if (!confirmed) {
      return;
    }

    try {
      await deleteComment(commentId);

      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== commentId)
      );

      setPost((currentPost) => ({
        ...currentPost,
        commentCount: Number(currentPost.commentCount) - 1,
      }));
    } catch (error) {
      setCommentError(error.message);
    }
  }
  function startEditComment(comment) {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content);
    setCommentError("");
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingCommentContent("");
    setCommentError("");
  }

  async function handleUpdateComment(commentId) {
    setCommentError("");

    try {
      const data = await updateComment(commentId, editingCommentContent);

      setComments((currentComments) =>
        currentComments.map((comment) =>
          comment.id === commentId ? data.comment : comment
        )
      );

      setEditingCommentId(null);
      setEditingCommentContent("");
    } catch (error) {
      setCommentError(error.message);
    }
  }

  if (loading) {
    return <p>Đang tải bài viết...</p>;
  }

  if (error) {
    return (
      <section className="card">
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!post) {
    return (
      <section className="card">
        <p>Không tìm thấy bài viết.</p>
      </section>
    );
  }

  const isAuthor = user && user.id === post.userId;

  return (
    <section className="card">
      <article>
        <h1>{post.title}</h1>

        <p className="muted">
          Tác giả:{" "}
          <Link to={`/users/${post.userId}`}>
            {post.authorName}
          </Link>{" "}
          · Likes: {post.likeCount} · Comments: {post.commentCount}
        </p>

        <p className="post-content">{post.content}</p>

        <div className="actions">
          <button className="button secondary" onClick={handleToggleLike}>
            {post.likedByMe ? "Unlike" : "Like"} ({post.likeCount})
          </button>

          {isAuthor && (
            <>
              <Link className="button" to={`/posts/${post.id}/edit`}>
                Sửa
              </Link>

              <button className="button danger" onClick={handleDeletePost}>
                Xóa
              </button>
            </>
          )}
        </div>
      </article>

      <hr />

      <section>
        <h2>Comments</h2>

        {user ? (
          <form onSubmit={handleCreateComment} className="form">
            <label>
              Viết comment
              <textarea
                value={commentContent}
                onChange={(event) => setCommentContent(event.target.value)}
                placeholder="Nhập comment..."
                rows={4}
              />
            </label>

            {commentError && <p className="error">{commentError}</p>}

            <button className="button">Gửi comment</button>
          </form>
        ) : (
          <p>
            Bạn cần <Link to="/login">login</Link> để comment.
          </p>
        )}

        <div className="comment-list">
          {comments.length === 0 ? (
            <p>Chưa có comment nào.</p>
          ) : (
            comments.map((comment) => {
              const isCommentAuthor = user && user.id === comment.userId;

              return (
                <div key={comment.id} className="comment-card">
                  {editingCommentId === comment.id ? (
                    <>
                      <textarea
                        value={editingCommentContent}
                        onChange={(event) => setEditingCommentContent(event.target.value)}
                        rows={4}
                      />

                      <div className="actions">
                        <button
                          className="button"
                          onClick={() => handleUpdateComment(comment.id)}
                        >
                          Lưu
                        </button>

                        <button className="button secondary" onClick={cancelEditComment}>
                          Hủy
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>{comment.content}</p>

                      <p className="muted">Bởi {comment.authorName}</p>

                      {isCommentAuthor && (
                        <div className="actions">
                          <button
                            className="button secondary"
                            onClick={() => startEditComment(comment)}
                          >
                            Sửa comment
                          </button>

                          <button
                            className="button danger"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            Xóa comment
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </section>
  );
}
