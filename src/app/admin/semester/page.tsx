"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";

interface SemesterStats {
  totalLevels: number;
  totalSubjects: number;
  levelBreakdown: {
    level: string;
    label: string;
    term1Subjects: number;
    term2Subjects: number;
    totalStudents: number;
    lastPromotion: string | null;
  }[];
}

export default function SemesterPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<SemesterStats | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveRole =
    user?.role === "ADMIN"
      ? "ADMIN"
      : user?.managementLevel
        ? "MANAGEMENT"
        : user?.role;
  const userLevel = user?.level || "LEVEL_1";

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/semester/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error("Semester stats error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useSupabaseRealtime(deriveStaticChannelName("semester"), "stats-update", () => {
    loadStats();
  });

  const getHomePath = () => {
    if (effectiveRole === "ADMIN") return "/admin";
    if (effectiveRole === "MANAGEMENT") return "/management";
    if (effectiveRole === "TEACHER") return "/teacher";
    return "/student";
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
            padding: "90px 12px 50px",
            maxWidth: "900px",
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
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => router.push(getHomePath())}
                style={{
                  background: "rgba(255,255,255,0.04)",
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
              <h1
                style={{
                  color: "#00e5ff",
                  fontSize: "clamp(1.2rem, 5vw, 1.7rem)",
                  fontWeight: 900,
                  margin: 0,
                }}
              >
                📚 إدارة الترم والمستويات
              </h1>
            </div>
            {user && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    background: "rgba(0,229,255,0.12)",
                    color: "#00e5ff",
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {user.name}
                </span>
                <span
                  style={{
                    background: "rgba(191,90,242,0.12)",
                    color: "#bf5af2",
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                  }}
                >
                  {effectiveRole === "ADMIN" ? "أدمن" : "إدارة"}
                </span>
                {user.level && (
                  <span
                    style={{
                      background: "rgba(255,202,40,0.12)",
                      color: "#ffca28",
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "0.75rem",
                    }}
                  >
                    {user.level.replace("LEVEL_", "المستوى ")}
                  </span>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div
              style={{ textAlign: "center", padding: "60px", color: "#8b949e" }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "3px solid rgba(0,229,255,0.2)",
                  borderTopColor: "#00e5ff",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 16px",
                }}
              />
              جاري تحميل البيانات...
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              {/* حقل إدارة الترم */}
              <div
                onClick={() => router.push("/admin/semester/manage")}
                style={{
                  background: "rgba(13,17,23,0.85)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(0,229,255,0.25)",
                  borderRadius: "18px",
                  padding: "22px 18px",
                  cursor: "pointer",
                  boxShadow: "0 6px 25px rgba(0,0,0,0.35)",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    marginBottom: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "14px",
                      background:
                        "linear-gradient(135deg, rgba(0,229,255,0.2), rgba(0,229,255,0.05))",
                      border: "1px solid rgba(0,229,255,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      flexShrink: 0,
                    }}
                  >
                    📅
                  </div>
                  <h2
                    style={{
                      color: "#00e5ff",
                      fontSize: "clamp(1.1rem, 4vw, 1.3rem)",
                      fontWeight: 800,
                      margin: 0,
                    }}
                  >
                    إدارة الترم الدراسي
                  </h2>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "20px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                      عدد المستويات
                    </span>
                    <div
                      style={{
                        color: "#00e5ff",
                        fontWeight: 700,
                        fontSize: "1.1rem",
                      }}
                    >
                      {stats?.totalLevels || 0}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                      المواد المولدة
                    </span>
                    <div
                      style={{
                        color: "#39ff14",
                        fontWeight: 700,
                        fontSize: "1.1rem",
                      }}
                    >
                      {stats?.totalSubjects || 0}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    color: "#00e5ff",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    textAlign: "center",
                    padding: "10px",
                    background: "rgba(0,229,255,0.05)",
                    borderRadius: "10px",
                  }}
                >
                  📋 إدارة المواد حسب الترم ←
                </div>
              </div>

              {/* حقل ترقية المستويات */}
              <div
                onClick={() => router.push("/admin/semester/promote")}
                style={{
                  background: "rgba(13,17,23,0.85)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(191,90,242,0.25)",
                  borderRadius: "18px",
                  padding: "22px 18px",
                  cursor: "pointer",
                  boxShadow: "0 6px 25px rgba(0,0,0,0.35)",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    marginBottom: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "14px",
                      background:
                        "linear-gradient(135deg, rgba(191,90,242,0.2), rgba(191,90,242,0.05))",
                      border: "1px solid rgba(191,90,242,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      flexShrink: 0,
                    }}
                  >
                    🎓
                  </div>
                  <h2
                    style={{
                      color: "#bf5af2",
                      fontSize: "clamp(1.1rem, 4vw, 1.3rem)",
                      fontWeight: 800,
                      margin: 0,
                    }}
                  >
                    ترقية المستويات
                  </h2>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginBottom: "14px",
                  }}
                >
                  {stats?.levelBreakdown
                    ?.filter((l) => {
                      if (effectiveRole === "ADMIN") return true;
                      return l.level === userLevel;
                    })
                    .map((level) => (
                      <div
                        key={level.level}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          color: "#8b949e",
                          fontSize: "0.85rem",
                        }}
                      >
                        <span>{level.label}</span>
                        <span style={{ color: "#bf5af2", fontWeight: 700 }}>
                          {level.totalStudents} طالب
                        </span>
                      </div>
                    ))}
                </div>
                <div
                  style={{
                    color: "#bf5af2",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    textAlign: "center",
                    padding: "10px",
                    background: "rgba(191,90,242,0.05)",
                    borderRadius: "10px",
                  }}
                >
                  🚀 نقل الطلاب للمستوى التالي ←
                </div>
              </div>
            </div>
          )}
        </main>
      </PageTransition>
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
