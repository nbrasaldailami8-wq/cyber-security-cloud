"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";

interface SecurityStats {
  errors: number;
  warnings: number;
  intrusions: number;
  vulnerabilities: number;
  attackAttempts: number;
  bans: number;
}

interface SecurityEvent {
  id: string;
  action: string;
  severity: string;
  description: string;
  ipAddress: string;
  deviceInfo: string;
  createdAt: string;
  user?: { name: string; email: string; role: string };
}

interface StatsResponse {
  success: boolean;
  data: {
    stats: SecurityStats;
    trends: { attacksLast24h: number; attacksLast7d: number };
    recentIntrusions: SecurityEvent[];
    criticalLogs: SecurityEvent[];
  };
}

const cardConfigs = [
  {
    key: "errors",
    label: "أخطاء",
    icon: "❌",
    color: "#f85149",
    bg: "rgba(248,81,73,0.08)",
    border: "rgba(248,81,73,0.3)",
    glow: "0 0 30px rgba(248,81,73,0.15)",
  },
  {
    key: "warnings",
    label: "تحذيرات",
    icon: "⚠️",
    color: "#ffca28",
    bg: "rgba(255,202,40,0.08)",
    border: "rgba(255,202,40,0.3)",
    glow: "0 0 30px rgba(255,202,40,0.15)",
  },
  {
    key: "intrusions",
    label: "تسللات",
    icon: "🕵️",
    color: "#ff3131",
    bg: "rgba(255,49,49,0.08)",
    border: "rgba(255,49,49,0.3)",
    glow: "0 0 30px rgba(255,49,49,0.15)",
  },
  {
    key: "vulnerabilities",
    label: "ثغرات",
    icon: "💥",
    color: "#bf5af2",
    bg: "rgba(191,90,242,0.08)",
    border: "rgba(191,90,242,0.3)",
    glow: "0 0 30px rgba(191,90,242,0.15)",
  },
  {
    key: "attackAttempts",
    label: "محاولات اختراق",
    icon: "🎯",
    color: "#ff6b35",
    bg: "rgba(255,107,53,0.08)",
    border: "rgba(255,107,53,0.3)",
    glow: "0 0 30px rgba(255,107,53,0.15)",
  },
  {
    key: "bans",
    label: "عمليات حظر",
    icon: "🚫",
    color: "#e3b341",
    bg: "rgba(227,179,65,0.08)",
    border: "rgba(227,179,65,0.3)",
    glow: "0 0 30px rgba(227,179,65,0.15)",
  },
];

