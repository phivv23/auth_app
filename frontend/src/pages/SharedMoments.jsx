import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { getFileUrl } from "../api/client.js";
import { getFriends } from "../api/friend.api.js";
import {
  addSharedMomentItem,
  createSharedMoment,
  getSharedMoment,
  getSharedMoments,
  respondToSharedMoment,
} from "../api/moment.api.js";
import { useRealtimeSubscription } from "../context/useRealtime.js";
import { formatRelativeTime, formatVietnamDateTime } from "../utils/time.js";

const MOMENT_NOTIFICATION_TYPES = new Set([
  "shared_moment_invite",
  "shared_moment_accept",
]);

const moodOptions = [
  { value: "", label: "Chọn sắc thái" },
  { value: "vui", label: "Vui" },
  { value: "tu hao", label: "Tự hào" },
  { value: "nho", label: "Nhớ lại" },
  { value: "cam on", label: "Biết ơn" },
  { value: "bat ngo", label: "Bất ngờ" },
];

const statusTabs = [
  { id: "all", label: "Tất cả" },
  { id: "accepted", label: "Đang tham gia" },
  { id: "pending", label: "Lời mời" },
];

const itemTypeLabels = {
  post: "Bài viết",
  story: "Story",
  message: "Tin nhắn",
  note: "Ghi chú",
};

function getInitial(name) {
  return name?.charAt(0)?.toUpperCase() || "U";
}

function getSourceItem(searchParams) {
  const postId = searchParams.get("postId");
  const storyId = searchParams.get("storyId");
  const messageId = searchParams.get("messageId");

  if (postId) {
    return {
      itemType: "post",
      postId,
    };
  }

  if (storyId) {
    return {
      itemType: "story",
      storyId,
    };
  }

  if (messageId) {
    return {
      itemType: "message",
      messageId,
    };
  }

  return null;
}

function getSourceLabel(sourceItem) {
  if (!sourceItem) {
    return "";
  }

  return {
    post: "Bài viết đang chọn",
    story: "Story đang xem",
    message: "Tin nhắn đang chọn",
  }[sourceItem.itemType];
}

function isSameSource(item, sourceItem) {
  if (!item || !sourceItem || item.itemType !== sourceItem.itemType) {
    return false;
  }

  if (sourceItem.itemType === "post") {
    return Number(item.postId) === Number(sourceItem.postId);
  }

  if (sourceItem.itemType === "story") {
    return Number(item.storyId) === Number(sourceItem.storyId);
  }

  if (sourceItem.itemType === "message") {
    return Number(item.messageId) === Number(sourceItem.messageId);
  }

  return false;
}

function getStatusLabel(status) {
  return {
    accepted: "Đang tham gia",
    pending: "Đang chờ phản hồi",
    declined: "Đã từ chối",
  }[status] || status;
}

function MomentAvatar({ user }) {
  const avatarUrl = getFileUrl(user?.avatarUrl);

  if (avatarUrl) {
    return <img src={avatarUrl} alt={user?.name || ""} />;
  }

  return <span>{getInitial(user?.name)}</span>;
}

function MomentMedia({ item }) {
  const mediaUrl = getFileUrl(item.mediaUrl);

  if (!mediaUrl) {
    return null;
  }

  if (item.mediaType === "video") {
    return <video src={mediaUrl} controls preload="metadata" />;
  }

  return <img src={mediaUrl} alt="" loading="lazy" />;
}

