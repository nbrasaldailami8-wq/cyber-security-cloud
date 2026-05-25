"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";

interface StudentItem {
  id: string;
  name: string;
  email: string;
  level: string;
  createdAt: string;
}

interface LevelData {
  level: string;
  label: string;
  totalStudents: number;
  students: StudentItem[];
  nextLevel: string | null;
  nextLabel: string | null;
}

export default function PromotePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [levels, setLevels] = useState<LevelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<string>("LEVEL_1");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [excludedStudents, setExcludedStudents] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentItem[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [message, setMessage] = useState("");

  const effectiveRole =
    user?.role === "ADMIN"
      ? "ADMIN"
      : user?.managementLevel
        ? "MANAGEMENT"
        : user?.role;
  const userLevel = user?.level || "LEVEL_1";

  const allLevels = ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"];
  const availableLevels = effectiveRole === "ADMIN" ? allLevels : [userLevel];

  const levelLabels: Record<string, string> = {
    LEVEL_1: "المستوى الأول",
    LEVEL_2: "المستوى الثاني",
    LEVEL_3: "المستوى الثالث",
    LEVEL_4: "المستوى الرابع",
  };

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/semester/promote?action=preview");
      const data = await res.json();
      if (data.success) {
        setLevels(data.data);
        if (
          data.data.length > 0 &&
          !data.data.find((l: LevelData) => l.level === activeLevel)
        ) {
          setActiveLevel(data.data[0].level);
        }
      }
    } catch (err) {
      console.error("Promote load error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeLevel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useSupabaseRealtime(deriveStaticChannelName("semester"), "promotion-update", () => {
    loadData();
  });

  const activeLevelData = levels.find((l) => l.level === activeLevel);
  const studentsToPromote =
    activeLevelData?.students.filter((s) => !excludedStudents.includes(s.id)) ||
    [];

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    const results =
      activeLevelData?.students.filter(
        (s) =>
          s.name.includes(q) || s.email.toLowerCase().includes(q.toLowerCase()),
      ) || [];
    setSearchResults(results);
  };

  const handleExclude = (studentId: string) => {
    if (!excludedStudents.includes(studentId)) {
      setExcludedStudents((prev) => [...prev, studentId]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveExclusion = (studentId: string) => {
    setExcludedStudents((prev) => prev.filter((id) => id !== studentId));
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === studentsToPromote.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(studentsToPromote.map((s) => s.id));
    }
  };

  const handlePromote = async () => {
    setPromoting(true);
    setMessage("");
    try {
      const res = await fetch("/api/semester/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: activeLevel,
          studentIds: studentsToPromote.map((s) => s.id),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ تم ترقية ${studentsToPromote.length} طالب بنجاح`);
        setShowConfirm(false);
        setSelectedStudents([]);
        setExcludedStudents([]);
        loadData();
      } else {
        setMessage(`❌ ${data.error || "حدث خطأ"}`);
      }
    } catch {
      setMessage("❌ حدث خطأ في الاتصال");
    } finally {
      setPromoting(false);
    }
  };

  const getHomePath = () => {
    if (effectiveRole === "ADMIN") return "/admin/semester";
    return "/admin/semester";
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
      <Sidebar />
      <PageTransition>
        <main
          style={{
            padding: "100px 16px 60px",
            maxWidth: "1100px",
            margin: "0 auto",
          }}
        >
          {/* الهيدر */}
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ marginBottom: "24px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push(getHomePath())}
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
                    color: "#bf5af2",
                    fontSize: "clamp(1.3rem, 2.5vw, 1.7rem)",
                    fontWeight: 900,
                    margin: 0,
                    textShadow: "0 0 20px rgba(191,90,242,0.3)",
                  }}
                >
                  🎓 ترقية المستويات
                </h2>
              </div>
            </div>
          </motion.div>

          {/* أيقونات المستويات */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "24px",
            }}
          >
            {availableLevels.map((level) => (
              <motion.button
                key={level}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setActiveLevel(level);
                  setSelectedStudents([]);
                  setExcludedStudents([]);
                  setSearchQuery("");
                }}
                style={{
                  background:
                    activeLevel === level
                      ? "rgba(191,90,242,0.12)"
                      : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${activeLevel === level ? "rgba(191,90,242,0.5)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "14px",
                  padding: "10px 20px",
                  color: activeLevel === level ? "#bf5af2" : "#8b949e",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: activeLevel === level ? 700 : 500,
                  transition: "all 0.25s ease",
                }}
              >
                {levelLabels[level]}
              </motion.button>
            ))}
          </motion.div>

          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: message.includes("✅")
                  ? "rgba(46,160,67,0.1)"
                  : "rgba(255,49,49,0.1)",
                border: `1px solid ${message.includes("✅") ? "rgba(46,160,67,0.3)" : "rgba(255,49,49,0.3)"}`,
                borderRadius: "12px",
                padding: "12px 18px",
                marginBottom: "20px",
                color: message.includes("✅") ? "#2ea043" : "#ff3131",
                fontSize: "0.9rem",
                textAlign: "center",
              }}
            >
              {message}
            </motion.div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px" }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                style={{
                  width: "40px",
                  height: "40px",
                  border: "3px solid rgba(191,90,242,0.2)",
                  borderTopColor: "#bf5af2",
                  borderRadius: "50%",
                  margin: "0 auto 16px",
                }}
              />
              <p style={{ color: "#8b949e" }}>جاري تحميل البيانات...</p>
            </div>
          ) : activeLevelData ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              style={{
                background: "rgba(13,17,23,0.85)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(48,54,61,0.5)",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
              }}
            >
              {/* إحصائيات */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h3
                    style={{
                      color: "#e6edf3",
                      margin: "0 0 4px",
                      fontSize: "1.1rem",
                    }}
                  >
                    {activeLevelData.label}
                  </h3>
                  <p
                    style={{ color: "#8b949e", fontSize: "0.85rem", margin: 0 }}
                  >
                    👥 عدد الطلاب:{" "}
                    <span style={{ color: "#bf5af2", fontWeight: 700 }}>
                      {activeLevelData.totalStudents}
                    </span>
                  </p>
                </div>
                {activeLevelData.nextLabel && (
                  <div
                    style={{
                      background: "rgba(46,160,67,0.1)",
                      border: "1px solid rgba(46,160,67,0.3)",
                      borderRadius: "12px",
                      padding: "8px 16px",
                      color: "#2ea043",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                    }}
                  >
                    📈 الترقية إلى: {activeLevelData.nextLabel}
                  </div>
                )}
              </div>

              {/* محرك بحث للاستثناء */}
              <div style={{ marginBottom: "16px", position: "relative" }}>
                <input
                  type="text"
                  placeholder="🔍 بحث عن طالب لاستثنائه..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{
                    width: "100%",
                    background: "rgba(22,27,34,0.8)",
                    border: "1px solid rgba(48,54,61,0.5)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    color: "#e6edf3",
                    fontSize: "0.9rem",
                    fontFamily: "'Cairo', sans-serif",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {searchResults.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "rgba(13,17,23,0.98)",
                      border: "1px solid rgba(48,54,61,0.5)",
                      borderRadius: "0 0 12px 12px",
                      maxHeight: "200px",
                      overflowY: "auto",
                      zIndex: 10,
                    }}
                  >
                    {searchResults.map((student) => (
                      <div
                        key={student.id}
                        onClick={() => handleExclude(student.id)}
                        style={{
                          padding: "10px 16px",
                          cursor: "pointer",
                          borderBottom: "1px solid rgba(255,255,255,0.03)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: "#e6edf3" }}>{student.name}</span>
                        <span
                          style={{
                            color: "#ffca28",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          استثناء ✕
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* الطلاب المستثنون */}
              {excludedStudents.length > 0 && (
                <div
                  style={{
                    marginBottom: "16px",
                    padding: "12px",
                    background: "rgba(255,202,40,0.06)",
                    border: "1px solid rgba(255,202,40,0.2)",
                    borderRadius: "10px",
                  }}
                >
                  <p
                    style={{
                      color: "#ffca28",
                      fontSize: "0.8rem",
                      margin: "0 0 8px",
                    }}
                  >
                    ⚠️ طلاب مستثنون من الترقية ({excludedStudents.length})
                  </p>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
                  >
                    {excludedStudents.map((id) => {
                      const student = activeLevelData.students.find(
                        (s) => s.id === id,
                      );
                      return student ? (
                        <span
                          key={id}
                          onClick={() => handleRemoveExclusion(id)}
                          style={{
                            background: "rgba(255,202,40,0.1)",
                            border: "1px solid rgba(255,202,40,0.3)",
                            borderRadius: "20px",
                            padding: "4px 12px",
                            fontSize: "0.75rem",
                            color: "#ffca28",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {student.name} ✕
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* تحديد الكل */}
              <div
                onClick={handleSelectAll}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                  marginBottom: "16px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    selectedStudents.length === studentsToPromote.length &&
                    studentsToPromote.length > 0
                  }
                  onChange={handleSelectAll}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <span style={{ color: "#e6edf3", fontWeight: 600 }}>
                  تحديد الكل ({studentsToPromote.length} طالب)
                </span>
              </div>

              {/* زر الترقية */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowConfirm(true)}
                disabled={
                  studentsToPromote.length === 0 || !activeLevelData.nextLevel
                }
                style={{
                  width: "100%",
                  padding: "16px",
                  background:
                    studentsToPromote.length === 0
                      ? "rgba(255,255,255,0.05)"
                      : "linear-gradient(135deg, rgba(191,90,242,0.3), rgba(191,90,242,0.1))",
                  border: `1.5px solid ${studentsToPromote.length === 0 ? "rgba(255,255,255,0.1)" : "rgba(191,90,242,0.4)"}`,
                  borderRadius: "14px",
                  color: studentsToPromote.length === 0 ? "#8b949e" : "#bf5af2",
                  cursor:
                    studentsToPromote.length === 0 ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  fontSize: "1.05rem",
                  fontFamily: "'Cairo', sans-serif",
                  transition: "all 0.3s ease",
                }}
              >
                🚀 ترقية {studentsToPromote.length} طالب إلى{" "}
                {activeLevelData.nextLabel || "..."}
              </motion.button>
            </motion.div>
          ) : null}
        </main>
      </PageTransition>

      {/* نافذة التأكيد */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowConfirm(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(5px)",
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
                border: "1px solid rgba(191,90,242,0.4)",
                borderRadius: "18px",
                padding: "28px",
                maxWidth: "480px",
                width: "100%",
                boxShadow: "0 25px 70px rgba(0,0,0,0.7)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>⚠️</div>
              <h3
                style={{
                  color: "#ffca28",
                  margin: "0 0 12px",
                  fontSize: "1.2rem",
                }}
              >
                تأكيد الترقية
              </h3>
              <p
                style={{
                  color: "#e6edf3",
                  marginBottom: "8px",
                  fontSize: "0.95rem",
                }}
              >
                سيتم ترقية{" "}
                <strong style={{ color: "#bf5af2" }}>
                  {studentsToPromote.length}
                </strong>{" "}
                طالب
              </p>
              <p
                style={{
                  color: "#8b949e",
                  marginBottom: "8px",
                  fontSize: "0.85rem",
                }}
              >
                من <strong>{activeLevelData?.label}</strong> إلى{" "}
                <strong>{activeLevelData?.nextLabel}</strong>
              </p>
              <p
                style={{
                  color: "#ff3131",
                  marginBottom: "20px",
                  fontSize: "0.8rem",
                }}
              >
                ⚠️ سيتم حذف جميع تكاليفهم ودرجاتهم ومحادثاتهم القديمة
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowConfirm(false)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  إلغاء
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePromote}
                  disabled={promoting}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "linear-gradient(135deg, #bf5af2, #7a00ff)",
                    border: "none",
                    borderRadius: "12px",
                    color: "#fff",
                    cursor: promoting ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    opacity: promoting ? 0.7 : 1,
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  {promoting ? "⚡ جاري الترقية..." : "✅ تأكيد الترقية"}
                </motion.button>
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
          background: rgba(191, 90, 242, 0.12);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