export default function SecurityRadarPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<SecurityStats>({
    errors: 0,
    warnings: 0,
    intrusions: 0,
    vulnerabilities: 0,
    attackAttempts: 0,
    bans: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<SecurityEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/security/stats");
      const data: StatsResponse = await res.json();
      if (data.success) {
        setStats(data.data.stats);
      }
    } catch (err) {
      console.error("Stats load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useSupabaseRealtime(deriveStaticChannelName("security-radar"), "stats-update", () => {
    loadStats();
  });

  // تحديث كل 30 ثانية كاحتياط
  useEffect(() => {
    const interval = setInterval(() => {
      loadStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  const handleCardClick = async (key: string) => {
    if (selectedCard === key) {
      setSelectedCard(null);
      setDetailData([]);
      return;
    }
    setSelectedCard(key);
    setDetailLoading(true);
    try {
      const typeMap: Record<string, string> = {
        errors: "error",
        warnings: "warning",
        intrusions: "intrusion",
        vulnerabilities: "vulnerability",
        attackAttempts: "attack",
        bans: "ban",
      };
      const res = await fetch(
        `/api/security/logs?type=${typeMap[key]}&limit=50`,
      );
      const data = await res.json();
      if (data.success) {
        setDetailData(data.data);
      }
    } catch (err) {
      console.error("Detail load error:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const getSeverityBadge = (severity: string, action: string) => {
    if (action === "FAILED_LOGIN")
      return {
        label: "دخول فاشل",
        color: "#ffca28",
        bg: "rgba(255,202,40,0.15)",
      };
    if (action === "SUSPICIOUS_ACTIVITY")
      return {
        label: "نشاط مشبوه",
        color: "#ff3131",
        bg: "rgba(255,49,49,0.15)",
      };
    if (severity === "CRITICAL")
      return { label: "حرج", color: "#ff3131", bg: "rgba(255,49,49,0.15)" };
    if (severity === "ERROR")
      return { label: "خطأ", color: "#f85149", bg: "rgba(248,81,73,0.15)" };
    if (severity === "WARNING")
      return { label: "تحذير", color: "#ffca28", bg: "rgba(255,202,40,0.15)" };
    return { label: severity, color: "#00e5ff", bg: "rgba(0,229,255,0.15)" };
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        fontFamily: "'Cairo', sans-serif",
        color: "#fff",
        position: "relative",
      }}
    >
      <Sidebar />
      <PageTransition>
        <main
          style={{
            padding: "100px 20px 60px",
            maxWidth: "1300px",
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* الهيدر */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: "30px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "15px",
              }}
            >
              <div>
                <h1
                  style={{
                    color: "#00e5ff",
                    fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
                    fontWeight: 900,
                    margin: 0,
                    textShadow: "0 0 40px rgba(0,229,255,0.4)",
                    letterSpacing: "1px",
                  }}
                >
                  🛡️ رادار الأخطاء والأمن السيبراني
                </h1>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "5px 0 0",
                  }}
                >
                  نظام مراقبة شامل لحماية الموقع من التهديدات والثغرات
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.push("/admin/security-radar/terminal")}
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(0,229,255,0.12), rgba(0,229,255,0.04))",
                    border: "1px solid rgba(0,229,255,0.35)",
                    borderRadius: "14px",
                    padding: "14px 24px",
                    color: "#00e5ff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    boxShadow: "0 0 25px rgba(0,229,255,0.1)",
                    transition: "all 0.3s ease",
                  }}
                >
                  <span style={{ fontSize: "1.4rem" }}>🖥️</span>
                  <span>Terminal</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.push("/admin/security-radar/guardian")}
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,49,49,0.12), rgba(255,49,49,0.04))",
                    border: "1px solid rgba(255,49,49,0.35)",
                    borderRadius: "14px",
                    padding: "14px 24px",
                    color: "#ff6b6b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    boxShadow: "0 0 25px rgba(255,49,49,0.1)",
                    transition: "all 0.3s ease",
                  }}
                >
                  <span style={{ fontSize: "1.4rem" }}>🛡️</span>
                  <span>الحارس الرقمي</span>
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* البطاقات الإحصائية */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "14px",
              marginBottom: "30px",
            }}
          >
            {cardConfigs.map((card, index) => {
              const value = stats[card.key as keyof SecurityStats] || 0;
              const isSelected = selectedCard === card.key;
              const isHovered = hoveredCard === card.key;

              return (
                <motion.div
                  key={card.key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{
                    opacity: 1,
                    scale: isSelected ? 1.03 : 1,
                    boxShadow: isSelected
                      ? card.glow
                      : "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                  whileHover={{ scale: 1.04, y: -3 }}
                  transition={{ duration: 0.25, delay: index * 0.06 }}
                  onClick={() => handleCardClick(card.key)}
                  onMouseEnter={() => setHoveredCard(card.key)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: isSelected ? card.bg : "rgba(22,27,34,0.85)",
                    border: `1.5px solid ${isSelected || isHovered ? card.border : "rgba(48,54,61,0.5)"}`,
                    borderRadius: "16px",
                    padding: "22px 18px",
                    cursor: "pointer",
                    textAlign: "center",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    transition: "all 0.3s ease",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "60px",
                        height: "3px",
                        background: card.color,
                        borderRadius: "0 0 8px 8px",
                        boxShadow: `0 0 15px ${card.color}`,
                      }}
                    />
                  )}
                  <div
                    style={{
                      fontSize: "2rem",
                      marginBottom: "8px",
                      filter: isHovered ? "none" : "grayscale(20%)",
                      transition: "filter 0.3s ease",
                    }}
                  >
                    {card.icon}
                  </div>
                  <div
                    style={{
                      fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)",
                      fontWeight: 900,
                      color: card.color,
                      lineHeight: 1,
                      marginBottom: "6px",
                      textShadow: isHovered
                        ? `0 0 20px ${card.color}40`
                        : "none",
                      transition: "text-shadow 0.3s ease",
                    }}
                  >
                    {loading ? (
                      <span
                        style={{
                          display: "inline-block",
                          width: "40px",
                          height: "30px",
                          background:
                            "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
                          borderRadius: "8px",
                          animation: "pulse 1.5s infinite",
                        }}
                      />
                    ) : (
                      value.toLocaleString("ar-SA")
                    )}
                  </div>
                  <div
                    style={{
                      color: "#8b949e",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                    }}
                  >
                    {card.label}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* نافذة تفاصيل البطاقة */}
          <AnimatePresence>
            {selectedCard && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div
                  style={{
                    background: "rgba(13,17,23,0.95)",
                    border: "1px solid rgba(48,54,61,0.6)",
                    borderRadius: "16px",
                    padding: "24px",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "20px",
                    }}
                  >
                    <h3
                      style={{
                        color: "#00e5ff",
                        fontSize: "1.2rem",
                        fontWeight: 700,
                        margin: 0,
                      }}
                    >
                      {cardConfigs.find((c) => c.key === selectedCard)?.icon}{" "}
                      تفاصيل{" "}
                      {cardConfigs.find((c) => c.key === selectedCard)?.label}
                    </h3>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedCard(null);
                        setDetailData([]);
                      }}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "10px",
                        padding: "8px 16px",
                        color: "#8b949e",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      ✕ إغلاق
                    </motion.button>
                  </div>

                  {detailLoading ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px",
                        color: "#8b949e",
                      }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          repeat: Infinity,
                          duration: 1,
                          ease: "linear",
                        }}
                        style={{
                          width: "40px",
                          height: "40px",
                          border: "3px solid rgba(0,229,255,0.2)",
                          borderTopColor: "#00e5ff",
                          borderRadius: "50%",
                          margin: "0 auto 15px",
                        }}
                      />
                      جاري تحميل التفاصيل...
                    </div>
                  ) : detailData.length === 0 ? (
                    <p
                      style={{
                        textAlign: "center",
                        color: "#8b949e",
                        padding: "30px",
                      }}
                    >
                      ✅ لا توجد بيانات لعرضها
                    </p>
                  ) : (
                    <div
                      style={{
                        maxHeight: "500px",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {detailData.map((event, idx) => {
                        const badge = getSeverityBadge(
                          event.severity,
                          event.action,
                        );
                        return (
                          <motion.div
                            key={event.id}
                            initial={{ opacity: 0, x: -15 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            style={{
                              background: "rgba(22,27,34,0.7)",
                              border: "1px solid rgba(48,54,61,0.4)",
                              borderRadius: "12px",
                              padding: "14px 16px",
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "12px",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                background: badge.bg,
                                color: badge.color,
                                padding: "4px 12px",
                                borderRadius: "20px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {badge.label}
                            </span>
                            <span
                              style={{
                                flex: 1,
                                color: "#e6edf3",
                                fontSize: "0.85rem",
                                minWidth: "150px",
                              }}
                            >
                              {event.description}
                            </span>
                            <span
                              style={{
                                fontFamily: "monospace",
                                color: "#8b949e",
                                fontSize: "0.8rem",
                                direction: "ltr",
                              }}
                            >
                              {event.ipAddress || "—"}
                            </span>
                            <span
                              style={{
                                color: "#8b949e",
                                fontSize: "0.75rem",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {new Date(event.createdAt).toLocaleString(
                                "ar-YE",
                              )}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* حالة التحميل لأول مرة */}
          {loading && (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  repeat: Infinity,
                  duration: 1.2,
                  ease: "linear",
                }}
                style={{
                  width: "50px",
                  height: "50px",
                  border: "3px solid rgba(0,229,255,0.15)",
                  borderTopColor: "#00e5ff",
                  borderRadius: "50%",
                  margin: "0 auto 20px",
                }}
              />
              <p style={{ color: "#8b949e" }}>جاري تحميل الإحصائيات...</p>
            </div>
          )}
        </main>
      </PageTransition>

      {/* أنيميشن pulse للـ Skeleton */}
      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
        ::-webkit-scrollbar {
          width: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0, 229, 255, 0.2);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