export default function SharedMoments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceItem = useMemo(() => getSourceItem(searchParams), [searchParams]);
  const sourceLabel = getSourceLabel(sourceItem);

  const [moments, setMoments] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedMomentId, setSelectedMomentId] = useState(
    searchParams.get("momentId") || ""
  );
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [mood, setMood] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [newItemText, setNewItemText] = useState("");
  const [loadingMoments, setLoadingMoments] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [respondingId, setRespondingId] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedMomentIsAccepted = selectedMoment?.myStatus === "accepted";
  const sourceAlreadyAdded = selectedMoment?.items?.some((item) =>
    isSameSource(item, sourceItem)
  );

  const loadMoments = useCallback(async function loadMoments(signal) {
    const data = await getSharedMoments({
      status: statusFilter,
      limit: 30,
      signal,
      timeoutMs: 8000,
    });

    setMoments(data.moments || []);

    return data.moments || [];
  }, [statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function initialize() {
      try {
        setLoadingMoments(true);
        setError("");
        const nextMoments = await loadMoments(controller.signal);
        const requestedMomentId = searchParams.get("momentId");
        const nextSelectedMomentId =
          requestedMomentId || selectedMomentId || nextMoments[0]?.id || "";

        if (isActive) {
          setSelectedMomentId(nextSelectedMomentId);
        }
      } catch (error) {
        if (isActive && error.name !== "AbortError") {
          setError(error.message);
        }
      } finally {
        if (isActive) {
          setLoadingMoments(false);
        }
      }
    }

    initialize();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [loadMoments, searchParams, selectedMomentId]);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadFriendList() {
      try {
        setLoadingFriends(true);
        const data = await getFriends({
          page: 1,
          limit: 50,
          signal: controller.signal,
        });

        if (isActive) {
          setFriends(data.users || []);
        }
      } catch (error) {
        if (isActive && error.name !== "AbortError") {
          setError(error.message);
        }
      } finally {
        if (isActive) {
          setLoadingFriends(false);
        }
      }
    }

    loadFriendList();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedMomentId) {
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    async function loadDetail() {
      try {
        setLoadingDetail(true);
        const data = await getSharedMoment(selectedMomentId, {
          signal: controller.signal,
          timeoutMs: 8000,
        });

        if (isActive) {
          setSelectedMoment(data.moment || null);
        }
      } catch (error) {
        if (isActive && error.name !== "AbortError") {
          setError(error.message);
          setSelectedMoment(null);
        }
      } finally {
        if (isActive) {
          setLoadingDetail(false);
        }
      }
    }

    loadDetail();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [selectedMomentId]);

  function handleSelectMoment(momentId) {
    setSelectedMomentId(String(momentId));
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("momentId", String(momentId));
    setSearchParams(nextParams);
  }

  function toggleFriend(friendId) {
    setSelectedFriendIds((currentIds) =>
      currentIds.includes(friendId)
        ? currentIds.filter((id) => id !== friendId)
        : [...currentIds, friendId]
    );
  }

  async function refreshMoments(nextSelectedMomentId = selectedMomentId) {
    const nextMoments = await loadMoments();
    setSelectedMomentId(nextSelectedMomentId || nextMoments[0]?.id || "");
  }

  useRealtimeSubscription(
    "notifications",
    "notification",
    (event) => {
      const notification = JSON.parse(event.data);

      if (MOMENT_NOTIFICATION_TYPES.has(notification.type)) {
        refreshMoments(selectedMomentId).catch(() => {});
      }
    }
  );

  async function handleCreateMoment(event) {
    event.preventDefault();

    if (!title.trim() || selectedFriendIds.length === 0) {
      setError("Bạn cần nhập tên khoảnh khắc và chọn bạn bè.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setNotice("");

      const data = await createSharedMoment({
        title,
        note,
        mood,
        participantIds: selectedFriendIds,
        initialItem: sourceItem,
      }, {
        timeoutMs: 10000,
      });

      setTitle("");
      setNote("");
      setMood("");
      setSelectedFriendIds([]);
      setSelectedMoment(data.moment);
      setSelectedMomentId(String(data.moment.id));
      await refreshMoments(String(data.moment.id));
      setNotice("Đã tạo khoảnh khắc chung và gửi lời mời.");
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRespond(momentId, status) {
    try {
      setRespondingId(`${momentId}:${status}`);
      setError("");
      setNotice("");

      const data = await respondToSharedMoment(momentId, status, {
        timeoutMs: 10000,
      });

      if (status === "accepted") {
        setSelectedMoment(data.moment);
        setSelectedMomentId(String(momentId));
        setNotice("Bạn đã tham gia khoảnh khắc chung.");
      } else {
        setSelectedMomentId("");
        setSelectedMoment(null);
        setNotice("Đã từ chối lời mời.");
      }

      await refreshMoments(status === "accepted" ? String(momentId) : "");
    } catch (error) {
      setError(error.message);
    } finally {
      setRespondingId("");
    }
  }

  async function handleAddNote(event) {
    event.preventDefault();

    if (!selectedMomentId || !newItemText.trim()) {
      return;
    }

    try {
      setAddingItem(true);
      setError("");
      const data = await addSharedMomentItem(selectedMomentId, {
        itemType: "note",
        content: newItemText,
      }, {
        timeoutMs: 10000,
      });

      setSelectedMoment(data.moment);
      setNewItemText("");
      await refreshMoments(String(selectedMomentId));
    } catch (error) {
      setError(error.message);
    } finally {
      setAddingItem(false);
    }
  }

  async function handleAddCurrentSource() {
    if (!selectedMomentId || !sourceItem || sourceAlreadyAdded) {
      return;
    }

    try {
      setAddingItem(true);
      setError("");
      const data = await addSharedMomentItem(selectedMomentId, sourceItem, {
        timeoutMs: 10000,
      });

      setSelectedMoment(data.moment);
      await refreshMoments(String(selectedMomentId));
      setNotice("Đã thêm nội dung vào khoảnh khắc.");
    } catch (error) {
      setError(error.message);
    } finally {
      setAddingItem(false);
    }
  }

  return (
    <div className="moments-page">
      <header className="moments-hero">
        <div>
          <span className="moments-eyebrow">Tính năng riêng của Phivv</span>
          <h1>Khoảnh Khắc Chung</h1>
          <p>
            Gom bài viết, story, tin nhắn và ghi chú vào một dòng kỷ niệm có
            lời mời riêng cho bạn bè.
          </p>
        </div>
        <Link to="/feed">Về Feed</Link>
      </header>

      {sourceItem && (
        <section className="moment-source-banner">
          <div>
            <strong>{sourceLabel}</strong>
            <span>Bạn có thể tạo khoảnh khắc mới hoặc thêm vào khoảnh khắc đang tham gia.</span>
          </div>
          {selectedMomentIsAccepted && (
            <button
              type="button"
              disabled={addingItem || sourceAlreadyAdded}
              onClick={handleAddCurrentSource}
            >
              {sourceAlreadyAdded
                ? "Đã có trong khoảnh khắc"
                : addingItem
                  ? "Đang thêm..."
                  : "Thêm vào khoảnh khắc"}
            </button>
          )}
        </section>
      )}

      {notice && <p className="feed-notice moments-notice">{notice}</p>}
      {error && <p className="error moments-error">{error}</p>}

      <div className="moments-layout">
        <aside className="moments-left">
          <section className="moments-create-panel">
            <h2>Tạo khoảnh khắc</h2>
            <form onSubmit={handleCreateMoment}>
              <label>
                <span>Tên khoảnh khắc</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ví dụ: Chuyến đi Đà Lạt"
                  maxLength={120}
                />
              </label>

              <label>
                <span>Sắc thái</span>
                <select
                  value={mood}
                  onChange={(event) => setMood(event.target.value)}
                >
                  {moodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Lời nhắn</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Nói một chút về khoảnh khắc này..."
                  maxLength={1000}
                />
              </label>

              <div className="moment-friend-picker">
                <div className="moment-friend-picker-header">
                  <strong>Mời bạn bè</strong>
                  <small>{selectedFriendIds.length}/10</small>
                </div>

                {loadingFriends ? (
                  <p>Đang tải bạn bè...</p>
                ) : friends.length === 0 ? (
                  <p>Chưa có bạn bè để mời.</p>
                ) : (
                  friends.slice(0, 12).map((friend) => {
                    const selected = selectedFriendIds.includes(friend.id);

                    return (
                      <button
                        key={friend.id}
                        type="button"
                        className={selected ? "selected" : ""}
                        onClick={() => toggleFriend(friend.id)}
                        disabled={!selected && selectedFriendIds.length >= 10}
                      >
                        <MomentAvatar user={friend} />
                        <span>{friend.name}</span>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                className="button"
                type="submit"
                disabled={submitting || !title.trim() || selectedFriendIds.length === 0}
              >
                {submitting ? "Đang tạo..." : "Tạo và mời"}
              </button>
            </form>
          </section>

          <section className="moments-list-panel">
            <div className="moments-tabs">
              {statusTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={statusFilter === tab.id ? "active" : ""}
                  onClick={() => setStatusFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loadingMoments ? (
              <p className="moments-empty">Đang tải khoảnh khắc...</p>
            ) : moments.length === 0 ? (
              <p className="moments-empty">
                Chưa có khoảnh khắc nào trong mục này.
              </p>
            ) : (
              <div className="moment-list">
                {moments.map((moment) => (
                  <button
                    key={moment.id}
                    type="button"
                    className={
                      String(selectedMomentId) === String(moment.id)
                        ? "moment-list-card active"
                        : "moment-list-card"
                    }
                    onClick={() => handleSelectMoment(moment.id)}
                  >
                    <span className="moment-cover">
                      {moment.coverMediaUrl ? (
                        <img src={getFileUrl(moment.coverMediaUrl)} alt="" />
                      ) : (
                        <span>{getInitial(moment.title)}</span>
                      )}
                    </span>
                    <span>
                      <strong>{moment.title}</strong>
                      <small>
                        {getStatusLabel(moment.myStatus)} · {moment.itemCount} nội dung
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className="moments-detail">
          {!selectedMomentId ? (
            <div className="moments-empty-state">
              <h2>Chọn hoặc tạo một khoảnh khắc</h2>
              <p>Những nội dung chung với bạn bè sẽ xuất hiện ở đây.</p>
            </div>
          ) : loadingDetail ? (
            <div className="moments-empty-state">
              <h2>Đang tải...</h2>
            </div>
          ) : !selectedMoment ? (
            <div className="moments-empty-state">
              <h2>Không tìm thấy khoảnh khắc</h2>
            </div>
          ) : (
            <>
              <header className="moment-detail-header">
                <div>
                  <span>{selectedMoment.mood || "Khoảnh khắc"}</span>
                  <h2>{selectedMoment.title}</h2>
                  <p>{selectedMoment.note || "Chưa có lời nhắn mở đầu."}</p>
                  <small title={formatVietnamDateTime(selectedMoment.updatedAt)}>
                    Cập nhật {formatRelativeTime(selectedMoment.updatedAt)}
                  </small>
                </div>

                {selectedMoment.myStatus === "pending" && (
                  <div className="moment-invite-actions">
                    <button
                      type="button"
                      onClick={() => handleRespond(selectedMoment.id, "accepted")}
                      disabled={Boolean(respondingId)}
                    >
                      {respondingId.endsWith(":accepted")
                        ? "Đang nhận..."
                        : "Chấp nhận"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => handleRespond(selectedMoment.id, "declined")}
                      disabled={Boolean(respondingId)}
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </header>

              <div className="moment-participants">
                {selectedMoment.participants?.map((participant) => (
                  <span key={participant.id} title={participant.user.name}>
                    <MomentAvatar user={participant.user} />
                    <small>{getStatusLabel(participant.status)}</small>
                  </span>
                ))}
              </div>

              {selectedMomentIsAccepted && (
                <form className="moment-note-form" onSubmit={handleAddNote}>
                  <input
                    value={newItemText}
                    onChange={(event) => setNewItemText(event.target.value)}
                    placeholder="Thêm ghi chú vào khoảnh khắc..."
                    maxLength={1000}
                  />
                  <button type="submit" disabled={addingItem || !newItemText.trim()}>
                    {addingItem ? "Đang thêm..." : "Thêm"}
                  </button>
                </form>
              )}

              <div className="moment-timeline">
                {selectedMoment.items?.length === 0 ? (
                  <p className="moments-empty">
                    Khoảnh khắc này chưa có nội dung nào.
                  </p>
                ) : (
                  selectedMoment.items?.map((item) => (
                    <article key={item.id} className={`moment-item ${item.itemType}`}>
                      <div className="moment-item-avatar">
                        <MomentAvatar user={item.createdBy} />
                      </div>
                      <div className="moment-item-card">
                        <header>
                          <div>
                            <strong>{item.createdBy.name}</strong>
                            <small>
                              {itemTypeLabels[item.itemType]} ·{" "}
                              {formatRelativeTime(item.createdAt)}
                            </small>
                          </div>
                          {item.postId && <Link to={`/posts/${item.postId}`}>Mở bài</Link>}
                          {item.storyId && <Link to={`/stories/${item.storyId}`}>Mở story</Link>}
                          {item.messageId && item.conversationId && (
                            <Link to={`/messages?conversationId=${item.conversationId}`}>
                              Mở chat
                            </Link>
                          )}
                        </header>
                        {item.content && <p>{item.content}</p>}
                        <MomentMedia item={item} />
                      </div>
                    </article>
                  ))
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
