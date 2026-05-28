import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { searchUsers } from "../api/user.api";
import UserCard from "../components/UserCard";

export default function UserSearch() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialKeyword = searchParams.get("keyword") || "";

  const [keywordInput, setKeywordInput] = useState(initialKeyword);
  const [keyword, setKeyword] = useState(initialKeyword);

  const [users, setUsers] = useState([]);

  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [limit] = useState(10);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsers() {
      if (!keyword.trim()) {
        setUsers([]);
        setTotal(0);
        setTotalPages(0);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data = await searchUsers(keyword, {
          page,
          limit,
        });

        setUsers(data.users || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [keyword, page, limit]);

  function handleSubmit(event) {
    event.preventDefault();

    const nextKeyword = keywordInput.trim();

    setKeyword(nextKeyword);
    setPage(1);

    setSearchParams({
      keyword: nextKeyword,
      page: "1",
    });
  }

  function handleUserUpdated(updatedProfile) {
    if (updatedProfile.isBlocked) {
      setUsers((currentUsers) =>
        currentUsers.filter((user) => user.id !== updatedProfile.id)
      );
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

  function goToPage(nextPage) {
    setPage(nextPage);

    setSearchParams({
      keyword,
      page: String(nextPage),
    });
  }

  return (
    <div className="container">
      <section className="card">
        <h1>Tìm kiếm user</h1>

        <form onSubmit={handleSubmit} className="search-form">
          <input
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="Nhập tên user..."
          />

          <button type="submit">Tìm kiếm</button>
        </form>

        <p>
          <Link to="/feed">Quay lại Feed</Link>
        </p>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="card">
        {!keyword ? (
          <p>Nhập tên user để tìm kiếm.</p>
        ) : loading ? (
          <p>Đang tìm kiếm...</p>
        ) : users.length === 0 ? (
          <p>Không tìm thấy user nào.</p>
        ) : (
          <>
            <p>
              Tìm thấy {total} user cho từ khóa: <strong>{keyword}</strong>
            </p>

            <div className="user-list">
              {users.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onUserUpdated={handleUserUpdated}
                />
              ))}
            </div>

            <div className="pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Trang trước
              </button>

              <span>
                Trang {page} / {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Trang sau
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
