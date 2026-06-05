import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  getConversationMessages,
  markConversationRead,
  reactToMessage,
  sendMessage,
  startConversation,
} from "../api/message.api.js";
import { useAuth } from "../context/useAuth.js";
import { useRealtimeSubscription } from "../context/useRealtime.js";
import LinkifiedText from "../utils/linkify.jsx";
import { stripSharedPostUrl } from "../utils/sharedPostMessage.js";
import { formatRelativeTime } from "../utils/time.js";
import SharedPostMessagePreview from "./SharedPostMessagePreview.jsx";

function upsertMessage(messages, nextMessage) {
  const withoutDuplicate = messages.filter(
    (message) => message.id !== nextMessage.id
  );

  return [...withoutDuplicate, nextMessage].sort((a, b) => a.id - b.id);
}

function applyMessageReaction(messages, reactionEvent, currentUserId) {
  return messages.map((message) => {
    if (Number(message.id) !== Number(reactionEvent.messageId)) {
      return message;
    }

    const reactions = reactionEvent.reactions || [];
    const myReaction =
      reactions.find(
        (reaction) => Number(reaction.userId) === Number(currentUserId)
      )?.reaction || null;

    return {
      ...message,
      reactions,
      myReaction,
    };
  });
}

const POPUP_EMOJIS = ["👍", "❤️", "😂", "😍", "😮", "😢", "🙏", "🔥", "🎉", "💜"];
const POPUP_GIFS = [
  {
    label: "Nice",
    url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
  },
  {
    label: "Haha",
    url: "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif",
  },
  {
    label: "OK",
    url: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
  },
  {
    label: "Thanks",
    url: "https://media.giphy.com/media/FPDZV2JGkNGeUZdi7G/giphy.gif",
  },
];

function ChatPopupMedia({ message }) {
  if (!message.mediaUrl) {
    return null;
  }

  const mediaUrl = getFileUrl(message.mediaUrl);
  const mediaAlt = message.mediaName || message.content || "Tệp tin nhắn";

  if (message.mediaType === "file") {
    return (
      <a className="chat-popup-file" href={mediaUrl} target="_blank" rel="noreferrer">
        <span aria-hidden="true">📎</span>
        <strong>{message.mediaName || "Tệp tin"}</strong>
      </a>
    );
  }

  if (message.mediaType === "video") {
    return (
      <video
        className="chat-popup-media"
        src={mediaUrl}
        controls
        preload="metadata"
      />
    );
  }

  return (
    <img
      className="chat-popup-media"
      src={mediaUrl}
      alt={mediaAlt}
      loading="lazy"
    />
  );
}

function ChatPopupReactionSummary({ reactions = [] }) {
  if (reactions.length === 0) {
    return null;
  }

  const uniqueReactions = [...new Set(reactions.map((reaction) => reaction.reaction))];

  return (
    <div className="chat-popup-reaction-summary">
      {uniqueReactions.slice(0, 3).map((reaction) => (
        <span key={reaction}>{reaction}</span>
      ))}
      {reactions.length > 1 && <strong>{reactions.length}</strong>}
    </div>
  );
}

function getDeletedMessageText(message, currentUserId, peerName) {
  return Number(message.senderId) === Number(currentUserId)
    ? "Bạn đã thu hồi một tin nhắn."
    : `${message.senderName || peerName || "Người dùng"} đã thu hồi một tin nhắn.`;
}

function getReplyPreviewText(message) {
  if (!message) {
    return "";
  }

  if (message.deletedAt) {
    return "Tin nhắn đã bị thu hồi.";
  }

  const content = message.content?.trim();

  if (content) {
    return content;
  }

  const mediaLabels = {
    gif: "[GIF]",
    image: "[Ảnh]",
    video: "[Video]",
    file: `[Tệp tin${message.mediaName ? `: ${message.mediaName}` : ""}]`,
  };

  return mediaLabels[message.mediaType] || "[Tin nhắn]";
}

