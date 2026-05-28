"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { csrfFetch } from "@/lib/csrfClient";
import { getOnlineUsers } from "@/lib/supabaseRealtime";
import { getUserChannelName } from "@/lib/realtimeChannels";
import { traceOptimistic, traceLifecycle, traceAudio, traceRenderSkip, traceMessageLifecycle } from "@/lib/realtimeDiagnostics";

// ==================== الأنواع ====================
interface ChatUser {
  id: string;
  name: string;
  role: string;
  level?: string;
  lastSeenAt?: string;
  lastLoginAt?: string;
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
const BackIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const EditIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const BlockIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

// ==================== خصائص ====================
interface ChatAreaProps {
  userId: string;
  selectedUser: ChatUser | null;
  messages: Message[];
  onClose: () => void;
  onMessageSent: () => void;
  onConversationDeleted: () => void;
  onNewMessage?: (msg: Message, replaceTempId?: string) => void;
  typingUserId?: string | null;
  hasMoreMessages?: boolean;
  loadingMoreMessages?: boolean;
  onLoadMoreMessages?: () => void;
  connectionState?: string;
}

export default function ChatArea({
  userId,
  selectedUser,
  messages,
  onClose,
  onMessageSent,
  onConversationDeleted,
  onNewMessage,
  typingUserId,
  hasMoreMessages,
  loadingMoreMessages,
  onLoadMoreMessages,
  connectionState,
}: ChatAreaProps) {
  const { showToast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sendingMsgId, setSendingMsgId] = useState<string | null>(null);
  const [failedMsgId, setFailedMsgId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    show: boolean;
    title: string;
    message: string;
    action: string;
    messageId?: string;
  }>({ show: false, title: "", message: "", action: "" });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingEmitRef = useRef<NodeJS.Timeout | null>(null);
  const typingStopRef = useRef<NodeJS.Timeout | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => { onNewMessageRef.current = onNewMessage; });
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; });

  const retryQueueRef = useRef<
    Array<{
      tempId: string;
      body: string;
      receiverId: string;
      replyToId?: string;
      idempotencyKey: string;
      retryCount: number;
    }>
  >([]);
  const MAX_RETRIES = 3;

  // تتبع المستخدمين المتصلين عبر Presence
  useEffect(() => {
    const unsubscribe = getOnlineUsers((users) => {
      setOnlineUsers(new Set(users));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // تفعيل الصوت (يحتاج تفاعل مستخدم مرة واحدة)
  useEffect(() => {
    const unlockAudio = () => {
      const audio = new Audio();
      audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      audio.preload = "none";
      audio.volume = 0;
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          traceAudio("AUDIO_UNLOCK_SUCCESS", "USER_INTERACTION", {});
        })
        .catch(() => {
          traceAudio("AUDIO_UNLOCK_REJECTED", "USER_INTERACTION", {});
        });
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
    };
    document.addEventListener("click", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    traceLifecycle("ChatArea", "MOUNT", { userId });
    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      traceLifecycle("ChatArea", "UNMOUNT", { userId });
    };
  }, [userId]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // FORENSIC: Detect messages in state but not rendered
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!selectedUser) return;
    const totalInState = messages.length;
    const renderedIds: string[] = [];
    const skippedIds: string[] = [];
    for (const msg of messages) {
      if (!searchTerm || msg.body.includes(searchTerm)) {
        renderedIds.push(msg.id);
        traceMessageLifecycle("MESSAGE_RENDERED", msg.id, { searchTerm: searchTerm || null, selectedUserId: selectedUser.id });
      } else {
        skippedIds.push(msg.id);
        traceMessageLifecycle("MESSAGE_NOT_RENDERED", msg.id, { reason: "SEARCH_FILTER", searchTerm, selectedUserId: selectedUser.id });
      }
    }
    if (skippedIds.length > 0) {
      traceRenderSkip(totalInState, renderedIds.length, skippedIds, "SEARCH_FILTER", { searchTerm, selectedUserId: selectedUser.id });
    }
    // Detect message in state but not rendered (no search filter)
    if (renderedIds.length < totalInState && !searchTerm) {
      const missingIds = messages.filter(m => !renderedIds.includes(m.id)).map(m => m.id);
      traceRenderSkip(totalInState, renderedIds.length, missingIds, "UNKNOWN_SKIP", { selectedUserId: selectedUser.id });
      for (const missingId of missingIds) {
        traceMessageLifecycle("MESSAGE_VISIBILITY_REJECTED", missingId, { reason: "UNKNOWN_SKIP", selectedUserId: selectedUser.id });
      }
    }
  }, [messages, searchTerm, selectedUser]);
  // تنظيف typingTimeouts عند unmount
  useEffect(() => {
    return () => {
      if (typingEmitRef.current) clearTimeout(typingEmitRef.current);
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
    };
  }, []);
  // إرسال حدث typing مع debounce (مرة كل ثانيتين كحد أقصى)
  const debouncedTypingEmit = useCallback(() => {
    if (typingEmitRef.current) return;
    typingEmitRef.current = setTimeout(() => {
      typingEmitRef.current = null;
    }, 2000);
    if (selectedUser && userId) {
      import("@/lib/supabaseRealtime")
        .then(({ broadcastEvent }) => {
          broadcastEvent(getUserChannelName(selectedUser.id), "typing", {
            userId,
            name: "",
          });
        })
        .catch(() => {});
    }
  }, [selectedUser, userId]);
  const resetTypingStop = useCallback(() => {
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => {
      if (selectedUser && userId) {
        import("@/lib/supabaseRealtime")
          .then(({ broadcastEvent }) => {
            broadcastEvent(getUserChannelName(selectedUser.id), "typing_stop", {
              userId,
            });
          })
          .catch(() => {});
      }
    }, 2000);
  }, [selectedUser, userId]);
  // ==================== إرسال ====================
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    const messageToSend = newMessage.trim();
    const tempId = `temp_${Date.now()}`;

    // 1. إظهار الرسالة فوراً في الواجهة (Optimistic UI)
    const optimisticMsg: Message = {
      id: tempId,
      senderId: userId,
      receiverId: selectedUser.id,
      body: messageToSend,
      isRead: false,
      isEdited: false,
      createdAt: new Date().toISOString(),
      sender: { id: userId, name: "أنت" },
      ...(replyTo
        ? ({
            replyTo: {
              id: replyTo.id,
              body: replyTo.body,
              sender: replyTo.sender,
            },
          } as any)
        : {}),
    };

    // إضافة الرسالة للواجهة مباشرة (optimistic)
    if (onNewMessage) {
      onNewMessage(optimisticMsg);
    }
    traceOptimistic("TEMP_CREATED", tempId, { body: messageToSend.slice(0, 50), receiverId: selectedUser.id, replyToId: replyTo?.id || null });
    // منع التكرار: نخزن الـ tempId عشان realtime ما يضيفه مرة ثانية
    const tempIdRef = tempId;

    setNewMessage("");
    setReplyTo(null); // إخفاء شريط الرد بعد الإرسال
    setSendingMsgId(tempId);
    setLoading(true);

    const idempotencyKey = crypto.randomUUID();

    try {
      const res = await csrfFetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedUser.id,
          body: messageToSend,
          replyToId: replyTo?.id || undefined,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSendingMsgId(null);
        // استبدال الرسالة المؤقتة (temp) بالرسالة الحقيقية من السيرفر
        if (data.data && onNewMessage) {
          const serverMsg = data.data as any;
          const replacement: Message = {
            ...optimisticMsg,
            id: serverMsg.id,
            createdAt: serverMsg.createdAt,
            isRead: serverMsg.isRead ?? false,
            isEdited: serverMsg.isEdited ?? false,
          };
          traceOptimistic("TEMP_REPLACED", tempId, { serverId: serverMsg.id, body: messageToSend.slice(0, 50), receiverId: selectedUser.id });
          onNewMessage(replacement, tempId);
        }
      } else {
        throw new Error(data.message);
      }
    } catch {
      setSendingMsgId(null);
      setFailedMsgId(tempId);
      retryQueueRef.current.push({
        tempId,
        body: messageToSend,
        receiverId: selectedUser.id,
        replyToId: replyTo?.id,
        idempotencyKey,
        retryCount: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // ==================== إعادة المحاولة (Retry Queue) ====================
  const processRetryQueue = useCallback(async () => {
    const queue = retryQueueRef.current;
    if (queue.length === 0) return;
    const entries = [...queue];
    for (const entry of entries) {
      if (entry.retryCount >= MAX_RETRIES) continue;
      entry.retryCount++;
      setSendingMsgId(entry.tempId);
      try {
        const res = await csrfFetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiverId: entry.receiverId,
            body: entry.body,
            replyToId: entry.replyToId,
            idempotencyKey: entry.idempotencyKey,
          }),
        });
        const data = await res.json();
        if (data.success) {
          retryQueueRef.current = retryQueueRef.current.filter(
            (e) => e.tempId !== entry.tempId
          );
          setFailedMsgId((prev) => (prev === entry.tempId ? null : prev));
          // استبدال الرسالة المؤقتة بالرسالة الحقيقية بعد نجاح إعادة المحاولة
          if (data.data && onNewMessageRef.current) {
            const serverMsg = data.data as any;
            const replacement: Message = {
              id: serverMsg.id,
              senderId: userIdRef.current,
              receiverId: entry.receiverId,
              body: entry.body,
              isRead: false,
              isEdited: false,
              createdAt: serverMsg.createdAt,
              sender: { id: userIdRef.current, name: "أنت" },
            };
            traceOptimistic("TEMP_REPLACED_RETRY", entry.tempId, { serverId: serverMsg.id, retryCount: entry.retryCount });
            onNewMessageRef.current(replacement, entry.tempId);
          }
        } else {
          throw new Error(data.message);
        }
      } catch {
        setFailedMsgId(entry.tempId);
      } finally {
        setSendingMsgId((prev) => (prev === entry.tempId ? null : prev));
      }
      if (entries.length > 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }, []);

  useEffect(() => {
    if (connectionState === "connected") {
      processRetryQueue();
    }
  }, [connectionState, processRetryQueue]);

  // ==================== تعديل ====================
  const handleEditMessage = async () => {
    if (!editingMsg || !editBody.trim()) return;
    try {
      const res = await csrfFetch("/api/chat/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: editingMsg.id,
          newBody: editBody.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ تم تعديل الرسالة", "success");
        setEditingMsg(null);
        onMessageSent();
      } else {
        showToast(data.message, "error");
      }
    } catch {
      showToast("فشل التعديل", "error");
    }
  };
  // ==================== حذف للجميع ====================
  const handleDeleteForEveryone = (messageId: string) => {
    setConfirmAction({
      show: true,
      title: "حذف للجميع",
      message: "سيتم حذف الرسالة من المحادثة للطرفين. هل أنت متأكد؟",
      action: "delete-for-everyone",
      messageId,
    });
  };

  const executeDeleteForEveryone = async () => {
    const messageId = confirmAction.messageId;
    setConfirmAction({ show: false, title: "", message: "", action: "" });
    if (!messageId) return;
    try {
      const res = await csrfFetch("/api/chat/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, action: "delete-for-everyone" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ تم حذف الرسالة للجميع", "warning");
        onMessageSent();
      } else {
        showToast(data.message, "error");
      }
    } catch {
      showToast("فشل الحذف", "error");
    }
  };
  // ==================== حذف رسالة ====================
  const handleDeleteMessage = (messageId: string) => {
    setConfirmAction({
      show: true,
      title: "حذف الرسالة",
      message: "هل أنت متأكد من حذف هذه الرسالة؟",
      action: "delete-message",
      messageId,
    });
  };

  const executeDeleteMessage = async () => {
    const messageId = confirmAction.messageId;
    setConfirmAction({ show: false, title: "", message: "", action: "" });
    if (!messageId) return;
    try {
      const res = await csrfFetch("/api/chat/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ تم حذف الرسالة", "warning");
        onMessageSent();
      } else {
        showToast(data.message, "error");
      }
    } catch {
      showToast("فشل الحذف", "error");
    }
  };

  // ==================== حذف محادثة ====================
  const handleDeleteConversation = () => {
    if (!selectedUser) return;
    setConfirmAction({
      show: true,
      title: "حذف المحادثة",
      message: "هل أنت متأكد من حذف المحادثة بالكامل؟",
      action: "delete-conversation",
    });
  };

  const executeDeleteConversation = async () => {
    if (!selectedUser) return;
    setConfirmAction({ show: false, title: "", message: "", action: "" });
    try {
      const res = await csrfFetch("/api/chat/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otherUserId: selectedUser.id,
          action: "delete-conversation",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ تم حذف المحادثة", "warning");
        onClose();
        onConversationDeleted();
      } else {
        showToast(data.message, "error");
      }
    } catch {
      showToast("فشل الحذف", "error");
    }
  };

  // ==================== حظر ====================
  const handleBlockUser = () => {
    if (!selectedUser) return;
    setConfirmAction({
      show: true,
      title: "حظر المستخدم",
      message: `هل أنت متأكد من حظر ${selectedUser.name}؟`,
      action: "block",
    });
  };

  const executeBlockUser = async () => {
    if (!selectedUser) return;
    setConfirmAction({ show: false, title: "", message: "", action: "" });
    try {
      const res = await csrfFetch("/api/chat/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: selectedUser.id, action: "block" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🚫 تم حظر المستخدم", "warning");
        onClose();
        onConversationDeleted();
      } else {
        showToast(data.message, "error");
      }
    } catch {
      showToast("فشل الحظر", "error");
    }
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
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("ar-YE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-YE", { month: "short", day: "numeric" });
  const isOnline = (u: ChatUser) => {
    return onlineUsers.has(u.id);
  };
  const lastSeenText = (u: ChatUser) => {
    if (isOnline(u)) return "متصل الآن";
    if (!u.lastSeenAt) return "";
    return `آخر ظهور: ${formatDate(u.lastSeenAt)} ${formatTime(u.lastSeenAt)}`;
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

  if (!selectedUser) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8b949e",
          fontSize: "1rem",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ fontSize: "3rem" }}>💬</div>
        <p>اختر محادثة من القائمة أو ابحث عن مستخدم</p>
      </div>
    );
  }

  return (
    <>
      {/* هيدر المحادثة */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#00e5ff",
              cursor: "pointer",
              display: "flex",
            }}
            className="md:hidden"
          >
            <BackIcon />
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{ fontWeight: 700, fontSize: "1rem", color: "#e6edf3" }}
              >
                {selectedUser.name}
              </span>
              <span
                style={{
                  color: getRoleColor(selectedUser.role),
                  fontSize: "0.65rem",
                  background: "rgba(255,255,255,0.05)",
                  padding: "2px 8px",
                  borderRadius: "10px",
                }}
              >
                {getRoleLabel(selectedUser.role)}
              </span>
              {selectedUser.level && (
                <span style={{ fontSize: "0.7rem", color: "#8b949e" }}>
                  {getLevelLabel(selectedUser.level)}
                </span>
              )}
            </div>
            <p
              style={{
                fontSize: "0.7rem",
                color: isOnline(selectedUser) ? "#2ea043" : "#8b949e",
                margin: "2px 0 0",
              }}
            >
              {typingUserId === selectedUser?.id
                ? "✍️ يكتب الآن..."
                : lastSeenText(selectedUser)}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={handleBlockUser}
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              background: "rgba(248,81,73,0.1)",
              border: "1px solid rgba(248,81,73,0.2)",
              color: "#f85149",
              cursor: "pointer",
              fontSize: "0.7rem",
              fontFamily: "'Cairo', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <BlockIcon /> حظر
          </button>
          <button
            onClick={handleDeleteConversation}
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              background: "rgba(248,81,73,0.1)",
              border: "1px solid rgba(248,81,73,0.2)",
              color: "#f85149",
              cursor: "pointer",
              fontSize: "0.7rem",
              fontFamily: "'Cairo', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <DeleteIcon /> حذف
          </button>
        </div>
      </div>
      {/* حقل البحث */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.03)",
        }}
      >
        <input
          type="text"
          placeholder="🔍 بحث في المحادثة..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px",
            color: "#e6edf3",
            fontSize: "0.8rem",
            fontFamily: "'Cairo', sans-serif",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {searchTerm && (
          <p
            style={{
              color: "#8b949e",
              fontSize: "0.65rem",
              margin: "4px 0 0",
              textAlign: "center",
            }}
          >
            {messages.filter((m) => m.body.includes(searchTerm)).length} نتيجة
          </p>
        )}
      </div>
      {/* الرسائل */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {hasMoreMessages && (
          <button
            onClick={onLoadMoreMessages}
            disabled={loadingMoreMessages}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "12px",
              border: "1px solid rgba(0,229,255,0.15)",
              borderRadius: "10px",
              background: "rgba(0,229,255,0.04)",
              color: loadingMoreMessages ? "#5a6a7a" : "#00e5ff",
              cursor: loadingMoreMessages ? "default" : "pointer",
              fontFamily: "'Cairo', sans-serif",
              fontWeight: 600,
              fontSize: "0.8rem",
            }}
          >
            {loadingMoreMessages ? "جاري التحميل..." : "تحميل رسائل أقدم ↓"}
          </button>
        )}
        {messages.length === 0 && (
          <p
            style={{ textAlign: "center", color: "#8b949e", marginTop: "40px" }}
          >
            ابدأ المحادثة الآن
          </p>
        )}
        {messages
          .filter((msg) => !searchTerm || msg.body.includes(searchTerm))
          .map((msg) => {
            const isMine = msg.senderId === userId;
            // تمييز النص المطابق
            const highlightText = (text: string, term: string) => {
              if (!term) return text;
              const idx = text.indexOf(term);
              if (idx === -1) return text;
              return (
                <>
                  {text.slice(0, idx)}
                  <mark
                    style={{
                      background: "#ffca28",
                      color: "#000",
                      borderRadius: "2px",
                      padding: "0 2px",
                    }}
                  >
                    {text.slice(idx, idx + term.length)}
                  </mark>
                  {text.slice(idx + term.length)}
                </>
              );
            };
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: isMine ? "flex-end" : "flex-start",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    maxWidth: "75%",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "16px",
                      background: isMine
                        ? "rgba(0,229,255,0.18)"
                        : "rgba(255,255,255,0.06)",
                      border: isMine
                        ? "1px solid rgba(0,229,255,0.25)"
                        : "1px solid rgba(255,255,255,0.06)",
                      wordBreak: "break-word",
                    }}
                  >
                    {/* عرض الرسالة المقتبسة */}
                    {(msg as any).replyTo && (
                      <div
                        style={{
                          background: "rgba(255,202,40,0.08)",
                          borderRight: "3px solid #ffca28",
                          borderRadius: "4px",
                          padding: "6px 8px",
                          marginBottom: "6px",
                          fontSize: "0.75rem",
                          color: "#8b949e",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#ffca28",
                            fontSize: "0.65rem",
                            marginBottom: "2px",
                          }}
                        >
                          {(msg as any).replyTo?.sender?.name || "مستخدم"}
                        </div>
                        <div>
                          {(msg as any).replyTo?.body?.slice(0, 80) || ""}
                          {(msg as any).replyTo?.body?.length > 80 ? "..." : ""}
                        </div>
                      </div>
                    )}

                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.9rem",
                        lineHeight: 1.5,
                        color: "#e6edf3",
                      }}
                    >
                      {highlightText(msg.body, searchTerm)}
                    </p>
                    {msg.isEdited && (
                      <span style={{ fontSize: "0.6rem", color: "#8b949e" }}>
                        (مُعدّلة)
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      marginTop: "2px",
                      justifyContent: isMine ? "flex-end" : "flex-start",
                    }}
                  >
                    <span style={{ color: "#5a6a7a", fontSize: "0.6rem" }}>
                      {formatTime(msg.createdAt)}
                    </span>
                    {isMine && (
                      <span
                        style={{
                          color: msg.isRead ? "#00e5ff" : "#5a6a7a",
                          fontSize: "0.6rem",
                        }}
                      >
                        {sendingMsgId === msg.id
                          ? "⏳"
                          : failedMsgId === msg.id
                            ? "❌"
                            : msg.isRead
                              ? "✓✓"
                              : "✓"}
                      </span>
                    )}
                    <div style={{ display: "flex", gap: "2px" }}>
                      {/* زر الرد - يظهر للجميع */}
                      <button
                        onClick={() => setReplyTo(msg)}
                        title="رد"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#8b949e",
                          cursor: "pointer",
                          padding: "2px",
                          fontSize: "0.7rem",
                        }}
                      >
                        ↩️
                      </button>
                      {/* أزرار التعديل والحذف - تظهر لرسائلك فقط */}
                      {isMine && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMsg(msg);
                              setEditBody(msg.body);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#8b949e",
                              cursor: "pointer",
                              padding: "2px",
                            }}
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#8b949e",
                              cursor: "pointer",
                              padding: "2px",
                            }}
                          >
                            <DeleteIcon />
                          </button>
                          <button
                            onClick={() => handleDeleteForEveryone(msg.id)}
                            title="حذف للجميع"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#f85149",
                              cursor: "pointer",
                              padding: "2px",
                              fontSize: "0.65rem",
                              fontWeight: 700,
                            }}
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        <div ref={messagesEndRef} />
      </div>
      {/* شريط الرد */}
      {replyTo && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(255,202,40,0.08)",
            borderLeft: "3px solid #ffca28",
            margin: "0 12px",
            borderRadius: "6px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span
              style={{ color: "#ffca28", fontSize: "0.7rem", fontWeight: 600 }}
            >
              رد على{" "}
              {replyTo.senderId === userId ? "نفسك" : replyTo.sender.name}:
            </span>
            <span
              style={{
                color: "#8b949e",
                fontSize: "0.75rem",
                marginRight: "8px",
              }}
            >
              {replyTo.body.slice(0, 50)}
              {replyTo.body.length > 50 ? "..." : ""}
            </span>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            style={{
              background: "none",
              border: "none",
              color: "#8b949e",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            ✕
          </button>
        </div>
      )}
      {/* حقل الإرسال */}
      <div
        style={{
          padding: "12px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          type="text"
          placeholder="اكتب رسالتك..."
          value={newMessage}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          onChange={(e) => {
            setNewMessage(e.target.value);
            if (e.target.value.length > 0) {
              debouncedTypingEmit();
              resetTypingStop();
            } else if (selectedUser && userId) {
              import("@/lib/supabaseRealtime")
                .then(({ broadcastEvent }) => {
          broadcastEvent(getUserChannelName(selectedUser.id), "typing_stop", {
                    userId,
                  });
                })
                .catch(() => {});
            }
          }}
          style={{
            flex: 1,
            ...inputStyle,
            fontSize: "0.9rem",
            padding: "12px",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{
            padding: "12px 22px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #7a00ff, #bf5af2)",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 800,
            fontFamily: "'Cairo', sans-serif",
            opacity: loading ? 0.6 : 1,
          }}
        >
          إرسال
        </button>
      </div>

      {/* نافذة تأكيد */}
      <AnimatePresence>
        {confirmAction.show && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={() =>
              setConfirmAction({
                show: false,
                title: "",
                message: "",
                action: "",
              })
            }
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(10, 20, 40, 0.95)",
                backdropFilter: "blur(30px)",
                border: "1px solid rgba(248,81,73,0.3)",
                borderRadius: "24px",
                padding: "30px",
                maxWidth: "420px",
                width: "100%",
                textAlign: "center",
                boxShadow: "0 0 60px rgba(248,81,73,0.15)",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(248,81,73,0.15)",
                  margin: "0 auto 15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.8rem",
                }}
              >
                ⚠️
              </div>
              <h3
                style={{
                  color: "#fff",
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  marginBottom: "8px",
                }}
              >
                {confirmAction.title}
              </h3>
              <p
                style={{
                  color: "#8b949e",
                  fontSize: "0.9rem",
                  marginBottom: "25px",
                }}
              >
                {confirmAction.message}
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() =>
                    setConfirmAction({
                      show: false,
                      title: "",
                      message: "",
                      action: "",
                    })
                  }
                  style={{
                    flex: 1,
                    padding: "13px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  إلغاء
                </button>
                <button
                  onClick={() => {
                    if (confirmAction.action === "delete-message")
                      executeDeleteMessage();
                    else if (confirmAction.action === "delete-for-everyone")
                      executeDeleteForEveryone();
                    else if (confirmAction.action === "delete-conversation")
                      executeDeleteConversation();
                    else if (confirmAction.action === "block")
                      executeBlockUser();
                  }}
                  style={{
                    flex: 1.5,
                    padding: "13px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #f85149, #da3633)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    fontFamily: "'Cairo', sans-serif",
                    boxShadow: "0 8px 25px rgba(248,81,73,0.3)",
                  }}
                >
                  نعم، تأكيد
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة تعديل */}
      <AnimatePresence>
        {editingMsg && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={() => setEditingMsg(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(10, 20, 40, 0.55)",
                backdropFilter: "blur(25px)",
                border: "1px solid rgba(255,202,40,0.3)",
                borderRadius: "24px",
                padding: "25px",
                maxWidth: "450px",
                width: "100%",
              }}
            >
              <h3
                style={{
                  color: "#ffca28",
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  marginBottom: "15px",
                  textAlign: "center",
                }}
              >
                ✏️ تعديل الرسالة
              </h3>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={3}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: "80px",
                  marginBottom: "15px",
                }}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setEditingMsg(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleEditMessage}
                  style={{
                    flex: 2,
                    padding: "12px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #ffca28, #e3b341)",
                    border: "none",
                    color: "#010204",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  💾 حفظ
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
