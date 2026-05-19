import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  getPublicUserPosts,
  getPublicUserProfile,
} from "../api/user.api.js";
import { useAuth } from "../context/useAuth.js";

export default function UserProfile() {
  const { id } = useParams();
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState("");

  const isMyProfile = user && profile && user.id === profile.id;

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const data = await getPublicUserProfile(id);

        setProfile(data.profile);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [id]);

  useEffect(() => {
    async function loadPosts() {
      try {
        setPostsLoading(true);
        setError("");

        const data = await getPublicUserPosts(id, {
          page,
          limit,
          search,
        });

        setPosts(data.posts || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch (error) {
        setError(error.message);
      } finally {
        setPostsLoading(false);
      }
    }

    loadPosts();
  }, [id, page, limit, search]);

  function handleSearchSubmit(event) {
    event.preventDefault();

    setPage(1);
    setSearch(searchInput.trim());
  }

  if (loading) {
    return (
      <div className="container">
        <p>Đang tải profile...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="container">
        <p className="error">{error}</p>
        <Link to="/posts">Quay lại danh sách bài viết</Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container">
        <p>Không tìm thấy user.</p>
      </div>
    );
  }

  const avatarUrl = getFileUrl(profile.avatarUrl);

  return (
    <div className="container">
      <section className="card profile-header">
        <div>
          {avatarUrl ? (
            <img className="avatar-preview" src={avatarUrl} alt={profile.name} />
          ) : (
            <div className="avatar-placeholder">
              {profile.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
        </div>

        <div>
          <h1>{profile.name}</h1>

          <p>
            Tham gia:{" "}
            {new Date(profile.createdAt).toLocaleDateString("vi-VN")}
          </p>

          <p>Tổng bài viết: {profile.postCount}</p>

          {isMyProfile && (
            <Link to="/profile">
              Chỉnh sửa profile của tôi
            </Link>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Bài viết của {profile.name}</h2>

        <form onSubmit={handleSearchSubmit} className="search-form">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm bài viết..."
          />

          <button type="submit">Tìm kiếm</button>
        </form>

        {error && <p className="error">{error}</p>}

        {postsLoading ? (
          <p>Đang tải bài viết...</p>
        ) : posts.length === 0 ? (
          <p>Chưa có bài viết nào.</p>
        ) : (
          <div className="post-list">
            {posts.map((post) => (
              <article key={post.id} className="post-card">
                <h3>
                  <Link to={`/posts/${post.id}`}>{post.title}</Link>
                </h3>

                <p>{post.content}</p>

                <div className="post-meta">
                  <span>{post.likeCount || 0} likes</span>
                  <span>{post.commentCount || 0} comments</span>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage((currentPage) => currentPage - 1)}
          >
            Trang trước
          </button>

          <span>
            Trang {page} / {totalPages} — Tổng {total} bài viết
          </span>

          <button
            disabled={page >= totalPages}
            onClick={() => setPage((currentPage) => currentPage + 1)}
          >
            Trang sau
          </button>
        </div>
      </section>
    </div>
  );
}
