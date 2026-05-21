import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import {
  getUserFollowers,
  getUserFollowing,
} from "../api/user.api";
import UserCard from "../components/UserCard";

export default function FollowList({ type }) {
  const { id } = useParams();

  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isFollowersPage = type === "followers";

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        setError("");

        const data = isFollowersPage
          ? await getUserFollowers(id, { page, limit })
          : await getUserFollowing(id, { page, limit });

        setProfile(data.profile);
        setUsers(data.users || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [id, page, limit, isFollowersPage]);

  function handleUserUpdated(updatedProfile) {
    setUsers((currentUsers) =>
      currentUsers.map((user) => {
        if (user.id !== updatedProfile.id) {
          return user;
        }

        return {
          ...user,
          followerCount: updatedProfile.followerCount,
          followingCount: updatedProfile.followingCount,
          isFollowing: updatedProfile.isFollowing,
        };
      })
    );
  }

  const title = isFollowersPage ? "Followers" : "Following";

  if (loading) {
    return (
      <div className="container">
        <p>Đang tải danh sách...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="container">
        <p className="error">{error}</p>
        <Link to="/posts">Quay lại Blog</Link>
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

  return (
    <div className="container">
      <section className="card">
        <h1>
          {title} của{" "}
          <Link to={`/users/${profile.id}`}>{profile.name}</Link>
        </h1>

        <p>
          {isFollowersPage
            ? `${profile.followerCount || 0} người đang theo dõi ${profile.name}`
            : `${profile.name} đang theo dõi ${profile.followingCount || 0} người`}
        </p>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="card">
        {users.length === 0 ? (
          <p>
            {isFollowersPage
              ? "Chưa có ai follow user này."
              : "User này chưa follow ai."}
          </p>
        ) : (
          <div className="user-list">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                onUserUpdated={handleUserUpdated}
              />
            ))}
          </div>
        )}

        <div className="pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((currentPage) => currentPage - 1)}
          >
            Trang trước
          </button>

          <span>
            Trang {page} / {totalPages} — Tổng {total}
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
  );
}