"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";

interface ThreatEvent {
  id: string;
  action: string;
  severity: string;
  description: string;
  ipAddress: string;
  deviceInfo: string;
  level: string;
  metadata?: any;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: string };
}

interface GuardianStats {
  intrusions: number;
  vulnerabilities: number;
  attackAttempts: number;
  bans: number;
  actionsTaken: number;
}

interface StatsResponse {
  success: boolean;
  data: {
    stats: {
      errors: number;
      warnings: number;
      intrusions: number;
      vulnerabilities: number;
      attackAttempts: number;
      bans: number;
    };
    trends: { attacksLast24h: number; attacksLast7d: number };
    recentIntrusions: ThreatEvent[];
    criticalLogs: ThreatEvent[];
  };
}

const threatTypes = [
  { key: "all", label: "الكل", icon: "🌐", color: "#8b949e" },
  { key: "intrusion", label: "تسلل", icon: "🕵️", color: "#ff3131" },
  { key: "attack", label: "اختراق", icon: "🎯", color: "#ff6b35" },
  { key: "vulnerability", label: "ثغرة", icon: "💥", color: "#bf5af2" },
  { key: "ban", label: "حظر", icon: "🚫", color: "#e3b341" },
];

const severityLevels = [
  {
    key: "CRITICAL",
    label: "حرج",
    color: "#ff3131",
    bg: "rgba(255,49,49,0.12)",
  },
  { key: "ERROR", label: "خطأ", color: "#f85149", bg: "rgba(248,81,73,0.12)" },
  {
    key: "WARNING",
    label: "تحذير",
    color: "#ffca28",
    bg: "rgba(255,202,40,0.12)",
  },
  {
    key: "INFO",
    label: "معلومة",
    color: "#00e5ff",
    bg: "rgba(0,229,255,0.12)",
  },
];

