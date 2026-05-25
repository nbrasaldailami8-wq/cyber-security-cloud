"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import { useAuthStore } from "@/store/authStore";
import { csrfFetch } from "@/lib/csrfClient";

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

const glassStyle: React.CSSProperties = {
  background: "rgba(10,20,40,0.5)",
  backdropFilter: "blur(25px)",
  WebkitBackdropFilter: "blur(25px)",
  border: "1px solid rgba(0,229,255,0.12)",
  borderRadius: "18px",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  color: "#e6edf3",
  fontSize: "0.9rem",
  fontFamily: "'Cairo', sans-serif",
  outline: "none",
};

interface LogEntry {
  id: string;
  name: string;
  email: string | null;
  code: string;
  level: string;
  role: string;
  createdAt: string;
}

export default function GenerateManagementPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userRole = user?.role || "";

  const [name, setName] = useState("");
  const [level, setLevel] = useState("LEVEL_1");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logSearch, setLogSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    id: string;
    name: string;
  }>({ show: false, id: "", name: "" });

  useEffect(() => {
    if (userRole) fetchLogs();
  }, [logPage, logSearch, userRole]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams({
        page: String(logPage),
        limit: "50",
        role: "MANAGEMENT",
      });
      if (logSearch) params.set("search", logSearch);
      const res = await fetch(`/api/admin/generation-log?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setTotalLogs(data.total);
      }
    } catch {
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleGenerate = async () => {
    if (!name.trim()) {
      showToast("الرجاء إدخال اسم الحساب", "warning");
      return;
    }
    setGenerating(true);
    setProgress(0);
    try {
      const res = await csrfFetch("/api/admin/generate-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), level }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        setName("");
        setLogPage(1);
        fetchLogs();
        if (data.data) generateTextFile(data.data);
      } else showToast(data.message || "فشل", "error");
    } catch {
      showToast("فشل الاتصال", "error");
    } finally {
      setGenerating(false);
      setProgress(100);
    }
  };

  const generateTextFile = (entry: any) => {
    const lines = [
      "=".repeat(60),
      "سحابة الأمن السيبراني - جامعة ذمار",
      "أكواد تفعيل حسابات الإدارة",
      "=".repeat(60),
      "",
      `التاريخ: ${new Date().toLocaleDateString("ar-YE")}`,
      `الاسم: ${entry.name}`,
      `المستوى: ${entry.level === "LEVEL_1" ? "المستوى الأول" : "المستوى الثاني"}`,
      `كود التفعيل: ${entry.code}`,
      "",
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `management-${entry.name}-${Date.now()}.txt`;
    a.click();
  };

  const handleDownloadSingle = (entry: LogEntry) => {
    const lines = [
      "=".repeat(60),
      "سحابة الأمن السيبراني",
      `الاسم: ${entry.name}`,
      `المستوى: ${entry.level === "LEVEL_1" ? "المستوى الأول" : "المستوى الثاني"}`,
      `كود التفعيل: ${entry.code}`,
      "",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `code-${entry.name}.txt`;
    a.click();
  };

  const handleDownloadSelected = async () => {
    if (!selectedIds.size) {
      showToast("حدد حساب واحد على الأقل", "warning");
      return;
    }
    const ids = Array.from(selectedIds).join(",");
    const res = await fetch(`/api/admin/generation-log/export?ids=${ids}`);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `selected-${Date.now()}.txt`;
    a.click();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(logs.map((l) => l.id)));
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim() || editName.length < 2) {
      showToast("الاسم قصير", "warning");
      return;
    }
    try {
      const res = await csrfFetch(`/api/admin/generation-log/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ تم التعديل", "success");
        setEditingId(null);
        fetchLogs();
      } else showToast(data.message, "error");
    } catch {
      showToast("فشل", "error");
    }
  };

  const handleDelete = (id: string, nm: string) => {
    setDeleteConfirm({ show: true, id, name: nm });
  };
  const executeDelete = async () => {
    const { id } = deleteConfirm;
    setDeleteConfirm({ show: false, id: "", name: "" });
    try {
      const res = await csrfFetch(`/api/admin/generation-log/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ تم الحذف", "warning");
        fetchLogs();
      } else showToast(data.message, "error");
    } catch {
      showToast("فشل", "error");
    }
  };

  const totalPages = Math.ceil(totalLogs / 50);

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
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "100px 20px 60px",
          }}
        >
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
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() =>
                  router.push(
                    userRole === "ADMIN" ? "/admin/generation" : "/management",
                  )
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
                    fontSize: "clamp(1.2rem,3vw,1.5rem)",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  👔 توليد حسابات الإدارة
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  الأدمن - جميع المستويات
                </p>
              </div>
            </div>
          </motion.div>

          {/* قسم الإدخال */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ ...glassStyle, padding: "24px", marginBottom: "24px" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              <div>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  اسم المسؤول
                </label>
                <input
                  type="text"
                  placeholder="أدخل اسم حساب الإدارة"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  المستوى المسؤول عنه
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  style={inputStyle}
                >
                  <option value="LEVEL_1">المستوى الأول</option>
                  <option value="LEVEL_2">المستوى الثاني</option>
                </select>
              </div>
            </div>

            {generating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ marginBottom: "16px" }}
              >
                <div
                  style={{
                    height: "6px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "3px",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2 }}
                    style={{
                      height: "100%",
                      background: "linear-gradient(90deg,#ffca28,#ff8c00)",
                      borderRadius: "3px",
                    }}
                  />
                </div>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    textAlign: "center",
                    marginTop: "4px",
                  }}
                >
                  {progress}%
                </p>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              disabled={generating || !name.trim()}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: generating
                  ? "#1a1a2e"
                  : "linear-gradient(135deg,#ffca28,#ff8c00)",
                color: "#000",
                fontWeight: 800,
                fontSize: "1rem",
                cursor: "pointer",
                fontFamily: "'Cairo', sans-serif",
                opacity: generating || !name.trim() ? 0.6 : 1,
              }}
            >
              {generating ? "⏳ جاري التوليد..." : "🚀 توليد حساب الإدارة"}
            </motion.button>
          </motion.div>

          {/* السجل */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ ...glassStyle, padding: "24px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <h3
                style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700 }}
              >
                📋 سجل حسابات الإدارة ({totalLogs})
              </h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="🔍 بحث..."
                  value={logSearch}
                  onChange={(e) => {
                    setLogSearch(e.target.value);
                    setLogPage(1);
                  }}
                  style={{ ...inputStyle, width: "160px", padding: "8px" }}
                />
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleDownloadSelected}
                    style={{
                      padding: "8px 16px",
                      background: "rgba(255,202,40,0.15)",
                      border: "1px solid rgba(255,202,40,0.3)",
                      color: "#ffca28",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontFamily: "'Cairo', sans-serif",
                    }}
                  >
                    📥 ({selectedIds.size})
                  </button>
                )}
              </div>
            </div>

            {loadingLogs ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#8b949e",
                }}
              >
                ⏳ جاري التحميل...
              </div>
            ) : logs.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#8b949e",
                }}
              >
                📭 لا توجد حسابات
              </div>
            ) : (
              <>
                <button
                  onClick={toggleSelectAll}
                  style={{
                    padding: "6px 14px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8b949e",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontFamily: "'Cairo', sans-serif",
                    marginBottom: "10px",
                  }}
                >
                  {selectedIds.size === logs.length
                    ? "❌ إلغاء الكل"
                    : "✅ تحديد الكل"}
                </button>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.85rem",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <th
                          style={{
                            padding: "10px 8px",
                            color: "#8b949e",
                            textAlign: "center",
                          }}
                        >
                          #
                        </th>
                        <th
                          style={{
                            padding: "10px 8px",
                            color: "#8b949e",
                            textAlign: "right",
                          }}
                        >
                          الاسم
                        </th>
                        <th
                          style={{
                            padding: "10px 8px",
                            color: "#8b949e",
                            textAlign: "center",
                          }}
                        >
                          المستوى
                        </th>
                        <th
                          style={{
                            padding: "10px 8px",
                            color: "#8b949e",
                            textAlign: "center",
                          }}
                        >
                          الكود
                        </th>
                        <th
                          style={{
                            padding: "10px 8px",
                            color: "#8b949e",
                            textAlign: "center",
                          }}
                        >
                          البريد
                        </th>
                        <th
                          style={{
                            padding: "10px 8px",
                            color: "#8b949e",
                            textAlign: "center",
                          }}
                        >
                          التاريخ
                        </th>
                        <th
                          style={{
                            padding: "10px 8px",
                            color: "#8b949e",
                            textAlign: "center",
                          }}
                        >
                          إجراءات
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((entry, i) => (
                        <motion.tr
                          key={entry.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.03)",
                          }}
                        >
                          <td
                            style={{
                              padding: "10px",
                              textAlign: "center",
                              color: "#8b949e",
                            }}
                          >
                            {(logPage - 1) * 50 + i + 1}
                          </td>
                          <td style={{ padding: "10px", color: "#fff" }}>
                            {editingId === entry.id ? (
                              <div style={{ display: "flex", gap: "6px" }}>
                                <input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  style={{
                                    ...inputStyle,
                                    width: "120px",
                                    padding: "4px 8px",
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleEdit(entry.id)}
                                  style={{
                                    padding: "4px 8px",
                                    background: "rgba(255,202,40,0.15)",
                                    border: "none",
                                    borderRadius: "6px",
                                    color: "#ffca28",
                                    cursor: "pointer",
                                  }}
                                >
                                  حفظ
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  style={{
                                    padding: "4px 8px",
                                    background: "rgba(255,255,255,0.05)",
                                    border: "none",
                                    borderRadius: "6px",
                                    color: "#8b949e",
                                    cursor: "pointer",
                                  }}
                                >
                                  إلغاء
                                </button>
                              </div>
                            ) : (
                              entry.name
                            )}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: "6px",
                                background: "rgba(0,229,255,0.1)",
                                color: "#00e5ff",
                                fontSize: "0.75rem",
                              }}
                            >
                              {entry.level === "LEVEL_1" ? "م1" : "م2"}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              textAlign: "center",
                              fontFamily: "monospace",
                              direction: "ltr",
                              color: "#00e5ff",
                              fontSize: "0.8rem",
                            }}
                          >
                            {entry.code}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              textAlign: "center",
                              color: "#8b949e",
                              fontSize: "0.75rem",
                            }}
                          >
                            {entry.email || "—"}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              textAlign: "center",
                              color: "#8b949e",
                              fontSize: "0.75rem",
                            }}
                          >
                            {new Date(entry.createdAt).toLocaleDateString(
                              "ar-YE",
                            )}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            <div
                              style={{
                                display: "flex",
                                gap: "4px",
                                justifyContent: "center",
                              }}
                            >
                              <button
                                onClick={() => handleDownloadSingle(entry)}
                                style={{
                                  padding: "4px 8px",
                                  background: "rgba(0,229,255,0.1)",
                                  border: "none",
                                  borderRadius: "6px",
                                  color: "#00e5ff",
                                  cursor: "pointer",
                                }}
                              >
                                📥
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(entry.id);
                                  setEditName(entry.name);
                                }}
                                style={{
                                  padding: "4px 8px",
                                  background: "rgba(255,202,40,0.1)",
                                  border: "none",
                                  borderRadius: "6px",
                                  color: "#ffca28",
                                  cursor: "pointer",
                                }}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() =>
                                  handleDelete(entry.id, entry.name)
                                }
                                style={{
                                  padding: "4px 8px",
                                  background: "rgba(255,49,49,0.1)",
                                  border: "none",
                                  borderRadius: "6px",
                                  color: "#ff3131",
                                  cursor: "pointer",
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: "6px",
                      marginTop: "20px",
                    }}
                  >
                    <button
                      onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                      disabled={logPage <= 1}
                      style={{
                        padding: "8px 16px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: logPage <= 1 ? "#484f58" : "#8b949e",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      السابق
                    </button>
                    <span style={{ padding: "8px 12px", color: "#8b949e" }}>
                      {logPage} / {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setLogPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={logPage >= totalPages}
                      style={{
                        padding: "8px 16px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: logPage >= totalPages ? "#484f58" : "#8b949e",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      التالي
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </main>
      </PageTransition>

      <AnimatePresence>
        {deleteConfirm.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={() => setDeleteConfirm({ show: false, id: "", name: "" })}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                ...glassStyle,
                padding: "30px",
                maxWidth: "400px",
                width: "100%",
                textAlign: "center",
                border: "1px solid rgba(248,81,73,0.3)",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "10px" }}>⚠️</div>
              <h3 style={{ color: "#fff", marginBottom: "15px" }}>
                تأكيد الحذف
              </h3>
              <p style={{ color: "#8b949e", marginBottom: "20px" }}>
                حذف "{deleteConfirm.name}"؟
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    setDeleteConfirm({ show: false, id: "", name: "" })
                  }
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontFamily: "'Cairo', sans-serif",
                    fontWeight: 700,
                  }}
                >
                  إلغاء
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={executeDelete}
                  style={{
                    flex: 1.5,
                    padding: "12px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg,#f85149,#da3633)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontFamily: "'Cairo', sans-serif",
                    fontWeight: 800,
                  }}
                >
                  نعم، احذف
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer />
    </div>
  );
}
