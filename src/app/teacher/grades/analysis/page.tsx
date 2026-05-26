"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import { useAuthStore } from "@/store/authStore";
import { csrfFetch } from "@/lib/csrfClient";
interface AnalysisRecord {
  id: string;
  fileName: string;
  fileUrl: string;
  subjectName: string;
  studentsCount: number;
  status: "processing" | "completed" | "failed";
  errorMessage?: string;
  extractedCount?: number;
  matchedCount?: number;
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

const EyeIcon = () => (
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

export default function AnalysisListPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();
  const userName = user?.name || "";
  const userId = user?.id || "";

  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/grades/list?limit=50");
      const data = await res.json();
      if (data.success) {
        const mapped: AnalysisRecord[] = (data.data || []).map((d: any) => ({
          id: d.id,
          fileName: d.fileName,
          fileUrl: d.fileUrl,
          subjectName: d.subjectName,
          studentsCount: d.studentsCount,
          status: d.distributionData?.publishedAt ? "completed" : "processing",
          extractedCount: d.distributionData?.extracted?.length || 0,
          matchedCount: d.distributionData?.matched?.length || 0,
          createdAt: d.createdAt,
        }));
        setRecords(mapped);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    id: string;
  }>({ show: false, id: "" });

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
        loadRecords();
      } else showToast(data.message || "فشل", "error");
    } catch {
      showToast("فشل", "error");
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-YE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const glassStyle: React.CSSProperties = {
    background: "rgba(10,20,40,0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0,229,255,0.12)",
    borderRadius: "18px",
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
                onClick={() => router.push("/teacher/grades")}
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
                  🔬 عمليات التحليل والاستخراج
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  {userName}
                </p>
              </div>
            </div>
          </motion.div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "50px" }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{
                  width: "40px",
                  height: "40px",
                  border: "3px solid rgba(0,229,255,0.2)",
                  borderTopColor: "#00e5ff",
                  borderRadius: "50%",
                  margin: "0 auto",
                }}
              />
            </div>
          ) : records.length === 0 ? (
            <div
              style={{
                ...glassStyle,
                padding: "50px",
                textAlign: "center",
                color: "#8b949e",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "10px" }}>📭</div>
              <p>لا توجد عمليات تحليل</p>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              <AnimatePresence mode="popLayout">
                {records.map((rec) => (
                  <motion.div
                    key={rec.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    whileHover={{ borderColor: "rgba(255,202,40,0.3)" }}
                    style={{
                      ...glassStyle,
                      padding: "18px 20px",
                      border: `1px solid ${rec.status === "completed" ? "rgba(46,160,67,0.2)" : rec.status === "failed" ? "rgba(248,81,73,0.2)" : "rgba(255,202,40,0.2)"}`,
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
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: "6px",
                          }}
                        >
                          <span style={{ fontSize: "1.5rem" }}>
                            {rec.status === "completed"
                              ? "✅"
                              : rec.status === "failed"
                                ? "❌"
                                : "⏳"}
                          </span>
                          <div>
                            <p
                              style={{
                                color: "#e6edf3",
                                fontWeight: 700,
                                margin: 0,
                                fontSize: "0.95rem",
                              }}
                            >
                              {rec.fileName}
                            </p>
                            <p
                              style={{
                                color: "#8b949e",
                                fontSize: "0.75rem",
                                margin: "2px 0 0",
                              }}
                            >
                              {rec.subjectName} • {formatDate(rec.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            flexWrap: "wrap",
                            fontSize: "0.75rem",
                            color: "#8b949e",
                          }}
                        >
                          <span>📄 مستخرج: {rec.extractedCount || 0}</span>
                          <span>✅ مطابق: {rec.matchedCount || 0}</span>
                          <span
                            style={{
                              color:
                                rec.status === "completed"
                                  ? "#2ea043"
                                  : rec.status === "failed"
                                    ? "#f85149"
                                    : "#ffca28",
                              fontWeight: 600,
                            }}
                          >
                            {rec.status === "completed"
                              ? "مكتمل"
                              : rec.status === "failed"
                                ? "فشل"
                                : "قيد المعالجة"}
                          </span>
                        </div>
                        {rec.status === "failed" && rec.errorMessage && (
                          <p
                            style={{
                              color: "#f85149",
                              fontSize: "0.75rem",
                              margin: "4px 0 0",
                            }}
                          >
                            ⚠️ {rec.errorMessage}
                          </p>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            router.push(`/teacher/grades/analysis/${rec.id}`)
                          }
                          style={{
                            padding: "10px 18px",
                            borderRadius: "12px",
                            background:
                              "linear-gradient(135deg,#00e5ff,#0077b6)",
                            border: "none",
                            color: "#010204",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "'Cairo', sans-serif",
                            fontSize: "0.85rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <EyeIcon /> استكمل العملية
                        </motion.button>
                        <a
                          href={rec.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "8px 12px",
                            borderRadius: "10px",
                            background: "rgba(0,229,255,0.08)",
                            border: "1px solid rgba(0,229,255,0.2)",
                            color: "#00e5ff",
                            fontSize: "0.8rem",
                            textDecoration: "none",
                            fontFamily: "'Cairo', sans-serif",
                          }}
                        >
                          📥
                        </a>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDelete(rec.id)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "10px",
                            background: "rgba(248,81,73,0.1)",
                            border: "1px solid rgba(248,81,73,0.2)",
                            color: "#f85149",
                            cursor: "pointer",
                            fontFamily: "'Cairo', sans-serif",
                          }}
                        >
                          <DeleteIcon />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
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
      <Footer />
    </div>
  );
}
