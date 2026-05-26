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
// ==================== الأنواع ====================
interface ServerStats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  totalAssignments: number;
  evaluatedAssignments: number;
  totalContent: number;
  totalSubjects: number;
}

// ==================== الأيقونات ====================
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

// ==================== المكوّن الرئيسي ====================
export default function AdminDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userName = user?.name || "";
  const userId = user?.id || "";

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

  // ==================== تحميل الإحصائيات ====================
  const loadStats = useCallback(async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/server/stats"),
      ]);
      const usersData = await usersRes.json();
      const statsData = await statsRes.json();

      if (statsData.success) {
        setStats(statsData.data);
      } else if (usersData.success) {
        const users = usersData.data?.users || usersData.data || [];
        setStats({
          totalUsers: users.length,
          activeUsers: users.filter((u: any) => u.isActivated).length,
          pendingUsers: users.filter((u: any) => !u.isActivated).length,
          totalAssignments: 0,
          evaluatedAssignments: 0,
          totalContent: 0,
          totalSubjects: 0,
        });
      }
    } catch {
      /* صامت */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ==================== تسجيل الخروج ====================
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // ==================== التنسيقات ====================
  const glassStyle: React.CSSProperties = {
    background: "rgba(10, 20, 40, 0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0, 229, 255, 0.15)",
    borderRadius: "20px",
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
    {
      label: "المواد الدراسية",
      value: stats.totalSubjects,
      icon: "📘",
      color: "#ffca28",
    },
  ];

  const shortcuts = [
    {
      href: "/admin/generation",
      icon: "🏗️",
      label: "إدارة التوليد",
      color: "#00e5ff",
    },
    {
      href: "/admin/activated-accounts",
      icon: "📋",
      label: "الحسابات المفعلة",
      color: "#2ea043",
    },
    {
      href: "/admin/audit-log",
      icon: "📜",
      label: "سجل العمليات",
      color: "#ffca28",
    },
    {
      href: "/admin/security-radar",
      icon: "🛡️",
      label: "رادار الأمان",
      color: "#f85149",
    },
    {
      href: "/admin/semester",
      icon: "📅",
      label: "الفصول الدراسية",
      color: "#bf5af2",
    },
    {
      href: "/admin/server-usage",
      icon: "💻",
      label: "استخدام الخادم",
      color: "#39ff14",
    },
    {
      href: "/admin/promotions",
      icon: "🏆",
      label: "الترفيعات",
      color: "#ffca28",
    },
    {
      href: "/admin/upgrade",
      icon: "⬆️",
      label: "ترقية المستخدمين",
      color: "#ff6b6b",
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
      <Header />
      <Sidebar />
      <PageTransition>
        <main
          style={{
            maxWidth: "1400px",
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
                    "0 0 20px rgba(255,49,49,0.4)",
                    "0 0 40px rgba(255,49,49,0.2)",
                    "0 0 20px rgba(255,49,49,0.4)",
                  ],
                }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: "rgba(255,49,49,0.15)",
                  border: "2px solid #ff3131",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  color: "#ff3131",
                }}
              >
                {userName.charAt(0)}
              </motion.div>
              <div>
                <h2
                  style={{
                    color: "#ff3131",
                    fontSize: "clamp(1.1rem, 3vw, 1.5rem)",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  👑 مرحباً، {userName}
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  الأدمن - تحكم كامل
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

          {/* ========== بطاقات إحصائية بتصميم أفقي فخم ========== */}
          {loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "25px",
              }}
            >
              {Array(7)
                .fill(0)
                .map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
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
                          height: "16px",
                          width: "40%",
                          background: "rgba(255,255,255,0.04)",
                          borderRadius: "6px",
                          marginBottom: "8px",
                        }}
                      />
                      <div
                        style={{
                          height: "22px",
                          width: "30%",
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: "6px",
                        }}
                      />
                    </div>
                  </motion.div>
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
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, type: "spring" }}
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
                  {/* أيقونة جانبية */}
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

                  {/* البيانات */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: "#8b949e",
                        fontSize: "0.8rem",
                        marginBottom: "4px",
                        fontWeight: 500,
                      }}
                    >
                      {stat.label}
                    </div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      style={{
                        fontSize: "1.6rem",
                        fontWeight: 800,
                        color: stat.color,
                        lineHeight: 1,
                      }}
                    >
                      {stat.value.toLocaleString("ar-YE")}
                    </motion.div>
                  </div>

                  {/* شريط توهج جانبي */}
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{ marginBottom: "10px" }}
          >
            <h3
              style={{
                color: "#00e5ff",
                fontSize: "1.1rem",
                fontWeight: 700,
                marginBottom: "15px",
              }}
            >
              ⚡ اختصارات سريعة
            </h3>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "12px",
            }}
          >
            {shortcuts.map((shortcut, i) => (
              <motion.button
                key={shortcut.href}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.04 }}
                whileHover={{
                  scale: 1.05,
                  y: -4,
                  boxShadow: `0 12px 30px ${shortcut.color}22`,
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(shortcut.href)}
                style={{
                  ...glassStyle,
                  padding: "18px 10px",
                  textAlign: "center",
                  cursor: "pointer",
                  border: `1px solid ${shortcut.color}22`,
                  transition: "all 0.3s",
                }}
              >
                <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>
                  {shortcut.icon}
                </div>
                <div
                  style={{
                    color: shortcut.color,
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  {shortcut.label}
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
