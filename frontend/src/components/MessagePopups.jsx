import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  getConversationMessages,
  getMessageStreamUrl,
  markConversationRead,
  sendMessage,
  startConversation,
} from "../api/message.api.js";
import { useAuth } from "../context/useAuth.js";
import { formatRelativeTime } from "../utils/time.js";

function upsertMessage(messages, nextMessage) {
  const withoutDuplicate = messages.filter(
    (message) => message.id !== nextMessage.id
  );

  return [...withoutDuplicate, nextMessage].sort((a, b) => a.id - b.id);
}

export default function MessagePopups() {
  const { user } = useAuth();
  const location = useLocation();
  const bottomRef = useRef(null);

  const [popup, setPopup] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const isMessagesPage = location.pathname === "/messages";

  async function openConversation(conversation, initialMessages = []) {
    setPopup({
      conversation,
      messages: initialMessages,
      minimized: false,
      unreadCount: 0,
    });

    await markConversationRead(conversation.id);
  }

  async function loadConversation(conversationId) {
    const data = await getConversationMessages({
      conversationId,
      page: 1,
      limit: 30,
    });

    return data;
  }

  useEffect(() => {
    if (!user) {
      return;
    }

    async function handleOpenPopup(event) {
      const userId = event.detail?.userId;

      if (!userId) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data = await startConversation(userId);
        const messageData = await loadConversation(data.conversation.id);

        await openConversation(
          messageData.conversation,
          messageData.messages || []
        );
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    window.addEventListener("open-message-popup", handleOpenPopup);

    return () => {
      window.removeEventListener("open-message-popup", handleOpenPopup);
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const eventSource = new EventSource(getMessageStreamUrl(), {
      withCredentials: true,
    });

    eventSource.addEventListener("message", async (event) => {
      const nextMessage = JSON.parse(event.data);
      const isMine = Number(nextMessage.senderId) === Number(user.id);

      if (isMine) {
        return;
      }

      if (isMessagesPage) {
        return;
      }

      setPopup((currentPopup) => {
        if (
          currentPopup?.conversation?.id === Number(nextMessage.conversationId)
        ) {
          return {
            ...currentPopup,
            messages: upsertMessage(currentPopup.messages, nextMessage),
            minimized: false,
            unreadCount: currentPopup.minimized
              ? currentPopup.unreadCount + 1
              : 0,
          };
        }

        return currentPopup;
      });

      if (popup?.conversation?.id === Number(nextMessage.conversationId)) {
        await markConversationRead(nextMessage.conversationId);
        return;
      }

      try {
        const data = await loadConversation(nextMessage.conversationId);
        await openConversation(data.conversation, data.messages || []);
      } catch {
        // Ignore transient popup loading errors; the full messages page still works.
      }
    });

    return () => {
      eventSource.close();
    };
  }, [isMessagesPage, popup?.conversation?.id, user]);

  useEffect(() => {
    if (!popup || popup.minimized) {
      return;
    }

    bottomRef.current?.scrollIntoView({
      block: "end",
    });
  }, [popup]);

  async function submitMessage() {
    const content = messageInput.trim();

    if (!popup?.conversation?.id || !content) {
      return;
    }

    try {
      setSending(true);
      setError("");

      const data = await sendMessage(popup.conversation.id, content);
      setPopup((currentPopup) =>
        currentPopup
          ? {
              ...currentPopup,
              messages: upsertMessage(currentPopup.messages, data.message),
            }
          : currentPopup
      );
      setMessageInput("");
    } catch (error) {
      setError(error.message);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitMessage();
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    submitMessage();
  }

  async function handleRestore() {
    setPopup((currentPopup) =>
      currentPopup
        ? {
            ...currentPopup,
            minimized: false,
            unreadCount: 0,
          }
        : currentPopup
    );

    if (popup?.conversation?.id) {
      await markConversationRead(popup.conversation.id);
    }
  }

  if (!user || isMessagesPage) {
    return null;
  }

  if (loading && !popup) {
    return (
      <div className="chat-popup loading">
        <p>Đang mở đoạn chat...</p>
      </div>
    );
  }

  if (!popup) {
    return null;
  }

  const conversation = popup.conversation;
  const otherUser = conversation.otherUser;
  const avatarUrl = getFileUrl(otherUser.avatarUrl);

  if (popup.minimized) {
    return (
      <button
        type="button"
        className="chat-head"
        onClick={handleRestore}
        aria-label={`Mở chat với ${otherUser.name}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={otherUser.name} />
        ) : (
          <span>{otherUser.name?.charAt(0)?.toUpperCase() || "U"}</span>
        )}
        {popup.unreadCount > 0 && (
          <strong>{popup.unreadCount > 9 ? "9+" : popup.unreadCount}</strong>
        )}
      </button>
    );
  }

  return (
    <section className="chat-popup" aria-label={`Chat với ${otherUser.name}`}>
      <header className="chat-popup-header">
        <Link className="chat-popup-user" to={`/users/${otherUser.id}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={otherUser.name} />
          ) : (
            <span>{otherUser.name?.charAt(0)?.toUpperCase() || "U"}</span>
          )}
          <strong>{otherUser.name}</strong>
        </Link>

        <div className="chat-popup-actions">
          <button
            type="button"
            onClick={() =>
              setPopup((currentPopup) =>
                currentPopup
                  ? {
                      ...currentPopup,
                      minimized: true,
                    }
                  : currentPopup
              )
            }
            aria-label="Thu nhỏ"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setPopup(null)}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
      </header>

      {error && <p className="chat-popup-error">{error}</p>}

      <div className="chat-popup-thread">
        {popup.messages.length === 0 ? (
          <div className="chat-popup-empty">
            {avatarUrl ? (
              <img src={avatarUrl} alt={otherUser.name} />
            ) : (
              <span>{otherUser.name?.charAt(0)?.toUpperCase() || "U"}</span>
            )}
            <p>Hãy gửi tin nhắn đầu tiên.</p>
          </div>
        ) : (
          popup.messages.map((message) => {
            const isMine = Number(message.senderId) === Number(user.id);

            return (
              <div
                key={message.id}
                className={isMine ? "chat-popup-row mine" : "chat-popup-row"}
              >
                <div className="chat-popup-bubble">
                  <p>{message.content}</p>
                  <span>{formatRelativeTime(message.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-popup-composer" onSubmit={handleSubmit}>
        <textarea
          value={messageInput}
          onChange={(event) => setMessageInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Aa"
          rows={1}
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={sending || messageInput.trim().length === 0}
        >
          Gửi
        </button>
      </form>
    </section>
  );
}
