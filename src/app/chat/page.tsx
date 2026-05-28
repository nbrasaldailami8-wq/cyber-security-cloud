"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";
import { useAuthStore } from "@/store/authStore";
import ChatArea from "@/components/chat/ChatArea";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { trackPresence, getOnlineUsers, isAudioAuthorized, trackAudioPlayed, trackAudioSkippedHidden, trackAudioSkippedThrottle, trackAudioSkippedInactiveTab, trackAudioSkippedUnmounted } from "@/lib/supabaseRealtime";
import {
  traceMessageMutation,
  traceConversationMutation,
  traceAsyncRequest,
  traceAsyncResponse,
  traceRealtimeEvent,
  traceLifecycle,
  traceAudio,
  traceMessageLifecycle,
  trackMutationTimestamp,
  getLastRealtimeMutationAt,
  updateRealtimeLatencyMutation,
  getLastOwner,
  getLastRealtimeOwner,
  traceTyping,
  tracePresence,
} from "@/lib/realtimeDiagnostics";

// ==================== الأنواع ====================
interface ChatUser {
  id: string;
  name: string;
  role: string;
  level?: string;
  lastSeenAt?: string;
  lastLoginAt?: string;
}

interface Conversation {
  userId: string;
  name: string;
  role: string;
  level?: string;
  lastSeenAt?: string;
  lastLoginAt?: string;
  lastMessage: string;
  createdAt: string;
  isRead: boolean;
  isSent: boolean;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  body: string;
  isRead: boolean;
  isEdited: boolean;
  createdAt: string;
  sender: { id: string; name: string };
}