function ChatPopupReplyPreview({ message }) {
  if (!message) {
    return null;
  }

  return (
    <div className="chat-popup-reply-preview">
      <strong>{message.senderName || "Người dùng"}</strong>
      <span>{getReplyPreviewText(message)}</span>
    </div>
  );
}

export default function MessagePopups() {
  const { user } = useAuth();
  const location = useLocation();
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const sendingRef = useRef(false);

  const [popup, setPopup] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [selectedMediaPreview, setSelectedMediaPreview] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState(null);
  const [reactingMessageId, setReactingMessageId] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [quickEmoji] = useState("👍");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const isMessagesPage = location.pathname === "/messages";

  async function openConversation(conversation, initialMessages = []) {
    setReplyingToMessage(null);
    setPopup({
      conversation,
      messages: initialMessages,
      minimized: false,
      unreadCount: 0,
    });
    setError("");

    try {
      await markConversationRead(conversation.id);
    } catch {
      // Read receipts are non-critical for the popup; keep the chat usable.
    }
  }

  async function loadConversation(conversationId) {
    const data = await getConversationMessages({
      conversationId,
      page: 1,
      limit: 30,
    });

    return data;
  }

  function clearSelectedMedia() {
    if (selectedMediaPreview) {
      URL.revokeObjectURL(selectedMediaPreview);
    }

    setSelectedMedia(null);
    setSelectedMediaPreview("");
  }

  function handleMediaChange(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) {
      return;
    }

    clearSelectedMedia();
    setSelectedMedia(file);
    setSelectedMediaPreview(URL.createObjectURL(file));
  }

  function appendEmoji(emoji) {
    setMessageInput((currentInput) => `${currentInput}${emoji}`);
    setEmojiPickerOpen(false);
  }

  function toggleEmojiPicker(event) {
    event.preventDefault();
    event.stopPropagation();
    setGifPickerOpen(false);
    setEmojiPickerOpen((currentOpen) => !currentOpen);
  }

  function toggleGifPicker(event) {
    event.preventDefault();
    event.stopPropagation();
    setEmojiPickerOpen(false);
    setGifPickerOpen((currentOpen) => !currentOpen);
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

  useRealtimeSubscription(
    "messages",
    "message",
    async (event) => {
      if (!user) {
        return;
      }

      const nextMessage = JSON.parse(event.data);
      const isMine = Number(nextMessage.senderId) === Number(user.id);

      if (isMine || isMessagesPage) {
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
    },
    {
      enabled: Boolean(user) && !isMessagesPage,
    }
  );

  useRealtimeSubscription(
    "messages",
    "messageUpdate",
    (event) => {
      const nextMessage = JSON.parse(event.data);

      setPopup((currentPopup) => {
        if (
          currentPopup?.conversation?.id !== Number(nextMessage.conversationId)
        ) {
          return currentPopup;
        }

        return {
          ...currentPopup,
          messages: upsertMessage(currentPopup.messages, nextMessage),
        };
      });
    },
    {
      enabled: Boolean(user) && !isMessagesPage,
    }
  );

  useRealtimeSubscription(
    "messages",
    "reaction",
    (event) => {
      if (!user) {
        return;
      }

      const reactionEvent = JSON.parse(event.data);

      setPopup((currentPopup) => {
        if (
          currentPopup?.conversation?.id !==
          Number(reactionEvent.conversationId)
        ) {
          return currentPopup;
        }

        return {
          ...currentPopup,
          messages: applyMessageReaction(
            currentPopup.messages,
            reactionEvent,
            user.id
          ),
        };
      });
    },
    {
      enabled: Boolean(user) && !isMessagesPage,
    }
  );

  useEffect(() => {
    if (!popup || popup.minimized) {
      return;
    }

    bottomRef.current?.scrollIntoView({
      block: "end",
    });
  }, [popup]);

  useEffect(() => {
    return () => {
      if (selectedMediaPreview) {
        URL.revokeObjectURL(selectedMediaPreview);
      }
    };
  }, [selectedMediaPreview]);

  async function submitMessage({ allowQuickEmoji = false } = {}) {
    const trimmedContent = messageInput.trim();
    const content =
      trimmedContent || (allowQuickEmoji && !selectedMedia ? quickEmoji : "");

    if (
      sendingRef.current ||
      !popup?.conversation?.id ||
      (!content && !selectedMedia)
    ) {
      return;
    }

    try {
      sendingRef.current = true;
      setSending(true);
      setError("");

      const data = await sendMessage(popup.conversation.id, {
        content,
        media: selectedMedia,
        replyToMessageId: replyingToMessage?.id || null,
      });
      setPopup((currentPopup) =>
        currentPopup
          ? {
              ...currentPopup,
              messages: upsertMessage(currentPopup.messages, data.message),
            }
          : currentPopup
      );
      setMessageInput("");
      clearSelectedMedia();
      setReplyingToMessage(null);
      setEmojiPickerOpen(false);
      setGifPickerOpen(false);
    } catch (error) {
      setError(error.message);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function chooseGif(gif, event) {
    event?.preventDefault();
    event?.stopPropagation();

    if (sendingRef.current || !popup?.conversation?.id) {
      return;
    }

    try {
      sendingRef.current = true;
      setSending(true);
      setError("");
      setGifPickerOpen(false);
      setEmojiPickerOpen(false);

      const data = await sendMessage(popup.conversation.id, {
        gifUrl: gif.url,
        replyToMessageId: replyingToMessage?.id || null,
      });

      setPopup((currentPopup) =>
        currentPopup
          ? {
              ...currentPopup,
              messages: upsertMessage(currentPopup.messages, data.message),
            }
          : currentPopup
      );
      setReplyingToMessage(null);
    } catch (error) {
      setError(error.message);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function handleReactToMessage(message, reaction) {
    if (!popup?.conversation?.id || reactingMessageId) {
      return;
    }

    const nextReaction = message.myReaction === reaction ? null : reaction;

    try {
      setReactingMessageId(message.id);
      setReactionPickerMessageId(null);
      setError("");

      const data = await reactToMessage(
        popup.conversation.id,
        message.id,
        nextReaction
      );

      setPopup((currentPopup) =>
        currentPopup
          ? {
              ...currentPopup,
              messages: applyMessageReaction(
                currentPopup.messages,
                data.reaction,
                user.id
              ),
            }
          : currentPopup
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setReactingMessageId(null);
    }
  }

  function handleStartReplyMessage(message) {
    setReplyingToMessage(message);
    setReactionPickerMessageId(null);
    setEmojiPickerOpen(false);
    setGifPickerOpen(false);
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitMessage({ allowQuickEmoji: true });
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
      try {
        await markConversationRead(popup.conversation.id);
      } catch {
        // Read receipt sync can recover on the next successful request.
      }
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
            onClick={() => {
              clearSelectedMedia();
              setEmojiPickerOpen(false);
              setGifPickerOpen(false);
              setReactionPickerMessageId(null);
              setReplyingToMessage(null);
              setPopup(null);
            }}
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
            const isDeleted = Boolean(message.deletedAt);

            return (
              <div
                key={message.id}
                className={isMine ? "chat-popup-row mine" : "chat-popup-row"}
              >
                <div className="chat-popup-bubble-stack">
                  <div
                    className={[
                      message.mediaUrl
                        ? "chat-popup-bubble with-media"
                        : "chat-popup-bubble",
                      isDeleted ? "deleted" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {isDeleted ? (
                      <p className="chat-popup-deleted-text">
                        {getDeletedMessageText(message, user.id, otherUser.name)}
                      </p>
                    ) : (
                      <>
                        <ChatPopupReplyPreview
                          message={message.replyToMessage}
                        />
                        <ChatPopupMedia message={message} />
                        {stripSharedPostUrl(message.content) && (
                          <p>
                            <LinkifiedText
                              text={stripSharedPostUrl(message.content)}
                            />
                          </p>
                        )}
                        <SharedPostMessagePreview
                          content={message.content}
                          compact
                        />
                      </>
                    )}
                    <span>
                      {formatRelativeTime(message.createdAt)}
                      {message.editedAt && !isDeleted ? " · Đã chỉnh sửa" : ""}
                    </span>
                  </div>
                  {!isDeleted && (
                    <ChatPopupReactionSummary
                      reactions={message.reactions || []}
                    />
                  )}
                </div>

                {!isDeleted && (
                  <div className="chat-popup-reaction-control">
                    <button
                      type="button"
                      className={
                        message.myReaction
                          ? "chat-popup-react-button active"
                          : "chat-popup-react-button"
                      }
                      onClick={() =>
                        setReactionPickerMessageId((currentId) =>
                          Number(currentId) === Number(message.id)
                            ? null
                            : message.id
                        )
                      }
                      aria-label="Thả cảm xúc tin nhắn"
                      title="Thả cảm xúc"
                    >
                      {message.myReaction || "☺"}
                    </button>

                    {Number(reactionPickerMessageId) === Number(message.id) && (
                      <div className="chat-popup-reaction-picker">
                        {POPUP_EMOJIS.map((reaction) => (
                          <button
                            key={reaction}
                            type="button"
                            className={
                              message.myReaction === reaction ? "active" : ""
                            }
                            disabled={
                              Number(reactingMessageId) === Number(message.id)
                            }
                            onClick={() => handleReactToMessage(message, reaction)}
                            aria-label={`Thả ${reaction}`}
                          >
                            {reaction}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!isDeleted && (
                  <button
                    className="chat-popup-reply-button"
                    type="button"
                    onClick={() => handleStartReplyMessage(message)}
                    aria-label="Trả lời tin nhắn"
                    title="Trả lời"
                  >
                    ↩
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-popup-composer" onSubmit={handleSubmit}>
        {replyingToMessage && (
          <div className="chat-popup-composer-reply">
            <div>
              <strong>
                Đang trả lời {replyingToMessage.senderName || "người dùng"}
              </strong>
              <span>{getReplyPreviewText(replyingToMessage)}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToMessage(null)}
              aria-label="Hủy trả lời"
            >
              ×
            </button>
          </div>
        )}

        {selectedMedia && (
          <div className="chat-popup-attachment-preview">
            {selectedMedia.type?.startsWith("video/") ? (
              <video src={selectedMediaPreview} muted />
            ) : selectedMedia.type?.startsWith("image/") ? (
              <img src={selectedMediaPreview} alt={selectedMedia.name || ""} />
            ) : (
              <span aria-hidden="true">📎</span>
            )}
            <strong>{selectedMedia.name || "Tệp tin"}</strong>
            <button
              type="button"
              onClick={clearSelectedMedia}
              aria-label="Bỏ file đã chọn"
            >
              ×
            </button>
          </div>
        )}

        {(emojiPickerOpen || gifPickerOpen) && (
          <div className="chat-popup-picker">
            {emojiPickerOpen &&
              POPUP_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => appendEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}

            {gifPickerOpen &&
              POPUP_GIFS.map((gif) => (
                <button
                  key={gif.url}
                  type="button"
                  className="chat-popup-gif-option"
                  disabled={sending}
                  onClick={(event) => chooseGif(gif, event)}
                >
                  <img src={gif.url} alt={gif.label} loading="lazy" />
                  <span>{gif.label}</span>
                </button>
              ))}
          </div>
        )}

        <div className="chat-popup-tools">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            hidden
            onChange={handleMediaChange}
          />
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              fileInputRef.current?.click();
            }}
            aria-label="Gửi tệp tin"
          >
            ＋
          </button>
          <button
            type="button"
            onClick={toggleEmojiPicker}
            aria-label="Chọn biểu tượng cảm xúc"
          >
            ☺
          </button>
          <button
            type="button"
            onClick={toggleGifPicker}
            aria-label="Chọn GIF"
          >
            GIF
          </button>
        </div>
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
          className={
            !messageInput.trim() && !selectedMedia ? "quick-emoji" : ""
          }
          disabled={sending}
        >
          {!messageInput.trim() && !selectedMedia ? quickEmoji : "Gửi"}
        </button>
      </form>
    </section>
  );
}
