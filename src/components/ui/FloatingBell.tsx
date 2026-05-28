"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/authStore";
import { csrfFetch } from "@/lib/csrfClient";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { trackNotifRefresh, trackNotifDedup, trackNotifReconnect, traceAudio, traceAudioForensic, traceLifecycle, traceAsyncRequest, traceAsyncResponse, traceRealtimeEvent, getLastRealtimeMutationAt } from "@/lib/realtimeDiagnostics";
import { isAudioAuthorized, isToastAuthorized, trackAudioPlayed, trackAudioSkippedHidden, trackAudioSkippedThrottle, trackAudioSkippedInactiveTab, trackAudioSkippedUnmounted, trackAudioDuplicatePrevented } from "@/lib/supabaseRealtime";

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

  const mountedRef = useRef(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const processedIdTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastSoundTimeRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevConnectionRef = useRef<string>("disconnected");
  const reconnectCooldownRef = useRef(0);
  const MAX_PROCESSED_IDS = 500;
  const hiddenToastQueueRef = useRef<Array<{id: string; title: string; body: string; timestamp: number}>>([]);
  const notificationStormTimersRef = useRef<number[]>([]);
  const stormActiveRef = useRef(false);
  const stormCooldownRef = useRef(0);
  const pushPermissionRef = useRef<NotificationPermission | null>(null);

  // تنظيف معرفات التكرار: إزالة الأقدم عند تجاوز الحد
  const markIdProcessed = useCallback((id: string) => {
    processedIdsRef.current.add(id);
    const expiryTimer = setTimeout(() => {
      processedIdsRef.current?.delete(id);
    }, 60000);
    processedIdTimersRef.current.push(expiryTimer);
    // Hard cap: إزالة الأقدم عند تجاوز الحد (Set يحافظ على ترتيب الإدراج)
    if (processedIdsRef.current.size > MAX_PROCESSED_IDS) {
      const toRemove = processedIdsRef.current.size - MAX_PROCESSED_IDS;
      const values = processedIdsRef.current.values();
      for (let i = 0; i < toRemove; i++) {
        const entry = values.next();
        if (entry.done) break;
        processedIdsRef.current.delete(entry.value);
      }
    }
  }, []);

  // جدولة تحديث الإشعارات: نقطة تمرير واحدة لكل المشغلات
  const loadNotifRef = useRef<() => void>(() => {});
  useEffect(() => { loadNotifRef.current = loadNotifications; });
  const scheduleNotificationRefresh = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      if (mountedRef.current) {
        trackNotifRefresh();
        loadNotifRef.current();
      }
    }, 300);
  }, []);

  const notificationsRef = useRef<NotificationItem[]>([]);
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);

  // ==================== تحميل الإشعارات ====================
  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    const seqId = traceAsyncRequest("/api/notifications/list", "LOAD_NOTIFICATIONS", null);
    const requestTs = Date.now();
    try {
      const res = await fetch("/api/notifications/list?page=1&limit=10");
      const data = await res.json();
      if (data.success) {
        const prevIds = notificationsRef.current.map((n) => n.id);
        const nextIds = (data.data || []).map((n: NotificationItem) => n.id);
        setNotifications(data.data || []);
        setUnreadCount(
          (data.data || []).filter((n: NotificationItem) => !n.isRead).length,
        );
        traceAsyncResponse("/api/notifications/list", "LOAD_NOTIFICATIONS", seqId, requestTs, null, getLastRealtimeMutationAt() || null, { prevCount: prevIds.length, nextCount: nextIds.length });
      }
    } catch {
      traceAsyncResponse("/api/notifications/list", "LOAD_NOTIFICATIONS", seqId, requestTs, null, getLastRealtimeMutationAt() || null, { failed: true });
    }
  }, [userId]);

  const flushHiddenToasts = useCallback(() => {
    const queue = hiddenToastQueueRef.current;
    if (queue.length === 0 || !mountedRef.current) return;
    if (document.visibilityState !== "visible" || !isToastAuthorized()) return;
    const toFlush = queue.splice(0);
    for (const item of toFlush) {
      if (processedIdsRef.current.has(item.id)) continue;
      showToast(`🔔 ${item.title}: ${item.body}`, "info");
    }
  }, [showToast]);

  useEffect(() => {
    mountedRef.current = true;
    const processedIds = processedIdsRef.current;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        flushHiddenToasts();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    loadNotifications();
    traceLifecycle("FloatingBell", "MOUNT", { userId });
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      // V014: Clear all pending processedId expiry timers on unmount
      for (const t of processedIdTimersRef.current) {
        clearTimeout(t);
      }
      processedIdTimersRef.current = [];
      processedIds.clear();
      prevConnectionRef.current = "disconnected";
      reconnectCooldownRef.current = 0;
      traceLifecycle("FloatingBell", "UNMOUNT", { userId });
    };
  }, [loadNotifications, flushHiddenToasts]);

  // T9: Permission state re-validation on mount + focus
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const check = () => {
      const current = Notification.permission;
      if (pushPermissionRef.current && pushPermissionRef.current !== current) {
        if (process.env.NODE_ENV === "development") {
          console.log("[Push] Permission changed:", pushPermissionRef.current, "->", current);
        }
      }
      pushPermissionRef.current = current;
    };
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, []);

  // ==================== Supabase Realtime للحظية ====================
  const { connectionState } = useSupabaseRealtime(
    `user-${userId}`,
    "notification",
    (data: any) => {
      const arrivalTs = Date.now();
      traceRealtimeEvent("notification", data.id || "unknown", arrivalTs, null, { type: data.type, title: data.title });

      // تجاهل الإشعارات المكررة عبر تتبع المعرفات في الذاكرة
      if (data.id) {
        if (processedIdsRef.current.has(data.id)) {
          trackNotifDedup();
          trackAudioDuplicatePrevented();
          traceAudio("AUDIO_SKIPPED_DUPLICATE", data.type || "notification", { payloadId: data.id });
          return;
        }
        markIdProcessed(data.id);
      }

      const now = Date.now();

      // Storm detection: >20 notifications in 10 seconds
      const stormTimestamps = notificationStormTimersRef.current;
      stormTimestamps.push(now);
      while (stormTimestamps.length > 0 && stormTimestamps[0] < now - 10000) {
        stormTimestamps.shift();
      }
      if (stormTimestamps.length > 20 && !stormActiveRef.current) {
        stormActiveRef.current = true;
        stormCooldownRef.current = now + 10000;
        if (document.visibilityState === "visible" && isToastAuthorized()) {
          showToast("🔔 لديك إشعارات جديدة متعددة", "info");
        }
      }
      if (stormActiveRef.current && now > stormCooldownRef.current) {
        stormActiveRef.current = false;
      }

      // T11: Selective refresh — skip API fetch for complete message notifications
      if (data.type !== "NEW_MESSAGE" || !data.id || !data.title || !data.body) {
        scheduleNotificationRefresh();
      } else {
        setUnreadCount((prev) => prev + 1);
        // Also add directly to popup state to keep list consistent
        setNotifications((prev) => {
          if (prev.some((n) => n.id === data.id)) return prev;
          return [
            {
              id: data.id,
              type: data.type,
              title: data.title,
              body: data.body,
              linkUrl: data.linkUrl || undefined,
              isRead: false,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ];
        });
      }

      // Audio guards: block sound only, not toast/state
      let shouldPlaySound = true;
      let skipReason = "";
      if (!mountedRef.current) { trackAudioSkippedUnmounted(); shouldPlaySound = false; skipReason = "UNMOUNTED"; }
      else if (document.visibilityState !== "visible") { trackAudioSkippedHidden(); shouldPlaySound = false; skipReason = "HIDDEN"; }
      else if (pathname.startsWith("/chat")) { shouldPlaySound = false; skipReason = "ROUTE_CHAT"; }
      else if (!isAudioAuthorized()) { trackAudioSkippedInactiveTab(); shouldPlaySound = false; skipReason = "UNAUTHORIZED"; }
      if (shouldPlaySound && !stormActiveRef.current) {
        if (now - lastSoundTimeRef.current >= 1000) {
          lastSoundTimeRef.current = now;
          try {
            if (!audioRef.current) {
              audioRef.current = new Audio("/sounds/notification.mp3");
            }
            audioRef.current.volume = 0.5;
            audioRef.current.currentTime = 0;
            const playPromise = audioRef.current.play();
            if (playPromise) {
              playPromise
                .then(() => {
                  traceAudio("AUDIO_PLAY_CONFIRMED", data.type || "notification", { payloadId: data.id, title: data.title });
                  traceAudioForensic("AUDIO_PLAY_CONFIRMED", data.type || "notification", "none", { payloadId: data.id, title: data.title, authorizationStatus: isAudioAuthorized() });
                })
                .catch((err: unknown) => {
                  traceAudio("AUDIO_PROMISE_REJECTED", data.type || "notification", { payloadId: data.id, error: String(err), title: data.title });
                  traceAudioForensic("AUDIO_PROMISE_REJECTED", data.type || "notification", "promise_rejected", { payloadId: data.id, error: String(err), title: data.title });
                });
            }
          } catch (err) {
            traceAudioForensic("AUDIO_PLAY_REJECTED", data.type || "notification", "exception", { payloadId: data.id, error: String(err) });
          }
          trackAudioPlayed();
          traceAudioForensic("AUDIO_ALLOWED", data.type || "notification", "none", { payloadId: data.id, throttleMs: now - lastSoundTimeRef.current });
        } else {
          trackAudioSkippedThrottle();
          traceAudioForensic("AUDIO_BLOCKED_THROTTLE", data.type || "notification", "throttle", { payloadId: data.id, throttleMs: now - lastSoundTimeRef.current });
        }
      } else if (!shouldPlaySound) {
        const forensicLabel = "AUDIO_BLOCKED_" + skipReason;
        traceAudio(forensicLabel, data.type || "notification", { payloadId: data.id, visibilityState: document.visibilityState, pathname });
        traceAudioForensic(forensicLabel, data.type || "notification", skipReason.toLowerCase(), { payloadId: data.id, visibilityState: document.visibilityState, pathname, isActiveTab: isAudioAuthorized() });
      }

      // T1 + T3: Hidden tab toast preservation + toast authority
      if (data.title && data.body && !stormActiveRef.current) {
        if (document.visibilityState === "visible" && isToastAuthorized()) {
          showToast(`🔔 ${data.title}: ${data.body}`, "info");
        } else if (document.visibilityState !== "visible") {
          const queue = hiddenToastQueueRef.current;
          if (queue.length < 20) {
            queue.push({ id: data.id, title: data.title, body: data.body, timestamp: Date.now() });
          }
        }
      }
    },
  );

  // استرداد الإشعارات بعد إعادة الاتصال مع cooldown لمنع التكرار
  useEffect(() => {
    const prev = prevConnectionRef.current;
    prevConnectionRef.current = connectionState;
    if (prev === "reconnecting" && connectionState === "connected") {
      if (mountedRef.current && Date.now() - reconnectCooldownRef.current >= 2000) {
        reconnectCooldownRef.current = Date.now();
        trackNotifReconnect();
        scheduleNotificationRefresh();
      }
    }
  }, [connectionState, scheduleNotificationRefresh]);

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
          if (!showPopup) scheduleNotificationRefresh();
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
