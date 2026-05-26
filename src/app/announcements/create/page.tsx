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
import { csrfFetch } from "@/lib/csrfClient";
// ==================== الأنواع ====================
interface Announcement {
  id: string;
  title: string;
  description: string;
  level: string;
  publisherId: string;
  createdAt: string;
  publisher?: { id: string; name: string; role: string };
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

const EditIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const CloseIcon = () => (
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
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ==================== المكوّن الرئيسي ====================
export default function CreateAnnouncementPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userRole = user?.role || "";
  const userLevel = user?.level || "";
  const userId = user?.id || "";

  // تبويب: نشر أو سجل
  type Tab = "create" | "history";
  const [tab, setTab] = useState<Tab>("create");

  // نموذج النشر
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState(
    userRole === "MANAGEMENT" || userRole === "TEACHER" ? userLevel : "LEVEL_1",
  );
  const [submitting, setSubmitting] = useState(false);

  // السجل
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const pag = usePagination(1, 10);

  // تعديل
  const [editModal, setEditModal] = useState<Announcement | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // تأكيد حذف
  const [confirmDelete, setConfirmDelete] = useState<{
    show: boolean;
    id: string;
    title: string;
  }>({ show: false, id: "", title: "" });

  // ==================== تحميل السجل ====================
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/announcements/create?page=${pag.page}&limit=${pag.limit}`,
      );
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.data || []);
        pag.setTotal(data.total || 0);
      }
    } catch {
      /* صامت */
    } finally {
      setLoadingHistory(false);
    }
  }, [pag.page, pag.limit]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  // ==================== نشر تعميم ====================
  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      showToast("العنوان والوصف مطلوبان", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await csrfFetch("/api/announcements/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          level,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("📢 تم نشر التعميم بنجاح", "success");
        setTitle("");
        setDescription("");
      } else {
        showToast(data.message, "error");
      }
    } catch {
      showToast("فشل النشر", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== تعديل تعميم ====================
  const handleEdit = (ann: Announcement) => {
    setEditModal(ann);
    setEditTitle(ann.title);
    setEditDesc(ann.description);
  };

  const executeEdit = async () => {
    if (!editModal || !editTitle.trim()) return;
    try {
      const res = await csrfFetch("/api/announcements/create", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editModal.id,
          title: editTitle.trim(),
          description: editDesc.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ تم تعديل التعميم", "success");
        setEditModal(null);
        loadHistory();
      } else {
        showToast(data.message, "error");
      }
    } catch {
      showToast("فشل التعديل", "error");
    }
  };

  // ==================== حذف تعميم ====================
  const handleDeleteClick = (ann: Announcement) => {
    setConfirmDelete({ show: true, id: ann.id, title: ann.title });
  };

  const executeDelete = async () => {
    const id = confirmDelete.id;
    setConfirmDelete({ show: false, id: "", title: "" });
    try {
      const res = await csrfFetch("/api/announcements/create", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ تم حذف التعميم", "warning");
        loadHistory();
      } else {
        showToast(data.message, "error");
      }
    } catch {
      showToast("فشل الحذف", "error");
    }
  };

  // ==================== أدوات مساعدة ====================
  const getLevelLabel = (l: string) =>
    ({
      LEVEL_1: "المستوى الأول",
      LEVEL_2: "المستوى الثاني",
      LEVEL_3: "المستوى الثالث",
      LEVEL_4: "المستوى الرابع",
    })[l] || l;
  const getRoleLabel = (r: string) =>
    ({ ADMIN: "أدمن", MANAGEMENT: "إدارة", TEACHER: "معلم" })[r] || r;
  const getRoleColor = (r: string) =>
    ({ ADMIN: "#ff3131", MANAGEMENT: "#ffca28", TEACHER: "#bf5af2" })[r] ||
    "#8b949e";

  const glassStyle: React.CSSProperties = {
    background: "rgba(10, 20, 40, 0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0, 229, 255, 0.12)",
    borderRadius: "18px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    color: "#e6edf3",
    fontSize: "0.95rem",
    fontFamily: "'Cairo', sans-serif",
    outline: "none",
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
            maxWidth: "900px",
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
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() =>
                  router.push(
                    userRole === "ADMIN"
                      ? "/admin"
                      : userRole === "MANAGEMENT"
                        ? "/management"
                        : "/teacher",
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
              <h2
                style={{
                  color: "#00e5ff",
                  fontSize: "clamp(1.2rem, 3vw, 1.5rem)",
                  fontWeight: 800,
                  margin: 0,
                }}
              >
                📢 التعميمات
              </h2>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {[
                { key: "create", label: "✍️ نشر تعميم" },
                { key: "history", label: "📋 السجل" },
              ].map((t: any) => (
                <motion.button
                  key={t.key}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setTab(t.key as Tab)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "12px",
                    background:
                      tab === t.key
                        ? "rgba(0,229,255,0.12)"
                        : "rgba(255,255,255,0.03)",
                    border:
                      tab === t.key
                        ? "1px solid #00e5ff"
                        : "1px solid rgba(255,255,255,0.08)",
                    color: tab === t.key ? "#00e5ff" : "#8b949e",
                    cursor: "pointer",
                    fontFamily: "'Cairo', sans-serif",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                  }}
                >
                  {t.label}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* ========== تبويب النشر ========== */}
          <AnimatePresence mode="wait">
            {tab === "create" && (
              <motion.div
                key="create"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div style={{ ...glassStyle, padding: "30px" }}>
                  <h3
                    style={{
                      color: "#00e5ff",
                      fontSize: "1.2rem",
                      fontWeight: 700,
                      marginBottom: "20px",
                      textAlign: "center",
                    }}
                  >
                    ✍️ نشر تعميم جديد
                  </h3>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    style={{ marginBottom: "16px" }}
                  >
                    <label
                      style={{
                        color: "#8b949e",
                        fontSize: "0.85rem",
                        marginBottom: "6px",
                        display: "block",
                      }}
                    >
                      عنوان التعميم
                    </label>
                    <input
                      type="text"
                      placeholder="أدخل عنوان التعميم..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      style={inputStyle}
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    style={{ marginBottom: "16px" }}
                  >
                    <label
                      style={{
                        color: "#8b949e",
                        fontSize: "0.85rem",
                        marginBottom: "6px",
                        display: "block",
                      }}
                    >
                      نص التعميم
                    </label>
                    <textarea
                      placeholder="أدخل نص التعميم..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={5}
                      style={{
                        ...inputStyle,
                        resize: "vertical",
                        minHeight: "120px",
                      }}
                    />
                  </motion.div>

                  {userRole === "ADMIN" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      style={{ marginBottom: "20px" }}
                    >
                      <label
                        style={{
                          color: "#ffca28",
                          fontSize: "0.85rem",
                          marginBottom: "6px",
                          display: "block",
                        }}
                      >
                        👑 المستوى المستهدف
                      </label>
                      <select
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                        style={{
                          ...inputStyle,
                          cursor: "pointer",
                          appearance: "none",
                        }}
                      >
                        <option value="LEVEL_1">المستوى الأول</option>
                        <option value="LEVEL_2">المستوى الثاني</option>
                        <option value="LEVEL_3">المستوى الثالث</option>
                        <option value="LEVEL_4">المستوى الرابع</option>
                      </select>
                    </motion.div>
                  )}

                  {(userRole === "MANAGEMENT" || userRole === "TEACHER") && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        marginBottom: "20px",
                        padding: "12px",
                        borderRadius: "10px",
                        background: "rgba(0,229,255,0.06)",
                        border: "1px solid rgba(0,229,255,0.15)",
                        textAlign: "center",
                      }}
                    >
                      <p
                        style={{
                          color: "#8b949e",
                          fontSize: "0.85rem",
                          margin: 0,
                        }}
                      >
                        سيتم النشر تلقائياً في:{" "}
                        <span style={{ color: "#00e5ff", fontWeight: 700 }}>
                          {getLevelLabel(userLevel)}
                        </span>
                      </p>
                    </motion.div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "12px",
                      border: "none",
                      background: submitting
                        ? "rgba(255,255,255,0.1)"
                        : "linear-gradient(135deg, #238636, #2ea043)",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: "1rem",
                      cursor: "pointer",
                      fontFamily: "'Cairo', sans-serif",
                      opacity: submitting ? 0.6 : 1,
                      boxShadow: "0 8px 25px rgba(35,134,54,0.3)",
                    }}
                  >
                    {submitting ? "⏳ جاري النشر..." : "📢 نشر التعميم"}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ========== تبويب السجل ========== */}
            {tab === "history" && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {loadingHistory ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      style={{
                        width: "36px",
                        height: "36px",
                        border: "3px solid rgba(0,229,255,0.2)",
                        borderTopColor: "#00e5ff",
                        borderRadius: "50%",
                        margin: "0 auto",
                      }}
                    />
                  </div>
                ) : announcements.length === 0 ? (
                  <div
                    style={{
                      ...glassStyle,
                      padding: "50px",
                      textAlign: "center",
                      color: "#8b949e",
                    }}
                  >
                    <div style={{ fontSize: "3rem", marginBottom: "10px" }}>
                      📭
                    </div>
                    <p>لا توجد تعميمات سابقة</p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {announcements.map((ann) => (
                      <motion.div
                        key={ann.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ borderColor: "rgba(0,229,255,0.25)" }}
                        style={{
                          ...glassStyle,
                          padding: "18px 20px",
                          transition: "border-color 0.3s",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            gap: "12px",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: "200px" }}>
                            <h4
                              style={{
                                color: "#e6edf3",
                                fontWeight: 700,
                                fontSize: "1rem",
                                margin: "0 0 6px",
                              }}
                            >
                              {ann.title}
                            </h4>
                            <p
                              style={{
                                color: "#8b949e",
                                fontSize: "0.85rem",
                                margin: "0 0 8px",
                                lineHeight: 1.5,
                              }}
                            >
                              {ann.description}
                            </p>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  color: "#00e5ff",
                                  fontSize: "0.7rem",
                                  background: "rgba(0,229,255,0.1)",
                                  padding: "3px 10px",
                                  borderRadius: "10px",
                                }}
                              >
                                {getLevelLabel(ann.level)}
                              </span>
                              {ann.publisher && (
                                <span
                                  style={{
                                    color: getRoleColor(ann.publisher.role),
                                    fontSize: "0.7rem",
                                    background: "rgba(255,255,255,0.05)",
                                    padding: "3px 10px",
                                    borderRadius: "10px",
                                  }}
                                >
                                  ✍️ {ann.publisher.name} (
                                  {getRoleLabel(ann.publisher.role)})
                                </span>
                              )}
                              <span
                                style={{ color: "#5a6a7a", fontSize: "0.7rem" }}
                              >
                                {new Date(ann.createdAt).toLocaleDateString(
                                  "ar-YE",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )}
                              </span>
                            </div>
                          </div>
                          {(ann.publisherId === userId ||
                            userRole === "ADMIN") && (
                            <div style={{ display: "flex", gap: "6px" }}>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleEdit(ann)}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  background: "rgba(255,202,40,0.1)",
                                  border: "1px solid rgba(255,202,40,0.2)",
                                  color: "#ffca28",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  fontFamily: "'Cairo', sans-serif",
                                }}
                              >
                                <EditIcon /> تعديل
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDeleteClick(ann)}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  background: "rgba(248,81,73,0.1)",
                                  border: "1px solid rgba(248,81,73,0.2)",
                                  color: "#f85149",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  fontFamily: "'Cairo', sans-serif",
                                }}
                              >
                                <DeleteIcon /> حذف
                              </motion.button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    <Pagination
                      page={pag.page}
                      totalPages={pag.totalPages}
                      onPageChange={pag.goTo}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </PageTransition>
      <Footer />

      {/* ==================== نافذة تعديل ==================== */}
      <AnimatePresence>
        {editModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={() => setEditModal(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                ...glassStyle,
                padding: "30px",
                maxWidth: "500px",
                width: "100%",
                border: "1px solid rgba(255,202,40,0.3)",
                boxShadow: "0 0 60px rgba(255,202,40,0.15)",
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
                    color: "#ffca28",
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  ✏️ تعديل التعميم
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setEditModal(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8b949e",
                    cursor: "pointer",
                  }}
                >
                  <CloseIcon />
                </motion.button>
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  العنوان
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  النص
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    minHeight: "100px",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setEditModal(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  إلغاء
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={executeEdit}
                  style={{
                    flex: 2,
                    padding: "12px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #ffca28, #e3b341)",
                    border: "none",
                    color: "#010204",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  💾 حفظ التعديل
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== نافذة تأكيد الحذف ==================== */}
      <AnimatePresence>
        {confirmDelete.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={() => setConfirmDelete({ show: false, id: "", title: "" })}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                ...glassStyle,
                padding: "30px",
                maxWidth: "420px",
                width: "100%",
                textAlign: "center",
                border: "1px solid rgba(248,81,73,0.3)",
                boxShadow: "0 0 60px rgba(248,81,73,0.15)",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(248,81,73,0.15)",
                  margin: "0 auto 15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.8rem",
                }}
              >
                ⚠️
              </div>
              <h3
                style={{
                  color: "#fff",
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  marginBottom: "8px",
                }}
              >
                تأكيد الحذف
              </h3>
              <p
                style={{
                  color: "#8b949e",
                  fontSize: "0.9rem",
                  marginBottom: "25px",
                }}
              >
                هل أنت متأكد من حذف التعميم: "{confirmDelete.title}"؟
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    setConfirmDelete({ show: false, id: "", title: "" })
                  }
                  style={{
                    flex: 1,
                    padding: "13px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontFamily: "'Cairo', sans-serif",
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
                    padding: "13px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #f85149, #da3633)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontFamily: "'Cairo', sans-serif",
                    boxShadow: "0 8px 25px rgba(248,81,73,0.3)",
                  }}
                >
                  نعم، احذف
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
