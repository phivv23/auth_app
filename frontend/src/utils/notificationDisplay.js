const reportStatusLabels = {
  pending: "đang chờ xử lý",
  reviewing: "đang được xem xét",
  resolved: "đã được xử lý",
  dismissed: "đã được giữ lại",
};

const accountStatusLabels = {
  active: "đã được mở lại",
  suspended: "đã bị tạm khóa",
  banned: "đã bị cấm đăng nhập",
};

const reportTargetLabels = {
  user: "người dùng",
  post: "bài viết",
  comment: "bình luận",
  message: "tin nhắn",
  story: "story",
};

export function getNotificationText(notification) {
  const actorName = notification.actorName || "Một người dùng";

  if (notification.type === "follow") {
    return `${actorName} đã follow bạn`;
  }

  if (notification.type === "friend_request") {
    return `${actorName} đã gửi lời mời kết bạn`;
  }

  if (notification.type === "friend_accept") {
    return `${actorName} đã chấp nhận lời mời kết bạn`;
  }

  if (notification.type === "post_like") {
    return `${actorName} đã thích bài viết "${notification.postTitle || ""}"`;
  }

  if (notification.type === "post_comment") {
    return notification.metadata?.isReply
      ? `${actorName} đã trả lời bình luận của bạn`
      : `${actorName} đã bình luận bài viết "${notification.postTitle || ""}"`;
  }

  if (notification.type === "comment_reaction") {
    return `${actorName} đã bày tỏ cảm xúc với bình luận của bạn`;
  }

  if (notification.type === "message") {
    return `${actorName} đã nhắn tin cho bạn`;
  }

  if (notification.type === "story_reply") {
    const content = notification.metadata?.content;

    return content
      ? `${actorName} đã trả lời story của bạn: ${content}`
      : `${actorName} đã trả lời story của bạn`;
  }

  if (notification.type === "story_reaction") {
    const reaction = notification.metadata?.reaction || "cảm xúc";

    return `${actorName} đã thả ${reaction} vào story của bạn`;
  }

  if (notification.type === "shared_moment_invite") {
    const title = notification.metadata?.title || "Khoảnh khắc chung";

    return `${actorName} đã mời bạn vào "${title}"`;
  }

  if (notification.type === "shared_moment_accept") {
    const title = notification.metadata?.title || "Khoảnh khắc chung";

    return `${actorName} đã tham gia "${title}"`;
  }

  if (notification.type === "report_status_update") {
    return `Báo cáo của bạn ${
      reportStatusLabels[notification.reportStatus] || "đã được cập nhật"
    }`;
  }

  if (notification.type === "admin_report_created") {
    const targetType =
      reportTargetLabels[notification.metadata?.targetType] || "nội dung";

    return `${actorName} đã gửi báo cáo mới về ${targetType}`;
  }

  if (notification.type === "admin_content_removed") {
    const contentType =
      notification.metadata?.contentType === "comment" ? "bình luận" : "bài viết";
    const reason = notification.metadata?.reason || "vi phạm quy định";

    return `${actorName} đã gỡ ${contentType} của bạn: ${reason}`;
  }

  if (notification.type === "admin_account_status_update") {
    const statusText =
      accountStatusLabels[notification.metadata?.accountStatus] ||
      "đã được cập nhật";
    const reason = notification.metadata?.reason;

    return reason
      ? `Tài khoản của bạn ${statusText}: ${reason}`
      : `Tài khoản của bạn ${statusText}`;
  }

  return "Bạn có thông báo mới";
}

export function getNotificationTarget(notification) {
  if (notification.type === "follow") {
    return `/users/${notification.actorId}`;
  }

  if (notification.type === "friend_request") {
    return "/friends?tab=incoming";
  }

  if (notification.type === "friend_accept") {
    return `/users/${notification.actorId}`;
  }

  if (notification.type === "message" && notification.conversationId) {
    return `/messages?conversationId=${notification.conversationId}`;
  }

  if (
    (notification.type === "story_reply" ||
      notification.type === "story_reaction") &&
    notification.metadata?.storyId
  ) {
    return `/stories/${notification.metadata.storyId}`;
  }

  if (
    (notification.type === "shared_moment_invite" ||
      notification.type === "shared_moment_accept") &&
    notification.metadata?.momentId
  ) {
    return `/moments?momentId=${notification.metadata.momentId}`;
  }

  if (notification.type === "report_status_update") {
    return notification.reportId
      ? `/reports?reportId=${notification.reportId}`
      : "/reports";
  }

  if (notification.type === "admin_report_created") {
    return notification.reportId
      ? `/admin/reports?reportId=${notification.reportId}`
      : "/admin/reports";
  }

  if (notification.postId) {
    return notification.commentId
      ? `/posts/${notification.postId}?commentId=${notification.commentId}`
      : `/posts/${notification.postId}`;
  }

  return "/notifications";
}
