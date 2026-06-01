function SkeletonBlock({ className = "" }) {
  return <span className={`skeleton-block ${className}`.trim()} aria-hidden="true" />;
}

export function PostCardSkeleton({ compact = false }) {
  return (
    <article className={`skeleton-card post-card-skeleton ${compact ? "compact" : ""}`}>
      <div className="skeleton-row">
        <SkeletonBlock className="skeleton-avatar" />
        <div className="skeleton-stack">
          <SkeletonBlock className="skeleton-line medium" />
          <SkeletonBlock className="skeleton-line short" />
        </div>
      </div>

      <div className="skeleton-stack">
        <SkeletonBlock className="skeleton-line full" />
        <SkeletonBlock className="skeleton-line wide" />
        {!compact && <SkeletonBlock className="skeleton-line medium" />}
      </div>

      {!compact && <SkeletonBlock className="skeleton-media" />}

      <div className="skeleton-action-row">
        <SkeletonBlock className="skeleton-pill" />
        <SkeletonBlock className="skeleton-pill" />
        <SkeletonBlock className="skeleton-pill" />
      </div>
    </article>
  );
}

export function PostListSkeleton({ count = 3, compact = false, className = "feed-list" }) {
  return (
    <div className={`skeleton-list ${className}`} aria-label="Đang tải bài viết">
      {Array.from({ length: count }, (_, index) => (
        <PostCardSkeleton key={index} compact={compact} />
      ))}
    </div>
  );
}

export function CommentListSkeleton({ count = 3 }) {
  return (
    <div className="comment-skeleton-list" aria-label="Đang tải bình luận">
      {Array.from({ length: count }, (_, index) => (
        <div className="comment-skeleton" key={index}>
          <SkeletonBlock className="skeleton-avatar small" />
          <div className="skeleton-comment-bubble">
            <SkeletonBlock className="skeleton-line medium" />
            <SkeletonBlock className="skeleton-line wide" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="profile-page skeleton-profile" aria-label="Đang tải profile">
      <section className="profile-hero">
        <SkeletonBlock className="skeleton-cover" />
        <div className="profile-summary">
          <SkeletonBlock className="skeleton-avatar profile" />
          <div className="skeleton-stack">
            <SkeletonBlock className="skeleton-line title" />
            <SkeletonBlock className="skeleton-line wide" />
          </div>
          <div className="skeleton-action-row">
            <SkeletonBlock className="skeleton-pill" />
            <SkeletonBlock className="skeleton-pill" />
          </div>
        </div>
      </section>

      <div className="profile-content-grid">
        <aside className="profile-sidebar">
          <section className="profile-panel">
            <SkeletonBlock className="skeleton-line medium" />
            <SkeletonBlock className="skeleton-line full" />
            <SkeletonBlock className="skeleton-line wide" />
          </section>
        </aside>
        <section className="profile-timeline">
          <PostListSkeleton count={2} className="post-list profile-post-list" />
        </section>
      </div>
    </div>
  );
}

export function NotificationListSkeleton({ count = 6 }) {
  return (
    <div className="notification-list skeleton-notification-list" aria-label="Đang tải thông báo">
      {Array.from({ length: count }, (_, index) => (
        <div className="notification-item skeleton-notification" key={index}>
          <SkeletonBlock className="skeleton-avatar" />
          <div className="skeleton-stack">
            <SkeletonBlock className="skeleton-line wide" />
            <SkeletonBlock className="skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function UserListSkeleton({ count = 3 }) {
  return (
    <div className="user-list compact skeleton-user-list" aria-label="Đang tải gợi ý">
      {Array.from({ length: count }, (_, index) => (
        <div className="user-card skeleton-user-card" key={index}>
          <SkeletonBlock className="skeleton-avatar" />
          <div className="skeleton-stack">
            <SkeletonBlock className="skeleton-line medium" />
            <SkeletonBlock className="skeleton-line short" />
          </div>
          <SkeletonBlock className="skeleton-pill" />
        </div>
      ))}
    </div>
  );
}

export default SkeletonBlock;
