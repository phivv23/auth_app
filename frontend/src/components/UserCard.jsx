import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { getFileUrl } from "../api/client";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  sendFriendRequest,
  unfriendUser,
} from "../api/friend.api.js";
import { followUser, unfollowUser } from "../api/user.api";
import { useAuth } from "../context/useAuth";
import { openMessagePopup } from "../utils/messagePopup.js";

export default function UserCard({ user, onUserUpdated }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const friendshipStatus = user.friendshipStatus || "none";
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  async function handleToggleFollow() {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (user.isMe || user.isBlocked) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");

      const data = user.isFollowing
        ? await unfollowUser(user.id)
        : await followUser(user.id);

      onUserUpdated?.(data.profile);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFriendAction() {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (user.isMe || user.isBlocked || friendshipStatus === "self") {
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");

      let data;

      if (friendshipStatus === "incoming_pending") {
        data = await acceptFriendRequest(user.id);
      } else if (friendshipStatus === "outgoing_pending") {
        data = await cancelFriendRequest(user.id);
      } else if (friendshipStatus === "friends") {
        data = await unfriendUser(user.id);
      } else {
        data = await sendFriendRequest(user.id);
      }

      onUserUpdated?.(data.profile);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionLoading(false);
    }
  }

  function getFriendButtonLabel() {
    if (friendshipStatus === "incoming_pending") {
      return "Chấp nhận";
    }

    if (friendshipStatus === "outgoing_pending") {
      return "Đã gửi";
    }

    if (friendshipStatus === "friends") {
      return "Bạn bè";
    }

    return "Thêm bạn";
  }

  function handleOpenMessages() {
    if (user.isBlocked) {
      return;
    }

    openMessagePopup(user.id);
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
        <p>{user.friendCount || 0} bạn bè</p>
        {user.suggestionReason && (
          <p className="suggestion-reason">{user.suggestionReason}</p>
        )}
        {actionError && <p className="error">{actionError}</p>}
      </div>

      {!user.isMe && (
        <div className="user-card-actions">
          {user.blockedByMe ? (
            <span className="muted-text">Đã block</span>
          ) : (
            <>
              {!user.hasBlockedMe && (
                <>
          <button type="button" onClick={handleFriendAction} disabled={actionLoading}>
            {getFriendButtonLabel()}
          </button>

          <button type="button" onClick={handleToggleFollow} disabled={actionLoading}>
            {user.isFollowing ? "Unfollow" : "Follow"}
          </button>

          <button type="button" onClick={handleOpenMessages}>
            Nhắn tin
          </button>
                </>
              )}

            </>
          )}
        </div>
      )}

      {user.isMe && <span className="muted-text">Bạn</span>}
    </article>
  );
}
