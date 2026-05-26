"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import { useAuthStore } from "@/store/authStore";
import { csrfFetch } from "@/lib/csrfClient";
interface TeacherSubject {
  id: string;
  name: string;
  code: string;
}
interface DistributionRecord {
  id: string;
  fileName: string;
  fileUrl: string;
  subjectName: string;
  studentsCount: number;
  createdAt: string;
}

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
const UploadIcon = () => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const AnalysisIcon = () => (
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
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
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

export default function TeacherGradesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();
  const userName = user?.name || "";
  const userId = user?.id || "";
  const userLevel = user?.level || "";

  const [mySubject, setMySubject] = useState<TeacherSubject | null>(null);
  const [distributions, setDistributions] = useState<DistributionRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    id: string;
  }>({ show: false, id: "" });

  // النشر اليدوي
  const [manualModal, setManualModal] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualResults, setManualResults] = useState<
    { id: string; name: string }[]
  >([]);
  const [manualList, setManualList] = useState<
    { id: string; name: string; grade: string; feedback: string }[]
  >([]);
  const [manualPublishType, setManualPublishType] = useState("");
  const [manualPublishing, setManualPublishing] = useState(false);

  useEffect(() => {
    if (!userId || !userLevel) return;
    fetch(`/api/subjects/active?level=${userLevel}&teacherId=${userId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.length) setMySubject(res.data[0]);
      })
      .catch(() => {});
  }, [userId, userLevel]);

  const loadDistributions = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/grades/list?limit=50");
      const data = await res.json();
      if (data.success) setDistributions(data.data || []);
    } catch {
    } finally {
      setLoadingHistory(false);
    }
  }, []);
  useEffect(() => {
    loadDistributions();
  }, [loadDistributions]);

  const handleUpload = async (directFile?: File) => {
    const fileToUpload = directFile || file;
    if (!fileToUpload) {
      showToast("يرجى اختيار ملف", "warning");
      return;
    }
    if (!mySubject) {
      showToast("لم يتم التعرف على المادة", "error");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", fileToUpload);
      fd.append("subjectId", mySubject.id);
      const res = await csrfFetch("/api/grades/analyze", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ تم رفع الملف وبدء التحليل", "success");
        setFile(null);
        loadDistributions();
        router.push("/teacher/grades/analysis");
      } else showToast(data.message || "فشل", "error");
    } catch {
      showToast("فشل الرفع", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ show: true, id });
  };
  const executeDelete = async () => {
    const id = deleteConfirm.id;
    setDeleteConfirm({ show: false, id: "" });
    try {
      const res = await csrfFetch("/api/grades/list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ تم الحذف", "warning");
        loadDistributions();
      } else showToast(data.message || "فشل", "error");
    } catch {
      showToast("فشل", "error");
    }
  };

  // النشر اليدوي
  const searchManualStudent = async () => {
    if (!manualSearch.trim()) return;
    try {
      const params = new URLSearchParams();
      params.set("search", manualSearch.trim());
      if (userLevel) params.set("level", userLevel);
      params.set("role", "STUDENT");
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (data.success) setManualResults(data.data || []);
    } catch {}
  };
  const addManualStudent = (student: { id: string; name: string }) => {
    if (manualList.find((s) => s.id === student.id)) {
      showToast("الطالب مضاف مسبقاً", "warning");
      return;
    }
    setManualList([
      ...manualList,
      { id: student.id, name: student.name, grade: "", feedback: "" },
    ]);
    setManualSearch("");
    setManualResults([]);
  };
  const updateManualStudent = (index: number, field: string, value: string) => {
    const updated = [...manualList];
    (updated[index] as any)[field] = value;
    setManualList(updated);
  };
  const removeManualStudent = (index: number) => {
    setManualList(manualList.filter((_, i) => i !== index));
  };
  const handleManualPublish = async () => {
    if (!manualPublishType.trim()) {
      showToast("يرجى إدخال نوع التقييم", "warning");
      return;
    }
    const hasData = manualList.some((s) => s.grade.trim() || s.feedback.trim());
    if (!hasData) {
      showToast("يجب إدخال درجة أو ملاحظة لكل طالب", "warning");
      return;
    }
    setManualPublishing(true);
    try {
      const res = await csrfFetch("/api/grades/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualStudents: manualList,
          publishType: manualPublishType.trim(),
          subjectId: mySubject?.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("📊 تم النشر", "success");
        setManualModal(false);
        setManualList([]);
      } else showToast(data.message, "error");
    } catch {
      showToast("فشل", "error");
    } finally {
      setManualPublishing(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-YE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const glassStyle: React.CSSProperties = {
    background: "rgba(10,20,40,0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0,229,255,0.12)",
    borderRadius: "18px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#e6edf3",
    fontSize: "0.9rem",
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
            maxWidth: "1200px",
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
                onClick={() => router.push("/teacher")}
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
                    color: "#00e5ff",
                    fontSize: "clamp(1.2rem,3vw,1.5rem)",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  📊 تصدير وتوزيع الدرجات
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  {userName}
                  {mySubject && (
                    <span style={{ color: "#00e5ff" }}>
                      {" "}
                      • {mySubject.name} ({mySubject.code})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setManualModal(true)}
                style={{
                  padding: "12px 20px",
                  borderRadius: "14px",
                  background: "rgba(191,90,242,0.1)",
                  border: "1px solid rgba(191,90,242,0.3)",
                  color: "#bf5af2",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontSize: "0.9rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                ✍️ نشر يدوي
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/teacher/grades/analysis")}
                style={{
                  padding: "12px 20px",
                  borderRadius: "14px",
                  background: "rgba(255,202,40,0.1)",
                  border: "1px solid rgba(255,202,40,0.3)",
                  color: "#ffca28",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontSize: "0.9rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AnalysisIcon /> عمليات التحليل
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: "12px 24px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg,#00e5ff,#0077b6)",
                  border: "none",
                  color: "#010204",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontSize: "0.95rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 8px 25px rgba(0,229,255,0.25)",
                }}
              >
                <UploadIcon /> رفع ملف
              </motion.button>
              <p
                style={{
                  width: "100%",
                  textAlign: "center",
                  color: "#ffca28",
                  fontSize: "0.75rem",
                  marginTop: "8px",
                }}
              >
                ⚠️ للحصول على أفضل نتائج التحليل، يرجى رفع ملف Excel (.xlsx)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.pdf,.docx,.png,.jpg,.jpeg,.txt,.csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  handleUpload(f);
                }
              }}
            />
          </motion.div>

          {mySubject && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                ...glassStyle,
                padding: "14px 20px",
                marginBottom: "20px",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "#8b949e", fontSize: "0.85rem" }}>
                المادة:
              </span>
              <span
                style={{ color: "#00e5ff", fontWeight: 700, fontSize: "1rem" }}
              >
                📘 {mySubject.name} ({mySubject.code})
              </span>
            </motion.div>
          )}

          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: "#8b949e", fontSize: "1rem", marginBottom: "15px" }}
          >
            📋 سجل عمليات النشر
          </motion.h3>
          {loadingHistory ? (
            <div style={{ textAlign: "center", padding: "30px" }}>
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
          ) : distributions.length === 0 ? (
            <div
              style={{
                ...glassStyle,
                padding: "40px",
                textAlign: "center",
                color: "#8b949e",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "10px" }}>📭</div>
              <p>لا توجد عمليات نشر سابقة</p>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {distributions.map((d) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ borderColor: "rgba(0,229,255,0.25)" }}
                  style={{
                    ...glassStyle,
                    padding: "16px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    <p
                      style={{
                        color: "#e6edf3",
                        fontWeight: 700,
                        margin: "0 0 4px",
                      }}
                    >
                      {d.subjectName} - {d.fileName}
                    </p>
                    <p
                      style={{
                        color: "#8b949e",
                        fontSize: "0.75rem",
                        margin: 0,
                      }}
                    >
                      {d.studentsCount} طالب • {formatDate(d.createdAt)}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "8px 14px",
                        borderRadius: "10px",
                        background: "rgba(0,229,255,0.08)",
                        border: "1px solid rgba(0,229,255,0.2)",
                        color: "#00e5ff",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textDecoration: "none",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      📥 تحميل
                    </a>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDelete(d.id)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "10px",
                        background: "rgba(248,81,73,0.1)",
                        border: "1px solid rgba(248,81,73,0.2)",
                        color: "#f85149",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      🗑️ حذف
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>

        {deleteConfirm.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
            onClick={() => setDeleteConfirm({ show: false, id: "" })}
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
              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDeleteConfirm({ show: false, id: "" })}
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
      </PageTransition>

      <AnimatePresence>
        {manualModal && (
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
            onClick={() => setManualModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                ...glassStyle,
                padding: "25px",
                maxWidth: "600px",
                width: "100%",
                maxHeight: "85vh",
                overflowY: "auto",
              }}
            >
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
                    color: "#bf5af2",
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  ✍️ النشر اليدوي للدرجات
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setManualModal(false)}
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
              <div
                style={{ display: "flex", gap: "8px", marginBottom: "15px" }}
              >
                <input
                  type="text"
                  placeholder="🔍 اسم الطالب..."
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchManualStudent()}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={searchManualStudent}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg,#bf5af2,#7a00ff)",
                    border: "none",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  بحث
                </motion.button>
              </div>
              {manualResults.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    marginBottom: "15px",
                    maxHeight: "150px",
                    overflowY: "auto",
                  }}
                >
                  {manualResults.map((st) => (
                    <motion.button
                      key={st.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => addManualStudent(st)}
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "#e6edf3",
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                        textAlign: "right",
                        fontSize: "0.85rem",
                      }}
                    >
                      {st.name}
                    </motion.button>
                  ))}
                </div>
              )}
              {manualList.length > 0 && (
                <div style={{ marginBottom: "15px" }}>
                  <p
                    style={{
                      color: "#8b949e",
                      fontSize: "0.8rem",
                      marginBottom: "8px",
                    }}
                  >
                    {manualList.length} طالب مضاف
                  </p>
                  {manualList.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                        marginBottom: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          color: "#e6edf3",
                          fontSize: "0.8rem",
                          flex: 1,
                          minWidth: "100px",
                        }}
                      >
                        {s.name}
                      </span>
                      <input
                        type="text"
                        placeholder="درجة"
                        value={s.grade}
                        onChange={(e) =>
                          updateManualStudent(i, "grade", e.target.value)
                        }
                        style={{
                          ...inputStyle,
                          width: "65px",
                          textAlign: "center",
                        }}
                      />
                      <input
                        type="text"
                        placeholder="ملاحظة"
                        value={s.feedback}
                        onChange={(e) =>
                          updateManualStudent(i, "feedback", e.target.value)
                        }
                        style={{
                          ...inputStyle,
                          flex: 1,
                          minWidth: "80px",
                          textAlign: "center",
                        }}
                      />
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeManualStudent(i)}
                        style={{
                          color: "#f85149",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        ✕
                      </motion.button>
                    </div>
                  ))}
                </div>
              )}
              {manualList.length > 0 && (
                <>
                  <div
                    style={{
                      marginBottom: "15px",
                      padding: "10px",
                      borderRadius: "10px",
                      background: "rgba(0,229,255,0.06)",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        color: "#8b949e",
                        fontSize: "0.75rem",
                        margin: 0,
                      }}
                    >
                      📢 رسالة النشر:{" "}
                      <span style={{ color: "#00e5ff" }}>
                        قام معلم {mySubject?.name || "المادة"} برفع درجاتك في:
                      </span>
                    </p>
                  </div>
                  <input
                    type="text"
                    placeholder="مثال: الاختبار الشهري"
                    value={manualPublishType}
                    onChange={(e) => setManualPublishType(e.target.value)}
                    style={{
                      ...inputStyle,
                      textAlign: "center",
                      marginBottom: "15px",
                      padding: "10px",
                    }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManualPublish}
                    disabled={manualPublishing}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg,#238636,#2ea043)",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      cursor: "pointer",
                      fontFamily: "'Cairo', sans-serif",
                      opacity: manualPublishing ? 0.6 : 1,
                    }}
                  >
                    {manualPublishing ? "⏳..." : "📢 نشر الدرجات"}
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer />
    </div>
  );
}
