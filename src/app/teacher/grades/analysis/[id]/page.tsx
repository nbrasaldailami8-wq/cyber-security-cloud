"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import { useAuthStore } from "@/store/authStore";
import { csrfFetch } from "@/lib/csrfClient";

interface MatchedStudent {
  dbName: string;
  dbId: string;
  extractedName: string;
  grade: string;
  feedback: string;
  matched: boolean;
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
const SearchIcon = () => (
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
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
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

export default function AnalysisDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();
  const userLevel = user?.level || "";

  const [students, setStudents] = useState<MatchedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [distInfo, setDistInfo] = useState<any>(null);
  const [publishType, setPublishType] = useState("");

  // نافذة البحث
  const [searchModal, setSearchModal] = useState<{
    show: boolean;
    index: number;
  }>({ show: false, index: -1 });
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; name: string }[]
  >([]);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/grades/list?limit=100");
      const data = await res.json();
      if (data.success) {
        const found = (data.data || []).find((d: any) => d.id === id);
        if (found) {
          setDistInfo(found);
          let matched = [];
          try {
            if (typeof found.distributionData === "string")
              matched = JSON.parse(found.distributionData).matched || [];
            else if (found.distributionData?.matched)
              matched = found.distributionData.matched;
          } catch {
            matched = [];
          }
          setStudents(matched);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const updateStudent = (index: number, field: string, value: string) => {
    const updated = [...students];
    (updated[index] as any)[field] = value;
    setStudents(updated);
  };

  // البحث عن طالب
  const searchStudent = async () => {
    if (!searchName.trim()) return;
    try {
      const params = new URLSearchParams();
      params.set("search", searchName.trim());
      if (userLevel) params.set("level", userLevel);
      params.set("role", "STUDENT");
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (data.success) setSearchResults(data.data || []);
    } catch {}
  };

  const selectStudent = (student: { id: string; name: string }) => {
    if (searchModal.index >= 0) {
      const updated = [...students];
      updated[searchModal.index].dbName = student.name;
      updated[searchModal.index].dbId = student.id;
      updated[searchModal.index].matched = true;
      setStudents(updated);
    }
    setSearchModal({ show: false, index: -1 });
    setSearchName("");
    setSearchResults([]);
  };

  // نشر
  const handlePublish = async () => {
    if (!publishType.trim()) {
      showToast("يرجى إدخال نوع التقييم (اختبار شهري/محصلة)", "warning");
      return;
    }
    setPublishing(true);
    try {
      const res = await csrfFetch("/api/grades/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distributionId: id,
          students,
          publishType: publishType.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`📊 تم نشر الدرجات`, "success");
        router.push("/teacher/grades");
      } else showToast(data.message, "error");
    } catch {
      showToast("فشل النشر", "error");
    } finally {
      setPublishing(false);
    }
  };

  const glassStyle: React.CSSProperties = {
    background: "rgba(10,20,40,0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0,229,255,0.12)",
    borderRadius: "18px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#e6edf3",
    fontSize: "0.8rem",
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
            padding: "100px 15px 60px",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              ...glassStyle,
              padding: "16px 20px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/teacher/grades/analysis")}
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
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
                    color: "#39ff14",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  🔍 مراجعة النتائج
                </h2>
              </div>
            </div>
            <span style={{ color: "#8b949e", fontSize: "0.75rem" }}>
              {distInfo?.fileName || ""} • {students.length} طالب
            </span>
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
          ) : students.length === 0 ? (
            <div
              style={{
                ...glassStyle,
                padding: "50px",
                textAlign: "center",
                color: "#8b949e",
              }}
            >
              📭 لا توجد بيانات
            </div>
          ) : (
            <>
              {/* الجدول */}
              <div
                style={{
                  ...glassStyle,
                  overflow: "hidden",
                  marginBottom: "20px",
                }}
              >
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.78rem",
                      minWidth: "600px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                          background: "rgba(0,0,0,0.3)",
                        }}
                      >
                        <th
                          style={{
                            padding: "8px 6px",
                            textAlign: "center",
                            color: "#ffca28",
                            fontSize: "0.7rem",
                          }}
                        >
                          الاسم في الملف
                        </th>
                        <th
                          style={{
                            padding: "8px 6px",
                            textAlign: "center",
                            color: "#8b949e",
                            fontSize: "0.7rem",
                          }}
                        >
                          الدرجة
                        </th>
                        <th
                          style={{
                            padding: "8px 6px",
                            textAlign: "center",
                            color: "#8b949e",
                            fontSize: "0.7rem",
                          }}
                        >
                          ملاحظات
                        </th>
                        <th
                          style={{
                            padding: "8px 6px",
                            textAlign: "center",
                            color: "#00e5ff",
                            fontSize: "0.7rem",
                          }}
                        >
                          الاسم في القاعدة
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s, i) => (
                        <tr
                          key={i}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.03)",
                          }}
                        >
                          <td
                            style={{
                              padding: "6px",
                              textAlign: "center",
                              color: "#ffca28",
                              fontSize: "0.78rem",
                            }}
                          >
                            {s.extractedName}
                          </td>
                          <td style={{ padding: "4px" }}>
                            <input
                              type="text"
                              value={s.grade}
                              onChange={(e) =>
                                updateStudent(i, "grade", e.target.value)
                              }
                              style={{
                                ...inputStyle,
                                textAlign: "center",
                                width: "55px",
                                margin: "0 auto",
                                display: "block",
                              }}
                            />
                          </td>
                          <td style={{ padding: "4px" }}>
                            <input
                              type="text"
                              value={s.feedback}
                              onChange={(e) =>
                                updateStudent(i, "feedback", e.target.value)
                              }
                              style={{
                                ...inputStyle,
                                textAlign: "center",
                                fontSize: "0.75rem",
                              }}
                            />
                          </td>
                          <td style={{ padding: "4px" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <input
                                type="text"
                                value={s.dbName}
                                onChange={(e) =>
                                  updateStudent(i, "dbName", e.target.value)
                                }
                                style={{
                                  ...inputStyle,
                                  textAlign: "center",
                                  flex: 1,
                                  fontSize: "0.75rem",
                                }}
                              />
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => {
                                  setSearchModal({ show: true, index: i });
                                  setSearchName("");
                                  setSearchResults([]);
                                }}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  background: "rgba(0,229,255,0.1)",
                                  border: "1px solid rgba(0,229,255,0.2)",
                                  color: "#00e5ff",
                                  cursor: "pointer",
                                  fontSize: "0.65rem",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <SearchIcon />
                              </motion.button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* رسالة النشر */}
              <div
                style={{
                  ...glassStyle,
                  padding: "16px 20px",
                  marginBottom: "20px",
                }}
              >
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    marginBottom: "10px",
                    textAlign: "center",
                  }}
                >
                  📢 رسالة النشر:{" "}
                  <span style={{ color: "#00e5ff" }}>
                    قام معلم {distInfo?.subjectName || "المادة"} برفع درجاتك في:
                  </span>
                </p>
                <input
                  type="text"
                  placeholder="مثال: الاختبار الشهري - المحصلة الشهرية"
                  value={publishType}
                  onChange={(e) => setPublishType(e.target.value)}
                  style={{
                    ...inputStyle,
                    textAlign: "center",
                    fontSize: "0.9rem",
                    padding: "10px",
                  }}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePublish}
                disabled={publishing}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg,#238636,#2ea043)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "1rem",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  opacity: publishing ? 0.6 : 1,
                }}
              >
                {publishing ? "⏳..." : "📢 نشر الدرجات"}
              </motion.button>
            </>
          )}

          {/* نافذة البحث */}
          <AnimatePresence>
            {searchModal.show && (
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
                onClick={() => setSearchModal({ show: false, index: -1 })}
              >
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    ...glassStyle,
                    padding: "25px",
                    maxWidth: "450px",
                    width: "100%",
                    maxHeight: "70vh",
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
                        color: "#00e5ff",
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        margin: 0,
                      }}
                    >
                      🔍 البحث عن طالب
                    </h3>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setSearchModal({ show: false, index: -1 })}
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
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "15px",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="اسم الطالب..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchStudent()}
                      style={{
                        ...inputStyle,
                        flex: 1,
                        padding: "10px",
                        fontSize: "0.9rem",
                      }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={searchStudent}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg,#00e5ff,#0077b6)",
                        border: "none",
                        color: "#010204",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      <SearchIcon />
                    </motion.button>
                  </div>
                  {searchResults.map((st) => (
                    <motion.button
                      key={st.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => selectStudent(st)}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "#e6edf3",
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                        textAlign: "right",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        marginBottom: "4px",
                      }}
                    >
                      {st.name}
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </PageTransition>
      <Footer />
    </div>
  );
}
