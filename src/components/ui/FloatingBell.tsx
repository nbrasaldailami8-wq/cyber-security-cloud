"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/authStore";
import { csrfFetch } from "@/lib/csrfClient";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  isRead: boolean;
  createdAt: string;
}

const typeIcons: Record<string, string> = {
  NEW_MESSAGE: "💬",
  ASSIGNMENT_EVALUATED: "✅",
  NEW_ASSIGNMENT: "📤",
  NEW_ANNOUNCEMENT: "📢",
  NEW_CONTENT: "📚",
  GRADES_DISTRIBUTED: "📝",
  ACCOUNT_MODIFIED: "⚙️",
  LEVEL_PROMOTED: "🎉",
};

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  return new Date(date).toLocaleDateString("ar-YE");
};

export default function FloatingBell() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPopup, setShowPopup] = useState(false);

  // إخفاء الأيقونة في صفحة تسجيل الدخول والـ onboarding
  const isHidden = pathname === "/login" || pathname === "/onboarding";

  const userId = user?.id || "";

  // ==================== تحميل الإشعارات ====================
  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/notifications/list?page=1&limit=10");
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data || []);
        setUnreadCount(
          (data.data || []).filter((n: NotificationItem) => !n.isRead).length,
        );
      }
    } catch {
      /* صامت */
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // ==================== Supabase Realtime للحظية ====================
  useSupabaseRealtime(`user-${userId}`, "notification", (data: any) => {
    loadNotifications();
    // تشغيل صوت الإشعار
    try {
      const audio = new Audio("/sounds/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
    if (data.title && data.body) {
      showToast(`🔔 ${data.title}: ${data.body}`, "info");
    }
  });

  // ==================== تحديد كمقروء والتوجيه ====================
  const handleClickNotification = async (notif: NotificationItem) => {
    try {
      await csrfFetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notif.id }),
      });
      loadNotifications();
      if (notif.linkUrl) {
        setShowPopup(false);
        router.push(notif.linkUrl);
      }
    } catch {
      /* صامت */
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await csrfFetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      loadNotifications();
    } catch {
      /* صامت */
    }
  };

  const handleViewAll = () => {
    setShowPopup(false);
    router.push("/notifications");
  };

  if (isHidden) return null;

  return (
    <>
      {/* ========== أيقونة الجرس العائمة ========== */}
      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => {
          setShowPopup(!showPopup);
          if (!showPopup) loadNotifications();
        }}
        style={{
          position: "fixed",
          bottom: "30px",
          left: "30px",
          zIndex: 200,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "rgba(10, 20, 40, 0.75)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "2px solid rgba(0, 229, 255, 0.4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.5rem",
          boxShadow:
            "0 8px 32px rgba(0, 229, 255, 0.2), 0 0 60px rgba(0, 229, 255, 0.08)",
          transition: "box-shadow 0.3s",
        }}
        title="الإشعارات"
      >
        <motion.span
          key={unreadCount}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" }}
        >
          🔔
        </motion.span>

        {/* علامة العداد */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                minWidth: "22px",
                height: "22px",
                borderRadius: "11px",
                background: "#f85149",
                color: "#fff",
                fontSize: "0.7rem",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 5px",
                border: "2px solid rgba(0,0,0,0.5)",
                boxShadow: "0 0 12px rgba(248,81,73,0.5)",
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ========== نافذة الإشعارات المنبثقة ========== */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            style={{
              position: "fixed",
              bottom: "100px",
              left: "30px",
              zIndex: 201,
              width: "380px",
              maxWidth: "calc(100vw - 60px)",
              maxHeight: "500px",
              overflowY: "auto",
              background: "rgba(10, 20, 40, 0.95)",
              backdropFilter: "blur(30px)",
              WebkitBackdropFilter: "blur(30px)",
              border: "1px solid rgba(0, 229, 255, 0.2)",
              borderRadius: "20px",
              padding: "20px",
              boxShadow:
                "0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 229, 255, 0.1)",
            }}
          >
            {/* هيدر النافذة */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
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
                🔔 الإشعارات
                {unreadCount > 0 && (
                  <span
                    style={{
                      color: "#f85149",
                      fontSize: "0.8rem",
                      marginRight: "8px",
                    }}
                  >
                    ({unreadCount})
                  </span>
                )}
              </h3>
              <div style={{ display: "flex", gap: "8px" }}>
                {unreadCount > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleMarkAllRead}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "8px",
                      fontSize: "0.7rem",
                      background: "rgba(0,229,255,0.1)",
                      border: "1px solid rgba(0,229,255,0.2)",
                      color: "#00e5ff",
                      cursor: "pointer",
                      fontFamily: "'Cairo', sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    تعيين الكل مقروء
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleViewAll}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "8px",
                    fontSize: "0.7rem",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontFamily: "'Cairo', sans-serif",
                    fontWeight: 600,
                  }}
                >
                  عرض الكل
                </motion.button>
              </div>
            </div>

            {/* قائمة الإشعارات */}
            {notifications.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "30px",
                  color: "#8b949e",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📭</div>
                <p style={{ fontSize: "0.9rem" }}>لا توجد إشعارات</p>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {notifications.slice(0, 8).map((notif) => (
                  <motion.div
                    key={notif.id}
                    whileHover={{
                      scale: 1.02,
                      background: "rgba(0,229,255,0.06)",
                    }}
                    onClick={() => handleClickNotification(notif)}
                    style={{
                      padding: "12px",
                      borderRadius: "12px",
                      cursor: "pointer",
                      background: notif.isRead
                        ? "transparent"
                        : "rgba(0,229,255,0.03)",
                      border: notif.isRead
                        ? "1px solid transparent"
                        : "1px solid rgba(0,229,255,0.1)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      transition: "all 0.2s",
                    }}
                  >
                    <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>
                      {typeIcons[notif.type] || "🔔"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <p
                          style={{
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            color: notif.isRead ? "#8b949e" : "#e6edf3",
                            margin: 0,
                          }}
                        >
                          {notif.title}
                        </p>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            color: "#5a6a7a",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {timeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "#8b949e",
                          margin: "2px 0 0",
                          lineHeight: 1.4,
                        }}
                      >
                        {notif.body.length > 60
                          ? notif.body.slice(0, 60) + "..."
                          : notif.body}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#00e5ff",
                          flexShrink: 0,
                          marginTop: "4px",
                          boxShadow: "0 0 6px #00e5ff",
                        }}
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
