import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { getFileUrl } from "../api/client.js";
import {
  getConversationMessages,
  getConversations,
  getMessageRequests,
  deleteMessage,
  editMessage,
  markConversationRead,
  reactToMessage,
  sendMessage,
  sendTypingStatus,
  startConversation,
} from "../api/message.api.js";
import ReportDialog from "../components/ReportDialog.jsx";
import SharedPostMessagePreview from "../components/SharedPostMessagePreview.jsx";
import { useAuth } from "../context/useAuth.js";
import { useRealtimeSubscription } from "../context/useRealtime.js";
import LinkifiedText from "../utils/linkify.jsx";
import { stripSharedPostUrl } from "../utils/sharedPostMessage.js";
import { formatRelativeTime } from "../utils/time.js";

const INITIAL_MESSAGE_LIMIT = 40;
const OLDER_MESSAGE_LIMIT = 40;
const MAX_RENDERED_MESSAGES = 180;

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

function getConversationPreview(conversation, currentUserId) {
  if (!conversation.lastMessage) {
    return "Chưa có tin nhắn.";
  }

  if (conversation.lastMessage.deletedAt) {
    return Number(conversation.lastMessage.senderId) === Number(currentUserId)
      ? "Bạn đã thu hồi một tin nhắn."
      : "Tin nhắn đã bị thu hồi.";
  }

  const mediaLabels = {
    gif: "[GIF]",
    image: "[Ảnh]",
    video: "[Video]",
    file: "[Tệp tin]",
  };
  const fallbackContent =
    mediaLabels[conversation.lastMessage.mediaType] || "[File]";
  const prefix =
    Number(conversation.lastMessage.senderId) === Number(currentUserId)
      ? "Bạn: "
      : "";

  return `${prefix}${conversation.lastMessage.content || fallbackContent}`;
}

