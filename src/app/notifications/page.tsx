"use client";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { csrfFetch } from "@/lib/csrfClient";
import { useNotificationStore } from "@/store/notificationStore";
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
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} يوم`;
  return new Date(date).toLocaleDateString("ar-YE");
};

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    setNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuth();
  const pathname = "/notifications";

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications/list?page=${page}&limit=20`);
      const data = await res.json();
      if (data.success) {
        if (page === 1) {
          setNotifications(data.data);
        } else {
          data.data.forEach((n: any) => addNotification(n));
        }
        setTotal(data.total);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string, linkUrl: string | null) => {
    try {
      await csrfFetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      markAsRead(id);
      if (linkUrl) router.push(linkUrl);
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await csrfFetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      markAllAsRead();
    } catch {}
  };

  const loadMore = () => {
    if (notifications.length < total) setPage((prev) => prev + 1);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#010204",
        fontFamily: "'Cairo', sans-serif",
        color: "#fff",
      }}
    >
      <Header />
      <Sidebar />
      <PageTransition>
        <main
          style={{
            padding: "100px 20px 60px",
            maxWidth: "900px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "25px",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <h2
              style={{ color: "#00e5ff", fontSize: "1.8rem", fontWeight: 800 }}
            >
              🔔 سجل الإشعارات{" "}
              {unreadCount > 0 && (
                <span style={{ color: "#f0883e", fontSize: "1rem" }}>
                  ({unreadCount} غير مقروء)
                </span>
              )}
            </h2>
            {unreadCount > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleMarkAllRead}
                style={{
                  padding: "10px 20px",
                  background: "rgba(0,229,255,0.1)",
                  border: "1px solid #00e5ff",
                  borderRadius: "10px",
                  color: "#00e5ff",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontWeight: 700,
                }}
              >
                تحديد الكل كمقروء
              </motion.button>
            )}
          </div>

          {notifications.length === 0 && !loading && (
            <p
              style={{
                textAlign: "center",
                color: "#8b949e",
                marginTop: "50px",
                fontSize: "1.1rem",
              }}
            >
              📭 لا توجد إشعارات
            </p>
          )}

          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                onClick={() => handleMarkRead(notif.id, notif.linkUrl)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "15px",
                  padding: "18px",
                  borderRadius: "14px",
                  cursor: "pointer",
                  background: notif.isRead
                    ? "rgba(22,27,34,0.4)"
                    : "rgba(0,229,255,0.06)",
                  border: notif.isRead
                    ? "1px solid rgba(255,255,255,0.05)"
                    : "1px solid rgba(0,229,255,0.2)",
                  transition: "all 0.3s",
                }}
              >
                <span style={{ fontSize: "1.8rem", flexShrink: 0 }}>
                  {typeIcons[notif.type] || "🔔"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <h4
                      style={{
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        color: notif.isRead ? "#8b949e" : "#fff",
                        margin: 0,
                      }}
                    >
                      {notif.title}
                    </h4>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#8b949e",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>
                  <p
                    style={{
                      color: "#8b949e",
                      fontSize: "0.85rem",
                      margin: "4px 0 0",
                      lineHeight: 1.5,
                    }}
                  >
                    {notif.body}
                  </p>
                </div>
                {!notif.isRead && (
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#00e5ff",
                      flexShrink: 0,
                      marginTop: "6px",
                      boxShadow: "0 0 8px #00e5ff",
                    }}
                  />
                )}
              </motion.div>
            ))}
          </div>

          {loading && (
            <p
              style={{
                textAlign: "center",
                color: "#8b949e",
                marginTop: "20px",
              }}
            >
              ⏳ جاري التحميل...
            </p>
          )}

          {notifications.length < total && !loading && (
            <div style={{ textAlign: "center", marginTop: "25px" }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={loadMore}
                style={{
                  padding: "12px 30px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px",
                  color: "#8b949e",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontWeight: 600,
                }}
              >
                عرض المزيد
              </motion.button>
            </div>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
