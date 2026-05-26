"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

// ==================== الأنواع ====================
interface Subject {
  id: string;
  name: string;
  code: string;
}

interface AssignmentItem {
  id: string;
  status: string;
  grade?: number;
  feedback?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  createdAt: string;
  evaluatedAt?: string;
  subject: { id: string; name: string; code: string };
}

// ==================== الأيقونات SVG ====================
const UploadIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const EyeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const DeleteIcon = () => (
  <svg
    width="16"
    height="16"
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

const ChevronDown = () => (
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
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ==================== المكوّن الرئيسي ====================
export default function StudentDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userId = user?.id || "";
  const userName = user?.name || "";
  const userLevel = user?.level || "";

  useSupabaseRealtime(`user-${userId}`, "assignment-update", (data: any) => {
    loadAssignments();
    if (data.grade !== undefined) {
      showToast(`✅ تم تقييم ${data.subjectName}: ${data.grade}`, "success");
    }
  });
  // التبويبات
  type Tab = "upload" | "assignments" | "grades";
  const [activeTab, setActiveTab] = useState<Tab>("upload");

  // البيانات
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [grades, setGrades] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // الإحصائيات
  const [stats, setStats] = useState({ total: 0, evaluated: 0, subjects: 0 });

  // الترقيم
  const assignPag = usePagination(1, 20);
  const gradesPag = usePagination(1, 20);

  // Wheel Picker
  const [wheelOpen, setWheelOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedSubjectName, setSelectedSubjectName] = useState("");
  const [wheelScroll, setWheelScroll] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  // رفع الملف
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==================== تحميل المواد ====================
  useEffect(() => {
    fetch(`/api/subjects/active?level=${userLevel}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setSubjects(res.data);
          setStats((prev) => ({ ...prev, subjects: res.data.length }));
        }
      })
      .catch(() => {});
  }, [userLevel]);

  // ==================== تحميل التكاليف ====================
  const loadAssignments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/assignments/list?page=${assignPag.page}&limit=${assignPag.limit}`,
      );
      const data = await res.json();
      if (data.success) {
        setAssignments(data.data);
        assignPag.setTotal(data.total || 0);
        const ev = (data.data || []).filter(
          (a: AssignmentItem) => a.status === "evaluated",
        ).length;
        setStats({
          total: data.total || 0,
          evaluated: ev,
          subjects: subjects.length,
        });
      }
    } catch {
      /* صامت */
    }
  }, [assignPag.page, assignPag.limit, subjects.length]);

  // ==================== تحميل الدرجات ====================
  const loadGrades = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/grades/list?page=${gradesPag.page}&limit=${gradesPag.limit}`,
        { credentials: "include" },
      );
      const data = await res.json();
      if (data.success) setGrades(data.data);
      gradesPag.setTotal(data.total || 0);
    } catch {
      /* صامت */
    }
  }, [gradesPag.page, gradesPag.limit]);

  useEffect(() => {
    setLoading(true);
    loadAssignments().finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (activeTab === "assignments") loadAssignments();
  }, [activeTab, assignPag.page]);
  useEffect(() => {
    if (activeTab === "grades") loadGrades();
  }, [activeTab, gradesPag.page]);

  // ==================== رفع التكليف ====================
  const handleUpload = async () => {
    if (!selectedFile || !selectedSubject) {
      showToast("يرجى اختيار المادة والملف", "warning");
      return;
    }
    setUploading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 12, 90));
    }, 400);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("subjectId", selectedSubject);
      const res = await csrfFetch("/api/assignments/upload", {
        method: "POST",
        body: fd,
      });
      clearInterval(progressInterval);
      setUploadProgress(100);
      const data = await res.json();
      if (data.success) {
        showToast("✅ تم رفع التكليف بنجاح", "success");
        setSelectedFile(null);
        setSelectedSubject("");
        setSelectedSubjectName("");
        loadAssignments();
      } else {
        showToast(data.message || "فشل الرفع", "error");
      }
    } catch {
      showToast("حدث خطأ في الرفع", "error");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  // ==================== حذف تكليف ====================
  const [confirmDelete, setConfirmDelete] = useState<{
    show: boolean;
    id: string;
  }>({ show: false, id: "" });

  const handleDeleteClick = (id: string) => {
    setConfirmDelete({ show: true, id });
  };

  const executeDelete = async () => {
    const id = confirmDelete.id;
    setConfirmDelete({ show: false, id: "" });
    try {
      const res = await csrfFetch("/api/assignments/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ تم حذف التكليف بنجاح", "warning");
        loadAssignments();
      } else {
        showToast(data.message || "فشل الحذف", "error");
      }
    } catch {
      showToast("فشل الاتصال", "error");
    }
  };

  // ==================== تسجيل الخروج ====================
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // ==================== Wheel Picker ====================
  const openWheel = () => {
    if (subjects.length === 0) {
      showToast("لا توجد مواد متاحة", "warning");
      return;
    }
    setWheelOpen(true);
  };

  const selectWheelItem = (subject: Subject) => {
    setSelectedSubject(subject.id);
    setSelectedSubjectName(subject.name);
    setWheelOpen(false);
    showToast(`📘 تم اختيار: ${subject.name}`, "info");
  };

  // ==================== أدوات مساعدة ====================
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-YE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const getLevelLabel = (l: string) =>
    ({
      LEVEL_1: "المستوى الأول",
      LEVEL_2: "المستوى الثاني",
      LEVEL_3: "المستوى الثالث",
      LEVEL_4: "المستوى الرابع",
    })[l] || l;
  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // ==================== التنسيقات ====================
  const glassStyle: React.CSSProperties = {
    background: "rgba(10, 20, 40, 0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0, 229, 255, 0.15)",
    borderRadius: "20px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    background: "rgba(0, 0, 0, 0.5)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "12px",
    color: "#e6edf3",
    fontSize: "0.95rem",
    fontFamily: "'Cairo', sans-serif",
    outline: "none",
  };

  // ==================== الواجهة ====================
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
            maxWidth: "1200px",
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
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: "rgba(0,229,255,0.2)",
                  border: "2px solid #00e5ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  color: "#00e5ff",
                }}
              >
                {userName.charAt(0)}
              </div>
              <div>
                <h2
                  style={{
                    color: "#00e5ff",
                    fontSize: "clamp(1.1rem, 3vw, 1.5rem)",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  🎓 مرحباً، {userName}
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  طالب - {getLevelLabel(userLevel)}
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

          {/* ========== اختصارات سريعة ========== */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
              gap: "10px",
              marginBottom: "25px",
            }}
          >
            {[
              {
                label: "الإشعارات",
                icon: "🔔",
                path: "/notifications",
                color: "#ffca28",
              },
              {
                label: "المكتبة",
                icon: "📚",
                path: "/library",
                color: "#00e5ff",
              },
              {
                label: "المحادثة",
                icon: "💬",
                path: "/chat",
                color: "#39ff14",
              },
              {
                label: "الإعدادات",
                icon: "⚙️",
                path: "/settings",
                color: "#8b949e",
              },
            ].map((shortcut) => (
              <motion.button
                key={shortcut.path}
                whileHover={{
                  scale: 1.04,
                  y: -3,
                  boxShadow: `0 10px 30px ${shortcut.color}22`,
                }}
                whileTap={{ scale: 0.96 }}
                onClick={() => router.push(shortcut.path)}
                style={{
                  ...glassStyle,
                  padding: "16px 8px",
                  textAlign: "center",
                  cursor: "pointer",
                  border: `1px solid ${shortcut.color}22`,
                  transition: "all 0.3s",
                }}
              >
                <div style={{ fontSize: "1.6rem", marginBottom: "4px" }}>
                  {shortcut.icon}
                </div>
                <div
                  style={{
                    color: "#e6edf3",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                  }}
                >
                  {shortcut.label}
                </div>
              </motion.button>
            ))}
          </motion.div>

          {/* ========== بطاقات إحصائية ========== */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "15px",
              marginBottom: "25px",
            }}
          >
            {[
              {
                label: "تكاليفي",
                value: stats.total,
                icon: "📤",
                color: "#00e5ff",
              },
              {
                label: "تم تقييمها",
                value: stats.evaluated,
                icon: "✅",
                color: "#2ea043",
              },
              {
                label: "المواد",
                value: stats.subjects,
                icon: "📚",
                color: "#bf5af2",
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.03, y: -3 }}
                style={{ ...glassStyle, padding: "22px", textAlign: "center" }}
              >
                <div style={{ fontSize: "2.2rem", marginBottom: "6px" }}>
                  {stat.icon}
                </div>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: 800,
                    color: stat.color,
                  }}
                >
                  {loading ? "..." : stat.value}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#8b949e" }}>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* ========== التبويبات ========== */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            {[
              { key: "upload", label: "📤 رفع تكليف" },
              { key: "assignments", label: "📋 تكاليفي" },
              { key: "grades", label: "📊 درجاتي" },
            ].map((tab: any) => (
              <motion.button
                key={tab.key}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(tab.key as Tab)}
                style={{
                  padding: "12px 22px",
                  borderRadius: "14px",
                  border:
                    activeTab === tab.key
                      ? "1px solid #00e5ff"
                      : "1px solid rgba(255,255,255,0.1)",
                  background:
                    activeTab === tab.key
                      ? "rgba(0,229,255,0.12)"
                      : "rgba(255,255,255,0.03)",
                  color: activeTab === tab.key ? "#00e5ff" : "#8b949e",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontWeight: activeTab === tab.key ? 700 : 400,
                  fontSize: "0.9rem",
                }}
              >
                {tab.label}
              </motion.button>
            ))}
          </div>

          {/* ========== محتوى التبويبات ========== */}
          <AnimatePresence mode="wait">
            {/* ===== رفع تكليف ===== */}
            {activeTab === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div
                  style={{
                    ...glassStyle,
                    padding: "30px",
                    maxWidth: "600px",
                    margin: "0 auto",
                  }}
                >
                  <h3
                    style={{
                      color: "#00e5ff",
                      fontSize: "1.3rem",
                      fontWeight: 700,
                      marginBottom: "24px",
                      textAlign: "center",
                    }}
                  >
                    📤 رفع تكليف جديد
                  </h3>

                  {/* Wheel Picker - اختيار المادة */}
                  <div style={{ marginBottom: "20px" }}>
                    <label
                      style={{
                        display: "block",
                        color: "#8b949e",
                        marginBottom: "8px",
                        textAlign: "center",
                      }}
                    >
                      اختر المادة الدراسية
                    </label>
                    <motion.div
                      whileHover={{ borderColor: "rgba(0,229,255,0.5)" }}
                      onClick={openWheel}
                      style={{
                        ...inputStyle,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        border: selectedSubject
                          ? "1px solid #00e5ff"
                          : "1px solid rgba(255,255,255,0.1)",
                        background: selectedSubject
                          ? "rgba(0,229,255,0.06)"
                          : "rgba(0,0,0,0.5)",
                      }}
                    >
                      <span
                        style={{
                          color: selectedSubject ? "#00e5ff" : "#8b949e",
                        }}
                      >
                        {selectedSubjectName || "-- اختر المادة --"}
                      </span>
                      <motion.span
                        animate={{ rotate: wheelOpen ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <ChevronDown />
                      </motion.span>
                    </motion.div>
                  </div>
                  <div
                    style={{
                      marginBottom: "12px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(255,202,40,0.08)",
                      border: "1px solid rgba(255,202,40,0.2)",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        color: "#ffca28",
                        fontSize: "0.8rem",
                        margin: 0,
                        fontWeight: 600,
                      }}
                    >
                      ⚠️ قبل رفع التكليف، قم بتسمية ملف التكليف باسمك
                    </p>
                  </div>

                  {/* رفع الملف */}
                  <div style={{ marginBottom: "20px" }}>
                    <label
                      style={{
                        display: "block",
                        color: "#8b949e",
                        marginBottom: "8px",
                        textAlign: "center",
                      }}
                    >
                      اختر ملف التكليف
                    </label>
                    <motion.div
                      whileHover={{ borderColor: "rgba(0,229,255,0.4)" }}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        ...inputStyle,
                        border: "2px dashed rgba(255,255,255,0.15)",
                        padding: "25px",
                        textAlign: "center",
                        cursor: "pointer",
                        color: "#8b949e",
                      }}
                    >
                      {selectedFile ? (
                        <span style={{ color: "#00e5ff" }}>
                          📎 {selectedFile.name} (
                          {formatSize(selectedFile.size)})
                        </span>
                      ) : (
                        <span>اسحب وأفلت الملف هنا أو انقر للاختيار</span>
                      )}
                    </motion.div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.mp3,.wav"
                      style={{ display: "none" }}
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] || null)
                      }
                    />
                    {selectedFile && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedFile(null)}
                        style={{
                          marginTop: "8px",
                          padding: "6px 14px",
                          borderRadius: "8px",
                          background: "rgba(248,81,73,0.1)",
                          border: "1px solid rgba(248,81,73,0.2)",
                          color: "#f85149",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                        }}
                      >
                        إزالة الملف
                      </motion.button>
                    )}
                  </div>

                  {/* شريط التقدم */}
                  {uploading && (
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
                          animate={{ width: `${uploadProgress}%` }}
                          style={{
                            height: "100%",
                            background:
                              "linear-gradient(90deg, #00e5ff, #39ff14)",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                      <p
                        style={{
                          color: "#8b949e",
                          fontSize: "0.8rem",
                          textAlign: "center",
                          marginTop: "6px",
                        }}
                      >
                        {uploadProgress}% - جاري فحص الفيروسات...
                      </p>
                    </motion.div>
                  )}

                  {/* زر الرفع */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUpload}
                    disabled={uploading}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "12px",
                      border: "none",
                      background: "linear-gradient(135deg, #00e5ff, #007bff)",
                      color: "#010204",
                      fontWeight: 800,
                      fontSize: "1rem",
                      cursor: "pointer",
                      fontFamily: "'Cairo', sans-serif",
                      opacity: uploading ? 0.6 : 1,
                      boxShadow: "0 8px 30px rgba(0,229,255,0.25)",
                    }}
                  >
                    {uploading ? "⏳ جاري الرفع والفحص..." : "🚀 رفع التكليف"}
                  </motion.button>

                  <p
                    style={{
                      color: "#5a6a7a",
                      fontSize: "0.75rem",
                      textAlign: "center",
                      marginTop: "12px",
                    }}
                  >
                    الحد الأقصى: 20MB | يتم فحص الملف من الفيروسات تلقائياً
                  </p>
                </div>
              </motion.div>
            )}

            {/* ===== تكاليفي ===== */}
            {activeTab === "assignments" && (
              <motion.div
                key="assignments"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {loading ? (
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
                        duration: 1.5,
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
                  </div>
                ) : assignments.length === 0 ? (
                  <div
                    style={{
                      ...glassStyle,
                      padding: "50px 20px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "3rem", marginBottom: "10px" }}>
                      📭
                    </div>
                    <p style={{ color: "#8b949e", fontSize: "1.1rem" }}>
                      لا توجد تكاليف بعد
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
                    {assignments.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ borderColor: "rgba(0,229,255,0.3)" }}
                        style={{
                          ...glassStyle,
                          padding: "18px",
                          transition: "border-color 0.3s",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "12px",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: "180px" }}>
                            <div
                              style={{
                                fontWeight: 700,
                                color: "#e6edf3",
                                fontSize: "1rem",
                                marginBottom: "4px",
                              }}
                            >
                              {item.subject.name} ({item.subject.code})
                            </div>
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
                                  padding: "3px 10px",
                                  borderRadius: "20px",
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  background:
                                    item.status === "evaluated"
                                      ? "rgba(46,160,67,0.15)"
                                      : "rgba(255,202,40,0.15)",
                                  color:
                                    item.status === "evaluated"
                                      ? "#2ea043"
                                      : "#ffca28",
                                }}
                              >
                                {item.status === "evaluated"
                                  ? "✅ تم التقييم"
                                  : "⏳ قيد الانتظار"}
                              </span>
                              {item.fileSize && (
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    color: "#8b949e",
                                  }}
                                >
                                  {formatSize(item.fileSize)}
                                </span>
                              )}
                              <span
                                style={{ fontSize: "0.7rem", color: "#8b949e" }}
                              >
                                {formatDate(item.createdAt)}
                              </span>
                            </div>
                            {item.grade !== undefined &&
                              item.grade !== null && (
                                <div
                                  style={{
                                    marginTop: "6px",
                                    fontWeight: 700,
                                    color:
                                      item.grade >= 50 ? "#2ea043" : "#f85149",
                                  }}
                                >
                                  الدرجة: {item.grade}/100
                                </div>
                              )}
                            {item.feedback && (
                              <div
                                style={{
                                  marginTop: "4px",
                                  fontSize: "0.8rem",
                                  color: "#8b949e",
                                }}
                              >
                                💬 {item.feedback}
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              alignItems: "center",
                            }}
                          >
                            {item.fileUrl && (
                              <motion.a
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                href={item.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: "10px",
                                  textDecoration: "none",
                                  background: "rgba(0,229,255,0.08)",
                                  border: "1px solid rgba(0,229,255,0.2)",
                                  color: "#00e5ff",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.8rem",
                                }}
                              >
                                <EyeIcon /> فتح
                              </motion.a>
                            )}
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDeleteClick(item.id)}
                              style={{
                                padding: "8px 12px",
                                borderRadius: "10px",
                                background: "rgba(248,81,73,0.1)",
                                border: "1px solid rgba(248,81,73,0.2)",
                                color: "#f85149",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "0.8rem",
                              }}
                            >
                              <DeleteIcon />
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    <Pagination
                      page={assignPag.page}
                      totalPages={assignPag.totalPages}
                      onPageChange={assignPag.goTo}
                    />
                  </div>
                )}
              </motion.div>
            )}

            {/* ===== درجاتي ===== */}
            {activeTab === "grades" && (
              <motion.div
                key="grades"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {grades.length === 0 ? (
                  <div
                    style={{
                      ...glassStyle,
                      padding: "50px 20px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "3rem", marginBottom: "10px" }}>
                      📭
                    </div>
                    <p style={{ color: "#8b949e", fontSize: "1.1rem" }}>
                      لا توجد درجات بعد
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
                    {grades.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ borderColor: "rgba(0,229,255,0.3)" }}
                        style={{
                          ...glassStyle,
                          padding: "18px",
                          transition: "border-color 0.3s",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "12px",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: "150px" }}>
                            <div
                              style={{
                                fontWeight: 700,
                                color: "#e6edf3",
                                fontSize: "1rem",
                              }}
                            >
                              {item.subject?.name ||
                                (item as any).subjectName ||
                                ""}
                            </div>
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "#8b949e",
                                marginTop: "2px",
                              }}
                            >
                              {formatDate(
                                (item as any).evaluatedAt || item.createdAt,
                              )}
                            </div>
                          </div>
                          <div
                            style={{
                              textAlign: "center",
                              padding: "8px 18px",
                              borderRadius: "10px",
                              background:
                                (item.grade ?? 0) >= 80
                                  ? "rgba(46,160,67,0.15)"
                                  : (item.grade ?? 0) >= 50
                                    ? "rgba(255,202,40,0.15)"
                                    : "rgba(248,81,73,0.15)",
                              border: `1px solid ${(item.grade ?? 0) >= 80 ? "rgba(46,160,67,0.3)" : (item.grade ?? 0) >= 50 ? "rgba(255,202,40,0.3)" : "rgba(248,81,73,0.3)"}`,
                            }}
                          >
                            <div
                              style={{
                                fontSize: "1.4rem",
                                fontWeight: 800,
                                color:
                                  (item.grade ?? 0) >= 80
                                    ? "#2ea043"
                                    : (item.grade ?? 0) >= 50
                                      ? "#ffca28"
                                      : "#f85149",
                              }}
                            >
                              {item.grade ?? "—"}
                            </div>
                            <div
                              style={{ fontSize: "0.7rem", color: "#8b949e" }}
                            >
                              /100
                            </div>
                          </div>
                        </div>
                        {item.feedback && (
                          <div
                            style={{
                              marginTop: "8px",
                              padding: "8px",
                              background: "rgba(255,255,255,0.03)",
                              borderRadius: "8px",
                              color: "#8b949e",
                              fontSize: "0.85rem",
                            }}
                          >
                            💬 {item.feedback}
                          </div>
                        )}
                      </motion.div>
                    ))}
                    <Pagination
                      page={gradesPag.page}
                      totalPages={gradesPag.totalPages}
                      onPageChange={gradesPag.goTo}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </PageTransition>

      {/* ==================== نافذة تأكيد حذف التكليف ==================== */}
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
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={() => setConfirmDelete({ show: false, id: "" })}
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
                هل أنت متأكد من حذف هذا التكليف؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setConfirmDelete({ show: false, id: "" })}
                  style={{
                    flex: 1,
                    padding: "13px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.95rem",
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
                    fontSize: "0.95rem",
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
      <Footer />

      {/* ==================== نافذة Wheel Picker ==================== */}
      <AnimatePresence>
        {wheelOpen && (
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
            onClick={() => setWheelOpen(false)}
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
                maxHeight: "70vh",
                overflowY: "auto",
                boxShadow: "0 0 80px rgba(0,229,255,0.2)",
              }}
            >
              <h3
                style={{
                  color: "#00e5ff",
                  fontSize: "1.3rem",
                  fontWeight: 800,
                  textAlign: "center",
                  marginBottom: "20px",
                }}
              >
                🎯 اختر المادة الدراسية
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {subjects.map((subject, i) => (
                  <motion.button
                    key={subject.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{
                      scale: 1.02,
                      background: "rgba(0,229,255,0.12)",
                      borderColor: "#00e5ff",
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => selectWheelItem(subject)}
                    style={{
                      width: "100%",
                      padding: "16px",
                      borderRadius: "14px",
                      background:
                        selectedSubject === subject.id
                          ? "rgba(0,229,255,0.12)"
                          : "rgba(255,255,255,0.03)",
                      border:
                        selectedSubject === subject.id
                          ? "1px solid #00e5ff"
                          : "1px solid rgba(255,255,255,0.08)",
                      color:
                        selectedSubject === subject.id ? "#00e5ff" : "#e6edf3",
                      cursor: "pointer",
                      fontFamily: "'Cairo', sans-serif",
                      fontWeight: 600,
                      fontSize: "1rem",
                      textAlign: "center",
                      transition: "all 0.2s",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem", marginLeft: "8px" }}>
                      📘
                    </span>
                    {subject.name}
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        color: "#8b949e",
                        marginTop: "4px",
                      }}
                    >
                      {subject.code}
                    </span>
                  </motion.button>
                ))}
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setWheelOpen(false)}
                style={{
                  width: "100%",
                  marginTop: "15px",
                  padding: "12px",
                  borderRadius: "12px",
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
