import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  getConversations,
  getMessageRequests,
  getMessageStreamUrl,
} from "../api/message.api.js";
import { useAuth } from "../context/useAuth.js";
import { formatRelativeTime } from "../utils/time.js";
import { openMessagePopup } from "../utils/messagePopup.js";
import { connectReconnectingEventSource } from "../utils/reconnectingEventSource.js";

function getPreview(conversation, currentUserId) {
  if (!conversation.lastMessage) {
    return "Chưa có tin nhắn.";
  }

  const prefix =
    Number(conversation.lastMessage.senderId) === Number(currentUserId)
      ? "Bạn: "
      : "";

  return `${prefix}${conversation.lastMessage.content}`;
}

export default function MessageDropdown() {
  const { user } = useAuth();
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");
  const [conversations, setConversations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const activeConversations = activeTab === "requests" ? requests : conversations;
  const filteredConversations = activeConversations.filter((conversation) =>
    conversation.otherUser.name
      ?.toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const unreadCount = conversations.reduce(
    (total, conversation) => total + Number(conversation.unreadCount || 0),
    0
  );
  const requestCount = requests.reduce(
    (total, conversation) => total + Number(conversation.unreadCount || 0),
    requests.length
  );

  async function loadMessageData({ showLoading = false } = {}) {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const [conversationData, requestData] = await Promise.all([
        getConversations({
          page: 1,
          limit: 8,
        }),
        getMessageRequests({
          page: 1,
          limit: 8,
        }),
      ]);

      setConversations(conversationData.conversations || []);
      setRequests(requestData.conversations || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      return;
    }

    loadMessageData({ showLoading: true });
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const connection = connectReconnectingEventSource(getMessageStreamUrl(), {
      listeners: {
        message: () => {
          loadMessageData();
        },
      },
    });

    return () => {
      connection.close();
    };
  }, [user]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  function handleOpenConversation(conversation) {
    setOpen(false);
    openMessagePopup(conversation.otherUser.id);
  }

  if (!user) {
    return null;
  }

  return (
    <div className="message-dropdown-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="nav-icon-button"
        aria-label="Messenger"
        title="Messenger"
        onClick={() => {
          setOpen((currentOpen) => !currentOpen);
          loadMessageData();
        }}
      >
        <span aria-hidden="true">💬</span>
        {unreadCount + requestCount > 0 && (
          <strong className="nav-icon-badge">
            {unreadCount + requestCount > 99 ? "99+" : unreadCount + requestCount}
          </strong>
        )}
      </button>

      {open && (
        <section className="message-dropdown">
          <div className="message-dropdown-header">
            <h2>Đoạn chat</h2>
            <Link to="/messages" onClick={() => setOpen(false)}>
              Mở Messenger
            </Link>
          </div>

          <div className="message-dropdown-search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm kiếm trên Messenger"
            />
          </div>

          <div className="message-dropdown-tabs">
            <button
              type="button"
              className={activeTab === "inbox" ? "active" : ""}
              onClick={() => setActiveTab("inbox")}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={activeTab === "requests" ? "active" : ""}
              onClick={() => setActiveTab("requests")}
            >
              Tin nhắn chờ
              {requests.length > 0 ? ` (${requests.length})` : ""}
            </button>
          </div>

          {loading ? (
            <p className="message-dropdown-empty">Đang tải...</p>
          ) : activeConversations.length === 0 ? (
            <p className="message-dropdown-empty">
              {activeTab === "requests"
                ? "Không có tin nhắn đang chờ."
                : "Chưa có cuộc trò chuyện nào."}
            </p>
          ) : filteredConversations.length === 0 ? (
            <p className="message-dropdown-empty">
              Không tìm thấy cuộc trò chuyện.
            </p>
          ) : (
            <div className="message-dropdown-list">
              {filteredConversations.map((conversation) => {
                const avatarUrl = getFileUrl(conversation.otherUser.avatarUrl);
                const hasUnread = conversation.unreadCount > 0;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className={
                      hasUnread
                        ? "message-dropdown-item unread"
                        : "message-dropdown-item"
                    }
                    onClick={() => handleOpenConversation(conversation)}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={conversation.otherUser.name} />
                    ) : (
                      <span>
                        {conversation.otherUser.name
                          ?.charAt(0)
                          ?.toUpperCase() || "U"}
                      </span>
                    )}

                    <span className="message-dropdown-content">
                      <strong>{conversation.otherUser.name}</strong>
                      <span>
                        {activeTab === "requests" ? "Tin nhắn đang chờ · " : ""}
                        {getPreview(conversation, user.id)}
                        {conversation.lastMessage?.createdAt
                          ? ` · ${formatRelativeTime(
                              conversation.lastMessage.createdAt
                            )}`
                          : ""}
                      </span>
                    </span>

                    {hasUnread && <i aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}

          <Link
            className="message-dropdown-footer"
            to="/messages"
            onClick={() => setOpen(false)}
          >
            Xem tất cả trong Messenger
          </Link>
        </section>
      )}
    </div>
  );
}
