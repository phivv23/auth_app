import { Link, useNavigate } from "react-router";

import { getFileUrl } from "../api/client";
import { followUser, unfollowUser } from "../api/user.api";
import { useAuth } from "../context/useAuth";

export default function UserCard({ user, onUserUpdated }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  async function handleToggleFollow() {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (user.isMe) {
      return;
    }

    const data = user.isFollowing
      ? await unfollowUser(user.id)
      : await followUser(user.id);

    onUserUpdated?.(data.profile);
  }

  const avatarUrl = getFileUrl(user.avatarUrl);

  return (
    <article className="user-card">
      <Link to={`/users/${user.id}`}>
        {avatarUrl ? (
          <img className="user-card-avatar" src={avatarUrl} alt={user.name} />
        ) : (
          <div className="user-card-placeholder">
            {user.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
        )}
      </Link>

      <div className="user-card-info">
        <Link to={`/users/${user.id}`}>
          <strong>{user.name}</strong>
        </Link>

        <p>
          {user.followerCount || 0} followers · Đang follow{" "}
          {user.followingCount || 0}
        </p>
      </div>

      {!user.isMe && (
        <button type="button" onClick={handleToggleFollow}>
          {user.isFollowing ? "Unfollow" : "Follow"}
        </button>
      )}

      {user.isMe && <span className="muted-text">Bạn</span>}
    </article>
  );
}