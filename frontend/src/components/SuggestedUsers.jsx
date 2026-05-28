import { useEffect, useState } from "react";
import { Link } from "react-router";

import { getSuggestedUsers } from "../api/user.api";
import UserCard from "./UserCard";
import { useAuth } from "../context/useAuth.js";

export default function SuggestedUsers({ limit = 5, onFollowed }) {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadSuggestions() {
      if (!currentUser) {
        setUsers([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data = await getSuggestedUsers({
          limit,
        });

        if (!isActive) {
          return;
        }

        setUsers(data.users || []);
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

    loadSuggestions();

    return () => {
      isActive = false;
    };
  }, [currentUser, limit]);

  function handleUserUpdated(updatedProfile) {
    // Nếu user vừa được follow, xóa khỏi danh sách gợi ý
    if (updatedProfile.isFollowing || updatedProfile.isBlocked) {
      setUsers((currentUsers) =>
        currentUsers.filter((user) => user.id !== updatedProfile.id)
      );

      if (updatedProfile.isFollowing) {
        onFollowed?.(updatedProfile);
      }

      return;
    }

    setUsers((currentUsers) =>
      currentUsers.map((user) => {
        if (user.id !== updatedProfile.id) {
          return user;
        }

        return {
          ...user,
          ...updatedProfile,
        };
      })
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <section className="card">
      <div className="suggested-users-header">
        <h2>Gợi ý follow</h2>

        <Link to="/users/search">
          Tìm user
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Đang tải gợi ý...</p>
      ) : users.length === 0 ? (
        <p>Chưa có gợi ý phù hợp.</p>
      ) : (
        <div className="user-list compact">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onUserUpdated={handleUserUpdated}
            />
          ))}
        </div>
      )}
    </section>
  );
}
