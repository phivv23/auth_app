import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getPosts } from "../api/post.api.js";
import PostCard from "../components/PostCard.jsx";
import { PostListSkeleton } from "../components/Skeleton.jsx";
import { useAuth } from "../context/useAuth.js";

export default function PostList() {
  const { user } = useAuth();

  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [page, setPage] = useState(1);

  /**
   * searchInput:
   * - giá trị đang gõ trong ô search
   *
   * search:
   * - giá trị thật sự dùng để gọi API
   *
   * Tách 2 state này để tránh gọi API mỗi lần gõ 1 ký tự.
   */
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    getPosts({
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

    /**
     * Khi search mới, quay về trang 1.
     */
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

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h1>Blog</h1>
          <p>Danh sách bài viết mới nhất.</p>
        </div>

        {user && (
          <Link className="button" to="/posts/create">
            Tạo bài viết
          </Link>
        )}
      </div>

      <form onSubmit={handleSearchSubmit} className="search-form">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Tìm bài viết theo title hoặc content..."
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
            <p>Không tìm thấy bài viết nào.</p>
          ) : (
            <div className="post-list">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  showImage
                  showReadMore
                  showTime
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
