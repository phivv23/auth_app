import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { getFileUrl } from "../api/client.js";
import { getFriends } from "../api/friend.api.js";
import {
  createSharedMoment,
  getSharedMoments,
  respondToSharedMoment,
} from "../api/moment.api.js";
import { useRealtimeSubscription } from "../context/useRealtime.js";
import { formatRelativeTime } from "../utils/time.js";

const MOMENT_NOTIFICATION_TYPES = new Set([
  "shared_moment_invite",
  "shared_moment_accept",
]);

function getInitial(value) {
  return value?.charAt(0)?.toUpperCase() || "K";
}

function getMomentStatusText(moment) {
  if (moment.myStatus === "pending") {
    return "Lời mời";
  }

  return `${moment.participantCount || 1} người · ${moment.itemCount || 0} nội dung`;
}

function MomentCover({ moment }) {
  const coverUrl = getFileUrl(moment.coverMediaUrl);

  if (coverUrl) {
    return <img src={coverUrl} alt="" loading="lazy" />;
  }

  return <span>{getInitial(moment.title)}</span>;
}

function MomentCard({ moment, responding, onRespond }) {
  return (
    <article
      className={
        moment.myStatus === "pending"
          ? "feed-moment-card pending"
          : "feed-moment-card"
      }
    >
      <Link
        className="feed-moment-card-main"
        to={`/moments?momentId=${moment.id}`}
        aria-label={`Mở khoảnh khắc ${moment.title}`}
      >
        <span className="feed-moment-cover">
          <MomentCover moment={moment} />
        </span>

        <span className="feed-moment-body">
          <strong>{moment.title}</strong>
          <small>{getMomentStatusText(moment)}</small>
          <em>{formatRelativeTime(moment.updatedAt)}</em>
        </span>
      </Link>

      {moment.myStatus === "pending" && (
        <div className="feed-moment-actions">
          <button
            type="button"
            disabled={Boolean(responding)}
            onClick={() => onRespond(moment.id, "accepted")}
          >
            {responding === "accepted" ? "Đang nhận..." : "Nhận"}
          </button>
          <button
            type="button"
            disabled={Boolean(responding)}
            onClick={() => onRespond(moment.id, "declined")}
          >
            Từ chối
          </button>
        </div>
      )}
    </article>
  );
}

