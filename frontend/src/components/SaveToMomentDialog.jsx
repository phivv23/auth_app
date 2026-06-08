import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { getFileUrl } from "../api/client.js";
import { getFriends } from "../api/friend.api.js";
import {
  addSharedMomentItem,
  createSharedMoment,
  getSharedMoments,
} from "../api/moment.api.js";
import {
  buildSharedMomentDeepLink,
  getSharedMomentSourceLabel,
} from "../utils/sharedMomentSource.js";
import { formatRelativeTime } from "../utils/time.js";

const DUPLICATE_ITEM_CODE = "MOMENT_ITEM_ALREADY_EXISTS";

function getInitial(value) {
  return value?.charAt(0)?.toUpperCase() || "K";
}

function MomentAvatar({ value, src }) {
  const imageUrl = getFileUrl(src);

  if (imageUrl) {
    return <img src={imageUrl} alt="" />;
  }

  return <span>{getInitial(value)}</span>;
}

function getMomentMeta(moment) {
  const participantText = `${moment.participantCount || 1} người`;
  const itemText = `${moment.itemCount || 0} nội dung`;

  return `${participantText} · ${itemText}`;
}

function getDialogError(error) {
  if (error?.code === DUPLICATE_ITEM_CODE) {
    return "Nội dung này đã có trong khoảnh khắc.";
  }

  return error?.message || "Không thể lưu vào khoảnh khắc.";
}

function notifyMomentSaved(moment, action) {
  window.dispatchEvent(
    new CustomEvent("shared-moment-saved", {
      detail: {
        moment,
        action,
      },
    })
  );
}

