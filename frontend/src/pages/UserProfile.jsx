import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  sendFriendRequest,
  unfriendUser,
} from "../api/friend.api.js";
import FollowListPanel from "../components/FollowListPanel.jsx";
import PostComposer from "../components/PostComposer.jsx";
import SocialPostCard from "../components/SocialPostCard.jsx";
import {
  followUser,
  getPublicUserPosts,
  getPublicUserProfile,
  unfollowUser,
} from "../api/user.api.js";
import { useAuth } from "../context/useAuth.js";

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [profileTab, setProfileTab] = useState({
    userId: id,
    section: "posts",
  });

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);
  const [error, setError] = useState("");

  const isMyProfile = Boolean(profile?.isMe);
  const activeSection = profileTab.userId === id ? profileTab.section : "posts";

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

  function handleProfileTabClick(section, targetId) {
    setProfileTab({
      userId: id,
      section,
    });

    if (!targetId) {
      return;
    }

    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handlePostCreated(post) {
    setPosts((currentPosts) => [post, ...currentPosts]);
    setTotal((currentTotal) => currentTotal + 1);
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
  }

  async function handleToggleFollow() {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!profile || profile.isMe) {
      return;
    }

    try {
      setFollowLoading(true);
      setError("");

      const data = profile.isFollowing
        ? await unfollowUser(profile.id)
        : await followUser(profile.id);

      setProfile(data.profile);
    } catch (error) {
      setError(error.message);
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleFriendAction() {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!profile || profile.isMe) {
      return;
    }

    try {
      setFriendLoading(true);
      setError("");

      let data;

      if (profile.friendshipStatus === "incoming_pending") {
        data = await acceptFriendRequest(profile.id);
      } else if (profile.friendshipStatus === "outgoing_pending") {
        data = await cancelFriendRequest(profile.id);
      } else if (profile.friendshipStatus === "friends") {
        data = await unfriendUser(profile.id);
      } else {
        data = await sendFriendRequest(profile.id);
      }

      setProfile(data.profile);
    } catch (error) {
      setError(error.message);
    } finally {
      setFriendLoading(false);
    }
  }

  function getFriendActionLabel() {
    if (friendLoading) {
      return "Đang xử lý...";
    }

    if (profile?.friendshipStatus === "incoming_pending") {
      return "Chấp nhận";
    }

    if (profile?.friendshipStatus === "outgoing_pending") {
      return "Đã gửi lời mời";
    }

    if (profile?.friendshipStatus === "friends") {
      return "Bạn bè";
    }

    return "Thêm bạn bè";
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
  const coverUrl = getFileUrl(profile.coverUrl);
  const showingFollowList =
    activeSection === "followers" || activeSection === "following";

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div className="profile-cover" aria-hidden="true">
          {coverUrl && (
            <img className="profile-cover-image" src={coverUrl} alt="" />
          )}
        </div>

        <div className="profile-summary">
          <div className="profile-avatar-frame">
            {avatarUrl ? (
              <img
                className="profile-avatar-large"
                src={avatarUrl}
                alt={profile.name}
              />
            ) : (
              <div className="profile-avatar-large profile-avatar-fallback">
                {profile.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}
          </div>

          <div className="profile-title-block">
            <h1>{profile.name}</h1>
            <p>
              {profile.followerCount || 0} người theo dõi · Đang theo dõi{" "}
              {profile.followingCount || 0} · {profile.friendCount || 0} bạn bè
            </p>
          </div>

          <div className="profile-actions">
            {isMyProfile ? (
              <Link to="/profile" className="button">
                Chỉnh sửa profile
              </Link>
            ) : (
              <>
                <button
                  className={`button ${
                    profile.friendshipStatus === "friends" ? "secondary" : ""
                  }`}
                  type="button"
                  onClick={handleFriendAction}
                  disabled={friendLoading}
                >
                  {getFriendActionLabel()}
                </button>

                <button
                  className={`button ${profile.isFollowing ? "secondary" : ""}`}
                  type="button"
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                >
                  {followLoading
                    ? "Đang xử lý..."
                    : profile.isFollowing
                      ? "Đang follow"
                      : "Follow"}
                </button>
              </>
            )}
          </div>
        </div>

        {error && <p className="error profile-error">{error}</p>}

        <div className="profile-tabs" aria-label="Profile sections">
          <button
            type="button"
            className={activeSection === "posts" ? "active" : ""}
            onClick={() => handleProfileTabClick("posts", "profile-posts")}
          >
            Bài viết
          </button>
          <button
            type="button"
            className={activeSection === "intro" ? "active" : ""}
            onClick={() => handleProfileTabClick("intro", "profile-intro")}
          >
            Giới thiệu
          </button>
          <button
            type="button"
            className={activeSection === "followers" ? "active" : ""}
            onClick={() => handleProfileTabClick("followers")}
          >
            Người theo dõi
          </button>
          <button
            type="button"
            className={activeSection === "following" ? "active" : ""}
            onClick={() => handleProfileTabClick("following")}
          >
            Đang theo dõi
          </button>
        </div>
      </section>

      {showingFollowList ? (
        <FollowListPanel userId={profile.id} type={activeSection} embedded />
      ) : (
        <div className="profile-content-grid">
        <aside className="profile-sidebar" id="profile-intro">
          <section className="profile-panel">
            <h2>Giới thiệu</h2>

            {profile.bio ? (
              <p className="profile-bio">{profile.bio}</p>
            ) : (
              <p className="muted">Chưa có bio.</p>
            )}

            <div className="profile-detail-list">
              <div>
                <span>Bài viết</span>
                <strong>{profile.postCount || 0}</strong>
              </div>

              <div>
                <span>Tham gia</span>
                <strong>
                  {new Date(profile.createdAt).toLocaleDateString("vi-VN")}
                </strong>
              </div>

              {profile.location && (
                <div>
                  <span>Địa điểm</span>
                  <strong>{profile.location}</strong>
                </div>
              )}

              {profile.website && (
                <div>
                  <span>Website</span>
                  <a href={profile.website} target="_blank" rel="noreferrer">
                    {profile.website}
                  </a>
                </div>
              )}
            </div>
          </section>
        </aside>

        <section className="profile-timeline" id="profile-posts">
          {isMyProfile && (
            <PostComposer
              compact
              placeholder="Bạn muốn chia sẻ gì trên trang cá nhân?"
              onCreated={handlePostCreated}
            />
          )}

          <div className="profile-panel">
            <div className="profile-section-header">
              <div>
                <h2>Bài viết</h2>
                <p>{total} bài viết của {profile.name}</p>
              </div>
            </div>

            <form onSubmit={handleSearchSubmit} className="profile-search-form">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm bài viết trên profile này..."
              />

              <button className="button secondary" type="submit">
                Tìm kiếm
              </button>
            </form>
          </div>

          {postsLoading ? (
            <section className="profile-panel">
              <p>Đang tải bài viết...</p>
            </section>
          ) : posts.length === 0 ? (
            <section className="profile-panel">
              <p>Chưa có bài viết nào.</p>
            </section>
          ) : (
            <div className="post-list profile-post-list">
              {posts.map((post) => (
                <SocialPostCard
                  key={post.id}
                  post={post}
                  onPostUpdated={handlePostUpdated}
                  onPostDeleted={handlePostDeleted}
                  onPostShared={isMyProfile ? handlePostCreated : undefined}
                />
              ))}
            </div>
          )}

          <div className="pagination profile-pagination">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((currentPage) => currentPage - 1)}
            >
              Trang trước
            </button>

            <span>
              Trang {page} / {totalPages} · Tổng {total} bài viết
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              Trang sau
            </button>
          </div>
        </section>
        </div>
      )}
    </div>
  );
}
