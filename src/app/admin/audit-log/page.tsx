"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import Pagination from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { useAuthStore } from "@/store/authStore";
// ==================== الأنواع ====================
interface LogItem {
  id: string;
  action: string;
  severity: string;
  description: string;
  ipAddress: string;
  deviceInfo?: string;
  createdAt: string;
  user?: { name: string; role: string };
  level?: string;
}

// ==================== الأيقونات ====================
const BackIcon = () => (
  <svg
    width="20"
    height="20"
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

const RefreshIcon = () => (
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
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

// ==================== المكوّن الرئيسي ====================
export default function AuditLogPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userRole = user?.role || "";
  const userId = user?.id || "";

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const pag = usePagination(1, 20);

  // ==================== تحميل السجل ====================
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/audit-log?page=${pag.page}&limit=${pag.limit}`,
      );
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
        pag.setTotal(data.total || 0);
      } else {
        showToast("فشل تحميل السجل", "error");
      }
    } catch {
      /* صامت */
    } finally {
      setLoading(false);
    }
  }, [pag.page, pag.limit, showToast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // ==================== تحديث يدوي ====================
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  // ==================== أدوات مساعدة ====================
  const getSeverityColor = (s: string) =>
    ({
      CRITICAL: "#ff3131",
      ERROR: "#f85149",
      WARNING: "#ffca28",
      INFO: "#00e5ff",
    })[s] || "#8b949e";
  const getSeverityBg = (s: string) =>
    ({
      CRITICAL: "rgba(255,49,49,0.15)",
      ERROR: "rgba(248,81,73,0.12)",
      WARNING: "rgba(255,202,40,0.12)",
      INFO: "rgba(0,229,255,0.08)",
    })[s] || "rgba(255,255,255,0.03)";
  const getSeverityIcon = (s: string) =>
    ({ CRITICAL: "🔴", ERROR: "🟠", WARNING: "🟡", INFO: "🔵" })[s] || "⚪";

  const getActionLabel = (a: string) => {
    const labels: Record<string, string> = {
      LOGIN: "تسجيل دخول",
      LOGOUT: "تسجيل خروج",
      CREATE: "إنشاء",
      UPDATE: "تعديل",
      DELETE: "حذف",
      UPLOAD: "رفع ملف",
      DOWNLOAD: "تحميل",
      EVALUATE: "تقييم",
      PUBLISH: "نشر",
      FAILED_LOGIN: "دخول فاشل",
      SUSPICIOUS_ACTIVITY: "نشاط مشبوه",
      LEVEL_PROMOTION: "ترقية مستوى",
      SEMESTER_SWITCH: "تبديل ترم",
    };
    return labels[a] || a;
  };

  const getActionIcon = (a: string) => {
    const icons: Record<string, string> = {
      LOGIN: "🔑",
      LOGOUT: "🚪",
      CREATE: "➕",
      UPDATE: "✏️",
      DELETE: "🗑️",
      UPLOAD: "📤",
      DOWNLOAD: "📥",
      EVALUATE: "✅",
      PUBLISH: "📢",
      FAILED_LOGIN: "❌",
      SUSPICIOUS_ACTIVITY: "⚠️",
      LEVEL_PROMOTION: "🎓",
    };
    return icons[a] || "📌";
  };

  const getLevelLabel = (l?: string) =>
    l
      ? { LEVEL_1: "م1", LEVEL_2: "م2", LEVEL_3: "م3", LEVEL_4: "م4" }[l] || l
      : "";

  const glassStyle: React.CSSProperties = {
    background: "rgba(10, 20, 40, 0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0, 229, 255, 0.12)",
    borderRadius: "18px",
  };

  // ==================== إحصائيات ====================
  const stats = {
    total: logs.length,
    critical: logs.filter(
      (l) => l.severity === "CRITICAL" || l.severity === "ERROR",
    ).length,
    warnings: logs.filter((l) => l.severity === "WARNING").length,
    failedLogins: logs.filter((l) => l.action === "FAILED_LOGIN").length,
  };

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
            maxWidth: "1500px",
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
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "15px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() =>
                  router.push(userRole === "ADMIN" ? "/admin" : "/management")
                }
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(0,229,255,0.08)",
                  border: "1px solid rgba(0,229,255,0.2)",
                  color: "#00e5ff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BackIcon />
              </motion.button>
              <div>
                <h2
                  style={{
                    color: "#ffca28",
                    fontSize: "clamp(1.2rem, 3vw, 1.5rem)",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  📜 سجل العمليات
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  جميع الأنشطة والأحداث في النظام
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                padding: "10px 18px",
                borderRadius: "12px",
                background: "rgba(0,229,255,0.08)",
                border: "1px solid rgba(0,229,255,0.2)",
                color: "#00e5ff",
                cursor: "pointer",
                fontFamily: "'Cairo', sans-serif",
                fontWeight: 700,
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <motion.span
                animate={refreshing ? { rotate: 360 } : {}}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <RefreshIcon />
              </motion.span>
              تحديث
            </motion.button>
          </motion.div>

          {/* ========== بطاقات إحصائية ========== */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            {[
              {
                label: "إجمالي العمليات",
                value: stats.total,
                icon: "📊",
                color: "#00e5ff",
              },
              {
                label: "أخطاء / حرجة",
                value: stats.critical,
                icon: "🔴",
                color: "#f85149",
              },
              {
                label: "تحذيرات",
                value: stats.warnings,
                icon: "🟡",
                color: "#ffca28",
              },
              {
                label: "دخول فاشل",
                value: stats.failedLogins,
                icon: "❌",
                color: "#ff3131",
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ scale: 1.03, y: -3 }}
                style={{ ...glassStyle, padding: "16px", textAlign: "center" }}
              >
                <div style={{ fontSize: "1.8rem", marginBottom: "4px" }}>
                  {stat.icon}
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 800,
                    color: stat.color,
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#8b949e" }}>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* ========== السجل ========== */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px" }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{
                  width: "44px",
                  height: "44px",
                  border: "3px solid rgba(0,229,255,0.2)",
                  borderTopColor: "#00e5ff",
                  borderRadius: "50%",
                  margin: "0 auto 20px",
                }}
              />
              <p style={{ color: "#8b949e" }}>جاري تحميل السجل...</p>
            </div>
          ) : logs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ ...glassStyle, padding: "60px", textAlign: "center" }}
            >
              <div style={{ fontSize: "4rem", marginBottom: "15px" }}>📭</div>
              <h3
                style={{
                  color: "#8b949e",
                  fontSize: "1.3rem",
                  marginBottom: "8px",
                }}
              >
                لا توجد عمليات مسجلة
              </h3>
            </motion.div>
          ) : (
            <>
              {/* جدول للكمبيوتر */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ ...glassStyle, overflow: "hidden", display: "none" }}
                className="lg:block"
              >
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.82rem",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                          background: "rgba(0,0,0,0.3)",
                        }}
                      >
                        {[
                          "الخطورة",
                          "العملية",
                          "الوصف",
                          "المستخدم",
                          "المستوى",
                          "IP",
                          "الوقت",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "12px",
                              textAlign: "center",
                              color: "#ffca28",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {logs.map((log, i) => (
                          <motion.tr
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.01 }}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.03)",
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = getSeverityBg(
                                log.severity,
                              ))
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                          >
                            <td
                              style={{ padding: "10px", textAlign: "center" }}
                            >
                              <span
                                style={{ fontSize: "1.1rem" }}
                                title={log.severity}
                              >
                                {getSeverityIcon(log.severity)}
                              </span>
                            </td>
                            <td
                              style={{ padding: "10px", textAlign: "center" }}
                            >
                              <span
                                style={{
                                  background: getSeverityBg(log.severity),
                                  color: getSeverityColor(log.severity),
                                  padding: "3px 10px",
                                  borderRadius: "8px",
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                }}
                              >
                                {getActionIcon(log.action)}{" "}
                                {getActionLabel(log.action)}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "10px",
                                color: "#e6edf3",
                                fontSize: "0.8rem",
                                maxWidth: "250px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {log.description}
                            </td>
                            <td
                              style={{
                                padding: "10px",
                                textAlign: "center",
                                color: "#8b949e",
                                fontSize: "0.75rem",
                              }}
                            >
                              {log.user?.name || "—"}
                            </td>
                            <td
                              style={{
                                padding: "10px",
                                textAlign: "center",
                                color: "#8b949e",
                                fontSize: "0.7rem",
                              }}
                            >
                              {getLevelLabel(log.level) || "—"}
                            </td>
                            <td
                              style={{
                                padding: "10px",
                                textAlign: "center",
                                color: "#5a6a7a",
                                fontSize: "0.7rem",
                                fontFamily: "monospace",
                                direction: "ltr",
                              }}
                            >
                              {log.ipAddress || "—"}
                            </td>
                            <td
                              style={{
                                padding: "10px",
                                textAlign: "center",
                                color: "#8b949e",
                                fontSize: "0.7rem",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {new Date(log.createdAt).toLocaleString("ar-YE", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* بطاقات للجوال */}
              <div
                className="lg:hidden"
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <AnimatePresence mode="popLayout">
                  {logs.map((log, i) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      whileHover={{
                        borderColor: getSeverityColor(log.severity),
                      }}
                      style={{
                        ...glassStyle,
                        padding: "14px 16px",
                        borderLeft: `3px solid ${getSeverityColor(log.severity)}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "6px",
                        }}
                      >
                        <span
                          style={{
                            background: getSeverityBg(log.severity),
                            color: getSeverityColor(log.severity),
                            padding: "3px 10px",
                            borderRadius: "8px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                          }}
                        >
                          {getActionIcon(log.action)}{" "}
                          {getActionLabel(log.action)}
                        </span>
                        <span style={{ color: "#8b949e", fontSize: "0.65rem" }}>
                          {new Date(log.createdAt).toLocaleString("ar-YE", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p
                        style={{
                          color: "#e6edf3",
                          fontSize: "0.85rem",
                          margin: "0 0 6px",
                          lineHeight: 1.5,
                        }}
                      >
                        {log.description}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {log.user?.name && (
                          <span
                            style={{ color: "#00e5ff", fontSize: "0.7rem" }}
                          >
                            👤 {log.user.name}
                          </span>
                        )}
                        {log.level && (
                          <span
                            style={{ color: "#8b949e", fontSize: "0.65rem" }}
                          >
                            {getLevelLabel(log.level)}
                          </span>
                        )}
                        {log.ipAddress && (
                          <span
                            style={{
                              color: "#5a6a7a",
                              fontSize: "0.65rem",
                              fontFamily: "monospace",
                              direction: "ltr",
                            }}
                          >
                            {log.ipAddress}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div style={{ marginTop: "20px" }}>
                <Pagination
                  page={pag.page}
                  totalPages={pag.totalPages}
                  onPageChange={pag.goTo}
                />
              </div>
            </>
          )}
        </main>
      </PageTransition>
      <Footer />
    </div>
  );
}