// ==================== الأيقونات ====================
const SearchIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// ==================== المكوّن الرئيسي ====================
export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id || "";
  const userRole = user?.role || "";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const mountedRef = useRef(true);
  const selectedUserRef = useRef(selectedUser);
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const conversationsRef = useRef<Conversation[]>([]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const latestRealtimeTimestampRef = useRef<number>(0);
  const loadMsgGenRef = useRef(0);
  const loadConvGenRef = useRef(0);
  const realtimeDeletedIdsRef = useRef(new Set<string>());
  const messageReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageSoundRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  // Restore selectedUser after remount (hydration guard)
  useEffect(() => {
    const saved = sessionStorage.getItem("chat_selectedUser");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          setSelectedUser(parsed);
        }
      } catch { /* ignore */ }
    }
  }, []);

  // Persist selectedUser across remounts
  useEffect(() => {
    if (selectedUser) {
      sessionStorage.setItem("chat_selectedUser", JSON.stringify(selectedUser));
    } else {
      sessionStorage.removeItem("chat_selectedUser");
    }
  }, [selectedUser]);

  useEffect(() => {
    mountedRef.current = true;
    traceLifecycle("ChatPage", "MOUNT", { userId, selectedUser: selectedUserRef.current?.id || null });
    return () => {
      mountedRef.current = false;
      traceLifecycle("ChatPage", "UNMOUNT", { userId });
      if (messageReloadTimerRef.current) clearTimeout(messageReloadTimerRef.current);
      if (conversationReloadTimerRef.current) clearTimeout(conversationReloadTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [userId]);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [convLoading, setConvLoading] = useState(true);
  const [conversationCursor, setConversationCursor] = useState<string | null>(null);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);

  // البحث
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [filterLevel, setFilterLevel] = useState("");
  const [filterRole, setFilterRole] = useState("");

  // ==================== تحميل المحادثات (cursor-based) ====================
  const loadConversations = useCallback(async (cursor?: string | null) => {
    if (cursor) setLoadingMoreConversations(true);
    else setConvLoading(true);
    const gen = ++loadConvGenRef.current;
    const requestTimestamp = Date.now();
    const seqId = traceAsyncRequest("/api/chat/messages", "LOAD_CONVERSATIONS", selectedUserRef.current?.id, { cursor: cursor || null });
    try {
      const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const res = await fetch(`/api/chat/messages${params}`);
      const data = await res.json();
      if (data.success) {
        setConversations((prev) => {
          if (gen !== loadConvGenRef.current) {
            if (process.env.NODE_ENV === "development") console.warn("[Chat] Discarded stale loadConversations response (gen mismatch)");
            return prev;
          }
          let next: Conversation[];
          if (cursor) {
            next = [...prev, ...data.data];
          } else {
            const serverIds = new Set(data.data.map((c: Conversation) => c.userId));
            const latestRealtime = latestRealtimeTimestampRef.current;
            if (latestRealtime > requestTimestamp) {
              const extras = prev.filter((c: Conversation) => !serverIds.has(c.userId));
              next = extras.length > 0 ? [...data.data, ...extras] : data.data;
            } else {
              next = data.data;
            }
          }
          const prevConvIds = prev.map((c: Conversation) => c.userId);
          const nextConvIds = next.map((c: Conversation) => c.userId);
          traceConversationMutation(
            "API",
            cursor ? "LOAD_MORE_CONVERSATIONS" : "LOAD_CONVERSATIONS",
            prevConvIds,
            nextConvIds,
            prev.filter((c: Conversation) => !c.isRead && !c.isSent).length,
            next.filter((c: Conversation) => !c.isRead && !c.isSent).length,
            selectedUserRef.current?.id ?? null,
            { conversationCount: next.length },
          );
          trackMutationTimestamp("API_LOAD_CONVERSATIONS");
          return next;
        });
        setConversationCursor(data.nextCursor);
        setHasMoreConversations(!!data.nextCursor);
      }
      traceAsyncResponse("/api/chat/messages", "LOAD_CONVERSATIONS", seqId, requestTimestamp, selectedUserRef.current?.id, getLastRealtimeMutationAt() || null, { success: data?.success });
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.warn("[Chat] loadConversations failed:", e);
      traceAsyncResponse("/api/chat/messages", "LOAD_CONVERSATIONS", seqId, requestTimestamp, selectedUserRef.current?.id, getLastRealtimeMutationAt() || null, { failed: true });
    }
    setConvLoading(false);
    setLoadingMoreConversations(false);
  }, []);

  const loadMoreConversations = useCallback(() => {
    if (conversationCursor && !loadingMoreConversations) {
      loadConversations(conversationCursor);
    }
  }, [conversationCursor, loadingMoreConversations, loadConversations]);

  // ==================== تحميل رسائل محادثة (cursor-based) ====================
  const loadMessages = useCallback(async (otherId: string, cursor?: string | null) => {
    if (cursor) setLoadingMoreMessages(true);
    const gen = ++loadMsgGenRef.current;
    const seqId = traceAsyncRequest("/api/chat/messages", "LOAD_MESSAGES", selectedUserRef.current?.id, { otherId, cursor: cursor || null });
    const requestTimestamp = Date.now();
    try {
      const params = cursor
        ? `?userId=${encodeURIComponent(otherId)}&cursor=${encodeURIComponent(cursor)}`
        : `?userId=${encodeURIComponent(otherId)}`;
      const res = await fetch(`/api/chat/messages${params}`);
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => {
          // Stale response guard: if a newer request was made, discard this
          if (gen !== loadMsgGenRef.current) {
            if (process.env.NODE_ENV === "development") console.warn("[Chat] Discarded stale loadMessages response (gen mismatch)");
            return prev;
          }
          const prevIds = prev.map((m) => m.id);
          let next: Message[];
          const latestRealtime = latestRealtimeTimestampRef.current;
          if (cursor) {
            const existingIds = new Set(prev.map((m: Message) => m.id));
            if (latestRealtime > requestTimestamp) {
              const cursorFiltered = data.data.filter((m: Message) => !realtimeDeletedIdsRef.current.has(m.id) && !existingIds.has(m.id));
              next = [...prev, ...cursorFiltered];
            } else {
              const cursorDeduped = data.data.filter((m: Message) => !existingIds.has(m.id));
              next = [...prev, ...cursorDeduped];
            }
          } else {
            const serverIds = new Set(data.data.map((m: Message) => m.id));
            const pending = prev.filter((m) => m.id.startsWith("temp_") && !serverIds.has(m.id) && (m.senderId === userId && m.receiverId === otherId || m.senderId === otherId && m.receiverId === userId));
            if (latestRealtime > requestTimestamp) {
              const prevMap = new Map(prev.map((m: Message) => [m.id, m]));
              const mergedApi = data.data.filter((m: Message) => !realtimeDeletedIdsRef.current.has(m.id))
                .map((m: Message) => {
                  const prevVersion = prevMap.get(m.id);
                  if (prevVersion && prevVersion.isEdited) return prevVersion;
                  return m;
                });
              const extras = prev.filter(m => !m.id.startsWith("temp_") && !serverIds.has(m.id) && (m.senderId === userId && m.receiverId === otherId || m.senderId === otherId && m.receiverId === userId));
              next = extras.length > 0 ? [...mergedApi, ...extras, ...pending] : (pending.length > 0 ? [...mergedApi, ...pending] : mergedApi);
            } else {
              next = pending.length > 0 ? [...data.data, ...pending] : data.data;
            }
          }
          const nextIds = next.map((m) => m.id);
          traceMessageMutation("API", cursor ? "LOAD_MORE_MESSAGES" : "LOAD_MESSAGES_API", prevIds, nextIds, selectedUserRef.current?.id, otherId, { cursor: !!cursor, pendingTempsPreserved: nextIds.filter(id => id.startsWith("temp_")).length });
          trackMutationTimestamp("API_LOAD_MESSAGES");
          return next;
        });
        setMessageCursor(data.nextCursor);
        setHasMoreMessages(!!data.nextCursor);
      }
      traceAsyncResponse("/api/chat/messages", "LOAD_MESSAGES", seqId, requestTimestamp, selectedUserRef.current?.id, getLastRealtimeMutationAt() || null, { otherId, cursor: !!cursor, success: data?.success });
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.warn("[Chat] loadMessages failed:", e);
      traceAsyncResponse("/api/chat/messages", "LOAD_MESSAGES", seqId, requestTimestamp, selectedUserRef.current?.id, getLastRealtimeMutationAt() || null, { otherId, cursor: !!cursor, failed: true });
    }
    setLoadingMoreMessages(false);
  }, []);

  const loadMoreMessages = useCallback(() => {
    if (selectedUser && messageCursor && !loadingMoreMessages) {
      loadMessages(selectedUser.id, messageCursor);
    }
  }, [selectedUser, messageCursor, loadingMoreMessages, loadMessages]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ==================== قناة Supabase مع إعادة اتصال تلقائي ====================
  const { connectionState } = useSupabaseRealtime(`user-${userId}`, [
    {
      event: "new-message",
      handler: (payload: any) => {
        const data = payload;
        const currentSelected = selectedUserRef.current;
        const arrivalTs = Date.now();
        latestRealtimeTimestampRef.current = arrivalTs;
        traceRealtimeEvent("new-message", data.id || data.tempId, arrivalTs, currentSelected?.id, { senderId: data.senderId, receiverId: data.receiverId });

        // Always refresh conversation list (debounced) for ALL incoming messages
        if (conversationReloadTimerRef.current) clearTimeout(conversationReloadTimerRef.current);
        conversationReloadTimerRef.current = setTimeout(() => {
          traceAsyncRequest("/api/chat/messages", "LOAD_CONVERSATIONS_REALTIME", selectedUserRef.current?.id, { trigger: "new-message" });
          loadConversations();
        }, 300);

        if (
          currentSelected &&
          (data.senderId === currentSelected.id ||
            data.receiverId === currentSelected.id)
        ) {
          // Play sound only for incoming messages from others
          if (data.senderId !== userId) {
            if (!mountedRef.current) {
              trackAudioSkippedUnmounted();
              traceAudio("AUDIO_SKIPPED_UNMOUNTED", "NEW_MESSAGE", { senderId: data.senderId, payloadId: data.id });
            } else if (document.visibilityState !== "visible") {
              trackAudioSkippedHidden();
              traceAudio("AUDIO_SKIPPED_HIDDEN", "NEW_MESSAGE", { visibilityState: document.visibilityState, senderId: data.senderId, payloadId: data.id });
            } else if (!isAudioAuthorized()) {
              trackAudioSkippedInactiveTab();
              traceAudio("AUDIO_SKIPPED_UNAUTHORIZED", "NEW_MESSAGE", { senderId: data.senderId, payloadId: data.id });
            } else {
              const now = Date.now();
              if (now - lastMessageSoundRef.current < 1000) {
                trackAudioSkippedThrottle();
                traceAudio("AUDIO_SKIPPED_THROTTLE", "NEW_MESSAGE", { throttleMs: now - lastMessageSoundRef.current, senderId: data.senderId, payloadId: data.id });
              } else {
                lastMessageSoundRef.current = now;
                try {
                  if (!audioRef.current) {
                    audioRef.current = new Audio("/sounds/notification.mp3");
                  }
                  audioRef.current.volume = 0.5;
                  audioRef.current.currentTime = 0;
                  const playPromise = audioRef.current.play();
                  if (playPromise) {
                    playPromise
                      .then(() => traceAudio("AUDIO_PLAY_SUCCESS", "NEW_MESSAGE", { senderId: data.senderId, payloadId: data.id }))
                      .catch((err: unknown) => traceAudio("AUDIO_PLAY_REJECTED", "NEW_MESSAGE", { error: String(err), senderId: data.senderId, payloadId: data.id }));
                  }
                } catch (err) {
                  traceAudio("AUDIO_PLAY_REJECTED", "NEW_MESSAGE", { error: String(err), senderId: data.senderId, payloadId: data.id });
                }
                trackAudioPlayed();
              }
            }
          }
          if (data.senderId !== userId && data.receiverId === userId) {
            const targetUserId = currentSelected.id;
            if (messageReloadTimerRef.current) clearTimeout(messageReloadTimerRef.current);
            messageReloadTimerRef.current = setTimeout(() => {
              if (selectedUserRef.current?.id === targetUserId) {
                traceAsyncRequest("/api/chat/messages", "LOAD_MESSAGES_REALTIME", selectedUserRef.current?.id, { trigger: "new-message", targetUserId });
                loadMessages(targetUserId, null);
              }
            }, 300);
          }
        }
      },
    },
    {
      event: "message-edited",
      handler: (payload: any) => {
        const { messageId, body } = payload;
        if (!messageId) return;
        const handlerTs = Date.now();
        latestRealtimeTimestampRef.current = handlerTs;
        traceRealtimeEvent("message-edited", messageId, handlerTs, selectedUserRef.current?.id, {});
        setMessages((prev) => {
          const prevIds = prev.map((m) => m.id);
          const next = prev.map((msg) =>
            msg.id === messageId ? { ...msg, body, isEdited: true } : msg
          );
          traceMessageMutation("REALTIME", "MESSAGE_EDIT", prevIds, next.map((m) => m.id), selectedUserRef.current?.id, null, { messageId });
          trackMutationTimestamp("REALTIME_MESSAGE_EDIT");
          updateRealtimeLatencyMutation(messageId);
          // forensic: track the edited message
          traceMessageLifecycle("MESSAGE_EDITED", messageId, { source: "REALTIME", handlerTs });
          return next;
        });
      },
    },
    {
      event: "message-deleted",
      handler: (payload: any) => {
        const { messageId } = payload;
        if (!messageId) return;
        realtimeDeletedIdsRef.current.add(messageId);
        const handlerTs = Date.now();
        latestRealtimeTimestampRef.current = handlerTs;
        traceRealtimeEvent("message-deleted", messageId, handlerTs, selectedUserRef.current?.id, {});
        setMessages((prev) => {
          const prevIds = prev.map((m) => m.id);
          const next = prev.filter((msg) => msg.id !== messageId);
          traceMessageMutation("REALTIME", "MESSAGE_DELETE", prevIds, next.map((m) => m.id), selectedUserRef.current?.id, null, { messageId });
          trackMutationTimestamp("REALTIME_MESSAGE_DELETE");
          updateRealtimeLatencyMutation(messageId);
          traceMessageLifecycle("MESSAGE_DELETED", messageId, { source: "REALTIME", handlerTs });
          return next;
        });
      },
    },
    {
      event: "messages-read",
      handler: (payload: any) => {
        const data = payload;
        const handlerTs = Date.now();
        latestRealtimeTimestampRef.current = handlerTs;
        traceRealtimeEvent("messages-read", data?.conversationId || "unknown", handlerTs, selectedUserRef.current?.id, { isRead: data?.isRead });
        if (data && data.isRead && selectedUserRef.current) {
          traceAsyncRequest("/api/chat/messages", "LOAD_MESSAGES_READ_RECEIPT", selectedUserRef.current?.id, { trigger: "messages-read" });
          loadMessages(selectedUserRef.current.id);
        }
      },
    },
    {
      event: "typing",
      handler: (payload: any) => {
        const data = payload;
        const currentSelected = selectedUserRef.current;
        if (data && currentSelected && data.userId === currentSelected.id) {
          traceTyping("TYPING_START", { userId: data.userId, byUserId: data.userId, conversationWith: currentSelected.id });
          setTypingUser(data.userId);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            traceTyping("TYPING_TIMEOUT", { userId: data.userId });
            setTypingUser(null);
          }, 3000);
        }
      },
    },
    {
      event: "typing_stop",
      handler: (payload: any) => {
        const data = payload;
        if (data && data.userId === selectedUserRef.current?.id) {
          traceTyping("TYPING_STOP", { userId: data.userId });
          setTypingUser(null);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
      },
    },
  ]);

  useEffect(() => {
    if (!userId) return;
    tracePresence("TRACK_PRESENCE_CALLED", { userId });
    trackPresence(userId);
  }, [userId]);

  // متابعة قائمة المستخدمين المتصلين
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = getOnlineUsers((users: string[]) => {
      setOnlineUserIds(new Set(users));
    });
    return () => { unsubscribe(); };
  }, [userId]);
  // Trace conversation switches
  useEffect(() => {
    traceLifecycle("ChatPage", "SELECTED_USER_CHANGE", { selectedUserId: selectedUser?.id || null, selectedUserName: selectedUser?.name || null });
  }, [selectedUser]);

  // Load messages when selectedUser is restored after remount
  useEffect(() => {
    if (selectedUser && messages.length === 0) {
      traceLifecycle("ChatPage", "RESTORE_CHAT_AFTER_REMOUNT", { userId: selectedUser.id });
      setMessageCursor(null);
      setHasMoreMessages(false);
      loadMessages(selectedUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);
  // ==================== البحث ====================
  const searchUsers = async () => {
    if (searchTerm.length < 2 && !filterLevel && !filterRole) {
      setSearchResults([]);
      return;
    }
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (filterLevel) params.set("level", filterLevel);
      if (filterRole) params.set("role", filterRole);
      const res = await fetch(`/api/chat/users?${params}`);
      const data = await res.json();
      if (data.success) setSearchResults(data.data);
    } catch {}
  };

  // ==================== فتح / إغلاق محادثة ====================
  const openChat = (chatUser: ChatUser | Conversation) => {
    const c = chatUser as any;
    const prevSelectedId = selectedUserRef.current?.id;
    const prevMsgIds = messagesRef.current.map((m) => m.id);
    const targetUserId = c.userId || c.id;
    traceLifecycle("ChatPage", "OPEN_CHAT", { fromUserId: prevSelectedId || null, toUserId: targetUserId, prevMessageCount: prevMsgIds.length });
    if (prevMsgIds.length > 0) {
      traceMessageMutation("CLIENT", "CONVERSATION_SWITCH", prevMsgIds, [], selectedUserRef.current?.id, targetUserId, { action: "open_chat", targetUserId });
    }
    setTypingUser(null);
    setSelectedUser({
      id: targetUserId,
      name: c.name,
      role: c.role,
      level: c.level,
      lastSeenAt: c.lastSeenAt,
      lastLoginAt: c.lastLoginAt,
    });
    setMessageCursor(null);
    setHasMoreMessages(false);
    traceAsyncRequest("/api/chat/messages", "LOAD_MESSAGES_OPEN_CHAT", targetUserId, { targetUserId });
    loadMessages(targetUserId);
    setShowMobileChat(true);
    setShowSearch(false);
    setSearchResults([]);
    setSearchTerm("");
  };

  const closeChat = () => {
    const prevIds = messagesRef.current.map((m) => m.id);
    const prevConversations = conversationsRef.current.map((c) => c.userId);
    setSelectedUser(null);
    setMessages([]);
    traceMessageMutation("CLIENT", "CONVERSATION_SWITCH", prevIds, [], selectedUserRef.current?.id, null, { action: "close_chat" });
    trackMutationTimestamp("CLIENT_CLOSE_CHAT");
    setMessageCursor(null);
    setHasMoreMessages(false);
    setShowMobileChat(false);
  };

  // ==================== أدوات مساعدة ====================
  const getRoleColor = (role: string) =>
    ({
      ADMIN: "#ff3131",
      MANAGEMENT: "#ffca28",
      TEACHER: "#bf5af2",
      STUDENT: "#00e5ff",
    })[role] || "#8b949e";
  const getRoleLabel = (role: string) =>
    ({ ADMIN: "أدمن", MANAGEMENT: "إدارة", TEACHER: "معلم", STUDENT: "طالب" })[
      role
    ] || role;
  const getLevelLabel = (l?: string) =>
    l
      ? { LEVEL_1: "م1", LEVEL_2: "م2", LEVEL_3: "م3", LEVEL_4: "م4" }[l] || l
      : "";
  const getConnectionColor = (state: string) =>
    state === "connected" ? "#2ea043" : state === "reconnecting" ? "#ffca28" : "#f85149";
  const getConnectionLabel = (state: string) =>
    state === "connected" ? "متصل" : state === "reconnecting" ? "إعادة اتصال..." : "غير متصل";
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("ar-YE", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const glassStyle: React.CSSProperties = {
    background: "rgba(10, 20, 40, 0.55)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0, 229, 255, 0.1)",
    borderRadius: "16px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(0, 0, 0, 0.5)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "10px",
    color: "#e6edf3",
    fontSize: "0.85rem",
    fontFamily: "'Cairo', sans-serif",
    outline: "none",
  };

  // ==================== الواجهة ====================
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        fontFamily: "'Cairo', sans-serif",
        color: "#fff",
      }}
    >
      <Header />
      <Sidebar />
      <PageTransition>
        <div
          style={{
            display: "flex",
            height: "calc(100vh - 60px)",
            paddingTop: "90px",
          }}
        >
          {/* ========== قائمة المحادثات ========== */}
          <div
            className={showMobileChat ? "hidden md:flex" : "flex"}
            style={{
              width: "100%",
              maxWidth: "380px",
              flexDirection: "column",
              borderLeft: "1px solid rgba(255,255,255,0.05)",
              ...glassStyle,
              margin: "0 10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "15px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  color: "#00e5ff",
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  title={getConnectionLabel(connectionState)}
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: getConnectionColor(connectionState),
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                💬 المحادثات
              </h3>
              <button
                onClick={() => setShowSearch(!showSearch)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "10px",
                  background: showSearch
                    ? "rgba(0,229,255,0.12)"
                    : "rgba(255,255,255,0.03)",
                  border: showSearch
                    ? "1px solid #00e5ff"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: showSearch ? "#00e5ff" : "#8b949e",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <SearchIcon /> بحث
              </button>
            </div>

            {/* لوحة البحث */}
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    style={{
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="ابحث بالاسم..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={inputStyle}
                    />
                    {(userRole === "ADMIN" || userRole === "MANAGEMENT") && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        {userRole === "ADMIN" && (
                          <select
                            value={filterLevel}
                            onChange={(e) => setFilterLevel(e.target.value)}
                            style={{
                              ...inputStyle,
                              flex: 1,
                              cursor: "pointer",
                              appearance: "none",
                            }}
                          >
                            <option value="">كل المستويات</option>
                            <option value="LEVEL_1">المستوى 1</option>
                            <option value="LEVEL_2">المستوى 2</option>
                            <option value="LEVEL_3">المستوى 3</option>
                            <option value="LEVEL_4">المستوى 4</option>
                          </select>
                        )}
                        <select
                          value={filterRole}
                          onChange={(e) => setFilterRole(e.target.value)}
                          style={{
                            ...inputStyle,
                            flex: 1,
                            cursor: "pointer",
                            appearance: "none",
                          }}
                        >
                          <option value="">كل الهويات</option>
                          <option value="STUDENT">طالب</option>
                          <option value="TEACHER">معلم</option>
                          {userRole === "ADMIN" && (
                            <option value="MANAGEMENT">إدارة</option>
                          )}
                        </select>
                      </div>
                    )}
                    <button
                      onClick={searchUsers}
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #00e5ff, #0077b6)",
                        border: "none",
                        color: "#010204",
                        cursor: "pointer",
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      <SearchIcon /> بحث
                    </button>
                    {searchResults.length > 0 && (
                      <div
                        style={{
                          maxHeight: "200px",
                          overflowY: "auto",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        {searchResults.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => openChat(u)}
                            style={{
                              padding: "10px",
                              borderRadius: "10px",
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.05)",
                              color: "#fff",
                              cursor: "pointer",
                              textAlign: "right",
                              fontFamily: "'Cairo', sans-serif",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{
                                color: getRoleColor(u.role),
                                fontSize: "0.65rem",
                                background: "rgba(255,255,255,0.05)",
                                padding: "2px 8px",
                                borderRadius: "20px",
                              }}
                            >
                              {getRoleLabel(u.role)}
                            </span>
                            <span style={{ flex: 1 }}>{u.name}</span>
                            {getLevelLabel(u.level) && (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  color: "#8b949e",
                                }}
                              >
                                {getLevelLabel(u.level)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* قائمة المحادثات */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {convLoading ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#8b949e",
                  }}
                >
                  ⏳ جاري التحميل...
                </div>
              ) : conversations.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#8b949e",
                  }}
                >
                  📭 لا توجد محادثات
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.userId}
                    onClick={() => openChat(conv)}
                    style={{
                      width: "100%",
                      padding: "12px 15px",
                      border: "none",
                      textAlign: "right",
                      cursor: "pointer",
                      fontFamily: "'Cairo', sans-serif",
                      background:
                        selectedUser?.id === conv.userId
                          ? "rgba(0,229,255,0.08)"
                          : "transparent",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      transition: "background 0.2s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {onlineUserIds.has(conv.userId) && (
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: "#2ea043",
                              boxShadow: "0 0 6px rgba(46,160,67,0.5)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.9rem",
                            color: "#e6edf3",
                          }}
                        >
                          {conv.name}
                        </span>
                        <span
                          style={{
                            color: getRoleColor(conv.role),
                            fontSize: "0.6rem",
                            background: "rgba(255,255,255,0.05)",
                            padding: "2px 6px",
                            borderRadius: "10px",
                          }}
                        >
                          {getRoleLabel(conv.role)}
                        </span>
                      </div>
                      {!conv.isRead && !conv.isSent && (
                        <span
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: "#00e5ff",
                            boxShadow: "0 0 6px #00e5ff",
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        color: "#8b949e",
                        fontSize: "0.75rem",
                        marginTop: "4px",
                      }}
                    >
                      {typingUser === conv.userId ? (
                        <span style={{ color: "#00e5ff", fontWeight: 600 }}>
                          ✍️ يكتب الآن...
                        </span>
                      ) : onlineUserIds.has(conv.userId) ? (
                        <span style={{ color: "#2ea043", fontWeight: 600 }}>
                          🟢 متصل الآن
                        </span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          {conv.isSent && (
                            <span
                              style={{ color: conv.isRead ? "#00e5ff" : "#5a6a7a" }}
                            >
                              {conv.isRead ? "✓✓" : "✓"}
                            </span>
                          )}
                          {conv.lastMessage}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
              {hasMoreConversations && (
                <button
                  onClick={loadMoreConversations}
                  disabled={loadingMoreConversations}
                  style={{
                    width: "100%",
                    padding: "14px",
                    border: "none",
                    background: "rgba(0,229,255,0.05)",
                    color: loadingMoreConversations ? "#5a6a7a" : "#00e5ff",
                    cursor: loadingMoreConversations ? "default" : "pointer",
                    fontFamily: "'Cairo', sans-serif",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                  }}
                >
                  {loadingMoreConversations ? "جاري التحميل..." : "تحميل المزيد ↑"}
                </button>
              )}
            </div>
          </div>

          {/* ========== منطقة الرسائل (ChatArea) ========== */}
          <div
            className={!showMobileChat ? "hidden md:flex" : "flex"}
            style={{
              flex: 1,
              flexDirection: "column",
              ...glassStyle,
              margin: "0 10px",
              overflow: "hidden",
            }}
          >
            <ChatArea
              userId={userId}
              selectedUser={selectedUser}
              messages={messages}
              onClose={closeChat}
              onMessageSent={() => {
                loadConversations();
              }}
              onConversationDeleted={loadConversations}
              onNewMessage={(msg, replaceTempId) => {
                setMessages((prev) => {
                  const prevIds = prev.map((m) => m.id);
                  const next = replaceTempId
                    ? prev.map((m) => (m.id === replaceTempId ? msg : m))
                    : [...prev, msg];
                  const nextIds = next.map((m) => m.id);
                  const label = replaceTempId ? "SEND_REPLACEMENT" : "OPTIMISTIC_SEND";
                  traceMessageMutation("CLIENT", label, prevIds, nextIds, selectedUserRef.current?.id, null, { replaceTempId: replaceTempId || null, msgId: msg.id, msgSenderId: msg.senderId });
                  trackMutationTimestamp(replaceTempId ? "CLIENT_SEND_REPLACEMENT" : "CLIENT_OPTIMISTIC_SEND");
                  return next;
                });
              }}
              hasMoreMessages={hasMoreMessages}
              loadingMoreMessages={loadingMoreMessages}
              onLoadMoreMessages={loadMoreMessages}
              typingUserId={typingUser}
              connectionState={connectionState}
            />
          </div>
        </div>
      </PageTransition>
      <Footer />
    </div>
  );
}
