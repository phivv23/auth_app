import { useEffect, useRef, useState } from "react";

import { getVideoPosts } from "../api/post.api.js";
import { PostListSkeleton } from "../components/Skeleton.jsx";
import SocialPostCard from "../components/SocialPostCard.jsx";

export default function Watch() {
  const loadMoreRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(8);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [loadMoreError, setLoadMoreError] = useState("");
  const [notice, setNotice] = useState("");

  const hasMore = page < totalPages;
  const isFetching = loading || loadingMore;

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    async function loadVideos() {
      const isFirstPage = page === 1;

      try {
        if (isFirstPage) {
          setLoading(true);
          setError("");
        } else {
          setLoadingMore(true);
        }

        setLoadMoreError("");

        const data = await getVideoPosts({
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

          const currentIds = new Set(currentPosts.map((post) => post.id));

          return [
            ...currentPosts,
            ...nextPosts.filter((post) => !currentIds.has(post.id)),
          ];
        });
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        if (!isActive || error.name === "AbortError") {
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

    loadVideos();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [page, limit, loadAttempt]);

  useEffect(() => {
    const node = loadMoreRef.current;

    if (!node || !hasMore || isFetching || error || loadMoreError) {
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
  }, [error, hasMore, isFetching, loadMoreError, totalPages]);

  function refreshVideos() {
    setPage(1);
    setLoadMoreError("");
    setNotice("");
    setLoadAttempt((currentAttempt) => currentAttempt + 1);
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
    setNotice("Đã xóa video khỏi Watch.");
  }

  function handlePostShared(sharedPost) {
    if (sharedPost?.media?.some((item) => item.type === "video")) {
      setPosts((currentPosts) => [sharedPost, ...currentPosts]);
      setTotal((currentTotal) => currentTotal + 1);
    }
  }

  return (
    <div className="feed-container watch-page">
      <section className="watch-header">
        <div>
          <h1>Watch</h1>
          <p>Video mới nhất từ những bài viết bạn có quyền xem.</p>
        </div>

        <button
          className="button-link"
          type="button"
          disabled={isFetching}
          onClick={refreshVideos}
        >
          Làm mới
        </button>
      </section>

      {notice && <p className="feed-notice">{notice}</p>}

      {error ? (
        <p className="error">{error}</p>
      ) : loading ? (
        <PostListSkeleton count={3} />
      ) : posts.length === 0 ? (
        <section className="card">
          <p>Chưa có video nào để hiển thị.</p>
          <p>Hãy đăng bài viết có video để video xuất hiện ở Watch.</p>
        </section>
      ) : (
        <div className="feed-list">
          {posts.map((post) => (
            <SocialPostCard
              key={post.id}
              post={post}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
              onPostShared={handlePostShared}
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
              <button
                type="button"
                onClick={() => {
                  setLoadMoreError("");
                  setLoadAttempt((currentAttempt) => currentAttempt + 1);
                }}
              >
                Thử lại
              </button>
            </>
          ) : hasMore ? (
            <span>Kéo xuống để tải thêm video</span>
          ) : (
            <span>Đã hiển thị tất cả {total} video</span>
          )}
        </div>
      )}
    </div>
  );
}
