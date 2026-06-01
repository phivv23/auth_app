import { useEffect, useState } from "react";

import { getBookmarkedPosts } from "../api/post.api.js";
import { PostListSkeleton } from "../components/Skeleton.jsx";
import SocialPostCard from "../components/SocialPostCard.jsx";

export default function SavedPosts() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    async function loadSavedPosts() {
      try {
        setLoading(true);
        setError("");

        const data = await getBookmarkedPosts({
          page,
          limit,
          signal: controller.signal,
        });

        if (!isActive) {
          return;
        }

        setPosts(data.posts || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        if (isActive) {
          setError(error.message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadSavedPosts();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [page, limit]);

  function handlePostUpdated(updatedPost) {
    if (!updatedPost.bookmarkedByMe) {
      setPosts((currentPosts) =>
        currentPosts.filter((post) => post.id !== updatedPost.id)
      );
      setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      return;
    }

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
  }

  function goToPage(nextPage) {
    setPage(nextPage);
  }

  return (
    <div className="feed-container">
      <section className="card">
        <div className="page-header">
          <div>
            <h1>Đã lưu</h1>
            <p>Các bài viết bạn đã lưu để xem lại sau.</p>
          </div>
        </div>
      </section>

      {error ? (
        <p className="error">{error}</p>
      ) : loading ? (
        <PostListSkeleton count={3} />
      ) : posts.length === 0 ? (
        <section className="card">
          <p>Bạn chưa lưu bài viết nào.</p>
        </section>
      ) : (
        <div className="feed-list">
          {posts.map((post) => (
            <SocialPostCard
              key={post.id}
              post={post}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
            />
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="pagination">
          <button
            className="button secondary"
            type="button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Trang trước
          </button>

          <span>
            Trang {page} / {totalPages} · {total} bài viết
          </span>

          <button
            className="button secondary"
            type="button"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  );
}
