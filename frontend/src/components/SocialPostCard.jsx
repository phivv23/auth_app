import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  createComment,
  deleteComment,
  deletePost,
  getPostComments,
  getPostReactions,
  sharePost,
  toggleCommentReaction,
  togglePostBookmark,
  togglePostLike,
  updateComment,
} from "../api/post.api.js";
import { getFileUrl } from "../api/client.js";
import MediaViewer from "./MediaViewer.jsx";
import ReportDialog from "./ReportDialog.jsx";
import { CommentListSkeleton } from "./Skeleton.jsx";
import { useAuth } from "../context/useAuth.js";
import { isVideoMedia } from "../utils/postMedia.js";
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

function renderMediaElement(
  item,
  { className = "", alt = "", controls = true } = {}
) {
  const mediaUrl = getFileUrl(item.url);

  if (isVideoMedia(item)) {
    return (
      <video
        className={className}
        src={mediaUrl}
        controls={controls}
        muted={!controls}
        playsInline
        preload="metadata"
      />
    );
  }

  return <img className={className} src={mediaUrl} alt={alt} />;
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

function getCommentReplies(comment) {
  return Array.isArray(comment?.replies) ? comment.replies : [];
}

function getThreadCommentCount(comment) {
  return 1 + getCommentReplies(comment).length;
}

function findCommentLocation(comments, commentId) {
  const targetId = Number(commentId);

  for (const comment of comments) {
    if (Number(comment.id) === targetId) {
      return {
        comment,
        parentId: null,
      };
    }

    const reply = getCommentReplies(comment).find(
      (item) => Number(item.id) === targetId
    );

    if (reply) {
      return {
        comment: reply,
        parentId: comment.id,
      };
    }
  }

  return null;
}

function updateCommentInTree(comments, commentId, updater) {
  const targetId = Number(commentId);

  return comments.map((comment) => {
    if (Number(comment.id) === targetId) {
      const updatedComment = updater(comment);

      return {
        ...updatedComment,
        replies: getCommentReplies(updatedComment).length
          ? getCommentReplies(updatedComment)
          : getCommentReplies(comment),
      };
    }

    let didUpdateReply = false;
    const nextReplies = getCommentReplies(comment).map((reply) => {
      if (Number(reply.id) !== targetId) {
        return reply;
      }

      didUpdateReply = true;

      return {
        ...updater(reply),
        replies: getCommentReplies(reply),
      };
    });

    if (!didUpdateReply) {
      return comment;
    }

    return {
      ...comment,
      replies: nextReplies,
      replyCount: Math.max(Number(comment.replyCount || 0), nextReplies.length),
    };
  });
}

function insertReplyIntoTree(comments, parentCommentId, reply) {
  const parentId = Number(parentCommentId);

  return comments.map((comment) => {
    if (Number(comment.id) !== parentId) {
      return comment;
    }

    const nextReplies = [...getCommentReplies(comment), { ...reply, replies: [] }];

    return {
      ...comment,
      replies: nextReplies,
      replyCount: Math.max(Number(comment.replyCount || 0) + 1, nextReplies.length),
    };
  });
}

function removeCommentFromTree(comments, commentId) {
  const targetId = Number(commentId);

  return comments.reduce((nextComments, comment) => {
    if (Number(comment.id) === targetId) {
      return nextComments;
    }

    const currentReplies = getCommentReplies(comment);
    const nextReplies = currentReplies.filter(
      (reply) => Number(reply.id) !== targetId
    );

    nextComments.push({
      ...comment,
      replies: nextReplies,
      replyCount:
        nextReplies.length === currentReplies.length
          ? Number(comment.replyCount || nextReplies.length)
          : Math.max(0, Number(comment.replyCount || currentReplies.length) - 1),
    });

    return nextComments;
  }, []);
}

export default function SocialPostCard({
  post,
  onPostUpdated,
  onPostDeleted,
  onPostShared,
  defaultCommentsOpen = false,
  highlightCommentId = null,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const highlightedCommentRef = useRef(null);
  const commentsRequestRef = useRef(null);
  const reactionsRequestRef = useRef(null);

  const [commentsOpen, setCommentsOpen] = useState(defaultCommentsOpen);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [commentEditInput, setCommentEditInput] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [commentActionError, setCommentActionError] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState(null);
  const [replyInputs, setReplyInputs] = useState({});
  const [replySubmittingId, setReplySubmittingId] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [reactingCommentId, setReactingCommentId] = useState(null);
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
  const [bookmarking, setBookmarking] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
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
  const { isEdited, displayTime } = getEditedState(post);
  const shareAuthorAvatarUrl = getFileUrl(user?.avatarUrl);
  const shareContentLength = shareContent.length;
  const canSubmitShare = !shareSubmitting && shareContentLength <= 5000;

  useEffect(() => {
    if (defaultCommentsOpen) {
      loadComments();
    }
    // loadComments reads local loading flags; post id is the important reset key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCommentsOpen, post.id]);

  useEffect(() => {
    return () => {
      commentsRequestRef.current?.abort();
      reactionsRequestRef.current?.abort();
      commentsRequestRef.current = null;
      reactionsRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!highlightCommentId || !commentsLoaded || commentsLoading) {
      return;
    }

    const highlightedLocation = findCommentLocation(comments, highlightCommentId);

    if (!highlightedLocation) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      highlightedCommentRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    comments,
    commentsLoaded,
    commentsLoading,
    highlightCommentId,
  ]);

  async function loadComments() {
    if (commentsLoaded || commentsLoading) {
      return;
    }

    commentsRequestRef.current?.abort();
    const controller = new AbortController();
    commentsRequestRef.current = controller;

    try {
      setCommentsLoading(true);
      setError("");

      const data = await getPostComments(post.id, {
        signal: controller.signal,
      });
      setComments(data.comments || []);
      setCommentsLoaded(true);
    } catch (error) {
      if (error.name !== "AbortError") {
        setError(error.message);
      }
    } finally {
      if (commentsRequestRef.current === controller) {
        setCommentsLoading(false);
        commentsRequestRef.current = null;
      }
    }
  }

  async function loadReactions(nextFilter = reactionFilter) {
    reactionsRequestRef.current?.abort();
    const controller = new AbortController();
    reactionsRequestRef.current = controller;

    try {
      setReactionsLoading(true);
      setReactionsError("");

      const data = await getPostReactions(post.id, {
        limit: 50,
        reactionType: nextFilter,
        signal: controller.signal,
      });

      setReactionUsers(data.users || []);
      setReactionSummary(data.summary || {});
    } catch (error) {
      if (error.name !== "AbortError") {
        setReactionsError(error.message);
      }
    } finally {
      if (reactionsRequestRef.current === controller) {
        setReactionsLoading(false);
        reactionsRequestRef.current = null;
      }
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
      setCommentActionError("");
      setNotice("");

      const data = await createComment(post.id, content);
      const createdComment = {
        ...data.comment,
        replies: getCommentReplies(data.comment),
      };

      setComments((currentComments) => [...currentComments, createdComment]);
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

  function handleStartReply(comment, parentComment = null) {
    if (!user) {
      navigate("/login");
      return;
    }

    const parentId = parentComment?.id || comment.id;

    setReplyingToCommentId(parentId);
    setExpandedReplies((currentExpandedReplies) => ({
      ...currentExpandedReplies,
      [parentId]: true,
    }));
    setCommentActionError("");
    setError("");
    setNotice("");
  }

  function handleCancelReply(parentCommentId) {
    if (replySubmittingId) {
      return;
    }

    setReplyingToCommentId(null);
    setReplyInputs((currentInputs) => ({
      ...currentInputs,
      [parentCommentId]: "",
    }));
  }

  async function handleCreateReply(event, parentComment) {
    event.preventDefault();

    if (!user) {
      navigate("/login");
      return;
    }

    const parentCommentId = parentComment.id;
    const content = String(replyInputs[parentCommentId] || "").trim();

    if (!content || replySubmittingId) {
      return;
    }

    try {
      setReplySubmittingId(parentCommentId);
      setError("");
      setCommentActionError("");
      setNotice("");

      const data = await createComment(post.id, content, {
        parentCommentId,
      });
      const reply = {
        ...data.comment,
        replies: [],
      };

      setComments((currentComments) =>
        insertReplyIntoTree(currentComments, parentCommentId, reply)
      );
      setReplyInputs((currentInputs) => ({
        ...currentInputs,
        [parentCommentId]: "",
      }));
      setReplyingToCommentId(null);
      setExpandedReplies((currentExpandedReplies) => ({
        ...currentExpandedReplies,
        [parentCommentId]: true,
      }));

      onPostUpdated?.({
        ...post,
        commentCount: Number(post.commentCount || 0) + 1,
      });
    } catch (error) {
      setCommentActionError(error.message);
    } finally {
      setReplySubmittingId(null);
    }
  }

  function handleStartEditComment(comment) {
    setEditingCommentId(comment.id);
    setCommentEditInput(comment.content || "");
    setCommentActionError("");
    setError("");
    setNotice("");
  }

  function handleCancelEditComment() {
    if (commentSaving) {
      return;
    }

    setEditingCommentId(null);
    setCommentEditInput("");
    setCommentActionError("");
  }

  async function handleUpdateComment(event, comment) {
    event.preventDefault();

    if (!user) {
      navigate("/login");
      return;
    }

    const nextContent = commentEditInput.trim();
    const currentContent = String(comment.content || "").trim();

    if (!nextContent || nextContent === currentContent || commentSaving) {
      return;
    }

    try {
      setCommentSaving(true);
      setError("");
      setCommentActionError("");
      setNotice("");

      const data = await updateComment(comment.id, nextContent);
      const updatedComment = data.comment || {
        ...comment,
        content: nextContent,
        updatedAt: new Date().toISOString(),
      };

      setComments((currentComments) =>
        updateCommentInTree(currentComments, comment.id, (currentComment) => ({
          ...currentComment,
          ...updatedComment,
          replies: getCommentReplies(currentComment),
        }))
      );
      setEditingCommentId(null);
      setCommentEditInput("");
      setNotice("Đã cập nhật bình luận.");
    } catch (error) {
      setCommentActionError(error.message);
    } finally {
      setCommentSaving(false);
    }
  }

  async function handleDeleteComment(comment) {
    if (!user) {
      navigate("/login");
      return;
    }

    if (deletingCommentId) {
      return;
    }

    const confirmed = window.confirm("Bạn chắc chắn muốn xóa bình luận này?");

    if (!confirmed) {
      return;
    }

    try {
      setDeletingCommentId(comment.id);
      setError("");
      setCommentActionError("");
      setNotice("");

      const data = await deleteComment(comment.id);

      setComments((currentComments) =>
        removeCommentFromTree(currentComments, comment.id)
      );

      if (editingCommentId === comment.id) {
        setEditingCommentId(null);
        setCommentEditInput("");
      }

      if (
        replyingToCommentId === comment.id ||
        getCommentReplies(comment).some(
          (reply) => Number(reply.id) === Number(replyingToCommentId)
        )
      ) {
        setReplyingToCommentId(null);
      }

      const deletedCount = Number(data.deletedCount || getThreadCommentCount(comment));

      onPostUpdated?.({
        ...post,
        commentCount: Math.max(
          0,
          Number(post.commentCount || comments.length || 0) - deletedCount
        ),
      });
      setNotice("Đã xóa bình luận.");
    } catch (error) {
      setCommentActionError(error.message);
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function handleCommentReaction(comment, reactionType) {
    if (!user) {
      navigate("/login");
      return;
    }

    if (reactingCommentId) {
      return;
    }

    try {
      setReactingCommentId(comment.id);
      setError("");
      setCommentActionError("");
      setNotice("");

      const data = await toggleCommentReaction(comment.id, reactionType);

      setComments((currentComments) =>
        updateCommentInTree(currentComments, comment.id, (currentComment) => ({
          ...currentComment,
          myReaction: data.reactionType,
          likeCount: data.likeCount,
          reactionSummary: data.reactionSummary || {},
        }))
      );
    } catch (error) {
      setCommentActionError(error.message);
    } finally {
      setReactingCommentId(null);
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

  function handleCloseSharePanel() {
    if (shareSubmitting) {
      return;
    }

    setSharePanelOpen(false);
    setError("");
  }

  async function handleShareSubmit(event) {
    event.preventDefault();

    if (!user) {
      navigate("/login");
      return;
    }

    if (!canSubmitShare) {
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

  async function handleToggleBookmark() {
    if (!user) {
      navigate("/login");
      return;
    }

    try {
      setBookmarking(true);
      setError("");
      setNotice("");

      const data = await togglePostBookmark(post.id);

      onPostUpdated?.({
        ...post,
        bookmarkedByMe: data.bookmarked,
        bookmarkCount: data.bookmarkCount,
      });

      setNotice(data.bookmarked ? "Đã lưu bài viết." : "Đã bỏ lưu bài viết.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBookmarking(false);
    }
  }

  function handleOpenMediaViewer(index) {
    setMediaViewerIndex(index);
  }

  function handleCloseMediaViewer() {
    setMediaViewerIndex(null);
  }

  function renderComment(comment, { parentComment = null } = {}) {
    const commentAvatarUrl = getFileUrl(comment.authorAvatarUrl);
    const { isEdited: isCommentEdited } = getEditedState(comment);
    const isOwnComment = user && Number(user.id) === Number(comment.userId);
    const isEditingComment = editingCommentId === comment.id;
    const isDeletingComment = deletingCommentId === comment.id;
    const isReply = Boolean(parentComment);
    const isHighlighted = Number(comment.id) === Number(highlightCommentId);
    const replies = getCommentReplies(comment);
    const replyCount = Math.max(Number(comment.replyCount || 0), replies.length);
    const repliesExpanded =
      Boolean(expandedReplies[comment.id]) ||
      replies.some((reply) => Number(reply.id) === Number(highlightCommentId));
    const isReplyComposerOpen = replyingToCommentId === comment.id;
    const replyInput = replyInputs[comment.id] || "";
    const isSubmittingReply = replySubmittingId === comment.id;
    const trimmedEditInput = commentEditInput.trim();
    const originalCommentContent = String(comment.content || "").trim();
    const canSaveComment =
      !commentSaving &&
      trimmedEditInput.length > 0 &&
      trimmedEditInput !== originalCommentContent;
    const commentReactionSummary = comment.reactionSummary || {};
    const commentReactionTotal = getReactionTotal(
      commentReactionSummary,
      comment.likeCount
    );
    const commentTopReactions = getTopReactions(
      commentReactionSummary,
      comment.myReaction,
      comment.likeCount
    );
    const commentReactionMeta = getReactionMeta(comment.myReaction || "like");
    const isReactingComment = reactingCommentId === comment.id;

    return (
      <div
        key={comment.id}
        className={isReply ? "comment-thread reply-thread" : "comment-thread"}
      >
        <div
          ref={isHighlighted ? highlightedCommentRef : null}
          className={[
            "feed-comment",
            isReply ? "reply" : "",
            isHighlighted ? "highlighted" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          id={`comment-${comment.id}`}
        >
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

          <div className="feed-comment-content">
            <div className="feed-comment-body">
              <strong>{comment.authorName}</strong>

              {isEditingComment ? (
                <form
                  className="comment-edit-form"
                  onSubmit={(event) => handleUpdateComment(event, comment)}
                >
                  <textarea
                    value={commentEditInput}
                    onChange={(event) => setCommentEditInput(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    disabled={commentSaving}
                    autoFocus
                  />

                  <div className="comment-edit-actions">
                    <button
                      className="comment-edit-save"
                      type="submit"
                      disabled={!canSaveComment}
                    >
                      {commentSaving ? "Đang lưu..." : "Lưu"}
                    </button>

                    <button
                      className="comment-edit-cancel"
                      type="button"
                      onClick={handleCancelEditComment}
                      disabled={commentSaving}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <p>{comment.content}</p>
              )}

              <div className="comment-meta-row">
                <span title={formatVietnamDateTime(comment.createdAt)}>
                  {formatRelativeTime(comment.createdAt)}
                  {isCommentEdited && (
                    <strong className="comment-edited-badge">Đã chỉnh sửa</strong>
                  )}
                </span>

                {commentReactionTotal > 0 && (
                  <span className="comment-reaction-summary">
                    {commentTopReactions.map((reaction) => (
                      <span key={reaction.type} aria-hidden="true">
                        {reaction.icon}
                      </span>
                    ))}
                    {commentReactionTotal}
                  </span>
                )}
              </div>
            </div>

            {!isEditingComment && (
              <div className="comment-action-row">
                <div className="comment-reaction-wrap">
                  <button
                    className={`comment-action-button ${
                      comment.myReaction ? "active" : ""
                    }`}
                    type="button"
                    disabled={isReactingComment}
                    onClick={() =>
                      handleCommentReaction(comment, comment.myReaction || "like")
                    }
                  >
                    {comment.myReaction ? commentReactionMeta.label : "Thích"}
                  </button>

                  <div
                    className="comment-reaction-picker"
                    role="menu"
                    aria-label="Chọn cảm xúc cho bình luận"
                  >
                    {reactions.map((reaction) => (
                      <button
                        key={reaction.type}
                        className={
                          comment.myReaction === reaction.type ? "active" : ""
                        }
                        type="button"
                        disabled={isReactingComment}
                        title={reaction.label}
                        onClick={() => handleCommentReaction(comment, reaction.type)}
                      >
                        <span aria-hidden="true">{reaction.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="comment-action-button"
                  type="button"
                  onClick={() => handleStartReply(comment, parentComment)}
                >
                  Trả lời
                </button>

                {isOwnComment ? (
                  <>
                    <button
                      className="comment-action-button"
                      type="button"
                      onClick={() => handleStartEditComment(comment)}
                      disabled={commentSaving || isDeletingComment}
                    >
                      Sửa
                    </button>

                    <button
                      className="comment-action-button danger"
                      type="button"
                      onClick={() => handleDeleteComment(comment)}
                      disabled={commentSaving || isDeletingComment}
                    >
                      {isDeletingComment ? "Đang xóa..." : "Xóa"}
                    </button>
                  </>
                ) : (
                  user && (
                    <button
                      className="comment-report-button"
                      type="button"
                      onClick={() =>
                        setReportTarget({
                          type: "comment",
                          id: comment.id,
                          title: "Báo cáo bình luận",
                        })
                      }
                    >
                      Báo cáo
                    </button>
                  )
                )}

                <Link
                  className="comment-action-button comment-permalink"
                  to={`/posts/${post.id}?commentId=${comment.id}`}
                >
                  Liên kết
                </Link>
              </div>
            )}
          </div>
        </div>

        {!isReply && replyCount > 0 && (
          <button
            className="comment-replies-toggle"
            type="button"
            onClick={() =>
              setExpandedReplies((currentExpandedReplies) => ({
                ...currentExpandedReplies,
                [comment.id]: !currentExpandedReplies[comment.id],
              }))
            }
          >
            {repliesExpanded ? "Ẩn phản hồi" : `Xem ${replyCount} phản hồi`}
          </button>
        )}

        {!isReply && repliesExpanded && replies.length > 0 && (
          <div className="comment-replies">
            {replies.map((reply) =>
              renderComment(reply, {
                parentComment: comment,
              })
            )}
          </div>
        )}

        {!isReply && isReplyComposerOpen && (
          <form
            className="comment-reply-form"
            onSubmit={(event) => handleCreateReply(event, comment)}
          >
            {user?.avatarUrl ? (
              <img
                className="feed-comment-avatar"
                src={getFileUrl(user.avatarUrl)}
                alt={user.name}
              />
            ) : (
              <div className="feed-comment-avatar-placeholder">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}

            <input
              value={replyInput}
              onChange={(event) =>
                setReplyInputs((currentInputs) => ({
                  ...currentInputs,
                  [comment.id]: event.target.value,
                }))
              }
              placeholder="Viết phản hồi..."
              maxLength={1000}
              autoFocus
            />

            <button
              type="submit"
              disabled={!replyInput.trim() || isSubmittingReply}
            >
              {isSubmittingReply ? "Đang gửi..." : "Gửi"}
            </button>

            <button
              className="comment-reply-cancel"
              type="button"
              onClick={() => handleCancelReply(comment.id)}
              disabled={isSubmittingReply}
            >
              Hủy
            </button>
          </form>
        )}
      </div>
    );
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
          <span title={formatVietnamDateTime(displayTime)}>
            {formatRelativeTime(displayTime)}{" "}
            {isEdited && (
              <strong className="post-edited-badge">Đã chỉnh sửa</strong>
            )}{" "}
            · {privacyLabels[post.privacy] || "Công khai"}
          </span>
        </div>

        {user && (
          <div className="social-post-menu">
            {isAuthor ? (
              <>
                <Link to={`/posts/${post.id}/edit`}>Sửa</Link>
                <button type="button" onClick={handleDeletePost}>
                  Xóa
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setReportTarget({
                    type: "post",
                    id: post.id,
                    title: "Báo cáo bài viết",
                  })
                }
              >
                Báo cáo
              </button>
            )}
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
            const extraCount = media.length - 4;
            const mediaContent = renderMediaElement(item, {
              alt: post.title || "Media bài viết",
            });
            const extraBadge = index === 3 && extraCount > 0 && (
              <span className="media-extra-count">+{extraCount}</span>
            );

            if (isVideoMedia(item)) {
              return (
                <div
                  key={`${item.url}-${index}`}
                  className="social-media-item video"
                >
                  {mediaContent}
                  {extraBadge}
                  <button
                    className="media-viewer-open-button"
                    type="button"
                    onClick={() => handleOpenMediaViewer(index)}
                  >
                    Phóng to
                  </button>
                </div>
              );
            }

            return (
              <button
                key={`${item.url}-${index}`}
                className="social-media-item media-button"
                type="button"
                onClick={() => handleOpenMediaViewer(index)}
              >
                {mediaContent}
                {extraBadge}
              </button>
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
              renderMediaElement(sharedMedia[0], {
                className: "shared-post-image",
                alt: sharedPost.title || "Media bài viết được chia sẻ",
                controls: false,
              })
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
        <span>{post.bookmarkCount || 0} lượt lưu</span>
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

        <button
          className={`feed-action-button ${post.bookmarkedByMe ? "active" : ""}`}
          type="button"
          disabled={bookmarking}
          onClick={handleToggleBookmark}
        >
          {post.bookmarkedByMe ? "Đã lưu" : "Lưu"}
        </button>

        <Link className="feed-action-button" to={`/posts/${post.id}`}>
          Chi tiết
        </Link>
      </div>

      {sharePanelOpen && (
        <form className="share-panel" onSubmit={handleShareSubmit}>
          <div className="share-panel-header">
            {shareAuthorAvatarUrl ? (
              <img
                className="share-panel-avatar"
                src={shareAuthorAvatarUrl}
                alt={user?.name}
              />
            ) : (
              <div className="share-panel-avatar-placeholder">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}

            <div className="share-panel-author">
              <strong>{user?.name || "Tài khoản của bạn"}</strong>
              <select
                value={sharePrivacy}
                onChange={(event) => setSharePrivacy(event.target.value)}
                aria-label="Quyền xem bài chia sẻ"
              >
                <option value="public">Công khai</option>
                <option value="followers">Người theo dõi</option>
                <option value="friends">Bạn bè</option>
                <option value="only_me">Chỉ mình tôi</option>
              </select>
            </div>
          </div>

          <textarea
            value={shareContent}
            onChange={(event) => setShareContent(event.target.value)}
            placeholder="Viết gì đó về bài viết này..."
            maxLength={5000}
          />

          <div className="share-target-preview" aria-label="Bài viết được chia sẻ">
            <div className="share-target-author">
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

            {post.title && <h3>{post.title}</h3>}
            {post.content && <p>{post.content}</p>}

            {media[0] && (
              renderMediaElement(media[0], {
                className: "share-target-image",
                alt: post.title || "Media bài viết được chia sẻ",
                controls: false,
              })
            )}
          </div>

          <div className="share-panel-footer">
            <span className="share-character-count">
              {shareContentLength}/5000
            </span>
            <button
              className="button secondary"
              type="button"
              onClick={handleCloseSharePanel}
              disabled={shareSubmitting}
            >
              Hủy
            </button>

            <button className="button" type="submit" disabled={!canSubmitShare}>
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
          {commentActionError && <p className="error">{commentActionError}</p>}

          {commentsLoading ? (
            <CommentListSkeleton count={3} />
          ) : comments.length === 0 ? (
            <p className="muted">Chưa có bình luận nào.</p>
          ) : (
            comments.map((comment) => renderComment(comment))
          )}
        </div>
      )}

      {mediaViewerIndex !== null && (
        <MediaViewer
          media={media}
          initialIndex={mediaViewerIndex}
          title={post.title || "Media bài viết"}
          authorName={post.authorName}
          postUrl={`/posts/${post.id}`}
          onClose={handleCloseMediaViewer}
        />
      )}

      <ReportDialog
        open={Boolean(reportTarget)}
        targetType={reportTarget?.type}
        targetId={reportTarget?.id}
        title={reportTarget?.title || "Báo cáo nội dung"}
        onClose={() => setReportTarget(null)}
        onReported={() => setNotice("Đã gửi báo cáo.")}
      />
    </article>
  );
}
