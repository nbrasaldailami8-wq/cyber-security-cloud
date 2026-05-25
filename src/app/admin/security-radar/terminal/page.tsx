"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";

interface TerminalLog {
  id: string;
  action: string;
  severity: string;
  description: string;
  ipAddress: string;
  deviceInfo: string;
  createdAt: string;
  file?: string;
  line?: number;
  solution?: string;
  user?: { name: string; email: string };
}

const severityStyles: Record<
  string,
  { icon: string; color: string; bg: string; label: string }
> = {
  CRITICAL: {
    icon: "💀",
    color: "#ff3131",
    bg: "rgba(255,49,49,0.12)",
    label: "CRITICAL",
  },
  ERROR: {
    icon: "❌",
    color: "#f85149",
    bg: "rgba(248,81,73,0.12)",
    label: "ERROR",
  },
  WARNING: {
    icon: "⚠️",
    color: "#ffca28",
    bg: "rgba(255,202,40,0.12)",
    label: "WARNING",
  },
  INFO: {
    icon: "ℹ️",
    color: "#00e5ff",
    bg: "rgba(0,229,255,0.12)",
    label: "INFO",
  },
};

export default function TerminalPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<TerminalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<TerminalLog | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [stats, setStats] = useState({ errors: 0, warnings: 0, problems: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/security/logs?limit=100");
      const data = await res.json();
      if (data.success) {
        const enhancedLogs: TerminalLog[] = data.data.map(
          (log: TerminalLog) => ({
            ...log,
            file: extractFileFromDescription(log.description),
            line: extractLineFromDescription(log.description),
            solution: generateSolution(log),
          }),
        );
        setLogs(enhancedLogs);
        applyFilter(enhancedLogs, activeFilter, searchQuery);
        updateStats(enhancedLogs);
      }
    } catch (err) {
      console.error("Terminal load error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useSupabaseRealtime(deriveStaticChannelName("security-terminal"), "new-log", (newLog: TerminalLog) => {
    console.log("📥 Realtime new-log received:", newLog);
    const enhanced = {
      ...newLog,
      file: extractFileFromDescription(newLog.description),
      line: extractLineFromDescription(newLog.description),
      solution: generateSolution(newLog),
    };
    setLogs((prev) => [enhanced, ...prev]);
    if (newLog.severity === "CRITICAL" && soundEnabled) {
      try {
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
      } catch {}
    }
  });

  const extractFileFromDescription = (desc: string): string => {
    const match = desc.match(/src\/[^\s]+\.(tsx?|jsx?|css)/);
    return match ? match[0] : "";
  };

  const extractLineFromDescription = (desc: string): number => {
    const match =
      desc.match(/line\s*:?\s*(\d+)/i) || desc.match(/سطر\s*:?\s*(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  };

  const generateSolution = (log: TerminalLog): string => {
    if (log.severity === "CRITICAL")
      return "🔴 تحقق فوراً من الملف المذكور وراجع التغييرات الأخيرة.";
    if (log.action === "FAILED_LOGIN")
      return "🟡 راقب IP وحاول تحديد ما إذا كانت محاولة اختراق.";
    if (log.action === "SUSPICIOUS_ACTIVITY")
      return "🔴 قم بحظر IP فوراً وتحقق من سجل الحارس الرقمي.";
    if (log.severity === "ERROR")
      return "🟠 افتح الملف وتحقق من السطر المذكور للتأكد من صحة الكود.";
    return "🔵 راقب السجل للمزيد من التفاصيل.";
  };

  const applyFilter = (
    sourceLogs: TerminalLog[],
    filter: string,
    search: string,
  ) => {
    let result = [...sourceLogs];
    if (filter !== "all") {
      result = result.filter((l) => l.severity === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.description.toLowerCase().includes(q) ||
          l.ipAddress?.toLowerCase().includes(q) ||
          (l.file && l.file.toLowerCase().includes(q)),
      );
    }
    setFilteredLogs(result);
  };

  const updateStats = (sourceLogs: TerminalLog[]) => {
    setStats({
      errors: sourceLogs.filter(
        (l) => l.severity === "ERROR" || l.severity === "CRITICAL",
      ).length,
      warnings: sourceLogs.filter((l) => l.severity === "WARNING").length,
      problems: sourceLogs.filter((l) => l.severity === "CRITICAL").length,
    });
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    applyFilter(logs, filter, searchQuery);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    applyFilter(logs, activeFilter, value);
  };

  const clearTerminal = () => {
    setLogs([]);
    setFilteredLogs([]);
    setStats({ errors: 0, warnings: 0, problems: 0 });
  };

  const exportLogs = () => {
    const json = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terminal-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const filters = [
    { key: "all", label: "الكل", color: "#8b949e" },
    { key: "CRITICAL", label: "حرجة", color: "#ff3131" },
    { key: "ERROR", label: "أخطاء", color: "#f85149" },
    { key: "WARNING", label: "تحذيرات", color: "#ffca28" },
    { key: "INFO", label: "معلومات", color: "#00e5ff" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        fontFamily: "'Cairo', 'Fira Code', monospace",
        color: "#fff",
      }}
    >
      <Sidebar />
      <PageTransition>
        <main
          style={{
            padding: "100px 16px 60px",
            maxWidth: "1200px",
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
                marginBottom: "16px",
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
                    color: "#00e5ff",
                    fontSize: "clamp(1.3rem, 2.5vw, 1.7rem)",
                    fontWeight: 800,
                    margin: 0,
                    textShadow: "0 0 25px rgba(0,229,255,0.3)",
                  }}
                >
                  🖥️ Terminal
                </h2>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    background: "rgba(248,81,73,0.1)",
                    border: "1px solid rgba(248,81,73,0.3)",
                    borderRadius: "20px",
                    padding: "6px 14px",
                    fontSize: "0.8rem",
                    color: "#f85149",
                  }}
                >
                  أخطاء: {stats.errors}
                </div>
                <div
                  style={{
                    background: "rgba(255,202,40,0.1)",
                    border: "1px solid rgba(255,202,40,0.3)",
                    borderRadius: "20px",
                    padding: "6px 14px",
                    fontSize: "0.8rem",
                    color: "#ffca28",
                  }}
                >
                  تحذيرات: {stats.warnings}
                </div>
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
                  مشاكل: {stats.problems}
                </div>
              </div>
            </div>
          </motion.div>

          {/* شريط الفلترة والبحث */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "14px",
              alignItems: "center",
            }}
          >
            {filters.map((f) => (
              <motion.button
                key={f.key}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleFilterChange(f.key)}
                style={{
                  background:
                    activeFilter === f.key
                      ? f.color + "20"
                      : "rgba(255,255,255,0.03)",
                  border: `1px solid ${activeFilter === f.key ? f.color + "60" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "20px",
                  padding: "6px 14px",
                  color: activeFilter === f.key ? f.color : "#8b949e",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: activeFilter === f.key ? 700 : 400,
                  transition: "all 0.25s ease",
                }}
              >
                {f.label}
              </motion.button>
            ))}
            <div style={{ flex: 1, minWidth: "180px" }}>
              <input
                type="text"
                placeholder="🔍 بحث في الطرفية..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                style={{
                  width: "100%",
                  background: "rgba(13,17,23,0.9)",
                  border: "1px solid rgba(48,54,61,0.5)",
                  borderRadius: "10px",
                  padding: "8px 14px",
                  color: "#e6edf3",
                  fontSize: "0.85rem",
                  fontFamily: "'Cairo', monospace",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={clearTerminal}
              title="مسح الطرفية"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "8px 12px",
                color: "#8b949e",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              🧹 مسح
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={exportLogs}
              title="تصدير"
              style={{
                background: "rgba(0,229,255,0.08)",
                border: "1px solid rgba(0,229,255,0.25)",
                borderRadius: "10px",
                padding: "8px 12px",
                color: "#00e5ff",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              📥 تصدير
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setAutoScroll(!autoScroll)}
              title={
                autoScroll ? "تعطيل التمرير التلقائي" : "تفعيل التمرير التلقائي"
              }
              style={{
                background: autoScroll
                  ? "rgba(46,160,67,0.1)"
                  : "rgba(255,255,255,0.03)",
                border: `1px solid ${autoScroll ? "rgba(46,160,67,0.3)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "10px",
                padding: "8px 12px",
                color: autoScroll ? "#2ea043" : "#8b949e",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              {autoScroll ? "📌 تلقائي" : "📌 يدوي"}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "كتم الصوت" : "تفعيل الصوت"}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "8px 12px",
                color: soundEnabled ? "#00e5ff" : "#8b949e",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              {soundEnabled ? "🔊" : "🔇"}
            </motion.button>
          </motion.div>

          {/* الطرفية */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{
              background: "rgba(1,2,4,0.96)",
              border: "1px solid rgba(48,54,61,0.5)",
              borderRadius: "14px",
              overflow: "hidden",
              boxShadow:
                "0 15px 50px rgba(0,0,0,0.6), inset 0 0 80px rgba(0,0,0,0.4)",
            }}
          >
            {/* شريط عنوان الطرفية */}
            <div
              style={{
                background: "rgba(22,27,34,0.9)",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                borderBottom: "1px solid rgba(48,54,61,0.4)",
              }}
            >
              <div style={{ display: "flex", gap: "6px" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#f85149",
                  }}
                />
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#ffca28",
                  }}
                />
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#2ea043",
                  }}
                />
              </div>
              <span
                style={{
                  color: "#8b949e",
                  fontSize: "0.8rem",
                  flex: 1,
                  textAlign: "center",
                }}
              >
                admin@cybersec — Terminal — bash
              </span>
            </div>

            {/* محتوى الطرفية */}
            <div
              ref={terminalRef}
              style={{
                height: "500px",
                overflowY: "auto",
                padding: "16px 20px",
                fontFamily:
                  "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                fontSize: "0.8rem",
                lineHeight: 1.8,
              }}
            >
              {loading ? (
                <div
                  style={{
                    color: "#8b949e",
                    textAlign: "center",
                    padding: "40px",
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
                      width: "30px",
                      height: "30px",
                      border: "2px solid rgba(0,229,255,0.2)",
                      borderTopColor: "#00e5ff",
                      borderRadius: "50%",
                      margin: "0 auto 15px",
                    }}
                  />
                  جاري تحميل السجلات...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div
                  style={{
                    color: "#2ea043",
                    textAlign: "center",
                    padding: "40px",
                  }}
                >
                  <span style={{ color: "#00e5ff" }}>$</span> لا توجد سجلات
                  مطابقة...
                  <br />
                  <span style={{ color: "#00e5ff" }}>$</span> النظام يعمل بشكل
                  طبيعي ✅
                </div>
              ) : (
                filteredLogs.map((log, idx) => {
                  const style =
                    severityStyles[log.severity] || severityStyles.INFO;
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.01 }}
                      onClick={() => setSelectedLog(log)}
                      style={{
                        cursor: "pointer",
                        padding: "3px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.02)",
                      }}
                    >
                      <span style={{ color: "#8b949e" }}>
                        [{new Date(log.createdAt).toLocaleTimeString("ar-YE")}]
                      </span>{" "}
                      <span style={{ color: style.color, fontWeight: 700 }}>
                        [{style.label}]
                      </span>{" "}
                      <span style={{ color: "#e6edf3" }}>
                        {log.description}
                      </span>{" "}
                      {log.file && (
                        <span style={{ color: "#00e5ff" }}>
                          → {log.file}
                          {(log.line ?? 0) > 0 && `:${log.line}`}
                        </span>
                      )}
                    </motion.div>
                  );
                })
              )}
              {/* سطر الأوامر */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "12px",
                  color: "#00e5ff",
                }}
              >
                <span>$</span>
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  style={{
                    width: "10px",
                    height: "18px",
                    background: "#00e5ff",
                    display: "inline-block",
                    borderRadius: "2px",
                  }}
                />
              </div>
            </div>

            {/* شريط الحالة */}
            <div
              style={{
                background: "rgba(22,27,34,0.9)",
                borderTop: "1px solid rgba(48,54,61,0.4)",
                padding: "8px 16px",
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                fontSize: "0.75rem",
                color: "#8b949e",
              }}
            >
              <span>🟢 متصل</span>
              <span>📊 {filteredLogs.length} سجل</span>
              <span>
                🔄 آخر تحديث: {new Date().toLocaleTimeString("ar-YE")}
              </span>
            </div>
          </motion.div>
        </main>
      </PageTransition>

      {/* نافذة تفاصيل الخطأ */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSelectedLog(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
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
                maxWidth: "650px",
                width: "100%",
                maxHeight: "80vh",
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
                    color: "#00e5ff",
                    margin: 0,
                    fontSize: "1.2rem",
                    fontWeight: 700,
                  }}
                >
                  🛡️ تفاصيل الخطأ
                </h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedLog(null)}
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
                    النوع:{" "}
                  </span>
                  <span
                    style={{
                      background: (
                        severityStyles[selectedLog.severity] ||
                        severityStyles.INFO
                      ).bg,
                      color: (
                        severityStyles[selectedLog.severity] ||
                        severityStyles.INFO
                      ).color,
                      padding: "3px 12px",
                      borderRadius: "20px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    {
                      (
                        severityStyles[selectedLog.severity] ||
                        severityStyles.INFO
                      ).label
                    }
                  </span>
                </div>
                <div>
                  <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                    الوصف:{" "}
                  </span>
                  <span style={{ color: "#e6edf3" }}>
                    {selectedLog.description}
                  </span>
                </div>
                {selectedLog.file && (
                  <div>
                    <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                      الملف:{" "}
                    </span>
                    <code
                      style={{
                        background: "rgba(0,229,255,0.08)",
                        color: "#00e5ff",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {selectedLog.file}
                      {(selectedLog.line ?? 0) > 0 && ` :${selectedLog.line}`}
                    </code>
                  </div>
                )}
                {selectedLog.solution && (
                  <div
                    style={{
                      background: "rgba(46,160,67,0.08)",
                      border: "1px solid rgba(46,160,67,0.25)",
                      borderRadius: "10px",
                      padding: "12px 16px",
                    }}
                  >
                    <span
                      style={{
                        color: "#2ea043",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      💡 الحل المقترح:{" "}
                    </span>
                    <span style={{ color: "#e6edf3" }}>
                      {selectedLog.solution}
                    </span>
                  </div>
                )}
                <div>
                  <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                    IP:{" "}
                  </span>
                  <code style={{ color: "#8b949e", direction: "ltr" }}>
                    {selectedLog.ipAddress || "—"}
                  </code>
                </div>
                <div>
                  <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                    التاريخ:{" "}
                  </span>
                  <span style={{ color: "#8b949e" }}>
                    {new Date(selectedLog.createdAt).toLocaleString("ar-YE")}
                  </span>
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
          background: rgba(0, 229, 255, 0.15);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
