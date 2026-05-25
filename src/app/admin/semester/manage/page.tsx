"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  isVisible: boolean;
  teacher?: { name: string } | null;
}

interface LevelData {
  level: string;
  label: string;
  term1Subjects: SubjectItem[];
  term2Subjects: SubjectItem[];
}

export default function SemesterManagePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [levels, setLevels] = useState<LevelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState("LEVEL_1");
  const [activeTerm, setActiveTerm] = useState<"TERM_1" | "TERM_2" | null>(
    null,
  );
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);

  // 1. التحقق أولاً إذا كان المستخدم أدمن، وإلا نتحقق من صلاحيات الإدارة أو الدور العادي
  const effectiveRole =
    user?.role === "ADMIN"
      ? "ADMIN"
      : user?.managementLevel
        ? "MANAGEMENT"
        : user?.role;

  const userLevel = user?.level || "LEVEL_1";

  const allLevels = ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"];

  // 2. هنا الأدمن فقط يرى جميع المستويات [LEVEL_1, LEVEL_2...]
  // أما الإدارة (MANAGEMENT) أو المرقون فيرون مصفوفة تحتوي على مستواهم المحدد فقط [userLevel]
  const availableLevels = effectiveRole === "ADMIN" ? allLevels : [userLevel];

  const levelLabels: Record<string, string> = {
    LEVEL_1: "المستوى ١",
    LEVEL_2: "المستوى ٢",
    LEVEL_3: "المستوى ٣",
    LEVEL_4: "المستوى ٤",
  };

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/semester/subjects");
      const data = await res.json();
      if (data.success) {
        setLevels(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useSupabaseRealtime(deriveStaticChannelName("semester"), "subjects-update", () => {
    loadData();
  });

  const activeLevelData = levels.find((l) => l.level === activeLevel);

  const handleSelectAll = (term: "TERM_1" | "TERM_2") => {
    const subjects =
      term === "TERM_1"
        ? activeLevelData?.term1Subjects || []
        : activeLevelData?.term2Subjects || [];
    const allIds = subjects.map((s) => s.id);
    const allSelected = allIds.every((id) => selectedSubjects.includes(id));
    if (allSelected) {
      setSelectedSubjects((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedSubjects((prev) => [...new Set([...prev, ...allIds])]);
    }
  };

  const handleToggleSubject = (id: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleAction = async (action: "hide" | "show") => {
    if (selectedSubjects.length === 0) return;
    setActionLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/semester/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectIds: selectedSubjects,
          isVisible: action === "show",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(
          `✅ تم ${action === "hide" ? "إخفاء" : "إظهار"} ${selectedSubjects.length} مادة بنجاح`,
        );
        setSelectedSubjects([]);
        setActiveTerm(null);
        setShowDrawer(false);
        loadData();
      } else {
        setMessage(`❌ ${data.error || "حدث خطأ"}`);
      }
    } catch {
      setMessage("❌ حدث خطأ في الاتصال");
    } finally {
      setActionLoading(false);
    }
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
        <div
          style={{
            padding: "100px 12px 60px",
            maxWidth: "1000px",
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* الهيدر */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => router.push("/admin/semester")}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "8px 14px",
                color: "#8b949e",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontFamily: "'Cairo', sans-serif",
              }}
            >
              ⬅ رجوع
            </button>
            <h2
              style={{
                color: "#00e5ff",
                fontSize: "clamp(1.1rem, 4vw, 1.5rem)",
                fontWeight: 800,
                margin: 0,
              }}
            >
              📅 إدارة الترم الدراسي
            </h2>
          </div>

          {/* أيقونات المستويات */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            {availableLevels.map((level) => (
              <button
                key={level}
                onClick={() => {
                  setActiveLevel(level);
                  setActiveTerm(null);
                  setSelectedSubjects([]);
                }}
                style={{
                  background:
                    activeLevel === level
                      ? "rgba(0,229,255,0.15)"
                      : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${activeLevel === level ? "rgba(0,229,255,0.6)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "12px",
                  padding: "10px 16px",
                  color: activeLevel === level ? "#00e5ff" : "#8b949e",
                  cursor: "pointer",
                  fontSize: "clamp(0.8rem, 3.5vw, 0.95rem)",
                  fontWeight: activeLevel === level ? 700 : 500,
                  fontFamily: "'Cairo', sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                {levelLabels[level]}
              </button>
            ))}
          </div>

          {message && (
            <div
              style={{
                background: message.includes("✅")
                  ? "rgba(46,160,67,0.1)"
                  : "rgba(255,49,49,0.1)",
                border: `1px solid ${message.includes("✅") ? "rgba(46,160,67,0.3)" : "rgba(255,49,49,0.3)"}`,
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "16px",
                color: message.includes("✅") ? "#2ea043" : "#ff3131",
                fontSize: "0.9rem",
                textAlign: "center",
              }}
            >
              {message}
            </div>
          )}

          {loading ? (
            <div
              style={{ textAlign: "center", padding: "60px", color: "#8b949e" }}
            >
              ⏳ جاري التحميل...
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "14px",
              }}
            >
              {/* مواد الترم الأول */}
              <div
                onClick={() => {
                  setActiveTerm("TERM_1");
                  setSelectedSubjects([]);
                  setShowDrawer(true);
                }}
                style={{
                  background:
                    activeTerm === "TERM_1"
                      ? "rgba(0,229,255,0.06)"
                      : "rgba(13,17,23,0.85)",
                  backdropFilter: "blur(12px)",
                  border: `1.5px solid ${activeTerm === "TERM_1" ? "rgba(0,229,255,0.4)" : "rgba(48,54,61,0.5)"}`,
                  borderRadius: "16px",
                  padding: "20px",
                  cursor: "pointer",
                  textAlign: "center",
                  boxShadow:
                    activeTerm === "TERM_1"
                      ? "0 0 25px rgba(0,229,255,0.1)"
                      : "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📗</div>
                <h3
                  style={{
                    color: "#00e5ff",
                    margin: "0 0 6px",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                  }}
                >
                  مواد الترم الأول
                </h3>
                <p style={{ color: "#8b949e", fontSize: "0.85rem", margin: 0 }}>
                  {activeLevelData?.term1Subjects.length || 0} مادة
                </p>
              </div>

              {/* مواد الترم الثاني */}
              <div
                onClick={() => {
                  setActiveTerm("TERM_2");
                  setSelectedSubjects([]);
                  setShowDrawer(true);
                }}
                style={{
                  background:
                    activeTerm === "TERM_2"
                      ? "rgba(191,90,242,0.06)"
                      : "rgba(13,17,23,0.85)",
                  backdropFilter: "blur(12px)",
                  border: `1.5px solid ${activeTerm === "TERM_2" ? "rgba(191,90,242,0.4)" : "rgba(48,54,61,0.5)"}`,
                  borderRadius: "16px",
                  padding: "20px",
                  cursor: "pointer",
                  textAlign: "center",
                  boxShadow:
                    activeTerm === "TERM_2"
                      ? "0 0 25px rgba(191,90,242,0.1)"
                      : "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📘</div>
                <h3
                  style={{
                    color: "#bf5af2",
                    margin: "0 0 6px",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                  }}
                >
                  مواد الترم الثاني
                </h3>
                <p style={{ color: "#8b949e", fontSize: "0.85rem", margin: 0 }}>
                  {activeLevelData?.term2Subjects.length || 0} مادة
                </p>
              </div>
            </div>
          )}
        </div>
      </PageTransition>

      {/* الدرج الجانبي */}
      {showDrawer && activeTerm && activeLevelData && (
        <div
          onClick={() => {
            setShowDrawer(false);
            setActiveTerm(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(13,17,23,0.98)",
              border: "1px solid rgba(48,54,61,0.5)",
              borderRadius: "16px",
              padding: "18px",
              width: "100%",
              maxWidth: "480px",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <h3
                style={{
                  color: activeTerm === "TERM_1" ? "#00e5ff" : "#bf5af2",
                  margin: 0,
                  fontSize: "1.1rem",
                }}
              >
                {activeTerm === "TERM_1"
                  ? "📗 مواد الترم الأول"
                  : "📘 مواد الترم الثاني"}
              </h3>
              <button
                onClick={() => {
                  setShowDrawer(false);
                  setActiveTerm(null);
                }}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  color: "#8b949e",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                }}
              >
                ✕
              </button>
            </div>

            <div
              onClick={() => handleSelectAll(activeTerm)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "8px",
                marginBottom: "10px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={
                  (activeTerm === "TERM_1"
                    ? activeLevelData.term1Subjects
                    : activeLevelData.term2Subjects
                  ).every((s) => selectedSubjects.includes(s.id)) &&
                  (activeTerm === "TERM_1"
                    ? activeLevelData.term1Subjects
                    : activeLevelData.term2Subjects
                  ).length > 0
                }
                onChange={() => handleSelectAll(activeTerm)}
                style={{ width: "18px", height: "18px" }}
              />
              <span style={{ color: "#e6edf3", fontWeight: 600 }}>
                تحديد الكل
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginBottom: "14px",
              }}
            >
              {(activeTerm === "TERM_1"
                ? activeLevelData.term1Subjects
                : activeLevelData.term2Subjects
              ).map((subject) => (
                <div
                  key={subject.id}
                  onClick={() => handleToggleSubject(subject.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px",
                    background: selectedSubjects.includes(subject.id)
                      ? "rgba(0,229,255,0.06)"
                      : "transparent",
                    border: `1px solid ${selectedSubjects.includes(subject.id) ? "rgba(0,229,255,0.3)" : "rgba(255,255,255,0.04)"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(subject.id)}
                    onChange={() => handleToggleSubject(subject.id)}
                    style={{ width: "16px", height: "16px", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: "#e6edf3",
                        fontSize: "0.9rem",
                        wordBreak: "break-word",
                      }}
                    >
                      {subject.name}
                    </div>
                    <div style={{ color: "#8b949e", fontSize: "0.7rem" }}>
                      {subject.code}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: "12px",
                      fontSize: "0.65rem",
                      background: subject.isVisible
                        ? "rgba(46,160,67,0.12)"
                        : "rgba(255,49,49,0.12)",
                      color: subject.isVisible ? "#2ea043" : "#ff3131",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {subject.isVisible ? "ظاهر" : "مخفي"}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => handleAction("show")}
                disabled={selectedSubjects.length === 0 || actionLoading}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "rgba(46,160,67,0.15)",
                  border: "1px solid rgba(46,160,67,0.3)",
                  borderRadius: "10px",
                  color: "#2ea043",
                  cursor:
                    selectedSubjects.length === 0 ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  fontFamily: "'Cairo', sans-serif",
                  opacity: selectedSubjects.length === 0 ? 0.5 : 1,
                }}
              >
                👁 إظهار
              </button>
              <button
                onClick={() => handleAction("hide")}
                disabled={selectedSubjects.length === 0 || actionLoading}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "rgba(255,49,49,0.15)",
                  border: "1px solid rgba(255,49,49,0.3)",
                  borderRadius: "10px",
                  color: "#ff3131",
                  cursor:
                    selectedSubjects.length === 0 ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  fontFamily: "'Cairo', sans-serif",
                  opacity: selectedSubjects.length === 0 ? 0.5 : 1,
                }}
              >
                🗑 إخفاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