const MESSAGE_EMOJIS = ["👍", "❤️", "😂", "😍", "😮", "😢", "🙏", "🔥", "🎉", "💜"];
const MESSAGE_GIFS = [
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
const MESSAGE_REACTIONS = MESSAGE_EMOJIS;

function MessageMedia({ message }) {
  if (!message.mediaUrl) {
    return null;
  }

  const mediaUrl = getFileUrl(message.mediaUrl);

  if (message.mediaType === "file") {
    return (
      <a className="message-file" href={mediaUrl} target="_blank" rel="noreferrer">
        <span aria-hidden="true">📎</span>
        <strong>{message.mediaName || "Tệp tin"}</strong>
      </a>
    );
  }

  if (message.mediaType === "video") {
    return (
      <video className="message-media" src={mediaUrl} controls preload="metadata" />
    );
  }

  return (
    <img
      className="message-media"
      src={mediaUrl}
      alt={message.mediaName || "Media tin nhắn"}
      loading="lazy"
    />
  );
}

function MessageReactionSummary({ reactions = [] }) {
  if (reactions.length === 0) {
    return null;
  }

  const uniqueReactions = [...new Set(reactions.map((reaction) => reaction.reaction))];
  const title = reactions
    .map((reaction) => `${reaction.userName}: ${reaction.reaction}`)
    .join("\n");

  return (
    <div className="message-reaction-summary" title={title}>
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

function MessageReplyPreview({ message }) {
  if (!message) {
    return null;
  }

  return (
    <div className="message-reply-preview">
      <strong>{message.senderName || "Người dùng"}</strong>
      <span>{getReplyPreviewText(message)}</span>
    </div>
  );
}

function formatConversationTime(conversation) {
  const timestamp = conversation.lastMessage?.createdAt || conversation.updatedAt;

  if (!timestamp) {
    return "";
  }

  return formatRelativeTime(timestamp);
}

function formatClockTime(timestamp) {
  if (!timestamp) {
    return "";
  }

  return new Date(timestamp).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shouldShowTimeSeparator(messages, index) {
  if (index === 0) {
    return true;
  }

  const previous = new Date(messages[index - 1].createdAt).getTime();
  const current = new Date(messages[index].createdAt).getTime();

  return current - previous > 15 * 60 * 1000;
}

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const bottomRef = useRef(null);
  const threadRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const messageSearchInputRef = useRef(null);
  const sendingRef = useRef(false);
  const typingStopTimeoutRef = useRef(null);
  const refreshListsTimeoutRef = useRef(null);
  const preserveThreadScrollRef = useRef(false);
  const searchParamKey = searchParams.toString();

  const [conversations, setConversations] = useState([]);
  const [messageRequests, setMessageRequests] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagePage, setMessagePage] = useState(1);
  const [messageTotalPages, setMessageTotalPages] = useState(1);
  const [messageInput, setMessageInput] = useState("");
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [selectedMediaPreview, setSelectedMediaPreview] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState(null);
  const [reactingMessageId, setReactingMessageId] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [muted, setMuted] = useState(false);
  const [accentTheme, setAccentTheme] = useState("blue");
  const [quickEmoji, setQuickEmoji] = useState("👍");
  const [nicknames, setNicknames] = useState({});
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingByConversation, setTypingByConversation] = useState({});
  const [reportMessage, setReportMessage] = useState(null);
  const [error, setError] = useState("");
  const [olderMessagesError, setOlderMessagesError] = useState("");

  const activeConversationId = activeConversation?.id || null;
  const activeOtherUser = activeConversation?.otherUser || null;
  const activeAvatarUrl = getFileUrl(activeOtherUser?.avatarUrl);
  const activePeerName = activeOtherUser
    ? nicknames[activeOtherUser.id] || activeOtherUser.name
    : "";

  const unreadConversationCount = conversations.filter(
    (conversation) => conversation.unreadCount > 0
  ).length;
  const onlineConversationCount = conversations.filter(
    (conversation) => conversation.otherUser.isOnline
  ).length;

  const conversationTabs = [
    { id: "all", label: "Tất cả", count: conversations.length },
    { id: "unread", label: "Chưa đọc", count: unreadConversationCount },
    { id: "requests", label: "Tin nhắn chờ", count: messageRequests.length },
    { id: "online", label: "Đang hoạt động", count: onlineConversationCount },
  ];

  const visibleConversations = useMemo(() => {
    const keyword = conversationSearch.trim().toLowerCase();
    const source =
      activeTab === "requests" ? messageRequests : conversations;

    return source.filter((conversation) => {
      const matchesKeyword = keyword
        ? conversation.otherUser.name?.toLowerCase().includes(keyword)
        : true;
      const matchesTab =
        activeTab === "unread"
          ? conversation.unreadCount > 0
          : activeTab === "online"
            ? conversation.otherUser.isOnline
            : true;

      return matchesKeyword && matchesTab;
    });
  }, [activeTab, conversationSearch, conversations, messageRequests]);

  const messageSearchMatches = useMemo(() => {
    const keyword = messageSearch.trim().toLowerCase();

    if (!keyword) {
      return [];
    }

    return messages.filter((message) => {
      if (message.deletedAt) {
        return false;
      }

      const searchableText = [
        stripSharedPostUrl(message.content || ""),
        message.mediaName || "",
        message.senderName || "",
        message.mediaType || "",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [messageSearch, messages]);

  const messageSearchResultIds = useMemo(
    () => new Set(messageSearchMatches.map((message) => Number(message.id))),
    [messageSearchMatches]
  );

  const visibleMessageSearchResults = useMemo(
    () => messageSearchMatches.slice(-8).reverse(),
    [messageSearchMatches]
  );
  const renderedMessages = useMemo(
    () => messages.slice(-MAX_RENDERED_MESSAGES),
    [messages]
  );
  const hiddenRenderedMessageCount = Math.max(
    0,
    messages.length - renderedMessages.length
  );

  const mediaMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          !message.deletedAt &&
          message.mediaUrl &&
          ["gif", "image", "video"].includes(message.mediaType)
      ),
    [messages]
  );

  const fileMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          !message.deletedAt && message.mediaUrl && message.mediaType === "file"
      ),
    [messages]
  );

  const loadConversations = useCallback(async function loadConversations() {
    const data = await getConversations({
      page: 1,
      limit: 40,
    });

    setConversations(data.conversations || []);
    return data.conversations || [];
  }, []);

  const loadMessageRequests = useCallback(async function loadMessageRequests() {
    const data = await getMessageRequests({
      page: 1,
      limit: 30,
    });

    setMessageRequests(data.conversations || []);
    return data.conversations || [];
  }, []);

  const refreshConversationLists = useCallback(async function refreshConversationLists() {
    const [nextConversations, nextRequests] = await Promise.all([
      loadConversations(),
      loadMessageRequests(),
    ]);

    return {
      conversations: nextConversations,
      requests: nextRequests,
    };
  }, [loadConversations, loadMessageRequests]);

  const scheduleRefreshConversationLists = useCallback(
    function scheduleRefreshConversationLists() {
      window.clearTimeout(refreshListsTimeoutRef.current);

      refreshListsTimeoutRef.current = window.setTimeout(() => {
        refreshConversationLists().catch(() => {
          // Chat should keep receiving messages even if refreshing the list fails.
        });
      }, 300);
    },
    [refreshConversationLists]
  );

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

  async function chooseGif(gif) {
    if (sendingRef.current || !activeConversationId) {
      return;
    }

    try {
      sendingRef.current = true;
      setSending(true);
      setError("");
      setGifPickerOpen(false);
      setEmojiPickerOpen(false);

      const data = await sendMessage(activeConversationId, {
        gifUrl: gif.url,
        replyToMessageId: replyingToMessage?.id || null,
      });

      setMessages((currentMessages) =>
        upsertMessage(currentMessages, data.message)
      );
      setReplyingToMessage(null);
      await refreshConversationLists();

      if (data.message?.acceptedRequest) {
        setActiveTab("all");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function updateConversationPresence(userId, isOnline) {
    const applyPresence = (currentConversations) =>
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
      );

    setConversations(applyPresence);
    setMessageRequests(applyPresence);

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
        setLoadingRequests(true);
        setError("");

        const lists = await refreshConversationLists();
        let nextConversations = lists.conversations;
        let nextRequests = lists.requests;
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
          setActiveTab("all");
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
          ) ||
          nextRequests.find(
            (conversation) =>
              String(conversation.id) === String(requestedConversationId)
          ) ||
          null;

        if (requestedConversationId && !selectedConversation) {
          const messageData = await getConversationMessages({
            conversationId: requestedConversationId,
            page: 1,
            limit: 60,
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

        selectedConversation =
          selectedConversation || nextConversations[0] || nextRequests[0] || null;

        if (selectedConversation?.isMessageRequest) {
          setActiveTab("requests");
        }

        setActiveConversation(selectedConversation);
      } catch (error) {
        if (isActive) {
          setError(error.message);
        }
      } finally {
        if (isActive) {
          setLoadingConversations(false);
          setLoadingRequests(false);
        }
      }
    }

    initializeMessages();

    return () => {
      isActive = false;
    };
  }, [refreshConversationLists, searchParamKey, setSearchParams]);

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
          limit: INITIAL_MESSAGE_LIMIT,
        });

        if (!isActive) {
          return;
        }

        setActiveConversation(data.conversation);
        setMessages(data.messages || []);
        setMessagePage(data.page || 1);
        setMessageTotalPages(data.totalPages || 1);
        setOlderMessagesError("");
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
        setMessageRequests((currentRequests) =>
          currentRequests.map((conversation) =>
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

  useRealtimeSubscription(
    "messages",
    "message",
    async (event) => {
      if (!user) {
        return;
      }

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

      scheduleRefreshConversationLists();
    },
    {
      enabled: Boolean(user),
    }
  );

  useRealtimeSubscription(
    "messages",
    "messageUpdate",
    (event) => {
      const nextMessage = JSON.parse(event.data);

      if (Number(nextMessage.conversationId) === Number(activeConversationId)) {
        setMessages((currentMessages) =>
          upsertMessage(currentMessages, nextMessage)
        );
      }

      scheduleRefreshConversationLists();
    },
    {
      enabled: Boolean(user),
    }
  );

  useRealtimeSubscription(
    "messages",
    "typing",
    (event) => {
      if (!user) {
        return;
      }

      const typingEvent = JSON.parse(event.data);

      if (Number(typingEvent.userId) === Number(user.id)) {
        return;
      }

      setTypingByConversation((currentTyping) => ({
        ...currentTyping,
        [typingEvent.conversationId]: Boolean(typingEvent.isTyping),
      }));
    },
    {
      enabled: Boolean(user),
    }
  );

  useRealtimeSubscription(
    "messages",
    "read",
    (event) => {
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

      const applyReadState = (currentConversations) =>
        currentConversations.map((conversation) =>
          Number(conversation.id) === Number(readEvent.conversationId)
            ? {
                ...conversation,
                peerLastReadMessageId: readEvent.lastReadMessageId,
              }
            : conversation
        );

      setConversations(applyReadState);
      setMessageRequests(applyReadState);
    },
    {
      enabled: Boolean(user),
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

      if (
        Number(reactionEvent.conversationId) !== Number(activeConversationId)
      ) {
        return;
      }

      setMessages((currentMessages) =>
        applyMessageReaction(currentMessages, reactionEvent, user.id)
      );
    },
    {
      enabled: Boolean(user),
    }
  );

  useRealtimeSubscription(
    "messages",
    "presence",
    (event) => {
      const presenceEvent = JSON.parse(event.data);
      updateConversationPresence(
        presenceEvent.userId,
        Boolean(presenceEvent.isOnline)
      );
    },
    {
      enabled: Boolean(user),
    }
  );

  useEffect(() => {
    return () => {
      window.clearTimeout(refreshListsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (selectedMediaPreview) {
        URL.revokeObjectURL(selectedMediaPreview);
      }
    };
  }, [selectedMediaPreview]);

  useEffect(() => {
    if (preserveThreadScrollRef.current) {
      preserveThreadScrollRef.current = false;
      return;
    }

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
    setMessages([]);
    setMessagePage(1);
    setMessageTotalPages(1);
    setOlderMessagesError("");
    setReactionPickerMessageId(null);
    setMessageMenuId(null);
    setEditingMessageId(null);
    setEditingText("");
    setReplyingToMessage(null);
    setMessageSearch("");
    setActiveCall(null);
    setDetailsOpen(false);
    setSearchParams({
      conversationId: String(conversation.id),
    });
  }

  async function loadOlderMessages() {
    if (
      !activeConversationId ||
      loadingOlderMessages ||
      messagePage >= messageTotalPages
    ) {
      return;
    }

    const nextPage = messagePage + 1;
    const thread = threadRef.current;
    const previousScrollHeight = thread?.scrollHeight || 0;

    try {
      setLoadingOlderMessages(true);
      setOlderMessagesError("");

      const data = await getConversationMessages({
        conversationId: activeConversationId,
        page: nextPage,
        limit: OLDER_MESSAGE_LIMIT,
      });

      preserveThreadScrollRef.current = true;
      setMessages((currentMessages) => {
        const existingMessageIds = new Set(
          currentMessages.map((message) => Number(message.id))
        );
        const olderMessages = (data.messages || []).filter(
          (message) => !existingMessageIds.has(Number(message.id))
        );

        return [...olderMessages, ...currentMessages].sort(
          (firstMessage, secondMessage) =>
            Number(firstMessage.id) - Number(secondMessage.id)
        );
      });
      setMessagePage(data.page || nextPage);
      setMessageTotalPages(data.totalPages || messageTotalPages);

      window.requestAnimationFrame(() => {
        if (!thread) {
          return;
        }

        thread.scrollTop += Math.max(0, thread.scrollHeight - previousScrollHeight);
      });
    } catch (error) {
      setOlderMessagesError(error.message);
    } finally {
      setLoadingOlderMessages(false);
    }
  }

  function handleEditNickname() {
    if (!activeOtherUser) {
      return;
    }

    const nextNickname = window.prompt(
      "Nhập biệt danh cho đoạn chat này",
      activePeerName
    );

    if (nextNickname === null) {
      return;
    }

    const normalizedNickname = nextNickname.trim();

    setNicknames((currentNicknames) => ({
      ...currentNicknames,
      [activeOtherUser.id]: normalizedNickname || activeOtherUser.name,
    }));
  }

  function scrollToMessage(messageId) {
    const messageElement = document.getElementById(`message-${messageId}`);

    if (!messageElement) {
      return;
    }

    messageElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    messageElement.classList.add("message-jump-highlight");

    window.setTimeout(() => {
      messageElement.classList.remove("message-jump-highlight");
    }, 1400);
  }

  function focusMessageSearch() {
    setDetailsOpen(true);
    window.setTimeout(() => {
      messageSearchInputRef.current?.focus();
    }, 0);
  }

  function handleStartCall(type) {
    setActiveCall({
      type,
      muted: false,
      cameraOff: false,
      startedAt: Date.now(),
    });
  }

  async function submitMessage({ allowQuickEmoji = false } = {}) {
    const hasAttachment = Boolean(selectedMedia);
    const trimmedContent = messageInput.trim();
    const content =
      trimmedContent || (allowQuickEmoji && !hasAttachment ? quickEmoji : "");

    if (
      sendingRef.current ||
      !activeConversationId ||
      (!content && !selectedMedia)
    ) {
      return;
    }

    try {
      sendingRef.current = true;
      setSending(true);
      setError("");

      const data = await sendMessage(activeConversationId, {
        content,
        media: selectedMedia,
        replyToMessageId: replyingToMessage?.id || null,
      });
      setMessages((currentMessages) =>
        upsertMessage(currentMessages, data.message)
      );
      setMessageInput("");
      clearSelectedMedia();
      setReplyingToMessage(null);
      setEmojiPickerOpen(false);
      setGifPickerOpen(false);
      sendTypingStatus(activeConversationId, false).catch(() => {});
      await refreshConversationLists();
      if (data.message?.acceptedRequest) {
        setActiveTab("all");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function handleReactToMessage(message, reaction) {
    if (!activeConversationId || reactingMessageId) {
      return;
    }

    const nextReaction = message.myReaction === reaction ? null : reaction;

    try {
      setReactingMessageId(message.id);
      setReactionPickerMessageId(null);
      setError("");

      const data = await reactToMessage(
        activeConversationId,
        message.id,
        nextReaction
      );

      setMessages((currentMessages) =>
        applyMessageReaction(currentMessages, data.reaction, user.id)
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setReactingMessageId(null);
    }
  }

  function handleStartEditMessage(message) {
    setMessageMenuId(null);
    setReactionPickerMessageId(null);
    setReplyingToMessage(null);
    setEditingMessageId(message.id);
    setEditingText(message.content || "");
  }

  function handleCancelEditMessage() {
    setEditingMessageId(null);
    setEditingText("");
  }

  function handleStartReplyMessage(message) {
    setReplyingToMessage(message);
    setReactionPickerMessageId(null);
    setMessageMenuId(null);
    setEditingMessageId(null);
    setEditingText("");
  }

  async function handleSaveMessageEdit(event) {
    event.preventDefault();

    const messageId = editingMessageId;
    const content = editingText.trim();

    if (!activeConversationId || !messageId || !content) {
      return;
    }

    try {
      setError("");

      const data = await editMessage(activeConversationId, messageId, content);

      setMessages((currentMessages) =>
        upsertMessage(currentMessages, data.message)
      );
      setEditingMessageId(null);
      setEditingText("");
      await refreshConversationLists();
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleDeleteMessageForEveryone(message) {
    if (!activeConversationId) {
      return;
    }

    const confirmed = window.confirm("Thu hồi tin nhắn này với mọi người?");

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessageMenuId(null);
      setReactionPickerMessageId(null);

      const data = await deleteMessage(activeConversationId, message.id);

      setMessages((currentMessages) =>
        upsertMessage(currentMessages, data.message)
      );
      await refreshConversationLists();
    } catch (error) {
      setError(error.message);
    }
  }

  function handleSendMessage(event) {
    event.preventDefault();
    submitMessage({ allowQuickEmoji: true });
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
  const loadingList =
    activeTab === "requests" ? loadingRequests : loadingConversations;

  return (
    <div
      className={[
        "messages-page",
        accentTheme === "violet" ? "theme-violet" : "",
        detailsOpen ? "details-open" : "",
        activeConversation ? "has-active-conversation" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <aside className="messages-sidebar">
        <div className="messages-sidebar-header">
          <div>
            <h1>Đoạn chat</h1>
            <p>{conversations.length} cuộc trò chuyện</p>
          </div>
          <div className="messages-sidebar-actions">
            <button type="button" aria-label="Tùy chọn đoạn chat">
              •••
            </button>
            <Link to="/friends" aria-label="Tạo đoạn chat">
              ✎
            </Link>
          </div>
        </div>

        <div className="conversation-search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchInputRef}
            value={conversationSearch}
            onChange={(event) => setConversationSearch(event.target.value)}
            placeholder="Tìm kiếm trên Messenger"
          />
        </div>

        <div className="conversation-tabs" aria-label="Bộ lọc đoạn chat">
          {conversationTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.count > 0 && <span>{tab.count}</span>}
            </button>
          ))}
        </div>

        {loadingList ? (
          <p className="messages-empty">Đang tải...</p>
        ) : activeTab !== "requests" && conversations.length === 0 ? (
          <p className="messages-empty">
            Chưa có cuộc trò chuyện. Vào danh sách bạn bè để bắt đầu nhắn tin.
          </p>
        ) : visibleConversations.length === 0 ? (
          <p className="messages-empty">Không tìm thấy cuộc trò chuyện.</p>
        ) : (
          <div className="conversation-list">
            {visibleConversations.map((conversation) => {
              const avatarUrl = getFileUrl(conversation.otherUser.avatarUrl);
              const isActive = conversation.id === activeConversationId;
              const hasUnread = conversation.unreadCount > 0;
              const isTyping = Boolean(typingByConversation[conversation.id]);

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={[
                    "conversation-item",
                    isActive ? "active" : "",
                    hasUnread ? "unread" : "",
                    conversation.isMessageRequest ? "request" : "",
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
                    <span
                      className={
                        conversation.otherUser.isOnline
                          ? "conversation-presence online"
                          : "conversation-presence"
                      }
                      aria-hidden="true"
                    />
                  </span>

                  <span className="conversation-summary">
                    <strong>{conversation.otherUser.name}</strong>
                    <span>
                      {isTyping
                        ? "Đang nhập..."
                        : getConversationPreview(conversation, user.id)}
                    </span>
                  </span>

                  <span className="conversation-meta">
                    <small>{formatConversationTime(conversation)}</small>
                    {hasUnread && (
                      <span className="conversation-unread">
                        {conversation.unreadCount > 9
                          ? "9+"
                          : conversation.unreadCount}
                      </span>
                    )}
                  </span>
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
                <span className="messages-peer-avatar">
                  {activeAvatarUrl ? (
                    <img
                      className="conversation-avatar"
                      src={activeAvatarUrl}
                      alt={activeOtherUser.name}
                    />
                  ) : (
                    <span className="conversation-avatar placeholder">
                      {activeOtherUser.name?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  )}
                  <span
                    className={
                      activeOtherUser.isOnline
                        ? "conversation-presence online"
                        : "conversation-presence"
                    }
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <h2>{activePeerName}</h2>
                  <p className="messages-peer-presence">
                    {activePeerTyping ? "Đang nhập..." : activePeerStatus}
                  </p>
                </div>
              </div>

              <div className="messages-header-actions">
                <button
                  type="button"
                  aria-label="Gọi thoại"
                  title="Gọi thoại"
                  onClick={() => handleStartCall("voice")}
                >
                  ☎
                </button>
                <button
                  type="button"
                  aria-label="Gọi video"
                  title="Gọi video"
                  onClick={() => handleStartCall("video")}
                >
                  ▣
                </button>
                <button
                  type="button"
                  aria-label="Thông tin đoạn chat"
                  onClick={() => setDetailsOpen((currentOpen) => !currentOpen)}
                >
                  i
                </button>
              </div>
            </header>

            <div className="message-thread" ref={threadRef}>
              {error && <p className="error messages-error">{error}</p>}

              {loadingMessages ? (
                <p className="messages-empty">Đang tải tin nhắn...</p>
              ) : messages.length === 0 ? (
                <div className="thread-empty-state">
                  {activeAvatarUrl ? (
                    <img
                      className="thread-empty-avatar"
                      src={activeAvatarUrl}
                      alt={activeOtherUser.name}
                    />
                  ) : (
                    <span className="thread-empty-avatar placeholder">
                      {activeOtherUser.name?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  )}
                  <h3>{activePeerName}</h3>
                  <p>Hãy gửi tin nhắn đầu tiên.</p>
                </div>
              ) : (
                <>
                  {messagePage < messageTotalPages && (
                    <button
                      className="load-older-messages"
                      type="button"
                      onClick={loadOlderMessages}
                      disabled={loadingOlderMessages}
                    >
                      {loadingOlderMessages
                        ? "Đang tải tin cũ..."
                        : "Tải tin nhắn cũ hơn"}
                    </button>
                  )}

                  {olderMessagesError && (
                    <p className="error messages-error">{olderMessagesError}</p>
                  )}

                  {hiddenRenderedMessageCount > 0 && (
                    <p className="messages-render-limit-note">
                      Đang ẩn {hiddenRenderedMessageCount} tin cũ để giữ đoạn chat mượt hơn.
                    </p>
                  )}

                  {renderedMessages.map((message, index) => {
                  const isMine = Number(message.senderId) === Number(user.id);
                  const isDeleted = Boolean(message.deletedAt);
                  const isEditing =
                    Number(editingMessageId) === Number(message.id);
                  const previousMessage = renderedMessages[index - 1];
                  const nextMessage = renderedMessages[index + 1];
                  const previousSameSender =
                    previousMessage &&
                    Number(previousMessage.senderId) ===
                      Number(message.senderId) &&
                    !shouldShowTimeSeparator(renderedMessages, index);
                  const nextSameSender =
                    nextMessage &&
                    Number(nextMessage.senderId) === Number(message.senderId) &&
                    !shouldShowTimeSeparator(renderedMessages, index + 1);
                  const showPeerAvatar =
                    !isMine && !isDeleted && !nextSameSender;
                  const rowClassName = [
                    "message-row",
                    isMine ? "mine" : "",
                    previousSameSender ? "group-continued" : "group-start",
                    nextSameSender ? "group-not-end" : "group-end",
                    isDeleted ? "is-deleted" : "",
                    messageSearchResultIds.has(Number(message.id))
                      ? "message-search-match"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const canEdit =
                    isMine && !isDeleted && Boolean(message.content?.trim());
                  const canDelete = isMine && !isDeleted;

                  return (
                    <div
                      key={message.id}
                      id={`message-${message.id}`}
                      className="message-block"
                    >
                    {shouldShowTimeSeparator(renderedMessages, index) && (
                        <div className="message-time-separator">
                          {formatClockTime(message.createdAt)}
                        </div>
                      )}

                      <div className={rowClassName}>
                        {!isMine && (
                          <span
                            className={
                              showPeerAvatar
                                ? "message-row-avatar"
                                : "message-row-avatar hidden"
                            }
                          >
                            {activeAvatarUrl ? (
                              <img src={activeAvatarUrl} alt="" />
                            ) : (
                              activeOtherUser.name?.charAt(0)?.toUpperCase() ||
                              "U"
                            )}
                          </span>
                        )}

                        <div className="message-bubble-stack">
                          {isEditing ? (
                            <form
                              className="message-edit-form"
                              onSubmit={handleSaveMessageEdit}
                            >
                              <textarea
                                value={editingText}
                                onChange={(event) =>
                                  setEditingText(event.target.value)
                                }
                                maxLength={2000}
                                rows={2}
                                autoFocus
                              />
                              <div>
                                <button type="submit">Lưu</button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditMessage}
                                >
                                  Hủy
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div
                                className={[
                                  message.mediaUrl
                                    ? "message-bubble with-media"
                                    : "message-bubble",
                                  isDeleted ? "deleted" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                {isDeleted ? (
                                  <p className="message-deleted-text">
                                    {getDeletedMessageText(
                                      message,
                                      user.id,
                                      activePeerName
                                    )}
                                  </p>
                                ) : (
                                  <>
                                    <MessageReplyPreview
                                      message={message.replyToMessage}
                                    />
                                    <MessageMedia message={message} />
                                    {stripSharedPostUrl(message.content) && (
                                      <p>
                                        <LinkifiedText
                                          text={stripSharedPostUrl(
                                            message.content
                                          )}
                                        />
                                      </p>
                                    )}
                                    <SharedPostMessagePreview
                                      content={message.content}
                                    />
                                  </>
                                )}
                                <span>
                                  {formatRelativeTime(message.createdAt)}
                                  {message.editedAt && !isDeleted
                                    ? " · Đã chỉnh sửa"
                                    : ""}
                                </span>
                              </div>
                              {!isDeleted && (
                                <MessageReactionSummary
                                  reactions={message.reactions || []}
                                />
                              )}
                            </>
                          )}
                        </div>

                        {!isDeleted && !isEditing && (
                          <div className="message-reaction-control">
                          <button
                            className={
                              message.myReaction
                                ? "message-react-button active"
                                : "message-react-button"
                            }
                            type="button"
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

                          {Number(reactionPickerMessageId) ===
                            Number(message.id) && (
                            <div className="message-reaction-picker">
                              {MESSAGE_REACTIONS.map((reaction) => (
                                <button
                                  key={reaction}
                                  type="button"
                                  className={
                                    message.myReaction === reaction
                                      ? "active"
                                      : ""
                                  }
                                  disabled={
                                    Number(reactingMessageId) ===
                                    Number(message.id)
                                  }
                                  onClick={() =>
                                    handleReactToMessage(message, reaction)
                                  }
                                  aria-label={`Thả ${reaction}`}
                                >
                                  {reaction}
                                </button>
                              ))}
                            </div>
                          )}
                          </div>
                        )}

                        {!isDeleted && !isEditing && (
                          <button
                            className="message-reply-button"
                            type="button"
                            onClick={() => handleStartReplyMessage(message)}
                            aria-label="Trả lời tin nhắn"
                            title="Trả lời"
                          >
                            ↩
                          </button>
                        )}

                        {isMine && (canEdit || canDelete) && !isEditing && (
                          <div className="message-action-control">
                            <button
                              className="message-action-button"
                              type="button"
                              onClick={() =>
                                setMessageMenuId((currentId) =>
                                  Number(currentId) === Number(message.id)
                                    ? null
                                    : message.id
                                )
                              }
                              aria-label="Tùy chọn tin nhắn"
                              title="Tùy chọn tin nhắn"
                            >
                              ...
                            </button>

                            {Number(messageMenuId) === Number(message.id) && (
                              <div className="message-action-menu">
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditMessage(message)}
                                  >
                                    Chỉnh sửa
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() =>
                                      handleDeleteMessageForEveryone(message)
                                    }
                                  >
                                    Thu hồi
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {!isMine && (
                          <button
                            className="message-report-button"
                            type="button"
                            onClick={() => setReportMessage(message)}
                            aria-label="Báo cáo tin nhắn"
                            title="Báo cáo tin nhắn"
                          >
                            •••
                          </button>
                        )}

                        {isMine &&
                          Number(message.id) ===
                            Number(lastReadOwnMessageId) && (
                            <span className="message-read-receipt">
                              Đã xem
                            </span>
                          )}
                      </div>
                    </div>
                  );
                  })}
                </>
              )}
              {activePeerTyping && (
                <div className="message-row">
                  <span className="message-row-avatar">
                    {activeAvatarUrl ? (
                      <img src={activeAvatarUrl} alt="" />
                    ) : (
                      activeOtherUser.name?.charAt(0)?.toUpperCase() || "U"
                    )}
                  </span>
                  <div className="message-bubble typing-indicator">
                    <span>Đang nhập...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form className="message-composer" onSubmit={handleSendMessage}>
              {replyingToMessage && (
                <div className="composer-reply-preview">
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
                <div className="composer-attachment-preview">
                  {selectedMedia?.type?.startsWith("video/") ? (
                    <video src={selectedMediaPreview} muted />
                  ) : selectedMedia?.type?.startsWith("image/") ? (
                    <img
                      src={selectedMediaPreview}
                      alt={selectedMedia?.name || ""}
                    />
                  ) : (
                    <span className="composer-file-preview" aria-hidden="true">
                      📎
                    </span>
                  )}
                  <span>{selectedMedia?.name || "File đã chọn"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearSelectedMedia();
                    }}
                    aria-label="Bỏ file đã chọn"
                  >
                    ×
                  </button>
                </div>
              )}

              {(emojiPickerOpen || gifPickerOpen) && (
                <div className="composer-picker">
                  {emojiPickerOpen &&
                    MESSAGE_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => appendEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}

                  {gifPickerOpen &&
                    MESSAGE_GIFS.map((gif) => (
                      <button
                        key={gif.url}
                        type="button"
                        className="composer-gif-option"
                        disabled={sending || !activeConversationId}
                        onClick={() => chooseGif(gif)}
                      >
                        <img src={gif.url} alt={gif.label} loading="lazy" />
                        <span>{gif.label}</span>
                      </button>
                    ))}
                </div>
              )}

              <div className="composer-tools">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                  hidden
                  onChange={handleMediaChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Gửi ảnh hoặc video"
                >
                  ＋
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGifPickerOpen(false);
                    setEmojiPickerOpen((currentOpen) => !currentOpen);
                  }}
                  aria-label="Chọn biểu tượng cảm xúc"
                >
                  ☺
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmojiPickerOpen(false);
                    setGifPickerOpen((currentOpen) => !currentOpen);
                  }}
                  aria-label="Chọn GIF"
                >
                  GIF
                </button>
              </div>
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
                disabled={sending}
              >
                {!messageInput.trim() && !selectedMedia
                  ? quickEmoji
                  : "Gửi"}
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

      {activeConversation && detailsOpen && (
        <aside className="messages-details">
          <section className="messages-details-profile">
            {activeAvatarUrl ? (
              <img src={activeAvatarUrl} alt={activePeerName} />
            ) : (
              <span>{activePeerName?.charAt(0)?.toUpperCase() || "U"}</span>
            )}
            <h2>{activePeerName}</h2>
            <p>{activePeerStatus}</p>
            <small>Được mã hóa đầu cuối</small>
          </section>

          <div className="messages-details-actions">
            <Link to={`/users/${activeOtherUser.id}`}>
              <span>◎</span>
              Trang cá nhân
            </Link>
            <button type="button" onClick={() => setMuted((current) => !current)}>
              <span>🔔</span>
              {muted ? "Bật thông báo" : "Tắt thông báo"}
            </button>
            <button type="button" onClick={focusMessageSearch}>
              <span>⌕</span>
              Tìm kiếm
            </button>
          </div>

          <section className="messages-details-section message-search-section">
            <h3>Tìm trong đoạn chat</h3>
            <label className="message-search-box">
              <span aria-hidden="true">⌕</span>
              <input
                ref={messageSearchInputRef}
                value={messageSearch}
                onChange={(event) => setMessageSearch(event.target.value)}
                placeholder="Tìm tin nhắn"
              />
            </label>
            {messageSearch.trim() && (
              <div className="message-search-results">
                {visibleMessageSearchResults.length > 0 ? (
                  visibleMessageSearchResults.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => scrollToMessage(message.id)}
                    >
                      <strong>
                        {Number(message.senderId) === Number(user.id)
                          ? "Bạn"
                          : message.senderName || activePeerName}
                      </strong>
                      <span>{getReplyPreviewText(message)}</span>
                    </button>
                  ))
                ) : (
                  <p>Không tìm thấy tin nhắn phù hợp.</p>
                )}
              </div>
            )}
          </section>

          <section className="messages-details-section">
            <h3>Thông tin về đoạn chat</h3>
            <Link to={`/users/${activeOtherUser.id}`}>Xem trang cá nhân</Link>
            <button
              type="button"
              disabled={messages.length === 0}
              onClick={() => setReportMessage(messages.at(-1) || null)}
            >
              Báo cáo tin nhắn gần nhất
            </button>
          </section>

          <section className="messages-details-section">
            <h3>Tùy chỉnh đoạn chat</h3>
            <button
              type="button"
              onClick={() =>
                setAccentTheme((currentTheme) =>
                  currentTheme === "blue" ? "violet" : "blue"
                )
              }
            >
              Đổi chủ đề
            </button>
            <button
              type="button"
              onClick={() =>
                setQuickEmoji((currentEmoji) =>
                  currentEmoji === "👍" ? "💜" : "👍"
                )
              }
            >
              Thay đổi biểu tượng cảm xúc
            </button>
            <div className="quick-emoji-options" aria-label="Chọn biểu tượng mặc định">
              {MESSAGE_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={quickEmoji === emoji ? "active" : ""}
                  onClick={() => setQuickEmoji(emoji)}
                  aria-label={`Dùng ${emoji} làm biểu tượng mặc định`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleEditNickname}>
              Chỉnh sửa biệt danh
            </button>
          </section>

          <section className="messages-details-section">
            <h3>File phương tiện và file</h3>
            {mediaMessages.length > 0 ? (
              <div className="message-detail-media-grid">
                {mediaMessages.slice(-9).reverse().map((message) => {
                  const mediaUrl = getFileUrl(message.mediaUrl);

                  return (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => scrollToMessage(message.id)}
                      aria-label="Mở file phương tiện trong đoạn chat"
                    >
                      {message.mediaType === "video" ? (
                        <video src={mediaUrl} muted preload="metadata" />
                      ) : (
                        <img
                          src={mediaUrl}
                          alt={message.mediaName || "File phương tiện"}
                          loading="lazy"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="messages-details-empty">
                Chưa có ảnh, video hoặc GIF.
              </p>
            )}

            <div className="message-detail-file-list">
              {fileMessages.length > 0 ? (
                fileMessages.slice(-6).reverse().map((message) => (
                  <a
                    key={message.id}
                    href={getFileUrl(message.mediaUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span aria-hidden="true">📎</span>
                    <strong>{message.mediaName || "Tệp tin"}</strong>
                  </a>
                ))
              ) : (
                <p className="messages-details-empty">Chưa có tệp tin.</p>
              )}
            </div>
          </section>

          <section className="messages-details-section">
            <h3>Quyền riêng tư và hỗ trợ</h3>
            <button type="button" onClick={() => setMuted((current) => !current)}>
              {muted ? "Bật thông báo" : "Tắt thông báo"}
            </button>
            <button
              type="button"
              disabled={messages.length === 0}
              onClick={() => setReportMessage(messages.at(-1) || null)}
            >
              Báo cáo
            </button>
          </section>
        </aside>
      )}

      {activeCall && activeConversation && (
        <div className="message-call-overlay" role="dialog" aria-modal="true">
          <section
            className={[
              "message-call-card",
              activeCall.type === "video" ? "video" : "voice",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              className="message-call-close"
              type="button"
              onClick={() => setActiveCall(null)}
              aria-label="Đóng cuộc gọi"
            >
              ×
            </button>

            {activeCall.type === "video" && (
              <div className="message-call-video-surface">
                {activeAvatarUrl ? (
                  <img src={activeAvatarUrl} alt="" />
                ) : (
                  <span>{activePeerName?.charAt(0)?.toUpperCase() || "U"}</span>
                )}
                <small>
                  {activeCall.cameraOff ? "Camera đã tắt" : "Đang kết nối video"}
                </small>
              </div>
            )}

            <div className="message-call-profile">
              {activeAvatarUrl ? (
                <img src={activeAvatarUrl} alt={activePeerName} />
              ) : (
                <span>{activePeerName?.charAt(0)?.toUpperCase() || "U"}</span>
              )}
              <h2>{activePeerName}</h2>
              <p>
                {activeCall.type === "video"
                  ? "Đang kết nối video..."
                  : "Đang kết nối cuộc gọi..."}
              </p>
            </div>

            <div className="message-call-actions">
              <button
                type="button"
                className={activeCall.muted ? "active" : ""}
                onClick={() =>
                  setActiveCall((currentCall) =>
                    currentCall
                      ? {
                          ...currentCall,
                          muted: !currentCall.muted,
                        }
                      : currentCall
                  )
                }
              >
                {activeCall.muted ? "Bật mic" : "Tắt mic"}
              </button>
              {activeCall.type === "video" && (
                <button
                  type="button"
                  className={activeCall.cameraOff ? "active" : ""}
                  onClick={() =>
                    setActiveCall((currentCall) =>
                      currentCall
                        ? {
                            ...currentCall,
                            cameraOff: !currentCall.cameraOff,
                          }
                        : currentCall
                    )
                  }
                >
                  {activeCall.cameraOff ? "Bật camera" : "Tắt camera"}
                </button>
              )}
              <button
                type="button"
                className="danger"
                onClick={() => setActiveCall(null)}
              >
                Kết thúc
              </button>
            </div>
          </section>
        </div>
      )}

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