export default function SharedMomentsFeedStrip({ onNotice }) {
  const [moments, setMoments] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [error, setError] = useState("");
  const [friendError, setFriendError] = useState("");
  const [respondingById, setRespondingById] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [creating, setCreating] = useState(false);

  const prioritizedMoments = useMemo(() => {
    return [...moments].sort((firstMoment, secondMoment) => {
      if (firstMoment.myStatus === "pending" && secondMoment.myStatus !== "pending") {
        return -1;
      }

      if (firstMoment.myStatus !== "pending" && secondMoment.myStatus === "pending") {
        return 1;
      }

      return (
        new Date(secondMoment.updatedAt).getTime() -
        new Date(firstMoment.updatedAt).getTime()
      );
    });
  }, [moments]);

  const pendingInviteCount = useMemo(
    () =>
      prioritizedMoments.filter((moment) => moment.myStatus === "pending")
        .length,
    [prioritizedMoments]
  );

  const filteredFriends = useMemo(() => {
    const keyword = friendSearch.trim().toLowerCase();

    if (!keyword) {
      return friends;
    }

    return friends.filter((friend) =>
      friend.name?.toLowerCase().includes(keyword)
    );
  }, [friendSearch, friends]);

  const loadMoments = useCallback(
    async function loadMoments({ signal, silent = false } = {}) {
      try {
        if (!silent) {
          setLoading(true);
        }

        setError("");

        const data = await getSharedMoments({
          limit: 8,
          signal,
          timeoutMs: 6000,
        });

        setMoments(data.moments || []);
      } catch (error) {
        if (error.name !== "AbortError" && !signal?.aborted) {
          setError(error.message);
        }
      } finally {
        if (!silent && !signal?.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      loadMoments({
        signal: controller.signal,
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadMoments]);

  useRealtimeSubscription(
    "notifications",
    "notification",
    (event) => {
      const notification = JSON.parse(event.data);

      if (MOMENT_NOTIFICATION_TYPES.has(notification.type)) {
        loadMoments({ silent: true });
      }
    }
  );

  const loadFriends = useCallback(
    async function loadFriends({ signal } = {}) {
      try {
        setLoadingFriends(true);
        setFriendError("");

        const data = await getFriends({
          page: 1,
          limit: 50,
          signal,
        });

        setFriends(data.users || []);
      } catch (error) {
        if (error.name !== "AbortError" && !signal?.aborted) {
          setFriendError(error.message);
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingFriends(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!createOpen || friends.length > 0) {
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      loadFriends({
        signal: controller.signal,
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [createOpen, friends.length, loadFriends]);

  async function handleRespond(momentId, status) {
    try {
      setRespondingById((currentState) => ({
        ...currentState,
        [momentId]: status,
      }));
      setError("");

      const data = await respondToSharedMoment(momentId, status, {
        timeoutMs: 10000,
      });

      setMoments((currentMoments) => {
        if (status === "declined") {
          return currentMoments.filter(
            (moment) => Number(moment.id) !== Number(momentId)
          );
        }

        return currentMoments.map((moment) =>
          Number(moment.id) === Number(momentId)
            ? {
                ...moment,
                ...data.moment,
              }
            : moment
        );
      });
      onNotice?.(
        status === "accepted"
          ? "Đã tham gia khoảnh khắc chung."
          : "Đã từ chối lời mời khoảnh khắc."
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setRespondingById((currentState) => {
        const nextState = { ...currentState };
        delete nextState[momentId];
        return nextState;
      });
    }
  }

  function resetCreateForm() {
    setCreateTitle("");
    setCreateNote("");
    setFriendSearch("");
    setSelectedFriendIds([]);
  }

  function handleCloseCreate() {
    if (creating) {
      return;
    }

    setCreateOpen(false);
    resetCreateForm();
  }

  function handleToggleFriend(friendId) {
    setSelectedFriendIds((currentIds) => {
      if (currentIds.includes(friendId)) {
        return currentIds.filter((id) => id !== friendId);
      }

      if (currentIds.length >= 10) {
        return currentIds;
      }

      return [...currentIds, friendId];
    });
  }

  async function handleCreateMoment(event) {
    event.preventDefault();

    if (!createTitle.trim() || selectedFriendIds.length === 0) {
      setError("Bạn cần nhập tên khoảnh khắc và chọn bạn bè.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const data = await createSharedMoment({
        title: createTitle,
        note: createNote,
        participantIds: selectedFriendIds,
      }, {
        timeoutMs: 10000,
      });

      setMoments((currentMoments) => [
        data.moment,
        ...currentMoments.filter(
          (moment) => Number(moment.id) !== Number(data.moment.id)
        ),
      ]);
      setCreateOpen(false);
      resetCreateForm();
      onNotice?.("Đã tạo khoảnh khắc chung và gửi lời mời.");
    } catch (error) {
      setError(error.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="feed-moments-strip" aria-label="Khoảnh Khắc Chung">
      <div className="feed-moments-header">
        <div>
          <h2>Khoảnh Khắc Chung</h2>
          {pendingInviteCount > 0 && <span>{pendingInviteCount} lời mời</span>}
        </div>
        <Link to="/moments">Xem tất cả</Link>
      </div>

      <div className="feed-moments-row">
        <button
          className="feed-moment-create-card"
          type="button"
          onClick={() => setCreateOpen(true)}
        >
          <span aria-hidden="true">+</span>
          <strong>Tạo khoảnh khắc</strong>
        </button>

        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <span
              key={index}
              className="feed-moment-card skeleton"
              aria-hidden="true"
            />
          ))
        ) : prioritizedMoments.length === 0 ? (
          <div className="feed-moment-empty">
            <strong>Chưa có khoảnh khắc chung.</strong>
            <button type="button" onClick={() => setCreateOpen(true)}>
              Bắt đầu
            </button>
          </div>
        ) : (
          prioritizedMoments.map((moment) => (
            <MomentCard
              key={moment.id}
              moment={moment}
              responding={respondingById[moment.id]}
              onRespond={handleRespond}
            />
          ))
        )}
      </div>

      {error && (
        <div className="feed-moments-error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadMoments()}
          >
            Thử lại
          </button>
        </div>
      )}

      {createOpen && (
        <div
          className="feed-moment-create-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseCreate();
            }
          }}
        >
          <section
            className="feed-moment-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feed-moment-create-title"
          >
            <header>
              <div>
                <h2 id="feed-moment-create-title">Tạo khoảnh khắc chung</h2>
                <p>Mời bạn bè vào một dòng kỷ niệm riêng.</p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                disabled={creating}
                onClick={handleCloseCreate}
              >
                ×
              </button>
            </header>

            <form onSubmit={handleCreateMoment}>
              <label>
                <span>Tên khoảnh khắc</span>
                <input
                  value={createTitle}
                  onChange={(event) => setCreateTitle(event.target.value)}
                  placeholder="Ví dụ: Cuối tuần cùng bạn bè"
                  maxLength={120}
                  autoFocus
                />
              </label>

              <label>
                <span>Lời nhắn</span>
                <textarea
                  value={createNote}
                  onChange={(event) => setCreateNote(event.target.value)}
                  placeholder="Nói một chút về khoảnh khắc này..."
                  maxLength={1000}
                />
              </label>

              <div className="feed-moment-create-friends">
                <div className="feed-moment-create-friends-header">
                  <strong>Mời bạn bè</strong>
                  <small>{selectedFriendIds.length}/10</small>
                </div>

                <input
                  value={friendSearch}
                  onChange={(event) => setFriendSearch(event.target.value)}
                  placeholder="Tìm bạn bè"
                />

                <div className="feed-moment-create-friend-list">
                  {loadingFriends ? (
                    <p>Đang tải bạn bè...</p>
                  ) : friendError ? (
                    <p>
                      Không tải được danh sách bạn bè.{" "}
                      <button
                        type="button"
                        onClick={() => loadFriends()}
                      >
                        Thử lại
                      </button>
                    </p>
                  ) : friends.length === 0 ? (
                    <p>
                      Chưa có bạn bè để mời.{" "}
                      <Link to="/friends">Mở danh bạ</Link>
                    </p>
                  ) : filteredFriends.length === 0 ? (
                    <p>Không tìm thấy bạn bè phù hợp.</p>
                  ) : (
                    filteredFriends.slice(0, 20).map((friend) => {
                      const selected = selectedFriendIds.includes(friend.id);
                      const avatarUrl = getFileUrl(friend.avatarUrl);

                      return (
                        <button
                          key={friend.id}
                          type="button"
                          className={selected ? "selected" : ""}
                          disabled={!selected && selectedFriendIds.length >= 10}
                          onClick={() => handleToggleFriend(friend.id)}
                        >
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" />
                          ) : (
                            <span>{getInitial(friend.name)}</span>
                          )}
                          <strong>{friend.name}</strong>
                          <small>{selected ? "Đã chọn" : "Mời"}</small>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <footer>
                <Link to="/moments">Mở trang đầy đủ</Link>
                <div>
                  <button
                    type="button"
                    className="secondary"
                    disabled={creating}
                    onClick={handleCloseCreate}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={
                      creating ||
                      !createTitle.trim() ||
                      selectedFriendIds.length === 0
                    }
                  >
                    {creating ? "Đang tạo..." : "Tạo và mời"}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
