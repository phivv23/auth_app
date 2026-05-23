import { useEffect, useState } from "react";
import { Link } from "react-router";

import { getUserFollowers, getUserFollowing } from "../api/user.api";
import UserCard from "./UserCard";

export default function FollowListPanel({ userId, type, embedded = false }) {
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);

  const [pageState, setPageState] = useState({
    userId,
    type,
    page: 1,
  });
  const [limit] = useState(10);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isFollowersList = type === "followers";
  const panelClassName = embedded ? "profile-panel follow-list-panel" : "card";
  const page =
    pageState.userId === userId && pageState.type === type
      ? pageState.page
      : 1;

  function updatePage(getNextPage) {
    setPageState((currentState) => {
      const currentPage =
        currentState.userId === userId && currentState.type === type
          ? currentState.page
          : 1;
      const nextPage =
        typeof getNextPage === "function"
          ? getNextPage(currentPage)
          : getNextPage;

      return {
        userId,
        type,
        page: nextPage,
      };
    });
  }

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        setError("");

        const data = isFollowersList
          ? await getUserFollowers(userId, { page, limit })
          : await getUserFollowing(userId, { page, limit });

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

    if (userId) {
      loadUsers();
    }
  }, [userId, page, limit, isFollowersList]);

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

  const title = isFollowersList ? "Người theo dõi" : "Đang theo dõi";

  if (loading) {
    return (
      <section className={panelClassName}>
        <p>Đang tải danh sách...</p>
      </section>
    );
  }

  if (error && !profile) {
    return (
      <section className={panelClassName}>
        <p className="error">{error}</p>
        {!embedded && <Link to="/posts">Quay lại Blog</Link>}
      </section>
    );
  }

  if (!profile) {
    return (
      <section className={panelClassName}>
        <p>Không tìm thấy user.</p>
      </section>
    );
  }

  return (
    <section className={panelClassName}>
      <div className="profile-section-header">
        <div>
          <h2>
            {embedded ? (
              title
            ) : (
              <>
                {title} của{" "}
                <Link to={`/users/${profile.id}`}>{profile.name}</Link>
              </>
            )}
          </h2>

          <p>
            {isFollowersList
              ? `${profile.followerCount || 0} người đang theo dõi ${profile.name}`
              : `${profile.name} đang theo dõi ${profile.followingCount || 0} người`}
          </p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {users.length === 0 ? (
        <p>
          {isFollowersList
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
          onClick={() => updatePage((currentPage) => currentPage - 1)}
        >
          Trang trước
        </button>

        <span>
          Trang {page} / {totalPages} - Tổng {total}
        </span>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => updatePage((currentPage) => currentPage + 1)}
        >
          Trang sau
        </button>
      </div>
    </section>
  );
}
