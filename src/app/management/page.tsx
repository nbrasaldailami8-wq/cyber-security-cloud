"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import { useAuthStore } from "@/store/authStore";
interface ServerStats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  totalAssignments: number;
  evaluatedAssignments: number;
  totalContent: number;
  totalSubjects: number;
}

const LogoutIcon = () => (
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
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function ManagementDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userName = user?.name || "";
  const userLevel = user?.level || "";
  const userId = user?.id || "";
  const managementLevel = (user as any)?.managementLevel || "";

  const [stats, setStats] = useState<ServerStats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalAssignments: 0,
    evaluatedAssignments: 0,
    totalContent: 0,
    totalSubjects: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/server/stats");
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const getLevelLabel = (l: string) =>
    ({
      LEVEL_1: "المستوى الأول",
      LEVEL_2: "المستوى الثاني",
      LEVEL_3: "المستوى الثالث",
      LEVEL_4: "المستوى الرابع",
    })[l] || l;
  const getManagementLabel = () =>
    managementLevel
      ? `إدارة ${getLevelLabel(managementLevel)}`
      : getLevelLabel(userLevel);

  const glassStyle: React.CSSProperties = {
    background: "rgba(10,20,40,0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0,229,255,0.12)",
    borderRadius: "18px",
  };

  const statCards = [
    {
      label: "إجمالي المستخدمين",
      value: stats.totalUsers,
      icon: "👥",
      color: "#00e5ff",
    },
    {
      label: "الحسابات المفعلة",
      value: stats.activeUsers,
      icon: "✅",
      color: "#2ea043",
    },
    {
      label: "الحسابات المعلقة",
      value: stats.pendingUsers,
      icon: "⏳",
      color: "#ffca28",
    },
    {
      label: "إجمالي التكاليف",
      value: stats.totalAssignments,
      icon: "📤",
      color: "#bf5af2",
    },
    {
      label: "التكاليف المقيمة",
      value: stats.evaluatedAssignments,
      icon: "📝",
      color: "#39ff14",
    },
    {
      label: "محتوى المكتبة",
      value: stats.totalContent,
      icon: "📚",
      color: "#ff6b6b",
    },
  ];

  const shortcuts = [
    {
      label: "إدارة التوليد",
      icon: "🏗️",
      path: "/management/generation",
      color: "#00e5ff",
    },
    {
      label: "ترقية المستخدمين",
      icon: "⬆️",
      path: "/admin/promotions",
      color: "#bf5af2",
    },
    {
      label: "الحسابات المفعلة",
      icon: "✅",
      path: "/management/activated-accounts",
      color: "#2ea043",
    },
    {
      label: "استهلاك السيرفر",
      icon: "💻",
      path: "/management/server-usage",
      color: "#39ff14",
    },
    {
      label: "سجل العمليات",
      icon: "📜",
      path: "/management/audit-log",
      color: "#ffca28",
    },
    {
      label: "المكتبة التعليمية",
      icon: "📚",
      path: "/library",
      color: "#00e5ff",
    },
    { label: "المحادثة", icon: "💬", path: "/chat", color: "#39ff14" },
    {
      label: "نشر تعميم",
      icon: "📢",
      path: "/announcements/create",
      color: "#ff3131",
    },
    { label: "الإعدادات", icon: "⚙️", path: "/settings", color: "#8b949e" },
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
      <Header />
      <Sidebar />
      <PageTransition>
        <main
          style={{
            maxWidth: "1300px",
            margin: "0 auto",
            padding: "100px 20px 60px",
          }}
        >
          {/* ========== الهيدر ========== */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              ...glassStyle,
              padding: "20px 30px",
              marginBottom: "25px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "15px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 15px rgba(255,202,40,0.4)",
                    "0 0 25px rgba(255,202,40,0.2)",
                    "0 0 15px rgba(255,202,40,0.4)",
                  ],
                }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "14px",
                  background: "rgba(255,202,40,0.15)",
                  border: "2px solid #ffca28",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  color: "#ffca28",
                }}
              >
                {userName.charAt(0)}
              </motion.div>
              <div>
                <h2
                  style={{
                    color: "#ffca28",
                    fontSize: "clamp(1.1rem,3vw,1.5rem)",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  🏢 مرحباً، {userName}
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  {getManagementLabel()}
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              style={{
                padding: "10px 20px",
                borderRadius: "12px",
                background: "rgba(248,81,73,0.1)",
                border: "1px solid rgba(248,81,73,0.25)",
                color: "#f85149",
                cursor: "pointer",
                fontFamily: "'Cairo', sans-serif",
                fontWeight: 700,
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <LogoutIcon /> تسجيل الخروج
            </motion.button>
          </motion.div>

          {/* ========== بطاقات إحصائية ========== */}
          {loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "25px",
              }}
            >
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    style={{
                      ...glassStyle,
                      padding: "16px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "15px",
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "14px",
                        background: "rgba(255,255,255,0.04)",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          height: "14px",
                          width: "40%",
                          background: "rgba(255,255,255,0.04)",
                          borderRadius: "6px",
                          marginBottom: "8px",
                        }}
                      />
                      <div
                        style={{
                          height: "20px",
                          width: "30%",
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: "6px",
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "25px",
              }}
            >
              {statCards.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{
                    scale: 1.015,
                    borderColor: stat.color,
                    boxShadow: `0 8px 30px ${stat.color}18`,
                  }}
                  style={{
                    ...glassStyle,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    cursor: "default",
                    transition: "all 0.3s",
                    border: `1px solid rgba(255,255,255,0.06)`,
                  }}
                >
                  <motion.div
                    animate={{
                      boxShadow: [
                        `0 0 15px ${stat.color}30`,
                        `0 0 25px ${stat.color}15`,
                        `0 0 15px ${stat.color}30`,
                      ],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.5,
                      delay: i * 0.3,
                    }}
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "16px",
                      background: `${stat.color}15`,
                      border: `1.5px solid ${stat.color}40`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.6rem",
                      flexShrink: 0,
                    }}
                  >
                    {stat.icon}
                  </motion.div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: "#8b949e",
                        fontSize: "0.8rem",
                        marginBottom: "4px",
                      }}
                    >
                      {stat.label}
                    </div>
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 800,
                        color: stat.color,
                        lineHeight: 1,
                      }}
                    >
                      {stat.value.toLocaleString("ar-YE")}
                    </div>
                  </div>
                  <div
                    style={{
                      width: "3px",
                      height: "40px",
                      borderRadius: "2px",
                      background: `linear-gradient(180deg, ${stat.color}60, ${stat.color}10)`,
                      flexShrink: 0,
                    }}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* ========== اختصارات سريعة ========== */}
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: "#8b949e", fontSize: "1rem", marginBottom: "15px" }}
          >
            ⚡ اختصارات سريعة
          </motion.h3>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "10px",
            }}
          >
            {shortcuts.map((s, i) => (
              <motion.button
                key={s.path}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.03 }}
                whileHover={{
                  scale: 1.05,
                  y: -4,
                  boxShadow: `0 12px 30px ${s.color}22`,
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(s.path)}
                style={{
                  ...glassStyle,
                  padding: "16px 8px",
                  textAlign: "center",
                  cursor: "pointer",
                  border: `1px solid ${s.color}22`,
                  transition: "all 0.3s",
                }}
              >
                <div style={{ fontSize: "1.6rem", marginBottom: "4px" }}>
                  {s.icon}
                </div>
                <div
                  style={{
                    color: "#e6edf3",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                  }}
                >
                  {s.label}
                </div>
              </motion.button>
            ))}
          </motion.div>
        </main>
      </PageTransition>
      <Footer />
    </div>
  );
}
