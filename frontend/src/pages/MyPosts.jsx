import { useEffect, useState } from "react";
import { Link } from "react-router";
import { deletePost, getMyPosts } from "../api/post.api.js";
import PostCard from "../components/PostCard.jsx";
import { PostListSkeleton } from "../components/Skeleton.jsx";

export default function MyPosts() {
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    getMyPosts({
      page,
      limit: 10,
      search,
      signal: controller.signal,
    })
      .then((data) => {
        if (isActive) {
          setPosts(data.posts);
          setPagination(data.pagination);
        }
      })
      .catch((error) => {
        if (isActive && error.name !== "AbortError") {
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
      controller.abort();
    };
  }, [page, search]);

  function handleSearchSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setPage(1);
    setSearch(searchInput);
  }

  function handleClearSearch() {
    setLoading(true);
    setError("");
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  function goToPage(nextPage) {
    setLoading(true);
    setError("");
    setPage(nextPage);
  }

  async function handleDeletePost(postId) {
    const confirmed = window.confirm("Bạn chắc chắn muốn xóa bài viết này?");

    if (!confirmed) {
      return;
    }

    try {
      await deletePost(postId);

      /**
       * Sau khi xóa, remove post khỏi state để UI cập nhật ngay.
       */
      setPosts((currentPosts) =>
        currentPosts.filter((post) => post.id !== postId)
      );
    } catch (error) {
      setError(error.message);
    }
  }

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h1>My Posts</h1>
          <p>Danh sách bài viết do bạn tạo.</p>
        </div>

        <Link className="button" to="/posts/create">
          Tạo bài viết
        </Link>
      </div>

      <form onSubmit={handleSearchSubmit} className="search-form">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Tìm trong bài viết của bạn..."
        />

        <button className="button">Search</button>

        {search && (
          <button
            type="button"
            className="button secondary"
            onClick={handleClearSearch}
          >
            Clear
          </button>
        )}
      </form>

      {search && (
        <p className="muted">
          Đang tìm kiếm với từ khóa: <strong>{search}</strong>
        </p>
      )}

      {loading ? (
        <PostListSkeleton count={3} compact className="post-list" />
      ) : (
        <>
          {error && <p className="error">{error}</p>}

          {posts.length === 0 ? (
            <p>Bạn chưa có bài viết nào.</p>
          ) : (
            <div className="post-list">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  showAuthor={false}
                  actions={
                    <div className="actions">
                      <Link
                        className="button secondary"
                        to={`/posts/${post.id}`}
                      >
                        Xem
                      </Link>

                      <Link className="button" to={`/posts/${post.id}/edit`}>
                        Sửa
                      </Link>

                      <button
                        className="button danger"
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                      >
                        Xóa
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="button secondary"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Trang trước
              </button>

              <span>
                Trang {pagination.page} / {pagination.totalPages}
              </span>

              <button
                className="button secondary"
                disabled={page >= pagination.totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Trang sau
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