export default function SaveToMomentDialog({
  open,
  sourceItem,
  onClose,
  onSaved,
  fullPageUrl = "",
}) {
  const [mode, setMode] = useState("existing");
  const [moments, setMoments] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loadingMoments, setLoadingMoments] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [momentsError, setMomentsError] = useState("");
  const [friendsError, setFriendsError] = useState("");
  const [savingMomentId, setSavingMomentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [actionError, setActionError] = useState("");

  const isBusy = Boolean(savingMomentId) || creating;
  const sourceLabel = getSharedMomentSourceLabel(sourceItem);
  const resolvedFullPageUrl =
    fullPageUrl || buildSharedMomentDeepLink(sourceItem);

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
    async function loadMoments({ signal } = {}) {
      if (!sourceItem) {
        return;
      }

      try {
        setLoadingMoments(true);
        setMomentsError("");

        const data = await getSharedMoments({
          status: "accepted",
          limit: 30,
          signal,
          timeoutMs: 8000,
        });

        if (!signal?.aborted) {
          setMoments(data.moments || []);
        }
      } catch (error) {
        if (error.name !== "AbortError" && !signal?.aborted) {
          setMomentsError(error.message);
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingMoments(false);
        }
      }
    },
    [sourceItem]
  );

  const loadFriends = useCallback(async function loadFriends({ signal } = {}) {
    try {
      setLoadingFriends(true);
      setFriendsError("");

      const data = await getFriends({
        page: 1,
        limit: 50,
        signal,
      });

      if (!signal?.aborted) {
        setFriends(data.users || []);
      }
    } catch (error) {
      if (error.name !== "AbortError" && !signal?.aborted) {
        setFriendsError(error.message);
      }
    } finally {
      if (!signal?.aborted) {
        setLoadingFriends(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!open || !sourceItem) {
      return undefined;
    }

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
  }, [loadMoments, open, sourceItem]);

  useEffect(() => {
    if (!open || mode !== "create" || friends.length > 0) {
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
  }, [friends.length, loadFriends, mode, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !isBusy) {
        onClose?.();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBusy, onClose, open]);

  useEffect(() => {
    if (open) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setMode("existing");
      setActionError("");
      setCreateTitle("");
      setCreateNote("");
      setFriendSearch("");
      setSelectedFriendIds([]);
      setSavingMomentId("");
      setCreating(false);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  function handleBackdropMouseDown(event) {
    if (event.target === event.currentTarget && !isBusy) {
      onClose?.();
    }
  }

  function toggleFriend(friendId) {
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

  async function handleAddToMoment(moment) {
    if (!sourceItem || savingMomentId) {
      return;
    }

    try {
      setSavingMomentId(String(moment.id));
      setActionError("");

      const data = await addSharedMomentItem(moment.id, sourceItem, {
        timeoutMs: 10000,
      });

      notifyMomentSaved(data.moment, "added");
      onSaved?.(data.moment, {
        action: "added",
      });
    } catch (error) {
      setActionError(getDialogError(error));
    } finally {
      setSavingMomentId("");
    }
  }

  async function handleCreateMoment(event) {
    event.preventDefault();

    if (!createTitle.trim() || selectedFriendIds.length === 0 || creating) {
      return;
    }

    try {
      setCreating(true);
      setActionError("");

      const data = await createSharedMoment(
        {
          title: createTitle,
          note: createNote,
          participantIds: selectedFriendIds,
          initialItem: sourceItem,
        },
        {
          timeoutMs: 10000,
        }
      );

      notifyMomentSaved(data.moment, "created");
      onSaved?.(data.moment, {
        action: "created",
      });
    } catch (error) {
      setActionError(getDialogError(error));
    } finally {
      setCreating(false);
    }
  }

  if (!open || !sourceItem) {
    return null;
  }

  return (
    <div className="save-moment-backdrop" onMouseDown={handleBackdropMouseDown}>
      <section
        className="save-moment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-moment-title"
      >
        <header>
          <div>
            <h2 id="save-moment-title">Lưu vào Khoảnh Khắc Chung</h2>
            <p>{sourceLabel}</p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            disabled={isBusy}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="save-moment-body">
          <div className="save-moment-source">
            <span aria-hidden="true">✦</span>
            <div>
              <strong>{sourceLabel}</strong>
              <small>Chọn khoảnh khắc có sẵn hoặc tạo mới để lưu nội dung này.</small>
            </div>
          </div>

          {actionError && <p className="save-moment-error">{actionError}</p>}

          <div className="save-moment-tabs" aria-label="Cách lưu">
            <button
              type="button"
              className={mode === "existing" ? "active" : ""}
              onClick={() => setMode("existing")}
            >
              Có sẵn
            </button>
            <button
              type="button"
              className={mode === "create" ? "active" : ""}
              onClick={() => setMode("create")}
            >
              Tạo mới
            </button>
          </div>

          {mode === "existing" ? (
            <div className="save-moment-list">
              {loadingMoments ? (
                <p>Đang tải khoảnh khắc...</p>
              ) : momentsError ? (
                <p>
                  Không tải được khoảnh khắc.{" "}
                  <button type="button" onClick={() => loadMoments()}>
                    Thử lại
                  </button>
                </p>
              ) : moments.length === 0 ? (
                <div className="save-moment-empty">
                  <strong>Chưa có khoảnh khắc đang tham gia.</strong>
                  <button type="button" onClick={() => setMode("create")}>
                    Tạo khoảnh khắc mới
                  </button>
                </div>
              ) : (
                moments.map((moment) => (
                  <button
                    key={moment.id}
                    type="button"
                    disabled={Boolean(savingMomentId)}
                    onClick={() => handleAddToMoment(moment)}
                  >
                    <MomentAvatar value={moment.title} src={moment.coverMediaUrl} />
                    <span>
                      <strong>{moment.title}</strong>
                      <small>
                        {getMomentMeta(moment)} · {formatRelativeTime(moment.updatedAt)}
                      </small>
                    </span>
                    <em>
                      {String(savingMomentId) === String(moment.id)
                        ? "Đang lưu..."
                        : "Lưu"}
                    </em>
                  </button>
                ))
              )}
            </div>
          ) : (
            <form className="save-moment-create" onSubmit={handleCreateMoment}>
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

              <div className="save-moment-friends">
                <div className="save-moment-friends-header">
                  <strong>Mời bạn bè</strong>
                  <small>{selectedFriendIds.length}/10</small>
                </div>
                <input
                  value={friendSearch}
                  onChange={(event) => setFriendSearch(event.target.value)}
                  placeholder="Tìm bạn bè"
                />

                <div className="save-moment-friend-list">
                  {loadingFriends ? (
                    <p>Đang tải bạn bè...</p>
                  ) : friendsError ? (
                    <p>
                      Không tải được danh sách bạn bè.{" "}
                      <button type="button" onClick={() => loadFriends()}>
                        Thử lại
                      </button>
                    </p>
                  ) : friends.length === 0 ? (
                    <p>Chưa có bạn bè để mời.</p>
                  ) : filteredFriends.length === 0 ? (
                    <p>Không tìm thấy bạn bè phù hợp.</p>
                  ) : (
                    filteredFriends.slice(0, 20).map((friend) => {
                      const selected = selectedFriendIds.includes(friend.id);

                      return (
                        <button
                          key={friend.id}
                          type="button"
                          className={selected ? "selected" : ""}
                          disabled={!selected && selectedFriendIds.length >= 10}
                          onClick={() => toggleFriend(friend.id)}
                        >
                          <MomentAvatar value={friend.name} src={friend.avatarUrl} />
                          <strong>{friend.name}</strong>
                          <small>{selected ? "Đã chọn" : "Mời"}</small>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  creating || !createTitle.trim() || selectedFriendIds.length === 0
                }
              >
                {creating ? "Đang tạo..." : "Tạo và lưu"}
              </button>
            </form>
          )}
        </div>

        <footer>
          <Link to={resolvedFullPageUrl}>Mở trang đầy đủ</Link>
          <button type="button" disabled={isBusy} onClick={onClose}>
            Đóng
          </button>
        </footer>
      </section>
    </div>
  );
}
