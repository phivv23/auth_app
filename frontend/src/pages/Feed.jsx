import { useEffect, useRef, useState } from "react";

import PostComposer from "../components/PostComposer.jsx";
import { PostListSkeleton } from "../components/Skeleton.jsx";
import SocialPostCard from "../components/SocialPostCard.jsx";
import SuggestedUsers from "../components/SuggestedUsers.jsx";
import StoryStrip from "../components/StoryStrip.jsx";
import { getFeedPosts } from "../api/post.api.js";
import { getPublicUserPosts } from "../api/user.api.js";

export default function Feed() {
  const loadMoreRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [loadMoreError, setLoadMoreError] = useState("");
  const [feedNotice, setFeedNotice] = useState("");

  const hasMore = page < totalPages;
  const isFetchingFeed = loading || loadingMore;

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    async function loadFeed() {
      const isFirstPage = page === 1;

      try {
        if (isFirstPage) {
          setLoading(true);
          setError("");
        } else {
          setLoadingMore(true);
        }

        setLoadMoreError("");

        const data = await getFeedPosts({
          page,
          limit,
          signal: controller.signal,
        });

        if (!isActive) {
          return;
        }

        const nextPosts = data.posts || [];

        setPosts((currentPosts) => {
          if (isFirstPage) {
            return nextPosts;
          }

          const existingPostIds = new Set(currentPosts.map((post) => post.id));

          return [
            ...currentPosts,
            ...nextPosts.filter((post) => !existingPostIds.has(post.id)),
          ];
        });
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isFirstPage) {
          setError(error.message);
        } else {
          setLoadMoreError(error.message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    loadFeed();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [page, limit, loadAttempt]);

  useEffect(() => {
    const node = loadMoreRef.current;

    if (!node || !hasMore || isFetchingFeed || error || loadMoreError) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          setPage((currentPage) =>
            currentPage < totalPages ? currentPage + 1 : currentPage
          );
        }
      },
      {
        rootMargin: "360px 0px",
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [error, hasMore, isFetchingFeed, loadMoreError, totalPages]);

  function refreshFeed() {
    setPage(1);
    setLoadMoreError("");
    setFeedNotice("");
    setLoadAttempt((currentAttempt) => currentAttempt + 1);
  }

  function handleRetryLoadMore() {
    setLoadMoreError("");
    setLoadAttempt((currentAttempt) => currentAttempt + 1);
  }

  function handlePostCreated(post) {
    setPosts((currentPosts) => [post, ...currentPosts]);
    setTotal((currentTotal) => currentTotal + 1);
    setFeedNotice("Đã đăng bài viết mới.");
  }

  function handlePostUpdated(updatedPost) {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === updatedPost.id ? updatedPost : post
      )
    );
  }

  function handlePostDeleted(postId) {
    setPosts((currentPosts) =>
      currentPosts.filter((post) => post.id !== postId)
    );
    setTotal((currentTotal) => Math.max(0, currentTotal - 1));
    setFeedNotice("Đã xóa bài viết.");
  }

  async function handleSuggestedUserFollowed(followedUser) {
    setFeedNotice(`Đã follow ${followedUser.name}.`);

    try {
      const data = await getPublicUserPosts(followedUser.id, {
        page: 1,
        limit: 5,
      });

      const followedPosts = (data.posts || []).map((post) => ({
        ...post,
        authorName: post.authorName || followedUser.name,
        authorAvatarUrl: post.authorAvatarUrl || followedUser.avatarUrl,
      }));

      if (followedPosts.length === 0) {
        return;
      }

      setPosts((currentPosts) => {
        const existingPostIds = new Set(currentPosts.map((post) => post.id));
        const uniqueFollowedPosts = followedPosts.filter(
          (post) => !existingPostIds.has(post.id)
        );

        return [...uniqueFollowedPosts, ...currentPosts].sort(
          (firstPost, secondPost) =>
            new Date(secondPost.createdAt).getTime() -
            new Date(firstPost.createdAt).getTime()
        );
      });

      setTotal((currentTotal) => currentTotal + followedPosts.length);
      setFeedNotice(
        `Đã thêm ${followedPosts.length} bài viết từ ${followedUser.name}.`
      );
    } catch {
      setFeedNotice(
        `Đã follow ${followedUser.name}. Bấm Làm mới Feed để cập nhật bài viết.`
      );
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

          <button
            className="button-link"
            type="button"
            disabled={isFetchingFeed}
            onClick={refreshFeed}
          >
            Làm mới Feed
          </button>
        </div>
      </section>

      <PostComposer onCreated={handlePostCreated} />

      <StoryStrip onNotice={setFeedNotice} />

      <div className="feed-toolbar">
        <span>Bài viết mới nhất</span>
        <button type="button" disabled={isFetchingFeed} onClick={refreshFeed}>
          Làm mới
        </button>
      </div>

      <SuggestedUsers limit={3} onFollowed={handleSuggestedUserFollowed} />

      {feedNotice && <p className="feed-notice">{feedNotice}</p>}

      {error ? (
        <p className="error">{error}</p>
      ) : loading ? (
        <PostListSkeleton count={3} />
      ) : posts.length === 0 ? (
        <section className="card">
          <p>Feed đang trống.</p>
          <p>Hãy follow người khác hoặc tạo bài viết đầu tiên của bạn.</p>
        </section>
      ) : (
        <div className="feed-list">
          {posts.map((post) => (
            <SocialPostCard
              key={post.id}
              post={post}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
              onPostShared={handlePostCreated}
            />
          ))}
        </div>
      )}

      {!error && !loading && posts.length > 0 && (
        <div ref={loadMoreRef} className="infinite-scroll-status">
          {loadingMore ? (
            <PostListSkeleton count={1} compact />
          ) : loadMoreError ? (
            <>
              <p className="error">{loadMoreError}</p>
              <button type="button" onClick={handleRetryLoadMore}>
                Thử lại
              </button>
            </>
          ) : hasMore ? (
            <span>Kéo xuống để tải thêm bài viết</span>
          ) : (
            <span>Đã hiển thị tất cả {total} bài viết</span>
          )}
        </div>
      )}
    </div>
  );
}
