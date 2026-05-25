"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";
import { useAuthStore } from "@/store/authStore";
import ChatArea from "@/components/chat/ChatArea";
import { getSupabase, trackPresence } from "@/lib/supabaseRealtime";

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
  const selectedUserRef = useRef(selectedUser);
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);
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
    try {
      const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const res = await fetch(`/api/chat/messages${params}`);
      const data = await res.json();
      if (data.success) {
        setConversations((prev) =>
          cursor ? [...prev, ...data.data] : data.data,
        );
        setConversationCursor(data.nextCursor);
        setHasMoreConversations(!!data.nextCursor);
      }
    } catch {}
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
    try {
      const params = cursor
        ? `?userId=${encodeURIComponent(otherId)}&cursor=${encodeURIComponent(cursor)}`
        : `?userId=${encodeURIComponent(otherId)}`;
      const res = await fetch(`/api/chat/messages${params}`);
      const data = await res.json();
      if (data.success) {
        setMessages((prev) =>
          cursor ? [...prev, ...data.data] : data.data,
        );
        setMessageCursor(data.nextCursor);
        setHasMoreMessages(!!data.nextCursor);
      }
    } catch {}
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

  // ==================== قناة Supabase موحدة ====================
  useEffect(() => {
    if (!userId) return;
    let channel: any = null;
    let isDestroyed = false;

    const setup = async () => {
      if (isDestroyed) return;

      // الحصول على اسم القناة المُوقّع والتحقق من الصلاحية
      let signedChannelName = "";
      try {
        const authRes = await fetch("/api/realtime/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelUserId: userId }),
        });
        const authData = await authRes.json();
        if (authData.authorized !== true) return;
        if (!authData.channelName) return;
        signedChannelName = authData.channelName;
      } catch {
        return;
      }
      
      const supabase = getSupabase();
      trackPresence(userId);

      channel = supabase
        .channel(signedChannelName)
        .on("broadcast", { event: "new-message" }, (payload: any) => {
          const data = payload.payload;
          const currentSelected = selectedUserRef.current;
          if (
            currentSelected &&
            (data.senderId === currentSelected.id ||
              data.receiverId === currentSelected.id)
          ) {
            // تشغيل صوت الإشعار عند استلام رسالة جديدة
            try {
              const audio = new Audio("/sounds/notification.mp3");
              audio.volume = 0.5;
              audio.play().catch(() => {});
            } catch {}
            if (data.senderId !== userId && data.receiverId === userId) {
              // رسالة من المستخدم الآخر — نجلبها عبر API (مشفرة)
              loadMessages(currentSelected.id, null);
            }
          } else if (!currentSelected) {
            loadConversations();
          }
        })
        .subscribe();
    };

    setup();

    return () => {
      isDestroyed = true;
      if (channel) {
        import("@/lib/supabaseRealtime").then(({ getSupabase }) => {
          const supabase = getSupabase();
          supabase.removeChannel(channel).catch(() => {});
        }).catch(() => {});
      }
    };
  }, [userId]);
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
    setSelectedUser({
      id: c.userId || c.id,
      name: c.name,
      role: c.role,
      level: c.level,
      lastSeenAt: c.lastSeenAt,
      lastLoginAt: c.lastLoginAt,
    });
    setMessageCursor(null);
    setHasMoreMessages(false);
    loadMessages(c.userId || c.id);
    setShowMobileChat(true);
    setShowSearch(false);
    setSearchResults([]);
    setSearchTerm("");
  };

  const closeChat = () => {
    setSelectedUser(null);
    setMessages([]);
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
                }}
              >
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
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {conv.isSent && (
                        <span
                          style={{ color: conv.isRead ? "#00e5ff" : "#5a6a7a" }}
                        >
                          {conv.isRead ? "✓✓" : "✓"}
                        </span>
                      )}
                      {conv.lastMessage}
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
              onMessagesRead={() => {
                if (selectedUser) loadMessages(selectedUser.id);
              }}
              onNewMessage={(msg) => {
                setMessages((prev) => [...prev, msg]);
              }}
              hasMoreMessages={hasMoreMessages}
              loadingMoreMessages={loadingMoreMessages}
              onLoadMoreMessages={loadMoreMessages}
            />
          </div>
        </div>
      </PageTransition>
      <Footer />
    </div>
  );
}
