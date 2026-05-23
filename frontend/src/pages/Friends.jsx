import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import {
  getFriendRequests,
  getFriends,
  getFriendSuggestions,
} from "../api/friend.api.js";
import UserCard from "../components/UserCard.jsx";

const tabs = [
  { key: "incoming", label: "Lời mời" },
  { key: "outgoing", label: "Đã gửi" },
  { key: "friends", label: "Bạn bè" },
  { key: "suggestions", label: "Gợi ý" },
];

export default function Friends() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "incoming";

  const [activeTab, setActiveTab] = useState(
    tabs.some((tab) => tab.key === initialTab) ? initialTab : "incoming"
  );
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadFriendsData() {
      try {
        setLoading(true);
        setError("");

        let data;

        if (activeTab === "incoming" || activeTab === "outgoing") {
          data = await getFriendRequests({
            type: activeTab,
            page,
            limit,
          });
        } else if (activeTab === "friends") {
          data = await getFriends({
            page,
            limit,
          });
        } else {
          data = await getFriendSuggestions({
            limit: 20,
          });
        }

        if (!isActive) {
          return;
        }

        setUsers(data.users || []);
        setTotal(data.total || data.users?.length || 0);
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

    loadFriendsData();

    return () => {
      isActive = false;
    };
  }, [activeTab, page, limit]);

  function handleTabClick(tabKey) {
    setActiveTab(tabKey);
    setPage(1);
    setSearchParams({
      tab: tabKey,
    });
  }

  function handleUserUpdated(updatedProfile) {
    if (!updatedProfile) {
      return;
    }

    setUsers((currentUsers) => {
      if (
        activeTab === "incoming" ||
        activeTab === "outgoing" ||
        activeTab === "suggestions"
      ) {
        return currentUsers.filter((user) => user.id !== updatedProfile.id);
      }

      if (
        activeTab === "friends" &&
        updatedProfile.friendshipStatus !== "friends"
      ) {
        return currentUsers.filter((user) => user.id !== updatedProfile.id);
      }

      return currentUsers.map((user) =>
        user.id === updatedProfile.id ? { ...user, ...updatedProfile } : user
      );
    });
  }

  const title = tabs.find((tab) => tab.key === activeTab)?.label || "Bạn bè";
  const canPaginate = activeTab !== "suggestions";

  return (
    <div className="friends-page">
      <section className="card">
        <div className="friends-header">
          <div>
            <h1>Friends</h1>
            <p>Quản lý lời mời kết bạn, danh sách bạn bè và gợi ý mới.</p>
          </div>

          <Link to="/users/search">Tìm bạn bè</Link>
        </div>

        <div className="friends-tabs" aria-label="Friends tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "active" : ""}
              onClick={() => handleTabClick(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="profile-section-header">
          <div>
            <h2>{title}</h2>
            <p>{total} kết quả</p>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <p>Đang tải danh sách...</p>
        ) : users.length === 0 ? (
          <p>Chưa có dữ liệu phù hợp.</p>
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

        {canPaginate && !loading && users.length > 0 && (
          <div className="pagination">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((currentPage) => currentPage - 1)}
            >
              Trang trước
            </button>

            <span>
              Trang {page} / {totalPages || 1}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              Trang sau
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
