import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  getConversationMessages,
  getConversations,
  getMessageStreamUrl,
  markConversationRead,
  sendMessage,
  sendTypingStatus,
  startConversation,
} from "../api/message.api.js";
import ReportDialog from "../components/ReportDialog.jsx";
import { useAuth } from "../context/useAuth.js";
import { connectReconnectingEventSource } from "../utils/reconnectingEventSource.js";
import { formatRelativeTime } from "../utils/time.js";

function upsertMessage(messages, nextMessage) {
  const withoutDuplicate = messages.filter(
    (message) => message.id !== nextMessage.id
  );

  return [...withoutDuplicate, nextMessage].sort((a, b) => a.id - b.id);
}

function getConversationPreview(conversation, currentUserId) {
  if (!conversation.lastMessage) {
    return "Chưa có tin nhắn.";
  }

  const prefix =
    Number(conversation.lastMessage.senderId) === Number(currentUserId)
      ? "Bạn: "
      : "";

  return `${prefix}${conversation.lastMessage.content}`;
}

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const bottomRef = useRef(null);
  const typingStopTimeoutRef = useRef(null);
  const searchParamKey = searchParams.toString();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingByConversation, setTypingByConversation] = useState({});
  const [reportMessage, setReportMessage] = useState(null);
  const [error, setError] = useState("");

  const activeConversationId = activeConversation?.id || null;
  const activeOtherUser = activeConversation?.otherUser || null;

  const filteredConversations = useMemo(() => {
    const keyword = conversationSearch.trim().toLowerCase();

    if (!keyword) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      conversation.otherUser.name?.toLowerCase().includes(keyword)
    );
  }, [conversationSearch, conversations]);

  async function loadConversations() {
    const data = await getConversations({
      page: 1,
      limit: 30,
    });

    setConversations(data.conversations || []);
    return data.conversations || [];
  }

  function updateConversationPresence(userId, isOnline) {
    setConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        Number(conversation.otherUser.id) === Number(userId)
          ? {
              ...conversation,
              otherUser: {
                ...conversation.otherUser,
                isOnline,
                lastSeenAt: isOnline
                  ? conversation.otherUser.lastSeenAt
                  : new Date().toISOString(),
              },
            }
          : conversation
      )
    );

    setActiveConversation((currentConversation) =>
      currentConversation &&
      Number(currentConversation.otherUser.id) === Number(userId)
        ? {
            ...currentConversation,
            otherUser: {
              ...currentConversation.otherUser,
              isOnline,
              lastSeenAt: isOnline
                ? currentConversation.otherUser.lastSeenAt
                : new Date().toISOString(),
            },
          }
        : currentConversation
    );
  }

  useEffect(() => {
    let isActive = true;

    async function initializeMessages() {
      try {
        setLoadingConversations(true);
        setError("");

        let nextConversations = await loadConversations();
        const currentSearchParams = new URLSearchParams(searchParamKey);
        const requestedUserId = currentSearchParams.get("userId");
        const requestedConversationId =
          currentSearchParams.get("conversationId");

        if (requestedUserId) {
          const data = await startConversation(requestedUserId);
          const nextConversation = data.conversation;

          nextConversations = [
            nextConversation,
            ...nextConversations.filter(
              (conversation) => conversation.id !== nextConversation.id
            ),
          ];
          setConversations(nextConversations);
          setActiveConversation(nextConversation);
          setSearchParams({
            conversationId: String(nextConversation.id),
          });
          return;
        }

        if (!isActive) {
          return;
        }

        let selectedConversation =
          nextConversations.find(
            (conversation) =>
              String(conversation.id) === String(requestedConversationId)
          ) || null;

        if (requestedConversationId && !selectedConversation) {
          const messageData = await getConversationMessages({
            conversationId: requestedConversationId,
            page: 1,
            limit: 50,
          });

          selectedConversation = messageData.conversation;
          nextConversations = [
            selectedConversation,
            ...nextConversations.filter(
              (conversation) => conversation.id !== selectedConversation.id
            ),
          ];
          setConversations(nextConversations);
        }

        selectedConversation = selectedConversation || nextConversations[0] || null;

        setActiveConversation(selectedConversation);
      } catch (error) {
        if (isActive) {
          setError(error.message);
        }
      } finally {
        if (isActive) {
          setLoadingConversations(false);
        }
      }
    }

    initializeMessages();

    return () => {
      isActive = false;
    };
  }, [searchParamKey, setSearchParams]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    let isActive = true;

    async function loadMessages() {
      try {
        setLoadingMessages(true);
        setError("");

        const data = await getConversationMessages({
          conversationId: activeConversationId,
          page: 1,
          limit: 50,
        });

        if (!isActive) {
          return;
        }

        setActiveConversation(data.conversation);
        setMessages(data.messages || []);
        await markConversationRead(activeConversationId);
        setConversations((currentConversations) =>
          currentConversations.map((conversation) =>
            conversation.id === activeConversationId
              ? {
                  ...conversation,
                  unreadCount: 0,
                }
              : conversation
          )
        );
      } catch (error) {
        if (isActive) {
          setError(error.message);
        }
      } finally {
        if (isActive) {
          setLoadingMessages(false);
        }
      }
    }

    loadMessages();

    return () => {
      isActive = false;
    };
  }, [activeConversationId]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const connection = connectReconnectingEventSource(getMessageStreamUrl(), {
      listeners: {
        message: async (event) => {
          const nextMessage = JSON.parse(event.data);
          const isActiveThread =
            Number(nextMessage.conversationId) === Number(activeConversationId);

          if (isActiveThread) {
            setMessages((currentMessages) =>
              upsertMessage(currentMessages, nextMessage)
            );

            if (Number(nextMessage.senderId) !== Number(user.id)) {
              await markConversationRead(nextMessage.conversationId);
            }
          }

          try {
            const nextConversations = await loadConversations();
            const refreshedActive = nextConversations.find(
              (conversation) =>
                Number(conversation.id) === Number(activeConversationId)
            );

            if (refreshedActive) {
              setActiveConversation((currentConversation) =>
                currentConversation?.id === refreshedActive.id
                  ? {
                      ...refreshedActive,
                      unreadCount: isActiveThread
                        ? 0
                        : refreshedActive.unreadCount,
                    }
                  : currentConversation
              );
            }
          } catch {
            // Chat should keep receiving messages even if refreshing the list fails.
          }
        },
        typing: (event) => {
          const typingEvent = JSON.parse(event.data);

          if (Number(typingEvent.userId) === Number(user.id)) {
            return;
          }

          setTypingByConversation((currentTyping) => ({
            ...currentTyping,
            [typingEvent.conversationId]: Boolean(typingEvent.isTyping),
          }));
        },
        read: (event) => {
          const readEvent = JSON.parse(event.data);

          setActiveConversation((currentConversation) =>
            currentConversation &&
            Number(currentConversation.id) === Number(readEvent.conversationId)
              ? {
                  ...currentConversation,
                  peerLastReadMessageId: readEvent.lastReadMessageId,
                }
              : currentConversation
          );

          setConversations((currentConversations) =>
            currentConversations.map((conversation) =>
              Number(conversation.id) === Number(readEvent.conversationId)
                ? {
                    ...conversation,
                    peerLastReadMessageId: readEvent.lastReadMessageId,
                  }
                : conversation
            )
          );
        },
        presence: (event) => {
          const presenceEvent = JSON.parse(event.data);
          updateConversationPresence(
            presenceEvent.userId,
            Boolean(presenceEvent.isOnline)
          );
        },
      },
    });

    return () => {
      connection.close();
    };
  }, [activeConversationId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "end",
    });
  }, [messages, loadingMessages]);

  useEffect(() => {
    return () => {
      window.clearTimeout(typingStopTimeoutRef.current);

      if (activeConversationId) {
        sendTypingStatus(activeConversationId, false).catch(() => {});
      }
    };
  }, [activeConversationId]);

  function handleSelectConversation(conversation) {
    setActiveConversation(conversation);
    setSearchParams({
      conversationId: String(conversation.id),
    });
  }

  async function submitMessage() {
    const content = messageInput.trim();

    if (!activeConversationId || !content) {
      return;
    }

    try {
      setSending(true);
      setError("");

      const data = await sendMessage(activeConversationId, content);
      setMessages((currentMessages) =>
        upsertMessage(currentMessages, data.message)
      );
      setMessageInput("");
      sendTypingStatus(activeConversationId, false).catch(() => {});
      await loadConversations();
    } catch (error) {
      setError(error.message);
    } finally {
      setSending(false);
    }
  }

  function handleSendMessage(event) {
    event.preventDefault();
    submitMessage();
  }

  function handleMessageInputChange(event) {
    const nextValue = event.target.value;
    setMessageInput(nextValue);

    if (!activeConversationId) {
      return;
    }

    window.clearTimeout(typingStopTimeoutRef.current);

    if (!nextValue.trim()) {
      sendTypingStatus(activeConversationId, false).catch(() => {});
      return;
    }

    sendTypingStatus(activeConversationId, true).catch(() => {});

    typingStopTimeoutRef.current = window.setTimeout(() => {
      sendTypingStatus(activeConversationId, false).catch(() => {});
    }, 1500);
  }

  function handleComposerKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    submitMessage();
  }

  const activePeerTyping = Boolean(typingByConversation[activeConversationId]);
  const peerLastReadMessageId = Number(
    activeConversation?.peerLastReadMessageId || 0
  );
  const lastReadOwnMessageId = messages
    .filter(
      (message) =>
        Number(message.senderId) === Number(user.id) &&
        Number(message.id) <= peerLastReadMessageId
    )
    .map((message) => Number(message.id))
    .at(-1);
  const activePeerStatus = activeOtherUser?.isOnline
    ? "Đang hoạt động"
    : activeOtherUser?.lastSeenAt
      ? `Hoạt động ${formatRelativeTime(activeOtherUser.lastSeenAt)}`
      : "Offline";

  return (
    <div className="messages-page">
      <aside className="messages-sidebar">
        <div className="messages-sidebar-header">
          <div>
            <h1>Đoạn chat</h1>
            <p>{conversations.length} cuộc trò chuyện</p>
          </div>
          <Link to="/friends">Bạn bè</Link>
        </div>

        <div className="conversation-search">
          <input
            value={conversationSearch}
            onChange={(event) => setConversationSearch(event.target.value)}
            placeholder="Tìm kiếm trên Messenger"
          />
        </div>

        {loadingConversations ? (
          <p className="messages-empty">Đang tải...</p>
        ) : conversations.length === 0 ? (
          <p className="messages-empty">
            Chưa có cuộc trò chuyện. Vào danh sách bạn bè để bắt đầu nhắn tin.
          </p>
        ) : filteredConversations.length === 0 ? (
          <p className="messages-empty">Không tìm thấy cuộc trò chuyện.</p>
        ) : (
          <div className="conversation-list">
            {filteredConversations.map((conversation) => {
              const avatarUrl = getFileUrl(conversation.otherUser.avatarUrl);
              const isActive = conversation.id === activeConversationId;
              const hasUnread = conversation.unreadCount > 0;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={[
                    "conversation-item",
                    isActive ? "active" : "",
                    hasUnread ? "unread" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <span className="conversation-avatar-wrap">
                    {avatarUrl ? (
                      <img
                        className="conversation-avatar"
                        src={avatarUrl}
                        alt={conversation.otherUser.name}
                      />
                    ) : (
                      <span className="conversation-avatar placeholder">
                        {conversation.otherUser.name
                          ?.charAt(0)
                          ?.toUpperCase() || "U"}
                      </span>
                    )}
                  </span>

                  <span className="conversation-summary">
                    <strong>{conversation.otherUser.name}</strong>
                    <span>
                      {getConversationPreview(conversation, user.id)}
                    </span>
                  </span>

                  {hasUnread && (
                    <span className="conversation-unread">
                      {conversation.unreadCount > 9
                        ? "9+"
                        : conversation.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      <section className="messages-panel">
        {activeConversation ? (
          <>
            <header className="messages-panel-header">
              <div className="messages-peer">
                {getFileUrl(activeOtherUser.avatarUrl) ? (
                  <img
                    className="conversation-avatar"
                    src={getFileUrl(activeOtherUser.avatarUrl)}
                    alt={activeOtherUser.name}
                  />
                ) : (
                  <span className="conversation-avatar placeholder">
                    {activeOtherUser.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
                <div>
                  <h2>{activeOtherUser.name}</h2>
                  <p className="messages-peer-presence">
                    <span
                      className={
                        activeOtherUser.isOnline
                          ? "presence-dot online"
                          : "presence-dot"
                      }
                      aria-hidden="true"
                    />
                    {activePeerTyping ? "Đang nhập..." : activePeerStatus}
                  </p>
                  <Link to={`/users/${activeOtherUser.id}`}>Xem hồ sơ</Link>
                </div>
              </div>
            </header>

            {error && <p className="error messages-error">{error}</p>}

            <div className="message-thread">
              {loadingMessages ? (
                <p className="messages-empty">Đang tải tin nhắn...</p>
              ) : messages.length === 0 ? (
                <div className="thread-empty-state">
                  {getFileUrl(activeOtherUser.avatarUrl) ? (
                    <img
                      className="thread-empty-avatar"
                      src={getFileUrl(activeOtherUser.avatarUrl)}
                      alt={activeOtherUser.name}
                    />
                  ) : (
                    <span className="thread-empty-avatar placeholder">
                      {activeOtherUser.name?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  )}
                  <h3>{activeOtherUser.name}</h3>
                  <p>Hãy gửi tin nhắn đầu tiên.</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = Number(message.senderId) === Number(user.id);

                  return (
                    <div
                      key={message.id}
                      className={isMine ? "message-row mine" : "message-row"}
                    >
                      <div className="message-bubble">
                        <p>{message.content}</p>
                        <span>{formatRelativeTime(message.createdAt)}</span>
                      </div>
                      {!isMine && (
                        <button
                          className="message-report-button"
                          type="button"
                          onClick={() => setReportMessage(message)}
                          aria-label="Báo cáo tin nhắn"
                          title="Báo cáo tin nhắn"
                        >
                          ...
                        </button>
                      )}
                      {isMine &&
                        Number(message.id) === Number(lastReadOwnMessageId) && (
                          <span className="message-read-receipt">Đã xem</span>
                        )}
                    </div>
                  );
                })
              )}
              {activePeerTyping && (
                <div className="message-row">
                  <div className="message-bubble typing-indicator">
                    <span>Đang nhập...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form className="message-composer" onSubmit={handleSendMessage}>
              <textarea
                value={messageInput}
                onChange={handleMessageInputChange}
                onKeyDown={handleComposerKeyDown}
                placeholder="Aa"
                maxLength={2000}
                rows={1}
              />
              <button
                type="submit"
                disabled={sending || messageInput.trim().length === 0}
              >
                Gửi
              </button>
            </form>
          </>
        ) : (
          <div className="messages-placeholder">
            <h2>Chọn một cuộc trò chuyện</h2>
            <p>Bạn có thể bắt đầu chat từ danh sách bạn bè.</p>
            <Link to="/friends">Mở danh sách bạn bè</Link>
          </div>
        )}
      </section>

      <ReportDialog
        open={Boolean(reportMessage)}
        targetType="message"
        targetId={reportMessage?.id}
        title="Báo cáo tin nhắn"
        onClose={() => setReportMessage(null)}
      />
    </div>
  );
}