export default function GuardianPage() {
  const router = useRouter();
  const [stats, setStats] = useState<GuardianStats>({
    intrusions: 0,
    vulnerabilities: 0,
    attackAttempts: 0,
    bans: 0,
    actionsTaken: 0,
  });
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<ThreatEvent | null>(null);
  const [trends, setTrends] = useState({ last24h: 0, last7d: 0 });

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/security/stats");
      const data: StatsResponse = await res.json();
      if (data.success) {
        setStats({
          intrusions: data.data.stats.intrusions,
          vulnerabilities: data.data.stats.vulnerabilities,
          attackAttempts: data.data.stats.attackAttempts,
          bans: data.data.stats.bans,
          actionsTaken: data.data.stats.bans + data.data.stats.intrusions,
        });
        setTrends({
          last24h: data.data.trends.attacksLast24h,
          last7d: data.data.trends.attacksLast7d,
        });
        const allThreats = [
          ...data.data.recentIntrusions,
          ...data.data.criticalLogs,
        ].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setEvents(allThreats);
      }
    } catch (err) {
      console.error("Guardian load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useSupabaseRealtime(
    deriveStaticChannelName("security-guardian"),
    "new-threat",
    (newThreat: ThreatEvent) => {
      console.log("📥 Realtime new-threat received:", newThreat);
      setEvents((prev) => [newThreat, ...prev]);
      setStats((prev) => ({
        ...prev,
        attackAttempts: prev.attackAttempts + 1,
        actionsTaken: prev.actionsTaken + 1,
      }));
    },
  );

  const filteredEvents =
    activeTab === "all"
      ? events
      : events.filter((e) => {
          if (activeTab === "intrusion")
            return e.action === "SUSPICIOUS_ACTIVITY";
          if (activeTab === "attack")
            return (
              e.action === "FAILED_LOGIN" || e.action === "SUSPICIOUS_ACTIVITY"
            );
          if (activeTab === "vulnerability") return e.severity === "CRITICAL";
          if (activeTab === "ban") return e.description?.includes("حظر");
          return true;
        });

  const getSeverityInfo = (severity: string) => {
    return severityLevels.find((s) => s.key === severity) || severityLevels[3];
  };

  const getThreatTypeInfo = (action: string) => {
    if (action === "FAILED_LOGIN")
      return { label: "محاولة دخول", icon: "🔑", color: "#ffca28" };
    if (action === "SUSPICIOUS_ACTIVITY")
      return { label: "نشاط مشبوه", icon: "🕵️", color: "#ff3131" };
    return { label: action, icon: "⚠️", color: "#8b949e" };
  };

  const statCards = [
    {
      key: "intrusions",
      label: "تسللات",
      icon: "🕵️",
      color: "#ff3131",
      bg: "rgba(255,49,49,0.08)",
      border: "rgba(255,49,49,0.3)",
    },
    {
      key: "vulnerabilities",
      label: "ثغرات",
      icon: "💥",
      color: "#bf5af2",
      bg: "rgba(191,90,242,0.08)",
      border: "rgba(191,90,242,0.3)",
    },
    {
      key: "attackAttempts",
      label: "محاولات اختراق",
      icon: "🎯",
      color: "#ff6b35",
      bg: "rgba(255,107,53,0.08)",
      border: "rgba(255,107,53,0.3)",
    },
    {
      key: "bans",
      label: "عمليات حظر",
      icon: "🚫",
      color: "#e3b341",
      bg: "rgba(227,179,65,0.08)",
      border: "rgba(227,179,65,0.3)",
    },
    {
      key: "actionsTaken",
      label: "إجراءات متخذة",
      icon: "✅",
      color: "#2ea043",
      bg: "rgba(46,160,67,0.08)",
      border: "rgba(46,160,67,0.3)",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        fontFamily: "'Cairo', sans-serif",
        color: "#fff",
      }}
    >
      <Sidebar />
      <PageTransition>
        <main
          style={{
            padding: "100px 16px 60px",
            maxWidth: "1300px",
            margin: "0 auto",
          }}
        >
          {/* الهيدر */}
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "10px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push("/admin/security-radar")}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    padding: "8px 14px",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  ⬅ رجوع
                </motion.button>
                <h2
                  style={{
                    color: "#ff6b6b",
                    fontSize: "clamp(1.3rem, 2.5vw, 1.7rem)",
                    fontWeight: 900,
                    margin: 0,
                    textShadow: "0 0 25px rgba(255,49,49,0.4)",
                    letterSpacing: "1px",
                  }}
                >
                  🛡️ الحارس الرقمي
                </h2>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <div
                  style={{
                    background: "rgba(255,49,49,0.1)",
                    border: "1px solid rgba(255,49,49,0.3)",
                    borderRadius: "20px",
                    padding: "6px 14px",
                    fontSize: "0.8rem",
                    color: "#ff3131",
                  }}
                >
                  🔴 آخر 24 ساعة: {trends.last24h}
                </div>
                <div
                  style={{
                    background: "rgba(255,107,53,0.1)",
                    border: "1px solid rgba(255,107,53,0.3)",
                    borderRadius: "20px",
                    padding: "6px 14px",
                    fontSize: "0.8rem",
                    color: "#ff6b35",
                  }}
                >
                  🟠 آخر 7 أيام: {trends.last7d}
                </div>
              </div>
            </div>
            <p
              style={{
                color: "#8b949e",
                fontSize: "0.85rem",
                margin: "0 0 20px",
              }}
            >
              نظام الدفاع والأمن - مراقبة التهديدات والثغرات والهجمات
            </p>
          </motion.div>

          {/* البطاقات الإحصائية */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            {statCards.map((card, idx) => {
              const value = stats[card.key as keyof GuardianStats] || 0;
              return (
                <motion.div
                  key={card.key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.06 }}
                  whileHover={{ scale: 1.03, y: -2 }}
                  style={{
                    background: card.bg,
                    border: `1.5px solid ${card.border}`,
                    borderRadius: "14px",
                    padding: "18px 16px",
                    textAlign: "center",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>
                    {card.icon}
                  </div>
                  <div
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: 900,
                      color: card.color,
                      lineHeight: 1,
                    }}
                  >
                    {loading ? "—" : value.toLocaleString("ar-SA")}
                  </div>
                  <div style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                    {card.label}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* تبويبات */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "18px",
            }}
          >
            {threatTypes.map((tab) => (
              <motion.button
                key={tab.key}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  background:
                    activeTab === tab.key
                      ? tab.color + "18"
                      : "rgba(255,255,255,0.03)",
                  border: `1px solid ${activeTab === tab.key ? tab.color + "50" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "20px",
                  padding: "8px 16px",
                  color: activeTab === tab.key ? tab.color : "#8b949e",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: activeTab === tab.key ? 700 : 400,
                  transition: "all 0.25s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </motion.button>
            ))}
          </motion.div>

          {/* سجل التهديدات */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {loading ? (
              <div style={{ textAlign: "center", padding: "50px" }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  style={{
                    width: "45px",
                    height: "45px",
                    border: "3px solid rgba(255,49,49,0.2)",
                    borderTopColor: "#ff3131",
                    borderRadius: "50%",
                    margin: "0 auto 18px",
                  }}
                />
                <p style={{ color: "#8b949e" }}>جاري تحميل سجل التهديدات...</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "50px",
                  background: "rgba(22,27,34,0.6)",
                  border: "1px solid rgba(48,54,61,0.4)",
                  borderRadius: "14px",
                }}
              >
                <div style={{ fontSize: "3rem", marginBottom: "12px" }}>✅</div>
                <p
                  style={{
                    color: "#2ea043",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                  }}
                >
                  لا توجد تهديدات حالية
                </p>
                <p style={{ color: "#8b949e", fontSize: "0.85rem" }}>
                  النظام يعمل بشكل آمن، لم يتم رصد أي نشاط مشبوه
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {filteredEvents.map((event) => {
                  const severityInfo = getSeverityInfo(event.severity);
                  const threatInfo = getThreatTypeInfo(event.action);
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 }}
                      whileHover={{ scale: 1.01 }}
                      style={{
                        background: "rgba(13,17,23,0.85)",
                        border: "1px solid rgba(48,54,61,0.45)",
                        borderRadius: "14px",
                        padding: "16px 18px",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        cursor: "pointer",
                        boxShadow: "0 6px 25px rgba(0,0,0,0.3)",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "12px",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: "1.5rem" }}>
                            {threatInfo.icon}
                          </span>
                          <span
                            style={{
                              background: severityInfo.bg,
                              color: severityInfo.color,
                              padding: "4px 12px",
                              borderRadius: "20px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            {severityInfo.label}
                          </span>
                          <span
                            style={{
                              background: threatInfo.color + "20",
                              color: threatInfo.color,
                              padding: "4px 12px",
                              borderRadius: "20px",
                              fontSize: "0.75rem",
                            }}
                          >
                            {threatInfo.label}
                          </span>
                        </div>
                        <span style={{ color: "#8b949e", fontSize: "0.75rem" }}>
                          {new Date(event.createdAt).toLocaleString("ar-YE")}
                        </span>
                      </div>
                      <p
                        style={{
                          color: "#e6edf3",
                          margin: "10px 0 8px",
                          fontSize: "0.9rem",
                        }}
                      >
                        {event.description}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "16px",
                          fontSize: "0.78rem",
                          color: "#8b949e",
                        }}
                      >
                        <span>
                          🌍 IP:{" "}
                          <code
                            style={{
                              direction: "ltr",
                              display: "inline-block",
                            }}
                          >
                            {event.ipAddress || "—"}
                          </code>
                        </span>
                        {event.deviceInfo && <span>💻 {event.deviceInfo}</span>}
                        {event.user?.email && (
                          <span>👤 {event.user.email}</span>
                        )}
                      </div>
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "8px 12px",
                          background: "rgba(46,160,67,0.06)",
                          border: "1px solid rgba(46,160,67,0.2)",
                          borderRadius: "8px",
                          fontSize: "0.8rem",
                          color: "#2ea043",
                        }}
                      >
                        ✅ الإجراءات: تم تسجيل الحدث - مراقبة مستمرة - إرسال
                        تنبيه للأدمن
                      </div>
                      <div style={{ textAlign: "left", marginTop: "8px" }}>
                        <span
                          style={{
                            color: "#00e5ff",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                          }}
                        >
                          📋 تفاصيل أكثر ←
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* قسم نقاط الضعف والثغرات */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={{
              marginTop: "24px",
              background: "rgba(13,17,23,0.85)",
              border: "1px solid rgba(48,54,61,0.45)",
              borderRadius: "14px",
              padding: "20px 22px",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <h3
              style={{
                color: "#bf5af2",
                fontSize: "1.1rem",
                fontWeight: 700,
                margin: "0 0 14px",
              }}
            >
              💥 نقاط الضعف والثغرات المكتشفة
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    background: "rgba(255,49,49,0.12)",
                    color: "#ff3131",
                    padding: "3px 12px",
                    borderRadius: "20px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  🔴 ثغرات حرجة: {stats.vulnerabilities}
                </span>
                <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                  طرق الإصلاح: تحديث المكتبات - تعقيم المدخلات - مراجعة
                  الصلاحيات - تدقيق السجلات
                </span>
              </div>
            </div>
          </motion.div>
        </main>
      </PageTransition>

      {/* نافذة تفاصيل الحدث */}
      <AnimatePresence mode="wait">
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSelectedEvent(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.78)",
              backdropFilter: "blur(6px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(13,17,23,0.97)",
                border: "1px solid rgba(48,54,61,0.6)",
                borderRadius: "16px",
                padding: "28px",
                maxWidth: "680px",
                width: "100%",
                maxHeight: "85vh",
                overflowY: "auto",
                boxShadow: "0 25px 70px rgba(0,0,0,0.7)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "20px",
                }}
              >
                <h3
                  style={{
                    color: "#ff6b6b",
                    margin: 0,
                    fontSize: "1.2rem",
                    fontWeight: 800,
                  }}
                >
                  🛡️ تفاصيل التهديد
                </h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedEvent(null)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    padding: "6px 14px",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  ✕
                </motion.button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div>
                  <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                    نوع التهديد:{" "}
                  </span>
                  <span style={{ color: "#e6edf3", fontWeight: 600 }}>
                    {getThreatTypeInfo(selectedEvent.action).label}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                    الخطورة:{" "}
                  </span>
                  <span
                    style={{
                      background: getSeverityInfo(selectedEvent.severity).bg,
                      color: getSeverityInfo(selectedEvent.severity).color,
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    {getSeverityInfo(selectedEvent.severity).label}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                    الوصف:{" "}
                  </span>
                  <span style={{ color: "#e6edf3" }}>
                    {selectedEvent.description}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                    IP المهاجم:{" "}
                  </span>
                  <code
                    style={{
                      color: "#e6edf3",
                      direction: "ltr",
                      display: "inline-block",
                    }}
                  >
                    {selectedEvent.ipAddress || "—"}
                  </code>
                </div>
                {selectedEvent.deviceInfo && (
                  <div>
                    <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                      الجهاز:{" "}
                    </span>
                    <span style={{ color: "#e6edf3" }}>
                      {selectedEvent.deviceInfo}
                    </span>
                  </div>
                )}
                {selectedEvent.user && (
                  <div>
                    <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                      المستخدم المستهدف:{" "}
                    </span>
                    <span style={{ color: "#e6edf3" }}>
                      {selectedEvent.user.name} ({selectedEvent.user.email})
                    </span>
                  </div>
                )}
                <div>
                  <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                    التاريخ:{" "}
                  </span>
                  <span style={{ color: "#e6edf3" }}>
                    {new Date(selectedEvent.createdAt).toLocaleString("ar-YE")}
                  </span>
                </div>
                <div
                  style={{
                    background: "rgba(46,160,67,0.08)",
                    border: "1px solid rgba(46,160,67,0.25)",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    marginTop: "6px",
                  }}
                >
                  <span
                    style={{
                      color: "#2ea043",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                    }}
                  >
                    ✅ الإجراءات المتخذة:
                  </span>
                  <ul
                    style={{
                      color: "#e6edf3",
                      margin: "8px 0 0",
                      paddingRight: "20px",
                      fontSize: "0.85rem",
                    }}
                  >
                    <li>✅ تم تسجيل الحدث في سجل العمليات</li>
                    <li>✅ تم إرسال تنبيه فوري للأدمن</li>
                    <li>✅ جاري مراقبة IP المهاجم</li>
                    <li>✅ تم تفعيل Rate Limiting</li>
                    <li>✅ جاهز لحظر IP عند التأكيد</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        ::-webkit-scrollbar {
          width: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 49, 49, 0.15);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
